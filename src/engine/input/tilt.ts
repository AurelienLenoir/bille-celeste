import { clamp, type Vec2 } from '../math';
import { applyResponse, invertAxes, type AxisInversion, type ResponseCurve } from './response';

/** Response used for the gyroscope: small dead zone against hand tremor, a gentle expo curve. */
export const TILT_RESPONSE: ResponseCurve = { deadZone: 0.06, expo: 0.35 };
/** Time constant of the low-pass filter applied to raw sensor readings, in seconds. */
const SENSOR_FILTER_SECONDS = 0.05;

export type TiltOptions = AxisInversion & {
  /** Phone tilt, in degrees from neutral, that gives a full-strength stick. */
  fullTiltDeg: number;
};

export const DEFAULT_TILT_OPTIONS: TiltOptions = { fullTiltDeg: 20, invertX: false, invertY: false };

/** Maps device beta/gamma to screen-relative tilt for the current screen rotation. */
export const orientationToTilt = (beta: number, gamma: number, screenAngle: number): Vec2 => {
  if (screenAngle === 90) return { x: beta, y: -gamma };
  if (screenAngle === -90 || screenAngle === 270) return { x: -beta, y: gamma };
  return { x: gamma, y: beta };
};

/** Tilt relative to the calibrated neutral pose, as a shaped stick value in -1..1. */
export const tiltToInput = (tilt: Vec2, neutral: Vec2, options: TiltOptions = DEFAULT_TILT_OPTIONS): Vec2 => {
  const raw = {
    x: clamp((tilt.x - neutral.x) / options.fullTiltDeg),
    y: clamp((neutral.y - tilt.y) / options.fullTiltDeg),
  };
  return invertAxes(applyResponse(raw, TILT_RESPONSE), options);
};

/** Exponential low-pass step for readings that arrive at an irregular rate. */
export const lowPass = (previous: Vec2, next: Vec2, elapsedSeconds: number): Vec2 => {
  const k = 1 - Math.exp(-Math.max(0, elapsedSeconds) / SENSOR_FILTER_SECONDS);
  return { x: previous.x + (next.x - previous.x) * k, y: previous.y + (next.y - previous.y) * k };
};

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

/**
 * Gyroscope input. `options` is read on every call so settings apply immediately.
 * The neutral pose is kept per screen rotation: if the page flips to landscape for a moment and
 * back, the portrait neutral comes back as it was instead of being replaced by whatever pose the
 * phone had when it flipped back (which felt like a drift that needed recalibrating).
 */
export const createTilt = (options: () => TiltOptions = () => DEFAULT_TILT_OPTIONS): Tilt => {
  let current: Vec2 | null = null;
  let neutral: Vec2 | null = null;
  /** Neutral pose of each screen rotation seen so far. */
  const neutrals = new Map<number, Vec2>();
  let received = false;
  let lastAngle = screenAngle();
  let lastStamp = 0;

  const onOrientation = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    const angle = screenAngle();
    const reading = orientationToTilt(e.beta, e.gamma, angle);
    if (angle !== lastAngle) {
      lastAngle = angle;
      current = null;
      neutral = neutrals.get(angle) ?? null;
    }
    received = true;
    current = current ? lowPass(current, reading, (e.timeStamp - lastStamp) / 1000) : reading;
    lastStamp = e.timeStamp;
    if (!neutral) {
      neutral = current;
      neutrals.set(angle, neutral);
    }
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
      neutrals.set(lastAngle, neutral);
      return true;
    },
    resetCalibration: () => {
      neutral = null;
      neutrals.clear();
    },
    hasReading: () => received,
    read: () => (current && neutral ? tiltToInput(current, neutral, options()) : null),
  };
};
