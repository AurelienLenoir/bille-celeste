import { emptyShape } from '../../engine/trackCollider';
import { CELL, edgeKey, entryFrame, toWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import { emptyNav, RAIL, RAIL_TAG, type PieceBuild, type PieceModule } from './kit';

type Wall = PieceOf<'wall'>;

/**
 * Guard wall standing just outside the front edge of `cell`, running `length` cells to the right.
 * It closes those cell edges for the validator and the bot.
 */
const build = ({ cell, rot, length, height }: Wall): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const f = CELL + RAIL.thickness / 2;
  const shape = emptyShape();
  shape.barriers.push({
    points: [toWorld(frame, -CELL / 2, f), toWorld(frame, length * CELL - CELL / 2, f)],
    thickness: RAIL.thickness,
    height,
    tag: RAIL_TAG,
  });
  const nav = emptyNav();
  const y = frame.origin[1];
  for (let c = 0; c < length; c++) {
    const [x, , z] = toWorld(frame, c * CELL, CELL);
    nav.blocks.push({ key: edgeKey(x, z), yMin: y - 0.3, yMax: y + height });
  }
  return { shape, nav, footprint: [] };
};

export const wall: PieceModule<Wall> = { build };
