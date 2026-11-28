import type { Grip } from './ball';

/** What the ball rolls on, for its sound (PLAN.md § 5.4). */
export type RollSurface = 'wood' | 'ice' | 'metal' | 'sand';

/** The course's own material in each world. */
export const THEME_SURFACE: Record<string, RollSurface> = {
  garden: 'wood',
  sunset: 'wood',
  glacier: 'ice',
  factory: 'metal',
};

/** A zone's grip wins over the course's material: ice is slippery, sand drags. */
export const surfaceUnder = (theme: string, grip: Grip): RollSurface => {
  if (grip.friction < 0.1) return 'ice';
  if (grip.damping > 1) return 'sand';
  return THEME_SURFACE[theme] ?? 'wood';
};

/** Low-pass colour of each surface: base frequency, extra Hz per unit of speed, resonance. */
const TONE: Record<RollSurface, { base: number; perSpeed: number; q: number; loud: number }> = {
  wood: { base: 180, perSpeed: 55, q: 1.2, loud: 1 },
  ice: { base: 900, perSpeed: 160, q: 6, loud: 0.55 },
  metal: { base: 420, perSpeed: 90, q: 9, loud: 0.8 },
  sand: { base: 260, perSpeed: 120, q: 0.4, loud: 1.2 },
};

export type RollSound = { gain: number; frequency: number; q: number };

const SILENT: RollSound = { gain: 0, frequency: 200, q: 1 };
/** Below this speed the ball is silent; at `FULL_SPEED` it is as loud as it gets. */
const QUIET_SPEED = 0.3;
const FULL_SPEED = 11;
const MAX_GAIN = 0.18;

/** The rolling sound for a ball moving at `speed` (units/s). In the air, it is silent. */
export const rollingSound = (speed: number, grounded: boolean, surface: RollSurface): RollSound => {
  if (!grounded || speed < QUIET_SPEED) return SILENT;
  const tone = TONE[surface];
  const amount = Math.min(1, (speed - QUIET_SPEED) / (FULL_SPEED - QUIET_SPEED));
  return {
    gain: MAX_GAIN * tone.loud * Math.sqrt(amount),
    frequency: tone.base + tone.perSpeed * speed,
    q: tone.q,
  };
};
