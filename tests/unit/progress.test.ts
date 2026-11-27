import { describe, expect, it } from 'vitest';
import {
  emptyProgress,
  isLevelOpen,
  isWorldOpen,
  parseStoredProgress,
  PROGRESS_VERSION,
  readProgress,
  recordWin,
  resumeLevel,
  totalStars,
  type Progress,
  type WinningRun,
} from '../../src/meta/progress';
import { createProgressStore, PROGRESS_KEY, type KeyValueStorage } from '../../src/meta/store';
import { CAMPAIGN, WORLDS } from '../../src/levels/worlds';

const run = (time: number, underPar: boolean, noFall: boolean, gem = false): WinningRun => ({
  time,
  falls: noFall ? 0 : 1,
  stars: { underPar, noFall, count: (1 + Number(underPar) + Number(noFall)) as 1 | 2 | 3 },
  gem,
});

/** Progress with every level up to `count` (campaign order) finished with all three stars. */
const finished = (count: number): Progress =>
  CAMPAIGN.slice(0, count).reduce((p, id) => recordWin(p, id, run(10, true, true)).progress, emptyProgress());

describe('recording wins', () => {
  it('keeps the best time and every star once earned, across runs', () => {
    const first = recordWin(emptyProgress(), 'w1-01', run(40, false, true));
    expect(first).toMatchObject({ newRecord: true, stars: 2, gainedStars: 2 });
    expect(first.previousBest).toBeUndefined();

    const slower = recordWin(first.progress, 'w1-01', run(50, true, false, true));
    expect(slower).toMatchObject({ newRecord: false, previousBest: 40, stars: 3, gainedStars: 1 });
    expect(slower.progress.levels['w1-01']).toEqual({ bestTime: 40, underPar: true, noFall: true, gem: true });

    const faster = recordWin(slower.progress, 'w1-01', run(31, false, false));
    expect(faster).toMatchObject({ newRecord: true, previousBest: 40, gainedStars: 0 });
    expect(faster.progress.levels['w1-01']?.bestTime).toBe(31);
  });
});

describe('unlocking', () => {
  it('opens the first level only, then each level after the one before it', () => {
    const none = emptyProgress();
    expect(isLevelOpen(none, 'w1-01')).toBe(true);
    expect(isLevelOpen(none, 'w1-02')).toBe(false);
    expect(isLevelOpen(finished(1), 'w1-02')).toBe(true);
    expect(resumeLevel(none)).toBe('w1-01');
    expect(resumeLevel(finished(2))).toBe('w1-03');
  });

  it('opens worlds with stars (10, 22, 35)', () => {
    const [w1, w2, w3, w4] = WORLDS;
    if (!w1 || !w2 || !w3 || !w4) throw new Error('four worlds');
    expect(isWorldOpen(emptyProgress(), w1)).toBe(true);
    const three = finished(3);
    expect(totalStars(three)).toBe(9);
    expect(isWorldOpen(three, w2)).toBe(false);
    expect(isLevelOpen(three, 'w2-01')).toBe(false);
    const four = finished(4);
    expect(isWorldOpen(four, w2)).toBe(true);
    expect(isLevelOpen(four, 'w2-01')).toBe(true);
    expect(isLevelOpen(four, 'w2-02')).toBe(false);
    expect(isWorldOpen(finished(8), w3)).toBe(true);
    expect(isWorldOpen(finished(11), w4)).toBe(false);
    expect(isWorldOpen(finished(12), w4)).toBe(true);
  });

  it('every world can be opened with the stars of the worlds before it', () => {
    WORLDS.forEach((world, i) => expect(world.unlockStars).toBeLessThanOrEqual(i * 5 * 3));
    expect(resumeLevel(finished(20))).toBe('w4-05');
  });
});

describe('progress save', () => {
  it('falls back to empty progress on garbage, newer versions or a missing save', () => {
    expect(parseStoredProgress(null)).toEqual(emptyProgress());
    expect(parseStoredProgress('{oops')).toEqual(emptyProgress());
    expect(readProgress({ version: PROGRESS_VERSION + 1, levels: {} })).toEqual(emptyProgress());
  });

  it('keeps valid level records and drops broken ones', () => {
    const progress = readProgress({
      version: PROGRESS_VERSION,
      levels: {
        'w1-01': { bestTime: 30, underPar: true, noFall: false, gem: false },
        'w1-02': { bestTime: -4, underPar: true, noFall: false, gem: false },
        'BAD ID': { bestTime: 30, underPar: true, noFall: false, gem: false },
      },
    });
    expect(Object.keys(progress.levels)).toEqual(['w1-01']);
  });

  it('the store saves every win', async () => {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = {
      get: async (key) => data.get(key) ?? null,
      set: async (key, value) => {
        data.set(key, value);
      },
    };
    const store = await createProgressStore(storage);
    const outcome = store.getState().win('w1-01', run(20, true, true));
    expect(outcome.stars).toBe(3);
    expect(JSON.parse(data.get(PROGRESS_KEY) ?? '{}').levels['w1-01'].bestTime).toBe(20);
    const again = await createProgressStore(storage);
    expect(totalStars(again.getState().progress)).toBe(3);
  });
});
