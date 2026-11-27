import { emptyShape } from '../../engine/trackCollider';
import { CELL, entryFrame } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { linearNav, rectFloor, rectFootprint, surfaceTag, type PieceBuild, type PieceModule } from './kit';

type HalfPipe = PieceOf<'halfPipe'>;

const WALL_HEIGHT = 1.2;
const SEGMENTS = 4;

/**
 * Cross-section of the pipe, from the centre outwards: a flat bottom one cell wide, then a curved
 * wall over the next cell on each side. Returns (s, y) points for the right half.
 */
export const halfPipeProfile = (): [number, number][] => {
  const points: [number, number][] = [[CELL / 2, 0]];
  for (let i = 1; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    points.push([CELL / 2 + CELL * t, WALL_HEIGHT * (1 - Math.sqrt(1 - t * t))]);
  }
  return points;
};

/** Forgiving U-shaped channel three cells wide; only the middle cell connects at each end. */
const build = ({ cell, rot, length, surface }: HalfPipe): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const end = length * CELL;
  const tag = surfaceTag(surface);
  const shape = emptyShape();
  shape.floors.push(rectFloor(frame, [-CELL / 2, CELL / 2], [0, end], { y0: 0 }, tag));
  const profile = halfPipeProfile();
  for (let i = 0; i < profile.length - 1; i++) {
    const [sa, ya] = profile[i] ?? [0, 0];
    const [sb, yb] = profile[i + 1] ?? [0, 0];
    const ks = (yb - ya) / (sb - sa);
    shape.floors.push(rectFloor(frame, [sa, sb], [0, end], { y0: ya, ks }, tag));
    shape.floors.push(rectFloor(frame, [-sb, -sa], [0, end], { y0: yb, ks: -ks }, tag));
  }
  const rows = Array.from({ length }, (_, c) => c * CELL + CELL / 2);
  return {
    shape,
    nav: linearNav(frame, length, () => 0),
    footprint: rectFootprint(frame, [-CELL, 0, CELL], rows, () => [0, WALL_HEIGHT]),
  };
};

export const halfPipe: PieceModule<HalfPipe> = { build };
