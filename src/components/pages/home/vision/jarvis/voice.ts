/**
 * JARVIS's voice. The neural voice is Kokoro-82M with a stock British male voice, generated in a
 * worker one sentence at a time so speech starts while the rest is still being written. It plays
 * through a small WebAudio chain: cleanup EQ, gentle compression, a faint chorus and a short room,
 * which gives the stock voice a quiet, synthetic polish without turning it into a robot. An
 * analyser on the output drives the hologram. Without WebGPU, the best British system voice stands in.
 */
export type VoiceId = 'bm_fable' | 'bm_george' | 'bm_daniel' | 'bm_lewis';
export const VOICES: { id: VoiceId; name: string; line: string }[] = [
  { id: 'bm_fable', name: 'Fable', line: 'Measured, warm, a little theatrical' },
  { id: 'bm_daniel', name: 'Daniel', line: 'Even and calm, the most restrained' },
  { id: 'bm_george', name: 'George', line: 'Brighter and quicker' },
  { id: 'bm_lewis', name: 'Lewis', line: 'Deep and unhurried' },
];

export type VoiceStatus = 'off' | 'loading' | 'ready' | 'error';
type Speech = { words: string[]; onWord?: (index: number) => void };

/** Split for streaming: sentences, with very long ones broken at commas. */
export function sentences(text: string) {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [text];
  const out: string[] = [];
  for (const part of parts.map(item => item.trim()).filter(Boolean)) {
    if (part.length < 180) { out.push(part); continue; }
    let rest = part;
    while (rest.length > 180) { const cut = rest.lastIndexOf(',', 170); const at = cut > 60 ? cut + 1 : 170; out.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim(); }
    if (rest) out.push(rest);
  }
  return out;
}

/** Kokoro reads digits and symbols oddly in places; give it the words. */
function speakable(text: string) {
  return text.replace(/(\d)\s*%/g, '$1 percent').replace(/&/g, ' and ').replace(/\bJARVIS\b/g, 'Jarvis').replace(/\bvisionOS\b/gi, 'vision O S').replace(/\bUI\b/g, 'U I').replace(/[*_#`]/g, '');
}

function impulse(context: BaseAudioContext, seconds: number, decay: number) {
  const length = Math.floor(context.sampleRate * seconds), buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

export class JarvisVoice {
  status: VoiceStatus = 'off';
  progress = 0;
  engine: 'neural' | 'system' = 'system';
  voice: VoiceId = 'bm_fable';
  muted = false;
  onChange: () => void = () => {};
  private worker: Worker | null = null;
  private context: AudioContext | null = null;
  private input: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private samples = new Float32Array(1024);
  private sources = new Set<AudioBufferSourceNode>();
  private pending = new Map<number, (audio: { samples: Float32Array; rate: number } | null) => void>();
  private files = new Map<string, [number, number]>();
  private nextId = 1;
  private generation = 0;
  private simulated = 0;
  private speaking = false;

  /** 0..1, for the hologram. */
  level() {
    if (this.engine === 'system') return this.speaking ? this.simulated : 0;
    if (!this.analyser || !this.speaking) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const value of this.samples) sum += value * value;
    return Math.min(1, Math.sqrt(sum / this.samples.length) * 5);
  }
  get busy() { return this.speaking; }

  /** Creates the audio graph on the first user gesture. */
  private graph() {
    if (this.context) return this.context;
    const context = new AudioContext({ latencyHint: 'interactive' });
    const input = context.createGain();
    const highpass = new BiquadFilterNode(context, { type: 'highpass', frequency: 85, Q: .7 });
    const mud = new BiquadFilterNode(context, { type: 'peaking', frequency: 280, Q: 1, gain: -2.5 });
    const presence = new BiquadFilterNode(context, { type: 'peaking', frequency: 3100, Q: .9, gain: 2.5 });
    const air = new BiquadFilterNode(context, { type: 'highshelf', frequency: 8500, gain: 1.5 });
    const compressor = new DynamicsCompressorNode(context, { threshold: -20, knee: 8, ratio: 2.6, attack: .004, release: .16 });
    const master = context.createGain();
    master.gain.value = .95;
    input.connect(highpass).connect(mud).connect(presence).connect(air).connect(compressor);
    compressor.connect(master);
    // A faint chorus: two slowly wandering delays, panned apart.
    for (const [delay, rate, depth, pan] of [[.012, .21, .0012, -.35], [.019, .33, .0016, .35]] as const) {
      const line = new DelayNode(context, { delayTime: delay, maxDelayTime: .05 });
      const lfo = new OscillatorNode(context, { frequency: rate });
      const amount = new GainNode(context, { gain: depth });
      lfo.connect(amount).connect(line.delayTime);
      lfo.start();
      compressor.connect(line).connect(new GainNode(context, { gain: .075 })).connect(new StereoPannerNode(context, { pan })).connect(master);
    }
    // A short, bright room, as if the voice is in the space with you.
    const room = new ConvolverNode(context, { buffer: impulse(context, .32, 3.2) });
    compressor.connect(room).connect(new GainNode(context, { gain: .1 })).connect(master);
    const analyser = new AnalyserNode(context, { fftSize: 1024, smoothingTimeConstant: .4 });
    master.connect(analyser).connect(context.destination);
    this.context = context; this.input = input; this.analyser = analyser;
    return context;
  }

  /** Stay with the system voice: nothing to download. */
  useSystem() { if (this.status === 'ready' && this.engine === 'neural') return; this.engine = 'system'; this.status = 'ready'; this.onChange(); }

  /** Download and warm the neural voice. Resolves when it is ready, or falls back to the system voice. */
  async load() {
    if (this.status === 'ready' || this.status === 'loading') return;
    const gpu = 'gpu' in navigator && await (navigator as Navigator & { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter().catch(() => null);
    if (!gpu) { this.engine = 'system'; this.status = 'ready'; this.onChange(); return; }
    this.status = 'loading'; this.progress = 0; this.onChange();
    this.worker = new Worker(new URL('./voice.worker.ts', import.meta.url), { type: 'module' });
    await new Promise<void>(resolve => {
      const worker = this.worker!;
      worker.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (data.type === 'progress') {
          this.files.set(data.file, [data.loaded, data.total]);
          let loaded = 0, total = 0;
          for (const [l, t] of this.files.values()) { loaded += l; total += t; }
          this.progress = total ? loaded / total : 0; this.onChange();
        } else if (data.type === 'ready') { this.engine = 'neural'; this.status = 'ready'; this.progress = 1; this.onChange(); resolve(); }
        else if (data.type === 'audio') { this.pending.get(data.id)?.({ samples: data.samples, rate: data.rate }); this.pending.delete(data.id); }
        else if (data.type === 'error') {
          if (data.id === -1 || this.status === 'loading') { this.engine = 'system'; this.status = 'ready'; this.worker?.terminate(); this.worker = null; this.onChange(); resolve(); }
          else { this.pending.get(data.id)?.(null); this.pending.delete(data.id); }
        }
      };
      worker.onerror = () => { this.engine = 'system'; this.status = 'ready'; this.worker = null; this.onChange(); resolve(); };
      worker.postMessage({ type: 'load', device: 'webgpu' });
    });
  }

  private synthesize(text: string) {
    return new Promise<{ samples: Float32Array; rate: number } | null>(resolve => {
      if (!this.worker) { resolve(null); return; }
      const id = this.nextId++;
      this.pending.set(id, resolve);
      this.worker.postMessage({ type: 'speak', id, text: speakable(text), voice: this.voice, speed: .96 });
    });
  }

  stop() {
    this.generation++;
    for (const source of this.sources) { try { source.stop(); } catch { /* already stopped */ } }
    this.sources.clear();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.speaking = false;
  }

  /** Say a line. `onWord` follows along for captions. Resolves when finished or interrupted. */
  async speak(text: string, speech: Speech = { words: [] }) {
    this.stop();
    const run = this.generation;
    if (this.muted || !text.trim()) return;
    const context = this.graph();
    if (context.state === 'suspended') await context.resume().catch(() => {});
    this.speaking = true;
    const parts = sentences(text);
    let wordBase = 0;
    if (this.engine === 'neural' && this.worker) {
      // Ask for every sentence at once; the worker answers in order and playback chains them.
      const jobs = parts.map(part => this.synthesize(part));
      let at = context.currentTime + .05;
      for (const [index, job] of jobs.entries()) {
        const audio = await job;
        if (run !== this.generation) return;
        const words = parts[index]!.split(' ').filter(Boolean);
        if (audio) {
          const buffer = context.createBuffer(1, audio.samples.length, audio.rate);
          buffer.copyToChannel(new Float32Array(audio.samples), 0);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(this.input!);
          at = Math.max(at, context.currentTime + .02);
          source.start(at);
          this.sources.add(source);
          source.onended = () => this.sources.delete(source);
          this.follow(words, wordBase, at, buffer.duration, run, speech.onWord);
          at += buffer.duration + .08;
        }
        wordBase += words.length;
      }
      const left = (at - context.currentTime) * 1000;
      await new Promise(resolve => window.setTimeout(resolve, Math.max(0, left)));
      if (run === this.generation) this.speaking = false;
      return;
    }
    await this.system(text, run, speech.onWord);
    if (run === this.generation) this.speaking = false;
  }

  /**
   * Speak while the text is still arriving. `push` takes each finished sentence in order; `end` resolves
   * once everything pushed has been heard. Captions follow word by word across the whole stream.
   */
  stream(onWord?: (index: number) => void) {
    this.stop();
    const run = this.generation;
    let chain: Promise<void> = Promise.resolve();
    let wordBase = 0, at = 0;
    const context = this.muted ? null : this.graph();
    if (context?.state === 'suspended') void context.resume();
    const push = (sentence: string) => {
      const clean = sentence.trim();
      if (!clean || this.muted || run !== this.generation) return;
      this.speaking = true;
      const words = clean.split(' ').filter(Boolean), base = wordBase;
      wordBase += words.length;
      if (this.engine === 'neural' && this.worker && context) {
        const job = this.synthesize(clean);
        chain = chain.then(async () => {
          const audio = await job;
          if (!audio || run !== this.generation) return;
          const buffer = context.createBuffer(1, audio.samples.length, audio.rate);
          buffer.copyToChannel(new Float32Array(audio.samples), 0);
          const source = context.createBufferSource();
          source.buffer = buffer; source.connect(this.input!);
          at = Math.max(at, context.currentTime + .03);
          source.start(at);
          this.sources.add(source); source.onended = () => this.sources.delete(source);
          this.follow(words, base, at, buffer.duration, run, onWord);
          at += buffer.duration + .08;
        });
      } else chain = chain.then(() => run === this.generation ? this.system(clean, run, index => onWord?.(base + index)) : undefined);
    };
    const end = async () => {
      await chain;
      if (context && this.engine === 'neural') await new Promise(resolve => window.setTimeout(resolve, Math.max(0, (at - context.currentTime) * 1000)));
      if (run === this.generation) this.speaking = false;
    };
    return { push, end };
  }

  /** Reveal words across a sentence's audio, weighted by length, so captions keep pace with speech. */
  private follow(words: string[], base: number, start: number, duration: number, run: number, onWord?: (index: number) => void) {
    if (!onWord || !this.context) return;
    const weights = words.map(word => Math.max(2, word.replace(/[^a-z0-9]/gi, '').length + 1.5));
    const total = weights.reduce((a, b) => a + b, 0);
    let elapsed = 0;
    words.forEach((_, index) => {
      const delay = (start - this.context!.currentTime + duration * .92 * elapsed / total) * 1000;
      elapsed += weights[index]!;
      window.setTimeout(() => { if (run === this.generation) onWord(base + index); }, Math.max(0, delay));
    });
  }

  private system(text: string, run: number, onWord?: (index: number) => void) {
    return new Promise<void>(resolve => {
      if (!('speechSynthesis' in window)) { resolve(); return; }
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred = ['Microsoft Ryan Online', 'Microsoft Thomas Online', 'Google UK English Male', 'Daniel', 'Microsoft George', 'Arthur', 'Oliver'];
      utterance.voice = preferred.map(name => voices.find(voice => voice.name.includes(name))).find(Boolean) ?? voices.find(voice => /en[-_]GB/i.test(voice.lang)) ?? null;
      utterance.lang = 'en-GB'; utterance.rate = .98; utterance.pitch = .92;
      const offsets: number[] = [];
      text.replace(/\S+/g, (word, offset: number) => { offsets.push(offset); return word; });
      let pulse = 0;
      utterance.onboundary = event => {
        this.simulated = .55 + Math.random() * .35; window.clearTimeout(pulse); pulse = window.setTimeout(() => { this.simulated = .15; }, 140);
        const index = offsets.findIndex(offset => offset >= event.charIndex);
        if (onWord && index >= 0 && run === this.generation) onWord(index);
      };
      utterance.onend = utterance.onerror = () => { this.simulated = 0; resolve(); };
      this.simulated = .3;
      window.speechSynthesis.speak(utterance);
    });
  }

  /** Short UI sounds: a soft chime when JARVIS wakes, a lower one when it rests. */
  chime(kind: 'wake' | 'rest' | 'ack' | 'error') {
    if (this.muted) return;
    const context = this.graph();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const notes = { wake: [659.3, 987.8, 1318.5], rest: [987.8, 659.3], ack: [1174.7, 1568], error: [392, 311.1] }[kind];
    notes.forEach((frequency, index) => {
      const osc = new OscillatorNode(context, { type: 'sine', frequency });
      const shimmer = new OscillatorNode(context, { type: 'triangle', frequency: frequency * 2.003 });
      const gain = new GainNode(context, { gain: 0 });
      const t = now + index * .07;
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.06, t + .015); gain.gain.exponentialRampToValueAtTime(.0001, t + .55);
      osc.connect(gain); shimmer.connect(new GainNode(context, { gain: .25 })).connect(gain);
      gain.connect(this.input!);
      osc.start(t); shimmer.start(t); osc.stop(t + .6); shimmer.stop(t + .6);
    });
  }

  dispose() { this.stop(); this.worker?.terminate(); this.worker = null; void this.context?.close(); this.context = null; }
}
