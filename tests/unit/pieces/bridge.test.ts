import { describe, expect, it } from 'vitest';
import { bridge } from '../../../src/game/pieces/bridge';
import { piece } from '../helpers';

describe('bridge', () => {
  it('is a narrow plank without rails or side exits', () => {
    const { shape, nav } = bridge.build(piece({ type: 'bridge', cell: [0, 0, 0], length: 3 }));
    expect(shape.floors[0]?.maxX).toBeCloseTo(0.7);
    expect(shape.barriers).toHaveLength(0);
    expect(nav.ports).toHaveLength(2);
  });
});
