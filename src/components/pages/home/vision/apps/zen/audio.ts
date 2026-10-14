type Tone = { source: OscillatorNode; gain: GainNode };
/** One context per garden, opened only after the visitor enables sound. */
export class GardenAudio {
  private readonly context = new AudioContext();
  private readonly master = this.context.createGain();
  private readonly compressor = this.context.createDynamicsCompressor();
  private readonly noise: AudioBuffer;
  private rainSource: AudioBufferSourceNode | undefined;
  private rainFilter: BiquadFilterNode | undefined;
  private rainGain: GainNode | undefined;
  private tones = new Set<Tone>();
  private closed = false;
  constructor() {
    this.master.gain.value = .34;
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 20;
    this.compressor.ratio.value = 5;
    this.master.connect(this.compressor).connect(this.context.destination);
    this.noise = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
    const channel = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < channel.length; i++) {
      last = .94 * last + .06 * (Math.random() * 2 - 1);
      channel[i] = last * 3;
    }
  }
  async resume(): Promise<boolean> {
    if (this.closed) return false;
    await this.context.resume();
    return !this.closed && this.context.state === 'running';
  }
  rain(on: boolean): void {
    if (this.closed) return;
    if (!on) { this.stopRain(); return; }
    if (this.rainSource) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noise; source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 3200;
    const gain = this.context.createGain(); gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(.12, this.context.currentTime + .8);
    source.connect(filter).connect(gain).connect(this.master); source.start();
    this.rainSource = source; this.rainFilter = filter; this.rainGain = gain;
  }
  private stopRain(): void {
    if (this.rainSource) { try { this.rainSource.stop(); } catch { /* Already stopped. */ } this.rainSource.disconnect(); }
    this.rainFilter?.disconnect(); this.rainGain?.disconnect();
    this.rainSource = undefined; this.rainFilter = undefined; this.rainGain = undefined;
  }
  private tone(frequency: number, duration: number, level: number, type: OscillatorType, to?: number): void {
    if (this.closed || this.context.state !== 'running' || this.tones.size >= 12) return;
    const now = this.context.currentTime;
    const source = this.context.createOscillator(), gain = this.context.createGain();
    source.type = type; source.frequency.setValueAtTime(frequency, now);
    if (to) source.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(level, now + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(gain).connect(this.master);
    const tone: Tone = { source, gain }; this.tones.add(tone);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.tones.delete(tone); };
    source.start(now); source.stop(now + duration + .02);
  }
  tok(): void { this.tone(760, .11, .17, 'sine', 260); this.tone(1280, .065, .045, 'triangle', 520); }
  chime(): void { this.tone(880, 2.4, .065, 'sine'); this.tone(1320, 1.7, .025, 'sine'); }
  suspend(): void {
    this.stopRain();
    for (const tone of this.tones) {
      tone.source.onended = null;
      try { tone.source.stop(); } catch { /* Already ended. */ }
      tone.source.disconnect(); tone.gain.disconnect();
    }
    this.tones.clear();
    if (!this.closed) void this.context.suspend().catch(() => {});
  }
  close(): void {
    if (this.closed) return;
    this.suspend(); this.closed = true;
    this.master.disconnect(); this.compressor.disconnect();
    void this.context.close().catch(() => {});
  }
}
