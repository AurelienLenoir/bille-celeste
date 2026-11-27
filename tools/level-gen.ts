/**
 * Procedural level draft (PLAN.md § 4.2), checked by the validator and the bot.
 * Usage: npm run level:gen -- --world 3 --difficulty 0.6 --seed 42 [--id w3-draft] [--out file.json]
 * The par time is set from the bot's time. Without --out the file goes to src/levels/data/<id>.json.
 */
import { writeFileSync } from 'node:fs';
import { initPhysics } from '../src/engine/physics';
import { parTimeFrom, runBot } from '../src/game/bot';
import { generateLevel } from '../src/levels/generate';
import { validateLevel } from '../src/levels/validate';
import { arg, LEVEL_DIR } from './levels';

const world = Number(arg('world') ?? 1);
const difficulty = Number(arg('difficulty') ?? 0.3);
const seed = Number(arg('seed') ?? Date.now() % 100000);
if (!(world >= 1 && world <= 4) || !(difficulty >= 0 && difficulty <= 1) || !Number.isInteger(seed)) {
  console.error('Usage : npm run level:gen -- --world 1..4 --difficulty 0..1 --seed N [--id id] [--out fichier]');
  process.exit(1);
}

await initPhysics();
const id = arg('id');
const level = generateLevel({ world, difficulty, seed, ...(id ? { id } : {}) });
const warnings = validateLevel(level);
const bot = runBot(level);
const counts = level.entities.reduce<Record<string, number>>((c, e) => ({ ...c, [e.type]: (c[e.type] ?? 0) + 1 }), {});
console.log(
  `${level.id} : ${level.pieces.length} pièces, ${counts.crystal ?? 0} cristaux, ${counts.checkpoint ?? 0} checkpoints, parcours de ${Math.round(bot.routeLength)} unités`,
);
warnings.forEach((w) => console.log(`  attention : ${w.message}`));
if (!bot.won) {
  console.log(`✗ Le bot ne termine pas ce brouillon (${bot.falls} chutes). Essaie une autre graine.`);
  process.exit(1);
}
level.parTimeSec = parTimeFrom(bot.time);
const out = arg('out') ?? `${LEVEL_DIR}/${level.id}.json`;
writeFileSync(out, `${JSON.stringify(level, null, 2)}\n`);
console.log(
  `✓ Bot : ${bot.time.toFixed(1)} s, ${bot.falls} chute(s). Temps de référence ${level.parTimeSec} s. Écrit dans ${out}`,
);
