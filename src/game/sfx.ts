import type { Beep } from '../engine/audio';
import type { EventBus, GameEvents } from './events';

/** Synthesised sound effects for game events. */
export const bindSoundEffects = (events: EventBus<GameEvents>, beep: Beep): void => {
  const later = (ms: number, play: () => void) => setTimeout(play, ms);
  events.on('crystalCollected', () => {
    beep(988, 0.15);
    later(70, () => beep(1480, 0.22));
  });
  events.on('checkpointReached', () => {
    beep(660, 0.12, 0.1, 'triangle');
    later(90, () => beep(880, 0.18, 0.1, 'triangle'));
  });
  events.on('levelWon', () => {
    beep(784, 0.2);
    later(120, () => beep(988, 0.2));
    later(240, () => beep(1318, 0.35));
  });
  events.on('fell', () => beep(220, 0.3, 0.1, 'sawtooth'));
};
