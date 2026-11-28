import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { HapticPattern } from '../engine/haptics';
import { isNative } from '.';

const later = (ms: number, run: () => void) => setTimeout(run, ms);
const impact = (style: ImpactStyle) => void Haptics.impact({ style }).catch(() => undefined);

/** Taptic Engine / Android vibrator through Capacitor, the same patterns as the web version. */
const PLAY: Record<HapticPattern, () => void> = {
  light: () => impact(ImpactStyle.Light),
  medium: () => impact(ImpactStyle.Medium),
  heavy: () => impact(ImpactStyle.Heavy),
  success: () => void Haptics.notification({ type: NotificationType.Success }).catch(() => undefined),
  double: () => {
    impact(ImpactStyle.Light);
    later(70, () => impact(ImpactStyle.Light));
  },
  buzz: () => void Haptics.notification({ type: NotificationType.Warning }).catch(() => undefined),
};

/** Native haptics in the apps, undefined in a browser (the Web Vibration API is used there). */
export const nativeVibrator = (): ((pattern: HapticPattern) => void) | undefined =>
  isNative() ? (pattern) => PLAY[pattern]() : undefined;
