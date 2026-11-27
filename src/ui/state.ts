import { createStore, type StoreApi } from 'zustand/vanilla';
import type { WinOutcome, WinningRun } from '../meta/progress';
import type { World } from '../levels/worlds';

/** Everything the victory screen shows. */
export type WinView = {
  levelId: string;
  run: WinningRun;
  crystals: number;
  parTimeSec: number;
  hasGem: boolean;
  /** Saved outcome, for campaign levels. */
  outcome?: WinOutcome;
  /** The next campaign level, when it is open. */
  next?: string;
  /** A world this win opened. */
  opened?: World;
  /** The last campaign level was just finished. */
  campaignDone: boolean;
};

export type Screen =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'levels'; world: number }
  | { name: 'loading' }
  | { name: 'play' }
  | { name: 'pause' }
  | { name: 'win'; win: WinView };

export type UiState = {
  screen: Screen;
  /** The settings card is open on top of the current screen. */
  settings: boolean;
  go: (screen: Screen) => void;
  openSettings: (open: boolean) => void;
};

export type UiStore = StoreApi<UiState>;

export const createUiStore = (): UiStore =>
  createStore<UiState>((set) => ({
    screen: { name: 'title' },
    settings: false,
    go: (screen) => set({ screen }),
    openSettings: (settings) => set({ settings }),
  }));
