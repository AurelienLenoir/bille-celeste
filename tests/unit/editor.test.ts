import { describe, expect, it } from 'vitest';
import { fitView, hitTest, toScreen } from '../../tools/level-editor/draw';
import { hasRot, modifierFields, PIECE_TYPES, pieceFields } from '../../tools/level-editor/fields';
import {
  deleteSelection,
  duplicateSelection,
  emptyLevel,
  initialState,
  moveSelection,
  placeAt,
  redo,
  rotate,
  undo,
  updateLevel,
  updateModifier,
  updatePiece,
  type EditorState,
} from '../../tools/level-editor/model';
import { parseLevel } from '../../src/levels/loader';
import { validateLevel } from '../../src/levels/validate';

const withTool = (state: EditorState, tool: EditorState['tool']): EditorState => ({ ...state, tool });

describe('editor fields', () => {
  it('lists every piece type of the schema', () => {
    expect(PIECE_TYPES).toHaveLength(14);
    expect(PIECE_TYPES).toContain('seesaw');
  });

  it('reads ranges, steps and choices from the schema', () => {
    const fields = pieceFields('ramp');
    expect(fields.find((f) => f.key === 'drop')).toEqual({ key: 'drop', kind: 'number', min: -8, max: 16, step: 1 });
    expect(fields.find((f) => f.key === 'width')).toMatchObject({
      kind: 'choice',
      options: ['wide', 'normal', 'narrow', 'rail'],
    });
    expect(pieceFields('platform').find((f) => f.key === 'size')).toMatchObject({ kind: 'pair', min: 1, max: 12 });
    expect(pieceFields('curve').find((f) => f.key === 'angle')).toMatchObject({ kind: 'choice', options: [90, 180] });
    expect(pieceFields('movingPlatform').find((f) => f.key === 'size')).toMatchObject({ kind: 'pair', step: 0.5 });
  });

  it('leaves position and rotation to the editor', () => {
    for (const type of PIECE_TYPES) expect(pieceFields(type).map((f) => f.key)).not.toContain('cell');
    expect(hasRot('straight')).toBe(true);
    expect(hasRot('fallingTile')).toBe(false);
  });
});

describe('editor model', () => {
  it('starts on a valid level', () => {
    const parsed = parseLevel(emptyLevel());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(validateLevel(parsed.level).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('places pieces on the current layer with the current rotation, and selects them', () => {
    const state = { ...withTool(initialState(), { kind: 'piece', type: 'straight' }), layer: 2, rot: 90 as const };
    const next = placeAt(state, 3, -4);
    expect(next.level.pieces.at(-1)).toMatchObject({ type: 'straight', cell: [3, 2, -4], rot: 90 });
    expect(next.selection).toEqual([{ kind: 'piece', index: next.level.pieces.length - 1 }]);
  });

  it('keeps a single goal: placing it again moves it', () => {
    const next = placeAt(withTool(initialState(), { kind: 'entity', type: 'goal' }), 0, -5);
    const goals = next.level.entities.filter((e) => e.type === 'goal');
    expect(goals).toEqual([{ type: 'goal', cell: [0, 0, -5] }]);
  });

  it('moves the spawn', () => {
    expect(placeAt(withTool(initialState(), { kind: 'spawn' }), 0, -1).level.spawn.cell).toEqual([0, 0, -1]);
  });

  it('moves, turns, duplicates and deletes the selection, with undo and redo', () => {
    let state: EditorState = { ...initialState(), selection: [{ kind: 'piece', index: 1 }] };
    state = moveSelection(state, 1, 2, -1);
    expect(state.level.pieces[1]).toMatchObject({ cell: [1, 2, -3] });
    state = rotate(state);
    expect(state.level.pieces[1]).toMatchObject({ rot: 90 });
    state = duplicateSelection(state);
    expect(state.level.pieces).toHaveLength(4);
    expect(state.level.pieces[3]).toMatchObject({ cell: [2, 2, -3], rot: 90 });
    state = deleteSelection(state);
    expect(state.level.pieces).toHaveLength(3);
    state = undo(undo(undo(state)));
    expect(state.level.pieces[1]).toMatchObject({ rot: 0 });
    state = redo(state);
    expect(state.level.pieces[1]).toMatchObject({ rot: 90 });
  });

  it('turns the rotation of new pieces when nothing is selected', () => {
    expect(rotate(initialState()).rot).toBe(90);
  });

  it('never deletes the goal', () => {
    const state = { ...initialState(), selection: [{ kind: 'entity' as const, index: 1 }] };
    expect(deleteSelection(state).level.entities.some((e) => e.type === 'goal')).toBe(true);
  });

  it('turns a moving platform path around its first stop', () => {
    const state = placeAt(withTool(initialState(), { kind: 'piece', type: 'movingPlatform' }), 2, 0);
    const turned = rotate({ ...state, tool: { kind: 'select' } });
    expect(turned.level.pieces.at(-1)).toMatchObject({
      path: [
        [2, 0, 0],
        [5, 0, 0],
      ],
    });
  });

  it('rejects changes the schema refuses', () => {
    const state = initialState();
    expect(updatePiece(state, 1, { length: 99 })).toBe(state);
    expect(updatePiece(state, 1, { length: 6 }).level.pieces[1]).toMatchObject({ length: 6 });
    expect(updateLevel(state, { id: 'Pas Valide' })).toBe(state);
    expect(updateLevel(state, { id: 'mon-niveau' }).level.id).toBe('mon-niveau');
  });
});

describe('editor bonuses and maluses', () => {
  it('reads their parameters from the schema', () => {
    expect(modifierFields('wind').map((f) => f.key)).toEqual(['size', 'strength', 'gusts']);
    expect(modifierFields('magnet')).toEqual([]);
    expect(modifierFields('sweeper').find((f) => f.key === 'length')).toMatchObject({ kind: 'number', step: 0.5 });
  });

  it('places, turns, moves, duplicates, edits and deletes them', () => {
    let state = placeAt({ ...withTool(initialState(), { kind: 'modifier', type: 'speedPad' }), rot: 90 }, 0, -3);
    expect(state.level.modifiers).toEqual([{ type: 'speedPad', cell: [0, 0, -3], rot: 90, speed: 10 }]);
    expect(state.selection).toEqual([{ kind: 'modifier', index: 0 }]);
    state = rotate(state);
    expect(state.level.modifiers[0]).toMatchObject({ rot: 180 });
    state = moveSelection(state, 0, 0, -1);
    expect(state.level.modifiers[0]).toMatchObject({ cell: [0, 0, -4] });
    state = duplicateSelection(state);
    expect(state.level.modifiers[1]).toMatchObject({ cell: [1, 0, -4] });
    expect(updateModifier(state, 0, { speed: 99 })).toBe(state);
    expect(updateModifier(state, 0, { speed: 12 }).level.modifiers[0]).toMatchObject({ speed: 12 });
    state = deleteSelection(state);
    expect(state.level.modifiers).toHaveLength(1);
  });

  it('turning a zone swaps its size', () => {
    const state = placeAt(withTool(initialState(), { kind: 'modifier', type: 'ice' }), 0, -3);
    const wide = updateModifier(state, 0, { size: [1, 3] });
    expect(rotate(wide).level.modifiers[0]).toMatchObject({ size: [3, 1] });
  });

  it('picks a modifier under the click, before the piece it sits on', () => {
    const state = placeAt(withTool(initialState(), { kind: 'modifier', type: 'ice' }), 0, -4);
    const view = fitView(state.level, 400, 600);
    expect(hitTest(state.level, view, ...toScreen(view, 0, -8), 0)).toEqual({ kind: 'modifier', index: 0 });
  });
});

describe('editor top view', () => {
  it('frames the whole level', () => {
    const level = emptyLevel();
    const view = fitView(level, 400, 600);
    const [, top] = toScreen(view, 0, -8 * 2);
    const [, bottom] = toScreen(view, 0, 1 * 2);
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(600);
  });

  it('picks entities first, then pieces', () => {
    const level = emptyLevel();
    const view = fitView(level, 400, 600);
    expect(hitTest(level, view, ...toScreen(view, 0, -6), 0)).toEqual({ kind: 'entity', index: 0 });
    expect(hitTest(level, view, ...toScreen(view, 0, -8), 0)).toEqual({ kind: 'piece', index: 1 });
    expect(hitTest(level, view, ...toScreen(view, 30, 30), 0)).toBeUndefined();
  });
});
