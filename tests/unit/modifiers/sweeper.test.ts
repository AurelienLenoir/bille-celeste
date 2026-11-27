import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../../src/engine/physics';
import { armAngle, armHits } from '../../../src/game/modifiers/sweeper';
import { buildNav } from '../../../src/game/nav';
import { levelWith } from '../helpers';
import { placeOn, playground, record, seconds } from './helpers';

const m = { type: 'sweeper' as const, cell: [0, 0, 0] as [number, number, number], length: 1.5, speed: 90 };

describe('sweeper', () => {
  beforeAll(() => initPhysics());

  it('sweeps around its hub, clockwise seen from above', () => {
    expect(armHits(m, armAngle(90, 0), 2, 0, 0.3)).toBe(true);
    expect(armHits(m, armAngle(90, 0), 0, 2, 0.3)).toBe(false);
    // A quarter turn later, the arm points to +z (towards the camera).
    expect(armHits(m, armAngle(90, 1), 0, 2, 0.3)).toBe(true);
    expect(armHits(m, armAngle(90, 1), 5, 0, 0.3)).toBe(false);
  });

  it('knocks the ball away', () => {
    const run = playground([m]);
    const events = record(run);
    placeOn(run, 0, 1);
    seconds(run, 1.2);
    expect(events).toContain('modifierFired');
    expect(Math.hypot(run.ball.position().x, run.ball.position().z - 2)).toBeGreaterThan(0.5);
  });

  it('routes go around its hub', () => {
    const level = levelWith([{ type: 'platform', cell: [0, 0, 0], size: [3, 3] }], { modifiers: [m] });
    const { graph } = buildNav(level);
    const hub = graph.nodes.findIndex((n) => n.at[0] === 0 && n.at[2] === 0);
    expect(graph.edges[hub]).toEqual([]);
    expect(graph.edges.flat().some((e) => e.to === hub)).toBe(false);
  });
});
