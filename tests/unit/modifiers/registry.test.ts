import { describe, expect, it } from 'vitest';
import { MODIFIERS } from '../../../src/game/modifiers';
import { BONUS_TYPES, MALUS_TYPES } from '../../../src/levels/schema';

describe('modifier registry', () => {
  it('has the 7 bonuses and 10 maluses of PLAN.md § 5', () => {
    expect(BONUS_TYPES).toHaveLength(7);
    expect(MALUS_TYPES).toHaveLength(10);
    expect(Object.keys(MODIFIERS).sort()).toEqual([...BONUS_TYPES, ...MALUS_TYPES].sort());
  });

  it('gives every modifier a kind matching the schema, a sound and a vibration', () => {
    for (const type of BONUS_TYPES) expect(MODIFIERS[type].kind).toBe('bonus');
    for (const type of MALUS_TYPES) expect(MODIFIERS[type].kind).toBe('malus');
    for (const module of Object.values(MODIFIERS)) {
      expect(module.sound.length).toBeGreaterThan(0);
      expect(module.haptic).toBeTruthy();
    }
  });
});
