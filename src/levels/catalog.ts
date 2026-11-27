import { loadLevel } from './loader';
import type { Level } from './schema';

/** Every level shipped with the game, loaded on demand (one small chunk per file). */
const files = import.meta.glob<{ default: unknown }>('./data/*.json');

const idOf = (path: string) => path.replace(/^.*\//, '').replace(/\.json$/, '');
const byId = new Map(Object.entries(files).map(([path, load]) => [idOf(path), load]));

/** Key under which the level editor hands its level to the game (`?level=editor`). */
export const EDITOR_LEVEL_KEY = 'bille-celeste.editor-level';

export const LEVEL_IDS: readonly string[] = [...byId.keys()].sort();
export const DEFAULT_LEVEL = 'poc';

export const fetchLevel = async (id: string): Promise<Level> => {
  const load = byId.get(id);
  if (!load) throw new Error(`Niveau inconnu : ${id}`);
  return loadLevel((await load()).default);
};
