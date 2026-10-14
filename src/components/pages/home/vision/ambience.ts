/**
 * Ambient sound for the headset's environments, made in the browser: no audio files.
 * Everything is shaped noise and a few sine tones, kept quiet. Nothing plays until `set` is called
 * from a user gesture, which is what browsers require.
 */
export type AmbienceKind = 'none' | 'wind' | 'waves' | 'water' | 'forest' | 'night' | 'space';

export function createAmbience() {
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let stopCurrent: (() => void) | undefined;
  let current: AmbienceKind = 'none';

  const ensure = () => {
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') void context.resume();
    return context;
  };
  /** Two seconds of looping noise; `brown` leans it toward a low rumble. */
  const noise = (audio: AudioContext, brown: boolean) => {
    const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = brown ? (last + 0.02 * white) / 1.02 : white;
      data[i] = brown ? last * 3.5 : white;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  };
  /** A bed of filtered noise whose loudness rises and falls every `period` seconds. */
  const bed = (audio: AudioContext, out: AudioNode, options: { brown: boolean; type: BiquadFilterType; frequency: number; q?: number; level: number; swell: number; period: number }) => {
    const source = noise(audio, options.brown);
    const filter = audio.createBiquadFilter();
    filter.type = options.type; filter.frequency.value = options.frequency; filter.Q.value = options.q ?? 0.7;
    const gain = audio.createGain();
    gain.gain.value = options.level;
    const lfo = audio.createOscillator();
    lfo.frequency.value = 1 / options.period;
    const depth = audio.createGain();
    depth.gain.value = options.level * options.swell;
    lfo.connect(depth).connect(gain.gain);
    source.connect(filter).connect(gain).connect(out);
    source.start(); lfo.start();
    return () => { source.stop(); lfo.stop(); gain.disconnect(); };
  };
  /** Short pitched calls at random moments: birds by day, insects by night. */
  const calls = (audio: AudioContext, out: AudioNode, options: { low: number; high: number; every: number; length: number; trill: number; level: number }) => {
    let alive = true, timer = 0;
    const call = () => {
      if (!alive) return;
      const start = audio.currentTime + 0.02, pitch = options.low + Math.random() * (options.high - options.low);
      const notes = 1 + Math.floor(Math.random() * options.trill);
      for (let n = 0; n < notes; n++) {
        const tone = audio.createOscillator(), gain = audio.createGain(), at = start + n * options.length * 1.25;
        tone.type = 'sine';
        tone.frequency.setValueAtTime(pitch * (1 + n * 0.03), at);
        tone.frequency.exponentialRampToValueAtTime(pitch * (0.92 + Math.random() * 0.22), at + options.length);
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(options.level * (0.5 + Math.random() * 0.5), at + options.length * 0.25);
        gain.gain.linearRampToValueAtTime(0, at + options.length);
        tone.connect(gain).connect(out);
        tone.start(at); tone.stop(at + options.length + 0.05);
      }
      timer = window.setTimeout(call, options.every * (0.4 + Math.random() * 1.4) * 1000);
    };
    timer = window.setTimeout(call, 600);
    return () => { alive = false; clearTimeout(timer); };
  };

  const RECIPES: Record<Exclude<AmbienceKind, 'none'>, (audio: AudioContext, out: AudioNode) => (() => void)[]> = {
    wind: (audio, out) => [
      bed(audio, out, { brown: true, type: 'lowpass', frequency: 420, level: 0.5, swell: 0.55, period: 9 }),
      bed(audio, out, { brown: false, type: 'bandpass', frequency: 900, q: 0.6, level: 0.035, swell: 0.8, period: 5.5 }),
    ],
    waves: (audio, out) => [
      bed(audio, out, { brown: true, type: 'lowpass', frequency: 700, level: 0.45, swell: 0.85, period: 8 }),
      bed(audio, out, { brown: false, type: 'highpass', frequency: 2400, level: 0.02, swell: 0.95, period: 8 }),
    ],
    water: (audio, out) => [
      bed(audio, out, { brown: true, type: 'lowpass', frequency: 520, level: 0.28, swell: 0.6, period: 4.5 }),
      bed(audio, out, { brown: false, type: 'bandpass', frequency: 1800, q: 1.2, level: 0.012, swell: 0.9, period: 3.1 }),
      calls(audio, out, { low: 2400, high: 3800, every: 7, length: 0.09, trill: 3, level: 0.018 }),
    ],
    forest: (audio, out) => [
      bed(audio, out, { brown: true, type: 'lowpass', frequency: 600, level: 0.3, swell: 0.5, period: 11 }),
      calls(audio, out, { low: 2200, high: 4400, every: 3.2, length: 0.08, trill: 5, level: 0.022 }),
      calls(audio, out, { low: 1100, high: 1500, every: 9, length: 0.22, trill: 2, level: 0.016 }),
    ],
    night: (audio, out) => [
      bed(audio, out, { brown: true, type: 'lowpass', frequency: 300, level: 0.22, swell: 0.4, period: 13 }),
      calls(audio, out, { low: 4300, high: 4700, every: 0.9, length: 0.035, trill: 7, level: 0.012 }),
    ],
    space: (audio, out) => {
      const hum = audio.createOscillator(), gain = audio.createGain();
      hum.type = 'sine'; hum.frequency.value = 54; gain.gain.value = 0.05;
      hum.connect(gain).connect(out); hum.start();
      return [() => { hum.stop(); gain.disconnect(); }, bed(audio, out, { brown: true, type: 'lowpass', frequency: 160, level: 0.3, swell: 0.5, period: 17 })];
    },
  };

  return {
    /** Fade to another ambience, or to silence with `none`. `level` is 0..1. */
    set(kind: AmbienceKind, level = 1) {
      if (kind === 'none' && !context) return;
      const audio = ensure();
      if (!master) return;
      const target = kind === 'none' ? 0 : 0.5 * Math.max(0, Math.min(1, level));
      master.gain.cancelScheduledValues(audio.currentTime);
      if (kind !== current) {
        // Dip to silence, swap the sources, then rise again.
        const previous = stopCurrent;
        master.gain.setTargetAtTime(0, audio.currentTime, 0.18);
        current = kind;
        stopCurrent = undefined;
        window.setTimeout(() => {
          previous?.();
          if (current !== kind || !master) return;
          if (kind !== 'none') { const stops = RECIPES[kind](audio, master); stopCurrent = () => stops.forEach((stop) => stop()); }
          master.gain.setTargetAtTime(target, audio.currentTime, 0.6);
        }, 520);
      } else master.gain.setTargetAtTime(target, audio.currentTime, 0.3);
    },
    dispose() {
      stopCurrent?.();
      stopCurrent = undefined;
      void context?.close();
      context = undefined; master = undefined; current = 'none';
    },
  };
}
