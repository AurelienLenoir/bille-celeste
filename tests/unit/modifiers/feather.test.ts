import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, seconds, steps } from './helpers';

/** Vertical speed after falling for 0.2 s from 3 units up, with an effect picked up just before. */
const fallSpeed = (pickup?: 'feather' | 'heavy') => {
  const run = playground(pickup ? [{ type: pickup, cell: [0, 0, 0] }] : []);
  placeOn(run, 0, 0);
  seconds(run, 0.2);
  run.ball.placeAt(4, 3, 4);
  steps(run, 24);
  return -run.ball.velocity().y;
};

describe('feather', () => {
  beforeAll(() => initPhysics());

  it('halves gravity', () => {
    expect(fallSpeed('feather') / fallSpeed()).toBeCloseTo(0.5, 1);
  });
});
