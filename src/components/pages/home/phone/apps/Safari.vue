<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
/**
 * A small working browser. Its own sites load for real in a frame; made-up
 * pages are drawn here; everything else offers to open in the visitor's browser,
 * because most sites refuse to be framed.
 */
type Tab = {
    id: number;
    stack: string[];
    at: number;
};
const config = useRuntimeConfig();
const FRAMED = ['smohith.vercel.app', 'card-galle.vercel.app'];
const FAVOURITES = [
    {
        label: 'Portfolio',
        to: 'https://smohith.vercel.app',
        tint: '#10b981',
        glyph: 'M'
    },
    {
        label: 'Gallery',
        to: 'https://card-galle.vercel.app',
        tint: '#e8c170',
        glyph: 'G'
    },
    {
        label: 'GitHub',
        to: String(config.public.GITHUB_LINK),
        tint: '#24292f',
        glyph: 'gh'
    },
    {
        label: 'LinkedIn',
        to: String(config.public.LINKEDIN_LINK),
        tint: '#0a66c2',
        glyph: 'in'
    },
    {
        label: 'Stack Overflow',
        to: 'stackunderflow.dev',
        tint: '#f48024',
        glyph: 'SO'
    },
    {
        label: 'localhost',
        to: 'localhost:3000',
        tint: '#8e8e93',
        glyph: ':3k'
    },
    {
        label: 'Duckipedia',
        to: 'duckipedia.org/rubber-duck',
        tint: '#f5c518',
        glyph: 'D'
    },
    {
        label: 'This room',
        to: 'https://3dinsightportfolio.vercel.app',
        tint: '#5856d6',
        glyph: '3D'
    },
];
const RESULTS = [
    {
        site: 'stackunderflow.dev',
        to: 'stackunderflow.dev',
        title: '{q} [closed as duplicate]',
        text: 'Marked as duplicate of a question that was itself marked as duplicate. 14 years ago. The link is dead.'
    },
    {
        site: 'duckipedia.org',
        to: 'duckipedia.org/rubber-duck',
        title: '{q}  ·  Duckipedia, the quacking encyclopedia',
        text: 'This article needs additional citations. It has needed them since it was written.'
    },
    {
        site: 'medium-rare.blog',
        to: '',
        title: 'I tried {q} for 30 days. Here is what happened.',
        text: 'Nothing happened. 14 min read. Member-only story.'
    },
    {
        site: 'localhost:3000',
        to: 'localhost:3000',
        title: '{q} | My Awesome App',
        text: 'This site can’t be reached. It worked a minute ago, on someone’s machine.'
    },
    {
        site: 'forum.oldinternet.net',
        to: '',
        title: 'SOLVED: {q}',
        text: '“nvm, fixed it.”  ·  the only reply, posted in 2009, with no explanation.'
    },
];
let nextId = 1;
const tabs = ref<Tab[]>([{
        id: nextId++,
        stack: ['start:'],
        at: 0
    }]);
const activeId = ref(tabs.value[0].id);
const overview = ref(false);
const editing = ref(false);
const address = ref('');
const loading = ref(false);
const frameRevision = ref(0);
const field = ref<HTMLInputElement>();
const tab = computed(() => tabs.value.find(item => item.id === activeId.value) ?? tabs.value[0]);
const url = computed(() => tab.value.stack[tab.value.at]);
const kind = computed(() => url.value.slice(0, url.value.indexOf(':')));
const rest = computed(() => url.value.slice(url.value.indexOf(':') + 1));
const host = (value: string) => {
    try {
        return new URL(value).hostname.replace(/^www\./, '');
    }
    catch {
        return value;
    }
};
const titleOf = (value: string) => {
    const [type, ...tail] = value.split(':');
    const body = tail.join(':');
    return type === 'start' ? 'Start Page' : type === 'search' ? body : type === 'page' ? {
        stack: 'stackunderflow.dev',
        local: 'localhost:3000',
        duck: 'duckipedia.org'
    }[body] ?? body : host(body);
};
const shown = computed(() => (kind.value === 'start' ? '' : titleOf(url.value)));
let loadTimer = 0;
function resolve(input: string): string {
    const text = input.trim();
    if (!text)
        return 'start:';
    if (/^(https?:\/\/)?(www\.)?stack(under|over)flow/i.test(text))
        return 'page:stack';
    if (/^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(text))
        return 'page:local';
    if (/^(https?:\/\/)?(www\.)?duckipedia/i.test(text))
        return 'page:duck';
    // Other schemes (javascript:, data:, file:) are never navigated to.
    if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text))
        return `search:${text}`;
    if (/^https?:\/\//i.test(text) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text)) {
        try {
            const target = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
            return `${FRAMED.includes(target.hostname.replace(/^www\./, '')) ? 'web' : 'ext'}:${target.href}`;
        }
        catch { /* fall through to search */
        }
    }
    return `search:${text}`;
}
function go(input: string) {
    const target = resolve(input), current = tab.value;
    editing.value = false;
    overview.value = false;
    if (target === url.value)
        return;
    current.stack.splice(current.at + 1, Infinity, target);
    current.at = current.stack.length - 1;
    load();
}
function load() {
    frameRevision.value++;
    loading.value = true;
    clearTimeout(loadTimer);
    loadTimer = window.setTimeout(() => {
        loading.value = false;
    }, 650);
}
function step(by: number) {
    const to = tab.value.at + by;
    if (to < 0 || to >= tab.value.stack.length)
        return;
    tab.value.at = to;
    load();
}
function edit() {
    editing.value = true;
    address.value = kind.value === 'start' ? '' : kind.value === 'search' ? rest.value : kind.value === 'page' ? titleOf(url.value) : rest.value;
    void nextTick(() => {
        field.value?.focus();
        field.value?.select();
    });
}
function newTab() {
    const created = {
        id: nextId++,
        stack: ['start:'],
        at: 0
    };
    tabs.value.push(created);
    activeId.value = created.id;
    overview.value = false;
}
function closeTab(id: number) {
    if (tabs.value.length === 1) {
        tabs.value[0].stack = ['start:'];
        tabs.value[0].at = 0;
        return;
    }
    const index = tabs.value.findIndex(item => item.id === id);
    if (index < 0)
        return;
    tabs.value.splice(index, 1);
    if (activeId.value === id)
        activeId.value = tabs.value[Math.max(0, index - 1)].id;
}
function outside(target: string) {
    window.open(target, '_blank', 'noopener,noreferrer');
}
onBeforeUnmount(() => clearTimeout(loadTimer));
</script>

<template>
  <div class="app" :class="{ dark: overview }">
    <div class="page" :class="{ loading }">
      <!--Start page-->
      <div v-if="kind === 'start'" class="start">
        <h2>Favourites</h2>
        <div class="favourites">
          <button v-for="item in FAVOURITES" :key="item.label" @click="go(item.to)">
            <i :style="{ background: item.tint }">{{ item.glyph }}</i>
            {{ item.label }}
          </button>
        </div>
        <h2>Privacy Report</h2>
        <p class="card">
          <b>47</b>
          This pretend browser stopped 47 imaginary trackers. Your search for “how to centre a div” remains a local matter.
        </p>
        <h2>Reading List</h2>
        <ul class="reading">
          <li>
            <i style="background:#ff9f0a">☕</i>
            <span>
              <b>The complete guide to finishing side projects</b>
              Saved 2 years ago · Unread
            </span>
          </li>
          <li>
            <i style="background:#5856d6">∞</i>
            <span>
              <b>Why your loop never ends (part 1 of ∞)</b>
              Saved last night at 3:12 AM
            </span>
          </li>
          <li>
            <i style="background:#34c759">✓</i>
            <span>
              <b>10 habits of people who close their tabs</b>
              Saved in one of 38 tabs
            </span>
          </li>
        </ul>
      </div>
      <!--Search results-->
      <div v-else-if="kind === 'search'" class="results">
        <p class="engine">
          Q
          <span>uack</span>
          Search
        </p>
        <p class="count">About 4,20,000 results (0.42 seconds, most of it buffering)</p>
        <article v-for="item in RESULTS" :key="item.site">
          <small>{{ item.site }}</small>
          <button :disabled="!item.to" @click="go(item.to)">{{ item.title.replace('{q}', rest) }}</button>
          <p>{{ item.text }}</p>
        </article>
        <button class="real" @click="outside(`https://www.google.com/search?q=${encodeURIComponent(rest)}`)">
          Search the real web for “
          {{ rest }}
          ” ↗
        </button>
      </div>
      <!--A site that loads for real-->
      <iframe
        v-else-if="kind === 'web'"
        :key="rest + '-' + frameRevision"
        :src="rest"
        :title="host(rest)"
        referrerpolicy="no-referrer"
        loading="lazy"
       />
      <!--A site that will not load in a frame-->
      <div v-else-if="kind === 'ext'" class="blocked">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="2.500" />
          <path
            d="M5 24h38M24 5c6 5 8.500 12 8.500 19S30 38 24 43c-6-5-8.500-12-8.500-19S18 10 24 5Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2.500"
           />
        </svg>
        <template v-if="host(rest) === '3dinsightportfolio.vercel.app'">
          <h2>You are already here.</h2>
          <p>
            Opening this room inside a phone inside this room has been disabled, for the safety of the universe.
          </p>
        </template>
        <template v-else>
          <h2>{{ host(rest) }}</h2>
          <p>
            This site does not allow itself to be shown inside a pretend phone. Fair enough.
          </p>
          <button class="primary" @click="outside(rest)">Open in your browser ↗</button>
        </template>
      </div>
      <!--Made-up pages-->
      <div v-else-if="rest === 'stack'" class="fake stack">
        <header>
          <b>
            stack
            <em>underflow</em>
          </b>
          <span>Log in</span>
        </header>
        <h2>Why does my code work only when I am not looking at it?</h2>
        <p class="meta">
          Asked 3 years ago · Viewed 1.2m times ·
          <mark>Closed</mark>
        </p>
        <div class="post">
          <div class="votes">
            <i>▲</i>
            <b>4096</b>
            <i>▼</i>
          </div>
          <p>
            It passes every test until I share my screen. Then it fails in a new and creative way. I have tried restarting, reinstalling, and making direct eye contact with the laptop.
          </p>
        </div>
        <h3>3 Answers</h3>
        <div class="post">
          <div class="votes">
            <i>▲</i>
            <b>812</b>
            <i>▼</i>
            <u>✓</u>
          </div>
          <p>
            <b>Accepted.</b>
            This is a known feature called observation. Remove the manager from the call and try again.
          </p>
        </div>
        <div class="post">
          <div class="votes">
            <i>▲</i>
            <b>-3</b>
            <i>▼</i>
          </div>
          <p>
            Why would you even want to do this? Use a completely different language.
          </p>
        </div>
        <div class="post">
          <div class="votes">
            <i>▲</i>
            <b>57</b>
            <i>▼</i>
          </div>
          <p>nvm, fixed it.</p>
        </div>
      </div>
      <div v-else-if="rest === 'local'" class="blocked local">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <rect
            x="8"
            y="10"
            width="32"
            height="22"
            rx="3"
            fill="none"
            stroke="currentColor"
            stroke-width="2.500"
           />
          <path
            d="M18 40h12M24 32v8M19 17l10 9M29 17l-10 9"
            stroke="currentColor"
            stroke-width="2.500"
            stroke-linecap="round"
           />
        </svg>
        <h2>Safari can’t connect to the server.</h2>
        <p>
          “localhost:3000” is not running. Have you tried actually starting it? The terminal on the other pedestal is right there.
        </p>
        <button class="primary" @click="load()">Try again, with feeling</button>
      </div>
      <div v-else class="fake duck">
        <header>
          <b>Duckipedia</b>
          <span>The quacking encyclopedia</span>
        </header>
        <h2>Rubber duck debugging</h2>
        <p>
          <i>From Duckipedia. This article has multiple issues. So does your code.</i>
        </p>
        <p>
          <b>Rubber duck debugging</b>
          is a method in which a developer explains a problem, line by line, to a small yellow duck. The duck says nothing. The developer finds the bug. The duck takes the credit.
        </p>
        <h3>History</h3>
        <p>
          The practice dates back to the first time someone said “wait, never mind” halfway through asking a question.
        </p>
        <h3>Criticism</h3>
        <p>
          Some argue the duck is overqualified. Others note it has never once been late to a stand-up.
        </p>
      </div>
    </div>
    <i class="progress" :class="{ on: loading }" />
    <!--Tab overview-->
    <Transition name="over">
      <div v-if="overview" class="overview">
        <div class="tiles">
          <div v-for="item in tabs" :key="item.id" class="tile" :class="{ current: item.id === activeId }">
            <button
              class="close"
              :aria-label="`Close ${titleOf(item.stack[item.at])}`"
              @click="closeTab(item.id)"
            >
              <AppGlyph name="close" />
            </button>
            <button
              class="thumb"
              :aria-label="`Show ${titleOf(item.stack[item.at])}`"
              @click="activeId = item.id; overview = false"
            >
              <span>{{ titleOf(item.stack[item.at]) }}</span>
            </button>
          </div>
        </div>
        <div class="over-bar">
          <button aria-label="New tab" @click="newTab">
            <AppGlyph name="plus" />
          </button>
          <span>
            {{ tabs.length }}
            {{ tabs.length === 1 ? 'Tab' : 'Tabs' }}
          </span>
          <button @click="overview = false">Done</button>
        </div>
      </div>
    </Transition>
    <!--Floating Liquid Glass toolbar-->
    <form v-if="!overview" class="toolbar" @submit.prevent="go(address)">
      <button
        type="button"
        class="glass round"
        aria-label="Back"
        :disabled="tab.at === 0"
        @click="step(-1)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.500 5 8 12l6.500 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2.200"
            stroke-linecap="round"
            stroke-linejoin="round"
           />
        </svg>
      </button>
      <div class="glass bar">
        <input
          v-if="editing"
          ref="field"
          v-model="address"
          type="text"
          inputmode="url"
          placeholder="Search or enter website name"
          aria-label="Address"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="go"
          @blur="editing = false"
         />
        <button v-else type="button" class="address" aria-label="Edit address" @click="edit">
          <svg v-if="shown" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3.500" y="7" width="9" height="6.500" rx="1.800" fill="currentColor" />
            <path
              d="M5.500 7V5.300a2.500 2.500 0 0 1 5 0V7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.500"
             />
          </svg>
          <span :class="{ hint: !shown }">{{ shown || 'Search or enter website name' }}</span>
        </button>
        <button
          v-if="!editing && kind !== 'start'"
          type="button"
          class="reload"
          aria-label="Reload"
          @click="load"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M18.500 12A6.500 6.500 0 1 1 16 6.900M16.500 3.500V7.500h-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
             />
          </svg>
        </button>
      </div>
      <button
        type="button"
        class="glass round"
        :aria-label="`Show ${tabs.length} tabs`"
        @click="overview = true"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="4"
            y="8"
            width="12"
            height="12"
            rx="3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.900"
           />
          <path
            d="M8.500 5h8.500a3 3 0 0 1 3 3v8.500"
            fill="none"
            stroke="currentColor"
            stroke-width="1.900"
            stroke-linecap="round"
           />
        </svg>
      </button>
    </form>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #f2f2f7;
  color: #000;
}

button {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  padding: 0;
}

button:focus-visible, input:focus-visible {
  outline: 2px solid #007aff;
  outline-offset: 2px;
}

.page {
  position: absolute;
  inset: 0;
  padding-top: var(--safe-top,62px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  transition: transform 250ms ease, opacity 250ms ease;
}

.page.loading {
  opacity: .45;
}

.page>div {
  padding: 6px 18px 128px;
  min-height: 100%;
}

iframe {
  display: block;
  width: 100%;
  height: calc(100% - 0px);
  border: 0;
  background: #fff;
}

.progress {
  position: absolute;
  left: 0;
  top: var(--safe-top,62px);
  height: 2.500px;
  width: 0;
  background: #007aff;
  opacity: 0;
  z-index: 3;
}

.progress.on {
  animation: load .65s ease-out;
}

h2 {
  margin: 18px 0 10px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -.03em;
}

h3 {
  margin: 18px 0 6px;
  font-size: 18px;
  font-weight: 700;
}

.favourites {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 18px 8px;
}

.favourites button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  min-height: 44px;
}

.favourites i {
  width: 62px;
  height: 62px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  color: #fff;
  font-style: normal;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -.02em;
  box-shadow: 0 1px 3px rgb(0 0 0 / .18);
}

.favourites button:active i {
  filter: brightness(.85);
}

.card {
  margin: 0;
  padding: 14px 16px;
  border-radius: 18px;
  background: #fff;
  font-size: 15px;
  line-height: 1.38;
  color: #3c3c43;
  display: flex;
  gap: 14px;
  align-items: center;
}

.card b {
  font-size: 34px;
  color: #000;
  font-weight: 700;
}

.reading {
  list-style: none;
  margin: 0;
  padding: 4px 16px;
  border-radius: 18px;
  background: #fff;
}

.reading li {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 11px 0;
}

.reading li+li {
  border-top: 1px solid #3c3c4321;
}

.reading i {
  width: 42px;
  height: 42px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-style: normal;
  color: #fff;
  flex-shrink: 0;
  font-size: 19px;
}

.reading span {
  font-size: 13px;
  color: #8e8e93;
  line-height: 1.3;
}

.reading b {
  display: block;
  font-size: 15px;
  color: #000;
  font-weight: 600;
}

.results {
  background: #fff;
}

.engine {
  margin: 14px 0 4px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -.04em;
  color: #f5a300;
}

.engine span {
  color: #111;
}

.count {
  margin: 0 0 14px;
  font-size: 12px;
  color: #8e8e93;
}

.results article {
  padding: 12px 0;
  border-top: 1px solid #3c3c4321;
}

.results small {
  font-size: 12px;
  color: #3c3c4399;
}

.results article button {
  display: block;
  text-align: left;
  font-size: 18px;
  line-height: 1.25;
  color: #1a56db;
  min-height: 44px;
}

.results article button:disabled {
  cursor: default;
  color: #5b3fbd;
}

.results p {
  margin: 2px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: #3c3c43;
}

.real {
  margin-top: 18px;
  width: 100%;
  min-height: 48px;
  border-radius: 14px;
  background: #007aff1a;
  color: #007aff;
  font-weight: 600;
}

.blocked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 6px;
  padding: 0 40px 150px!important;
  color: #3c3c43;
}

.blocked svg {
  width: 60px;
  height: 60px;
  color: #8e8e93;
}

.blocked h2 {
  font-size: 22px;
  color: #000;
  overflow-wrap: anywhere;
}

.blocked p {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
}

.primary {
  margin-top: 18px;
  min-height: 50px;
  padding: 0 24px;
  border-radius: 25px;
  background: #007aff;
  color: #fff;
  font-weight: 600;
}

.primary:active {
  transform: scale(.97);
}

.fake {
  background: #fff;
  user-select: text;
}

.fake header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 -18px;
  padding: 10px 18px;
  border-bottom: 1px solid #0000001f;
  font-size: 13px;
  color: #6a737c;
}

.stack header {
  border-top: 3px solid #f48024;
}

.stack header b {
  font-size: 19px;
  color: #222;
  font-weight: 400;
}

.stack header em {
  font-style: normal;
  font-weight: 800;
}

.fake h2 {
  font-size: 21px;
  line-height: 1.25;
  font-weight: 600;
}

.meta {
  margin: 0 0 6px;
  font-size: 12px;
  color: #6a737c;
}

.meta mark {
  background: #fdf7e2;
  color: #7a5b00;
  padding: 1px 6px;
  border-radius: 4px;
}

.post {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid #0000001a;
}

.post p {
  margin: 0;
  font-size: 15px;
  line-height: 1.45;
  color: #232629;
}

.votes {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: #babfc4;
  width: 38px;
  flex-shrink: 0;
}

.votes i {
  font-style: normal;
  font-size: 18px;
}

.votes b {
  color: #232629;
  font-size: 17px;
  font-weight: 600;
}

.votes u {
  text-decoration: none;
  color: #2f6f44;
  font-size: 22px;
  font-weight: 800;
}

.duck header b {
  font-family: Georgia,'Times New Roman',serif!important;
  font-size: 22px;
  color: #111;
  font-weight: 400;
}

.duck h2, .duck h3 {
  font-family: Georgia,'Times New Roman',serif!important;
  font-weight: 400;
  border-bottom: 1px solid #a2a9b1;
  padding-bottom: 3px;
}

.duck h2 {
  font-size: 28px;
}

.duck p {
  margin: 8px 0;
  font-size: 15px;
  line-height: 1.5;
  color: #202122;
}

.toolbar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: calc(var(--safe-bottom,34px) + 4px);
  display: flex;
  gap: 9px;
  align-items: center;
  z-index: 4;
}

.glass {
  height: 50px;
  border-radius: 25px;
  color: #111;
  background: linear-gradient(180deg,rgb(255 255 255 / .82),rgb(255 255 255 / .62));
  backdrop-filter: blur(26px) saturate(190%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .9),inset 0 0 0 1px rgb(255 255 255 / .5),0 6px 22px rgb(0 0 0 / .16);
}

.round {
  width: 50px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.round svg {
  width: 23px;
  height: 23px;
}

.round:disabled {
  color: #b4b4b9;
  cursor: default;
}

.bar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0 6px 0 14px;
}

.address {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  font-size: 16px;
}

.address svg {
  width: 14px;
  height: 14px;
  color: #6b6b70;
  flex-shrink: 0;
}

.address span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  color: #6b6b70;
}

.bar input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 17px;
  color: #000;
  user-select: text;
}

.reload {
  width: 40px;
  height: 44px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.reload svg {
  width: 20px;
  height: 20px;
}

.overview {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: #1c1c1e;
  color: #fff;
  padding: calc(var(--safe-top,62px) + 10px) 16px 0;
  display: flex;
  flex-direction: column;
}

.tiles {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-content: start;
}

.tile {
  position: relative;
}

.thumb {
  display: block;
  width: 100%;
  height: 250px;
  border-radius: 18px;
  background: linear-gradient(180deg,#f2f2f7,#d8d8de);
  color: #111;
  padding: 14px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 8px 22px rgb(0 0 0 / .4);
}

.thumb span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 30px;
}

.tile.current .thumb {
  box-shadow: 0 0 0 3px #0a84ff,0 8px 22px rgb(0 0 0 / .4);
}

.close {
  position: absolute;
  top: 0;
  right: 0;
  width: 44px;
  height: 44px;
  z-index: 1;
  color: #3c3c43;
  font-size: 22px;
}

.over-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 6px calc(var(--safe-bottom,34px) + 6px);
}

.over-bar button {
  min-width: 60px;
  min-height: 44px;
  font-size: 18px;
  font-weight: 600;
}

.over-bar span {
  font-size: 15px;
  color: #98989f;
}

.over-enter-active, .over-leave-active {
  transition: transform 250ms ease, opacity 250ms ease;
}

.over-enter-from, .over-leave-to {
  opacity: 0;
  transform: scale(1.060);
}

@keyframes load {
  0% {
    width: 8%;
    opacity: 1;
  }
  80% {
    width: 92%;
    opacity: 1;
  }
  100% {
    width: 100%;
    opacity: 0;
  }
}

@media(prefers-reduced-motion:reduce) {
  .page, .over-enter-active, .over-leave-active {
    transition: none;
  }
  .progress.on {
    animation: none;
  }
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  container-type: size;
  min-width: 0;
  min-height: 0;
}

.app :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

button, a[download] {
  min-width: 44px;
  min-height: 44px;
  touch-action: manipulation;
  transition: transform 220ms ease, opacity 220ms ease;
}

button:active:not(:disabled), a[download]:active {
  transform: scale(.96);
}

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid var(--accent, #007aff);
  outline-offset: 3px;
}

.icon, .tool, .glass-round, .round, .go, .send {
  flex-shrink: 0;
}

.scroll, .scroller, .feed, .page, .tiles {
  min-width: 0;
  min-height: 0;
  overscroll-behavior: contain;
}

.tabs button {
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
}

@media (hover: hover) {
  button:hover:not(:disabled), a[download]:hover {
    opacity: .82;
  }
}

@media (pointer: coarse) {
  button, a[download] {
    min-width: 58px;
    min-height: 58px;
  }
  .tabs button {
    min-width: 0;
    min-height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app :deep(*), .app :deep(*::before), .app :deep(*::after) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.app {
  font-size: 17px;
}

.reload {
  width: 44px;
  min-width: 44px;
  min-height: 44px;
}

.toolbar {
  gap: 8px;
}

.bar {
  padding-left: 10px;
}

.address {
  min-width: 0;
}

.page > div {
  padding-bottom: calc(var(--safe-bottom,34px) + 88px);
}

.overview, .page {
  overscroll-behavior: contain;
}

.tiles {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tile {
  min-width: 0;
}

.thumb {
  height: clamp(180px, 36cqh, 250px);
}

.close {
  display: grid;
  place-items: center;
}

.card, .reading {
  color: #505058;
}

.reading b {
  color: #1c1c1e;
}

.card b {
  color: #111;
  flex-shrink: 0;
}

@media (pointer: coarse) {
  .reload {
    width: 58px;
    min-width: 58px;
  }
  .toolbar .glass {
    height: 58px;
  }
  .address {
    min-width: 0;
  }
}

@container (max-width: 380px) {
  .favourites {
    column-gap: 8px;
  }
  .favourites i {
    width: 54px;
    height: 54px;
  }
  .favourites button {
    font-size: 12px;
  }
  .toolbar {
    left: 10px;
    right: 10px;
    gap: 6px;
  }
  .address {
    font-size: 14px;
  }
}
</style>
