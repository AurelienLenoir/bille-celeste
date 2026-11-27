import type * as THREE from 'three';
import type { Surface } from '../../art/palette';
import { RAPIER, SURFACE, type PhysicsWorld } from '../../engine/physics';
import type { BoxSpec } from './box';

export type MovingPlatformData = {
  type: 'movingPlatform';
  /** Top-centre at the start of the path. */
  at: readonly [number, number, number];
  size: readonly [number, number];
  surface: Surface;
  /** z coordinate of the far end of the path (the platform moves along z only for now). */
  toZ: number;
  speed: number;
  pause: number;
};

const THICKNESS = 0.5;

export const movingPlatformBox = ({ at: [x, y, z], size: [w, d], surface }: MovingPlatformData): BoxSpec => ({
  position: [x, y - THICKNESS / 2, z],
  size: [w, THICKNESS, d],
  surface,
});

export type Shuttle = {
  /** Position after the last step. */
  z: () => number;
  /** Position before the last step, for render interpolation. */
  previousZ: () => number;
  step: (dt: number) => void;
  reset: () => void;
};

/** Back-and-forth motion along z between the start and `toZ`, pausing at each end. */
export const createShuttle = ({ at, toZ, speed, pause }: MovingPlatformData): Shuttle => {
  const startZ = at[2];
  const near = Math.max(startZ, toZ);
  const far = Math.min(startZ, toZ);
  const initialDir: -1 | 1 = toZ < startZ ? -1 : 1;
  let z = startZ;
  let prev = startZ;
  let dir = initialDir;
  let wait = pause;

  const arrive = (end: number, nextDir: -1 | 1) => {
    z = end;
    dir = nextDir;
    wait = pause;
  };

  return {
    z: () => z,
    previousZ: () => prev,
    step: (dt) => {
      prev = z;
      if (wait > 0) {
        wait -= dt;
        return;
      }
      z += dir * speed * dt;
      if (dir < 0 && z <= far) arrive(far, 1);
      else if (dir > 0 && z >= near) arrive(near, -1);
    },
    reset: () => {
      z = prev = startZ;
      dir = initialDir;
      wait = pause;
    },
  };
};

export type MovingPlatform = {
  step: (dt: number) => void;
  reset: () => void;
  syncMesh: (alpha: number) => void;
};

/** Kinematic platform driven by a shuttle; it carries the ball through friction. */
export const createMovingPlatform = (
  world: PhysicsWorld,
  data: MovingPlatformData,
  mesh: THREE.Mesh,
): MovingPlatform => {
  const { position, size } = movingPlatformBox(data);
  const [x, y] = position;
  const shuttle = createShuttle(data);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(...position));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(size[0] / 2, size[1] / 2, size[2] / 2)
      .setFriction(SURFACE.friction)
      .setRestitution(SURFACE.restitution),
    body,
  );

  return {
    step: (dt) => {
      shuttle.step(dt);
      body.setNextKinematicTranslation({ x, y, z: shuttle.z() });
    },
    reset: () => {
      shuttle.reset();
      body.setTranslation({ x, y, z: shuttle.z() }, true);
    },
    syncMesh: (alpha) => {
      mesh.position.z = shuttle.previousZ() + (shuttle.z() - shuttle.previousZ()) * alpha;
    },
  };
};
