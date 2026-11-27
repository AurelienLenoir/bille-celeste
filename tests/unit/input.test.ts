import { describe, expect, it } from 'vitest';
import { combineInputs, smoothInput } from '../../src/engine/input';
import { keysToInput } from '../../src/engine/input/keyboard';
import { orientationToTilt, tiltToInput } from '../../src/engine/input/tilt';
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
});

describe('tilt', () => {
  it('maps beta/gamma for each screen rotation', () => {
    expect(orientationToTilt(10, 5, 0)).toEqual({ x: 5, y: 10 });
    expect(orientationToTilt(10, 5, 90)).toEqual({ x: 10, y: -5 });
    expect(orientationToTilt(10, 5, 270)).toEqual({ x: -10, y: 5 });
  });
  it('is relative to the neutral pose, with a dead zone and full tilt at 20°', () => {
    const neutral = { x: 0, y: 30 };
    expect(tiltToInput({ x: 1, y: 30 }, neutral)).toEqual({ x: 0, y: 0 });
    expect(tiltToInput({ x: 40, y: 10 }, neutral)).toEqual({ x: 1, y: 1 });
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
