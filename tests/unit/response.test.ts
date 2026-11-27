import { describe, expect, it } from 'vitest';
import { applyResponse, invertAxes } from '../../src/engine/input/response';

const curve = { deadZone: 0.1, expo: 0.5 };
const length = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

describe('applyResponse', () => {
  it('ignores input inside the dead zone', () => {
    expect(applyResponse({ x: 0.05, y: -0.05 }, curve)).toEqual({ x: 0, y: 0 });
  });
  it('starts from zero at the dead-zone edge instead of jumping', () => {
    expect(length(applyResponse({ x: 0.11, y: 0 }, curve))).toBeLessThan(0.02);
  });
  it('is gentler than linear in the middle and reaches 1 at the edge', () => {
    expect(applyResponse({ x: 0.5, y: 0 }, curve).x).toBeLessThan(0.5);
    expect(applyResponse({ x: 1, y: 0 }, curve).x).toBeCloseTo(1);
    expect(length(applyResponse({ x: 1, y: 1 }, curve))).toBeCloseTo(1);
  });
  it('is monotonic and keeps the direction', () => {
    let previous = 0;
    for (let m = 0; m <= 1; m += 0.05) {
      const out = applyResponse({ x: m * 0.6, y: m * 0.8 }, curve);
      expect(length(out)).toBeGreaterThanOrEqual(previous);
      if (length(out) > 0) expect(out.y / out.x).toBeCloseTo(0.8 / 0.6);
      previous = length(out);
    }
  });
  it('is the identity with no dead zone and no expo', () => {
    expect(applyResponse({ x: 0.3, y: -0.4 }, { deadZone: 0, expo: 0 })).toEqual({ x: 0.3, y: -0.4 });
  });
});

describe('invertAxes', () => {
  it('flips only the requested axes', () => {
    expect(invertAxes({ x: 0.5, y: 0.25 }, { invertX: true, invertY: false })).toEqual({ x: -0.5, y: 0.25 });
    expect(invertAxes({ x: 0.5, y: 0.25 }, { invertX: false, invertY: true })).toEqual({ x: 0.5, y: -0.25 });
  });
});
