import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { pusherReach } from '../../../src/game/modifiers/pusher';
import { placeOn, playground, record, seconds } from './helpers';

describe('pusher', () => {
  beforeAll(() => initPhysics());

  it('rests, strikes fast, holds, then pulls back, once per period', () => {
    const m = { period: 3, phase: 0 };
    expect(pusherReach(m, 1)).toBe(0);
    expect(pusherReach(m, 2.2)).toBe(1);
    expect(pusherReach(m, 2.8)).toBeGreaterThan(0);
    expect(pusherReach(m, 2.8)).toBeLessThan(1);
    expect(pusherReach(m, 4)).toBe(0);
    expect(pusherReach({ period: 3, phase: 0.5 }, 0.7)).toBe(1);
  });

  it('shoves a ball standing in front of it, and tells the bot when', () => {
    const run = playground([{ type: 'pusher', cell: [0, 0, 0], rot: 90, period: 3 }]);
    const events = record(run);
    const hazard = run.world.modifiers[0]?.instance.hazard;
    expect(hazard?.covers(0, 0)).toBe(true);
    expect(hazard?.hitsAt(0, 0, 0.5, 0.4)).toBe(false);
    expect(hazard?.hitsAt(0, 0, 2.2, 0.4)).toBe(true);
    placeOn(run, 0, 0);
    seconds(run, 3);
    expect(events).toContain('modifierFired');
    expect(run.ball.position().x).toBeGreaterThan(1.2);
  });
});
