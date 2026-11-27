import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, record, seconds } from './helpers';

describe('magnet', () => {
  beforeAll(() => initPhysics());

  it('pulls a crystal within 4 units to the ball, which never moves to it', () => {
    const run = playground([{ type: 'magnet', cell: [0, 0, 0] }], {
      entities: [
        { type: 'crystal', cell: [0, 0, -1] },
        { type: 'crystal', cell: [4, 0, 4] },
        { type: 'goal', cell: [-4, 0, 4] },
      ],
    });
    const events = record(run);
    placeOn(run, 0, 1);
    seconds(run, 0.5);
    expect(events).not.toContain('crystalCollected');
    placeOn(run, 0, 0);
    seconds(run, 1);
    expect(events.filter((e) => e === 'crystalCollected')).toHaveLength(1);
    expect(run.session.status().effects.map((e) => e.type)).toEqual(['magnet']);
    seconds(run, 8);
    expect(events).toContain('effectEnded');
  });
});
