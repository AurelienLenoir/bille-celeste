import { describe, expect, it } from 'vitest';
import { floorHeight } from '../../../src/engine/trackCollider';
import { ramp, rampAngle } from '../../../src/game/pieces/ramp';
import { piece } from '../helpers';

describe('ramp', () => {
  const p = piece({ type: 'ramp', cell: [7, 0, -18], length: 5, drop: 6, width: 'wide', rails: 'both' });
  const { shape, nav } = ramp.build(p);

  it('goes from the entry height down by drop steps', () => {
    const floor = shape.floors[0];
    if (!floor) throw new Error('no floor');
    expect(floorHeight(floor, 14, -35)).toBeCloseTo(0);
    expect(floorHeight(floor, 14, -45)).toBeCloseTo(-3);
    expect(nav.ports.map((port) => port.y)).toEqual([0, -3]);
  });

  it('has rails on both sides and a slope angle', () => {
    expect(shape.barriers).toHaveLength(2);
    expect(rampAngle(p)).toBeCloseTo(16.7, 1);
  });

  it('can climb', () => {
    const up = ramp.build(piece({ type: 'ramp', cell: [0, 0, 0], length: 2, drop: -2 }));
    expect(up.nav.ports.map((port) => port.y)).toEqual([0, 1]);
  });
});
