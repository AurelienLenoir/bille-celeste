import { describe, expect, it } from 'vitest';
import { levelFunnel, worldOneCompletion, type FunnelEvent } from '../../src/meta/funnel';

const ev = (event: string, id: string, level: string, falls = 0, time = 30): FunnelEvent => ({
  event,
  distinct_id: id,
  properties: { level, falls, time },
});

describe('beta funnel', () => {
  const events = [
    ev('level_start', 'a', 'w1-01'),
    ev('level_win', 'a', 'w1-01', 2, 40),
    ev('level_start', 'b', 'w1-01'),
    ev('level_quit', 'b', 'w1-01'),
    ev('level_start', 'b', 'w1-01'),
    ev('level_win', 'b', 'w1-01', 0, 20),
    ev('level_start', 'a', 'w1-05'),
    ev('level_win', 'a', 'w1-05'),
  ];
  it('counts players, finishers, quits, falls and the median time per level', () => {
    const first = levelFunnel(events)[0];
    expect(first).toEqual({
      level: 'w1-01',
      players: 2,
      finishers: 2,
      starts: 3,
      wins: 2,
      quits: 1,
      fallsPerWin: 1,
      medianTime: 30,
    });
  });
  it('measures how many players finish world 1', () => {
    expect(worldOneCompletion(events)).toBe(0.5);
    expect(worldOneCompletion([])).toBe(0);
  });
});
