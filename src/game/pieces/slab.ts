import type { Surface } from '../../art/palette';
import type { BoxSpec } from './box';
import type { PieceCollision } from './shape';

export const SLAB_THICKNESS = 0.5;

export type SlabData = {
  type: 'slab';
  at: readonly [number, number, number];
  size: readonly [number, number];
  surface: Surface;
};

/** Flat slab whose top surface sits at height `at[1]`. */
export const slab = ({ at: [x, y, z], size: [w, d], surface }: SlabData): BoxSpec[] => [
  { position: [x, y - SLAB_THICKNESS / 2, z], size: [w, SLAB_THICKNESS, d], surface },
];

export const slabCollision = ({ at: [x, y, z], size: [w, d] }: SlabData): PieceCollision => ({
  floors: [{ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, heightAtMinZ: y, heightAtMaxZ: y }],
  solids: [],
});
