import './ui/style.css';
import * as THREE from 'three';
import { FOG, FOG_THICK } from './art/palette';
import { createSkyTexture } from './art/textures';
import { createAudio } from './engine/audio';
import { createFollowCamera } from './engine/camera';
import { combineInputs } from './engine/input';
import { createHaptics } from './engine/haptics';
import { createKeyboard } from './engine/input/keyboard';
import { createTilt } from './engine/input/tilt';
import { createJoystick } from './engine/input/touch';
import { startLoop } from './engine/loop';
import type { Vec2 } from './engine/math';
import { createFrameStats, createQualityGovernor } from './engine/perf';
import { initPhysics, type GravityDirection } from './engine/physics';
import { bindResize, createRenderContext, followSun, lowerQuality } from './engine/renderer';
import { createEffectAura } from './game/effectAura';
import { createEventBus, type GameEvents } from './game/events';
import { bindHapticFeedback } from './game/hapticFeedback';
import { createRecorder } from './game/replay';
import { bindSoundEffects } from './game/sfx';
import { createStage, type Stage } from './game/stage';
import { pick, t } from './i18n';
import { EDITOR_LEVEL_KEY, fetchLevel } from './levels/catalog';
import { loadLevel } from './levels/loader';
import type { Level } from './levels/schema';
import { CAMPAIGN, nextLevel, WORLDS, worldOfLevel } from './levels/worlds';
import { isLevelOpen, isWorldOpen, resumeLevel } from './meta/progress';
import { createProgressStore, createSettingsStore } from './meta/store';
import { onBackground } from './platform/lifecycle';
import { webStorage } from './platform/storage';
import { mountUi } from './ui/app';
import { byId } from './ui/dom';
import { downloadJson } from './ui/download';
import { bindHud } from './ui/hud/hud';
import { createMinimap } from './ui/hud/minimap';
import { bindPerfOverlay } from './ui/hud/perf';
import { createUiStore } from './ui/state';
import { createToast } from './ui/toast';

// Tells the inline watchdog in index.html that the bundle loaded.
Object.assign(window, { __ok: true });

const params = new URLSearchParams(location.search);
/** `?level=id` plays one level straight from the title (campaign, sandbox, editor…). */
const directLevel = params.get('level') ?? undefined;
/** `?unlock` opens every world and level, for testing. */
const unlockAll = params.has('unlock');

const fetchAnyLevel = async (id: string): Promise<Level> => {
  if (id !== 'editor') return fetchLevel(id);
  const saved = await webStorage.get(EDITOR_LEVEL_KEY);
  return loadLevel(JSON.parse(saved ?? 'null'));
};

const canvas = byId<HTMLCanvasElement>('c');
const { renderer, scene, sun } = createRenderContext(canvas, {
  background: createSkyTexture(),
  fogColor: FOG.color,
  fogNear: FOG.near,
  fogFar: FOG.far,
});
const follow = createFollowCamera();
bindResize(renderer, follow.camera);

await initPhysics();
const events = createEventBus<GameEvents>();
const [settingsStore, progressStore] = await Promise.all([
  createSettingsStore(webStorage),
  createProgressStore(webStorage),
]);
const settings = () => settingsStore.getState().settings;
const progress = () => progressStore.getState().progress;
const usesTilt = () => settings().controlMode === 'tilt';
const ui = createUiStore();
const screen = () => ui.getState().screen.name;

const audio = createAudio(() => settings().sound);
const haptics = createHaptics(() => settings().haptics);
const toast = createToast();
const tilt = createTilt(() => ({
  fullTiltDeg: settings().tiltRangeDeg,
  invertX: settings().invertX,
  invertY: settings().invertY,
}));
const joystick = createJoystick({ surface: canvas, base: byId('joy'), knob: byId('knob') }, () => ({
  sensitivity: settings().touchSensitivity,
  invertX: settings().invertX,
  invertY: settings().invertY,
}));
const playerInput = combineInputs(joystick, createKeyboard(), { read: () => (usesTilt() ? tilt.read() : null) });

let stage: Stage | undefined;
// `?record` keeps every input of a run and downloads it as a replay when the level is won.
const recorder = createRecorder(() => stage?.session.state() === 'play');
const recorded = params.has('record') ? recorder.wrap(playerInput) : playerInput;
const STILL: Vec2 = { x: 0, y: 0 };
/** The level behind the menus stays still; `?bot` lets the autopilot play. */
const readInput = (): Vec2 => (screen() === 'play' ? (stage?.autopilot() ?? recorded()) : STILL);

let tiltEnabled = false;
const enableTilt = async () => {
  if (!tiltEnabled) await tilt.enable();
  tiltEnabled = true;
  tilt.resetCalibration();
};
// Switching to tilt in the settings happens inside the tap, which iOS needs to grant the sensor.
settingsStore.subscribe(({ settings: next }, { settings: before }) => {
  if (next.controlMode === 'tilt' && before.controlMode !== 'tilt') void enableTilt();
});

bindSoundEffects(events, audio);
bindHapticFeedback(events, haptics);
bindHud(events, toast);
events.on('respawned', ({ x, y, z }) => follow.snapTo(x, y, z));
const SHAKERS = new Set(['bumper', 'pusher', 'sweeper']);
events.on('modifierFired', ({ type }) => {
  if (SHAKERS.has(type)) follow.shake(0.22);
});
const aura = createEffectAura(scene);
events.on('paused', () => {
  joystick.release();
  ui.getState().go({ name: 'pause' });
});
events.on('resumed', () => ui.getState().go({ name: 'play' }));
events.on('reset', recorder.clear);

const minimap = createMinimap(byId<HTMLCanvasElement>('minimap'));
/** Redraws the minimap about 20 times a second: it does not need every frame. */
let mapClock = 0;
const updateMinimap = ({ world, ball }: Stage, dt: number) => {
  mapClock += dt;
  if (mapClock < 0.05) return;
  mapClock = 0;
  const { x, z } = ball.mesh.position;
  minimap.draw({
    ball: { x, z },
    crystals: world.crystals.map((c) => ({ x: c.position[0], z: c.position[2], taken: c.taken })),
    checkpoints: world.checkpoints.map((c) => ({ x: c.x, z: c.z, active: c.active })),
    goal: { x: world.goal.x, z: world.goal.z, open: world.crystals.every((c) => c.taken) },
  });
};

/** Builds a level in place of the current one. The last request wins when several overlap. */
let loading = 0;
const mount = async (id: string): Promise<Stage | undefined> => {
  const ticket = ++loading;
  const level = await fetchAnyLevel(id);
  if (level.signs.length) await document.fonts.ready;
  if (ticket !== loading) return undefined;
  stage?.dispose();
  stage = createStage(level, { scene, events, text: pick, bot: params.has('bot') });
  minimap.setLevel(level);
  const { x, y, z } = stage.world.spawn;
  follow.snapTo(x, y, z);
  return stage;
};

const showBackdrop = (id: string) => {
  if (stage?.level.id !== id) void mount(id).catch((error: unknown) => console.error(error));
};

let firstRun = true;
/** Starts (or restarts) the run of the loaded level. */
const begin = () => {
  if (!stage) return;
  audio.unlock();
  if (usesTilt()) tilt.resetCalibration();
  stage.session.start();
  ui.getState().go({ name: 'play' });
  if (!firstRun) return;
  firstRun = false;
  if (!usesTilt()) toast(t().touchHint, 2600);
  else
    setTimeout(() => {
      if (tilt.hasReading()) return toast(t().tiltReady, 1500);
      settingsStore.getState().update({ controlMode: 'touch' });
      toast(t().tiltUnavailable, 4500);
    }, 1200);
};

const play = (id: string) => {
  audio.unlock();
  if (stage?.level.id === id) return begin();
  ui.getState().go({ name: 'loading' });
  mount(id)
    .then((loaded) => loaded && begin())
    .catch((error: unknown) => {
      console.error(error);
      ui.getState().go({ name: 'map' });
    });
};

const quit = () => {
  if (!stage) return;
  stage.session.stop();
  const world = worldOfLevel(stage.level.id);
  ui.getState().go(world ? { name: 'levels', world: world.id } : { name: 'title' });
};

events.on('levelWon', (run) => {
  if (!stage) return;
  const { level } = stage;
  if (params.has('record')) downloadJson(`replay-${level.id}.json`, recorder.finish(level.id, run));
  const inCampaign = CAMPAIGN.includes(level.id);
  const openBefore = WORLDS.filter((w) => isWorldOpen(progress(), w));
  const outcome = inCampaign ? progressStore.getState().win(level.id, run) : undefined;
  const opened = WORLDS.find((w) => !openBefore.includes(w) && isWorldOpen(progress(), w));
  const next = nextLevel(level.id);
  ui.getState().go({
    name: 'win',
    win: {
      levelId: level.id,
      run,
      crystals: stage.world.crystals.length,
      parTimeSec: level.parTimeSec,
      hasGem: !!stage.world.gem,
      ...(outcome ? { outcome } : {}),
      ...(next && (unlockAll || isLevelOpen(progress(), next)) ? { next } : {}),
      ...(opened ? { opened } : {}),
      campaignDone: inCampaign && !next,
    },
  });
});

mountUi(byId('ui'), {
  ui,
  settings: settingsStore,
  progress: progressStore,
  toast,
  unlockAll,
  ...(directLevel ? { directLevel } : {}),
  actions: {
    chooseControl: (controlMode) => settingsStore.getState().update({ controlMode }),
    enableTilt,
    play,
    showBackdrop,
    restart: begin,
    pause: () => stage?.session.pause(),
    resume: () => stage?.session.resume(),
    quit,
    usesTilt: () => usesTilt() && tilt.hasReading(),
    calibrate: tilt.calibrate,
  },
});
onBackground(() => stage?.session.pause());
// Sideways on a phone, the rotate screen covers the game: pause the run underneath it.
const sideways = matchMedia('(orientation: landscape) and (pointer: coarse) and (max-height: 540px)');
sideways.addEventListener('change', () => {
  if (sideways.matches) stage?.session.pause();
});
await mount(directLevel ?? resumeLevel(progress()));

const frames = createFrameStats();
const quality = createQualityGovernor();
/** Pixel ratio before the last drop, to undo it if it did not help. */
let ratioBefore = renderer.getPixelRatio();
const updatePerf = bindPerfOverlay(
  () =>
    `${frames.fps().toFixed(0)} fps · pire ${frames.worstMs().toFixed(1)} ms\n` +
    `${renderer.info.render.calls} draw calls · ratio ${renderer.getPixelRatio()}` +
    (quality.isLow() ? ' · basse' : ''),
);

/** Scene fog follows the fog zones the ball is in, smoothly. */
const fogLevel = { now: 0 };
const updateFog = (target: number, dt: number) => {
  fogLevel.now += (target - fogLevel.now) * Math.min(1, dt * 2.5);
  if (!(scene.fog instanceof THREE.Fog)) return;
  scene.fog.near = FOG.near + (FOG_THICK.near - FOG.near) * fogLevel.now;
  scene.fog.far = FOG.far + (FOG_THICK.far - FOG.far) * fogLevel.now;
};

let gravity: GravityDirection = { x: 0, y: -1, z: 0 };
startLoop((dt) => {
  const current = stage;
  if (current) {
    const { session, ball, decor, signs } = current;
    gravity = session.update(dt, readInput);
    const playing = session.state() === 'play';
    const status = session.status();
    updateFog(playing ? status.fog : 0, dt);
    aura.update(ball.mesh.position, playing ? status.effects : [], session.clock());
    decor.update(session.clock(), dt);
    signs.update(ball.mesh.position);
    if (screen() === 'play') updateMinimap(current, dt);
    follow.update(ball.mesh.position, gravity, dt);
    followSun(sun, ball.mesh.position);
  }
  renderer.render(scene, follow.camera);
  frames.push(dt);
  updatePerf(dt);
  // Only frames of a run in progress tell how the game runs: menus, level loads and the pause
  // that a screen rotation triggers are not counted.
  const running = screen() === 'play' && current?.session.state() === 'play';
  if (!running) return quality.restart();
  const change = quality.update(dt);
  if (change === 'lower') {
    ratioBefore = renderer.getPixelRatio();
    console.info(`[perf] under 50 fps for 3 s: trying pixel ratio ${lowerQuality(renderer)}`);
  } else if (change === 'restore') {
    renderer.setPixelRatio(ratioBefore);
    console.info(`[perf] a lower pixel ratio did not help (frame rate capped?): back to ${ratioBefore}`);
  }
});
