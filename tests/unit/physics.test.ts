import * as CANNON from 'cannon-es';
import { describe, expect, it } from 'vitest';
import { gravityDirection, MAX_TILT } from '../../src/engine/physics';
import { createRandom } from '../../src/engine/math';
import { createMovingPlatform } from '../../src/game/pieces/movingPlatform';
import type { BuiltBox } from '../../src/game/pieces/box';

describe('gravityDirection', () => {
  it('points straight down with no tilt', () => {
    const g = gravityDirection({ x: 0, y: 0 });
    expect(g.x).toBeCloseTo(0);
    expect(g.y).toBeCloseTo(-1);
    expect(g.z).toBeCloseTo(0);
  });
  it('tilting forward pulls the ball towards -z, by at most 26°', () => {
    const g = gravityDirection({ x: 0, y: 1 });
    expect(g.z).toBeLessThan(0);
    expect(Math.hypot(g.x, g.y, g.z)).toBeCloseTo(1);
    expect(Math.atan2(-g.z, -g.y)).toBeCloseTo(Math.atan(MAX_TILT));
    expect((Math.atan(MAX_TILT) * 180) / Math.PI).toBeCloseTo(26);
  });
});

describe('createRandom', () => {
  it('is deterministic for a seed', () => {
    const a = createRandom(7);
    const b = createRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('moving platform', () => {
  const makeBox = (z: number): BuiltBox => {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, position: new CANNON.Vec3(0, 0, z) });
    return { body, mesh: { position: { set: () => undefined } } as unknown as BuiltBox['mesh'] };
  };
  const data = {
    type: 'movingPlatform',
    at: [14, -3, -52.5],
    size: [3, 3],
    surface: 'lav',
    toZ: -62.5,
    speed: 2.2,
    pause: 1.2,
  } as const;

  it('waits, travels to the far end, then turns back', () => {
    const box = makeBox(-52.5);
    const platform = createMovingPlatform(data, box);
    platform.update(1);
    expect(box.body.velocity.z).toBe(0);
    platform.update(0.3); // pause runs out during this frame
    platform.update(0.01);
    expect(box.body.velocity.z).toBeCloseTo(-2.2);

    box.body.position.z = -63;
    platform.update(0.01);
    expect(box.body.position.z).toBe(-62.5);
    expect(box.body.velocity.z).toBe(0);

    platform.update(1.3);
    platform.update(0.01);
    expect(box.body.velocity.z).toBeCloseTo(2.2);
  });

  it('reset puts it back at the start', () => {
    const box = makeBox(-60);
    const platform = createMovingPlatform(data, box);
    platform.reset();
    expect(box.body.position.z).toBe(-52.5);
  });
});
