import { emptyShape } from '../../engine/trackCollider';
import { CELL, entryFrame, toWorld } from '../../levels/grid';
import type { PieceOf } from '../../levels/schema';
import {
  back,
  emptyNav,
  port,
  RAIL,
  RAIL_TAG,
  rectFootprint,
  surfaceTag,
  type PieceBuild,
  type PieceModule,
} from './kit';

type Funnel = PieceOf<'funnel'>;

/** Length of the funnel in cells: it narrows by one cell on each side per cell. */
export const funnelLength = (diameter: number): number => (diameter + 1) / 2;

/** Wide mouth that narrows to a normal track, with rails along the slanted sides. */
const build = ({ cell, rot, diameter, surface }: Funnel): PieceBuild => {
  const frame = entryFrame(cell, rot);
  const mouth = (diameter * CELL) / 2;
  const neck = CELL / 2;
  const cells = funnelLength(diameter);
  const end = cells * CELL;
  const tag = surfaceTag(surface);
  const at = (s: number, f: number) => toWorld(frame, s, f);

  const shape = emptyShape();
  shape.triangles.push(
    { points: [at(-mouth, 0), at(mouth, 0), at(neck, end)], tag },
    { points: [at(-mouth, 0), at(neck, end), at(-neck, end)], tag },
  );
  // Rail centre line, pushed out of the slanted edge by half the rail thickness.
  const slant = Math.hypot(mouth - neck, end);
  const push = ((RAIL.thickness / 2) * slant) / end;
  for (const side of [-1, 1]) {
    shape.barriers.push({
      points: [at(side * (mouth + push), 0), at(side * (neck + push), end)],
      thickness: RAIL.thickness,
      height: RAIL.height,
      tag: RAIL_TAG,
    });
  }

  const nav = emptyNav();
  for (let c = 0; c < cells; c++) {
    nav.nodes.push(at(0, c * CELL + CELL / 2));
    if (c > 0) nav.links.push({ from: c - 1, to: c });
  }
  for (let s = -mouth + CELL / 2; s < mouth; s += CELL) nav.ports.push(port(frame, 0, s, 0, back(frame), 0));
  nav.ports.push(port(frame, cells - 1, 0, end, frame.forward, 0));

  const columns = [];
  for (let s = -mouth + CELL / 2; s < mouth; s += CELL) columns.push(s);
  const footprint = rectFootprint(frame, columns, [CELL / 2], () => [0, 0]);
  for (let c = 1; c < cells; c++) footprint.push(...rectFootprint(frame, [0], [c * CELL + CELL / 2], () => [0, 0]));
  return { shape, nav, footprint };
};

export const funnel: PieceModule<Funnel> = { build };
