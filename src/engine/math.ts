export type Vec2 = { x: number; y: number };
export type Vec3Tuple = readonly [number, number, number];

export const clamp = (value: number, min = -1, max = 1): number => Math.max(min, Math.min(max, value));

/** Park–Miller minimal standard generator, as used by the prototype's decor. */
export const createRandom = (seed: number): (() => number) => {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
};
