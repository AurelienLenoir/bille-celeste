import { CAMPAIGN } from '../levels/worlds';

/** One analytics event as exported from PostHog (only the fields the funnel needs). */
export type FunnelEvent = {
  event: string;
  distinct_id: string;
  properties: { level?: string; falls?: number; time?: number };
};

export type LevelFunnel = {
  level: string;
  /** Players who started the level at least once. */
  players: number;
  /** Players who finished it. */
  finishers: number;
  starts: number;
  wins: number;
  quits: number;
  /** Mean falls per finished run. */
  fallsPerWin: number;
  /** Median winning time (s). */
  medianTime: number | undefined;
};

const median = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
};

/**
 * Where the beta players stop (PLAN.md § 7): per campaign level, how many players started it, how
 * many finished it, and how hard it was (falls, times, quits).
 */
export const levelFunnel = (events: readonly FunnelEvent[]): LevelFunnel[] =>
  CAMPAIGN.map((level) => {
    const mine = events.filter((e) => e.properties.level === level);
    const of = (name: string) => mine.filter((e) => e.event === name);
    const wins = of('level_win');
    return {
      level,
      players: new Set(of('level_start').map((e) => e.distinct_id)).size,
      finishers: new Set(wins.map((e) => e.distinct_id)).size,
      starts: of('level_start').length,
      wins: wins.length,
      quits: of('level_quit').length,
      fallsPerWin: wins.length ? wins.reduce((sum, e) => sum + (e.properties.falls ?? 0), 0) / wins.length : 0,
      medianTime: median(wins.flatMap((e) => (e.properties.time === undefined ? [] : [e.properties.time]))),
    };
  });

/** Share of players who started level 1 and finished the whole first world (beta goal: over 80 %). */
export const worldOneCompletion = (events: readonly FunnelEvent[]): number => {
  const started = new Set(
    events.filter((e) => e.event === 'level_start' && e.properties.level === 'w1-01').map((e) => e.distinct_id),
  );
  if (!started.size) return 0;
  const done = new Set(
    events.filter((e) => e.event === 'level_win' && e.properties.level === 'w1-05').map((e) => e.distinct_id),
  );
  return [...started].filter((id) => done.has(id)).length / started.size;
};
