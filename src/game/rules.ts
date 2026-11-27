import type { Vec3Tuple } from '../engine/math';

type Point = { x: number; y: number; z: number };

const CRYSTAL_PICKUP_RADIUS = 0.85;
const CRYSTAL_CENTRE_HEIGHT = 0.4;
/** Half-size of the zone that triggers a checkpoint: its whole 3 × 3 cell platform (6 × 6 units). */
const CHECKPOINT_HALF_SIZE = 3;
const CHECKPOINT_HEIGHT_TOLERANCE = 1.2;
const GOAL_RADIUS = 1.25;
const GOAL_FLOOR_TOLERANCE = 0.5;
export const FALL_DEPTH = 9;
export const GOAL_HINT_COOLDOWN = 2.5;

export const touchesCrystal = (ball: Point, [x, y, z]: Vec3Tuple): boolean =>
  Math.hypot(ball.x - x, ball.y - (y + CRYSTAL_CENTRE_HEIGHT), ball.z - z) < CRYSTAL_PICKUP_RADIUS;

/** Anywhere on the checkpoint's platform counts, so cutting across a corner still saves it. */
export const reachesCheckpoint = (ball: Point, checkpoint: Point, ballRadius: number): boolean =>
  Math.abs(ball.x - checkpoint.x) < CHECKPOINT_HALF_SIZE &&
  Math.abs(ball.z - checkpoint.z) < CHECKPOINT_HALF_SIZE &&
  Math.abs(ball.y - checkpoint.y - ballRadius) < CHECKPOINT_HEIGHT_TOLERANCE;

export const isInGoal = (ball: Point, goal: Point): boolean =>
  Math.hypot(ball.x - goal.x, ball.z - goal.z) < GOAL_RADIUS && ball.y > goal.y - GOAL_FLOOR_TOLERANCE;

/** Falling is measured from the current respawn point, so lower sections still work. */
export const hasFallen = (ball: Point, spawn: Point): boolean => ball.y < spawn.y - FALL_DEPTH;

/** Stars of a finished run (PLAN.md § 5.3): one for finishing, one under the par time, one without a fall. */
export type Stars = { underPar: boolean; noFall: boolean; count: 1 | 2 | 3 };

export const starsFor = (time: number, falls: number, parTimeSec: number): Stars => {
  const underPar = time <= parTimeSec;
  const noFall = falls === 0;
  return { underPar, noFall, count: (1 + Number(underPar) + Number(noFall)) as Stars['count'] };
};
