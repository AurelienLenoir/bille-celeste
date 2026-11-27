import type { EventBus, GameEvents } from '../../game/events';
import { fr } from '../../i18n/fr';
import { byId } from '../dom';
import { formatTime } from '../format';
import type { Toast } from '../toast';

/** Top bar (crystals, timer, falls) and the in-game toasts. */
export const bindHud = (events: EventBus<GameEvents>, toast: Toast): void => {
  const crystals = byId('cr');
  const timer = byId('tm');
  const falls = byId('fl');

  events.on('reset', ({ total }) => {
    crystals.textContent = `0/${total}`;
    falls.textContent = '0';
  });
  events.on('tick', ({ time }) => {
    timer.textContent = formatTime(time);
  });
  events.on('crystalCollected', ({ collected, total }) => {
    crystals.textContent = `${collected}/${total}`;
  });
  events.on('allCrystalsCollected', () => toast(fr.allCrystals, 2200));
  events.on('checkpointReached', () => toast(fr.checkpoint, 1200));
  events.on('goalLocked', ({ missing }) => toast(fr.missingCrystals(missing)));
  events.on('fell', ({ falls: n }) => {
    falls.textContent = String(n);
    toast(fr.fell, 900);
  });
};
