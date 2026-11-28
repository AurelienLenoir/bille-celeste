import { createStore, type StoreApi } from 'zustand/vanilla';
import { parseStoredProgress, recordWin, type Progress, type WinningRun, type WinOutcome } from './progress';
import { DEFAULT_SETTINGS, parseStoredSettings, settingsSchema, type Settings } from './settings';
import {
  addFeathers,
  buySkin,
  equipSkin,
  parseStoredWallet,
  payWin,
  today,
  type BuyResult,
  type Earnings,
  type Wallet,
} from './wallet';

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

export const PROGRESS_KEY = 'bille-celeste.progress';

export type ProgressState = {
  progress: Progress;
  /** Stores a won run and returns what it changed (record, stars). */
  win: (id: string, run: WinningRun) => WinOutcome;
};

export type ProgressStore = StoreApi<ProgressState>;

/** Loads the saved progress (stars, records), then writes every win back to storage. */
export const createProgressStore = async (storage: KeyValueStorage): Promise<ProgressStore> => {
  const initial = parseStoredProgress(await storage.get(PROGRESS_KEY).catch(() => null));
  const store = createStore<ProgressState>((set, get) => ({
    progress: initial,
    win: (id, run) => {
      const outcome = recordWin(get().progress, id, run);
      set({ progress: outcome.progress });
      return outcome;
    },
  }));
  store.subscribe(({ progress }) => {
    void storage.set(PROGRESS_KEY, JSON.stringify(progress)).catch(() => undefined);
  });
  return store;
};

export const WALLET_KEY = 'bille-celeste.wallet';

export type WalletState = {
  wallet: Wallet;
  /** Pays a won run (stars, gem, daily challenge) and returns what it earned. */
  payWin: (levelId: string, run: WinningRun, outcome?: Pick<WinOutcome, 'gainedStars'>, date?: string) => Earnings;
  buy: (skinId: string) => BuyResult;
  equip: (skinId: string) => void;
  addFeathers: (amount: number) => void;
  setNoAds: (noAds: boolean) => void;
  /** An interstitial was shown: the count of wins starts again. */
  adShown: () => void;
};

export type WalletStore = StoreApi<WalletState>;

/** Loads the saved wallet (feathers, skins, purchases), then writes every change back. */
export const createWalletStore = async (storage: KeyValueStorage): Promise<WalletStore> => {
  const initial = parseStoredWallet(await storage.get(WALLET_KEY).catch(() => null));
  const store = createStore<WalletState>((set, get) => ({
    wallet: initial,
    payWin: (levelId, run, outcome, date = today()) => {
      const paid = payWin(get().wallet, levelId, run, outcome, date);
      set({ wallet: paid.wallet });
      return paid.earnings;
    },
    buy: (skinId) => {
      const result = buySkin(get().wallet, skinId);
      if (result.ok) set({ wallet: result.wallet });
      return result;
    },
    equip: (skinId) => set({ wallet: equipSkin(get().wallet, skinId) }),
    addFeathers: (amount) => set({ wallet: addFeathers(get().wallet, amount) }),
    setNoAds: (noAds) => set({ wallet: { ...get().wallet, noAds } }),
    adShown: () => set({ wallet: { ...get().wallet, winsSinceAd: 0 } }),
  }));
  store.subscribe(({ wallet }) => {
    void storage.set(WALLET_KEY, JSON.stringify(wallet)).catch(() => undefined);
  });
  return store;
};
