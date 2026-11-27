import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../src/engine/physics';
import { runBot } from '../../src/game/bot';
import { runHeadless } from '../../src/game/headless';
import { createRecorder, playReplay, replaySchema } from '../../src/game/replay';
import { shippedLevel } from './helpers';

describe('replay encoding', () => {
  it('round-trips inputs, run-length encoded', () => {
    const recorder = createRecorder(() => true);
    const values = [
      { x: 0, y: 1 },
      { x: 0, y: 1 },
      { x: 0.5, y: -0.25 },
    ];
    let i = 0;
    const read = recorder.wrap(() => values[i++] ?? { x: 0, y: 0 });
    values.forEach(() => read());
    const replay = recorder.finish('poc', { time: 1, falls: 0 });
    expect(replay.inputs).toEqual([
      [0, 256, 2],
      [128, -64, 1],
    ]);
    const play = playReplay(replay);
    expect([play(), play(), play(), play()]).toEqual([...values, { x: 0, y: 0 }]);
  });
});

describe('bot and replays', () => {
  beforeAll(() => initPhysics());

  it('the bot finishes the prototype level without falling', () => {
    const run = runBot(shippedLevel('poc'));
    expect(run.won).toBe(true);
    expect(run.falls).toBe(0);
  });

  it('the recorded prototype replay still wins at the same time', () => {
    const replay = replaySchema.parse(JSON.parse(readFileSync('tests/replays/poc.json', 'utf8')));
    const run = runHeadless(shippedLevel('poc'), () => playReplay(replay), replay.result.time + 1);
    expect(run.won).toBe(true);
    expect(run.time).toBeCloseTo(replay.result.time, 6);
  });
});
