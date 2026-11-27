import type { Vec2 } from '../math';

const RADIUS_PX = 55;

/** Converts a finger offset in pixels to a stick value in -1..1 (screen y points down). */
export const stickFromOffset = (dx: number, dy: number, radius = RADIUS_PX): { stick: Vec2; knob: Vec2 } => {
  const len = Math.hypot(dx, dy);
  const scale = len > radius ? radius / len : 1;
  const kx = dx * scale;
  const ky = dy * scale;
  return { stick: { x: kx / radius, y: -ky / radius }, knob: { x: kx, y: ky } };
};

type JoystickElements = { surface: HTMLElement; base: HTMLElement; knob: HTMLElement };

/** Virtual joystick that appears under the thumb wherever it lands on the surface. */
export const createJoystick = ({ surface, base, knob }: JoystickElements): { read: () => Vec2 | null } => {
  let pointerId: number | null = null;
  let origin: Vec2 = { x: 0, y: 0 };
  let value: Vec2 = { x: 0, y: 0 };

  surface.addEventListener('pointerdown', (e) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    value = { x: 0, y: 0 };
    base.style.left = `${e.clientX}px`;
    base.style.top = `${e.clientY}px`;
    base.style.display = 'block';
    knob.style.transform = '';
  });
  addEventListener('pointermove', (e) => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    const { stick, knob: k } = stickFromOffset(e.clientX - origin.x, e.clientY - origin.y);
    value = stick;
    knob.style.transform = `translate(${k.x}px,${k.y}px)`;
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    value = { x: 0, y: 0 };
    base.style.display = 'none';
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);

  return { read: () => (pointerId !== null ? value : null) };
};
