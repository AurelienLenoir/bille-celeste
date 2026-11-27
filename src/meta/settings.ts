import { z } from 'zod';

export const SETTINGS_VERSION = 1;

export const CONTROL_MODES = ['tilt', 'touch'] as const;
export type ControlMode = (typeof CONTROL_MODES)[number];

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
  /** Stored now so the save format does not change when music arrives (phase 5). */
  music: z.boolean(),
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

/**
 * One function per old version, each returning the next version's shape. Version 1 is the first
 * stored format, so the list is empty; a future v2 adds `1: (v1) => v2` and a test for it.
 */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Turns whatever was stored (possibly nothing, an old version or garbage) into valid settings. */
export const migrateSettings = (stored: unknown): Settings => {
  if (!isRecord(stored)) return { ...DEFAULT_SETTINGS };
  let data = stored;
  let version = typeof data.version === 'number' ? data.version : SETTINGS_VERSION;
  if (version > SETTINGS_VERSION) return { ...DEFAULT_SETTINGS };
  while (version < SETTINGS_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return { ...DEFAULT_SETTINGS };
    data = migrate(data);
    version++;
  }
  return salvage({ ...data, version: SETTINGS_VERSION });
};

export const parseStoredSettings = (json: string | null): Settings => {
  if (json === null) return { ...DEFAULT_SETTINGS };
  try {
    return migrateSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};
