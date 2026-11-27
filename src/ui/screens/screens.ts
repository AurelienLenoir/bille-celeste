import type { EventBus, GameEvents } from '../../game/events';
import { fr } from '../../i18n/fr';
import { byId } from '../dom';
import { formatTimeShort } from '../format';
import type { Toast } from '../toast';

type ScreenActions = {
  /** Unlocks audio and starts a fresh run. */
  play: () => void;
  enableTilt: () => Promise<void>;
  hasTiltReading: () => boolean;
  calibrate: () => boolean;
};

const TILT_PROBE_MS = 1200;

/** Start card, win card and the bottom-right dock (recalibrate / restart). */
export const bindScreens = (events: EventBus<GameEvents>, toast: Toast, actions: ScreenActions): void => {
  const start = byId('start');
  const win = byId('win');
  const dock = byId('dock');
  const calibrate = byId<HTMLButtonElement>('calib');

  const begin = () => {
    start.hidden = true;
    win.hidden = true;
    dock.hidden = false;
    actions.play();
  };
  const restart = () => {
    actions.play();
    win.hidden = true;
  };

  byId('playTouch').addEventListener('click', () => {
    begin();
    toast(fr.touchHint, 2600);
  });
  byId('playGyro').addEventListener('click', async () => {
    await actions.enableTilt();
    begin();
    calibrate.hidden = false;
    setTimeout(() => {
      if (!actions.hasTiltReading()) {
        calibrate.hidden = true;
        toast(fr.tiltUnavailable, 4500);
      } else toast(fr.tiltReady, 1500);
    }, TILT_PROBE_MS);
  });
  calibrate.addEventListener('click', () => {
    if (actions.calibrate()) toast(fr.calibrated, 1200);
  });
  byId('restart').addEventListener('click', restart);
  byId('again').addEventListener('click', restart);

  events.on('levelWon', ({ time, falls }) => {
    byId('wTime').textContent = formatTimeShort(time);
    byId('wFalls').textContent = String(falls);
    win.hidden = false;
  });
};
