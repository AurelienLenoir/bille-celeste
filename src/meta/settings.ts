import { z } from 'zod';
import { parseSave, readSave, type Migration, type SaveFormat } from './save';

export const SETTINGS_VERSION = 3;

export const CONTROL_MODES = ['tilt', 'touch'] as const;
export type ControlMode = (typeof CONTROL_MODES)[number];

/** `auto` follows the device language (French if it is French, English otherwise). */
export const LANGUAGES = ['auto', 'fr', 'en'] as const;
export type LanguageSetting = (typeof LANGUAGES)[number];

export const TILT_RANGE_DEG = { min: 10, max: 35 } as const;
export const TOUCH_SENSITIVITY = { min: 0.5, max: 2 } as const;

export const settingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  controlMode: z.enum(CONTROL_MODES),
  /** Phone tilt (degrees from neutral) that gives full strength. Smaller = more sensitive. */
  tiltRangeDeg: z.number().min(TILT_RANGE_DEG.min).max(TILT_RANGE_DEG.max),
  touchSensitivity: z.number().min(TOUCH_SENSITIVITY.min).max(TOUCH_SENSITIVITY.max),
  invertX: z.boolean(),
  invertY: z.boolean(),
  haptics: z.boolean(),
  sound: z.boolean(),
  music: z.boolean(),
  /** Version 2. */
  language: z.enum(LANGUAGES),
  /** Version 3: sound effect and music volumes, 0 to 1. */
  sfxVolume: z.number().min(0).max(1),
  musicVolume: z.number().min(0).max(1),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  controlMode: 'touch',
  tiltRangeDeg: 20,
  touchSensitivity: 1,
  invertX: false,
  invertY: false,
  haptics: true,
  sound: true,
  music: true,
  language: 'auto',
  sfxVolume: 0.8,
  musicVolume: 0.5,
};

const fieldSchemas = settingsSchema.omit({ version: true }).shape;
type FieldKey = keyof typeof fieldSchemas;

/** Keeps each stored field that is still valid and falls back to the default for the others. */
const salvage = (raw: Record<string, unknown>): Settings => {
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(fieldSchemas) as FieldKey[]) {
    const parsed = fieldSchemas[key].safeParse(raw[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return settingsSchema.parse(result);
};

/** One function per old version, each returning the next version's shape (tested in settings.test.ts). */
export const SETTINGS_MIGRATIONS: Record<number, Migration> = {
  /** Version 2 adds the language: players of version 1 keep following their device. */
  1: (v1) => ({ ...v1, language: 'auto' }),
  /** Version 3 adds the volumes, at their defaults (the on/off switches are kept). */
  2: (v2) => ({ ...v2, sfxVolume: 0.8, musicVolume: 0.5 }),
};

const SETTINGS_FORMAT: SaveFormat<Settings> = {
  version: SETTINGS_VERSION,
  migrations: SETTINGS_MIGRATIONS,
  fallback: () => ({ ...DEFAULT_SETTINGS }),
  finalize: salvage,
};

/** Turns whatever was stored (possibly nothing, an old version or garbage) into valid settings. */
export const migrateSettings = (stored: unknown): Settings => readSave(stored, SETTINGS_FORMAT);

export const parseStoredSettings = (json: string | null): Settings => parseSave(json, SETTINGS_FORMAT);
