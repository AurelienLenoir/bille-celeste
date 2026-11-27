import { createRandom } from '../engine/math';
import { buildPiece } from '../game/pieces';
import { centreRadius } from '../game/pieces/curve';
import type { FootCell } from '../game/pieces/kit';
import { CELL, forwardOf, rightOf, STEP, type Rot } from './grid';
import { loadLevel } from './loader';
import { LEVEL_VERSION, type Entity, type Level, type LevelInput, type ModifierType, type Width } from './schema';
import { hasErrors, validateLevel } from './validate';

/** Course segments the generator can lay, by name (`focus` can feature them). */
export const SEGMENTS = [
  'straight',
  'turn',
  'slope',
  'steps',
  'pipe',
  'funnel',
  'bridge',
  'jump',
  'ferry',
  'tiles',
  'plank',
  'turntable',
] as const;
export type SegmentName = (typeof SEGMENTS)[number];

export type GenerateOptions = {
  world: number;
  difficulty: number;
  seed: number;
  id?: string;
  /**
   * Mechanics to feature (segments or bonus / malus types): they come up about four times as
   * often, which is how a world introduces what is new in it (PLAN.md § 3.3).
   */
  focus?: readonly string[];
};

type PieceInput = LevelInput['pieces'][number];
type ModifierInput = NonNullable<LevelInput['modifiers']>[number];
type Cell = [number, number, number];
/** Where the next piece starts: its entry cell, facing `rot` (never 180: the course never comes back towards the camera). */
type Turtle = { cell: Cell; rot: Rot };
type Segment = {
  pieces: PieceInput[];
  next: Turtle;
  crystals?: Cell[];
  checkpoint?: Cell;
  /** Course length added, in cells. */
  cells: number;
  /** Extra cells to keep free (the empty lane of a moving platform, a pusher's housing). */
  lane?: FootCell[];
  modifiers?: ModifierInput[];
};

/** Bonuses and maluses the generator uses, by the world that introduces them (PLAN.md § 3.3). */
export const GENERATED_MODIFIERS: Record<number, { bonus: ModifierType[]; malus: ModifierType[] }> = {
  1: { bonus: ['hourglass', 'shield'], malus: [] },
  2: { bonus: ['speedPad', 'spring'], malus: ['sand'] },
  3: { bonus: ['slowMo', 'feather'], malus: ['ice', 'wind'] },
  4: { bonus: ['magnet'], malus: ['conveyor', 'pusher', 'invert', 'heavy', 'fog'] },
};

/** Everything introduced up to `world`. */
const modifiersUpTo = (world: number, kind: 'bonus' | 'malus'): ModifierType[] =>
  [1, 2, 3, 4].filter((w) => w <= world).flatMap((w) => GENERATED_MODIFIERS[w]?.[kind] ?? []);

/** Smallest zone (centre cell and size) covering some cells. */
const zoneOver = (cells: Cell[]): { cell: Cell; size: [number, number] } => {
  const is = cells.map((c) => c[0]);
  const ks = cells.map((c) => c[2]);
  const [i0, i1, k0, k1] = [Math.min(...is), Math.max(...is), Math.min(...ks), Math.max(...ks)];
  const size: [number, number] = [i1 - i0 + 1, k1 - k0 + 1];
  return { cell: [i0 + Math.floor((size[0] - 1) / 2), cells[0]?.[1] ?? 0, k0 + Math.floor((size[1] - 1) / 2)], size };
};

const MAX_ATTEMPTS = 40;
const TRIES_PER_SEGMENT = 12;
/** Cells kept free around a moving platform's path so nothing gets in its way. */
const HEADROOM = 2;

const step = (cell: Cell, rot: number, n: number, side = 0): Cell => {
  const [fx, fz] = forwardOf(rot);
  const [rx, rz] = rightOf(rot);
  return [cell[0] + fx * n + rx * side, cell[1], cell[2] + fz * n + rz * side];
};

/** Turtle state after a linear piece, read from its exit port (always its last port). */
const exitOf = (piece: PieceInput): Turtle => {
  const ports = buildPiece(loadPiece(piece)).nav.ports;
  const exit = ports[ports.length - 1];
  if (!exit) throw new Error(`${piece.type} has no exit`);
  const [x, z] = exit.key.split(',').map(Number) as [number, number];
  const [dx, dz] = exit.dir;
  const rot = (dx === 1 ? 90 : dx === -1 ? 270 : dz === 1 ? 180 : 0) as Rot;
  return { cell: [Math.round((x + dx) / CELL), Math.round(exit.y / STEP), Math.round((z + dz) / CELL)], rot };
};

/** Fills a piece's defaults through the schema, using a throwaway level around it. */
const loadPiece = (piece: PieceInput) =>
  loadLevel({
    id: 'piece',
    version: LEVEL_VERSION,
    name: { fr: 'x', en: 'x' },
    world: 1,
    parTimeSec: 1,
    spawn: { cell: [0, 0, 0] },
    pieces: [piece],
    entities: [
      { type: 'crystal', cell: [0, 0, 0] },
      { type: 'goal', cell: [0, 0, 0] },
    ],
    decor: {},
  }).pieces[0] as ReturnType<typeof loadLevel>['pieces'][number];

const footprintOf = (piece: PieceInput): FootCell[] => buildPiece(loadPiece(piece)).footprint;

const pick = <T>(rnd: () => number, items: readonly T[]): T => items[Math.floor(rnd() * items.length)] as T;
const between = (rnd: () => number, min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

/**
 * Procedural level draft (PLAN.md § 4.2): a constrained random walk on the grid, dressed with
 * pieces chosen from the world's mechanics and the difficulty, with crystals along the way (some
 * on short side branches), a checkpoint about every quarter, and the goal at the end.
 * The result always passes the validator; it is a draft to retouch in the editor.
 */
export const generateLevel = ({ world, difficulty, seed, id, focus = [] }: GenerateOptions): Level => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const level = tryGenerate(
      world,
      Math.min(1, Math.max(0, difficulty)),
      seed + attempt * 7919,
      id ?? `gen-w${world}-${seed}`,
      new Set(focus),
    );
    if (level && !hasErrors(validateLevel(level))) return level;
  }
  throw new Error(`Impossible de générer un niveau valide (monde ${world}, graine ${seed})`);
};

const tryGenerate = (
  world: number,
  difficulty: number,
  seed: number,
  id: string,
  focus: ReadonlySet<string>,
): Level | undefined => {
  const rnd = createRandom(seed);
  const occupied = new Map<string, [number, number][]>();
  const pieces: PieceInput[] = [];
  const modifiers: ModifierInput[] = [];
  const entities: Entity[] = [];
  const crystalSpots: Cell[] = [];

  const free = (cells: FootCell[]) =>
    cells.every(({ i, k, yMin, yMax }) =>
      (occupied.get(`${i},${k}`) ?? []).every(([a, b]) => yMin - b >= 3 || a - yMax >= 3),
    );
  const claim = (cells: FootCell[]) =>
    cells.forEach(({ i, k, yMin, yMax }) => {
      const key = `${i},${k}`;
      occupied.set(key, [...(occupied.get(key) ?? []), [yMin, yMax]]);
    });
  const fits = (list: PieceInput[], extra: FootCell[] = []) => {
    const cells = [...list.flatMap(footprintOf), ...extra];
    return free(cells) ? cells : undefined;
  };

  const widthFor = (): Width => {
    const r = rnd() * 0.6 + difficulty * 0.7;
    return r < 0.35 ? 'wide' : r < 0.85 ? 'normal' : r < 1.15 ? 'narrow' : 'rail';
  };
  const railsFor = () => (rnd() > 0.35 + difficulty * 0.6 ? 'both' : 'none');

  const platformAt = (
    t: Turtle,
    surface: 'mint' | 'rose' | 'lav',
  ): { piece: PieceInput; centre: Cell; next: Turtle } => {
    const centre = step(t.cell, t.rot, 1);
    return {
      piece: { type: 'platform', cell: centre, size: [3, 3], surface },
      centre,
      next: { cell: step(centre, t.rot, 2), rot: t.rot },
    };
  };

  // Segment builders. Each returns the pieces it adds and where the course continues.
  const straight = (t: Turtle): Segment => {
    const length = between(rnd, 2, 5);
    const piece: PieceInput & { type: 'straight' } = {
      type: 'straight',
      cell: t.cell,
      rot: t.rot,
      length,
      width: widthFor(),
      rails: railsFor(),
    };
    const segment: Segment = {
      pieces: [piece],
      next: exitOf(piece),
      crystals: [step(t.cell, t.rot, Math.floor(length / 2))],
      cells: length,
    };
    return decorate(t, piece, length, segment);
  };

  // Bonuses and maluses: dropped on straights, a few per level, more maluses with difficulty.
  const bonuses = modifiersUpTo(world, 'bonus');
  const maluses = modifiersUpTo(world, 'malus');
  const featured = (list: ModifierType[]) => list.filter((type) => focus.has(type));
  /** Featured types win three times out of four. */
  const pickType = (list: ModifierType[]): ModifierType => {
    const star = featured(list);
    return pick(rnd, star.length && rnd() < 0.75 ? star : list);
  };
  let malusLeft = maluses.length ? Math.round(1 + difficulty * 4 + (world - 2)) + featured(maluses).length : 0;
  let bonusLeft = 1 + Math.round(rnd() * 2) + featured(bonuses).length;
  const malusChance = featured(maluses).length ? 0.6 : 0.45;
  const bonusChance = featured(bonuses).length ? 0.5 : 0.7;
  const decorate = (t: Turtle, piece: PieceInput & { type: 'straight' }, length: number, segment: Segment): Segment => {
    const cells: Cell[] = Array.from({ length }, (_, n) => step(t.cell, t.rot, n));
    const first = cells[0] ?? t.cell;
    const middle = cells[Math.floor(cells.length / 2)] ?? first;
    const side = ((t.rot + (rnd() < 0.5 ? 90 : 270)) % 360) as Rot;
    const r = rnd();
    if (malusLeft > 0 && length >= 3 && r < malusChance) {
      const type = pickType(maluses);
      malusLeft--;
      const zone = zoneOver(cells);
      const add = (m: ModifierInput, change: Partial<typeof piece> = {}, lane?: FootCell[]): Segment => {
        Object.assign(piece, change);
        return { ...segment, next: exitOf(piece), modifiers: [m], ...(lane ? { lane } : {}) };
      };
      if (type === 'ice' || type === 'sand' || type === 'invert' || type === 'fog')
        return add({ type, ...zone }, { width: piece.width === 'rail' ? 'narrow' : piece.width });
      if (type === 'wind')
        return add(
          { type, ...zone, rot: side, strength: 2 + difficulty * 3, gusts: difficulty > 0.5 ? 3 : 0 },
          { rails: 'both', width: 'wide' },
        );
      if (type === 'conveyor')
        return add(
          { type, ...zone, rot: rnd() < 0.5 ? t.rot : side, speed: 2.5 + difficulty * 2 },
          { rails: 'both', width: 'wide' },
        );
      if (type === 'pusher') {
        const [hx, hy, hz] = step(middle, side, -1);
        return add({ type, cell: middle, rot: side, period: 3.5 - difficulty }, { rails: 'none', width: 'normal' }, [
          { i: hx, k: hz, yMin: hy * STEP, yMax: hy * STEP + 1 },
        ]);
      }
      if (type === 'heavy') return add({ type, cell: cells.at(-1) ?? middle });
    }
    if (bonusLeft > 0 && r > bonusChance) {
      const type = pickType(bonuses);
      bonusLeft--;
      if (type === 'speedPad') return { ...segment, modifiers: [{ type, cell: first, rot: t.rot, speed: 8 }] };
      // The ball flies over its own cell and the next one: the crystal goes at the far end.
      if (type === 'spring' && length >= 4)
        return { ...segment, crystals: [cells.at(-1) ?? middle], modifiers: [{ type, cell: first, height: 1.5 }] };
      if (type === 'spring') return segment;
      return { ...segment, modifiers: [{ type, cell: first } as ModifierInput] };
    }
    return segment;
  };
  const turn = (t: Turtle): Segment => {
    const dirs = t.rot === 0 ? ['left', 'right'] : t.rot === 90 ? ['left'] : ['right'];
    const radius = between(rnd, 1, 3);
    const piece: PieceInput = {
      type: 'curve',
      cell: t.cell,
      rot: t.rot,
      radius,
      dir: pick(rnd, dirs) as 'left' | 'right',
      width: difficulty < 0.4 ? 'wide' : 'normal',
      rails: radius > 1 ? railsFor() : 'none',
    };
    return { pieces: [piece], next: exitOf(piece), cells: Math.ceil(centreRadius(radius)) };
  };
  const slope = (t: Turtle): Segment => {
    const length = between(rnd, 2, 4);
    const piece: PieceInput = {
      type: 'ramp',
      cell: t.cell,
      rot: t.rot,
      length,
      drop: between(rnd, 2, length + 1),
      width: widthFor() === 'rail' ? 'narrow' : 'normal',
      rails: railsFor(),
    };
    return { pieces: [piece], next: exitOf(piece), cells: length };
  };
  const steps = (t: Turtle): Segment => {
    const piece: PieceInput = { type: 'stairs', cell: t.cell, rot: t.rot, steps: between(rnd, 2, 3) };
    return { pieces: [piece], next: exitOf(piece), cells: 3 };
  };
  const bridge = (t: Turtle): Segment => {
    const length = between(rnd, 2, 4);
    const piece: PieceInput = {
      type: 'bridge',
      cell: t.cell,
      rot: t.rot,
      length,
      width: difficulty > 0.85 ? 'rail' : 'narrow',
    };
    return {
      pieces: [piece],
      next: exitOf(piece),
      crystals: [step(t.cell, t.rot, Math.floor(length / 2))],
      cells: length,
    };
  };
  const pipe = (t: Turtle): Segment => {
    const length = between(rnd, 3, 5);
    const piece: PieceInput = { type: 'halfPipe', cell: t.cell, rot: t.rot, length };
    return { pieces: [piece], next: exitOf(piece), crystals: [step(t.cell, t.rot, 1)], cells: length };
  };
  const jump = (t: Turtle): Segment => {
    const runUp: PieceInput = { type: 'straight', cell: t.cell, rot: t.rot, length: 4, width: 'normal', rails: 'both' };
    const after = exitOf(runUp);
    const kicker: PieceInput = { type: 'gap', cell: after.cell, rot: t.rot, length: difficulty > 0.7 ? 2 : 1 };
    const land = platformAt(exitOf(kicker), 'rose');
    return { pieces: [runUp, kicker, land.piece], next: land.next, checkpoint: land.centre, cells: 10 };
  };
  const funnel = (t: Turtle): Segment => {
    const rest = platformAt(t, 'mint');
    const mouth: PieceInput = { type: 'funnel', cell: rest.next.cell, rot: t.rot, diameter: 3 };
    return { pieces: [rest.piece, mouth], next: exitOf(mouth), crystals: [rest.centre], cells: 5 };
  };
  const ferry = (t: Turtle): Segment | undefined => {
    const dock = platformAt(t, 'rose');
    const span = between(rnd, 3, 4);
    const [fx] = forwardOf(t.rot);
    // Platform 3 wide × 4 long, docked against the dock's front edge, crossing `span` empty cells.
    const start = step(dock.centre, t.rot, 1.5 + 1);
    const end = step(start, t.rot, span);
    const far = platformAt({ cell: step(end, t.rot, 1.5), rot: t.rot }, 'mint');
    const travel: PieceInput = {
      type: 'movingPlatform',
      path: [start, end],
      size: fx !== 0 ? [2, 1.5] : [1.5, 2],
      speed: 1.6 + difficulty * 1.6,
      pause: 1.2 - difficulty * 0.5,
    };
    const lane: FootCell[] = [];
    for (let n = 0; n <= span + 1; n++) {
      const [i, j, k] = step(dock.centre, t.rot, 2 + n);
      lane.push({ i, k, yMin: j * STEP, yMax: j * STEP + HEADROOM });
    }
    return { pieces: [dock.piece, travel, far.piece], next: far.next, checkpoint: far.centre, cells: 8 + span, lane };
  };
  const tiles = (t: Turtle): Segment => {
    const count = between(rnd, 2, 3);
    const list: PieceInput[] = Array.from({ length: count }, (_, n) => ({
      type: 'fallingTile',
      cell: step(t.cell, t.rot, n),
      delay: 0.9 - difficulty * 0.4,
    }));
    return { pieces: list, next: { cell: step(t.cell, t.rot, count), rot: t.rot }, cells: count };
  };
  const plank = (t: Turtle): Segment => {
    const piece: PieceInput = { type: 'seesaw', cell: t.cell, rot: t.rot, length: 3 };
    return { pieces: [piece], next: exitOf(piece), crystals: [step(t.cell, t.rot, 1)], cells: 3 };
  };
  const turntable = (t: Turtle): Segment => {
    const centre = step(t.cell, t.rot, 1);
    const piece: PieceInput = {
      type: 'rotatingPlatform',
      cell: centre,
      diameter: 3,
      speed: (rnd() > 0.5 ? 1 : -1) * (15 + difficulty * 25),
    };
    return { pieces: [piece], next: { cell: step(centre, t.rot, 2), rot: t.rot }, crystals: [centre], cells: 3 };
  };

  type Builder = (t: Turtle) => Segment | undefined;
  const builders: Record<SegmentName, Builder> = {
    straight,
    turn,
    slope,
    steps,
    pipe,
    funnel,
    bridge,
    jump,
    ferry,
    tiles,
    plank,
    turntable,
  };
  const weights: Partial<Record<SegmentName, number>> = {
    straight: 4,
    turn: 3,
    slope: 2,
    steps: 1,
    pipe: 1,
    funnel: 0.7,
    bridge: 0.5 + difficulty * 2,
  };
  if (world >= 2) Object.assign(weights, { jump: 1 + difficulty, ferry: 1.2 });
  else if (difficulty > 0.5) weights.jump = 0.6;
  if (world >= 3) weights.tiles = 1.5;
  if (world >= 4) Object.assign(weights, { plank: 1.2, turntable: 1.2 });
  const menu: [Builder, number][] = SEGMENTS.flatMap((name): [Builder, number][] => {
    const weight = weights[name] ?? (focus.has(name) ? 1 : 0);
    return weight ? [[builders[name], focus.has(name) ? weight * 4 : weight]] : [];
  });
  const total = menu.reduce((s, [, w]) => s + w, 0);
  const choose = (): Builder => {
    let r = rnd() * total;
    for (const [builder, weight] of menu) {
      r -= weight;
      if (r <= 0) return builder;
    }
    return straight;
  };

  // Start platform.
  const start: Turtle = { cell: [0, 0, 1], rot: 0 };
  const first = platformAt(start, 'mint');
  pieces.push(first.piece);
  claim(footprintOf(first.piece));
  let turtle = first.next;
  const target = Math.round(30 + difficulty * 35 + world * 4);
  let length = 0;
  const checkpointsAt = [0.3, 0.6, 0.85].map((f) => f * target);
  let lastWasLinear = false;
  let gemPlaced = false;

  const addSegment = (segment: Segment) => {
    const cells = fits(segment.pieces, segment.lane);
    if (!cells) return false;
    claim(cells);
    pieces.push(...segment.pieces);
    modifiers.push(...(segment.modifiers ?? []));
    crystalSpots.push(...(segment.crystals ?? []));
    if (segment.checkpoint) entities.push({ type: 'checkpoint', cell: segment.checkpoint });
    turtle = segment.next;
    length += segment.cells;
    return true;
  };

  while (length < target) {
    if (checkpointsAt.length && length >= (checkpointsAt[0] ?? Infinity)) {
      checkpointsAt.shift();
      const rest = platformAt(turtle, 'lav');
      // The first side branch that fits holds the hidden gem; later ones hold optional crystals.
      const branch = !gemPlaced || rnd() < 0.5 + difficulty * 0.3;
      const side = rnd() < 0.5 ? -1 : 1;
      const spur: PieceInput = {
        type: 'straight',
        cell: step(rest.centre, rest.next.rot, 0, side * 2),
        rot: ((turtle.rot + (side > 0 ? 90 : 270)) % 360) as Rot,
        length: 2,
        width: 'normal',
      };
      if (addSegment({ pieces: [rest.piece], next: rest.next, checkpoint: rest.centre, cells: 3 })) {
        if (branch && addSegment({ pieces: [spur], next: turtle, cells: 0 })) {
          entities.push({
            type: gemPlaced ? 'crystal' : 'hiddenGem',
            cell: step(rest.centre, turtle.rot, 0, side * 3),
          });
          gemPlaced = true;
        }
        lastWasLinear = false;
        continue;
      }
      return undefined;
    }
    let placed = false;
    for (let i = 0; i < TRIES_PER_SEGMENT && !placed; i++) {
      const builder = choose();
      // Two curves in a row tend to box the walk in: alternate with something straight.
      if (builder === turn && !lastWasLinear) continue;
      const segment = builder(turtle);
      if (segment && addSegment(segment)) {
        placed = true;
        lastWasLinear = builder !== turn;
      }
    }
    if (!placed) return undefined;
  }

  const finish = platformAt(turtle, 'lav');
  const endWall: PieceInput = {
    type: 'wall',
    cell: step(finish.centre, turtle.rot, 1, -1),
    rot: turtle.rot,
    length: 3,
  };
  if (!addSegment({ pieces: [finish.piece, endWall], next: finish.next, cells: 3 })) return undefined;
  entities.push({ type: 'goal', cell: finish.centre });

  const wanted = 4 + Math.round(difficulty * 4);
  const spacing = Math.max(1, Math.floor(crystalSpots.length / wanted));
  crystalSpots
    .filter((_, i) => i % spacing === 0)
    .slice(0, wanted)
    .forEach((cell) => entities.push({ type: 'crystal', cell }));
  if (!entities.some((e) => e.type === 'crystal')) entities.push({ type: 'crystal', cell: finish.centre });

  return loadLevel({
    id,
    version: LEVEL_VERSION,
    name: { fr: `Brouillon ${id}`, en: `Draft ${id}` },
    world,
    parTimeSec: Math.round(20 + length * 0.9),
    spawn: { cell: [0, 0, 0] },
    pieces,
    entities: [...entities.filter((e) => e.type !== 'goal'), ...entities.filter((e) => e.type === 'goal')],
    modifiers,
    decor: {
      theme: (['garden', 'sunset', 'glacier', 'factory'] as const)[world - 1] ?? 'garden',
      seed: seed % 2_000_000_000 || 1,
    },
  });
};
