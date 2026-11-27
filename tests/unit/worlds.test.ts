import { describe, expect, it } from 'vitest';
import { THEMES } from '../../src/levels/schema';
import { CAMPAIGN, levelNumber, nextLevel, worldOfLevel, WORLDS } from '../../src/levels/worlds';
import { shippedLevel } from './helpers';

describe('campaign', () => {
  it('has four worlds of five levels, one theme each, opened by more and more stars', () => {
    expect(WORLDS.map((w) => w.theme)).toEqual([...THEMES]);
    expect(CAMPAIGN).toHaveLength(20);
    WORLDS.forEach((world, i) => {
      expect(world.levels).toHaveLength(5);
      if (i > 0) expect(world.unlockStars).toBeGreaterThan(WORLDS[i - 1]?.unlockStars ?? 0);
    });
  });

  it('every campaign level ships, in its world and theme, with a name and a hidden gem', () => {
    for (const world of WORLDS)
      for (const id of world.levels) {
        const level = shippedLevel(id);
        expect(level.id).toBe(id);
        expect(level.world).toBe(world.id);
        expect(level.decor.theme).toBe(world.theme);
        expect(level.name.fr).not.toMatch(/Brouillon/);
        expect(level.entities.filter((e) => e.type === 'hiddenGem')).toHaveLength(1);
      }
  });

  it('teaches the basics with signs in the first two levels', () => {
    expect(shippedLevel('w1-01').signs.length).toBeGreaterThanOrEqual(3);
    expect(shippedLevel('w1-02').signs.length).toBeGreaterThanOrEqual(3);
    expect(shippedLevel('w1-01').modifiers).toEqual([]);
  });

  it('each world brings in its own mechanics (PLAN.md § 3.3)', () => {
    const uses = (world: number, types: string[]) =>
      WORLDS[world - 1]?.levels.some((id) => {
        const level = shippedLevel(id);
        const found = new Set<string>([...level.pieces.map((p) => p.type), ...level.modifiers.map((m) => m.type)]);
        return types.every((type) => found.has(type));
      });
    expect(uses(1, ['ramp'])).toBe(true);
    expect(uses(2, ['movingPlatform', 'gap'])).toBe(true);
    expect(uses(2, ['speedPad'])).toBe(true);
    expect(uses(3, ['ice'])).toBe(true);
    expect(uses(3, ['wind'])).toBe(true);
    expect(uses(3, ['fallingTile'])).toBe(true);
    for (const type of ['conveyor', 'pusher', 'magnet', 'invert']) expect(uses(4, [type])).toBe(true);
  });

  it('walks the campaign in order', () => {
    expect(nextLevel('w1-05')).toBe('w2-01');
    expect(nextLevel('w4-05')).toBeUndefined();
    expect(worldOfLevel('w3-02')?.id).toBe(3);
    expect(worldOfLevel('sandbox')).toBeUndefined();
    expect(levelNumber('w2-04')).toBe('2-4');
  });
});
