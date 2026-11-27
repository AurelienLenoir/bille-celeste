import * as THREE from 'three';
import { RAPIER, SURFACE } from '../../engine/physics';
import { emptyShape, type TrackShape } from '../../engine/trackCollider';
import { CELL, entryFrame, toWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { createBodyView, PLANK_GROUPS } from './body';
import {
  back,
  emptyNav,
  port,
  rectFloor,
  rectFootprint,
  surfaceTag,
  widthOf,
  type PieceBuild,
  type PieceModule,
} from './kit';

type Seesaw = PieceOf<'seesaw'>;

/** Largest tilt of the plank either way. */
export const SEESAW_TILT = (12 * Math.PI) / 180;
const THICKNESS = 0.3;
/** Small gap at both ends so the plank never scrapes the course. */
const END_GAP = 0.05;
const PLANK_DENSITY = 0.25;
const WEIGHT_DENSITY = 4;

/** Height of the pivot above the entry: the plank rests with its entry end level with the entry. */
export const pivotRise = ({ length }: Seesaw): number => ((length * CELL) / 2) * Math.sin(SEESAW_TILT);

const plankShape = (piece: Seesaw, frame: ReturnType<typeof entryFrame>, f0: number, f1: number): TrackShape => {
  const half = widthOf(piece.width) / 2;
  const shape = emptyShape();
  shape.floors.push(rectFloor(frame, [-half, half], [f0, f1], { y0: 0 }, surfaceTag(piece.surface)));
  return shape;
};

/**
 * Plank on a pivot across the track. It rests with the entry end down; the ball climbs it and its
 * weight tips the far end down past the middle. Its ends meet the course at the entry height.
 */
const build = (piece: Seesaw): PieceBuild => {
  const frame = entryFrame(piece.cell, piece.rot);
  const end = piece.length * CELL;
  const rise = pivotRise(piece);
  const nav = emptyNav();
  nav.nodes.push(
    toWorld(frame, 0, CELL / 2, 0),
    toWorld(frame, 0, end / 2, rise),
    toWorld(frame, 0, end - CELL / 2, 0),
  );
  nav.links.push({ from: 0, to: 1 }, { from: 1, to: 2 });
  nav.ports.push(port(frame, 0, 0, 0, back(frame), 0, 0.3), port(frame, 2, 0, end, frame.forward, 0, 0.3));
  const rows = Array.from({ length: piece.length }, (_, c) => c * CELL + CELL / 2);
  return {
    shape: emptyShape(),
    body: plankShape(piece, frame, 0, end),
    nav,
    footprint: rectFootprint(frame, [0], rows, () => [0, 2 * rise]),
  };
};

export const seesaw: PieceModule<Seesaw> = {
  build,
  createMover: (ctx, piece) => {
    const end = piece.length * CELL;
    const half = widthOf(piece.width) / 2;
    const entry = entryFrame(piece.cell, piece.rot);
    const pivot = toWorld(entry, 0, end / 2, pivotRise(piece));
    const [px, py, pz] = pivot;
    const local = { ...entry, origin: [0, 0, 0] as const };
    const view = createBodyView(ctx, plankShape(piece, local, -end / 2 + END_GAP, end / 2 - END_GAP));
    const axis = { x: entry.right[0], y: 0, z: entry.right[1] };
    const rest = {
      x: axis.x * Math.sin(SEESAW_TILT / 2),
      y: 0,
      z: axis.z * Math.sin(SEESAW_TILT / 2),
      w: Math.cos(SEESAW_TILT / 2),
    };

    const anchor = ctx.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz));
    const body = ctx.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(px, py, pz)
        .setRotation(rest)
        .setAngularDamping(1.5)
        .setCanSleep(false),
    );
    const [hx, hz] = entry.right[0] !== 0 ? [half, end / 2 - END_GAP] : [end / 2 - END_GAP, half];
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, THICKNESS / 2, hz)
        .setTranslation(0, -THICKNESS / 2, 0)
        .setDensity(PLANK_DENSITY)
        .setFriction(SURFACE.friction)
        .setRestitution(SURFACE.restitution)
        .setCollisionGroups(PLANK_GROUPS),
      body,
    );
    // Hidden counterweight under the entry half keeps the plank resting entry-end down.
    const [wx, , wz] = toWorld(local, 0, -end / 4, 0);
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.1, 0.2)
        .setTranslation(wx, -THICKNESS - 0.15, wz)
        .setDensity(WEIGHT_DENSITY)
        .setCollisionGroups(PLANK_GROUPS),
      body,
    );
    const joint = ctx.world.createImpulseJoint(
      RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, axis),
      anchor,
      body,
      true,
    ) as RAPIER.RevoluteImpulseJoint;
    joint.setLimits(-SEESAW_TILT, SEESAW_TILT);

    const from = new THREE.Quaternion();
    const to = new THREE.Quaternion();
    const previous = { q: { ...rest } };
    const current = { q: { ...rest } };
    return {
      step: () => {
        previous.q = current.q;
        const r = body.rotation();
        current.q = { x: r.x, y: r.y, z: r.z, w: r.w };
      },
      reset: () => {
        body.setTranslation({ x: px, y: py, z: pz }, true);
        body.setRotation(rest, true);
        body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        previous.q = current.q = { ...rest };
      },
      syncMesh: (alpha) => {
        view.position.set(px, py, pz);
        from.set(previous.q.x, previous.q.y, previous.q.z, previous.q.w);
        to.set(current.q.x, current.q.y, current.q.z, current.q.w);
        view.quaternion.slerpQuaternions(from, to, alpha);
      },
    };
  },
};
