import './ui/style.css';
import { createDecor } from './art/decor';
import { createSurfaceMaterials } from './art/materials';
import { FOG } from './art/palette';
import { createSkyTexture } from './art/textures';
import { createAudio } from './engine/audio';
import { createFollowCamera } from './engine/camera';
import { combineInputs } from './engine/input';
import { createKeyboard } from './engine/input/keyboard';
import { createTilt } from './engine/input/tilt';
import { createJoystick } from './engine/input/touch';
import { startLoop } from './engine/loop';
import { createPhysicsWorld, initPhysics } from './engine/physics';
import { bindResize, createRenderContext, followSun } from './engine/renderer';
import { createBall } from './game/ball';
import { createEventBus, type GameEvents } from './game/events';
import { createSession } from './game/session';
import { bindSoundEffects } from './game/sfx';
import { buildLevel } from './game/world';
import { POC_LEVEL } from './levels/data/poc';
import { byId } from './ui/dom';
import { bindHud } from './ui/hud/hud';
import { bindScreens } from './ui/screens/screens';
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

const audio = createAudio();
const toast = createToast();
const tilt = createTilt();
const readInput = combineInputs(
  createJoystick({ surface: canvas, base: byId('joy'), knob: byId('knob') }),
  createKeyboard(),
  tilt,
);

bindSoundEffects(events, audio.beep);
bindHud(events, toast);
events.on('respawned', ({ x, y, z }) => follow.snapTo(x, y, z));

const session = createSession({ physics, level, world, ball, events });

bindScreens(events, toast, {
  play: () => {
    audio.unlock();
    session.start();
  },
  enableTilt: async () => {
    await tilt.enable();
    tilt.resetCalibration();
  },
  hasTiltReading: tilt.hasReading,
  calibrate: tilt.calibrate,
});

startLoop((dt) => {
  const gravity = session.update(dt, readInput);
  decor.update(session.clock(), dt);
  follow.update(ball.mesh.position, gravity, dt);
  followSun(sun, ball.mesh.position);
  renderer.render(scene, follow.camera);
});
