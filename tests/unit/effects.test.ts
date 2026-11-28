import { describe, expect, it } from 'vitest';
import { createEffectTimers } from '../../src/game/effects';
import { createGroundTrail } from '../../src/game/groundTrail';

describe('effect timers', () => {
  it('counts each effect down and reports when it ends; the shield waits to be used', () => {
    const timers = createEffectTimers();
    timers.grant('slowMo');
    timers.grant('shield');
    expect(timers.step(4)).toEqual([]);
    expect(timers.active()).toEqual([
      { type: 'slowMo', left: 1 },
      { type: 'shield', left: Infinity },
    ]);
    expect(timers.step(1.5)).toEqual(['slowMo']);
    expect(timers.consume('shield')).toBe(true);
    expect(timers.consume('shield')).toBe(false);
  });

  it('picking an effect up again restarts it; feather and heavy cancel each other', () => {
    const timers = createEffectTimers();
    timers.grant('magnet');
    timers.step(7);
    timers.grant('magnet');
    expect(timers.active()).toEqual([{ type: 'magnet', left: 8 }]);
    timers.grant('feather');
    timers.grant('heavy');
    expect(timers.has('feather')).toBe(false);
    expect(timers.has('heavy')).toBe(true);
  });
});

describe('ground trail', () => {
  it('remembers where the ball rolled half a second before it left the ground', () => {
    const trail = createGroundTrail();
    expect(trail.safePoint()).toBeUndefined();
    for (let i = 0; i <= 20; i++) trail.record({ x: i, y: 0, z: 0 }, () => true, 0.1);
    trail.record({ x: 50, y: -3, z: 0 }, () => false, 0.1);
    expect(trail.safePoint()).toEqual({ x: 15, y: 0, z: 0 });
  });
});
