import type { Vec3Tuple } from '../engine/math';
import { floorHeight, type TrackShape } from '../engine/trackCollider';
import { buildNav, entityNode, nodeAt, planRoute, shortestPaths, type LevelNav } from '../game/nav';
import type { PieceBuild } from '../game/pieces/kit';
import { rampAngle } from '../game/pieces/ramp';
import { cellToWorld } from './grid';
import type { Entity, Level } from './schema';

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

const insideTriangle = (x: number, z: number, [a, b, c]: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple]) => {
  const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
  return u >= 0 && v >= 0 && u + v <= 1 ? a[1] * u + b[1] * v + c[1] * (1 - u - v) : undefined;
};

/** Heights of every surface (static or moving at rest) right above or below (x, z). */
const surfacesAt = (shapes: TrackShape[], x: number, z: number): number[] =>
  shapes.flatMap((shape) => [
    ...shape.floors
      .filter((f) => x > f.minX && x < f.maxX && z > f.minZ && z < f.maxZ)
      .map((f) => floorHeight(f, x, z)),
    ...shape.triangles.flatMap((t) => insideTriangle(x, z, t.points) ?? []),
  ]);

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
    const above = surfacesAt(shapes, at[0], at[2]).filter((h) => h > at[1] + 0.2 && h < at[1] + HEADROOM);
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
 * course materials and moving pieces twice (colour and shadow passes), the entities, the ball and
 * the decor. Measured with `?debug`, frustum culling keeps the real count well under it.
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
  return course * 2 + count('crystal') + count('checkpoint') * 2 + count('goal') + DECOR;
};

/** Every static check of PLAN.md § 4.3. An empty list (or only warnings) means the level is valid. */
export const validateLevel = (level: Level): Issue[] => {
  const nav = buildNav(level);
  const issues = [...pieceChecks(level), ...overlaps(level, nav.builds), ...entityChecks(level, nav)];
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
