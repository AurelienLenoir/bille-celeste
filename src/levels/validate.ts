import type { Vec3Tuple } from '../engine/math';
import { surfaceHeightsAt, type TrackShape } from '../engine/trackCollider';
import { buildNav, entityNode, nodeAt, planRoute, shortestPaths, type LevelNav } from '../game/nav';
import { MODIFIERS } from '../game/modifiers';
import { springLanding } from '../game/modifiers/spring';
import type { PieceBuild } from '../game/pieces/kit';
import { rampAngle } from '../game/pieces/ramp';
import { CELL, cellToWorld, forwardOf } from './grid';
import type { Entity, Level, Modifier, ModifierType } from './schema';

export type Issue = { severity: 'error' | 'warning'; message: string };

/** Two surfaces in the same cell need this much height between them for the ball to pass. */
const HEADROOM = 2;
/** A route longer than this (world units) needs at least one checkpoint. */
export const CHECKPOINT_ROUTE_LENGTH = 70;
export const DRAW_CALL_BUDGET = 80;
const MAX_RAMP_DEG = 32;
const MAX_CLIMB_DEG = 16;

const ENTITY_NAMES: Record<Entity['type'], string> = {
  crystal: 'Cristal',
  checkpoint: 'Checkpoint',
  hiddenGem: 'Gemme cachée',
  goal: 'Arrivée',
};

const MODIFIER_NAMES: Record<ModifierType, string> = {
  speedPad: 'Pad de vitesse',
  spring: 'Ressort',
  magnet: 'Aimant',
  shield: 'Bulle-bouclier',
  slowMo: 'Ralenti',
  hourglass: 'Sablier',
  feather: 'Bille plume',
  ice: 'Glace',
  sand: 'Sable',
  wind: 'Vent',
  conveyor: 'Tapis roulant',
  pusher: 'Pousseur',
  sweeper: 'Barre tournante',
  bumper: 'Bumper',
  heavy: 'Bille lourde',
  invert: 'Zone inversée',
  fog: 'Brouillard',
};

/** Draw calls of each modifier in game (shadow casters count twice). */
const MODIFIER_DRAW_CALLS: Record<ModifierType, number> = {
  speedPad: 1,
  spring: 1,
  magnet: 1,
  shield: 1,
  slowMo: 1,
  hourglass: 1,
  feather: 1,
  heavy: 1,
  ice: 1,
  sand: 1,
  wind: 1,
  conveyor: 2,
  pusher: 3,
  sweeper: 2,
  bumper: 2,
  invert: 1,
  fog: 1,
};

/** Modifiers that may hang over the void (a fog bank, a gust across a gap). */
const AIRBORNE = new Set<ModifierType>(['fog', 'wind']);

const describe = (level: Level, index: number) => `pièce ${index} (${level.pieces[index]?.type ?? '?'})`;
const entityLabel = (e: Entity, i: number) => `${ENTITY_NAMES[e.type]} ${i} en [${e.cell.join(', ')}]`;

const overlaps = (level: Level, builds: PieceBuild[]): Issue[] => {
  const seen = new Map<string, { piece: number; yMin: number; yMax: number }[]>();
  const issues: Issue[] = [];
  const reported = new Set<string>();
  builds.forEach(({ footprint }, piece) => {
    for (const cell of footprint) {
      const key = `${cell.i},${cell.k}`;
      const others = seen.get(key) ?? [];
      for (const o of others) {
        const clear = cell.yMin - o.yMax >= HEADROOM || o.yMin - cell.yMax >= HEADROOM;
        const pair = `${o.piece}-${piece}`;
        if (clear || o.piece === piece || reported.has(pair)) continue;
        reported.add(pair);
        issues.push({
          severity: 'error',
          message: `La ${describe(level, o.piece)} et la ${describe(level, piece)} se chevauchent en [${cell.i}, ${cell.k}]`,
        });
      }
      others.push({ piece, yMin: cell.yMin, yMax: cell.yMax });
      seen.set(key, others);
    }
  });
  return issues;
};

const segmentDistance = (x: number, z: number, a: Vec3Tuple, b: Vec3Tuple) => {
  const [dx, dz] = [b[0] - a[0], b[2] - a[2]];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / len2));
  return { dist: Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t), y: a[1] + (b[1] - a[1]) * t };
};

const inWall = (shapes: TrackShape[], [x, y, z]: Vec3Tuple) =>
  shapes.some((shape) =>
    shape.barriers.some(({ points, thickness, height }) =>
      points.slice(1).some((b, i) => {
        const a = points[i] ?? b;
        const hit = segmentDistance(x, z, a, b);
        return hit.dist < thickness / 2 + 0.35 && y > hit.y - 0.3 && y < hit.y + height;
      }),
    ),
  );

const entityChecks = (level: Level, { graph, builds }: LevelNav): Issue[] => {
  const shapes = builds.flatMap((b) => (b.body ? [b.shape, b.body] : [b.shape]));
  const issues: Issue[] = [];
  level.entities.forEach((entity, i) => {
    const at = cellToWorld(entity.cell);
    const label = entityLabel(entity, i);
    if (entityNode(graph, entity) === undefined) {
      issues.push({ severity: 'error', message: `${label} n'est posé sur aucune pièce du parcours` });
      return;
    }
    if (inWall(shapes, at)) issues.push({ severity: 'error', message: `${label} est dans un mur ou une rambarde` });
    const above = surfaceHeightsAt(shapes, at[0], at[2]).filter((h) => h > at[1] + 0.2 && h < at[1] + HEADROOM);
    if (above.length) issues.push({ severity: 'error', message: `${label} est sous une autre surface` });
  });
  return issues;
};

const reachability = (level: Level, nav: LevelNav): Issue[] => {
  const { graph } = nav;
  const start = nodeAt(graph, cellToWorld(level.spawn.cell));
  if (start === undefined) return [{ severity: 'error', message: `Le départ n'est posé sur aucune pièce` }];
  const issues: Issue[] = [];
  const fromStart = shortestPaths(graph, start).dist;
  const goal = level.entities.find((e) => e.type === 'goal');
  const goalNode = goal && entityNode(graph, goal);
  level.entities.forEach((entity, i) => {
    const node = entityNode(graph, entity);
    if (node === undefined) return;
    if (!Number.isFinite(fromStart[node])) {
      issues.push({ severity: 'error', message: `${entityLabel(entity, i)} est inaccessible depuis le départ` });
      return;
    }
    if (entity.type === 'crystal' && goalNode !== undefined) {
      if (!Number.isFinite(shortestPaths(graph, node).dist[goalNode]))
        issues.push({ severity: 'error', message: `Après le ${entityLabel(entity, i)}, l'arrivée est inaccessible` });
    }
  });
  return issues;
};

const routeChecks = (level: Level, nav: LevelNav): Issue[] => {
  const route = planRoute(level, nav);
  if (!route) return [];
  const checkpoints = level.entities.filter((e) => e.type === 'checkpoint').length;
  if (route.length > CHECKPOINT_ROUTE_LENGTH && checkpoints === 0) {
    return [
      {
        severity: 'error',
        message: `Parcours de ${Math.round(route.length)} unités sans checkpoint (il en faut un au-delà de ${CHECKPOINT_ROUTE_LENGTH})`,
      },
    ];
  }
  return [];
};

const modifierLabel = (m: Modifier, i: number) => `${MODIFIER_NAMES[m.type]} ${i} en [${m.cell.join(', ')}]`;

/** Bonuses and maluses: on the course, not stacked, pushers out of the way, springs landing somewhere. */
const modifierChecks = (level: Level, { graph, builds }: LevelNav): Issue[] => {
  const issues: Issue[] = [];
  const shapes = builds.flatMap((b) => (b.body ? [b.shape, b.body] : [b.shape]));
  const start = nodeAt(graph, cellToWorld(level.spawn.cell));
  const fromStart = start === undefined ? [] : shortestPaths(graph, start).dist;
  const anchors = new Map<string, number>();
  level.modifiers.forEach((m, i) => {
    const label = modifierLabel(m, i);
    const key = m.cell.join(',');
    const other = anchors.get(key);
    if (other !== undefined && !AIRBORNE.has(m.type))
      issues.push({ severity: 'warning', message: `${label} est sur la même case que le modificateur ${other}` });
    if (!AIRBORNE.has(m.type)) anchors.set(key, i);
    if (AIRBORNE.has(m.type)) return;
    const node = nodeAt(graph, cellToWorld(m.cell));
    const onCourse = surfaceHeightsAt(shapes, ...xz(m.cell)).some((h) => Math.abs(h - cellToWorld(m.cell)[1]) < 1.3);
    if (!onCourse) {
      issues.push({ severity: 'error', message: `${label} n'est posé sur aucune pièce du parcours` });
      return;
    }
    if (MODIFIERS[m.type].kind === 'bonus' && node !== undefined && !Number.isFinite(fromStart[node] ?? Infinity))
      issues.push({ severity: 'warning', message: `${label} est inaccessible depuis le départ` });
    if (m.type === 'pusher') {
      const [fx, fz] = forwardOf(m.rot);
      const [x, y, z] = cellToWorld(m.cell);
      const housing = surfaceHeightsAt(shapes, x - fx * CELL, z - fz * CELL).filter((h) => h > y - 1 && h < y + 1.5);
      if (housing.length)
        issues.push({
          severity: 'error',
          message: `${label} : son logement (la case derrière) est occupé par une pièce`,
        });
    }
    if (m.type === 'spring' && level.entities.some((e) => e.type === 'crystal' && e.cell.join() === key))
      issues.push({ severity: 'warning', message: `${label} : la bille saute par-dessus le cristal de sa case` });
    if (m.type === 'spring' && m.forward > 0) {
      const [lx, ly, lz] = springLanding(m);
      if (!surfaceHeightsAt(shapes, lx, lz).some((h) => h <= ly + 0.6 && h > ly - 4))
        issues.push({
          severity: 'error',
          message: `${label} envoie la bille dans le vide (vers [${lx.toFixed(1)}, ${lz.toFixed(1)}])`,
        });
    }
  });
  return issues;
};

const xz = (cell: readonly [number, number, number]): [number, number] => {
  const [x, , z] = cellToWorld(cell);
  return [x, z];
};

const pieceChecks = (level: Level): Issue[] =>
  level.pieces.flatMap((piece, i): Issue[] => {
    if (piece.type !== 'ramp') return [];
    const angle = rampAngle(piece);
    if (angle > MAX_RAMP_DEG)
      return [{ severity: 'error', message: `La ${describe(level, i)} est trop raide (${angle.toFixed(0)}°)` }];
    if (piece.drop < 0 && angle > MAX_CLIMB_DEG)
      return [
        { severity: 'warning', message: `La montée de la ${describe(level, i)} est raide (${angle.toFixed(0)}°)` },
      ];
    return [];
  });

/**
 * Upper bound of the draw calls of a level in game, as if everything were in view at once: the
 * course materials and moving pieces twice (colour and shadow passes), the entities, the ball,
 * the tutorial signs and the decor. Measured with `?debug`, frustum culling keeps the real count well under it.
 */
export const estimateDrawCalls = (level: Level, builds: PieceBuild[]): number => {
  const materials = new Set<string>();
  builds.forEach(({ shape }) => {
    [...shape.floors, ...shape.triangles].forEach((f) => materials.add(`${f.tag}:top`).add(`${f.tag}:side`));
    shape.barriers.forEach((b) => materials.add(`${b.tag}:top`).add(`${b.tag}:side`));
  });
  const movers = builds.filter((b) => b.body).length;
  const count = (type: Entity['type']) => level.entities.filter((e) => e.type === type).length;
  const DECOR = 13;
  const course = materials.size + movers * 2 + 1;
  const modifiers = level.modifiers.reduce((sum, m) => sum + MODIFIER_DRAW_CALLS[m.type], 0);
  return (
    course * 2 +
    count('crystal') +
    count('checkpoint') * 2 +
    count('goal') +
    count('hiddenGem') * 2 +
    modifiers +
    level.signs.length +
    DECOR
  );
};

/** Every static check of PLAN.md § 4.3. An empty list (or only warnings) means the level is valid. */
export const validateLevel = (level: Level): Issue[] => {
  const nav = buildNav(level);
  const issues = [...pieceChecks(level), ...overlaps(level, nav.builds), ...entityChecks(level, nav)];
  issues.push(...modifierChecks(level, nav));
  issues.push(...reachability(level, nav), ...routeChecks(level, nav));
  const calls = estimateDrawCalls(level, nav.builds);
  if (calls > DRAW_CALL_BUDGET)
    issues.push({
      severity: 'error',
      message: `Environ ${calls} draw calls, au-delà du budget de ${DRAW_CALL_BUDGET}`,
    });
  return issues;
};

export const hasErrors = (issues: readonly Issue[]): boolean => issues.some((i) => i.severity === 'error');
