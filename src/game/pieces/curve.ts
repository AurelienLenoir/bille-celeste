import type { Vec3Tuple } from '../../engine/math';
import { emptyShape, type Barrier } from '../../engine/trackCollider';
import { CELL, entryFrame, toWorld, type Dir, type Frame } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import {
  back,
  emptyNav,
  hasRail,
  port,
  RAIL,
  RAIL_TAG,
  surfaceTag,
  widthOf,
  type PieceBuild,
  type PieceModule,
} from './kit';

type Curve = PieceOf<'curve'>;

const SEGMENTS_PER_QUARTER = 8;

/**
 * Radius of the centre line in world units. A curve of radius N fills an N × N block of cells and
 * both its ends sit on cell edges, so it joins straights on the grid.
 */
export const centreRadius = (radius: number): number => radius * CELL - CELL / 2;

/** Local (s, f) of the point at angle `t` (radians) and distance `r` from the turn centre. */
const arcPoint = (R: number, side: number, r: number, t: number): [number, number] => [
  side * (R - r * Math.cos(t)),
  r * Math.sin(t),
];

export const curveExit = ({
  radius,
  angle,
  dir,
}: Curve): { s: number; f: number; heading: 'right' | 'left' | 'back' } => {
  const R = centreRadius(radius);
  const side = dir === 'right' ? 1 : -1;
  const [s, f] = arcPoint(R, side, R, (angle * Math.PI) / 180);
  return { s, f, heading: angle === 180 ? 'back' : dir };
};

const headingDir = (frame: Frame, heading: 'right' | 'left' | 'back'): Dir =>
  heading === 'right' ? frame.right : heading === 'left' ? [-frame.right[0], -frame.right[1]] : back(frame);

/** Quarter or half turn, flat, with optional rails along the arcs. */
const build = (piece: Curve): PieceBuild => {
  const { cell, rot, radius, angle, dir, width, rails, surface } = piece;
  const frame = entryFrame(cell, rot);
  const R = centreRadius(radius);
  const half = widthOf(width) / 2;
  const side = dir === 'right' ? 1 : -1;
  const inner = Math.max(0, R - half);
  const outer = R + half;
  const sweep = (angle * Math.PI) / 180;
  const segments = (SEGMENTS_PER_QUARTER * angle) / 90;
  const at = (r: number, t: number, y = 0): Vec3Tuple => toWorld(frame, ...arcPoint(R, side, r, t), y);
  const tag = surfaceTag(surface);

  const shape = emptyShape();
  for (let i = 0; i < segments; i++) {
    const [t0, t1] = [(i / segments) * sweep, ((i + 1) / segments) * sweep];
    shape.triangles.push({ points: [at(inner, t0), at(outer, t0), at(outer, t1)], tag });
    if (inner > 0) shape.triangles.push({ points: [at(inner, t0), at(outer, t1), at(inner, t1)], tag });
  }
  const arcRail = (r: number): Barrier => ({
    points: Array.from({ length: segments + 1 }, (_, i) => at(r, (i / segments) * sweep)),
    thickness: RAIL.thickness,
    height: RAIL.height,
    tag: RAIL_TAG,
  });
  // The inner arc is on the side the curve turns towards.
  const innerSide = dir;
  const outerSide = dir === 'right' ? 'left' : 'right';
  if (hasRail(rails, outerSide, half * 2)) shape.barriers.push(arcRail(outer + RAIL.thickness / 2));
  if (hasRail(rails, innerSide, half * 2) && inner > RAIL.thickness)
    shape.barriers.push(arcRail(inner - RAIL.thickness / 2));

  const nav = emptyNav();
  const count = Math.max(1, Math.round((R * sweep) / CELL));
  for (let i = 0; i < count; i++) {
    nav.nodes.push(at(R, ((i + 0.5) / count) * sweep));
    if (i > 0) nav.links.push({ from: i - 1, to: i });
  }
  const exit = curveExit(piece);
  nav.ports.push(port(frame, 0, 0, 0, back(frame), 0));
  nav.ports.push(port(frame, count - 1, exit.s, exit.f, headingDir(frame, exit.heading), 0));

  const footprint = [];
  const [cx, , cz] = toWorld(frame, side * R, 0);
  const reach = outer + CELL;
  for (let x = Math.ceil((cx - reach) / CELL); x <= Math.floor((cx + reach) / CELL); x++) {
    for (let z = Math.ceil((cz - reach) / CELL); z <= Math.floor((cz + reach) / CELL); z++) {
      const dx = x * CELL - cx;
      const dz = z * CELL - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < inner - 0.5 || dist > outer + 0.5) continue;
      // Angle of the cell centre around the turn, measured like `arcPoint`.
      const s = (dx * frame.right[0] + dz * frame.right[1]) * side;
      const f = dx * frame.forward[0] + dz * frame.forward[1];
      const t = Math.atan2(f, -s);
      if (t < -0.05 || t > sweep + 0.05) continue;
      footprint.push({ i: x, k: z, yMin: frame.origin[1], yMax: frame.origin[1] });
    }
  }
  return { shape, nav, footprint };
};

export const curve: PieceModule<Curve> = { build };
