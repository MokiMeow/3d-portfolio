<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { Jarvis } from './useJarvis';
import { MiniOrb } from './mini';
import JarvisCore from './JarvisCore.vue';

/**
 * JARVIS in the corner of your view. A small gold orb you can drag anywhere; a quick panel for one-line
 * requests; remarks that appear beside it as you move between places; and the door to the full HUD.
 */
const props = defineProps<{ jarvis: Jarvis; compact: boolean; status: { place: string; immersion: number; windows: number; front: string } }>();
const emit = defineEmits<{ core: [state: 'closed' | 'open' | 'docked'] }>();
const state = props.jarvis.state;

const layer = ref<HTMLElement>();
const dock = ref<HTMLElement>();
const orbCanvas = ref<HTMLCanvasElement>();
const input = ref<HTMLInputElement>();
const core = ref<InstanceType<typeof JarvisCore>>();
const panel = ref(false);
const coreOpen = ref(false);
const docked = ref(false);
const question = ref('');
const bounds = ref({ w: 1280, h: 720 });
const position = ref<{ x: number; y: number } | null>(null);
let orb: MiniOrb | null = null;
let observer: ResizeObserver | undefined;
const STORAGE = 'lab-vision-jarvis-pos';
const size = computed(() => props.compact ? 48 : 54);

const QUICK = ['Take me to the Moon', 'Status report', 'Hide everything', 'Drop five glass cubes'] as const;

function pixel() {
  const maxX = Math.max(0, bounds.value.w - size.value - 12), maxY = Math.max(0, bounds.value.h - size.value - 12);
  return position.value ? { x: Math.max(12, position.value.x * maxX), y: Math.max(12, position.value.y * maxY) }
    : { x: Math.max(12, bounds.value.w - size.value - (props.compact ? 16 : 28)), y: Math.max(12, bounds.value.h - size.value - (props.compact ? 112 : 120)) };
}
/** The orb's centre in page pixels, so the full display can arrive out of it and fold back into it. */
const orbCentre = computed(() => { const p = pixel(), rect = layer.value?.getBoundingClientRect(); return { x: (rect?.left ?? 0) + p.x + size.value / 2, y: (rect?.top ?? 0) + p.y + size.value / 2 }; });
const dockStyle = computed<CSSProperties>(() => { const p = pixel(); return { left: `${p.x}px`, top: `${p.y}px`, width: `${size.value}px`, height: `${size.value}px` }; });
/** The quick panel and remarks open on whichever side of the orb has room. */
const side = computed(() => {
  const p = pixel();
  return { left: p.x > bounds.value.w / 2, up: p.y > bounds.value.h / 2 };
});
const panelStyle = computed<CSSProperties>(() => {
  const p = pixel(), w = Math.min(372, bounds.value.w - 24);
  if (props.compact) return { left: '12px', right: '12px', width: 'auto', ...(side.value.up ? { bottom: `${bounds.value.h - p.y + 12}px` } : { top: `${p.y + size.value + 12}px` }) };
  const left = side.value.left ? Math.max(12, p.x + size.value - w) : Math.min(bounds.value.w - w - 12, p.x);
  return { left: `${left}px`, width: `${w}px`, ...(side.value.up ? { bottom: `${bounds.value.h - p.y + 14}px` } : { top: `${p.y + size.value + 14}px` }) };
});
const whisperStyle = computed<CSSProperties>(() => {
  const p = pixel();
  return side.value.left ? { right: `${bounds.value.w - p.x + 12}px`, top: `${p.y + size.value / 2}px` } : { left: `${p.x + size.value + 12}px`, top: `${p.y + size.value / 2}px` };
});

watch(() => state.mode, mode => { if (orb) orb.mode = panel.value && mode === 'idle' ? 'open' : mode; });
watch(panel, open => { if (orb) orb.mode = open ? 'open' : state.mode; if (open) void nextTick(() => input.value?.focus({ preventScroll: true })); });
watch(() => state.whispers.length, () => { if (orb && state.whispers.length) { orb.mode = 'alert'; window.setTimeout(() => { if (orb) orb.mode = state.mode; }, 1600); } });

async function quick(text = question.value) {
  if (!text.trim()) return;
  question.value = '';
  await props.jarvis.ask(text);
}
function activate() { if (coreOpen.value) { core.value?.focus(); return; } panel.value = !panel.value; }
async function talk() {
  panel.value = false;
  coreOpen.value = true; docked.value = false;
  emit('core', 'open');
}
async function closeCore() {
  await core.value?.implode();
  coreOpen.value = false; docked.value = false;
  emit('core', 'closed');
}
function setDocked(value: boolean) { docked.value = value; emit('core', value ? 'docked' : 'open'); }
/** When he changes what you see, JARVIS returns to his corner so the apps and the place are yours to use. */
function stepAside() { if (coreOpen.value) void closeCore(); }
/** What he is saying right now, shown beside the orb while the full display is closed. */
const live = computed(() => state.words.slice(0, Math.max(0, state.spoken + 1)).join(' '));
/** Offer hands-free once, until it is on or turned down. */
const offerEar = ref(false);
window.setTimeout(() => { offerEar.value = props.jarvis.wakeAvailable && !state.wake && localStorage.getItem('lab-jarvis-ear-offered') !== '1'; }, 2500);
watch(() => state.wake, on => { if (on) offerEar.value = false; });
function enableEar() { offerEar.value = false; localStorage.setItem('lab-jarvis-ear-offered', '1'); props.jarvis.setWake(true); }
defineExpose({ activate, talk, stepAside, close: closeCore, get open() { return coreOpen.value; }, get visible() { return coreOpen.value || panel.value; } });

/* Dragging the orb */
let drag: { id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
let swallow = false;
function down(event: PointerEvent) {
  if (event.button !== 0) return;
  const p = pixel();
  drag = { id: event.pointerId, sx: event.clientX, sy: event.clientY, ox: p.x, oy: p.y, moved: false };
  swallow = false;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.sx, dy = event.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 5) return;
  drag.moved = true; swallow = true;
  const maxX = Math.max(1, bounds.value.w - size.value - 12), maxY = Math.max(1, bounds.value.h - size.value - 12);
  position.value = { x: Math.max(0, Math.min(1, (drag.ox + dx) / maxX)), y: Math.max(0, Math.min(1, (drag.oy + dy) / maxY)) };
}
function up() {
  if (drag?.moved && position.value) { try { localStorage.setItem(STORAGE, JSON.stringify(position.value)); } catch { /* optional */ } }
  drag = null;
}
function click() { if (swallow) { swallow = false; return; } activate(); }
function keys(event: KeyboardEvent) {
  if (event.key === 'Escape' && panel.value && !coreOpen.value) { event.preventDefault(); event.stopImmediatePropagation(); panel.value = false; }
}

onMounted(() => {
  try { const p = JSON.parse(localStorage.getItem(STORAGE) ?? 'null'); if (p && typeof p.x === 'number' && typeof p.y === 'number') position.value = { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) }; } catch { /* ignore */ }
  if (orbCanvas.value) { orb = new MiniOrb(orbCanvas.value); orb.level = () => props.jarvis.voice.level(); orb.start(); }
  if (layer.value) {
    observer = new ResizeObserver(() => { if (layer.value?.clientWidth) bounds.value = { w: layer.value.clientWidth, h: layer.value.clientHeight }; });
    observer.observe(layer.value);
  }
  window.addEventListener('keydown', keys, true);
});
onBeforeUnmount(() => { orb?.stop(); observer?.disconnect(); window.removeEventListener('keydown', keys, true); });
</script>

<template>
  <div ref="layer" class="jarvis-layer" :class="{ compact, 'core-open': coreOpen }">
    <!-- Remarks beside the orb -->
    <TransitionGroup name="whisper" tag="div" class="whispers" :class="{ left: side.left }" :style="whisperStyle">
      <button v-for="item in state.whispers" v-show="!coreOpen && !panel" :key="item.id" class="whisper" @click="panel = true">{{ item.text }}</button>
    </TransitionGroup>

    <!-- His words beside the orb while he speaks from the corner -->
    <Transition name="whisper">
      <button v-if="!coreOpen && !panel && state.mode !== 'idle' && (live || state.mode === 'thinking' || state.mode === 'listening')" class="whisper live" :class="{ left: side.left, listening: state.mode === 'listening' }" :style="whisperStyle" @click="panel = true">
        <template v-if="state.mode === 'listening'"><i class="mic" />Listening…</template>
        <i v-else-if="!live" class="dots"><i /><i /><i /></i><template v-else>{{ live }}</template>
      </button>
      <button v-else-if="!coreOpen && !panel && offerEar" class="whisper live offer" :class="{ left: side.left }" :style="whisperStyle" @click="enableEar"><i class="mic" />Turn on <b>“Hey JARVIS”</b>: talk to me hands-free</button>
    </Transition>

    <!-- Quick panel -->
    <Transition name="quick">
      <section v-if="panel && !coreOpen" class="quick" :style="panelStyle" role="dialog" aria-label="JARVIS" @pointerdown.stop @wheel.stop>
        <header>
          <div><b>JARVIS</b><small>{{ state.mode === 'thinking' ? 'Processing' : state.mode === 'speaking' ? 'Speaking' : state.mindStatus === 'ready' ? 'Neural core online' : 'Standing by' }}</small></div>
          <button class="x" aria-label="Close" @click="panel = false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg></button>
        </header>
        <p class="reply" aria-live="polite">
          <template v-if="state.mode === 'thinking'"><i class="dots"><i /><i /><i /></i></template>
          <template v-else-if="state.caption">{{ state.caption }}</template>
          <template v-else>At your service{{ state.address ? `, ${state.address}` : '' }}. What can I do for you?</template>
        </p>
        <form @submit.prevent="quick()">
          <input ref="input" v-model="question" type="text" maxlength="300" placeholder="Ask JARVIS…" aria-label="Ask JARVIS" autocomplete="off" @keydown.stop />
          <button type="submit" :disabled="!question.trim()" aria-label="Send"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
        </form>
        <div class="chips"><button v-for="item in QUICK" :key="item" @click="quick(item)">{{ item }}</button></div>
        <button v-if="jarvis.wakeAvailable" class="handsfree" :aria-pressed="state.wake" @click="jarvis.setWake(!state.wake)">
          <i class="mic" /><span><b>“Hey JARVIS”</b><small>{{ state.wake ? (state.ear === 'listening' ? 'Listening…' : 'On: just say his name') : 'Off: tap to talk hands-free' }}</small></span><em>{{ state.wake ? 'On' : 'Off' }}</em>
        </button>
        <button class="talk" @click="talk">
          <span class="glyph" aria-hidden="true"><i /><i /><i /></span>
          <span><b>Talk to JARVIS</b><small>Voice, conversation and the full display</small></span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </section>
    </Transition>

    <!-- The orb -->
    <div ref="dock" class="orb-dock" :style="dockStyle" :class="{ hidden: coreOpen }" @pointerdown.stop>
      <button class="orb" :class="{ active: panel, busy: state.mode !== 'idle' }" :aria-label="panel ? 'Close JARVIS' : 'JARVIS. Drag to move.'" :aria-expanded="panel"
        @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @click.stop="click" @dblclick.stop="talk">
        <canvas ref="orbCanvas" aria-hidden="true" />
      </button>
    </div>

    <!-- The full HUD -->
    <JarvisCore v-if="coreOpen" ref="core" :jarvis="jarvis" :docked="docked" :compact="compact" :status="status" :origin="orbCentre" @close="closeCore" @dock="setDocked" />
  </div>
</template>

<style scoped>
.jarvis-layer{--gold:#ffc15a;--white:#fff1ca;position:absolute;inset:0;pointer-events:none;z-index:7600;color:var(--white);font:400 15px/1.4 'Inter',system-ui,sans-serif;letter-spacing:-.01em}
.jarvis-layer *{box-sizing:border-box}
.jarvis-layer button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.jarvis-layer button:focus-visible{outline:1.5px solid var(--gold);outline-offset:3px}
.jarvis-layer input:focus-visible{outline:none}

.orb-dock{position:absolute;pointer-events:auto;transition:opacity .4s,scale .5s cubic-bezier(.2,.8,.2,1)}
.orb-dock.hidden{opacity:0;scale:.6;pointer-events:none}
.orb{width:100%;height:100%;border-radius:50%;display:block;position:relative;touch-action:none;transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.orb canvas{width:100%;height:100%;display:block;border-radius:50%}
.orb::after{content:'';position:absolute;inset:-3px;border-radius:50%;box-shadow:0 0 0 1px rgb(255 193 90 / .35),0 0 22px rgb(255 150 40 / .3);transition:box-shadow .3s}
.orb:hover{transform:scale(1.08)}
.orb:hover::after,.orb.active::after{box-shadow:0 0 0 1.5px rgb(255 193 90 / .8),0 0 30px rgb(255 150 40 / .55)}
.orb.busy::after{animation:halo 1.6s ease-in-out infinite}
@keyframes halo{50%{box-shadow:0 0 0 1.5px rgb(255 193 90 / .9),0 0 38px rgb(255 150 40 / .7)}}

.quick{position:absolute;pointer-events:auto;padding:18px;border-radius:26px;background:linear-gradient(160deg,rgb(255 200 120 / .12),rgb(255 255 255 / .03) 40%),rgb(26 20 12 / .86);border:1px solid rgb(255 193 90 / .22);backdrop-filter:blur(40px) saturate(140%);-webkit-backdrop-filter:blur(40px) saturate(140%);box-shadow:inset 0 1px 0 rgb(255 230 180 / .18),0 30px 80px rgb(0 0 0 / .5)}
.quick header{display:flex;justify-content:space-between;align-items:flex-start}
.quick header b{display:block;font:600 14px/1 'Rajdhani','Inter',sans-serif;letter-spacing:.42em;color:var(--gold)}
.quick header small{display:block;margin-top:5px;font-size:12px;color:rgb(255 225 170 / .55)}
.quick .x{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:rgb(255 255 255 / .06)}
.quick .x:hover{background:rgb(255 255 255 / .14)}
.quick .x svg{width:15px;height:15px}
.reply{margin:14px 2px 14px;font-size:17px;line-height:1.4;font-weight:400;min-height:24px;color:var(--white)}
.dots{display:inline-flex;gap:6px;vertical-align:middle}
.dots i{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:dots 1s ease-in-out infinite}
.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes dots{50%{opacity:.2;transform:translateY(-3px)}}
.quick .handsfree{margin-top:12px;width:100%;display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:16px;background:rgb(255 255 255 / .05);border:1px solid rgb(255 193 90 / .16);text-align:left}
.quick .handsfree .mic{width:10px;height:10px;border-radius:50%;background:rgb(255 255 255 / .3)}.quick .handsfree[aria-pressed=true] .mic{background:#63d8ff;box-shadow:0 0 10px #63d8ff}
.quick .handsfree span{flex:1;display:grid;gap:2px}.quick .handsfree b{font-size:14px}.quick .handsfree small{font-size:12px;color:rgb(255 225 170 / .6)}
.quick .handsfree em{font-style:normal;font-size:12px;font-weight:600;padding:4px 10px;border-radius:10px;background:rgb(255 255 255 / .08)}.quick .handsfree[aria-pressed=true] em{background:var(--gold);color:#1a1206}
.quick form{display:flex;align-items:center;gap:6px;height:44px;padding:0 5px 0 15px;border-radius:22px;background:rgb(0 0 0 / .28);box-shadow:inset 0 0 0 1px rgb(255 193 90 / .18)}
.quick form:focus-within{box-shadow:inset 0 0 0 1px rgb(255 193 90 / .55)}
.quick input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--white);font-size:15px;caret-color:var(--gold)}
.quick input::placeholder{color:rgb(255 225 170 / .45)}
.quick form button{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--gold);color:#1a1206}
.quick form button:disabled{background:rgb(255 193 90 / .14);color:rgb(255 193 90 / .45);cursor:default}
.quick form svg{width:17px;height:17px}
.quick .chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 14px}
.quick .chips button{height:30px;padding:0 12px;border-radius:15px;font-size:12.5px;color:#ffe2a8;background:rgb(255 170 60 / .07);box-shadow:inset 0 0 0 1px rgb(255 193 90 / .2);transition:background .2s}
.quick .chips button:hover{background:rgb(255 170 60 / .2)}
.talk{width:100%;display:flex;align-items:center;gap:13px;padding:12px 14px 12px 12px;border-radius:18px;text-align:left;color:#1a1206!important;background:linear-gradient(110deg,#f3a63c,#ffd38a 45%,#f3a63c 90%) 0 0/220% 100%!important;box-shadow:0 12px 34px rgb(255 150 40 / .32),inset 0 1px 0 rgb(255 255 255 / .5);animation:sheen 5s ease-in-out infinite;transition:transform .2s}
.talk:hover{transform:translateY(-1px)}
@keyframes sheen{50%{background-position:100% 0}}
.talk b{display:block;font-size:15.5px;font-weight:700}
.talk small{display:block;font-size:12px;opacity:.7;margin-top:1px}
.talk>span:nth-child(2){flex:1}
.talk>svg{width:18px;height:18px;flex:none}
.glyph{flex:none;width:36px;height:36px;border-radius:50%;position:relative;background:radial-gradient(circle,#2a1a06 30%,#1a1004 70%);box-shadow:inset 0 0 0 1px rgb(26 18 6 / .5)}
.glyph i{position:absolute;inset:7px;border-radius:50%;border:1.5px solid #ffc15a;border-left-color:transparent;border-bottom-color:transparent;animation:spin 3s linear infinite}
.glyph i:nth-child(2){inset:12px;animation-duration:2s;animation-direction:reverse;border-color:#ffd38a;border-right-color:transparent}
.glyph i:nth-child(3){inset:15.5px;border:2px solid #fff1ca;animation:none;box-shadow:0 0 8px #ffc15a}
@keyframes spin{to{rotate:360deg}}

.whispers{position:absolute;display:grid;gap:8px;translate:0 -50%;pointer-events:auto;max-width:min(330px,calc(100vw - 110px))}
.whispers.left{justify-items:end}
.jarvis-layer .whisper.live{position:absolute;translate:0 -50%;pointer-events:auto;max-width:min(360px,calc(100vw - 110px));font-size:14px;padding:10px 15px;border-radius:16px;background:linear-gradient(160deg,rgb(255 200 120 / .14),rgb(255 255 255 / .02)),rgb(24 17 8 / .86)!important;border:1px solid rgb(255 193 90 / .3)!important;box-shadow:0 16px 40px rgb(0 0 0 / .35)}
@keyframes blink{50%{opacity:.25}}
.jarvis-layer .whisper.live .dots{display:inline-flex;gap:5px}.jarvis-layer .whisper.live .dots i{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out infinite}.jarvis-layer .whisper.live .dots i:nth-child(2){animation-delay:.15s}.jarvis-layer .whisper.live .dots i:nth-child(3){animation-delay:.3s}
.whisper.live.left{text-align:right}
.jarvis-layer .whisper.live .mic{display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:#63d8ff;box-shadow:0 0 10px #63d8ff;animation:blink 1.1s ease-in-out infinite;vertical-align:1px}
.jarvis-layer .whisper.live.offer{cursor:pointer}.jarvis-layer .whisper.live.offer b{color:var(--gold);font-weight:600}
.whisper{padding:10px 15px;border-radius:16px;font-size:13.5px;line-height:1.4;text-align:left;color:var(--white)!important;background:linear-gradient(160deg,rgb(255 200 120 / .12),rgb(255 255 255 / .02)),rgb(24 17 8 / .82)!important;border:1px solid rgb(255 193 90 / .26)!important;backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);box-shadow:0 16px 40px rgb(0 0 0 / .35);animation:type-in .9s steps(40) both}
@keyframes type-in{from{clip-path:inset(0 100% 0 0 round 16px)}to{clip-path:inset(0 0 0 0 round 16px)}}
.whisper-leave-active{transition:opacity .5s,translate .5s}
.whisper-leave-to{opacity:0;translate:0 -8px}
.quick-enter-active,.quick-leave-active{transition:opacity .3s,scale .45s cubic-bezier(.2,.8,.2,1),translate .45s cubic-bezier(.2,.8,.2,1)}
.quick-enter-from,.quick-leave-to{opacity:0;scale:.94;translate:0 10px}
.compact .quick{padding:16px}
@media (prefers-reduced-motion:reduce){.jarvis-layer *{animation:none!important}}
</style>
