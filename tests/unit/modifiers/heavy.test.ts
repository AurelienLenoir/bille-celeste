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

describe('heavy', () => {
  beforeAll(() => initPhysics());

  it('multiplies gravity by 1.5 for 6 s', () => {
    expect(fallSpeed('heavy') / fallSpeed()).toBeCloseTo(1.5, 1);
  });

  it('ends the feather', () => {
    const run = playground([
      { type: 'feather', cell: [0, 0, 0] },
      { type: 'heavy', cell: [2, 0, 0] },
    ]);
    placeOn(run, 0, 0);
    seconds(run, 0.2);
    placeOn(run, 2, 0);
    seconds(run, 0.2);
    expect(run.session.status().effects.map((e) => e.type)).toEqual(['heavy']);
  });
});
