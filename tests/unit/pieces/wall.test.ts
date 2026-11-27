import { describe, expect, it } from 'vitest';
import { wall } from '../../../src/game/pieces/wall';
import { piece } from '../helpers';

describe('wall', () => {
  it('stands outside the front edge and closes those edges', () => {
    const { shape, nav } = wall.build(piece({ type: 'wall', cell: [-1, 0, -9], length: 3 }));
    const [a, b] = shape.barriers[0]?.points ?? [];
    expect(a?.[0]).toBeCloseTo(-3);
    expect(b?.[0]).toBeCloseTo(3);
    expect(a?.[2]).toBeCloseTo(-19.15);
    expect(nav.blocks.map((block) => block.key)).toEqual(['-2,-19', '0,-19', '2,-19']);
  });
});
