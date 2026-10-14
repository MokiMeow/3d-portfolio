<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
type Photo = {
    id: number;
    kind: string;
    bg: string;
    caption: string;
    month: string;
    year: number;
};
const kinds = [
    'sunset',
    'chai',
    'desk',
    'thumb',
    'cat',
    'error'
];
const backgrounds = [
    'linear-gradient(155deg,#6483ab,#eaa5a0 54%,#f6c795)',
    'linear-gradient(130deg,#d5c3a1,#b3a28e)',
    'linear-gradient(140deg,#667b88,#b5c0c4)',
    'linear-gradient(135deg,#c5d6d4,#90aea6)',
    'linear-gradient(150deg,#e8d8bb,#bcb2a7)',
    'linear-gradient(130deg,#2c3049,#666c8c)'
];
const captions = [
    'The sky shipped a gradient. No review required.',
    'Chai. The most stable part of the stack.',
    'A clean desk, if you crop with confidence.',
    'An ambitious portrait of a thumb.',
    'Local cat. Senior nap consultant.',
    'A screenshot worth at least one thousand sighs.'
];
const photos: Photo[] = Array.from({
    length: 36
}, (_, i) => ({
    id: i,
    kind: kinds[i % 6]!,
    bg: backgrounds[i % 6]!,
    caption: captions[i % 6]! + (i >= 6 ? ' Take ' + (Math.floor(i / 6) + 1) + '.' : ''),
    month: [
        'October',
        'September',
        'August'
    ][Math.floor(i / 12)]!,
    year: i < 24 ? 2026 : 2025
}));
const tab = ref<string>('Library');
const period = ref<string>('All');
const album = ref<string | null>(null);
const index = ref<number | null>(null);
const favourites = ref<number[]>([]);
const info = ref<boolean>(true);
const current = computed(() => index.value === null ? null : photos[index.value] ?? null);
const library = computed(() => {
    if (album.value === 'Favourites') return photos.filter(photo => favourites.value.includes(photo.id));
    const kind = album.value === 'Screenshots of bugs' ? 'error'
        : album.value === 'Blurry' ? 'thumb'
        : album.value === 'Food before eating' ? 'chai'
        : null;
    return kind ? photos.filter(photo => photo.kind === kind) : photos;
});
const groups = computed(() => period.value === 'Years' ? [{
        name: '2026',
        items: library.value.filter(p => p.year === 2026)
    }, {
        name: '2025',
        items: library.value.filter(p => p.year === 2025)
    }] : [
    'October',
    'September',
    'August'
].map(month => ({
    name: month,
    items: library.value.filter(p => p.month === month)
})));
const albums = [
    {
        name: 'Screenshots of bugs',
        count: String(photos.filter(photo => photo.kind === 'error').length),
        kind: 'error',
        bg: backgrounds[5]!
    },
    {
        name: 'Blurry',
        count: 'Emotionally sharp',
        kind: 'thumb',
        bg: backgrounds[3]!
    },
    {
        name: 'Food before eating',
        count: 'A brief window',
        kind: 'chai',
        bg: backgrounds[1]!
    },
    {
        name: 'Favourites',
        count: 'The good ones',
        kind: 'sunset',
        bg: backgrounds[0]!
    }
];
function favourite() {
    if (!current.value)
        return;
    const id = current.value.id;
    favourites.value = favourites.value.includes(id) ? favourites.value.filter(n => n !== id) : [...favourites.value, id];
}
const viewerPosition = computed(() => library.value.findIndex(photo => photo.id === index.value) + 1);
function navigate(delta: number) {
    if (index.value === null) return;
    const collection = library.value;
    if (!collection.length) {
        index.value = null;
        return;
    }
    const position = collection.findIndex(photo => photo.id === index.value);
    const next = (Math.max(0, position) + delta + collection.length) % collection.length;
    index.value = collection[next]?.id ?? null;
}
let swipeX: number | null = null;
onBeforeUnmount(() => {
    swipeX = null;
});
function swipeStart(event: PointerEvent) {
    if (event.button === 0)
        swipeX = event.clientX;
}
function swipeEnd(event: PointerEvent) {
    if (swipeX !== null && Math.abs(event.clientX - swipeX) > 45)
        navigate(event.clientX < swipeX ? 1 : -1);
    swipeX = null;
}
</script>

<template>
  <div class="app">
    <template v-if="current">
      <header class="viewer-head glass">
        <button class="icon" aria-label="Back to library" @click="index=null">
          <svg viewBox="0 0 24 24">
            <path :d="icons.back" />
          </svg>
        </button>
        <div>
          <h3>
            {{ current.month }}
            {{ current.year }}
          </h3>
          <p class="muted">An entirely generated memory</p>
        </div>
        <button class="icon" aria-label="Toggle caption" :aria-pressed="info" @click="info=!info">
          <AppGlyph name="info" />
        </button>
      </header>
      <main class="viewer">
        <div
          v-for="photo in [current]"
          :key="photo.id"
          class="full-photo"
          :style="{background:photo.bg}"
          @pointerdown="swipeStart"
          @pointerup="swipeEnd"
          @pointercancel="swipeX=null"
        >
          <svg class="photo-art" viewBox="0 0 200 200" aria-hidden="true">
            <g v-if="photo.kind==='sunset'">
              <circle cx="143" cy="67" r="31" fill="#ffdd9b" />
              <path d="M0 125 45 92l44 32 46-30 65 35v71H0Z" fill="#514967" />
              <path d="M0 145q50-20 100 1t100-2v56H0Z" fill="#293d58" />
              <path d="m112 163 48-1M105 175h57M122 186h29" stroke="#ffc581" opacity=".5" />
            </g>
            <g v-else-if="photo.kind==='chai'">
              <ellipse cx="100" cy="165" rx="65" ry="13" fill="#553b3033" />
              <path d="m63 66 12 95h50l12-95Z" fill="#ffffff65" stroke="#ffffffaa" stroke-width="3" />
              <path d="m70 95 8 60h44l8-60Z" fill="#a56c37" />
              <ellipse cx="100" cy="95" rx="30" ry="6" fill="#dcb37a" />
              <path d="M89 54q-12-12 0-25M110 54q-12-12 0-25" stroke="#ffffffaa" stroke-width="4" fill="none" />
              <path d="m79 111 4 30" stroke="#fff7" stroke-width="4" />
            </g>
            <g v-else-if="photo.kind==='desk'">
              <path d="M0 135h200v65H0Z" fill="#ab7959" />
              <rect x="30" y="35" width="136" height="96" rx="7" fill="#252b38" />
              <rect x="38" y="43" width="120" height="77" rx="2" fill="#172123" />
              <path d="M48 59h60M48 72h86M58 85h49M48 98h72" stroke="#67bf9e" stroke-width="4" />
              <path d="m30 131-14 24h164l-14-24Z" fill="#b8bec8" />
              <rect x="148" y="149" width="29" height="28" rx="4" fill="#e6dac1" />
              <path d="m13 172 22 3-4 12-22-3Z" fill="#f3da83" />
            </g>
            <g v-else-if="photo.kind==='thumb'">
              <path d="M0 138 42 86l49 52 29-35 80 47v50H0Z" fill="#698271" />
              <path d="M0 200V66C-5 10 75-16 104 30c30 53 32 120 45 170Z" fill="#dfac91" />
              <ellipse cx="65" cy="60" rx="31" ry="45" fill="#e7baa7" />
              <path d="m36 84 40 6" stroke="#c88e79" opacity=".3" stroke-width="8" />
            </g>
            <g v-else-if="photo.kind==='cat'">
              <ellipse cx="96" cy="157" rx="62" ry="12" fill="#0002" />
              <path d="M48 130q0-35 26-46L70 43l28 25 28-25 1 43q36 19 31 49c-4 43-111 48-110-5Z" fill="#606570" />
              <path d="M151 133q50-36 27-53" stroke="#606570" stroke-width="16" fill="none" />
              <ellipse cx="89" cy="103" rx="5" ry="7" fill="#dfe2a4" />
              <ellipse cx="117" cy="103" rx="5" ry="7" fill="#dfe2a4" />
              <path d="m99 117 5 4 5-4" stroke="#e9b6b8" fill="none" />
            </g>
            <g v-else>
              <rect x="14" y="29" width="172" height="142" rx="10" fill="#f8f8fb" />
              <path d="M14 54h172" stroke="#dddde3" />
              <circle cx="28" cy="42" r="4" fill="#ef7270" />
              <circle cx="40" cy="42" r="4" fill="#e9bd6b" />
              <circle cx="52" cy="42" r="4" fill="#83be8b" />
              <path d="m100 66 18 32H82Z" fill="#ffbe51" />
              <text x="100" y="116" text-anchor="middle" fill="#292733" font-size="10" font-weight="700">UNEXPECTED EXPECTATION</text>
              <text x="100" y="134" text-anchor="middle" fill="#888" font-size="8">It worked five minutes ago.</text>
              <rect x="71" y="145" width="58" height="16" rx="5" fill="#468ce8" />
              <text x="100" y="156" text-anchor="middle" fill="white" font-size="8">Deep breath</text>
            </g>
          </svg>
        </div>
        <div class="viewer-arrows">
          <button class="glass icon" aria-label="Previous photo" @click="navigate(-1)">
            <svg viewBox="0 0 24 24">
              <path :d="icons.back" />
            </svg>
          </button>
          <span>
            {{ viewerPosition || 1 }}
            of
            {{ library.length || 1 }}
          </span>
          <button class="glass icon" aria-label="Next photo" @click="navigate(1)">
            <svg viewBox="0 0 24 24" class="flip">
              <path :d="icons.back" />
            </svg>
          </button>
        </div>
        <p v-if="info" class="caption">{{ current.caption }}</p>
      </main>
      <footer class="viewer-footer glass">
        <button class="icon" aria-label="Open photo information" @click="info=!info">
          <svg viewBox="0 0 24 24">
            <path d="M12 16V3m-4 4 4-4 4 4M5 11v10h14V11" />
          </svg>
        </button>
        <button
          class="icon"
          :aria-label="favourites.includes(current.id)?'Remove favourite':'Favourite photo'"
          :aria-pressed="favourites.includes(current.id)"
          :class="{liked:favourites.includes(current.id)}"
          @click="favourite"
        >
          <svg viewBox="0 0 24 24">
            <path :d="icons.heart" />
          </svg>
        </button>
        <button class="icon" aria-label="Show photo caption" @click="info=!info">
          <AppGlyph name="info" />
        </button>
      </footer>
    </template>
    <template v-else>
      <header class="top">
        <div class="bar">
          <div>
            <h1>{{ album || tab }}</h1>
            <p>
              {{ album?'A carefully curated situation':'36 Photos · entirely imagined' }}
            </p>
          </div>
          <button v-if="album" class="icon glass" aria-label="Back to collections" @click="album=null">
            <svg viewBox="0 0 24 24">
              <path :d="icons.back" />
            </svg>
          </button>
          <span v-else class="profile">M</span>
        </div>
      </header>
      <main class="scroll library">
        <template v-if="tab==='Library'||album">
          <div v-if="!album" class="segments glass">
            <button
              v-for="item in ['Years','Months','All']"
              :key="item"
              :class="{selected:period===item}"
              @click="period=item"
            >
              {{ item }}
            </button>
          </div>
          <template v-if="period==='All'||album">
            <div class="photo-grid">
              <button
                v-for="photo in library"
                :key="photo.id"
                class="photo-tile"
                :style="{background:photo.bg}"
                :aria-label="photo.caption"
                @click="index=photo.id"
              >
                <svg class="photo-art" viewBox="0 0 200 200" aria-hidden="true">
                  <g v-if="photo.kind==='sunset'">
                    <circle cx="143" cy="67" r="31" fill="#ffdd9b" />
                    <path d="M0 125 45 92l44 32 46-30 65 35v71H0Z" fill="#514967" />
                    <path d="M0 145q50-20 100 1t100-2v56H0Z" fill="#293d58" />
                    <path d="m112 163 48-1M105 175h57M122 186h29" stroke="#ffc581" opacity=".5" />
                  </g>
                  <g v-else-if="photo.kind==='chai'">
                    <ellipse cx="100" cy="165" rx="65" ry="13" fill="#553b3033" />
                    <path d="m63 66 12 95h50l12-95Z" fill="#ffffff65" stroke="#ffffffaa" stroke-width="3" />
                    <path d="m70 95 8 60h44l8-60Z" fill="#a56c37" />
                    <ellipse cx="100" cy="95" rx="30" ry="6" fill="#dcb37a" />
                    <path d="M89 54q-12-12 0-25M110 54q-12-12 0-25" stroke="#ffffffaa" stroke-width="4" fill="none" />
                    <path d="m79 111 4 30" stroke="#fff7" stroke-width="4" />
                  </g>
                  <g v-else-if="photo.kind==='desk'">
                    <path d="M0 135h200v65H0Z" fill="#ab7959" />
                    <rect x="30" y="35" width="136" height="96" rx="7" fill="#252b38" />
                    <rect x="38" y="43" width="120" height="77" rx="2" fill="#172123" />
                    <path d="M48 59h60M48 72h86M58 85h49M48 98h72" stroke="#67bf9e" stroke-width="4" />
                    <path d="m30 131-14 24h164l-14-24Z" fill="#b8bec8" />
                    <rect x="148" y="149" width="29" height="28" rx="4" fill="#e6dac1" />
                    <path d="m13 172 22 3-4 12-22-3Z" fill="#f3da83" />
                  </g>
                  <g v-else-if="photo.kind==='thumb'">
                    <path d="M0 138 42 86l49 52 29-35 80 47v50H0Z" fill="#698271" />
                    <path d="M0 200V66C-5 10 75-16 104 30c30 53 32 120 45 170Z" fill="#dfac91" />
                    <ellipse cx="65" cy="60" rx="31" ry="45" fill="#e7baa7" />
                    <path d="m36 84 40 6" stroke="#c88e79" opacity=".3" stroke-width="8" />
                  </g>
                  <g v-else-if="photo.kind==='cat'">
                    <ellipse cx="96" cy="157" rx="62" ry="12" fill="#0002" />
                    <path d="M48 130q0-35 26-46L70 43l28 25 28-25 1 43q36 19 31 49c-4 43-111 48-110-5Z" fill="#606570" />
                    <path d="M151 133q50-36 27-53" stroke="#606570" stroke-width="16" fill="none" />
                    <ellipse cx="89" cy="103" rx="5" ry="7" fill="#dfe2a4" />
                    <ellipse cx="117" cy="103" rx="5" ry="7" fill="#dfe2a4" />
                    <path d="m99 117 5 4 5-4" stroke="#e9b6b8" fill="none" />
                  </g>
                  <g v-else>
                    <rect x="14" y="29" width="172" height="142" rx="10" fill="#f8f8fb" />
                    <path d="M14 54h172" stroke="#dddde3" />
                    <circle cx="28" cy="42" r="4" fill="#ef7270" />
                    <circle cx="40" cy="42" r="4" fill="#e9bd6b" />
                    <circle cx="52" cy="42" r="4" fill="#83be8b" />
                    <path d="m100 66 18 32H82Z" fill="#ffbe51" />
                    <text x="100" y="116" text-anchor="middle" fill="#292733" font-size="10" font-weight="700">UNEXPECTED EXPECTATION</text>
                    <text x="100" y="134" text-anchor="middle" fill="#888" font-size="8">It worked five minutes ago.</text>
                    <rect x="71" y="145" width="58" height="16" rx="5" fill="#468ce8" />
                    <text x="100" y="156" text-anchor="middle" fill="white" font-size="8">Deep breath</text>
                  </g>
                </svg>
                <svg v-if="favourites.includes(photo.id)" class="tile-heart" viewBox="0 0 24 24">
                  <path :d="icons.heart" />
                </svg>
              </button>
            </div>
          </template>
          <template v-else>
            <section v-for="group in groups.filter(g=>g.items.length)" :key="group.name" class="moment">
              <h2>{{ group.name }}</h2>
              <div class="moment-grid">
                <button
                  v-for="photo in group.items.slice(0,period==='Years'?1:3)"
                  :key="photo.id"
                  :style="{background:photo.bg}"
                  :aria-label="'Explore '+group.name"
                  @click="index=photo.id"
                >
                  <svg class="photo-art" viewBox="0 0 200 200" aria-hidden="true">
                    <g v-if="photo.kind==='sunset'">
                      <circle cx="143" cy="67" r="31" fill="#ffdd9b" />
                      <path d="M0 125 45 92l44 32 46-30 65 35v71H0Z" fill="#514967" />
                      <path d="M0 145q50-20 100 1t100-2v56H0Z" fill="#293d58" />
                      <path d="m112 163 48-1M105 175h57M122 186h29" stroke="#ffc581" opacity=".5" />
                    </g>
                    <g v-else-if="photo.kind==='chai'">
                      <ellipse cx="100" cy="165" rx="65" ry="13" fill="#553b3033" />
                      <path d="m63 66 12 95h50l12-95Z" fill="#ffffff65" stroke="#ffffffaa" stroke-width="3" />
                      <path d="m70 95 8 60h44l8-60Z" fill="#a56c37" />
                      <ellipse cx="100" cy="95" rx="30" ry="6" fill="#dcb37a" />
                      <path d="M89 54q-12-12 0-25M110 54q-12-12 0-25" stroke="#ffffffaa" stroke-width="4" fill="none" />
                      <path d="m79 111 4 30" stroke="#fff7" stroke-width="4" />
                    </g>
                    <g v-else-if="photo.kind==='desk'">
                      <path d="M0 135h200v65H0Z" fill="#ab7959" />
                      <rect x="30" y="35" width="136" height="96" rx="7" fill="#252b38" />
                      <rect x="38" y="43" width="120" height="77" rx="2" fill="#172123" />
                      <path d="M48 59h60M48 72h86M58 85h49M48 98h72" stroke="#67bf9e" stroke-width="4" />
                      <path d="m30 131-14 24h164l-14-24Z" fill="#b8bec8" />
                      <rect x="148" y="149" width="29" height="28" rx="4" fill="#e6dac1" />
                      <path d="m13 172 22 3-4 12-22-3Z" fill="#f3da83" />
                    </g>
                    <g v-else-if="photo.kind==='thumb'">
                      <path d="M0 138 42 86l49 52 29-35 80 47v50H0Z" fill="#698271" />
                      <path d="M0 200V66C-5 10 75-16 104 30c30 53 32 120 45 170Z" fill="#dfac91" />
                      <ellipse cx="65" cy="60" rx="31" ry="45" fill="#e7baa7" />
                      <path d="m36 84 40 6" stroke="#c88e79" opacity=".3" stroke-width="8" />
                    </g>
                    <g v-else-if="photo.kind==='cat'">
                      <ellipse cx="96" cy="157" rx="62" ry="12" fill="#0002" />
                      <path d="M48 130q0-35 26-46L70 43l28 25 28-25 1 43q36 19 31 49c-4 43-111 48-110-5Z" fill="#606570" />
                      <path d="M151 133q50-36 27-53" stroke="#606570" stroke-width="16" fill="none" />
                      <ellipse cx="89" cy="103" rx="5" ry="7" fill="#dfe2a4" />
                      <ellipse cx="117" cy="103" rx="5" ry="7" fill="#dfe2a4" />
                      <path d="m99 117 5 4 5-4" stroke="#e9b6b8" fill="none" />
                    </g>
                    <g v-else>
                      <rect x="14" y="29" width="172" height="142" rx="10" fill="#f8f8fb" />
                      <path d="M14 54h172" stroke="#dddde3" />
                      <circle cx="28" cy="42" r="4" fill="#ef7270" />
                      <circle cx="40" cy="42" r="4" fill="#e9bd6b" />
                      <circle cx="52" cy="42" r="4" fill="#83be8b" />
                      <path d="m100 66 18 32H82Z" fill="#ffbe51" />
                      <text x="100" y="116" text-anchor="middle" fill="#292733" font-size="10" font-weight="700">UNEXPECTED EXPECTATION</text>
                      <text x="100" y="134" text-anchor="middle" fill="#888" font-size="8">It worked five minutes ago.</text>
                      <rect x="71" y="145" width="58" height="16" rx="5" fill="#468ce8" />
                      <text x="100" y="156" text-anchor="middle" fill="white" font-size="8">Deep breath</text>
                    </g>
                  </svg>
                  <span>
                    {{ period==='Years'?'Chai, code and small skies':group.items.length+' memories' }}
                  </span>
                </button>
              </div>
            </section>
          </template>
          <p v-if="!library.length" class="empty">Tap a heart in the viewer to save a favourite.</p>
          <p class="library-note">No cloud. No camera roll anxiety.</p>
        </template>
        <template v-else>
          <h2 class="album-title">Your albums</h2>
          <div class="albums">
            <button v-for="photo in albums" :key="photo.name" class="album" @click="album=photo.name">
              <div class="album-cover" :style="{background:photo.bg}">
                <svg class="photo-art" viewBox="0 0 200 200" aria-hidden="true">
                  <g v-if="photo.kind==='sunset'">
                    <circle cx="143" cy="67" r="31" fill="#ffdd9b" />
                    <path d="M0 125 45 92l44 32 46-30 65 35v71H0Z" fill="#514967" />
                    <path d="M0 145q50-20 100 1t100-2v56H0Z" fill="#293d58" />
                    <path d="m112 163 48-1M105 175h57M122 186h29" stroke="#ffc581" opacity=".5" />
                  </g>
                  <g v-else-if="photo.kind==='chai'">
                    <ellipse cx="100" cy="165" rx="65" ry="13" fill="#553b3033" />
                    <path d="m63 66 12 95h50l12-95Z" fill="#ffffff65" stroke="#ffffffaa" stroke-width="3" />
                    <path d="m70 95 8 60h44l8-60Z" fill="#a56c37" />
                    <ellipse cx="100" cy="95" rx="30" ry="6" fill="#dcb37a" />
                    <path d="M89 54q-12-12 0-25M110 54q-12-12 0-25" stroke="#ffffffaa" stroke-width="4" fill="none" />
                    <path d="m79 111 4 30" stroke="#fff7" stroke-width="4" />
                  </g>
                  <g v-else-if="photo.kind==='desk'">
                    <path d="M0 135h200v65H0Z" fill="#ab7959" />
                    <rect x="30" y="35" width="136" height="96" rx="7" fill="#252b38" />
                    <rect x="38" y="43" width="120" height="77" rx="2" fill="#172123" />
                    <path d="M48 59h60M48 72h86M58 85h49M48 98h72" stroke="#67bf9e" stroke-width="4" />
                    <path d="m30 131-14 24h164l-14-24Z" fill="#b8bec8" />
                    <rect x="148" y="149" width="29" height="28" rx="4" fill="#e6dac1" />
                    <path d="m13 172 22 3-4 12-22-3Z" fill="#f3da83" />
                  </g>
                  <g v-else-if="photo.kind==='thumb'">
                    <path d="M0 138 42 86l49 52 29-35 80 47v50H0Z" fill="#698271" />
                    <path d="M0 200V66C-5 10 75-16 104 30c30 53 32 120 45 170Z" fill="#dfac91" />
                    <ellipse cx="65" cy="60" rx="31" ry="45" fill="#e7baa7" />
                    <path d="m36 84 40 6" stroke="#c88e79" opacity=".3" stroke-width="8" />
                  </g>
                  <g v-else-if="photo.kind==='cat'">
                    <ellipse cx="96" cy="157" rx="62" ry="12" fill="#0002" />
                    <path d="M48 130q0-35 26-46L70 43l28 25 28-25 1 43q36 19 31 49c-4 43-111 48-110-5Z" fill="#606570" />
                    <path d="M151 133q50-36 27-53" stroke="#606570" stroke-width="16" fill="none" />
                    <ellipse cx="89" cy="103" rx="5" ry="7" fill="#dfe2a4" />
                    <ellipse cx="117" cy="103" rx="5" ry="7" fill="#dfe2a4" />
                    <path d="m99 117 5 4 5-4" stroke="#e9b6b8" fill="none" />
                  </g>
                  <g v-else>
                    <rect x="14" y="29" width="172" height="142" rx="10" fill="#f8f8fb" />
                    <path d="M14 54h172" stroke="#dddde3" />
                    <circle cx="28" cy="42" r="4" fill="#ef7270" />
                    <circle cx="40" cy="42" r="4" fill="#e9bd6b" />
                    <circle cx="52" cy="42" r="4" fill="#83be8b" />
                    <path d="m100 66 18 32H82Z" fill="#ffbe51" />
                    <text x="100" y="116" text-anchor="middle" fill="#292733" font-size="10" font-weight="700">UNEXPECTED EXPECTATION</text>
                    <text x="100" y="134" text-anchor="middle" fill="#888" font-size="8">It worked five minutes ago.</text>
                    <rect x="71" y="145" width="58" height="16" rx="5" fill="#468ce8" />
                    <text x="100" y="156" text-anchor="middle" fill="white" font-size="8">Deep breath</text>
                  </g>
                </svg>
              </div>
              <h3>{{ photo.name }}</h3>
              <p>{{ photo.count }}</p>
            </button>
          </div>
          <h2 class="album-title">A little perspective</h2>
          <button class="memory-card" @click="album=null;tab='Library';period='Months'">
            <span>THE SMALL THINGS</span>
            <h2>Chai &amp; quiet skies</h2>
            <p>A collection with no action items.</p>
            <svg viewBox="0 0 24 24">
              <path :d="icons.play" />
            </svg>
          </button>
        </template>
      </main>
      <nav class="tabs">
        <button :class="{active:tab==='Library'}" @click="tab='Library';album=null">
          <svg viewBox="0 0 24 24">
            <path :d="icons.grid" />
          </svg>
          Library
        </button>
        <button :class="{active:tab==='Collections'}" @click="tab='Collections';album=null">
          <svg viewBox="0 0 24 24">
            <path d="M3 5h7l2 3h9v13H3ZM3 12h18" />
          </svg>
          Collections
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
  color: #171719;
}

.top {
  padding-bottom: 18px;
}

.top p {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 6px;
}

.profile {
  background: linear-gradient(140deg,#b4c7dd,#728caa);
  width: 45px;
  height: 45px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 600;
}

.library {
  flex: 1;
}

.segments {
  display: flex;
  border-radius: 28px;
  background: #f2f2f4;
  margin: 4px 65px 20px;
  padding: 3px;
  position: sticky;
  top: 4px;
  z-index: 2;
  box-shadow: 0 4px 12px #0000000c;
}

.segments button {
  flex: 1;
  font-size: 14px;
  border-radius: 23px;
}

.segments .selected {
  background: #fff;
  box-shadow: 0 1px 4px #0002;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 2px;
}

.photo-tile {
  height: 146px;
  min-width: 0;
  padding: 0;
  border-radius: 0;
  position: relative;
  overflow: hidden;
}

.photo-art {
  width: 100%;
  height: 100%;
  stroke: none;
  display: block;
}

.tile-heart {
  width: 15px;
  height: 15px;
  position: absolute;
  left: 8px;
  bottom: 8px;
  fill: #fff;
  stroke: #fff;
  filter: drop-shadow(0 1px 2px #0005);
}

.library-note {
  text-align: center;
  font-size: 12px;
  color: #aaa;
  padding: 25px;
}

.moment {
  margin: 20px;
}

.moment h2 {
  margin: 12px 0;
}

.moment-grid {
  display: flex;
  gap: 3px;
  border-radius: 22px;
  overflow: hidden;
}

.moment-grid button {
  position: relative;
  height: 220px;
  padding: 0;
  min-width: 0;
  flex: 1;
}

.moment-grid button span {
  position: absolute;
  left: 14px;
  bottom: 14px;
  color: #fff;
  font-size: 12px;
  text-shadow: 0 1px 5px #000;
  max-width: 80%;
  text-align: left;
}

.album-title {
  padding: 20px;
}

.albums {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22px 16px;
  padding: 0 20px;
}

.album {
  padding: 0;
  text-align: left;
  min-width: 0;
}

.album-cover {
  height: 181px;
  overflow: hidden;
  border-radius: 18px;
}

.album h3 {
  font-size: 15px;
  margin-top: 9px;
}

.album p {
  font-size: 13px;
  color: #888;
  margin-top: 4px;
}

.memory-card {
  width: calc(100% - 40px);
  margin: 0 20px 28px;
  padding: 28px;
  border-radius: 25px;
  text-align: left;
  color: #fff;
  background: linear-gradient(140deg,#43435b,#b77f73 70%,#daa982);
}

.memory-card>span {
  font-size: 12px;
  letter-spacing: .14em;
}

.memory-card h2 {
  font-size: 28px;
  margin: 70px 0 8px;
}

.memory-card p {
  font-size: 14px;
}

.memory-card svg {
  margin-top: 20px;
}

.viewer-head {
  padding: var(--safe-top,62px) 14px 16px;
  background: #fffffff0;
  display: flex;
  gap: 10px;
  align-items: center;
}

.viewer-head>div {
  flex: 1;
  text-align: center;
}

.viewer-head p {
  font-size: 12px;
  margin-top: 4px;
}

.viewer {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #f2f2f5;
}

.full-photo {
  width: 100%;
  height: 440px;
  touch-action: pan-y;
}

.viewer-arrows {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  color: #75757a;
}

.viewer-arrows .icon {
  background: #ffffffb3;
}

.viewer-arrows span {
  font-size: 12px;
}

.flip {
  transform: rotate(180deg);
}

.caption {
  text-align: center;
  font-size: 16px;
  line-height: 1.5;
  min-height: 66px;
  padding: 0 35px;
  color: #555;
}

.viewer-footer {
  display: flex;
  justify-content: space-around;
  padding: 10px 20px var(--safe-bottom,34px);
  color: #007aff;
  background: #ffffffe8;
}

.liked svg {
  fill: #ff375f;
  stroke: #ff375f;
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

.top, .segments, .tabs, .viewer-head, .viewer-footer, .viewer-arrows {
  flex-shrink: 0;
}

.photo-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.photo-tile {
  height: auto;
  aspect-ratio: 1;
}

.album-cover {
  height: auto;
  aspect-ratio: 1;
}

.viewer {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.full-photo {
  height: auto;
  min-height: 0;
  flex: 1 1 auto;
  max-height: 100cqw;
  aspect-ratio: 1;
}

.caption {
  min-height: 0;
  flex-shrink: 0;
  padding: 12px 24px;
  line-height: 1.45;
}

.viewer-arrows {
  padding: 12px 20px;
}

.top p, .muted, .viewer-arrows span {
  color: #64646b;
}

@container (min-width: 600px) {
  .photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  .albums {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

.caption {
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
  .caption {
    animation: none;
  }
}
</style>
