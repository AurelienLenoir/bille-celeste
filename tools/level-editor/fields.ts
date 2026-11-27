import type { z } from 'zod';
import { modifierSchema, pieceSchema, type ModifierType, type PieceType } from '../../src/levels/schema';

/** One editable parameter of a piece, read from the Zod schema so the inspector never drifts from it. */
export type Field =
  | { key: string; kind: 'number'; min: number; max: number; step: number }
  | { key: string; kind: 'choice'; options: readonly (string | number)[] }
  | { key: string; kind: 'pair'; min: number; max: number; step: number };

/** Keys the editor handles itself (position and orientation). */
const SKIPPED = new Set(['type', 'cell', 'rot', 'path']);

type AnySchema = z.core.$ZodType & { def: Record<string, unknown> };
type NumberLike = AnySchema & { minValue: number | null; maxValue: number | null; isInt: boolean };

const unwrap = (schema: AnySchema): AnySchema => {
  const { def } = schema;
  if (def.type === 'default' || def.type === 'optional') return unwrap(def.innerType as AnySchema);
  return schema;
};

const stepOf = (schema: NumberLike): number => {
  if (schema.isInt) return 1;
  const checks = (schema.def.checks ?? []) as { _zod: { def: { check: string; value?: number } } }[];
  const multiple = checks.find((c) => c._zod.def.check === 'multiple_of');
  return multiple?._zod.def.value ?? 0.1;
};

const numberField = (key: string, schema: NumberLike): Field => ({
  key,
  kind: 'number',
  min: schema.minValue ?? -100,
  max: schema.maxValue ?? 100,
  step: stepOf(schema),
});

const fieldOf = (key: string, raw: AnySchema): Field | undefined => {
  const schema = unwrap(raw);
  const { def } = schema;
  if (def.type === 'number') return numberField(key, schema as NumberLike);
  if (def.type === 'enum')
    return { key, kind: 'choice', options: Object.values(def.entries as Record<string, string>) };
  if (def.type === 'union') {
    const options = (def.options as AnySchema[]).flatMap(
      (o) => (o.def.values as (string | number)[] | undefined) ?? [],
    );
    return { key, kind: 'choice', options };
  }
  if (def.type === 'tuple') {
    const [first] = def.items as NumberLike[];
    if (!first) return undefined;
    const n = numberField(key, first);
    return n.kind === 'number' ? { ...n, kind: 'pair' } : undefined;
  }
  return undefined;
};

const shapes = new Map(pieceSchema.options.map((option) => [option.shape.type.value, option.shape]));
const modifierShapes = new Map(modifierSchema.options.map((option) => [option.shape.type.value, option.shape]));

const fieldsOf = (shape: Record<string, unknown> | undefined): Field[] =>
  Object.entries(shape ?? {}).flatMap(([key, schema]) =>
    SKIPPED.has(key) ? [] : (fieldOf(key, schema as unknown as AnySchema) ?? []),
  );

/** Editable parameters of a piece type, in schema order. */
export const pieceFields = (type: PieceType): Field[] => fieldsOf(shapes.get(type));

/** Editable parameters of a bonus or malus, in schema order. */
export const modifierFields = (type: ModifierType): Field[] => fieldsOf(modifierShapes.get(type));

export const PIECE_TYPES = [...shapes.keys()] as PieceType[];

/** Pieces that have a rotation. */
export const hasRot = (type: PieceType): boolean => 'rot' in (shapes.get(type) ?? {});

/** Bonuses and maluses that point somewhere (pads, wind, belts, pushers). */
export const modifierHasRot = (type: ModifierType): boolean => 'rot' in (modifierShapes.get(type) ?? {});
