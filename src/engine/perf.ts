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

type GovernorOptions = {
  minFps: number;
  holdSeconds: number;
  windowSeconds: number;
  steps: number;
  /** How long a lower quality is tried before deciding whether it helped. */
  checkSeconds: number;
  /** Frame rate gain a lower quality must bring to be kept (1.1 = 10 % more frames). */
  minGain: number;
};

const DEFAULT_GOVERNOR: GovernorOptions = {
  minFps: 50,
  holdSeconds: 3,
  windowSeconds: 1,
  steps: 2,
  checkSeconds: 2,
  minGain: 1.1,
};

/** `lower`: drop quality one step. `restore`: the last drop did not help, undo it. */
export type QualityChange = 'lower' | 'restore';

/**
 * PLAN.md § 9: lower the quality one step when the game stays under 50 fps for 3 s, at most
 * `steps` times. Each drop is tried for a moment and undone if it does not bring more frames: a
 * phone in power saving mode (iOS caps the page at 30 fps) or a slow CPU gains nothing from fewer
 * pixels, and the game would look blurry for nothing. After an undone drop, quality stays put.
 * Only frames of active play should be fed: menus, loading and pauses say nothing about how the
 * game runs, and a level load or a screen rotation would otherwise count as a slowdown.
 */
export const createQualityGovernor = (options: GovernorOptions = DEFAULT_GOVERNOR) => {
  let phase: 'watch' | 'check' | 'done' = 'watch';
  let windowTime = 0;
  let windowFrames = 0;
  let slowTime = 0;
  let slowFrames = 0;
  let fpsBefore = 0;
  let drops = 0;

  const restart = () => {
    windowTime = 0;
    windowFrames = 0;
    slowTime = 0;
    slowFrames = 0;
  };

  const watch = (): QualityChange | undefined => {
    const fps = windowFrames / windowTime;
    if (fps < options.minFps) {
      slowTime += windowTime;
      slowFrames += windowFrames;
    } else restart();
    windowTime = 0;
    windowFrames = 0;
    if (slowTime < options.holdSeconds) return undefined;
    fpsBefore = slowFrames / slowTime;
    restart();
    phase = 'check';
    return 'lower';
  };

  const check = (): QualityChange | undefined => {
    if (windowTime < options.checkSeconds) return undefined;
    const fpsAfter = windowFrames / windowTime;
    restart();
    if (fpsAfter < fpsBefore * options.minGain) {
      phase = 'done';
      return 'restore';
    }
    drops++;
    phase = drops < options.steps ? 'watch' : 'done';
    return undefined;
  };

  return {
    update: (dt: number): QualityChange | undefined => {
      if (phase === 'done') return undefined;
      windowTime += dt;
      windowFrames++;
      if (phase === 'check') return check();
      return windowTime < options.windowSeconds ? undefined : watch();
    },
    /** Forgets the frames counted so far (after a level load, a pause or a menu). */
    restart,
    /** True while a lower quality is in use (being tried, or kept because it helped). */
    isLow: () => drops > 0 || phase === 'check',
  };
};
