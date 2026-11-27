import { describe, expect, it } from 'vitest';
import { gravityDirection, MAX_TILT } from '../../src/engine/physics';
import { createRandom } from '../../src/engine/math';
import { createShuttle } from '../../src/game/pieces/movingPlatform';
import { createFixedStepper } from '../../src/engine/loop';
import { rapierDamping } from '../../src/engine/physics';

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

describe('moving platform shuttle', () => {
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
    const shuttle = createShuttle(data);
    shuttle.step(1);
    expect(shuttle.z()).toBe(-52.5);
    shuttle.step(0.3); // pause runs out during this step
    shuttle.step(0.1);
    expect(shuttle.z()).toBeCloseTo(-52.72);
    expect(shuttle.previousZ()).toBe(-52.5);

    let steps = 0;
    while (shuttle.z() > -62.5 && steps < 100) {
      shuttle.step(0.1);
      steps++;
    }
    expect(shuttle.z()).toBe(-62.5);
    expect(steps).toBe(45); // the remaining 9.78 m at 2.2 m/s
    shuttle.step(1.3);
    shuttle.step(0.1);
    expect(shuttle.z()).toBeGreaterThan(-62.5);
  });

  it('reset puts it back at the start', () => {
    const shuttle = createShuttle(data);
    for (let i = 0; i < 30; i++) shuttle.step(0.1);
    shuttle.reset();
    expect(shuttle.z()).toBe(-52.5);
    expect(shuttle.previousZ()).toBe(-52.5);
  });
});

describe('fixed stepper', () => {
  it('runs exactly two 120 Hz steps per 60 Hz frame and keeps the remainder for blending', () => {
    const stepper = createFixedStepper(1 / 120);
    let steps = 0;
    for (let i = 0; i < 600; i++) stepper.advance(1 / 60, () => steps++);
    expect(steps).toBe(1200);
    const alpha = stepper.advance(1 / 240, () => steps++);
    expect(steps).toBe(1200);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('caps the number of steps after a long stall', () => {
    const stepper = createFixedStepper(1 / 120, 8);
    let steps = 0;
    stepper.advance(1, () => steps++);
    expect(steps).toBe(8);
  });
});

describe('rapierDamping', () => {
  it('loses the same speed per second as the cannon-es coefficient', () => {
    const d = 0.12;
    const cannon = Math.pow(1 - d, 1);
    let rapier = 1;
    for (let i = 0; i < 1200; i++) rapier /= 1 + rapierDamping(d) / 1200;
    expect(rapier).toBeCloseTo(cannon, 3);
  });
});
