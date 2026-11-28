/**
 * Beta funnel (PLAN.md § 7): reads a PostHog event export (JSON array or JSON lines) and prints,
 * for each level, how many players started and finished it, falls and times.
 * Usage: npm run beta:funnel -- export.json
 */
import { readFileSync } from 'node:fs';
import { levelFunnel, worldOneCompletion, type FunnelEvent } from '../src/meta/funnel';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run beta:funnel -- <export PostHog .json ou .jsonl>');
  process.exit(1);
}
const text = readFileSync(file, 'utf8').trim();
const events: FunnelEvent[] = text.startsWith('[')
  ? (JSON.parse(text) as FunnelEvent[])
  : text.split('\n').map((line) => JSON.parse(line) as FunnelEvent);

const pct = (n: number) => `${Math.round(n * 100)} %`;
console.log('Niveau  Joueurs  Terminé  Abandons  Chutes/victoire  Temps médian');
let previous: number | undefined;
for (const row of levelFunnel(events)) {
  const drop = previous ? ` (${pct(row.players / previous)} des joueurs du niveau précédent)` : '';
  console.log(
    `${row.level}   ${String(row.players).padStart(7)}  ${String(row.finishers).padStart(7)}  ${String(row.quits).padStart(8)}  ${row.fallsPerWin.toFixed(1).padStart(15)}  ${row.medianTime === undefined ? '—' : `${row.medianTime.toFixed(1)} s`}${drop}`,
  );
  previous = row.players || previous;
}
console.log(
  `\nMonde 1 terminé par ${pct(worldOneCompletion(events))} des joueurs (objectif de la bêta : plus de 80 %).`,
);
