import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, migrateSettings, parseStoredSettings, SETTINGS_VERSION } from '../../src/meta/settings';
import { createSettingsStore, SETTINGS_KEY, type KeyValueStorage } from '../../src/meta/store';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
  };
  return { storage, data };
};

describe('settings migration', () => {
  it('returns the defaults when nothing or garbage was stored', () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseStoredSettings('{not json')).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings('hello')).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettings([1, 2])).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid fields and repairs invalid ones', () => {
    const migrated = migrateSettings({
      version: SETTINGS_VERSION,
      controlMode: 'tilt',
      tiltRangeDeg: 500,
      haptics: false,
      invertY: 'yes',
    });
    expect(migrated.controlMode).toBe('tilt');
    expect(migrated.haptics).toBe(false);
    expect(migrated.tiltRangeDeg).toBe(DEFAULT_SETTINGS.tiltRangeDeg);
    expect(migrated.invertY).toBe(false);
  });
  it('treats a save without a version as the current format', () => {
    expect(migrateSettings({ sound: false }).sound).toBe(false);
  });
  it('ignores saves from a newer version of the game', () => {
    expect(migrateSettings({ version: SETTINGS_VERSION + 1, sound: false })).toEqual(DEFAULT_SETTINGS);
  });
  it('migrates a version-1 save to version 2, keeping every choice and following the device language', () => {
    const v1 = {
      version: 1,
      controlMode: 'tilt',
      tiltRangeDeg: 14,
      touchSensitivity: 1.6,
      invertX: true,
      invertY: false,
      haptics: false,
      sound: true,
      music: false,
    };
    expect(migrateSettings(v1)).toEqual({
      ...v1,
      version: SETTINGS_VERSION,
      language: 'auto',
      sfxVolume: 0.8,
      musicVolume: 0.5,
      telemetry: 'ask',
    });
    expect(parseStoredSettings(JSON.stringify(v1)).language).toBe('auto');
  });
  it('migrates a version-2 save to version 3 with default volumes, keeping the switches', () => {
    const v2 = { ...DEFAULT_SETTINGS, version: 2, sound: false, music: false, language: 'en' } as Record<
      string,
      unknown
    >;
    delete v2.sfxVolume;
    delete v2.musicVolume;
    expect(migrateSettings(v2)).toEqual({ ...DEFAULT_SETTINGS, sound: false, music: false, language: 'en' });
  });
  it('migrates a version-3 save to version 4: statistics are asked for, never assumed', () => {
    const v3 = { ...DEFAULT_SETTINGS, version: 3, musicVolume: 0.2 } as Record<string, unknown>;
    delete v3.telemetry;
    expect(migrateSettings(v3)).toEqual({ ...DEFAULT_SETTINGS, musicVolume: 0.2, telemetry: 'ask' });
  });
  it('drops a volume out of range back to its default', () => {
    expect(migrateSettings({ ...DEFAULT_SETTINGS, musicVolume: 3 }).musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
  });
  it('round-trips through JSON', () => {
    const custom = { ...DEFAULT_SETTINGS, invertX: true, touchSensitivity: 1.4 };
    expect(parseStoredSettings(JSON.stringify(custom))).toEqual(custom);
  });
});

describe('settings store', () => {
  it('loads what was saved and saves every valid change', async () => {
    const saved = JSON.stringify({ ...DEFAULT_SETTINGS, sound: false });
    const { storage, data } = memoryStorage({ [SETTINGS_KEY]: saved });
    const store = await createSettingsStore(storage);
    expect(store.getState().settings.sound).toBe(false);

    store.getState().update({ tiltRangeDeg: 14 });
    expect(store.getState().settings.tiltRangeDeg).toBe(14);
    expect(JSON.parse(data.get(SETTINGS_KEY) ?? '{}').tiltRangeDeg).toBe(14);
  });
  it('rejects out-of-range values', async () => {
    const store = await createSettingsStore(memoryStorage().storage);
    store.getState().update({ touchSensitivity: 9 });
    expect(store.getState().settings.touchSensitivity).toBe(DEFAULT_SETTINGS.touchSensitivity);
  });
  it('starts with the defaults when storage fails', async () => {
    const store = await createSettingsStore({
      get: () => Promise.reject(new Error('blocked')),
      set: () => Promise.reject(new Error('blocked')),
    });
    expect(store.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(() => store.getState().update({ sound: false })).not.toThrow();
  });
});
