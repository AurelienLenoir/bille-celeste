type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

export type Beep = (frequency: number, duration?: number, volume?: number, type?: OscillatorType) => void;

/**
 * One synthesised note of a sound effect: a tone (optionally sliding to `to` Hz) or a burst of
 * filtered noise (`wave: 'noise'`, `frequency` is then the filter's centre). `at` delays it (s).
 */
export type SoundNote = {
  frequency: number;
  duration: number;
  volume?: number;
  wave?: OscillatorType | 'noise';
  to?: number;
  at?: number;
};

export type Audio = {
  /** Must be called from a user gesture so browsers allow sound. */
  unlock: () => void;
  beep: Beep;
  /** Plays a sound effect made of several notes. */
  play: (notes: readonly SoundNote[]) => void;
};

/** `enabled` is checked on every sound so the setting applies at once. */
export const createAudio = (enabled: () => boolean = () => true): Audio => {
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
    if (!context || !enabled()) return;
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

  let noiseBuffer: AudioBuffer | null = null;
  const noise = (ctx: AudioContext): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    noiseBuffer = buffer;
    return buffer;
  };

  const note = (ctx: AudioContext, n: SoundNote) => {
    const start = ctx.currentTime + (n.at ?? 0);
    const end = start + n.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(n.volume ?? 0.12, start + Math.min(0.015, n.duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(ctx.destination);
    if (n.wave === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = noise(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(n.frequency, start);
      if (n.to) filter.frequency.exponentialRampToValueAtTime(n.to, end);
      source.connect(filter).connect(gain);
      source.start(start);
      source.stop(end);
      return;
    }
    const osc = ctx.createOscillator();
    osc.type = n.wave ?? 'sine';
    osc.frequency.setValueAtTime(n.frequency, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, end);
    osc.connect(gain);
    osc.start(start);
    osc.stop(end);
  };

  const play = (notes: readonly SoundNote[]) => {
    if (!context || !enabled()) return;
    const ctx = context;
    notes.forEach((n) => note(ctx, n));
  };

  return { unlock, beep, play };
};
