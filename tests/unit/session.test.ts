import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../src/engine/physics';
import { startHeadless } from '../../src/game/headless';
import { cellToWorld } from '../../src/levels/grid';
import { shippedLevel } from './helpers';

const STILL = { x: 0, y: 0 };

describe('session', () => {
  beforeAll(() => initPhysics());

  it('the timer waits for the first move', () => {
    const run = startHeadless(shippedLevel('w1-01'));
    let time = 0;
    run.events.on('tick', (t) => (time = t.time));
    for (let i = 0; i < 120; i++) run.step(STILL);
    expect(time).toBe(0);
    for (let i = 0; i < 60; i++) run.step({ x: 0, y: 0.2 });
    expect(time).toBeCloseTo(0.5, 5);
    run.dispose();
  });

  it('a fall puts back the crystals picked up since the last checkpoint, not the ones before', () => {
    const run = startHeadless(shippedLevel('w1-01'));
    const counts: string[] = [];
    run.events.on('crystalsPutBack', ({ collected, total }) => counts.push(`${collected}/${total}`));
    const goTo = (cell: [number, number, number]) => {
      const [x, y, z] = cellToWorld(cell);
      run.ball.placeAt(x, y + 0.45, z);
      for (let i = 0; i < 3; i++) run.step(STILL);
    };
    goTo([0, 0, -3]); // crystal before the checkpoint
    goTo([0, 0, -9]); // checkpoint
    goTo([3, 0, -12]); // crystal after it
    expect(run.world.crystals.filter((c) => c.taken)).toHaveLength(2);
    run.ball.placeAt(0, -20, -18);
    for (let i = 0; i < 3; i++) run.step(STILL);
    expect(run.world.crystals.filter((c) => c.taken)).toHaveLength(1);
    expect(run.world.crystals[0]?.taken).toBe(true);
    expect(counts).toEqual(['1/3']);
    run.dispose();
  });
});
