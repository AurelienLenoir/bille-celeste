import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, seconds } from './helpers';

const speedAfter = (inSand: boolean) => {
  const run = playground(inSand ? [{ type: 'sand', cell: [0, 0, 0], size: [9, 9] }] : []);
  placeOn(run, -3, 0);
  seconds(run, 0.1);
  run.ball.setVelocity({ x: 6, y: 0, z: 0 });
  seconds(run, 0.8);
  return run.ball.velocity().x;
};

describe('sand', () => {
  beforeAll(() => initPhysics());

  it('brakes the ball hard', () => {
    expect(speedAfter(false)).toBeGreaterThan(3.2);
    expect(speedAfter(true)).toBeLessThan(1.5);
  });
});
