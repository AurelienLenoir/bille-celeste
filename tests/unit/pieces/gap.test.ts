import { describe, expect, it } from 'vitest';
import { gap, KICKER_RISE } from '../../../src/game/pieces/gap';
import { piece } from '../helpers';

describe('gap', () => {
  it('has a kicker then a one-way jump over the empty cells', () => {
    const { shape, nav, footprint } = gap.build(piece({ type: 'gap', cell: [0, 0, 0], length: 2 }));
    expect(shape.floors[0]?.slopeZ).toBeCloseTo(-KICKER_RISE / 2);
    expect(nav.links).toEqual([{ from: 0, to: 1, oneWay: true, kind: 'jump' }]);
    expect(nav.ports.map((p) => p.key)).toEqual(['0,1', '0,-5']);
    expect(footprint).toHaveLength(1);
  });
});
