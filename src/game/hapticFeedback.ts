import type { Haptics } from '../engine/haptics';
import type { EventBus, GameEvents } from './events';
import { MODIFIERS } from './modifiers';

/** One vibration per game event, as listed in PLAN.md § 5.4; each bonus and malus has its own. */
export const bindHapticFeedback = (events: EventBus<GameEvents>, haptics: Haptics): void => {
  events.on('crystalCollected', () => haptics('light'));
  events.on('checkpointReached', () => haptics('medium'));
  events.on('fell', () => haptics('heavy'));
  events.on('levelWon', () => haptics('success'));
  events.on('modifierFired', ({ type }) => haptics(MODIFIERS[type].haptic));
  events.on('shieldSaved', () => haptics('medium'));
  events.on('hiddenGemFound', () => haptics('success'));
};
