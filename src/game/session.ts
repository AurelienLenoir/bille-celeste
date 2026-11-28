import type { Vec2, Vec3Tuple } from '../engine/math';
import { createFixedStepper } from '../engine/loop';
import {
  applyGravity,
  GRAVITY,
  gravityDirection,
  PHYSICS_STEP,
  stepPhysics,
  type GravityDirection,
  type PhysicsWorld,
} from '../engine/physics';
import { quantizeInput, smoothInput } from '../engine/input';
import { BALL_RADIUS, NORMAL_GRIP, type Ball, type Grip } from './ball';
import { createEffectTimers, GRAVITY_SCALE, MAGNET_RADIUS, SLOW_MOTION, type ActiveEffect } from './effects';
import type { EventBus, GameEvents } from './events';
import { createGroundTrail } from './groundTrail';
import { neutralEffects, type ModifierRun, type StepEffects } from './modifiers/kit';
import { GOAL_HINT_COOLDOWN, hasFallen, isInGoal, reachesCheckpoint, starsFor, touchesCrystal } from './rules';
import type { Crystal } from './entities/crystal';
import type { LevelWorld, LiveModifier, Point } from './world';

export type SessionState = 'menu' | 'play' | 'paused' | 'win';

/** What the modifiers do to the run right now (camera fog, bot). */
export type RunStatus = {
  /** 0 clear, 1 thickest fog. */
  fog: number;
  invert: boolean;
  /** Game speed: 1, or less in slow motion. */
  timeScale: number;
  /** Acceleration the zones add to the ball (units/s²). */
  push: Point;
  effects: ActiveEffect[];
  /** Grip of the zone under the ball (rolling sound). */
  grip: Grip;
};

export type Session = {
  state: () => SessionState;
  /** Seconds since the page started, including time spent in menus (drives idle animations). */
  clock: () => number;
  /** Resets the level and starts playing. */
  start: () => void;
  /** Leaves the run: the level goes back to its start, still and out of play (menus). */
  stop: () => void;
  /** Freezes the run (physics, timer, movers). Does nothing outside of play. */
  pause: () => void;
  resume: () => void;
  /**
   * Advances one rendered frame: runs as many fixed physics steps as `dt` allows, reading the input
   * once per step, then blends the visuals. Returns the gravity direction the camera should follow.
   */
  update: (dt: number, readInput: () => Vec2) => GravityDirection;
  status: () => RunStatus;
  /** Since the last fall, can the ball be put back where it fell instead of at the checkpoint? */
  canRevive: () => boolean;
  /**
   * Puts the ball back on the ground just before its last fall, with the crystals that fall put
   * back (the "continue here" reward, PLAN.md § 10.3). The fall still counts.
   */
  revive: () => boolean;
};

type SessionDeps = {
  physics: PhysicsWorld;
  world: LevelWorld;
  ball: Ball;
  events: EventBus<GameEvents>;
};

/** Crystals pulled by the magnet fly at this speed (units/s). */
const MAGNET_PULL = 12;
/** After the goal, the ball rolls on in slow motion for 0.3 s (PLAN.md § 5.4), at this speed. */
export const WIN_SLOW_MOTION = 0.25;
const WIN_COAST_STEPS = Math.round(0.3 / PHYSICS_STEP);
/** The shield puts the ball back this high above the ground it was rolling on. */
const SHIELD_LIFT = 0.3;

const resetEffects = (e: StepEffects) => {
  e.grip = NORMAL_GRIP;
  e.push.x = e.push.y = e.push.z = 0;
  e.invert = false;
  e.fog = 0;
};

/** One play-through of a level: timer, falls, crystals, checkpoints, modifiers and the win condition. */
export const createSession = ({ physics, world, ball, events }: SessionDeps): Session => {
  const { crystals, checkpoints, goal, movers, gem, modifiers } = world;
  const start: Point = world.spawn;
  const smoothed: Vec2 = { x: 0, y: 0 };
  const stepper = createFixedStepper(PHYSICS_STEP);
  const timers = createEffectTimers();
  const trail = createGroundTrail();
  const effects = neutralEffects(NORMAL_GRIP);
  const inside = modifiers.map(() => false);
  let gravity = gravityDirection(smoothed);
  let status: RunStatus = {
    fog: 0,
    invert: false,
    timeScale: 1,
    push: { x: 0, y: 0, z: 0 },
    effects: [],
    grip: NORMAL_GRIP,
  };

  let state: SessionState = 'menu';
  let time = 0;
  let falls = 0;
  let spawn: Point = start;
  let clock = 0;
  let lastGoalHint = 0;
  /** Crystals (and gem) picked up since the last checkpoint: a fall puts them back (PLAN.md § 5.3). */
  let sinceCheckpoint: Crystal[] = [];
  let gemSinceCheckpoint = false;
  /** The timer waits for the player's first move. */
  let started = false;
  /** Where and with what the last fall can be undone. */
  let revivable: { point: Point; crystals: Crystal[]; gem: boolean } | undefined;
  /** Steps of slow motion left after the win. */
  let coast = 0;

  const runOf = ({ data }: LiveModifier): ModifierRun => ({
    ball,
    effects,
    grant: timers.grant,
    shiftTimer: (seconds) => (time = Math.max(0, time + seconds)),
    fire: () => events.emit('modifierFired', { type: data.type }),
  });
  const runs = modifiers.map(runOf);

  const collected = () => crystals.filter((c) => c.taken).length;
  const allCollected = () => collected() === crystals.length;

  const respawnAt = (p: Point, lift: number) => {
    movers.forEach((m) => m.onRespawn?.());
    ball.placeAt(p.x, p.y + lift, p.z);
    smoothed.x = smoothed.y = 0;
    events.emit('respawned', { x: p.x, y: p.y, z: p.z });
  };
  const respawn = () => respawnAt(spawn, 1);

  const reset = () => {
    time = 0;
    falls = 0;
    spawn = start;
    sinceCheckpoint = [];
    gemSinceCheckpoint = false;
    started = false;
    coast = 0;
    revivable = undefined;
    crystals.forEach((c) => c.reset());
    checkpoints.forEach((c) => c.reset());
    gem?.reset();
    goal.reset();
    movers.forEach((m) => m.reset());
    modifiers.forEach((m) => m.instance.reset());
    inside.fill(false);
    timers.reset();
    trail.clear();
    resetEffects(effects);
    status = { fog: 0, invert: false, timeScale: 1, push: { x: 0, y: 0, z: 0 }, effects: [], grip: NORMAL_GRIP };
    respawn();
    events.emit('reset', { total: crystals.length });
  };

  const checkCrystals = (p: Point) => {
    const magnet = timers.has('magnet');
    for (const crystal of crystals) {
      if (crystal.taken) continue;
      if (magnet) {
        const [x, y, z] = crystal.position;
        if (Math.hypot(p.x - x, p.y - y, p.z - z) < MAGNET_RADIUS) {
          const target: Vec3Tuple = [p.x, p.y - 0.4, p.z];
          crystal.pull(target, MAGNET_PULL * PHYSICS_STEP);
        }
      }
      if (!touchesCrystal(p, crystal.position)) continue;
      crystal.collect();
      sinceCheckpoint.push(crystal);
      events.emit('crystalCollected', { collected: collected(), total: crystals.length });
      if (allCollected()) {
        goal.open();
        events.emit('allCrystalsCollected');
      }
    }
    if (gem && !gem.taken && touchesCrystal(p, gem.position)) {
      gem.collect();
      gemSinceCheckpoint = true;
      events.emit('hiddenGemFound');
    }
  };

  const checkCheckpoints = (p: Point) => {
    for (const checkpoint of checkpoints) {
      if (checkpoint.active || !reachesCheckpoint(p, checkpoint, BALL_RADIUS)) continue;
      checkpoint.activate();
      spawn = checkpoint;
      revivable = undefined;
      sinceCheckpoint = [];
      gemSinceCheckpoint = false;
      events.emit('checkpointReached');
    }
  };

  const checkGoal = (p: Point) => {
    if (!isInGoal(p, goal)) return;
    const missing = crystals.length - collected();
    if (!missing) {
      state = 'win';
      coast = WIN_COAST_STEPS;
      events.emit('levelWon', { time, falls, stars: starsFor(time, falls, world.parTimeSec), gem: !!gem?.taken });
    } else if (clock - lastGoalHint > GOAL_HINT_COOLDOWN) {
      lastGoalHint = clock;
      events.emit('goalLocked', { missing });
    }
  };

  const putBackSinceCheckpoint = () => {
    if (gemSinceCheckpoint) gem?.reset();
    gemSinceCheckpoint = false;
    if (!sinceCheckpoint.length) return;
    sinceCheckpoint.forEach((c) => c.reset());
    sinceCheckpoint = [];
    goal.reset();
    events.emit('crystalsPutBack', { collected: collected(), total: crystals.length });
  };

  const checkFall = (p: Point) => {
    if (!hasFallen(p, spawn)) return;
    const safe = trail.safePoint();
    if (safe && timers.consume('shield')) {
      trail.clear();
      respawnAt(safe, SHIELD_LIFT);
      events.emit('shieldSaved');
      return;
    }
    falls++;
    revivable = safe ? { point: safe, crystals: [...sinceCheckpoint], gem: gemSinceCheckpoint } : undefined;
    trail.clear();
    events.emit('fell', { falls });
    putBackSinceCheckpoint();
    respawn();
  };

  /** Zones the ball was in after the last step act on this one. */
  const gatherEffects = () => {
    resetEffects(effects);
    modifiers.forEach((m, i) => {
      if (inside[i]) m.instance.inside?.(runs[i] as ModifierRun);
    });
  };

  /** Extra acceleration on the ball: zone pushes, plus the feather or heavy ball's gravity. */
  const ballAcceleration = (): Point => {
    const scale = timers.has('feather')
      ? GRAVITY_SCALE.feather
      : timers.has('heavy')
        ? GRAVITY_SCALE.heavy
        : GRAVITY_SCALE.normal;
    return {
      x: effects.push.x + gravity.x * GRAVITY * (scale.tilt - 1),
      y: effects.push.y + gravity.y * GRAVITY * (scale.vertical - 1),
      z: effects.push.z + gravity.z * GRAVITY * (scale.tilt - 1),
    };
  };

  const accelerate = (a: Point, dt: number) => {
    if (!a.x && !a.y && !a.z) return;
    const v = ball.velocity();
    ball.setVelocity({ x: v.x + a.x * dt, y: v.y + a.y * dt, z: v.z + a.z * dt });
  };

  /** Fires the enter and exit callbacks from the sensors' state after the physics step. */
  const updateTriggers = () => {
    modifiers.forEach((m, i) => {
      if (!m.sensor) return;
      const now = physics.intersectionPair(m.sensor, ball.collider);
      if (now === inside[i]) return;
      inside[i] = now;
      const run = runs[i] as ModifierRun;
      if (now) m.instance.onEnter?.(run);
      else m.instance.onExit?.(run);
    });
  };

  const play = () => {
    const timeScale = timers.has('slowMo') ? SLOW_MOTION : 1;
    const dt = PHYSICS_STEP * timeScale;
    if (modifiers.length) gatherEffects();
    ball.setGrip(effects.grip);
    const acceleration = ballAcceleration();
    accelerate(acceleration, dt);

    const probe = { position: ball.position(), radius: BALL_RADIUS };
    movers.forEach((m) => m.step(dt, probe));
    modifiers.forEach((m, i) => m.instance.step?.(dt, runs[i] as ModifierRun));
    stepPhysics(physics, timeScale);
    if (started) time += PHYSICS_STEP;
    timers.step(PHYSICS_STEP).forEach((type) => events.emit('effectEnded', { type }));
    ball.limitSpeed();
    ball.capture();
    if (modifiers.length) updateTriggers();
    const p = ball.position();
    trail.record(p, ball.grounded, PHYSICS_STEP);
    status = {
      fog: effects.fog,
      invert: effects.invert,
      timeScale,
      push: { ...effects.push },
      effects: status.effects,
      grip: effects.grip,
    };
    checkCrystals(p);
    checkCheckpoints(p);
    checkGoal(p);
    checkFall(p);
  };

  const step = (readInput: () => Vec2) => {
    const raw = quantizeInput(readInput());
    if (state === 'play' && (raw.x || raw.y)) started = true;
    const input = status.invert && state === 'play' ? { x: -raw.x, y: -raw.y } : raw;
    smoothInput(smoothed, input, PHYSICS_STEP);
    gravity = gravityDirection(smoothed);
    applyGravity(physics, gravity);
    if (state === 'play') play();
    else if (state === 'win' && coast > 0) {
      coast--;
      stepPhysics(physics, WIN_SLOW_MOTION);
      ball.capture();
      // Both records equal once the coast is over, so the still ball does not flicker.
      if (!coast) ball.capture();
    }
  };

  const update = (dt: number, readInput: () => Vec2) => {
    if (state === 'paused') return gravity;
    clock += dt;
    const alpha = stepper.advance(dt, () => step(readInput));
    status.effects = timers.active();
    if (state === 'play') events.emit('tick', { time, effects: status.effects });

    ball.syncMesh(alpha);
    movers.forEach((m) => m.syncMesh(alpha));
    modifiers.forEach((m) => m.instance.syncMesh(alpha, clock));
    crystals.forEach((c) => c.animate(clock, dt));
    gem?.animate(clock, dt);
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
    stop: () => {
      reset();
      state = 'menu';
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
    status: () => status,
    canRevive: () => !!revivable,
    revive: () => {
      if (!revivable || (state !== 'play' && state !== 'paused')) return false;
      const { point, crystals: back, gem: gemBack } = revivable;
      revivable = undefined;
      back.forEach((c) => c.collect());
      sinceCheckpoint = back;
      if (gemBack) gem?.collect();
      gemSinceCheckpoint = gemBack;
      if (back.length) {
        events.emit('crystalCollected', { collected: collected(), total: crystals.length });
        if (allCollected()) goal.open();
      }
      trail.clear();
      respawnAt(point, SHIELD_LIFT);
      return true;
    },
  };
};
