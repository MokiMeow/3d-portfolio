import { reactive, markRaw } from 'vue';
import { addressRequest, addressed, describeApp, newMemory, think, APP_LINES, PLACE_LINES } from './brain';
import type { JarvisAction, JarvisContext } from './brain';
import { JarvisMind, MODELS, validTag } from './mind';
import { JarvisVoice, VOICES } from './voice';
import type { VoiceId } from './voice';

export type JarvisMode = 'idle' | 'listening' | 'thinking' | 'speaking';
export type LogLine = { id: number; text: string; kind: 'in' | 'op' | 'ok' | 'say' | 'warn' | 'sys'; at: number };
export type Remarks = 'off' | 'captions' | 'spoken';
export type Whisper = { id: number; text: string };

const STORE = 'lab-jarvis-v1';
type Saved = { address?: string; voiceOn?: boolean; voice?: VoiceId; remarks?: Remarks; tier?: 'full' | 'instant'; neural?: boolean; wake?: boolean };
function saved(): Saved { try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; } catch { return {}; } }

/**
 * One JARVIS for the whole headset. The orb, the quick panel and the full HUD all read this, so a
 * conversation started in one carries on in the others, and remarks follow you between places.
 */
export function useJarvis(options: {
  context: () => Omit<JarvisContext, 'address' | 'neural' | 'timers'>;
  act: (action: JarvisAction) => string | void | Promise<string | void>;
  /** Called when someone says "JARVIS" out loud, so the shell can bring him forward. */
  onWake?: () => void;
  /** Whether the quick panel or the full display is showing his words. */
  visible?: () => boolean;
}) {
  const initial = saved();
  const state = reactive({
    mode: 'idle' as JarvisMode,
    you: '',
    caption: '',
    words: [] as string[],
    spoken: -1,
    log: [] as LogLine[],
    whispers: [] as Whisper[],
    timers: [] as { id: number; label: string; end: number; total: number }[],
    address: initial.address ?? '',
    voiceOn: initial.voiceOn ?? true,
    voiceId: (initial.voice ?? 'bm_fable') as VoiceId,
    remarks: (initial.remarks ?? 'captions') as Remarks,
    tier: initial.tier ?? null as 'full' | 'instant' | null,
    voiceStatus: 'off' as JarvisVoice['status'],
    voiceEngine: 'system' as JarvisVoice['engine'],
    voiceProgress: 0,
    mindStatus: 'off' as JarvisMind['status'],
    mindProgress: 0,
    mindDetail: '',
    tokensPerSecond: 0,
    wake: false,
    wakeHeard: '',
    gpu: null as boolean | null,
    turns: 0,
    lastMs: 0,
  });
  const voice = markRaw(new JarvisVoice());
  const mind = markRaw(new JarvisMind());
  const memory = newMemory();
  voice.voice = state.voiceId;
  voice.muted = !state.voiceOn;
  voice.onChange = () => { state.voiceStatus = voice.status; state.voiceEngine = voice.engine; state.voiceProgress = voice.progress; };
  let lastMindProgress = 0;
  mind.onChange = () => {
    state.mindStatus = mind.status; state.mindProgress = mind.progress; state.mindDetail = mind.detail;
    if (mind.status === 'loading' && mind.progress - lastMindProgress > .1) { lastMindProgress = mind.progress; log(`core.fetch  ${Math.round(mind.progress * 100)}%`, 'sys'); }
    if (mind.status === 'ready') log(`core.online(${mind.model.name})  ✓`, 'ok');
    if (mind.status === 'error') log(`core.error: ${mind.detail.slice(0, 60)}`, 'warn');
  };

  let lineId = 0, whisperId = 0, timerId = 0, run = 0;
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ address: state.address, voiceOn: state.voiceOn, voice: state.voiceId, remarks: state.remarks, tier: state.tier, neural: mind.status === 'ready', wake: state.wake })); } catch { /* private mode */ } };
  function log(text: string, kind: LogLine['kind'] = 'op') {
    state.log.push({ id: ++lineId, text, kind, at: Date.now() });
    if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
  }
  const address = () => state.address || 'sir';
  function context(): JarvisContext {
    return { ...options.context(), address: address(), neural: mind.status === 'ready', timers: state.timers.map(item => ({ label: item.label, left: Math.max(0, item.end - Date.now()) / 1000 })) };
  }

  /** Speak a line with captions that follow the voice. */
  async function say(text: string) {
    const mine = ++run;
    state.caption = text;
    state.words = text.split(' ').filter(Boolean);
    state.spoken = state.voiceOn ? -1 : state.words.length;
    log(`say(${JSON.stringify(text.length > 52 ? text.slice(0, 52) + '…' : text)})`, 'say');
    if (options.visible && !options.visible()) caption(text);
    if (!state.voiceOn) { state.mode = 'idle'; return; }
    state.mode = 'speaking';
    await voice.speak(text, { words: state.words, onWord: index => { if (mine === run) state.spoken = index; } });
    if (mine === run) { state.spoken = state.words.length; state.mode = 'idle'; }
  }

  async function run_actions(actions: JarvisAction[]) {
    const extra: string[] = [];
    for (const action of actions) {
      if (action.type === 'timer') { startTimer(action.seconds, action.label); continue; }
      if (action.type === 'cancelTimers') { state.timers.forEach(timer => clearTimeout(timers.get(timer.id))); state.timers = []; continue; }
      if (action.type === 'scan') {
        const ctx = context();
        await options.act(action);
        if (ctx.front) extra.push(addressed(describeApp(ctx.front.id, ctx.front.name), address()));
        continue;
      }
      const said = await options.act(action);
      if (said) extra.push(addressed(said, address()));
      await new Promise(resolve => window.setTimeout(resolve, 140));
    }
    return extra;
  }

  /** Everything the wearer says comes through here. */
  async function ask(raw: string) {
    const text = raw.trim().slice(0, 300);
    if (!text) return;
    voice.stop(); mind.stop();
    ++run;
    state.you = text; state.mode = 'thinking'; state.caption = ''; state.words = []; state.spoken = -1; state.turns++;
    log(`> ${text}`, 'in');
    const started = performance.now();

    const asked = addressRequest(text);
    if (asked) {
      state.address = asked; persist();
      log(`profile.address = ${JSON.stringify(asked)}`, 'ok');
      memory.turns.push({ you: text, jarvis: '' });
      await say(addressed(`Very good, {a}. I shall remember that.`, asked));
      return;
    }

    const reply = think(text, context(), memory);
    reply.trace.slice(1).forEach(line => log(line.trim(), line.includes('intent') ? 'sys' : 'op'));
    // Commands and facts are certain: act at once and say so.
    // A conversation started while the core is still warming up waits for it rather than settling for less.
    if ((reply.kind === 'chat' || reply.kind === 'unknown') && mind.status === 'loading') {
      log('core.wait()', 'sys');
      state.caption = addressed('One moment, {a}. My neural core is still warming up.', address()); state.words = state.caption.split(' '); state.spoken = state.words.length;
      const mine = run;
      for (let waited = 0; mind.status === 'loading' && waited < 90000 && mine === run; waited += 300) await new Promise(resolve => window.setTimeout(resolve, 300));
      if (mine !== run) return;
      state.caption = ''; state.words = [];
    }
    if (reply.kind === 'command' || reply.kind === 'answer' || ((reply.kind === 'chat' || reply.kind === 'unknown') && mind.status !== 'ready')) {
      await new Promise(resolve => window.setTimeout(resolve, 260 + Math.random() * 220));
      const extra = await run_actions(reply.actions);
      if (reply.actions.length) log(`done  ${Math.round(performance.now() - started)}ms  ✓`, 'ok');
      state.lastMs = Math.round(performance.now() - started);
      const line = [reply.say, ...extra].filter(Boolean).join(' ');
      if (line) await say(line); else state.mode = 'idle';
      return;
    }
    // Conversation goes to the neural core when it is awake.
    // The local brain already noted its own placeholder reply; the model must not see it and copy it.
    if (memory.turns.at(-1)?.you === text) memory.turns.pop();
    log(`core.generate(tokens ≤ 90)`, 'sys');
    try {
      const mine = run;
      const speech = state.voiceOn ? voice.stream(index => { if (mine === run) state.spoken = index; }) : null;
      let said = 0;
      const feed = (partial: string, final: boolean) => {
        // Hand each finished sentence to the voice as soon as it exists.
        const done = final ? partial.length : (partial.match(/^[\s\S]*[.!?]["')\]]?(?=\s)/)?.[0].length ?? 0);
        if (done > said) { speech?.push(partial.slice(said, done)); said = done; }
      };
      const result = await mind.reply(context(), memory.turns, text, partial => {
        if (mine !== run) return;
        state.caption = partial; state.words = partial.split(' ').filter(Boolean);
        if (state.mode === 'thinking' && speech && /[.!?]/.test(partial)) state.mode = 'speaking';
        feed(partial, false);
      });
      if (mine !== run) return;
      feed(result.text, true);
      state.tokensPerSecond = mind.tokensPerSecond; state.lastMs = result.ms;
      log(`core.reply  ${result.ms}ms  ${mind.tokensPerSecond} t/s`, 'ok');
      memory.turns.push({ you: text, jarvis: result.text });
      if (memory.turns.length > 8) memory.turns.shift();
      const ctx = context();
      const tag = validTag(result.tag, ctx.apps, ctx.environments, text, ctx.place.id, ctx.open);
      if (tag) {
        log(`suggest ${tag.kind}:${tag.id}`, 'op');
        await run_actions([tag.kind === 'place' ? { type: 'environment', id: tag.id } : { type: 'open', app: tag.id }]);
      }
      log(`say(${JSON.stringify(result.text.slice(0, 52))})`, 'say');
      if (!result.text) { await say(addressed('Forgive me, {a}. I lost my train of thought.', address())); return; }
      state.caption = result.text; state.words = result.text.split(' ').filter(Boolean);
      if (speech) { state.mode = 'speaking'; await speech.end(); }
      if (mine === run) { state.spoken = state.words.length; state.mode = 'idle'; }
    } catch (error) {
      log(`core.error  ${String(error).slice(0, 50)}`, 'warn');
      await say(reply.say);
    }
  }

  function interrupt() { ++run; voice.stop(); mind.stop(); state.mode = 'idle'; state.spoken = state.words.length; }

  /* Timers live with JARVIS, so he can tell you when they are done wherever you are. */
  const timers = new Map<number, number>();
  function startTimer(seconds: number, label: string) {
    const id = ++timerId;
    state.timers.push({ id, label, end: Date.now() + seconds * 1000, total: seconds });
    timers.set(id, window.setTimeout(() => {
      state.timers = state.timers.filter(item => item.id !== id);
      timers.delete(id);
      voice.chime('ack');
      const line = addressed(label ? `{a}, you asked me to remind you to ${label}.` : `{a}, your timer is done.`, address());
      whisper(line, true);
    }, seconds * 1000));
  }

  /* Remarks: short captions beside the orb when something happens, spoken if you have asked for that. */
  let lastRemark = 0;
  const placesRemarked = new Set<string>();
  /** A remark bubble beside the orb, without speaking it again. */
  function caption(text: string) {
    const item = { id: ++whisperId, text };
    state.whispers = [...state.whispers.slice(-1), item];
    window.setTimeout(() => { state.whispers = state.whispers.filter(entry => entry.id !== item.id); }, Math.max(4200, text.length * 70));
  }
  function whisper(text: string, important = false) {
    if (state.remarks === 'off' && !important) return;
    const item = { id: ++whisperId, text };
    state.whispers = [...state.whispers.slice(-1), item];
    log(`whisper(${JSON.stringify(text.slice(0, 40))})`, 'say');
    window.setTimeout(() => { state.whispers = state.whispers.filter(entry => entry.id !== item.id); }, Math.max(4200, text.length * 70));
    if ((state.remarks === 'spoken' || important) && state.voiceOn && state.mode === 'idle') void say(text);
  }
  function remark(kind: 'place' | 'app' | 'greet' | 'view', id = '') {
    const now = Date.now();
    if (now - lastRemark < (kind === 'app' ? 40000 : 15000)) return;
    let pool: readonly string[] | undefined;
    if (kind === 'place') { if (placesRemarked.has(id)) return; placesRemarked.add(id); pool = PLACE_LINES[id]; }
    else if (kind === 'app') { if (Math.random() > .35) return; pool = APP_LINES[id]; }
    else if (kind === 'view') pool = ['Enjoy the view, {a}. I shall keep quiet.', 'Just the view. A fine choice.'];
    else {
      const hour = new Date().getHours();
      pool = hour < 5 || hour >= 22 ? ['Working late, {a}? I shall keep the lights low.'] : hour < 12 ? ['Good morning, {a}. All systems ready.'] : hour < 17 ? ['Good afternoon, {a}. At your service.'] : ['Good evening, {a}. All systems ready.'];
    }
    if (!pool?.length) return;
    lastRemark = now;
    whisper(addressed(pool[Math.floor(Math.random() * pool.length)]!, address()));
  }

  async function wakeNeural() {
    state.tier = 'full'; persist();
    state.gpu ??= await JarvisMind.supported();
    if (!state.gpu) { log('webgpu.unavailable → local protocols', 'warn'); state.tier = 'instant'; persist(); return false; }
    log('core.boot()', 'sys');
    log(`voice.boot(kokoro-82m, ${state.voiceId})`, 'sys');
    // The voice is small; fetch it alongside the mind so both are ready together.
    await Promise.all([voice.load(), mind.load(MODELS[0])]);
    persist();
    return mind.status === 'ready';
  }
  function setInstant() { state.tier = 'instant'; persist(); voice.useSystem(); }
  function setVoice(id: VoiceId) { state.voiceId = id; voice.voice = id; persist(); void say(addressed(`This is ${VOICES.find(item => item.id === id)!.name}, {a}. Will this do?`, address())); }
  function setVoiceOn(on: boolean) { state.voiceOn = on; voice.muted = !on; if (!on) voice.stop(); persist(); }
  function setRemarks(value: Remarks) { state.remarks = value; persist(); }
  function setAddress(value: string) { state.address = value; persist(); }
  function forget() { memory.turns = []; state.log = []; state.turns = 0; log('memory.clear()  ✓', 'ok'); }

  /* "JARVIS, …": hands-free, through the browser's speech recognition, only when switched on. */
  type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null; start(): void; stop(): void; abort(): void };
  let wake: Recognition | null = null, wakePaused = false, wakeRetry = 0;
  const Recognizer = typeof window === 'undefined' ? undefined : ((window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition);
  const wakeAvailable = Boolean(Recognizer);
  function startWake() {
    if (!Recognizer || wake || wakePaused || !state.wake) return;
    const recognizer = new Recognizer();
    recognizer.lang = 'en-GB'; recognizer.continuous = true; recognizer.interimResults = false;
    recognizer.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        if (!result.isFinal || voice.busy) continue;
        const heard = result[0]!.transcript.trim();
        const match = heard.match(/\b(?:hey |ok |okay )?(?:jarvis|jervis|jarvis's|travis)\b[,.!?]?\s*(.*)$/i);
        if (!match) continue;
        state.wakeHeard = heard;
        log(`wake("${heard.slice(0, 40)}")`, 'in');
        voice.chime('wake');
        options.onWake?.();
        if (match[1]?.trim()) void ask(match[1].trim());
        else void say(addressed(['Yes, {a}?', 'At your service.', 'Listening, {a}.'][Math.floor(Math.random() * 3)]!, address()));
      }
    };
    recognizer.onerror = event => { if (event.error === 'not-allowed' || event.error === 'service-not-allowed') { state.wake = false; persist(); log('wake.denied', 'warn'); } };
    recognizer.onend = () => { wake = null; if (state.wake && !wakePaused) { window.clearTimeout(wakeRetry); wakeRetry = window.setTimeout(startWake, 400); } };
    try { recognizer.start(); wake = recognizer; log('wake.listen()', 'sys'); } catch { wake = null; }
  }
  function stopWake() { window.clearTimeout(wakeRetry); const current = wake; wake = null; if (current) { current.onend = null; current.abort(); } }
  /** The microphone button needs the recogniser to itself for a moment. */
  function pauseWake(paused: boolean) { wakePaused = paused; if (paused) stopWake(); else startWake(); }
  function setWake(on: boolean) { state.wake = on && wakeAvailable; persist(); if (state.wake) startWake(); else stopWake(); }
  if (initial.wake) { state.wake = wakeAvailable; window.setTimeout(startWake, 1500); }

  function dispose() { stopWake(); voice.dispose(); void mind.unload(); timers.forEach(handle => clearTimeout(handle)); }

  // Returning visitors who chose the full JARVIS get it back without asking again.
  if (initial.tier === 'full' && initial.neural) {
    // Start at once: load() reports its own failure, and a question asked in the meantime knows to wait.
    void voice.load(); void mind.load(MODELS[0]);
    void JarvisMind.supported().then(ok => { state.gpu = ok; });
  }

  return { state, voice, mind, ask, say, interrupt, whisper, remark, log, wakeNeural, setInstant, setVoice, setVoiceOn, setRemarks, setAddress, forget, dispose, address, context, setWake, pauseWake, wakeAvailable };
}
export type Jarvis = ReturnType<typeof useJarvis>;
