import { clamp, type Vec2 } from '../math';

const FULL_TILT_DEG = 20;
const DEAD_ZONE = 0.06;

/** Maps device beta/gamma to screen-relative tilt for the current screen rotation. */
export const orientationToTilt = (beta: number, gamma: number, screenAngle: number): Vec2 => {
  if (screenAngle === 90) return { x: beta, y: -gamma };
  if (screenAngle === -90 || screenAngle === 270) return { x: -beta, y: gamma };
  return { x: gamma, y: beta };
};

const deadZone = (v: number) => (Math.abs(v) < DEAD_ZONE ? 0 : v);

/** Tilt relative to the calibrated neutral pose, as a stick value in -1..1. */
export const tiltToInput = (tilt: Vec2, neutral: Vec2): Vec2 => ({
  x: deadZone(clamp((tilt.x - neutral.x) / FULL_TILT_DEG)),
  y: deadZone(clamp((neutral.y - tilt.y) / FULL_TILT_DEG)),
});

type PermissionRequester = { requestPermission: () => Promise<PermissionState> };

const needsPermission = (ctor: unknown): ctor is PermissionRequester =>
  typeof ctor === 'function' && 'requestPermission' in ctor && typeof ctor.requestPermission === 'function';

const screenAngle = (): number => {
  const legacy = 'orientation' in window ? Number(window.orientation) : 0;
  return screen.orientation?.angle || legacy || 0;
};

export type Tilt = {
  /** Asks for sensor permission when the browser requires it (iOS) and starts listening. */
  enable: () => Promise<void>;
  /** Uses the current pose as neutral. Returns false if no reading arrived yet. */
  calibrate: () => boolean;
  /** Next reading becomes the neutral pose. */
  resetCalibration: () => void;
  hasReading: () => boolean;
  read: () => Vec2 | null;
};

export const createTilt = (): Tilt => {
  let current: Vec2 | null = null;
  let neutral: Vec2 | null = null;
  let received = false;

  const onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    received = true;
    current = orientationToTilt(e.beta, e.gamma, screenAngle());
    if (!neutral) neutral = current;
  };

  const enable = async () => {
    const ctor: unknown = window.DeviceOrientationEvent;
    if (needsPermission(ctor)) {
      try {
        await ctor.requestPermission();
      } catch {
        // A refusal is detected later: no reading arrives and the game falls back to touch.
      }
    }
    addEventListener('deviceorientation', onOrientation);
  };

  return {
    enable,
    calibrate: () => {
      if (!current) return false;
      neutral = { ...current };
      return true;
    },
    resetCalibration: () => {
      neutral = null;
    },
    hasReading: () => received,
    read: () => (current && neutral ? tiltToInput(current, neutral) : null),
  };
};
