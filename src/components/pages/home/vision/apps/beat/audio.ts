import type { SynthSettings } from './model';
type Source = OscillatorNode | AudioBufferSourceNode;
type Voice = { nodes: AudioNode[]; sources: Source[]; envelope: GainNode; end: number; done: boolean };
export class BeatAudio {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly destination: MediaStreamAudioDestinationNode;
  private readonly input: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly output: GainNode;
  private readonly limiter: WaveShaperNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly synthBus: BiquadFilterNode;
  private readonly dry: GainNode;
  private delay!: DelayNode;
  private wet!: GainNode;
  private feedback!: GainNode;
  private settings: SynthSettings = { cutoff: 1600, resonance: 1.2, delay: .2, scale: true };
  private voices = new Set<Voice>();
  private closed = false;

  constructor() {
    this.context = new AudioContext();
    const ctx = this.context;
    this.input = ctx.createGain();
    this.input.gain.value = .7;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = .003;
    this.compressor.release.value = .18;
    this.limiter = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) curve[i] = .9 * Math.tanh((i / (curve.length - 1) * 2 - 1) * 1.2);
    this.limiter.curve = curve;
    this.output = ctx.createGain();
    this.output.gain.value = .7;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = .84;
    this.destination = ctx.createMediaStreamDestination();
    this.input.connect(this.compressor).connect(this.limiter).connect(this.output).connect(this.analyser);
    this.analyser.connect(ctx.destination);
    this.output.connect(this.destination);
    this.synthBus = ctx.createBiquadFilter();
    this.synthBus.type = 'lowpass';
    this.dry = ctx.createGain();
    this.synthBus.connect(this.dry).connect(this.input);
    this.setupDelay();
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.configure(this.settings);
  }
  async resume(): Promise<boolean> {
    if (this.closed) return false;
    await this.context.resume();
    return !this.closed && this.context.state === 'running';
  }
  private setupDelay(): void {
    this.delay = this.context.createDelay(1);
    this.delay.delayTime.value = .28;
    this.wet = this.context.createGain();
    this.wet.gain.value = this.settings.delay;
    this.feedback = this.context.createGain();
    this.feedback.gain.value = .3;
    this.synthBus.connect(this.delay);
    this.delay.connect(this.feedback).connect(this.delay);
    this.delay.connect(this.wet).connect(this.input);
  }
  configure(settings: SynthSettings): void {
    this.settings = { ...settings };
    const now = this.context.currentTime;
    this.synthBus.frequency.setTargetAtTime(settings.cutoff, now, .025);
    this.synthBus.Q.setTargetAtTime(settings.resonance, now, .025);
    this.wet.gain.setTargetAtTime(settings.delay, now, .025);
    this.dry.gain.setTargetAtTime(1 - settings.delay * .4, now, .025);
  }
  private createVoice(time: number, duration: number, velocity: number, target = this.input, attack = .002): Voice {
    if (this.voices.size >= 48) {
      const oldest = this.voices.values().next().value as Voice | undefined;
      if (oldest) this.disposeVoice(oldest);
    }
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, velocity), time + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    envelope.connect(target);
    const voice: Voice = { nodes: [envelope], sources: [], envelope, end: time + duration, done: false };
    this.voices.add(voice);
    return voice;
  }
  private startSource(voice: Voice, source: Source, time: number): void {
    voice.sources.push(source);
    voice.nodes.push(source);
    source.onended = () => {
      if (voice.done) return;
      source.disconnect();
      if (voice.sources.every(item => item === source || item.onended === null)) this.disposeVoice(voice);
      source.onended = null;
    };
    source.start(time);
    source.stop(voice.end + .04);
  }
  private tone(voice: Voice, time: number, frequency: number, type: OscillatorType = 'sine', endFrequency?: number, detune = 0, level = 1): void {
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.detune.value = detune;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, voice.end);
    const gain = this.context.createGain();
    gain.gain.value = level;
    voice.nodes.push(gain);
    oscillator.connect(gain).connect(voice.envelope);
    this.startSource(voice, oscillator, time);
  }
  private noise(voice: Voice, time: number, frequency: number, type: BiquadFilterType = 'highpass', q = .7): void {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    voice.nodes.push(filter);
    source.connect(filter).connect(voice.envelope);
    this.startSource(voice, source, time);
  }
  hit(pad: number, time = this.context.currentTime, velocity = .75): void {
    if (this.closed) return;
    const durations = [.48, .2, .22, .065, .52, .075, .35, .24, .14, .24, 1, .38, .48, .6, 1.4, 1.1];
    const voice = this.createVoice(time, durations[pad] ?? .2, velocity * (pad === 3 || pad === 4 || pad === 8 ? .19 : .38), pad === 11 || pad === 12 ? this.synthBus : this.input);
    switch (pad) {
      case 0: this.tone(voice, time, 150, 'sine', 38); break;
      case 1: this.noise(voice, time, 1250, 'highpass'); this.tone(voice, time, 185, 'triangle', 90, 0, .35); break;
      case 2:
        // Three overlapping band-limited bursts give a clap its little crowd.
        this.noise(voice, time, 1500, 'bandpass', .8);
        for (let i = 0; i < 3; i++) {
          voice.envelope.gain.setValueAtTime(.02, time + i * .025);
          voice.envelope.gain.linearRampToValueAtTime(velocity * .4, time + i * .025 + .003);
        }
        voice.envelope.gain.exponentialRampToValueAtTime(.0001, voice.end);
        break;
      case 3: case 4: this.noise(voice, time, 7500); break;
      case 5: this.tone(voice, time, 820, 'triangle', 550); this.tone(voice, time, 1650, 'sine', undefined, 0, .3); break;
      case 6: case 7: this.tone(voice, time, pad === 6 ? 160 : 280, 'sine', pad === 6 ? 70 : 140); break;
      case 8: this.noise(voice, time, 5600, 'bandpass', 1.2); break;
      case 9: this.tone(voice, time, 540, 'square', undefined, 0, .35); this.tone(voice, time, 800, 'square', undefined, 0, .28); break;
      case 10: this.tone(voice, time, 90, 'sine', 32.7); this.tone(voice, time, 65.4, 'triangle', 32.7, 0, .2); break;
      case 11: for (const f of [261.63, 311.13, 392]) this.tone(voice, time, f, 'sawtooth', undefined, -4, .2); break;
      case 12: this.tone(voice, time, 523.25, 'triangle'); this.tone(voice, time, 1046.5, 'sine', undefined, 0, .2); break;
      case 13: {
        const oscillator = this.context.createOscillator();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 130.81;
        for (const [frequency, level] of [[730, .65], [1090, .4], [2440, .18]]) {
          if (frequency === undefined || level === undefined) continue;
          const filter = this.context.createBiquadFilter();
          filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 7;
          const gain = this.context.createGain(); gain.gain.value = level;
          voice.nodes.push(filter, gain); oscillator.connect(filter).connect(gain).connect(voice.envelope);
        }
        this.startSource(voice, oscillator, time);
        break;
      }
      case 14:
        this.noise(voice, time, 2400, 'bandpass');
        this.tone(voice, time, 180, 'sawtooth', 1800, 0, .2);
        voice.envelope.gain.cancelScheduledValues(time);
        voice.envelope.gain.setValueAtTime(.0001, time);
        voice.envelope.gain.exponentialRampToValueAtTime(velocity * .24, time + 1.15);
        voice.envelope.gain.exponentialRampToValueAtTime(.0001, voice.end);
        break;
      default: this.noise(voice, time, 800, 'lowpass'); this.tone(voice, time, 110, 'sine', 28);
    }
  }
  note(semitone: number): () => void {
    if (this.closed) return () => {};
    const now = this.context.currentTime;
    const voice = this.createVoice(now, 20, .13, this.synthBus, .13);
    const frequency = 261.6256 * Math.pow(2, semitone / 12);
    this.tone(voice, now, frequency, 'sawtooth', undefined, -8, .48);
    this.tone(voice, now, frequency, 'sawtooth', undefined, 8, .48);
    return () => {
      if (voice.done || this.closed) return;
      const time = this.context.currentTime;
      const gain = voice.envelope.gain;
      gain.cancelAndHoldAtTime(time);
      gain.exponentialRampToValueAtTime(.0001, time + .28);
      for (const source of voice.sources) { try { source.stop(time + .3); } catch { /* Already ended. */ } }
    };
  }
  private disposeVoice(voice: Voice): void {
    if (voice.done) return;
    voice.done = true;
    for (const source of voice.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Already stopped. */ }
    }
    for (const node of voice.nodes) node.disconnect();
    this.voices.delete(voice);
  }
  stopAll(): void {
    for (const voice of this.voices) this.disposeVoice(voice);
    if (!this.closed) {
      this.synthBus.disconnect(this.delay);
      this.delay.disconnect(); this.feedback.disconnect(); this.wet.disconnect();
      this.setupDelay();
    }
  }
  suspend(): void {
    this.stopAll();
    if (!this.closed) void this.context.suspend().catch(() => {});
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopAll();
    for (const node of [this.input, this.compressor, this.limiter, this.output, this.analyser, this.destination, this.synthBus, this.dry, this.delay, this.wet, this.feedback]) node.disconnect();
    for (const track of this.destination.stream.getTracks()) track.stop();
    void this.context.close().catch(() => {});
  }
}
