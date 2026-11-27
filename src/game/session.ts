import type { Vec2 } from '../engine/math';
import { createFixedStepper } from '../engine/loop';
import {
  applyGravity,
  gravityDirection,
  PHYSICS_STEP,
  stepPhysics,
  type GravityDirection,
  type PhysicsWorld,
} from '../engine/physics';
import { quantizeInput, smoothInput } from '../engine/input';
import { BALL_RADIUS, type Ball } from './ball';
import type { EventBus, GameEvents } from './events';
import { GOAL_HINT_COOLDOWN, hasFallen, isInGoal, reachesCheckpoint, touchesCrystal } from './rules';
import type { LevelWorld, Point } from './world';

export type SessionState = 'menu' | 'play' | 'paused' | 'win';

export type Session = {
  state: () => SessionState;
  /** Seconds since the page started, including time spent in menus (drives idle animations). */
  clock: () => number;
  /** Resets the level and starts playing. */
  start: () => void;
  /** Freezes the run (physics, timer, movers). Does nothing outside of play. */
  pause: () => void;
  resume: () => void;
  /**
   * Advances one rendered frame: runs as many fixed physics steps as `dt` allows, reading the input
   * once per step, then blends the visuals. Returns the gravity direction the camera should follow.
   */
  update: (dt: number, readInput: () => Vec2) => GravityDirection;
};

type SessionDeps = {
  physics: PhysicsWorld;
  world: LevelWorld;
  ball: Ball;
  events: EventBus<GameEvents>;
};

/** One play-through of a level: timer, falls, crystals, checkpoints and the win condition. */
export const createSession = ({ physics, world, ball, events }: SessionDeps): Session => {
  const { crystals, checkpoints, goal, movers } = world;
  const start: Point = world.spawn;
  const smoothed: Vec2 = { x: 0, y: 0 };
  const stepper = createFixedStepper(PHYSICS_STEP);
  let gravity = gravityDirection(smoothed);

  let state: SessionState = 'menu';
  let time = 0;
  let falls = 0;
  let spawn: Point = start;
  let clock = 0;
  let lastGoalHint = 0;

  const collected = () => crystals.filter((c) => c.taken).length;
  const allCollected = () => collected() === crystals.length;

  const respawn = () => {
    movers.forEach((m) => m.onRespawn?.());
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

  const play = () => {
    const probe = { position: ball.position(), radius: BALL_RADIUS };
    movers.forEach((m) => m.step(PHYSICS_STEP, probe));
    stepPhysics(physics);
    time += PHYSICS_STEP;
    ball.limitSpeed();
    ball.capture();
    const p = ball.position();
    checkCrystals(p);
    checkCheckpoints(p);
    checkGoal(p);
    checkFall(p);
  };

  const step = (readInput: () => Vec2) => {
    smoothInput(smoothed, quantizeInput(readInput()), PHYSICS_STEP);
    gravity = gravityDirection(smoothed);
    applyGravity(physics, gravity);
    if (state === 'play') play();
  };

  const update = (dt: number, readInput: () => Vec2) => {
    if (state === 'paused') return gravity;
    clock += dt;
    const alpha = stepper.advance(dt, () => step(readInput));
    if (state === 'play') events.emit('tick', { time });

    ball.syncMesh(alpha);
    movers.forEach((m) => m.syncMesh(alpha));
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
    pause: () => {
      if (state !== 'play') return;
      state = 'paused';
      events.emit('paused');
    },
    resume: () => {
      if (state !== 'paused') return;
      state = 'play';
      events.emit('resumed');
    },
    update,
  };
};
