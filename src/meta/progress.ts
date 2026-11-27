import { z } from 'zod';
import type { Stars } from '../game/rules';
import { CAMPAIGN, WORLDS, type World } from '../levels/worlds';
import { isRecord, parseSave, readSave, type Migration, type SaveFormat } from './save';

export const PROGRESS_VERSION = 1;

/** What a player achieved on a finished level. Each star, once earned, is kept for good. */
const levelRecordSchema = z.object({
  /** Best time of a winning run (seconds). */
  bestTime: z.number().positive(),
  underPar: z.boolean(),
  noFall: z.boolean(),
  gem: z.boolean(),
});
export type LevelRecord = z.infer<typeof levelRecordSchema>;

const levelId = z.string().regex(/^[a-z0-9-]{1,32}$/);

export const progressSchema = z.object({
  version: z.literal(PROGRESS_VERSION),
  /** Only finished levels have a record. */
  levels: z.record(levelId, levelRecordSchema),
});
export type Progress = z.infer<typeof progressSchema>;

export const emptyProgress = (): Progress => ({ version: PROGRESS_VERSION, levels: {} });

/** Keeps every level record that is still valid and drops the others. */
const salvage = (raw: Record<string, unknown>): Progress => {
  const levels: Progress['levels'] = {};
  if (isRecord(raw.levels))
    for (const [id, record] of Object.entries(raw.levels)) {
      const parsed = levelRecordSchema.safeParse(record);
      if (levelId.safeParse(id).success && parsed.success) levels[id] = parsed.data;
    }
  return { version: PROGRESS_VERSION, levels };
};

/** Version 1 is the first progress format; a future v2 adds `1: (v1) => v2` and its test. */
export const PROGRESS_MIGRATIONS: Record<number, Migration> = {};

export const PROGRESS_FORMAT: SaveFormat<Progress> = {
  version: PROGRESS_VERSION,
  migrations: PROGRESS_MIGRATIONS,
  fallback: emptyProgress,
  finalize: salvage,
};

export const readProgress = (stored: unknown): Progress => readSave(stored, PROGRESS_FORMAT);
export const parseStoredProgress = (json: string | null): Progress => parseSave(json, PROGRESS_FORMAT);

/** A won run, as the session reports it. */
export type WinningRun = { time: number; falls: number; stars: Stars; gem: boolean };

/** What a win changed, for the victory screen. */
export type WinOutcome = {
  progress: Progress;
  /** Faster than every earlier win (always true for a first win). */
  newRecord: boolean;
  /** Best time before this run, if the level had been finished. */
  previousBest?: number;
  /** Stars the level has now, all runs together. */
  stars: number;
  /** Stars this run added to the level. */
  gainedStars: number;
};

export const starCount = (record: LevelRecord | undefined): number =>
  record ? 1 + Number(record.underPar) + Number(record.noFall) : 0;

/** Stores a win: best time, and each star and the gem once earned. */
export const recordWin = (progress: Progress, id: string, run: WinningRun): WinOutcome => {
  const before = progress.levels[id];
  const record: LevelRecord = {
    bestTime: before ? Math.min(before.bestTime, run.time) : run.time,
    underPar: (before?.underPar ?? false) || run.stars.underPar,
    noFall: (before?.noFall ?? false) || run.stars.noFall,
    gem: (before?.gem ?? false) || run.gem,
  };
  const next: Progress = { ...progress, levels: { ...progress.levels, [id]: record } };
  return {
    progress: next,
    newRecord: !before || run.time < before.bestTime,
    ...(before ? { previousBest: before.bestTime } : {}),
    stars: starCount(record),
    gainedStars: starCount(record) - starCount(before),
  };
};

/** Stars earned over the whole campaign. */
export const totalStars = (progress: Progress): number =>
  CAMPAIGN.reduce((sum, id) => sum + starCount(progress.levels[id]), 0);

export const worldStars = (progress: Progress, world: World): number =>
  world.levels.reduce((sum, id) => sum + starCount(progress.levels[id]), 0);

export const isWorldOpen = (progress: Progress, world: World): boolean => totalStars(progress) >= world.unlockStars;

/** A level opens with its world, once the level before it in that world is finished. */
export const isLevelOpen = (progress: Progress, id: string): boolean => {
  const world = WORLDS.find((w) => w.levels.includes(id));
  if (!world) return true;
  if (!isWorldOpen(progress, world)) return false;
  const i = world.levels.indexOf(id);
  const before = world.levels[i - 1];
  return !before || !!progress.levels[before];
};

/** Where "Play" leads: the first open level not finished yet, or the last open one. */
export const resumeLevel = (progress: Progress): string => {
  const open = CAMPAIGN.filter((id) => isLevelOpen(progress, id));
  return open.find((id) => !progress.levels[id]) ?? open.at(-1) ?? CAMPAIGN[0] ?? 'w1-01';
};
