<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { BeatAudio } from './beat/audio';
import BeatKnob from './beat/BeatKnob.vue';
import BeatIcon from './beat/BeatIcon.vue';
import BeatDigits from './beat/BeatDigits.vue';
import { defaultChannels, kits, lockedNote, makeScenes, pads, piano, presets, trackPads, type Pattern, type SynthSettings } from './beat/model';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION);
const app = ref<HTMLElement>();
const scope = ref<HTMLCanvasElement>();
const meterBank = ref<HTMLElement>();
const stepText = ref<HTMLElement>();
const page = ref('Pads');
const pages = ['Pads', 'Sequencer', 'Mixer', 'Synth'];
const narrow = ref(false);
const single = computed(() => props.compact || narrow.value);
const preset = ref(0), kit = ref(0), bpm = ref(78), swing = ref(28);
const synth = ref<SynthSettings>({ cutoff: 2600, resonance: 1.4, space: .28, tone: .35, attack: .04, scale: true });
const channels = ref(defaultChannels());
const scenes = ref(makeScenes(presets[0]!.pattern));
const scene = ref(0), queuedScene = ref<number | null>(null), chain = ref(false);
const steps = computed(() => scenes.value[scene.value]!);
const playing = ref(false), busy = ref(false), armed = ref(false), metronome = ref(false), exporting = ref(false), canRecord = ref(false);
const selectedPad = ref(0), arp = ref(false), arpMode = ref('Up');
const sheet = ref<'kits' | 'patterns' | 'help' | 'track' | null>(null);
const query = ref(''), selectedTrack = ref(0), undoPattern = ref<Pattern | null>(null);
const status = ref('Ready when you are. Press play, or make the first move.');
const filteredPresets = computed(() => presets.map((item, index) => ({ ...item, index })).filter(item => (item.name + kits[item.kit]!.name).toLowerCase().includes(query.value.toLowerCase())));
const kitName = computed(() => kits[kit.value]!.name);
const selectedName = computed(() => padName(selectedPad.value));
const trackName = computed(() => padName(trackPads[selectedTrack.value]!));
let audio: BeatAudio | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let frame = 0, lastFrame = 0, visualUntil = 0, nextTime = 0, nextStep = 0, scheduledCount = 0, recordEnd = Infinity;
let operation = 0, disposed = false, visible = true, reduced = false;
let resize: ResizeObserver | undefined, intersection: IntersectionObserver | undefined, motion: MediaQueryList | undefined;
let recorder: MediaRecorder | undefined, recordMime = '', downloadUrl = '';
let returnFocus: HTMLElement | null = null;
const visualQueue: { step: number; scene: number; time: number; hits: number[] }[] = [];
const wave = new Uint8Array(256), meterSamples = new Uint8Array(256);
const held = new Map<string, { note: number; release?: () => void }>();
const animations = new Map<HTMLElement, Animation>();
let taps: number[] = [];
function padName(index: number): string { return kit.value === 4 && index === 5 ? 'Dayan' : kit.value === 4 && index === 6 ? 'Bayan' : pads[index]!.name; }
function announce(message: string): void { if (!disposed) status.value = message; }
async function ready(): Promise<BeatAudio | undefined> {
  if (disposed || !visible || document.hidden) return;
  try {
    audio ??= new BeatAudio(); audio.configure(synth.value); audio.setKit(kit.value); audio.setChannels(channels.value);
    if (await audio.resume() && !disposed && visible && !document.hidden) return audio;
  } catch { announce('Audio could not start. Your pattern can still be edited.'); }
}
function flash(index: number): void {
  const button = app.value?.querySelector<HTMLElement>('[data-pad="' + index + '"]');
  if (!button) return;
  animations.get(button)?.cancel();
  const color = pads[index]!.color;
  const animation = button.animate([
    { boxShadow: 'inset 0 3px 12px #0009, inset 0 0 0 2px ' + color + ', 0 0 20px ' + color + '55', backgroundColor: color + '55', transform: reduced ? 'none' : 'translateY(2px)' },
    { boxShadow: 'inset 0 1px 0 #ffffff25, inset 0 0 0 1px ' + color + '44, 0 3px 0 #111317', backgroundColor: color + '16', transform: 'translateY(0)' },
  ], { duration: reduced ? 100 : 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
  animations.set(button, animation);
  animation.onfinish = () => animations.delete(button);
  const ripple = button.querySelector<HTMLElement>('.ripple');
  if (ripple && !reduced) {
    animations.get(ripple)?.cancel();
    const effect = ripple.animate([{ opacity: .4, transform: 'scale(.1)' }, { opacity: 0, transform: 'scale(2)' }], { duration: 420 });
    animations.set(ripple, effect); effect.onfinish = () => animations.delete(ripple);
  }
}
async function hit(index: number, event?: PointerEvent): Promise<void> {
  selectedPad.value = index; flash(index);
  let velocity = .85;
  if (event?.currentTarget instanceof HTMLElement) {
    const rect = event.currentTarget.getBoundingClientRect();
    velocity = event.pressure > 0 && event.pointerType === 'pen' ? event.pressure : Math.max(.3, 1 - Math.abs((event.clientY - rect.top) / rect.height - .5));
  }
  const engine = await ready();
  if (!engine) return;
  engine.hit(index, engine.context.currentTime, velocity);
  if (armed.value && playing.value && !exporting.value) {
    const track = trackPads.indexOf(index as typeof trackPads[number]);
    if (track >= 0) {
      const current = (nextStep + 15) % 16;
      steps.value[track]![current] = velocity;
      announce('Overdubbed ' + padName(index) + ' · step ' + (current + 1));
    } else announce('This performance pad is live only. The eight arrangement tracks can be overdubbed.');
  }
  visualUntil = performance.now() + 1800; beginFrames();
}
function editStep(track: number, step: number, event: MouseEvent): void {
  undoPattern.value = steps.value.map(row => [...row]);
  const row = steps.value[track]!;
  row[step] = event.shiftKey ? (row[step] === 1 ? .4 : 1) : row[step] ? 0 : .75;
}
function backup(): void { undoPattern.value = steps.value.map(row => [...row]); }
function clearPattern(): void { backup(); scenes.value[scene.value] = Array.from({ length: 8 }, () => Array<number>(16).fill(0)); announce('Scene cleared. Undo is available.'); }
function undo(): void { if (undoPattern.value) { const previous = steps.value.map(row => [...row]); scenes.value[scene.value] = undoPattern.value; undoPattern.value = previous; announce('Pattern edit undone.'); } }
function copyScene(): void { const next = (scene.value + 1) % 4; scenes.value[next] = steps.value.map(row => [...row]); announce('Scene ' + 'ABCD'[scene.value] + ' copied to ' + 'ABCD'[next] + '.'); }
function chooseScene(index: number): void {
  if (playing.value) { queuedScene.value = index; announce('Scene ' + 'ABCD'[index] + ' will start at the next bar.'); }
  else { scene.value = index; queuedScene.value = null; }
}
function schedule(): void {
  const engine = audio;
  if (!engine || !playing.value) return;
  const now = engine.context.currentTime;
  if (exporting.value && now >= recordEnd + .65) { stop(false); announce('Two bars exported with a reverb tail.'); return; }
  if (nextTime < now - .04) { nextTime = now + .03; visualQueue.length = 0; }
  let count = 0;
  while (nextTime < now + .1 && count++ < 8) {
    if (exporting.value && scheduledCount >= 32) break;
    if (nextStep === 0 && scheduledCount > 0) {
      const next = queuedScene.value ?? (chain.value ? (scene.value + 1) % 4 : scene.value);
      scene.value = next; queuedScene.value = null;
    }
    const tempo = Number.isFinite(bpm.value) ? Math.max(55, Math.min(180, bpm.value)) : 78;
    const step = nextStep, base = 60 / tempo / 4;
    const duration = base * (step % 2 === 0 ? 1 + swing.value / 100 : 1 - swing.value / 100);
    const hits: number[] = [];
    const hasSolo = channels.value.some(channel => channel.solo);
    trackPads.forEach((pad, track) => {
      const velocity = steps.value[track]![step] ?? 0, channel = channels.value[track]!;
      if (velocity && !channel.muted && (!hasSolo || channel.solo)) { engine.hit(pad, nextTime, velocity); hits.push(pad); }
    });
    if (metronome.value && !exporting.value && step % 4 === 0) engine.click(nextTime, step === 0);
    if (arp.value && held.size) {
      const notes = [...held.values()].map(item => item.note).sort((a,b) => a-b);
      const position = scheduledCount % notes.length;
      const note = notes[arpMode.value === 'Down' ? notes.length - 1 - position : arpMode.value === 'Random' ? Math.floor(Math.random() * notes.length) : position]!;
      engine.note(lockedNote(note, synth.value.scale), nextTime, duration * .7);
    }
    visualQueue.push({ step, scene: scene.value, time: nextTime, hits });
    nextTime += duration; nextStep = (step + 1) % 16; scheduledCount++;
    if (exporting.value && scheduledCount === 32) recordEnd = nextTime;
  }
}
function beginSequence(engine: BeatAudio): void {
  if (timer) clearInterval(timer);
  nextStep = 0; scheduledCount = 0; nextTime = engine.context.currentTime + .05; recordEnd = Infinity;
  visualQueue.length = 0; playing.value = true; schedule(); timer = setInterval(schedule, 25); beginFrames();
}
async function togglePlay(): Promise<void> {
  if (playing.value || busy.value) { stop(); return; }
  const token = ++operation; busy.value = true;
  const engine = await ready();
  if (disposed || token !== operation) return;
  busy.value = false;
  if (engine) { beginSequence(engine); announce(armed.value ? 'Recording pads into the loop. Quantised to sixteenth notes.' : 'Looping · change a step, make it yours.'); }
}
function stop(silence = true): void {
  operation++; busy.value = false; playing.value = false; queuedScene.value = null;
  if (timer) clearInterval(timer); timer = undefined;
  releaseNotes(); if (silence) audio?.stopAll();
  visualQueue.length = 0;
  if (recorder?.state === 'recording') recorder.stop();
  exporting.value = false; recordEnd = Infinity;
  if (stepText.value) stepText.value.textContent = '01 / 16';
  app.value?.querySelectorAll('[data-current]').forEach(el => el.removeAttribute('data-current'));
  visualUntil = performance.now() + 700; beginFrames();
}
function tapTempo(): void {
  const now = performance.now(); taps = [...taps.filter(time => now - time < 2500), now].slice(-5);
  if (taps.length > 1) bpm.value = Math.min(180, Math.max(55, Math.round(60000 * (taps.length - 1) / (now - taps[0]!))));
  announce(taps.length > 1 ? 'Tempo tapped to ' + bpm.value + ' BPM.' : 'Tap a few more times to set the tempo.');
}
function loadPreset(index: number): void {
  stop(); const item = presets[index]!;
  preset.value = index; kit.value = item.kit; bpm.value = item.bpm; swing.value = item.swing;
  scenes.value = makeScenes(item.pattern); scene.value = 0; channels.value = defaultChannels(); undoPattern.value = null;
  announce(item.name + ' · ' + item.mood); closeSheet();
}
async function saveLoop(): Promise<void> {
  if (!canRecord.value || busy.value) return;
  if (exporting.value) { if (recorder) recorder.onstop = null; stop(); announce('Export cancelled. Your scenes are safe.'); return; }
  stop(); const token = ++operation; busy.value = true; const engine = await ready();
  if (token !== operation || disposed) return; busy.value = false; if (!engine) return;
  try {
    const chunks: Blob[] = []; const tempo = bpm.value;
    recorder = new MediaRecorder(engine.destination.stream, { mimeType: recordMime });
    recorder.ondataavailable = event => { if (!disposed && event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      if (disposed || !chunks.length) return;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(new Blob(chunks, { type: recordMime }));
      const link = document.createElement('a'); link.href = downloadUrl; link.download = 'beat-studio-' + tempo + 'bpm.' + (recordMime.includes('mp4') ? 'm4a' : 'webm'); link.click();
      announce('Loop saved · two bars, plus the room around them.'); vision?.toast('Beat Studio loop saved');
    };
    recorder.onerror = () => { if (recorder) recorder.onstop = null; stop(); announce('Export could not finish. Try again.'); };
    recorder.start(); exporting.value = true; beginSequence(engine); announce('Exporting two bars from step one…');
  } catch { stop(); announce('This browser could not record the audio stream.'); }
}
async function noteDown(id: string, note: number): Promise<void> {
  if (held.has(id)) return;
  const entry: { note: number; release?: () => void } = { note };
  held.set(id, entry); const engine = await ready();
  if (!engine || held.get(id) !== entry) { if (held.get(id) === entry) held.delete(id); return; }
  if (arp.value) { if (!playing.value) beginSequence(engine); }
  else entry.release = engine.note(lockedNote(note, synth.value.scale));
  visualUntil = performance.now() + 21000; beginFrames();
}
function noteUp(id: string): void { held.get(id)?.release?.(); held.delete(id); if (!held.size) visualUntil = performance.now() + 1200; }
function releaseNotes(): void { for (const key of held.keys()) noteUp(key); }
function pointerNote(event: PointerEvent, note: number): void { (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); void noteDown('p' + event.pointerId, note); }
function keys(event: KeyboardEvent): void {
  if (sheet.value) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSheet(); }
    if (event.key === 'Tab') trapFocus(event);
    return;
  }
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const target = event.target;
  if (target instanceof HTMLElement && (target.matches('input,select,textarea,[role=slider]') || target.isContentEditable)) return;
  const key = event.key.toLowerCase();
  if (event.code === 'Space') { event.preventDefault(); event.stopPropagation(); if (!exporting.value) void togglePlay(); return; }
  if (exporting.value) return;
  const pad = pads.findIndex(item => item.key.toLowerCase() === key);
  if (pad >= 0) { event.preventDefault(); void hit(pad); return; }
  if (page.value === 'Synth') { const note = piano.findIndex(item => item.key.toLowerCase() === key); if (note >= 0) { event.preventDefault(); void noteDown('k' + event.code, note); } }
  if (key === '?') openSheet('help');
}
function keyUp(event: KeyboardEvent): void { noteUp('k' + event.code); }
function openSheet(which: typeof sheet.value): void { returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null; query.value = ''; sheet.value = which; void nextTick(() => app.value?.querySelector<HTMLElement>('[role=dialog] input, [role=dialog] button')?.focus()); }
function closeSheet(): void { sheet.value = null; void nextTick(() => (returnFocus ?? app.value)?.focus({ preventScroll: true })); }
function trapFocus(event: KeyboardEvent): void {
  const elements = app.value?.querySelectorAll<HTMLElement>('[role=dialog] button:not(:disabled),[role=dialog] input,[role=dialog] select');
  if (!elements?.length) return;
  const first = elements[0]!, last = elements[elements.length-1]!;
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function focusInstrument(event: PointerEvent): void { if (event.target instanceof HTMLElement && !event.target.closest('button,input,select,[role=slider]')) app.value?.focus({ preventScroll: true }); }
function sizeCanvas(): void {
  const canvas = scope.value; if (!canvas) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr)); canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr)); drawScope();
}
function drawScope(): void {
  const canvas = scope.value, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
  const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = '#eabe791c'; ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i*w/6,0); ctx.lineTo(i*w/6,h); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0,h/2); ctx.lineTo(w,h/2); ctx.stroke();
  if (audio) audio.analyser.getByteTimeDomainData(wave); else wave.fill(128);
  ctx.beginPath(); ctx.strokeStyle = '#e9bd80'; ctx.lineWidth = Math.max(1.2, w/180);
  for (let i = 0; i < wave.length; i++) { const x = i*w/(wave.length-1), y = h/2 + ((wave[i] ?? 128)-128)/128*h*.45; if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.stroke();
}
function render(now: number): void {
  frame = 0; if (disposed || !visible || document.hidden || !audio) return;
  while (visualQueue[0] && visualQueue[0].time <= audio.context.currentTime) {
    const visual = visualQueue.shift()!;
    if (stepText.value) stepText.value.textContent = String(visual.step+1).padStart(2,'0') + ' / 16';
    app.value?.querySelectorAll<HTMLElement>('[data-step]').forEach(el => { if (Number(el.dataset.step) === visual.step) el.dataset.current = ''; else el.removeAttribute('data-current'); });
    for (const hit of visual.hits) flash(hit);
  }
  if (now-lastFrame >= (reduced ? 150 : 40)) {
    lastFrame = now; drawScope();
    meterBank.value?.querySelectorAll<HTMLElement>('[data-meter]').forEach(element => {
      const analyser = element.dataset.meter === 'master' ? audio!.analyser : audio!.channels[Number(element.dataset.meter)]?.analyser;
      if (!analyser) return; analyser.getByteTimeDomainData(meterSamples);
      let sum = 0; for (const value of meterSamples) sum += Math.pow((value-128)/128,2);
      const level = Math.min(1, Math.sqrt(sum/meterSamples.length)*4);
      element.style.setProperty('--level', String(level));
    });
    const reduction = meterBank.value?.querySelector<HTMLElement>('[data-reduction]');
    reduction?.style.setProperty('--reduction', String(Math.min(1,audio.reduction/12)));
    const label = meterBank.value?.querySelector<HTMLElement>('[data-reduction-label]');
    if (label) label.textContent = audio.reduction.toFixed(1) + ' dB';
  }
  if (playing.value || held.size || now < visualUntil) frame = requestAnimationFrame(render);
}
function beginFrames(): void { if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render); }
function visibility(): void {
  if (document.hidden || !visible) {
    if (recorder) recorder.onstop = null; stop(); cancelAnimationFrame(frame); frame = 0; audio?.suspend();
    for (const animation of animations.values()) animation.cancel(); animations.clear();
  }
}
function motionChange(): void { reduced = motion?.matches ?? false; }
watch(synth, value => audio?.configure(value), { deep: true });
watch(channels, value => audio?.setChannels(value), { deep: true });
watch(kit, value => audio?.setKit(value));
watch([arp, () => synth.value.scale], releaseNotes);
watch(page, () => { releaseNotes(); void nextTick(() => { sizeCanvas(); if (audio) { visualUntil = performance.now()+800; beginFrames(); } }); });
onMounted(() => {
  motion = matchMedia('(prefers-reduced-motion: reduce)'); motionChange(); motion.addEventListener('change', motionChange);
  resize = new ResizeObserver(entries => { const entry = entries[0]; if (entry) narrow.value = entry.contentRect.width < 760; sizeCanvas(); });
  if (app.value) { resize.observe(app.value); app.value.focus({ preventScroll: true }); }
  intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; visibility(); }, { threshold: .01 });
  if (app.value) intersection.observe(app.value);
  document.addEventListener('visibilitychange', visibility); window.addEventListener('keyup', keyUp); window.addEventListener('blur', releaseNotes);
  if (typeof MediaRecorder !== 'undefined') {
    recordMime = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type => MediaRecorder.isTypeSupported(type)) ?? '';
    canRecord.value = !!recordMime && typeof AudioContext !== 'undefined' && 'createMediaStreamDestination' in AudioContext.prototype;
  }
  void nextTick(sizeCanvas);
});
onBeforeUnmount(() => {
  disposed = true; if (recorder) { recorder.onstop = null; recorder.ondataavailable = null; recorder.onerror = null; } stop();
  cancelAnimationFrame(frame); resize?.disconnect(); intersection?.disconnect(); motion?.removeEventListener('change',motionChange);
  document.removeEventListener('visibilitychange',visibility); window.removeEventListener('keyup',keyUp); window.removeEventListener('blur',releaseNotes);
  for (const animation of animations.values()) animation.cancel(); animations.clear(); audio?.close();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});
</script>

<template>
  <div ref="app" class="beat-app" :class="{ compact: single, exporting }" :data-page="page" tabindex="0" aria-label="Beat Studio groovebox" @keydown="keys" @pointerdown="focusInstrument">
    <header class="studio-header" :inert="!!sheet">
      <div class="identity"><span class="studio-mark"><BeatIcon name="wave" :size="23" /></span><div><h1>Beat Studio<span class="edition"> / 01</span></h1><p>THE SPATIAL GROOVEBOX</p></div></div>
      <button v-hover class="pattern-picker" :aria-label="'Session library, current session ' + presets[preset]!.name" :disabled="exporting" @click="openSheet('patterns')"><span class="pattern-mini"><i v-for="n in 9" :key="n" :class="{ filled: n % 3 !== 0 }" /></span><span><small>SESSION</small><strong>{{ presets[preset]!.name }}</strong></span><BeatIcon name="chevron" :size="16" /></button>
      <div class="header-actions"><button v-if="canRecord" v-hover class="save-button" :disabled="busy" @click="saveLoop"><BeatIcon :name="exporting ? 'stop' : 'export'" :size="18" /><span>{{ exporting ? 'Cancel export' : 'Save loop' }}</span></button><button v-hover class="help-button" aria-label="Controls and keyboard shortcuts" @click="openSheet('help')"><BeatIcon name="help" /></button></div>
    </header>

    <main class="studio-main vk-scroll" :class="{ overview: page === 'Pads' && !single }" :inert="exporting || !!sheet">
      <section v-if="page === 'Pads'" class="device vk-platter" aria-label="Performance deck">
        <div class="lcd vk-well">
          <div class="lcd-top"><span><i :class="{ running: playing }" />{{ armed ? 'OVERDUB' : playing ? 'PLAYING' : 'STANDBY' }}</span><span>SCENE {{ 'ABCD'[scene] }} · 4/4</span><span>BS—01</span></div>
          <div class="lcd-body"><div class="tempo-screen"><BeatDigits :value="bpm" /><small>BPM</small></div><div class="scope-screen"><canvas ref="scope" aria-label="Live audio oscilloscope" /><div><span>{{ kitName }}</span><b ref="stepText">01 / 16</b></div></div></div>
        </div>
        <div class="pad-caption"><span>PERFORMANCE PADS</span><span>{{ String(selectedPad + 1).padStart(2,'0') }} / {{ selectedName }}</span></div>
        <div class="pads">
          <button v-for="(pad,index) in pads" :key="pad.key" v-hover class="pad" :class="{ selected: selectedPad === index }" :data-pad="index" :style="{ '--pad': pad.color }" :aria-label="padName(index) + ', keyboard ' + pad.key" @pointerdown.prevent="hit(index,$event)" @click="($event.detail === 0) && hit(index)"><span class="ripple" /><span class="pad-top"><i /> <kbd>{{ pad.key }}</kbd></span><span class="pad-name">{{ padName(index) }}</span><span class="pad-index">{{ String(index + 1).padStart(2,'0') }}</span></button>
        </div>
        <div class="knob-row"><BeatKnob v-model="bpm" label="Tempo" :min="55" :max="180" :display="bpm + ' BPM'" /><BeatKnob v-model="swing" label="Swing" :min="0" :max="45" :display="swing + '%'" color="#b5cba1" /><BeatKnob v-model="synth.cutoff" label="Filter" :min="200" :max="6000" :step="50" :display="(synth.cutoff / 1000).toFixed(1) + ' kHz'" color="#92becf" /><BeatKnob v-model="synth.space" label="Space" :min="0" :max=".65" :step=".01" :display="Math.round(synth.space * 100) + '%'" color="#bba7d2" /></div>
        <div class="transport"><button v-hover class="play-button" :class="{ active: playing }" :disabled="busy" :aria-label="playing ? 'Stop playback' : 'Play loop'" @click="togglePlay"><BeatIcon :name="playing ? 'stop' : 'play'" :size="18" />{{ busy ? 'Starting' : playing ? 'Stop' : 'Play' }}</button><button v-hover class="transport-icon" :class="{ armed }" :aria-pressed="armed" aria-label="Record pads into the eight arrangement tracks" @click="armed = !armed; announce(armed ? 'Overdub armed. Press play, then tap a track pad.' : 'Overdub off.')"><BeatIcon name="record" :size="18" /></button><button v-hover class="transport-icon" :aria-pressed="metronome" aria-label="Metronome" @click="metronome = !metronome"><BeatIcon name="metro" :size="18" /></button><button v-hover class="tap-button" @click="tapTempo">TAP</button></div>
        <div class="device-foot"><span>16 VOICES / FULLY SYNTHESISED</span><span class="speaker-grille" aria-hidden="true" /></div>
      </section>

      <section v-if="page === 'Sequencer' || (page === 'Pads' && !single)" class="arrangement vk-platter" aria-label="Arrangement sequencer">
        <div class="panel-heading"><div><h2>Arrangement</h2><span class="panel-meta">8 tracks · 16 steps · 1 bar</span></div><button v-hover class="kit-picker" @click="openSheet('kits')"><i :style="{ background: kits[kit]!.color }" />{{ kitName }}<BeatIcon name="chevron" :size="14" /></button></div>
        <div class="scene-toolbar"><div class="scene-buttons" aria-label="Scenes"><button v-for="(letter,index) in ['A','B','C','D']" :key="letter" v-hover :class="{ selected: scene === index, queued: queuedScene === index }" :aria-pressed="scene === index" :aria-label="'Scene ' + letter + (queuedScene === index ? ', queued' : '')" @click="chooseScene(index)">{{ letter }}<span>{{ index === 0 ? 'MAIN' : index === 1 ? 'LIFT' : index === 2 ? 'FILL' : 'BREAK' }}</span><i v-if="queuedScene === index" /></button></div><button v-hover class="chain-button" :aria-pressed="chain" aria-label="Chain scenes A through D, one bar each" @click="chain = !chain"><BeatIcon name="chain" :size="16" /><span>Chain</span></button></div>
        <div class="sequence-scroll vk-scroll"><div class="sequence-grid">
          <div class="step-ruler"><span>SOUND / MIX</span><span v-for="n in 16" :key="n" :class="{ beat: (n-1)%4===0 }">{{ String(n).padStart(2,'0') }}</span></div>
          <div v-for="(pad,track) in trackPads" :key="pad" class="track-row" @contextmenu.prevent="selectedTrack = track; openSheet('track')" :class="{ muted: channels[track]!.muted }" :style="{ '--track': pads[pad].color }">
            <div class="track-controls"><button v-hover class="track-title" :aria-label="'Edit ' + padName(pad)" @click="selectedTrack = track; openSheet('track')"><i /><span>{{ padName(pad) }}</span></button><button v-hover class="ms" :aria-pressed="channels[track]!.muted" :aria-label="'Mute ' + padName(pad)" @click="channels[track]!.muted = !channels[track]!.muted">M</button><button v-hover class="ms solo" :aria-pressed="channels[track]!.solo" :aria-label="'Solo ' + padName(pad)" @click="channels[track]!.solo = !channels[track]!.solo">S</button><input v-model.number="channels[track]!.volume" class="mini-fader" type="range" min="0" max="1" step=".01" :aria-label="padName(pad) + ' volume'" /></div>
            <button v-for="n in 16" :key="n" class="step-cell" :class="{ on: steps[track]![n-1], quarter: (n-1)%4===0, accent: steps[track]![n-1]! >= .9 }" :data-step="n-1" :style="{ '--velocity': steps[track]![n-1] }" :aria-label="padName(pad) + ', step ' + n + ', velocity ' + Math.round((steps[track]![n-1] ?? 0)*100) + ' percent'" :aria-pressed="!!steps[track]![n-1]" @click="editStep(track,n-1,$event)"><span /><i /></button>
          </div>
        </div></div>
        <footer class="sequence-footer"><span><i /> Tap a step · Shift + tap for accent</span><div><button v-hover :disabled="!undoPattern" @click="undo">Undo</button><button v-hover aria-label="Copy this scene to next scene" @click="copyScene"><BeatIcon name="copy" :size="16" /></button><button v-hover aria-label="Clear scene" @click="clearPattern"><BeatIcon name="trash" :size="16" /></button></div></footer>
        <div v-if="single || page === 'Sequencer'" class="page-transport"><button v-hover class="vk-button primary" @click="togglePlay"><BeatIcon :name="playing ? 'stop' : 'play'" />{{ playing ? 'Stop' : 'Play loop' }}</button><label>Tempo<input v-model.number="bpm" type="number" min="55" max="180" aria-label="Tempo in beats per minute" @change="bpm = Math.min(180,Math.max(55,bpm || 78))" />BPM</label></div>
      </section>

      <section v-if="page === 'Mixer'" ref="meterBank" class="mixer-page" aria-label="Channel mixer">
        <div class="page-heading"><div><p class="eyebrow">GIVE EVERY SOUND ITS SPACE</p><h2>A little balance.</h2><p>Pan, level, and a room of their own.</p></div><button v-hover class="vk-button" @click="togglePlay"><BeatIcon :name="playing ? 'stop' : 'play'" />{{ playing ? 'Stop' : 'Audition mix' }}</button></div>
        <div class="mixer-scroll vk-scroll"><div class="channel-strips vk-platter"><div v-for="(channel,index) in channels" :key="index" class="channel-strip" :style="{ '--track': index < 8 ? pads[trackPads[index]!].color : '#d6b7df' }"><div class="strip-label"><i /><small>{{ String(index+1).padStart(2,'0') }}</small><h3>{{ index < 8 ? padName(trackPads[index]!) : 'Synth' }}</h3></div><label class="pan-control"><span>PAN <b>{{ channel.pan === 0 ? 'C' : Math.abs(Math.round(channel.pan*100)) + (channel.pan < 0 ? 'L' : 'R') }}</b></span><input v-model.number="channel.pan" class="mini-fader" type="range" min="-1" max="1" step=".01" :aria-label="'Channel ' + (index+1) + ' pan'" /></label><div class="fader-bank"><div class="meter" :data-meter="index"><i /><span /></div><input v-model.number="channel.volume" class="vertical-fader" type="range" min="0" max="1" step=".01" :aria-label="'Channel ' + (index+1) + ' level'" /><div class="fader-scale"><span>0</span><span>−6</span><span>−18</span><span>−∞</span></div></div><output class="db-value">{{ channel.volume ? (20*Math.log10(channel.volume)).toFixed(1) : '−∞' }} <small>dB</small></output><label class="send-control"><span>ROOM <b>{{ Math.round(channel.send*100) }}%</b></span><input v-model.number="channel.send" class="mini-fader" type="range" min="0" max=".8" step=".01" :aria-label="'Channel ' + (index+1) + ' reverb send'" /></label><div class="strip-buttons"><button v-hover :aria-pressed="channel.muted" :aria-label="'Mute channel ' + (index+1)" @click="channel.muted = !channel.muted">M</button><button v-hover :aria-pressed="channel.solo" :aria-label="'Solo channel ' + (index+1)" @click="channel.solo = !channel.solo">S</button></div></div><div class="master-strip"><span class="eyebrow">STEREO OUT</span><h3>Master</h3><div class="master-meters"><div data-meter="master" class="meter"><i /><span /></div><div class="master-scale"><span>0</span><span>−12</span><span>−24</span><span>−48</span></div></div><div class="limiter"><span>LIMITER <b data-reduction-label>0.0 dB</b></span><div data-reduction><i /></div></div><span class="safe-output"><i /> Soft limited</span></div></div></div>
        <div class="mix-note vk-well"><BeatIcon name="wave" /><div><strong>A room, without the room.</strong><p>Short stereo convolution reverb · gentle master compression · meters follow the audio.</p></div><button v-hover @click="channels = defaultChannels(); announce('Mixer reset. Fresh ears, fresh start.')">Reset mix</button></div>
      </section>

      <section v-if="page === 'Synth'" class="synth-page" aria-label="Polyphonic synthesizer">
        <div class="page-heading"><div><p class="eyebrow">ANALOG HEART / SPATIAL SOUL</p><h2>Soft focus.</h2><p>A little melody between the beats.</p></div><span class="synth-badge"><i /> POLYPHONIC</span></div>
        <div class="synth-workbench"><div class="envelope-panel vk-well"><div class="section-label"><span>FILTER ENVELOPE</span><span>{{ synth.cutoff }} Hz · {{ synth.attack.toFixed(2) }}s</span></div><svg class="envelope-drawing" viewBox="0 0 500 160" preserveAspectRatio="none" aria-label="Filter envelope: attack, decay, sustain and release"><defs><linearGradient id="beat-envelope-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#adcbd7" stop-opacity=".28" /><stop offset="1" stop-color="#adcbd7" stop-opacity="0" /></linearGradient></defs><path class="envelope-grid" d="M0 40h500M0 80h500M0 120h500M100 0v160M200 0v160M300 0v160M400 0v160" /><path :d="'M0 150 L' + (25+synth.attack*230) + ' ' + (100-synth.cutoff/90) + ' Q180 100 245 105 L360 105 Q440 110 500 150 L0 150Z'" fill="url(#beat-envelope-fill)" /><path :d="'M0 150 L' + (25+synth.attack*230) + ' ' + (100-synth.cutoff/90) + ' Q180 100 245 105 L360 105 Q440 110 500 150'" class="envelope-line" /></svg><div class="envelope-labels"><span>ATTACK</span><span>DECAY</span><span>SUSTAIN</span><span>RELEASE</span></div></div><div class="macro-panel vk-platter"><BeatKnob v-model="synth.tone" label="Colour" :min="0" :max="1" :step=".01" :display="synth.tone < .5 ? 'Velvet' : 'Bright'" color="#dfb6cf" /><BeatKnob v-model="synth.attack" label="Bloom" :min=".01" :max=".5" :step=".01" :display="Math.round(synth.attack*1000) + ' ms'" color="#adcbd7" /><label class="cutoff-control"><span>Filter cutoff <b>{{ (synth.cutoff/1000).toFixed(1) }} kHz</b></span><input v-model.number="synth.cutoff" class="mini-fader" type="range" min="200" max="6000" step="50" aria-label="Synth filter cutoff" /></label></div></div>
        <div class="keyboard-panel vk-platter"><div class="keyboard-toolbar"><label class="scale-lock"><input v-model="synth.scale" type="checkbox" class="vk-toggle" /><span>Scale lock<small>{{ synth.scale ? 'C minor pentatonic' : 'Chromatic · C3–C4' }}</small></span></label><div class="arp-controls"><button v-hover :aria-pressed="arp" @click="arp = !arp">Arpeggiator <i /></button><select v-model="arpMode" aria-label="Arpeggiator direction"><option>Up</option><option>Down</option><option>Random</option></select><span>1/16</span></div></div><div class="keyboard vk-scroll"><div class="keys-inner"><button v-for="(key,index) in piano" :key="index" class="piano-key" :class="{ black: key.black }" :style="{ '--key': key.position }" :aria-label="key.note + ', hold to play, keyboard ' + key.key" @pointerdown.prevent="pointerNote($event,index)" @pointerup="noteUp('p'+$event.pointerId)" @pointercancel="noteUp('p'+$event.pointerId)" @lostpointercapture="noteUp('p'+$event.pointerId)" @keydown.enter.stop.prevent="noteDown('enter'+index,index)" @keyup.enter="noteUp('enter'+index)" @keydown.space.stop.prevent="noteDown('space'+index,index)" @keyup.space="noteUp('space'+index)" @blur="noteUp('enter'+index); noteUp('space'+index)"><span>{{ key.note }}</span><kbd>{{ key.key }}</kbd></button></div></div><div class="keyboard-footer"><span>HOLD A KEY. FIND A FEELING.</span><span>Y U I O P [ ] \\ · black keys 5–9</span></div></div>
      </section>
    </main>

    <footer class="studio-bottom" :inert="!!sheet"><p class="status" role="status"><i :class="{ live: playing }" />{{ status }}</p><nav class="page-tabs vk-ornament" aria-label="Studio pages"><button v-if="page !== 'Pads'" v-hover class="ornament-play" :disabled="exporting || busy" :aria-label="playing ? 'Stop playback' : 'Play loop'" @click="togglePlay"><BeatIcon :name="playing ? 'stop' : 'play'" :size="17" /></button><button v-for="item in pages" :key="item" v-hover :aria-current="page === item ? 'page' : undefined" :disabled="exporting" @click="page = item"><BeatIcon :name="item.toLowerCase()" :size="19" /><span>{{ item }}</span></button></nav><div v-if="single && page === 'Pads'" class="mobile-kit"><button @click="openSheet('kits')">{{ kitName }}<BeatIcon name="chevron" :size="14" /></button></div></footer>

    <div v-if="sheet" class="sheet-backdrop" @click.self="closeSheet"><section class="studio-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true" :aria-label="sheet === 'kits' ? 'Sound library' : sheet === 'patterns' ? 'Session library' : sheet === 'track' ? trackName + ' settings' : 'Playing Beat Studio'"><div class="sheet-heading"><div><p class="eyebrow">BEAT STUDIO / {{ sheet === 'kits' ? 'SOUND LIBRARY' : sheet === 'patterns' ? 'SESSIONS' : sheet === 'track' ? 'CHANNEL' : 'FIELD GUIDE' }}</p><h2>{{ sheet === 'kits' ? 'Find your sound.' : sheet === 'patterns' ? 'Start somewhere good.' : sheet === 'track' ? trackName : 'Hands on. Headphones on.' }}</h2></div><button v-hover class="sheet-close" aria-label="Close panel" @click="closeSheet"><BeatIcon name="close" /></button></div>
      <template v-if="sheet === 'kits'"><p class="sheet-description">Six original synthesis palettes. No downloaded samples.</p><div class="kit-grid"><button v-for="(item,index) in kits" :key="item.name" v-hover class="kit-card vk-platter" :class="{ selected: kit === index }" :style="{ '--kit': item.color }" :aria-pressed="kit === index" @click="kit = index; announce(item.name + ' loaded. ' + item.description); closeSheet()"><div class="kit-art"><span v-for="n in 18" :key="n" :style="{ height: (14 + ((n*17+index*23)%55)) + '%' }" /><i>{{ String(index+1).padStart(2,'0') }}</i></div><div><small>{{ item.tag }}</small><strong>{{ item.name }}</strong><p>{{ item.description }}</p></div><BeatIcon v-if="kit === index" name="check" :size="17" /></button></div></template>
      <template v-else-if="sheet === 'patterns'"><p class="sheet-description">Loading a session replaces the four scenes in this workspace.</p><label class="search-field vk-well"><BeatIcon name="search" :size="18" /><input v-model="query" type="search" placeholder="Find a groove or a kit" aria-label="Search sessions" /></label><div class="preset-list"><button v-for="item in filteredPresets" :key="item.index" v-hover :aria-pressed="preset === item.index" @click="loadPreset(item.index)"><span class="preset-art" :style="{ '--kit': kits[item.kit]!.color }"><i v-for="n in 16" :key="n" :class="{ on: item.pattern[n%8]![n-1] }" /></span><span><strong>{{ item.name }}</strong><small>{{ kits[item.kit]!.name }} · {{ item.bpm }} BPM · {{ item.swing }}% swing</small></span><BeatIcon v-if="preset === item.index" name="check" /></button><div v-if="!filteredPresets.length" class="empty-state"><BeatIcon name="search" :size="32" /><h3>No grooves called that. Yet.</h3><p>Try “Chai”, “Glass”, or “Garage”.</p><button @click="query = ''">Show all sessions</button></div></div></template>
      <template v-else-if="sheet === 'track'"><p class="sheet-description">Every detail has a place in the mix.</p><div class="track-settings"><label>Level <output>{{ Math.round(channels[selectedTrack]!.volume*100) }}%</output><input v-model.number="channels[selectedTrack]!.volume" class="vk-slider" type="range" min="0" max="1" step=".01" :style="{ '--value': channels[selectedTrack]!.volume }" /></label><label>Pan <output>{{ Math.round(channels[selectedTrack]!.pan*100) }}</output><input v-model.number="channels[selectedTrack]!.pan" class="vk-slider" type="range" min="-1" max="1" step=".01" :style="{ '--value': (channels[selectedTrack]!.pan+1)/2 }" /></label><label>Room send <output>{{ Math.round(channels[selectedTrack]!.send*100) }}%</output><input v-model.number="channels[selectedTrack]!.send" class="vk-slider" type="range" min="0" max=".8" step=".01" :style="{ '--value': channels[selectedTrack]!.send/.8 }" /></label><button class="vk-button destructive" @click="backup(); scenes[scene]![selectedTrack] = Array.from({ length: 16 }, () => 0); announce(trackName + ' pattern cleared. Undo is available.'); closeSheet()">Clear this track</button></div></template>
      <div v-else class="help-content"><div class="help-hero vk-well"><BeatIcon name="pads" :size="40" /><div><h3>Make a loop. Leave a little air.</h3><p>Start playback, tap the grid, then shape the sound. Everything you hear is synthesised in your browser.</p></div></div><dl><div><dt>Play / stop</dt><dd><kbd>Space</kbd></dd></div><div><dt>Sixteen performance pads</dt><dd><kbd>1 2 3 4</kbd><kbd>Q W E R</kbd><kbd>A S D F</kbd><kbd>Z X C V</kbd></dd></div><div><dt>Change step velocity</dt><dd>Shift + tap a step</dd></div><div><dt>Adjust a knob</dt><dd>Drag up / down · arrows · Shift for precision</dd></div><div><dt>Record a pattern</dt><dd>Arm the red circle, press play, tap track pads</dd></div><div><dt>Switch / chain scenes</dt><dd>Changes land on the next bar</dd></div><div><dt>Synth keyboard</dt><dd>Y U I O P [ ] \\ · 5–9 for black keys</dd></div><div><dt>Save your loop</dt><dd>Two bars + reverb tail · when supported</dd></div></dl><p>Performance pads outside the eight arrangement tracks play live. Focus the instrument to use shortcuts. Audio pauses when the page is hidden.</p></div>
    </section></div>
  </div>
</template>
<style scoped src="./beat/beat.css"></style>
