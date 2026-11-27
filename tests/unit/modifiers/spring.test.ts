import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { springLanding, springVelocity } from '../../../src/game/modifiers/spring';
import { placeOn, playground, steps } from './helpers';

describe('spring', () => {
  beforeAll(() => initPhysics());

  it('jumps straight up or in an arc, and knows where the arc lands', () => {
    expect(springVelocity({ rot: 0, height: 2, forward: 0 }, { x: 1, z: 0 })).toMatchObject({ x: 1, z: 0 });
    expect(springVelocity({ rot: 90, height: 2, forward: 4 }, { x: 0, z: 0 })).toMatchObject({ x: 4, z: 0 });
    const [x] = springLanding({ type: 'spring', cell: [0, 0, 0], rot: 90, height: 2, forward: 4 });
    expect(x).toBeCloseTo(4 * ((2 * Math.sqrt(2 * 22 * 2)) / 22));
  });

  it('bounces the ball about as high as asked', () => {
    const run = playground([{ type: 'spring', cell: [0, 0, 0], height: 2.5 }]);
    placeOn(run, 0, 0);
    let top = 0;
    for (let i = 0; i < 120; i++) {
      steps(run, 1);
      top = Math.max(top, run.ball.position().y);
    }
    expect(top - 0.42).toBeGreaterThan(2);
    expect(top - 0.42).toBeLessThan(3);
  });
});
