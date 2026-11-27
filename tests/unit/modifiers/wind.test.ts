import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { windFactor } from '../../../src/game/modifiers/wind';
import { placeOn, playground, seconds } from './helpers';

describe('wind', () => {
  beforeAll(() => initPhysics());

  it('blows steadily, or in gusts with a lull in between', () => {
    expect(windFactor(0, 3.3)).toBe(1);
    expect(windFactor(4, 0.9)).toBeGreaterThan(1.5);
    expect(windFactor(4, 3)).toBeLessThan(0.2);
  });

  it('pushes the ball in its direction', () => {
    const run = playground([{ type: 'wind', cell: [0, 0, 0], size: [9, 9], rot: 270, strength: 4 }]);
    placeOn(run, 0, 0);
    seconds(run, 1);
    expect(run.ball.velocity().x).toBeLessThan(-1.5);
    expect(run.session.status().push.x).toBe(-4);
  });
});
