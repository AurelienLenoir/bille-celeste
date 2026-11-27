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
