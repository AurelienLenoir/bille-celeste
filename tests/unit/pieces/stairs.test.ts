import { describe, expect, it } from 'vitest';
import { stairs } from '../../../src/game/pieces/stairs';
import { piece } from '../helpers';

describe('stairs', () => {
  it('goes down half a unit per step, one way only', () => {
    const { shape, nav } = stairs.build(piece({ type: 'stairs', cell: [0, 0, 0], steps: 3 }));
    expect(shape.floors.map((f) => f.y)).toEqual([-0.5, -1, -1.5]);
    expect(nav.links.every((l) => l.oneWay)).toBe(true);
    expect(nav.ports.map((p) => p.y)).toEqual([-0.5, -1.5]);
  });
});
