import type { Surface } from '../../art/palette';
import type { BoxSpec } from './box';

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
