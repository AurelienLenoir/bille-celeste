import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { padVelocity } from '../../../src/game/modifiers/speedPad';
import { placeOn, playground, record, steps } from './helpers';

describe('speedPad', () => {
  beforeAll(() => initPhysics());

  it('raises the speed along its direction and keeps the sideways speed', () => {
    expect(padVelocity({ x: 1, y: 0, z: -2 }, { x: 0, z: -1 }, 10)).toEqual({ x: 1, y: 0, z: -10 });
    expect(padVelocity({ x: 0, y: 0, z: -12 }, { x: 0, z: -1 }, 10)).toEqual({ x: 0, y: 0, z: -12 });
  });

  it('launches a ball that rolls onto it', () => {
    const run = playground([{ type: 'speedPad', cell: [0, 0, 0], rot: 90, speed: 10 }]);
    const events = record(run);
    placeOn(run, 0, 0);
    steps(run, 3);
    expect(events).toContain('modifierFired');
    expect(run.ball.velocity().x).toBeGreaterThan(9);
  });
});
