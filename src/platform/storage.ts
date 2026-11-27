/**
 * Key/value persistence. On the web this is localStorage (which can be missing or throw in
 * private modes); phase 6 swaps in @capacitor/preferences behind the same async interface.
 */
export const webStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage full or blocked: settings simply last for this session.
    }
  },
};
