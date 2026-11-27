import type { Vec3Tuple } from '../engine/math';

type Point = { x: number; y: number; z: number };

const CRYSTAL_PICKUP_RADIUS = 0.85;
const CRYSTAL_CENTRE_HEIGHT = 0.4;
const CHECKPOINT_RADIUS = 2.6;
const CHECKPOINT_HEIGHT_TOLERANCE = 1.2;
const GOAL_RADIUS = 1.25;
const GOAL_FLOOR_TOLERANCE = 0.5;
export const FALL_DEPTH = 9;
export const GOAL_HINT_COOLDOWN = 2.5;

export const touchesCrystal = (ball: Point, [x, y, z]: Vec3Tuple): boolean =>
  Math.hypot(ball.x - x, ball.y - (y + CRYSTAL_CENTRE_HEIGHT), ball.z - z) < CRYSTAL_PICKUP_RADIUS;

export const reachesCheckpoint = (ball: Point, checkpoint: Point, ballRadius: number): boolean =>
  Math.hypot(ball.x - checkpoint.x, ball.z - checkpoint.z) < CHECKPOINT_RADIUS &&
  Math.abs(ball.y - checkpoint.y - ballRadius) < CHECKPOINT_HEIGHT_TOLERANCE;

export const isInGoal = (ball: Point, goal: Point): boolean =>
  Math.hypot(ball.x - goal.x, ball.z - goal.z) < GOAL_RADIUS && ball.y > goal.y - GOAL_FLOOR_TOLERANCE;

/** Falling is measured from the current respawn point, so lower sections still work. */
export const hasFallen = (ball: Point, spawn: Point): boolean => ball.y < spawn.y - FALL_DEPTH;
