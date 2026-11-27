import type * as CANNON from 'cannon-es';
import type { Vec2 } from '../engine/math';
import { applyGravity, gravityDirection, stepPhysics, type GravityDirection } from '../engine/physics';
import { smoothInput } from '../engine/input';
import type { LevelData } from '../levels/types';
import { BALL_RADIUS, type Ball } from './ball';
import type { EventBus, GameEvents } from './events';
import { GOAL_HINT_COOLDOWN, hasFallen, isInGoal, reachesCheckpoint, touchesCrystal } from './rules';
import type { LevelWorld } from './world';

export type SessionState = 'menu' | 'play' | 'win';

type Point = { x: number; y: number; z: number };

export type Session = {
  state: () => SessionState;
  /** Seconds since the page started, including time spent in menus (drives idle animations). */
  clock: () => number;
  /** Resets the level and starts playing. */
  start: () => void;
  /** Advances one rendered frame and returns the gravity direction the camera should follow. */
  update: (dt: number, input: Vec2) => GravityDirection;
};

type SessionDeps = {
  physics: CANNON.World;
  level: LevelData;
  world: LevelWorld;
  ball: Ball;
  events: EventBus<GameEvents>;
};

/** One play-through of a level: timer, falls, crystals, checkpoints and the win condition. */
export const createSession = ({ physics, level, world, ball, events }: SessionDeps): Session => {
  const { crystals, checkpoints, goal, movers } = world;
  const [sx, sy, sz] = level.start;
  const start: Point = { x: sx, y: sy, z: sz };
  const smoothed: Vec2 = { x: 0, y: 0 };

  let state: SessionState = 'menu';
  let time = 0;
  let falls = 0;
  let spawn: Point = start;
  let clock = 0;
  let lastGoalHint = 0;

  const collected = () => crystals.filter((c) => c.taken).length;
  const allCollected = () => collected() === crystals.length;

  const respawn = () => {
    ball.placeAt(spawn.x, spawn.y + 1, spawn.z);
    smoothed.x = smoothed.y = 0;
    events.emit('respawned', { x: spawn.x, y: spawn.y, z: spawn.z });
  };

  const reset = () => {
    time = 0;
    falls = 0;
    spawn = start;
    crystals.forEach((c) => c.reset());
    checkpoints.forEach((c) => c.reset());
    goal.reset();
    movers.forEach((m) => m.reset());
    respawn();
    events.emit('reset', { total: crystals.length });
  };

  const checkCrystals = (p: Point) => {
    for (const crystal of crystals) {
      if (crystal.taken || !touchesCrystal(p, crystal.position)) continue;
      crystal.collect();
      events.emit('crystalCollected', { collected: collected(), total: crystals.length });
      if (allCollected()) {
        goal.open();
        events.emit('allCrystalsCollected');
      }
    }
  };

  const checkCheckpoints = (p: Point) => {
    for (const checkpoint of checkpoints) {
      if (checkpoint.active || !reachesCheckpoint(p, checkpoint, BALL_RADIUS)) continue;
      checkpoint.activate();
      spawn = checkpoint;
      events.emit('checkpointReached');
    }
  };

  const checkGoal = (p: Point) => {
    if (!isInGoal(p, goal)) return;
    const missing = crystals.length - collected();
    if (!missing) {
      state = 'win';
      events.emit('levelWon', { time, falls });
    } else if (clock - lastGoalHint > GOAL_HINT_COOLDOWN) {
      lastGoalHint = clock;
      events.emit('goalLocked', { missing });
    }
  };

  const checkFall = (p: Point) => {
    if (!hasFallen(p, spawn)) return;
    falls++;
    events.emit('fell', { falls });
    respawn();
  };

  const play = (dt: number) => {
    movers.forEach((m) => m.update(dt));
    stepPhysics(physics, dt);
    time += dt;
    ball.limitSpeed();
    const p = ball.body.position;
    checkCrystals(p);
    checkCheckpoints(p);
    checkGoal(p);
    checkFall(p);
    events.emit('tick', { time });
  };

  const update = (dt: number, input: Vec2) => {
    clock += dt;
    smoothInput(smoothed, input, dt);
    const gravity = gravityDirection(smoothed);
    applyGravity(physics, gravity);

    if (state === 'play') play(dt);

    ball.syncMesh();
    movers.forEach((m) => m.syncMesh());
    crystals.forEach((c) => c.animate(clock, dt));
    goal.animate(clock, allCollected());
    return gravity;
  };

  reset();

  return {
    state: () => state,
    clock: () => clock,
    start: () => {
      reset();
      state = 'play';
    },
    update,
  };
};
