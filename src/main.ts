import './ui/style.css';
import * as THREE from 'three';
import { AMBIENT_LOOKS, createAmbient, type Ambient } from './art/ambient';
import { SONGS } from './art/music';
import { FOG, FOG_THICK } from './art/palette';
import { createParticles, fitPointScale } from './art/particles';
import { createSkinMaterial } from './art/skinMaterial';
import { createSkyTexture } from './art/textures';
import { createAudio } from './engine/audio';
import { createFollowCamera } from './engine/camera';
import { combineInputs } from './engine/input';
import { createHaptics } from './engine/haptics';
import { createKeyboard } from './engine/input/keyboard';
import { createTilt } from './engine/input/tilt';
import { createJoystick } from './engine/input/touch';
import { startLoop } from './engine/loop';
import { createMusicPlayer } from './engine/music';
import type { Vec2 } from './engine/math';
import { createFrameStats, createQualityGovernor } from './engine/perf';
import { initPhysics, type GravityDirection } from './engine/physics';
import { bindResize, createRenderContext, followSun, lowerQuality } from './engine/renderer';
import { createEffectAura } from './game/effectAura';
import { createEventBus, type GameEvents } from './game/events';
import { bindHapticFeedback } from './game/hapticFeedback';
import { bindJuice, createBallTrail } from './game/juice';
import { createRecorder } from './game/replay';
import { rollingSound, surfaceUnder } from './game/rolling';
import { bindSoundEffects } from './game/sfx';
import { createStage, type Stage } from './game/stage';
import { pick, t } from './i18n';
import { EDITOR_LEVEL_KEY, fetchLevel } from './levels/catalog';
import { loadLevel } from './levels/loader';
import type { Level } from './levels/schema';
import { CAMPAIGN, nextLevel, WORLDS, worldOfLevel } from './levels/worlds';
import { isLevelOpen, isWorldOpen, resumeLevel } from './meta/progress';
import { mayShowInterstitial } from './meta/adPolicy';
import { skinById } from './meta/skins';
import { createProgressStore, createSettingsStore, createWalletStore } from './meta/store';
import { createAds } from './platform/ads';
import { createPurchases, PACK_FEATHERS } from './platform/purchases';
import { nativeVibrator } from './platform/haptics';
import { onBackButton, onBackground, onForeground } from './platform/lifecycle';
import { hideSplash, keepScreenOn, setUpNativeShell } from './platform/shell';
import { createTelemetry, telemetryConfigFromEnv } from './platform/telemetry';
import { appStorage } from './platform/storage';
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

setUpNativeShell();
const storage = appStorage();
const params = new URLSearchParams(location.search);
/** `?level=id` plays one level straight from the title (campaign, sandbox, editor…). */
const directLevel = params.get('level') ?? undefined;
/** `?unlock` opens every world and level, for testing. */
const unlockAll = params.has('unlock');

const fetchAnyLevel = async (id: string): Promise<Level> => {
  if (id !== 'editor') return fetchLevel(id);
  const saved = await storage.get(EDITOR_LEVEL_KEY);
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
const [settingsStore, progressStore, walletStore] = await Promise.all([
  createSettingsStore(storage),
  createProgressStore(storage),
  createWalletStore(storage),
]);
const wallet = () => walletStore.getState().wallet;
const settings = () => settingsStore.getState().settings;
const progress = () => progressStore.getState().progress;
const usesTilt = () => settings().controlMode === 'tilt';
const telemetry = createTelemetry(telemetryConfigFromEnv(), () => settings().telemetry === 'yes', storage);
telemetry.startCrashReports();
settingsStore.subscribe(() => telemetry.startCrashReports());
const ui = createUiStore();
const screen = () => ui.getState().screen.name;

const audio = createAudio(() => ({
  sfx: settings().sound ? settings().sfxVolume : 0,
  music: settings().music ? settings().musicVolume : 0,
}));
settingsStore.subscribe(() => audio.refresh());
const music = createMusicPlayer(audio.context, audio.musicBus, audio.noise);
const rolling = audio.loop();

const ads = createAds();
const purchases = createPurchases();
void purchases.ownsNoAds().then((owned) => owned && walletStore.getState().setNoAds(true));
/** Rewarded ads are free once "no ads" is bought (PLAN.md § 10.3). */
const rewards = () => (wallet().noAds ? 'free' : ads.available() ? 'ad' : 'none');
/** The run stands still while an ad covers the game. */
let holdRun = false;
const duringAd = async <T>(show: () => Promise<T>): Promise<T> => {
  holdRun = true;
  audio.suspend();
  try {
    return await show();
  } finally {
    holdRun = false;
    audio.resume();
  }
};
const earnReward = async (): Promise<boolean> => {
  if (wallet().noAds) return true;
  if (!ads.available()) return false;
  return duringAd(ads.rewarded);
};
/** Between two runs, after a win: now and then an interstitial (never in the first levels). */
const maybeInterstitial = async () => {
  if (screen() !== 'win' || !stage || !ads.available()) return;
  if (!mayShowInterstitial(stage.level.id, wallet().winsSinceAd, wallet().noAds)) return;
  walletStore.getState().adShown();
  await duringAd(ads.interstitial);
};
/** Unlocks sound on the first tap and starts the music clock. */
const unlockAudio = () => {
  audio.unlock();
  music.wake();
};
const haptics = createHaptics(() => settings().haptics, nativeVibrator());
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
/** "Continue here" is offered for a few seconds after a fall, once per level. */
const REVIVE_OFFER_MS = 4500;
let revivedThisLevel = false;
let reviveTimer: ReturnType<typeof setTimeout> | undefined;
const offerRevive = (on: boolean) => {
  clearTimeout(reviveTimer);
  ui.getState().offerRevive(on);
  if (on) reviveTimer = setTimeout(() => ui.getState().offerRevive(false), REVIVE_OFFER_MS);
};
events.on('fell', () => {
  if (!revivedThisLevel && stage?.session.canRevive() && rewards() !== 'none') offerRevive(true);
});
events.on('checkpointReached', () => offerRevive(false));
events.on('reset', () => {
  revivedThisLevel = false;
  offerRevive(false);
});
const revive = async () => {
  offerRevive(false);
  if (revivedThisLevel || !stage?.session.canRevive()) return;
  revivedThisLevel = true;
  if (await earnReward()) stage.session.revive();
};
// A new skin rolls at once, even on the level waiting behind the menus.
walletStore.subscribe(({ wallet: next }, { wallet: before }) => {
  if (next.equipped === before.equipped || !stage) return;
  const old = stage.ball.mesh.material;
  stage.ball.mesh.material = skinMaterial();
  if (old instanceof THREE.MeshPhysicalMaterial) {
    old.map?.dispose();
    old.dispose();
  }
});
const SHAKERS = new Set(['bumper', 'pusher', 'sweeper']);
events.on('modifierFired', ({ type }) => {
  if (SHAKERS.has(type)) follow.shake(0.22);
});
const aura = createEffectAura(scene);
const particles = createParticles(scene);
const trail = createBallTrail(particles, () => parseInt(skinById(wallet().equipped).trail.slice(1), 16));
const skinMaterial = () => createSkinMaterial(skinById(wallet().equipped).look);
bindJuice({ events, particles, ball: () => stage?.ball.mesh.position ?? { x: 0, y: 0, z: 0 } });
let ambient: Ambient | undefined;
events.on('paused', () => {
  joystick.release();
  ui.getState().go({ name: 'pause' });
});
events.on('resumed', () => ui.getState().go({ name: 'play' }));
events.on('reset', recorder.clear);
/** Falls of the run in progress, for the statistics of an abandoned level. */
let fallsSoFar = 0;
events.on('reset', () => (fallsSoFar = 0));
events.on('fell', ({ falls }) => (fallsSoFar = falls));

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
  stage = createStage(level, { scene, events, text: pick, bot: params.has('bot'), ballMaterial: skinMaterial() });
  ambient?.dispose();
  const look = AMBIENT_LOOKS[level.decor.theme];
  ambient = look ? createAmbient(scene, look, level.decor.seed) : undefined;
  particles.clear();
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
  unlockAudio();
  if (usesTilt()) tilt.resetCalibration();
  stage.session.start();
  telemetry.track('level_start', { level: stage.level.id });
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
  unlockAudio();
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
  if (stage.session.state() !== 'win') telemetry.track('level_quit', { level: stage.level.id, falls: fallsSoFar });
  stage.session.stop();
  const world = worldOfLevel(stage.level.id);
  ui.getState().go(world ? { name: 'levels', world: world.id } : { name: 'title' });
};

/** Time between crossing the ring and the results screen. */
const WIN_SCREEN_DELAY_MS = 900;
events.on('levelWon', (run) => {
  if (!stage) return;
  const { level } = stage;
  telemetry.track('level_win', {
    level: level.id,
    time: run.time,
    falls: run.falls,
    stars: run.stars.count,
    gem: run.gem,
  });
  if (params.has('record')) downloadJson(`replay-${level.id}.json`, recorder.finish(level.id, run));
  const inCampaign = CAMPAIGN.includes(level.id);
  const openBefore = WORLDS.filter((w) => isWorldOpen(progress(), w));
  const outcome = inCampaign ? progressStore.getState().win(level.id, run) : undefined;
  const earnings = inCampaign ? walletStore.getState().payWin(level.id, run, outcome) : undefined;
  const opened = WORLDS.find((w) => !openBefore.includes(w) && isWorldOpen(progress(), w));
  const next = nextLevel(level.id);
  const win = {
    levelId: level.id,
    run,
    crystals: stage.world.crystals.length,
    parTimeSec: level.parTimeSec,
    hasGem: !!stage.world.gem,
    ...(outcome ? { outcome } : {}),
    ...(next && (unlockAll || isLevelOpen(progress(), next)) ? { next } : {}),
    ...(opened ? { opened } : {}),
    campaignDone: inCampaign && !next,
    ...(earnings ? { earnings } : {}),
  };
  // The ball rolls on in slow motion through the ring while the confetti flies, then the results.
  setTimeout(() => {
    if (stage?.level.id === level.id && stage.session.state() === 'win') ui.getState().go({ name: 'win', win });
  }, WIN_SCREEN_DELAY_MS);
});

mountUi(byId('ui'), {
  ui,
  settings: settingsStore,
  progress: progressStore,
  toast,
  unlockAll,
  wallet: walletStore,
  rewards,
  shop: {
    available: purchases.available,
    offers: async () =>
      (await purchases.offers()).map((o) => ({
        ...o,
        ...(PACK_FEATHERS[o.key] ? { feathers: PACK_FEATHERS[o.key] } : {}),
      })),
    buy: async (key) => {
      const outcome = await purchases.buy(key);
      if (outcome !== 'bought') return outcome;
      if (key === 'noAds') walletStore.getState().setNoAds(true);
      else walletStore.getState().addFeathers(PACK_FEATHERS[key] ?? 0);
      return outcome;
    },
    restore: async () => {
      const owned = await purchases.restore();
      if (owned) walletStore.getState().setNoAds(true);
      return owned;
    },
  },
  telemetryAvailable: telemetry.available,
  ...(directLevel ? { directLevel } : {}),
  actions: {
    chooseControl: (controlMode) => settingsStore.getState().update({ controlMode }),
    enableTilt,
    play: (id) => void maybeInterstitial().then(() => play(id)),
    showBackdrop,
    restart: () => void maybeInterstitial().then(begin),
    revive: () => void revive(),
    doubleFeathers: async (amount) => {
      if (!(await earnReward())) return false;
      walletStore.getState().addFeathers(amount);
      return true;
    },
    pause: () => stage?.session.pause(),
    resume: () => stage?.session.resume(),
    quit,
    usesTilt: () => usesTilt() && tilt.hasReading(),
    calibrate: tilt.calibrate,
  },
});
onBackground(() => {
  stage?.session.pause();
  audio.suspend();
});
onForeground(audio.resume);
// Browsers only allow sound after a tap: the first one anywhere starts the menu music.
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

/** The screen sets the music (menus have their own tune, a level its world's) and keeps the phone awake during a run. */
const followScreen = () => {
  keepScreenOn(screen() === 'play');
  // Ads ask for their consent once the player reaches the menus, not on the very first screen.
  if (screen() === 'map' && !wallet().noAds) void ads.start();
  const name = screen();
  const inLevel = name === 'play' || name === 'pause' || name === 'win' || name === 'loading';
  music.play(inLevel && stage ? SONGS[stage.level.decor.theme] : SONGS.menu);
};
ui.subscribe(followScreen);

/** Rolling sound from the ball's speed and what it rolls on; silent outside of play. */
const updateRolling = ({ ball, session, level }: Stage) => {
  if (session.state() !== 'play') return rolling.set(0, 200);
  const v = ball.velocity();
  const sound = rollingSound(
    Math.hypot(v.x, v.y, v.z),
    ball.grounded(),
    surfaceUnder(level.decor.theme, session.status().grip),
  );
  rolling.set(sound.gain, sound.frequency, sound.q);
};
// Sideways on a phone, the rotate screen covers the game: pause the run underneath it.
const sideways = matchMedia('(orientation: landscape) and (pointer: coarse) and (max-height: 540px)');
sideways.addEventListener('change', () => {
  if (sideways.matches) stage?.session.pause();
});
await mount(directLevel ?? resumeLevel(progress()));
// The boot splash fades out once the first level stands behind the title.
const boot = document.getElementById('boot');
boot?.classList.add('done');
setTimeout(() => boot?.remove(), 500);
hideSplash();
// Android back: pause a run, resume from the pause menu, otherwise go one menu back.
onBackButton(() => {
  const now = ui.getState();
  if (now.settings) return now.openSettings(false);
  const name = now.screen.name;
  if (name === 'play') stage?.session.pause();
  else if (name === 'pause') stage?.session.resume();
  else if (name === 'levels') now.go({ name: 'map' });
  else if (name === 'map' || name === 'win') now.go({ name: 'title' });
});

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
    gravity = session.update(holdRun ? 0 : dt, readInput);
    const playing = session.state() === 'play';
    const status = session.status();
    updateFog(playing ? status.fog : 0, dt);
    aura.update(ball.mesh.position, playing ? status.effects : [], session.clock());
    decor.update(session.clock(), dt);
    signs.update(ball.mesh.position);
    if (screen() === 'play') updateMinimap(current, dt);
    updateRolling(current);
    ambient?.update(ball.mesh.position, session.clock());
    if (playing) trail(ball.mesh.position, ball.velocity(), dt);
    follow.update(ball.mesh.position, gravity, dt);
    followSun(sun, ball.mesh.position);
  }
  particles.update(dt);
  fitPointScale(renderer.domElement.height, follow.camera.fov);
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
