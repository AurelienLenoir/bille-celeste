/**
 * Bot run of every level, without rendering (PLAN.md § 4.4), then the non-regression replays.
 * Usage: npm run level:bot [-- --level id] [-- --record]
 *   --record  saves the bot's winning inputs as tests/replays/<id>.json
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initPhysics } from '../src/engine/physics';
import type { Vec2 } from '../src/engine/math';
import { runBot } from '../src/game/bot';
import { runHeadless } from '../src/game/headless';
import { createRecorder, playReplay, replaySchema } from '../src/game/replay';
import type { Level } from '../src/levels/schema';
import { arg, readLevels } from './levels';

const REPLAY_DIR = 'tests/replays';
const only = arg('level');
const record = process.argv.includes('--record');

await initPhysics();
const levels = new Map<string, Level>();
let failed = 0;

console.log('Bot');
for (const { file, result } of readLevels()) {
  if (!result.ok) {
    console.log(`✗ ${file} : niveau invalide (lancer level:validate)`);
    failed++;
    continue;
  }
  const level = result.level;
  levels.set(level.id, level);
  if (only && level.id !== only) continue;
  const recorder = createRecorder(() => true);
  let next: Vec2 = { x: 0, y: 0 };
  const capture = recorder.wrap(() => next);
  const started = performance.now();
  const run = runBot(level, (input) => {
    next = input;
    capture();
  });
  const ms = (performance.now() - started).toFixed(0);
  if (!run.won) failed++;
  const outcome = !run.planned
    ? 'aucun chemin trouvé'
    : run.won
      ? `terminé en ${run.time.toFixed(1)} s (référence ${level.parTimeSec} s), ${run.falls} chute(s)`
      : `échec après ${run.time.toFixed(1)} s, ${run.falls} chute(s)`;
  console.log(`${run.won ? '✓' : '✗'} ${level.id} : ${outcome} [${ms} ms]`);
  if (record && run.won) {
    mkdirSync(REPLAY_DIR, { recursive: true });
    const replay = recorder.finish(level.id, { time: run.time, falls: run.falls });
    writeFileSync(join(REPLAY_DIR, `${level.id}.json`), `${JSON.stringify(replay)}\n`);
    console.log(`    replay enregistré dans ${REPLAY_DIR}/${level.id}.json`);
  }
}

console.log('\nReplays');
const replayFiles = (() => {
  try {
    return readdirSync(REPLAY_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
})();
for (const name of replayFiles.sort()) {
  const parsed = replaySchema.safeParse(JSON.parse(readFileSync(join(REPLAY_DIR, name), 'utf8')));
  if (!parsed.success) {
    console.log(`✗ ${name} : fichier de replay invalide`);
    failed++;
    continue;
  }
  const replay = parsed.data;
  if (only && replay.level !== only) continue;
  const level = levels.get(replay.level);
  if (!level) {
    console.log(`✗ ${name} : niveau ${replay.level} introuvable`);
    failed++;
    continue;
  }
  const run = runHeadless(level, () => playReplay(replay), replay.result.time + 2);
  const same = run.won && Math.abs(run.time - replay.result.time) < 1e-6 && run.falls === replay.result.falls;
  if (!same) failed++;
  console.log(
    same
      ? `✓ ${name} : rejoué à l'identique (${run.time.toFixed(2)} s, ${run.falls} chute(s))`
      : `✗ ${name} : attendu ${replay.result.time.toFixed(2)} s / ${replay.result.falls} chute(s), obtenu ${run.won ? `${run.time.toFixed(2)} s` : 'pas de victoire'} / ${run.falls} chute(s)`,
  );
}

if (failed) {
  console.log(`\n${failed} échec(s)`);
  process.exit(1);
}
