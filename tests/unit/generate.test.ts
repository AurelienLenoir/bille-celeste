import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../src/engine/physics';
import { runBot } from '../../src/game/bot';
import { generateLevel } from '../../src/levels/generate';
import { hasErrors, validateLevel } from '../../src/levels/validate';

describe('generateLevel', () => {
  beforeAll(() => initPhysics());

  it('is deterministic for a seed', () => {
    const options = { world: 2, difficulty: 0.5, seed: 42 };
    expect(generateLevel(options)).toEqual(generateLevel(options));
    expect(generateLevel({ ...options, seed: 43 })).not.toEqual(generateLevel(options));
  });

  it.each([
    [1, 0.2, 1],
    [2, 0.5, 42],
    [3, 0.6, 7],
    [4, 0.8, 3],
  ])('world %i, difficulty %f, seed %i: passes the validator and the bot', (world, difficulty, seed) => {
    const level = generateLevel({ world, difficulty, seed });
    expect(hasErrors(validateLevel(level))).toBe(false);
    expect(level.entities.filter((e) => e.type === 'checkpoint').length).toBeGreaterThan(0);
    expect(runBot(level).won).toBe(true);
  });

  it('introduces mechanics by world', () => {
    const types = (world: number) =>
      new Set(generateLevel({ world, difficulty: 0.5, seed: 5 }).pieces.map((p) => p.type));
    expect(types(1).has('movingPlatform')).toBe(false);
    expect(types(1).has('fallingTile')).toBe(false);
  });
});
