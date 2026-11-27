import type { Vec2 } from '../math';

type Source = { read: () => Vec2 | null };

/** First source with an opinion wins: touch, then keyboard, then tilt; otherwise neutral. */
export const combineInputs =
  (...sources: Source[]) =>
  (): Vec2 => {
    for (const source of sources) {
      const value = source.read();
      if (value) return value;
    }
    return { x: 0, y: 0 };
  };

const SMOOTHING_RATE = 9;

/** Low-pass filter applied to the raw stick before it tilts gravity. */
export const smoothInput = (smoothed: Vec2, target: Vec2, dt: number): void => {
  const k = 1 - Math.exp(-dt * SMOOTHING_RATE);
  smoothed.x += (target.x - smoothed.x) * k;
  smoothed.y += (target.y - smoothed.y) * k;
};

/** Input resolution: 1/256 of full tilt. Quantized input makes recorded replays small and exact. */
const INPUT_LEVELS = 256;

export const quantizeInput = ({ x, y }: Vec2): Vec2 => ({
  x: Math.round(x * INPUT_LEVELS) / INPUT_LEVELS,
  y: Math.round(y * INPUT_LEVELS) / INPUT_LEVELS,
});
