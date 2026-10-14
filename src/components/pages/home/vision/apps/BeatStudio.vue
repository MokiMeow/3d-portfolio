<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { BeatAudio } from './beat/audio';
import { lockedNote, pads, piano, presets, trackPads, type SynthSettings } from './beat/model';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const app = ref<HTMLElement>();
const spectrum = ref<HTMLCanvasElement>();
const head = ref<HTMLElement>();
const readout = ref<HTMLElement>();
const playing = ref(false);
const busy = ref(false);
const recording = ref(false);
const canRecord = ref(false);
const preset = ref(2);
const bpm = ref(78);
const swing = ref(32);
const synth = ref<SynthSettings>({ cutoff: 650, resonance: .8, delay: .35, scale: true });
const steps = ref(presets[2]!.pattern.map(row => [...row]));
const muted = ref(Array<boolean>(8).fill(false));
const solo = ref(Array<boolean>(8).fill(false));
const status = ref('Original sounds. No samples, no musical qualifications required.');
let audio: BeatAudio | undefined;
let scheduler: ReturnType<typeof setInterval> | undefined;
let frame = 0;
let operation = 0;
let disposed = false;
let visible = true;
let reduced = false;
let motion: MediaQueryList | undefined;
let resize: ResizeObserver | undefined;
let intersection: IntersectionObserver | undefined;
let canvasContext: CanvasRenderingContext2D | null = null;
let width = 1;
let height = 1;
let nextTime = 0;
let nextStep = 0;
let scheduledCount = 0;
let recordEnd = Infinity;
let recorder: MediaRecorder | undefined;
let downloadUrl: string | undefined;
let recordMime = '';
let lastVisual = 0;
let visualUntil = 0;
let hue = '#b99bff';
let currentVisual: { step: number; time: number; duration: number } | undefined;
const visualQueue: { step: number; time: number; duration: number; hits: number[] }[] = [];
const frequencies = new Uint8Array(128);
const levels = new Float32Array(32);
const padElements: HTMLButtonElement[] = [];
const animations = new Map<HTMLElement, Animation>();
const held = new Map<string, (() => void) | null>();
const keyPositions = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7];

function announce(message: string): void { if (!disposed) status.value = message; }
async function ready(): Promise<BeatAudio | undefined> {
  if (disposed || !visible || document.hidden) return;
  try {
    audio ??= new BeatAudio();
    audio.configure(synth.value);
    if (await audio.resume() && !disposed && visible && !document.hidden) return audio;
  } catch { announce('Audio is unavailable in this browser. The pattern editor still works.'); }
}
function flash(index: number): void {
  const element = padElements[index];
  const color = pads[index]?.color;
  if (!element || !color) return;
  hue = color;
  animations.get(element)?.cancel();
  if (typeof element.animate === 'function') {
    const animation = element.animate([
      { boxShadow: 'inset 0 0 0 2px ' + color + ', 0 0 30px ' + color + '88', backgroundColor: color + '55', transform: reduced ? 'none' : 'scale(.96)' },
      { boxShadow: 'inset 0 0 0 1px ' + color + '33', backgroundColor: color + '12', transform: 'scale(1)' },
    ], { duration: reduced ? 120 : 420, easing: 'ease-out' });
    animations.set(element, animation);
    animation.onfinish = () => { if (animations.get(element) === animation) animations.delete(element); };
    const ripple = element.querySelector<HTMLElement>('.ripple');
    if (ripple && !reduced) {
      animations.get(ripple)?.cancel();
      const wave = ripple.animate([{ opacity: .7, transform: 'scale(.15)' }, { opacity: 0, transform: 'scale(2)' }], { duration: 520, easing: 'ease-out' });
      animations.set(ripple, wave);
      wave.onfinish = () => { if (animations.get(ripple) === wave) animations.delete(ripple); };
    }
  }
}
async function hit(index: number, event?: PointerEvent): Promise<void> {
  let velocity = .8;
  if (event?.currentTarget instanceof HTMLElement) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / Math.max(box.width, 1) - .5;
    const y = (event.clientY - box.top) / Math.max(box.height, 1) - .5;
    velocity = Math.max(.25, 1 - Math.hypot(x, y) * 1.05);
    app.value?.focus({ preventScroll: true });
  }
  flash(index);
  const engine = await ready();
  if (!engine) return;
  engine.hit(index, engine.context.currentTime, velocity);
  visualUntil = performance.now() + 1800;
  beginFrames();
}
async function noteDown(id: string, note: number): Promise<void> {
  if (held.has(id)) return;
  held.set(id, null);
  const engine = await ready();
  if (!engine || !held.has(id)) { held.delete(id); return; }
  held.set(id, engine.note(lockedNote(note, synth.value.scale)));
  visualUntil = performance.now() + 21000;
  beginFrames();
}
function noteUp(id: string): void {
  held.get(id)?.();
  held.delete(id);
  if (!held.size) visualUntil = performance.now() + 1000;
}
function releaseNotes(): void { for (const id of held.keys()) noteUp(id); }
function pointerNote(event: PointerEvent, note: number): void {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.focus({ preventScroll: true });
  void noteDown('pointer-' + event.pointerId, note);
}
function keys(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return;
  const key = event.key.toLowerCase();
  const pad = pads.findIndex(item => item.key.toLowerCase() === key);
  if (pad >= 0) { event.preventDefault(); void hit(pad); return; }
  const note = piano.findIndex(item => item.key.toLowerCase() === key);
  if (note >= 0) { event.preventDefault(); void noteDown('key-' + event.code, note); }
  if (event.key === ' ' && target === app.value) { event.preventDefault(); void togglePlay(); }
}
function keyUp(event: KeyboardEvent): void { noteUp('key-' + event.code); }
function tick(): void {
  const engine = audio;
  if (!engine || !playing.value) return;
  const now = engine.context.currentTime;
  if (recording.value && now >= recordEnd) { stop(); return; }
  // Never catch up a stalled tab by firing a pile of old notes.
  if (nextTime < now - .03) { nextTime = now + .025; visualQueue.length = 0; }
  let scheduled = 0;
  while (nextTime < now + .1 && scheduled++ < 8) {
    if (recording.value && scheduledCount >= 32) break;
    const step = nextStep;
    const base = 60 / bpm.value / 4;
    const duration = base * (step % 2 === 0 ? 1 + swing.value / 100 : 1 - swing.value / 100);
    const hasSolo = solo.value.some(Boolean);
    const hits: number[] = [];
    trackPads.forEach((pad, track) => {
      if (steps.value[track]?.[step] && !muted.value[track] && (!hasSolo || solo.value[track])) {
        engine.hit(pad, nextTime, step % 4 === 0 ? .82 : .65);
        hits.push(pad);
      }
    });
    visualQueue.push({ step, time: nextTime, duration, hits });
    nextTime += duration;
    nextStep = (step + 1) % 16;
    scheduledCount++;
    if (recording.value && scheduledCount === 32) recordEnd = nextTime;
  }
}
function beginSequence(engine: BeatAudio): void {
  nextStep = 0;
  scheduledCount = 0;
  nextTime = engine.context.currentTime + .045;
  recordEnd = Infinity;
  visualQueue.length = 0;
  currentVisual = undefined;
  playing.value = true;
  tick();
  scheduler = setInterval(tick, 25);
  beginFrames();
}
async function togglePlay(): Promise<void> {
  if (recording.value) { cancelRecording(); return; }
  if (playing.value || busy.value) { stop(); return; }
  const request = ++operation;
  busy.value = true;
  const engine = await ready();
  if (request !== operation || disposed) return;
  busy.value = false;
  if (engine) { beginSequence(engine); announce('Looping. Tap a step to rewrite the future.'); }
}
function cancelRecording(): void {
  if (recorder) { recorder.onstop = null; recorder.ondataavailable = null; }
  stop();
  announce('Recording cancelled. Your pattern is still here.');
}
function stopRecord(): void {
  if (recorder?.state === 'recording') recorder.stop();
  recording.value = false;
  recordEnd = Infinity;
}
function stop(): void {
  operation++;
  busy.value = false;
  playing.value = false;
  if (scheduler) clearInterval(scheduler);
  scheduler = undefined;
  stopRecord();
  releaseNotes();
  audio?.stopAll();
  visualQueue.length = 0;
  currentVisual = undefined;
  if (head.value) head.value.style.transform = 'translateX(0)';
  if (readout.value) readout.value.textContent = '01 / 16';
  visualUntil = performance.now() + 300;
  if (visible && !document.hidden && !disposed) beginFrames();
}
function loadPreset(): void {
  stop();
  const item = presets[preset.value];
  if (!item) return;
  bpm.value = item.bpm;
  swing.value = item.swing;
  synth.value = { ...item.synth };
  steps.value = item.pattern.map(row => [...row]);
  muted.value = Array<boolean>(8).fill(false);
  solo.value = Array<boolean>(8).fill(false);
  announce(item.name + '. A fresh sixteen steps.');
}
async function saveLoop(): Promise<void> {
  if (!canRecord.value || recording.value || busy.value) return;
  stop();
  const request = ++operation;
  busy.value = true;
  const engine = await ready();
  if (disposed || request !== operation) return;
  busy.value = false;
  if (!engine) return;
  try {
    const sessionChunks: Blob[] = [];
    const sessionBpm = bpm.value;
    recorder = new MediaRecorder(engine.destination.stream, { mimeType: recordMime });
    const session = recorder;
    session.ondataavailable = event => { if (!disposed && event.data.size) sessionChunks.push(event.data); };
    session.onerror = () => {
      stop(); session.onstop = null;
      announce('Recording could not finish. Your pattern is still here.');
    };
    session.onstop = () => {
      if (disposed || !sessionChunks.length) return;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(new Blob(sessionChunks, { type: recordMime }));
      sessionChunks.length = 0;
      const link = document.createElement('a');
      link.href = downloadUrl; link.download = 'beat-studio-' + sessionBpm + 'bpm.webm';
      link.click();
      announce('Two bars saved. Your future ringtone has potential.');
      vision.toast('Beat Studio loop saved');
    };
    session.start();
    recording.value = true;
    beginSequence(engine);
    announce('Recording two bars from step one. Keep playing, or let the loop cook.');
  } catch { recording.value = false; announce('Loop recording is unavailable in this browser.'); }
}
function animate(now: number): void {
  frame = 0;
  if (disposed || !visible || document.hidden || !audio) return;
  const clock = audio.context.currentTime;
  while (visualQueue[0] && visualQueue[0].time <= clock) {
    const item = visualQueue.shift()!;
    currentVisual = item;
    for (const index of item.hits) flash(index);
    if (readout.value) readout.value.textContent = String(item.step + 1).padStart(2, '0') + ' / 16';
  }
  if (playing.value && currentVisual && head.value) {
    const phase = reduced ? 0 : Math.min(1, Math.max(0, (clock - currentVisual.time) / currentVisual.duration));
    head.value.style.transform = 'translateX(' + ((currentVisual.step + phase) * 100) + '%)';
  }
  if (canvasContext && now - lastVisual >= (reduced ? 160 : 33)) {
    lastVisual = now;
    audio.analyser.getByteFrequencyData(frequencies);
    canvasContext.clearRect(0, 0, width, height);
    canvasContext.fillStyle = hue;
    for (let i = 0; i < 32; i++) {
      const target = (frequencies[i * 3] ?? 0) / 255;
      levels[i] = (levels[i] ?? 0) * .78 + target * .22;
      const barHeight = Math.max(3, (levels[i] ?? 0) * height * .85);
      canvasContext.globalAlpha = .12 + (levels[i] ?? 0) * .24;
      canvasContext.fillRect(i * width / 32, height - barHeight, width / 32 - 3, barHeight);
    }
    canvasContext.globalAlpha = 1;
  }
  if (playing.value || held.size || now < visualUntil) frame = requestAnimationFrame(animate);
}
function beginFrames(): void { if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(animate); }
function sizeCanvas(): void {
  const canvas = spectrum.value;
  if (!canvas) return;
  width = Math.max(1, canvas.clientWidth);
  height = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  canvasContext = canvas.getContext('2d');
  canvasContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function visibility(): void {
  if (document.hidden || !visible) {
    if (recording.value && recorder) { recorder.onstop = null; recorder.ondataavailable = null; }
    stop();
    cancelAnimationFrame(frame); frame = 0;
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
    audio?.suspend();
  }
}
function motionChanged(): void { reduced = motion?.matches ?? false; }
watch(synth, value => audio?.configure(value), { deep: true });
onMounted(() => {
  if (!app.value) return;
  padElements.push(...app.value.querySelectorAll<HTMLButtonElement>('[data-pad]'));
  motion = matchMedia('(prefers-reduced-motion: reduce)'); motionChanged();
  motion.addEventListener('change', motionChanged);
  resize = new ResizeObserver(sizeCanvas); if (spectrum.value) resize.observe(spectrum.value);
  intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; visibility(); }, { threshold: .01 });
  intersection.observe(app.value);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', releaseNotes);
  sizeCanvas();
  if (typeof MediaRecorder !== 'undefined') {
    recordMime = ['audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
    canRecord.value = !!recordMime && typeof AudioContext !== 'undefined' && 'createMediaStreamDestination' in AudioContext.prototype;
  }
});
onBeforeUnmount(() => {
  disposed = true; stop();
  cancelAnimationFrame(frame);
  resize?.disconnect(); intersection?.disconnect();
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', releaseNotes);
  motion?.removeEventListener('change', motionChanged);
  for (const animation of animations.values()) animation.cancel();
  animations.clear();
  if (recorder) { recorder.onstop = null; recorder.ondataavailable = null; recorder.onerror = null; }
  audio?.close();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});
</script>

<template>
  <div ref="app" class="beat-app vk-scroll" :class="{ compact }" tabindex="0" aria-label="Beat Studio instrument" @keydown="keys">
    <header class="intro">
      <div><p class="eyebrow vk-tertiary">MAKE A LITTLE NOISE</p><h1 class="vk-large-title">Beat Studio</h1><p class="vk-footnote vk-secondary">Sixteen pads. Infinite reasons to miss a meeting.</p></div>
      <span class="vk-chip">Live synthesis</span>
    </header>
    <div class="transport vk-platter">
      <button v-hover class="vk-button primary play" :disabled="recording" @click="togglePlay">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="playing ? 'M7 6h10v12H7Z' : 'm8 5 11 7-11 7Z'" /></svg>{{ busy ? 'Starting…' : playing ? 'Stop' : 'Play loop' }}
      </button>
      <button v-if="recording" v-hover class="vk-button destructive" @click="cancelRecording">Cancel recording</button>
      <label class="tempo"><span class="vk-footnote">BPM <b>{{ bpm }}</b></span><input v-model.number="bpm" class="vk-slider" type="range" min="70" max="160" :disabled="recording" :style="{ '--value': (bpm - 70) / 90 }" aria-label="Tempo" /></label>
      <label class="swing"><span class="vk-footnote">Swing <b>{{ swing }}%</b></span><input v-model.number="swing" class="vk-slider" type="range" min="0" max="45" :disabled="recording" :style="{ '--value': swing / 45 }" aria-label="Swing" /></label>
      <label class="preset"><span class="sr-only">Pattern preset</span><select v-model.number="preset" class="vk-field" :disabled="recording" @change="loadPreset"><option v-for="(item, index) in presets" :key="item.name" :value="index">{{ item.name }}</option></select></label>
      <button v-if="canRecord && !recording" v-hover class="vk-button" :disabled="busy" @click="saveLoop"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4" /></svg>Save loop</button>
    </div>
    <div class="workspace">
      <section class="pad-deck vk-well" aria-label="Drum pads">
        <canvas ref="spectrum" class="spectrum" aria-hidden="true" />
        <div class="section-label"><h2 class="vk-headline">Air drums</h2><span class="vk-footnote vk-secondary">Centre hits harder</span></div>
        <div class="pads">
          <button v-for="(pad, index) in pads" :key="pad.name" v-hover class="pad vk-platter" :data-pad="index" :style="{ '--pad': pad.color }" :aria-label="pad.name + ', key ' + pad.key" @pointerdown.prevent="hit(index, $event)" @click="($event.detail === 0) && hit(index)">
            <span class="ripple" aria-hidden="true" /><span class="pad-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <svg viewBox="0 0 36 24" aria-hidden="true"><path :d="index % 4 === 0 ? 'M2 12h6l3-9 5 18 5-18 4 9h9' : index % 4 === 1 ? 'M3 16V8m5 12V4m5 13V7m5 15V2m5 14V8m5 10V6m5 9V9' : index % 4 === 2 ? 'M2 17q5-20 10 0t10 0t10 0' : 'M2 12h5m4 0h5m4 0h5m4 0h5'" /></svg>
            <span class="pad-caption">{{ pad.name }}<kbd>{{ pad.key }}</kbd></span>
          </button>
        </div>
      </section>
      <section class="sequencer vk-platter" aria-label="Sixteen-step sequencer">
        <div class="section-label"><h2 class="vk-headline">Step into it</h2><span ref="readout" class="vk-footnote vk-secondary">01 / 16</span></div>
        <p class="vk-footnote vk-tertiary sequence-hint">Tap to compose · M mute · S solo · swipe for all 16</p>
        <div class="sequence-scroll vk-scroll">
          <div class="sequence-inner">
            <div class="step-labels"><span>TRACK</span><span v-for="n in 16" :key="n">{{ String(n).padStart(2, '0') }}</span></div>
            <div class="step-rows">
              <div v-for="(pad, track) in trackPads" :key="pad" class="track" :style="{ '--track': pads[pad].color }">
                <div class="track-controls"><span>{{ pads[pad].name }}</span><button v-hover :aria-label="'Mute ' + pads[pad].name" :aria-pressed="muted[track]" @click="muted[track] = !muted[track]">M</button><button v-hover :aria-label="'Solo ' + pads[pad].name" :aria-pressed="solo[track]" @click="solo[track] = !solo[track]">S</button></div>
                <button v-for="n in 16" :key="n" class="step" :class="{ on: steps[track]?.[n - 1], quarter: (n - 1) % 4 === 0 }" :aria-label="pads[pad].name + ', step ' + n" :aria-pressed="steps[track]?.[n - 1] ?? false" @click="steps[track]![n - 1] = !steps[track]![n - 1]"><span /></button>
              </div>
              <div class="head-lane" aria-hidden="true"><div ref="head" class="playhead" :class="{ moving: playing }" /></div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <section class="synth vk-platter" aria-label="Warm saw synthesizer">
      <div class="section-label"><div><h2 class="vk-headline">A soft place to land</h2><p class="vk-footnote vk-tertiary">Hold a key · Y U I O P [ ] \ · black keys 5–9</p></div><label class="scale"><span class="vk-footnote">C minor pentatonic</span><input v-model="synth.scale" class="vk-toggle" type="checkbox" aria-label="Scale lock to C minor pentatonic" /></label></div>
      <div class="synth-content">
        <div class="keyboard vk-scroll"><div class="keys-inner">
          <button v-for="(key, index) in piano" :key="index" class="piano-key" :class="{ black: key.black }" :style="{ '--key': keyPositions[index] }" :aria-label="key.note + ', key ' + key.key + ', hold to play'" @pointerdown.prevent="pointerNote($event, index)" @pointerup="noteUp('pointer-' + $event.pointerId)" @pointercancel="noteUp('pointer-' + $event.pointerId)" @lostpointercapture="noteUp('pointer-' + $event.pointerId)" @keydown.enter.prevent="noteDown('enter-' + index, index)" @keyup.enter="noteUp('enter-' + index)" @keydown.space.prevent="noteDown('space-' + index, index)" @keyup.space="noteUp('space-' + index)" @blur="noteUp('enter-' + index); noteUp('space-' + index)"><span>{{ key.note }}</span><kbd>{{ key.key }}</kbd></button>
        </div></div>
        <div class="synth-controls">
          <label><span class="vk-footnote">Cutoff <b>{{ synth.cutoff }} Hz</b></span><input v-model.number="synth.cutoff" class="vk-slider" type="range" min="200" max="6000" step="50" :style="{ '--value': (synth.cutoff - 200) / 5800 }" aria-label="Filter cutoff" /></label>
          <label><span class="vk-footnote">Resonance <b>{{ synth.resonance.toFixed(1) }}</b></span><input v-model.number="synth.resonance" class="vk-slider" type="range" min="0.5" max="8" step="0.1" :style="{ '--value': (synth.resonance - .5) / 7.5 }" aria-label="Filter resonance" /></label>
          <label><span class="vk-footnote">Delay <b>{{ Math.round(synth.delay * 100) }}%</b></span><input v-model.number="synth.delay" class="vk-slider" type="range" min="0" max="0.6" step="0.01" :style="{ '--value': synth.delay / .6 }" aria-label="Delay mix" /></label>
        </div>
      </div>
    </section>
    <p class="status vk-footnote vk-secondary" role="status">{{ recording ? 'Recording two bars… ' : '' }}{{ status }}</p>
  </div>
</template>

<style scoped src="./beat/beat.css"></style>
