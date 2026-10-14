<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
type Song = {
    title: string;
    artist: string;
    album: string;
    duration: number;
    art: string;
    lyrics: string[];
};
const songs: Song[] = [
    {
        title: 'Merge Conflict (Acoustic)',
        artist: 'The Night Build',
        album: 'Uncommitted',
        duration: 212,
        art: 'linear-gradient(145deg,#76483f,#d6a489 50%,#403d57)',
        lyrics: [
            'Two branches in the evening light',
            'Both of us were certain we were right',
            'A little red, a little green',
            'The quietest conflict ever seen',
            'Keep your changes, keep mine too',
            'We will build something new'
        ]
    },
    {
        title: 'Traffic at Silk Board',
        artist: 'The Slow Lane',
        album: 'Eventually',
        duration: 245,
        art: 'linear-gradient(140deg,#304f62,#d58b70 65%,#f7c2a0)',
        lyrics: [
            'The signal has a plan for me',
            'It is not where I hoped to be',
            'One more song before we move',
            'Time has found a slower groove',
            'Every lane a little dream',
            'We are all a loading screen'
        ]
    },
    {
        title: 'It Works on My Machine',
        artist: 'Localhost Ensemble',
        album: 'Environment',
        duration: 186,
        art: 'linear-gradient(130deg,#335e63,#7cb69c,#23384f)',
        lyrics: [
            'Here the tests are always green',
            'In this tiny perfect scene',
            'Take my laptop, take my chair',
            'Maybe it will work out there',
            'Nothing changed, or so it seems',
            'It works on my machine'
        ]
    },
    {
        title: 'One More Quick Change',
        artist: 'The Night Build',
        album: 'Scope',
        duration: 198,
        art: 'linear-gradient(155deg,#473353,#aa7193,#d9a8a0)',
        lyrics: [
            'Just one button, just one line',
            'We will finish before nine',
            'A little feature on the side',
            'Now the side is twice as wide',
            'Close the tab and dim the light',
            'Quick is taking all the night'
        ]
    },
    {
        title: 'Chai in D Major',
        artist: 'Kettle Quartet',
        album: 'Steep',
        duration: 176,
        art: 'linear-gradient(145deg,#634e2e,#d1a36e,#f4d6ae)',
        lyrics: [
            'Let the kettle lead the way',
            'Let the deadline drift away',
            'Steam above a quiet cup',
            'We do not need to hurry up',
            'Warm hands, slower afternoon',
            'Everything can wait a tune'
        ]
    },
    {
        title: '404: Sleep Not Found',
        artist: 'Midnight Console',
        album: 'After Hours',
        duration: 234,
        art: 'linear-gradient(135deg,#182740,#45587d,#9b90b0)',
        lyrics: [
            'The city has turned out its lights',
            'The cursor counts the quiet nights',
            'One last line and then I go',
            'Promises the soft blue glow',
            'Save the work and close the door',
            'Sleep is worth returning for'
        ]
    }
];
const tab = ref<string>('Listen Now');
const currentIndex = ref<number>(0);
const current = computed(() => songs[currentIndex.value]!);
const playing = ref<boolean>(false);
const position = ref<number>(0);
const shuffle = ref<boolean>(false);
const repeat = ref<'off' | 'all' | 'one'>('off');
const volume = ref<number>(65);
const sheet = ref<boolean>(false);
const lyrics = ref<boolean>(false);
const query = ref<string>('');
const libraryMode = ref<string>('Songs');
const results = computed(() => songs.filter(s => (s.title + ' ' + s.artist).toLowerCase().includes(query.value.toLowerCase())));
const lyricIndex = computed(() => Math.min(current.value.lyrics.length - 1, Math.floor(position.value / current.value.duration * current.value.lyrics.length)));
function clock(seconds: number) {
    return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
}
function select(index: number) {
    currentIndex.value = index;
    position.value = 0;
    playing.value = true;
    sheet.value = true;
}
function step(direction: number) {
    if (direction < 0 && position.value > 3) {
        position.value = 0;
        return;
    }
    const next = shuffle.value 
        ? (currentIndex.value + 1 + Math.floor(Math.random() * (songs.length - 1))) % songs.length 
        : (currentIndex.value + direction + songs.length) % songs.length;
    currentIndex.value = next;
    position.value = 0;
}
function cycleRepeat() {
    repeat.value = repeat.value === 'off' ? 'all' : repeat.value === 'all' ? 'one' : 'off';
}
let timer: ReturnType<typeof setInterval> | undefined;
let lastTick = 0;
onMounted(() => {
    lastTick = Date.now();
    timer = setInterval(() => {
        const now = Date.now();
        const delta = (now - lastTick) / 1000;
        lastTick = now;
        if (!playing.value)
            return;
        position.value = Math.min(current.value.duration, position.value + delta);
        if (position.value >= current.value.duration) {
            if (repeat.value === 'one')
                position.value = 0;
            else if (currentIndex.value < songs.length - 1 || repeat.value === 'all' || shuffle.value)
                step(1);
            else {
                playing.value = false;
                position.value = 0;
            }
        }
    }, 500);
});
onBeforeUnmount(() => {
    if (timer)
        clearInterval(timer);
});
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="bar">
        <h1>{{ tab }}</h1>
        <span class="profile">M</span>
      </div>
      <input
        v-if="tab==='Search'"
        v-model="query"
        class="search"
        aria-label="Search fictional songs"
        placeholder="Songs, artists and albums"
       />
    </header>
    <main class="scroll content">
      <template v-if="tab==='Listen Now'">
        <div class="feature-label">MADE FOR YOUR NEXT CHAI BREAK</div>
        <button class="hero" @click="select(0)">
          <div v-for="song in [songs[0]!]" :key="song.title">
            <div class="artwork" :style="{background:song.art}">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="59" />
                <circle cx="100" cy="100" r="40" />
                <circle cx="100" cy="100" r="20" />
                <path d="M25 138 67 84l24 30 31-65 54 89" />
                <path d="M24 164h152" />
              </svg>
              <span>{{ song.album }}</span>
              <small>POCKET LAB RECORDS</small>
            </div>
          </div>
          <div class="hero-copy">
            <span>POCKET LAB MIX</span>
            <h2>
              A little less
              <br />
              background noise.
            </h2>
            <p>Code, pause, repeat.</p>
            <svg viewBox="0 0 24 24">
              <path :d="icons.play" />
            </svg>
          </div>
        </button>
        <div class="bar shelf-heading">
          <h2>Recently imagined</h2>
          <button aria-label="See all songs" @click="tab='Library'">See All</button>
        </div>
        <div class="shelf scroll">
          <button v-for="(song,i) in songs.slice(0,3)" :key="song.title" class="album" @click="select(i)">
            <div class="artwork" :style="{background:song.art}">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="59" />
                <circle cx="100" cy="100" r="40" />
                <circle cx="100" cy="100" r="20" />
                <path d="M25 138 67 84l24 30 31-65 54 89" />
                <path d="M24 164h152" />
              </svg>
              <span>{{ song.album }}</span>
              <small>POCKET LAB RECORDS</small>
            </div>
            <h3>{{ song.title }}</h3>
            <p>{{ song.artist }}</p>
          </button>
        </div>
        <div class="bar shelf-heading">
          <h2>For the late build</h2>
          <button aria-label="See more songs" @click="tab='Library'">See All</button>
        </div>
        <div class="shelf scroll">
          <button v-for="(song,i) in songs.slice(3)" :key="song.title" class="album" @click="select(i+3)">
            <div class="artwork" :style="{background:song.art}">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="59" />
                <circle cx="100" cy="100" r="40" />
                <circle cx="100" cy="100" r="20" />
                <path d="M25 138 67 84l24 30 31-65 54 89" />
                <path d="M24 164h152" />
              </svg>
              <span>{{ song.album }}</span>
              <small>POCKET LAB RECORDS</small>
            </div>
            <h3>{{ song.title }}</h3>
            <p>{{ song.artist }}</p>
          </button>
        </div>
      </template>
      <template v-else-if="tab==='Library'">
        <button
          v-for="mode in ['Playlists','Artists','Albums','Songs']"
          :key="mode"
          class="library-link"
          @click="libraryMode=mode"
        >
          <svg viewBox="0 0 24 24">
            <path :d="icons.music" />
          </svg>
          {{ mode }}
          <span>›</span>
        </button>
        <div class="bar shelf-heading">
          <h2>{{ libraryMode }}</h2>
          <button @click="playing=true;shuffle=true;step(1);sheet=true">Shuffle</button>
        </div>
        <div v-if="libraryMode==='Albums' || libraryMode==='Artists'" class="album-grid">
          <button v-for="(song,i) in songs" :key="song.title" class="album" @click="select(i)">
            <div class="artwork" :style="{background:song.art}">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="59" />
                <circle cx="100" cy="100" r="40" />
                <circle cx="100" cy="100" r="20" />
                <path d="M25 138 67 84l24 30 31-65 54 89" />
                <path d="M24 164h152" />
              </svg>
              <span>{{ song.album }}</span>
              <small>POCKET LAB RECORDS</small>
            </div>
            <h3>{{ libraryMode==='Artists'?song.artist:song.album }}</h3>
            <p>{{ song.title }}</p>
          </button>
        </div>
        <template v-else>
          <button v-for="(song,i) in songs" :key="song.title" class="song-row" @click="select(i)">
            <div class="artwork" :style="{background:song.art}">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="59" />
                <circle cx="100" cy="100" r="40" />
                <circle cx="100" cy="100" r="20" />
                <path d="M25 138 67 84l24 30 31-65 54 89" />
                <path d="M24 164h152" />
              </svg>
              <span>{{ song.album }}</span>
              <small>POCKET LAB RECORDS</small>
            </div>
            <div>
              <h3>{{ song.title }}</h3>
              <p>{{ song.artist }}</p>
            </div>
            <span>{{ clock(song.duration) }}</span>
          </button>
        </template>
      </template>
      <template v-else>
        <h2 class="shelf-heading">{{ query?'Results':'Search the pocket catalogue' }}</h2>
        <button
          v-for="song in results"
          :key="song.title"
          class="song-row"
          @click="select(songs.indexOf(song))"
        >
          <div class="artwork" :style="{background:song.art}">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="59" />
              <circle cx="100" cy="100" r="40" />
              <circle cx="100" cy="100" r="20" />
              <path d="M25 138 67 84l24 30 31-65 54 89" />
              <path d="M24 164h152" />
            </svg>
            <span>{{ song.album }}</span>
            <small>POCKET LAB RECORDS</small>
          </div>
          <div>
            <h3>{{ song.title }}</h3>
            <p>{{ song.artist }}</p>
          </div>
          <svg viewBox="0 0 24 24">
            <path :d="icons.play" />
          </svg>
        </button>
        <p v-if="!results.length" class="empty">That song has not been imagined yet.</p>
      </template>
      <p class="simulation">Fictional songs · visual playback only</p>
    </main>
    <div class="mini glass">
      <button class="mini-song" aria-label="Open now playing" @click="sheet=true">
        <div v-for="song in [current]" :key="song.title">
          <div class="artwork" :style="{background:song.art}">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="59" />
              <circle cx="100" cy="100" r="40" />
              <circle cx="100" cy="100" r="20" />
              <path d="M25 138 67 84l24 30 31-65 54 89" />
              <path d="M24 164h152" />
            </svg>
            <span>{{ song.album }}</span>
            <small>POCKET LAB RECORDS</small>
          </div>
        </div>
        <div>
          <h3>{{ current.title }}</h3>
          <p>{{ current.artist }}</p>
        </div>
      </button>
      <button class="icon" :aria-label="playing?'Pause':'Play'" @click="playing=!playing">
        <svg viewBox="0 0 24 24">
          <path :d="icons[playing?'pause':'play']" />
        </svg>
      </button>
      <button class="icon" aria-label="Next song" @click="step(1)">
        <svg viewBox="0 0 24 24">
          <path :d="icons.next" />
        </svg>
      </button>
    </div>
    <nav class="tabs">
      <button
        v-for="(item,i) in ['Listen Now','Library','Search']"
        :key="item"
        :class="{active:tab===item}"
        @click="tab=item"
      >
        <svg viewBox="0 0 24 24">
          <path :d="icons[['play','music','search'][i]!]" />
        </svg>
        {{ item }}
      </button>
    </nav>
    <div v-if="sheet" class="now-playing" :style="{background:current.art}">
      <div class="sheet-shade" />
      <header class="sheet-top">
        <button class="icon glass" aria-label="Close now playing" @click="sheet=false">
          <svg viewBox="0 0 24 24">
            <path d="m5 9 7 7 7-7" />
          </svg>
        </button>
        <div>
          <span>PLAYING FROM POCKET LAB</span>
          <p>{{ current.album }}</p>
        </div>
        <button class="icon glass" aria-label="Toggle lyrics" :aria-pressed="lyrics" @click="lyrics=!lyrics">
          <svg viewBox="0 0 24 24">
            <path :d="icons.chat" />
          </svg>
        </button>
      </header>
      <div v-if="!lyrics" class="large-art">
        <div v-for="song in [current]" :key="song.title">
          <div class="artwork" :style="{background:song.art}">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle cx="100" cy="100" r="59" />
              <circle cx="100" cy="100" r="40" />
              <circle cx="100" cy="100" r="20" />
              <path d="M25 138 67 84l24 30 31-65 54 89" />
              <path d="M24 164h152" />
            </svg>
            <span>{{ song.album }}</span>
            <small>POCKET LAB RECORDS</small>
          </div>
        </div>
      </div>
      <div v-else class="lyrics scroll" aria-live="off">
        <p v-for="(line,i) in current.lyrics" :key="line" :class="{highlighted:i===lyricIndex}">{{ line }}</p>
      </div>
      <div class="playback">
        <div class="bar song-title">
          <div>
            <h2>{{ current.title }}</h2>
            <p>{{ current.artist }}</p>
          </div>
          <button
            class="icon"
            :aria-label="'Repeat: '+repeat"
            :aria-pressed="repeat!=='off'"
            :class="{toggled:repeat!=='off'}"
            @click="cycleRepeat"
          >
            <svg viewBox="0 0 24 24">
              <path :d="icons.repeat" />
            </svg>
            <small v-if="repeat==='one'">1</small>
          </button>
        </div>
        <input
          v-model.number="position"
          type="range"
          min="0"
          :max="current.duration"
          step="1"
          class="scrubber"
          aria-label="Playback position"
         />
        <div class="times">
          <span>{{ clock(position) }}</span>
          <span>
            −
            {{ clock(current.duration-position) }}
          </span>
        </div>
        <div class="transport">
          <button
            class="icon"
            :aria-pressed="shuffle"
            aria-label="Shuffle"
            :class="{toggled:shuffle}"
            @click="shuffle=!shuffle"
          >
            <svg viewBox="0 0 24 24">
              <path :d="icons.shuffle" />
            </svg>
          </button>
          <button aria-label="Previous song" @click="step(-1)">
            <svg viewBox="0 0 24 24">
              <path :d="icons.prev" />
            </svg>
          </button>
          <button class="big-play" :aria-label="playing?'Pause':'Play'" @click="playing=!playing">
            <svg viewBox="0 0 24 24">
              <path :d="icons[playing?'pause':'play']" />
            </svg>
          </button>
          <button aria-label="Next song" @click="step(1)">
            <svg viewBox="0 0 24 24">
              <path :d="icons.next" />
            </svg>
          </button>
          <button
            class="icon"
            aria-label="Show lyrics"
            :aria-pressed="lyrics"
            :class="{toggled:lyrics}"
            @click="lyrics=!lyrics"
          >
            <svg viewBox="0 0 24 24">
              <path :d="icons.chat" />
            </svg>
          </button>
        </div>
        <label class="volume">
          <AppGlyph name="volumeLow" />
          <input v-model.number="volume" type="range" min="0" max="100" aria-label="Simulated volume" />
          <AppGlyph name="volume" />
        </label>
        <p class="simulation">Visual simulation · no audio playback</p>
      </div>
    </div>
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
  background: #101011;
  color: #f8f8fa;
  --accent: #fa586a;
}

.top {
  padding-top: calc(var(--safe-top,62px) + 20px);
}

.profile {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #3c3c40;
  color: #fa586a;
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 8px 20px 20px;
}

.feature-label {
  font-size: 12px;
  letter-spacing: .12em;
  color: #fa586a;
  padding: 10px 0;
}

.hero {
  position: relative;
  overflow: hidden;
  height: 260px;
  width: 100%;
  border-radius: 22px;
  text-align: left;
  padding: 0;
  box-shadow: 0 8px 26px #0004;
}

.hero>div:first-child {
  position: absolute;
  inset: 0;
  opacity: .6;
}

.hero .artwork {
  height: 100%;
  border-radius: 0;
}

.hero .artwork>span, .hero .artwork>small {
  display: none;
}

.hero-copy {
  position: absolute;
  inset: 0;
  padding: 26px;
  background: linear-gradient(90deg,#0007,transparent);
}

.hero-copy>span {
  font-size: 12px;
  letter-spacing: .12em;
}

.hero-copy h2 {
  font-size: 30px;
  margin: 45px 0 10px;
  font-weight: 700;
  line-height: 1.1;
}

.hero-copy p {
  font-size: 15px;
  color: #ffffffb0;
}

.hero-copy svg {
  position: absolute;
  right: 22px;
  bottom: 22px;
  fill: #fff;
}

.shelf-heading {
  margin: 24px 0 8px;
}

.shelf-heading button {
  color: #fa586a;
  font-size: 14px;
  padding-right: 0;
}

.shelf {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  margin-right: -20px;
  padding: 4px 20px 14px 0;
}

.album {
  min-width: 166px;
  width: 166px;
  padding: 0;
  text-align: left;
  flex-shrink: 0;
}

.artwork {
  position: relative;
  height: 166px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px #ffffff20;
}

.artwork svg {
  width: 100%;
  height: 100%;
  stroke: #ffffff60;
  stroke-width: 1;
  fill: none;
  padding: 10px;
}

.artwork>span {
  position: absolute;
  top: 15px;
  left: 15px;
  font-size: 17px;
  letter-spacing: -.04em;
  font-weight: 700;
  color: #fff;
  max-width: 85%;
}

.artwork>small {
  position: absolute;
  bottom: 12px;
  left: 15px;
  font-size: 12px;
  letter-spacing: .12em;
  color: #fff9;
}

.album h3 {
  font-size: 14px;
  margin-top: 10px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.album p {
  font-size: 12px;
  color: #8d8d92;
  margin-top: 4px;
}

.mini {
  display: flex;
  align-items: center;
  margin: 0 10px 8px;
  border-radius: 21px;
  background: #28282cdd;
  padding: 5px 6px;
  border-color: #ffffff20;
  flex-shrink: 0;
}

.mini-song {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  text-align: left;
  padding: 4px;
}

.mini .artwork {
  width: 46px;
  height: 46px;
  border-radius: 8px;
}

.mini .artwork>span, .mini .artwork>small {
  display: none;
}

.mini-song>div:last-child {
  min-width: 0;
}

.mini h3 {
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.mini p {
  font-size: 12px;
  color: #aaa;
  margin-top: 4px;
}

.mini svg {
  fill: currentColor;
  stroke-width: 1;
}

.tabs {
  background: #1c1c1ecc;
  border-top-color: #ffffff10;
}

.simulation {
  font-size: 12px;
  color: #ffffff60;
  text-align: center;
  margin: 25px 0 10px;
}

.library-link {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 2px;
  border-bottom: 1px solid #ffffff18;
  color: #fa586a;
  font-size: 22px;
}

.library-link>span {
  margin-left: auto;
  color: #666;
}

.song-row {
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  width: 100%;
  padding: 12px 0;
  border-bottom: 1px solid #ffffff14;
}

.song-row .artwork {
  width: 54px;
  height: 54px;
  border-radius: 7px;
  flex-shrink: 0;
}

.song-row .artwork>span, .song-row .artwork>small {
  display: none;
}

.song-row>div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.song-row h3 {
  font-size: 15px;
}

.song-row p {
  font-size: 12px;
  color: #999;
  margin-top: 5px;
}

.song-row>span {
  font-size: 12px;
  color: #777;
}

.album-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px 16px;
}

.album-grid .album {
  width: 100%;
  min-width: 0;
}

.album-grid .artwork {
  height: 180px;
}

.top .search {
  margin-top: 22px;
}

.now-playing {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  z-index: 5;
  color: #fff;
  padding: var(--safe-top,62px) 28px var(--safe-bottom,34px);
  overflow: hidden;
}

.sheet-shade {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(#0004,#080808bb);
  backdrop-filter: blur(30px);
}

.sheet-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0 10px;
}

.sheet-top>div {
  flex: 1;
  text-align: center;
}

.sheet-top span {
  font-size: 12px;
  letter-spacing: .1em;
  color: #ffffff8a;
}

.sheet-top p {
  font-size: 13px;
  margin-top: 5px;
}

.sheet-top .glass {
  background: #ffffff0b;
  border-color: #ffffff20;
}

.large-art {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 22px 0;
}

.large-art>div {
  width: 100%;
}

.large-art .artwork {
  height: 350px;
  border-radius: 18px;
  box-shadow: 0 20px 40px #0004;
}

.large-art .artwork>span {
  font-size: 34px;
  top: 25px;
  left: 25px;
}

.large-art .artwork>small {
  font-size: 12px;
  left: 25px;
  bottom: 20px;
}

.lyrics {
  flex: 1;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 17px;
}

.lyrics p {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff38;
  transition: transform 250ms ease, opacity 250ms ease;
}

.lyrics .highlighted {
  color: #fff;
}

.song-title h2 {
  font-size: 22px;
  max-width: 310px;
}

.song-title p {
  color: #ffffff90;
  font-size: 16px;
  margin-top: 7px;
}

.song-title .icon {
  position: relative;
}

.song-title small {
  position: absolute;
  right: 2px;
  top: 0;
  font-size: 12px;
}

.scrubber {
  width: 100%;
  accent-color: #fff;
  height: 44px;
  margin-top: 16px;
  background: transparent;
  cursor: pointer;
}

.times {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #ffffff70;
  font-variant-numeric: tabular-nums;
}

.transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 20px 0;
}

.transport>button svg {
  width: 31px;
  height: 31px;
  fill: #fff;
  stroke-width: 1;
}

.transport .icon svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke-width: 1.8;
}

.transport .big-play svg {
  width: 49px;
  height: 49px;
}

.toggled {
  color: #ff8ea1;
  background: #ffffff20;
  border-radius: 12px;
}

.volume {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #ffffff70;
}

.volume input {
  flex: 1;
  width: 0;
  accent-color: #ffffffb0;
  background: transparent;
}

.playback .simulation {
  margin: 16px 0;
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

.top, .mini, .tabs, .sheet-top, .playback {
  flex-shrink: 0;
}

.hero > div:first-child {
  height: 100%;
}

.hero > div:first-child .artwork > span, .hero > div:first-child .artwork > small {
  display: none;
}

.artwork > small {
  max-width: 85%;
  line-height: 1.3;
}

.mini .artwork > span, .mini .artwork > small, .mini .artwork > svg {
  display: none;
}

.mini-song > div:first-child {
  flex-shrink: 0;
}

.album h3 {
  white-space: normal;
  line-height: 1.35;
  min-height: 38px;
}

.artwork > span {
  overflow-wrap: anywhere;
}

.now-playing {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.sheet-top {
  gap: 8px;
}

.sheet-top > div {
  min-width: 0;
}

.large-art {
  min-height: 150px;
}

.large-art > div {
  height: min(100%, 350px);
  width: auto;
  max-width: 100%;
  aspect-ratio: 1;
}

.large-art .artwork {
  height: 100%;
  width: 100%;
}

.large-art .artwork > span {
  font-size: clamp(22px, 7cqw, 34px);
}

.song-title > div {
  min-width: 0;
}

.song-title h2 {
  overflow-wrap: anywhere;
}

.transport {
  gap: 0;
}

.transport > button {
  padding-inline: 4px;
}

.volume {
  color: #e8e8ef;
}

.times, .simulation, .mini p {
  color: #d0d0d6;
}

.lyrics p {
  color: #dddded;
}

.lyrics p.highlighted {
  color: #fff;
}

@container (max-height: 700px) {
  .now-playing {
    padding-inline: 20px;
  }
  .large-art {
    min-height: 130px;
    padding-block: 12px;
  }
  .transport {
    margin-block: 8px;
  }
  .song-title h2 {
    font-size: 19px;
  }
  .simulation {
    margin-block: 10px;
  }
  .sheet-top span {
    font-size: 12px;
  }
}

.now-playing {
  animation: pocket-reveal 250ms ease both;
}

@keyframes pocket-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .now-playing {
    animation: none;
  }
}
</style>
