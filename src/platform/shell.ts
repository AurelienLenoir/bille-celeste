import { KeepAwake } from '@capacitor-community/keep-awake';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { isNative } from '.';

const quietly = (promise: Promise<unknown>) => void promise.catch(() => undefined);

/** Native app setup: portrait only, no status bar over the game. Does nothing in a browser. */
export const setUpNativeShell = (): void => {
  if (!isNative()) return;
  quietly(ScreenOrientation.lock({ orientation: 'portrait' }));
  quietly(StatusBar.hide());
  document.documentElement.classList.add('native');
};

/** Hides the native splash once the first level stands behind the title. */
export const hideSplash = (): void => {
  if (isNative()) quietly(SplashScreen.hide({ fadeOutDuration: 300 }));
};

/** Keeps the screen on during a run (tilt control means no touches for a long time). */
export const keepScreenOn = (on: boolean): void => {
  if (!isNative()) return;
  quietly(on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
};
