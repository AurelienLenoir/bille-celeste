import type { EventBus, GameEvents } from '../../game/events';
import { fr } from '../../i18n/fr';
import { byId } from '../dom';
import type { Toast } from '../toast';

export type PauseActions = {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  /** True when the gyroscope drives the ball, so recalibrating makes sense. */
  usesTilt: () => boolean;
  calibrate: () => boolean;
  openSettings: (back: () => void) => void;
};

const PAUSE_KEYS = new Set(['escape', 'p']);

/** Pause button, pause menu (resume, recalibrate, restart, settings) and the Esc / P shortcut. */
export const bindPauseMenu = (events: EventBus<GameEvents>, toast: Toast, actions: PauseActions): void => {
  const menu = byId('pauseMenu');
  const calibrate = byId<HTMLButtonElement>('calib');
  const calibrateHint = byId('calibHint');
  let open = false;

  const show = () => {
    open = true;
    const tilt = actions.usesTilt();
    calibrate.hidden = !tilt;
    calibrateHint.hidden = !tilt;
    menu.hidden = false;
    byId('resume').focus({ preventScroll: true });
  };
  const hide = () => {
    open = false;
    menu.hidden = true;
  };

  events.on('paused', show);
  events.on('resumed', hide);

  byId('pause').addEventListener('click', actions.pause);
  byId('resume').addEventListener('click', actions.resume);
  byId('restart').addEventListener('click', () => {
    hide();
    actions.restart();
  });
  calibrate.addEventListener('click', () => {
    toast(actions.calibrate() ? fr.calibrated : fr.noTiltReading, 1400);
  });
  byId('pauseSettings').addEventListener('click', () => {
    menu.hidden = true;
    actions.openSettings(show);
  });

  addEventListener('keydown', (e) => {
    if (e.repeat || !PAUSE_KEYS.has(e.key.toLowerCase())) return;
    if (open && !menu.hidden) actions.resume();
    else if (!open) actions.pause();
  });
};
