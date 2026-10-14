<script setup lang="ts">
import type { Component } from 'vue';
import { labDeviceBack } from '~/common/models/lab-device.model';
import { VISION, VISION_APPS, VISION_ENVIRONMENTS, type VisionAppId, type VisionEnvironmentId } from './vision/vision';
import { createAmbience } from './vision/ambience';
import VisionEnvironment from './vision/VisionEnvironment.vue';
import VisionIcon from './vision/VisionIcon.vue';
import SpatialWidgets from './vision/SpatialWidgets.vue';
import JarvisOrb from './vision/jarvis/JarvisOrb.vue';
import SpatialSpace from './vision/space/SpatialSpace.vue';
import { useJarvis } from './vision/jarvis/useJarvis';
import type { JarvisAction } from './vision/jarvis/brain';
import Spotlight, { type SpotlightResult } from './vision/Spotlight.vue';

type Win = { id: VisionAppId; x: number; y: number; w: number; h: number; z: number; locked?: boolean; full?: { x: number; y: number; w: number; h: number } };
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
  gravity: defineAsyncComponent(() => import('./vision/apps/Gravity.vue')),
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
  { key: 'siri', title: 'Search, widgets and JARVIS', text: 'Press Ctrl + Space or / to search anything. Pin widgets from Control Center. Tap the gold orb, press Alt + Space or J, or hold the Digital Crown, for JARVIS.' },
];
/** Space kept clear at the bottom for the dock, so a window's bar never hides behind it. */
const DOCK = 96;
// Windows live below the row of hardware pills and the clock, never underneath them.
const TOP = 72;

useHead({ link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Rajdhani:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap' }] });

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
// Control Center switches. Most are the headset's own modes; Focus also holds back notification banners.
const focusMode = ref(false);
const guest = ref(false);
const travel = ref(false);
const wifi = ref(true);
const bluetooth = ref(true);
const mirroring = ref(false);
const volume = ref(0.7);
const help = ref(false);
// Just the view: every window, the Home View and the chrome step aside so only the place is left.
const viewOnly = ref(false);
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
const gliding = ref(false);
const scanning = ref<VisionAppId | null>(null);
let glideTimer = 0, scanTimer = 0;
function glideWindows() { gliding.value = true; clearTimeout(glideTimer); glideTimer = window.setTimeout(() => { gliding.value = false; }, 760); }
/** Tile every unlocked window into a tidy grid, each keeping its own proportions. */
function arrange() {
  const list = windows.value.filter(win => !win.locked);
  if (!list.length) return;
  glideWindows();
  const fit = room(), n = list.length, cols = n === 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 18;
  const cellW = (fit.w - gap * (cols - 1)) / cols, cellH = (fit.h - gap * (rows - 1)) / rows;
  list.forEach((win, index) => {
    const [aw, ah] = VISION_APPS.find(item => item.id === win.id)!.size;
    const scale = Math.min(1, cellW / aw, cellH / ah);
    win.full = undefined;
    win.w = Math.round(Math.max(Math.min(320, cellW), aw * scale)); win.h = Math.round(Math.max(Math.min(260, cellH), ah * scale));
    const col = index % cols, row = Math.floor(index / cols);
    win.x = Math.round((view.w - fit.w) / 2 + col * (cellW + gap) + (cellW - win.w) / 2);
    win.y = Math.round(TOP + row * (cellH + gap) + (cellH - win.h) / 2);
  });
}
function room() { return { w: view.w - (compact.value ? 12 : 56), h: view.h - TOP - DOCK - 58 }; }
function open(id: VisionAppId) {
  const existing = windows.value.find(item => item.id === id);
  homeOpen.value = false; control.value = false; help.value = false;
  if (existing) { focus(existing); return; }
  if (!jarvisActing) jarvis.remark('app', id);
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
  if (viewOnly.value) { setViewOnly(false); return; }
  control.value = false; help.value = false;
  if (homeOpen.value && tab.value === which && windows.value.length) { homeOpen.value = false; return; }
  tab.value = which; homeOpen.value = true;
}
/** Escape: step back one level. Returns false when there is nothing left to step back from. */
function back() {
  if (viewOnly.value) { setViewOnly(false); return true; }
  if (spotlight.value?.open) { spotlight.value.hide(); return true; }
  if (help.value) { help.value = false; return true; }
  if (control.value) { control.value = false; return true; }
  if (homeOpen.value && windows.value.length) { homeOpen.value = false; return true; }
  const win = front.value;
  if (win) { close(win.id); return true; }
  if (!homeOpen.value) { homeOpen.value = true; return true; }
  if (tab.value !== 'apps') { tab.value = 'apps'; return true; }
  return false;
}
/* Notifications arrive as compact glass banners at the top of the view and expand when you look at them. */
type Notice = { id: number; app: VisionAppId; title: string; body: string; at: Date };
const notices = ref<Notice[]>([]);
const history = ref<Notice[]>([]);
let noticeId = 0;
const noticeTimers = new Map<number, number>();
function notify(app: VisionAppId, title: string, body: string) {
  const item = { id: ++noticeId, app, title, body, at: new Date() };
  // Focus keeps the history but holds the banner back.
  if (focusMode.value) { history.value = [item, ...history.value].slice(0, 20); return; }
  notices.value = [item, ...notices.value].slice(0, 2);
  history.value = [item, ...history.value].slice(0, 20);
  noticeTimers.set(item.id, window.setTimeout(() => dismissNotice(item.id), 7000));
}
function dismissNotice(id: number) {
  clearTimeout(noticeTimers.get(id));
  noticeTimers.delete(id);
  notices.value = notices.value.filter(item => item.id !== id);
}
function holdNotice(id: number, on: boolean) {
  clearTimeout(noticeTimers.get(id));
  if (!on) noticeTimers.set(id, window.setTimeout(() => dismissNotice(id), 3500));
}
function openNotice(item: Notice) { dismissNotice(item.id); open(item.app); }
// A few gentle, fictional messages turn up while someone is exploring, the way a real headset gets interrupted.
const SCRIPT: [number, VisionAppId, string, string][] = [
  [45, 'messages', 'Amma', 'Are you wearing that thing again? Blink twice if you have eaten.'],
  [140, 'clock', 'Timer', 'Chai is ready. It has been ready. It is now cold.'],
  [260, 'arcade', 'Arcade', 'Pinball misses you. Space Cadet is still awaiting deployment.'],
  [420, 'weather', 'Weather', 'Demo forecast: 100% chance of staying in here a bit longer.'],
];
let scriptTimers: number[] = [];
function toast(text: string) {
  // JARVIS says what he is doing; a toast repeating it would be noise.
  if (jarvisActing) return;
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
let viewHinted = false;
function setViewOnly(on: boolean) {
  if (viewOnly.value === on) return;
  viewOnly.value = on;
  if (on && !jarvisActing) jarvis.remark('view');
  document.documentElement.classList.toggle('lab-vision-view', on);
  if (!on) return;
  control.value = false; help.value = false; closeMenu.value = null; spotlight.value?.hide();
  if (!viewHinted) { viewHinted = true; toast('Just the view. Tap the bar below, or press V, to bring everything back.'); }
}
/** Picking a place from the Home View steps into it, the way the headset does, instead of leaving the grid in the way. */
function pickPlace(id: VisionEnvironmentId) {
  setEnvironment(id);
  if (id !== 'room' && windows.value.length === 0) window.setTimeout(() => { if (environment.value === id) homeOpen.value = false; }, 420);
  else if (id !== 'room') homeOpen.value = false;
}
function setEnvironment(id: VisionEnvironmentId) {
  if (!jarvisActing) jarvis.remark('place', id);
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
function toggleMode(which: 'focus' | 'guest' | 'travel' | 'wifi' | 'bluetooth' | 'mirroring') {
  const switches = { focus: focusMode, guest, travel, wifi, bluetooth, mirroring };
  const flag = switches[which];
  flag.value = !flag.value;
  const lines: Record<typeof which, [string, string]> = {
    focus: ['Focus on. Banners will wait quietly.', 'Focus off.'],
    guest: ['Guest User on. Your stuff is politely hidden.', 'Guest User off. Welcome back.'],
    travel: ['Travel Mode on. The view will hold still on bumpy rides.', 'Travel Mode off.'],
    wifi: ['Wi-Fi on.', 'Wi-Fi off. Bold choice for a website.'],
    bluetooth: ['Bluetooth on.', 'Bluetooth off.'],
    mirroring: ['Mirroring to the room TV. Everyone can see your tabs now.', 'Mirroring stopped.'],
  };
  toast(lines[which][flag.value ? 0 : 1]);
}
function toggleSound() { sound.value = !sound.value; toast(sound.value ? 'Ambient sound on.' : 'Ambient sound off.'); }
watch(environment, value => { if (value === 'room') glideTo(0); else { lastPlace = value; if (immersion.value < 0.05) glideTo(1); } });
// The ambience follows the place and fades with immersion.
watch([sound, environment, () => Math.round(immersion.value * 10), () => Math.round(volume.value * 10)], () => {
  ambience.set(sound.value && inside.value ? here.value.sound : 'none', immersion.value * volume.value);
});
provide(VISION, { now, environment, immersion, dim, reduceTransparency, dark, sound, open, close, toast });

function capture() {
  flash.value = true;
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => { flash.value = false; }, 220);
  toast('Captured. Saved to Photos, in spirit.');
}
function recenter() {
  glideWindows();
  const fit = room();
  windows.value.forEach((win, index) => { if (win.locked) return; win.full = undefined; win.w = Math.min(win.w, fit.w); win.h = Math.min(win.h, fit.h); win.x = Math.max(6, (view.w - win.w) / 2 + (index % 4) * 28); win.y = Math.max(TOP, TOP + (fit.h - win.h) / 2 + (index % 4) * 18); });
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
let drag: { win: Win; mode: 'move' | 'size' | 'size-left'; x: number; y: number; left: number; top: number; w: number; h: number } | null = null;
function grab(event: PointerEvent, win: Win, mode: 'move' | 'size' | 'size-left') {
  focus(win);
  // A locked window stays where it was put; its lock is the only thing that moves it.
  if (win.locked && mode === 'move') { toast(`${NAMES[win.id]} is locked in place. Tap the lock to free it.`); return; }
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
  } else if (drag.mode === 'size') {
    win.w = Math.max(Math.min(380, view.w - 12), Math.min(view.w - win.x - 6, drag.w + dx));
    win.h = Math.max(300, Math.min(view.h - DOCK - 54 - win.y, drag.h + dy));
  } else {
    // The left corner grows the window leftwards, keeping its right edge put.
    const right = drag.left + drag.w;
    const w = Math.max(Math.min(380, view.w - 12), Math.min(right - 6, drag.w - dx));
    win.w = w; win.x = right - w;
    win.h = Math.max(300, Math.min(view.h - DOCK - 54 - win.y, drag.h + dy));
  }
}

/* The close control: a resting dot beside the bar that becomes × when you look at it.
   Holding it opens the visionOS menu: close this, close the others, or lock the window in place. */
const closeMenu = ref<VisionAppId | null>(null);
let holdTimer = 0, held = false;
function closeDown(id: VisionAppId) {
  held = false;
  clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => { held = true; closeMenu.value = id; }, 480);
}
function closeUp() { clearTimeout(holdTimer); }
function closeClick(id: VisionAppId) {
  if (held) { held = false; return; }
  closeMenu.value = null;
  close(id);
}
function closeOthers(id: VisionAppId) {
  windows.value = windows.value.filter(item => item.id === id);
  closeMenu.value = null;
  toast('Other apps closed.');
}
function lockWindow(win: Win, on: boolean) {
  win.locked = on;
  closeMenu.value = null;
  toast(on ? `${NAMES[win.id]} locked in place. Recentring will leave it be.` : `${NAMES[win.id]} unlocked.`);
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

let crownY: number | null = null, crownMoved = false, crownHold = 0, crownHeld = false;
function crownDown(event: PointerEvent) {
  crownY = event.clientY; crownMoved = false; crownHeld = false;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  // Holding the Digital Crown calls Siri.
  clearTimeout(crownHold);
  crownHold = window.setTimeout(() => { if (!crownMoved && crownY !== null) { crownHeld = true; void jarvisOrb.value?.talk(); } }, 650);
}
function crownMove(event: PointerEvent) {
  if (crownY === null) return;
  const by = (crownY - event.clientY) / 160;
  if (Math.abs(by) > 0.02) { crownMoved = true; turnCrown(by); crownY = event.clientY; }
}
function crownUp() { clearTimeout(crownHold); if (crownY !== null && !crownMoved && !crownHeld) goHome(); crownY = null; }

/* Widgets in the room and Siri. */
const widgets = ref<InstanceType<typeof SpatialWidgets>>();
const jarvisOrb = ref<InstanceType<typeof JarvisOrb>>();
/* Making things in the space around you. */
const spatial = ref<InstanceType<typeof SpatialSpace>>();
const creating = ref(false);
const envView = () => place.value?.view() ?? { yaw: 0, pitch: 0, fov: 72 };
const envUrl = computed(() => !inside.value ? null : here.value.kind === 'photo' ? `/vision/env/${here.value.id}-4k.webp` : 'space');
function toggleCreate() {
  control.value = false; help.value = false;
  if (!creating.value) { homeOpen.value = false; setViewOnly(false); }
  spatial.value?.toggle();
}
const APP_IDS = new Set<string>(VISION_APPS.map(item => item.id));
/** 'open' while the full JARVIS display covers the view, 'docked' when it has stepped aside. */
const jarvisCore = ref<'closed' | 'open' | 'docked'>('closed');
let jarvisActing = false, jarvisActingTimer = 0;
const jarvis = useJarvis({
  context: () => ({
    now: new Date(),
    place: inside.value ? { id: here.value.id, name: here.value.name } : { id: 'room', name: 'My Room' },
    immersion: inside.value ? immersion.value : 0,
    open: windows.value.map(win => ({ id: win.id, name: NAMES[win.id] })),
    front: front.value ? { id: front.value.id, name: NAMES[front.value.id] } : null,
    dark: dark.value, viewOnly: viewOnly.value, focusMode: focusMode.value,
    apps: VISION_APPS, environments: VISION_ENVIRONMENTS, objects: spatial.value?.count ?? 0,
  }),
  act: jarvisAct,
});
const jarvisStatus = computed(() => ({ place: inside.value ? here.value.name : 'My Room', immersion: inside.value ? immersion.value : 0, windows: windows.value.length, front: front.value ? NAMES[front.value.id] : '' }));
/** Everything JARVIS can do to the headset. Returns an extra line for him to say, when there is one. */
async function jarvisAct(action: JarvisAction): Promise<string | void> {
  jarvisActing = true;
  clearTimeout(jarvisActingTimer);
  jarvisActingTimer = window.setTimeout(() => { jarvisActing = false; }, 900);
  const aside = () => jarvisOrb.value?.stepAside();
  switch (action.type) {
    case 'open': if (APP_IDS.has(action.app)) { setViewOnly(false); open(action.app as VisionAppId); aside(); } break;
    case 'close': close(action.app as VisionAppId); break;
    case 'closeAll': windows.value = []; homeOpen.value = false; break;
    case 'environment':
      if (VISION_ENVIRONMENTS.some(item => item.id === action.id)) { homeOpen.value = false; setEnvironment(action.id as VisionEnvironmentId); if (action.id !== 'room') aside(); }
      break;
    case 'immersion': if (environment.value === 'room' && action.value > 0) environment.value = lastPlace; glideTo(Math.max(0, Math.min(1, action.value))); aside(); break;
    case 'immersionBy': turnCrown(action.delta); break;
    case 'home': goHome('apps'); aside(); break;
    case 'widgets': control.value = false; widgets.value?.openGallery(); aside(); break;
    case 'capture': aside(); await new Promise(resolve => window.setTimeout(resolve, 700)); capture(); break;
    case 'dark': dark.value = action.on; break;
    case 'viewOnly':
      if (action.on) { await jarvisOrb.value?.close(); setViewOnly(true); } else setViewOnly(false);
      break;
    case 'arrange': setViewOnly(false); homeOpen.value = false; arrange(); aside(); break;
    case 'search': open('safari'); aside(); break;
    case 'recentre': recenter(); break;
    case 'sound': if (sound.value !== action.on) toggleSound(); break;
    case 'focusMode': focusMode.value = action.on; break;
    case 'scan': {
      const win = front.value;
      if (!win) break;
      aside(); focus(win);
      scanning.value = win.id; clearTimeout(scanTimer); scanTimer = window.setTimeout(() => { scanning.value = null; }, 1700);
      await new Promise(resolve => window.setTimeout(resolve, 900));
      break;
    }
    case 'spawn': homeOpen.value = false; setViewOnly(false); aside(); await new Promise(resolve => window.setTimeout(resolve, 450)); spatial.value?.spawn(action.shape, action.count, action.material); break;
    case 'clearSpace': spatial.value?.clear(); break;
    case 'gravity': spatial.value?.setGravity(action.mode); break;
  }
}
function siriKey(event: KeyboardEvent) {
  if (event.altKey && event.code === 'Space') { event.preventDefault(); jarvisOrb.value?.activate(); return; }
  // Spotlight: Ctrl or Command + Space, or / when nothing is being typed.
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement | null)?.isContentEditable;
  if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'j' || event.key === 'J') && !booting.value) { event.preventDefault(); if (viewOnly.value) setViewOnly(false); void jarvisOrb.value?.talk(); return; }
  if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'v' || event.key === 'V') && !booting.value) { event.preventDefault(); setViewOnly(!viewOnly.value); return; }
  if (!typing && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'c' || event.key === 'C') && !booting.value) { event.preventDefault(); toggleCreate(); return; }
  if (((event.ctrlKey || event.metaKey) && event.code === 'Space') || (event.key === '/' && !typing)) { event.preventDefault(); openSpotlight(); }
}
const spotlight = ref<InstanceType<typeof Spotlight>>();
function openSpotlight() { control.value = false; help.value = false; spotlight.value?.show(); }
function spotlightPick(result: SpotlightResult) {
  switch (result.kind) {
    case 'app': open(result.id); break;
    case 'place': homeOpen.value = false; setEnvironment(result.id as VisionEnvironmentId); break;
    case 'person': open('messages'); break;
    case 'web': open('safari'); toast(`Searching the web for “${result.id}”.`); break;
    case 'action':
      if (result.id === 'dark') dark.value = !dark.value;
      else if (result.id === 'solid') reduceTransparency.value = !reduceTransparency.value;
      else if (result.id === 'sound') toggleSound();
      else if (result.id === 'capture') capture();
      else if (result.id === 'recentre') recenter();
      else if (result.id === 'closeAll') closeAll();
      else if (result.id === 'widgets') widgets.value?.openGallery();
      else if (result.id === 'siri') void jarvisOrb.value?.talk();
      else goHome('apps');
  }
}
function openFromWidget(id: string) { if (APP_IDS.has(id)) open(id as VisionAppId); }

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
  window.addEventListener('keydown', siriKey);
  let welcomed = false;
  try { welcomed = localStorage.getItem('lab-vision-welcomed') === '1'; } catch { /* ignore */ }
  bootTimer = window.setTimeout(() => { booting.value = false; if (!welcomed) help.value = true; else window.setTimeout(() => jarvis.remark('greet'), 1400); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2600);
  scriptTimers = SCRIPT.map(([seconds, app, title, body]) => window.setTimeout(() => notify(app, title, body), seconds * 1000));
});
onBeforeUnmount(() => {
  jarvis.dispose();
  document.documentElement.classList.remove('lab-vision-on', 'lab-vision-view');
  if (labDeviceBack.handler === back) labDeviceBack.handler = null;
  watcher?.disconnect();
  window.removeEventListener('keydown', pageKeys);
  window.removeEventListener('keydown', siriKey);
  clearTimeout(crownHold);
  ambience.dispose();
  scriptTimers.forEach(clearTimeout); noticeTimers.forEach(clearTimeout); clearTimeout(holdTimer);
  clearInterval(clockTimer); clearTimeout(bootTimer); clearTimeout(noteTimer); clearTimeout(flashTimer); cancelAnimationFrame(glide);
});
</script>

<template>
  <div ref="visor" class="visor" :class="{ booting, solid: reduceTransparency, compact, inside, looking, 'cc-open': control, 'home-open': homeOpen, 'view-only': viewOnly, 'jarvis-open': jarvisCore === 'open', 'jarvis-docked': jarvisCore === 'docked', creating }" :style="{ '--tx': tilt.x, '--ty': tilt.y }" @pointermove="look">
    <VisionEnvironment :id="environment" ref="place" :immersion="immersion" :dark="dark" class="place" />
    <i class="dimmer" :style="{ opacity: dim }" />
    <i class="gaze" />

    <div ref="space" class="space" :class="{ dimmed: !viewOnly && ((homeOpen && windows.length) || help) }" @pointerdown="lookDown" @pointermove="lookMove" @pointerup="lookUp" @pointercancel="lookUp">
      <!-- Widgets live in the room, behind any open windows. -->
      <SpatialSpace v-if="!booting" ref="spatial" :view="envView" :environment="envUrl" :compact="compact" :hidden="viewOnly || jarvisCore === 'open'" @creating="creating = $event" @toast="toast" />
      <SpatialWidgets v-if="!booting" ref="widgets" :now="now" :compact="compact" :dark="dark" :immersed="inside && immersion > 0.95" @open="openFromWidget" />
      <!-- Windows -->
      <TransitionGroup name="window">
        <section v-for="win in windows" :key="win.id" class="window" :class="{ front: front === win, behind: homeOpen, gliding, scanning: scanning === win.id }" :aria-label="NAMES[win.id]"
          :style="{ left: `${win.x}px`, top: `${win.y}px`, width: `${win.w}px`, height: `${win.h}px`, zIndex: win.z }" @pointerdown.capture="focus(win)">
          <div class="glass"><component :is="VIEWS[win.id]" :compact="compact" /></div>
          <div class="grip-row">
            <button class="shut" :aria-label="`Close ${NAMES[win.id]}. Hold for more.`" :title="`Close ${NAMES[win.id]} (hold for more)`"
              @pointerdown="closeDown(win.id)" @pointerup="closeUp" @pointerleave="closeUp" @click="closeClick(win.id)" @contextmenu.prevent="closeMenu = win.id">
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" /></svg>
            </button>
            <button v-if="win.locked" class="bar locked" :aria-label="`${NAMES[win.id]} is locked in place. Unlock.`" title="Locked in place. Click to unlock." @click="lockWindow(win, false)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6Z" fill="none" stroke="currentColor" stroke-width="1.900" stroke-linejoin="round" /></svg>
            </button>
            <button v-else class="bar" :aria-label="`Move ${NAMES[win.id]}. Double-click to fill the view.`" :title="`${NAMES[win.id]}: drag to move, double-click to fill the view`" @pointerdown="grab($event, win, 'move')" @dblclick="zoom(win)"><i /></button>
            <Transition name="drop">
              <div v-if="closeMenu === win.id" class="close-menu" role="menu" @pointerdown.stop>
                <button role="menuitem" @click="closeMenu = null; close(win.id)">Close Window</button>
                <button v-if="windows.length > 1" role="menuitem" @click="closeOthers(win.id)">Close Other Apps</button>
                <button role="menuitem" @click="lockWindow(win, !win.locked)">{{ win.locked ? 'Unlock' : 'Lock in Place' }}</button>
                <button role="menuitem" class="cancel" @click="closeMenu = null">Cancel</button>
              </div>
            </Transition>
          </div>
          <button class="corner left" :aria-label="`Resize ${NAMES[win.id]} from the left`" title="Drag to resize" @pointerdown="grab($event, win, 'size-left')"><i /></button>
          <button class="corner" :aria-label="`Resize ${NAMES[win.id]}`" title="Drag to resize" @pointerdown="grab($event, win, 'size')"><i /></button>
        </section>
      </TransitionGroup>

      <!-- Home View -->
      <Transition name="home">
        <div v-if="homeOpen && !booting" class="home" :style="{ '--s': homeScale }">
          <button class="home-search" aria-label="Search (Ctrl + Space)" title="Search · Ctrl + Space" @click="openSpotlight">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm4.8 11.3L20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Search</span>
          </button>
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
            <button v-for="spot in VISION_ENVIRONMENTS" :key="spot.id" :aria-pressed="spot.id === 'room' ? !inside : environment === spot.id && inside" @click="pickPlace(spot.id)">
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
      <button class="dock-round" aria-label="Create in your space (C)" title="Create in your space · C" @click="toggleCreate">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9Zm0 0v9m0 0 8-4.5M12 12l-8-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
      </button>
      <button class="dock-round" aria-label="Just the view (V)" title="Just the view · V" @click="setViewOnly(true)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /></svg>
      </button>
      <button class="dock-round" :aria-pressed="help" aria-label="How to use Vision Pro" title="How to use Vision Pro" @click="help = !help; control = false">?</button>
    </nav>

    <!-- Just the view: one quiet bar brings everything back. -->
    <Transition name="view-return">
      <button v-if="viewOnly" class="view-return" aria-label="Show everything (V)" title="Show everything · V" @click="setViewOnly(false)">
        <i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /></svg></i>
        <span>Show everything</span>
      </button>
    </Transition>

    <Spotlight ref="spotlight" :apps="VISION_APPS" :environments="VISION_ENVIRONMENTS" :people="PEOPLE" :compact="compact" @pick="spotlightPick" />
    <JarvisOrb v-if="!booting" ref="jarvisOrb" :jarvis="jarvis" :compact="compact" :status="jarvisStatus" @core="jarvisCore = $event" />

    <!-- Control Centre -->
    <button class="status" :aria-expanded="control" aria-label="Control Centre" @click="control = !control; help = false"><b>{{ time }}</b><i /></button>
    <Transition name="drop">
      <div v-if="control" class="control cc" role="dialog" aria-label="Control Centre">
        <header class="cc-status">
          <div><b>{{ time }}</b><span>{{ day }}</span></div>
          <em>
            <svg v-if="wifi" viewBox="0 0 24 24" aria-label="Wi-Fi"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><circle cx="12" cy="19.2" r="1.5" fill="currentColor" /></svg>
            <svg viewBox="0 0 28 13" aria-hidden="true"><rect x=".5" y=".5" width="23.500" height="12" rx="3.800" fill="none" stroke="currentColor" opacity=".5" /><rect x="2" y="2" width="14" height="9" rx="2.400" fill="currentColor" /><path d="M25.500 4.300v4.400c.900-.300 1.500-1.200 1.500-2.200s-.600-1.900-1.500-2.200Z" fill="currentColor" opacity=".5" /></svg>71%
          </em>
        </header>
        <div class="cc-grid">
          <section class="cc-toggles">
            <button :aria-pressed="wifi" aria-label="Wi-Fi" @click="toggleMode('wifi')"><svg viewBox="0 0 24 24"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.6 16a5 5 0 0 1 6.8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><circle cx="12" cy="19.2" r="1.5" fill="currentColor" /></svg><span>Wi-Fi</span></button>
            <button :aria-pressed="bluetooth" aria-label="Bluetooth" @click="toggleMode('bluetooth')"><svg viewBox="0 0 24 24"><path d="m7 7 10 10-5 4V3l5 4L7 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg><span>Bluetooth</span></button>
            <button :aria-pressed="focusMode" aria-label="Focus" @click="toggleMode('focus')"><svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" fill="currentColor" /></svg><span>Focus</span></button>
            <button :aria-pressed="guest" aria-label="Guest User" @click="toggleMode('guest')"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" /><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Guest</span></button>
            <button :aria-pressed="travel" aria-label="Travel Mode" @click="toggleMode('travel')"><svg viewBox="0 0 24 24"><path d="M2 15 22 7l-2 5-8 2-4 6-1-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg><span>Travel</span></button>
            <button :aria-pressed="mirroring" aria-label="Mirror my view" @click="toggleMode('mirroring')"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Mirror</span></button>
            <button :aria-pressed="sound" aria-label="Environment sound" @click="toggleSound"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Sound</span></button>
            <button :aria-pressed="dark" aria-label="Dark environments" @click="dark = !dark"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" /></svg><span>Dark</span></button>
            <button :aria-pressed="reduceTransparency" aria-label="Solid glass" @click="reduceTransparency = !reduceTransparency"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" opacity=".9" /></svg><span>Solid</span></button>
            <button aria-label="Mac Virtual Display" @click="open('mac')"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><path d="M2 19h20" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Mac</span></button>
            <button aria-label="Capture" @click="capture"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="12" r="4.5" fill="#ff453a" /></svg><span>Capture</span></button>
            <button aria-label="Search" @click="openSpotlight"><svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm4.8 11.3L20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Search</span></button>
            <button aria-label="Widgets" @click="control = false; widgets?.openGallery()"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="2" /><rect x="13" y="3" width="8" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="2" /><rect x="3" y="13" width="18" height="8" rx="2.5" fill="none" stroke="currentColor" stroke-width="2" /></svg><span>Widgets</span></button>
            <button aria-label="JARVIS" @click="control = false; jarvisOrb?.activate()"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#ffc15a" stroke-width="1.6" /><circle cx="12" cy="12" r="3.6" fill="none" stroke="#ffe2a8" stroke-width="2" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="#ffc15a" stroke-width="1.4" stroke-linecap="round" /></svg><span>JARVIS</span></button>
            <button aria-label="Create in your space" @click="toggleCreate"><svg viewBox="0 0 24 24"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9Zm0 0v9m0 0 8-4.5M12 12l-8-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg><span>Create</span></button>
            <button aria-label="Recentre" @click="recenter"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg><span>Recentre</span></button>
          </section>
          <section class="cc-side">
            <label class="cc-slider"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" fill="currentColor" /></svg><input type="range" min="0" max="1" step="0.01" :value="volume" :style="{ '--v': volume }" aria-label="Volume" @input="volume = Number(($event.target as HTMLInputElement).value)" /></label>
            <label class="cc-slider"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 6-10 4 6 2.500-3.500L21 19Z" fill="currentColor" /></svg><input type="range" min="0" max="1" step="0.01" :value="immersion" :style="{ '--v': immersion }" aria-label="Immersion" @input="turnCrown(Number(($event.target as HTMLInputElement).value) - immersion)" /></label>
            <button class="cc-now" @click="open('music')">
              <i class="cc-art" />
              <span><small>Now Playing</small><b>After Hours</b><em>The Lab Band</em></span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z" fill="currentColor" /></svg>
            </button>
          </section>
        </div>
        <div class="cc-places">
          <button v-for="spot in VISION_ENVIRONMENTS" :key="spot.id" :aria-pressed="spot.id === 'room' ? !inside : environment === spot.id && inside" :title="spot.name" @click="setEnvironment(spot.id)">
            <i v-if="spot.id === 'room'" class="room-thumb" /><img v-else :src="`/vision/env/${spot.id}-thumb.webp`" alt="" loading="lazy" draggable="false" />
            <span>{{ spot.name }}</span>
          </button>
        </div>
        <section v-if="history.length" class="cc-notes">
          <h3>Notifications <button @click="history = []">Clear</button></h3>
          <button v-for="item in history.slice(0, 4)" :key="item.id" @click="open(item.app)"><span class="notice-icon"><VisionIcon :name="item.app" /></span><span><b>{{ item.title }}</b><em>{{ item.body }}</em></span></button>
        </section>
        <footer class="cc-foot">
          <button @click="goHome('apps')">Home</button>
          <button :disabled="!windows.length" @click="closeAll(); control = false">Close all</button>
          <button @click="help = true; control = false">Help</button>
        </footer>
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
    <TransitionGroup name="notice" tag="div" class="notices" :class="{ below: !!note }" aria-live="polite">
      <article v-for="item in notices" :key="item.id" class="notice" tabindex="0"
        @pointerenter="holdNotice(item.id, true)" @pointerleave="holdNotice(item.id, false)" @focus="holdNotice(item.id, true)" @blur="holdNotice(item.id, false)">
        <button class="notice-main" :aria-label="`${item.title}: ${item.body}. Open ${NAMES[item.app]}.`" @click="openNotice(item)">
          <span class="notice-icon"><VisionIcon :name="item.app" /></span>
          <span class="notice-copy"><small>{{ NAMES[item.app] }} · now</small><b>{{ item.title }}</b><em>{{ item.body }}</em></span>
        </button>
        <div class="notice-actions">
          <button @click="openNotice(item)">Open</button>
          <button @click="dismissNotice(item.id)">Dismiss</button>
        </div>
      </article>
    </TransitionGroup>
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
/* The Home View's search pill floats just above the icons. */
.home-search{position:absolute;left:50%;top:-74px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:44px;padding:0 20px 0 16px;border-radius:22px;font-size:15px;color:rgb(255 255 255 / .82);
  background:rgb(60 62 70 / .42);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .16);transition:background .2s,transform .2s cubic-bezier(.2,.9,.3,1.2)}
.home-search:hover{background:rgb(100 102 110 / .6);transform:translateX(-50%) scale(1.04)}
.home-search svg{width:18px;height:18px}
.compact .home-search{position:relative;left:auto;top:auto;transform:none;margin:0 auto 10px;width:calc(100% - 24px);justify-content:flex-start}
.compact .home-search:hover{transform:none}
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
.grip-row .shut{position:relative;height:34px;width:34px;min-width:0;padding:0;border-radius:50%;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important}
/* At rest the close control is a small dot; it becomes a round × when targeted. */
.grip-row .shut::before{content:'';position:absolute;inset:11px;border-radius:50%;background:rgb(255 255 255 / .55);box-shadow:0 2px 8px rgb(0 0 0 / .3);transition:inset .22s cubic-bezier(.2,.9,.3,1.2),background .2s}
.grip-row .shut svg{position:relative;opacity:0;transform:scale(.6);transition:opacity .18s,transform .22s;color:#fff}
.grip-row .shut:hover::before,.grip-row .shut:focus-visible::before{inset:0;background:rgb(70 72 80 / .78);backdrop-filter:blur(20px)}
.grip-row .shut:hover svg,.grip-row .shut:focus-visible svg{opacity:1;transform:none}
.window:not(.front) .grip-row .shut::before{background:rgb(255 255 255 / .3)}
.bar.locked{width:46px;height:34px;border-radius:17px;background:rgb(70 72 80 / .62);backdrop-filter:blur(20px);color:#fff;cursor:pointer}.bar.locked svg{width:17px;height:17px}
.close-menu{position:absolute;bottom:calc(100% + 54px);left:50%;transform:translateX(-50%);display:grid;min-width:220px;padding:8px;border-radius:26px;z-index:2;
  background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .06)),rgb(48 50 56 / .82);backdrop-filter:blur(40px) saturate(140%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .14),0 24px 60px rgb(0 0 0 / .4)}
.close-menu button{height:46px;padding:0 18px;border-radius:18px;text-align:left;font-size:15px;font-weight:500;transition:background .15s}.close-menu button:hover{background:rgb(255 255 255 / .14)}
.close-menu .cancel{color:rgb(255 255 255 / .6)}
.shut{height:34px;min-width:34px;padding:0 10px;border-radius:17px;display:flex;align-items:center;justify-content:center;gap:0;font-size:13px;font-weight:600;
  background:rgb(88 90 98 / .72);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .22),0 6px 16px rgb(0 0 0 / .3);transition:background .2s,transform .2s,gap .2s}
.shut svg{width:13px;height:13px;flex:none}
.shut span{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .25s ease}
.shut:hover,.shut:focus-visible{background:rgb(255 69 58 / .92);gap:6px}.shut:hover span,.shut:focus-visible span{max-width:44px}
.shut:active{transform:scale(.94)}
.bar{width:150px;height:34px;display:grid;place-items:center;cursor:grab;touch-action:none}.bar:active{cursor:grabbing}
.bar i{width:112px;height:9px;border-radius:5px;background:rgb(255 255 255 / .6);box-shadow:0 2px 10px rgb(0 0 0 / .3);transition:background .2s,transform .2s}.bar:hover i{background:#fff;transform:scaleX(1.050)}
.window:not(.front) .bar i{background:rgb(255 255 255 / .38)}
.corner.left{right:auto;left:-16px;cursor:nesw-resize}.corner.left i{right:auto;left:8px;border-radius:0 0 0 22px;border-left-color:rgb(255 255 255 / .8);border-right-color:transparent}
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
/* visionOS 27 Control Center: one connected glass surface with status, toggles, sliders, Now Playing, places and notifications. */
.control.cc{width:min(560px,calc(100vw - 20px));margin-left:calc(min(560px,100vw - 20px) / -2);padding:20px;display:grid;gap:14px}
.cc-status{display:flex!important;justify-content:space-between;align-items:center;margin:0!important}
.cc-status b{display:block;font-size:40px;line-height:1;font-weight:600;letter-spacing:-.03em}.cc-status span{font-size:14px;color:rgb(255 255 255 / .65)}
.cc-status em{display:flex;align-items:center;gap:8px;font-style:normal;font-size:14px}.cc-status svg{width:22px;height:22px}
.cc-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}
.cc-toggles{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 6px}
.cc-toggles button{display:grid;justify-items:center;gap:5px;font-size:11px;color:rgb(255 255 255 / .8)}
.cc-toggles svg{width:52px;height:52px;padding:14px;border-radius:50%;background:rgb(255 255 255 / .12);transition:background .2s,color .2s,transform .2s cubic-bezier(.2,.9,.3,1.3)}
.cc-toggles button:hover svg{background:rgb(255 255 255 / .22);transform:scale(1.07)}
.cc-toggles button[aria-pressed=true] svg{background:#fff;color:#111}
.cc-side{display:grid;gap:10px;align-content:start}
.cc-slider{position:relative;display:block;height:52px;border-radius:26px;overflow:hidden;background:rgb(255 255 255 / .12)}
.cc-slider svg{position:absolute;left:16px;top:16px;width:20px;height:20px;z-index:1;color:#fff;mix-blend-mode:difference;pointer-events:none}
.cc-slider input{appearance:none;-webkit-appearance:none;width:100%;height:100%;margin:0;background:linear-gradient(90deg,#fff calc(var(--v) * 100%),transparent 0);cursor:pointer}
.cc-slider input::-webkit-slider-thumb{-webkit-appearance:none;width:1px;height:52px;opacity:0}.cc-slider input::-moz-range-thumb{width:1px;height:52px;opacity:0;border:0}
.cc-now{display:flex;align-items:center;gap:12px;padding:10px;border-radius:24px;background:rgb(255 255 255 / .12);text-align:left;transition:background .2s}.cc-now:hover{background:rgb(255 255 255 / .2)}
.cc-art{width:46px;height:46px;flex:none;border-radius:12px;background:radial-gradient(circle at 30% 30%,#ff9f6b,#d6336c 45%,#3b1d6e)}
.cc-now span{display:grid;flex:1;min-width:0}.cc-now small{font-size:11px;color:rgb(255 255 255 / .6);text-transform:uppercase;letter-spacing:.06em}.cc-now b{font-size:15px}.cc-now em{font-style:normal;font-size:13px;color:rgb(255 255 255 / .7)}
.cc-now svg{width:22px;height:22px;margin-right:6px}
.cc-places{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px}
.cc-places button{flex:none;display:grid;gap:5px;justify-items:center;width:84px;font-size:11px;color:rgb(255 255 255 / .8)}
.cc-places .room-thumb{position:relative;inset:auto}
.cc-places img,.cc-places .room-thumb{width:84px;height:54px;border-radius:14px;object-fit:cover;display:block;transition:transform .2s,box-shadow .2s}
.cc-places button:hover img{transform:scale(1.05)}.cc-places button[aria-pressed=true] img,.cc-places button[aria-pressed=true] .room-thumb{box-shadow:0 0 0 3px #fff}
.cc-places span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:84px}
.cc-notes h3{display:flex;justify-content:space-between;margin:0 0 6px;font-size:13px;font-weight:600;color:rgb(255 255 255 / .7)}.cc-notes h3 button{font-size:13px;color:rgb(255 255 255 / .6)}
.cc-notes>button{display:flex;align-items:center;gap:10px;width:100%;padding:8px;border-radius:18px;text-align:left}.cc-notes>button:hover{background:rgb(255 255 255 / .1)}
.cc-notes>button .notice-icon{width:34px}.cc-notes>button span:last-child{display:grid;min-width:0}.cc-notes b{font-size:14px}.cc-notes em{font-style:normal;font-size:13px;color:rgb(255 255 255 / .7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cc-foot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.cc-foot button{height:44px;border-radius:22px;background:rgb(255 255 255 / .12);font-size:14px;font-weight:500}.cc-foot button:hover{background:rgb(255 255 255 / .2)}.cc-foot button:disabled{opacity:.35}
.compact .cc-grid{grid-template-columns:1fr}

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
.help .tip-siri::before{inset:8px;border-radius:50%;background:radial-gradient(circle,#2a1a06 32%,transparent 34%),conic-gradient(from 90deg,#d97b28,#ffc15a,#fff1ca,#ffc15a,#d97b28);box-shadow:0 0 14px #ffb04a;animation:tip-spin 3s linear infinite}
@keyframes tip-spin{to{transform:rotate(360deg)}}
.help .tip-place::after{right:14px;top:13px;width:8px;height:8px;border-radius:50%;background:#ffd60a}
.go{display:block;width:100%;margin-top:18px;height:54px;border-radius:27px;background:#fff;color:#111;font-size:17px;font-weight:600;transition:transform .2s,background .2s}.go:hover{background:#e9e9ee}.go:active{transform:scale(.98)}

.toast{position:absolute;left:50%;top:62px;bottom:auto;transform:translateX(-50%);margin:0;max-width:calc(100vw - 24px);padding:13px 22px;border-radius:26px;z-index:7500;font-size:15px;text-align:center;pointer-events:none;
  background:rgb(50 52 60 / .78);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);box-shadow:inset 0 1px 0 rgb(255 255 255 / .28),0 16px 40px rgb(0 0 0 / .35)}
.drop-enter-active,.drop-leave-active{transition:opacity .25s,translate .35s cubic-bezier(.2,.9,.2,1)}.drop-enter-from,.drop-leave-to{opacity:0;translate:0 -18px}
/* Notification banners: compact at the top of the view; looking at one opens it up. */
.notices.below{top:118px}
.cc-open .toast{top:auto;bottom:112px}
.cc-open .jarvis-layer{opacity:0;pointer-events:none;transition:opacity .2s}
.compact .toast{font-size:13px;padding:9px 16px;max-width:min(320px,calc(100vw - 24px))}
/* The Home View sits in front of the room; widgets fall back while it is open. */
.widget-layer :deep(.placed){transition:opacity .35s ease,filter .25s}
.home-open .widget-layer :deep(.placed){opacity:.18;pointer-events:none}
.home-open .widget-layer :deep(.placed *){pointer-events:none!important}
.notices{position:absolute;top:62px;transition:top .3s ease;left:50%;transform:translateX(-50%);z-index:7400;display:grid;gap:10px;width:min(420px,calc(100vw - 24px));pointer-events:none}
.notice{pointer-events:auto;border-radius:30px;overflow:hidden;outline:none;
  background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .06)),rgb(48 50 56 / .72);backdrop-filter:blur(40px) saturate(140%);-webkit-backdrop-filter:blur(40px) saturate(140%);
  box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .14),0 22px 50px rgb(0 0 0 / .35);transition:transform .3s cubic-bezier(.2,.9,.3,1.1)}
.notice:hover,.notice:focus-within{transform:scale(1.03)}
.notice-main{display:flex;align-items:center;gap:12px;width:100%;padding:12px 18px 12px 12px;text-align:left}
.notice-icon{width:44px;flex:none}
.notice-copy{display:grid;min-width:0}.notice-copy small{font-size:12px;color:rgb(255 255 255 / .6);text-transform:uppercase;letter-spacing:.06em}
.notice-copy b{font-size:15px;font-weight:600}.notice-copy em{font-style:normal;font-size:14px;color:rgb(255 255 255 / .85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:all .3s}
.notice:hover .notice-copy em,.notice:focus-within .notice-copy em{white-space:normal}
.notice-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px;max-height:0;opacity:0;transition:max-height .3s ease,opacity .25s ease,padding .3s ease}
.notice:hover .notice-actions,.notice:focus-within .notice-actions{max-height:70px;opacity:1;padding:0 12px 12px}
.notice-actions button{height:42px;border-radius:21px;background:rgb(255 255 255 / .14);font-size:14px;font-weight:600}.notice-actions button:first-child{background:#fff;color:#111}
.notice-enter-active{transition:opacity .35s,transform .5s cubic-bezier(.2,.9,.3,1.15)}.notice-leave-active{transition:opacity .25s,transform .3s}
.notice-enter-from{opacity:0;transform:translateY(-24px) scale(.92)}.notice-leave-to{opacity:0;transform:translateY(-12px) scale(.96)}
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

/* Just the view. Windows and the Home View sink back and blur away; the chrome slides off the edges. */
.window,.home,.widget-layer{transition-property:transform,filter,opacity,scale,visibility;transition-duration:.25s,.3s,.3s,.6s,0s;transition-timing-function:ease-out,ease,ease,cubic-bezier(.2,.8,.2,1),linear}
.dock,.status,.crown,.top-button,.notices,.jarvis-layer{transition:translate .6s cubic-bezier(.2,.8,.2,1),opacity .4s ease,top .3s ease}
.view-only :is(.window,.home,.widget-layer){opacity:0;scale:.9;filter:blur(14px);pointer-events:none;visibility:hidden;transition-duration:.25s,.45s,.45s,.6s,0s;transition-delay:0s,0s,0s,0s,.6s}
.view-only .dock{translate:0 calc(100% + 40px);opacity:0;pointer-events:none}
.view-only :is(.status,.crown,.top-button){translate:0 -90px;opacity:0;pointer-events:none}
.view-only :is(.notices,.jarvis-layer){opacity:0;pointer-events:none}
/* While JARVIS has the whole view, everything else waits behind him. */
.jarvis-open :is(.window,.home,.widget-layer){scale:.94;filter:blur(2px) brightness(.75);pointer-events:none}
.jarvis-open :is(.dock,.status,.crown,.top-button,.notices){opacity:0;pointer-events:none}
.jarvis-open .dock,.jarvis-docked .dock{translate:0 calc(100% + 40px)}
.jarvis-docked .dock{opacity:0;pointer-events:none}
/* While creating, the creation ornament takes the dock's place. */
.creating .dock{translate:0 calc(100% + 40px);opacity:0;pointer-events:none}
.jarvis-open :is(.status,.crown,.top-button){translate:0 -90px}
.window.gliding{transition:left .72s cubic-bezier(.2,.8,.2,1),top .72s cubic-bezier(.2,.8,.2,1),width .72s cubic-bezier(.2,.8,.2,1),height .72s cubic-bezier(.2,.8,.2,1),transform .25s ease-out,filter .3s,opacity .3s,scale .6s cubic-bezier(.2,.8,.2,1)}
.window.scanning::after{content:'';position:absolute;inset:0;border-radius:34px;pointer-events:none;z-index:9;box-shadow:0 0 0 1.5px #ffc15a,0 0 40px rgb(255 160 50 / .45);background:linear-gradient(180deg,transparent 0,transparent calc(var(--scan) - 2px),rgb(255 210 140 / .95) var(--scan),rgb(255 170 60 / .25) calc(var(--scan) + 2px),transparent calc(var(--scan) + 60px));animation:jarvis-scan 1.6s cubic-bezier(.4,0,.2,1) both}
@property --scan{syntax:'<percentage>';inherits:false;initial-value:0%}
@keyframes jarvis-scan{0%{--scan:0%;opacity:0}10%{opacity:1}85%{opacity:1}100%{--scan:100%;opacity:0}}
.view-only .space::before{opacity:0}
.view-return{position:absolute;left:50%;bottom:24px;translate:-50% 0;z-index:7600;height:40px;padding:0 7px;border-radius:20px;display:flex;align-items:center;color:#fff;background:linear-gradient(180deg,rgb(255 255 255 / .16),rgb(255 255 255 / .05)),rgb(36 38 46 / .32);backdrop-filter:blur(26px) saturate(150%);-webkit-backdrop-filter:blur(26px) saturate(150%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .28),inset 0 0 0 1px rgb(255 255 255 / .14),0 14px 34px rgb(0 0 0 / .28);opacity:.62;transition:opacity .3s,padding .35s cubic-bezier(.2,.8,.2,1),background .3s}
.view-return i{width:26px;height:26px;display:grid;place-items:center;flex:none}
.view-return svg{width:20px;height:20px}
.view-return span{max-width:0;overflow:hidden;white-space:nowrap;font-size:14px;font-weight:600;opacity:0;transition:max-width .4s cubic-bezier(.2,.8,.2,1),opacity .25s,margin .4s}
.view-return:is(:hover,:focus-visible){opacity:1;padding:0 16px 0 9px}
.view-return:is(:hover,:focus-visible) span{max-width:150px;opacity:1;margin-left:7px}
.view-return::after{content:"";position:absolute;inset:-6px;border-radius:26px;box-shadow:0 0 0 1.5px rgb(255 255 255 / .5);opacity:0;animation:view-ping 2.4s ease-out .7s 2;pointer-events:none}
@keyframes view-ping{0%{opacity:.9;scale:.9}100%{opacity:0;scale:1.25}}
.view-return-enter-active{transition:opacity .5s ease .35s,translate .6s cubic-bezier(.2,.8,.2,1) .35s}
.view-return-leave-active{transition:opacity .25s ease,translate .3s ease}
.view-return-enter-from,.view-return-leave-to{opacity:0;translate:-50% 30px}
@media (prefers-reduced-motion:reduce){.view-only :is(.window,.home,.widget-layer){scale:1;filter:none}.view-return::after{animation:none}}
</style>

<style src="./vision/kit/kit.css"></style>

<style>
/* While the headset is on, the site's own menus step out of view: only the room and visionOS remain. */
.lab-vision-on .lab-chrome{opacity:0;pointer-events:none;transition:opacity .4s}
.lab-vision-view .device-close{opacity:.22;transition:opacity .4s}
.lab-vision-view .device-close:is(:hover,:focus-visible){opacity:1}
</style>
