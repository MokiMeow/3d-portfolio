<script setup lang="ts">
import { loadYouTube, type YouTubePlayer } from "~/utils/music-providers";
import { HomeExperience } from "~/experiences/home";
import { VISION, VISION_ENVIRONMENTS, type VisionEnvironmentId } from '../vision';
import { vHover } from '../kit/hover';
import YtIcon from '../youtube/YtIcon.vue';
import Poster from './tv/Poster.vue';

defineProps<{ compact?: boolean }>();

// Whatever the visitor picks, the cinema plays one very familiar song.
const vision = inject(VISION, undefined);
const screen = ref<HTMLElement>();
const watching = ref<string | null>(null);
const started = ref(false),
  playing = ref(false),
  ready = ref(false),
  muted = ref(false),
  failed = ref(false);
const videoId = "dQw4w9WgXcQ";
const message = ref("Dimming the room...");
let player: YouTubePlayer | undefined,
  disposed = false,
  attempt = 0;
let readyTimer: ReturnType<typeof setTimeout> | undefined;
const dim = (amount: number) => {
  if (vision) vision.dim.value = amount;
};
const pause = () => {
  try { player?.pauseVideo?.(); } catch { /* An unavailable embed is already paused. */ }
  playing.value = false;
};
const release = () => {
  ++attempt;
  clearTimeout(readyTimer);
  try { player?.destroy(); } catch { /* The iframe may already be gone. */ }
  player = undefined;
  ready.value = false;
  playing.value = false;
};
const silenceRoom = () => {
  try { new HomeExperience().sound?.pauseMusic(); } catch { /* Room audio is optional. */ }
};
const play = () => {
  if (!ready.value || !player) return;
  silenceRoom();
  try { player.playVideo(); } catch { message.value = 'Press play again when the player is ready.'; }
};
const toggleSound = () => {
  muted.value = !muted.value;
  if (!ready.value) return;
  try { if (muted.value) player?.mute(); else player?.unMute(); }
  catch { message.value = 'Sound is unavailable while the player reconnects.'; }
};
async function start() {
  if (failed.value) {
    release();
    started.value = false;
    failed.value = false;
  }
  if (started.value) {
    play();
    return;
  }
  const current = ++attempt;
  started.value = true;
  message.value = "Finding your film...";
  silenceRoom();
  readyTimer = setTimeout(() => {
    if (!ready.value) {
      release();
      failed.value = true;
      message.value = "YouTube is taking a moment. Retry, or open the original below.";
    }
  }, 18000);
  try {
    const api = await loadYouTube();
    if (disposed || current !== attempt || !screen.value) return;
    const element = document.createElement("div");
    screen.value.replaceChildren(element);
    player = new api.Player(element, {
      width: "100%",
      height: "100%",
      videoId,
      host: "https://www.youtube-nocookie.com",
      playerVars: { playsinline: 1, controls: 0, fs: 0, disablekb: 1, rel: 0, origin: window.location.origin },
      events: {
        onReady: () => {
          if (disposed || current !== attempt) return;
          if (muted.value) player?.mute();
          ready.value = true;
          clearTimeout(readyTimer);
          message.value = "Press play. Stay in your seat.";
          play();
        },
        onStateChange: (event: { data: number }) => {
          if (disposed || current !== attempt || !ready.value) return;
          playing.value = event.data === 1;
          if (event.data === 1) message.value = "Now showing. Please enjoy the feature presentation.";
          else if ([0, 2, 3].includes(event.data))
            message.value = event.data === 3 ? "Buffering..." : event.data === 0 ? "You knew what you were signing up for." : "Paused. Take your time.";
        },
        onAutoplayBlocked: () => {
          if (disposed || current !== attempt) return;
          message.value = "Press play below to start the film.";
        },
        onError: (event: { data: number }) => {
          if (disposed || current !== attempt) return;
          release();
          failed.value = true;
          message.value = [101, 150].includes(event.data)
            ? "This video does not allow embedded playback here. Open the original on YouTube."
            : "YouTube cannot play this here. Retry or open the original below.";
        },
      },
    });
  } catch {
    if (disposed || current !== attempt) return;
    release();
    failed.value = true;
    message.value = "The cinema could not reach YouTube. Retry or open the original below.";
  }
}
const screenFilm = (title: string) => {
  if (!watching.value) previousDim = vision?.dim.value ?? 0;
  watching.value = title;
  position.value = 0;
  dim(0.8);
  void nextTick(start);
};
const leave = () => {
  release();
  started.value = false;
  failed.value = false;
  watching.value = null;
  dim(previousDim);
};
const onVisibility = () => {
  if (document.hidden) pause();
};
function dismiss(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || (!watching.value && !detail.value)) return;
  event.preventDefault();
  event.stopPropagation();
  if (watching.value) leave();
  else detail.value = null;
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  updateMotion();
  motion.addEventListener('change', updateMotion);
  heroTimer = setInterval(() => {
    if (!reduced.value && !document.hidden && !watching.value && !detail.value && !heroPaused.value && !heroHeld.value) {
      heroIndex.value = (heroIndex.value + 1) % 3;
    }
  }, 7000);
  clockTimer = setInterval(() => {
    if (!ready.value || !player) return;
    try { position.value = Math.min(duration, player.getCurrentTime()); } catch { /* Wait for the embed. */ }
  }, 500);
});
onBeforeUnmount(() => {
  disposed = true;
  release();
  if (watching.value) dim(previousDim);
  clearInterval(heroTimer);
  clearInterval(clockTimer);
  motion?.removeEventListener('change', updateMotion);
  document.removeEventListener("visibilitychange", onVisibility);
});

type Show = { id: string; title: string; meta: string; art: string; accent: string; genre: string; synopsis: string };
type Tab = 'Home' | 'Apple TV+' | 'Store' | 'Library' | 'Search';
const tabs: { name: Tab; path: string }[] = [
  { name: 'Home', path: 'm3 11 9-8 9 8M6 10v11h12V10M10 21v-7h4v7' },
  { name: 'Apple TV+', path: 'M4 6h13v12H4zM8 21h5m7-12h4m-2-2v4' },
  { name: 'Store', path: 'M5 8h14l2 12H3zM8 8V6a4 4 0 0 1 8 0v2' },
  { name: 'Library', path: 'M4 4h4v16H4zM11 4h4v16h-4zM18 5l3 14' },
  { name: 'Search', path: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0' },
];
const shows: Show[] = [
  { id: 'keynote', title: 'One More Thing', meta: '2026 · Comedy · 3 min', art: 'keynote', accent: '#78c5ed', genre: 'Comedy',
    synopsis: 'A very important presentation. Critics call it “familiar”. A lone presenter attempts to announce something that has definitely never been announced before.' },
  { id: 'traffic', title: 'Silk Board: The Documentary', meta: '9 h 40 min · Still loading', art: 'traffic', accent: '#ffb75e', genre: 'Documentary',
    synopsis: 'Five lanes. Seven opinions. Nobody moves. A patient portrait of a junction that has become a destination in its own right.' },
  { id: 'meeting', title: 'The Stand-up That Never Ended', meta: 'Season 4 · Horror', art: 'meeting', accent: '#bba1ee', genre: 'Horror',
    synopsis: 'It began with “one quick update”. Four seasons later, the team is still standing. Somewhere, a calendar invitation is laughing.' },
  { id: 'planet', title: 'Planet Localhost', meta: 'Nature · It works here', art: 'planet', accent: '#9eddaa', genre: 'Documentary',
    synopsis: 'Explore an extraordinary ecosystem where everything works. Follow a brave deployment as it ventures into the hostile wilderness of production.' },
  { id: 'merge', title: 'The Great Merge-Off', meta: 'Reality · 38 conflicts', art: 'merge', accent: '#fa98b1', genre: 'Reality',
    synopsis: 'Six fictional developers. One shared branch. The judges demand a clean history, and someone has just force-pushed.' },
  { id: 'chai', title: 'Chai: A Love Story', meta: 'Romance · One more cup', art: 'chai', accent: '#e7c39a', genre: 'Romance',
    synopsis: 'Two cups meet on a rainy afternoon. One has ginger. The other has deadlines. A warm story about making time for a second steep.' },
  { id: 'error', title: 'Unexpectedly Expected', meta: 'Thriller · Try again', art: 'error', accent: '#a2c8e2', genre: 'Thriller',
    synopsis: 'A detective follows an error message through seventeen layers of abstraction. The culprit was a missing semicolon. Or was it?' },
  { id: 'offline', title: 'Offline by the Water', meta: 'Adventure · No signal', art: 'mountains', accent: '#b9d9dd', genre: 'Adventure',
    synopsis: 'A phone loses signal. A person discovers the sky. An unhurried adventure with absolutely no push notifications.' },
];
const tab = ref<Tab>('Home');
const detail = ref<Show | null>(null);
const query = ref('');
const heroIndex = ref(0);
const heroPaused = ref(false);
const heroHeld = ref(false);
const saved = ref(['traffic', 'meeting', 'planet', 'merge', 'chai']);
const season = ref(1);
const position = ref(0);
const duration = 213;
const reduced = ref(false);
const notice = ref('');
let previousDim = 0;
let heroTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
let motion: MediaQueryList | undefined;
const updateMotion = () => { reduced.value = motion?.matches ?? false; };
const hero = computed(() => shows[heroIndex.value] ?? shows[0]);
const results = computed(() => shows.filter(show => (show.title + ' ' + show.genre).toLowerCase().includes(query.value.trim().toLowerCase())));
const library = computed(() => shows.filter(show => saved.value.includes(show.id)));
const environments = computed(() => VISION_ENVIRONMENTS.filter(place => place.id !== 'room'));
const rails = [
  { title: 'Up Next', ids: ['traffic', 'meeting', 'planet', 'merge', 'chai'] },
  { title: 'Only on Pocket Lab', ids: ['keynote', 'planet', 'error', 'offline'] },
  { title: 'A little too relatable', ids: ['meeting', 'merge', 'traffic', 'chai'] },
];
function navigate(next: Tab): void { tab.value = next; detail.value = null; }
function toggleSaved(show: Show): void {
  saved.value = saved.value.includes(show.id) ? saved.value.filter(id => id !== show.id) : [...saved.value, show.id];
  notice.value = saved.value.includes(show.id) ? 'Added to Up Next and Library.' : 'Removed from Up Next.';
}
function rent(show: Show): void {
  if (!saved.value.includes(show.id)) saved.value = [...saved.value, show.id];
  notice.value = 'Added to Library. Your total: zero dependencies.';
}
function seek(value: number): void {
  if (!ready.value || !player) return;
  try {
    position.value = Math.max(0, Math.min(duration, value));
    player.seekTo(position.value, true);
  } catch { message.value = 'The player is reconnecting. Try again in a moment.'; }
}
function time(value: number): string {
  return Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
}
function watchIn(id: VisionEnvironmentId): void {
  if (vision) { vision.environment.value = id; vision.immersion.value = id === 'room' ? 0 : 1; }
  notice.value = id === 'room' ? 'Cinema selected. The room dims when the film starts.' : 'Environment selected for your next screening.';
}
function collectionKeys(event: KeyboardEvent): void {
  if (!(event.target instanceof HTMLElement) || event.target.matches('input, select')) return;
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  const group = event.target.closest('[data-collection]');
  if (!direction || !group) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const index = buttons.indexOf(event.target.closest('button') as HTMLButtonElement);
  buttons[(index + direction + buttons.length) % buttons.length]?.focus();
  event.preventDefault();
}
</script>

<template>
  <div class="tv-app" :class="{ compact }" @keydown="dismiss($event); collectionKeys($event)">
    <template v-if="!watching">
      <nav class="vk-tabbar destinations vk-scroll" aria-label="TV destinations" data-collection>
        <button v-for="item in tabs" :key="item.name" v-hover class="vk-icon" :aria-label="item.name"
          :aria-pressed="tab === item.name" @click="navigate(item.name)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="item.path" />
          </svg>
          <span class="tab-label">{{ item.name }}</span>
        </button>
      </nav>
      <main class="browse vk-scroll">
        <template v-if="detail">
          <button v-hover class="vk-button" @click="detail = null"><YtIcon name="back" />Back to {{ tab }}</button>
          <section class="detail-backdrop">
            <Poster :title="detail.title" :art="detail.art" :accent="detail.accent" :lettered="false" wide />
          </section>
          <div class="detail-copy">
            <span class="vk-chip">{{ detail.genre }} · Fictional catalog</span>
            <h1 class="vk-large-title">{{ detail.title }}</h1>
            <p class="vk-secondary">{{ detail.meta }} · CC · Spatial cinema</p>
            <p class="synopsis">{{ detail.synopsis }}</p>
            <div class="actions">
              <button v-hover class="vk-button primary play-button" @click="screenFilm(detail.title)"><YtIcon name="play" />Play</button>
              <button v-hover class="vk-button" :aria-pressed="saved.includes(detail.id)" @click="toggleSaved(detail)">
                <YtIcon :name="saved.includes(detail.id) ? 'check' : 'create'" />
                {{ saved.includes(detail.id) ? 'In Up Next' : 'Add to Up Next' }}
              </button>
              <button v-hover class="vk-button" @click="screenFilm(detail.title + ': Trailer')"><YtIcon name="play" />Trailer</button>
            </div>
            <h2 class="vk-title">Episodes</h2>
            <div class="vk-segmented" aria-label="Season">
              <button v-for="n in 3" :key="n" v-hover :aria-pressed="season === n" @click="season = n">Season {{ n }}</button>
            </div>
            <div class="episodes" data-collection>
              <button v-for="(name, i) in ['It worked yesterday', 'A quick fix', 'The rollback']" :key="name" v-hover
                class="vk-row vk-platter" @click="screenFilm(detail.title + ' · S' + season + ' E' + (i + 1))">
                <span class="episode-number">{{ i + 1 }}</span>
                <span><b>{{ name }}</b><small class="vk-secondary">Season {{ season }} · 3 min · The plot thickens.</small></span><YtIcon name="play" />
              </button>
            </div>
            <h2 class="vk-title">Cast &amp; Crew</h2>
            <div class="cast">
              <div v-for="person in ['Ada Frame', 'Basil Byte', 'Mira Loop', 'Theo Cache']" :key="person" class="vk-platter">
                <span class="cast-avatar">{{ person.split(' ').map(word => word[0]).join('') }}</span>
                <b>{{ person }}</b><small class="vk-secondary">Fictional performer</small>
              </div>
            </div>
            <p class="vk-footnote vk-secondary">A Pocket Lab simulation. All shows and cast are invented. All screenings share a very dependable soundtrack.</p>
          </div>
        </template>
        <template v-else>
          <header class="heading"><div><p class="eyebrow">POCKET LAB · TV SIMULATION</p><h1 class="vk-large-title">{{ tab }}</h1></div></header>
          <template v-if="tab === 'Home' || tab === 'Apple TV+'">
            <section v-if="hero" class="hero" @mouseenter="heroHeld = true" @mouseleave="heroHeld = false"
              @focusin="heroHeld = true" @focusout="heroHeld = false">
              <Transition name="hero-fade" mode="out-in">
                <div :key="hero.id" class="hero-poster"><Poster :title="hero.title" :art="hero.art" :accent="hero.accent" wide /></div>
              </Transition>
              <div class="hero-bottom">
                <p>{{ hero.meta }}<br /><span>{{ hero.synopsis.split('. ')[0] }}.</span></p>
                <div class="actions">
                  <button v-hover class="vk-button primary play-button" @click="screenFilm(hero.title)"><YtIcon name="play" />Play</button>
                  <button v-hover class="vk-button" @click="detail = hero">Details</button>
                </div>
              </div>
            </section>
            <div class="hero-pages" data-collection>
              <button v-for="(show, i) in shows.slice(0, 3)" :key="show.id" v-hover class="vk-icon" :aria-label="'Feature ' + show.title"
                :aria-pressed="heroIndex === i" @click="heroIndex = i"><span class="page-dot" /></button>
              <button v-hover class="vk-icon" :aria-label="heroPaused ? 'Resume featured carousel' : 'Pause featured carousel'"
                :aria-pressed="heroPaused" @click="heroPaused = !heroPaused"><YtIcon :name="heroPaused ? 'play' : 'pause'" /></button>
            </div>
            <section v-for="rail in rails" :key="rail.title" class="rail-section">
              <h2 class="vk-title">{{ rail.title }}</h2>
              <div class="rail vk-scroll" data-collection>
                <button v-for="show in shows.filter(item => rail.title === 'Up Next' ? saved.includes(item.id) : rail.ids.includes(item.id))"
                  :key="show.id" v-hover class="show-card" @click="detail = show">
                  <div class="card-poster"><Poster :title="show.title" :art="show.art" :accent="show.accent" :lettered="false" /></div>
                  <b>{{ show.title }}</b><small class="vk-secondary">{{ show.meta }}</small>
                </button>
                <p v-if="rail.title === 'Up Next' && !saved.length" class="vk-secondary">Add a title to plan your next screening.</p>
              </div>
            </section>
          </template>
          <template v-else-if="tab === 'Search'">
            <input v-model="query" v-hover class="vk-field search" type="search" aria-label="Search shows, films and genres" placeholder="Shows, films, genres" />
            <h2 class="vk-title">{{ query ? 'Results' : 'Explore the catalog' }}</h2>
            <div class="catalog" data-collection>
              <button v-for="show in results" :key="show.id" v-hover class="show-card" @click="detail = show">
                <div class="card-poster"><Poster :title="show.title" :art="show.art" :accent="show.accent" :lettered="false" /></div>
                <b>{{ show.title }}</b><small class="vk-secondary">{{ show.genre }}</small>
              </button>
            </div>
            <p v-if="!results.length">No matches. Even our fictional catalog has limits.</p>
          </template>
          <template v-else-if="tab === 'Library'">
            <p class="vk-secondary">Your Up Next collection. No subscription anxiety.</p>
            <div class="catalog" data-collection>
              <div v-for="show in library" :key="show.id" class="library-card">
                <button v-hover class="show-card" @click="detail = show">
                  <div class="card-poster"><Poster :title="show.title" :art="show.art" :accent="show.accent" :lettered="false" /></div><b>{{ show.title }}</b>
                </button>
                <button v-hover class="vk-button" :aria-label="'Remove ' + show.title + ' from Library'" @click="toggleSaved(show)">Remove</button>
              </div>
            </div>
            <div v-if="!library.length" class="empty vk-platter"><h2>Your next favourite is waiting.</h2>
              <button v-hover class="vk-button" @click="navigate('Home')">Explore TV</button>
            </div>
          </template>
          <template v-else>
            <p class="vk-secondary">Rent a fictional film. Payment method: imagination.</p>
            <div class="catalog" data-collection>
              <div v-for="show in shows" :key="show.id" class="library-card">
                <button v-hover class="show-card" @click="detail = show">
                  <div class="card-poster"><Poster :title="show.title" :art="show.art" :accent="show.accent" :lettered="false" /></div><b>{{ show.title }}</b>
                </button>
                <button v-hover class="vk-button" @click="rent(show)">{{ saved.includes(show.id) ? 'In Library · Add again' : 'Rent · ₹0' }}</button>
              </div>
            </div>
          </template>
          <h2 class="vk-title">Watch in</h2>
          <div class="environments vk-scroll" data-collection>
            <button v-hover class="environment vk-platter" @click="watchIn('room')"><span class="cinema-art"><YtIcon name="screen" /></span><b>Cinema</b></button>
            <button v-for="place in environments" :key="place.id" v-hover class="environment vk-platter"
              :aria-pressed="vision?.environment.value === place.id" @click="watchIn(place.id)">
              <img v-if="place.kind === 'photo'" :src="'/vision/env/' + place.id + '-thumb.webp'" alt="" loading="lazy" />
              <span v-else class="cinema-art"><YtIcon :name="place.id === 'moon' ? 'moon' : 'globe'" /></span><b>{{ place.name }}</b>
            </button>
          </div>
        </template>
        <p v-if="notice" class="vk-footnote notice" role="status">{{ notice }}</p>
      </main>
    </template>
    <main v-else class="cinema">
      <header class="cinema-heading"><b>{{ watching }}</b><span class="vk-secondary">The feature presentation</span></header>
      <div class="picture">
        <div ref="screen" class="frame" />
        <div v-if="!ready" class="curtain" role="status"><span>{{ failed ? 'Playback unavailable' : 'Preparing your screening' }}</span>{{ message }}</div>
      </div>
      <div class="transport vk-ornament">
        <div class="transport-row">
          <button v-hover class="vk-icon" aria-label="Rewind 10 seconds" :disabled="!ready" @click="seek(position - 10)"><YtIcon name="rewind" /></button>
          <button v-hover class="vk-icon large main-play" :aria-label="failed ? 'Retry playback' : playing ? 'Pause' : 'Play'"
            @click="failed ? start() : playing ? pause() : start()"><YtIcon :name="failed ? 'reload' : playing ? 'pause' : 'play'" /></button>
          <button v-hover class="vk-icon" aria-label="Forward 10 seconds" :disabled="!ready" @click="seek(position + 10)"><YtIcon name="fastForward" /></button>
          <button v-hover class="vk-icon" :aria-label="muted ? 'Unmute' : 'Mute'" :aria-pressed="muted" :disabled="!ready" @click="toggleSound">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M3 9h4l5-4v14l-5-4H3z" /><path :d="muted ? 'm16 8 6 8m0-8-6 8' : 'M16 8q6 4 0 8m3-11q9 7 0 14'" />
            </svg>
          </button>
          <button v-hover class="vk-button leave" @click="leave">Leave cinema</button>
        </div>
        <div class="scrub-row"><span>{{ time(position) }}</span>
          <input v-hover class="vk-slider" type="range" min="0" :max="duration" :value="position" :disabled="!ready"
            :style="{ '--value': position / duration }" aria-label="Playback position" :aria-valuetext="time(position)"
            @input="seek(Number(($event.target as HTMLInputElement).value))" /><span>{{ time(duration) }}</span>
        </div>
      </div>
      <div class="cinema-caption"><span role="status">{{ message }}</span>
        <a v-hover class="vk-button" :href="'https://www.youtube.com/watch?v=' + videoId" target="_blank" rel="noopener noreferrer">Open on YouTube<YtIcon name="external" /></a>
      </div>
    </main>
  </div>
</template>

<style scoped src="./tv/tv.css"></style>
