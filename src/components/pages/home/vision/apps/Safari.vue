<script setup lang="ts">
import { listenAsApp } from '../bus';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import YtIcon from '../youtube/YtIcon.vue';
import BuiltinPage from './safari/BuiltinPage.vue';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
const config = useRuntimeConfig();
type BrowserTab = { id: number; history: string[]; cursor: number; private: boolean; revision: number };
type PageKind = 'start' | 'search' | 'stack' | 'news' | 'museum' | 'site' | 'external';
type Page = { kind: PageKind; url: string; title: string; query: string };
type SavedPage = { url: string; title: string };
const SITES = [
  { label: 'Portfolio', url: 'https://smohith.vercel.app', tint: '#159878', glyph: 'P' },
  { label: 'Studio', url: 'https://smohith.vercel.app/studio', tint: '#28384d', glyph: 'S' },
  { label: 'Gallery', url: 'https://card-galle.vercel.app', tint: '#9a7328', glyph: 'G' },
  { label: '3D Portfolio', url: 'https://3dinsightportfolio.vercel.app', tint: '#675da5', glyph: '3D' },
];
const LINKS = [
  { label: 'GitHub', url: String(config.public.GITHUB_LINK ?? ''), tint: '#24292f', glyph: 'G' },
  { label: 'LinkedIn', url: String(config.public.LINKEDIN_LINK ?? ''), tint: '#0a66c2', glyph: 'in' },
].filter(site => isWebAddress(site.url));
const demos = [
  { label: 'Stack Underflow', url: 'lab://stack', tint: '#a56836', glyph: '▤' },
  { label: 'The Daily Commit', url: 'lab://news', tint: '#456963', glyph: 'N' },
  { label: '404 Museum', url: 'lab://museum', tint: '#7f644f', glyph: '?' },
];
const browserTabs = ref<BrowserTab[]>([
  { id: 1, history: ['lab://start'], cursor: 0, private: false, revision: 0 },
  { id: 2, history: ['lab://stack'], cursor: 0, private: false, revision: 0 },
  { id: 3, history: ['lab://news'], cursor: 0, private: false, revision: 0 },
]);
let nextId = 4;
const activeId = ref(1);
const privateMode = ref(false);
const visibleTabs = computed(() => browserTabs.value.filter(item => item.private === privateMode.value));
const active = computed(() => browserTabs.value.find(item => item.id === activeId.value));
const location = computed(() => active.value?.history[active.value.cursor] ?? 'lab://start');
const page = computed(() => describe(location.value));
const draft = ref('');
const addressField = ref<HTMLInputElement | null>(null);
const overview = ref(false);
const sidebar = ref<'Bookmarks' | 'Reading List' | 'History' | null>(null);
const share = ref(false);
const reader = ref(false);
const findOpen = ref(false);
const find = ref('');
const matchCount = ref(0);
const matchIndex = ref(0);
const progress = ref(0);
const loading = ref(false);
const timedOut = ref(false);
const notice = ref('');
const bookmarks = ref<SavedPage[]>([...SITES.map(site => ({ url: site.url, title: site.label })), ...demos.map(site => ({ url: site.url, title: site.label }))]);
const readingList = ref<SavedPage[]>([
  { url: 'lab://stack', title: 'Why it works locally' },
  { url: 'lab://news', title: 'The Daily Commit' },
  { url: 'lab://museum', title: 'The 404 Museum' },
]);
const history = ref<SavedPage[]>([]);
const frequentlyVisited = computed(() => {
  const counts = new Map<string, number>();
  history.value.forEach(item => counts.set(item.url, (counts.get(item.url) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([url]) => ({ url, title: describe(url).title }));
});
let loadTimer: ReturnType<typeof setTimeout> | undefined;
let progressTimer: ReturnType<typeof setInterval> | undefined;
let focusBeforePopover: HTMLElement | null = null;
const popover = ref<HTMLElement | null>(null);
const builtIn = computed(() => ['search', 'stack', 'news', 'museum'].includes(page.value.kind));
function isWebAddress(value: string): boolean {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}
function host(value: string): string { try { return new URL(value).hostname; } catch { return value; } }
function describe(url: string): Page {
  if (url.startsWith('lab://')) {
    const parsed = new URL(url);
    const kind: PageKind = ['search', 'stack', 'news', 'museum'].includes(parsed.hostname) ? parsed.hostname as PageKind : 'start';
    const query = parsed.searchParams.get('q') ?? '';
    const titles: Partial<Record<PageKind, string>> = {
      stack: 'Stack Underflow', news: 'The Daily Commit', museum: '404 Museum', start: 'Start Page',
    };
    const title = kind === 'search' ? 'Search: ' + query : titles[kind] ?? 'Start Page';
    return { kind, url, title, query };
  }
  try {
    const parsed = new URL(url);
    const kind = SITES.some(site => new URL(site.url).origin === parsed.origin) ? 'site' : 'external';
    return { kind, url: parsed.href, title: parsed.hostname.replace(/^www[.]/, ''), query: '' };
  } catch { return { kind: 'start', url: 'lab://start', title: 'Start Page', query: '' }; }
}
function record(url: string): void {
  if (privateMode.value || url === 'lab://start') return;
  history.value = [{ url, title: describe(url).title }, ...history.value].slice(0, 100);
}
function visit(url: string): void {
  if (!active.value) return;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:', 'lab:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw new Error('Invalid address');
  } catch { notice.value = 'Use a valid web address or a search.'; return; }
  active.value.history = [...active.value.history.slice(0, active.value.cursor + 1), url];
  active.value.cursor = active.value.history.length - 1;
  overview.value = false; share.value = false; reader.value = false; find.value = ''; findOpen.value = false;
  record(url);
}
function submitAddress(): void {
  const value = draft.value.trim();
  if (!value) { visit('lab://start'); return; }
  if (value.startsWith('lab://')) { visit(value); return; }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.toLowerCase().startsWith('http://') && !value.toLowerCase().startsWith('https://')) {
    notice.value = 'Only http and https web addresses are supported.'; return;
  }
  if (isWebAddress(value) || (!Array.from(value).some(character => character.trim() === '') && value.split('/')[0]?.includes('.'))) {
    try {
      const url = new URL(isWebAddress(value) ? value : 'https://' + value);
      if (!url.hostname || url.username || url.password) throw new Error('Invalid address');
      visit(url.href);
    } catch { notice.value = 'That address needs another look. Try a domain or a search.'; }
  } else visit('lab://search?q=' + encodeURIComponent(value));
}
function newTab(): void {
  const id = nextId++;
  browserTabs.value.push({ id, history: ['lab://start'], cursor: 0, private: privateMode.value, revision: 0 });
  activeId.value = id; overview.value = false;
  void nextTick(() => addressField.value?.focus());
}
function closeTab(id: number): void {
  browserTabs.value = browserTabs.value.filter(item => item.id !== id);
  if (id !== activeId.value) return;
  const remaining = visibleTabs.value[visibleTabs.value.length - 1];
  if (remaining) activeId.value = remaining.id;
  else newTab();
}
function switchTab(id: number): void { activeId.value = id; overview.value = false; reader.value = false; find.value = ''; findOpen.value = false; }
function travel(direction: number): void {
  if (!active.value) return;
  const cursor = active.value.cursor + direction;
  if (cursor < 0 || cursor >= active.value.history.length) return;
  active.value.cursor = cursor; reader.value = false; find.value = ''; findOpen.value = false;
}
function reload(): void { if (active.value) active.value.revision++; beginLoading(); }
function clearLoading(): void { clearTimeout(loadTimer); clearInterval(progressTimer); }
function beginLoading(): void {
  clearLoading(); progress.value = .06; loading.value = true; timedOut.value = false;
  progressTimer = setInterval(() => { progress.value = Math.min(.85, progress.value + (1 - progress.value) * .14); }, 120);
  loadTimer = setTimeout(() => {
    clearLoading(); loading.value = false; progress.value = 1;
    if (page.value.kind === 'site') timedOut.value = true;
  }, page.value.kind === 'site' ? 10000 : 400);
}
function finishLoading(): void { clearLoading(); loading.value = false; timedOut.value = false; progress.value = 1; }
function togglePrivate(): void {
  privateMode.value = !privateMode.value; share.value = false; overview.value = false; sidebar.value = null;
  const next = visibleTabs.value[0];
  if (next) switchTab(next.id); else newTab();
}
function save(kind: 'bookmark' | 'reading'): void {
  const collection = kind === 'bookmark' ? bookmarks : readingList;
  if (!collection.value.some(item => item.url === location.value)) collection.value.push({ url: location.value, title: page.value.title });
  notice.value = kind === 'bookmark' ? 'Bookmark added.' : 'Added to Reading List. The headset believes in you.';
}
async function copyLink(): Promise<void> {
  try { await navigator.clipboard.writeText(location.value); notice.value = 'Address copied.'; }
  catch { notice.value = 'Clipboard unavailable. Select and copy the address above.'; addressField.value?.focus(); addressField.value?.select(); }
}
function showShare(): void {
  focusBeforePopover = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  share.value = !share.value;
  if (share.value) void nextTick(() => popover.value?.querySelector<HTMLButtonElement>('button')?.focus());
}
function closeShare(): void { share.value = false; void nextTick(() => focusBeforePopover?.focus()); }
function findNext(direction: number): void {
  if (matchCount.value) matchIndex.value = (matchIndex.value + direction + matchCount.value) % matchCount.value;
}
function updateMatches(count: number): void { matchCount.value = count; if (matchIndex.value >= count) matchIndex.value = 0; }
function keys(event: KeyboardEvent): void {
  if (event.key === 'Escape' && (share.value || overview.value || sidebar.value || findOpen.value || notice.value)) {
    event.preventDefault();
    event.stopPropagation();
    if (share.value) closeShare();
    else if (overview.value) overview.value = false;
    else if (sidebar.value) sidebar.value = null;
    else if (findOpen.value) { findOpen.value = false; find.value = ''; }
    else notice.value = '';
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') { event.preventDefault(); addressField.value?.focus(); addressField.value?.select(); return; }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    if (builtIn.value) findOpen.value = !findOpen.value;
    else notice.value = 'Find is available on the built-in pages. Open this website in your browser to search it.';
    return;
  }
  if (share.value && event.key === 'Tab') {
    const controls = Array.from(popover.value?.querySelectorAll<HTMLElement>('button, a[href]') ?? []);
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (!(event.target instanceof HTMLElement) || event.target.matches('input, textarea')) return;
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  const group = event.target.closest('[data-collection]');
  if (!group || !direction) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const index = buttons.indexOf(event.target.closest('button') as HTMLButtonElement);
  buttons[(index + direction + buttons.length) % buttons.length]?.focus(); event.preventDefault();
}
watch([activeId, location], () => {
  draft.value = location.value === 'lab://start' ? '' : location.value;
  notice.value = ''; reader.value = false; find.value = ''; share.value = false;
  beginLoading();
}, { immediate: true });

function jarvisMatch(value: string): string {
  return value.toLowerCase().replace(/\b(the|my)\b/g, '').replace(/\s+/g, ' ').trim();
}
function jarvisBrief(value: string): string {
  return value.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0F\u200D]/gu, '').trim().split(/\s+/).slice(0, 10).join(' ');
}
// JARVIS can work in Safari: open_site, search, back.
const stopJarvis = listenAsApp('safari', async command => {
  let line = "I can't do that in Safari yet.";
  try {
    await nextTick();
    if (command.action === 'do') {
      const arg = String(command.arg ?? '').trim();
      if (command.verb === 'back') {
        if (!active.value || active.value.cursor <= 0) line = 'There is no earlier page in this tab.';
        else {
          travel(-1); overview.value = false; sidebar.value = null;
          line = 'Went back to ' + jarvisBrief(page.value.title) + '.';
        }
      } else if (command.verb === 'search') {
        if (!arg) line = 'Tell me what to search for.';
        else if (!active.value) line = 'There is no active Safari tab.';
        else {
          visit('lab://search?q=' + encodeURIComponent(arg));
          sidebar.value = null;
          line = 'Searching Safari for ' + jarvisBrief(page.value.query) + '.';
        }
      } else if (command.verb === 'open_site') {
        const name = jarvisMatch(arg);
        const sites = [...SITES, ...LINKS, ...demos, ...bookmarks.value.map(item => ({ label: item.title, url: item.url })),
          { label: 'Wikipedia', url: 'https://www.wikipedia.org/' }, { label: 'GitHub', url: 'https://github.com/' },
          { label: 'Google', url: 'https://www.google.com/' }, { label: 'YouTube', url: 'https://www.youtube.com/' },
          { label: 'Apple', url: 'https://www.apple.com/' }, { label: 'LinkedIn', url: 'https://www.linkedin.com/' }];
        const site = name ? sites.find(item => jarvisMatch(item.label) === name)
          ?? sites.find(item => jarvisMatch(item.label).includes(name)) : undefined;
        const address = site?.url ?? (/^[a-z][a-z0-9+.-]*:/i.test(arg) ? arg : 'https://' + arg);
        if (!arg) line = 'Tell me which site to open.';
        else if (!active.value) line = 'There is no active Safari tab.';
        else if (!isWebAddress(address) && !(site && address.startsWith('lab://'))) line = "I couldn't find a valid address for that site.";
        else {
          draft.value = address;
          submitAddress(); sidebar.value = null;
          line = 'Navigated to ' + jarvisBrief(site?.label ?? page.value.title) + '.';
        }
      }
    }
  } catch { line = "I couldn't complete that in Safari."; }
  try {
    const reply = command.reply as ((line: string) => void) | undefined;
    reply?.(line);
  } catch { /* A reply callback must not interrupt the app. */ }
});

onBeforeUnmount(() => { stopJarvis(); clearLoading(); });
</script>

<template>
  <div class="safari-app" :class="{ compact, private: privateMode }" @keydown="keys">
    <div class="tab-strip vk-scroll" role="tablist" aria-label="Browser tabs" data-collection>
      <div v-for="item in visibleTabs" :key="item.id" class="browser-tab" :class="{ active: item.id === activeId }">
        <button v-hover class="tab-open" role="tab" :aria-selected="item.id === activeId"
          :aria-label="describe(item.history[item.cursor] ?? 'lab://start').title" @click="switchTab(item.id)">
          <YtIcon :name="item.private ? 'shield' : 'globe'" class="tab-glyph" />
          <span class="tab-title">{{ describe(item.history[item.cursor] ?? 'lab://start').title }}</span>
        </button>
        <button v-hover class="tab-close vk-icon" :aria-label="'Close ' + describe(item.history[item.cursor] ?? 'lab://start').title + ' tab'"
          @click="closeTab(item.id)">
          <YtIcon name="close" />
          </button>
      </div>
      <button v-hover class="vk-icon new-tab" aria-label="New tab" @click="newTab"><YtIcon name="create" /></button>
    </div>
    <header class="browser-toolbar">
      <div class="navigation-controls">
        <button v-hover class="vk-icon" aria-label="Show bookmarks sidebar" :aria-pressed="Boolean(sidebar)" @click="sidebar = sidebar ? null : 'Bookmarks'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="4" />
          <path d="M9 4v16M5 8h2m-2 4h2m-2 4h2" />
          </svg>
        </button>
        <button v-hover class="vk-icon" aria-label="Back" :disabled="!active || active.cursor === 0" @click="travel(-1)"><YtIcon name="back" /></button>
        <button v-hover class="vk-icon" aria-label="Forward" :disabled="!active || active.cursor >= active.history.length - 1" @click="travel(1)"><YtIcon name="forward" /></button>
      </div>
      <form class="address-form" @submit.prevent="submitAddress">
        <span aria-hidden="true" class="address-lock"><YtIcon :name="privateMode ? 'shield' : page.kind === 'site' ? 'globe' : 'search'" /></span>
        <input ref="addressField" v-model="draft" v-hover class="vk-field" aria-label="Search or enter website address" placeholder="Search or enter website name"
          type="text" inputmode="url" autocomplete="off" autocapitalize="off" :spellcheck="false" @focus="($event.target as HTMLInputElement).select()" />
        <button v-hover class="vk-icon reload" type="button" aria-label="Reload page" @click="reload"><YtIcon name="reload" /></button>
        <div v-if="loading" class="progress" aria-label="Loading page" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ transform: 'scaleX(' + progress + ')' }" />
        </div>
      </form>
      <div class="toolbar-actions">
        <button v-hover class="vk-icon" aria-label="Reader view" :aria-pressed="reader" :disabled="!builtIn" @click="reader = !reader">aA</button>
        <button v-hover class="vk-icon" aria-label="Share page" :aria-expanded="share" @click="showShare"><YtIcon name="share" /></button>
        <button v-hover class="vk-icon" aria-label="Tab overview" :aria-pressed="overview" @click="overview = !overview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
        </button>
        <button v-hover class="vk-icon"
          :aria-label="privateMode ? 'Switch to regular browsing' : 'Switch to private browsing'"
          :aria-pressed="privateMode"
          @click="togglePrivate"><YtIcon name="shield" /></button>
      </div>
    </header>
    <div v-if="findOpen && builtIn" class="find-bar vk-platter">
      <input
        v-model="find" v-hover class="vk-field" type="search" aria-label="Find on page" placeholder="Find on page"
        @input="matchIndex = 0"
        @keydown.enter.prevent="findNext(1)" />
      <span>{{ matchCount ? matchIndex + 1 : 0 }}/{{ matchCount }}</span>
      <button v-hover class="vk-icon" aria-label="Previous match" :disabled="!matchCount" @click="findNext(-1)"><YtIcon name="up" /></button>
      <button v-hover class="vk-icon" aria-label="Next match" :disabled="!matchCount" @click="findNext(1)"><YtIcon name="down" /></button>
      <button v-hover class="vk-icon" aria-label="Close find on page" @click="findOpen = false; find = ''"><YtIcon name="close" /></button>
    </div>
    <div class="browser-body">
      <aside v-if="sidebar" class="sidebar vk-platter vk-scroll" aria-label="Browser sidebar">
        <header><h2 class="vk-title">{{ sidebar }}</h2><button v-hover class="vk-icon" aria-label="Close sidebar" @click="sidebar = null"><YtIcon name="close" /></button></header>
        <div class="sidebar-tabs vk-scroll">
          <button
            v-for="name in (['Bookmarks', 'Reading List', 'History'] as const)"
            :key="name" v-hover class="vk-button"
            :aria-pressed="sidebar === name"
            @click="sidebar = name">{{ name }}</button>
        </div>
        <template v-if="sidebar === 'Bookmarks'">
          <button v-hover class="vk-row" @click="save('bookmark')"><YtIcon name="create" />Bookmark this page</button>
          <div v-for="item in bookmarks" :key="item.url" class="saved-row">
            <button v-hover class="vk-row" @click="visit(item.url); sidebar = null"><YtIcon name="bookmark" /><span>{{ item.title }}<small>{{ item.url }}</small></span></button>
            <button v-hover class="vk-icon" :aria-label="'Remove bookmark ' + item.title"
              @click="bookmarks = bookmarks.filter(entry => entry.url !== item.url)">
              <YtIcon name="close" />
              </button>
          </div>
        </template>
        <template v-else-if="sidebar === 'Reading List'">
          <button v-hover class="vk-row" @click="save('reading')"><YtIcon name="create" />Add this page</button>
          <div v-for="item in readingList" :key="item.url" class="saved-row">
            <button v-hover class="vk-row"
              @click="visit(item.url); sidebar = null">
              <YtIcon name="playlist" />
              <span>{{ item.title }}<small>Unread. Optimistically.</small>
              </span>
              </button>
            <button v-hover class="vk-icon"
              :aria-label="'Mark ' + item.title + ' as read and remove'"
              @click="readingList = readingList.filter(entry => entry.url !== item.url)"><YtIcon name="check" /></button>
          </div>
          <p v-if="!readingList.length" class="vk-secondary sidebar-empty">All read. A historic moment.</p>
        </template>
        <template v-else>
          <p v-if="privateMode" class="vk-secondary sidebar-empty">Private visits are not added to History.</p>
          <template v-else>
            <button v-hover class="vk-row" :disabled="!history.length" @click="history = []; notice = 'History cleared for this session.'">Clear History</button>
            <button v-for="(item, index) in history" :key="index" v-hover class="vk-row" @click="visit(item.url); sidebar = null">
              <YtIcon name="history" /><span>{{ item.title }}<small>{{ item.url }}</small></span>
            </button>
            <p v-if="!history.length" class="vk-secondary sidebar-empty">Your next detour starts here.</p>
          </template>
        </template>
      </aside>
      <main class="web-content vk-scroll" :class="{ 'real-page': page.kind === 'site', 'reader-page': reader }">
        <div v-if="overview" class="overview">
          <header><div><p class="eyebrow">{{ privateMode ? 'PRIVATE TABS' : 'YOUR OPEN WINDOWS' }}</p><h1 class="vk-large-title">Tab Overview</h1></div>
            <button v-hover class="vk-button" @click="newTab"><YtIcon name="create" />New tab</button>
          </header>
          <div class="overview-grid" data-collection>
            <div v-for="item in visibleTabs" :key="item.id" class="overview-card vk-platter">
              <button v-hover class="tab-preview" @click="switchTab(item.id)">
                <span class="mini-page" :class="describe(item.history[item.cursor] ?? 'lab://start').kind">
                  <img :src="'/phone/photos/' + (describe(item.history[item.cursor] ?? 'lab://start').kind === 'news' ? 'mountains-3' : 'workspace-1') + '.webp'" alt="" /><strong>{{ describe(item.history[item.cursor] ?? 'lab://start').title }}</strong><i /><i /><i />
                </span><b>{{ describe(item.history[item.cursor] ?? 'lab://start').title }}</b>
              </button>
              <button v-hover class="vk-icon" :aria-label="'Close tab ' + item.id" @click="closeTab(item.id)"><YtIcon name="close" /></button>
            </div>
          </div>
        </div>
        <div v-else-if="page.kind === 'start'" class="start-page">
          <header class="start-heading"><div><p class="eyebrow">{{ privateMode ? 'PRIVATE BROWSING' : 'SAFARI · POCKET LAB' }}</p>
            <h1 class="vk-large-title">{{ privateMode ? 'A little room to browse.' : 'A world of possibility.' }}</h1>
            <p class="vk-secondary">{{ privateMode ? 'Private tabs stay separate and do not enter this app’s History.' : 'A familiar place to start. Something new to discover.' }}</p>
          </div><span class="date-chip vk-chip">{{ vision?.now.value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) ?? 'Start Page' }}</span></header>
          <h2 class="vk-title">Favourites</h2>
          <div class="favourites" data-collection>
            <button v-for="site in [...SITES, ...LINKS]" :key="site.url" v-hover class="favourite" @click="visit(site.url)">
              <span class="favicon" :style="{ '--site-tint': site.tint }"><svg v-if="!['GitHub','LinkedIn'].includes(site.label)" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path v-if="site.label === 'Portfolio'" d="M8 7h16v18H8zM12 12h8m-8 5h8m-8 4h4"/><path v-else-if="site.label === 'Studio'" d="m7 23 3-9L23 4l5 6-13 10-8 3Zm3-9 5 6M4 28h24"/><path v-else-if="site.label === 'Gallery'" d="M5 6h22v20H5zM5 22l8-9 5 6 4-4 5 6"/><path v-else d="m16 3 12 7v13l-12 7-12-7V10l12-7Zm0 14 12-7M16 17 4 10m12 7v13"/></svg><span v-else>{{ site.glyph }}</span></span><b>{{ site.label }}</b><small>{{ host(site.url) }}</small>
            </button>
          </div>
          <div class="start-dashboard">
            <section class="reading-section vk-platter">
              <header><h2 class="vk-title">Reading List</h2><button v-hover class="vk-icon plain" aria-label="Show Reading List" @click="sidebar = 'Reading List'"><YtIcon name="forward" /></button></header>
              <button v-for="(item,index) in readingList.slice(0,1)" :key="item.url" v-hover class="reading-preview" @click="visit(item.url)">
                <img :src="'/phone/photos/' + (index ? 'mountains-3' : 'workspace-1') + '.webp'" alt="" loading="lazy" />
                <span><b>{{ item.title }}</b><small>{{ item.url.startsWith('lab:') ? 'SAMPLE ARTICLE · SAVED FOR LATER' : host(item.url) }}</small></span><YtIcon name="forward" />
              </button>
              <p v-if="!readingList.length" class="reading-empty">All caught up. Save a page to enjoy it later.</p>
            </section>
            <section class="privacy-report vk-platter"><span class="privacy-shield"><YtIcon name="shield" /></span>
              <div><h2 class="vk-title">Privacy Report</h2><p>A little peace of mind.</p><small class="vk-secondary">This simulation adds no tracking scripts. Websites you visit have their own privacy policies.</small></div>
              <span class="privacy-label">LOCAL BROWSING</span>
            </section>
          </div>
          <h2 class="vk-title">{{ frequentlyVisited.length ? 'Frequently Visited' : 'Explore something new' }}</h2>
          <div class="frequent" data-collection>
            <button v-for="site in (privateMode || !frequentlyVisited.length ? demos : frequentlyVisited)" :key="site.url" v-hover class="vk-row vk-platter" @click="visit(site.url)">
              <span class="frequent-icon"><YtIcon :name="site.url.includes('stack') ? 'comment' : site.url.includes('news') ? 'playlist' : 'globe'" /></span>
              <span>{{ 'label' in site ? site.label : site.title }}<small>{{ site.url.startsWith('lab:') ? 'An interactive sample website' : site.url }}</small></span><YtIcon name="forward" />
            </button>
          </div>
        </div>
        <div v-else-if="page.kind === 'site'" class="iframe-container">
          <iframe :key="activeId + ':' + page.url + ':' + active?.revision" :src="page.url" :title="page.title" referrerpolicy="no-referrer" @load="finishLoading" />
          <div v-if="loading" class="frame-loading" role="status"><span class="loading-orbit"><YtIcon name="globe" /></span>Opening {{ page.title }}...</div>
          <div v-if="timedOut" class="frame-help vk-sheet"><p>This page is taking a moment, or may not allow an embedded view.</p>
            <button v-hover class="vk-button" @click="reload">Retry</button>
            <a v-hover class="vk-button" :href="page.url" target="_blank" rel="noopener noreferrer">Open in browser<YtIcon name="external" /></a>
            <button v-hover class="vk-icon" aria-label="Dismiss loading help" @click="timedOut = false"><YtIcon name="close" /></button>
          </div>
        </div>
        <div v-else-if="page.kind === 'external'" class="interstitial">
          <div class="external-emblem"><YtIcon name="external" /></div><p class="eyebrow">A WINDOW INTO THE WEB</p><h1 class="vk-large-title">{{ page.title }}</h1>
          <p>Many websites block embedded browsing. Open this address in your browser.</p>
          <a v-hover class="vk-button primary external-open" :href="page.url" target="_blank" rel="noopener noreferrer">Open in a new browser tab<YtIcon name="external" /></a>
          <p class="vk-footnote vk-secondary external-url">{{ page.url }}</p>
          <h2 class="vk-title">Or take a local detour</h2>
          <div class="detours" data-collection>
          <button
            v-for="demo in demos"
            :key="demo.url" v-hover class="vk-row vk-platter"
            @click="visit(demo.url)">{{ demo.glyph }} {{ demo.label }} <YtIcon name="forward" />
          </button>
          </div>
        </div>
        <BuiltinPage v-else :key="page.url + ':' + active?.revision" :kind="page.kind" :query="page.query" :reader="reader" :find="find"
          :match-index="matchIndex" @navigate="visit" @matches="updateMatches" />
      </main>
    </div>
    <footer class="bottom-ornament vk-ornament">
      <button v-hover class="vk-icon" aria-label="Start Page" @click="visit('lab://start')"><YtIcon name="home" /></button>
      <button v-hover class="vk-button" :aria-pressed="privateMode"
        @click="togglePrivate">
        <YtIcon v-if="privateMode" name="shield" />{{ privateMode ? 'Private' : 'Regular' }}</button>
      <button v-hover class="vk-icon" aria-label="Find on page" :disabled="!builtIn" :aria-pressed="findOpen" @click="findOpen = !findOpen"><YtIcon name="search" /></button>
      <button v-hover class="vk-icon" aria-label="Add to Reading List" @click="save('reading')"><YtIcon name="playlist" /></button>
    </footer>
    <div v-if="share" class="share-backdrop" @click.self="closeShare">
      <section ref="popover" class="share-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true" aria-label="Share page">
        <header><h2 class="vk-title">Share page</h2><button v-hover class="vk-icon" aria-label="Close share sheet" @click="closeShare"><YtIcon name="close" /></button></header>
        <p>{{ page.title }}</p><small class="vk-secondary">{{ page.url }}</small>
        <button v-hover class="vk-row" @click="copyLink"><YtIcon name="share" />Copy address</button>
        <button v-hover class="vk-row" @click="save('bookmark')"><YtIcon name="bookmark" />Add Bookmark</button>
        <button v-hover class="vk-row" @click="save('reading')"><YtIcon name="playlist" />Add to Reading List</button>
        <a v-if="page.url.startsWith('http')" v-hover class="vk-row" :href="page.url" target="_blank" rel="noopener noreferrer">
          <YtIcon name="external" />Open in a new browser tab</a>
        <p v-if="notice" role="status">{{ notice }}</p>
      </section>
    </div>
    <div
      v-if="notice && !share" class="notice vk-platter">
    <span role="status">{{ notice }}</span>
    <button v-hover class="vk-icon" aria-label="Dismiss notification"
      @click="notice = ''"><YtIcon name="close" /></button>
    </div>
  </div>
</template>

<style scoped src="./safari/safari.css"></style>
