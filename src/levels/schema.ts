import { z } from 'zod';

/**
 * Level format, version 2 (PLAN.md § 3): version 1 plus the bonuses and maluses (`modifiers`). This file is the source of truth: the TypeScript types,
 * the loader, the editor, the generator and the validator all derive from it.
 *
 * Grid: a cell is 2 × 2 units, heights go by steps of 0.5. `cell` is [x, height, z] in cells and
 * steps. Rotation 0 faces -z (away from the camera), 90 turns right (+x).
 */
export const LEVEL_VERSION = 2;

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const half = (min: number, max: number) => z.number().multipleOf(0.5).min(min).max(max);

const GRID_LIMIT = 500;
export const cellSchema = z.tuple([int(-GRID_LIMIT, GRID_LIMIT), int(-200, 200), int(-GRID_LIMIT, GRID_LIMIT)]);
/** Moving platforms may stop on half cells, so they can dock against a cell edge. */
const halfCellSchema = z.tuple([half(-GRID_LIMIT, GRID_LIMIT), int(-200, 200), half(-GRID_LIMIT, GRID_LIMIT)]);
const rotSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0);

export const SURFACE_NAMES = ['cream', 'mint', 'rose', 'lav', 'wood'] as const;
const surface = (fallback: (typeof SURFACE_NAMES)[number]) => z.enum(SURFACE_NAMES).default(fallback);

/** Track widths in world units. */
export const WIDTHS = { wide: 3, normal: 2, narrow: 1.4, rail: 0.8 } as const;
const widthSchema = z.enum(['wide', 'normal', 'narrow', 'rail']).default('normal');
/** Rails along the sides. A `rail`-width track never gets any: the ball would not fit between them. */
const railsSchema = z.enum(['none', 'left', 'right', 'both']).default('none');

const linear = { cell: cellSchema, rot: rotSchema };

export const platformSchema = z.object({
  type: z.literal('platform'),
  cell: cellSchema,
  size: z.tuple([int(1, 12), int(1, 12)]).default([3, 3]),
  rot: rotSchema,
  surface: surface('mint'),
});

export const straightSchema = z.object({
  type: z.literal('straight'),
  ...linear,
  length: int(1, 24).default(4),
  width: widthSchema,
  rails: railsSchema,
  surface: surface('cream'),
});

export const curveSchema = z.object({
  type: z.literal('curve'),
  ...linear,
  radius: int(1, 4).default(2),
  angle: z.union([z.literal(90), z.literal(180)]).default(90),
  dir: z.enum(['left', 'right']).default('right'),
  width: widthSchema,
  rails: railsSchema,
  surface: surface('cream'),
});

export const rampSchema = z.object({
  type: z.literal('ramp'),
  ...linear,
  length: int(1, 12).default(3),
  /** Height lost over the ramp, in steps of 0.5 (negative climbs). */
  drop: int(-8, 16)
    .refine((n) => n !== 0, 'Une rampe doit monter ou descendre')
    .default(2),
  width: widthSchema,
  rails: railsSchema,
  surface: surface('cream'),
});

export const halfPipeSchema = z.object({
  type: z.literal('halfPipe'),
  ...linear,
  length: int(1, 24).default(4),
  surface: surface('lav'),
});

export const funnelSchema = z.object({
  type: z.literal('funnel'),
  ...linear,
  /** Width of the mouth in cells; the funnel narrows to a normal track. */
  diameter: z.union([z.literal(3), z.literal(5)]).default(3),
  surface: surface('cream'),
});

export const bridgeSchema = z.object({
  type: z.literal('bridge'),
  ...linear,
  length: int(1, 16).default(4),
  width: z.enum(['narrow', 'rail']).default('narrow'),
  surface: surface('wood'),
});

export const gapSchema = z.object({
  type: z.literal('gap'),
  ...linear,
  /** Empty cells after the kicker, which sits in `cell`. */
  length: int(1, 2).default(1),
  surface: surface('rose'),
});

export const wallSchema = z.object({
  type: z.literal('wall'),
  /** The wall stands just outside the front edge of `cell` (front = `rot`) and runs to the right. */
  ...linear,
  length: int(1, 24).default(3),
  height: z.number().min(0.3).max(3).default(0.6),
});

export const stairsSchema = z.object({
  type: z.literal('stairs'),
  ...linear,
  /** Each step is one cell long and half a unit lower than the one before. */
  steps: int(1, 8).default(3),
  width: widthSchema,
  surface: surface('cream'),
});

export const movingPlatformSchema = z.object({
  type: z.literal('movingPlatform'),
  /** Centre of the platform at each stop, in cells; it goes back and forth along this path. */
  path: z.array(halfCellSchema).min(2).max(6),
  size: z.tuple([half(0.5, 4), half(0.5, 4)]).default([1.5, 1.5]),
  speed: z.number().min(0.5).max(6).default(2),
  pause: z.number().min(0).max(5).default(1),
  surface: surface('lav'),
});

export const rotatingPlatformSchema = z.object({
  type: z.literal('rotatingPlatform'),
  cell: cellSchema,
  /** Disc diameter in cells. */
  diameter: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(3),
  /** Degrees per second, positive turns clockwise seen from above. */
  speed: z
    .number()
    .min(-180)
    .max(180)
    .refine((n) => n !== 0, 'Un plateau tournant doit tourner')
    .default(30),
  surface: surface('rose'),
});

export const fallingTileSchema = z.object({
  type: z.literal('fallingTile'),
  cell: cellSchema,
  /** Seconds between the ball touching the tile and the tile falling. */
  delay: z.number().min(0.1).max(3).default(0.6),
  surface: surface('rose'),
});

export const seesawSchema = z.object({
  type: z.literal('seesaw'),
  ...linear,
  length: z.union([z.literal(3), z.literal(5)]).default(3),
  width: z.enum(['normal', 'wide']).default('wide'),
  surface: surface('wood'),
});

export const pieceSchema = z.discriminatedUnion('type', [
  platformSchema,
  straightSchema,
  curveSchema,
  rampSchema,
  halfPipeSchema,
  funnelSchema,
  bridgeSchema,
  gapSchema,
  wallSchema,
  stairsSchema,
  movingPlatformSchema,
  rotatingPlatformSchema,
  fallingTileSchema,
  seesawSchema,
]);

export const entitySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('crystal'), cell: cellSchema }),
  z.object({ type: z.literal('checkpoint'), cell: cellSchema }),
  /** Optional collectible off the main path; it scores from phase 3. */
  z.object({ type: z.literal('hiddenGem'), cell: cellSchema }),
  z.object({ type: z.literal('goal'), cell: cellSchema }),
]);

/** A zone covers `size` cells (x by z) centred on `cell`, like a platform (the cell before the middle when even). */
const zoneSize = z.tuple([int(1, 12), int(1, 12)]).default([1, 1]);
const pickup = <T extends string>(type: T) => z.object({ type: z.literal(type), cell: cellSchema });

/** Bonuses (PLAN.md § 5.1). Durations and strengths of pickups are fixed by the game, not per level. */
export const bonusSchemas = [
  z.object({
    type: z.literal('speedPad'),
    cell: cellSchema,
    rot: rotSchema,
    /** Speed (units/s) the ball has along `rot` when it leaves the pad. */
    speed: z.number().min(5).max(13).default(10),
  }),
  z.object({
    type: z.literal('spring'),
    cell: cellSchema,
    rot: rotSchema,
    /** Height of the jump's apex above the pad (units). */
    height: z.number().min(0.5).max(4).default(2.5),
    /** Horizontal speed along `rot` (units/s): 0 bounces straight up, more jumps in an arc. */
    forward: z.number().min(0).max(10).default(0),
  }),
  pickup('magnet'),
  pickup('shield'),
  pickup('slowMo'),
  pickup('hourglass'),
  pickup('feather'),
] as const;

/** Maluses (PLAN.md § 5.2). */
export const malusSchemas = [
  z.object({ type: z.literal('ice'), cell: cellSchema, size: zoneSize }),
  z.object({ type: z.literal('sand'), cell: cellSchema, size: zoneSize }),
  z.object({
    type: z.literal('wind'),
    cell: cellSchema,
    size: zoneSize,
    /** Direction the wind blows towards. */
    rot: rotSchema,
    /** Acceleration given to the ball (units/s²). */
    strength: z.number().min(1).max(8).default(4),
    /** Seconds between two gusts; 0 blows steadily. */
    gusts: z.number().min(0).max(8).default(0),
  }),
  z.object({
    type: z.literal('conveyor'),
    cell: cellSchema,
    size: zoneSize,
    rot: rotSchema,
    /** Belt speed (units/s). */
    speed: z.number().min(1).max(6).default(4),
  }),
  z.object({
    type: z.literal('pusher'),
    /** The track cell the block sweeps; it comes out of the next cell behind `rot` and pushes towards `rot`. */
    cell: cellSchema,
    rot: rotSchema,
    /** Seconds between two strikes. */
    period: z.number().min(1.5).max(8).default(3),
    /** Fraction of the period by which this pusher is late (to stagger several). */
    phase: z.number().min(0).max(1).default(0),
  }),
  z.object({
    type: z.literal('sweeper'),
    /** Pivot of the arm (usually the middle of a platform). */
    cell: cellSchema,
    /** Arm length in cells. */
    length: half(1, 4).default(1.5),
    /** Degrees per second, positive turns clockwise seen from above. */
    speed: z
      .number()
      .min(-180)
      .max(180)
      .refine((n) => n !== 0, 'Une barre tournante doit tourner')
      .default(60),
  }),
  z.object({
    type: z.literal('bumper'),
    cell: cellSchema,
    /** Speed (units/s) the ball bounces off at. */
    strength: z.number().min(4).max(13).default(9),
  }),
  pickup('heavy'),
  z.object({ type: z.literal('invert'), cell: cellSchema, size: zoneSize }),
  z.object({
    type: z.literal('fog'),
    cell: cellSchema,
    size: zoneSize,
    /** 0 leaves the view clear, 1 is the thickest fog. */
    density: z.number().min(0.2).max(1).default(0.8),
  }),
] as const;

export const modifierSchema = z.discriminatedUnion('type', [...bonusSchemas, ...malusSchemas]);

const textSchema = z.object({ fr: z.string().min(1).max(60), en: z.string().min(1).max(60) });

export const THEMES = ['garden', 'sunset', 'glacier', 'factory'] as const;

export const levelSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,32}$/, 'Identifiant : minuscules, chiffres et tirets'),
    version: z.literal(LEVEL_VERSION),
    name: textSchema,
    world: int(1, 4),
    parTimeSec: z.number().positive().max(600),
    spawn: z.object({ cell: cellSchema }),
    pieces: z.array(pieceSchema).min(1).max(300),
    entities: z.array(entitySchema).max(120),
    modifiers: z.array(modifierSchema).max(60).default([]),
    decor: z.object({ theme: z.enum(THEMES).default('garden'), seed: int(1, 2_000_000_000).default(7) }),
  })
  .superRefine((level, ctx) => {
    const count = (type: string) => level.entities.filter((e) => e.type === type).length;
    if (count('goal') !== 1)
      ctx.addIssue({ code: 'custom', path: ['entities'], message: 'Il faut exactement un goal' });
    if (count('crystal') < 1)
      ctx.addIssue({ code: 'custom', path: ['entities'], message: 'Il faut au moins un cristal' });
    if (count('hiddenGem') > 1)
      ctx.addIssue({ code: 'custom', path: ['entities'], message: 'Au plus une gemme cachée' });
  });

export type Level = z.output<typeof levelSchema>;
export type LevelInput = z.input<typeof levelSchema>;
export type Piece = z.output<typeof pieceSchema>;
export type PieceType = Piece['type'];
export type PieceOf<T extends PieceType> = Extract<Piece, { type: T }>;
export type Entity = z.output<typeof entitySchema>;
export type Surface = (typeof SURFACE_NAMES)[number];
export type Width = keyof typeof WIDTHS;
export type Rails = z.output<typeof railsSchema>;
export type Modifier = z.output<typeof modifierSchema>;
export type ModifierType = Modifier['type'];
export type ModifierOf<T extends ModifierType> = Extract<Modifier, { type: T }>;
export const BONUS_TYPES = bonusSchemas.map((s) => s.shape.type.value);
export const MALUS_TYPES = malusSchemas.map((s) => s.shape.type.value);
