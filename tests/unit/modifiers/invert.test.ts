import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, seconds } from './helpers';

describe('invert', () => {
  beforeAll(() => initPhysics());

  it('turns the controls around while the ball is inside', () => {
    const run = playground([{ type: 'invert', cell: [0, 0, 0], size: [3, 3] }]);
    placeOn(run, 0, 0);
    seconds(run, 0.2);
    expect(run.session.status().invert).toBe(true);
    seconds(run, 0.5, { x: 1, y: 0 });
    expect(run.ball.velocity().x).toBeLessThan(-1);
    placeOn(run, 3, 3);
    seconds(run, 0.2);
    expect(run.session.status().invert).toBe(false);
  });
});
