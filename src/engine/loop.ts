const MAX_FRAME_DT = 0.05;
/** Spiral-of-death guard: never run more steps than this for one rendered frame. */
const MAX_STEPS_PER_FRAME = 8;
/** Absorbs float error so that a 1/60 s frame always runs exactly two 1/120 s steps. */
const EPSILON = 1e-9;

/** Calls `frame` once per animation frame with the elapsed time in seconds, capped at 50 ms. */
export const startLoop = (frame: (dt: number) => void): void => {
  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
    last = now;
    frame(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

export type FixedStepper = {
  /** Runs `step` as many times as `dt` allows and returns the render blend (0..1) between the last two steps. */
  advance: (dt: number, step: () => void) => number;
};

export const createFixedStepper = (stepSize: number, maxSteps = MAX_STEPS_PER_FRAME): FixedStepper => {
  let pending = 0;
  return {
    advance: (dt, step) => {
      pending += dt;
      let steps = 0;
      while (pending >= stepSize - EPSILON && steps < maxSteps) {
        step();
        pending -= stepSize;
        steps++;
      }
      if (steps === maxSteps) pending = 0;
      pending = Math.max(0, pending);
      return Math.min(1, pending / stepSize);
    },
  };
};
