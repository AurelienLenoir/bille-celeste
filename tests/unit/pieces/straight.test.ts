import { describe, expect, it } from 'vitest';
import { straight } from '../../../src/game/pieces/straight';
import { piece } from '../helpers';

describe('straight', () => {
  it('starts at the back edge of its cell and runs forward', () => {
    const { shape, nav } = straight.build(piece({ type: 'straight', cell: [0, 0, -2], length: 5 }));
    expect(shape.floors[0]).toMatchObject({ minX: -1, maxX: 1, minZ: -13, maxZ: -3, y: 0 });
    expect(nav.nodes.map((n) => n[2])).toEqual([-4, -6, -8, -10, -12]);
  });

  it('turns with rot and sets its width', () => {
    const { shape } = straight.build(piece({ type: 'straight', cell: [2, 0, -8], rot: 90, length: 4, width: 'wide' }));
    expect(shape.floors[0]).toMatchObject({ minX: 3, maxX: 11, minZ: -17.5, maxZ: -14.5 });
  });

  it('has side ports unless a rail closes that side', () => {
    const open = straight.build(piece({ type: 'straight', cell: [0, 0, 0], length: 2 }));
    const railed = straight.build(piece({ type: 'straight', cell: [0, 0, 0], length: 2, rails: 'left' }));
    expect(open.nav.ports).toHaveLength(6);
    expect(railed.nav.ports).toHaveLength(4);
    expect(railed.shape.barriers).toHaveLength(1);
  });
});
