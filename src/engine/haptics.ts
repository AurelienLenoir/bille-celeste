export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 12,
  medium: 28,
  heavy: 70,
  success: [30, 60, 30, 60, 80],
};

export type Haptics = (pattern: HapticPattern) => void;

/**
 * Vibrations through the Web Vibration API (Android browsers; iOS Safari has none).
 * Native haptics replace it in phase 6.
 */
export const createHaptics = (enabled: () => boolean): Haptics => {
  const vibrate = typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : null;
  return (pattern) => {
    if (!vibrate || !enabled()) return;
    try {
      vibrate(PATTERNS[pattern]);
    } catch {
      // Some browsers block vibration without a recent user gesture.
    }
  };
};
