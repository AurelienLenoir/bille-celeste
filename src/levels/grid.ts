import type { Vec3Tuple } from '../engine/math';

/** Size of one grid cell in the xz plane (world units). */
export const CELL = 2;
/** One height step on the grid (world units). */
export const STEP = 0.5;

export type Rot = 0 | 90 | 180 | 270;
export type CellCoord = readonly [number, number, number];
/** Horizontal direction as (dx, dz). */
export type Dir = readonly [number, number];

/** Centre of a cell, at its floor height. */
export const cellToWorld = ([i, j, k]: CellCoord): Vec3Tuple => [i * CELL, j * STEP, k * CELL];

/** Rotation 0 faces -z (away from the camera); 90 turns right, towards +x. */
export const forwardOf = (rot: number): Dir => {
  const r = (((rot % 360) + 360) % 360) as Rot;
  return ({ 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] } as const)[r];
};

export const rightOf = (rot: number): Dir => forwardOf(rot + 90);

/**
 * A piece's local frame: `s` goes right, `f` goes forward, `y` up, from `origin`. Every rotation is
 * a multiple of 90°, so local rectangles stay axis-aligned in the world.
 */
export type Frame = { origin: Vec3Tuple; forward: Dir; right: Dir };

export const frameAt = (origin: Vec3Tuple, rot: number): Frame => ({
  origin,
  forward: forwardOf(rot),
  right: rightOf(rot),
});

/** Frame whose origin is the middle of the back edge of `cell` (where a linear piece is entered). */
export const entryFrame = (cell: CellCoord, rot: number): Frame => {
  const [x, y, z] = cellToWorld(cell);
  const [fx, fz] = forwardOf(rot);
  return frameAt([x - (fx * CELL) / 2, y, z - (fz * CELL) / 2], rot);
};

export const toWorld = ({ origin, forward, right }: Frame, s: number, f: number, y = 0): Vec3Tuple => [
  origin[0] + right[0] * s + forward[0] * f,
  origin[1] + y,
  origin[2] + right[1] * s + forward[1] * f,
];

/** Cell containing a world point (xz only). */
export const worldToCell = (x: number, z: number): [number, number] => [Math.round(x / CELL), Math.round(z / CELL)];

/** Key of the cell edge whose midpoint is at world (x, z). Cell edges sit on odd coordinates. */
export const edgeKey = (x: number, z: number): string => `${Math.round(x * 100) / 100},${Math.round(z * 100) / 100}`;
