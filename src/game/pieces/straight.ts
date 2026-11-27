import { emptyShape } from '../../engine/trackCollider';
import { CELL, entryFrame } from '../../levels/grid';
import type { PieceOf, Rails, Surface, Width } from '../../levels/schema';
import {
  hasRail,
  linearNav,
  rectFloor,
  rectFootprint,
  sideRails,
  surfaceTag,
  widthOf,
  type PieceBuild,
  type PieceModule,
} from './kit';

type Run = {
  cell: readonly [number, number, number];
  rot: number;
  length: number;
  width: Width;
  rails: Rails;
  surface: Surface;
};

/** Flat corridor of `length` cells; the width sets the difficulty. Shared by bridges. */
export const buildRun = ({ cell, rot, length, width, rails, surface }: Run): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const half = widthOf(width) / 2;
  const end = length * CELL;
  const shape = emptyShape();
  shape.floors.push(rectFloor(frame, [-half, half], [0, end], { y0: 0 }, surfaceTag(surface)));
  shape.barriers.push(...sideRails(frame, rails, half, [0, end], [0, 0]));
  const open = width === 'wide' || width === 'normal';
  const nav = linearNav(frame, length, () => 0, {
    left: open && !hasRail(rails, 'left'),
    right: open && !hasRail(rails, 'right'),
  });
  const rows = Array.from({ length }, (_, c) => c * CELL + CELL / 2);
  return { shape, nav, footprint: rectFootprint(frame, [0], rows, () => [0, 0]) };
};

export const straight: PieceModule<PieceOf<'straight'>> = { build: buildRun };
