import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseLevel } from '../../src/levels/loader';
import { migrateLevel } from '../../src/levels/migrations';
import { cellToWorld, entryFrame, forwardOf, toWorld } from '../../src/levels/grid';
import { LEVEL_VERSION } from '../../src/levels/schema';
import { levelWith, shippedLevel } from './helpers';

describe('grid', () => {
  it('maps cells to world units and rotations to directions', () => {
    expect(cellToWorld([7, -6, -41])).toEqual([14, -3, -82]);
    expect(forwardOf(0)).toEqual([0, -1]);
    expect(forwardOf(90)).toEqual([1, 0]);
    expect(toWorld(entryFrame([2, 0, -8], 90), 0, 8)).toEqual([11, 0, -16]);
  });
});

describe('level schema', () => {
  it('fills defaults', () => {
    const level = levelWith([{ type: 'straight', cell: [0, 0, 0] }]);
    expect(level.pieces[0]).toMatchObject({ rot: 0, length: 4, width: 'normal', rails: 'none', surface: 'cream' });
    expect(level.decor).toEqual({ theme: 'garden', seed: 7 });
  });

  it('names the faulty field', () => {
    const result = parseLevel({
      ...levelWith([{ type: 'platform', cell: [0, 0, 0] }]),
      pieces: [{ type: 'ramp', cell: [0, 0, 0], drop: 0 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain('pieces.0.drop');
  });

  it('needs exactly one goal and a crystal', () => {
    const base = levelWith([{ type: 'platform', cell: [0, 0, 0] }]);
    const result = parseLevel({
      ...base,
      entities: [
        { type: 'goal', cell: [0, 0, 0] },
        { type: 'goal', cell: [0, 0, 0] },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toMatch(/exactement un goal.*au moins un cristal/);
  });

  it('every shipped level parses', () => {
    for (const file of readdirSync('src/levels/data'))
      expect(shippedLevel(file.replace('.json', '')).version).toBe(LEVEL_VERSION);
  });
});

describe('level migrations', () => {
  const migrations = {
    1: (l: Record<string, unknown>) => ({ ...l, renamed: l.old }),
    2: (l: Record<string, unknown>) => ({ ...l, added: true }),
  };

  it('runs every step up to the current version', () => {
    expect(migrateLevel({ version: 1, old: 'x' }, migrations, 3)).toEqual({
      version: 3,
      old: 'x',
      renamed: 'x',
      added: true,
    });
  });

  it('refuses newer files and gaps in the chain', () => {
    expect(() => migrateLevel({ version: 4 }, migrations, 3)).toThrow(/version 4/);
    expect(() => migrateLevel({ version: 0 }, migrations, 3)).toThrow(/version 0/);
  });

  it('brings a version-1 level (no modifiers) up to version 2', () => {
    const { modifiers: _dropped, ...v1 } = { ...levelWith([{ type: 'platform', cell: [0, 0, 0] }]), version: 1 };
    void _dropped;
    const result = parseLevel(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.level.version).toBe(2);
      expect(result.level.modifiers).toEqual([]);
    }
  });

  it('turns a migration error into a parse error', () => {
    const result = parseLevel({ version: 99 });
    expect(result.ok).toBe(false);
  });
});
