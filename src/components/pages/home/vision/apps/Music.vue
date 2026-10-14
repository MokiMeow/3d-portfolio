<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { HomeExperience } from '~/experiences/home';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import AlbumArt from './music/AlbumArt.vue';
import AppIcon from './music/AppIcon.vue';
import TrackRows from './music/TrackRows.vue';
import { MusicEngine, type SoundProfile } from './music/audio';
import { focusCollection } from './music/keyboard';
import { firstTrack, formatTime, genres, playlists, stations, tracks, type Genre, type Track } from './music/catalog';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type View = 'Listen Now' | 'Browse' | 'Radio' | 'Library' | 'Search' | 'Now Playing';
type LibraryView = 'Albums' | 'Artists' | 'Songs' | 'Playlists' | 'Favorites';
const navigation: { name: View; icon: string }[] = [
  { name: 'Listen Now', icon: 'play' }, { name: 'Browse', icon: 'browse' }, { name: 'Radio', icon: 'radio' },
  { name: 'Library', icon: 'music' }, { name: 'Search', icon: 'search' }, { name: 'Now Playing', icon: 'queue' },
];
const libraryViews: LibraryView[] = ['Albums', 'Artists', 'Songs', 'Playlists', 'Favorites'];
const view = ref<View>('Listen Now');
const library = ref<LibraryView>('Albums');
const genre = ref<Genre | 'All'>('All');
const collection = ref('');
const search = ref('');
const currentId = ref(firstTrack.id);
const track = computed(() => tracks.find(song => song.id === currentId.value) ?? firstTrack);
const playing = ref(false);
const busy = ref(false);
const elapsed = ref(0);
const volume = ref(65);
const shuffle = ref(false);
const repeat = ref<'Off' | 'All' | 'One'>('All');
const favorites = ref<string[]>([]);
const queue = ref(tracks.map(song => song.id));
const history = ref<string[]>([]);
const pane = ref<'Artwork' | 'Lyrics' | 'Queue'>('Artwork');
const menu = ref<'Output' | 'More' | null>(null);
const profile = ref<SoundProfile>('Studio');
const profiles: SoundProfile[] = ['Studio', 'Chai cup', 'Silk Board cancellation'];
const status = ref('Original sounds, generated right here. Press play to begin.');
const radio = ref('');
const lyricRows = ref<HTMLElement[]>([]);
const content = ref<HTMLElement>();
const levels = ref(Array.from({ length: 18 }, () => 0.04));
const reducedMotion = ref(false);
const currentLine = computed(() => Math.min(track.value.lyrics.length - 1,
  Math.floor(elapsed.value / track.value.duration * track.value.lyrics.length)));
const queueSongs = computed(() => queue.value.map(id => tracks.find(song => song.id === id)).filter((song): song is Track => !!song));
const groups = computed(() => {
  const key = library.value === 'Artists' ? 'artist' : 'album';
  return Array.from(new Set(tracks.map(song => song[key]))).map(name => ({
    name, songs: tracks.filter(song => song[key] === name),
    cover: tracks.find(song => song[key] === name) ?? firstTrack,
  }));
});
const filteredTracks = computed(() => {
  if (view.value === 'Search') {
    const query = search.value.trim().toLowerCase();
    return tracks.filter(song => [song.title, song.artist, song.album, song.genre].join(' ').toLowerCase().includes(query));
  }
  if (view.value === 'Browse') return tracks.filter(song => genre.value === 'All' || song.genre === genre.value);
  if (library.value === 'Favorites') return tracks.filter(song => favorites.value.includes(song.id));
  if (collection.value)
    return tracks.filter(song => song.album === collection.value || song.artist === collection.value);
  return tracks;
});
const recentTracks = computed(() => history.value.map(id => tracks.find(song => song.id === id)).filter((song): song is Track => !!song));
let engine: MusicEngine | undefined;
let frame = 0;
let disposed = false;
let operation = 0;
let lastVisual = 0;
let motionPreference: MediaQueryList | undefined;

function announce(message: string): void {
  status.value = message;
}
function getEngine(): MusicEngine {
  if (!engine) engine = new MusicEngine(() => void advance(false));
  return engine;
}
function animate(now: number): void {
  if (!playing.value || disposed) return;
  if (now - lastVisual > 70) {
    elapsed.value = engine?.position ?? elapsed.value;
    if (!reducedMotion.value) levels.value = engine?.levels() ?? levels.value;
    lastVisual = now;
  }
  frame = requestAnimationFrame(animate);
}
function beginFrames(): void {
  cancelAnimationFrame(frame);
  lastVisual = 0;
  frame = requestAnimationFrame(animate);
}
async function start(song = track.value, position = elapsed.value): Promise<void> {
  const request = ++operation;
  busy.value = true;
  playing.value = false;
  cancelAnimationFrame(frame);
  try {
    if (vision) {
      try { new HomeExperience().sound?.pauseMusic(); } catch { /* The player also works outside the room. */ }
    }
    const sound = getEngine();
    sound.setVolume(volume.value / 100);
    sound.setProfile(profile.value);
    const started = await sound.play(song, position >= song.duration ? 0 : position);
    if (!started || disposed || request !== operation) return;
    currentId.value = song.id;
    elapsed.value = sound.position;
    playing.value = true;
    history.value = [song.id, ...history.value.filter(id => id !== song.id)].slice(0, 6);
    announce(song.genre + ' · ' + song.bpm + ' BPM · Original instrumental');
    beginFrames();
  } catch {
    if (disposed || request !== operation) return;
    engine?.pause();
    playing.value = false;
    announce('Audio could not start. Press play to try again in this browser.');
  } finally {
    if (request === operation) busy.value = false;
  }
}
function pause(): void {
  ++operation;
  elapsed.value = engine?.position ?? elapsed.value;
  engine?.pause();
  playing.value = false;
  busy.value = false;
  cancelAnimationFrame(frame);
  levels.value = levels.value.map(() => 0.04);
}
function togglePlay(): void {
  if (playing.value || busy.value) pause();
  else void start();
}
function select(song: Track): void {
  radio.value = '';
  if (!queue.value.includes(song.id)) queue.value.push(song.id);
  currentId.value = song.id;
  elapsed.value = 0;
  void start(song, 0);
}
async function advance(manual: boolean): Promise<void> {
  if (!manual && repeat.value === 'One') {
    await start(track.value, 0);
    return;
  }
  const pool = queueSongs.value.length ? queueSongs.value : [track.value];
  const index = pool.findIndex(song => song.id === currentId.value);
  if (!manual && repeat.value === 'Off' && index >= pool.length - 1 && !shuffle.value) {
    pause();
    elapsed.value = track.value.duration;
    announce('Queue finished. Even the backlog deserves a break.');
    return;
  }
  const alternatives = pool.filter(song => song.id !== currentId.value);
  const following = shuffle.value && alternatives.length
    ? alternatives[Math.floor(Math.random() * alternatives.length)]
    : pool[(index + 1) % pool.length];
  if (following) {
    currentId.value = following.id;
    elapsed.value = 0;
    await start(following, 0);
  }
}
function previous(): void {
  if (elapsed.value > 3) { seek(0); return; }
  const index = queue.value.indexOf(currentId.value);
  const id = queue.value[(index - 1 + queue.value.length) % queue.value.length];
  const song = tracks.find(item => item.id === id);
  if (song) select(song);
}
function seek(position: number): void {
  elapsed.value = Math.min(track.value.duration, Math.max(0, position));
  engine?.seek(elapsed.value);
}
function scrub(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLInputElement) seek(Number(target.value));
}
function changeVolume(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    volume.value = Number(target.value);
    engine?.setVolume(volume.value / 100);
  }
}
function cycleRepeat(): void {
  repeat.value = repeat.value === 'Off' ? 'All' : repeat.value === 'All' ? 'One' : 'Off';
}
function favorite(id: string): void {
  const exists = favorites.value.includes(id);
  favorites.value = exists ? favorites.value.filter(item => item !== id) : [...favorites.value, id];
  announce(exists ? 'Removed from Favorites. No hard feelings.' : 'Added to Favorites. The artist is a for-loop, and it is thrilled.');
}
function enqueue(id: string): void {
  if (queue.value.includes(id)) announce('Already in your queue. It has been waiting patiently.');
  else { queue.value.push(id); announce('Added to the queue. No merge conflict.'); }
}
function move(id: string, direction: number): void {
  const index = queue.value.indexOf(id);
  const target = index + direction;
  const other = queue.value[target];
  if (index < 0 || target < 0 || !other) return;
  const updated = [...queue.value];
  updated[index] = other;
  updated[target] = id;
  queue.value = updated;
}
function remove(id: string): void {
  queue.value = queue.value.filter(item => item !== id);
  if (!queue.value.includes(currentId.value)) queue.value.unshift(currentId.value);
  announce('Removed from the queue.');
}
function playCollection(ids: string[], label: string): void {
  queue.value = [...ids];
  radio.value = label;
  const song = tracks.find(item => item.id === ids[0]);
  if (song) {
    currentId.value = song.id;
    elapsed.value = 0;
    void start(song, 0);
  }
}
function openGroup(name: string): void {
  collection.value = name;
  view.value = 'Library';
}
function navigate(name: View): void {
  view.value = name;
  menu.value = null;
  if (name !== 'Library') collection.value = '';
}
function setProfile(value: SoundProfile): void {
  profile.value = value;
  engine?.setProfile(value);
  announce(value === 'Studio' ? 'Full-frequency sound. The bugs are still audible.'
    : value === 'Chai cup' ? 'Warm low-pass sound. Served without a saucer.' : 'Reduced treble. Traffic cancellation remains aspirational.');
}
function clearUpcoming(): void {
  queue.value = [currentId.value];
  menu.value = null;
  announce('Queue cleared. One thing left to finish.');
}
function shuffleLibrary(): void {
  queue.value = tracks.map(song => song.id);
  shuffle.value = true;
  menu.value = null;
  void advance(true);
}
function syncMotionPreference(): void {
  reducedMotion.value = motionPreference?.matches ?? false;
  if (reducedMotion.value) levels.value = levels.value.map(() => 0.04);
}
function onVisibility(): void {
  if (document.hidden && (playing.value || busy.value)) pause();
}
watch(view, async () => {
  await nextTick();
  if (!disposed) content.value?.scrollTo({ top: 0, behavior: 'auto' });
});
watch(currentLine, async () => {
  if (pane.value !== 'Lyrics' || view.value !== 'Now Playing') return;
  await nextTick();
  lyricRows.value[currentLine.value]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
});
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMotionPreference();
  motionPreference.addEventListener('change', syncMotionPreference);
});
onBeforeUnmount(() => {
  disposed = true;
  ++operation;
  cancelAnimationFrame(frame);
  engine?.dispose();
  document.removeEventListener('visibilitychange', onVisibility);
  motionPreference?.removeEventListener('change', syncMotionPreference);
});
</script>

<template>
  <div class="music-app" :class="{ compact }" @keydown="focusCollection">
    <div class="music-layout">
    <nav class="tabs vk-tabbar vk-scroll" aria-label="Music navigation">
      <button v-for="item in navigation" :key="item.name" v-hover class="vk-icon large tab"
        :aria-label="item.name" :title="item.name" :aria-pressed="view === item.name" @click="navigate(item.name)">
        <AppIcon :name="item.icon" :filled="item.icon === 'play'" /><span class="tab-label">{{ item.name }}</span>
      </button>
    </nav>

    <div class="music-body">
      <main ref="content" class="content vk-scroll">
        <header class="page-header">
          <div><small class="eyebrow">MUSIC · POCKET LAB</small><h1>{{ view }}</h1></div>
          <button v-hover class="vk-icon" aria-label="Music menu" :aria-expanded="menu === 'More'"
            @click="menu = menu === 'More' ? null : 'More'"><AppIcon name="more" /></button>
        </header>

        <section v-if="menu === 'More'" class="menu vk-sheet" aria-label="Music menu">
          <button v-hover class="vk-row" @click="favorite(track.id)">
            <AppIcon name="heart" :filled="favorites.includes(track.id)" />
            {{ favorites.includes(track.id) ? 'Unfavorite current song' : 'Favorite current song' }}</button>
          <button v-hover class="vk-row" @click="shuffleLibrary"><AppIcon name="shuffle" /> Shuffle all six originals</button>
          <button v-hover class="vk-row" @click="clearUpcoming"><AppIcon name="queue" /> Clear upcoming queue</button>
          <p>Made from oscillators, filters and a worrying amount of chai. Instrumental audio; imaginary artists. No streaming account required.</p>
          <button v-hover class="vk-button" @click="menu = null">Done</button>
        </section>

        <section v-if="view === 'Listen Now'" class="listen">
          <button v-hover class="featured vk-platter" @click="select(firstTrack)">
            <span class="featured-art"><AlbumArt :track="firstTrack" /></span>
            <span class="feature-copy"><small>MADE FOR YOUR NEXT COMMIT</small><strong>Less noise.<br>More flow.</strong>
              <span>Lazy chords for a very busy brain.</span><span class="feature-play"><AppIcon name="play" filled /> Listen now</span></span>
          </button>
          <div class="section-heading"><h2>Your next chai break</h2><small>Six original sound worlds</small></div>
          <div class="album-grid">
            <button v-for="song in tracks" :key="song.id" v-hover class="album-card" :aria-label="'Play ' + song.title" @click="select(song)">
              <AlbumArt :track="song" /><strong>{{ song.title }}</strong><small>{{ song.genre }} · {{ song.artist }}</small>
            </button>
          </div>
          <h2>{{ recentTracks.length ? 'Recently played' : 'Start listening' }}</h2>
          <TrackRows :tracks="recentTracks.length ? recentTracks : tracks.slice(0, 3)" :current-id="track.id"
            :playing="playing" :favorites="favorites" @play="select" @favorite="favorite" @enqueue="enqueue" />
        </section>

        <section v-else-if="view === 'Browse'" class="browse">
          <p class="lede">Every mood, locally composed. No algorithm has opinions about your taste.</p>
          <div class="filters vk-scroll" aria-label="Genres">
            <button v-hover class="vk-button" :aria-pressed="genre === 'All'" @click="genre = 'All'">All moods</button>
            <button v-for="item in genres" :key="item" v-hover class="vk-button" :aria-pressed="genre === item" @click="genre = item">{{ item }}</button>
          </div>
          <div v-if="genre !== 'All'" class="genre-feature vk-platter">
            <h2>{{ genre }}</h2><p>{{ filteredTracks[0]?.description }}</p>
          </div>
          <TrackRows :tracks="filteredTracks" :current-id="track.id" :playing="playing" :favorites="favorites"
            @play="select" @favorite="favorite" @enqueue="enqueue" />
          <h2>Curated by absolutely nobody</h2>
          <div class="playlist-grid">
            <button v-for="list in playlists" :key="list.name" v-hover class="playlist vk-platter" @click="playCollection(list.ids, list.name)">
              <span class="playlist-symbol"><AppIcon name="music" /></span><strong>{{ list.name }}</strong>
              <small>{{ list.subtitle }}</small><span class="vk-footnote playlist-play"><AppIcon name="play" filled /> {{ list.ids.length }} songs</span>
            </button>
          </div>
        </section>

        <section v-else-if="view === 'Radio'" class="radio">
          <div class="radio-banner vk-platter"><span><AppIcon name="radio" /></span><small>LIVE FROM THIS BROWSER</small>
            <h2>No ads. No awkward callers.</h2><p>Three stations, six originals. The DJ is extremely deterministic.</p></div>
          <button v-for="station in stations" :key="station.name" v-hover class="station vk-row"
            :aria-pressed="radio === station.name" @click="playCollection(station.ids, station.name)">
            <span class="station-mark"><AppIcon name="radio" /></span>
            <span><strong>{{ station.name }}</strong><small>{{ station.subtitle }}</small></span><AppIcon name="play" filled />
          </button>
          <p v-if="radio" class="vk-footnote">Tuned to {{ radio }}. Use Repeat All below to keep the station rolling.</p>
        </section>

        <section v-else-if="view === 'Library'" class="library">
          <div class="filters vk-scroll" aria-label="Library categories">
            <button v-for="item in libraryViews" :key="item" v-hover class="vk-button" :aria-pressed="library === item"
              @click="library = item; collection = ''">{{ item }}</button>
          </div>
          <template v-if="collection">
            <div class="section-heading"><h2>{{ collection }}</h2>
              <button v-hover class="vk-button" @click="collection = ''"><AppIcon name="left" /> Back</button></div>
            <TrackRows :tracks="filteredTracks" :current-id="track.id" :playing="playing" :favorites="favorites"
              @play="select" @favorite="favorite" @enqueue="enqueue" />
          </template>
          <div v-else-if="library === 'Albums' || library === 'Artists'" class="album-grid">
            <button v-for="group in groups" :key="group.name" v-hover class="album-card" @click="openGroup(group.name)">
              <AlbumArt :track="group.cover" /><strong>{{ group.name }}</strong><small>{{ group.songs.length }} {{ group.songs.length === 1 ? 'song' : 'songs' }}</small>
            </button>
          </div>
          <div v-else-if="library === 'Playlists'" class="playlist-grid">
            <button v-for="list in playlists" :key="list.name" v-hover class="playlist vk-platter" @click="playCollection(list.ids, list.name)">
              <span class="playlist-symbol"><AppIcon name="music" /></span><strong>{{ list.name }}</strong><small>{{ list.subtitle }}</small>
              <span class="vk-footnote playlist-play"><AppIcon name="play" filled /> Play {{ list.ids.length }} songs</span>
            </button>
          </div>
          <template v-else>
            <TrackRows :tracks="filteredTracks" :current-id="track.id" :playing="playing" :favorites="favorites"
              @play="select" @favorite="favorite" @enqueue="enqueue" />
            <div v-if="!filteredTracks.length" class="empty vk-platter"><span><AppIcon name="heart" /></span><h2>Your favorites live here</h2>
              <p>Tap a heart on any song. Even imaginary musicians appreciate it.</p>
              <button v-hover class="vk-button" @click="library = 'Songs'">Find a song</button></div>
          </template>
        </section>

        <section v-else-if="view === 'Search'" class="search-view">
          <label class="search-field"><span class="sr-only">Search songs, artists, albums or genres</span>
            <input v-model="search" v-hover class="vk-field" type="search" placeholder="Songs, artists, genres…" /></label>
          <h2>{{ search ? 'Results for “' + search + '”' : 'Try a little discovery' }}</h2>
          <TrackRows :tracks="filteredTracks" :current-id="track.id" :playing="playing" :favorites="favorites"
            @play="select" @favorite="favorite" @enqueue="enqueue" />
          <p v-if="!filteredTracks.length" class="empty">No matches. The catalog is small. Its feelings are enormous.</p>
          <button v-if="search" v-hover class="vk-button" @click="search = ''">Clear search</button>
        </section>

        <section v-else class="now-playing">
          <div class="now-modes vk-segmented" aria-label="Now Playing views">
            <button v-for="item in (['Artwork', 'Lyrics', 'Queue'] as const)" :key="item" v-hover :aria-pressed="pane === item" @click="pane = item">{{ item }}</button>
          </div>
          <div v-if="pane === 'Artwork'" class="listening">
            <div class="art-stage">
              <div class="spectrum" aria-hidden="true"><i v-for="(level, bar) in levels" :key="bar"
                :style="{ transform: 'scaleY(' + Math.max(0.04, level) + ')', background: track.colors[bar % 3] }" /></div>
              <div class="main-cover"><AlbumArt :track="track" /></div>
            </div>
            <div class="track-info"><small>{{ radio || 'ORIGINAL INSTRUMENTAL' }}</small><h2>{{ track.title }}</h2>
              <p>{{ track.artist }}</p><span>{{ track.album }}</span><small>{{ track.description }}</small></div>
          </div>
          <section v-else-if="pane === 'Lyrics'" class="lyrics-panel">
            <h2>{{ track.title }}</h2><p class="vk-footnote">Words for the imaginary album. The music is instrumental.</p>
            <div class="lyrics vk-scroll" aria-label="Synchronized lyrics">
              <button v-for="(line, lineIndex) in track.lyrics" :key="track.id + lineIndex" ref="lyricRows" v-hover
                :class="{ current: lineIndex === currentLine }" :aria-current="lineIndex === currentLine ? 'true' : undefined"
                :aria-label="'Seek to lyric: ' + line" @click="seek(lineIndex * track.duration / track.lyrics.length)">{{ line }}</button>
            </div>
          </section>
          <section v-else class="queue-panel">
            <div class="section-heading"><h2>Playing Next</h2><small>{{ queueSongs.length }} {{ queueSongs.length === 1 ? 'song' : 'songs' }}</small></div>
            <p class="vk-footnote">Move songs to shape what comes next. The current song stays while you listen.</p>
            <div v-for="(song, songIndex) in queueSongs" :key="song.id" class="queue-item vk-platter">
              <button v-hover class="vk-row queue-song" :aria-pressed="song.id === track.id" @click="select(song)">
                <span class="queue-cover"><AlbumArt :track="song" small /></span>
                <span>
                  <strong>{{ song.title }}</strong>
                  <small>{{ song.id === track.id ? (busy ? 'Starting…' : playing ? 'Now playing' : 'Selected · Paused') : song.artist }}</small>
                  </span>
              </button>
              <div class="queue-actions">
                <button v-hover class="vk-icon" :aria-label="'Move ' + song.title + ' up'" :disabled="songIndex === 0" @click="move(song.id, -1)"><AppIcon name="up" /></button>
                <button v-hover class="vk-icon" :aria-label="'Move ' + song.title + ' down'" :disabled="songIndex === queueSongs.length - 1" @click="move(song.id, 1)">
                  <AppIcon name="down" />
                  </button>
                <button v-hover class="vk-icon" :aria-label="'Remove ' + song.title + ' from queue'" :disabled="song.id === track.id" @click="remove(song.id)">
                  <AppIcon name="close" />
                  </button>
              </div>
            </div>
          </section>


        </section>


        <p class="status vk-footnote" role="status">{{ status }}</p>

      </main>
        <section v-if="menu === 'Output'" class="output vk-sheet vk-scroll" aria-label="Sound output profiles">
          <h2>Sound goes to your browser</h2><p>Pick a tone profile. Your actual speaker selection stays with your device.</p>
          <button v-for="value in profiles" :key="value" v-hover class="vk-row" :aria-pressed="profile === value" @click="setProfile(value)">
            <AppIcon :name="profile === value ? 'check' : 'sound'" />{{ value }}</button>
          <button v-hover class="vk-button" @click="menu = null">Done</button>
        </section>
          <section v-if="view === 'Now Playing'" class="transport vk-platter" aria-label="Playback controls">
            <label class="scrubber"><span class="sr-only">Track position</span>
              <input v-hover class="vk-slider" type="range" min="0" :max="track.duration" step=".1" :value="elapsed"
                :style="{ '--value': elapsed / track.duration }" :aria-valuetext="formatTime(elapsed) + ' of ' + formatTime(track.duration)" @input="scrub" /></label>
            <div class="time-row"><small>{{ formatTime(elapsed) }}</small><small>−{{ formatTime(track.duration - elapsed) }}</small></div>
            <div class="play-controls">
              <button v-hover class="vk-icon" :aria-pressed="shuffle" aria-label="Shuffle" @click="shuffle = !shuffle"><AppIcon name="shuffle" /></button>
              <button v-hover class="vk-icon large" aria-label="Previous song" @click="previous"><AppIcon name="previous" filled /></button>
              <button v-hover class="vk-icon large play-button" :aria-label="playing || busy ? 'Pause' : 'Play'" @click="togglePlay">
                <AppIcon :name="playing || busy ? 'pause' : 'play'" :filled="!playing && !busy" />
                </button>
              <button v-hover class="vk-icon large" aria-label="Next song" @click="advance(true)"><AppIcon name="next" filled /></button>
              <button v-hover class="vk-icon" :aria-label="'Repeat: ' + repeat" :aria-pressed="repeat !== 'Off'" @click="cycleRepeat">
                <AppIcon name="repeat" />
                <span v-if="repeat === 'One'" class="repeat-one">1</span>
                </button>
            </div>
            <label class="volume"><AppIcon name="sound" /><span class="sr-only">Volume</span>
              <input v-hover class="vk-slider" type="range" min="0" max="100" :value="volume" :style="{ '--value': volume / 100 }"
                :aria-valuetext="volume + ' percent'" @input="changeVolume" /><small>{{ volume }}%</small></label>
          </section>
        <footer v-if="view === 'Now Playing'" class="bottom-tools vk-ornament" aria-label="Music tools">
          <button v-hover class="vk-icon" aria-label="Open synchronized lyrics" :aria-pressed="view === 'Now Playing' && pane === 'Lyrics'"
            @click="navigate('Now Playing'); pane = 'Lyrics'"><AppIcon name="lyrics" /></button>
          <button v-hover class="vk-icon" aria-label="Open play queue" :aria-pressed="view === 'Now Playing' && pane === 'Queue'"
            @click="navigate('Now Playing'); pane = 'Queue'"><AppIcon name="queue" /></button>
          <button v-hover class="vk-icon" aria-label="Sound output profiles" :aria-expanded="menu === 'Output'"
            @click="menu = menu === 'Output' ? null : 'Output'"><AppIcon name="sound" /></button>
          <button v-hover class="vk-icon" :aria-label="favorites.includes(track.id) ? 'Unfavorite current song' : 'Favorite current song'"
            :aria-pressed="favorites.includes(track.id)" @click="favorite(track.id)"><AppIcon name="heart" :filled="favorites.includes(track.id)" /></button>
        </footer>

      <section v-if="view !== 'Now Playing'" class="mini-player vk-platter" aria-label="Mini player">
        <button v-hover class="mini-info" aria-label="Open Now Playing" @click="navigate('Now Playing'); pane = 'Artwork'">
          <span class="mini-cover"><AlbumArt :track="track" small /></span><span><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span>
        </button>
        <button v-hover class="vk-icon" :aria-label="playing || busy ? 'Pause' : 'Play'" @click="togglePlay">
          <AppIcon :name="playing || busy ? 'pause' : 'play'" :filled="!playing && !busy" />
          </button>
        <button v-hover class="vk-icon" aria-label="Next song" @click="advance(true)"><AppIcon name="next" filled /></button>
        <div class="mini-progress" :style="{ transform: 'scaleX(' + elapsed / track.duration + ')' }" aria-hidden="true" />
      </section>
    </div>
    </div>
  </div>
</template>

<style scoped>
.music-app {
  box-sizing: border-box;
  width: 100%; height: 100%; min-width: 0; min-height: 0; container-type: size; display: block;
  color: rgb(255 255 255 / .96); border-radius: inherit; overflow: hidden; font-size: 17px; line-height: 1.4;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
}
.music-layout { width: 100%; height: 100%; min-height: 0; display: flex; }
.music-app :deep(*) { font-family: inherit; box-sizing: border-box; }
button, input { font: inherit; color: inherit; }
button { border: 0; cursor: pointer; background: transparent; padding: 0; }
:focus-visible { outline: 2px solid white; outline-offset: 3px; }
button:disabled { opacity: .35; cursor: default; }
h1, h2, p { margin: 0; }
h1 { font-size: 32px; line-height: 1.1; letter-spacing: -.03em; font-weight: 700; }
h2 { font-size: 23px; line-height: 1.2; letter-spacing: -.02em; font-weight: 700; }
small { font-size: 14px; line-height: 1.35; color: rgb(255 255 255 / .76); }
.music-app .tabs {
  position: relative; z-index: 3; flex: none; width: 76px; margin: 20px 0 20px 14px; align-self: flex-start;
  max-height: calc(100% - 40px); overflow: visible; overscroll-behavior: contain;
}
.tab { position: relative; font-size: 25px; }
.tab-label {
  pointer-events: none; position: absolute; z-index: 10; left: calc(100% + 8px); white-space: nowrap; opacity: 0;
  background: rgb(35 38 46 / .94); padding: 9px 14px; border-radius: 18px; font-size: 14px;
  transform: translateX(-5px); transition: opacity 220ms, transform 220ms;
}
.tab:hover .tab-label, .tab:focus-visible .tab-label { opacity: 1; transform: translateX(0); }
.music-body { position: relative; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.content { flex: 1; min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; padding: 26px 28px 18px; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 24px; }
.eyebrow { display: block; font-size: 12px; font-weight: 600; letter-spacing: .12em; margin-bottom: 7px; }
.listen, .browse, .library, .search-view, .radio, .now-playing { display: flex; flex-direction: column; gap: 22px; }
.featured {
  display: flex; gap: 26px; align-items: center; padding: 22px; width: 100%; text-align: left; min-height: 220px;
  background: linear-gradient(130deg, rgb(174 82 119 / .24), rgb(255 255 255 / .06));
}
.featured-art { width: min(42%, 230px); flex: none; }
.feature-copy { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.feature-copy > small { font-size: 12px; letter-spacing: .08em; }
.feature-copy > strong { font-size: clamp(23px, 4cqw, 42px); line-height: 1.04; letter-spacing: -.03em; }
.feature-copy > span { font-size: 14px; color: rgb(255 255 255 / .8); }
.feature-copy .feature-play { color: white; font-size: 17px; font-weight: 600; padding-top: 9px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.album-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 20px 14px; }
.album-card { display: flex; flex-direction: column; min-width: 0; gap: 5px; border-radius: 24px; text-align: left; padding: 7px; }
.album-card strong { margin-top: 6px; font-size: 17px; font-weight: 600; line-height: 1.25; }
.album-card small { display: block; }
.lede { color: rgb(255 255 255 / .78); }
.filters { display: flex; flex-wrap: wrap; gap: 8px; overflow: auto; padding: 3px; }
.filters .vk-button { min-height: 44px; font-size: 14px; padding: 0 16px; }
.genre-feature { padding: 22px; }
.genre-feature p { margin-top: 8px; color: rgb(255 255 255 / .78); }
.playlist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
.playlist { padding: 22px; display: flex; flex-direction: column; gap: 10px; text-align: left; }
.playlist strong { font-size: 23px; line-height: 1.15; }
.playlist-symbol { font-size: 44px; color: #fcb1bd; }
.radio-banner { padding: 28px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.radio-banner > span { font-size: 60px; color: #ff9fac; line-height: 1; }
.radio-banner p { color: rgb(255 255 255 / .78); }
.station { min-height: 90px; padding: 18px; gap: 18px; }
.station > span:nth-child(2) { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; }
.station-mark { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 17px; background: rgb(241 127 156 / .2); font-size: 29px; flex: none; }
.empty { padding: 28px; text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; color: rgb(255 255 255 / .8); }
.empty > span { font-size: 44px; }
.search-field { display: block; }
.search-field input { min-height: 52px; }
.now-modes { align-self: center; max-width: 100%; }
.now-modes button { min-height: 44px; }
.listening { display: flex; gap: 34px; align-items: center; padding: 12px 0; }
.art-stage { position: relative; width: min(46%, 350px); flex: none; padding: 20px; isolation: isolate; }
.main-cover { position: relative; z-index: 1; }
.spectrum { position: absolute; inset: -8% -12%; display: flex; align-items: center; gap: 7px; z-index: 0; opacity: .42; }
.spectrum i { flex: 1; height: 100%; border-radius: 20px; transition: transform 200ms ease-out; transform-origin: center; }
.track-info { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.track-info h2 { font-size: 32px; letter-spacing: -.03em; }
.track-info p { color: #ffc1cd; }
.track-info > span { font-size: 14px; color: rgb(255 255 255 / .78); }
.track-info > small:last-child { margin-top: 10px; }
.transport { flex: none; padding: 8px 20px; width: calc(100% - 44px); align-self: center; margin: 8px 0 0; }
.scrubber { display: block; }
.time-row { display: flex; justify-content: space-between; gap: 16px; margin-top: -5px; }
.play-controls { display: flex; justify-content: center; align-items: center; gap: 16px; margin: 6px 0; }
.play-controls .vk-icon { font-size: 23px; }
.play-controls .vk-icon.large { font-size: 20px; }
.play-controls .play-button { font-size: 28px; background: rgb(255 255 255 / .24); }
.volume { display: flex; align-items: center; gap: 14px; }
.volume small { min-width: 36px; text-align: right; }
.volume > span:first-child { font-size: 25px; }
.lyrics-panel { display: flex; flex-direction: column; gap: 12px; }
.lyrics { max-height: 380px; min-height: 170px; display: flex; flex-direction: column; gap: 10px; overflow: auto; overscroll-behavior: contain; }
.lyrics button {
  text-align: left; color: rgb(255 255 255 / .57); font-size: 32px; font-weight: 700; line-height: 1.2;
  padding: 14px 8px; border-radius: 18px; min-height: 60px; transition: opacity 300ms;
}
.lyrics button.current { color: white; }
.queue-panel { display: flex; flex-direction: column; gap: 12px; }
.queue-item { display: flex; align-items: center; gap: 8px; padding: 5px; }
.queue-song { min-width: 0; flex: 1; padding: 8px; }
.queue-song > span:last-child { min-width: 0; display: flex; flex-direction: column; }
.queue-song strong { font-size: 17px; line-height: 1.25; }
.queue-cover { width: 44px; height: 44px; flex: none; }
.queue-actions { display: flex; gap: 5px; padding: 3px; }
.menu, .output { margin: 12px 0 22px; }
.menu p, .output p { font-size: 14px; color: rgb(255 255 255 / .78); padding: 14px; }
.music-app .output {
  position: absolute; z-index: 10; left: 16px; right: 16px; bottom: 76px;
  max-height: calc(100% - 96px); margin: 0; overflow: auto; overscroll-behavior: contain;
}
.output h2 { padding: 14px 14px 0; }
.status { margin: 22px 0 16px; min-height: 20px; color: rgb(255 255 255 / .78); }
.bottom-tools { flex: none; width: max-content; max-width: 100%; margin: 8px auto 16px; }
.mini-player {
  position: relative; flex: none; display: flex; gap: 10px; align-items: center; margin: 0 22px 18px; padding: 10px 14px;
  overflow: hidden; border-radius: 24px; min-height: 76px;
}
.mini-info { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 0; text-align: left; border-radius: 16px; }
.mini-info > span:last-child { min-width: 0; display: flex; flex-direction: column; }
.mini-info strong { font-size: 17px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-cover { width: 46px; height: 46px; flex: none; }
.mini-progress { position: absolute; height: 2px; background: #ffb7c6; inset: auto 0 0; transform-origin: left; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@container (min-width: 1100px) {
  .content { padding: 38px 46px 22px; }
  .album-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .listen .featured { max-width: 820px; }
  .listening { justify-content: center; }
  .track-info { max-width: 440px; }
}
@container (max-width: 760px) {
  .tabs { width: 64px; margin: 18px 0 18px 10px; }
  .tabs .tab { width: 48px; height: 48px; }
  .content { padding: 22px 20px 16px; }
  .featured { gap: 18px; min-height: 190px; padding: 16px; }
  .listening { flex-direction: column; text-align: center; gap: 14px; }
  .art-stage { width: min(80%, 290px); padding: 15px; }
  .track-info h2 { font-size: 23px; }
  .play-controls { gap: 9px; }
  .transport { padding: 12px 16px; }
  .queue-item { flex-wrap: wrap; }
  .queue-song { flex-basis: 100%; }
  .queue-actions { padding-left: 8px; }
  .mini-player { margin: 0 14px 14px; padding: 9px; }
}
@container (max-width: 540px) {
  .tabs { width: 58px; margin: 12px 0 12px 6px; padding: 6px; gap: 5px; }
  .tabs .tab { width: 46px; height: 46px; font-size: 23px; }
  .content { padding: 18px 12px; }
  .page-header { margin-bottom: 18px; }
  .page-header h1 { font-size: 32px; overflow-wrap: anywhere; }
  .featured { flex-direction: column; align-items: stretch; padding: 14px; gap: 14px; }
  .featured-art { width: 100%; }
  .feature-copy > strong { font-size: 32px; }
  .album-grid { grid-template-columns: 1fr; gap: 16px; }
  .album-card { padding: 5px; }
  .playlist-grid { grid-template-columns: 1fr; }
  .listen, .browse, .library, .search-view, .radio, .now-playing { gap: 18px; }
  .station { padding: 10px; gap: 10px; flex-wrap: wrap; }
  .station-mark { width: 44px; height: 44px; font-size: 23px; }
  .now-modes { width: 100%; }
  .now-modes button { flex: 1; font-size: 14px; padding: 0 9px; }
  .transport { padding: 10px; }
  .play-controls { gap: 1px; justify-content: space-between; flex-wrap: wrap; }
  .play-controls .vk-icon.large:not(.play-button) { width: 44px; height: 44px; font-size: 14px; }
  .play-controls .vk-icon { width: 44px; height: 44px; font-size: 20px; }
  .play-controls .play-button { width: 60px; height: 60px; }
  .mini-player { gap: 5px; margin: 0 8px 12px; padding: 8px; flex-wrap: wrap; }
  .mini-info { flex-basis: 100%; }
  .mini-player > button:not(.mini-info) { margin-top: 3px; }
  .lyrics button { font-size: 23px; }
  .track-info > small:last-child { font-size: 14px; }
}
@container (max-height: 460px) {
  .music-app .tabs { overflow: auto; }
}
@container (max-height: 400px) {
  .art-stage { width: 150px; }
}

.music-app :deep(.vk-scroll) { scrollbar-width: thin; scrollbar-color: #ffffff38 transparent; }
.music-app :deep(.vk-scroll::-webkit-scrollbar) { display: block; width: 4px; height: 4px; }
.music-app :deep(.vk-scroll::-webkit-scrollbar-thumb) { background: #ffffff38; border-radius: 8px; }
.music-app .tabs .app-icon { width: 26px; height: 26px; }
.feature-play, .playlist-play { display: flex; align-items: center; gap: 8px; }
.playlist-symbol :deep(svg), .radio-banner > span :deep(svg), .empty > span :deep(svg) { width: 40px; height: 40px; }
.repeat-one { position: absolute; right: 6px; bottom: 3px; font-size: 12px; font-weight: 700; }
.music-app .transport .play-controls .vk-icon.large { width: 48px; height: 48px; }
.music-app .transport .play-controls .play-button { width: 52px; height: 52px; }
.listen, .browse, .library, .search-view, .radio, .now-playing { animation: music-page .24s ease-out; }
.queue-song strong { overflow-wrap: anywhere; }
.mini-info strong { white-space: normal; overflow: visible; text-overflow: clip; }
.mini-info { min-height: 48px; }
@keyframes music-page { from { opacity: 0; transform: translateY(5px); } }
@container (max-width: 760px) {
  .music-app .tabs { width: 64px; margin: 18px 0 18px 10px; }
}
@container (max-width: 540px) {
  .music-layout { flex-direction: column-reverse; }
  .music-app .tabs {
    flex-direction: row; align-self: center; width: max-content; max-width: calc(100% - 20px);
    max-height: none; margin: 0 10px 10px; padding: 6px; gap: 4px; overflow: visible;
  }
  .music-app .tabs .tab { width: 44px; height: 44px; }
  .tab-label { left: 50%; bottom: calc(100% + 8px); transform: translate(-50%, 5px); }
  .tab:focus-visible .tab-label { transform: translate(-50%, 0); }
  .tab:hover .tab-label { opacity: 0; }
  .content { padding: 18px 16px; }
  .page-header h1 { font-size: 28px; overflow-wrap: normal; }
  .featured { flex-direction: row; align-items: center; gap: 12px; padding: 14px; min-height: 0; }
  .featured-art { width: 42%; }
  .feature-copy > strong { font-size: 24px; }
  .feature-copy > small { font-size: 12px; letter-spacing: .04em; }
  .feature-copy > span { font-size: 13px; }
  .feature-copy .feature-play { font-size: 14px; padding-top: 4px; }
  .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 10px; }
  .album-card strong { font-size: 14px; }
  .album-card small { font-size: 12px; }
  .queue-item { flex-wrap: nowrap; gap: 4px; }
  .queue-song { flex-basis: auto; gap: 9px; }
  .queue-song strong { font-size: 14px; }
  .queue-song small { font-size: 12px; }
  .queue-cover { width: 40px; height: 40px; }
  .queue-actions { flex-direction: column; gap: 4px; padding: 0; }
  .queue-actions .vk-icon { width: 44px; height: 44px; }
  .music-app .transport { padding: 4px 12px; width: calc(100% - 24px); margin-top: 4px; }
  .play-controls { flex-wrap: nowrap; gap: 4px; margin: 4px 0; }
  .time-row { margin-top: -8px; }
  .volume { gap: 8px; }
  .music-app .bottom-tools { padding: 4px; margin: 6px auto 8px; }
  .mini-player { flex-wrap: nowrap; gap: 4px; margin: 0 12px 10px; padding: 8px; }
  .mini-info { flex-basis: auto; gap: 8px; }
  .mini-info strong { font-size: 14px; }
  .mini-info small { font-size: 12px; }
  .mini-cover { width: 40px; height: 40px; }
  .mini-player > button:not(.mini-info) { margin: 0; }
}
@container (max-height: 440px) {
  .music-app .transport { padding: 2px 12px; }
  .transport .volume { display: none; }
  .music-app .bottom-tools { padding: 4px; margin: 4px auto 8px; }
}
@media (hover: none) { .tab-label { display: none; } }

@media (prefers-reduced-motion: reduce) {
  .music-app :deep(*), .music-app :deep(*::before), .music-app :deep(*::after) {
    transition: none !important; animation: none !important; scroll-behavior: auto !important;
  }
}
</style>
