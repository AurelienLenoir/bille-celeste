import { describe, expect, it } from 'vitest';
import { NORMAL_GRIP } from '../../src/game/ball';
import { ICE_GRIP } from '../../src/game/modifiers/ice';
import { SAND_GRIP } from '../../src/game/modifiers/sand';
import { rollingSound, surfaceUnder } from '../../src/game/rolling';

describe('rolling sound', () => {
  it('is silent in the air and when the ball is still', () => {
    expect(rollingSound(8, false, 'wood').gain).toBe(0);
    expect(rollingSound(0.1, true, 'wood').gain).toBe(0);
  });
  it('gets louder and brighter with speed', () => {
    const slow = rollingSound(2, true, 'wood');
    const fast = rollingSound(10, true, 'wood');
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(fast.frequency).toBeGreaterThan(slow.frequency);
  });
  it('sounds different on each surface', () => {
    const tones = (['wood', 'ice', 'metal', 'sand'] as const).map((s) => rollingSound(6, true, s).frequency);
    expect(new Set(tones).size).toBe(4);
  });
  it('lets a zone override the world material', () => {
    expect(surfaceUnder('garden', NORMAL_GRIP)).toBe('wood');
    expect(surfaceUnder('factory', NORMAL_GRIP)).toBe('metal');
    expect(surfaceUnder('garden', ICE_GRIP)).toBe('ice');
    expect(surfaceUnder('glacier', SAND_GRIP)).toBe('sand');
  });
});

describe('ball trail', () => {
  it('only shows when the ball is fast, carrying fractions over', async () => {
    const { trailCount, TRAIL_SPEED } = await import('../../src/game/juice');
    expect(trailCount(TRAIL_SPEED - 1, 1 / 60, 0).count).toBe(0);
    let debt = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const next = trailCount(TRAIL_SPEED + 4, 1 / 60, debt);
      debt = next.debt;
      total += next.count;
    }
    expect(total).toBeGreaterThan(50);
  });
});
