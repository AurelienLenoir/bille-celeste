import type { ActiveEffect } from '../../game/effects';
import type { EventBus, GameEvents } from '../../game/events';
import type { ModifierType } from '../../levels/schema';
import { fr } from '../../i18n/fr';
import { byId } from '../dom';
import { formatTime } from '../format';
import type { Toast } from '../toast';

/** Zones announce themselves once per run; pickups every time. */
const ZONES = new Set<ModifierType>(['ice', 'sand', 'wind', 'conveyor', 'invert', 'fog']);

const effectText = ({ type, left }: ActiveEffect) =>
  Number.isFinite(left) ? `${fr.effects[type]} ${Math.ceil(left)}` : fr.effects[type];

/** Top bar (crystals, timer, falls), running effects and the in-game toasts. */
export const bindHud = (events: EventBus<GameEvents>, toast: Toast): void => {
  const crystals = byId('cr');
  const timer = byId('tm');
  const falls = byId('fl');
  const effects = byId('fx');
  let shown = '';
  const announced = new Set<ModifierType>();

  events.on('reset', ({ total }) => {
    crystals.textContent = `0/${total}`;
    falls.textContent = '0';
    announced.clear();
  });
  events.on('tick', ({ time, effects: active }) => {
    timer.textContent = formatTime(time);
    const texts = active.map(effectText);
    const key = texts.join('|');
    if (key === shown) return;
    shown = key;
    effects.replaceChildren(
      ...active.map((effect, i) => {
        const pill = document.createElement('span');
        pill.className = `effect ${effect.type}`;
        pill.textContent = texts[i] ?? '';
        return pill;
      }),
    );
  });
  events.on('modifierFired', ({ type }) => {
    const message = (fr.modifiers as Partial<Record<ModifierType, string>>)[type];
    if (!message || (ZONES.has(type) && announced.has(type))) return;
    announced.add(type);
    toast(message, 1600);
  });
  events.on('shieldSaved', () => toast(fr.shieldSaved, 1400));
  events.on('hiddenGemFound', () => toast(fr.hiddenGem, 1800));
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
