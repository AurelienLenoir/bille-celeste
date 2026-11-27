import * as THREE from 'three';
import { createPlainMaterials } from '../art/materials';
import type { Vec2 } from '../engine/math';
import { createPhysicsWorld, PHYSICS_STEP } from '../engine/physics';
import type { Level } from '../levels/schema';
import { createBall, createBallMaterial, type Ball } from './ball';
import { createEventBus, type GameEvents } from './events';
import { createSession, type Session } from './session';
import { buildLevel, type LevelWorld } from './world';

export type HeadlessRun = {
  session: Session;
  world: LevelWorld;
  ball: Ball;
  events: ReturnType<typeof createEventBus<GameEvents>>;
  /** Advances exactly one physics step with the given input. */
  step: (input: Vec2) => void;
  dispose: () => void;
};

/** A level running without rendering, one physics step at a time (bot, replays, tests). Call initPhysics() first. */
export const startHeadless = (level: Level): HeadlessRun => {
  const physics = createPhysicsWorld();
  const scene = new THREE.Scene();
  const events = createEventBus<GameEvents>();
  const world = buildLevel({ world: physics, scene, materials: createPlainMaterials() }, level);
  const ball = createBall(physics, scene, createBallMaterial(false));
  const session = createSession({ physics, world, ball, events });
  session.start();
  let next: Vec2 = { x: 0, y: 0 };
  const read = () => next;
  return {
    session,
    world,
    ball,
    events,
    step: (input) => {
      next = input;
      session.update(PHYSICS_STEP, read);
    },
    dispose: () => physics.free(),
  };
};

export type RunResult = { won: boolean; time: number; falls: number; steps: number };

/** Plays a level with a driver choosing the input before each step, until it is won or time runs out. */
export const runHeadless = (
  level: Level,
  driver: (run: HeadlessRun) => () => Vec2,
  maxSeconds: number,
  onStep?: (input: Vec2) => void,
): RunResult => {
  const run = startHeadless(level);
  const drive = driver(run);
  const outcome = { won: false, time: 0, falls: 0, steps: 0 };
  run.events.on('levelWon', ({ time, falls }) => Object.assign(outcome, { won: true, time, falls }));
  run.events.on('fell', ({ falls }) => (outcome.falls = falls));
  run.events.on('tick', ({ time }) => {
    if (!outcome.won) outcome.time = time;
  });
  const maxSteps = Math.ceil(maxSeconds / PHYSICS_STEP);
  while (!outcome.won && outcome.steps < maxSteps) {
    const input = drive();
    onStep?.(input);
    run.step(input);
    outcome.steps++;
  }
  run.dispose();
  return outcome;
};
