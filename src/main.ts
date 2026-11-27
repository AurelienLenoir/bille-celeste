import './ui/style.css';
import { createDecor } from './art/decor';
import { createSurfaceMaterials } from './art/materials';
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
import { createFrameStats, createQualityGovernor } from './engine/perf';
import { createPhysicsWorld, initPhysics } from './engine/physics';
import { bindResize, createRenderContext, followSun, setLowQuality } from './engine/renderer';
import { createBall } from './game/ball';
import { createEventBus, type GameEvents } from './game/events';
import { createAutopilot } from './game/autopilot';
import { createEffectAura } from './game/effectAura';
import { buildNav, planRoute } from './game/nav';
import type { Vec2 } from './engine/math';
import { bindHapticFeedback } from './game/hapticFeedback';
import { createSession } from './game/session';
import { bindSoundEffects } from './game/sfx';
import { buildLevel } from './game/world';
import { DEFAULT_LEVEL, EDITOR_LEVEL_KEY, fetchLevel } from './levels/catalog';
import { loadLevel } from './levels/loader';
import type { Level } from './levels/schema';
import { createRecorder } from './game/replay';
import { downloadJson } from './ui/download';
import { createSettingsStore } from './meta/store';
import { onBackground } from './platform/lifecycle';
import { webStorage } from './platform/storage';
import { byId } from './ui/dom';
import { bindHud } from './ui/hud/hud';
import { bindPerfOverlay } from './ui/hud/perf';
import { bindPauseMenu } from './ui/screens/pause';
import { bindScreens } from './ui/screens/screens';
import { bindSettings } from './ui/screens/settings';
import { createToast } from './ui/toast';

// Tells the inline watchdog in index.html that the bundle loaded.
Object.assign(window, { __ok: true });

const params = new URLSearchParams(location.search);
const chooseLevel = async (): Promise<Level> => {
  const id = params.get('level') ?? DEFAULT_LEVEL;
  if (id !== 'editor') return fetchLevel(id);
  const saved = await webStorage.get(EDITOR_LEVEL_KEY);
  return loadLevel(JSON.parse(saved ?? 'null'));
};
const level = await chooseLevel();
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
const physics = createPhysicsWorld();
const events = createEventBus<GameEvents>();
const world = buildLevel({ world: physics, scene, materials: createSurfaceMaterials() }, level);
const ball = createBall(physics, scene);
const decor = createDecor(scene, level.decor.seed, world.track.vertices);

const settingsStore = await createSettingsStore(webStorage);
const settings = () => settingsStore.getState().settings;
const usesTilt = () => settings().controlMode === 'tilt';

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
// `?record` keeps every input of a run and downloads it as a replay when the level is won.
const recorder = createRecorder(() => session.state() === 'play');
const recorded = params.has('record') ? recorder.wrap(playerInput) : playerInput;
// `?bot` lets the autopilot play (demo of a level, and screenshots of every modifier in tests).
let autopilot: (() => Vec2) | undefined;
const readInput = () => (autopilot ? autopilot() : recorded());

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
events.on('paused', joystick.release);

const session = createSession({ physics, world, ball, events });
const route = params.has('bot') ? planRoute(level, buildNav(level)) : undefined;
events.on('reset', () => {
  if (route) autopilot = createAutopilot(level, route, world, ball, session.status);
});
events.on('reset', recorder.clear);
events.on('levelWon', (result) => {
  if (params.has('record')) downloadJson(`replay-${level.id}.json`, recorder.finish(level.id, result));
});
const openSettings = bindSettings(settingsStore);

const play = () => {
  audio.unlock();
  if (usesTilt()) tilt.resetCalibration();
  session.start();
};

bindScreens(events, toast, {
  play,
  chooseControl: (controlMode) => settingsStore.getState().update({ controlMode }),
  enableTilt,
  hasTiltReading: tilt.hasReading,
  openSettings,
  parTimeSec: level.parTimeSec,
  hasGem: level.entities.some((e) => e.type === 'hiddenGem'),
});
bindPauseMenu(events, toast, {
  pause: session.pause,
  resume: session.resume,
  restart: play,
  usesTilt: () => usesTilt() && tilt.hasReading(),
  calibrate: tilt.calibrate,
  openSettings,
});
onBackground(session.pause);

const frames = createFrameStats();
const quality = createQualityGovernor();
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

startLoop((dt) => {
  const gravity = session.update(dt, readInput);
  const status = session.status();
  updateFog(session.state() === 'play' ? status.fog : 0, dt);
  aura.update(ball.mesh.position, session.state() === 'play' ? status.effects : [], session.clock());
  decor.update(session.clock(), dt);
  follow.update(ball.mesh.position, gravity, dt);
  followSun(sun, ball.mesh.position);
  renderer.render(scene, follow.camera);
  frames.push(dt);
  updatePerf(dt);
  if (quality.update(dt)) {
    setLowQuality(renderer);
    console.info('[perf] stayed under 50 fps for 3 s: switching to low quality');
  }
});
