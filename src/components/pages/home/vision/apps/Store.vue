<script setup lang="ts">
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { storeApps, stories } from './store/catalog';
import type { DownloadState, StoreApp, StoreStory, StoreTab } from './store/catalog';
import StoreIcon from './store/StoreIcon.vue';
import StoreGet from './store/StoreGet.vue';
import StoreArtwork from './store/StoreArtwork.vue';
import StorePage from './store/StorePage.vue';
import AppGlyph from './files/AppGlyph.vue';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
const tab = ref<StoreTab>('Today');
const query = ref('');
const filter = ref('All');
const selected = ref<StoreApp | null>(null);
const story = ref<StoreStory | null>(null);
const launch = ref<StoreApp | null>(null);
const notifications = ref(true);
const announcement = ref('');
const notice = ref('');
const stage = ref<HTMLElement | null>(null);
const storyElement = ref<HTMLElement | null>(null);
const launchElement = ref<HTMLElement | null>(null);
const storeSearch = ref<HTMLInputElement | null>(null);
const navigationWrap = ref<HTMLElement | null>(null);
const navTooltip = ref<{ name: StoreTab; top: number } | null>(null);
const launchTitleId = useId();
const savedCount = ref(0);
const reducedMotion = ref(false);
const tabs: { name: StoreTab; path: string }[] = [
  { name: 'Today', path: 'M6 4h16v20H6zM10 9h8M10 14h8M10 19h5' },
  { name: 'Apps', path: 'M5 5h7v7H5zM16 5h7v7h-7zM5 16h7v7H5zM16 16h7v7h-7z' },
  { name: 'Games', path: 'M8 9h12l5 12-4 3-5-5h-4l-5 5-4-3zM8 13v6M5 16h6M19 14h.1M22 17h.1' },
  { name: 'Arcade', path: 'M14 3l3.4 7 7.6 1.1-5.5 5.4 1.3 7.5-6.8-3.6L7.2 24l1.3-7.5L3 11.1l7.6-1.1z' },
  { name: 'Search', path: 'M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0M18 18l7 7' },
  { name: 'Updates', path: 'M22 10a9 9 0 1 0 1 9M22 3v7h-7M14 8v7l4 3' },
  { name: 'Account', path: 'M18 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0M5 25v-3a9 9 0 0 1 18 0v3' },
];
const downloads = ref<Record<string, DownloadState>>(Object.fromEntries(storeApps.map(app => [app.id, {
  progress: 0, started: null, version: app.headsetId ? app.version : ['tabs', 'chai'].includes(app.id) ? 1 : 0,
}])));
const purchases = computed(() => storeApps.filter(app => !app.headsetId && state(app.id).version > 0));
const updates = computed(() => purchases.value.filter(app => state(app.id).version < app.version));
const activeDownloads = computed(() => storeApps.filter(app => state(app.id).started !== null));
const categories = computed(() => tab.value === 'Games' || tab.value === 'Arcade'
  ? ['All', 'Gentle', 'Developer'] : ['All', 'Productivity', 'Utilities', 'Headset']);
const shown = computed(() => storeApps.filter(app => {
  if (tab.value === 'Games' || tab.value === 'Arcade') {
    if (!app.arcade) return false;
    if (filter.value === 'Gentle' && app.id === 'bug') return false;
    if (filter.value === 'Developer' && app.id === 'commute') return false;
  } else if (tab.value === 'Apps') {
    if (filter.value === 'Headset' && !app.headsetId) return false;
    if (filter.value === 'Productivity' && (app.arcade || app.headsetId || ['chai', 'duck'].includes(app.id))) return false;
    if (filter.value === 'Utilities' && !['chai', 'duck'].includes(app.id)) return false;
  }
  if (tab.value === 'Search') {
    const terms = query.value.trim().toLowerCase().split(/\s+/);
    return terms.every(term => (app.name + ' ' + app.subtitle + ' ' + app.category).toLowerCase().includes(term));
  }
  return true;
}));
const suggestions = ['Productivity', 'Chai', 'Developer', 'Arcade', 'Headset'];
const headline = computed(() => selected.value ? selected.value.name : tab.value);
const listTitle = computed(() => tab.value === 'Today' ? 'A few good distractions'
  : tab.value === 'Search' ? query.value ? 'Search results' : 'Discover something' : 'Made for a little more space');
let tick: ReturnType<typeof setInterval> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let mounted = false;
let motionQuery: MediaQueryList | undefined;
let cardAnimation: Animation | undefined;
let cardSource: DOMRect | undefined;
let storyFocus: HTMLElement | null = null;
let launchFocus: HTMLElement | null = null;
let pageFocus: HTMLElement | null = null;
const virtualTabs = ref(['The actual task', 'Research', 'Definitely later', 'A worthy distraction']);
let nextTabNumber = 1;
const timerSeconds = ref(180);
const teaStarted = ref<number | null>(null);
const teaRemainingAtStart = ref(180);
const duckLines = [
  'I am listening.',
  'Have you tried explaining that last line out loud?',
  'Quack. That sounds like an off-by-one.',
  'Excellent. The solution was in your explanation.',
];
const duckIndex = ref(0);
const explanation = ref('');
const standup = ref('Yesterday: investigated. Today: investigating. Blocked by chai.');
const concise = ref('');
const gardenSize = ref(3);
const caughtBugs = ref<number[]>([]);
const bugsFound = computed(() => caughtBugs.value.length);
const traffic = ref(0);
const focused = ref(false);
const focusTime = ref(0);
const teaClock = computed(() => Math.floor(timerSeconds.value / 60).toString().padStart(2, '0') + ':'
  + (timerSeconds.value % 60).toString().padStart(2, '0'));
const focusCaption = computed(() => ['Breathe in', 'Hold gently', 'Breathe out'][Math.floor(focusTime.value / 4) % 3] ?? 'Breathe in');

function state(id: string): DownloadState {
  return downloads.value[id] ?? { progress: 0, started: null, version: 0 };
}
function notify(text: string): void {
  announcement.value = text;
  if (!notifications.value) return;
  notice.value = text;
  if (noticeTimer !== undefined) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ''; noticeTimer = undefined; }, 3600);
}
function savePurchases(): void {
  try {
    localStorage.setItem('lab-vision-store', JSON.stringify({
      schema: 1,
      purchases: purchases.value.map(app => ({ id: app.id, version: state(app.id).version })),
      notifications: notifications.value,
    }));
  } catch { /* Private browsing can still enjoy imaginary purchases. */ }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function restorePurchases(report = false): void {
  try {
    const saved = localStorage.getItem('lab-vision-store');
    if (!saved) {
      if (report) notify(purchases.value.length
        ? 'Your current library is ready. No saved receipt was found.'
        : 'No saved purchases here. Get starts a new local receipt.');
      return;
    }
    const value: unknown = JSON.parse(saved);
    if (!isRecord(value) || value.schema !== 1 || !Array.isArray(value.purchases) || typeof value.notifications !== 'boolean') {
      if (report) notify('That local purchase record could not be read. Your current library is safe.');
      return;
    }
    const restored: { id: string; version: number }[] = [];
    for (const purchase of value.purchases as unknown[]) {
      if (!isRecord(purchase) || typeof purchase.id !== 'string' || typeof purchase.version !== 'number') continue;
      const app = storeApps.find(item => item.id === purchase.id && !item.headsetId);
      if (!app || !Number.isInteger(purchase.version) || purchase.version < 1 || purchase.version > app.version) continue;
      restored.push({ id: app.id, version: purchase.version });
    }
    for (const app of storeApps) {
      const item = downloads.value[app.id];
      if (!item || app.headsetId || item.started !== null) continue;
      item.version = restored.find(purchase => purchase.id === app.id)?.version ?? 0;
    }
    notifications.value = value.notifications;
    savedCount.value = restored.length;
    if (report) notify('Restored ' + restored.length + ' local purchases. The receipt remains imaginary.');
  } catch {
    if (report) notify('Local storage is unavailable. Your library still works during this visit.');
  }
}
function activate(app: StoreApp, update = false): void {
  const item = downloads.value[app.id];
  if (!item) return;
  if (item.started !== null) {
    item.started = null;
    item.progress = 0;
    notify('Cancelled: ' + app.name + '. No bytes were harmed.');
    return;
  }
  if (item.version > 0 && !update) {
    if (app.headsetId && vision) {
      vision.open(app.headsetId);
      notify('Opened ' + app.name + ' in this headset.');
    } else {
      launch.value = app;
      launchFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void nextTick(() => launchElement.value?.querySelector<HTMLButtonElement>('button')?.focus());
    }
    return;
  }
  item.started = Date.now();
  item.progress = .01;
  announcement.value = (update ? 'Updating ' : 'Downloading ') + app.name + ' in the simulation.';
}
function updateAll(): void {
  for (const app of updates.value) {
    if (state(app.id).started === null) activate(app, true);
  }
  if (!updates.value.length) notify('Everything is up to date. An unusually peaceful sentence.');
}
function switchTab(name: StoreTab): void {
  cardAnimation?.cancel();
  tab.value = name;
  selected.value = null;
  story.value = null;
  filter.value = 'All';
  navTooltip.value = null;
  stage.value?.querySelector<HTMLElement>('.store-feed')?.scrollTo({ top: 0 });
  if (name === 'Search') void nextTick(() => storeSearch.value?.focus());
}
function showDetails(app: StoreApp): void {
  cardAnimation?.cancel();
  pageFocus = story.value ? storyFocus : document.activeElement instanceof HTMLElement ? document.activeElement : null;
  selected.value = app;
  story.value = null;
  void nextTick(() => stage.value?.querySelector<HTMLButtonElement>('.page-navigation button')?.focus());
}
function backToList(): void {
  selected.value = null;
  void nextTick(() => pageFocus?.isConnected ? pageFocus.focus() : stage.value?.querySelector<HTMLButtonElement>('[data-app-card]')?.focus());
}
function storyApp(item: StoreStory): StoreApp | undefined {
  return storeApps.find(app => app.id === item.appId);
}
async function openStory(item: StoreStory, event: MouseEvent): Promise<void> {
  const source = event.currentTarget;
  if (!(source instanceof HTMLElement)) return;
  storyFocus = source;
  cardSource = source.getBoundingClientRect();
  story.value = item;
  await nextTick();
  if (!mounted || !story.value) return;
  animateStory(false);
  storyElement.value?.querySelector<HTMLButtonElement>('button')?.focus();
}
function animateStory(reverse: boolean): Animation | undefined {
  const element = storyElement.value;
  if (!element || !cardSource || reducedMotion.value || !element.animate) return;
  const destination = element.getBoundingClientRect();
  const spatialScale = element.offsetWidth / (destination.width || 1);
  const transform = 'translate(' + (cardSource.left - destination.left) * spatialScale + 'px, '
    + (cardSource.top - destination.top) * spatialScale + 'px) scale('
    + cardSource.width / (destination.width || 1) + ', ' + cardSource.height / (destination.height || 1) + ')';
  cardAnimation?.cancel();
  cardAnimation = element.animate(reverse
    ? [{ transform: 'none', opacity: 1 }, { transform, opacity: 0 }]
    : [{ transform, opacity: .35 }, { transform: 'none', opacity: 1 }], {
    duration: 300, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'both',
  });
  return cardAnimation;
}
async function closeStory(): Promise<void> {
  const animation = animateStory(true);
  if (animation) {
    try { await animation.finished; } catch { if (!mounted) return; }
  }
  if (!mounted) return;
  story.value = null;
  cardAnimation?.cancel();
  void nextTick(() => storyFocus?.isConnected ? storyFocus.focus() : undefined);
}
function closeLaunch(): void {
  launch.value = null;
  focused.value = false;
  void nextTick(() => launchFocus?.isConnected ? launchFocus.focus() : undefined);
}
function trapSheet(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !(event.currentTarget instanceof HTMLElement)) return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, [tabindex="0"]')]
    .filter(element => element.getClientRects().length > 0);
  if (!controls?.length) return;
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function collectionKeys(event: KeyboardEvent): void {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.closest('input, textarea, select')) return;
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const area = event.currentTarget;
  if (!(area instanceof HTMLElement)) return;
  const controls = [...area.querySelectorAll<HTMLButtonElement>('[data-app-card]')];
  if (!controls.length) return;
  const current = controls.indexOf(target.closest<HTMLButtonElement>('[data-app-card]') ?? target as HTMLButtonElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
    : Math.max(0, Math.min(controls.length - 1, current + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1)));
  event.preventDefault();
  controls[next]?.focus();
}
function removePurchase(app: StoreApp): void {
  const item = downloads.value[app.id];
  if (!item || app.headsetId) return;
  item.started = null;
  item.version = 0;
  item.progress = 0;
  savePurchases();
  notify('Removed ' + app.name + '. Get will bring it back for free.');
}
function toggleTea(): void {
  if (teaStarted.value !== null) teaStarted.value = null;
  else {
    if (timerSeconds.value === 0) timerSeconds.value = 180;
    teaRemainingAtStart.value = timerSeconds.value;
    teaStarted.value = Date.now();
  }
}
function resetTea(): void {
  teaStarted.value = null;
  timerSeconds.value = 180;
}
function showNavLabel(name: StoreTab, event: Event): void {
  const target = event.currentTarget;
  const wrapper = navigationWrap.value;
  if (!(target instanceof HTMLElement) || !wrapper) return;
  const box = wrapper.getBoundingClientRect();
  navTooltip.value = {
    name,
    top: (target.getBoundingClientRect().top - box.top) * wrapper.offsetHeight / (box.height || 1) + target.offsetHeight / 2,
  };
}
function addVirtualTab(): void {
  virtualTabs.value.push('One more thought ' + nextTabNumber);
  nextTabNumber += 1;
}
function makeConcise(): void {
  const sentences = standup.value.trim().split(/[.!?]/).map(item => item.trim()).filter(Boolean);
  concise.value = sentences.length ? sentences.slice(0, 2).join('. ') + '.' : 'Blocked by an empty status update.';
}
function updateMotion(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches;
  if (event.matches) cardAnimation?.cancel();
}
function stepBack(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (launch.value) closeLaunch();
  else if (story.value) void closeStory();
  else if (selected.value) backToList();
  else return;
  event.preventDefault();
  event.stopPropagation();
}
onMounted(() => {
  mounted = true;
  restorePurchases();
  try {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.value = motionQuery.matches;
    motionQuery.addEventListener('change', updateMotion);
  } catch { reducedMotion.value = true; }
  let lastSecond = Date.now();
  tick = setInterval(() => {
    const now = Date.now();
    for (const app of storeApps) {
      const item = downloads.value[app.id];
      if (!item || item.started === null) continue;
      item.progress = Math.min(1, (now - item.started) / 2600);
      if (item.progress >= 1) {
        const wasUpdate = item.version > 0;
        item.started = null;
        item.version = app.version;
        savePurchases();
        notify((wasUpdate ? 'Updated: ' : 'Installed: ') + app.name + '. Ready to Open.');
      }
    }
    if (teaStarted.value !== null) {
      timerSeconds.value = Math.max(0, teaRemainingAtStart.value - Math.floor((now - teaStarted.value) / 1000));
      if (timerSeconds.value === 0) { teaStarted.value = null; notify('Tea is ready. The imaginary biscuit has excellent timing.'); }
    }
    if (now - lastSecond >= 1000) {
      if (focused.value) focusTime.value += 1;
      lastSecond = now;
    }
  }, 80);
});
onBeforeUnmount(() => {
  mounted = false;
  if (noticeTimer !== undefined) clearTimeout(noticeTimer);
  if (tick !== undefined) clearInterval(tick);
  cardAnimation?.cancel();
  motionQuery?.removeEventListener?.('change', updateMotion);
});
</script>

<template>
  <div class="store-root" :class="{ compact }" @keydown="stepBack">
    <div ref="navigationWrap" class="navigation-wrap">
    <nav class="store-navigation vk-tabbar vk-scroll" aria-label="App Store destinations" :inert="!!story || !!launch" @scroll="navTooltip = null">
      <button v-for="item in tabs" :key="item.name" v-hover class="vk-icon nav-button" :aria-label="item.name"
        :aria-pressed="tab === item.name" @click="switchTab(item.name)"
        @pointerenter="showNavLabel(item.name, $event)" @pointerleave="navTooltip = null"
        @focus="showNavLabel(item.name, $event)" @blur="navTooltip = null">
        <svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><path :d="item.path" stroke="currentColor"
          stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <i v-if="item.name === 'Updates' && updates.length" class="update-dot" />
      </button>
    </nav>
    <Transition name="nav-tip"><span v-if="navTooltip" class="nav-tooltip" :style="{ top: navTooltip.top + 'px' }"
      aria-hidden="true">{{ navTooltip.name }}</span></Transition>
    </div>
    <main ref="stage" class="store-stage" :inert="!!launch">
      <StorePage v-if="selected" :app="selected" :state="state(selected.id)" @activate="selected && activate(selected)" @back="backToList" />
      <div v-else class="store-home" :inert="!!story || !!launch">
        <header class="store-header">
          <div><p class="eyebrow vk-secondary">{{ tab === 'Today' ? 'A GOOD DAY FOR SOMETHING UNNECESSARY' : 'THE SIMULATED APP STORE' }}</p>
            <h1>{{ headline }}</h1></div>
          <button v-hover class="vk-icon account-avatar" aria-label="Open account and purchases" @click="switchTab('Account')">M</button>
        </header>
        <div v-if="tab === 'Search'" class="search-area">
          <input ref="storeSearch" v-model="query" v-hover class="vk-field" type="search" placeholder="Apps, games, and good excuses"
            aria-label="Search apps" />
          <div v-if="!query" class="suggestions" aria-label="Search suggestions">
            <button v-for="suggestion in suggestions" :key="suggestion" v-hover class="vk-chip" @click="query = suggestion">{{ suggestion }}</button>
          </div>
        </div>
        <div class="store-feed vk-scroll" @keydown="collectionKeys">
          <template v-if="tab === 'Account'">
            <section class="account-card vk-platter">
              <span class="profile-mark">M</span><div><h2>A guest with excellent taste</h2>
                <p class="vk-secondary">No sign-in. No bills. Purchases stay in this browser.</p></div>
            </section>
            <div class="account-settings vk-platter">
              <label class="setting-row"><span><strong>Store notifications</strong><small class="vk-secondary">A quiet note when a download finishes</small></span>
                <input v-model="notifications" v-hover type="checkbox" aria-label="Store notifications" class="vk-toggle" @change="savePurchases" /></label>
              <button v-hover class="vk-row" @click="restorePurchases(true)"><span>Restore local purchases</span><AppGlyph name="restore" /></button>
            </div>
            <div class="section-heading">
              <h2>Purchased</h2>
              <span class="vk-footnote vk-secondary">{{ purchases.length }} {{ purchases.length === 1 ? 'app' : 'apps' }} · Simulated</span>
            </div>
            <p class="vk-footnote vk-secondary library-note">Tab Hoarder Pro and Chai Timer are starter purchases. Remove or update them here.</p>
            <div class="app-list">
              <article v-for="app in purchases" :key="app.id" class="app-row vk-platter">
                <button v-hover class="vk-row app-details" data-app-card @click="showDetails(app)"><StoreIcon :app="app" />
                  <span class="app-copy"><strong>{{ app.name }}</strong>
                    <small>{{ state(app.id).version < app.version ? 'An update is waiting' : 'Up to date' }}</small></span></button>
                <StoreGet :name="app.name" :state="state(app.id)" @activate="activate(app)" />
                <button v-hover class="vk-icon remove-button" :aria-label="'Remove local purchase of ' + app.name" @click="removePurchase(app)"><AppGlyph name="close" /></button>
              </article>
              <div v-if="!purchases.length" class="empty-state vk-well"><h2>A beautifully empty receipt</h2><p>Find an app and tap Get to start your local library.</p>
                <button v-hover class="vk-button" @click="switchTab('Apps')">Explore apps</button></div>
            </div>
            <p class="vk-footnote vk-secondary">{{ savedCount ? savedCount + ' purchases restored on this visit.' : 'Your library is saved locally when it changes.' }}</p>
          </template>
          <template v-else-if="tab === 'Updates'">
            <div class="update-heading vk-platter"><div><h2>{{ updates.length ? updates.length + ' updates available' : 'All caught up' }}</h2>
              <p class="vk-secondary">Small improvements. Reasonable release notes.</p></div>
              <button v-hover class="vk-button update-all" @click="updateAll">{{ updates.length ? 'Update all' : 'Check again' }}</button>
            </div>
            <article v-for="app in updates" :key="app.id" class="update-row vk-platter">
              <div class="app-row"><button v-hover class="vk-row app-details" data-app-card @click="showDetails(app)"><StoreIcon :app="app" />
                <span class="app-copy"><strong>{{ app.name }}</strong><small>Version 1.1 · {{ app.size }}</small></span></button>
                <StoreGet :name="app.name" :state="state(app.id)" update @activate="activate(app, true)" /></div>
              <p class="vk-secondary">{{ app.id === 'tabs' ? 'A new home for your unfinished thoughts. They insisted on a balcony.'
                : 'A quieter timer and a more confident imaginary biscuit.' }}</p>
            </article>
            <div v-if="!updates.length" class="empty-state vk-well"><AppGlyph name="check" class="complete-mark" />
              <h2>Everything has its latest polish.</h2><p>Updates for these fictional apps run here, without a network download.</p>
              <button v-hover class="vk-button" @click="switchTab('Today')">Back to Today</button></div>
          </template>
          <template v-else>
            <div v-if="tab === 'Today'" class="editorial-grid">
              <button v-for="item in stories" :key="item.id" v-hover class="editorial-card vk-platter" :class="item.appId"
                data-app-card @click="openStory(item, $event)">
                <span class="eyebrow">{{ item.kicker }}</span><h2>{{ item.title }}</h2>
                <StoreArtwork v-if="storyApp(item)" :app="storyApp(item) as StoreApp" editorial />
                <span class="editorial-bottom"><strong>{{ storyApp(item)?.name }}</strong><small>{{ item.line }}</small></span>
              </button>
            </div>
            <div v-if="tab === 'Arcade' || tab === 'Games'" class="arcade-hero vk-platter">
              <div><span class="eyebrow">{{ tab === 'Arcade' ? 'A LITTLE SPATIAL PLAY' : 'SMALL WORLDS, BIG EXCUSES' }}</span>
                <h2>{{ tab === 'Arcade' ? 'Your backlog can wait one level.' : 'A good day to go absolutely nowhere.' }}</h2>
                <p>Original fictional games. No subscriptions, leaderboards, or guilt.</p></div><AppGlyph name="spark" class="arcade-spark" />
            </div>
            <div v-if="['Apps', 'Games', 'Arcade'].includes(tab)" class="filters" aria-label="App categories">
              <button v-for="category in categories" :key="category" v-hover class="vk-chip" :aria-pressed="filter === category"
                @click="filter = category">{{ category }}</button>
            </div>
            <div class="section-heading"><h2>{{ listTitle }}</h2><span v-if="tab === 'Search'" class="vk-footnote vk-secondary">{{ shown.length }} results</span></div>
            <div class="app-list">
              <article v-for="app in shown" :key="app.id" class="app-row vk-platter">
                <button v-hover class="vk-row app-details" :aria-label="'View ' + app.name" data-app-card @click="showDetails(app)">
                  <StoreIcon :app="app" /><span class="app-copy"><strong>{{ app.name }}</strong><small>{{ app.subtitle }}</small>
                    <span class="row-rating">
                      <span class="rating-stars" aria-hidden="true"><AppGlyph v-for="n in 5" :key="n" name="star" /></span>
                      {{ app.rating }} · {{ app.headsetId ? 'Included' : app.category }}
                    </span></span>
                </button>
                <StoreGet :name="app.name" :state="state(app.id)" @activate="activate(app)" />
              </article>
              <div v-if="!shown.length" class="empty-state vk-well"><h2>No apps found.</h2><p>Perhaps that idea is yours to build.</p>
                <button v-hover class="vk-button" @click="query = ''; filter = 'All'">Clear search and filters</button></div>
            </div>
            <p class="simulation-note vk-footnote vk-secondary">An independent portfolio simulation. Fictional apps and reviews, plus the apps already in this headset.</p>
          </template>
        </div>
        <footer v-if="activeDownloads.length" class="download-status vk-ornament"><span class="download-pulse" />
          <span>{{ activeDownloads.length }} simulated {{ activeDownloads.length === 1 ? 'download' : 'downloads' }}</span>
          <button v-hover class="vk-button" @click="switchTab('Account')">Library</button>
        </footer>
      </div>
      <article v-if="story" ref="storyElement" class="story-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true" aria-label="Editorial story" @keydown="trapSheet">
        <button v-hover class="vk-icon story-close" aria-label="Close editorial story" @click="closeStory"><AppGlyph name="close" /></button>
        <div class="story-hero" :class="story.appId"><span class="eyebrow">{{ story.kicker }}</span><h1>{{ story.title }}</h1>
          <StoreArtwork v-if="storyApp(story)" :app="storyApp(story) as StoreApp" editorial />
          <p>{{ story.line }}</p></div>
        <div class="story-body"><p v-for="paragraph in story.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <template v-if="storyApp(story)"><div class="story-app vk-platter"><StoreIcon :app="storyApp(story) as StoreApp" />
            <div><strong>{{ storyApp(story)?.name }}</strong><small class="vk-secondary">Original fictional app</small></div>
            <StoreGet :name="storyApp(story)?.name ?? ''" :state="state(story.appId)" @activate="activate(storyApp(story) as StoreApp)" /></div>
            <button v-hover class="vk-button story-details" @click="showDetails(storyApp(story) as StoreApp)">Explore the app</button></template>
        </div>
      </article>
    </main>
    <div v-if="launch" class="launch-backdrop" @click.self="closeLaunch">
      <section ref="launchElement" class="launch-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true" :aria-labelledby="launchTitleId" @keydown="trapSheet">
        <div class="launch-heading">
          <StoreIcon :app="launch" />
          <button v-hover class="vk-icon" aria-label="Close launched app" @click="closeLaunch"><AppGlyph name="close" /></button>
        </div>
        <h2 :id="launchTitleId">{{ launch.name }}</h2>
        <p class="vk-secondary launch-intro">{{ launch.headsetId ? 'This headset app needs the portfolio shell to open.' : 'A tiny fictional app, now beautifully installed.' }}</p>
        <template v-if="launch.id === 'tabs'">
          <p>The tabs have moved in. None have offered to pay rent.</p><div class="toy-list">
            <button v-for="(item, index) in virtualTabs" :key="item" v-hover class="vk-row vk-platter" :aria-label="'Close tab ' + item" @click="virtualTabs.splice(index, 1)">
              <span>{{ item }}</span><span class="vk-secondary">Close ×</span></button></div>
          <button v-hover class="vk-button" @click="addVirtualTab">Open one more tab</button>
        </template>
        <template v-else-if="launch.id === 'chai'">
          <div class="tea-clock vk-well"><strong>{{ teaClock }}</strong>
            <span>{{ timerSeconds ? 'Steep in another dimension.' : 'Tea is ready. The backlog can wait.' }}</span></div>
          <div class="toy-controls"><button v-hover class="vk-button" @click="toggleTea">
            {{ teaStarted !== null ? 'Pause' : timerSeconds === 180 ? 'Start brewing' : 'Resume' }}</button>
            <button v-hover class="vk-button" @click="resetTea">Reset</button></div>
        </template>
        <template v-else-if="launch.id === 'duck'">
          <div class="duck-response vk-well">{{ duckLines[duckIndex] }}</div>
          <textarea v-model="explanation" v-hover class="vk-field" placeholder="Explain the line you have read fourteen times..." aria-label="Explain your code to the duck" />
          <button v-hover class="vk-button" @click="duckIndex = (duckIndex + 1) % duckLines.length">Ask the duck</button>
          <small class="vk-secondary">A scripted duck. No AI service and no code leaves this window.</small>
        </template>
        <template v-else-if="launch.id === 'standup'">
          <textarea v-model="standup" v-hover class="vk-field" aria-label="Your imaginary standup" />
          <button v-hover class="vk-button" @click="makeConcise">Make it concise</button>
          <p v-if="concise" class="duck-response vk-well">{{ concise }}</p><small class="vk-secondary">Yesterday. Today. Still blocked by chai.</small>
        </template>
        <template v-else-if="launch.id === 'scope'">
          <div class="garden-toy vk-well"><AppGlyph v-for="n in gardenSize" :key="n" name="leaf" /></div>
          <p>{{ gardenSize }} requirements. {{ gardenSize > 5 ? 'The button has become a forest.' : 'Still a pleasantly small idea.' }}</p>
          <div class="toy-controls"><button v-hover class="vk-button" :disabled="gardenSize >= 12" @click="gardenSize += 1">Add a feature</button>
            <button v-hover class="vk-button" :disabled="gardenSize <= 1" @click="gardenSize -= 1">Prune the scope</button></div>
        </template>
        <template v-else-if="launch.id === 'bug'">
          <p>{{ bugsFound }} bugs caught. {{ bugsFound === 6 ? 'All caught. A suspiciously successful demo.' : 'These ones reproduce reliably.' }}</p><div class="bug-grid vk-well">
            <button v-for="n in 6" :key="n" v-hover class="vk-icon large" :aria-label="'Catch bug ' + n" :disabled="caughtBugs.includes(n)" @click="caughtBugs.push(n)">
              <svg viewBox="0 0 38 38" fill="none" aria-hidden="true"><path :d="launch.path" stroke="currentColor" stroke-width="2" /></svg>
            </button></div><button v-hover class="vk-button" @click="caughtBugs = []">Start another safari</button>
        </template>
        <template v-else-if="launch.id === 'commute'">
          <div class="traffic-light vk-well"><i v-for="n in 3" :key="n" :class="{ on: traffic === n - 1 }" /></div>
          <p>{{ ['Red. Arriving eventually.', 'Amber. Optimism is loading.', 'Green. You moved one imaginary metre.'][traffic] }}</p>
          <button v-hover class="vk-button" @click="traffic = (traffic + 1) % 3">Wait very patiently</button>
        </template>
        <template v-else-if="launch.id === 'focus'">
          <div class="focus-toy vk-well"><div class="breathing-disc" :class="{ breathing: focused }" />
            <strong>{{ focused ? focusCaption : 'One thing. When you are ready.' }}</strong></div>
          <button v-hover class="vk-button" @click="focused = !focused">{{ focused ? 'Pause the quiet' : 'Start a quiet moment' }}</button>
        </template>
        <button v-else v-hover class="vk-button" @click="closeLaunch">Return to the store</button>
      </section>
    </div>
    <Transition name="notice">
      <div v-if="notice" class="store-notice vk-sheet" aria-hidden="true">{{ notice }}</div>
    </Transition>
    <span class="sr-only" role="status" aria-live="polite">{{ announcement }}</span>
  </div>
</template>

<style scoped>
.store-root {
  --vk-secondary: rgb(255 255 255 / .82);
  --vk-tertiary: rgb(255 255 255 / .72);
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  container-type: size;
  overflow: hidden;
  display: flex;
  gap: 12px;
  padding: 16px;
  color: var(--vk-text, rgb(255 255 255 / .96));
  font-size: 17px;
  line-height: 1.4;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
}

.store-root :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

.store-root button {
  border: 0;
  font: inherit;
  cursor: pointer;
  color: inherit;
}

.store-root input,
.store-root textarea {
  font: inherit;
}

.store-root :focus-visible {
  outline: 2px solid white;
  outline-offset: 3px;
}

.store-root h1,
.store-root h2,
.store-root p {
  margin: 0;
}

.store-root h1 {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -.03em;
}

.store-root h2 {
  font-size: 23px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -.02em;
}

.store-root .navigation-wrap {
  position: relative;
  flex: none;
  width: 60px;
  height: min(100%, 366px);
  align-self: center;
  z-index: 6;
}

.store-root .store-navigation {
  width: 100%;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
}

.store-root .nav-button {
  position: relative;
}

.store-root .nav-tooltip {
  position: absolute;
  left: 52px;
  min-height: 44px;
  padding: 11px 18px;
  border-radius: 999px;
  background: rgb(70 73 81 / .96);
  transform: translateY(-50%);
  pointer-events: none;
  white-space: nowrap;
  color: #fff;
  font-size: 15px;
  box-shadow: 0 5px 20px rgb(0 0 0 / .2);
}

.store-root .nav-tip-enter-active,
.store-root .nav-tip-leave-active {
  transition: opacity .22s ease-out, transform .22s cubic-bezier(.2,.9,.3,1.15);
}

.store-root .nav-tip-enter-from,
.store-root .nav-tip-leave-to {
  opacity: 0;
  transform: translate(-8px, -50%) scale(.9);
}

.store-root .nav-button svg {
  pointer-events: none;
}

.store-root .update-dot {
  position: absolute;
  top: 6px;
  right: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9ed3ff;
}

.store-root .store-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 28px;
  overflow: hidden;
}

.store-root .store-home {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 12px 0;
  gap: 18px;
}

.store-root .store-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  gap: 12px;
}

.store-root .eyebrow {
  display: block;
  font-size: 12px;
  letter-spacing: .075em;
  font-weight: 600;
  margin-bottom: 10px;
}

.store-root .account-avatar {
  font-size: 20px;
}

.store-root .store-feed {
  flex: 1;
  min-height: 0;
  padding: 2px 3px 12px;
  touch-action: pan-y;
}

.store-root .editorial-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.store-root .editorial-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 380px;
  padding: 24px;
  border-radius: 30px;
  text-align: left;
  background: linear-gradient(145deg, rgb(114 172 192 / .43), rgb(42 62 78 / .38));
}

.store-root .editorial-card.scope {
  grid-column: 1 / -1;
  min-height: 300px;
  background: linear-gradient(120deg, rgb(70 112 80 / .42), rgb(37 63 53 / .4));
}

.store-root .editorial-card.chai {
  background: linear-gradient(135deg, rgb(151 113 78 / .44), rgb(76 57 52 / .36));
}

.store-root .editorial-card h2 {
  white-space: pre-line;
  font-size: 29px;
  position: relative;
  z-index: 2;
}

.store-root .editorial-card :deep(.store-art) {
  margin: 12px 0;
  width: 100%;
  flex: none;
  height: 190px;
  min-height: 0;
}

.store-root .editorial-card.scope {
  padding-right: 54%;
}

.store-root .editorial-card.scope :deep(.store-art) {
  position: absolute;
  left: 48%;
  top: 0;
  bottom: 0;
  width: 52%;
  height: 100%;
  margin: 0;
}

.store-root .editorial-bottom {
  display: block;
  position: relative;
  z-index: 2;
  margin-top: auto;
}

.store-root .editorial-bottom strong,
.store-root .editorial-bottom small {
  display: block;
}

.store-root .editorial-bottom small {
  font-size: 14px;
  color: rgb(255 255 255 / .8);
  margin-top: 4px;
}

.store-root .section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.store-root .app-list {
  display: grid;
  gap: 12px;
  margin-bottom: 20px;
}

.store-root .app-row {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px;
  min-width: 0;
}

.store-root .app-details {
  flex: 1;
  min-width: 0;
  padding: 8px;
  background: transparent;
}

.store-root .app-copy {
  display: block;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.store-root .app-copy strong {
  display: block;
  font-weight: 600;
}

.store-root .app-copy small {
  display: block;
  color: var(--vk-secondary);
  font-size: 14px;
  margin-top: 3px;
}

.store-root .row-rating {
  display: block;
  color: var(--vk-secondary);
  font-size: 12px;
  margin-top: 7px;
}

.store-root .rating-stars {
  display: inline-flex;
  gap: 1px;
  vertical-align: -2px;
  margin-right: 4px;
}

.store-root .rating-stars .app-glyph {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.store-root .search-area {
  flex: none;
}

.store-root .suggestions,
.store-root .filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.store-root .filters {
  margin: 0 0 22px;
}

.store-root .suggestions button,
.store-root .filters button {
  min-height: 44px;
}

.store-root .arcade-hero {
  padding: 26px;
  display: flex;
  gap: 20px;
  align-items: center;
  margin-bottom: 20px;
  background: rgb(78 114 88 / .3);
}

.store-root .arcade-hero h2 {
  font-size: 29px;
  max-width: 520px;
}

.store-root .arcade-hero p {
  font-size: 15px;
  color: var(--vk-secondary);
  margin-top: 12px;
}

.store-root .arcade-spark {
  width: 72px;
  height: 72px;
  color: #cbe3bf;
  margin-left: auto;
}

.store-root .empty-state {
  text-align: center;
  padding: 32px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.store-root .empty-state p {
  color: var(--vk-secondary);
}

.store-root .complete-mark {
  width: 44px;
  height: 44px;
  color: #b4e1c0;
}

.store-root .account-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  margin-bottom: 20px;
}

.store-root .account-card p {
  margin-top: 8px;
  font-size: 15px;
}

.store-root .profile-mark {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgb(255 255 255 / .12);
  flex: none;
  display: grid;
  place-items: center;
  font-size: 27px;
}

.store-root .account-settings {
  padding: 8px;
  margin-bottom: 26px;
}

.store-root .setting-row {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 12px;
}

.store-root .setting-row span {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.store-root .setting-row small {
  font-size: 14px;
}

.store-root .setting-row input {
  flex: none;
}

.store-root .account-settings > button {
  justify-content: space-between;
  background: transparent;
}

.store-root .library-note {
  margin: -5px 0 16px;
}

.store-root .remove-button {
  font-size: 22px;
}

.store-root .update-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
  margin-bottom: 20px;
}

.store-root .update-heading p {
  font-size: 15px;
  margin-top: 8px;
}

.store-root .update-all {
  min-height: 60px;
}

.store-root .update-row {
  padding: 8px;
  margin-bottom: 14px;
}

.store-root .update-row > p {
  padding: 8px 16px 16px;
  font-size: 15px;
}

.store-root .download-status {
  flex: none;
  justify-content: center;
  align-self: center;
  font-size: 13px;
  margin-bottom: 4px;
}

.store-root .download-status button {
  min-height: 44px;
  font-size: 14px;
  padding: 0 14px;
}

.store-root .download-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a8d5ff;
  flex: none;
}

.store-root .story-sheet {
  position: absolute;
  inset: 0;
  z-index: 5;
  padding: 0;
  transform-origin: top left;
  touch-action: pan-y;
}

.store-root .story-close {
  position: sticky;
  top: 16px;
  float: right;
  margin: 16px 16px -60px 0;
  z-index: 6;
  font-size: 24px;
}

.store-root .story-hero {
  padding: 38px 30px 28px;
  min-height: 400px;
  background: linear-gradient(135deg, #466779, #263d51);
}

.store-root .story-hero.chai {
  background: linear-gradient(135deg, #78624b, #3f3837);
}

.store-root .story-hero.scope {
  background: linear-gradient(135deg, #477552, #273f3b);
}

.store-root .story-hero h1 {
  white-space: pre-line;
  padding-right: 35px;
}

.store-root .story-hero :deep(.store-art) {
  height: 230px;
}

.store-root .story-hero > p {
  font-size: 18px;
}

.store-root .story-body {
  padding: 30px;
  max-width: 850px;
  margin: auto;
}

.store-root .story-body > p {
  margin-bottom: 22px;
  font-size: 18px;
  line-height: 1.65;
}

.store-root .story-app {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  margin: 26px 0 16px;
}

.store-root .story-app > div {
  flex: 1;
  min-width: 0;
}

.store-root .story-app small {
  display: block;
  font-size: 13px;
  margin-top: 4px;
}

.store-root .story-details {
  min-height: 60px;
  width: 100%;
}

.store-root .launch-backdrop {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / .22);
  z-index: 10;
}

.store-root .launch-sheet {
  width: min(100%, 520px);
  max-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  touch-action: pan-y;
}

.store-root .launch-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.store-root .launch-heading > button {
  font-size: 23px;
}

.store-root .launch-intro {
  font-size: 15px;
  margin-top: -9px;
}

.store-root .toy-list {
  display: grid;
  gap: 8px;
}

.store-root .toy-list button {
  justify-content: space-between;
}

.store-root .toy-controls {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.store-root .toy-controls button,
.store-root .launch-sheet > button {
  min-height: 60px;
}

.store-root .tea-clock {
  padding: 28px 18px;
  text-align: center;
}

.store-root .tea-clock strong {
  display: block;
  font-size: 52px;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.05em;
}

.store-root .tea-clock span {
  display: block;
  font-size: 15px;
  color: var(--vk-secondary);
}

.store-root .duck-response {
  padding: 24px;
}

.store-root .launch-sheet textarea {
  min-height: 110px;
  flex: none;
}

.store-root .garden-toy {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  min-height: 120px;
  padding: 22px;
  align-items: end;
}

.store-root .garden-toy .app-glyph {
  color: #b1dfaa;
  width: 38px;
  height: 44px;
}

.store-root .bug-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  justify-items: center;
  gap: 12px;
  padding: 18px;
}

.store-root .bug-grid button {
  color: #c9e8ba;
}

.store-root .traffic-light {
  align-self: center;
  display: flex;
  gap: 15px;
  padding: 18px;
}

.store-root .traffic-light i {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fe7777;
  opacity: .25;
}

.store-root .traffic-light i:nth-child(2) {
  background: #efd476;
}

.store-root .traffic-light i:nth-child(3) {
  background: #a3e4aa;
}

.store-root .traffic-light i.on {
  opacity: 1;
}

.store-root .focus-toy {
  min-height: 200px;
  position: relative;
  display: grid;
  place-items: center;
  text-align: center;
}

.store-root .breathing-disc {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgb(185 212 241 / .17);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .3);
}

.store-root .focus-toy strong {
  position: absolute;
  max-width: 70%;
  font-size: 17px;
}

.store-root .breathing-disc.breathing {
  animation: breathe 12s ease-in-out infinite;
}

.store-root .sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(.7);
  }
  33%,
  66% {
    transform: scale(1.25);
  }
}

@container (min-width: 1250px) {
  .store-root .editorial-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .store-root .editorial-card.scope {
    grid-column: auto;
    min-height: 380px;
    padding-right: 24px;
  }
  .store-root .editorial-card.scope :deep(.store-art) {
    position: relative;
    left: auto;
    top: auto;
    width: 100%;
    height: 190px;
    margin: 12px 0;
  }
  .store-root .app-list {
    grid-template-columns: 1fr 1fr;
  }
  .store-root .store-home {
    padding: 22px;
  }
}

@container (max-width: 720px) {
  .store-root {
    padding: 10px;
    gap: 8px;
  }
  .store-root .navigation-wrap {
    position: absolute;
    top: 10px;
    left: 12px;
    right: 12px;
    width: auto;
    height: 54px;
  }
  .store-root .store-navigation {
    flex-direction: row;
    padding: 5px;
    gap: 4px;
    touch-action: pan-x;
  }
  .store-root .store-stage {
    margin-top: 62px;
  }
  .store-root .nav-tooltip {
    display: none;
  }
  .store-root .store-home {
    padding: 12px 2px 0;
    gap: 15px;
  }
  .store-root .editorial-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .store-root .editorial-card.scope {
    grid-column: auto;
    min-height: 360px;
    padding-right: 22px;
  }
  .store-root .editorial-card.scope :deep(.store-art) {
    position: relative;
    left: auto;
    top: auto;
    width: 100%;
    height: 180px;
    margin: 12px 0;
  }
  .store-root .editorial-card {
    min-height: 0;
    padding: 22px;
  }
  .store-root .editorial-card h2 {
    font-size: 27px;
  }
  .store-root .store-header .eyebrow {
    font-size: 12px;
    margin-bottom: 7px;
  }
  .store-root h1 {
    font-size: 29px;
  }
  .store-root .account-avatar {
    width: 44px;
  }
  .store-root .app-row {
    flex-wrap: wrap;
    padding: 9px;
    gap: 8px;
  }
  .store-root .app-details {
    flex-basis: 100%;
    padding: 0;
  }
  .store-root .app-details :deep(.store-icon) {
    width: 52px;
    height: 52px;
    border-radius: 16px;
  }
  .store-root .app-details :deep(.store-icon svg) {
    width: 33px;
    height: 33px;
  }
  .store-root .app-row :deep(.store-get) {
    margin-left: auto;
    min-height: 44px;
  }
  .store-root .row-rating {
    font-size: 12px;
  }
  .store-root .section-heading {
    flex-wrap: wrap;
  }
  .store-root h2 {
    font-size: 22px;
  }
  .store-root .arcade-hero {
    padding: 22px;
  }
  .store-root .arcade-hero h2 {
    font-size: 25px;
  }
  .store-root .arcade-spark {
    display: none;
  }
  .store-root .account-card {
    flex-direction: column;
    align-items: start;
    padding: 20px;
  }
  .store-root .update-heading {
    flex-wrap: wrap;
    padding: 20px;
  }
  .store-root .setting-row {
    flex-wrap: nowrap;
  }
  .store-root .setting-row > span {
    min-width: 0;
  }
  .store-root .story-hero {
    padding: 30px 20px 22px;
  }
  .store-root .story-body {
    padding: 22px 18px;
  }
  .store-root .story-body > p {
    font-size: 17px;
  }
  .store-root .story-app {
    flex-wrap: wrap;
    padding: 14px;
  }
  .store-root .story-app :deep(.store-icon) {
    width: 52px;
    height: 52px;
  }
  .store-root .story-app :deep(.store-get) {
    margin-left: auto;
  }
  .store-root .download-status {
    font-size: 12px;
    gap: 4px;
  }
  .store-root .launch-sheet {
    padding: 20px;
  }
}

@container (max-height: 390px) {
  .store-root .store-home {
    gap: 10px;
    padding-top: 2px;
  }
  .store-root .store-header .eyebrow {
    display: none;
  }
  .store-root .search-area .suggestions {
    display: none;
  }
  .store-root .store-header h1 {
    font-size: 27px;
  }
  .store-root .download-status {
    margin-bottom: 0;
    padding: 4px;
  }
  .store-root .story-hero {
    min-height: 360px;
  }
}

.store-root .store-notice {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 32px);
  padding: 12px 18px;
  font-size: 14px;
  text-align: center;
  pointer-events: none;
  z-index: 12;
  animation: none;
}

.store-root .notice-enter-active,
.store-root .notice-leave-active {
  transition: opacity 250ms ease-out, transform 250ms ease-out;
}

.store-root .notice-enter-from,
.store-root .notice-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

.store-root .store-feed {
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / .25) transparent;
}

.store-root .store-feed::-webkit-scrollbar {
  display: block;
  width: 4px;
}

.store-root .store-feed::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgb(255 255 255 / .25);
}

.store-root .store-header > div {
  min-width: 0;
}

.store-root .story-app strong,
.store-root .toy-list span {
  overflow-wrap: anywhere;
}

.store-root .launch-sheet small {
  font-size: 12px;
}

@container (max-width: 420px) {
  .store-root .store-home {
    padding: 8px 2px 0;
  }
  .store-root .store-header .eyebrow {
    letter-spacing: .04em;
  }
  .store-root .editorial-card {
    padding: 20px;
  }
  .store-root .editorial-card h2 {
    font-size: 27px;
  }
  .store-root .account-card {
    flex-direction: row;
    gap: 12px;
    padding: 18px;
  }
  .store-root .profile-mark {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }
  .store-root .account-card h2 {
    font-size: 19px;
  }
  .store-root .setting-row {
    gap: 10px;
    padding: 10px;
  }
  .store-root .launch-backdrop {
    padding: 12px;
  }
  .store-root .toy-list .vk-row {
    align-items: start;
  }
  .store-root .toy-list .vk-row > span:last-child {
    flex: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .store-root :deep(*),
  .store-root :deep(*::before),
  .store-root :deep(*::after) {
    animation: none !important;
    transition: none !important;
  }
}
</style>
