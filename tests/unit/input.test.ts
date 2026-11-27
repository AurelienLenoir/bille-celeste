import { describe, expect, it } from 'vitest';
import { combineInputs, smoothInput } from '../../src/engine/input';
import { keysToInput } from '../../src/engine/input/keyboard';
import { lowPass, orientationToTilt, tiltToInput } from '../../src/engine/input/tilt';
import { stickFromOffset } from '../../src/engine/input/touch';

describe('keysToInput', () => {
  it('supports arrows, ZQSD and WASD', () => {
    expect(keysToInput(new Set(['arrowup']))).toEqual({ x: 0, y: 1 });
    expect(keysToInput(new Set(['q', 's']))).toEqual({ x: -1, y: -1 });
    expect(keysToInput(new Set(['a', 'w']))).toEqual({ x: -1, y: 1 });
  });
  it('returns null when nothing is held or keys cancel out', () => {
    expect(keysToInput(new Set())).toBeNull();
    expect(keysToInput(new Set(['arrowleft', 'arrowright']))).toBeNull();
  });
});

describe('stickFromOffset', () => {
  it('clamps to the joystick radius', () => {
    const { stick, knob } = stickFromOffset(110, 0);
    expect(stick).toEqual({ x: 1, y: -0 });
    expect(knob).toEqual({ x: 55, y: 0 });
  });
  it('flips screen y so dragging up tilts forward', () => {
    expect(stickFromOffset(0, -27.5).stick.y).toBeCloseTo(0.5);
  });
  it('reaches full tilt sooner with a higher sensitivity, while the knob stays in the ring', () => {
    const { stick, knob } = stickFromOffset(0, -27.5, 2);
    expect(stick.y).toBeCloseTo(1);
    expect(knob.y).toBeCloseTo(-27.5);
    expect(stickFromOffset(200, 0, 2).knob.x).toBeCloseTo(55);
    expect(stickFromOffset(55, 0, 0.5).stick.x).toBeCloseTo(0.5);
  });
});

describe('tilt', () => {
  it('maps beta/gamma for each screen rotation', () => {
    expect(orientationToTilt(10, 5, 0)).toEqual({ x: 5, y: 10 });
    expect(orientationToTilt(10, 5, 90)).toEqual({ x: 10, y: -5 });
    expect(orientationToTilt(10, 5, 270)).toEqual({ x: -10, y: 5 });
  });
  it('is relative to the neutral pose, with a dead zone and full tilt at 20° by default', () => {
    const neutral = { x: 0, y: 30 };
    expect(tiltToInput({ x: 1, y: 30 }, neutral)).toEqual({ x: 0, y: 0 });
    expect(tiltToInput({ x: 20, y: 30 }, neutral).x).toBeCloseTo(1);
    expect(tiltToInput({ x: 0, y: 10 }, neutral).y).toBeCloseTo(1);
  });
  it('clamps radially, so a diagonal is as strong as a straight tilt', () => {
    const { x, y } = tiltToInput({ x: 40, y: -10 }, { x: 0, y: 30 });
    expect(Math.hypot(x, y)).toBeCloseTo(1);
    expect(x).toBeCloseTo(y);
  });
  it('honours the full-tilt angle and axis inversion', () => {
    const options = { fullTiltDeg: 10, invertX: true, invertY: false };
    expect(tiltToInput({ x: 10, y: 0 }, { x: 0, y: 0 }, options).x).toBeCloseTo(-1);
    const half = tiltToInput({ x: 5, y: 0 }, { x: 0, y: 0 }, { ...options, fullTiltDeg: 20 }).x;
    expect(half).toBeLessThan(0);
    expect(half).toBeGreaterThan(-0.5);
  });
});

describe('lowPass', () => {
  it('follows the reading faster the longer the gap, and never overshoots', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: -10 };
    const short = lowPass(from, to, 0.01);
    const long = lowPass(from, to, 0.2);
    expect(short.x).toBeGreaterThan(0);
    expect(short.x).toBeLessThan(long.x);
    expect(long.x).toBeLessThan(10);
    expect(lowPass(from, to, -1)).toEqual(from);
  });
});

describe('combineInputs', () => {
  it('uses the first source that reports a value', () => {
    const read = combineInputs(
      { read: () => null },
      { read: () => ({ x: 1, y: 0 }) },
      { read: () => ({ x: 0, y: 1 }) },
    );
    expect(read()).toEqual({ x: 1, y: 0 });
    expect(combineInputs({ read: () => null })()).toEqual({ x: 0, y: 0 });
  });
});

describe('smoothInput', () => {
  it('moves towards the target without overshooting', () => {
    const s = { x: 0, y: 0 };
    smoothInput(s, { x: 1, y: -1 }, 1 / 60);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(1);
    expect(s.y).toBeCloseTo(-s.x);
  });
});
