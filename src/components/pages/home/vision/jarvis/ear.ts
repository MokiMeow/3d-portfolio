/**
 * JARVIS's ear: always listening (once you switch it on), hands-free.
 *
 * The browser's own recogniser is quick but careless with words, so here it only listens for his name.
 * Meanwhile the microphone is kept in a short rolling buffer at 16 kHz. When "JARVIS" is heard, the ear
 * waits for you to stop talking, cuts out exactly what you said, and sends that audio to Whisper, which
 * gets names like "Sidemen" right. After he answers, a brief follow-up window lets you carry on without
 * his name. It ignores everything while he is speaking, so he never hears himself.
 */
export type EarState = 'off' | 'waiting' | 'listening' | 'hearing';
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; abort(): void;
};

const RATE = 16000, KEEP = 24;                    // seconds of audio kept
// His name as recognisers tend to hear it, and the greetings people put before it ("hey hello JARVIS").
const WAKE = /\b(?:jarvis|jervis|jarvi|jarves|travis|javis|javvis|jarvas|jaarvis)\b/i;
const STRIP = /^\W*(?:(?:hey|hi|hello|ok|okay|yo)\W+){0,3}(?:jarvis|jervis|jarvi|jarves|travis|javis|javvis|jarvas|jaarvis)\W*/i;
/** What Whisper tends to invent from silence or noise. */
const NOISE = /^(?:you|thank you\.?|thanks for watching!?|bye\.?|\.+|uh+|um+|hmm+|okay\.?)$/i;

export class Ear {
  state: EarState = 'off';
  onChange: (state: EarState) => void = () => {};
  /** Called with what you said (his name already removed), or '' when you only said his name. */
  onHeard: (text: string) => void = () => {};
  /** True while JARVIS is talking: the ear ignores the room so he never hears himself. */
  busy: () => boolean = () => false;
  /** Names Whisper should expect: apps, places, people. */
  hints: () => string = () => '';
  /** Why the ear cannot hear, in a few plain words; '' when all is well. */
  onProblem: (problem: string) => void = () => {};
  /** How loud the room is right now, 0 to 1, a few times a second: proof that the microphone is live. */
  onLevel: (level: number) => void = () => {};
  /** The browser's guess, used only if Whisper is unavailable. */
  private guess = '';
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private recogniser: Recognition | null = null;
  private ring = new Float32Array(RATE * KEEP);
  private written = 0;                  // total samples ever written
  private noise = .006;                 // adaptive noise floor (RMS)
  private speaking = false;
  private speechStart = 0;              // sample index where the current stretch of speech began
  private lastVoice = 0;                // sample index of the last loud chunk
  private armedAt = 0;
  private followUntil = 0;
  private hosted = false;
  /** When the browser's recogniser cannot work (no speech service, or it hears nothing), Whisper listens for the name. */
  private whisperWake = false;
  private results = 0;                  // anything the browser's recogniser has heard since start
  private segments = 0;                 // clear stretches of speech since start
  private checking = false;
  private checks: number[] = [];
  private lastChunkAt = 0;
  private levelAt = 0;
  private watchdog = 0;
  private resume = () => { if (this.context?.state === 'suspended') void this.context.resume().catch(() => {}); };

  static available() {
    return typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  }
  /** Whether the microphone was already allowed, so the ear can start without asking again. */
  static async allowed() {
    try { return (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state === 'granted'; } catch { return false; }
  }

  async start(hosted: boolean) {
    if (this.state !== 'off') return true;
    this.hosted = hosted;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (error) {
      const name = (error as { name?: string })?.name;
      this.onProblem(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'No microphone found.' : name === 'NotReadableError' ? 'The microphone is busy in another app.' : 'Microphone blocked: allow it from the icon in the address bar.');
      return false;
    }
    this.onProblem('');
    this.results = 0; this.segments = 0; this.whisperWake = false;
    const context = new AudioContext({ sampleRate: RATE });
    // Browsers hold audio until the page has been touched; start now if allowed, otherwise on the first touch.
    if (context.state === 'suspended') void context.resume().catch(() => {});
    window.addEventListener('pointerdown', this.resume, true); window.addEventListener('keydown', this.resume, true);
    const source = context.createMediaStreamSource(this.stream);
    const node = context.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = event => this.chunk(event.inputBuffer.getChannelData(0));
    source.connect(node); node.connect(context.destination);
    this.context = context; this.node = node;
    this.lastChunkAt = performance.now();
    // If audio stops arriving while he waits for your words, use what the browser heard rather than hang.
    this.watchdog = window.setInterval(() => {
      this.resume();
      if (this.state === 'listening' && performance.now() - this.lastChunkAt > 1500) void this.finish(true);
    }, 500);
    this.listenForName();
    this.set('waiting');
    return true;
  }

  stop() {
    clearInterval(this.watchdog);
    window.removeEventListener('pointerdown', this.resume, true); window.removeEventListener('keydown', this.resume, true);
    this.recogniser?.abort(); this.recogniser = null;
    this.node?.disconnect(); this.node = null;
    void this.context?.close(); this.context = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.set('off');
  }

  /** After he replies: a few seconds in which you can simply carry on talking. */
  followUp(seconds = 6) { if (this.state !== 'off') this.followUntil = this.written + seconds * RATE; }

  private set(state: EarState) { if (this.state !== state) { this.state = state; this.onChange(state); } }

  private listenForName() {
    const Recognizer = (window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!Recognizer) return;
    const recogniser = new Recognizer();
    recogniser.lang = 'en-GB'; recogniser.continuous = true; recogniser.interimResults = true;
    recogniser.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i]![0]!.transcript;
        this.results++;
        if (this.state === 'listening') this.guess = text;
        if (this.state === 'waiting' && !this.busy() && WAKE.test(text)) this.arm(text);
      }
    };
    recogniser.onerror = event => {
      if (event.error === 'not-allowed') { this.onProblem('Microphone blocked: allow it from the icon in the address bar.'); this.stop(); return; }
      if (event.error === 'audio-capture') { this.onProblem('No microphone found.'); return; }
      // No speech service in this browser or on this network: Whisper listens for the name instead.
      if (event.error === 'network' || event.error === 'service-not-allowed' || event.error === 'language-not-supported') {
        if (this.hosted) this.whisperWake = true;
        else this.onProblem('This browser cannot listen for his name. Chrome or Edge can.');
      }
    };
    // The recogniser stops every so often; start it again (slowly, when Whisper has taken over).
    recogniser.onend = () => { if (this.state !== 'off') window.setTimeout(() => { if (this.state !== 'off') this.listenForName(); }, this.whisperWake ? 30000 : 250); };
    try { recogniser.start(); this.recogniser = recogniser; } catch { /* already running */ }
  }

  /** His name was heard: capture from the start of this stretch of speech until you pause. */
  private arm(text: string) {
    this.guess = text;
    this.armedAt = this.written;
    if (!this.speaking) this.speechStart = Math.max(0, this.written - RATE * 2);
    this.set('listening');
  }

  private chunk(samples: Float32Array) {
    this.lastChunkAt = performance.now();
    // Keep the audio.
    for (let i = 0; i < samples.length; i++) this.ring[(this.written + i) % this.ring.length] = samples[i]!;
    this.written += samples.length;
    // Is anyone speaking? A simple loudness gate over an adaptive noise floor.
    let sum = 0;
    for (const value of samples) sum += value * value;
    const rms = Math.sqrt(sum / samples.length);
    const loud = rms > Math.max(.012, this.noise * 3.2);
    if (!loud) this.noise = this.noise * .97 + rms * .03;
    if (this.lastChunkAt - this.levelAt > 90) { this.levelAt = this.lastChunkAt; this.onLevel(Math.min(1, rms * 14)); }
    if (loud) {
      if (!this.speaking && this.written - this.lastVoice > RATE * .5) this.speechStart = this.written - samples.length - RATE * .3;
      this.speaking = true; this.lastVoice = this.written;
    } else if (this.speaking && this.written - this.lastVoice > RATE * .7) {
      this.speaking = false;
      const seconds = (this.lastVoice - this.speechStart) / RATE;
      if (seconds > .6) this.segments++;
      // Plenty of talking and not a word from the browser's recogniser: it is not working here.
      if (!this.whisperWake && this.hosted && this.segments >= 3 && this.results === 0) this.whisperWake = true;
      if (this.whisperWake && this.state === 'waiting' && !this.busy()) void this.checkForName(this.speechStart, this.lastVoice);
    }

    if (this.busy()) { if (this.state === 'listening') this.set('waiting'); return; }
    // Follow-up: after a reply, any clear speech counts, no name needed.
    if (this.state === 'waiting' && loud && this.written < this.followUntil) { this.followUntil = 0; this.arm(''); }
    if (this.state !== 'listening') return;
    const quietFor = (this.written - this.lastVoice) / RATE, since = (this.written - this.armedAt) / RATE;
    if ((quietFor > .85 && since > .4) || since > 14) void this.finish();
  }

  /** Whisper listens for the name in one stretch of speech, when the browser cannot. A few a minute at most. */
  private async checkForName(from: number, to: number) {
    const seconds = (to - from) / RATE, now = Date.now();
    this.checks = this.checks.filter(at => now - at < 60000);
    if (this.checking || seconds < .4 || seconds > 6 || this.checks.length >= 12) return;
    this.checking = true; this.checks.push(now);
    const start = Math.max(from - RATE * .2, this.written - this.ring.length + 1, 0), end = Math.min(this.written, to + RATE * .3);
    const audio = new Float32Array(end - start);
    for (let i = 0; i < audio.length; i++) audio[i] = this.ring[(start + i) % this.ring.length]!;
    try {
      const response = await fetch('/api/jarvis-hear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: wav(audio), prompt: this.hints() }) });
      const text = response.ok ? ((await response.json()) as { text?: string }).text ?? '' : '';
      const name = text.match(WAKE);
      if (!name || this.state !== 'waiting') return;
      const rest = text.slice((name.index ?? 0) + name[0].length).replace(/^\W+/, '').trim();
      if (rest && !NOISE.test(rest)) { this.set('listening'); this.set('waiting'); this.onHeard(rest); }
      else { this.armedAt = this.written; this.speechStart = this.written; this.set('listening'); }
    } catch { /* the next stretch of speech gets another chance */ } finally { this.checking = false; }
  }

  private async finish(stalled = false) {
    if (this.state !== 'listening') return;
    const start = Math.max(this.speechStart - RATE * .25, this.written - this.ring.length + 1, 0), end = this.written;
    const audio = new Float32Array(end - start);
    for (let i = 0; i < audio.length; i++) audio[i] = this.ring[(start + i) % this.ring.length]!;
    const guess = this.guess;
    this.set('hearing');
    let text = '';
    if (this.hosted && !stalled && audio.length > RATE * .3) {
      try {
        const response = await fetch('/api/jarvis-hear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: wav(audio), prompt: this.hints() }) });
        if (response.ok) text = ((await response.json()) as { text?: string }).text ?? '';
      } catch { /* fall back to the browser's guess */ }
    }
    if (!text) text = guess;
    if ((this.state as EarState) === 'off') return;   // switched off while Whisper was listening
    this.set('waiting');
    const spoken = text.replace(STRIP, '').trim();
    if (NOISE.test(spoken) || (!spoken && !WAKE.test(text))) return;
    this.onHeard(spoken);
  }
}

/** 16-bit mono WAV, as base64. */
function wav(samples: Float32Array) {
  const bytes = new Uint8Array(44 + samples.length * 2), view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(samples[i]! * 32767))), true);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
