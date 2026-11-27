/** States a pickup gives the ball for a while (PLAN.md § 5). The shield lasts until it is used. */
export type TimedEffect = 'magnet' | 'shield' | 'slowMo' | 'feather' | 'heavy';

export type ActiveEffect = { type: TimedEffect; left: number };

/** Durations in seconds of chrono time (slow motion does not stretch them). */
export const EFFECT_SECONDS: Record<TimedEffect, number> = {
  magnet: 8,
  shield: Infinity,
  slowMo: 5,
  feather: 6,
  heavy: 6,
};

/** Feather and heavy ball cancel each other: picking one up ends the other. */
const OPPOSITE: Partial<Record<TimedEffect, TimedEffect>> = { feather: 'heavy', heavy: 'feather' };

export type EffectTimers = {
  grant: (type: TimedEffect) => void;
  has: (type: TimedEffect) => boolean;
  /** Ends an effect early (the shield when it saves a fall). Returns whether it was active. */
  consume: (type: TimedEffect) => boolean;
  /** Counts down; returns the effects that just ran out. */
  step: (dt: number) => TimedEffect[];
  active: () => ActiveEffect[];
  reset: () => void;
};

export const createEffectTimers = (): EffectTimers => {
  const left = new Map<TimedEffect, number>();
  return {
    grant: (type) => {
      const opposite = OPPOSITE[type];
      if (opposite) left.delete(opposite);
      left.set(type, EFFECT_SECONDS[type]);
    },
    has: (type) => left.has(type),
    consume: (type) => left.delete(type),
    step: (dt) => {
      const ended: TimedEffect[] = [];
      for (const [type, seconds] of left) {
        const next = seconds - dt;
        if (next > 0) left.set(type, next);
        else {
          left.delete(type);
          ended.push(type);
        }
      }
      return ended;
    },
    active: () => [...left].map(([type, seconds]) => ({ type, left: seconds })),
    reset: () => left.clear(),
  };
};

/** Gravity multipliers: vertical part, then the tilt (horizontal) part. */
export const GRAVITY_SCALE = {
  normal: { vertical: 1, tilt: 1 },
  /** Floaty: falls slowly, so jumps carry further. */
  feather: { vertical: 0.5, tilt: 0.8 },
  /** Gravity × 1.5, and tilting has less grip on the ball. */
  heavy: { vertical: 1.5, tilt: 0.7 },
} as const;

/** Game time runs at this rate in slow motion; the chrono does not slow down. */
export const SLOW_MOTION = 0.6;
/** The magnet pulls crystals within this radius (units). */
export const MAGNET_RADIUS = 4;
/** Seconds the hourglass takes off the chrono. */
export const HOURGLASS_SECONDS = 5;
