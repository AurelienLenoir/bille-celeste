import { describe, expect, it } from 'vitest';
import { platform, platformCells } from '../../../src/game/pieces/platform';
import { piece } from '../helpers';

describe('platform', () => {
  it('is centred on its cell and covers size cells', () => {
    const p = piece({ type: 'platform', cell: [0, 2, 0], size: [3, 2] });
    expect(platformCells(p)).toEqual({ i0: -1, i1: 1, k0: 0, k1: 1 });
    const { shape, footprint } = platform.build(p);
    expect(shape.floors[0]).toMatchObject({ minX: -3, maxX: 3, minZ: -1, maxZ: 3, y: 1 });
    expect(footprint).toHaveLength(6);
  });

  it('swaps width and depth when turned', () => {
    expect(platformCells(piece({ type: 'platform', cell: [0, 0, 0], size: [3, 1], rot: 90 }))).toEqual({
      i0: 0,
      i1: 0,
      k0: -1,
      k1: 1,
    });
  });

  it('has one node per cell and ports only on its outline', () => {
    const { nav } = platform.build(piece({ type: 'platform', cell: [0, 0, 0], size: [3, 3] }));
    expect(nav.nodes).toHaveLength(9);
    expect(nav.ports).toHaveLength(12);
    expect(nav.links).toHaveLength(12);
  });
});
