<script setup lang="ts">
import { HomeExperience } from '~/experiences/home';
import { PS_GAMES, PS_SHELVES, type PsGame, type PsShelf } from '~/common/playstation/games';
import { catalogue } from './vision/youtube/catalogue';
import PsGlyph from './playstation/PsGlyph.vue';
import { psSound } from './playstation/sound';
import { SHELF_TROPHY, TROPHIES, loadProfile, saveProfile, type PsProfile, type Trophy } from './playstation/trophies';

/** One thing the console can show: a game, or a video on the Media tab. */
interface Tile {
  id: string;
  kind: 'game' | 'video';
  title: string;
  pitch: string;
  cover: string;
  logo: boolean;
  color: string;
  url: string;
  meta: string[];
  game?: PsGame;
}

const opened = useState<boolean>('isConsoleOpen', () => false);
const dialog = ref<HTMLDialogElement>();
const strip = ref<HTMLElement>();
const frame = ref<HTMLIFrameElement>();

const phase = ref<'off' | 'boot' | 'prompt' | 'home'>('off');
const tab = ref<'games' | 'explore' | 'media'>('games');
const focus = ref(0);
const library = ref(false);
const shelf = ref<PsShelf | 'all'>('all');
const options = ref(false);
const control = ref(false);
const searching = ref(false);
const query = ref('');
const trophyList = ref(false);
const confirmPhone = ref<Tile | null>(null);
const running = ref<Tile | null>(null);
const showPlayer = ref(false);
const loading = ref(false);
const slow = ref(false);
const idle = ref(false);
const phone = ref(false);
const now = ref(new Date());
const profile = reactive<PsProfile>({ trophies: {}, played: [], booted: false, muted: false });
const toasts = ref<{ id: number; trophy?: Trophy; title: string; text: string }[]>([]);

const gameTile = (game: PsGame): Tile => ({
  id: game.id, kind: 'game', title: game.title, pitch: game.pitch, cover: game.cover, logo: game.logo, color: game.color,
  url: game.url, game,
  meta: [game.genre, game.online ? 'Online' : 'Offline', game.phone ? 'Touch ready' : 'Keyboard & mouse'],
});
const videos: Tile[] = catalogue.slice(0, 18).map(video => ({
  id: 'yt-' + video.id, kind: 'video', title: video.title.replace(/\s*[([].*?(official|4k|remaster|hd).*?[)\]]/gi, '').trim(),
  pitch: video.channel + ' · ' + video.year, cover: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`, logo: false,
  color: '#c4302b', url: `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`,
  meta: [video.category, video.duration.replace('~', '') + ' min'],
}));

// The row is "recently played first", like the real home screen, then the rest in library order.
const recent = computed(() => {
  const played = profile.played.map(id => PS_GAMES.find(game => game.id === id)).filter((game): game is PsGame => !!game);
  const rest = PS_GAMES.filter(game => !profile.played.includes(game.id));
  return [...played, ...rest].slice(0, 10).map(gameTile);
});
const row = computed<Tile[]>(() => (tab.value === 'games' ? recent.value : tab.value === 'media' ? videos : []));

/* ---------- Explore: a magazine of the library, the way the real console shows collections ---------- */
const COLLECTIONS: { title: string; note: string; ids: string[] }[] = [
  { title: 'Ten minutes, max', note: 'For the gap between two meetings', ids: ['dino', 'floppybird', 'tetris', 'game2048', 'pixelrunner', 'towerbuilder', 'swopper', 'celeste'] },
  { title: 'Play with strangers', note: 'Real people, real servers, real chaos', ids: ['bloxd', 'krunker', 'smashkarts', 'shellshockers', 'narrowone', 'tanx', 'venge', 'zombs', 'diep', 'powerline'] },
  { title: 'Blast from the past', note: 'Your childhood called. It wants a rematch', ids: ['pinball', 'doom', 'pacman', 'duckhunt', 'solitaire', 'minecraft', 'darkroom'] },
  { title: 'Builders and planners', note: 'Blocks, factories and tiny cities', ids: ['minecraft', 'shapez', 'isocity', 'yourcraft', 'peakofempires', 'picocraft', 'sandspiel'] },
  { title: 'Pocket Arcade', note: 'PICO-8 gems: 128 pixels, unlimited charm', ids: ['outvain', 'fleb', 'babademake', 'overstory', 'mossmoss', 'descender', 'pinballvania', 'picoball', 'forlornshores'] },
  { title: 'Slow evenings', note: 'Nothing is chasing you here', ids: ['orbfarm', 'alchemy', 'astray', 'ancientbeast', 'sandspiel', 'solitaire'] },
];
const SPOTLIGHT = ['pinball', 'minecraft', 'doom', 'shapez', 'peakofempires', 'smashkarts'];
const spotlight = ref(0);
const collections = computed(() => COLLECTIONS.map(group => ({
  ...group,
  games: group.ids.map(id => PS_GAMES.find(game => game.id === id)).filter((game): game is PsGame => !!game),
})));
const spotlightGame = computed(() => PS_GAMES.find(game => game.id === SPOTLIGHT[spotlight.value % SPOTLIGHT.length])!);
let spotlightTimer = 0;
function startSpotlight() {
  clearInterval(spotlightTimer);
  spotlightTimer = window.setInterval(() => { if (tab.value === 'explore' && !showPlayer.value && !reduced()) spotlight.value++; }, 7000);
}
// Index row.length is the Game Library tile on the Games tab.
const libraryIndex = computed(() => (tab.value === 'games' ? row.value.length : -1));
const current = computed<Tile | null>(() => row.value[focus.value] ?? null);
const heroTile = computed(() => tab.value === 'explore' ? gameTile(spotlightGame.value) : current.value ?? (tab.value === 'games' ? recent.value[0]! : videos[0]!));
const shelfGames = computed(() => {
  const words = query.value.trim().toLowerCase();
  return PS_GAMES.filter(game => (shelf.value === 'all' || game.shelf === shelf.value)
    && (!words || (game.title + ' ' + game.genre + ' ' + game.pitch).toLowerCase().includes(words)));
});
const earned = computed(() => TROPHIES.filter(trophy => profile.trophies[trophy.id]));
const nextUp = computed(() => {
  const game = current.value?.game;
  if (!game) return null;
  return PS_GAMES.find(other => other.shelf === game.shelf && other.id !== game.id) ?? null;
});
const clock = computed(() => now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sound = (cue: Parameters<typeof psSound>[0]) => psSound(cue, profile.muted);

/* ---------- Hero art: keep the old picture until the new one has decoded, then crossfade ---------- */
const heroes = reactive<{ a: string; b: string; showA: boolean }>({ a: '', b: '', showA: true });
let heroRequest = 0;
watch(() => heroTile.value?.cover, async src => {
  if (!src) return;
  const ticket = ++heroRequest;
  const image = new Image();
  image.src = src;
  try { await image.decode(); } catch { /* A missing picture still swaps, onto the colour wash. */ }
  if (ticket !== heroRequest) return;
  if (heroes.showA) heroes.b = src; else heroes.a = src;
  heroes.showA = !heroes.showA;
}, { immediate: true });

/* ---------- Profile, trophies and notices ---------- */
let toastId = 0;
function notice(title: string, text: string, trophy?: Trophy) {
  toasts.value.push({ id: ++toastId, title, text, trophy });
  if (trophy) sound('trophy');
  const id = toastId;
  window.setTimeout(() => { toasts.value = toasts.value.filter(item => item.id !== id); }, 4200);
}
function award(id: string) {
  if (profile.trophies[id]) return;
  const trophy = TROPHIES.find(item => item.id === id);
  if (!trophy) return;
  profile.trophies[id] = Date.now();
  // Toasts queue: a second trophy waits for the first to leave rather than stacking a wall.
  window.setTimeout(() => notice(trophy.name, trophy.detail, trophy), toasts.value.length * 900);
  const others = TROPHIES.filter(item => item.id !== 'platinum');
  if (others.every(item => profile.trophies[item.id])) award('platinum');
  saveProfile(profile);
}
watch(() => profile.muted, () => saveProfile(profile));

/* ---------- Moving around ---------- */
function setFocus(index: number, silent = false) {
  const max = row.value.length + (tab.value === 'games' ? 0 : -1);
  const next = Math.max(0, Math.min(max, index));
  if (next === focus.value) return;
  focus.value = next;
  if (!silent) sound('move');
  void nextTick(() => strip.value?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }));
}
let hoverTimer = 0;
function hover(index: number) {
  if (phone.value) return;
  clearTimeout(hoverTimer);
  // A pointer sweeping across the row should not flick the whole background on every tile.
  hoverTimer = window.setTimeout(() => setFocus(index), 140);
}
function unhover() { clearTimeout(hoverTimer); }
// "If you like this" jumps to that game in the row, or straight into it when it lives deeper in the library.
function showNext() {
  const game = nextUp.value;
  if (!game) return;
  const index = row.value.findIndex(tile => tile.id === game.id);
  if (index >= 0) { setFocus(index); focusTile(); } else launch(gameTile(game));
}
function pick(index: number) {
  clearTimeout(hoverTimer);
  if (index === libraryIndex.value) { openLibrary(); return; }
  if (index === focus.value) { const tile = row.value[index]; if (tile) launch(tile); return; }
  setFocus(index);
}
function switchTab(next: 'games' | 'explore' | 'media') {
  if (tab.value === next) return;
  tab.value = next;
  focus.value = 0;
  sound('move');
  if (next === 'media') award('media');
  if (next === 'explore') void nextTick(() => dialog.value?.querySelector<HTMLElement>('.explore [data-nav]')?.focus({ preventScroll: true }));
}

/* ---------- Spatial navigation for grids and the Explore page (arrow keys and the d-pad) ---------- */
function spatial(direction: 'left' | 'right' | 'up' | 'down', scope: Element | null): boolean {
  if (!scope) return false;
  const items = [...scope.querySelectorAll<HTMLElement>('[data-nav]')].filter(item => item.offsetParent);
  const active = document.activeElement instanceof HTMLElement && items.includes(document.activeElement) ? document.activeElement : null;
  if (!active) { items[0]?.focus(); return !!items[0]; }
  const from = active.getBoundingClientRect();
  const fx = from.left + from.width / 2, fy = from.top + from.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const item of items) {
    if (item === active) continue;
    const r = item.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - fx, dy = y - fy;
    const ahead = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    if (ahead < 8) continue;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = ahead + across * 2.2;
    if (score < bestScore) { bestScore = score; best = item; }
  }
  if (!best) return false;
  best.focus();
  best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  sound('move');
  return true;
}

/* ---------- A real controller: any gamepad the browser can see drives the console ---------- */
const padConnected = ref(false);
let padFrame = 0, padNext = 0;
const padHeld: boolean[] = [];
function padPress(index: number, pad: Gamepad): boolean {
  const now = !!pad.buttons[index]?.pressed;
  const fresh = now && !padHeld[index];
  padHeld[index] = now;
  return fresh;
}
function sendKey(key: string) {
  dialog.value?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}
function pollPads() {
  padFrame = requestAnimationFrame(pollPads);
  const pad = [...(navigator.getGamepads?.() ?? [])].find((item): item is Gamepad => !!item && item.connected);
  if (!pad) return;
  if (padPress(16, pad) || padPress(8, pad)) { psButton(); return; }
  // While a game is on screen the controller belongs to the game, apart from the PS button.
  if (showPlayer.value && !control.value) { padHeld.length = 0; return; }
  if (phase.value !== 'home') { if (padPress(0, pad) || padPress(9, pad)) wake(); return; }
  if (padPress(0, pad)) { (document.activeElement as HTMLElement | null)?.click(); return; }
  if (padPress(1, pad)) { escape(); return; }
  if (padPress(9, pad) && current.value) { options.value = !options.value; sound('open'); return; }
  if (padPress(4, pad)) { switchTab(tab.value === 'media' ? 'explore' : 'games'); return; }
  if (padPress(5, pad)) { switchTab(tab.value === 'games' ? 'explore' : 'media'); return; }
  const x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0;
  const dpad = padPress(14, pad) ? 'ArrowLeft' : padPress(15, pad) ? 'ArrowRight' : padPress(12, pad) ? 'ArrowUp' : padPress(13, pad) ? 'ArrowDown' : '';
  if (dpad) { sendKey(dpad); padNext = performance.now() + 380; return; }
  const stick = x < -0.6 ? 'ArrowLeft' : x > 0.6 ? 'ArrowRight' : y < -0.6 ? 'ArrowUp' : y > 0.6 ? 'ArrowDown' : '';
  if (stick && performance.now() > padNext) { sendKey(stick); padNext = performance.now() + 170; }
}
function onPad(event: GamepadEvent) {
  padConnected.value = event.type === 'gamepadconnected';
  if (padConnected.value && opened.value) notice('Controller connected', 'Cross to select, Circle to go back, PS for Control Center.');
}

/* ---------- The hero art leans gently toward the pointer ---------- */
const lean = reactive({ x: 0, y: 0 });
let leanFrame = 0;
function leanTo(event: PointerEvent) {
  if (phone.value || reduced() || leanFrame) return;
  const x = event.clientX / window.innerWidth - 0.5, y = event.clientY / window.innerHeight - 0.5;
  leanFrame = requestAnimationFrame(() => { leanFrame = 0; lean.x = x; lean.y = y; });
}
function openLibrary() {
  library.value = true;
  shelf.value = 'all';
  sound('select');
  award('browser');
}

/* ---------- Playing ---------- */
let slowTimer = 0, settleTimer = 0;
function launch(tile: Tile, force = false) {
  if (tile.kind === 'game' && phone.value && !tile.game?.phone && !force) { confirmPhone.value = tile; sound('open'); return; }
  confirmPhone.value = null;
  library.value = false;
  searching.value = false;
  options.value = false;
  control.value = false;
  sound('select');
  if (running.value?.id === tile.id) { showPlayer.value = true; return; }
  running.value = tile;
  showPlayer.value = true;
  loading.value = true;
  slow.value = false;
  clearTimeout(slowTimer);
  slowTimer = window.setTimeout(() => { if (loading.value) slow.value = true; }, 25000);
  // The room's own music would fight the game's.
  // Asked for only now: creating the experience while this mounts would claim it before the room has set up its canvas.
  new HomeExperience().sound?.pauseMusic();
  if (tile.game) {
    profile.played = [tile.id, ...profile.played.filter(id => id !== tile.id)].slice(0, 40);
    award(SHELF_TROPHY[tile.game.shelf]);
    const distinct = new Set(profile.played).size;
    if (distinct >= 5) award('five');
    if (distinct >= 10) award('ten');
    saveProfile(profile);
  }
}
function frameLoaded() {
  if (!running.value) return;
  clearTimeout(settleTimer);
  // "Loaded" is not "ready": give the game a breath to draw its first frame before lifting the veil.
  settleTimer = window.setTimeout(() => { loading.value = false; slow.value = false; }, reduced() ? 0 : 900);
}
function retry() {
  if (!running.value || !frame.value) return;
  loading.value = true;
  slow.value = false;
  frame.value.src = running.value.url;
}
function closeGame() {
  running.value = null;
  showPlayer.value = false;
  loading.value = false;
  control.value = false;
  clearTimeout(slowTimer);
  sound('back');
  void nextTick(() => strip.value?.querySelector<HTMLElement>(`[data-index="${focus.value}"]`)?.focus());
}
function goHome() {
  showPlayer.value = false;
  control.value = false;
  library.value = false;
  sound('back');
}
async function fullscreen() {
  const target = dialog.value;
  if (!target) return;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await target.requestFullscreen();
  } catch { /* Some phones refuse; the console already fills the window. */ }
}

/* ---------- The PS button, back and power ---------- */
function psButton() {
  control.value = !control.value;
  sound(control.value ? 'open' : 'back');
}
function back(): boolean {
  if (confirmPhone.value) { confirmPhone.value = null; return true; }
  if (trophyList.value) { trophyList.value = false; return true; }
  if (options.value) { options.value = false; return true; }
  if (control.value) { control.value = false; sound('back'); return true; }
  if (searching.value) { searching.value = false; query.value = ''; return true; }
  if (library.value) { library.value = false; sound('back'); return true; }
  if (showPlayer.value) { control.value = true; sound('open'); return true; }
  if (phase.value === 'boot' || phase.value === 'prompt') { wake(); return true; }
  return false;
}
function powerOff() {
  sound('back');
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  opened.value = false;
}
function escape() {
  if (!back()) powerOff();
}

/* ---------- Switching on ---------- */
let bootTimer = 0;
function wake() {
  clearTimeout(bootTimer);
  if (phase.value === 'home') return;
  phase.value = 'home';
  sound('select');
  if (!profile.booted) { profile.booted = true; saveProfile(profile); }
  award('found');
  void nextTick(() => strip.value?.querySelector<HTMLElement>(`[data-index="${focus.value}"]`)?.focus({ preventScroll: true }));
}
function key(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement) {
    if (event.key === 'Escape') { event.preventDefault(); escape(); }
    return;
  }
  if (phase.value === 'prompt' || phase.value === 'boot') {
    if (['Enter', ' ', 'Escape'].includes(event.key)) { event.preventDefault(); wake(); }
    return;
  }
  if (event.key === 'Escape') { event.preventDefault(); escape(); return; }
  if (event.key.toLowerCase() === 'p' && !library.value) { event.preventDefault(); psButton(); return; }
  if (showPlayer.value || control.value || options.value) return;
  const arrows: Record<string, 'left' | 'right' | 'up' | 'down' | undefined> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const arrow = arrows[event.key];
  if (library.value) {
    if (arrow && spatial(arrow, dialog.value?.querySelector('.library') ?? null)) event.preventDefault();
    return;
  }
  if (tab.value === 'explore') {
    if (arrow && spatial(arrow, dialog.value?.querySelector('.explore') ?? null)) event.preventDefault();
    else if (arrow === 'up') { event.preventDefault(); dialog.value?.querySelector<HTMLElement>('.tabs .on')?.focus(); }
    return;
  }
  const inStrip = !!strip.value?.contains(document.activeElement);
  if (event.key === 'ArrowRight' && inStrip) { event.preventDefault(); setFocus(focus.value + 1); focusTile(); }
  if (event.key === 'ArrowLeft' && inStrip) { event.preventDefault(); setFocus(focus.value - 1); focusTile(); }
  if (event.key === 'ArrowDown' && inStrip) { event.preventDefault(); dialog.value?.querySelector<HTMLElement>('.play')?.focus(); }
  if (event.key === 'ArrowUp' && !inStrip) { event.preventDefault(); focusTile(); }
}
function focusTile() {
  void nextTick(() => strip.value?.querySelector<HTMLElement>(`[data-index="${focus.value}"]`)?.focus({ preventScroll: true }));
}

/* ---------- Pointer idle: the floating PS button fades while a game has your attention ---------- */
let idleTimer = 0;
function nudge() {
  idle.value = false;
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => { idle.value = true; }, 2600);
}

function measure() { phone.value = window.innerWidth < 760 || window.innerHeight < 430; }
let clockTimer = 0;
watch(opened, async value => {
  clearTimeout(bootTimer);
  if (!value) {
    phase.value = 'off';
    running.value = null;
    showPlayer.value = false;
    control.value = false;
    library.value = false;
    options.value = false;
    dialog.value?.close();
    clearInterval(clockTimer);
    return;
  }
  Object.assign(profile, loadProfile());
  measure();
  now.value = new Date();
  clockTimer = window.setInterval(() => { now.value = new Date(); }, 15000);
  focus.value = 0;
  tab.value = 'games';
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  // First visit gets the full switch-on; after that the console simply wakes.
  if (reduced() || profile.booted) { phase.value = 'boot'; bootTimer = window.setTimeout(wake, reduced() ? 0 : 650); return; }
  phase.value = 'boot';
  sound('boot');
  bootTimer = window.setTimeout(() => { phase.value = 'prompt'; }, 2400);
});
onMounted(() => {
  window.addEventListener('resize', measure);
  window.addEventListener('gamepadconnected', onPad);
  window.addEventListener('gamepaddisconnected', onPad);
});
// The controller is only polled while the console is switched on.
watch(opened, value => {
  cancelAnimationFrame(padFrame);
  clearInterval(spotlightTimer);
  if (value) { padFrame = requestAnimationFrame(pollPads); startSpotlight(); }
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', measure);
  window.removeEventListener('gamepadconnected', onPad);
  window.removeEventListener('gamepaddisconnected', onPad);
  cancelAnimationFrame(padFrame);
  cancelAnimationFrame(leanFrame);
  clearInterval(spotlightTimer);
  clearTimeout(bootTimer); clearTimeout(slowTimer); clearTimeout(settleTimer); clearTimeout(idleTimer); clearTimeout(hoverTimer); clearInterval(clockTimer);
  opened.value = false;
});
const shelfName = (id: PsShelf) => PS_SHELVES.find(item => item.id === id)?.name ?? '';
const tierColor: Record<Trophy['tier'], string> = { bronze: '#d08a52', silver: '#c9d1dc', gold: '#f2c14e', platinum: '#a9c8ff' };
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="ps"
      :class="{ phone, playing: showPlayer }"
      aria-label="PlayStation 5"
      @cancel.prevent="escape"
      @close="opened = false"
      @keydown.stop="key"
      @pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop @wheel.stop @touchstart.stop @touchmove.stop @touchend.stop
      @pointermove="nudge"
    >
      <!-- Switching on -->
      <Transition name="ps-fade">
        <div v-if="phase === 'boot' || phase === 'prompt'" class="boot" @click="wake">
          <div class="boot-glow" />
          <div class="boot-mark" :class="{ ready: phase === 'prompt' }">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".35" />
              <path d="M34 82V38l26 30 26-30v44" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Mohith Lab</span>
          </div>
          <Transition name="ps-fade">
            <p v-if="phase === 'prompt'" class="boot-prompt">
              <span class="ps-key">{{ phone ? 'Tap' : 'Press Enter' }}</span>
              {{ phone ? 'anywhere to start' : 'or click to start' }}
            </p>
          </Transition>
        </div>
      </Transition>

      <!-- Home -->
      <div v-if="phase === 'home'" class="home" :inert="showPlayer || undefined" @pointermove="leanTo">
        <div class="hero" aria-hidden="true" :style="{ '--tint': heroTile?.color, '--lx': lean.x, '--ly': lean.y }">
          <img v-if="heroes.a" :src="heroes.a" :class="{ on: heroes.showA }" alt="">
          <img v-if="heroes.b" :src="heroes.b" :class="{ on: !heroes.showA }" alt="">
          <i class="scrim-top" /><i class="scrim-left" /><i class="scrim-bottom" />
          <!-- The drifting light the real home screen is known for: a handful of soft orbs, all on the GPU. -->
          <div class="motes"><i v-for="n in 14" :key="n" :style="{ '--n': n }" /></div>
        </div>

        <header class="topbar">
          <nav class="tabs" aria-label="Console sections">
            <button :class="{ on: tab === 'games' }" @click="switchTab('games')">Games</button>
            <button :class="{ on: tab === 'explore' }" @click="switchTab('explore')">Explore</button>
            <button :class="{ on: tab === 'media' }" @click="switchTab('media')">Media</button>
          </nav>
          <div class="system">
            <button class="icon" aria-label="Search games" @click="searching = true; library = true; shelf = 'all'"><PsGlyph name="search" /></button>
            <button class="icon" :aria-label="profile.muted ? 'Turn console sounds on' : 'Mute console sounds'" @click="profile.muted = !profile.muted"><PsGlyph :name="profile.muted ? 'mute' : 'sound'" /></button>
            <button class="avatar" aria-label="Trophies" @click="trophyList = true; sound('open')">
              <span>G</span>
              <b v-if="earned.length">{{ earned.length }}</b>
            </button>
            <time>{{ clock }}</time>
            <button class="icon power" aria-label="Turn off and go back to the room" title="Back to the room" @click="powerOff"><PsGlyph name="power" /></button>
          </div>
        </header>

        <template v-if="tab !== 'explore'">
        <div ref="strip" class="strip" role="listbox" :aria-label="tab === 'games' ? 'Games' : 'Videos'" :class="tab">
          <button
            v-for="(tile, index) in row"
            :key="tile.id"
            class="tile"
            role="option"
            :data-index="index"
            :aria-selected="index === focus"
            :aria-label="tile.title"
            :class="{ on: index === focus, live: running?.id === tile.id }"
            :tabindex="index === focus ? 0 : -1"
            @pointerenter="hover(index)"
            @pointerleave="unhover"
            @click="pick(index)"
          >
            <img :src="tile.cover" alt="" loading="lazy" draggable="false">
            <span v-if="!tile.logo && tile.kind === 'game'" class="tile-name">{{ tile.title }}</span>
            <i v-if="running?.id === tile.id" class="live-dot" />
            <span v-if="index === focus" class="tile-label">{{ tile.title }}</span>
          </button>
          <button
            v-if="tab === 'games'"
            class="tile library-tile"
            role="option"
            :data-index="libraryIndex"
            :aria-selected="focus === libraryIndex"
            :class="{ on: focus === libraryIndex }"
            :tabindex="focus === libraryIndex ? 0 : -1"
            aria-label="Game library"
            @pointerenter="hover(libraryIndex)"
            @click="pick(libraryIndex)"
          >
            <PsGlyph name="library" />
            <span v-if="focus === libraryIndex" class="tile-label">Game Library</span>
          </button>
        </div>

        <!-- The selected game's hub -->
        <Transition name="hub" mode="out-in">
          <section v-if="current" :key="current.id" class="hub">
            <p class="eyebrow">
              <span v-if="running?.id === current.id" class="running">Running</span>
              {{ current.meta.join(' · ') }}
            </p>
            <h2>{{ current.title }}</h2>
            <p class="pitch">{{ current.pitch }}</p>
            <div class="actions">
              <button class="play" @click="launch(current)">
                <PsGlyph name="play" />
                {{ running?.id === current.id ? 'Resume' : current.kind === 'video' ? 'Watch' : 'Play Game' }}
              </button>
              <div class="more">
                <button class="round" aria-label="More options" :aria-expanded="options" @click="options = !options; sound('open')"><PsGlyph name="dots" /></button>
                <Transition name="pop">
                  <div v-if="options" class="menu" role="menu">
                    <button role="menuitem" @click="options = false; launch(current, true)"><PsGlyph name="play" />{{ current.kind === 'video' ? 'Watch' : 'Play' }}</button>
                    <a role="menuitem" :href="current.url.replace('youtube-nocookie.com/embed/', 'youtube.com/watch?v=').replace(/\?autoplay.*$/, '')" target="_blank" rel="noopener" @click="options = false"><PsGlyph name="expand" />Open in a new tab</a>
                    <button v-if="running" role="menuitem" @click="options = false; closeGame()"><PsGlyph name="close" />Close {{ running.title }}</button>
                    <button v-if="current.kind === 'game'" role="menuitem" @click="options = false; openLibrary()"><PsGlyph name="library" />Browse the library</button>
                  </div>
                </Transition>
              </div>
            </div>
            <div class="cards">
              <article v-if="current.game" class="card">
                <h3><PsGlyph :name="current.game.phone ? 'touch' : 'keyboard'" />How to play</h3>
                <p>{{ current.game.controls }}</p>
              </article>
              <article v-if="current.game" class="card">
                <h3><PsGlyph name="info" />About</h3>
                <p>Made by {{ current.game.credit }}. {{ current.game.online ? 'Online with real people, so be nice.' : 'Plays on its own, no account needed.' }}</p>
                <small>{{ shelfName(current.game.shelf) }} · {{ current.game.genre }}</small>
              </article>
              <button v-if="nextUp" class="card next" @click="showNext">
                <img :src="nextUp.cover" alt="" loading="lazy">
                <span><small>If you like this</small><b>{{ nextUp.title }}</b></span>
              </button>
              <button class="card trophies" @click="trophyList = true; sound('open')">
                <h3><PsGlyph name="trophy" />Trophies</h3>
                <div class="meter"><i :style="{ width: earned.length / TROPHIES.length * 100 + '%' }" /></div>
                <small>{{ earned.length }} of {{ TROPHIES.length }} · {{ earned.at(-1)?.name ?? 'None yet. Go on.' }}</small>
              </button>
              <article v-if="current.kind === 'video'" class="card">
                <h3><PsGlyph name="film" />Now showing</h3>
                <p>{{ current.pitch }}. Plays here, full screen, no adverts on the way in.</p>
              </article>
            </div>
          </section>
          <section v-else key="library" class="hub">
            <p class="eyebrow">{{ PS_GAMES.length }} games · all free to play</p>
            <h2>Game Library</h2>
            <p class="pitch">Everything on this console, sorted into shelves. Some are tiny, some are enormous, all of them are made by people worth knowing.</p>
            <div class="actions"><button class="play" @click="openLibrary"><PsGlyph name="library" />Open Library</button></div>
          </section>
        </Transition>
        </template>

        <!-- Explore -->
        <section v-else class="explore" aria-label="Explore">
          <Transition name="hub" mode="out-in">
            <button :key="spotlightGame.id" data-nav class="spotlight" :style="{ '--tint': spotlightGame.color }" @click="launch(gameTile(spotlightGame))">
              <img :src="spotlightGame.cover" alt="">
              <span class="spot-copy">
                <small>Spotlight · {{ spotlightGame.genre }}</small>
                <b>{{ spotlightGame.title }}</b>
                <em>{{ spotlightGame.pitch }}</em>
                <span class="play"><PsGlyph name="play" />Play now</span>
              </span>
              <span class="spot-dots" aria-hidden="true"><i v-for="(id, index) in SPOTLIGHT" :key="id" :class="{ on: index === spotlight % SPOTLIGHT.length }" /></span>
            </button>
          </Transition>
          <div v-for="group in collections" :key="group.title" class="collection">
            <h3>{{ group.title }} <small>{{ group.note }}</small></h3>
            <div class="collection-row">
              <button v-for="game in group.games" :key="group.title + game.id" data-nav class="cover" :class="{ square: game.square }" :style="{ '--tint': game.color }" @click="launch(gameTile(game))" @pointerenter="sound('move')">
                <img :src="game.cover" alt="" loading="lazy">
                <span class="cover-copy"><b>{{ game.title }}</b><small>{{ game.genre }}<template v-if="game.online"> · Online</template></small></span>
                <i v-if="running?.id === game.id" class="live-dot" />
              </button>
            </div>
          </div>
          <p class="explore-foot">{{ PS_GAMES.length }} games, every one free and made by people worth following. Credits live in each game's options.</p>
        </section>
      </div>

      <!-- Library and search -->
      <Transition name="sheet">
        <section v-if="library && phase === 'home'" class="library" aria-label="Game library">
          <header>
            <button class="round" aria-label="Back" @click="back"><PsGlyph name="back" /></button>
            <h2>Game Library</h2>
            <label class="search">
              <PsGlyph name="search" />
              <input v-model="query" type="search" placeholder="Search games" :autofocus="searching" @focus="searching = true">
            </label>
          </header>
          <nav class="shelves" aria-label="Shelves">
            <button :class="{ on: shelf === 'all' }" @click="shelf = 'all'; sound('move')">All <small>{{ PS_GAMES.length }}</small></button>
            <button v-for="item in PS_SHELVES" :key="item.id" :class="{ on: shelf === item.id }" @click="shelf = item.id; sound('move')">
              {{ item.name }} <small>{{ PS_GAMES.filter(game => game.shelf === item.id).length }}</small>
            </button>
          </nav>
          <p class="shelf-note">{{ shelf === 'all' ? 'Every game on the console.' : PS_SHELVES.find(item => item.id === shelf)?.note }}</p>
          <div class="grid">
            <button v-for="game in shelfGames" :key="game.id" data-nav class="cover" :style="{ '--tint': game.color }" @click="launch(gameTile(game))" @pointerenter="sound('move')">
              <img :src="game.cover" alt="" loading="lazy">
              <span class="cover-copy">
                <b>{{ game.title }}</b>
                <small>{{ game.genre }}<template v-if="game.phone"> · Touch ready</template><template v-if="game.online"> · Online</template></small>
              </span>
              <i v-if="running?.id === game.id" class="live-dot" />
            </button>
            <p v-if="!shelfGames.length" class="empty">Nothing called that. Yet.</p>
          </div>
        </section>
      </Transition>

      <!-- The game itself -->
      <div v-if="running" v-show="showPlayer" class="player" :class="{ idle: idle && !control && !loading }">
        <iframe
          ref="frame"
          :key="running.id"
          :src="running.url"
          :title="running.title"
          :class="{ square: running.game?.square }"
          allow="autoplay; fullscreen; gamepad; pointer-lock; accelerometer; gyroscope; clipboard-write"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          @load="frameLoaded"
        />
        <Transition name="ps-fade">
          <div v-if="loading" class="veil">
            <img :src="running.cover" alt="">
            <div class="veil-copy">
              <div class="spinner" />
              <b>{{ slow ? 'This one is taking its time' : running.kind === 'video' ? 'Starting the video' : 'Starting ' + running.title }}</b>
              <small v-if="!slow">{{ running.game?.controls ?? running.pitch }}</small>
              <div v-if="slow" class="veil-actions">
                <button class="play" @click="retry"><PsGlyph name="reload" />Try again</button>
                <button class="ghost" @click="closeGame">Pick something else</button>
              </div>
            </div>
          </div>
        </Transition>
        <button class="ps-button" aria-label="Open Control Center" title="Control Center (P)" @click="psButton">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18V6l5 6 5-6v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>

      <!-- Control Center -->
      <Transition name="control">
        <div v-if="control && phase === 'home'" class="control" @click.self="control = false">
          <div class="control-cards">
            <article v-if="running" class="cc-card now">
              <img :src="running.cover" alt="">
              <div>
                <small>{{ running.kind === 'video' ? 'Now watching' : 'Now playing' }}</small>
                <b>{{ running.title }}</b>
                <div class="cc-actions">
                  <button class="play" @click="control = false; showPlayer = true"><PsGlyph name="play" />Resume</button>
                  <button class="ghost" @click="closeGame"><PsGlyph name="close" />Close</button>
                </div>
              </div>
            </article>
            <button class="cc-card" @click="trophyList = true">
              <small>Trophies</small>
              <b>{{ earned.length }} / {{ TROPHIES.length }}</b>
              <div class="meter"><i :style="{ width: earned.length / TROPHIES.length * 100 + '%' }" /></div>
            </button>
            <article v-if="running?.game" class="cc-card">
              <small>Controls</small>
              <p>{{ running.game.controls }}</p>
            </article>
            <article class="cc-card">
              <small>Accessories</small>
              <p>Controller: you. {{ phone ? 'Touch screen detected.' : 'Keyboard and mouse.' }} Battery: not reported, which is the honest answer.</p>
            </article>
          </div>
          <nav class="control-bar" aria-label="Control Center">
            <button @click="goHome"><PsGlyph name="home" /><span>Home</span></button>
            <button @click="control = false; openLibrary()"><PsGlyph name="library" /><span>Library</span></button>
            <button @click="trophyList = true"><PsGlyph name="trophy" /><span>Trophies</span></button>
            <button @click="profile.muted = !profile.muted"><PsGlyph :name="profile.muted ? 'mute' : 'sound'" /><span>{{ profile.muted ? 'Sounds off' : 'Sounds on' }}</span></button>
            <button @click="fullscreen"><PsGlyph name="expand" /><span>Full screen</span></button>
            <button class="off" @click="powerOff"><PsGlyph name="power" /><span>Back to room</span></button>
          </nav>
        </div>
      </Transition>

      <!-- Phone warning for keyboard games -->
      <Transition name="pop">
        <div v-if="confirmPhone" class="modal" @click.self="confirmPhone = null">
          <div class="modal-box">
            <PsGlyph name="keyboard" />
            <h3>{{ confirmPhone.title }} wants a keyboard</h3>
            <p>It runs on a phone, but you will be poking at a game built for WASD. Bold. Or pick something touch ready.</p>
            <div class="cc-actions">
              <button class="play" @click="launch(confirmPhone, true)">Play anyway</button>
              <button class="ghost" @click="confirmPhone = null; openLibrary()">Touch-ready games</button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Trophies -->
      <Transition name="pop">
        <div v-if="trophyList" class="modal" @click.self="trophyList = false">
          <div class="modal-box trophy-box">
            <header>
              <h3>Trophies</h3>
              <button class="round" aria-label="Close trophies" @click="trophyList = false"><PsGlyph name="close" /></button>
            </header>
            <p class="trophy-sum">{{ earned.length }} of {{ TROPHIES.length }} earned in this room. Kept on this device only.</p>
            <ul>
              <li v-for="trophy in TROPHIES" :key="trophy.id" :class="{ got: profile.trophies[trophy.id] }">
                <span class="cup" :style="{ color: tierColor[trophy.tier] }"><PsGlyph name="trophy" /></span>
                <span><b>{{ profile.trophies[trophy.id] || trophy.tier !== 'platinum' ? trophy.name : 'Hidden trophy' }}</b><small>{{ trophy.detail }}</small></span>
                <em>{{ trophy.tier }}</em>
              </li>
            </ul>
          </div>
        </div>
      </Transition>

      <!-- Notifications -->
      <div class="toasts" aria-live="polite">
        <TransitionGroup name="toast">
          <div v-for="toast in toasts" :key="toast.id" class="toast">
            <span class="cup" :style="{ color: toast.trophy ? tierColor[toast.trophy.tier] : '#fff' }"><PsGlyph :name="toast.trophy ? 'trophy' : 'bell'" /></span>
            <span>
              <small>{{ toast.trophy ? 'You earned a trophy' : 'Notice' }}</small>
              <b>{{ toast.title }}</b>
              <em>{{ toast.text }}</em>
            </span>
          </div>
        </TransitionGroup>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Laid out on a 1920 x 1080 board and scaled to the window, like a television; phones get their own layout. */
.ps {
  --u: min(100vw / 1920, 100dvh / 1080);
  --ink: #f6f7f9;
  --soft: #bdc0c8;
  --panel: #101114;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  overflow: hidden;
  color: var(--ink);
  background: #000;
  font-family: "SST", "Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
.ps[open] { animation: ps-on .5s ease-out; }
.ps::backdrop { background: #000; }
.ps :deep(svg) { width: 1em; height: 1em; flex-shrink: 0; }
:where(.ps button, .ps a) { font: inherit; color: inherit; cursor: pointer; background: none; border: 0; padding: 0; text-decoration: none; }
.ps button:focus-visible, .ps a:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
@keyframes ps-on { from { opacity: 0; } }

/* ---------- Boot ---------- */
.boot { position: absolute; inset: 0; z-index: 40; display: grid; place-items: center; background: #000; cursor: pointer; overflow: hidden; }
.boot-glow { position: absolute; inset: -20%; background: radial-gradient(40% 30% at 50% 50%, #2a5bd7 0%, #0a1a4a 35%, transparent 70%); opacity: 0; animation: boot-glow 2.4s ease-out forwards; }
.boot-mark { position: relative; display: grid; justify-items: center; gap: calc(28 * var(--u)); color: #fff; opacity: 0; animation: boot-mark 1.6s .5s ease-out forwards; }
.boot-mark svg { width: calc(170 * var(--u)); height: calc(170 * var(--u)); min-width: 96px; min-height: 96px; filter: drop-shadow(0 0 24px #6fa0ff); }
.boot-mark span { font-size: max(15px, calc(30 * var(--u))); font-weight: 300; letter-spacing: .5em; text-transform: uppercase; padding-left: .5em; }
.boot-mark.ready { transform: translateY(calc(-40 * var(--u))); transition: transform .6s ease; }
.boot-prompt { position: absolute; bottom: 18%; display: flex; gap: 12px; align-items: center; font-size: max(15px, calc(28 * var(--u))); font-weight: 300; color: #d8dbe2; animation: breathe 2.4s ease-in-out infinite; }
.ps-key { padding: 4px 12px; border: 1px solid #ffffff60; border-radius: 999px; font-weight: 500; color: #fff; }
@keyframes boot-glow { 30% { opacity: 1; } 100% { opacity: .55; } }
@keyframes boot-mark { from { opacity: 0; transform: scale(.94); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes breathe { 50% { opacity: .55; } }

/* ---------- Home ---------- */
.home { position: absolute; inset: 0; }
.hero { position: absolute; inset: 0; background: color-mix(in srgb, var(--tint, #12204a) 45%, #05060a); transition: background .5s ease; }
.hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.06); transition: opacity .45s ease, transform 14s linear; }
.hero img.on { opacity: 1; transform: scale(1.04) translate(calc(var(--lx, 0) * -14px), calc(var(--ly, 0) * -10px)); transition: opacity .45s ease, transform .6s cubic-bezier(.2, .8, .2, 1); }
.motes { position: absolute; inset: 0; overflow: hidden; pointer-events: none; mix-blend-mode: screen; }
.motes i { position: absolute; left: calc(var(--n) * 7%); top: calc(20% + var(--n) * 4%); width: calc(30px + var(--n) * 9px); aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--tint, #4f7bff) 60%, #fff) 0%, transparent 70%); opacity: .12;
  animation: mote calc(14s + var(--n) * 1.7s) ease-in-out infinite alternate; animation-delay: calc(var(--n) * -2.3s); will-change: transform; }
@keyframes mote { from { transform: translate3d(0, 30px, 0) scale(.8); } to { transform: translate3d(calc(var(--n) * 6px - 40px), -60px, 0) scale(1.15); opacity: .22; } }
.hero i { position: absolute; inset: 0; pointer-events: none; }
.scrim-top { background: linear-gradient(#000c, #0006 14%, transparent 30%); }
.scrim-left { background: linear-gradient(90deg, #000c 0%, #0008 32%, #0003 55%, transparent 75%); }
.scrim-bottom { background: linear-gradient(transparent 52%, #000a 76%, #000e); }

.topbar { position: absolute; z-index: 5; top: calc(48 * var(--u)); left: calc(112 * var(--u)); right: calc(112 * var(--u)); display: flex; align-items: center; justify-content: space-between; }
.tabs { display: flex; gap: calc(44 * var(--u)); }
.tabs button { font-size: max(16px, calc(32 * var(--u))); font-weight: 400; color: #ffffff8a; transition: color .15s ease; }
.tabs button.on { color: #fff; font-weight: 500; }
.tabs button:hover { color: #fff; }
.system { display: flex; align-items: center; gap: calc(30 * var(--u)); font-size: max(18px, calc(30 * var(--u))); }
.icon { display: grid; place-items: center; width: max(40px, calc(52 * var(--u))); height: max(40px, calc(52 * var(--u))); border-radius: 50%; transition: background .15s ease; }
.icon:hover { background: #ffffff1f; }
.avatar { position: relative; display: grid; place-items: center; width: max(36px, calc(48 * var(--u))); height: max(36px, calc(48 * var(--u))); border-radius: 50%; background: linear-gradient(140deg, #ff9a3c, #e8458b 55%, #6a5cff); font-size: .62em; font-weight: 600; box-shadow: 0 0 0 2px #ffffff30; }
.avatar b { position: absolute; right: -6px; bottom: -4px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px; background: #fff; color: #000; font-size: 11px; line-height: 18px; }
.system time { font-size: max(16px, calc(28 * var(--u))); font-variant-numeric: tabular-nums; }
.power { color: #ffffffc0; }

.strip { position: absolute; z-index: 4; top: calc(132 * var(--u)); left: 0; right: 0; display: flex; align-items: flex-start; gap: calc(16 * var(--u)); padding: 8px calc(112 * var(--u)) 60px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; scroll-padding-inline: calc(112 * var(--u)); }
.strip::-webkit-scrollbar { display: none; }
.tile { position: relative; flex: none; width: calc(108 * var(--u)); height: calc(108 * var(--u)); min-width: 58px; min-height: 58px; border-radius: calc(14 * var(--u)); background: #ffffff14; box-shadow: 0 6px 20px #0007; transition: width .2s ease-out, height .2s ease-out, margin .2s ease-out; }
.tile img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
.tile.on { width: calc(172 * var(--u)); height: calc(172 * var(--u)); min-width: 92px; min-height: 92px; margin-right: calc(var(--label, 300px)); }
.tile.on::after { content: ""; position: absolute; inset: -6px; border: 2px solid #fff; border-radius: calc(14 * var(--u) + 6px); box-shadow: 0 0 0 2px #0006 inset, 0 0 24px #ffffff40; animation: ring .14s ease-out; }
.tile:focus-visible { outline: 0; }
.tile-name { position: absolute; inset: auto 6px 6px; font-size: max(9px, calc(14 * var(--u))); font-weight: 700; line-height: 1.1; text-shadow: 0 1px 4px #000; text-align: left; }
.tile-label { position: absolute; left: calc(100% + 26 * var(--u)); bottom: calc(6 * var(--u)); width: max-content; max-width: calc(380 * var(--u)); font-size: max(15px, calc(28 * var(--u))); font-weight: 400; text-align: left; text-shadow: 0 2px 8px #0008; animation: label-in .18s ease-out; }
.strip.games .tile.on { --label: calc(330 * var(--u)); }
.strip.media .tile { width: calc(192 * var(--u)); min-width: 104px; }
.strip.media .tile.on { width: calc(300 * var(--u)); min-width: 160px; --label: calc(330 * var(--u)); }
.library-tile { display: grid; place-items: center; font-size: max(22px, calc(44 * var(--u))); background: #ffffff1c; backdrop-filter: blur(10px); }
.live-dot { position: absolute; top: 8px; right: 8px; width: 10px; height: 10px; border-radius: 50%; background: #3f7bff; box-shadow: 0 0 0 3px #0008, 0 0 12px #3f7bff; }
@keyframes ring { from { opacity: 0; transform: scale(.96); } }
@keyframes label-in { from { opacity: 0; transform: translateX(-6px); } }

.hub { position: absolute; z-index: 3; left: calc(120 * var(--u)); right: calc(112 * var(--u)); top: calc(400 * var(--u)); bottom: calc(40 * var(--u)); display: flex; flex-direction: column; }
.eyebrow { margin: 0; display: flex; align-items: center; gap: 12px; font-size: max(13px, calc(22 * var(--u))); color: var(--soft); letter-spacing: .02em; }
.running { padding: 2px 10px; border-radius: 999px; background: #3f7bff; color: #fff; font-size: .8em; font-weight: 600; }
.hub h2 { margin: calc(10 * var(--u)) 0 0; max-width: calc(1000 * var(--u)); font-size: max(30px, calc(76 * var(--u))); line-height: 1.02; font-weight: 600; letter-spacing: -.01em; text-shadow: 0 4px 30px #0009; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pitch { margin: calc(16 * var(--u)) 0 0; max-width: calc(760 * var(--u)); min-width: min(100%, 300px); font-size: max(15px, calc(27 * var(--u))); line-height: 1.4; color: #e3e5ea; font-weight: 300; }
.actions { display: flex; align-items: center; gap: calc(16 * var(--u)); margin-top: calc(34 * var(--u)); }
.play { white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; gap: 12px; height: max(46px, calc(66 * var(--u))); min-width: max(150px, calc(300 * var(--u))); padding: 0 calc(36 * var(--u)); border-radius: 999px; background: #f6f7f9 !important; color: #17191d !important; font-size: max(16px, calc(27 * var(--u))) !important; font-weight: 600 !important; box-shadow: 0 10px 30px #0006; transition: transform .1s ease, box-shadow .2s ease; }
.play:hover { box-shadow: 0 0 0 4px #ffffff40, 0 10px 30px #0006; }
.play:active { transform: scale(.97); }
.round { display: grid; place-items: center; width: max(46px, calc(66 * var(--u))); height: max(46px, calc(66 * var(--u))); border-radius: 50%; background: #ffffff26 !important; backdrop-filter: blur(14px); font-size: max(20px, calc(30 * var(--u))) !important; transition: background .15s ease; }
.round:hover { background: #ffffff40 !important; }
.ghost { white-space: nowrap; display: inline-flex; align-items: center; gap: 10px; height: max(42px, calc(60 * var(--u))); padding: 0 calc(28 * var(--u)); border-radius: 999px; background: #ffffff21 !important; font-weight: 500; }
.ghost:hover { background: #ffffff38 !important; }
.more { position: relative; }
.menu { position: absolute; left: 0; bottom: calc(100% + 12px); z-index: 10; display: grid; min-width: 260px; padding: 8px; border-radius: 16px; background: #1c1d22f2; backdrop-filter: blur(24px); box-shadow: 0 20px 50px #000a, inset 0 1px 0 #ffffff14; }
.menu > * { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; font-size: 16px; text-align: left; white-space: nowrap; }
.menu > *:hover { background: #ffffff1a; }
.cards { display: flex; gap: calc(16 * var(--u)); margin-top: auto; padding-top: 24px; overflow-x: auto; scrollbar-width: none; }
.cards::-webkit-scrollbar { display: none; }
.card { flex: none; display: flex; flex-direction: column; gap: 10px; width: max(220px, calc(380 * var(--u))); min-height: max(120px, calc(190 * var(--u))); padding: calc(24 * var(--u)) calc(26 * var(--u)); border-radius: calc(14 * var(--u)); background: #16171cd9; backdrop-filter: blur(20px); box-shadow: inset 0 1px 0 #ffffff12; text-align: left; transition: transform .15s ease, background .15s ease; }
button.card:hover { background: #22232ae6; transform: translateY(-3px); }
.card h3 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: max(14px, calc(23 * var(--u))); font-weight: 500; }
.card h3 :deep(svg) { color: #9fb7ff; }
.card p { margin: 0; font-size: max(13px, calc(21 * var(--u))); line-height: 1.4; color: #c9ccd4; font-weight: 300; }
.card small { margin-top: auto; font-size: max(12px, calc(18 * var(--u))); color: #9a9eaa; }
.card.next { flex-direction: row; align-items: stretch; padding: 0; overflow: hidden; }
.card.next img { width: 45%; object-fit: cover; }
.card.next span { display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 18px; }
.card.next small { margin: 0; }
.card.next b { font-size: max(15px, calc(25 * var(--u))); font-weight: 500; }
.meter { height: 6px; border-radius: 3px; background: #ffffff1f; overflow: hidden; }
.meter i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #8fb0ff, #fff); transition: width .6s ease; }

/* ---------- Explore ---------- */
.explore { position: absolute; z-index: 4; inset: calc(118 * var(--u)) 0 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; padding: 8px calc(112 * var(--u)) 60px; }
.explore::-webkit-scrollbar { display: none; }
.spotlight { position: relative; display: block; width: 100%; height: clamp(220px, calc(430 * var(--u)), 460px); border-radius: 20px; overflow: hidden; text-align: left; box-shadow: 0 24px 60px #000a; transition: transform .2s ease, box-shadow .2s ease; }
.spotlight img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.02); transition: transform 6s ease; }
.spotlight:hover img { transform: scale(1.08); }
.spotlight::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, #000d 0%, #0008 40%, transparent 75%), linear-gradient(transparent 60%, #000a); }
.spotlight:focus-visible { box-shadow: 0 0 0 4px #fff, 0 24px 60px #000a; }
.spot-copy { position: absolute; z-index: 1; left: 44px; bottom: 40px; max-width: 520px; display: grid; gap: 10px; }
.spot-copy small { font-size: 14px; letter-spacing: .12em; text-transform: uppercase; color: #ffffffb0; }
.spot-copy b { font-size: clamp(30px, calc(60 * var(--u)), 60px); line-height: 1; font-weight: 600; }
.spot-copy em { font-style: normal; font-size: 18px; line-height: 1.4; color: #e2e4ea; font-weight: 300; }
.spot-copy .play { justify-self: start; margin-top: 8px; height: 52px; min-width: 180px; font-size: 18px !important; }
.spot-dots { position: absolute; z-index: 1; right: 28px; bottom: 26px; display: flex; gap: 6px; }
.spot-dots i { width: 7px; height: 7px; border-radius: 4px; background: #ffffff55; transition: width .3s ease, background .3s ease; }
.spot-dots i.on { width: 22px; background: #fff; }
.collection { margin-top: 34px; }
.collection h3 { display: flex; align-items: baseline; gap: 14px; margin: 0 0 14px; font-size: 22px; font-weight: 500; }
.collection h3 small { font-size: 14px; color: #9a9eaa; font-weight: 400; }
.collection-row { display: flex; gap: 16px; overflow-x: auto; padding: 6px 4px 14px; scrollbar-width: none; scroll-snap-type: x proximity; }
.collection-row::-webkit-scrollbar { display: none; }
.collection-row .cover { flex: none; width: 280px; padding-top: 0; height: 175px; scroll-snap-align: start; }
.collection-row .cover.square img { object-position: center 30%; }
.explore-foot { margin: 36px 0 0; color: #7d818c; font-size: 13px; }
.phone .explore { inset: calc(max(14px, env(safe-area-inset-top)) + 52px) 0 0; padding: 6px 16px 40px; }
.phone .spotlight { height: 240px; border-radius: 16px; }
.phone .spot-copy { left: 20px; bottom: 22px; right: 20px; }
.phone .spot-copy em { font-size: 14px; }
.phone .collection-row .cover { width: 200px; height: 125px; }

/* ---------- Library ---------- */
.library { position: absolute; inset: 0; z-index: 12; display: flex; flex-direction: column; padding: calc(48 * var(--u)) calc(112 * var(--u)) 0; background: linear-gradient(#0b0d14f5, #07080cfa); backdrop-filter: blur(30px); }
.library header { display: flex; align-items: center; gap: calc(28 * var(--u)); }
.library h2 { margin: 0; font-size: max(24px, calc(44 * var(--u))); font-weight: 500; }
.search { margin-left: auto; display: flex; align-items: center; gap: 10px; height: 48px; width: min(420px, 40vw); padding: 0 18px; border-radius: 999px; background: #ffffff17; font-size: 20px; }
.search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: #fff; font: inherit; font-size: 16px; }
.search input::placeholder { color: #ffffff80; }
.shelves { display: flex; gap: 10px; margin-top: calc(34 * var(--u)); overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
.shelves button { flex: none; height: 44px; padding: 0 20px; border-radius: 999px; background: #ffffff12 !important; font-size: 16px !important; transition: background .15s ease, color .15s ease; }
.shelves button small { margin-left: 6px; opacity: .6; }
.shelves button.on { background: #fff !important; color: #111 !important; font-weight: 600 !important; }
.shelf-note { margin: 14px 0 0; color: #9a9eaa; font-size: 15px; }
.grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; align-content: start; margin-top: 20px; padding-bottom: 48px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #ffffff30 transparent; }
.cover { position: relative; display: block; width: 100%; height: 0; padding-top: 62.5%; border-radius: 14px; overflow: hidden; background: var(--tint); box-shadow: 0 10px 30px #0008; text-align: left; transition: transform .18s ease, box-shadow .18s ease; }
.cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; }
.cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(transparent 45%, #000d); }
.cover:hover, .cover:focus-visible { transform: translateY(-4px); box-shadow: 0 0 0 3px #fff, 0 18px 40px #000a; }
.cover:hover img { transform: scale(1.05); }
.cover-copy { position: absolute; z-index: 1; left: 16px; right: 16px; bottom: 14px; display: grid; gap: 3px; }
.cover-copy b { font-size: 19px; font-weight: 600; }
.cover-copy small { font-size: 13px; color: #d4d6dc; }
.cover .live-dot { z-index: 2; }
.empty { grid-column: 1 / -1; color: #9a9eaa; font-size: 18px; }

/* ---------- Player ---------- */
.player { position: absolute; inset: 0; z-index: 20; background: #000; }
.player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: #000; }
/* PICO-8 carts are square: frame them in the middle like a handheld held up to the screen. */
.player iframe.square { left: 50%; right: auto; width: min(100vw, calc(100dvh * 1.08)); transform: translateX(-50%); }
.player:has(iframe.square) { background: radial-gradient(70% 90% at 50% 50%, #1d1a2b, #000 70%); }
.veil { position: absolute; inset: 0; display: grid; place-items: center; background: #000; }
.veil img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(30px) brightness(.45); transform: scale(1.1); }
.veil-copy { position: relative; display: grid; justify-items: center; gap: 14px; max-width: 560px; padding: 24px; text-align: center; }
.veil-copy b { font-size: clamp(20px, 2.4vw, 34px); font-weight: 500; }
.veil-copy small { color: #d7d9df; font-size: 15px; line-height: 1.5; }
.veil-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 8px; }
.spinner { width: 46px; height: 46px; border-radius: 50%; border: 3px solid #ffffff30; border-top-color: #fff; animation: spin .9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.ps-button { position: absolute; z-index: 3; top: 16px; left: 16px; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: #0b0c10cc !important; backdrop-filter: blur(10px); box-shadow: 0 0 0 1px #ffffff2e, 0 6px 18px #0008; font-size: 22px; transition: opacity .4s ease, transform .15s ease; }
.ps-button svg { width: 24px; height: 24px; }
.ps-button:hover { transform: scale(1.08); }
.player.idle .ps-button { opacity: .28; }

/* ---------- Control Center ---------- */
.control { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; justify-content: flex-end; background: linear-gradient(transparent 30%, #000b 70%); }
.control-cards { display: flex; gap: 16px; padding: 0 calc(112 * var(--u)) 24px; overflow-x: auto; scrollbar-width: none; }
.cc-card { flex: none; display: flex; flex-direction: column; gap: 10px; width: 300px; min-height: 170px; padding: 20px; border-radius: 16px; background: #1b1c22f0; backdrop-filter: blur(24px); box-shadow: inset 0 1px 0 #ffffff14, 0 16px 40px #0008; text-align: left; }
.cc-card small { color: #9a9eaa; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
.cc-card b { font-size: 22px; font-weight: 500; }
.cc-card p { margin: 0; font-size: 15px; line-height: 1.45; color: #cfd2d9; }
.cc-card.now { flex-direction: row; width: 460px; padding: 0; overflow: hidden; }
.cc-card.now img { width: 42%; object-fit: cover; }
.cc-card.now > div { display: flex; flex-direction: column; gap: 8px; padding: 20px; }
.cc-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto; }
.cc-actions .play { min-width: 0; height: 44px; padding: 0 20px; font-size: 16px !important; }
.cc-actions .ghost { height: 44px; padding: 0 18px; font-size: 15px; }
.control-bar { display: flex; justify-content: center; gap: 8px; padding: 14px calc(112 * var(--u)) max(18px, env(safe-area-inset-bottom)); border-top: 1px solid #ffffff1c; background: #0d0e12f2; backdrop-filter: blur(30px); }
.control-bar button { display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 92px; padding: 10px 12px; border-radius: 14px; font-size: 26px; transition: background .15s ease; }
.control-bar button span { font-size: 12px; color: #c4c7cf; }
.control-bar button:hover, .control-bar button:focus-visible { background: #ffffff1c; }
.control-bar .off { color: #ff9b8f; }

/* ---------- Modals and notices ---------- */
.modal { position: absolute; inset: 0; z-index: 35; display: grid; place-items: center; padding: 20px; background: #000a; backdrop-filter: blur(6px); }
.modal-box { display: grid; gap: 12px; width: min(480px, 100%); padding: 28px; border-radius: 20px; background: #1b1c22; box-shadow: 0 30px 80px #000c, inset 0 1px 0 #ffffff14; font-size: 30px; }
.modal-box h3 { margin: 0; font-size: 22px; font-weight: 600; }
.modal-box p { margin: 0; font-size: 15px; line-height: 1.5; color: #c9ccd4; }
.trophy-box { width: min(560px, 100%); max-height: min(720px, 90dvh); grid-template-rows: auto auto minmax(0, 1fr); }
.trophy-box header { display: flex; align-items: center; justify-content: space-between; }
.trophy-box .round { width: 44px; height: 44px; font-size: 20px !important; }
.trophy-sum { font-size: 14px !important; }
.trophy-box ul { margin: 0; padding: 0; list-style: none; overflow-y: auto; display: grid; gap: 6px; }
.trophy-box li { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 12px; background: #ffffff08; opacity: .5; }
.trophy-box li.got { opacity: 1; background: #ffffff10; }
.trophy-box li span:nth-child(2) { display: grid; gap: 2px; flex: 1; }
.trophy-box li b { font-size: 16px; font-weight: 500; }
.trophy-box li small { font-size: 13px; color: #a6a9b3; }
.trophy-box li em { font-size: 11px; font-style: normal; text-transform: uppercase; letter-spacing: .1em; color: #8a8e99; }
.cup { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: #ffffff10; font-size: 22px; }
.toasts { position: absolute; z-index: 50; top: calc(48 * var(--u) + 60px); right: calc(56 * var(--u)); display: grid; gap: 10px; pointer-events: none; }
.toast { display: flex; align-items: center; gap: 14px; width: min(440px, calc(100vw - 32px)); padding: 14px 18px; border-radius: 14px; background: #1c1d22f5; backdrop-filter: blur(20px); box-shadow: 0 16px 40px #000b, inset 0 1px 0 #ffffff17; }
.toast span:last-child { display: grid; gap: 2px; }
.toast small { font-size: 12px; color: #9a9eaa; text-transform: uppercase; letter-spacing: .08em; }
.toast b { font-size: 17px; font-weight: 600; }
.toast em { font-size: 14px; font-style: normal; color: #c9ccd4; }

/* ---------- Transitions ---------- */
.ps-fade-enter-active, .ps-fade-leave-active { transition: opacity .35s ease; }
.ps-fade-enter-from, .ps-fade-leave-to { opacity: 0; }
.hub-enter-active { transition: opacity .22s ease, transform .22s ease; }
.hub-leave-active { transition: opacity .12s ease; }
.hub-enter-from { opacity: 0; transform: translateY(8px); }
.hub-leave-to { opacity: 0; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .25s ease, transform .25s ease; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; transform: translateY(24px); }
.control-enter-active, .control-leave-active { transition: opacity .24s ease; }
.control-enter-active .control-cards, .control-enter-active .control-bar { transition: transform .26s cubic-bezier(.2, .8, .2, 1); }
.control-enter-from, .control-leave-to { opacity: 0; }
.control-enter-from .control-cards, .control-enter-from .control-bar { transform: translateY(28px); }
.pop-enter-active, .pop-leave-active { transition: opacity .18s ease, transform .18s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(.96); }
.toast-enter-active { transition: opacity .22s ease, transform .22s ease; }
.toast-leave-active { transition: opacity .2s ease; }
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to { opacity: 0; }

/* ---------- Phones ---------- */
.phone .topbar { top: max(14px, env(safe-area-inset-top)); left: 16px; right: 10px; }
.phone .tabs { gap: 20px; }
.phone .tabs button { font-size: 18px; }
.phone .system { gap: 4px; }
.phone .system time { display: none; }
.phone .strip { top: calc(max(14px, env(safe-area-inset-top)) + 54px); gap: 10px; padding: 8px 16px 40px; scroll-padding-inline: 16px; }
.phone .tile { width: 72px; height: 72px; min-width: 0; min-height: 0; border-radius: 12px; }
.phone .tile.on { width: 104px; height: 104px; margin-right: 0; }
.phone .tile-label { display: none; }
.phone .strip.media .tile { width: 112px; }
.phone .strip.media .tile.on { width: 170px; }
.phone .hub { left: 16px; right: 16px; top: calc(max(14px, env(safe-area-inset-top)) + 190px); bottom: max(16px, env(safe-area-inset-bottom)); }
.phone .hub h2 { font-size: 30px; }
.phone .pitch { font-size: 15px; max-width: none; }
.phone .actions { margin-top: 18px; }
.phone .play { flex: 1; min-width: 0; height: 50px; font-size: 17px !important; }
.phone .round { width: 50px; height: 50px; }
.phone .cards { margin-top: 18px; }
.phone .card { width: 240px; min-height: 0; padding: 16px; border-radius: 14px; }
.phone .scrim-left { background: linear-gradient(90deg, #000a, #0006 60%, #0003); }
.phone .scrim-bottom { background: linear-gradient(transparent 20%, #000b 55%, #000e); }
.phone .library { padding: max(14px, env(safe-area-inset-top)) 16px 0; }
.phone .library header { flex-wrap: wrap; gap: 12px; }
.phone .search { order: 3; width: 100%; margin: 0; }
.phone .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
.phone .cover-copy b { font-size: 15px; }
.phone .cover-copy small { font-size: 11px; }
.phone .control-cards { padding: 0 16px 16px; }
.phone .cc-card { width: 240px; min-height: 140px; }
.phone .cc-card.now { width: 320px; }
.phone .control-bar { justify-content: flex-start; overflow-x: auto; padding: 10px 10px max(14px, env(safe-area-inset-bottom)); }
.phone .control-bar button { min-width: 74px; font-size: 22px; }
.phone .ps-button { top: max(10px, env(safe-area-inset-top)); left: 10px; }
.phone .toasts { top: auto; bottom: max(16px, env(safe-area-inset-bottom)); right: 12px; left: 12px; }
.phone .toast { width: 100%; padding: 12px 14px; }
.phone .toast em { display: none; }
.phone .toast-enter-from { transform: translateY(20px); }

@media (prefers-reduced-motion: reduce) {
  .ps *, .ps *::before, .ps *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
</style>
