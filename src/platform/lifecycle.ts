import { App } from '@capacitor/app';
import { isNative } from '.';

/**
 * Calls `onHide` when the game stops being visible: tab switched, app sent to the background or
 * screen locked (the native apps also get Capacitor's appStateChange).
 */
export const onBackground = (onHide: () => void): void => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  addEventListener('pagehide', onHide);
  if (isNative()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) onHide();
    });
  }
};

/** Calls `onShow` when the game is visible again. */
export const onForeground = (onShow: () => void): void => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onShow();
  });
  if (isNative()) {
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) onShow();
    });
  }
};

/** Android's back button (or gesture). Without a handler the app would close. */
export const onBackButton = (handler: () => void): void => {
  if (isNative()) void App.addListener('backButton', handler);
};
