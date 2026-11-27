import type { Audio } from '../engine/audio';
import type { EventBus, GameEvents } from './events';
import { MODIFIERS } from './modifiers';

/** Synthesised sound effects for game events; each bonus and malus brings its own (game/modifiers/). */
export const bindSoundEffects = (events: EventBus<GameEvents>, { beep, play }: Pick<Audio, 'beep' | 'play'>): void => {
  const later = (ms: number, sound: () => void) => setTimeout(sound, ms);
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
  events.on('modifierFired', ({ type }) => play(MODIFIERS[type].sound));
  events.on('effectEnded', () => play([{ frequency: 660, to: 440, duration: 0.18, wave: 'triangle', volume: 0.06 }]));
  events.on('shieldSaved', () =>
    play([
      { frequency: 1320, to: 660, duration: 0.25, volume: 0.1 },
      { frequency: 400, to: 1200, duration: 0.3, wave: 'noise', volume: 0.08 },
    ]),
  );
  events.on('hiddenGemFound', () =>
    play([1047, 1319, 1568, 2093].map((frequency, i) => ({ frequency, duration: 0.25, volume: 0.09, at: i * 0.08 }))),
  );
};
