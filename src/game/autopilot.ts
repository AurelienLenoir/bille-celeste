import { clamp, type Vec2, type Vec3Tuple } from '../engine/math';
import { GRAVITY, MAX_TILT, PHYSICS_STEP } from '../engine/physics';
import type { Level } from '../levels/schema';
import { BALL_RADIUS, type Ball as BallType } from './ball';
import type { Hazard } from './modifiers/kit';
import type { Route } from './nav';
import { centreRadius } from './pieces/curve';
import type { RunStatus } from './session';
import type { LevelWorld } from './world';

/** Cruise speeds (units/s) by situation. */
const SPEED = { cruise: 4.5, turn: 3, narrow: 3, rail: 2.2, careful: 2.5, jump: 12.5 } as const;
/** Sideways acceleration (units/s²) the bot allows itself in curves. */
const CORNER_GRIP = 3.5;
/** Input per unit/s of velocity error. */
const GAIN = 0.55;
/** How far before a kicker the bot starts building up speed (route steps). */
const JUMP_LOOKAHEAD = 5;
/** Respawn is detected when the ball is suddenly this far from where the bot thought it was. */
const LOST = 6;
const DOCKED = 0.2;
/** Crossing a moving obstacle: assumed average speed from a standstill (units/s) and start-up delay (s). */
const CROSSING = { speed: 3, delay: 0.45, window: 0.4, margin: BALL_RADIUS + 0.4 } as const;

type Flat = { x: number; z: number };

const flat = (p: Vec3Tuple | { x: number; z: number }): Flat => ('x' in p ? p : { x: p[0], z: p[2] });
const sub = (a: Flat, b: Flat): Flat => ({ x: a.x - b.x, z: a.z - b.z });
const len = (a: Flat) => Math.hypot(a.x, a.z);

/** Speed limit for the piece a route step belongs to. */
const pieceSpeed = (level: Level, piece: number): number => {
  const p = level.pieces[piece];
  if (!p) return SPEED.cruise;
  if ('width' in p && p.width === 'rail') return SPEED.rail;
  // Keep the sideways pull of a curve (v² / r) well under what the tilt can give back.
  if (p.type === 'curve')
    return Math.min(
      p.width === 'narrow' ? SPEED.narrow : SPEED.cruise,
      Math.sqrt(CORNER_GRIP * centreRadius(p.radius)),
    );
  if ('width' in p && p.width === 'narrow') return SPEED.narrow;
  if (p.type === 'seesaw' || p.type === 'rotatingPlatform') return SPEED.careful;
  return SPEED.cruise;
};

/**
 * Automatic pilot that follows a planned route (PLAN.md § 4.4): it steers the tilt so the ball's
 * velocity matches a target velocity towards a point a little ahead on the route. It waits for
 * moving platforms at their docks, rides them, and speeds up before gaps.
 */
export const createAutopilot = (
  level: Level,
  route: Route,
  world: LevelWorld,
  ball: BallType,
  status: () => RunStatus,
): (() => Vec2) => {
  const steps = route.steps;
  const last = steps.length - 1;
  let idx = 0;
  let lastPlatform: Vec3Tuple | undefined;

  const at = (i: number) => steps[Math.max(0, Math.min(last, i))]?.at ?? ([0, 0, 0] as const);
  const moverAt = (i: number) => world.moverByPiece[steps[i]?.piece ?? -1]?.position;

  /** Point `distance` along the route after the projection of `p` on the current segment. */
  const lookAhead = (p: Flat, distance: number): Flat => {
    const a = flat(at(idx));
    let b = flat(at(idx + 1));
    const ab = sub(b, a);
    const t = clamp(((p.x - a.x) * ab.x + (p.z - a.z) * ab.z) / (len(ab) ** 2 || 1), 0, 1);
    let point = { x: a.x + ab.x * t, z: a.z + ab.z * t };
    let left = distance;
    for (let i = idx + 1; i <= last && left > 0; i++) {
      if (steps[i]?.via === 'ride' && i > idx + 1) break;
      b = flat(at(i));
      const step = len(sub(b, point));
      if (step >= left)
        return { x: point.x + ((b.x - point.x) * left) / step, z: point.z + ((b.z - point.z) * left) / step };
      left -= step;
      point = b;
    }
    return point;
  };

  const relocate = (p: { x: number; y: number; z: number }) => {
    let best = idx;
    let bestDist = Infinity;
    for (let i = 0; i <= idx; i++) {
      const [x, y, z] = at(i);
      const d = Math.hypot(p.x - x, (p.y - y) * 2, p.z - z);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    idx = best;
  };

  /** Is the moving platform of route step `i` (or of the step before, when riding) at that step's stop? */
  const isDocked = (i: number, platformStep = i) => {
    const platform = moverAt(platformStep)?.();
    return !!platform && len(sub(flat(platform), flat(at(i)))) <= DOCKED;
  };

  const hazards = world.modifiers.flatMap((m) => m.instance.hazard ?? []);

  /** Would rolling from route step `idx` through `hazard` now get the ball hit on the way? */
  const crossingIsUnsafe = (hazard: Hazard, from: number, delay: number) => {
    const scale = status().timeScale;
    let travelled = 0;
    let prev = flat(at(from));
    for (let i = from + 1; i <= last; i++) {
      const point = flat(at(i));
      const seg = len(sub(point, prev));
      for (let d = 0; d < seg; d += 0.25) {
        const x = prev.x + ((point.x - prev.x) * d) / seg;
        const z = prev.z + ((point.z - prev.z) * d) / seg;
        if (!hazard.covers(x, z)) continue;
        const t = delay + CROSSING.delay + (travelled + d) / CROSSING.speed;
        for (const dt of [-CROSSING.window, 0, CROSSING.window])
          if (hazard.hitsAt(x, z, Math.max(0, t + dt) * scale, CROSSING.margin)) return true;
      }
      travelled += seg;
      prev = point;
      if (!hazard.covers(point.x, point.z) && i > from + 1) break;
    }
    return false;
  };

  /**
   * Route step `i` is the last one before a moving obstacle's reach, and setting off from it in
   * `delay` seconds would get the ball hit.
   */
  const gateUnsafe = (i: number, delay = 0) => {
    if (i >= last) return false;
    const here = flat(at(i));
    const next = flat(at(i + 1));
    return hazards.some((h) => !h.covers(here.x, here.z) && h.covers(next.x, next.z) && crossingIsUnsafe(h, i, delay));
  };
  /** Gate the bot decided to cross: it does not change its mind halfway. */
  let committed = -1;
  const mustWaitForHazard = () => {
    if (committed === idx) return false;
    if (gateUnsafe(idx)) return true;
    if (hazards.length && idx < last) committed = idx;
    return false;
  };

  const advance = (p: Flat) => {
    while (idx < last) {
      if (mustWaitForHazard()) return;
      const next = steps[idx + 1];
      // Step onto a moving platform only when it is at this dock, and leave it only at the next stop.
      if (next && next.via !== 'ride' && moverAt(idx + 1) && !isDocked(idx + 1)) return;
      if (next?.via === 'ride' && !isDocked(idx + 1, idx)) return;
      const a = flat(at(idx));
      const b = flat(at(idx + 1));
      const ab = sub(b, a);
      const t = ((p.x - a.x) * ab.x + (p.z - a.z) * ab.z) / (len(ab) ** 2 || 1);
      if (t < 1 && len(sub(p, b)) > 0.7) return;
      idx++;
    }
  };

  /** Target velocity when the bot must hold still on something (a dock or a moving platform). */
  const hold = (p: Flat, target: Flat, carried: Flat): Flat => {
    const d = sub(target, p);
    return { x: carried.x + clamp(d.x * 2.5, -2, 2), z: carried.z + clamp(d.z * 2.5, -2, 2) };
  };

  return () => {
    const pos = ball.position();
    const p = flat(pos);
    const [, cy] = at(idx);
    if (len(sub(p, flat(at(idx)))) > LOST || pos.y < cy - 2.5) relocate(pos);
    advance(p);

    const v = ball.velocity();
    let wanted: Flat;
    const next = steps[idx + 1];
    const platform = moverAt(idx)?.();
    const carried = platform && lastPlatform ? sub(flat(platform), flat(lastPlatform)) : { x: 0, z: 0 };
    lastPlatform = platform;
    const run = status();
    const stepTime = PHYSICS_STEP * run.timeScale;
    const carriedVel = { x: carried.x / stepTime, z: carried.z / stepTime };

    if (platform && next?.via === 'ride') {
      wanted = hold(p, flat(platform), carriedVel);
    } else if (idx < last && mustWaitForHazard()) {
      wanted = hold(p, flat(at(idx)), { x: 0, z: 0 });
    } else if (next && next.via !== 'ride' && moverAt(idx + 1) && !isDocked(idx + 1)) {
      wanted = hold(p, flat(at(idx)), { x: 0, z: 0 });
    } else {
      const jumping = steps.slice(idx + 1, idx + 1 + JUMP_LOOKAHEAD).some((s) => s.via === 'jump');
      let speed = jumping
        ? SPEED.jump
        : Math.min(pieceSpeed(level, steps[idx]?.piece ?? -1), pieceSpeed(level, next?.piece ?? -1));
      const speedNow = Math.hypot(v.x, v.z);
      const target = lookAhead(p, jumping ? 3 : 1 + speedNow * 0.3);
      if (!jumping) {
        // Slow down before sharp turns.
        const a = flat(at(idx));
        const b = flat(at(idx + 1));
        const c = flat(at(idx + 2));
        const u = sub(b, a);
        const w = sub(c, b);
        const cos = (u.x * w.x + u.z * w.z) / ((len(u) || 1) * (len(w) || 1));
        if (cos < 0.8) speed = Math.min(speed, SPEED.turn);
      }
      if (idx >= last) speed = SPEED.careful;
      // Coming up to a moving obstacle that is not clear: arrive slowly enough to stop at the gate.
      if (hazards.length && gateUnsafe(idx + 1, 0.5))
        speed = Math.min(speed, 0.4 + 1.4 * len(sub(flat(at(idx + 1)), p)));
      const d = sub(target, p);
      const dist = len(d) || 1;
      wanted = { x: (d.x / dist) * speed + carriedVel.x, z: (d.z / dist) * speed + carriedVel.z };
    }

    // Feed-forward: cancel what wind and belts push, since the tilt only answers after the fact.
    const perInput = GRAVITY * MAX_TILT;
    const x = clamp((wanted.x - v.x) * GAIN - run.push.x / perInput);
    const y = clamp(-(wanted.z - v.z) * GAIN + run.push.z / perInput);
    return run.invert ? { x: -x, y: -y } : { x, y };
  };
};
