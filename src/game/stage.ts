import * as THREE from 'three';
import { createDecor, type Decor } from '../art/decor';
import { createSurfaceMaterials } from '../art/materials';
import { THEME_LOOKS } from '../art/palette';
import { createSigns, type Signs } from '../art/signs';
import { createSkyTexture } from '../art/textures';
import type { Vec2 } from '../engine/math';
import { createPhysicsWorld, type PhysicsWorld } from '../engine/physics';
import { cellToWorld, forwardOf } from '../levels/grid';
import type { Level } from '../levels/schema';
import { createAutopilot } from './autopilot';
import { createBall, type Ball } from './ball';
import type { EventBus, GameEvents } from './events';
import { buildNav, planRoute } from './nav';
import { createSession, type Session } from './session';
import { buildLevel, type LevelWorld } from './world';

/** One level loaded in the scene and the physics: built when the level starts, disposed when it is left. */
export type Stage = {
  level: Level;
  world: LevelWorld;
  ball: Ball;
  session: Session;
  decor: Decor;
  signs: Signs;
  /** With `bot`: the autopilot's input for the current run, renewed on each reset. */
  autopilot: () => Vec2 | undefined;
  dispose: () => void;
};

type StageOptions = {
  scene: THREE.Scene;
  events: EventBus<GameEvents>;
  /** Sign text in the player's language. */
  text: (text: Level['name']) => string;
  /** Lets the autopilot play (`?bot`). */
  bot: boolean;
};

const disposeTree = (root: THREE.Object3D) =>
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    const materials: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    materials.forEach((m) => {
      if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) m.map?.dispose();
      m.dispose();
    });
  });

/** Sky and distance fog of the level's world. */
const applyTheme = (scene: THREE.Scene, level: Level) => {
  const look = THEME_LOOKS[level.decor.theme];
  if (scene.background instanceof THREE.Texture) scene.background.dispose();
  scene.background = createSkyTexture(look.sky);
  if (scene.fog instanceof THREE.Fog) scene.fog.color.set(look.fog);
};

/** Builds a level, its ball, decor and signs under one group, and the session that plays it. */
export const createStage = (level: Level, { scene, events, text, bot }: StageOptions): Stage => {
  const root = new THREE.Group();
  scene.add(root);
  applyTheme(scene, level);
  const physics: PhysicsWorld = createPhysicsWorld();
  const world = buildLevel({ world: physics, scene: root, materials: createSurfaceMaterials() }, level);
  const ball = createBall(physics, root);
  const decor = createDecor(
    root,
    level.decor.seed,
    world.track.vertices,
    THEME_LOOKS[level.decor.theme].decor,
    level.decor.theme,
  );
  const signs = createSigns(
    root,
    level.signs.map((s) => ({ position: cellToWorld(s.cell), facing: forwardOf(s.rot), text: text(s.text) })),
  );
  const session = createSession({ physics, world, ball, events });

  const route = bot ? planRoute(level, buildNav(level)) : undefined;
  let pilot: (() => Vec2) | undefined;
  const offReset = events.on('reset', () => {
    if (route) pilot = createAutopilot(level, route, world, ball, session.status);
  });
  if (route) pilot = createAutopilot(level, route, world, ball, session.status);

  return {
    level,
    world,
    ball,
    session,
    decor,
    signs,
    autopilot: () => pilot?.(),
    dispose: () => {
      offReset();
      scene.remove(root);
      disposeTree(root);
      physics.free();
    },
  };
};
