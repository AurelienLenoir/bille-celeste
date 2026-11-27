import { describe, expect, it } from 'vitest';
import { ramp } from '../../src/game/pieces/ramp';
import { slab } from '../../src/game/pieces/slab';
import { wall } from '../../src/game/pieces/wall';

describe('slab', () => {
  it('puts the top surface at the given height', () => {
    const [box] = slab({ type: 'slab', at: [0, 0, -8], size: [2, 10.2], surface: 'cream' });
    expect(box?.position).toEqual([0, -0.25, -8]);
    expect(box?.size).toEqual([2, 0.5, 10.2]);
  });
});

describe('wall', () => {
  it('stands on the surface', () => {
    const [box] = wall({ type: 'wall', at: [0, 0, -19.15], size: [6.6, 0.3] });
    expect(box?.position).toEqual([0, 0.3, -19.15]);
    expect(box?.surface).toBe('lav');
  });
});

describe('ramp', () => {
  const boxes = ramp({ type: 'ramp', at: [14, 0, -35], length: 10, drop: 3, width: 3, surface: 'cream' });
  const [deck, left, right] = boxes;

  it('builds a deck and two rails', () => {
    expect(boxes).toHaveLength(3);
    expect(left?.position[0]).toBeCloseTo(12.35);
    expect(right?.position[0]).toBeCloseTo(15.65);
  });

  it('deck top passes through both ends of the slope', () => {
    if (!deck?.rotationX) throw new Error('deck must be pitched');
    const angle = -deck.rotationX;
    const [, cy, cz] = deck.position;
    // Top-surface centre = centre + half thickness along the normal.
    const topY = cy + 0.25 * Math.cos(angle);
    const topZ = cz - 0.25 * Math.sin(angle);
    expect(topY).toBeCloseTo(-1.5);
    expect(topZ).toBeCloseTo(-40);
    expect(angle).toBeCloseTo(Math.atan2(3, 10));
  });
});
