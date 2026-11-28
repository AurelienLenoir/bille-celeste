import type { ControlMode } from '../meta/settings';
import type { ProgressStore, SettingsStore } from '../meta/store';
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
};

export type UiDeps = {
  ui: UiStore;
  settings: SettingsStore;
  progress: ProgressStore;
  actions: GameActions;
  toast: Toast;
  /** `?unlock`: every world and level is open (testing). */
  unlockAll: boolean;
  /** This build can send anonymous statistics or crash reports (asks for consent). */
  telemetryAvailable: boolean;
  /** `?level=id`: the title goes straight to that level. */
  directLevel?: string;
};
