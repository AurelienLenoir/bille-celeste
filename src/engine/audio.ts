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

/** Volumes from 0 (silent) to 1, read again on `refresh`. */
export type AudioLevels = { sfx: number; music: number };

/** A continuous sound (rolling ball) whose loudness and colour change smoothly. */
export type LoopVoice = {
  /** `gain` 0..1 of the effects bus, `frequency` of the low-pass filter (Hz), `q` its resonance. */
  set: (gain: number, frequency: number, q?: number) => void;
};

export type Audio = {
  /** Must be called from a user gesture so browsers allow sound. */
  unlock: () => void;
  beep: Beep;
  /** Plays a sound effect made of several notes. */
  play: (notes: readonly SoundNote[]) => void;
  /** Applies the current volumes (call when the settings change). */
  refresh: () => void;
  /** The audio context once unlocked, and the bus the music plays into. */
  context: () => AudioContext | null;
  musicBus: () => AudioNode | null;
  /** Shared white-noise buffer (one second), for noisy instruments. */
  noise: (ctx: AudioContext) => AudioBuffer;
  /** A looping filtered-noise voice on the effects bus. Silent until `set` gives it a gain. */
  loop: () => LoopVoice;
  /** Stops all sound while the app is in the background. */
  suspend: () => void;
  resume: () => void;
};

const BUS_RAMP = 0.08;

/** Web Audio with two buses (effects, music). `levels` is read on `refresh` so settings apply at once. */
export const createAudio = (levels: () => AudioLevels = () => ({ sfx: 1, music: 1 })): Audio => {
  let context: AudioContext | null = null;
  let sfx: GainNode | null = null;
  let music: GainNode | null = null;
  const loops: { ready: (ctx: AudioContext, bus: GainNode) => void }[] = [];

  const refresh = () => {
    if (!context || !sfx || !music) return;
    const { sfx: s, music: m } = levels();
    sfx.gain.setTargetAtTime(s, context.currentTime, BUS_RAMP);
    music.gain.setTargetAtTime(m, context.currentTime, BUS_RAMP);
  };

  const unlock = () => {
    try {
      const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio unavailable');
      if (!context) {
        context = new Ctor();
        sfx = context.createGain();
        music = context.createGain();
        sfx.gain.value = music.gain.value = 0;
        sfx.connect(context.destination);
        music.connect(context.destination);
        const ctx = context;
        const bus = sfx;
        loops.forEach((l) => l.ready(ctx, bus));
      }
      void context.resume();
      refresh();
    } catch {
      context = null;
    }
  };

  const beep: Beep = (frequency, duration = 0.18, volume = 0.12, type = 'sine') =>
    play([{ frequency, duration, volume, wave: type }]);

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

  const note = (ctx: AudioContext, out: AudioNode, n: SoundNote) => {
    const start = ctx.currentTime + (n.at ?? 0);
    const end = start + n.duration;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(n.volume ?? 0.12, start + Math.min(0.015, n.duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    gain.connect(out);
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
    if (!context || !sfx) return;
    const ctx = context;
    const out = sfx;
    notes.forEach((n) => note(ctx, out, n));
  };

  const loop = (): LoopVoice => {
    let voice: { gain: GainNode; filter: BiquadFilterNode; ctx: AudioContext } | null = null;
    loops.push({
      ready: (ctx, bus) => {
        const source = ctx.createBufferSource();
        source.buffer = noise(ctx);
        source.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(bus);
        source.start();
        voice = { gain, filter, ctx };
      },
    });
    if (context && sfx) loops[loops.length - 1]?.ready(context, sfx);
    return {
      set: (gain, frequency, q = 0.8) => {
        if (!voice) return;
        const now = voice.ctx.currentTime;
        voice.gain.gain.setTargetAtTime(gain, now, 0.05);
        voice.filter.frequency.setTargetAtTime(frequency, now, 0.05);
        voice.filter.Q.setTargetAtTime(q, now, 0.1);
      },
    };
  };

  return {
    unlock,
    beep,
    play,
    refresh,
    context: () => context,
    musicBus: () => music,
    noise,
    loop,
    suspend: () => void context?.suspend(),
    resume: () => void context?.resume(),
  };
};
