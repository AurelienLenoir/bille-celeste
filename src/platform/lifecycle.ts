/**
 * Calls `onHide` when the game stops being visible: tab switched, app sent to the background or
 * screen locked. Phase 6 adds Capacitor's appStateChange here for the native apps.
 */
export const onBackground = (onHide: () => void): void => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  addEventListener('pagehide', onHide);
};
