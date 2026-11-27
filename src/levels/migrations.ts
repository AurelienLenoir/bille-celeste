import { LEVEL_VERSION } from './schema';

/** `MIGRATIONS[n]` turns a version-n level into a version n + 1 level. Version 1 is the first format. */
export type Migrations = Record<number, (level: Record<string, unknown>) => Record<string, unknown>>;
export const MIGRATIONS: Migrations = {
  /** Version 2 adds the bonuses and maluses: a version-1 level has none. */
  1: (level) => ({ ...level, modifiers: [] }),
  /** Version 3 adds the tutorial signs: older levels have none. */
  2: (level) => ({ ...level, signs: [] }),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Brings a level file up to the current format, one version at a time. */
export const migrateLevel = (json: unknown, migrations: Migrations = MIGRATIONS, target = LEVEL_VERSION): unknown => {
  if (!isRecord(json) || typeof json.version !== 'number') return json;
  if (json.version > target)
    throw new Error(`Niveau en version ${json.version}, ce jeu lit au plus la version ${target}`);
  let level = json;
  for (let v = json.version; v < target; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`Aucune migration de la version ${v} vers ${v + 1}`);
    level = { ...step(level), version: v + 1 };
  }
  return level;
};
