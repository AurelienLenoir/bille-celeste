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

type Stairs = PieceOf<'stairs'>;

/** Steps one cell long, each half a unit below the previous one (the first is already one step down). */
const build = ({ cell, rot, steps, width, surface }: Stairs): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const half = widthOf(width) / 2;
  const tag = surfaceTag(surface);
  const shape = emptyShape();
  const nav = emptyNav();
  const yOf = (step: number) => -(step + 1) * STEP;
  for (let s = 0; s < steps; s++) {
    shape.floors.push(rectFloor(frame, [-half, half], [s * CELL, (s + 1) * CELL], { y0: yOf(s) }, tag));
    nav.nodes.push(toWorld(frame, 0, s * CELL + CELL / 2, yOf(s)));
    if (s > 0) nav.links.push({ from: s - 1, to: s, oneWay: true, kind: 'drop' });
  }
  nav.ports.push(port(frame, 0, 0, 0, back(frame), yOf(0)));
  nav.ports.push(port(frame, steps - 1, 0, steps * CELL, frame.forward, yOf(steps - 1)));
  const rows = Array.from({ length: steps }, (_, s) => s * CELL + CELL / 2);
  return {
    shape,
    nav,
    footprint: rectFootprint(frame, [0], rows, (f) => {
      const y = yOf(Math.floor(f / CELL));
      return [y, y];
    }),
  };
};

export const stairs: PieceModule<Stairs> = { build };
