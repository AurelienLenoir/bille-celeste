type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

export type Beep = (frequency: number, duration?: number, volume?: number, type?: OscillatorType) => void;

export type Audio = {
  /** Must be called from a user gesture so browsers allow sound. */
  unlock: () => void;
  beep: Beep;
};

export const createAudio = (): Audio => {
  let context: AudioContext | null = null;

  const unlock = () => {
    try {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio unavailable');
      context = context ?? new Ctor();
      void context.resume();
    } catch {
      context = null;
    }
  };

  const beep: Beep = (frequency, duration = 0.18, volume = 0.12, type = 'sine') => {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  };

  return { unlock, beep };
};
