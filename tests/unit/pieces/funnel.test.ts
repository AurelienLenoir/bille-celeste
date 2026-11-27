import { describe, expect, it } from 'vitest';
import { funnel, funnelLength } from '../../../src/game/pieces/funnel';
import { piece } from '../helpers';

describe('funnel', () => {
  it('takes the whole mouth as entries and narrows to one exit', () => {
    const { nav, shape } = funnel.build(piece({ type: 'funnel', cell: [0, 0, 0], diameter: 3 }));
    expect(funnelLength(3)).toBe(2);
    expect(nav.ports).toHaveLength(4);
    expect(nav.ports.at(-1)?.key).toBe('0,-3');
    expect(shape.triangles).toHaveLength(2);
    expect(shape.barriers).toHaveLength(2);
  });
});
