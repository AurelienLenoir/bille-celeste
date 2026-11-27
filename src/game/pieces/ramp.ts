import { emptyShape } from '../../engine/trackCollider';
import { CELL, entryFrame, STEP } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import {
  linearNav,
  rectFloor,
  rectFootprint,
  sideRails,
  surfaceTag,
  widthOf,
  type PieceBuild,
  type PieceModule,
} from './kit';

type Ramp = PieceOf<'ramp'>;

/** Straight slope: enters at the cell's height and leaves `drop` steps lower (higher if negative). */
const build = ({ cell, rot, length, drop, width, rails, surface }: Ramp): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const half = widthOf(width) / 2;
  const end = length * CELL;
  const fall = drop * STEP;
  const yAt = (f: number) => (-fall * f) / end;
  const shape = emptyShape();
  shape.floors.push(rectFloor(frame, [-half, half], [0, end], { y0: 0, kf: -fall / end }, surfaceTag(surface)));
  shape.barriers.push(...sideRails(frame, rails, half, [0, end], [0, -fall]));
  const rows = Array.from({ length }, (_, c) => c * CELL + CELL / 2);
  return {
    shape,
    nav: linearNav(frame, length, yAt),
    footprint: rectFootprint(frame, [0], rows, (f) => [yAt(f - CELL / 2), yAt(f + CELL / 2)]),
  };
};

export const ramp: PieceModule<Ramp> = { build };

/** Slope angle in degrees, used by the validator. */
export const rampAngle = ({ length, drop }: Ramp): number =>
  (Math.atan2(Math.abs(drop) * STEP, length * CELL) * 180) / Math.PI;
