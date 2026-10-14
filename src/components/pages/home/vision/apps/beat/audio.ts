import { kits, trackPads, type SynthSettings, type Channel } from './model';
type Source = OscillatorNode | AudioBufferSourceNode;
type Voice = { nodes: AudioNode[]; sources: Source[]; envelope: GainNode; end: number; done: boolean };
export class BeatAudio {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly destination: MediaStreamAudioDestinationNode;
  private readonly input: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly output: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly softClip: WaveShaperNode;
  private readonly noiseBuffer: AudioBuffer;
  private readonly synthBus: BiquadFilterNode;
  private readonly dry: GainNode;
  readonly channels: { gain: GainNode; pan: StereoPannerNode; send: GainNode; analyser: AnalyserNode }[];
  private readonly filter: BiquadFilterNode;
  private readonly reverb: ConvolverNode;
  private readonly wet: GainNode;
  private kit = 0;
  private settings: SynthSettings = { cutoff: 2400, resonance: 1.2, space: .24, tone: .4, attack: .04, scale: true };
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
    this.compressor.ratio.value = 3.5;
    this.compressor.attack.value = .003;
    this.compressor.release.value = .18;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -4; this.limiter.knee.value = 0; this.limiter.ratio.value = 20;
    this.limiter.attack.value = .001; this.limiter.release.value = .08;
    this.softClip = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) curve[i] = .9 * Math.tanh((i / (curve.length - 1) * 2 - 1) * 1.2);
    this.softClip.curve = curve;
    this.output = ctx.createGain();
    this.output.gain.value = .7;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = .84;
    this.destination = ctx.createMediaStreamDestination();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.input.connect(this.filter).connect(this.compressor).connect(this.limiter).connect(this.softClip).connect(this.output).connect(this.analyser);
    this.reverb = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 1.7), ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 3.5) * .5;
    }
    this.reverb.buffer = impulse;
    this.wet = ctx.createGain();
    this.reverb.connect(this.wet).connect(this.input);
    this.channels = Array.from({ length: 9 }, () => {
      const gain = ctx.createGain(), pan = ctx.createStereoPanner(), send = ctx.createGain(), analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = .65;
      gain.connect(pan).connect(analyser).connect(this.input);
      pan.connect(send).connect(this.reverb);
      return { gain, pan, send, analyser };
    });
    this.analyser.connect(ctx.destination);
    this.output.connect(this.destination);
    this.synthBus = ctx.createBiquadFilter();
    this.synthBus.type = 'lowpass';
    this.dry = ctx.createGain();
    this.synthBus.connect(this.dry).connect(this.channels[8]!.gain);
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
  setKit(index: number): void { this.kit = Math.max(0, Math.min(kits.length - 1, index)); }
  setChannels(channels: Channel[]): void {
    const solo = channels.some(channel => channel.solo);
    channels.forEach((value, index) => {
      const channel = this.channels[index];
      if (!channel) return;
      const now = this.context.currentTime;
      channel.gain.gain.setTargetAtTime(value.muted || (solo && !value.solo) ? 0 : value.volume, now, .015);
      channel.pan.pan.setTargetAtTime(value.pan, now, .02);
      channel.send.gain.setTargetAtTime(value.send, now, .02);
    });
  }
  get reduction(): number { return -this.limiter.reduction; }
  click(time: number, accent: boolean): void {
    const voice = this.createVoice(time, .035, .07, this.input);
    this.tone(voice, time, accent ? 1500 : 1000, 'sine');
  }
  configure(settings: SynthSettings): void {
    this.settings = { ...settings };
    const now = this.context.currentTime;
    this.synthBus.frequency.setTargetAtTime(settings.cutoff, now, .025);
    this.synthBus.Q.setTargetAtTime(settings.resonance, now, .025);
    this.wet.gain.setTargetAtTime(settings.space, now, .025);
    this.filter.frequency.setTargetAtTime(Math.min(18000, settings.cutoff * 3), now, .025);
    this.dry.gain.setTargetAtTime(1 - settings.space * .3, now, .025);
  }
  private createVoice(time: number, duration: number, velocity: number, target: AudioNode = this.input, attack = .002): Voice {
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
    const kit = kits[this.kit]!;
    const track = trackPads.indexOf(pad as typeof trackPads[number]);
    const target = this.channels[track >= 0 ? track : 8]!.gain;
    const durations = [.48, .2, .22, .065, .52, .075, .35, .24, .14, .24, 1, .38, .48, .6, 1.4, 1.1];
    const voice = this.createVoice(time, (durations[pad] ?? .2) * kit.decay, velocity * (pad === 3 || pad === 4 || pad === 8 ? .19 : .38), target);
    if (this.kit === 4 && (pad === 5 || pad === 6 || pad === 7)) {
      // Modal partials suggest tabla membranes; this is synthesis, not a sampled instrument.
      const base = pad === 6 ? 115 : pad === 5 ? 310 : 390;
      [1, 2.02, 2.96, 4.08].forEach((ratio, i) => this.tone(voice, time, base * ratio * (pad === 6 ? 1.3 : 1), 'sine', base * ratio, 0, .65 / (i + 1)));
      this.noise(voice, time, 2200, 'bandpass', 3);
      return;
    }
    if (this.kit === 3 && pad !== 0 && pad !== 10) {
      this.tone(voice, time, (220 + pad * 95) * kit.pitch, 'sine', undefined, 0, .7);
      this.tone(voice, time, (220 + pad * 95) * 2.76, 'sine', undefined, 0, .22);
      return;
    }
    switch (pad) {
      case 0: this.tone(voice, time, 150 * kit.pitch, 'sine', 38 * kit.pitch); break;
      case 1: this.noise(voice, time, 1250, 'highpass'); this.tone(voice, time, 185 * kit.pitch, kit.tone, 90 * kit.pitch, 0, .35); break;
      case 2:
        // Three overlapping band-limited bursts give a clap its little crowd.
        this.noise(voice, time, 1500, 'bandpass', .8);
        for (let i = 0; i < 3; i++) {
          voice.envelope.gain.setValueAtTime(.02, time + i * .025);
          voice.envelope.gain.linearRampToValueAtTime(velocity * .4, time + i * .025 + .003);
        }
        voice.envelope.gain.exponentialRampToValueAtTime(.0001, voice.end);
        break;
      case 3: case 4: this.noise(voice, time, this.kit === 0 ? 4800 : 7500); break;
      case 5: this.tone(voice, time, 820, 'triangle', 550); this.tone(voice, time, 1650, 'sine', undefined, 0, .3); break;
      case 6: case 7: this.tone(voice, time, pad === 6 ? 160 : 280, 'sine', pad === 6 ? 70 : 140); break;
      case 8: this.noise(voice, time, 5600, 'bandpass', 1.2); break;
      case 9: this.tone(voice, time, 540, 'square', undefined, 0, .35); this.tone(voice, time, 800, 'square', undefined, 0, .28); break;
      case 10: this.tone(voice, time, 90 * kit.pitch, 'sine', 32.7 * kit.pitch); this.tone(voice, time, 65.4, 'triangle', 32.7, 0, .2); break;
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
  note(semitone: number, time = this.context.currentTime, duration = 20): () => void {
    if (this.closed) return () => {};
    const voiceFilter = this.context.createBiquadFilter();
    voiceFilter.type = 'lowpass'; voiceFilter.Q.value = this.settings.resonance;
    voiceFilter.frequency.setValueAtTime(180, time);
    voiceFilter.frequency.exponentialRampToValueAtTime(Math.max(200, this.settings.cutoff), time + this.settings.attack + .015);
    voiceFilter.frequency.exponentialRampToValueAtTime(Math.max(160, this.settings.cutoff * .4), time + this.settings.attack + .3);
    voiceFilter.connect(this.synthBus);
    const voice = this.createVoice(time, duration, .14, voiceFilter, Math.min(this.settings.attack + .005, duration / 3));
    voice.nodes.push(voiceFilter);
    const frequency = 261.6256 * Math.pow(2, semitone / 12);
    this.tone(voice, time, frequency, this.settings.tone > .5 ? 'sawtooth' : 'triangle', undefined, -8, .48);
    this.tone(voice, time, frequency, 'sawtooth', undefined, 8, this.settings.tone * .45);
    return () => {
      if (voice.done || this.closed) return;
      const now = this.context.currentTime;
      voice.envelope.gain.cancelAndHoldAtTime(now);
      voice.envelope.gain.exponentialRampToValueAtTime(.0001, now + .2);
      for (const source of voice.sources) { try { source.stop(now + .23); } catch { /* Already ended. */ } }
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
  }

  suspend(): void {
    this.stopAll();
    if (!this.closed) void this.context.suspend().catch(() => {});
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopAll();
    for (const node of [this.input, this.compressor, this.limiter, this.softClip, this.output, this.analyser, this.destination, this.synthBus, this.dry, this.filter, this.reverb, this.wet, ...this.channels.flatMap(channel => [channel.gain, channel.pan, channel.send, channel.analyser])]) node.disconnect();
    for (const track of this.destination.stream.getTracks()) track.stop();
    void this.context.close().catch(() => {});
  }
}
