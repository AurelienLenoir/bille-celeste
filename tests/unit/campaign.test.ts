import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../src/engine/physics';
import { runBot } from '../../src/game/bot';
import { starsFor } from '../../src/game/rules';
import { CAMPAIGN, WORLDS } from '../../src/levels/worlds';
import { emptyProgress, isLevelOpen, isWorldOpen, recordWin, totalStars } from '../../src/meta/progress';
import { shippedLevel } from './helpers';

describe('the whole campaign', () => {
  beforeAll(() => initPhysics());

  it('the bot plays level 1 to level 20 in order, each one opening the next', () => {
    let progress = emptyProgress();
    for (const id of CAMPAIGN) {
      expect(isLevelOpen(progress, id), `${id} should be open`).toBe(true);
      const level = shippedLevel(id);
      const run = runBot(level);
      expect(run.won, `${id} won by the bot`).toBe(true);
      // The par time is calibrated from the bot's own time (level:bot --par).
      expect(run.time).toBeLessThan(level.parTimeSec);
      progress = recordWin(progress, id, {
        time: run.time,
        falls: run.falls,
        stars: starsFor(run.time, run.falls, level.parTimeSec),
        gem: false,
      }).progress;
    }
    expect(totalStars(progress)).toBe(60);
    WORLDS.forEach((world) => expect(isWorldOpen(progress, world)).toBe(true));
  }, 60_000);
});
