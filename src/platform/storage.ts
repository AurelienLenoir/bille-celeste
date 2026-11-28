import { Preferences } from '@capacitor/preferences';
import { isNative } from '.';

export type KeyValueStorage = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
};

/** localStorage, which can be missing or throw in private modes. */
export const webStorage: KeyValueStorage = {
  get: async (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked: settings simply last for this session.
    }
  },
};

/** Native preferences (UserDefaults / SharedPreferences), which the OS does not clear like web data. */
const nativeStorage: KeyValueStorage = {
  get: async (key) => (await Preferences.get({ key })).value,
  set: async (key, value) => Preferences.set({ key, value }),
};

/** The storage for saves on this platform. */
export const appStorage = (): KeyValueStorage => (isNative() ? nativeStorage : webStorage);
