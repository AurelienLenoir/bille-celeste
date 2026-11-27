import { describe, expect, it } from 'vitest';
import { halfPipe, halfPipeProfile } from '../../../src/game/pieces/halfPipe';
import { piece } from '../helpers';

describe('halfPipe', () => {
  it('rises smoothly from a flat bottom to its rim', () => {
    const profile = halfPipeProfile();
    expect(profile[0]).toEqual([1, 0]);
    expect(profile.at(-1)?.[0]).toBe(3);
    expect(profile.at(-1)?.[1]).toBeCloseTo(1.2);
    profile.slice(1).forEach(([, y], i) => expect(y).toBeGreaterThan(profile[i]?.[1] ?? 0));
  });

  it('is three cells wide but only connects through the middle', () => {
    const { shape, nav, footprint } = halfPipe.build(piece({ type: 'halfPipe', cell: [0, 0, 0], length: 2 }));
    expect(shape.floors).toHaveLength(9);
    expect(footprint).toHaveLength(6);
    expect(nav.ports).toHaveLength(2);
  });
});
