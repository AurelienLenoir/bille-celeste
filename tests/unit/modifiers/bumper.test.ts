import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { bounceOff } from '../../../src/game/modifiers/bumper';
import { placeOn, playground, record, seconds } from './helpers';

describe('bumper', () => {
  beforeAll(() => initPhysics());

  it('throws the ball straight away from the post', () => {
    expect(bounceOff({ x: 0, z: 0 }, { x: 1, z: 0 }, { x: -3, y: 0.5, z: 0 }, 9)).toEqual({ x: 9, y: 0.5, z: 0 });
  });

  it('bounces back a ball rolling into it', () => {
    const run = playground([{ type: 'bumper', cell: [0, 0, 0], strength: 9 }]);
    const events = record(run);
    placeOn(run, -1, 0);
    run.ball.setVelocity({ x: 5, y: 0, z: 0 });
    seconds(run, 0.5);
    expect(events).toContain('modifierFired');
    expect(run.ball.velocity().x).toBeLessThan(-5);
  });
});
