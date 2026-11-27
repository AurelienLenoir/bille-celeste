import { z } from 'zod';
import { quantizeInput } from '../engine/input';
import type { Vec2 } from '../engine/math';

/** Inputs are stored in 1/256 of full tilt, run-length encoded as [x, y, steps]. */
const SCALE = 256;

export const replaySchema = z.object({
  version: z.literal(1),
  level: z.string(),
  /** Result when it was recorded; replaying must reproduce it. */
  result: z.object({ time: z.number(), falls: z.number().int() }),
  inputs: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int().positive()])),
});

export type Replay = z.output<typeof replaySchema>;

export type Recorder = {
  /** Wraps an input source: every value it returns while `recording()` is true is kept. */
  wrap: (read: () => Vec2) => () => Vec2;
  clear: () => void;
  finish: (level: string, result: Replay['result']) => Replay;
};

export const createRecorder = (recording: () => boolean): Recorder => {
  let runs: [number, number, number][] = [];
  return {
    wrap: (read) => () => {
      const value = quantizeInput(read());
      if (!recording()) return value;
      const x = Math.round(value.x * SCALE);
      const y = Math.round(value.y * SCALE);
      const last = runs[runs.length - 1];
      if (last && last[0] === x && last[1] === y) last[2]++;
      else runs.push([x, y, 1]);
      return value;
    },
    clear: () => {
      runs = [];
    },
    finish: (level, result) => ({ version: 1, level, result, inputs: runs.map((r) => [...r]) }),
  };
};

/** Input source that plays a replay back, one value per physics step, then neutral. */
export const playReplay = (replay: Replay): (() => Vec2) => {
  let run = 0;
  let used = 0;
  return () => {
    const current = replay.inputs[run];
    if (!current) return { x: 0, y: 0 };
    used++;
    if (used >= current[2]) {
      run++;
      used = 0;
    }
    return { x: current[0] / SCALE, y: current[1] / SCALE };
  };
};
