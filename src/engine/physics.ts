import * as CANNON from 'cannon-es';
import type { Vec2 } from './math';

export const GRAVITY = 22;
export const MAX_TILT = Math.tan((26 * Math.PI) / 180);
const PHYSICS_STEP = 1 / 120;
const MAX_SUBSTEPS = 8;

export type GravityDirection = { x: number; y: number; z: number };

export const createPhysicsWorld = (): CANNON.World => {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0) });
  world.allowSleep = false;
  // cannon-es types the solver as the base Solver; the default is a GSSolver with iterations.
  (world.solver as CANNON.GSSolver).iterations = 12;
  world.defaultContactMaterial.friction = 0.5;
  world.defaultContactMaterial.restitution = 0.05;
  return world;
};

/** Unit vector of gravity once the world is tilted by `tilt` (each axis in -1..1). */
export const gravityDirection = (tilt: Vec2, maxTilt = MAX_TILT): GravityDirection => {
  const x = tilt.x * maxTilt;
  const z = -tilt.y * maxTilt;
  const len = Math.hypot(x, 1, z);
  return { x: x / len, y: -1 / len, z: z / len };
};

export const applyGravity = (world: CANNON.World, dir: GravityDirection): void => {
  world.gravity.set(dir.x * GRAVITY, dir.y * GRAVITY, dir.z * GRAVITY);
};

export const stepPhysics = (world: CANNON.World, dt: number): void => {
  world.step(PHYSICS_STEP, dt, MAX_SUBSTEPS);
};
