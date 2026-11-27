import type { Surface } from '../../art/palette';
import type { BoxSpec } from './box';
import { solidFromBox, type PieceCollision } from './shape';

const DECK_THICKNESS = 0.5;
const OVERLAP = 0.3;
const RAIL = { width: 0.3, height: 0.8 } as const;

export type RampData = {
  type: 'ramp';
  /** Top-centre of the high end. */
  at: readonly [number, number, number];
  length: number;
  drop: number;
  width: number;
  surface: Surface;
};

/** Slope descending towards -z, with a rail on each side. The deck box overlaps its neighbours slightly for looks. */
export const ramp = ({ at: [x, y0, z0], length, drop, width, surface }: RampData): BoxSpec[] => {
  const angle = Math.atan2(drop, length);
  const slopeLength = Math.hypot(length, drop) + OVERLAP;
  const normalY = Math.cos(angle);
  const normalZ = -Math.sin(angle);
  const midY = y0 - drop / 2;
  const midZ = z0 - length / 2;
  const half = DECK_THICKNESS / 2;

  const deck: BoxSpec = {
    position: [x, midY - half * normalY, midZ - half * normalZ],
    size: [width, DECK_THICKNESS, slopeLength],
    rotationX: -angle,
    surface,
  };
  const rails = [-1, 1].map((side): BoxSpec => ({
    position: [x + side * (width / 2 + RAIL.width / 2), midY + 0.4 * normalY, midZ + 0.4 * normalZ],
    size: [RAIL.width, RAIL.height, slopeLength],
    rotationX: -angle,
    surface: 'lav',
  }));
  return [deck, ...rails];
};

/**
 * The walkable part is the exact slope from (z0, y0) to (z0 - length, y0 - drop), so it shares its
 * end edges with the slabs it joins instead of poking out of them like the drawn deck does.
 */
export const rampCollision = (data: RampData): PieceCollision => {
  const {
    at: [x, y0, z0],
    length,
    drop,
    width,
  } = data;
  const [, ...rails] = ramp(data);
  return {
    floors: [
      {
        minX: x - width / 2,
        maxX: x + width / 2,
        minZ: z0 - length,
        maxZ: z0,
        heightAtMinZ: y0 - drop,
        heightAtMaxZ: y0,
      },
    ],
    solids: rails.map(solidFromBox),
  };
};
