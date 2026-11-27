import type { ActiveEffect } from '../../game/effects';
import type { EventBus, GameEvents } from '../../game/events';
import type { ModifierType } from '../../levels/schema';
import { t } from '../../i18n';
import { byId } from '../dom';
import { formatTime } from '../format';
import type { Toast } from '../toast';

/** Zones announce themselves once per run; pickups every time. */
const ZONES = new Set<ModifierType>(['ice', 'sand', 'wind', 'conveyor', 'invert', 'fog']);

const effectText = ({ type, left }: ActiveEffect) =>
  Number.isFinite(left) ? `${t().effects[type]} ${Math.ceil(left)}` : t().effects[type];

/** Writes the HUD labels in the current language. */
export const labelHud = (): void => {
  byId('crLabel').textContent = t().hud.crystals;
  byId('flLabel').textContent = t().hud.falls;
};

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
    const message = t().modifiers[type];
    if (!message || (ZONES.has(type) && announced.has(type))) return;
    announced.add(type);
    toast(message, 1600);
  });
  events.on('shieldSaved', () => toast(t().shieldSaved, 1400));
  events.on('hiddenGemFound', () => toast(t().hiddenGem, 1800));
  events.on('crystalsPutBack', ({ collected, total }) => {
    crystals.textContent = `${collected}/${total}`;
  });
  events.on('crystalCollected', ({ collected, total }) => {
    crystals.textContent = `${collected}/${total}`;
  });
  events.on('allCrystalsCollected', () => toast(t().allCrystals, 2200));
  events.on('checkpointReached', () => toast(t().checkpoint, 1200));
  events.on('goalLocked', ({ missing }) => toast(t().missingCrystals(missing)));
  events.on('fell', ({ falls: n }) => {
    falls.textContent = String(n);
    toast(t().fell, 900);
  });
};
