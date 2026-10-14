import type { Surface } from './catalog';

/** Gesture-unlocked, quiet procedural feedback. No audio file downloads. */
export class ImpactSound {
  private context?: AudioContext;
  private noise?: AudioBuffer;
  private last = 0;
  private enabled = false;

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) void this.context?.suspend();
  }

  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.noise = this.context.createBuffer(1, Math.floor(this.context.sampleRate * .035), this.context.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * .22));
      }
      void this.context.resume().catch(() => {});
    } catch { /* Visual play remains available when browser audio is blocked. */ }
  }

  click(speed: number, surface: Surface): void {
    const ctx = this.context;
    const now = performance.now();
    if (!this.enabled || !ctx || ctx.state !== 'running' || speed < .7 || now - this.last < 65 || !this.noise) return;
    this.last = now;
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = this.noise;
    source.playbackRate.value = surface === 'metal' ? 1.7 : surface === 'rubber' ? .55 : .9;
    filter.type = 'lowpass';
    filter.frequency.value = surface === 'metal' ? 4500 : surface === 'glass' ? 3200 : 1600;
    const time = ctx.currentTime;
    gain.gain.setValueAtTime(Math.min(.065, speed * .006), time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .055);
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(); source.stop(time + .065);
  }

  suspend(): void { void this.context?.suspend(); }

  dispose(): void {
    this.enabled = false;
    void this.context?.close();
    this.context = undefined; this.noise = undefined;
  }
}
