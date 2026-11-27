import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { placeOn, playground, record, seconds } from './helpers';

describe('shield', () => {
  beforeAll(() => initPhysics());

  it('catches the next fall: the ball comes back on the platform and no fall is counted', () => {
    const run = playground([{ type: 'shield', cell: [3, 0, 0] }]);
    const events = record(run);
    placeOn(run, 3, 0);
    seconds(run, 0.3);
    // Roll off the right edge.
    seconds(run, 3, { x: 1, y: 0 });
    expect(events).toContain('shieldSaved');
    expect(events).not.toContain('fell');
    expect(run.ball.position().x).toBeLessThan(9);
    expect(run.ball.position().y).toBeGreaterThan(0);
    // Used up: the next fall counts.
    seconds(run, 4, { x: 1, y: 0 });
    expect(events).toContain('fell');
  });
});
