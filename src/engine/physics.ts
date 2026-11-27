import RAPIER from '@dimforge/rapier3d-compat';
import type { Vec2 } from './math';
import type { TrackMesh } from './trackCollider';

export { RAPIER };
export type PhysicsWorld = RAPIER.World;
export type PhysicsBody = RAPIER.RigidBody;

export const GRAVITY = 22;
export const MAX_TILT = Math.tan((26 * Math.PI) / 180);
/** Fixed simulation step: 120 Hz, independent of the display rate. */
export const PHYSICS_STEP = 1 / 120;
const SOLVER_ITERATIONS = 8;

/** Friction and bounce shared by the ball and every course surface. */
export const SURFACE = { friction: 0.5, restitution: 0.05 } as const;

export type GravityDirection = { x: number; y: number; z: number };

/** Loads the WebAssembly module. Await once before creating any world. */
export const initPhysics = (): Promise<void> => RAPIER.init();

export const createPhysicsWorld = (): PhysicsWorld => {
  const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = PHYSICS_STEP;
  world.numSolverIterations = SOLVER_ITERATIONS;
  return world;
};

/** Unit vector of gravity once the world is tilted by `tilt` (each axis in -1..1). */
export const gravityDirection = (tilt: Vec2, maxTilt = MAX_TILT): GravityDirection => {
  const x = tilt.x * maxTilt;
  const z = -tilt.y * maxTilt;
  const len = Math.hypot(x, 1, z);
  return { x: x / len, y: -1 / len, z: z / len };
};

export const applyGravity = (world: PhysicsWorld, dir: GravityDirection): void => {
  world.gravity = { x: dir.x * GRAVITY, y: dir.y * GRAVITY, z: dir.z * GRAVITY };
};

/** Advances the world by exactly one PHYSICS_STEP. */
export const stepPhysics = (world: PhysicsWorld): void => {
  world.step();
};

/** Adds the whole static course as one trimesh collider whose internal edges are smoothed out. */
export const addTrackCollider = (world: PhysicsWorld, { vertices, indices }: TrackMesh, groups?: number): void => {
  const desc = RAPIER.ColliderDesc.trimesh(vertices, indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
    .setFriction(SURFACE.friction)
    .setRestitution(SURFACE.restitution);
  if (groups !== undefined) desc.setCollisionGroups(groups);
  world.createCollider(desc);
};

/**
 * cannon-es damps with v *= (1 - d)^dt, Rapier with v /= 1 + d·dt. This converts a cannon-es
 * coefficient into the Rapier one that loses the same speed per second.
 */
export const rapierDamping = (cannonDamping: number): number => -Math.log(1 - cannonDamping);
