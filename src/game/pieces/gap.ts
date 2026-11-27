import { emptyShape } from '../../engine/trackCollider';
import { CELL, entryFrame, STEP, toWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
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

type Gap = PieceOf<'gap'>;

/** Height of the kicker lip above the entry. */
export const KICKER_RISE = STEP;

/**
 * A kicker in `cell`, then `length` empty cells. The ball has to come in fast enough to fly over
 * and land on whatever piece starts after the hole, at the entry height.
 */
const build = ({ cell, rot, length, surface }: Gap): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const half = widthOf('normal') / 2;
  const shape = emptyShape();
  shape.floors.push(rectFloor(frame, [-half, half], [0, CELL], { y0: 0, kf: KICKER_RISE / CELL }, surfaceTag(surface)));

  const landing = CELL + length * CELL;
  const nav = emptyNav();
  nav.nodes.push(toWorld(frame, 0, CELL / 2, KICKER_RISE / 2), toWorld(frame, 0, landing, 0));
  nav.links.push({ from: 0, to: 1, oneWay: true, kind: 'jump' });
  nav.ports.push(port(frame, 0, 0, 0, back(frame), 0));
  nav.ports.push(port(frame, 1, 0, landing, frame.forward, 0));
  return { shape, nav, footprint: rectFootprint(frame, [0], [CELL / 2], () => [0, KICKER_RISE]) };
};

export const gap: PieceModule<Gap> = { build };
