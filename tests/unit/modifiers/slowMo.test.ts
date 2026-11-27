import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { copy, placeOn, playground, seconds } from './helpers';

const rollFor = (slow: boolean) => {
  const run = playground(slow ? [{ type: 'slowMo', cell: [-4, 0, 0] }] : []);
  placeOn(run, -4, 0);
  seconds(run, 0.1);
  const from = copy(run.ball.position());
  seconds(run, 1, { x: 1, y: 0 });
  return { distance: run.ball.position().x - from.x, scale: run.session.status().timeScale };
};

describe('slowMo', () => {
  beforeAll(() => initPhysics());

  it('runs the game at 0.6 speed: the ball covers less ground in the same chrono time', () => {
    const slow = rollFor(true);
    const normal = rollFor(false);
    expect(slow.scale).toBe(0.6);
    expect(normal.scale).toBe(1);
    expect(slow.distance).toBeLessThan(normal.distance * 0.5);
  });
});
