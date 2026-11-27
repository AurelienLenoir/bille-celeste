/** Rolling frame-time statistics over the last `size` frames. */
export const createFrameStats = (size = 120) => {
  const samples: number[] = [];
  let sum = 0;
  return {
    push: (dt: number) => {
      samples.push(dt);
      sum += dt;
      if (samples.length > size) sum -= samples.shift() ?? 0;
    },
    fps: () => (sum > 0 ? samples.length / sum : 0),
    /** Longest frame in the window, in milliseconds. */
    worstMs: () => Math.max(0, ...samples) * 1000,
  };
};

export type FrameStats = ReturnType<typeof createFrameStats>;

type GovernorOptions = { minFps: number; holdSeconds: number; windowSeconds: number; steps: number };

const DEFAULT_GOVERNOR: GovernorOptions = { minFps: 50, holdSeconds: 3, windowSeconds: 1, steps: 2 };

/**
 * PLAN.md § 9: lower the quality one step when the game stays under 50 fps for 3 s, at most
 * `steps` times. `update` returns true on each frame where quality should drop one step.
 * Only frames of active play should be fed: menus, loading and pauses say nothing about how the
 * game runs, and a level load or a screen rotation would otherwise count as a slowdown.
 */
export const createQualityGovernor = (options: GovernorOptions = DEFAULT_GOVERNOR) => {
  let windowTime = 0;
  let windowFrames = 0;
  let slowFor = 0;
  let drops = 0;
  return {
    update: (dt: number): boolean => {
      if (drops >= options.steps) return false;
      windowTime += dt;
      windowFrames++;
      if (windowTime < options.windowSeconds) return false;
      const fps = windowFrames / windowTime;
      slowFor = fps < options.minFps ? slowFor + windowTime : 0;
      windowTime = 0;
      windowFrames = 0;
      if (slowFor < options.holdSeconds) return false;
      slowFor = 0;
      drops++;
      return true;
    },
    /** Forgets the frames counted so far (after a level load, a pause or a menu). */
    restart: () => {
      windowTime = 0;
      windowFrames = 0;
      slowFor = 0;
    },
    isLow: () => drops > 0,
  };
};
