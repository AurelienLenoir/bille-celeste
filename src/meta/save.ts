/**
 * Versioned save formats (settings, progress). Each stored blob carries a `version`; older ones go
 * through one migration per version, newer or unreadable ones fall back to the defaults, and the
 * format's `finalize` keeps what is still valid.
 */
export type Migration = (old: Record<string, unknown>) => Record<string, unknown>;

export type SaveFormat<T> = {
  version: number;
  /** `migrations[n]` turns a version-n blob into a version n + 1 blob. */
  migrations: Record<number, Migration>;
  fallback: () => T;
  /** Turns a blob at the current version into valid data, salvaging what it can. */
  finalize: (data: Record<string, unknown>) => T;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Turns whatever was stored (possibly nothing, an old version or garbage) into valid data. */
export const readSave = <T>(stored: unknown, format: SaveFormat<T>): T => {
  if (!isRecord(stored)) return format.fallback();
  let data = stored;
  let version = typeof data.version === 'number' ? data.version : format.version;
  if (version > format.version) return format.fallback();
  while (version < format.version) {
    const migrate = format.migrations[version];
    if (!migrate) return format.fallback();
    data = migrate(data);
    version++;
  }
  return format.finalize({ ...data, version: format.version });
};

/** Same as `readSave`, from the stored JSON text. */
export const parseSave = <T>(json: string | null, format: SaveFormat<T>): T => {
  if (json === null) return format.fallback();
  try {
    return readSave(JSON.parse(json), format);
  } catch {
    return format.fallback();
  }
};
