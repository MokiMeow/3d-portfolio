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
const WAKE = /\b(?:hey |hi |ok |okay )?(?:jarvis|jervis|jarvi|jarves|travis|javis)\b/i;
const STRIP = /^\W*(?:(?:hey|hi|ok|okay)\W+)?(?:jarvis|jervis|jarvi|jarves|travis|javis)\W*/i;
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
    } catch { return false; }
    const context = new AudioContext({ sampleRate: RATE });
    const source = context.createMediaStreamSource(this.stream);
    const node = context.createScriptProcessor(2048, 1, 1);
    node.onaudioprocess = event => this.chunk(event.inputBuffer.getChannelData(0));
    source.connect(node); node.connect(context.destination);
    this.context = context; this.node = node;
    this.listenForName();
    this.set('waiting');
    return true;
  }

  stop() {
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
        if (this.state === 'listening') this.guess = text;
        if (this.state === 'waiting' && !this.busy() && WAKE.test(text)) this.arm(text);
      }
    };
    recogniser.onerror = event => { if (event.error === 'not-allowed' || event.error === 'service-not-allowed') this.stop(); };
    recogniser.onend = () => { if (this.state !== 'off') window.setTimeout(() => { if (this.state !== 'off') this.listenForName(); }, 250); };
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
    // Keep the audio.
    for (let i = 0; i < samples.length; i++) this.ring[(this.written + i) % this.ring.length] = samples[i]!;
    this.written += samples.length;
    // Is anyone speaking? A simple loudness gate over an adaptive noise floor.
    let sum = 0;
    for (const value of samples) sum += value * value;
    const rms = Math.sqrt(sum / samples.length);
    const loud = rms > Math.max(.012, this.noise * 3.2);
    if (!loud) this.noise = this.noise * .97 + rms * .03;
    if (loud) {
      if (!this.speaking && this.written - this.lastVoice > RATE * .5) this.speechStart = this.written - samples.length - RATE * .3;
      this.speaking = true; this.lastVoice = this.written;
    } else if (this.speaking && this.written - this.lastVoice > RATE * .7) this.speaking = false;

    if (this.busy()) { if (this.state === 'listening') this.set('waiting'); return; }
    // Follow-up: after a reply, any clear speech counts, no name needed.
    if (this.state === 'waiting' && loud && this.written < this.followUntil) { this.followUntil = 0; this.arm(''); }
    if (this.state !== 'listening') return;
    const quietFor = (this.written - this.lastVoice) / RATE, since = (this.written - this.armedAt) / RATE;
    if ((quietFor > .85 && since > .4) || since > 14) void this.finish();
  }

  private async finish() {
    const start = Math.max(this.speechStart - RATE * .25, this.written - this.ring.length + 1, 0), end = this.written;
    const audio = new Float32Array(end - start);
    for (let i = 0; i < audio.length; i++) audio[i] = this.ring[(start + i) % this.ring.length]!;
    const guess = this.guess;
    this.set('hearing');
    let text = '';
    if (this.hosted && audio.length > RATE * .3) {
      try {
        const response = await fetch('/api/jarvis-hear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio: wav(audio), prompt: this.hints() }) });
        if (response.ok) text = ((await response.json()) as { text?: string }).text ?? '';
      } catch { /* fall back to the browser's guess */ }
    }
    if (!text) text = guess;
    if (this.state === 'off') return;
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
