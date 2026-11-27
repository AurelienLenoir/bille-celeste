import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../src/engine/physics';
import { placeOn, playground, record, seconds } from './modifiers/helpers';

describe('hidden gem and stars', () => {
  beforeAll(() => initPhysics());

  it('is found by rolling over it, and the win reports it with the stars', () => {
    const run = playground([], {
      entities: [
        { type: 'crystal', cell: [1, 0, 0] },
        { type: 'hiddenGem', cell: [3, 0, 0] },
        { type: 'goal', cell: [-2, 0, 0] },
      ],
      parTimeSec: 30,
    });
    const events = record(run);
    let won: unknown;
    run.events.on('levelWon', (result) => (won = result));
    placeOn(run, 3, 0);
    seconds(run, 0.2);
    expect(events).toContain('hiddenGemFound');
    placeOn(run, 1, 0);
    seconds(run, 0.2);
    placeOn(run, -2, 0);
    seconds(run, 0.2);
    expect(won).toMatchObject({ falls: 0, gem: true, stars: { underPar: true, noFall: true, count: 3 } });
  });
});
