/**
 * Static validation of every level (PLAN.md § 4.3): schema, overlaps, entities on the course,
 * reachability of every crystal and of the goal, checkpoints, draw-call budget.
 * Usage: npm run level:validate [-- --dir path]
 */
import { arg, readLevels } from './levels';
import { hasErrors, validateLevel } from '../src/levels/validate';

const files = readLevels(arg('dir'));
let failed = 0;
const ids = new Map<string, string>();

for (const { file, id, result } of files) {
  const issues = result.ok
    ? validateLevel(result.level)
    : result.errors.map((message) => ({ severity: 'error' as const, message }));
  if (result.ok) {
    if (result.level.id !== id)
      issues.push({ severity: 'error', message: `L'id « ${result.level.id} » ne correspond pas au fichier` });
    const other = ids.get(result.level.id);
    if (other) issues.push({ severity: 'error', message: `Id « ${result.level.id} » déjà utilisé par ${other}` });
    ids.set(result.level.id, file);
  }
  const bad = hasErrors(issues);
  if (bad) failed++;
  console.log(`${bad ? '✗' : '✓'} ${file}`);
  for (const issue of issues)
    console.log(`    ${issue.severity === 'error' ? 'erreur' : 'attention'} : ${issue.message}`);
}

console.log(`\n${files.length - failed}/${files.length} niveaux valides`);
if (failed || !files.length) process.exit(1);
