export type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'double' | 'buzz';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 12,
  medium: 28,
  heavy: 70,
  success: [30, 60, 30, 60, 80],
  /** Two short taps: something was granted. */
  double: [18, 50, 18],
  /** Rough rumble: something works against the player. */
  buzz: [10, 20, 10, 20, 10, 20, 10],
};

export type Haptics = (pattern: HapticPattern) => void;

/**
 * Vibrations through `native` when the app provides one (platform/haptics.ts), otherwise the Web
 * Vibration API (Android browsers; iOS Safari has none).
 */
export const createHaptics = (enabled: () => boolean, native?: Haptics): Haptics => {
  if (native)
    return (pattern) => {
      if (enabled()) native(pattern);
    };
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
