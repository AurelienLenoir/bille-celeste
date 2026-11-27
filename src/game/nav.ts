import type { Vec3Tuple } from '../engine/math';
import { cellToWorld, STEP, worldToCell } from '../levels/grid';
import type { Entity, Level } from '../levels/schema';
import { modifierModule } from './modifiers';
import { buildPiece } from './pieces';
import type { NavBlock, NavKind, NavPort, PieceBuild } from './pieces/kit';

/** Ports this close in height join both ways. */
const LEVEL_TOLERANCE = 0.15;
/** A ball may roll off an edge onto a piece at most this much lower. */
export const MAX_DROP = 4;
/** Extra cost of stepping into a cell a moving obstacle sweeps: routes go around when they can. */
export const HAZARD_COST = 8;

export type NavEdge = { to: number; kind: NavKind; cost: number };
export type NavNode = { at: Vec3Tuple; piece: number };
export type NavGraph = { nodes: NavNode[]; edges: NavEdge[][] };
export type LevelNav = { graph: NavGraph; builds: PieceBuild[] };

const distance = (a: Vec3Tuple, b: Vec3Tuple) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const isBlocked = (blocks: readonly NavBlock[], key: string, ya: number, yb: number) =>
  blocks.some((b) => b.key === key && b.yMin <= Math.max(ya, yb) + 0.1 && b.yMax >= Math.min(ya, yb));

/**
 * Walkability graph of a level: the nodes of every piece, their own links, and links between
 * pieces whose ports meet on the same cell edge (both ways when level, one way down a drop).
 */
export const buildNav = (level: Level): LevelNav => {
  const builds = level.pieces.map(buildPiece);
  const nodes: NavNode[] = [];
  const edges: NavEdge[][] = [];
  const ports: (NavPort & { global: number })[] = [];
  const blocks = builds.flatMap((b) => b.nav.blocks);

  const link = (from: number, to: number, kind: NavKind) => {
    const a = nodes[from];
    const b = nodes[to];
    if (!a || !b) return;
    edges[from]?.push({ to, kind, cost: distance(a.at, b.at) + (kind === 'ride' ? 8 : 0) });
  };

  builds.forEach(({ nav }, piece) => {
    const base = nodes.length;
    nav.nodes.forEach((at) => {
      nodes.push({ at, piece });
      edges.push([]);
    });
    for (const l of nav.links) {
      const kind = l.kind ?? 'roll';
      link(base + l.from, base + l.to, kind);
      if (!l.oneWay) link(base + l.to, base + l.from, kind);
    }
    nav.ports.forEach((p) => ports.push({ ...p, global: base + p.node }));
  });

  const byKey = new Map<string, typeof ports>();
  ports.forEach((p) => byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]));
  for (const [key, group] of byKey) {
    for (const a of group) {
      for (const b of group) {
        if (a === b || nodes[a.global]?.piece === nodes[b.global]?.piece) continue;
        if (a.dir[0] !== -b.dir[0] || a.dir[1] !== -b.dir[1]) continue;
        if (isBlocked(blocks, key, a.y, b.y)) continue;
        const tolerance = Math.max(LEVEL_TOLERANCE, a.tolerance ?? 0, b.tolerance ?? 0);
        const drop = a.y - b.y;
        if (Math.abs(drop) <= tolerance) link(a.global, b.global, 'roll');
        else if (drop > 0 && drop <= MAX_DROP) link(a.global, b.global, 'drop');
      }
    }
  }
  avoidObstacles(level, nodes, edges);
  return { graph: { nodes, edges }, builds };
};

/** Cells (with their floor height) listed by the level's modifiers. */
const obstacleCells = (level: Level, kind: 'solidCells' | 'hazardCells') =>
  level.modifiers.flatMap((m) => (modifierModule(m)[kind]?.(m) ?? []).map(([i, k]) => ({ i, k, y: m.cell[1] * STEP })));

/** Nobody rolls through a solid obstacle; cells a moving one sweeps cost more. */
const avoidObstacles = (level: Level, nodes: NavNode[], edges: NavEdge[][]) => {
  if (!level.modifiers.length) return;
  const inCells = (cells: { i: number; k: number; y: number }[]) => (node: NavNode | undefined) => {
    if (!node) return false;
    const [i, k] = worldToCell(node.at[0], node.at[2]);
    return cells.some((c) => c.i === i && c.k === k && Math.abs(c.y - node.at[1]) < 1.5);
  };
  const solid = inCells(obstacleCells(level, 'solidCells'));
  const hazard = inCells(obstacleCells(level, 'hazardCells'));
  edges.forEach((list, from) => {
    const kept = solid(nodes[from])
      ? []
      : list
          .filter((e) => !solid(nodes[e.to]))
          .map((e) => (hazard(nodes[e.to]) ? { ...e, cost: e.cost + HAZARD_COST } : e));
    edges[from] = kept;
  });
};

/** Nav node standing for an entity: the closest one on the same floor, if any is close enough. */
export const nodeAt = (graph: NavGraph, [x, y, z]: Vec3Tuple): number | undefined => {
  let best: number | undefined;
  let bestDist = Infinity;
  graph.nodes.forEach(({ at }, i) => {
    const flat = Math.hypot(at[0] - x, at[2] - z);
    if (flat > 1.6 || Math.abs(at[1] - y) > 1.3) return;
    if (flat < bestDist) {
      best = i;
      bestDist = flat;
    }
  });
  return best;
};

export const entityNode = (graph: NavGraph, entity: Pick<Entity, 'cell'>): number | undefined =>
  nodeAt(graph, cellToWorld(entity.cell));

/** Shortest paths from `from` (Dijkstra). Returns distances and predecessors. */
export const shortestPaths = (graph: NavGraph, from: number) => {
  const dist = graph.nodes.map(() => Infinity);
  const prev: (number | undefined)[] = graph.nodes.map(() => undefined);
  const done = new Set<number>();
  dist[from] = 0;
  for (;;) {
    let u = -1;
    let best = Infinity;
    dist.forEach((d, i) => {
      if (!done.has(i) && d < best) {
        best = d;
        u = i;
      }
    });
    if (u < 0) break;
    done.add(u);
    for (const { to, cost } of graph.edges[u] ?? []) {
      const d = best + cost;
      if (d < (dist[to] ?? Infinity)) {
        dist[to] = d;
        prev[to] = u;
      }
    }
  }
  return { dist, prev };
};

export const pathTo = (prev: readonly (number | undefined)[], to: number): number[] => {
  const path = [to];
  for (let at = prev[to]; at !== undefined; at = prev[at]) path.unshift(at);
  return path;
};

export type RouteStep = { node: number; at: Vec3Tuple; piece: number; via: NavKind };
export type Route = { steps: RouteStep[]; length: number };

/**
 * A full run: spawn → every crystal (nearest first) → goal, as a list of nav nodes. Returns
 * undefined when some target cannot be reached.
 */
export const planRoute = (level: Level, { graph }: LevelNav): Route | undefined => {
  const start = nodeAt(graph, cellToWorld(level.spawn.cell));
  const goalEntity = level.entities.find((e) => e.type === 'goal');
  const goal = goalEntity && entityNode(graph, goalEntity);
  if (start === undefined || goal === undefined) return undefined;
  const crystals = level.entities.filter((e) => e.type === 'crystal').map((e) => entityNode(graph, e));
  if (crystals.some((c) => c === undefined)) return undefined;
  const pending = new Set(crystals as number[]);

  const nodes = [start];
  let at = start;
  let length = 0;
  const go = (prev: readonly (number | undefined)[], to: number, d: number) => {
    nodes.push(...pathTo(prev, to).slice(1));
    length += d;
    at = to;
  };
  while (pending.size) {
    const { dist, prev } = shortestPaths(graph, at);
    let next: number | undefined;
    for (const c of pending) if (next === undefined || (dist[c] ?? Infinity) < (dist[next] ?? Infinity)) next = c;
    if (next === undefined || !Number.isFinite(dist[next])) return undefined;
    go(prev, next, dist[next] ?? 0);
    pending.delete(next);
    // A crystal standing on the path to another one is picked up on the way.
    nodes.forEach((n) => pending.delete(n));
  }
  const { dist, prev } = shortestPaths(graph, at);
  if (!Number.isFinite(dist[goal])) return undefined;
  go(prev, goal, dist[goal] ?? 0);

  const steps = nodes.map((node, i): RouteStep => {
    const before = nodes[i - 1];
    const via = before === undefined ? 'roll' : (graph.edges[before]?.find((e) => e.to === node)?.kind ?? 'roll');
    const n = graph.nodes[node] ?? { at: [0, 0, 0] as const, piece: -1 };
    return { node, at: n.at, piece: n.piece, via };
  });
  return { steps, length };
};
