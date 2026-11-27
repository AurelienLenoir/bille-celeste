import type { BoxSpec } from './box';

export const WALL_HEIGHT = 0.6;

export type WallData = { type: 'wall'; at: readonly [number, number, number]; size: readonly [number, number] };

/** Low guard wall standing on a surface at height `at[1]`. */
export const wall = ({ at: [x, y, z], size: [w, d] }: WallData): BoxSpec[] => [
  { position: [x, y + WALL_HEIGHT / 2, z], size: [w, WALL_HEIGHT, d], surface: 'lav' },
];
