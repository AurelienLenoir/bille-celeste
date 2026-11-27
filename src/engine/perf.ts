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

type GovernorOptions = { minFps: number; holdSeconds: number; windowSeconds: number };

const DEFAULT_GOVERNOR: GovernorOptions = { minFps: 50, holdSeconds: 3, windowSeconds: 1 };

/**
 * PLAN.md § 9: switch to low quality when the game stays under 50 fps for 3 s.
 * `update` returns true exactly once, on the frame where quality should drop.
 */
export const createQualityGovernor = (options: GovernorOptions = DEFAULT_GOVERNOR) => {
  let windowTime = 0;
  let windowFrames = 0;
  let slowFor = 0;
  let dropped = false;
  return {
    update: (dt: number): boolean => {
      if (dropped) return false;
      windowTime += dt;
      windowFrames++;
      if (windowTime < options.windowSeconds) return false;
      const fps = windowFrames / windowTime;
      slowFor = fps < options.minFps ? slowFor + windowTime : 0;
      windowTime = 0;
      windowFrames = 0;
      if (slowFor < options.holdSeconds) return false;
      dropped = true;
      return true;
    },
    isLow: () => dropped,
  };
};
