import type { Track } from './catalog';

export type SoundProfile = 'Studio' | 'Chai cup' | 'Silk Board cancellation';

/** Live, deterministic compositions. The first context is created inside a play gesture. */
export class MusicEngine {
  private context: AudioContext | undefined;
  private master: GainNode | undefined;
  private toneFilter: BiquadFilterNode | undefined;
  private analyser: AnalyserNode | undefined;
  private compressor: DynamicsCompressorNode | undefined;
  private noise: AudioBuffer | undefined;
  private voices = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;
  private anchor = 0;
  private offset = 0;
  private step = 0;
  private song: Track | undefined;
  private active = false;
  private disposed = false;
  private operation = 0;
  private volume = 0.65;
  private profile: SoundProfile = 'Studio';
  private samples = new Uint8Array(32);
  private ended: () => void;

  constructor(onEnded: () => void) {
    this.ended = onEnded;
  }

  get position(): number {
    const position = this.active && this.context ? this.offset + this.context.currentTime - this.anchor : this.offset;
    return Math.min(this.song?.duration ?? 0, Math.max(0, position));
  }

  levels(): number[] {
    if (!this.active || !this.analyser) return Array.from({ length: 18 }, () => 0.04);
    this.analyser.getByteFrequencyData(this.samples);
    return Array.from({ length: 18 }, (_, index) => (this.samples[index + 1] ?? 0) / 255);
  }

  private initialize(): AudioContext {
    if (this.context) return this.context;
    const context = new AudioContext();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    const analyser = context.createAnalyser();
    const compressor = context.createDynamicsCompressor();
    master.gain.value = 0;
    filter.type = 'lowpass';
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.82;
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    filter.connect(master);
    master.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(context.destination);
    const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = noise.getChannelData(0);
    let seed = 4231;
    for (let index = 0; index < samples.length; index++) {
      seed = (seed * 16807) % 2147483647;
      samples[index] = (seed / 2147483647) * 2 - 1;
    }
    this.context = context;
    this.master = master;
    this.toneFilter = filter;
    this.analyser = analyser;
    this.compressor = compressor;
    this.noise = noise;
    this.setProfile(this.profile);
    // Persistent routing is disconnected when the context closes.
    return context;
  }

  async play(song: Track, position = 0): Promise<boolean> {
    if (this.disposed) return false;
    const operation = ++this.operation;
    clearTimeout(this.suspendTimer);
    const context = this.initialize();
    await context.resume();
    if (context.state !== 'running') throw new Error('Audio context did not resume');
    if (this.disposed || operation !== this.operation) return false;
    this.clearVoices();
    this.song = song;
    this.offset = Math.min(Math.max(position, 0), song.duration);
    this.anchor = context.currentTime;
    this.step = Math.floor(this.offset / this.stepLength(song));
    this.active = true;
    this.master?.gain.cancelScheduledValues(context.currentTime);
    this.master?.gain.setValueAtTime(0, context.currentTime);
    this.master?.gain.linearRampToValueAtTime(this.volume * 0.7, context.currentTime + 0.12);
    this.schedule();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 70);
    return true;
  }

  pause(): void {
    ++this.operation;
    this.offset = this.position;
    this.active = false;
    clearInterval(this.timer);
    clearTimeout(this.suspendTimer);
    const context = this.context;
    if (!context) return;
    this.master?.gain.cancelScheduledValues(context.currentTime);
    this.master?.gain.setTargetAtTime(0, context.currentTime, 0.02);
    this.suspendTimer = setTimeout(() => {
      this.clearVoices();
      void context.suspend().catch(() => undefined);
    }, 90);
  }

  seek(position: number): void {
    const song = this.song;
    this.offset = Math.max(0, Math.min(position, song?.duration ?? 0));
    if (!this.active || !this.context || !song) return;
    this.clearVoices();
    this.anchor = this.context.currentTime;
    this.step = Math.floor(this.offset / this.stepLength(song));
    this.schedule();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.active && this.context)
      this.master?.gain.setTargetAtTime(this.volume * 0.7, this.context.currentTime, 0.03);
  }

  setProfile(profile: SoundProfile): void {
    this.profile = profile;
    if (!this.context || !this.toneFilter) return;
    const frequency = profile === 'Studio' ? 17000 : profile === 'Chai cup' ? 1500 : 4200;
    this.toneFilter.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.08);
    this.toneFilter.Q.setTargetAtTime(profile === 'Chai cup' ? 2.2 : 0.6, this.context.currentTime, 0.08);
  }

  private stepLength(song: Track): number {
    return 60 / song.bpm / 4;
  }

  private schedule(): void {
    const song = this.song;
    const context = this.context;
    if (!this.active || !song || !context) return;
    if (this.position >= song.duration) {
      this.pause();
      this.offset = song.duration;
      this.ended();
      return;
    }
    const length = this.stepLength(song);
    const horizon = context.currentTime + 0.22;
    while (this.anchor + this.step * length - this.offset < horizon) {
      const position = this.step * length;
      const start = Math.max(context.currentTime + 0.006, this.anchor + position - this.offset);
      if (position < song.duration) this.compose(song, this.step, start, length);
      this.step++;
    }
  }

  private connect(source: AudioScheduledSourceNode, nodes: AudioNode[], start: number, duration: number): void {
    this.voices.set(source, nodes);
    source.onended = () => {
      source.disconnect();
      nodes.forEach(node => node.disconnect());
      this.voices.delete(source);
    };
    source.start(start);
    source.stop(start + duration);
  }

  private note(midi: number, start: number, duration: number, amplitude: number, type: OscillatorType, cutoff = 2000): void {
    const context = this.context;
    const output = this.toneFilter;
    if (!context || !output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const attack = type === 'sine' || type === 'triangle' ? Math.min(0.035, duration / 5) : Math.min(0.2, duration / 4);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amplitude, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    this.connect(oscillator, [filter, gain], start, duration + 0.02);
  }

  private kick(start: number, strength = 0.2): void {
    const context = this.context;
    const output = this.toneFilter;
    if (!context || !output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(135, start);
    oscillator.frequency.exponentialRampToValueAtTime(42, start + 0.13);
    gain.gain.setValueAtTime(strength, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
    oscillator.connect(gain);
    gain.connect(output);
    this.connect(oscillator, [gain], start, 0.26);
  }

  private drum(start: number, snare: boolean, amplitude: number): void {
    const context = this.context;
    const output = this.toneFilter;
    if (!context || !output || !this.noise) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const duration = snare ? 0.17 : 0.055;
    source.buffer = this.noise;
    filter.type = snare ? 'bandpass' : 'highpass';
    filter.frequency.value = snare ? 1800 : 7000;
    gain.gain.setValueAtTime(amplitude, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    this.connect(source, [filter, gain], start, duration + 0.02);
  }

  private compose(song: Track, step: number, start: number, unit: number): void {
    const beat = Math.floor(step / 4);
    const bar = Math.floor(beat / (song.genre === 'Piano' ? 3 : 4));
    const roots = [48, 45, 53, 43];
    const root = roots[bar % roots.length] ?? 48;
    const beatLength = unit * 4;
    if (song.genre === 'Lo-fi') {
      if (step % 16 === 0)
        [0, 3, 7, 10].forEach(interval => this.note(root + 12 + interval, start, beatLength * 3.8, 0.032, 'triangle', 1100));
      if (step % 8 === 0) this.note(root, start, beatLength * 1.8, 0.11, 'sine');
      if ([0, 10].includes(step % 16)) this.kick(start, 0.18);
      if (step % 8 === 4) this.drum(start + 0.025, true, 0.07);
      if (step % 2 === 0) this.drum(start + (step % 4 === 2 ? 0.035 : 0), false, 0.032);
    } else if (song.genre === 'Ambient') {
      if (step % 8 === 0)
        [0, 7, 14, 19].forEach((interval, index) =>
          this.note(root + interval + 12, start + index * 0.025, beatLength * 4, 0.025, 'sawtooth', 600 + bar % 4 * 170));
      if (step % 16 === 8) this.note(root + 31, start, beatLength * 3, 0.028, 'sine');
    } else if (song.genre === 'Synthwave') {
      const arp = [0, 7, 12, 15, 12, 7, 19, 7];
      if (step % 2 === 0) this.note(root + 12 + (arp[Math.floor(step / 2) % 8] ?? 0), start, unit * 1.8, 0.075, 'sawtooth', 2400);
      if (step % 4 === 0) {
        this.kick(start);
        this.note(root - 12, start, beatLength * 0.8, 0.12, 'sawtooth', 350);
      }
      if (step % 8 === 4) this.drum(start, true, 0.1);
      if (step % 2 === 1) this.drum(start, false, 0.025);
    } else if (song.genre === 'Piano') {
      if (step % 12 === 0) this.note(root - 12, start, beatLength * 2.8, 0.16, 'triangle', 2600);
      if (step % 4 === 0) {
        const interval = [0, 7, 12][beat % 3] ?? 0;
        [0, 12].forEach((octave, index) => this.note(root + interval + octave, start, beatLength * 2, 0.075 / (index + 1), 'sine'));
      }
      if (step % 6 === 2) this.note(root + 24 + ([0, 3, 7, 10][bar % 4] ?? 0), start, beatLength, 0.055, 'triangle', 2200);
    } else if (song.genre === 'Drum & bass') {
      if ([0, 6, 10].includes(step % 16)) this.kick(start, 0.24);
      if ([4, 12].includes(step % 16)) this.drum(start, true, 0.16);
      if (step % 2 === 0 || step % 16 === 11) this.drum(start, false, step % 4 === 0 ? 0.05 : 0.027);
      if (step % 4 === 0) this.note(root - 12 + (step % 16 === 8 ? 7 : 0), start, beatLength * 0.85, 0.16, 'sawtooth', 260);
      if (step % 8 === 2) this.note(root + 24, start, unit * 3, 0.05, 'square', 1800);
    } else {
      if (step % 8 === 0)
        [0, 7, 12, 19].forEach((interval, index) =>
          this.note(33 + interval + (Math.floor(bar / 4) % 2) * 2, start, beatLength * 5, 0.026 / (1 + index * 0.2),
            index % 2 === 0 ? 'sine' : 'sawtooth', 280 + (bar % 8) * 45));
    }
  }

  private clearVoices(): void {
    for (const [source, nodes] of this.voices) {
      source.onended = null;
      try { source.stop(); } catch { /* A scheduled voice may have just ended. */ }
      source.disconnect();
      nodes.forEach(node => node.disconnect());
    }
    this.voices.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.pause();
    clearTimeout(this.suspendTimer);
    this.clearVoices();
    this.master?.disconnect();
    this.toneFilter?.disconnect();
    this.analyser?.disconnect();
    this.compressor?.disconnect();
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
  }
}
