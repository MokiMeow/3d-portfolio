import { reactive, markRaw } from 'vue';
import { addressRequest, addressed, describeApp, newMemory, think, APP_LINES, PLACE_LINES } from './brain';
import type { JarvisAction, JarvisContext } from './brain';
import { JarvisMind, MODELS, validTag } from './mind';
import { JarvisVoice, VOICES, voiceOf } from './voice';
import { Ear, type EarState } from './ear';
import { PLAN_SCHEMA, planMessages, planReader, toActions, type Step } from './plan';
import { PLACES, CONDITIONS, forecast } from '../apps/weather/model';

/** Cities for the world clock card, by the names people say. */
const ZONES: Record<string, [string, string]> = {
  tokyo: ['Tokyo', 'Asia/Tokyo'], london: ['London', 'Europe/London'], paris: ['Paris', 'Europe/Paris'], berlin: ['Berlin', 'Europe/Berlin'], 'new york': ['New York', 'America/New_York'], nyc: ['New York', 'America/New_York'],
  'los angeles': ['Los Angeles', 'America/Los_Angeles'], la: ['Los Angeles', 'America/Los_Angeles'], 'san francisco': ['San Francisco', 'America/Los_Angeles'], sydney: ['Sydney', 'Australia/Sydney'], dubai: ['Dubai', 'Asia/Dubai'],
  singapore: ['Singapore', 'Asia/Singapore'], 'hong kong': ['Hong Kong', 'Asia/Hong_Kong'], shanghai: ['Shanghai', 'Asia/Shanghai'], beijing: ['Beijing', 'Asia/Shanghai'], seoul: ['Seoul', 'Asia/Seoul'], moscow: ['Moscow', 'Europe/Moscow'],
  bengaluru: ['Bengaluru', 'Asia/Kolkata'], bangalore: ['Bengaluru', 'Asia/Kolkata'], mumbai: ['Mumbai', 'Asia/Kolkata'], delhi: ['Delhi', 'Asia/Kolkata'], india: ['India', 'Asia/Kolkata'], chennai: ['Chennai', 'Asia/Kolkata'],
  toronto: ['Toronto', 'America/Toronto'], chicago: ['Chicago', 'America/Chicago'], 'sao paulo': ['São Paulo', 'America/Sao_Paulo'], cairo: ['Cairo', 'Africa/Cairo'], 'cape town': ['Cape Town', 'Africa/Johannesburg'],
  reykjavik: ['Reykjavík', 'Atlantic/Reykjavik'], lisbon: ['Lisbon', 'Europe/Lisbon'], rome: ['Rome', 'Europe/Rome'], madrid: ['Madrid', 'Europe/Madrid'], istanbul: ['Istanbul', 'Europe/Istanbul'], bangkok: ['Bangkok', 'Asia/Bangkok'],
};
const MEMORY = 'lab-jarvis-memory';
function memories(): string[] { try { const value: unknown = JSON.parse(localStorage.getItem(MEMORY) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; } catch { return []; } }
import type { VoiceId } from './voice';
/** Facts are stored in the wearer's own words; JARVIS repeats them back in the second person. */
const SWAP: Record<string, string> = { i: 'you', im: 'you are', ive: 'you have', me: 'you', my: 'your', mine: 'yours', myself: 'yourself', am: 'are', was: 'were' };
function yours(fact: string) {
  let subject = false;
  return fact.split(' ').map(word => {
    const swapped = SWAP[word];
    if (!swapped || ((word === 'am' || word === 'was') && !subject)) { subject = false; return word; }
    subject = word === 'i';
    return swapped;
  }).join(' ');
}


export type JarvisMode = 'idle' | 'listening' | 'thinking' | 'speaking';
export type LogLine = { id: number; text: string; kind: 'in' | 'op' | 'ok' | 'say' | 'warn' | 'sys'; at: number };
export type Remarks = 'off' | 'captions' | 'spoken';
export type Whisper = { id: number; text: string };
/** A holographic card JARVIS projects beside himself: world time, weather, a fact, a message, a memory. */
export type Card = { id: number; kind: 'time' | 'weather' | 'fact' | 'message' | 'memory' | 'build' | 'protocol'; title: string; big?: string; lines: string[]; accent?: string };
/** A beam of light from JARVIS to the thing he just acted on, in the headset's own pixels. */
export type Beam = { id: number; x: number; y: number };

const STORE = 'lab-jarvis-v1';
type Saved = { address?: string; voiceOn?: boolean; voice?: VoiceId; voiceChosen?: boolean; depth?: number; remarks?: Remarks; tier?: 'full' | 'instant'; neural?: boolean; wake?: boolean };
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
  /** A guest is wearing the headset: the owner's memories stay private. */
  guest?: () => boolean;
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
    cards: [] as Card[],
    beams: [] as Beam[],
    timers: [] as { id: number; label: string; end: number; total: number }[],
    address: initial.address ?? '',
    voiceOn: initial.voiceOn ?? true,
    depth: typeof initial.depth === 'number' ? initial.depth : 0,
    voiceId: voiceOf(!initial.voice || (initial.voice === 'whitcombe' && !initial.voiceChosen) ? 'sterling' : initial.voice),
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
    /** The site's hosted mind, by name, when it has one; null while unknown or absent. */
    hosted: null as string | null,
    hostedVoice: false,
    hostedHear: false,
    ear: 'off' as EarState,
    /** True once the site has said whether it hosts JARVIS, so the setup card never flashes. */
    serviceKnown: false,
    turns: 0,
    lastMs: 0,
  });
  const voice = markRaw(new JarvisVoice());
  const mind = markRaw(new JarvisMind());
  const memory = newMemory();
  voice.voice = state.voiceId;
  voice.depth = state.depth;
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
  let voiceChosen = initial.voiceChosen ?? false;
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ address: state.address, voiceOn: state.voiceOn, voice: state.voiceId, voiceChosen, depth: state.depth, remarks: state.remarks, tier: state.tier, neural: mind.status === 'ready', wake: state.wake })); } catch { /* private mode */ } };
  function log(text: string, kind: LogLine['kind'] = 'op') {
    state.log.push({ id: ++lineId, text, kind, at: Date.now() });
    if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
    // A test harness can read the trace by setting window.__jarvisLog = [].
    (globalThis as { __jarvisLog?: string[] }).__jarvisLog?.push(text);
  }
  const address = () => state.address || 'sir';
  function context(): JarvisContext {
    return { ...options.context(), memories: options.guest?.() ? [] : memories(), address: address(), neural: mind.status === 'ready', timers: state.timers.map(item => ({ label: item.label, left: Math.max(0, item.end - Date.now()) / 1000 })) };
  }

  let cardId = 0, beamId = 0;
  function card(data: Omit<Card, 'id'>, seconds = 16) {
    const item = { ...data, id: ++cardId };
    state.cards = [...state.cards.slice(-2), item];
    log(`project.card(${JSON.stringify(data.kind)})`, 'op');
    window.setTimeout(() => { state.cards = state.cards.filter(entry => entry.id !== item.id); }, seconds * 1000);
  }
  function beam(x: number, y: number) {
    const item = { id: ++beamId, x, y };
    state.beams = [...state.beams, item];
    window.setTimeout(() => { state.beams = state.beams.filter(entry => entry.id !== item.id); }, 1400);
  }

  /** Speak a line with captions that follow the voice. */
  async function say(text: string) {
    const mine = ++run;
    state.caption = text;
    state.words = text.split(' ').filter(Boolean);
    state.spoken = state.voiceOn ? -1 : state.words.length;
    log(`say(${JSON.stringify(text.length > 52 ? text.slice(0, 52) + '…' : text)})`, 'say');
    if (options.visible && !options.visible() && state.whispers.at(-1)?.text !== text) caption(text);
    if (!state.voiceOn) { state.mode = 'idle'; return; }
    state.mode = 'speaking';
    await voice.speak(text, { words: state.words, onWord: index => { if (mine === run) state.spoken = index; } });
    if (mine === run) { state.spoken = state.words.length; state.mode = 'idle'; }
  }

  /** What the apps reported, less any sentence he has already said in his own words. */
  function unsaid(said: string, lines: string[]) {
    const known = new Set(said.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    return lines.flatMap(line => line.match(/[^.!?]+[.!?]*/g) ?? [line]).map(sentence => sentence.trim()).filter(sentence => {
      const words = sentence.toLowerCase().match(/[a-z]{4,}/g) ?? [];
      return sentence && (!words.length || words.filter(word => known.has(word)).length / words.length < .6);
    }).join(' ');
  }
  async function run_actions(actions: JarvisAction[]) {
    const extra: string[] = [];
    for (const action of actions) {
      if (action.type === 'timer') { startTimer(action.seconds, action.label); continue; }
      if (action.type === 'cancelTimers') { state.timers.forEach(timer => clearTimeout(timers.get(timer.id))); state.timers = []; continue; }
      if (options.guest?.() && (action.type === 'remember' || action.type === 'recall' || action.type === 'forget')) { extra.push(addressed('Memories stay private while a guest is using the headset, {a}.', address())); continue; }
      if (action.type === 'remember') {
        const list = [...memories().filter(item => item !== action.fact), action.fact].slice(-30);
        try { localStorage.setItem(MEMORY, JSON.stringify(list)); } catch { /* private mode */ }
        card({ kind: 'memory', title: 'Memory stored', lines: [yours(action.fact)] });
        continue;
      }
      if (action.type === 'recall') {
        const list = memories();
        if (!list.length) { extra.push(addressed('You have not asked me to remember anything yet, {a}.', address())); continue; }
        card({ kind: 'memory', title: `Memory · ${list.length} items`, lines: list.slice(-5).reverse().map(yours) }, 22);
        extra.push(addressed(`I remember ${list.length === 1 ? 'one thing' : `${list.length} things`}, {a}. Most recently, that ${yours(list.at(-1)!)}.`, address()));
        continue;
      }
      if (action.type === 'forget') { try { localStorage.removeItem(MEMORY); } catch { /* private mode */ } continue; }
      if (action.type === 'alarm') {
        const at = new Date(); at.setHours(action.hour, action.minute, 0, 0);
        if (at.getTime() <= Date.now()) at.setDate(at.getDate() + 1);
        const when = at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
        startTimer(Math.round((at.getTime() - Date.now()) / 1000), action.label || `alarm, ${when}`);
        card({ kind: 'time', title: 'Alarm set', big: when, lines: [at.getDate() === new Date().getDate() ? 'Today' : 'Tomorrow', action.label || 'I shall wake you myself.'] });
        extra.push(addressed(`Alarm set for ${when}, {a}.`, address()));
        continue;
      }
      if (action.type === 'worldTime') {
        const key = Object.keys(ZONES).find(name => action.city.includes(name));
        if (!key) { extra.push(addressed(`I do not keep a clock for ${action.city}, {a}. Try a major city.`, address())); continue; }
        const [city, zone] = ZONES[key]!, now = new Date();
        const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
        const day = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long' }).format(now);
        const there = new Date(now.toLocaleString('en-US', { timeZone: zone })), diff = Math.round((there.getTime() - now.getTime()) / 60000);
        const ahead = diff === 0 ? 'Same time as you' : `${Math.floor(Math.abs(diff) / 60)}h${Math.abs(diff) % 60 ? ` ${Math.abs(diff) % 60}m` : ''} ${diff > 0 ? 'ahead of' : 'behind'} you`;
        card({ kind: 'time', title: `World clock · ${city}`, big: time, lines: [day, ahead] });
        extra.push(addressed(`It is ${time} in ${city}, {a}. ${day}.`, address()));
        continue;
      }
      if (action.type === 'weather') {
        const asked = action.city?.toLowerCase().trim();
        const place = (asked && PLACES.find(item => item.name.toLowerCase().includes(asked) || asked.includes(item.id))) || PLACES[0]!;
        const data = forecast(place, new Date()), now = data.hours[0];
        const condition = CONDITIONS[now?.condition ?? place.condition];
        card({ kind: 'weather', title: `Weather · ${place.name}`, big: `${Math.round(data.current)}°`, lines: [condition, `High ${Math.round(data.high)}° · Low ${Math.round(data.low)}°`, 'Simulated forecast'] });
        if (asked && !place.name.toLowerCase().includes(asked)) extra.push(addressed(`I only keep forecasts for a few cities, {a}. Here is ${place.name}.`, address()));
        extra.push(addressed(`${place.name}: ${Math.round(data.current)} degrees, ${condition.toLowerCase()}. Simulated, of course, {a}.`, address()));
        continue;
      }
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
    // Reflexes: one clear command, and certain answers (the time, a status report), happen at once.
    // Several steps in one request need context ("open YouTube and play…"), so the model plans those when it can.
    const sequence = reply.trace.some(line => line.includes('intent: sequence'));
    if (reply.kind === 'command' || reply.kind === 'answer') if (!(sequence && mind.status === 'ready')) {
      await new Promise(resolve => window.setTimeout(resolve, 120));
      const extra = await run_actions(reply.actions);
      if (reply.actions.length) log(`done  ${Math.round(performance.now() - started)}ms  ✓`, 'ok');
      state.lastMs = Math.round(performance.now() - started);
      const line = [reply.say, ...extra].filter(Boolean).join(' ');
      if (line) await say(line); else state.mode = 'idle';
      return;
    }
    if (sequence) log('  intent: sequence → core.plan', 'sys');
    // Everything else is understood by the model, which answers with a plan: what to do, and what to say.
    if (memory.turns.at(-1)?.you === text) memory.turns.pop();
    // Offline when the page loaded is not offline for good: the site may have its mind now.
    if (mind.status !== 'ready' && mind.status !== 'loading') {
      const service = await JarvisMind.recheck();
      if (service.name) {
        state.hosted = service.name; state.hostedVoice = service.voice; state.hostedHear = service.hear; state.tier = 'full'; persist();
        log(`core.connect(${service.name})`, 'sys');
        await Promise.all([voice.load(), mind.load(MODELS[0])]);
      }
    }
    if (mind.status !== 'ready') {
      log('core.offline', 'warn');
      await say(reply.kind === 'chat' ? reply.say : addressed('My neural core is offline at the moment, {a}. Plain commands still work: try "take me to the Moon".', address()));
      return;
    }
    log('core.plan()', 'sys');
    const mine = run;
    try {
      const speech = state.voiceOn ? voice.stream((index, start) => {
        if (mine !== run) return;
        state.spoken = index;
        if (start) state.mode = 'speaking';
      }) : null;
      let pushed = 0, actions: Promise<string[]> = Promise.resolve([]);
      // When apps do the work, they report what happened; he only acknowledges, so he never claims a result first.
      let reported = false;
      const act = (steps: Step[]) => {
        const mapped = toActions(steps, context(), text);
        reported = mapped.actions.some(action => action.type === 'inApp' || action.type === 'bringOut' || action.type === 'youtube' || (action.type === 'music' && action.action === 'play'));
        mapped.trace.forEach(line => log(`> ${line}`, 'op'));
        if (mapped.actions.length) actions = run_actions(mapped.actions).then(extra => { log(`done  ${Math.round(performance.now() - started)}ms  ✓`, 'ok'); return extra; });
      };
      // Speech goes out in short natural phrases: a sentence, or a clause at a comma or a joining word.
      // The first starts within a moment of the words arriving, and each next phrase is ready before the last ends.
      const feed = (said: string, final: boolean) => {
        for (;;) {
          const rest = said.slice(pushed);
          const sentence = rest.match(/^[\s\S]*?[.!?]["')\]]?(?=\s|$)/);
          let cut = sentence && (final || rest.length > sentence[0].length) ? sentence[0].length : 0;
          if (!cut) {
            const comma = rest.match(/^(?:\S+\s+){2,}?\S+?[,;:—–](?=\s)/);
            const joint = rest.match(/^(?:\S+\s+){3,}?\S+?(?=\s+(?:because|and|but|which|while|though|although|where|when|since|then)\s)/);
            cut = Math.min(comma ? comma[0].length : Infinity, joint ? joint[0].length : Infinity);
            if (!Number.isFinite(cut)) cut = 0;
            // Ten words with no natural break yet: say them rather than keep the listener waiting.
            if (!cut && !final) { const run = rest.match(/^(?:\S+\s+){10}/); if (run) cut = run[0].trimEnd().length; }
          }
          if (!cut && final && rest.trim()) cut = rest.length;
          if (!cut) return;
          speech?.push(rest.slice(0, cut)); pushed += cut;
        }
      };
      const reader = planReader(steps => { if (mine === run) act(steps); }, said => {
        if (mine !== run || reported) return;
        state.caption = said; state.words = said.split(' ').filter(Boolean);
        if (!speech) state.spoken = state.words.length;
        feed(said, false);
      });
      const result = await mind.plan(context(), memory.turns, text, delta => { if (mine === run) reader.push(delta); });
      if (mine !== run) return;
      const plan = reader.end();
      if (!reader.fired) act(plan.steps);
      // His own words stay where they are feelings or company; anything that sounds like a result is left to the apps.
      const kept = reported ? (plan.say.match(/[^.!?]+[.!?]*/g) ?? []).filter(line => !/\b(sent|found|playing|plays|is on|open|opened|ringing|calling|created|posted|started|showing|here is|here's|is out|done|ready|booked|noted|set)\b/i.test(line)).join(' ').trim() : '';
      const said = addressed(reported ? kept || ['Right away, {a}.', 'On it, {a}.', 'Certainly, {a}.'][Math.floor(Math.random() * 3)]! : plan.say || '', address()).trim();
      state.caption = said; state.words = said.split(' ').filter(Boolean);
      feed(said, true);
      state.tokensPerSecond = mind.tokensPerSecond; state.lastMs = result.ms;
      log(`core.reply  ${result.ms}ms  ${mind.tokensPerSecond} t/s`, 'ok');
      const extra = await actions;
      if (mine !== run) return;
      // Anything the actions found out (a forecast, a world clock) is said after his own line.
      if (extra.length) { const more = unsaid(said, extra); if (more) { state.caption = `${said} ${more}`.trim(); state.words = state.caption.split(' ').filter(Boolean); speech?.push(more); } }
      memory.turns.push({ you: text, jarvis: state.caption });
      if (memory.turns.length > 8) memory.turns.shift();
      log(`say(${JSON.stringify(state.caption.slice(0, 52))})`, 'say');
      if (!state.caption) { await say(addressed('Done, {a}.', address())); return; }
      if (speech) { await speech.end(); }
      if (mine === run) { state.spoken = state.words.length; state.mode = 'idle'; }
    } catch (error) {
      if (mine !== run) return;
      log(`core.error  ${String(error).slice(0, 50)}`, 'warn');
      await say(addressed('Forgive me, {a}. My neural core did not answer. Plain commands still work.', address()));
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
    const service = await JarvisMind.service();
    if (service.name) {
      log(`core.connect(${service.name})`, 'sys');
      if (service.voice) log(`voice.connect(${state.voiceId})`, 'sys');
      await Promise.all([voice.load(), mind.load(MODELS[0])]);
      return mind.status === 'ready';
    }
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
  function setVoice(id: VoiceId) { state.voiceId = id; voice.voice = id; voiceChosen = true; persist(); void say(addressed(`This is ${VOICES.find(item => item.id === id)!.name}, {a}. Will this do?`, address())); }
  /** Deeper or lighter, in semitones; 0 is the voice exactly as blended. */
  let depthSample = 0;
  function setDepth(semitones: number) {
    state.depth = Math.max(-4, Math.min(3, Math.round(semitones * 2) / 2));
    void voice.setDepth(state.depth); persist();
    clearTimeout(depthSample);
    depthSample = window.setTimeout(() => void say(addressed(state.depth ? 'Like this, {a}?' : 'My natural register, {a}.', address())), 450);
  }
  function setVoiceOn(on: boolean) { state.voiceOn = on; voice.muted = !on; if (!on) voice.stop(); persist(); }
  function setRemarks(value: Remarks) { state.remarks = value; persist(); }
  function setAddress(value: string) { state.address = value; persist(); }
  function forget() { memory.turns = []; state.log = []; state.turns = 0; log('memory.clear()  ✓', 'ok'); }

  /* "Hey JARVIS, …": hands-free from anywhere. The ear notices his name, Whisper hears the words, and he
     acts from his corner; after he answers you can carry on for a few seconds without his name. */
  const ear = new Ear();
  const wakeAvailable = Ear.available();
  ear.busy = () => voice.busy || state.mode === 'thinking' || state.mode === 'speaking';
  ear.hints = () => {
    const ctx = options.context();
    return `JARVIS. Hey JARVIS, open YouTube. ${ctx.apps.map(item => item.name).join(', ')}. ${ctx.environments.map(item => item.name).join(', ')}. Sidemen, MrBeast, lo-fi, Amma, Riya, Bengaluru, WhatsApp, Slack.`;
  };
  ear.onChange = mode => {
    state.ear = mode;
    if (mode === 'listening') { state.mode = 'listening'; state.you = ''; voice.chime('wake'); }
    else if (mode === 'hearing') state.mode = 'thinking';
    else if (mode === 'waiting' && (state.mode === 'listening' || state.mode === 'thinking') && !voice.busy) state.mode = 'idle';
  };
  ear.onHeard = text => {
    log(`heard(${JSON.stringify(text.slice(0, 50))})`, 'in');
    options.onWake?.();
    const done = text ? ask(text) : say(addressed(['Yes, {a}?', 'At your service, {a}.', 'Listening, {a}.'][Math.floor(Math.random() * 3)]!, address()));
    void done.then(() => ear.followUp(text ? 5 : 7));
  };
  let wakePaused = false;
  function startWake() {
    if (!wakeAvailable || wakePaused || !state.wake) return;
    void ear.start(state.hostedHear).then(ok => { if (!ok) { state.wake = false; persist(); log('ear.denied', 'warn'); } else log('ear.listen()', 'sys'); });
  }
  function stopWake() { ear.stop(); }
  /** The microphone button in the full display needs the microphone to itself for a moment. */
  function pauseWake(paused: boolean) { wakePaused = paused; if (paused) stopWake(); else startWake(); }
  function setWake(on: boolean) { state.wake = on && wakeAvailable; persist(); if (state.wake) startWake(); else stopWake(); }
  // On by default once the microphone is allowed; otherwise the orb offers it once.
  void Ear.allowed().then(allowed => {
    if (initial.wake === false) return;
    if (initial.wake || allowed) { state.wake = wakeAvailable; window.setTimeout(startWake, 1200); }
  });

  function dispose() { stopWake(); voice.dispose(); void mind.unload(); timers.forEach(handle => clearTimeout(handle)); }

  // When the site hosts JARVIS's mind there is nothing to download, so he is simply online, for everyone.
  void JarvisMind.service().then(service => {
    state.hosted = service.name; state.hostedVoice = service.voice; state.hostedHear = service.hear; state.serviceKnown = true;
    if (service.hear && ear.state !== 'off') { ear.stop(); startWake(); }
    if (!service.name) return;
    state.tier = 'full'; persist();
    void voice.load(); void mind.load(MODELS[0]);
    void fetch('/api/jarvis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: planMessages(context(), [], 'Good day.'), plan: true, schema: PLAN_SCHEMA, warm: true }) })
      .then(response => response.body?.cancel()).catch(() => {});
  });
  // Returning visitors who chose the full JARVIS get it back without asking again.
  if (initial.tier === 'full' && initial.neural) {
    // Start at once: load() reports its own failure, and a question asked in the meantime knows to wait.
    void voice.load(); void mind.load(MODELS[0]);
    void JarvisMind.supported().then(ok => { state.gpu = ok; });
  }

  return { state, voice, mind, card, beam, ask, say, interrupt, whisper, remark, log, wakeNeural, setInstant, setVoice, setDepth, setVoiceOn, setRemarks, setAddress, forget, dispose, address, context, setWake, pauseWake, wakeAvailable };
}
export type Jarvis = ReturnType<typeof useJarvis>;
