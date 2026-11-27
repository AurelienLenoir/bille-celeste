import type * as CANNON from 'cannon-es';
import type { Surface } from '../../art/palette';
import type { BuiltBox, BoxSpec } from './box';

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
  kinematic: true,
});

export type MovingPlatform = {
  box: BuiltBox;
  update: (dt: number) => void;
  reset: () => void;
  syncMesh: () => void;
};

type Shuttle = { dir: -1 | 1; wait: number };

/** Kinematic platform shuttling between its start and `toZ`, pausing at each end. */
export const createMovingPlatform = (data: MovingPlatformData, box: BuiltBox): MovingPlatform => {
  const startZ = data.at[2];
  const near = Math.max(startZ, data.toZ);
  const far = Math.min(startZ, data.toZ);
  const initialDir: -1 | 1 = data.toZ < startZ ? -1 : 1;
  const shuttle: Shuttle = { dir: initialDir, wait: data.pause };
  const body: CANNON.Body = box.body;

  const arrive = (z: number, nextDir: -1 | 1) => {
    body.position.z = z;
    shuttle.dir = nextDir;
    shuttle.wait = data.pause;
    body.velocity.setZero();
  };

  return {
    box,
    update: (dt) => {
      if (shuttle.wait > 0) {
        shuttle.wait -= dt;
        body.velocity.setZero();
        return;
      }
      body.velocity.set(0, 0, shuttle.dir * data.speed);
      if (shuttle.dir < 0 && body.position.z <= far) arrive(far, 1);
      else if (shuttle.dir > 0 && body.position.z >= near) arrive(near, -1);
    },
    reset: () => {
      shuttle.dir = initialDir;
      shuttle.wait = data.pause;
      body.position.z = startZ;
    },
    syncMesh: () => {
      box.mesh.position.set(body.position.x, body.position.y, body.position.z);
    },
  };
};
