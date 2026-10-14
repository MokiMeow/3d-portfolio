<script setup lang="ts">
import type { Component } from 'vue';
import { labDeviceBack } from '~/common/models/lab-device.model';
import { VISION, VISION_APPS, VISION_ENVIRONMENTS, type VisionAppId, type VisionEnvironmentId } from './vision/vision';
import { createAmbience } from './vision/ambience';
import VisionEnvironment from './vision/VisionEnvironment.vue';
import VisionIcon from './vision/VisionIcon.vue';

type Win = { id: VisionAppId; x: number; y: number; w: number; h: number; z: number; full?: { x: number; y: number; w: number; h: number } };
// Apps load on first open, so the headset itself starts quickly; each window shows its glass until the app arrives.
const VIEWS: Record<VisionAppId, Component> = {
  tv: defineAsyncComponent(() => import('./vision/apps/TV.vue')),
  youtube: defineAsyncComponent(() => import('./vision/apps/YouTube.vue')),
  photos: defineAsyncComponent(() => import('./vision/apps/Photos.vue')),
  safari: defineAsyncComponent(() => import('./vision/apps/Safari.vue')),
  music: defineAsyncComponent(() => import('./vision/apps/Music.vue')),
  notes: defineAsyncComponent(() => import('./vision/apps/Notes.vue')),
  mindfulness: defineAsyncComponent(() => import('./vision/apps/Mindfulness.vue')),
  mac: defineAsyncComponent(() => import('./vision/apps/Mac.vue')),
  freeform: defineAsyncComponent(() => import('./vision/apps/Freeform.vue')),
  settings: defineAsyncComponent(() => import('./vision/apps/Settings.vue')),
  messages: defineAsyncComponent(() => import('./vision/apps/Messages.vue')),
  files: defineAsyncComponent(() => import('./vision/apps/Files.vue')),
  encounter: defineAsyncComponent(() => import('./vision/apps/Encounter.vue')),
  store: defineAsyncComponent(() => import('./vision/apps/Store.vue')),
  arcade: defineAsyncComponent(() => import('./vision/apps/Arcade.vue')),
  facetime: defineAsyncComponent(() => import('./vision/apps/FaceTime.vue')),
  weather: defineAsyncComponent(() => import('./vision/apps/Weather.vue')),
  maps: defineAsyncComponent(() => import('./vision/apps/Maps.vue')),
  clock: defineAsyncComponent(() => import('./vision/apps/Clock.vue')),
  keynote: defineAsyncComponent(() => import('./vision/apps/Keynote.vue')),
  nightsky: defineAsyncComponent(() => import('./vision/apps/NightSky.vue')),
  objects: defineAsyncComponent(() => import('./vision/apps/Objects.vue')),
  beatstudio: defineAsyncComponent(() => import('./vision/apps/BeatStudio.vue')),
  zengarden: defineAsyncComponent(() => import('./vision/apps/ZenGarden.vue')),
};
const NAMES = Object.fromEntries(VISION_APPS.map(item => [item.id, item.name])) as Record<VisionAppId, string>;
// The Home View honeycomb: pages of rows of 4, 5 and 5, each cell 146 apart, like the real Home View.
const ROWS = [4, 5, 5];
const PER_PAGE = 14;
const PAGES = Array.from({ length: Math.ceil(VISION_APPS.length / PER_PAGE) }, (_, page) =>
  VISION_APPS.slice(page * PER_PAGE, (page + 1) * PER_PAGE).map((item, index) => {
    const row = index < 4 ? 0 : index < 9 ? 1 : 2, column = index - [0, 4, 9][row]!;
    return { ...item, x: (column - (ROWS[row]! - 1) / 2) * 146, y: (row - 1) * 134 };
  }));
const ALL_CELLS = PAGES.flat();
const PEOPLE = [
  { name: 'Build Bot', line: 'Available. Unfortunately.', tint: 'linear-gradient(180deg,#8e9aff,#5b5ce6)' },
  { name: 'Rubber Duck', line: 'Listening. Judging.', tint: 'linear-gradient(180deg,#ffe066,#ffb300)' },
  { name: 'Amma', line: 'Has called 3 times.', tint: 'linear-gradient(180deg,#ffb37a,#ff7a59)' },
];
const TIPS = [
  { key: 'open', title: 'Open an app', text: 'Click any icon in the Home View. It opens as a floating window.' },
  { key: 'move', title: 'Move, resize and close', text: 'Drag the bar under a window to move it. Drag a corner to resize. The × beside the bar closes it.' },
  { key: 'home', title: 'Go back Home', text: 'Press Home in the dock, press the Digital Crown, or hit Esc. Esc closes the front window first.' },
  { key: 'place', title: 'Step into a place', text: 'Pick an Environment, then turn the Digital Crown or scroll on it for more or less of it. Drag the scenery to look around.' },
];
/** Space kept clear at the bottom for the dock, so a window's bar never hides behind it. */
const DOCK = 96;
// Windows live below the row of hardware pills and the clock, never underneath them.
const TOP = 72;

useHead({ link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap' }] });

const booting = ref(true);
const homeOpen = ref(true);
const tab = ref<'apps' | 'people' | 'environments'>('apps');
const windows = ref<Win[]>([]);
const environment = ref<VisionEnvironmentId>('room');
const immersion = ref(0);
const dim = ref(0);
const reduceTransparency = ref(false);
const dark = ref(false);
const sound = ref(false);
const control = ref(false);
const help = ref(false);
const note = ref('');
const flash = ref(false);
const looking = ref(false);
const now = ref(new Date());
const view = reactive({ w: 1280, h: 720 });
const tilt = reactive({ x: 0, y: 0 });
const visor = ref<HTMLElement>();
const space = ref<HTMLElement>();
const place = ref<InstanceType<typeof VisionEnvironment>>();
const compact = computed(() => view.w < 700);
const homeScale = computed(() => Math.max(0.4, Math.min(1, (view.w - (compact.value ? 24 : 190)) / 740, (view.h - DOCK - 150) / 430)));
const time = computed(() => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now.value));
const day = computed(() => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now.value));
const here = computed(() => VISION_ENVIRONMENTS.find(item => item.id === environment.value)!);
const inside = computed(() => environment.value !== 'room' && immersion.value > 0.05);
const front = computed(() => windows.value.reduce<Win | undefined>((best, win) => (!best || win.z > best.z ? win : best), undefined));
const ambience = createAmbience();
let top = 10, lastPlace: VisionEnvironmentId = 'lakeside', hinted = false;
let noteTimer = 0, clockTimer = 0, bootTimer = 0, flashTimer = 0, glide = 0;
let watcher: ResizeObserver | undefined;

function focus(win: Win) { if (win.z !== top) win.z = ++top; }
function room() { return { w: view.w - (compact.value ? 12 : 56), h: view.h - TOP - DOCK - 58 }; }
function open(id: VisionAppId) {
  const existing = windows.value.find(item => item.id === id);
  homeOpen.value = false; control.value = false; help.value = false;
  if (existing) { focus(existing); return; }
  const [width, height] = VISION_APPS.find(item => item.id === id)!.size, fit = room();
  const w = Math.min(width, fit.w), h = Math.min(height, fit.h), step = windows.value.length % 4;
  windows.value.push({ id, w, h, x: Math.max(6, (view.w - w) / 2 + step * 28), y: Math.max(TOP, TOP + (fit.h - h) / 2 + step * 18), z: ++top });
  // The first window comes with one line on how to leave it.
  if (!hinted) { hinted = true; toast('Drag the bar under the window to move it. × closes it. Home is in the dock.'); }
}
function close(id: VisionAppId) {
  windows.value = windows.value.filter(item => item.id !== id);
  if (!windows.value.length) { homeOpen.value = true; tab.value = 'apps'; }
}
function closeAll() { windows.value = []; homeOpen.value = true; tab.value = 'apps'; toast('All apps closed.'); }
const page = ref(0);
const pageDirection = ref(1);
function turnPage(step: number) {
  const next = Math.max(0, Math.min(PAGES.length - 1, page.value + step));
  if (next === page.value) return;
  pageDirection.value = Math.sign(step);
  page.value = next;
}
function showPage(index: number) { turnPage(index - page.value); }
// A sideways swipe or a sideways scroll turns the page; the click that ends a swipe never opens an app.
let pageSwipe: { x: number; y: number; done: boolean } | null = null, swallowClick = false, wheelLock = 0;
function pageDown(event: PointerEvent) { swallowClick = false; pageSwipe = { x: event.clientX, y: event.clientY, done: false }; }
function pageMove(event: PointerEvent) {
  if (!pageSwipe || pageSwipe.done) return;
  const dx = event.clientX - pageSwipe.x, dy = event.clientY - pageSwipe.y;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) { pageSwipe.done = true; swallowClick = true; turnPage(dx < 0 ? 1 : -1); }
}
function pageUp() { pageSwipe = null; }
function pageClick(event: MouseEvent) { if (!swallowClick) return; event.stopPropagation(); event.preventDefault(); swallowClick = false; }
function pageWheel(event: WheelEvent) {
  if (PAGES.length < 2 || Math.abs(event.deltaX) < Math.abs(event.deltaY) || Math.abs(event.deltaX) < 24 || performance.now() < wheelLock) return;
  wheelLock = performance.now() + 450;
  turnPage(event.deltaX > 0 ? 1 : -1);
}
function pageKeys(event: KeyboardEvent) {
  if (!homeOpen.value || tab.value !== 'apps' || compact.value || event.defaultPrevented) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'ArrowRight' || event.key === 'PageDown') turnPage(1);
  else if (event.key === 'ArrowLeft' || event.key === 'PageUp') turnPage(-1);
}
function goHome(which: 'apps' | 'people' | 'environments' = 'apps') {
  control.value = false; help.value = false;
  if (homeOpen.value && tab.value === which && windows.value.length) { homeOpen.value = false; return; }
  tab.value = which; homeOpen.value = true;
}
/** Escape: step back one level. Returns false when there is nothing left to step back from. */
function back() {
  if (help.value) { help.value = false; return true; }
  if (control.value) { control.value = false; return true; }
  if (homeOpen.value && windows.value.length) { homeOpen.value = false; return true; }
  const win = front.value;
  if (win) { close(win.id); return true; }
  if (!homeOpen.value) { homeOpen.value = true; return true; }
  if (tab.value !== 'apps') { tab.value = 'apps'; return true; }
  return false;
}
function toast(text: string) {
  note.value = text;
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => { note.value = ''; }, 3600);
}
// Immersion glides rather than jumps, like the Digital Crown.
function glideTo(target: number) {
  cancelAnimationFrame(glide);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { immersion.value = target; return; }
  const tick = () => {
    immersion.value += (target - immersion.value) * 0.1;
    if (Math.abs(target - immersion.value) < 0.004) { immersion.value = target; return; }
    glide = requestAnimationFrame(tick);
  };
  glide = requestAnimationFrame(tick);
}
function setEnvironment(id: VisionEnvironmentId) {
  if (id === 'room') { glideTo(0); toast('Back in the room.'); return; }
  const already = environment.value === id && immersion.value > 0.9;
  environment.value = id; lastPlace = id;
  glideTo(1);
  if (!already) toast(`${VISION_ENVIRONMENTS.find(item => item.id === id)!.name}. Drag the scenery to look around.`);
}
function turnCrown(by: number) {
  cancelAnimationFrame(glide);
  if (environment.value === 'room') environment.value = lastPlace;
  immersion.value = Math.max(0, Math.min(1, immersion.value + by));
}
function toggleSound() { sound.value = !sound.value; toast(sound.value ? 'Ambient sound on.' : 'Ambient sound off.'); }
watch(environment, value => { if (value === 'room') glideTo(0); else { lastPlace = value; if (immersion.value < 0.05) glideTo(1); } });
// The ambience follows the place and fades with immersion.
watch([sound, environment, () => Math.round(immersion.value * 10)], () => {
  ambience.set(sound.value && inside.value ? here.value.sound : 'none', immersion.value);
});
provide(VISION, { now, environment, immersion, dim, reduceTransparency, dark, sound, open, close, toast });

function capture() {
  flash.value = true;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { flash.value = false; }, 220);
  toast('Captured. Saved to Photos, in spirit.');
}
function recenter() {
  const fit = room();
  windows.value.forEach((win, index) => { win.full = undefined; win.w = Math.min(win.w, fit.w); win.h = Math.min(win.h, fit.h); win.x = Math.max(6, (view.w - win.w) / 2 + (index % 4) * 28); win.y = Math.max(TOP, TOP + (fit.h - win.h) / 2 + (index % 4) * 18); });
  place.value?.recentre();
  control.value = false; toast('View recentred.');
}
/** Double-click a window's bar: fill the view, or go back to the size it had. */
function zoom(win: Win) {
  if (win.full) { Object.assign(win, win.full); win.full = undefined; return; }
  const fit = room();
  win.full = { x: win.x, y: win.y, w: win.w, h: win.h };
  win.w = fit.w; win.h = fit.h; win.x = (view.w - fit.w) / 2; win.y = TOP;
}

// Dragging a window by its bar, or resizing it from the corner.
let drag: { win: Win; mode: 'move' | 'size'; x: number; y: number; left: number; top: number; w: number; h: number } | null = null;
function grab(event: PointerEvent, win: Win, mode: 'move' | 'size') {
  focus(win);
  drag = { win, mode, x: event.clientX, y: event.clientY, left: win.x, top: win.y, w: win.w, h: win.h };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function lowest(win: Win) { return Math.max(TOP, view.h - DOCK - 54 - win.h); }
function pull(event: PointerEvent) {
  if (!drag) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y, win = drag.win;
  if (Math.abs(dx) + Math.abs(dy) > 3) win.full = undefined;
  if (drag.mode === 'move') {
    win.x = Math.max(90 - win.w, Math.min(view.w - 90, drag.left + dx));
    win.y = Math.max(TOP, Math.min(lowest(win), drag.top + dy));
  } else {
    win.w = Math.max(Math.min(380, view.w - 12), Math.min(view.w - win.x - 6, drag.w + dx));
    win.h = Math.max(300, Math.min(view.h - DOCK - 54 - win.y, drag.h + dy));
  }
}
function drop() { drag = null; }

// Looking around: dragging the empty space behind the windows turns the environment.
let gaze: { x: number; y: number; vx: number; vy: number; at: number } | null = null;
function lookDown(event: PointerEvent) {
  if (event.target !== space.value) return;
  if (homeOpen.value && windows.value.length) { homeOpen.value = false; return; }
  if (!inside.value) return;
  gaze = { x: event.clientX, y: event.clientY, vx: 0, vy: 0, at: performance.now() };
  looking.value = true;
  space.value?.setPointerCapture(event.pointerId);
}
function lookMove(event: PointerEvent) {
  pull(event);
  if (!gaze) return;
  const dx = event.clientX - gaze.x, dy = event.clientY - gaze.y, t = performance.now(), dt = Math.max(1, t - gaze.at) / 1000;
  place.value?.turn(dx, dy);
  gaze = { x: event.clientX, y: event.clientY, vx: dx / dt, vy: dy / dt, at: t };
}
function lookUp() {
  drop();
  if (!gaze) return;
  if (performance.now() - gaze.at < 80) place.value?.fling(gaze.vx, gaze.vy);
  gaze = null; looking.value = false;
}

let crownY: number | null = null, crownMoved = false;
function crownDown(event: PointerEvent) { crownY = event.clientY; crownMoved = false; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }
function crownMove(event: PointerEvent) {
  if (crownY === null) return;
  const by = (crownY - event.clientY) / 160;
  if (Math.abs(by) > 0.02) { crownMoved = true; turnCrown(by); crownY = event.clientY; }
}
function crownUp() { if (crownY !== null && !crownMoved) goHome(); crownY = null; }

function look(event: PointerEvent) {
  if (event.pointerType === 'touch') return;
  tilt.x = (event.clientX / view.w - 0.5) * 2; tilt.y = (event.clientY / view.h - 0.5) * 2;
  if (!gaze && !drag) place.value?.lean(tilt.x, tilt.y);
  visor.value?.style.setProperty('--gx', `${event.clientX}px`);
  visor.value?.style.setProperty('--gy', `${event.clientY}px`);
}
function measure() {
  const box = visor.value;
  if (!box || !box.clientWidth || !box.clientHeight) return;
  view.w = box.clientWidth; view.h = box.clientHeight;
  const fit = room();
  for (const win of windows.value) {
    win.w = Math.min(win.w, fit.w); win.h = Math.min(win.h, fit.h);
    win.x = Math.max(90 - win.w, Math.min(view.w - 90, win.x)); win.y = Math.max(TOP, Math.min(lowest(win), win.y));
  }
}
function finishHelp() {
  help.value = false;
  try { localStorage.setItem('lab-vision-welcomed', '1'); } catch { /* private mode: show it again next time */ }
}
onMounted(() => {
  // The dialog is still closed when this mounts, so size is taken from the element once it is shown.
  document.documentElement.classList.add('lab-vision-on');
  labDeviceBack.handler = back;
  watcher = new ResizeObserver(measure);
  if (visor.value) watcher.observe(visor.value);
  clockTimer = window.setInterval(() => { now.value = new Date(); }, 1000);
  window.addEventListener('keydown', pageKeys);
  let welcomed = false;
  try { welcomed = localStorage.getItem('lab-vision-welcomed') === '1'; } catch { /* ignore */ }
  bootTimer = window.setTimeout(() => { booting.value = false; if (!welcomed) help.value = true; }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2600);
});
onBeforeUnmount(() => {
  document.documentElement.classList.remove('lab-vision-on');
  if (labDeviceBack.handler === back) labDeviceBack.handler = null;
  watcher?.disconnect();
  window.removeEventListener('keydown', pageKeys);
  ambience.dispose();
  clearInterval(clockTimer); clearTimeout(bootTimer); clearTimeout(noteTimer); clearTimeout(flashTimer); cancelAnimationFrame(glide);
});
</script>

<template>
  <div ref="visor" class="visor" :class="{ booting, solid: reduceTransparency, compact, inside, looking }" :style="{ '--tx': tilt.x, '--ty': tilt.y }" @pointermove="look">
    <VisionEnvironment :id="environment" ref="place" :immersion="immersion" :dark="dark" class="place" />
    <i class="dimmer" :style="{ opacity: dim }" />
    <i class="gaze" />

    <div ref="space" class="space" :class="{ dimmed: (homeOpen && windows.length) || help }" @pointerdown="lookDown" @pointermove="lookMove" @pointerup="lookUp" @pointercancel="lookUp">
      <!-- Windows -->
      <TransitionGroup name="window">
        <section v-for="win in windows" :key="win.id" class="window" :class="{ front: front === win, behind: homeOpen }" :aria-label="NAMES[win.id]"
          :style="{ left: `${win.x}px`, top: `${win.y}px`, width: `${win.w}px`, height: `${win.h}px`, zIndex: win.z }" @pointerdown.capture="focus(win)">
          <div class="glass"><component :is="VIEWS[win.id]" :compact="compact" /></div>
          <div class="grip-row">
            <button class="shut" :aria-label="`Close ${NAMES[win.id]}`" :title="`Close ${NAMES[win.id]}`" @click="close(win.id)">
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.500 2.500 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" /></svg><span>Close</span>
            </button>
            <button class="bar" :aria-label="`Move ${NAMES[win.id]}. Double-click to fill the view.`" :title="`${NAMES[win.id]}: drag to move, double-click to fill the view`" @pointerdown="grab($event, win, 'move')" @dblclick="zoom(win)"><i /></button>
          </div>
          <button class="corner" :aria-label="`Resize ${NAMES[win.id]}`" title="Drag to resize" @pointerdown="grab($event, win, 'size')"><i /></button>
        </section>
      </TransitionGroup>

      <!-- Home View -->
      <Transition name="home">
        <div v-if="homeOpen && !booting" class="home" :style="{ '--s': homeScale }">
          <nav class="tabs" aria-label="Home View">
            <button :aria-pressed="tab === 'apps'" aria-label="Apps" @click="tab = 'apps'"><svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="7" cy="7" r="2.600" /><circle cx="17" cy="7" r="2.600" /><circle cx="7" cy="17" r="2.600" /><circle cx="17" cy="17" r="2.600" /><circle cx="12" cy="12" r="2.600" /></g></svg><span>Apps</span></button>
            <button :aria-pressed="tab === 'people'" aria-label="People" @click="tab = 'people'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.500" r="3.800" fill="currentColor" /><path d="M4.500 20a7.500 7.500 0 0 1 15 0Z" fill="currentColor" /></svg><span>People</span></button>
            <button :aria-pressed="tab === 'environments'" aria-label="Environments" @click="tab = 'environments'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6-10 4 6 2.500-3.500L21 19Z" fill="currentColor" /><circle cx="17" cy="6.500" r="2.200" fill="currentColor" /></svg><span>Environments</span></button>
          </nav>
          <div v-if="tab === 'apps'" class="honeycomb" @pointerdown="pageDown" @pointermove="pageMove" @pointerup="pageUp" @pointercancel="pageUp" @click.capture="pageClick" @wheel="pageWheel">
            <template v-if="compact">
              <button v-for="(cell, index) in ALL_CELLS" :key="cell.id" :style="{ '--i': index }" @click="open(cell.id)">
                <span class="orb"><VisionIcon :name="cell.id" /><i v-if="windows.some(win => win.id === cell.id)" class="running" /></span><span class="name">{{ cell.name }}</span>
              </button>
            </template>
            <Transition v-else :name="pageDirection > 0 ? 'page-next' : 'page-back'" mode="out-in">
              <div :key="page" class="page">
                <button v-for="(cell, index) in PAGES[page]" :key="cell.id" :style="{ '--x': `${cell.x}px`, '--y': `${cell.y}px`, '--i': index }" @click="open(cell.id)">
                  <span class="orb"><VisionIcon :name="cell.id" /><i v-if="windows.some(win => win.id === cell.id)" class="running" /></span><span class="name">{{ cell.name }}</span>
                </button>
              </div>
            </Transition>
          </div>
          <div v-else-if="tab === 'people'" class="shelf people">
            <button v-for="person in PEOPLE" :key="person.name" @click="open('messages')">
              <span class="persona" :style="{ background: person.tint }">{{ person.name[0] }}</span><b>{{ person.name }}</b><small>{{ person.line }}</small>
            </button>
          </div>
          <div v-else class="shelf places">
            <button v-for="spot in VISION_ENVIRONMENTS" :key="spot.id" :aria-pressed="spot.id === 'room' ? !inside : environment === spot.id && inside" @click="setEnvironment(spot.id)">
              <span class="thumbnail"><i v-if="spot.id === 'room'" class="room-thumb" /><img v-else :src="`/vision/env/${spot.id}-thumb.webp`" alt="" loading="lazy" draggable="false" /></span>
              <b>{{ spot.name }}</b><small>{{ spot.line }}</small>
            </button>
          </div>
          <nav v-if="tab === 'apps' && !compact && PAGES.length > 1" class="page-dots" aria-label="Home View pages">
            <button v-for="(_, index) in PAGES" :key="index" :aria-pressed="index === page" :aria-label="`Page ${index + 1}`" @click="showPage(index)"><i /></button>
          </nav>
        </div>
      </Transition>
    </div>

    <!-- Dock: Home, what is running, and the place you are in -->
    <nav v-if="!booting" class="dock" aria-label="Dock">
      <button class="dock-home" :aria-pressed="homeOpen && tab === 'apps'" aria-label="Home" @click="goHome('apps')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="6" cy="6" r="2.300" /><circle cx="12" cy="6" r="2.300" /><circle cx="18" cy="6" r="2.300" /><circle cx="6" cy="12" r="2.300" /><circle cx="12" cy="12" r="2.300" /><circle cx="18" cy="12" r="2.300" /><circle cx="6" cy="18" r="2.300" /><circle cx="12" cy="18" r="2.300" /><circle cx="18" cy="18" r="2.300" /></g></svg><span>Home</span>
      </button>
      <template v-if="windows.length">
        <i class="rule" />
        <div class="running-apps">
          <TransitionGroup name="chip">
            <span v-for="win in windows" :key="win.id" class="chip" :class="{ on: front === win && !homeOpen }">
              <button class="chip-open" :aria-label="`Show ${NAMES[win.id]}`" :title="NAMES[win.id]" @click="homeOpen = false; focus(win)"><VisionIcon :name="win.id" /></button>
              <button class="chip-shut" :aria-label="`Close ${NAMES[win.id]}`" :title="`Close ${NAMES[win.id]}`" @click="close(win.id)"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" /></svg></button>
            </span>
          </TransitionGroup>
        </div>
        <button v-if="windows.length > 1" class="dock-text" @click="closeAll">Close all</button>
      </template>
      <i class="rule" />
      <button class="dock-place" :aria-pressed="homeOpen && tab === 'environments'" :aria-label="`Environments. Now: ${inside ? here.name : 'My Room'}`" @click="goHome('environments')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6-10 4 6 2.500-3.500L21 19Z" fill="currentColor" /><circle cx="17" cy="6.500" r="2.200" fill="currentColor" /></svg>
        <span>{{ inside ? here.name : 'Environments' }}</span><em v-if="inside">{{ Math.round(immersion * 100) }}%</em>
      </button>
      <button class="dock-round" :aria-pressed="help" aria-label="How to use Vision Pro" title="How to use Vision Pro" @click="help = !help; control = false">?</button>
    </nav>

    <!-- Control Centre -->
    <button class="status" :aria-expanded="control" aria-label="Control Centre" @click="control = !control; help = false"><b>{{ time }}</b><i /></button>
    <Transition name="drop">
      <div v-if="control" class="control" role="dialog" aria-label="Control Centre">
        <header><b>{{ time }}</b><span>{{ day }}</span><em><svg viewBox="0 0 28 13" aria-hidden="true"><rect x=".5" y=".5" width="23.500" height="12" rx="3.800" fill="none" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="14" height="9" rx="2.400" fill="currentColor" /><path d="M25.500 4.300v4.400c.900-.300 1.500-1.200 1.500-2.200s-.600-1.900-1.500-2.200Z" fill="currentColor" opacity=".5" /></svg>71%</em></header>
        <div class="quick">
          <button @click="goHome('apps')">Home</button>
          <button @click="recenter">Recentre</button>
          <button @click="capture">Capture</button>
          <button :aria-pressed="sound" @click="toggleSound">Sound</button>
          <button :aria-pressed="dark" @click="dark = !dark">Dark</button>
          <button :aria-pressed="reduceTransparency" @click="reduceTransparency = !reduceTransparency">Solid glass</button>
          <button :disabled="!windows.length" @click="closeAll(); control = false">Close all</button>
          <button @click="help = true; control = false">Help</button>
        </div>
        <label class="slider"><span>Immersion</span><input type="range" min="0" max="1" step="0.01" :value="immersion" aria-label="Immersion" @input="turnCrown(Number(($event.target as HTMLInputElement).value) - immersion)" /><output>{{ Math.round(immersion * 100) }}%</output></label>
        <div class="mini-places">
          <button v-for="spot in VISION_ENVIRONMENTS" :key="spot.id" :aria-pressed="spot.id === 'room' ? !inside : environment === spot.id && inside" @click="setEnvironment(spot.id)">{{ spot.name }}</button>
        </div>
        <p>Guest User and Travel Mode are off. Nobody else is wearing this. Probably.</p>
      </div>
    </Transition>

    <!-- The headset's two physical controls -->
    <button class="crown" :aria-label="`Digital Crown: press for Home, drag or scroll for immersion (${Math.round(immersion * 100)}%)`" title="Digital Crown: press for Home, turn or scroll for immersion"
      @pointerdown="crownDown" @pointermove="crownMove" @pointerup="crownUp" @pointercancel="crownY = null" @wheel.prevent="turnCrown(-$event.deltaY / 900)"
      @keydown.up.prevent="turnCrown(0.08)" @keydown.down.prevent="turnCrown(-0.08)" @keydown.enter.prevent="goHome()">
      <i :style="{ transform: `rotate(${immersion * 300}deg)` }" /><span><b>Digital Crown</b><small>{{ immersion > 0.02 ? `Immersion ${Math.round(immersion * 100)}%` : 'Press: Home · Turn: Immersion' }}</small></span>
    </button>
    <button class="top-button" aria-label="Top button: capture" title="Top button: capture" @click="capture"><i /><span>Capture</span></button>

    <!-- How to use it -->
    <Transition name="drop">
      <section v-if="help" class="help" role="dialog" aria-label="How to use Vision Pro">
        <h2>Welcome to Vision Pro</h2>
        <p class="lede">There are no hands to pinch with here, so your pointer does the looking and the tapping.</p>
        <ol>
          <li v-for="tip in TIPS" :key="tip.key"><i :class="`tip-${tip.key}`" /><span><b>{{ tip.title }}</b>{{ tip.text }}</span></li>
        </ol>
        <button class="go" @click="finishHelp">Got it</button>
      </section>
    </Transition>

    <Transition name="drop"><p v-if="note" class="toast" role="status">{{ note }}</p></Transition>
    <i class="shutter" :class="{ on: flash }" />

    <!-- Putting it on -->
    <Transition name="boot">
      <div v-if="booting" class="boot" aria-label="Starting up"><i class="lens left" /><i class="lens right" /><div class="optic"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="30" /><circle cx="40" cy="40" r="12" /></svg><span>Optic ID</span></div></div>
    </Transition>
  </div>
</template>

<style scoped>
.visor{position:relative;width:100vw;height:var(--visual-height,100dvh);overflow:hidden;color:rgb(255 255 255 / .96);touch-action:none;user-select:none;-webkit-user-select:none;
  font:400 17px/1.35 -apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:-.015em;-webkit-font-smoothing:antialiased;
  background:radial-gradient(ellipse at 50% 46%,transparent 52%,rgb(0 0 0 / .5) 100%)}
/* The site sets its own typeface on every element; visionOS keeps San Francisco. */
.visor :deep(*){font-family:inherit}
.visor :deep(button){-webkit-tap-highlight-color:transparent}
.visor :deep(input),.visor :deep(textarea){user-select:text;-webkit-user-select:text}
button{border:0;background:none;color:inherit;font:inherit;letter-spacing:inherit;cursor:pointer;padding:0}
button:focus-visible,input:focus-visible{outline:2px solid #fff;outline-offset:3px}
.dimmer{position:absolute;inset:0;background:#000;pointer-events:none;transition:opacity .8s ease}
/* Where the pointer is, the glass catches a little light: the stand-in for where your eyes rest.
   No blend mode here: one would isolate the whole dialog and stop every window from blurring the room behind it. */
.gaze{position:absolute;left:0;top:0;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;pointer-events:none;z-index:4;
  background:radial-gradient(circle,rgb(255 255 255 / .055),transparent 62%);transform:translate(var(--gx,-400px),var(--gy,-400px))}
.space{position:absolute;inset:0;perspective:1600px}
.inside .space{cursor:grab}.looking .space{cursor:grabbing}
.space::before{content:'';position:absolute;inset:0;background:rgb(0 0 0 / .34);opacity:0;pointer-events:none;transition:opacity .35s;z-index:4000}
.space.dimmed::before{opacity:1}

/* Home View */
.home{position:absolute;left:50%;top:calc((100% - 96px) / 2 + 14px);width:740px;height:430px;margin:-215px 0 0 -370px;z-index:5000;transform:scale(var(--s)) rotateY(calc(var(--tx) * .5deg)) rotateX(calc(var(--ty) * -.4deg));transform-style:flat;transition:transform .25s ease-out}
.tabs{position:absolute;left:-104px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:40px;
  background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .05)),rgb(45 48 54 / .45);backdrop-filter:blur(36px) saturate(125%);-webkit-backdrop-filter:blur(36px) saturate(125%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 20px 50px rgb(0 0 0 / .25)}
.tabs button{position:relative;width:56px;height:56px;border-radius:50%;display:grid;place-items:center;color:rgb(255 255 255 / .7);transition:background .2s,color .2s,transform .2s}
.tabs button:hover{background:rgb(255 255 255 / .14);transform:scale(1.06)}.tabs button[aria-pressed=true]{background:rgb(255 255 255 / .24);color:#fff}
.tabs svg{width:26px;height:26px}
.tabs span{position:absolute;left:68px;top:50%;transform:translateY(-50%);padding:6px 12px;border-radius:14px;background:rgb(40 42 48 / .8);font-size:14px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .2s}.tabs button:hover span,.tabs button:focus-visible span{opacity:1}
.honeycomb button{position:absolute;left:50%;top:50%;width:132px;margin:-64px 0 0 -66px;display:flex;flex-direction:column;align-items:center;gap:9px;transform:translate(var(--x),var(--y));animation:bloom .7s cubic-bezier(.2,.9,.3,1.150) both;animation-delay:calc(var(--i) * 26ms)}
/* Pages slide sideways and the icons bloom in again, like turning a page of the real Home View. */
/* The page sits in the same plane as its icons inside the tilting 3D Home View; it must never win the hit test. */
.page{position:absolute;inset:0;pointer-events:none}.page button{pointer-events:auto}
.page-next-enter-active,.page-back-enter-active,.page-next-leave-active,.page-back-leave-active{transition:opacity .28s ease,transform .38s cubic-bezier(.2,.8,.2,1)}
.page-next-enter-from,.page-back-leave-to{opacity:0;transform:translateX(140px)}
.page-next-leave-to,.page-back-enter-from{opacity:0;transform:translateX(-140px)}
.page-dots{position:absolute;left:50%;top:calc(50% + 236px);transform:translateX(-50%);display:flex;gap:4px;padding:4px 6px;border-radius:14px;background:rgb(60 62 70 / .35);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
.page-dots button{display:grid;place-items:center;width:22px;height:22px;border-radius:11px}
.page-dots i{width:8px;height:8px;border-radius:50%;background:rgb(255 255 255 / .4);transition:background .2s,transform .2s}
.page-dots button[aria-pressed=true] i{background:#fff;transform:scale(1.15)}
.page-dots button:hover i{background:rgb(255 255 255 / .75)}
.orb{position:relative;display:block;width:92px;transition:transform .25s cubic-bezier(.2,.9,.3,1.300),filter .25s}
.honeycomb button:hover .orb,.honeycomb button:focus-visible .orb{transform:scale(1.1);filter:brightness(1.08) drop-shadow(0 0 18px rgb(255 255 255 / .35))}
.honeycomb button:active .orb{transform:scale(.96)}
.running{position:absolute;left:50%;bottom:-7px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff}
.name{font-size:16px;font-weight:500;text-shadow:0 1px 8px rgb(0 0 0 / .65);white-space:nowrap}
.shelf{position:absolute;inset:0;display:grid;gap:22px;align-content:center;animation:fade .4s both}
.people{grid-template-columns:repeat(3,1fr)}.places{grid-template-columns:repeat(5,1fr);gap:6px 8px;align-content:start;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding:2px;touch-action:pan-y}.places::-webkit-scrollbar{display:none}
.shelf button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 10px;border-radius:30px;transition:background .2s,transform .2s}.shelf button:hover{background:rgb(255 255 255 / .12);transform:scale(1.04)}
.places button{padding:6px 6px 8px;gap:2px;border-radius:22px}
.shelf b{font-size:17px;font-weight:600;text-shadow:0 1px 8px rgb(0 0 0 / .5)}.shelf small{font-size:14px;color:rgb(255 255 255 / .7)}
.places b{font-size:14px;margin-top:5px;white-space:nowrap}.places small{font-size:11.500px;line-height:1.25;text-align:center;text-shadow:0 1px 6px rgb(0 0 0 / .6);min-height:29px}
.persona{width:128px;height:128px;border-radius:50%;display:grid;place-items:center;font-size:54px;font-weight:700;box-shadow:inset 0 2px 2px rgb(255 255 255 / .5),0 14px 34px rgb(0 0 0 / .35);margin-bottom:8px}
.thumbnail{position:relative;display:block;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#11141c;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .22),0 10px 24px rgb(0 0 0 / .3)}
.thumbnail img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.places button[aria-pressed=true] .thumbnail{box-shadow:0 0 0 3px #fff,0 12px 28px rgb(0 0 0 / .3)}
.room-thumb{position:absolute;inset:0;background:linear-gradient(135deg,rgb(255 255 255 / .28),rgb(255 255 255 / .06));backdrop-filter:blur(3px)}
.home-enter-active,.home-leave-active{transition:opacity .35s,transform .45s cubic-bezier(.2,.8,.2,1)}.home-enter-from,.home-leave-to{opacity:0;transform:scale(calc(var(--s) * .82))}

/* Windows */
.window{position:absolute;transform:rotateY(calc(var(--tx) * .4deg)) rotateX(calc(var(--ty) * -.3deg));transition:transform .25s ease-out,filter .3s,opacity .3s}
.window:not(.front) .glass{filter:brightness(.82)}
.window.behind{pointer-events:none}
.glass{position:absolute;inset:0;border-radius:40px;overflow:hidden;border:1px solid rgb(255 255 255 / .2);transition:filter .3s;
  background:linear-gradient(135deg,rgb(255 255 255 / .16),rgb(255 255 255 / .035)),rgb(45 48 54 / .5);backdrop-filter:blur(36px) saturate(125%);-webkit-backdrop-filter:blur(36px) saturate(125%);
  box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),0 24px 70px rgb(0 0 0 / .3)}
.inside .glass{background:linear-gradient(135deg,rgb(255 255 255 / .14),rgb(255 255 255 / .03)),rgb(38 41 48 / .62)}
.solid .glass,.solid .tabs,.solid .control,.solid .dock,.solid .help{background:#2b2d33;backdrop-filter:none;-webkit-backdrop-filter:none}
/* The window bar: a close button that is always in view, and the bar you move the window by. */
.grip-row{position:absolute;left:0;right:0;top:calc(100% + 8px);display:flex;justify-content:center;align-items:center;gap:10px}
.shut{height:34px;min-width:34px;padding:0 10px;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:0;font-size:13px;font-weight:600;
  background:rgb(88 90 98 / .72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .22),0 6px 16px rgb(0 0 0 / .3);transition:background .2s,transform .2s,gap .2s}
.shut svg{width:13px;height:13px;flex:none}
.shut span{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .25s ease}
.shut:hover,.shut:focus-visible{background:rgb(255 69 58 / .92);gap:6px}.shut:hover span,.shut:focus-visible span{max-width:44px}
.shut:active{transform:scale(.94)}
.bar{width:150px;height:34px;display:grid;place-items:center;cursor:grab;touch-action:none}.bar:active{cursor:grabbing}
.bar i{width:112px;height:9px;border-radius:5px;background:rgb(255 255 255 / .6);box-shadow:0 2px 10px rgb(0 0 0 / .3);transition:background .2s,transform .2s}.bar:hover i{background:#fff;transform:scaleX(1.050)}
.window:not(.front) .bar i{background:rgb(255 255 255 / .38)}
.corner{position:absolute;right:-16px;bottom:-16px;width:54px;height:54px;cursor:nwse-resize;touch-action:none;opacity:0;transition:opacity .2s}
.window:hover .corner,.corner:focus-visible{opacity:1}
.corner i{position:absolute;right:8px;bottom:8px;width:26px;height:26px;border:4px solid rgb(255 255 255 / .8);border-left-color:transparent;border-top-color:transparent;border-radius:0 0 22px 0}
.window-enter-active{transition:opacity .35s,transform .5s cubic-bezier(.2,.9,.25,1)}.window-leave-active{transition:opacity .25s,transform .3s}
.window-enter-from{opacity:0;transform:translateZ(-260px) scale(.86)}.window-leave-to{opacity:0;transform:scale(.92)}

/* Dock */
.dock{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:6000;display:flex;align-items:center;gap:8px;max-width:calc(100% - 16px);padding:8px;border-radius:36px;
  background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .05)),rgb(45 48 54 / .55);backdrop-filter:blur(36px) saturate(125%);-webkit-backdrop-filter:blur(36px) saturate(125%);
  box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 20px 50px rgb(0 0 0 / .35);animation:rise .6s .1s cubic-bezier(.2,.9,.3,1) both}
.dock>button{flex:none;height:56px;border-radius:28px;display:flex;align-items:center;gap:9px;padding:0 18px 0 14px;font-size:15px;font-weight:600;transition:background .2s,transform .2s,color .2s}
.dock>button:hover{background:rgb(255 255 255 / .16)}.dock>button:active{transform:scale(.96)}
.dock>button[aria-pressed=true]{background:rgb(255 255 255 / .9);color:#16171a}
.dock svg{width:24px;height:24px;flex:none}
.dock-place em{font-style:normal;font-weight:500;opacity:.65;font-variant-numeric:tabular-nums}
.dock-place span{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dock>.dock-round{width:56px;padding:0;justify-content:center;font-size:20px}
.dock>.dock-text{padding:0 16px;font-size:14px;color:rgb(255 255 255 / .8)}
.rule{flex:none;width:1px;height:30px;background:rgb(255 255 255 / .2)}
.running-apps{display:flex;gap:6px;min-width:0;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;padding:0 2px}.running-apps::-webkit-scrollbar{display:none}
.chip{position:relative;flex:none;width:52px;height:56px;display:grid;place-items:center}
.chip-open{width:46px;height:46px;border-radius:50%;transition:transform .2s cubic-bezier(.2,.9,.3,1.300)}.chip-open:hover{transform:scale(1.1)}
.chip::after{content:'';position:absolute;left:50%;bottom:0;width:5px;height:5px;margin-left:-2.500px;border-radius:50%;background:rgb(255 255 255 / .45);transition:background .2s,width .2s,margin .2s}
.chip.on::after{background:#fff;width:14px;margin-left:-7px}
.chip-shut{position:absolute;right:-3px;top:-1px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgb(60 62 70 / .95);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .3);opacity:0;transform:scale(.6);transition:opacity .2s,transform .2s,background .2s}
.chip-shut svg{width:10px;height:10px}
.chip:hover .chip-shut,.chip-shut:focus-visible{opacity:1;transform:scale(1)}.chip-shut:hover{background:#ff453a}
.chip-enter-active,.chip-leave-active{transition:opacity .25s,transform .3s}.chip-enter-from,.chip-leave-to{opacity:0;transform:scale(.4)}

/* Control Centre */
.status{position:absolute;left:50%;top:8px;transform:translateX(-50%);height:40px;padding:0 14px 0 16px;border-radius:20px;display:flex;align-items:center;gap:10px;z-index:7000;font-size:15px;
  background:rgb(60 62 70 / .5);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .2);transition:background .2s,transform .2s}
.status:hover{background:rgb(100 102 110 / .65)}.status b{font-weight:600;font-variant-numeric:tabular-nums}
.status i{width:8px;height:8px;border-right:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg) translate(-2px,-2px);transition:transform .25s}.status[aria-expanded=true] i{transform:rotate(-135deg) translate(-2px,-2px)}
.control{position:absolute;left:50%;top:56px;width:min(450px,calc(100vw - 20px));margin-left:calc(min(450px,100vw - 20px) / -2);padding:22px;border-radius:40px;z-index:7000;max-height:calc(100% - 170px);overflow-y:auto;scrollbar-width:none;touch-action:pan-y;
  background:linear-gradient(135deg,rgb(255 255 255 / .18),rgb(255 255 255 / .05)),rgb(45 48 54 / .7);backdrop-filter:blur(40px) saturate(130%);-webkit-backdrop-filter:blur(40px) saturate(130%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 30px 80px rgb(0 0 0 / .4)}
.control header{display:grid;grid-template-columns:1fr auto;align-items:end;margin-bottom:16px}.control header b{font-size:44px;line-height:1;font-weight:600;letter-spacing:-.03em}
.control header span{grid-row:2;font-size:15px;color:rgb(255 255 255 / .65)}.control header em{grid-row:1/3;font-style:normal;display:flex;align-items:center;gap:7px;font-size:15px}.control header svg{width:28px}
.quick{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.quick button,.mini-places button{min-height:54px;border-radius:22px;font-size:14px;font-weight:500;background:rgb(255 255 255 / .1);transition:background .2s,transform .2s}
.quick button:hover,.mini-places button:hover{background:rgb(255 255 255 / .2);transform:scale(1.03)}.quick button[aria-pressed=true],.mini-places button[aria-pressed=true]{background:#fff;color:#111}
.quick button:disabled{opacity:.35;pointer-events:none}
.slider{display:flex;align-items:center;gap:14px;margin:16px 0 12px;font-size:15px}.slider input{flex:1;height:44px;accent-color:#fff}.slider output{width:44px;text-align:right;font-variant-numeric:tabular-nums;color:rgb(255 255 255 / .7)}
.mini-places{display:flex;flex-wrap:wrap;gap:7px}.mini-places button{min-height:42px;padding:0 15px}
.control p{margin:14px 0 0;font-size:13px;color:rgb(255 255 255 / .55)}

/* Hardware */
.crown,.top-button{position:absolute;top:6px;z-index:7001;display:flex;align-items:center;gap:10px;min-height:48px;padding:0 14px 0 6px;font-size:13px;color:rgb(255 255 255 / .9);border-radius:26px;transition:background .2s;
  background:rgb(60 62 70 / .42);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .16)}
.crown:hover,.top-button:hover{background:rgb(100 102 110 / .6)}
.crown{left:10px;cursor:ns-resize;touch-action:none;text-align:left}.top-button{left:246px;padding-left:10px}
.crown span{display:flex;flex-direction:column;line-height:1.2}.crown b{font-weight:600;color:#fff}.crown small{font-size:11.500px;color:rgb(255 255 255 / .62)}
.crown i{flex:none;width:38px;height:38px;border-radius:50%;background:repeating-conic-gradient(#d4d6da 0 6deg,#8b8e96 6deg 12deg);box-shadow:inset 0 0 0 8px #c3c5ca,inset 0 0 0 9px #6f727a,0 3px 10px rgb(0 0 0 / .5);transition:box-shadow .2s}
.crown:hover i{box-shadow:inset 0 0 0 8px #e6e7ea,inset 0 0 0 9px #6f727a,0 0 18px rgb(255 255 255 / .4)}
.top-button i{width:42px;height:16px;border-radius:8px;background:linear-gradient(180deg,#e2e3e6,#9a9da5);box-shadow:inset 0 1px 0 #fff,0 3px 10px rgb(0 0 0 / .5);transition:transform .15s}.top-button:active i{transform:translateY(2px) scaleY(.85)}

/* Help */
.help{position:absolute;left:50%;top:50%;width:min(520px,calc(100vw - 24px));max-height:calc(100% - 150px);overflow-y:auto;scrollbar-width:none;touch-action:pan-y;transform:translate(-50%,-54%);z-index:8000;padding:30px 30px 26px;border-radius:44px;
  background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .05)),rgb(40 43 50 / .9);backdrop-filter:blur(44px) saturate(130%);-webkit-backdrop-filter:blur(44px) saturate(130%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 40px 110px rgb(0 0 0 / .5)}
.help h2{margin:0;font-size:28px;font-weight:700;letter-spacing:-.03em}.lede{margin:6px 0 18px;font-size:15px;color:rgb(255 255 255 / .7)}
.help ol{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.help li{display:flex;gap:14px;align-items:center;padding:12px 14px;border-radius:24px;background:rgb(255 255 255 / .08)}
.help li span{font-size:14px;line-height:1.4;color:rgb(255 255 255 / .75)}.help li b{display:block;font-size:16px;color:#fff;font-weight:600}
.help li i{flex:none;position:relative;width:52px;height:52px;border-radius:50%;background:rgb(255 255 255 / .14);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .2)}
.help li i::before,.help li i::after{content:'';position:absolute}
.help .tip-open::before{inset:13px;border-radius:50%;background:linear-gradient(180deg,#64d2ff,#0a84ff);animation:tap 2.200s ease-in-out infinite}
.help .tip-move::before{left:10px;right:10px;top:12px;height:18px;border-radius:7px;border:2px solid #fff;animation:slide 2.600s ease-in-out infinite}
.help .tip-move::after{left:17px;right:17px;top:37px;height:4px;border-radius:2px;background:#fff;animation:slide 2.600s ease-in-out infinite}
.help .tip-home::before{inset:15px;background:radial-gradient(circle,#fff 2.600px,transparent 3.200px) 0 0/7.330px 7.330px}
.help .tip-place::before{left:11px;right:11px;bottom:15px;height:16px;background:#fff;clip-path:polygon(0 100%,34% 10%,54% 62%,68% 36%,100% 100%)}
.help .tip-place::after{right:14px;top:13px;width:8px;height:8px;border-radius:50%;background:#ffd60a}
.go{display:block;width:100%;margin-top:18px;height:54px;border-radius:27px;background:#fff;color:#111;font-size:17px;font-weight:600;transition:transform .2s,background .2s}.go:hover{background:#e9e9ee}.go:active{transform:scale(.98)}

.toast{position:absolute;left:50%;top:auto;bottom:calc(96px + 62px);transform:translateX(-50%);margin:0;max-width:calc(100vw - 24px);padding:13px 22px;border-radius:26px;z-index:7500;font-size:15px;text-align:center;pointer-events:none;
  background:rgb(50 52 60 / .78);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);box-shadow:inset 0 1px 0 rgb(255 255 255 / .28),0 16px 40px rgb(0 0 0 / .35)}
.drop-enter-active,.drop-leave-active{transition:opacity .25s,translate .35s cubic-bezier(.2,.9,.2,1)}.drop-enter-from,.drop-leave-to{opacity:0;translate:0 -18px}
.shutter{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:9000;transition:opacity .35s}.shutter.on{opacity:.75;transition:none}

/* Start-up: two lenses close in, Optic ID, then the room. */
.boot{position:absolute;inset:0;z-index:9999;background:#000;display:grid;place-items:center}
.lens{position:absolute;top:50%;width:46vmin;height:46vmin;margin-top:-23vmin;border-radius:46%;background:radial-gradient(circle at 50% 50%,#1b2233,#05060a 70%);box-shadow:inset 0 0 60px #000,0 0 0 2px #14161c;animation:lens 1.300s cubic-bezier(.3,.7,.2,1) both}
.lens.left{left:50%;margin-left:-48vmin;--from:-30vmin}.lens.right{left:50%;margin-left:2vmin;--from:30vmin}
.optic{display:flex;flex-direction:column;align-items:center;gap:12px;font-size:15px;color:rgb(255 255 255 / .8);animation:fade .5s 1.100s both}
.optic svg{width:74px;height:74px;fill:none;stroke:#fff;stroke-width:2.500}.optic circle:first-child{stroke-dasharray:190;stroke-dashoffset:190;animation:scan 1s 1.200s ease-out forwards}.optic circle:last-child{opacity:.6}
.boot-leave-active{transition:opacity .7s}.boot-leave-to{opacity:0}
@keyframes lens{from{opacity:0;transform:translateX(var(--from)) scale(1.5)}}
@keyframes scan{to{stroke-dashoffset:0}}
@keyframes fade{from{opacity:0}}
@keyframes rise{from{opacity:0;transform:translate(-50%,30px)}}
@keyframes bloom{from{opacity:0;transform:translate(calc(var(--x) * .4),calc(var(--y) * .4)) scale(.4)}}
@keyframes tap{0%,100%{transform:scale(1)}45%{transform:scale(.8)}60%{transform:scale(1.1)}}
@keyframes slide{0%,100%{transform:translateX(-4px)}50%{transform:translateX(4px)}}

/* Phones and narrow windows */
/* Phones: no scaled honeycomb. The Home View fills the space between the status row and the dock,
   apps sit in a scrolling four-column grid at real size, and the tab bar rests along the bottom. */
.compact .home{left:0;right:0;top:62px;bottom:84px;width:auto;height:auto;margin:0;transform:none}
.compact .home-enter-from,.compact .home-leave-to{transform:translateY(16px)}
.compact .honeycomb,.compact .shelf{position:absolute;inset:0 0 72px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;touch-action:pan-y}
.compact .honeycomb::-webkit-scrollbar,.compact .shelf::-webkit-scrollbar{display:none}
.compact .honeycomb{display:grid;grid-template-columns:repeat(4,1fr);align-content:start;gap:20px 4px;padding:18px 12px 24px}
.compact .honeycomb button{position:static;width:auto;margin:0;transform:none;gap:7px;animation:fade .45s both;animation-delay:calc(var(--i) * 18ms)}
.compact .orb{width:62px}
.compact .name{font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;text-align:center}
.compact .shelf{padding:14px 12px 24px;align-content:start}
.compact .people{grid-template-columns:repeat(3,1fr);gap:10px}.compact .persona{width:84px;height:84px;font-size:36px}
.compact .places{grid-template-columns:repeat(2,1fr);gap:8px}
.compact .places b{font-size:14px}.compact .places small{font-size:12px}
.compact .tabs{left:50%;top:auto;bottom:4px;transform:translateX(-50%);flex-direction:row;padding:6px;gap:4px}
.compact .tabs button{width:52px;height:52px}
.compact .tabs span{display:none}
.compact .crown span,.compact .top-button span{display:none}.compact .crown{padding-right:6px}.compact .top-button{left:66px;padding-right:10px}
.compact .glass{border-radius:30px}.compact .corner{display:none}
.compact .dock{bottom:10px;gap:4px;padding:6px}
.compact .dock>button{height:50px;padding:0 12px;gap:0}.compact .dock>button span,.compact .dock-place em{display:none}
.compact .dock>.dock-round{width:50px}.compact .dock>.dock-text{display:none}
.compact .chip{width:46px;height:50px}.compact .chip-open{width:40px;height:40px}
/* No hover on touch screens, so the small close buttons stay in view. */
@media(hover:none){.chip-shut{opacity:1;transform:scale(1)}.corner{opacity:1}.gaze{display:none}}
@media(prefers-reduced-motion:reduce){.home,.window,.orb,.dimmer,.dock{transition:none;animation:none}.honeycomb button,.shelf,.lens,.optic,.help li i::before,.help li i::after{animation:none}.optic circle:first-child{animation:none;stroke-dashoffset:0}
  .home-enter-active,.home-leave-active,.window-enter-active,.window-leave-active,.drop-enter-active,.drop-leave-active{transition:opacity .15s}.home-enter-from,.home-leave-to,.window-enter-from,.window-leave-to{transform:none}}
</style>

<style src="./vision/kit/kit.css"></style>

<style>
/* While the headset is on, the site's own menus step out of view: only the room and visionOS remain. */
.lab-vision-on .lab-chrome{opacity:0;pointer-events:none;transition:opacity .4s}
</style>
