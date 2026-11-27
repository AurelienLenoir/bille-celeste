import { migrateLevel } from './migrations';
import { levelSchema, type Level } from './schema';

export type ParseResult = { ok: true; level: Level } | { ok: false; errors: string[] };

/** Migrates then validates a level file. Errors name the faulty path, e.g. `pieces.3.length`. */
export const parseLevel = (json: unknown): ParseResult => {
  let migrated: unknown;
  try {
    migrated = migrateLevel(json);
  } catch (error) {
    return { ok: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
  const result = levelSchema.safeParse(migrated);
  if (result.success) return { ok: true, level: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.') || 'niveau'} : ${issue.message}`),
  };
};

/** Like `parseLevel`, but throws on an invalid file. */
export const loadLevel = (json: unknown): Level => {
  const result = parseLevel(json);
  if (!result.ok) throw new Error(`Niveau invalide :\n${result.errors.join('\n')}`);
  return result.level;
};
