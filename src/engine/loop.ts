const MAX_FRAME_DT = 0.05;

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
