import { describe, expect, it } from 'vitest';
import { discAngle, discRadius, rotatingPlatform } from '../../../src/game/pieces/rotatingPlatform';
import { piece } from '../helpers';

describe('rotatingPlatform', () => {
  const p = piece({ type: 'rotatingPlatform', cell: [0, 0, 0], diameter: 3, speed: 90 });

  it('turns clockwise seen from above for positive speeds', () => {
    expect(discAngle(90, 1)).toBeCloseTo(-Math.PI / 2);
  });

  it('touches the cell edges of its bounding square', () => {
    expect(discRadius(p)).toBe(3);
    const { nav, footprint } = rotatingPlatform.build(p);
    expect(nav.ports.map((port) => port.key).sort()).toEqual(['-3,0', '0,-3', '0,3', '3,0']);
    expect(footprint).toHaveLength(9);
  });
});
