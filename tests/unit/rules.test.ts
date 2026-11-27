import { describe, expect, it } from 'vitest';
import { hasFallen, isInGoal, reachesCheckpoint, touchesCrystal } from '../../src/game/rules';

describe('touchesCrystal', () => {
  it('picks up a crystal when the ball rolls through it', () => {
    expect(touchesCrystal({ x: 0, y: 0.42, z: -8 }, [0, 0, -8])).toBe(true);
  });
  it('ignores a crystal just out of reach', () => {
    expect(touchesCrystal({ x: 0.9, y: 0.4, z: -8 }, [0, 0, -8])).toBe(false);
  });
});

describe('reachesCheckpoint', () => {
  const cp = { x: 0, y: 0, z: -16 };
  it('triggers on the platform', () => {
    expect(reachesCheckpoint({ x: 2, y: 0.42, z: -16 }, cp, 0.42)).toBe(true);
  });
  it('does not trigger from a level below', () => {
    expect(reachesCheckpoint({ x: 0, y: -2, z: -16 }, cp, 0.42)).toBe(false);
  });
});

describe('isInGoal', () => {
  const goal = { x: 14, y: -3, z: -82 };
  it('accepts the ball inside the ring', () => {
    expect(isInGoal({ x: 14.5, y: -2.6, z: -82 }, goal)).toBe(true);
  });
  it('rejects a ball falling under the ring', () => {
    expect(isInGoal({ x: 14, y: -4, z: -82 }, goal)).toBe(false);
  });
});

describe('hasFallen', () => {
  it('measures the fall from the current spawn point', () => {
    expect(hasFallen({ x: 0, y: -8, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(false);
    expect(hasFallen({ x: 0, y: -9.1, z: 0 }, { x: 0, y: 0, z: 0 })).toBe(true);
    expect(hasFallen({ x: 0, y: -9.1, z: 0 }, { x: 0, y: -3, z: 0 })).toBe(false);
  });
});
