import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../src/engine/physics';
import { runBot } from '../../src/game/bot';
import { buildNav, entityNode, nodeAt, pathTo, shortestPaths } from '../../src/game/nav';
import { cellToWorld } from '../../src/levels/grid';
import { generateLevel, GENERATED_MODIFIERS } from '../../src/levels/generate';
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

  it('features the focused mechanics, and hides a gem on a side branch', () => {
    const count = (focus: string[]) => {
      let n = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const level = generateLevel({ world: 3, difficulty: 0.5, seed, focus });
        n += level.pieces.filter((p) => p.type === 'fallingTile').length;
        n += level.modifiers.filter((m) => m.type === 'wind').length;
        expect(level.entities.filter((e) => e.type === 'hiddenGem').length).toBeLessThanOrEqual(1);
      }
      return n;
    };
    expect(count(['tiles', 'wind'])).toBeGreaterThan(count([]) * 1.5);
    expect(generateLevel({ world: 2, difficulty: 0.4, seed: 9 }).entities.some((e) => e.type === 'hiddenGem')).toBe(
      true,
    );
  });

  it('never puts two checkpoints in a row, nor crystals off the course', () => {
    for (const [world, seed] of [
      [1, 1],
      [2, 2],
      [2, 9],
      [3, 4],
      [4, 6],
    ] as const) {
      const level = generateLevel({ world, difficulty: 0.6, seed });
      const { graph } = buildNav(level);
      const start = nodeAt(graph, cellToWorld(level.spawn.cell)) ?? -1;
      const goal = entityNode(graph, level.entities.find((e) => e.type === 'goal') ?? { cell: [0, 0, 0] }) ?? -1;
      const { dist, prev } = shortestPaths(graph, start);
      const spine = pathTo(prev, goal);
      const along = new Map(spine.map((node, n) => [node, n]));
      // Checkpoints in course order, then how far apart they are along the way to the goal.
      const checkpoints = level.entities
        .filter((e) => e.type === 'checkpoint')
        .map((e) => dist[entityNode(graph, e) ?? -1] ?? Infinity)
        .sort((a, b) => a - b);
      checkpoints.slice(1).forEach((d, n) => expect(d - (checkpoints[n] ?? 0)).toBeGreaterThan(10));
      // Every crystal is on the way from the spawn to the goal: no side trips.
      const spinePieces = new Set(spine.map((node) => graph.nodes[node]?.piece));
      for (const crystal of level.entities.filter((e) => e.type === 'crystal')) {
        const node = entityNode(graph, crystal) ?? -1;
        expect(along.has(node) || spinePieces.has(graph.nodes[node]?.piece)).toBe(true);
      }
    }
  });

  it('introduces mechanics by world', () => {
    const types = (world: number) =>
      new Set(generateLevel({ world, difficulty: 0.5, seed: 5 }).pieces.map((p) => p.type));
    expect(types(1).has('movingPlatform')).toBe(false);
    expect(types(1).has('fallingTile')).toBe(false);
  });

  it('adds bonuses and maluses from the worlds introduced so far', () => {
    const allowed = (world: number) =>
      new Set(
        [1, 2, 3, 4]
          .filter((w) => w <= world)
          .flatMap((w) => [...(GENERATED_MODIFIERS[w]?.bonus ?? []), ...(GENERATED_MODIFIERS[w]?.malus ?? [])]),
      );
    for (const world of [1, 2, 3, 4]) {
      for (const seed of [1, 2, 3]) {
        const level = generateLevel({ world, difficulty: 0.7, seed });
        for (const m of level.modifiers) expect(allowed(world).has(m.type)).toBe(true);
      }
    }
    const w4 = [1, 2, 3, 4, 5].flatMap((seed) => generateLevel({ world: 4, difficulty: 0.8, seed }).modifiers);
    expect(w4.some((m) => GENERATED_MODIFIERS[4]?.malus.includes(m.type))).toBe(true);
  });
});
