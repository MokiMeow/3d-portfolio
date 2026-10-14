<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Jarvis } from './useJarvis';
import { JarvisSphere } from './sphere';
import { VOICES } from './voice';
import { MODELS } from './mind';

/**
 * The full JARVIS: the gold consciousness sphere, the HUD around it, and the conversation.
 * `docked` tucks the sphere into a slim bar at the bottom so whatever JARVIS just did can be seen.
 */
const props = defineProps<{ jarvis: Jarvis; docked: boolean; compact: boolean; status: { place: string; immersion: number; windows: number; front: string } }>();
const emit = defineEmits<{ close: []; dock: [docked: boolean] }>();
const state = props.jarvis.state;

const canvas = ref<HTMLCanvasElement>();
const input = ref<HTMLInputElement>();
const signal = ref<HTMLCanvasElement>();
const root = ref<HTMLElement>();
const question = ref('');
const settings = ref(false);
const listening = ref(false);
const named = ref(false);
const now = ref(new Date());
const size = reactive({ w: 1280, h: 720 });
let sphere: JarvisSphere | null = null;
let frame = 0, clock = 0, observer: ResizeObserver | undefined;

const needsSetup = computed(() => state.tier === null);
const loading = computed(() => state.mindStatus === 'loading' || state.voiceStatus === 'loading');
const needsAddress = computed(() => !needsSetup.value && !state.address);
const progress = computed(() => {
  const parts = [state.mindStatus === 'loading' || state.mindStatus === 'ready' ? state.mindProgress : null, state.voiceStatus === 'loading' || state.voiceStatus === 'ready' ? state.voiceProgress : null].filter((value): value is number => value !== null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 1;
});
const SUGGESTIONS = [
  ['Take me to the Moon', 'Status report', 'Drop five glass cubes', 'What can you do?'],
  ['Arrange my windows', 'Show me the stars', 'Set a timer for 5 minutes', 'Tell me a joke'],
  ['Open Night Sky', 'Hide everything', 'Rain gold balls', 'Who are you?'],
] as const;
const suggestionPage = ref(0);
const suggestions = computed(() => needsAddress.value ? [] : SUGGESTIONS[suggestionPage.value % SUGGESTIONS.length]!);

const mindLine = computed(() => state.mindStatus === 'ready' ? `${MODELS[0]!.name.toUpperCase()} · ONLINE${state.tokensPerSecond ? ` · ${state.tokensPerSecond} T/S` : ''}`
  : state.mindStatus === 'loading' ? `LOADING · ${Math.round(state.mindProgress * 100)}%` : state.mindStatus === 'error' ? 'OFFLINE · LOCAL PROTOCOLS' : 'LOCAL PROTOCOLS');
const voiceLine = computed(() => !state.voiceOn ? 'MUTED' : state.voiceStatus === 'loading' ? `LOADING · ${Math.round(state.voiceProgress * 100)}%`
  : state.voiceEngine === 'neural' ? `${VOICES.find(item => item.id === state.voiceId)!.name.toUpperCase()} · NEURAL` : 'SYSTEM VOICE');
const statusLine = computed(() => state.mode === 'listening' ? 'LISTENING' : state.mode === 'thinking' ? 'PROCESSING' : state.mode === 'speaking' ? 'SPEAKING' : loading.value ? 'INITIALISING' : 'STANDING BY');
const time = computed(() => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now.value));
const tail = computed(() => state.log.slice(-(props.compact ? 6 : 16)));
const stamp = (at: number) => { const d = new Date(at); return `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`; };
const countdown = (end: number) => { const left = Math.max(0, Math.round((end - now.value.getTime()) / 1000)); return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };

/* Where the sphere sits: big and central, or small at the left end of the docked bar. */
const sphereSize = computed(() => props.compact ? Math.min(size.w * .92, size.h * .5) : Math.min(size.h * .56, size.w * .46));
const stageStyle = computed(() => {
  const s = sphereSize.value;
  const cx = size.w / 2, cy = size.h * (props.compact ? .34 : .42);
  if (!props.docked) return { width: `${s}px`, height: `${s}px`, transform: `translate(${cx - s / 2}px, ${cy - s / 2}px)` };
  const small = props.compact ? 76 : 112;
  const bar = Math.min(size.w - 24, 760);
  const x = size.w / 2 - bar / 2 + small / 2 - 6, y = size.h - (props.compact ? 128 : 150);
  return { width: `${s}px`, height: `${s}px`, transform: `translate(${x - s / 2}px, ${y - s / 2}px) scale(${small / s})` };
});

watch(() => state.mode, mode => sphere?.setMode(mode));
watch(progress, value => { if (loading.value) sphere?.assemble(.22 + value * .78); else if (!needsSetup.value) sphere?.assemble(1); });
watch(needsSetup, value => { if (!value && !loading.value) sphere?.assemble(1); });
watch(() => props.docked, docked => sphere?.setGain(docked ? 1.15 : 1));

async function send(text = question.value) {
  const clean = text.trim();
  if (!clean) return;
  question.value = '';
  if (needsAddress.value && named.value) { props.jarvis.setAddress(clean.replace(/\b[a-z]/g, letter => letter.toUpperCase()).slice(0, 24)); named.value = false; void props.jarvis.say(`Very good, ${state.address}. How may I help?`); return; }
  await props.jarvis.ask(clean);
}
function chooseAddress(value: string) {
  if (value === 'name') { named.value = true; void nextTick(() => input.value?.focus()); return; }
  props.jarvis.setAddress(value);
  void props.jarvis.say(`Very good, ${value}. How may I help?`);
}
async function full() {
  props.jarvis.log('tier = "full"', 'sys');
  sphere?.assemble(.22);
  const ok = await props.jarvis.wakeNeural();
  sphere?.assemble(1);
  if (ok) void props.jarvis.say(state.address ? `All systems online, ${state.address}. I am fully myself again.` : 'All systems online. How shall I address you?');
  else void props.jarvis.say('Your browser cannot run my neural core, I am afraid. Local protocols it is; I shall manage.');
}
function instant() {
  props.jarvis.setInstant();
  sphere?.assemble(1);
  void props.jarvis.say(state.address ? `At your service, ${state.address}.` : 'At your service. How shall I address you?');
}

/* Speech input through the browser. */
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((event: { error: string }) => void) | null; start(): void; stop(): void; abort(): void };
let recognition: Recognition | null = null;
const Recognizer = typeof window !== 'undefined' ? ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition) : undefined;
const micAvailable = Boolean(Recognizer);
function mic() {
  if (listening.value) { recognition?.stop(); return; }
  if (!Recognizer) return;
  props.jarvis.interrupt();
  recognition = new Recognizer();
  recognition.lang = 'en-GB'; recognition.interimResults = true; recognition.continuous = false;
  let finalText = '';
  recognition.onresult = event => {
    let text = '';
    for (let i = 0; i < event.results.length; i++) { const result = event.results[i]!; text += result[0]!.transcript; if (result.isFinal) finalText = text; }
    question.value = text;
  };
  recognition.onerror = event => { props.jarvis.log(`mic.error(${event.error})`, 'warn'); };
  recognition.onend = () => { listening.value = false; state.mode = state.mode === 'listening' ? 'idle' : state.mode; recognition = null; if (finalText.trim()) void send(finalText); };
  listening.value = true; state.mode = 'listening';
  props.jarvis.log('mic.listen()', 'sys');
  try { recognition.start(); } catch { listening.value = false; state.mode = 'idle'; }
}

/* The little voice-signal trace in the systems panel. */
const history = new Float32Array(90);
function drawSignal() {
  const c = signal.value;
  if (!c) return;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  history.copyWithin(0, 1);
  const level = state.mode === 'speaking' ? props.jarvis.voice.level() : state.mode === 'thinking' ? .15 + Math.random() * .2 : state.mode === 'listening' ? .1 + Math.random() * .3 : .03 + Math.random() * .02;
  history[history.length - 1] = level;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,193,90,.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  ctx.strokeStyle = '#ffc15a'; ctx.lineWidth = 1.4; ctx.shadowColor = 'rgba(255,160,50,.8)'; ctx.shadowBlur = 6;
  ctx.beginPath();
  history.forEach((value, i) => { const x = i / (history.length - 1) * w, y = h / 2 + Math.sin(i * 1.7) * value * h * .45; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke(); ctx.shadowBlur = 0;
}

function keys(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (settings.value) { settings.value = false; return; }
  if (state.mode === 'speaking') { props.jarvis.interrupt(); return; }
  emit('close');
}

onMounted(() => {
  if (!canvas.value || !root.value) return;
  sphere = new JarvisSphere(canvas.value, { quality: props.compact ? 'low' : 'high' });
  sphere.level = () => props.jarvis.voice.level();
  sphere.setMode(state.mode);
  sphere.start();
  sphere.assemble(needsSetup.value ? .22 : loading.value ? .22 + progress.value * .78 : 1);
  observer = new ResizeObserver(() => { size.w = root.value!.clientWidth; size.h = root.value!.clientHeight; });
  observer.observe(root.value);
  size.w = root.value.clientWidth; size.h = root.value.clientHeight;
  clock = window.setInterval(() => { now.value = new Date(); suggestionPage.value += now.value.getSeconds() % 12 === 0 ? 1 : 0; }, 1000);
  const tick = () => { frame = requestAnimationFrame(tick); drawSignal(); };
  frame = requestAnimationFrame(tick);
  window.addEventListener('keydown', keys, true);
  props.jarvis.voice.chime('wake');
  if (!needsSetup.value && !props.docked) void nextTick(() => input.value?.focus({ preventScroll: true }));
});
/** Collapse the sphere into its core, then let the parent remove us. */
async function implode() { sphere?.implode(); props.jarvis.voice.chime('rest'); await new Promise(resolve => window.setTimeout(resolve, 520)); }
defineExpose({ implode, focus: () => input.value?.focus() });
onBeforeUnmount(() => {
  recognition?.abort();
  cancelAnimationFrame(frame); clearInterval(clock); observer?.disconnect();
  window.removeEventListener('keydown', keys, true);
  sphere?.dispose(); sphere = null;
});
</script>

<template>
  <div ref="root" class="jarvis-hud" :class="[state.mode, { docked, compact, setup: needsSetup }]" role="dialog" aria-label="JARVIS" @pointerdown.stop @wheel.stop>
    <i class="veil" />
    <div class="stage" :style="stageStyle" @click="docked && emit('dock', false)">
      <canvas ref="canvas" aria-hidden="true" />
    </div>

    <header class="title">
      <b>J.A.R.V.I.S.</b>
      <small>Just A Rather Very Intelligent System</small>
      <span class="state"><i />{{ statusLine }}</span>
    </header>

    <aside class="panel systems" aria-label="Systems">
      <h3>Systems</h3>
      <dl>
        <div><dt>Location</dt><dd>{{ status.place }}</dd></div>
        <div class="gauge-row">
          <dt>Immersion</dt>
          <dd>
            <svg viewBox="0 0 44 44" class="gauge" aria-hidden="true"><circle cx="22" cy="22" r="18" /><circle cx="22" cy="22" r="18" class="fill" :style="{ strokeDashoffset: 113.1 * (1 - status.immersion) }" /></svg>
            {{ Math.round(status.immersion * 100) }}%
          </dd>
        </div>
        <div><dt>Windows</dt><dd>{{ status.windows ? `${status.windows} open` : 'None' }}<small v-if="status.front"> · {{ status.front }} in front</small></dd></div>
        <div><dt>Local time</dt><dd class="mono">{{ time }}</dd></div>
        <div><dt>Mind</dt><dd>{{ mindLine }}</dd></div>
        <div><dt>Voice</dt><dd>{{ voiceLine }}</dd></div>
        <div v-for="timer in state.timers" :key="timer.id" class="timer"><dt>Timer</dt><dd class="mono">{{ countdown(timer.end) }}<small v-if="timer.label"> · {{ timer.label }}</small></dd></div>
      </dl>
      <div class="signal"><span>Signal</span><canvas ref="signal" aria-hidden="true" /></div>
    </aside>

    <aside class="panel process" aria-label="Process log">
      <h3>Process<em>{{ state.turns }} turns</em></h3>
      <ol>
        <li v-for="line in tail" :key="line.id" :class="line.kind"><time>{{ stamp(line.at) }}</time><span>{{ line.text }}</span></li>
      </ol>
    </aside>

    <section class="transcript" aria-live="polite">
      <p v-if="state.you && !needsSetup" class="you"><em>You</em>{{ state.you }}</p>
      <p v-if="state.mode === 'thinking' && !state.caption" class="said thinking"><i /><i /><i /></p>
      <p v-else-if="state.words.length" class="said"><span v-for="(word, index) in state.words" :key="index" :class="{ lit: index <= state.spoken }">{{ `${word} ` }}</span></p>
    </section>

    <!-- First time: how much of JARVIS to wake. -->
    <Transition name="card">
      <div v-if="needsSetup" class="setup-card">
        <h2>Bring JARVIS fully online?</h2>
        <p>JARVIS can think and speak entirely on this device: a two-billion-parameter language model and a neural British voice, running on your graphics card. Nothing you say leaves this browser.</p>
        <div class="choices">
          <button class="primary" @click="full"><b>Full JARVIS</b><small>About 1.4 GB, downloaded once · Chrome or Edge</small></button>
          <button @click="instant"><b>Instant</b><small>Local protocols and system voice · no download</small></button>
        </div>
      </div>
    </Transition>
    <Transition name="card">
      <div v-if="!needsSetup && loading" class="loading-bar" role="progressbar" :aria-valuenow="Math.round(progress * 100)">
        <span>Bringing the neural core online</span><b>{{ Math.round(progress * 100) }}%</b><i :style="{ transform: `scaleX(${progress})` }" />
        <small>You can talk to me while I load.</small>
      </div>
    </Transition>

    <div v-if="!needsSetup" class="chips" :key="needsAddress ? 'address' : suggestionPage">
      <template v-if="needsAddress && !named">
        <span class="ask-label">How shall I address you?</span>
        <button v-for="choice in ['sir', 'ma\'am', 'boss']" :key="choice" @click="chooseAddress(choice)">{{ choice.charAt(0).toUpperCase() + choice.slice(1) }}</button>
        <button @click="chooseAddress('name')">By name…</button>
      </template>
      <button v-for="item in suggestions" v-else :key="item" @click="send(item)">{{ item }}</button>
    </div>

    <form v-if="!needsSetup" class="ask" @submit.prevent="send()">
      <button v-if="micAvailable" type="button" class="mic" :class="{ on: listening }" :aria-label="listening ? 'Stop listening' : 'Speak to JARVIS'" :aria-pressed="listening" @click="mic">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </button>
      <input ref="input" v-model="question" type="text" maxlength="300" autocomplete="off" spellcheck="false" :placeholder="listening ? 'Listening…' : named ? 'Your first name' : 'Speak, or type to JARVIS…'" aria-label="Talk to JARVIS" @keydown.stop />
      <button type="submit" class="send" aria-label="Send" :disabled="!question.trim()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </form>

    <nav class="corner">
      <button :aria-pressed="settings" aria-label="JARVIS settings" title="Settings" @click="settings = !settings">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
      </button>
      <button :aria-label="docked ? 'Expand JARVIS' : 'Step aside'" :title="docked ? 'Expand' : 'Step aside'" @click="emit('dock', !docked)">
        <svg v-if="docked" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15V5h10M19 9v10H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19h14M12 4v11m-4-4 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
      <button aria-label="Dismiss JARVIS (Esc)" title="Dismiss · Esc" @click="emit('close')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" /></svg>
      </button>
    </nav>

    <Transition name="drawer">
      <aside v-if="settings" class="settings" aria-label="JARVIS settings">
        <h3>Settings</h3>
        <section>
          <h4>Address me as</h4>
          <div class="seg">
            <button v-for="choice in ['sir', 'ma\'am', 'boss']" :key="choice" :aria-pressed="state.address === choice" @click="jarvis.setAddress(choice)">{{ choice }}</button>
            <input :value="['sir', 'ma\'am', 'boss', ''].includes(state.address) ? '' : state.address" placeholder="Name" maxlength="24" aria-label="Your name" @keydown.stop @change="jarvis.setAddress(($event.target as HTMLInputElement).value.trim())" />
          </div>
        </section>
        <section>
          <h4>Voice <button class="toggle" :aria-pressed="state.voiceOn" @click="jarvis.setVoiceOn(!state.voiceOn)">{{ state.voiceOn ? 'On' : 'Off' }}</button></h4>
          <p v-if="state.voiceEngine !== 'neural'" class="note">{{ state.voiceStatus === 'loading' ? `Neural voice loading · ${Math.round(state.voiceProgress * 100)}%` : 'Using your system voice. Wake the neural core for Kokoro.' }}</p>
          <div class="voices">
            <button v-for="item in VOICES" :key="item.id" :aria-pressed="state.voiceId === item.id" :disabled="state.voiceEngine !== 'neural'" @click="jarvis.setVoice(item.id)"><b>{{ item.name }}</b><small>{{ item.line }}</small></button>
          </div>
        </section>
        <section>
          <h4>Neural core</h4>
          <p class="note">{{ MODELS[0]!.name }} · {{ MODELS[0]!.size }} · {{ mindLine.toLowerCase() }}</p>
          <button v-if="state.mindStatus !== 'ready' && state.mindStatus !== 'loading'" class="wide" @click="full">Bring it online</button>
          <button v-else-if="state.mindStatus === 'ready'" class="wide" @click="jarvis.mind.unload()">Put it to sleep</button>
        </section>
        <section>
          <h4>Remarks as you go</h4>
          <div class="seg">
            <button v-for="value in (['off', 'captions', 'spoken'] as const)" :key="value" :aria-pressed="state.remarks === value" @click="jarvis.setRemarks(value)">{{ value }}</button>
          </div>
        </section>
        <button class="wide quiet" @click="jarvis.forget()">Clear conversation memory</button>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.jarvis-hud{--gold:#ffc15a;--amber:#ff9a2e;--deep:#d97b28;--white:#fff1ca;--cyan:#63d8ff;--line:rgb(255 193 90 / .2);position:absolute;inset:0;z-index:7700;color:var(--white);font:400 14px/1.4 'Inter',system-ui,sans-serif;pointer-events:auto;overflow:hidden}
.jarvis-hud *{box-sizing:border-box}
.jarvis-hud button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.jarvis-hud button:focus-visible{outline:1.5px solid var(--gold);outline-offset:3px}
.jarvis-hud input:focus-visible{outline:none}
.veil{position:absolute;inset:0;background:radial-gradient(ellipse 60% 55% at 50% 44%,rgb(12 8 2 / .55),rgb(4 3 1 / .86) 70%,rgb(2 1 0 / .94));backdrop-filter:blur(7px) saturate(.8);-webkit-backdrop-filter:blur(7px) saturate(.8);transition:opacity .6s ease;animation:veil-in .6s ease both}
@keyframes veil-in{from{opacity:0}}
.stage{position:absolute;left:0;top:0;transform-origin:50% 50%;transition:transform .8s cubic-bezier(.2,.8,.2,1);will-change:transform}
.stage canvas{width:100%;height:100%;display:block;cursor:grab}
.stage canvas:active{cursor:grabbing}

/* Title */
.title{position:absolute;top:22px;left:50%;translate:-50% 0;text-align:center;display:grid;justify-items:center;gap:3px;font-family:'Rajdhani','Inter',sans-serif;transition:opacity .4s,translate .6s cubic-bezier(.2,.8,.2,1);animation:rise .8s .25s cubic-bezier(.2,.8,.2,1) both}
.title b{font-size:17px;font-weight:600;letter-spacing:.62em;margin-right:-.62em;color:var(--gold);text-shadow:0 0 18px rgb(255 160 50 / .55)}
.title small{font-size:9.5px;letter-spacing:.36em;margin-right:-.36em;text-transform:uppercase;color:rgb(255 225 170 / .5)}
.title .state{margin-top:6px;display:flex;align-items:center;gap:8px;font-size:11px;font-weight:600;letter-spacing:.28em;color:rgb(255 210 140 / .78);padding:4px 12px 4px 10px;border:1px solid var(--line);border-radius:999px;background:rgb(255 170 60 / .05)}
.title .state i{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 10px var(--gold);animation:blink 2.4s ease-in-out infinite}
.thinking .title .state i{animation-duration:.5s}.speaking .title .state i{background:var(--white)}.listening .title .state i{background:var(--cyan);box-shadow:0 0 10px var(--cyan)}
@keyframes blink{50%{opacity:.25}}

/* Panels: hairlines with gold corner brackets */
.panel{position:absolute;top:110px;width:272px;padding:16px 18px 14px;background:linear-gradient(180deg,rgb(255 170 60 / .07),rgb(255 170 60 / .015));border:1px solid rgb(255 193 90 / .13);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);transition:opacity .45s,translate .7s cubic-bezier(.2,.8,.2,1)}
.panel::before,.panel::after{content:'';position:absolute;width:14px;height:14px;border:1.5px solid var(--gold);opacity:.8}
.panel::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
.panel::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.panel h3{margin:0 0 10px;display:flex;justify-content:space-between;align-items:baseline;font:600 11px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.34em;text-transform:uppercase;color:var(--gold)}
.panel h3 em{font-style:normal;letter-spacing:.12em;color:rgb(255 210 140 / .45);font-size:10px}
.systems{left:34px;animation:from-left .8s .35s cubic-bezier(.2,.8,.2,1) both}
.process{right:34px;width:340px;animation:from-right .8s .45s cubic-bezier(.2,.8,.2,1) both}
@keyframes from-left{from{opacity:0;translate:-40px 0}}@keyframes from-right{from{opacity:0;translate:40px 0}}@keyframes rise{from{opacity:0;translate:-50% -16px}}
.systems dl{margin:0;display:grid;gap:9px}
.systems dl>div{display:grid;gap:2px;padding-bottom:9px;border-bottom:1px solid rgb(255 193 90 / .08)}
.systems dt{font:600 9.5px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.26em;text-transform:uppercase;color:rgb(255 210 140 / .5)}
.systems dd{margin:0;font:600 15.5px/1.25 'Rajdhani','Inter',sans-serif;letter-spacing:.04em;color:var(--white);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.systems dd small{font-weight:500;color:rgb(255 225 170 / .55);font-size:12.5px}
.systems .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:14px;font-weight:500;letter-spacing:0}
.gauge{width:30px;height:30px;rotate:-90deg}
.gauge circle{fill:none;stroke:rgb(255 193 90 / .16);stroke-width:3}
.gauge .fill{stroke:var(--gold);stroke-dasharray:113.1;stroke-linecap:round;transition:stroke-dashoffset .6s;filter:drop-shadow(0 0 3px rgb(255 160 50 / .8))}
.timer dd{color:var(--gold)}
.signal{margin-top:10px;display:grid;gap:6px}
.signal span{font:600 9.5px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.26em;text-transform:uppercase;color:rgb(255 210 140 / .5)}
.signal canvas{width:100%;height:34px}

.process ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px;max-height:340px;overflow:hidden;font:400 11.5px/1.55 'JetBrains Mono',ui-monospace,monospace;mask-image:linear-gradient(transparent,#000 22%)}
.process li{display:flex;gap:10px;white-space:nowrap;animation:type-in .5s steps(24) both}
.process li time{flex:none;color:rgb(255 193 90 / .32)}
.process li span{overflow:hidden;text-overflow:ellipsis;color:rgb(255 193 90 / .82)}
.process li.in span{color:var(--white)}
.process li.ok span{color:var(--cyan)}
.process li.sys span{color:rgb(255 193 90 / .5)}
.process li.say span{color:#ffe2a8;font-style:italic}
.process li.warn span{color:#ff684c}
@keyframes type-in{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}

/* Conversation */
.transcript{position:absolute;left:50%;bottom:150px;translate:-50% 0;width:min(860px,calc(100% - 48px));text-align:center;display:grid;gap:10px;pointer-events:none;transition:bottom .7s cubic-bezier(.2,.8,.2,1),width .7s}
.transcript .you{margin:0;font-size:15px;color:rgb(255 241 202 / .62)}
.transcript .you em{font:600 10px/1 'Rajdhani','Inter',sans-serif;font-style:normal;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);margin-right:12px;vertical-align:2px}
.transcript .said{margin:0;font-size:27px;font-weight:300;line-height:1.36;letter-spacing:-.01em;text-wrap:balance;text-shadow:0 0 24px rgb(255 150 40 / .35)}
.transcript .said span{opacity:.24;transition:opacity .28s ease,color .28s}
.transcript .said span.lit{opacity:1}
.transcript .thinking{display:flex;justify-content:center;gap:8px;height:36px;align-items:center}
.transcript .thinking i{width:7px;height:7px;border-radius:50%;background:var(--gold);box-shadow:0 0 12px var(--gold);animation:dots 1s ease-in-out infinite}
.transcript .thinking i:nth-child(2){animation-delay:.15s}.transcript .thinking i:nth-child(3){animation-delay:.3s}
@keyframes dots{50%{opacity:.2;transform:translateY(-4px)}}

.chips{position:absolute;left:50%;bottom:96px;translate:-50% 0;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:min(760px,calc(100% - 32px));animation:chips-in .6s cubic-bezier(.2,.8,.2,1) both;transition:opacity .4s}
@keyframes chips-in{from{opacity:0;translate:-50% 8px}}
.chips button{height:32px;padding:0 15px;border-radius:16px;border:1px solid rgb(255 193 90 / .28);background:rgb(255 170 60 / .06);font-size:13px;color:#ffe2a8;transition:background .2s,border-color .2s,color .2s}
.chips button:hover{background:rgb(255 170 60 / .18);border-color:var(--gold);color:#fff}
.chips .ask-label{align-self:center;font:600 11px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-right:6px}

.ask{position:absolute;left:50%;bottom:30px;translate:-50% 0;width:min(660px,calc(100% - 24px));height:54px;display:flex;align-items:center;gap:6px;padding:0 7px;border-radius:27px;background:rgb(22 15 6 / .62);border:1px solid rgb(255 193 90 / .32);box-shadow:inset 0 0 22px rgb(255 160 50 / .07),0 18px 50px rgb(0 0 0 / .45);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);transition:border-color .25s,box-shadow .25s,width .7s cubic-bezier(.2,.8,.2,1),bottom .7s cubic-bezier(.2,.8,.2,1)}
.ask:focus-within{border-color:rgb(255 193 90 / .7);box-shadow:inset 0 0 22px rgb(255 160 50 / .12),0 0 0 4px rgb(255 170 60 / .08),0 18px 50px rgb(0 0 0 / .45)}
.ask input{flex:1;min-width:0;height:100%;background:none;border:0;outline:0;color:var(--white);font-size:16px;padding:0 8px;caret-color:var(--gold)}
.ask input::placeholder{color:rgb(255 225 170 / .42)}
.ask .mic,.ask .send{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;transition:background .2s,color .2s,transform .2s}
.ask svg{width:20px;height:20px}
.ask .mic{color:var(--gold);box-shadow:inset 0 0 0 1px rgb(255 193 90 / .4);position:relative}
.ask .mic:hover{background:rgb(255 170 60 / .14)}
.ask .mic.on{background:var(--gold);color:#1a1206}
.ask .mic.on::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:1.5px solid var(--gold);animation:ping 1.2s ease-out infinite}
@keyframes ping{from{opacity:.8;scale:.85}to{opacity:0;scale:1.35}}
.ask .send{background:var(--gold);color:#1a1206}
.ask .send:disabled{background:rgb(255 193 90 / .14);color:rgb(255 193 90 / .45);cursor:default}
.ask .send:not(:disabled):hover{transform:scale(1.06)}

.corner{position:absolute;top:20px;right:22px;display:flex;gap:8px;animation:from-right .7s .5s cubic-bezier(.2,.8,.2,1) both}
.corner button{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:var(--gold);background:rgb(22 15 6 / .45);box-shadow:inset 0 0 0 1px rgb(255 193 90 / .3);transition:background .2s,color .2s}
.corner button:hover,.corner button[aria-pressed=true]{background:rgb(255 170 60 / .2);color:#fff}
.corner svg{width:19px;height:19px}

.setup-card{position:absolute;left:50%;bottom:64px;translate:-50% 0;width:min(620px,calc(100% - 28px));padding:24px 26px;text-align:center;background:linear-gradient(180deg,rgb(30 20 8 / .78),rgb(14 9 3 / .82));border:1px solid rgb(255 193 90 / .26);border-radius:20px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 30px 80px rgb(0 0 0 / .5)}
.setup-card h2{margin:0;font:600 22px/1.2 'Rajdhani','Inter',sans-serif;letter-spacing:.06em;color:var(--white)}
.setup-card p{margin:10px auto 18px;max-width:500px;font-size:14px;line-height:1.55;color:rgb(255 235 200 / .72)}
.choices{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.choices button{padding:14px 16px;border-radius:14px;display:grid;gap:4px;text-align:left;border:1px solid rgb(255 193 90 / .28);background:rgb(255 170 60 / .05);transition:background .2s,border-color .2s,transform .2s}
.choices button:hover{background:rgb(255 170 60 / .14);border-color:var(--gold);transform:translateY(-1px)}
.choices button.primary{background:linear-gradient(180deg,#ffcf78,#f2a43a);color:#1a1206;border-color:transparent;box-shadow:0 10px 30px rgb(255 160 50 / .3)}
.choices b{font-size:16px;font-weight:650}
.choices small{font-size:12px;opacity:.75}
.loading-bar{position:absolute;left:50%;top:auto;bottom:calc(150px + 92px);translate:-50% 0;width:min(420px,calc(100% - 40px));display:grid;grid-template-columns:1fr auto;gap:6px 10px;font:600 10.5px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.24em;text-transform:uppercase;color:rgb(255 210 140 / .75)}
.loading-bar b{color:var(--gold);font-weight:700}
.loading-bar i{grid-column:1/-1;height:2px;background:linear-gradient(90deg,var(--deep),var(--gold));transform-origin:0 50%;transition:transform .4s;box-shadow:0 0 10px var(--amber)}
.loading-bar::before{content:'';grid-column:1/-1;grid-row:2;height:2px;background:rgb(255 193 90 / .14)}
.loading-bar small{grid-column:1/-1;font-family:'Inter',sans-serif;letter-spacing:0;text-transform:none;font-weight:400;font-size:12px;color:rgb(255 225 170 / .5)}

.settings{position:absolute;top:72px;right:22px;width:320px;max-height:calc(100% - 180px);overflow:auto;padding:18px;border-radius:18px;background:linear-gradient(180deg,rgb(32 22 9 / .9),rgb(16 11 4 / .92));border:1px solid rgb(255 193 90 / .24);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:0 30px 80px rgb(0 0 0 / .5);scrollbar-width:thin;z-index:2}
.settings h3{margin:0 0 12px;font:600 12px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.34em;text-transform:uppercase;color:var(--gold)}
.settings section{padding:12px 0;border-top:1px solid rgb(255 193 90 / .1)}
.settings h4{margin:0 0 9px;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:600;color:var(--white)}
.settings .note{margin:0 0 9px;font-size:12px;color:rgb(255 225 170 / .55)}
.seg{display:flex;gap:4px;flex-wrap:wrap}
.seg button,.seg input{height:30px;padding:0 12px;border-radius:15px;font-size:12.5px;text-transform:capitalize;border:1px solid rgb(255 193 90 / .22);background:rgb(255 170 60 / .05)}
.seg input{width:96px;color:var(--white);outline:0;text-transform:none}
.seg button[aria-pressed=true],.toggle[aria-pressed=true]{background:var(--gold);color:#1a1206;border-color:transparent}
.toggle{height:24px;padding:0 10px!important;border-radius:12px;font-size:11.5px;border:1px solid rgb(255 193 90 / .3)!important}
.voices{display:grid;gap:5px}
.voices button{display:grid;gap:1px;text-align:left;padding:8px 11px;border-radius:11px;border:1px solid rgb(255 193 90 / .14)}
.voices button[aria-pressed=true]{border-color:var(--gold);background:rgb(255 170 60 / .12)}
.voices button:disabled{opacity:.4;cursor:default}
.voices b{font-size:13px}.voices small{font-size:11.5px;color:rgb(255 225 170 / .55)}
.wide{width:100%;height:36px;border-radius:12px!important;background:rgb(255 170 60 / .14)!important;font-size:13px;font-weight:600}
.wide:hover{background:rgb(255 170 60 / .24)!important}
.wide.quiet{margin-top:6px;background:none!important;color:rgb(255 225 170 / .6)!important}

/* Docked: the HUD steps aside into a bar so the result can be seen. */
.docked .veil{opacity:0}
.docked{pointer-events:none}
.docked :is(.stage,.ask,.corner,.transcript){pointer-events:auto}
.docked :is(.panel,.title,.chips,.setup-card,.loading-bar){opacity:0;pointer-events:none}
.docked .systems{translate:-60px 0}.docked .process{translate:60px 0}
.docked .title{translate:-50% -30px}
.docked .stage canvas{cursor:pointer}
.docked .transcript{bottom:96px;width:min(560px,calc(100% - 210px));translate:-50% 0;text-align:left;margin-left:60px;pointer-events:none}
.docked .transcript .said{font-size:16.5px;text-shadow:none}
.docked .transcript:has(.said){padding:10px 16px;border-radius:16px;background:rgb(20 14 6 / .62);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:inset 0 0 0 1px rgb(255 193 90 / .16)}
.docked .transcript .said span{opacity:.45}.docked .transcript .said span.lit{opacity:1}
.docked .transcript .you{display:none}
.docked .ask{width:min(560px,calc(100% - 210px));margin-left:60px;bottom:30px}
.docked .corner{top:auto;bottom:37px;right:max(16px,calc(50% - 380px));animation:none}
.docked .corner button:first-child{display:none}

/* Phones */
.compact .panel{display:none}
.compact .title{top:16px;left:18px;translate:0 0;justify-items:start;animation:none}.compact .title small{display:none}.compact .title b{font-size:14px;letter-spacing:.42em}
.compact .transcript{bottom:162px}.compact .transcript .said{font-size:20px}
.compact .chips{bottom:96px;gap:6px}.compact .chips button{height:30px;padding:0 11px;font-size:12px}
.compact .ask{bottom:18px;height:50px}
.compact .corner{top:12px;right:12px}.compact .corner button{width:36px;height:36px}
.compact .setup-card{bottom:24px;padding:18px}.compact .choices{grid-template-columns:1fr}
.compact .settings{left:12px;right:12px;width:auto;top:60px}
.compact.docked .transcript,.compact.docked .ask{width:calc(100% - 110px);margin-left:44px}
.compact.docked .corner{top:auto;bottom:80px;right:12px}
.compact.docked .title{opacity:0}

.card-enter-active,.card-leave-active{transition:opacity .45s,translate .55s cubic-bezier(.2,.8,.2,1)}
.card-enter-from,.card-leave-to{opacity:0;translate:-50% 14px}
.drawer-enter-active,.drawer-leave-active{transition:opacity .3s,translate .45s cubic-bezier(.2,.8,.2,1)}
.drawer-enter-from,.drawer-leave-to{opacity:0;translate:16px 0}
@media (prefers-reduced-motion:reduce){.jarvis-hud *{animation:none!important}.stage{transition:none}}
</style>
