import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';
import { basename, join } from 'node:path';
import { parseLevel, type ParseResult } from '../src/levels/loader';

export const LEVEL_DIR = 'src/levels/data';

export type LevelFile = { file: string; id: string; result: ParseResult };

/** Every level file shipped with the game, parsed and migrated. */
export const readLevels = (dir = LEVEL_DIR): LevelFile[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const file = join(dir, f);
      let json: unknown;
      try {
        json = JSON.parse(readFileSync(file, 'utf8'));
      } catch (error) {
        return { file, id: basename(f, '.json'), result: { ok: false, errors: [`JSON illisible : ${String(error)}`] } };
      }
      return { file, id: basename(f, '.json'), result: parseLevel(json) };
    });

/** Value of `--name value` on the command line. */
export const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

/** Writes a level file formatted like the rest of the repository (Prettier). */
export const writeLevelFile = async (file: string, level: unknown): Promise<void> => {
  const options = (await resolveConfig(file)) ?? {};
  writeFileSync(file, await format(JSON.stringify(level), { ...options, parser: 'json' }));
};
