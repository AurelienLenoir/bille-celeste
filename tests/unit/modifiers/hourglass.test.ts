import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, seconds, steps } from './helpers';

describe('hourglass', () => {
  beforeAll(() => initPhysics());

  it('takes 5 s off the chrono, never below zero', () => {
    const run = playground([{ type: 'hourglass', cell: [2, 0, 0] }]);
    let time = 0;
    run.events.on('tick', (t) => (time = t.time));
    // The chrono starts with the first move.
    steps(run, 1, { x: 0, y: 0.5 });
    seconds(run, 7);
    placeOn(run, 2, 0);
    seconds(run, 0.1);
    expect(time).toBeCloseTo(2.1, 1);
  });
});
