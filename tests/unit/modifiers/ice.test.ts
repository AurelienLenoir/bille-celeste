import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { copy, placeOn, playground, seconds } from './helpers';

/** Distance rolled in 1 s of full tilt from a standstill. */
const roll = (onIce: boolean) => {
  const run = playground(onIce ? [{ type: 'ice', cell: [0, 0, 0], size: [9, 9] }] : []);
  placeOn(run, -3, 0);
  seconds(run, 0.2);
  const from = copy(run.ball.position());
  seconds(run, 1, { x: 1, y: 0 });
  return run.ball.position().x - from.x;
};

describe('ice', () => {
  beforeAll(() => initPhysics());

  it('makes the ball slide: it picks up speed faster than when it rolls (g sin θ instead of 5/7 of it)', () => {
    expect(roll(true) / roll(false)).toBeGreaterThan(1.25);
  });
});
