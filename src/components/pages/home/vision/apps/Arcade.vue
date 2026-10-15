<script setup lang="ts">
import { listenAsApp } from '../bus';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { PS_GAMES, PS_SHELVES, type PsGame } from '~/common/playstation/games';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import ArcadeIcon from './arcade/ArcadeIcon.vue';
import GameCard from './arcade/GameCard.vue';
import AppSheet from './arcade/AppSheet.vue';
import GamePage from './arcade/GamePage.vue';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const view = ref('featured');
const query = ref('');
const touchOnly = ref(false);
const recent = ref<string[]>([]);
const current = ref<PsGame | null>(null);
const detail = ref<PsGame | null>(null);
const favorites = ref<string[]>([]);
const playedGames = ref<string[]>([]);
const playedGenres = computed(() => new Set(playedGames.value.map(id => PS_GAMES.find(game => game.id === id)?.shelf).filter(Boolean)).size);
const quickPicks = computed(() => [
 { game: PS_GAMES.find(game => game.id === 'sandspiel')!, note: 'Make something' },
 { game: PS_GAMES.find(game => game.id === 'swooop')!, note: 'Take a quick flight' },
 { game: PS_GAMES.find(game => game.id === '2048') ?? PS_GAMES.find(game => game.phone)!, note: 'A little brain break' },
]);
const pending = ref<PsGame | null>(null);
const info = ref(false);
const loading = ref(false);
const slow = ref(false);
const revision = ref(0);
const player = ref<HTMLElement>();
const content = ref<HTMLElement>();
const arcadeRoot = ref<HTMLElement>();
const heroIndex = ref(0);
const heroHovered = ref(false);
const heroFocused = ref(false);
const reduced = ref(false);
const tilt = ref('');
const featured = ['minecraft', 'swooop', 'sandspiel', 'celeste', 'hexgl'].map(id => PS_GAMES.find(game => game.id === id)!).filter(Boolean);
const hero = computed(() => featured[heroIndex.value] ?? PS_GAMES[0]!);
const navigation = [{ id: 'featured', name: 'Featured' }, ...PS_SHELVES, { id: 'search', name: 'Search' }];
const title = computed(() => navigation.find(item => item.id === view.value)?.name ?? 'Featured');
const subtitle = computed(() => PS_SHELVES.find(item => item.id === view.value)?.note ?? 'Independent adventures, beautifully at home in your space.');
const results = computed(() => PS_GAMES.filter(game => {
  const matches = view.value === 'search' ? (game.title + ' ' + game.genre + ' ' + game.pitch).toLowerCase().includes(query.value.trim().toLowerCase()) : game.shelf === view.value;
  return matches && (!touchOnly.value || game.phone);
}));
const rows = computed(() => {
  const shelves = PS_SHELVES.map(shelf => ({ ...shelf, games: PS_GAMES.filter(game => game.shelf === shelf.id && (!touchOnly.value || game.phone)) }));
  const games = recent.value.map(id => PS_GAMES.find(game => game.id === id)).filter((game): game is PsGame => !!game && (!touchOnly.value || game.phone));
  return [...(games.length ? [{ id: 'recent', name: 'Recently played', note: 'Another round?', games }] : []), ...shelves].filter(shelf => shelf.games.length);
});
let rotation: ReturnType<typeof setInterval> | undefined;
let arcadeVisible = true;
let arcadeMounted = false;
let arcadeObserver: IntersectionObserver | undefined;
let loadDelay: ReturnType<typeof setTimeout> | undefined;
let slowDelay: ReturnType<typeof setTimeout> | undefined;
let preference: MediaQueryList | undefined;
function navigate(id: string): void { detail.value = null; view.value = id; content.value?.scrollTo({ top: 0 }); }
function backFromDetails(): void { detail.value = null; void nextTick(() => arcadeRoot.value?.querySelector<HTMLButtonElement>('.nav-item[aria-pressed="true"]')?.focus()); }
function showGame(game: PsGame): void { detail.value = game; tilt.value = ''; }
function toggleFavorite(game: PsGame): void {
  favorites.value = favorites.value.includes(game.id) ? favorites.value.filter(id => id !== game.id) : [...favorites.value,game.id];
  try { localStorage.setItem('lab-vision-arcade-favorites', JSON.stringify(favorites.value)); } catch { vision.toast('Favorites stay in this session.'); }
}
function detailKeys(event: KeyboardEvent): void { if (event.key === 'Escape' && detail.value && !current.value && !pending.value) { event.preventDefault(); event.stopPropagation(); backFromDetails(); } }
function clearLoading(): void { clearTimeout(loadDelay); clearTimeout(slowDelay); }
function beginLoading(): void {
  clearLoading(); loading.value = true; slow.value = false;
  slowDelay = setTimeout(() => { if (loading.value) slow.value = true; }, 25000);
}
function play(game: PsGame, force = false): void {
  if (props.compact && !game.phone && !force) { pending.value = game; return; }
  pending.value = null; current.value = game; revision.value++; beginLoading();
  if (!playedGames.value.includes(game.id)) playedGames.value.push(game.id);
  try { localStorage.setItem('lab-vision-arcade-played', JSON.stringify(playedGames.value)); } catch { /* Milestones stay in this session. */ }
  recent.value = [game.id, ...recent.value.filter(id => id !== game.id)].slice(0, 8);
  try { localStorage.setItem('lab-vision-arcade-recent', JSON.stringify(recent.value)); } catch { vision.toast('Recently played stays in this session.'); }
}
function loaded(): void {
  clearTimeout(loadDelay);
  loadDelay = setTimeout(() => { loading.value = false; slow.value = false; clearTimeout(slowDelay); }, 900);
}
function retry(): void { revision.value++; beginLoading(); }
function back(): void { clearLoading(); current.value = null; loading.value = false; slow.value = false; info.value = false; }
function pickTouch(): void { pending.value = null; touchOnly.value = true; navigate('search'); query.value = ''; }
async function fullscreen(): Promise<void> {
  try {
    if (!player.value?.requestFullscreen) { vision.toast('Full screen is unavailable in this browser.'); return; }
    if (document.fullscreenElement === player.value) await document.exitFullscreen();
    else await player.value.requestFullscreen();
  } catch { vision.toast('The browser could not enter full screen. Your game is still here.'); }
}
function pointer(event: PointerEvent): void {
  if (props.compact || reduced.value || event.pointerType === 'touch') return;
  const box = event.currentTarget instanceof HTMLElement ? event.currentTarget.getBoundingClientRect() : null;
  if (!box) return;
  const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
  const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
  tilt.value = 'perspective(1100px) rotateX(' + (-y * 4) + 'deg) rotateY(' + (x * 4) + 'deg)';
}
function refreshRotation(): void {
  clearInterval(rotation); rotation = undefined;
  if (!arcadeMounted || document.hidden || !arcadeVisible || reduced.value || current.value || detail.value || pending.value || view.value !== 'featured') return;
  rotation = setInterval(() => { if (!heroHovered.value && !heroFocused.value) heroIndex.value = (heroIndex.value + 1) % featured.length; }, 8000);
}
function motion(): void { reduced.value = preference?.matches ?? false; if (reduced.value) tilt.value = ''; refreshRotation(); }
watch([current, detail, pending, view], refreshRotation);
async function tabKeys(event: KeyboardEvent): Promise<void> {
  if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return;
  const index = navigation.findIndex(item => item.id === view.value);
  const next = navigation[(index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + navigation.length) % navigation.length];
  if (next) { event.preventDefault(); const nav = event.currentTarget as HTMLElement; navigate(next.id); await nextTick(); nav.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus(); }
}
onMounted(() => {
  arcadeMounted = true;
  document.addEventListener('visibilitychange', refreshRotation);
  if (arcadeRoot.value && typeof IntersectionObserver !== 'undefined') { arcadeObserver = new IntersectionObserver(entries => { arcadeVisible = entries[0]?.isIntersecting ?? false; refreshRotation(); }); arcadeObserver.observe(arcadeRoot.value); }
  try { const saved: unknown = JSON.parse(localStorage.getItem('lab-vision-arcade-recent') ?? '[]'); if (Array.isArray(saved)) recent.value = [...new Set(saved.filter((id): id is string => typeof id === 'string' && PS_GAMES.some(game => game.id === id)))].slice(0, 8); } catch { /* A fresh shelf is perfectly fine. */ }
  try { const saved: unknown = JSON.parse(localStorage.getItem('lab-vision-arcade-favorites') ?? '[]'); if (Array.isArray(saved)) favorites.value = [...new Set(saved.filter((id): id is string => typeof id === 'string' && PS_GAMES.some(game => game.id === id)))]; } catch { /* Favorites start empty. */ }
  playedGames.value = [...recent.value];
  try { const saved: unknown = JSON.parse(localStorage.getItem('lab-vision-arcade-played') ?? 'null'); if (Array.isArray(saved)) playedGames.value = [...new Set([...playedGames.value,...saved.filter((id): id is string => typeof id === 'string' && PS_GAMES.some(game => game.id === id))])]; } catch { /* The recent shelf still supplies local milestones. */ }
  preference = window.matchMedia('(prefers-reduced-motion: reduce)'); motion(); preference.addEventListener('change', motion);
  refreshRotation();
});
onBeforeUnmount(() => {
  stopJarvis(); arcadeMounted = false; document.removeEventListener('visibilitychange', refreshRotation); arcadeObserver?.disconnect(); clearLoading(); clearInterval(rotation); preference?.removeEventListener('change', motion); });
function jarvisMatch(value: string): string {
  return value.toLowerCase().replace(/\b(the|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
// JARVIS can work in Arcade: play, list.
const stopJarvis = listenAsApp('arcade', async command => {
  let line = "I can't do that in Arcade yet.";
  try {
    await nextTick();
    switch (command.verb) {
      case 'play': {
        const term = jarvisMatch(typeof command.arg === 'string' ? command.arg : '');
        const game = term ? PS_GAMES.find(item => jarvisMatch(item.title) === term)
          ?? PS_GAMES.find(item => jarvisMatch(item.title).includes(term)) : undefined;
        if (!game) { line = "I couldn't find that game in Arcade."; break; }
        play(game);
        line = pending.value ? 'Opened the keyboard warning for ' + game.title + '.' : 'Launched ' + game.title + '.';
        break;
      }
      case 'list':
        back();
        pending.value = null;
        touchOnly.value = false;
        query.value = '';
        navigate('search');
        line = 'Available games include ' + PS_GAMES.slice(0, 3).map(game => game.title).join(', ')
          + ', with ' + Math.max(0, PS_GAMES.length - 3) + ' more in the open list.';
        break;
    }
  } catch { line = "I couldn't finish that in Arcade."; }
  try { (command.reply as ((line: string) => void) | undefined)?.(line); } catch { /* A reply must not interrupt the app. */ }
});
</script>

<template>
  <div ref="arcadeRoot" class="arcade-app" :class="{ compact }" @keydown="detailKeys">
    <GamePage v-if="detail && !current" :game="detail" :favorite="favorites.includes(detail.id)" :played="playedGames.includes(detail.id)" :genres="playedGenres" :inert="pending ? true : undefined" @back="backFromDetails" @play="play" @favorite="toggleFavorite" @select="showGame" />
    <div v-else-if="!current" class="browse-layout" :inert="pending ? true : undefined">
      <nav class="tabs vk-tabbar vk-scroll" aria-label="Arcade shelves" @keydown="tabKeys">
        <button v-for="item in navigation" :key="item.id" v-hover class="nav-item" :aria-pressed="view === item.id" :title="item.name" @click="navigate(item.id)"><span class="vk-icon"><ArcadeIcon :name="item.id" /></span><span>{{ item.name }}</span></button>
      </nav>
      <main ref="content" class="browse-content vk-scroll">
        <header class="page-heading"><div><span class="vk-footnote vk-secondary">ARCADE / INDEPENDENT GAME LIBRARY</span><h1 class="vk-large-title">{{ title }}</h1></div><span class="vk-chip">{{ PS_GAMES.length }} games</span></header>
        <p class="vk-body vk-secondary intro">{{ subtitle }}</p>
        <div v-if="view === 'search'" class="search-tools"><input v-model="query" v-hover type="search" class="vk-field" placeholder="Find a game, genre, or tiny adventure" aria-label="Search game library" /><button v-hover class="vk-button" :aria-pressed="touchOnly" @click="touchOnly = !touchOnly">Touch ready</button></div>
        <template v-if="view === 'featured'">
          <div class="opening-selection">
          <section class="hero" :style="{ transform: tilt }" aria-label="Featured games" @pointermove="pointer" @pointerenter="heroHovered = true" @pointerleave="heroHovered = false; tilt = ''" @focusin="heroFocused = true" @focusout="heroFocused = false">
            <Transition name="cover"><img :key="hero.id" :src="hero.cover" alt="" class="hero-cover" /></Transition>
            <div class="hero-shade" />
            <Transition name="copy" mode="out-in"><div :key="hero.id" class="hero-copy"><span class="vk-footnote">TONIGHT'S NEXT ADVENTURE</span><h2>{{ hero.title }}</h2><p>{{ hero.pitch }}</p><div class="hero-actions"><span class="vk-chip">{{ hero.genre }}</span><span class="vk-chip">{{ hero.phone ? 'Touch ready' : 'Keyboard' }}</span><button v-hover class="vk-button primary" @click="play(hero)"><ArcadeIcon name="play" />Play</button><button v-hover class="vk-button details-button" @click="showGame(hero)">Details</button></div></div></Transition>
          </section>
          <div class="dots" aria-label="Choose featured game"><button v-for="(game, index) in featured" :key="game.id" v-hover :aria-label="'Feature ' + game.title" :aria-pressed="heroIndex === index" @click="heroIndex = index"><span /></button></div>
          <div class="quick-picks"><button v-for="pick in quickPicks" :key="pick.game.id" v-hover class="quick-pick vk-platter" @click="showGame(pick.game)"><img :src="pick.game.cover" alt=""/><span><small>{{ pick.note }}</small><b>{{ pick.game.title }}</b><em>{{ pick.game.phone ? 'Touch ready' : 'Keyboard' }}</em></span><ArcadeIcon name="info"/></button></div>
          </div>
          <section v-for="row in rows" :key="row.id" class="shelf"><div class="shelf-heading"><h2 class="vk-title">{{ row.name }}</h2><button v-if="row.id !== 'recent'" v-hover class="vk-button" @click="navigate(row.id)">See all</button></div><p class="vk-footnote vk-secondary">{{ row.note }}</p><div class="card-row vk-scroll"><GameCard v-for="game in row.games" :key="game.id" :game="game" @play="showGame" /></div></section>
        </template>
        <template v-else><div class="game-grid"><GameCard v-for="game in results" :key="game.id" :game="game" @play="showGame" /></div><p v-if="!results.length" class="empty vk-secondary">No games match this search. Try “sandbox”, or let the whole library surprise you.</p></template>
        <p class="library-note vk-footnote vk-secondary">Independent games, credited to their creators. Online games may show their own menus, accounts, or ads.</p>
      </main>
    </div>
    <div v-else ref="player" class="player" :inert="info ? true : undefined">
      <iframe :key="current.id + '-' + revision" :class="{ square: current.square }" :src="current.url" :title="current.title + ' game'" allow="autoplay; fullscreen; gamepad; pointer-lock; accelerometer; gyroscope" allowfullscreen @load="loaded" />
      <Transition name="cover"><div v-if="loading" class="loading-veil" role="status"><img :src="current.cover" alt="" /><div class="loading-copy"><span v-if="!slow" class="spinner" aria-hidden="true" /><h2 class="vk-title">{{ slow ? 'This one is taking its time' : 'Starting ' + current.title }}</h2><p>{{ current.controls }}</p><p class="vk-footnote">{{ slow ? 'The game may be busy, or its host may be unavailable.' : 'A tiny portal. A whole other world.' }}</p><div v-if="slow" class="actions"><button v-hover class="vk-button primary" @click="retry">Retry</button><button v-hover class="vk-button" @click="back">Back</button></div></div></div></Transition>
      <div class="player-tools vk-ornament"><button v-hover class="vk-button" @click="back"><ArcadeIcon name="back" /><span>Back to Arcade</span></button><span class="playing-title"><strong>{{ current.title }}</strong><small>by {{ current.credit }}</small></span><button v-hover class="vk-icon" aria-label="Reload game" title="Reload" @click="retry"><ArcadeIcon name="reload" /></button><button v-hover class="vk-icon" aria-label="Full screen" title="Full screen" @click="fullscreen"><ArcadeIcon name="fullscreen" /></button><button v-hover class="vk-icon" aria-label="Game controls and credits" @click="info = true"><ArcadeIcon name="info" /></button></div>
    </div>
    <AppSheet v-if="pending" title="Built for a keyboard" @close="pending = null"><p class="vk-body">{{ pending.title }} needs a keyboard and mouse to feel at home. You can still give it a go.</p><p class="vk-footnote vk-secondary">{{ pending.controls }}</p><div class="sheet-actions"><button v-hover class="vk-button primary" @click="play(pending, true)">Play anyway</button><button v-hover class="vk-button" @click="pickTouch">Pick a touch game</button></div></AppSheet>
    <AppSheet v-if="info && current" :title="current.title" @close="info = false"><p class="vk-headline">How to play</p><p class="vk-body">{{ current.controls }}</p><p class="vk-footnote vk-secondary">Created by {{ current.credit }}. This library provides a window into their game; all game content belongs to its creators.</p><button v-hover class="vk-button primary" @click="info = false">Back to game</button></AppSheet>
  </div>
</template>

<style src="../kit/kit.css"></style>
<style scoped>
/* A complete featured composition, followed by scrollable shelves. */
.browse-content { container-type:size; }
.page-heading h1 { font-size:32px; line-height:1.1; }
.page-heading>div>.vk-footnote { font-size:11.5px; letter-spacing:.09em; }
.intro { margin:9px 0 18px; font-size:15px; }
.opening-selection { height:calc(100cqh - 110px); min-height:355px; display:grid; grid-template-rows:minmax(0,1fr) 44px 100px; padding-bottom:18px; }
.opening-selection .hero { aspect-ratio:auto; min-height:0; }
.opening-selection .hero-copy { min-height:0; height:100%; gap:10px; padding:26px; max-width:720px; }
.opening-selection .hero-copy h2 { font-size:clamp(28px,3.8cqw,43px); }
.opening-selection .hero-copy p { font-size:16px; max-width:540px; }
.opening-selection .dots { margin:0; }
.hero-actions .vk-chip { min-height:28px; font-size:12px; }
.quick-picks { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; min-height:0; }
.quick-pick { display:flex; text-align:left; align-items:center; gap:12px; padding:12px; min-width:0; }
.quick-pick>img { width:62px; height:62px; flex:none; border-radius:16px; object-fit:cover; }
.quick-pick>span { display:flex; min-width:0; flex-direction:column; gap:5px; }
.quick-pick small { font-size:11.5px; color:var(--vk-secondary); }
.quick-pick b { font-size:14px; line-height:1.2; }
.quick-pick em { font-size:11.5px; font-style:normal; color:var(--vk-tertiary); }
.quick-pick>svg { width:20px; height:20px; margin-left:auto; flex:none; color:var(--vk-secondary); }
.shelf { margin-top:20px; }
@container(max-height:540px) and (min-width:651px) {
 .arcade-app .tabs { width:82px; margin-left:12px; padding:6px; }
 .nav-item { min-height:54px; font-size:11.5px; }
 .nav-item .vk-icon { width:36px; height:36px; min-height:36px; }
 .browse-content { padding:20px 24px; }
 .page-heading h1 { font-size:27px; }
 .intro { margin:7px 0 12px; font-size:13px; }
 .opening-selection { height:calc(100cqh - 87px); min-height:300px; grid-template-rows:minmax(0,1fr) 44px 80px; padding-bottom:8px; }
 .opening-selection .hero-copy { padding:20px 24px; gap:7px; }
 .opening-selection .hero-copy h2 { font-size:30px; }
 .opening-selection .hero-copy p { font-size:14px; max-width:540px; }
 .hero-actions .vk-chip { display:none; }
 .quick-pick { padding:10px; gap:10px; }
 .quick-pick>img { width:48px; height:48px; border-radius:13px; }
 .quick-pick>svg,.quick-pick em { display:none; }
}
@container(max-width:650px) {
 .browse-layout { flex-direction:column; }
 .arcade-app .tabs { flex-direction:row; width:calc(100% - 32px); max-height:72px; margin:16px 16px 0; border-radius:25px; padding:6px; overflow-x:auto; }
 .nav-item,.compact .nav-item { width:64px; flex:0 0 64px; min-height:54px; font-size:11.5px; }
 .nav-item .vk-icon { width:32px; height:32px; min-height:32px; }
 .browse-content,.compact .browse-content { padding:18px; }
 .page-heading h1 { font-size:27px; }
 .page-heading .vk-chip { font-size:12px; padding:5px 10px; }
 .page-heading>div>.vk-footnote { font-size:10.5px; }
 .intro { font-size:13px; margin:8px 0 13px; line-height:1.4; }
 .opening-selection { height:calc(100cqh - 105px); min-height:340px; grid-template-rows:minmax(0,1fr) 44px 88px; padding-bottom:8px; }
 .opening-selection .hero,.compact .opening-selection .hero { min-height:0; }
 .opening-selection .hero-copy,.compact .opening-selection .hero-copy { min-height:0; padding:20px; gap:8px; }
 .opening-selection .hero-copy h2 { font-size:29px; }
 .opening-selection .hero-copy p { font-size:14px; line-height:1.4; }
 .hero-actions .vk-chip { display:none; }
 .hero-actions .primary { margin-left:0; }
 .hero-actions .vk-button { font-size:13px; padding:0 16px; }
 .quick-picks { gap:8px; }
 .quick-pick { padding:8px; flex-direction:column; justify-content:center; gap:6px; text-align:center; }
 .quick-pick>img { width:32px; height:32px; border-radius:9px; }
 .quick-pick>span { gap:3px; width:100%; }
 .quick-pick b { font-size:12px; }
 .quick-pick small,.quick-pick em,.quick-pick>svg { display:none; }
 .game-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px 12px; }
 .game-grid :deep(.game-title) { font-size:15px; }
}
</style>
<style scoped>
.arcade-app { position: absolute; inset: 0; min-width: 0; min-height: 0; border-radius: inherit; overflow: hidden; color: var(--vk-text); container-type: size; }
.arcade-app *, .arcade-app *::before, .arcade-app *::after { box-sizing: border-box; }
button, input { font: inherit; } button { cursor: pointer; color: inherit; border: 0; background: none; } :focus-visible { outline: 2px solid white; outline-offset: 3px; } h1,h2,p { margin: 0; }
.browse-layout { display: flex; height: 100%; min-width: 0; }
.arcade-app .tabs { flex: none; align-self: center; width: 100px; max-height: calc(100% - 40px); margin: 20px 0 20px 16px; border-radius: 32px; padding: 8px; }
.nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border-radius: 22px; min-height: 65px; width: 100%; font-size: 12px; }
.nav-item .vk-icon { background: transparent; } .nav-item[aria-pressed=true] { background: #ffffff20; } .nav-item[aria-pressed=true] .vk-icon { background: white; color: #191c27; }
.browse-content { flex: 1; min-width: 0; padding: 26px 28px; }
.page-heading, .shelf-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; } .page-heading h1 { margin-top: 5px; } .intro { margin: 12px 0 24px; }
.hero { position: relative; aspect-ratio: 16/9; border-radius: 28px; overflow: hidden; isolation: isolate; transition: transform .35s var(--vk-spring); background: #232839; }
.hero-cover, .hero-shade { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; } .hero-shade { background: linear-gradient(0deg, #090e1cf5, #090e1c45 75%, #090e1c08); }
.hero-copy { position: relative; min-height: 100%; display: flex; flex-direction: column; justify-content: flex-end; gap: 12px; padding: 30px; max-width: 680px; } .hero-copy h2 { font-size: clamp(28px,4cqw,48px); letter-spacing: -.04em; line-height: 1; } .hero-copy p { max-width: 500px; font-size: 17px; line-height: 1.4; color: #ffffffd1; }
.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; } .hero-actions .primary { margin-left: 8px; }
.dots { display: flex; justify-content: center; margin: 0 0 14px; } .dots button { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; } .dots span { width: 6px; height: 6px; background: #ffffff5e; border-radius: 50%; transition: width .3s; } .dots [aria-pressed=true] span { width: 22px; border-radius: 5px; background: white; }
.shelf { margin: 0 0 28px; } .shelf > p { margin: 3px 0 12px; } .card-row { display: flex; gap: 18px; padding: 8px 4px 16px; } .game-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(210px,1fr)); gap: 24px 18px; } .game-grid :deep(.game-card) { width: 100%; }
.search-tools { display: flex; gap: 12px; margin-bottom: 24px; } .search-tools input { min-width: 0; } .empty { padding: 50px 20px; text-align: center; } .library-note { margin-top: 28px; }
.player { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; background: #080b12; } .player:fullscreen { border-radius: 0; } iframe { width: 100%; height: 100%; border: 0; display: block; } iframe.square { width: auto; max-width: 100%; aspect-ratio: 1.08; margin: 0 auto; }
.loading-veil { position: absolute; inset: 0; display: grid; place-items: center; padding: 32px 28px 120px; background: #101525; overflow: hidden; } .loading-veil > img { position: absolute; inset: -10%; width: 120%; height: 120%; object-fit: cover; filter: blur(28px) brightness(.3); } .loading-copy { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 18px; max-width: 520px; } .loading-copy p { line-height: 1.5; }
.spinner { width: 36px; height: 36px; border: 3px solid #ffffff30; border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; }
.arcade-app .player-tools { position: absolute; z-index: 3; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 10px; width: max-content; max-width: calc(100% - 32px); border-radius: 28px; } .playing-title { min-width: 0; display: flex; flex-direction: column; max-width: 230px; padding: 0 10px; } .playing-title strong { font-size: 15px; } .playing-title small { color: var(--vk-secondary); font-size: 12px; } .player-tools .vk-icon { flex: none; }
.actions, .sheet-actions { display: flex; flex-wrap: wrap; gap: 12px; } .sheet-actions { margin-top: 22px; } .arcade-app :deep(.app-sheet p) { margin: 12px 0 20px; }
.cover-enter-active, .cover-leave-active { transition: opacity .6s; } .cover-enter-from, .cover-leave-to { opacity: 0; } .copy-enter-active,.copy-leave-active { transition: opacity .22s; } .copy-enter-from,.copy-leave-to { opacity: 0; }
@keyframes spin { to { transform: rotate(360deg); } }
.compact .browse-layout { flex-direction: column; } .compact .tabs { flex-direction: row; width: calc(100% - 32px); max-height: none; margin: 16px 16px 0; overflow-x: auto; border-radius: 26px; } .compact .nav-item { width: 66px; flex: 0 0 66px; min-height: 64px; } .compact .browse-content { padding: 22px; } .compact .game-grid { grid-template-columns: 1fr; } .compact .hero { aspect-ratio: auto; min-height: 330px; } .compact .hero-copy { min-height: 330px; padding: 22px; } .compact .search-tools { flex-wrap: wrap; } .compact .playing-title { flex-basis: 100%; text-align: center; max-width: none; order: -1; } .compact .player-tools { flex-wrap: wrap; justify-content: center; width: calc(100% - 24px); gap: 6px; bottom: 12px; } .compact .player-tools .vk-button { padding: 0 14px; font-size: 14px; } .compact .loading-veil { padding-bottom: 180px; }
@container (max-width: 650px) { .arcade-app:not(.compact) .tabs { width: 74px; } .browse-content { padding: 22px; } .hero { aspect-ratio: auto; min-height: 330px; } .hero-copy { min-height: 330px; padding: 22px; } .playing-title { display: none; } .game-grid { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .arcade-app *, .arcade-app *::before, .arcade-app *::after { animation: none !important; transition: none !important; } .hero { transform: none !important; } }
</style>
