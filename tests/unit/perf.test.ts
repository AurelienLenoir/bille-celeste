import { describe, expect, it } from 'vitest';
import { followFactor } from '../../src/engine/camera';
import { createFrameStats, createQualityGovernor } from '../../src/engine/perf';

const run = (governor: ReturnType<typeof createQualityGovernor>, fps: number, seconds: number) => {
  let dropped = 0;
  for (let i = 0; i < fps * seconds; i++) if (governor.update(1 / fps)) dropped++;
  return dropped;
};

describe('frame stats', () => {
  it('averages the frame rate and tracks the worst frame', () => {
    const stats = createFrameStats(4);
    [1 / 60, 1 / 60, 1 / 30, 1 / 60, 1 / 60].forEach(stats.push);
    expect(stats.fps()).toBeCloseTo(4 / (3 / 60 + 1 / 30));
    expect(stats.worstMs()).toBeCloseTo(1000 / 30);
  });
});

describe('quality governor', () => {
  it('keeps high quality at 60 fps', () => {
    const governor = createQualityGovernor();
    expect(run(governor, 60, 10)).toBe(0);
    expect(governor.isLow()).toBe(false);
  });
  it('drops once after 3 s under 50 fps', () => {
    const governor = createQualityGovernor();
    expect(run(governor, 40, 2.5)).toBe(0);
    expect(run(governor, 40, 1)).toBe(1);
    expect(run(governor, 40, 10)).toBe(0);
    expect(governor.isLow()).toBe(true);
  });
  it('forgives a short slowdown', () => {
    const governor = createQualityGovernor();
    run(governor, 40, 2);
    run(governor, 60, 1);
    expect(run(governor, 40, 2)).toBe(0);
  });
});

describe('camera followFactor', () => {
  it('does not depend on the frame rate', () => {
    const at60 = 1 - (1 - followFactor(6, 1 / 60)) ** 60;
    const at120 = 1 - (1 - followFactor(6, 1 / 120)) ** 120;
    expect(at60).toBeCloseTo(at120);
    expect(followFactor(6, 0)).toBe(0);
  });
});
