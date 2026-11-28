import type { ControlMode } from '../meta/settings';
import type { ProgressStore, SettingsStore, WalletStore } from '../meta/store';
import type { Toast } from './toast';
import type { UiStore } from './state';

/** What the screens can ask of the game (wired in main.ts). */
export type GameActions = {
  chooseControl: (mode: ControlMode) => void;
  /** Asks for the motion sensor; must run inside a tap on iOS. */
  enableTilt: () => Promise<void>;
  /** Loads a level and starts playing it. */
  play: (id: string) => void;
  /** Shows a level behind the menus without playing it. */
  showBackdrop: (id: string) => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  /** Leaves the run for the level select of its world. */
  quit: () => void;
  usesTilt: () => boolean;
  calibrate: () => boolean;
  /** "Continue here" after a fall: shows a rewarded ad (free with "no ads"), then puts the ball back. */
  revive: () => void;
  /** Doubles the feathers of the last win after a rewarded ad. Resolves whether it worked. */
  doubleFeathers: (amount: number) => Promise<boolean>;
};

/** Store products as the shop shows them. */
export type ShopOffer = { key: 'noAds' | 'feathersSmall' | 'feathersLarge'; price: string; feathers?: number };

/** In-app purchases (phase 9); unavailable in a browser or a build without store keys. */
export type ShopApi = {
  available: () => boolean;
  offers: () => Promise<ShopOffer[]>;
  /** Buys and applies a product; resolves the message to show. */
  buy: (key: ShopOffer['key']) => Promise<'bought' | 'cancelled' | 'failed'>;
  restore: () => Promise<boolean>;
};

export type UiDeps = {
  ui: UiStore;
  settings: SettingsStore;
  progress: ProgressStore;
  actions: GameActions;
  wallet: WalletStore;
  shop: ShopApi;
  /** Can rewarded ads show (native app with ads), or are they free ("no ads" bought)? */
  rewards: () => 'ad' | 'free' | 'none';
  toast: Toast;
  /** `?unlock`: every world and level is open (testing). */
  unlockAll: boolean;
  /** This build can send anonymous statistics or crash reports (asks for consent). */
  telemetryAvailable: boolean;
  /** `?level=id`: the title goes straight to that level. */
  directLevel?: string;
};
