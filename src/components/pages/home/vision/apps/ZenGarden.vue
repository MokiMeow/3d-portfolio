<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { GardenAudio } from './zen/audio';
import { SandTray, type Point, type Tool } from './zen/sand';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const app = ref<HTMLElement>();
const stage = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const weather = ref<HTMLCanvasElement>();
const cursorElement = ref<HTMLElement>();
const tool = ref<Tool>('rake');
const stone = ref(0);
const plant = ref(0);
const rain = ref(false);
const sound = ref(false);
const caption = ref('Nothing here needs fixing.');
const status = ref('Drag slowly. Five little lines, one quieter thought.');
const tools: { id: Tool; name: string; icon: string; hint: string }[] = [
  { id: 'rake', name: 'Rake', icon: 'M12 3v9M4 12h16M4 12v8m4-8v8m4-8v8m4-8v8m4-8v8', hint: 'Drag slowly. Five little lines, one quieter thought.' },
  { id: 'fine', name: 'Fine rake', icon: 'M12 3v9M3 12h18M3 12v8m2-8v8m2-8v8m2-8v8m3-8v8m3-8v8m2-8v8m2-8v8m2-8v8', hint: 'Nine tines. For thoughts that need a finer comb.' },
  { id: 'finger', name: 'Finger', icon: 'M9 13V6a2 2 0 0 1 4 0v7m0-3 4 1c2 .5 3 2 2 4l-2 5H9l-5-6a2 2 0 0 1 3-2l2 1Z', hint: 'One soft groove. No impressive technique required.' },
  { id: 'smooth', name: 'Smooth', icon: 'm4 10 7-7 10 10-7 7-10-10ZM7 13l7-7M14 20h7', hint: 'Brush away a line. The sand is excellent at second chances.' },
  { id: 'stone', name: 'Stones', icon: 'M4 16Q1 10 7 6q5-5 10 1 6 5 3 11-8 5-16-2Zm3-8 3-1', hint: 'Choose a stone, then tap the sand. A small, solid decision.' },
  { id: 'plant', name: 'Plant', icon: 'M12 21V10M12 15Q2 15 4 5q9 0 8 10Zm0-4q0-8 8-8 2 8-8 8Z', hint: 'Tap to plant a tiny patch of green. It will not ask for a sprint.' },
];
const captions = ['Nothing here needs fixing.', 'The sand has no deadlines.', 'Rake slowly. The bugs will wait.', 'A little less doing. A little more being.', 'Let this be the quiet tab.', 'Even the stones are taking a break.'];
const stoneColors = ['#8b9690', '#a69987', '#66877a', '#9690ab', '#b99a80', '#788c9c'];
let tray: SandTray | undefined;
let audio: GardenAudio | undefined;
let resize: ResizeObserver | undefined;
let intersection: IntersectionObserver | undefined;
let motion: MediaQueryList | undefined;
let captionTimer: ReturnType<typeof setInterval> | undefined;
let chimeTimer: ReturnType<typeof setTimeout> | undefined;
let frame = 0;
let disposed = false;
let visible = true;
let reduced = false;
let width = 1;
let height = 1;
let weatherContext: CanvasRenderingContext2D | null = null;
let lastPaint = 0;
let lastDrop = 0;
let settling = false;
let settleStart = 0;
let settleElapsed = 0;
let lastSettle = 0;
let audioOperation = 0;
let downloadUrl: string | undefined;
let pointerId: number | undefined;
let pointerBox: DOMRect | undefined;
let cursor: Point = { x: 100, y: 100 };
let keyboardDrawing = false;
let captionIndex = 0;
const drops: { x: number; y: number; born: number; radius: number }[] = [];
function announce(message: string): void { if (!disposed) status.value = message; }
function choose(id: Tool): void {
  finishPointer();
  tool.value = id;
  announce(tools.find(item => item.id === id)?.hint ?? '');
}
function clearChime(): void { if (chimeTimer) clearTimeout(chimeTimer); chimeTimer = undefined; }
function scheduleChime(): void {
  clearChime();
  if (!sound.value || !vision.sound.value || !visible || document.hidden || disposed) return;
  chimeTimer = setTimeout(() => {
    chimeTimer = undefined;
    if (!visible || document.hidden || disposed || !sound.value || !vision.sound.value) return;
    audio?.chime(); scheduleChime();
  }, 24000 + Math.random() * 22000);
}
async function updateAudio(): Promise<void> {
  const request = ++audioOperation;
  clearChime();
  if (disposed || !sound.value || !vision.sound.value || !visible || document.hidden) { audio?.suspend(); return; }
  try {
    audio ??= new GardenAudio();
    const resumed = await audio.resume();
    if (disposed || request !== audioOperation || !visible || document.hidden) return;
    if (resumed) { audio.rain(rain.value); scheduleChime(); }
  } catch { announce('Sound is unavailable here. The sand is still listening.'); sound.value = false; }
}
function toggleSound(): void {
  sound.value = !sound.value;
  if (sound.value && !vision.sound.value) announce('Garden sound is on standby. Enable headset sound in Settings to hear it.');
  else announce(sound.value ? 'Quiet rain, wooden taps, and an occasional chime.' : 'A quiet garden. Sound is off.');
}
function finishPointer(): void {
  if (pointerId !== undefined && canvas.value?.hasPointerCapture(pointerId)) canvas.value.releasePointerCapture(pointerId);
  pointerId = undefined; pointerBox = undefined;
  if (keyboardDrawing) keyboardDrawing = false;
  tray?.finish();
}
function cancelSettle(): void { settling = false; settleElapsed = 0; }
function pointFrom(event: PointerEvent): Point {
  const box = pointerBox;
  if (!box) return { x: 0, y: 0 };
  return { x: Math.max(0, Math.min(width, (event.clientX - box.left) * width / Math.max(1, box.width))), y: Math.max(0, Math.min(height, (event.clientY - box.top) * height / Math.max(1, box.height))) };
}
function place(point: Point): void {
  cancelSettle();
  if (tool.value === 'stone') {
    if (tray?.placeStone(point, stone.value)) {
      if (sound.value && vision.sound.value) audio?.tok();
      announce('A stone has arrived. Try Ripples to give it a little breathing room.');
    } else announce('Twenty-four stones is a mountain. A new tray makes room.');
  } else if (tool.value === 'plant') {
    if (tray?.placePlant(point, plant.value)) announce(plant.value ? 'A tiny bonsai. Its only roadmap is up.' : 'Moss planted. Quietly ambitious.');
    else announce('Eighteen plants make a forest. Start a new tray for more.');
  }
}
function pointerDown(event: PointerEvent): void {
  if (!canvas.value || !tray || pointerId !== undefined || event.button > 0) return;
  cancelSettle();
  canvas.value.focus({ preventScroll: true });
  pointerBox = canvas.value.getBoundingClientRect();
  const point = pointFrom(event);
  cursor = point;
  if (tool.value === 'stone' || tool.value === 'plant') { place(point); pointerBox = undefined; return; }
  pointerId = event.pointerId;
  canvas.value.setPointerCapture(event.pointerId);
  tray.start(point, tool.value);
}
function pointerMove(event: PointerEvent): void {
  if (event.pointerId !== pointerId || !tray) return;
  // Coalesced hardware samples preserve silky paths without a reactive pointer state.
  const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [];
  const samples = events.length ? events : [event];
  for (const sample of samples.slice(-16)) tray.move(pointFrom(sample), false);
  tray.render();
}
function pointerEnd(event: PointerEvent): void { if (event.pointerId === pointerId) finishPointer(); }
function drawCursor(): void {
  const element = cursorElement.value;
  if (!element) return;
  element.style.transform = 'translate(' + (cursor.x - 10) + 'px,' + (cursor.y - 10) + 'px)';
}
function canvasKeys(event: KeyboardEvent): void {
  if (event.ctrlKey || event.metaKey || event.altKey || !tray) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); cancelSettle();
    const distance = event.shiftKey ? 24 : 8;
    cursor.x = Math.max(8, Math.min(width - 8, cursor.x + (event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0)));
    cursor.y = Math.max(8, Math.min(height - 8, cursor.y + (event.key === 'ArrowDown' ? distance : event.key === 'ArrowUp' ? -distance : 0)));
    drawCursor(); if (keyboardDrawing) tray.move({ ...cursor }); return;
  }
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
    event.preventDefault(); cancelSettle();
    if (tool.value === 'stone' || tool.value === 'plant') place(cursor);
    else if (!keyboardDrawing) { keyboardDrawing = true; tray.start({ ...cursor }, tool.value); }
  }
}
function endKeyboard(event: KeyboardEvent): void {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  if (keyboardDrawing) { tray?.finish(); keyboardDrawing = false; }
}
function newTray(): void {
  finishPointer();
  tray?.clearObjects();
  drops.length = 0;
  if (reduced) tray?.reset();
  else {
    settling = true; settleStart = performance.now(); settleElapsed = 0; lastSettle = settleStart;
    startFrames();
  }
  announce('The sand settles. So can you.');
}
function randomGarden(): void {
  finishPointer(); cancelSettle(); tray?.random();
  announce('A new little landscape. Yours to rearrange.');
}
function ripples(): void {
  finishPointer(); cancelSettle(); tray?.ripple();
  announce('Six rings around each stone. A small ripple in a very small world.');
}
function saveImage(): void {
  const image = canvas.value;
  if (!image) return;
  try {
    image.toBlob(blob => {
      if (!blob || disposed) { if (!disposed) announce('The image could not be saved. Try once more.'); return; }
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = downloadUrl; link.download = 'a-little-zen-garden.png'; link.click();
      announce('Garden saved. A PNG with absolutely no deadlines.');
      vision.toast('Zen Garden image saved');
    }, 'image/png');
  } catch { announce('Image saving is unavailable in this browser.'); }
}
function clearWeather(): void { weatherContext?.clearRect(0, 0, width, height); drops.length = 0; }
function animate(now: number): void {
  frame = 0;
  if (disposed || !visible || document.hidden) return;
  if (now - lastPaint >= 33) {
    lastPaint = now;
    if (settling) {
      settleElapsed = now - settleStart;
      const delta = Math.min(80, now - lastSettle); lastSettle = now;
      tray?.settle(1 - Math.exp(-delta / 180));
      if (settleElapsed >= 900) { tray?.reset(); cancelSettle(); }
    }
    const ctx = weatherContext;
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
      if (rain.value && !reduced) {
        if (now - lastDrop > 150 && drops.length < 16) {
          lastDrop = now; drops.push({ x: Math.random() * width, y: Math.random() * height, born: now, radius: 2 + Math.random() * 2 });
        }
        for (let i = drops.length - 1; i >= 0; i--) {
          const drop = drops[i]!, age = (now - drop.born) / 1100;
          if (age >= 1) { drops.splice(i, 1); continue; }
          const radius = drop.radius + age * 9;
          ctx.globalAlpha = Math.sin(age * Math.PI) * .27;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.ellipse(drop.x, drop.y, radius, radius * .48, 0, 0, Math.PI * 2);
          ctx.strokeStyle = '#635332'; ctx.stroke();
          ctx.beginPath(); ctx.ellipse(drop.x - .7, drop.y - .7, radius, radius * .48, 0, Math.PI, Math.PI * 2);
          ctx.strokeStyle = '#fff4ce'; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  if (settling || (rain.value && !reduced)) frame = requestAnimationFrame(animate);
}
function startFrames(): void {
  if (!frame && visible && !document.hidden && !disposed && (settling || (rain.value && !reduced))) frame = requestAnimationFrame(animate);
}
function startCaption(): void {
  if (captionTimer || !visible || document.hidden || disposed) return;
  captionTimer = setInterval(() => { captionIndex = (captionIndex + 1) % captions.length; caption.value = captions[captionIndex]!; }, 60000);
}
function visibility(): void {
  if (!visible || document.hidden) {
    finishPointer();
    if (settling) settleElapsed = performance.now() - settleStart;
    cancelAnimationFrame(frame); frame = 0;
    if (captionTimer) clearInterval(captionTimer); captionTimer = undefined;
    clearWeather(); clearChime(); audioOperation++; audio?.suspend();
  } else {
    if (settling) { settleStart = performance.now() - settleElapsed; lastSettle = performance.now(); }
    startCaption(); startFrames(); if (audio) void updateAudio();
  }
}
function motionChanged(): void {
  reduced = motion?.matches ?? false;
  if (reduced) { if (settling) { tray?.reset(); cancelSettle(); } clearWeather(); cancelAnimationFrame(frame); frame = 0; }
  else startFrames();
}
watch([rain, sound, vision.sound], () => {
  if (!rain.value) clearWeather();
  startFrames(); void updateAudio();
});
onMounted(() => {
  if (!canvas.value || !stage.value || !app.value) return;
  try { tray = new SandTray(canvas.value); }
  catch { announce('The sand needs a browser with canvas support.'); return; }
  motion = matchMedia('(prefers-reduced-motion: reduce)'); motionChanged(); motion.addEventListener('change', motionChanged);
  resize = new ResizeObserver(entries => {
    const entry = entries[0]; if (!entry || disposed || entry.contentRect.width < 2 || entry.contentRect.height < 2) return;
    finishPointer();
    width = Math.max(1, entry.contentRect.width); height = Math.max(1, entry.contentRect.height);
    tray?.resize(width, height);
    const overlay = weather.value;
    if (overlay) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      overlay.width = Math.round(width * dpr); overlay.height = Math.round(height * dpr);
      weatherContext = overlay.getContext('2d'); weatherContext?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    cursor = { x: width / 2, y: height / 2 }; drawCursor();
  });
  resize.observe(stage.value);
  intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; visibility(); }, { threshold: .01 });
  intersection.observe(app.value);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('blur', finishPointer);
  startCaption();
});
onBeforeUnmount(() => {
  disposed = true; audioOperation++;
  finishPointer(); cancelAnimationFrame(frame);
  if (captionTimer) clearInterval(captionTimer); clearChime();
  resize?.disconnect(); intersection?.disconnect();
  motion?.removeEventListener('change', motionChanged);
  document.removeEventListener('visibilitychange', visibility);
  window.removeEventListener('blur', finishPointer);
  audio?.close(); tray?.destroy();
  if (weather.value) { weather.value.width = 0; weather.value.height = 0; }
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
});
</script>

<template>
  <div ref="app" class="zen-app" :class="{ compact }">
    <header class="intro">
      <div><p class="eyebrow vk-tertiary">A LITTLE SPACE TO JUST BE</p><h1 class="vk-large-title">Zen Garden</h1></div>
      <div class="garden-actions">
        <button v-hover class="vk-button" @click="newTray"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 2 8M4 4v6h6" /></svg>New tray</button>
        <button v-hover class="vk-button" @click="randomGarden"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 5-10 5 10H4Zm10-8 3-5 4 5h-7M17 9v10M7 19h14" /></svg>Random garden</button>
        <button v-hover class="vk-icon" aria-label="Save garden as PNG" title="Save image" @click="saveImage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4" /></svg></button>
      </div>
    </header>
    <div class="garden-body">
      <nav class="tools vk-tabbar vk-scroll" aria-label="Garden tools">
        <button v-for="item in tools" :key="item.id" v-hover class="tool vk-icon" :aria-pressed="tool === item.id" :aria-label="item.name" @click="choose(item.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.icon" /></svg><span>{{ item.name }}</span></button>
      </nav>
      <div ref="stage" class="tray-stage">
        <canvas ref="canvas" class="sand-canvas" tabindex="0" role="application" aria-label="Interactive sand garden" aria-describedby="zen-instructions" @pointerdown.prevent="pointerDown" @pointermove.prevent="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @keydown="canvasKeys" @keyup="endKeyboard" @blur="finishPointer" />
        <canvas ref="weather" class="weather-canvas" aria-hidden="true" />
        <span ref="cursorElement" class="keyboard-cursor" aria-hidden="true" />
        <div class="tray-label" aria-hidden="true"><span>{{ tools.find(item => item.id === tool)?.name }}</span><span>Made of pixels. Still a little peaceful.</span></div>
      </div>
    </div>
    <footer class="garden-footer">
      <div class="options">
        <div v-if="tool === 'stone'" class="stone-options vk-segmented" aria-label="Choose a stone">
          <button v-for="(color, index) in stoneColors" :key="color" v-hover :aria-pressed="stone === index" :aria-label="'Stone ' + (index + 1)" @click="stone = index"><svg viewBox="0 0 32 28" aria-hidden="true"><path :fill="color" d="M5 21Q0 14 7 7q7-7 14 0 10 7 5 15-11 7-21-1Z" /><path d="m9 10 4-2" /></svg></button>
        </div>
        <div v-else-if="tool === 'plant'" class="plant-options vk-segmented" aria-label="Choose a plant"><button v-hover :aria-pressed="plant === 0" @click="plant = 0">Moss</button><button v-hover :aria-pressed="plant === 1" @click="plant = 1">Bonsai</button></div>
        <span v-else class="vk-footnote vk-secondary tool-note">{{ tool === 'fine' ? '9 tines · finer thoughts' : tool === 'finger' ? '1 groove · soft edges' : tool === 'smooth' ? 'A soft brush · a fresh start' : '5 tines · slow is lovely' }}</span>
        <div class="ambience vk-ornament">
          <button v-hover class="vk-button" @click="ripples"><svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="6" /><ellipse cx="12" cy="12" rx="5" ry="3" /><path d="M11 12h2" /></svg>Ripples</button>
          <button v-hover class="vk-button" :aria-pressed="rain" @click="rain = !rain"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 13a4 4 0 0 1 0-8 6 6 0 0 1 11-1 4 4 0 0 1 1 9M7 16l-1 3m6-3-1 3m6-3-1 3" /></svg>Rain</button>
          <button v-hover class="vk-icon" :aria-pressed="sound" :aria-label="sound ? 'Turn garden sound off' : 'Turn garden sound on'" @click="toggleSound"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3Z" /><path :d="sound && vision.sound.value ? 'M16 8q6 4 0 8m3-11q9 7 0 14' : 'm16 8 6 8m0-8-6 8'" /></svg></button>
        </div>
      </div>
      <p class="caption vk-body">{{ caption }}</p>
      <p class="status vk-footnote vk-secondary" role="status">{{ status }}</p>
      <p id="zen-instructions" class="keyboard-help vk-footnote vk-tertiary">Touch or drag the sand. Keyboard: focus the tray, move with arrows, hold Space to rake; Enter places a stone or plant.</p>
    </footer>
  </div>
</template>

<style scoped src="./zen/zen.css"></style>
