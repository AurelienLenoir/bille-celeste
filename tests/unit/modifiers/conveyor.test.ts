import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { beltPull } from '../../../src/game/modifiers/conveyor';
import { placeOn, playground, seconds } from './helpers';

describe('conveyor', () => {
  beforeAll(() => initPhysics());

  it('pulls towards the belt speed, gently enough to be fought', () => {
    expect(beltPull(3, 3)).toBe(0);
    expect(beltPull(3, 0)).toBeGreaterThan(0);
    expect(beltPull(3, -10)).toBe(4.5);
  });

  it('carries a ball at rest along at about its speed', () => {
    const run = playground([{ type: 'conveyor', cell: [0, 0, 0], size: [9, 9], rot: 0, speed: 3 }]);
    placeOn(run, 0, 2);
    seconds(run, 2);
    expect(run.ball.velocity().z).toBeLessThan(-2.2);
    expect(run.ball.velocity().z).toBeGreaterThan(-3.5);
  });
});
