import { describe, expect, it } from 'vitest';
import { centreRadius, curve, curveExit } from '../../../src/game/pieces/curve';
import { piece } from '../helpers';

describe('curve', () => {
  it('ends on a cell edge so it joins the grid', () => {
    expect(centreRadius(2)).toBe(3);
    expect(curveExit(piece({ type: 'curve', cell: [0, 0, 0], radius: 2 }))).toMatchObject({
      s: 3,
      f: 3,
      heading: 'right',
    });
    const exit = curveExit(piece({ type: 'curve', cell: [0, 0, 0], radius: 1, angle: 180, dir: 'left' }));
    expect(exit.s).toBeCloseTo(-2);
    expect(exit.f).toBeCloseTo(0);
    expect(exit.heading).toBe('back');
  });

  it('exposes an entry and an exit port at the right cell edges', () => {
    const { nav } = curve.build(piece({ type: 'curve', cell: [0, 0, -5], radius: 2 }));
    expect(nav.ports.map((p) => p.key)).toEqual(['0,-9', '3,-12']);
    expect(nav.ports[1]?.dir).toEqual([1, 0]);
  });

  it('covers the cells of its N × N block that the ring crosses', () => {
    const { footprint } = curve.build(piece({ type: 'curve', cell: [0, 0, -5], radius: 2 }));
    const cells = footprint.map((c) => `${c.i},${c.k}`).sort();
    expect(cells).toEqual(['0,-5', '0,-6', '1,-6']);
  });
});
