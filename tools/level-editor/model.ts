import { forwardOf, type Rot } from '../../src/levels/grid';
import {
  entitySchema,
  LEVEL_VERSION,
  levelSchema,
  modifierSchema,
  pieceSchema,
  type Entity,
  type Level,
  type Modifier,
  type ModifierType,
  type Piece,
  type PieceType,
} from '../../src/levels/schema';
import { hasRot, modifierHasRot } from './fields';

export type Selection = { kind: 'piece' | 'entity' | 'modifier'; index: number };
export type Tool =
  | { kind: 'select' }
  | { kind: 'piece'; type: PieceType }
  | { kind: 'entity'; type: Entity['type'] }
  | { kind: 'modifier'; type: ModifierType }
  | { kind: 'spawn' };

export type EditorState = {
  level: Level;
  selection: Selection[];
  tool: Tool;
  /** Rotation given to new pieces. */
  rot: Rot;
  /** Height (in steps) where new pieces and entities go. */
  layer: number;
  past: Level[];
  future: Level[];
  /** Counts the levels opened in this tab, so the views can frame each new one. */
  opened: number;
};

const HISTORY = 200;

export const emptyLevel = (): Level =>
  levelSchema.parse({
    id: 'nouveau',
    version: LEVEL_VERSION,
    name: { fr: 'Nouveau niveau', en: 'New level' },
    world: 1,
    parTimeSec: 60,
    spawn: { cell: [0, 0, 0] },
    pieces: [
      { type: 'platform', cell: [0, 0, 0] },
      { type: 'straight', cell: [0, 0, -2], length: 4 },
      { type: 'platform', cell: [0, 0, -7], surface: 'lav' },
    ],
    entities: [
      { type: 'crystal', cell: [0, 0, -3] },
      { type: 'goal', cell: [0, 0, -7] },
    ],
    decor: {},
  });

export const initialState = (level: Level = emptyLevel(), opened = 0): EditorState => ({
  level,
  opened,
  selection: [],
  tool: { kind: 'select' },
  rot: 0,
  layer: 0,
  past: [],
  future: [],
});

/** Replaces the level and records the previous one for undo. */
export const commit = (state: EditorState, level: Level, selection = state.selection): EditorState => ({
  ...state,
  level,
  selection,
  past: [...state.past, state.level].slice(-HISTORY),
  future: [],
});

export const undo = (state: EditorState): EditorState => {
  const previous = state.past[state.past.length - 1];
  if (!previous) return state;
  return {
    ...state,
    level: previous,
    selection: [],
    past: state.past.slice(0, -1),
    future: [state.level, ...state.future],
  };
};

export const redo = (state: EditorState): EditorState => {
  const [next, ...rest] = state.future;
  if (!next) return state;
  return { ...state, level: next, selection: [], past: [...state.past, state.level], future: rest };
};

/** A new piece of `type` at a cell, every other parameter at its default. */
export const newPiece = (type: PieceType, cell: [number, number, number], rot: Rot): Piece => {
  if (type === 'movingPlatform') {
    const [fx, fz] = forwardOf(rot);
    return pieceSchema.parse({ type, path: [cell, [cell[0] + fx * 3, cell[1], cell[2] + fz * 3]] });
  }
  return pieceSchema.parse(hasRot(type) ? { type, cell, rot } : { type, cell });
};

/** Uses the current tool on a cell: places a piece or an entity, or moves the spawn. */
export const placeAt = (state: EditorState, i: number, k: number): EditorState => {
  const cell: [number, number, number] = [i, state.layer, k];
  const { level, tool } = state;
  if (tool.kind === 'piece') {
    const pieces = [...level.pieces, newPiece(tool.type, cell, state.rot)];
    return commit(state, { ...level, pieces }, [{ kind: 'piece', index: pieces.length - 1 }]);
  }
  if (tool.kind === 'entity') {
    // A level has one goal (and one hidden gem): placing it again moves it.
    const unique = tool.type === 'goal' || tool.type === 'hiddenGem';
    const kept = unique ? level.entities.filter((e) => e.type !== tool.type) : level.entities;
    const entities = [...kept, entitySchema.parse({ type: tool.type, cell })];
    return commit(state, { ...level, entities }, [{ kind: 'entity', index: entities.length - 1 }]);
  }
  if (tool.kind === 'modifier') {
    const modifiers = [...level.modifiers, newModifier(tool.type, cell, state.rot)];
    return commit(state, { ...level, modifiers }, [{ kind: 'modifier', index: modifiers.length - 1 }]);
  }
  if (tool.kind === 'spawn') return commit(state, { ...level, spawn: { cell } }, []);
  return state;
};

/** A new bonus or malus of `type` on a cell, every other parameter at its default. */
export const newModifier = (type: ModifierType, cell: [number, number, number], rot: Rot): Modifier =>
  modifierSchema.parse(modifierHasRot(type) ? { type, cell, rot } : { type, cell });

const shiftCell = (cell: readonly [number, number, number], di: number, dj: number, dk: number) =>
  [cell[0] + di, cell[1] + dj, cell[2] + dk] as [number, number, number];

const selected = (state: EditorState, kind: Selection['kind']) =>
  new Set(state.selection.filter((s) => s.kind === kind).map((s) => s.index));

const shiftPiece = (piece: Piece, di: number, dj: number, dk: number): Piece => {
  if (piece.type === 'movingPlatform') {
    return { ...piece, path: piece.path.map(([x, y, z]) => [x + di, y + dj, z + dk] as [number, number, number]) };
  }
  const [x, y, z] = piece.cell;
  return { ...piece, cell: [x + di, y + dj, z + dk] };
};

/** Moves the selection by whole cells (and height steps). */
export const moveSelection = (state: EditorState, di: number, dj: number, dk: number): EditorState => {
  if (!state.selection.length) return state;
  const pieces = selected(state, 'piece');
  const entities = selected(state, 'entity');
  const modifiers = selected(state, 'modifier');
  const { level } = state;
  return commit(state, {
    ...level,
    pieces: level.pieces.map((p, i) => (pieces.has(i) ? shiftPiece(p, di, dj, dk) : p)),
    entities: level.entities.map((e, i) => (entities.has(i) ? { ...e, cell: shiftCell(e.cell, di, dj, dk) } : e)),
    modifiers: level.modifiers.map((m, i) => (modifiers.has(i) ? { ...m, cell: shiftCell(m.cell, di, dj, dk) } : m)),
  });
};

const turn = (piece: Piece): Piece => {
  if (piece.type === 'movingPlatform') {
    const [ox, , oz] = piece.path[0] ?? [0, 0, 0];
    return {
      ...piece,
      size: [piece.size[1], piece.size[0]],
      path: piece.path.map(([x, y, z]) => [ox - (z - oz), y, oz + (x - ox)] as [number, number, number]),
    };
  }
  if (!('rot' in piece)) return piece;
  return { ...piece, rot: ((piece.rot + 90) % 360) as Rot };
};

const turnModifier = (m: Modifier): Modifier => {
  if ('rot' in m) return { ...m, rot: ((m.rot + 90) % 360) as Rot };
  if ('size' in m) return { ...m, size: [m.size[1], m.size[0]] };
  return m;
};

/** R: turns the selected pieces and modifiers a quarter turn, or the rotation of the next ones placed. */
export const rotate = (state: EditorState): EditorState => {
  const pieces = selected(state, 'piece');
  const modifiers = selected(state, 'modifier');
  if (!pieces.size && !modifiers.size) return { ...state, rot: ((state.rot + 90) % 360) as Rot };
  return commit(state, {
    ...state.level,
    pieces: state.level.pieces.map((p, i) => (pieces.has(i) ? turn(p) : p)),
    modifiers: state.level.modifiers.map((m, i) => (modifiers.has(i) ? turnModifier(m) : m)),
  });
};

export const deleteSelection = (state: EditorState): EditorState => {
  if (!state.selection.length) return state;
  const pieces = selected(state, 'piece');
  const entities = selected(state, 'entity');
  const modifiers = selected(state, 'modifier');
  const { level } = state;
  return commit(
    state,
    {
      ...level,
      pieces: level.pieces.filter((_, i) => !pieces.has(i)),
      entities: level.entities.filter((e, i) => !entities.has(i) || e.type === 'goal'),
      modifiers: level.modifiers.filter((_, i) => !modifiers.has(i)),
    },
    [],
  );
};

/** Copies the selection one cell to the right and selects the copies. */
export const duplicateSelection = (state: EditorState): EditorState => {
  if (!state.selection.length) return state;
  const { level } = state;
  const pieces = level.pieces.filter((_, i) => selected(state, 'piece').has(i)).map((p) => shiftPiece(p, 1, 0, 0));
  const entities = level.entities
    .filter((e, i) => selected(state, 'entity').has(i) && e.type !== 'goal')
    .map((e) => ({ ...e, cell: shiftCell(e.cell, 1, 0, 0) }));
  const modifiers = level.modifiers
    .filter((_, i) => selected(state, 'modifier').has(i))
    .map((m) => ({ ...m, cell: shiftCell(m.cell, 1, 0, 0) }));
  const next = {
    ...level,
    pieces: [...level.pieces, ...pieces],
    entities: [...level.entities, ...entities],
    modifiers: [...level.modifiers, ...modifiers],
  };
  const selection: Selection[] = [
    ...pieces.map((_, n) => ({ kind: 'piece' as const, index: level.pieces.length + n })),
    ...entities.map((_, n) => ({ kind: 'entity' as const, index: level.entities.length + n })),
    ...modifiers.map((_, n) => ({ kind: 'modifier' as const, index: level.modifiers.length + n })),
  ];
  return commit(state, next, selection);
};

/** Applies a parameter change to one piece if the schema accepts it. */
export const updatePiece = (state: EditorState, index: number, patch: Record<string, unknown>): EditorState => {
  const current = state.level.pieces[index];
  const next = current && pieceSchema.safeParse({ ...current, ...patch });
  if (!next?.success) return state;
  return commit(state, { ...state.level, pieces: state.level.pieces.map((p, i) => (i === index ? next.data : p)) });
};

/** Applies a parameter change to one bonus or malus if the schema accepts it. */
export const updateModifier = (state: EditorState, index: number, patch: Record<string, unknown>): EditorState => {
  const current = state.level.modifiers[index];
  const next = current && modifierSchema.safeParse({ ...current, ...patch });
  if (!next?.success) return state;
  return commit(state, {
    ...state.level,
    modifiers: state.level.modifiers.map((m, i) => (i === index ? next.data : m)),
  });
};

/** Applies a change to the level's own fields (id, name, world…) if the schema accepts it. */
export const updateLevel = (state: EditorState, patch: Partial<Level>): EditorState => {
  const next = levelSchema.safeParse({ ...state.level, ...patch });
  return next.success ? commit(state, next.data) : state;
};
