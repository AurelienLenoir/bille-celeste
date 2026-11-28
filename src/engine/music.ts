import { createRandom } from './math';

/** Scales as semitone offsets from the root. */
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
} as const;

export type ScaleName = keyof typeof SCALES;
export type Instrument = 'pad' | 'bass' | 'lead' | 'bell' | 'kick' | 'hat' | 'snare';

/**
 * A looping piece of music, described as data: the melody is composed from the seed, on the
 * chords of the progression, so each world gets its own tune without any recorded file.
 */
export type Song = {
  bpm: number;
  /** MIDI note of the scale's root (60 = middle C). */
  root: number;
  scale: ScaleName;
  /** One chord per bar, as the scale degree of its root (0-based). */
  progression: readonly number[];
  seed: number;
  /** Instrument playing the tune. */
  lead: 'lead' | 'bell';
  /** Notes of the tune per bar (eighths), 0 = no tune. */
  density: number;
  /** Drum pattern over 16 sixteenths: k kick, s snare, h hat, '.' rest. Empty: no drums. */
  drums: string;
  /** Bass rhythm over 8 eighths: x plays the chord root, '.' rest. */
  bass: string;
  /** 0 straight, up to 0.3 for a lazy shuffle. */
  swing: number;
};

export type MusicNote = {
  instrument: Instrument;
  /** Start within the bar, in beats. */
  beat: number;
  /** Length in beats. */
  length: number;
  /** MIDI note (ignored by drums). */
  midi: number;
  velocity: number;
};

export const BEATS_PER_BAR = 4;

const degreeToMidi = (song: Song, degree: number, octave = 0): number => {
  const scale = SCALES[song.scale];
  const n = scale.length;
  const wrapped = ((degree % n) + n) % n;
  const octaves = Math.floor(degree / n) + octave;
  return song.root + (scale[wrapped] ?? 0) + 12 * octaves;
};

/** The triad on a scale degree, as degrees (root, third, fifth). */
const triad = (degree: number) => [degree, degree + 2, degree + 4];

/** Swing pushes every off-beat eighth later. */
const swung = (song: Song, eighth: number) => eighth / 2 + (eighth % 2 ? song.swing / 2 : 0);

/**
 * The notes of bar `bar` (any integer, the song loops over its progression). Pure and
 * deterministic: the same song and bar always give the same notes.
 */
export const composeBar = (song: Song, bar: number): MusicNote[] => {
  const length = song.progression.length;
  const index = ((bar % length) + length) % length;
  const chord = song.progression[index] ?? 0;
  const notes: MusicNote[] = [];

  for (const degree of triad(chord)) {
    notes.push({
      instrument: 'pad',
      beat: 0,
      length: BEATS_PER_BAR,
      midi: degreeToMidi(song, degree, -1),
      velocity: 0.5,
    });
  }

  [...song.bass].forEach((c, i) => {
    if (c !== 'x') return;
    notes.push({
      instrument: 'bass',
      beat: swung(song, i),
      length: 0.45,
      midi: degreeToMidi(song, chord, -2),
      velocity: 0.8,
    });
  });

  [...song.drums].forEach((c, i) => {
    const instrument = c === 'k' ? 'kick' : c === 's' ? 'snare' : c === 'h' ? 'hat' : undefined;
    if (!instrument) return;
    const beat = i / 4 + (i % 4 === 2 ? song.swing / 2 : 0);
    notes.push({ instrument, beat, length: 0.25, midi: 0, velocity: instrument === 'hat' ? 0.4 : 0.8 });
  });

  // The tune: the same seed per position in the progression, so the melody repeats each loop
  // (and its second half answers the first one, which makes it singable).
  const rnd = createRandom(song.seed * 131 + (index % Math.max(1, length / 2)) * 17 + 1);
  const tones = triad(chord);
  let previous = tones[0] ?? 0;
  for (let i = 0; i < 8; i++) {
    if (rnd() >= song.density / 8) continue;
    const onBeat = i % 2 === 0;
    const pool = onBeat ? tones : [previous - 1, previous + 1, ...tones];
    const degree = pool[Math.floor(rnd() * pool.length)] ?? previous;
    previous = degree;
    const lift = index >= length / 2 && i >= 6 ? 1 : 0;
    notes.push({
      instrument: song.lead,
      beat: swung(song, i),
      length: onBeat ? 0.9 : 0.45,
      midi: degreeToMidi(song, degree + lift, 1),
      velocity: onBeat ? 0.7 : 0.5,
    });
  }
  return notes;
};

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export const secondsPerBeat = (song: Song): number => 60 / song.bpm;

type Voice = (ctx: AudioContext, out: AudioNode, note: MusicNote, at: number, beat: number) => void;

const envelope = (ctx: AudioContext, out: AudioNode, at: number, peak: number, attack: number, end: number) => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  gain.connect(out);
  return gain;
};

const tone = (
  ctx: AudioContext,
  type: OscillatorType,
  hz: number,
  into: AudioNode,
  at: number,
  end: number,
  detune = 0,
) => {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = hz;
  osc.detune.value = detune;
  osc.connect(into);
  osc.start(at);
  osc.stop(end + 0.05);
};

const voices = (noise: (ctx: AudioContext) => AudioBuffer): Record<Instrument, Voice> => {
  const burst = (
    ctx: AudioContext,
    out: AudioNode,
    at: number,
    length: number,
    filter: BiquadFilterType,
    hz: number,
    peak: number,
  ) => {
    const source = ctx.createBufferSource();
    source.buffer = noise(ctx);
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = hz;
    source.connect(f).connect(envelope(ctx, out, at, peak, 0.002, at + length));
    source.start(at, Math.random() * 0.5);
    source.stop(at + length + 0.02);
  };
  return {
    pad: (ctx, out, n, at, beat) => {
      const end = at + n.length * beat;
      const gain = envelope(ctx, out, at, 0.035 * n.velocity, Math.min(0.8, n.length * beat * 0.4), end);
      tone(ctx, 'triangle', midiToHz(n.midi), gain, at, end, -6);
      tone(ctx, 'sine', midiToHz(n.midi), gain, at, end, 7);
    },
    bass: (ctx, out, n, at, beat) => {
      const end = at + n.length * beat;
      tone(ctx, 'triangle', midiToHz(n.midi), envelope(ctx, out, at, 0.16 * n.velocity, 0.01, end), at, end);
    },
    lead: (ctx, out, n, at, beat) => {
      const end = at + n.length * beat;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2200;
      filter.connect(envelope(ctx, out, at, 0.06 * n.velocity, 0.01, end));
      tone(ctx, 'square', midiToHz(n.midi), filter, at, end);
    },
    bell: (ctx, out, n, at, beat) => {
      const end = at + Math.max(0.6, n.length * beat * 1.6);
      const gain = envelope(ctx, out, at, 0.07 * n.velocity, 0.004, end);
      tone(ctx, 'sine', midiToHz(n.midi), gain, at, end);
      tone(
        ctx,
        'sine',
        midiToHz(n.midi) * 2.76,
        envelope(ctx, out, at, 0.015 * n.velocity, 0.002, at + 0.25),
        at,
        at + 0.25,
      );
    },
    kick: (ctx, out, n, at) => {
      const end = at + 0.25;
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(140, at);
      osc.frequency.exponentialRampToValueAtTime(45, end);
      osc.connect(envelope(ctx, out, at, 0.3 * n.velocity, 0.003, end));
      osc.start(at);
      osc.stop(end + 0.02);
    },
    snare: (ctx, out, n, at) => burst(ctx, out, at, 0.14, 'bandpass', 1800, 0.12 * n.velocity),
    hat: (ctx, out, n, at) => burst(ctx, out, at, 0.04, 'highpass', 7000, 0.06 * n.velocity),
  };
};

export type MusicPlayer = {
  /** Crossfades to `song` (undefined: silence). Playing the current song again does nothing. */
  play: (song: Song | undefined) => void;
  /** Call once the audio context exists (after the first tap). */
  wake: () => void;
};

const LOOKAHEAD = 0.25;
const FADE = 1.2;

/** Plays songs into `bus`, scheduling a little ahead of time on the audio clock. */
export const createMusicPlayer = (
  context: () => AudioContext | null,
  bus: () => AudioNode | null,
  noise: (ctx: AudioContext) => AudioBuffer,
): MusicPlayer => {
  const instruments = voices(noise);
  let wanted: Song | undefined;
  let current: { song: Song; out: GainNode; bar: number; barStart: number } | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;

  const fadeOut = (ctx: AudioContext, out: GainNode) => {
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, FADE / 4);
    setTimeout(() => out.disconnect(), FADE * 1500);
  };

  const schedule = () => {
    const ctx = context();
    const into = bus();
    if (!ctx || !into) return;
    if (current?.song !== wanted) {
      if (current) fadeOut(ctx, current.out);
      current = undefined;
      if (wanted) {
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, ctx.currentTime);
        out.gain.setTargetAtTime(1, ctx.currentTime + 0.1, FADE / 4);
        out.connect(into);
        current = { song: wanted, out, bar: 0, barStart: ctx.currentTime + 0.1 };
      }
    }
    if (!current) return;
    const beat = secondsPerBeat(current.song);
    // After a long suspension (app in the background), start again from now instead of catching up.
    if (current.barStart + BEATS_PER_BAR * beat < ctx.currentTime) current.barStart = ctx.currentTime + 0.05;
    while (current.barStart < ctx.currentTime + LOOKAHEAD) {
      for (const n of composeBar(current.song, current.bar)) {
        instruments[n.instrument](ctx, current.out, n, current.barStart + n.beat * beat, beat);
      }
      current.bar++;
      current.barStart += BEATS_PER_BAR * beat;
    }
  };

  const wake = () => {
    timer ??= setInterval(schedule, 60);
    schedule();
  };

  return {
    play: (song) => {
      wanted = song;
      if (timer) schedule();
    },
    wake,
  };
};
