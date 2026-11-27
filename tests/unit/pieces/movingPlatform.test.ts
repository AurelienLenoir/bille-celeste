import { describe, expect, it } from 'vitest';
import { createShuttle, movingPlatform, travelled } from '../../../src/game/pieces/movingPlatform';
import { piece } from '../helpers';

describe('movingPlatform', () => {
  it('speeds up and slows down smoothly', () => {
    const { duration } = travelled(10, 2, 0);
    expect(duration).toBeCloseTo(5.5);
    expect(travelled(10, 2, 0.25).d).toBeCloseTo(0.125);
    expect(travelled(10, 2, duration).d).toBeCloseTo(10);
    expect(travelled(0.4, 2, 0).duration).toBeCloseTo(2 * Math.sqrt(0.1));
  });

  it('waits, travels to the far end, then comes back', () => {
    const shuttle = createShuttle(
      [
        [0, 0, 0],
        [0, 0, -10],
      ],
      2,
      1,
    );
    for (let t = 0; t < 1; t += 0.01) shuttle.step(0.01);
    expect(shuttle.position()[2]).toBeCloseTo(0);
    for (let t = 0; t < 5.6; t += 0.01) shuttle.step(0.01);
    expect(shuttle.position()[2]).toBeCloseTo(-10);
    for (let t = 0; t < 1.5; t += 0.01) shuttle.step(0.01);
    expect(shuttle.position()[2]).toBeGreaterThan(-10);
    shuttle.reset();
    expect(shuttle.position()).toEqual([0, 0, 0]);
  });

  it('docks against the cell edges at both ends', () => {
    const { nav } = movingPlatform.build(
      piece({
        type: 'movingPlatform',
        path: [
          [7, -6, -26.5],
          [7, -6, -31.5],
        ],
        size: [1.5, 2],
      }),
    );
    expect(nav.links[0]?.kind).toBe('ride');
    expect(nav.ports.map((p) => p.key)).toEqual(['14,-55', '14,-51', '14,-65', '14,-61']);
  });
});
