import type { Vec3Tuple } from '../../engine/math';
import { RAPIER, SURFACE } from '../../engine/physics';
import { emptyShape, type TrackShape } from '../../engine/trackCollider';
import { CELL, cellToWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { createBodyView } from './body';
import { emptyNav, perimeterPorts, surfaceTag, type PieceBuild, type PieceModule } from './kit';

type RotatingPlatform = PieceOf<'rotatingPlatform'>;

const SEGMENTS = 24;
const THICKNESS = 0.5;

export const discRadius = ({ diameter }: RotatingPlatform): number => (diameter * CELL) / 2;

const disc = (centre: Vec3Tuple, radius: number, tag: number): TrackShape => {
  const shape = emptyShape();
  const [x, y, z] = centre;
  const at = (i: number): Vec3Tuple => {
    const t = (i / SEGMENTS) * Math.PI * 2;
    return [x + Math.cos(t) * radius, y, z + Math.sin(t) * radius];
  };
  for (let i = 0; i < SEGMENTS; i++) shape.triangles.push({ points: [centre, at(i), at(i + 1)], tag });
  return shape;
};

/** Angle (radians, around +y) after `time` seconds; positive speeds turn clockwise seen from above. */
export const discAngle = (speedDeg: number, time: number): number => (-speedDeg * Math.PI * time) / 180;

/** Turntable disc: a kinematic cylinder spinning around its centre. */
const build = (piece: RotatingPlatform): PieceBuild => {
  const centre = cellToWorld(piece.cell);
  const r = discRadius(piece);
  const nav = emptyNav();
  nav.nodes.push(centre);
  // The disc only reaches its bounding square in the middle of each side.
  const ports = perimeterPorts(0, [centre[0] - r, centre[0] + r, centre[2] - r, centre[2] + r], centre[1]);
  nav.ports.push(
    ...ports.filter(({ dir: [dx], key }) => {
      const [x, z] = key.split(',').map(Number);
      return dx !== 0 ? z === centre[2] : x === centre[0];
    }),
  );
  const footprint = [];
  const reach = (piece.diameter - 1) / 2;
  for (let di = -reach; di <= reach; di++) {
    for (let dk = -reach; dk <= reach; dk++) {
      footprint.push({ i: piece.cell[0] + di, k: piece.cell[2] + dk, yMin: centre[1], yMax: centre[1] });
    }
  }
  return { shape: emptyShape(), body: disc(centre, r, surfaceTag(piece.surface)), nav, footprint };
};

export const rotatingPlatform: PieceModule<RotatingPlatform> = {
  build,
  createMover: (ctx, piece) => {
    const [x, y, z] = cellToWorld(piece.cell);
    const r = discRadius(piece);
    const view = createBodyView(ctx, disc([0, 0, 0], r, surfaceTag(piece.surface)));
    view.position.set(x, y, z);
    const body = ctx.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cylinder(THICKNESS / 2, r)
        .setTranslation(0, -THICKNESS / 2, 0)
        .setFriction(SURFACE.friction)
        .setRestitution(SURFACE.restitution),
      body,
    );
    let time = 0;
    let previous = 0;
    const rotation = (angle: number) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });
    return {
      step: (dt) => {
        previous = time;
        time += dt;
        body.setNextKinematicRotation(rotation(discAngle(piece.speed, time)));
      },
      reset: () => {
        time = previous = 0;
        body.setRotation(rotation(0), true);
      },
      syncMesh: (alpha) => {
        view.rotation.y = discAngle(piece.speed, previous + (time - previous) * alpha);
      },
    };
  },
};
