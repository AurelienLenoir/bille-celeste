import type { Vec3Tuple } from '../../engine/math';
import { RAPIER, SURFACE } from '../../engine/physics';
import { emptyShape } from '../../engine/trackCollider';
import { CELL, cellToWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { createBodyView } from './body';
import { emptyNav, perimeterPorts, surfaceTag, type PieceBuild, type PieceModule } from './kit';

type MovingPlatform = PieceOf<'movingPlatform'>;

export const PLATFORM_THICKNESS = 0.5;
/** Seconds to reach full speed (and to stop), so a ball on the platform is not thrown off. */
export const RAMP_TIME = 0.5;

/** Distance covered after `t` seconds on a segment of length `len`, with smooth start and stop. */
export const travelled = (len: number, speed: number, t: number): { d: number; duration: number } => {
  const accel = speed / RAMP_TIME;
  const cruise = len >= speed * RAMP_TIME;
  const top = cruise ? speed : Math.sqrt(len * accel);
  const ramp = top / accel;
  const duration = cruise ? len / speed + RAMP_TIME : 2 * ramp;
  const tc = Math.min(Math.max(t, 0), duration);
  if (tc < ramp) return { d: 0.5 * accel * tc * tc, duration };
  if (tc > duration - ramp) return { d: len - 0.5 * accel * (duration - tc) ** 2, duration };
  return { d: 0.5 * accel * ramp * ramp + top * (tc - ramp), duration };
};

export type Shuttle = {
  position: () => Vec3Tuple;
  previous: () => Vec3Tuple;
  step: (dt: number) => void;
  reset: () => void;
};

/** Goes back and forth along `stops`, pausing at each one. */
export const createShuttle = (stops: readonly Vec3Tuple[], speed: number, pause: number): Shuttle => {
  let from = 0;
  let dir = 1;
  let t = 0;
  let wait = pause;
  const start = stops[0] ?? [0, 0, 0];
  let pos: Vec3Tuple = start;
  let prev: Vec3Tuple = start;

  const lerp = (a: Vec3Tuple, b: Vec3Tuple, k: number): Vec3Tuple => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];

  return {
    position: () => pos,
    previous: () => prev,
    step: (dt) => {
      prev = pos;
      if (wait > 0) {
        wait -= dt;
        return;
      }
      const a = stops[from] ?? start;
      const b = stops[from + dir] ?? a;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      t += dt;
      const { d, duration } = travelled(len, speed, t);
      pos = lerp(a, b, len ? d / len : 1);
      if (t < duration) return;
      from += dir;
      if (from + dir < 0 || from + dir >= stops.length) dir = -dir;
      t = 0;
      wait = pause;
    },
    reset: () => {
      from = 0;
      dir = 1;
      t = 0;
      wait = pause;
      pos = prev = start;
    },
  };
};

const halfSize = ({ size }: MovingPlatform): [number, number] => [(size[0] * CELL) / 2, (size[1] * CELL) / 2];

/** Kinematic platform travelling along its path; it carries the ball through friction. */
const build = (piece: MovingPlatform): PieceBuild => {
  const [hx, hz] = halfSize(piece);
  const stops = piece.path.map(cellToWorld);
  const [x, y, z] = stops[0] ?? [0, 0, 0];
  const body = emptyShape();
  body.floors.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, y, tag: surfaceTag(piece.surface) });
  const nav = emptyNav();
  stops.forEach(([sx, sy, sz], i) => {
    nav.nodes.push([sx, sy, sz]);
    if (i > 0) nav.links.push({ from: i - 1, to: i, kind: 'ride' });
    nav.ports.push(...perimeterPorts(i, [sx - hx, sx + hx, sz - hz, sz + hz], sy));
  });
  return { shape: emptyShape(), body, nav, footprint: [] };
};

export const movingPlatform: PieceModule<MovingPlatform> = {
  build,
  createMover: (ctx, piece) => {
    const [hx, hz] = halfSize(piece);
    const local = emptyShape();
    local.floors.push({ minX: -hx, maxX: hx, minZ: -hz, maxZ: hz, y: 0, tag: surfaceTag(piece.surface) });
    const view = createBodyView(ctx, local);
    const shuttle = createShuttle(piece.path.map(cellToWorld), piece.speed, piece.pause);
    const [x, y, z] = shuttle.position();
    const body = ctx.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, PLATFORM_THICKNESS / 2, hz)
        .setTranslation(0, -PLATFORM_THICKNESS / 2, 0)
        .setFriction(SURFACE.friction)
        .setRestitution(SURFACE.restitution),
      body,
    );
    const place = ([px, py, pz]: Vec3Tuple) => ({ x: px, y: py, z: pz });
    return {
      position: shuttle.position,
      step: (dt) => {
        shuttle.step(dt);
        body.setNextKinematicTranslation(place(shuttle.position()));
      },
      reset: () => {
        shuttle.reset();
        body.setTranslation(place(shuttle.position()), true);
      },
      syncMesh: (alpha) => {
        const [ax, ay, az] = shuttle.previous();
        const [bx, by, bz] = shuttle.position();
        view.position.set(ax + (bx - ax) * alpha, ay + (by - ay) * alpha, az + (bz - az) * alpha);
      },
    };
  },
};
