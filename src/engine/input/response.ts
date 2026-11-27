import { clamp, type Vec2 } from '../math';

export type ResponseCurve = {
  /** Stick magnitude below which the output is zero (0..1). */
  deadZone: number;
  /** 0 = linear, 1 = fully cubic. Higher values give finer control near the centre. */
  expo: number;
};

/**
 * Radial dead zone, then an expo curve: precise around neutral, fast near the edges.
 * The output stays continuous (no jump at the dead-zone border) and never exceeds 1.
 */
export const applyResponse = (stick: Vec2, { deadZone, expo }: ResponseCurve): Vec2 => {
  const magnitude = Math.hypot(stick.x, stick.y);
  if (magnitude <= deadZone) return { x: 0, y: 0 };
  const clamped = Math.min(1, magnitude);
  const rescaled = (clamped - deadZone) / (1 - deadZone);
  const shaped = (1 - expo) * rescaled + expo * rescaled ** 3;
  const k = shaped / magnitude;
  return { x: clamp(stick.x * k), y: clamp(stick.y * k) };
};

export type AxisInversion = { invertX: boolean; invertY: boolean };

export const invertAxes = (stick: Vec2, { invertX, invertY }: AxisInversion): Vec2 => ({
  x: invertX ? -stick.x : stick.x,
  y: invertY ? -stick.y : stick.y,
});
