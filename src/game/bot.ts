import type { Vec2 } from '../engine/math';
import type { Level } from '../levels/schema';
import { createAutopilot } from './autopilot';
import { runHeadless, type RunResult } from './headless';
import { buildNav, planRoute } from './nav';

export type BotResult = RunResult & { planned: boolean; routeLength: number };

/** Time the bot gets before a level counts as failed. */
export const botTimeLimit = (level: Level): number => Math.max(90, level.parTimeSec * 4);

/** Plays a level with the autopilot, without rendering (PLAN.md § 4.4). Call initPhysics() first. */
export const runBot = (level: Level, onStep?: (input: Vec2) => void): BotResult => {
  const route = planRoute(level, buildNav(level));
  if (!route) return { won: false, time: 0, falls: 0, steps: 0, planned: false, routeLength: 0 };
  const result = runHeadless(
    level,
    (run) => createAutopilot(level, route, run.world, run.ball),
    botTimeLimit(level),
    onStep,
  );
  return { ...result, planned: true, routeLength: route.length };
};
