import type { EventBus, GameEvents } from '../../game/events';
import type { ControlMode } from '../../meta/settings';
import { fr } from '../../i18n/fr';
import { byId } from '../dom';
import { formatTimeShort } from '../format';
import type { Toast } from '../toast';

export type ScreenActions = {
  /** Unlocks audio and starts a fresh run. */
  play: () => void;
  chooseControl: (mode: ControlMode) => void;
  enableTilt: () => Promise<void>;
  hasTiltReading: () => boolean;
  openSettings: (back: () => void) => void;
  /** Par time of the level, for the second star. */
  parTimeSec: number;
  /** The level hides a gem. */
  hasGem: boolean;
};

const TILT_PROBE_MS = 1200;

/** Start card and win card. */
export const bindScreens = (events: EventBus<GameEvents>, toast: Toast, actions: ScreenActions): void => {
  const start = byId('start');
  const win = byId('win');
  const pauseButton = byId('pause');

  const begin = () => {
    start.hidden = true;
    win.hidden = true;
    pauseButton.hidden = false;
    actions.play();
  };

  byId('playTouch').addEventListener('click', () => {
    actions.chooseControl('touch');
    begin();
    toast(fr.touchHint, 2600);
  });
  byId('playGyro').addEventListener('click', async () => {
    actions.chooseControl('tilt');
    await actions.enableTilt();
    begin();
    setTimeout(() => {
      if (actions.hasTiltReading()) {
        toast(fr.tiltReady, 1500);
        return;
      }
      actions.chooseControl('touch');
      toast(fr.tiltUnavailable, 4500);
    }, TILT_PROBE_MS);
  });
  byId('startSettings').addEventListener('click', () => {
    start.hidden = true;
    actions.openSettings(() => (start.hidden = false));
  });
  byId('again').addEventListener('click', begin);

  let total = 0;
  events.on('reset', (reset) => (total = reset.total));
  events.on('levelWon', ({ time, falls, stars, gem }) => {
    byId('wCrystals').textContent = `${total}/${total}`;
    byId('wTime').textContent = formatTimeShort(time);
    byId('wFalls').textContent = String(falls);
    const earned = [true, stars.underPar, stars.noFall];
    const labels = [fr.stars.finished, fr.stars.underPar(actions.parTimeSec), fr.stars.noFall];
    byId('wStars').replaceChildren(
      ...earned.map((on, i) => {
        const star = document.createElement('li');
        star.className = on ? 'on' : '';
        star.innerHTML = `<span aria-hidden="true">★</span>`;
        star.append(labels[i] ?? '');
        return star;
      }),
    );
    byId('wStars').setAttribute('aria-label', `${stars.count} étoile${stars.count > 1 ? 's' : ''} sur 3`);
    byId('wGem').textContent = gem ? fr.gemFound : actions.hasGem ? fr.gemMissed : '';
    win.hidden = false;
    pauseButton.hidden = true;
  });
};
