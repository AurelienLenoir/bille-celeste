import './ui/style.css';
import { createDecor } from './art/decor';
import { createSurfaceMaterials } from './art/materials';
import { FOG } from './art/palette';
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
import { bindHapticFeedback } from './game/hapticFeedback';
import { createSession } from './game/session';
import { bindSoundEffects } from './game/sfx';
import { buildLevel } from './game/world';
import { POC_LEVEL } from './levels/data/poc';
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

const level = POC_LEVEL;
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
const decor = createDecor(scene, level.decorSeed);

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
const readInput = combineInputs(joystick, createKeyboard(), { read: () => (usesTilt() ? tilt.read() : null) });

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

bindSoundEffects(events, audio.beep);
bindHapticFeedback(events, haptics);
bindHud(events, toast);
events.on('respawned', ({ x, y, z }) => follow.snapTo(x, y, z));
events.on('paused', joystick.release);

const session = createSession({ physics, level, world, ball, events });
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

startLoop((dt) => {
  const gravity = session.update(dt, readInput);
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
