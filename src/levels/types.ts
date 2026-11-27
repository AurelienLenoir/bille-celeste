import type { Vec3Tuple } from '../engine/math';
import type { MovingPlatformData } from '../game/pieces/movingPlatform';
import type { RampData } from '../game/pieces/ramp';
import type { SlabData } from '../game/pieces/slab';
import type { WallData } from '../game/pieces/wall';

export type PieceData = SlabData | WallData | RampData | MovingPlatformData;

/**
 * Prototype level format, kept as plain data so nothing is hard-coded in game logic.
 * Phase 2 replaces it with the grid-based, Zod-validated JSON format from PLAN.md § 3.
 */
export type LevelData = {
  id: string;
  name: string;
  start: Vec3Tuple;
  pieces: readonly PieceData[];
  crystals: readonly Vec3Tuple[];
  checkpoints: readonly Vec3Tuple[];
  goal: Vec3Tuple;
  decorSeed: number;
};
