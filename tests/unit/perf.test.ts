import { describe, expect, it } from 'vitest';
import { followFactor } from '../../src/engine/camera';
import { createFrameStats, createQualityGovernor } from '../../src/engine/perf';

type Governor = ReturnType<typeof createQualityGovernor>;
/** Feeds `seconds` of frames at `fps` and lists the changes asked for. */
const run = (governor: Governor, fps: number, seconds: number) => {
  const changes: string[] = [];
  for (let i = 0; i < fps * seconds; i++) {
    const change = governor.update(1 / fps);
    if (change) changes.push(change);
  }
  return changes;
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
    expect(run(governor, 60, 10)).toEqual([]);
    expect(governor.isLow()).toBe(false);
  });
  it('lowers quality after 3 s under 50 fps, keeps it when it helps, at most twice', () => {
    const governor = createQualityGovernor();
    expect(run(governor, 40, 2.5)).toEqual([]);
    expect(run(governor, 40, 1)).toEqual(['lower']);
    expect(run(governor, 46, 2.5)).toEqual([]);
    expect(governor.isLow()).toBe(true);
    expect(run(governor, 46, 3)).toEqual(['lower']);
    expect(run(governor, 58, 2.5)).toEqual([]);
    expect(run(governor, 30, 20)).toEqual([]);
    expect(governor.isLow()).toBe(true);
  });
  it('undoes a drop that brings no more frames (a phone capped at 30 fps), then stays put', () => {
    const governor = createQualityGovernor();
    expect(run(governor, 30, 3.5)).toEqual(['lower']);
    expect(run(governor, 30, 2.5)).toEqual(['restore']);
    expect(run(governor, 30, 30)).toEqual([]);
    expect(governor.isLow()).toBe(false);
  });
  it('forgets the frames counted before a restart (menus, loading, pause)', () => {
    const governor = createQualityGovernor();
    run(governor, 40, 2.5);
    governor.restart();
    expect(run(governor, 40, 2.5)).toEqual([]);
    expect(governor.isLow()).toBe(false);
  });
  it('forgives a short slowdown', () => {
    const governor = createQualityGovernor();
    run(governor, 40, 2);
    run(governor, 60, 1);
    expect(run(governor, 40, 2)).toEqual([]);
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
