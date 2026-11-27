import { describe, expect, it } from 'vitest';
import { createTileClock, isOnTile } from '../../../src/game/pieces/fallingTile';

describe('fallingTile', () => {
  it('detects the ball resting on it', () => {
    expect(isOnTile({ position: { x: 0.5, y: 0.42, z: -0.5 }, radius: 0.42 }, [0, 0, 0])).toBe(true);
    expect(isOnTile({ position: { x: 1.5, y: 0.42, z: 0 }, radius: 0.42 }, [0, 0, 0])).toBe(false);
    expect(isOnTile({ position: { x: 0, y: 2, z: 0 }, radius: 0.42 }, [0, 0, 0])).toBe(false);
  });

  it('falls after its delay, then is gone until reset', () => {
    const clock = createTileClock(0.5);
    clock.step(0.1, false);
    expect(clock.state()).toBe('idle');
    clock.step(0.1, true);
    expect(clock.state()).toBe('armed');
    for (let i = 0; i < 4; i++) clock.step(0.1, false);
    expect(clock.state()).toBe('falling');
    for (let i = 0; i < 30; i++) clock.step(0.1, false);
    expect(clock.state()).toBe('gone');
    clock.reset();
    expect(clock.state()).toBe('idle');
    expect(clock.drop()).toBe(0);
  });
});
