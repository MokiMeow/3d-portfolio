<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
const tab = ref<string>('Keypad');
const digits = ref<string>('');
const search = ref<string>('');
const caller = ref<string | null>(null);
const connected = ref<boolean>(false);
const started = ref<number>(0);
const elapsed = ref<number>(0);
const muted = ref<boolean>(false);
const speaker = ref<boolean>(false);
const callKeypad = ref<boolean>(false);
const callDigits = ref<string>('');
const transcript = ref<string[]>([]);
const voicemail = ref<string | null>(null);
const contacts = [
    {
        name: 'Amma',
        detail: 'The original notification system',
        glyph: 'A',
        color: '#b297b5'
    },
    {
        name: 'Pizza',
        detail: 'Emergency cheese services',
        glyph: 'P',
        color: '#de9d66'
    },
    {
        name: 'Do Not Answer',
        detail: 'Probably an extended warranty',
        glyph: '!',
        color: '#9aa8b7'
    },
    {
        name: 'Landlord (rent)',
        detail: 'A monthly recurring conversation',
        glyph: 'L',
        color: '#83a5a0'
    },
    {
        name: 'Rubber Duck',
        detail: 'Technical support, no judgement',
        glyph: 'RD',
        color: '#c5ac64'
    },
    {
        name: 'Chai Hotline',
        detail: 'For critical low-chai incidents',
        glyph: 'CH',
        color: '#af9178'
    }
];
const recents = ref<Array<{
    name: string;
    missed: boolean;
    label: string;
}>>([
    {
        name: 'Do Not Answer',
        missed: true,
        label: 'Today'
    },
    {
        name: 'Amma',
        missed: false,
        label: 'Today'
    },
    {
        name: 'Pizza',
        missed: false,
        label: 'Yesterday'
    },
    {
        name: 'Landlord (rent)',
        missed: true,
        label: 'Yesterday'
    },
    {
        name: 'Chai Hotline',
        missed: false,
        label: 'Monday'
    }
]);
const filtered = computed(() => contacts.filter(c => c.name.toLowerCase().includes(search.value.toLowerCase())));
const keys = [
    ['1', ''],
    ['2', 'ABC'],
    ['3', 'DEF'],
    ['4', 'GHI'],
    ['5', 'JKL'],
    ['6', 'MNO'],
    ['7', 'PQRS'],
    ['8', 'TUV'],
    ['9', 'WXYZ'],
    ['*', ''],
    ['0', '+'],
    ['#', '']
];
const duration = computed(() => String(Math.floor(elapsed.value / 60)).padStart(2, '0') + ':' + String(elapsed.value % 60).padStart(2, '0'));
const captions = [
    'Your call is important to us. So is our lunch.',
    'Please hold while we locate a person who is not in a meeting.',
    'You are first in the queue. The queue is also on hold.',
    'For technical support, have you tried making chai?',
    'A quick change may take longer than your current call.',
    'Thank you for your patience. It has been added to the backlog.'
];
let connector: ReturnType<typeof setTimeout> | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
function press(key: string) {
    const target = caller.value ? callDigits : digits;
    if (target.value.length < 24)
        target.value += key;
}
function end() {
    if (connector)
        clearTimeout(connector);
    if (ticker)
        clearInterval(ticker);
    caller.value = null;
    connected.value = false;
    elapsed.value = 0;
    callKeypad.value = false;
    callDigits.value = '';
}
function call(name?: string) {
    const target = name || digits.value;
    if (!target)
        return;
    end();
    caller.value = target;
    muted.value = false;
    speaker.value = false;
    transcript.value = ['Connecting to the Department of Reasonable Expectations…'];
    recents.value.unshift({
        name: target,
        missed: false,
        label: 'Just now'
    });
    connector = setTimeout(() => {
        connected.value = true;
        started.value = Date.now();
        transcript.value = [captions[0]!];
        ticker = setInterval(() => {
            elapsed.value = Math.floor((Date.now() - started.value) / 1000);
            const index = Math.floor(elapsed.value / 7);
            transcript.value = captions.slice(0, Math.min(index + 1, captions.length));
        }, 500);
    }, 1800);
}
onBeforeUnmount(() => {
    if (connector)
        clearTimeout(connector);
    if (ticker)
        clearInterval(ticker);
});
</script>

<template>
  <div class="app">
    <template v-if="caller">
      <div class="call-screen">
        <div class="call-identity">
          <span class="call-avatar">{{ caller.slice(0,1) }}</span>
          <h1>{{ caller }}</h1>
          <p>{{ connected?duration:'calling…' }}</p>
        </div>
        <div v-if="!callKeypad" class="transcript scroll" aria-live="polite">
          <span>LIVE CAPTIONS · SIMULATED CALL</span>
          <p v-for="(line,i) in transcript" :key="line" :class="{current:i===transcript.length-1}">{{ line }}</p>
        </div>
        <div v-else class="call-dial">
          <p class="dial-output">{{ callDigits || 'Keypad' }}</p>
          <div class="key-grid compact">
            <button v-for="key in keys" :key="key[0]" :aria-label="'Dial '+key[0]" @click="press(key[0]!)">
              <b>{{ key[0] }}</b>
              <small>{{ key[1] }}</small>
            </button>
          </div>
        </div>
        <div class="call-controls">
          <button :class="{enabled:muted}" :aria-pressed="muted" @click="muted=!muted">
            <span>
              <svg viewBox="0 0 24 24">
                <path d="M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M2 2l20 20" />
              </svg>
            </span>
            mute
          </button>
          <button :class="{enabled:callKeypad}" :aria-pressed="callKeypad" @click="callKeypad=!callKeypad">
            <span>
              <svg viewBox="0 0 24 24">
                <path :d="icons.grid" />
              </svg>
            </span>
            keypad
          </button>
          <button :class="{enabled:speaker}" :aria-pressed="speaker" @click="speaker=!speaker">
            <span>
              <svg viewBox="0 0 24 24">
                <path d="m3 9 5 0 5-5v16l-5-5H3ZM17 8c3 2 3 6 0 8M20 5c5 4 5 10 0 14" />
              </svg>
            </span>
            speaker
          </button>
        </div>
        <button class="end-call" aria-label="End call" @click="end">
          <svg viewBox="0 0 24 24">
            <path :d="icons.call" />
          </svg>
        </button>
        <p class="simulation">A pretend call. No number is dialled.</p>
      </div>
    </template>
    <template v-else>
      <header v-if="tab!=='Keypad'" class="top">
        <div class="bar">
          <button class="pill edit" @click="search=search?'':'Amma'">{{ search?'Done':'Find' }}</button>
          <button class="icon edit" aria-label="Go to keypad" @click="tab='Keypad'">
            <svg viewBox="0 0 24 24">
              <path :d="icons.plus" />
            </svg>
          </button>
        </div>
        <h1>{{ tab }}</h1>
        <input
          v-if="tab==='Contacts'"
          v-model="search"
          class="search"
          aria-label="Search contacts"
          placeholder="Search"
         />
      </header>
      <main class="main scroll" :class="{keypad:tab==='Keypad'}">
        <template v-if="tab==='Keypad'">
          <div class="number">
            <p :style="{fontSize:digits.length>14?'26px':'38px'}">{{ digits }}</p>
            <span>{{ digits?'Ready when you are':' ' }}</span>
          </div>
          <div class="key-grid">
            <button v-for="key in keys" :key="key[0]" :aria-label="'Dial '+key[0]" @click="press(key[0]!)">
              <b>{{ key[0] }}</b>
              <small>{{ key[1] }}</small>
            </button>
          </div>
          <div class="dial-actions">
            <span />
            <button class="call-button" aria-label="Call entered number" :disabled="!digits" @click="call()">
              <svg viewBox="0 0 24 24">
                <path :d="icons.call" />
              </svg>
            </button>
            <button
              aria-label="Delete last digit"
              class="delete"
              :disabled="!digits"
              @click="digits=digits.slice(0,-1)"
            >
              <svg viewBox="0 0 24 24">
                <path d="m8 5-6 7 6 7h14V5ZM12 9l6 6M18 9l-6 6" />
              </svg>
            </button>
          </div>
          <p class="keypad-note">Local simulation · no real calls</p>
        </template>
        <template v-else-if="tab==='Recents'">
          <div class="segments">
            <button :class="{selected:!search}" @click="search=''">All</button>
            <button :class="{selected:search==='missed'}" @click="search='missed'">Missed</button>
          </div>
          <button
            v-for="(item,i) in recents.filter(r=>search!=='missed'||r.missed)"
            :key="i"
            class="recent row"
            @click="call(item.name)"
          >
            <svg viewBox="0 0 24 24">
              <path :d="icons.call" />
            </svg>
            <div>
              <h3 :class="{missed:item.missed}">{{ item.name }}</h3>
              <p>
                mobile ·
                {{ item.missed?'missed call':'incoming' }}
              </p>
            </div>
            <span>{{ item.label }}</span>
            <AppGlyph class="info-glyph" name="info" />
          </button>
        </template>
        <template v-else-if="tab==='Contacts'">
          <div class="my-card">
            <span class="avatar">M</span>
            <div>
              <h2>Mohith</h2>
              <p class="muted">My Card · local pocket lab</p>
            </div>
          </div>
          <div class="letter">A  ·  Z</div>
          <button v-for="contact in filtered" :key="contact.name" class="row" @click="call(contact.name)">
            <span class="avatar" :style="{background:contact.color}">{{ contact.glyph }}</span>
            <div>
              <h3>{{ contact.name }}</h3>
              <p>{{ contact.detail }}</p>
            </div>
            <svg viewBox="0 0 24 24">
              <path :d="icons.call" />
            </svg>
          </button>
          <p v-if="!filtered.length" class="empty">No contacts found.</p>
        </template>
        <template v-else-if="tab==='Favourites'">
          <button
            v-for="contact in contacts.filter(c=>['Amma','Pizza','Chai Hotline'].includes(c.name))"
            :key="contact.name"
            class="row"
            @click="call(contact.name)"
          >
            <span class="avatar" :style="{background:contact.color}">{{ contact.glyph }}</span>
            <div>
              <h3>{{ contact.name }}</h3>
              <p>☎ mobile</p>
            </div>
            <svg viewBox="0 0 24 24">
              <path :d="icons.call" />
            </svg>
          </button>
          <p class="empty">A small list of very important calls.</p>
        </template>
        <template v-else>
          <button
            v-for="name in ['Landlord (rent)','Do Not Answer','Pizza']"
            :key="name"
            class="voicemail row"
            @click="voicemail=voicemail===name?null:name"
          >
            <div>
              <h3>{{ name }}</h3>
              <p>
                Today · 0:
                {{ name==='Pizza'?'12':'42' }}
              </p>
              <p v-if="voicemail===name" class="voice-caption">
                {{ name==='Pizza'
              ?'Your pizza is at the gate. It has been there less time than the rider.'
              :name==='Do Not Answer'
              ?'Hello. We would like to discuss your imaginary extended warranty.'
              :'A gentle reminder about rent. This voicemail is also a gentle reminder.' }}
              </p>
            </div>
            <svg viewBox="0 0 24 24">
              <path :d="icons[voicemail===name?'pause':'play']" />
            </svg>
          </button>
          <p class="empty">Voicemails are written simulations.</p>
        </template>
      </main>
      <nav class="tabs">
        <button
          v-for="(item,i) in ['Favourites','Recents','Contacts','Keypad','Voicemail']"
          :key="item"
          :class="{active:tab===item}"
          @click="tab=item;search=''"
        >
          <svg viewBox="0 0 24 24">
            <path :d="icons[['heart','clock','people','grid','chat'][i]!]" />
          </svg>
          {{ item }}
        </button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  letter-spacing: -.02em;
  font-size: 17px;
  isolation: isolate;
}

.app * {
  box-sizing: border-box;
}

button, input, textarea {
  font: inherit;
  letter-spacing: inherit;
}

button {
  cursor: pointer;
  border: 0;
  background: none;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  touch-action: manipulation;
  transition: transform 250ms ease, opacity 250ms ease;
}

button:active {
  transform: scale(.96);
}

button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid #4d9fff;
  outline-offset: 2px;
}

button:disabled {
  opacity: .45;
  cursor: default;
}

input, textarea {
  font-size: 16px;
  min-height: 44px;
  color: inherit;
  border: 0;
  outline: none;
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -.035em;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

h3 {
  font-size: 17px;
  font-weight: 600;
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  min-height: 0;
}

.scroll::-webkit-scrollbar {
  display: none;
}

.glass {
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255,255,255,.35);
}

.top {
  padding: var(--safe-top,62px) 20px 12px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  padding: 10px;
}

.muted {
  color: #8e8e93;
  font-size: 13px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  gap: 2px;
  flex-shrink: 0;
  padding: 8px 10px var(--safe-bottom,34px);
  background: rgba(249,249,250,.85);
  backdrop-filter: blur(25px) saturate(180%);
  border-top: 1px solid rgba(0,0,0,.08);
}

.tabs button {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  min-height: 52px;
  border-radius: 22px;
  color: #8e8e93;
}

.tabs button.active {
  color: var(--accent,#007aff);
  background: rgba(127,127,127,.1);
}

.pill {
  border-radius: 24px;
  padding: 8px 16px;
}

.empty {
  padding: 44px 24px;
  text-align: center;
  color: #8e8e93;
  line-height: 1.5;
}

.search {
  width: 100%;
  background: rgba(127,127,127,.12);
  border-radius: 14px;
  padding: 10px 14px;
}

.section-label {
  font-size: 13px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: .03em;
  padding: 22px 16px 8px;
}

.hairline {
  border-bottom: 1px solid rgba(127,127,127,.18);
}

@media(prefers-reduced-motion:reduce) {
  .app *, .app *::before, .app *::after {
    animation: none!important;
    transition: none!important;
    scroll-behavior: auto!important;
  }
}

.app {
  background: #fff;
  color: #111;
  --accent: #007aff;
}

.top h1 {
  margin: 12px 0 18px;
}

.edit {
  color: #007aff;
}

.main {
  flex: 1;
}

.keypad {
  padding-top: var(--safe-top,62px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.number {
  width: 100%;
  padding: 0 22px;
  text-align: center;
  height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.number p {
  overflow-wrap: anywhere;
  font-weight: 400;
  min-height: 46px;
  letter-spacing: .02em;
}

.number span {
  color: #007aff;
  font-size: 15px;
  height: 24px;
  margin-top: 8px;
}

.key-grid {
  display: grid;
  grid-template-columns: repeat(3,86px);
  gap: 17px 28px;
  margin: 15px auto;
}

.key-grid button {
  border-radius: 50%;
  height: 86px;
  width: 86px;
  background: #e9e9eb;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.key-grid b {
  font-size: 37px;
  font-weight: 400;
  line-height: 1;
}

.key-grid small {
  font-size: 12px;
  letter-spacing: 2px;
  margin-top: 4px;
  min-height: 12px;
}

.dial-actions {
  display: grid;
  grid-template-columns: repeat(3,86px);
  gap: 28px;
  margin: 7px auto;
  align-items: center;
}

.call-button {
  border-radius: 50%;
  background: #34c759;
  color: #fff;
  width: 86px;
  height: 86px;
  display: grid;
  place-items: center;
}

.call-button svg {
  width: 35px;
  height: 35px;
  fill: currentColor;
  stroke-width: 1;
}

.delete {
  display: grid;
  place-items: center;
}

.keypad-note {
  font-size: 12px;
  color: #aaa;
  margin-top: 26px;
}

.row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  text-align: left;
  padding: 18px 22px;
  border-bottom: 1px solid #0000000d;
  min-height: 82px;
}

.row>div {
  flex: 1;
}

.row p {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 4px;
}

.row>svg {
  color: #007aff;
}

.avatar {
  width: 48px;
  height: 48px;
  background: #a3adb7;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 19px;
}

.my-card {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 22px;
}

.my-card .avatar {
  width: 64px;
  height: 64px;
  font-size: 27px;
}

.letter {
  padding: 7px 22px;
  background: #f2f2f7;
  color: #8e8e93;
  font-size: 12px;
}

.recent>svg {
  color: #999;
  width: 17px;
  height: 17px;
}

.recent>span {
  font-size: 12px;
  color: #888;
}

.missed {
  color: #ff3b30;
}

.info {
  border: 1px solid #007aff;
  color: #007aff;
  border-radius: 50%;
  width: 21px;
  height: 21px;
  text-align: center;
  font-size: 15px;
  font-weight: 400;
}

.segments {
  display: flex;
  border-radius: 25px;
  background: #eee;
  margin: 0 100px 14px;
  padding: 3px;
}

.segments button {
  flex: 1;
  min-height: 44px;
  border-radius: 22px;
  font-size: 14px;
}

.segments .selected {
  background: #fff;
  box-shadow: 0 1px 3px #0002;
}

.voice-caption {
  line-height: 1.6;
  background: #f5f5f7;
  padding: 14px;
  border-radius: 12px;
}

.call-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: radial-gradient(ellipse at 20% 10%,#738583,#344445 55%,#203434);
  color: #fff;
  padding: calc(var(--safe-top,62px) + 25px) 24px var(--safe-bottom,34px);
}

.call-identity {
  text-align: center;
}

.call-avatar {
  width: 82px;
  height: 82px;
  display: grid;
  place-items: center;
  background: #ffffff22;
  border: 1px solid #ffffff30;
  border-radius: 50%;
  font-size: 35px;
  margin: 0 auto 16px;
}

.call-identity h1 {
  font-weight: 500;
  font-size: 32px;
}

.call-identity>p {
  font-size: 19px;
  color: #ced8d8;
  margin-top: 10px;
  font-variant-numeric: tabular-nums;
}

.transcript {
  flex: 1;
  max-height: 270px;
  width: 100%;
  margin: 30px 0 20px;
  border-radius: 22px;
  padding: 20px;
  background: #00000013;
  border: 1px solid #ffffff14;
}

.transcript>span {
  font-size: 12px;
  letter-spacing: .12em;
  color: #aebcbb;
}

.transcript p {
  font-size: 16px;
  line-height: 1.5;
  color: #a4b2b0;
  margin-top: 15px;
}

.transcript .current {
  color: #fff;
}

.call-controls {
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 25px;
  margin-top: auto;
}

.call-controls button {
  font-size: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 90px;
}

.call-controls button>span {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  background: #ffffff20;
  border: 1px solid #ffffff25;
  border-radius: 50%;
  backdrop-filter: blur(25px);
}

.call-controls button.enabled>span {
  background: #fff;
  color: #344445;
}

.call-controls svg {
  width: 28px;
  height: 28px;
}

.end-call {
  background: #ff453a;
  width: 78px;
  height: 78px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  margin: 25px auto 16px;
}

.end-call svg {
  transform: rotate(135deg);
  fill: #fff;
  stroke-width: 1;
  width: 34px;
  height: 34px;
}

.simulation {
  font-size: 12px;
  color: #acbcba;
  margin-bottom: 12px;
}

.call-dial {
  margin-top: 10px;
}

.compact {
  grid-template-columns: repeat(3,56px);
  gap: 8px 22px;
}

.compact button {
  width: 56px;
  height: 56px;
  background: #ffffff22;
}

.compact b {
  font-size: 26px;
}

.compact small {
  font-size: 12px;
}

.dial-output {
  text-align: center;
  font-size: 20px;
  height: 25px;
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

.top, .tabs {
  flex-shrink: 0;
}

.keypad {
  --key-size: clamp(58px, 10cqh, 86px);
  justify-content: flex-start;
}

.number {
  height: clamp(64px, 12.5cqh, 120px);
  flex-shrink: 0;
  margin-top: auto;
}

.key-grid {
  grid-template-columns: repeat(3, var(--key-size));
  gap: 12px 24px;
  flex-shrink: 0;
}

.key-grid button, .call-button {
  width: var(--key-size);
  height: var(--key-size);
}

.dial-actions {
  grid-template-columns: repeat(3, var(--key-size));
  gap: 24px;
  flex-shrink: 0;
}

.keypad-note {
  margin: 12px 0 20px;
  color: #64646b;
}

.row > div {
  min-width: 0;
}

.row h3 {
  overflow-wrap: anywhere;
}

.avatar {
  flex-shrink: 0;
}

.info-glyph {
  color: #007aff;
  width: 24px;
  height: 24px;
}

.segments {
  width: min(260px, calc(100% - 32px));
  margin-inline: auto;
}

.call-screen {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.call-identity, .call-controls, .end-call, .simulation, .call-dial {
  flex-shrink: 0;
}

.call-identity h1 {
  overflow-wrap: anywhere;
}

.call-controls {
  gap: 8px;
}

.call-controls button {
  flex: 1;
  min-width: 0;
}

.compact {
  --key-size: 58px;
  gap: 8px 20px;
}

.transcript > span, .simulation {
  color: #d8e4e1;
}

@container (max-height: 700px) {
  .key-grid {
    margin-block: 8px;
    gap-block: 10px;
  }
  .key-grid b {
    font-size: 31px;
  }
  .call-screen {
    padding-top: calc(var(--safe-top,62px) + 10px);
  }
  .call-avatar {
    width: 58px;
    height: 58px;
    margin-bottom: 10px;
    font-size: 28px;
  }
  .call-identity h1 {
    font-size: 26px;
  }
  .transcript {
    margin-block: 18px;
  }
  .call-controls button > span {
    width: 58px;
    height: 58px;
  }
  .end-call {
    margin-block: 16px 12px;
    width: 64px;
    height: 64px;
  }
}

.call-screen {
  background: linear-gradient(180deg, #a2b8b4 0, #57716f 24%, #253b3a 100%);
}
.call-avatar { background: #203f3d44; }

</style>
