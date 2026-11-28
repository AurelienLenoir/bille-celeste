import type { Particles } from '../art/particles';
import { CHECKPOINT_ON, CRYSTAL_HUES, GOAL_OPEN } from '../art/palette';
import type { EventBus, GameEvents } from './events';

type Point = { x: number; y: number; z: number };

export type JuiceDeps = {
  events: EventBus<GameEvents>;
  particles: Particles;
  /** Where the ball is drawn now. */
  ball: () => Point;
};

/** Trail colour while fast, and the speed (units/s) from which the trail shows. */
const TRAIL_COLOR = 0xffffff;
export const TRAIL_SPEED = 7.5;
/** Trail specks per second at top speed. */
const TRAIL_RATE = 70;

/** Particles on game events (PLAN.md § 5.4): collect, checkpoint, gem, respawn, win. */
export const bindJuice = ({ events, particles, ball }: JuiceDeps): (() => void) => {
  let hue = 0;
  const offs = [
    events.on('crystalCollected', () => {
      hue = (hue + 1) % CRYSTAL_HUES.length;
      particles.burst({
        at: ball(),
        color: CRYSTAL_HUES[hue] ?? 0xffffff,
        count: 18,
        speed: 3.2,
        up: 1.5,
        life: 0.7,
        size: 0.22,
        gravity: 4,
      });
      particles.burst({ at: ball(), color: 0xffffff, count: 8, speed: 1.5, up: 2, life: 0.5, size: 0.14 });
    }),
    events.on('checkpointReached', () =>
      particles.burst({
        at: ball(),
        color: CHECKPOINT_ON,
        count: 26,
        speed: 2.5,
        up: 3,
        life: 0.9,
        size: 0.2,
        gravity: 3,
      }),
    ),
    events.on('hiddenGemFound', () => {
      for (const color of [0xb07cff, 0xffffff, 0xffd04f]) {
        particles.burst({ at: ball(), color, count: 14, speed: 3.5, up: 2.5, life: 1, size: 0.2, gravity: 3 });
      }
    }),
    events.on('shieldSaved', () =>
      particles.burst({ at: ball(), color: 0x9fe8ff, count: 24, speed: 2, life: 0.6, size: 0.2 }),
    ),
    // A puff where the ball comes back (after a fall, and at the start).
    events.on('respawned', (at) =>
      particles.burst({ at, color: 0xffffff, count: 16, speed: 1.2, up: 0.8, life: 0.8, size: 0.35, gravity: -0.5 }),
    ),
    events.on('levelWon', () => {
      const at = ball();
      CRYSTAL_HUES.forEach((color) =>
        particles.burst({ at, color, count: 30, speed: 5, up: 4, life: 1.4, size: 0.24, gravity: 5, drag: 0.8 }),
      );
      particles.burst({ at, color: GOAL_OPEN.color, count: 30, speed: 3, up: 3, life: 1.2, size: 0.3, gravity: 2 });
    }),
  ];
  return () => offs.forEach((off) => off());
};

/** How many trail specks to emit this frame (fractional ones carry over through `debt`). */
export const trailCount = (speed: number, dt: number, debt: number): { count: number; debt: number } => {
  if (speed < TRAIL_SPEED) return { count: 0, debt: 0 };
  const rate = TRAIL_RATE * Math.min(1, (speed - TRAIL_SPEED) / 4);
  const total = debt + rate * dt;
  const count = Math.floor(total);
  return { count, debt: total - count };
};

/** Leaves a speck trail behind a fast ball. Call once per rendered frame. */
export const createBallTrail = (particles: Particles, color: () => number = () => TRAIL_COLOR) => {
  let debt = 0;
  return (at: Point, velocity: Point, dt: number) => {
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const next = trailCount(speed, dt, debt);
    debt = next.debt;
    for (let i = 0; i < next.count; i++) {
      const jitter = () => (Math.random() - 0.5) * 0.3;
      particles.emit(
        { x: at.x + jitter(), y: at.y + jitter(), z: at.z + jitter() },
        { x: -velocity.x * 0.05, y: 0.2, z: -velocity.z * 0.05 },
        color(),
        0.45,
        0.2,
      );
    }
  };
};
