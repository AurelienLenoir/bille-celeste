import type { Vec2 } from '../math';
import { invertAxes, type AxisInversion } from './response';

/** Drawn radius of the joystick ring; the knob never leaves it. */
const RADIUS_PX = 55;

export type TouchOptions = AxisInversion & {
  /** 1 = full tilt at the ring's edge; 2 = full tilt halfway there. */
  sensitivity: number;
};

export const DEFAULT_TOUCH_OPTIONS: TouchOptions = { sensitivity: 1, invertX: false, invertY: false };

/**
 * Converts a finger offset in pixels to a stick value in -1..1 (screen y points down) and the
 * knob's drawn offset. Higher sensitivity reaches full tilt with a shorter drag.
 */
export const stickFromOffset = (
  dx: number,
  dy: number,
  sensitivity = 1,
  radius = RADIUS_PX,
): { stick: Vec2; knob: Vec2 } => {
  const reach = radius / sensitivity;
  const len = Math.hypot(dx, dy);
  const stickScale = len > reach ? reach / len : 1;
  const knobScale = len > radius ? radius / len : 1;
  return {
    stick: { x: (dx * stickScale) / reach, y: (-dy * stickScale) / reach },
    knob: { x: dx * knobScale, y: dy * knobScale },
  };
};

type JoystickElements = { surface: HTMLElement; base: HTMLElement; knob: HTMLElement };

export type Joystick = {
  read: () => Vec2 | null;
  /** Drops the current touch, e.g. when the game pauses under the thumb. */
  release: () => void;
};

/** Virtual joystick that appears under the thumb wherever it lands on the surface. */
export const createJoystick = (
  { surface, base, knob }: JoystickElements,
  options: () => TouchOptions = () => DEFAULT_TOUCH_OPTIONS,
): Joystick => {
  let pointerId: number | null = null;
  let origin: Vec2 = { x: 0, y: 0 };
  let offset: Vec2 = { x: 0, y: 0 };

  surface.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    offset = { x: 0, y: 0 };
    base.style.left = `${e.clientX}px`;
    base.style.top = `${e.clientY}px`;
    base.style.display = 'block';
    knob.style.transform = '';
  });
  addEventListener('pointermove', (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    offset = { x: e.clientX - origin.x, y: e.clientY - origin.y };
    const { knob: k } = stickFromOffset(offset.x, offset.y);
    knob.style.transform = `translate(${k.x}px,${k.y}px)`;
  });
  const release = () => {
    pointerId = null;
    offset = { x: 0, y: 0 };
    base.style.display = 'none';
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId === pointerId) release();
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

  const read = () => {
    if (pointerId === null) return null;
    const settings = options();
    return invertAxes(stickFromOffset(offset.x, offset.y, settings.sensitivity).stick, settings);
  };

  return { read, release };
};
