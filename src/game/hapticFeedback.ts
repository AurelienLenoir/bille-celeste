import type { Haptics } from '../engine/haptics';
import type { EventBus, GameEvents } from './events';

/** One vibration per game event, as listed in PLAN.md § 5.4. */
export const bindHapticFeedback = (events: EventBus<GameEvents>, haptics: Haptics): void => {
  events.on('crystalCollected', () => haptics('light'));
  events.on('checkpointReached', () => haptics('medium'));
  events.on('fell', () => haptics('heavy'));
  events.on('levelWon', () => haptics('success'));
};
