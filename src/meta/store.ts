import { createStore, type StoreApi } from 'zustand/vanilla';
import { DEFAULT_SETTINGS, parseStoredSettings, settingsSchema, type Settings } from './settings';

export type KeyValueStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

export const SETTINGS_KEY = 'bille-celeste.settings';

export type SettingsState = {
  settings: Settings;
  update: (patch: Partial<Omit<Settings, 'version'>>) => void;
};

export type SettingsStore = StoreApi<SettingsState>;

/** Loads the saved settings, then writes every valid change back to storage. */
export const createSettingsStore = async (storage: KeyValueStorage): Promise<SettingsStore> => {
  const initial = parseStoredSettings(await storage.get(SETTINGS_KEY).catch(() => null));
  const store = createStore<SettingsState>((set, get) => ({
    settings: initial,
    update: (patch) => {
      const next = settingsSchema.safeParse({ ...get().settings, ...patch });
      if (next.success) set({ settings: next.data });
    },
  }));
  store.subscribe(({ settings }) => {
    void storage.set(SETTINGS_KEY, JSON.stringify(settings)).catch(() => undefined);
  });
  return store;
};

export { DEFAULT_SETTINGS };
