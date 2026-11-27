import { byId } from '../dom';

const REFRESH_SECONDS = 0.5;

/** Small frame-rate readout, shown only with `?debug` in the URL. Returns a per-frame updater. */
export const bindPerfOverlay = (describe: () => string): ((dt: number) => void) => {
  if (!new URLSearchParams(location.search).has('debug')) return () => undefined;
  const el = byId('perf');
  el.hidden = false;
  let elapsed = 0;
  return (dt) => {
    elapsed += dt;
    if (elapsed < REFRESH_SECONDS) return;
    elapsed = 0;
    el.textContent = describe();
  };
};
