<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
type Place = {
    id: number;
    name: string;
    category: string;
    rating: string;
    distance: string;
    x: number;
    y: number;
    icon: string;
};
const places: Place[] = [
    {
        id: 1,
        name: 'The Optimistic Chai Stall',
        category: 'Tea & perspective',
        rating: '4.9',
        distance: '350 m',
        x: 302,
        y: 220,
        icon: '☕'
    },
    {
        id: 2,
        name: 'One More Quick Change Café',
        category: 'Coffee · open until the build passes',
        rating: '4.6',
        distance: '800 m',
        x: 105,
        y: 180,
        icon: '♧'
    },
    {
        id: 3,
        name: 'Deadlock Junction',
        category: 'A scenic place to wait',
        rating: '3.2',
        distance: '1.2 km',
        x: 330,
        y: 450,
        icon: '↗'
    },
    {
        id: 4,
        name: 'Cache Garden',
        category: 'Park · clear your head',
        rating: '4.8',
        distance: '600 m',
        x: 86,
        y: 400,
        icon: '❋'
    },
    {
        id: 5,
        name: 'Rollback Bakery',
        category: 'Fresh starts & warm bread',
        rating: '4.7',
        distance: '950 m',
        x: 330,
        y: 110,
        icon: '◇'
    }
];
const placeGlyphs: Record<string, string> = {
    '☕': 'cup',
    '♧': 'cup',
    '↗': 'turn',
    '❋': 'leaf',
    '◇': 'food'
};
const query = ref<string>('');
const selected = ref<Place | null>(null);
const routing = ref<boolean>(false);
const navigating = ref<boolean>(false);
const expanded = ref<boolean>(false);
const zoom = ref<number>(1);
const pan = ref<{
    x: number;
    y: number;
}>({
    x: 0,
    y: 0
});
const filtered = computed(() => places.filter(p => (p.name + ' ' + p.category).toLowerCase().includes(query.value.toLowerCase())));
const transform = computed(() => 'translate(' + pan.value.x + ' ' + pan.value.y + ') translate(220 330) scale(' + zoom.value + ') translate(-220 -330)');
const route = computed(() => selected.value ? '212,330 250,330 250,' + selected.value.y + ' ' + selected.value.x + ',' + selected.value.y : '');
let drag: {
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
    scale: number;
} | null = null;
function start(event: PointerEvent) {
    if (event.button !== 0)
        return;
    const target = event.currentTarget as SVGSVGElement;
    const matrix = target.getScreenCTM();
    if (!matrix || matrix.a === 0)
        return;
    drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        panX: pan.value.x,
        panY: pan.value.y,
        scale: 1 / matrix.a
    };
    target.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId)
        return;
    pan.value = {
        x: Math.max(-350, Math.min(350, drag.panX + (event.clientX - drag.x) * drag.scale)),
        y: Math.max(-400, Math.min(400, drag.panY + (event.clientY - drag.y) * drag.scale))
    };
}
function end() {
    drag = null;
}
function locate() {
    pan.value = {
        x: 0,
        y: 0
    };
    zoom.value = 1;
}
function select(place: Place) {
    selected.value = place;
    expanded.value = false;
    query.value = '';
    locate();
    routing.value = false;
    navigating.value = false;
}
function directions() {
    routing.value = true;
    expanded.value = false;
    locate();
}
function close() {
    selected.value = null;
    routing.value = false;
    navigating.value = false;
}
onBeforeUnmount(() => {
    drag = null;
});
const blocks = Array.from({
    length: 36
}, (_, i) => ({
    x: (i % 6) * 90 - 36,
    y: Math.floor(i / 6) * 100 - 20,
    w: 60,
    h: 66
}));
</script>

<template>
  <div class="app">
    <svg
      class="map"
      viewBox="0 0 440 956"
      preserveAspectRatio="xMidYMin slice"
      aria-label="Fictional Pocket District map. Drag to pan."
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @lostpointercapture="end"
    >
      <g :transform="transform">
        <rect x="-500" y="-600" width="1500" height="2100" fill="#f4f0e9" />
        <g fill="#e5dfd6" stroke="#d4cec2" stroke-width=".6">
          <rect
            v-for="(block,i) in blocks"
            :key="i"
            :x="block.x"
            :y="block.y"
            :width="block.w"
            :height="block.h"
            rx="4"
           />
        </g>
        <path d="M-50 345q100-30 183 20l-6 145H-30Z" fill="#c4dcab" />
        <path d="M300-50q80 90 32 179t109 139l55-39V-50Z" fill="#acd5e5" stroke="#91c5dc" stroke-width="3" />
        <path d="M325 0q-17 80 27 107t10 75" stroke="#dcecf2" stroke-width="7" fill="none" />
        <g fill="none" stroke-linecap="round">
          <path
            d="M-300 130H900M-300 230H900M-300 330H900M-300 430H900M70-300V1400M160-300V1400M250-300V1400M340-300V1400"
            stroke="#d3cfc9"
            stroke-width="19"
           />
          <path
            d="M-300 130H900M-300 230H900M-300 330H900M-300 430H900M70-300V1400M160-300V1400M250-300V1400M340-300V1400"
            stroke="#fff"
            stroke-width="15"
           />
          <path d="M-300 560Q30 515 125 520t175-37 600 150" stroke="#e5c386" stroke-width="32" />
          <path d="M-300 560Q30 515 125 520t175-37 600 150" stroke="#ffe3a3" stroke-width="26" />
        </g>
        <g class="map-labels">
          <text x="20" y="315">Commit Avenue</text>
          <text x="263" y="280" transform="rotate(-90 263 280)">Dependency Road</text>
          <text x="112" y="121">Review Street</text>
          <text x="7" y="535">Eventually Expressway</text>
          <text x="30" y="383" class="park-label">CACHE GARDEN</text>
          <text x="376" y="210" transform="rotate(-60 376 210)" class="lake-label">Promise Lake</text>
          <text x="160" y="80" class="district-label">POCKET DISTRICT</text>
        </g>
        <g v-for="place in places" :key="place.id">
          <circle
            :cx="place.x"
            :cy="place.y"
            r="13"
            :fill="place.category.startsWith('Park')?'#63a761':'#ca9866'"
            stroke="white"
            stroke-width="3"
           />
          <path
            :d="icons[placeGlyphs[place.icon] ?? 'pin']"
            :transform="'translate(' + (place.x - 7) + ' ' + (place.y - 7) + ') scale(.58)'"
            fill="none"
            stroke="white"
            stroke-width="2"
           />
        </g>
        <polyline
          v-if="routing"
          :points="route"
          fill="none"
          stroke="#fff"
          stroke-width="13"
          stroke-linecap="round"
          stroke-linejoin="round"
         />
        <polyline
          v-if="routing"
          :points="route"
          fill="none"
          stroke="#007aff"
          stroke-width="8"
          stroke-linecap="round"
          stroke-linejoin="round"
         />
        <circle
          v-if="routing && selected"
          :cx="selected.x"
          :cy="selected.y"
          r="9"
          fill="#fff"
          stroke="#007aff"
          stroke-width="4"
         />
        <circle cx="212" cy="330" r="27" fill="#007aff" opacity=".1" />
        <circle cx="212" cy="330" r="11" fill="#007aff" stroke="#fff" stroke-width="4" />
      </g>
    </svg>
    <header class="map-top">
      <span class="district glass">
        Pocket District
        <small>Fictional map</small>
      </span>
      <div class="map-controls glass">
        <button aria-label="Zoom in" :disabled="zoom>=2" @click="zoom=Math.min(2,zoom+.2)">
          <svg viewBox="0 0 24 24">
            <path :d="icons.plus" />
          </svg>
        </button>
        <button aria-label="Zoom out" :disabled="zoom<=.6" @click="zoom=Math.max(.6,zoom-.2)">
          <svg viewBox="0 0 24 24">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button aria-label="Recenter on location" @click="locate">
          <svg viewBox="0 0 24 24">
            <path d="m3 10 18-7-7 18-3-8Z" />
          </svg>
        </button>
      </div>
    </header>
    <div v-if="navigating && selected" class="turn-banner glass">
      <svg viewBox="0 0 24 24">
        <path d="M12 21V7h8m-4-4 4 4-4 4" />
      </svg>
      <div>
        <h2>Continue optimistically</h2>
        <p>Next turn: Dependency Road</p>
      </div>
    </div>
    <section class="bottom-sheet glass" :class="{expanded}">
      <div class="handle-row">
        <button :aria-label="expanded?'Collapse places':'Expand places'" @click="expanded=!expanded">
          <span />
        </button>
      </div>
      <div class="sheet-content scroll">
        <template v-if="selected">
          <div class="bar">
            <div>
              <span class="category">{{ selected.category }}</span>
              <h2>{{ selected.name }}</h2>
              <p class="rating">
                ★
                {{ selected.rating }}
                <span>
                  ·
                  {{ selected.distance }}
                  away
                </span>
              </p>
            </div>
            <button class="icon close" aria-label="Close place" @click="close">
              <AppGlyph name="close" />
            </button>
          </div>
          <template v-if="routing">
            <div class="route-summary">
              <svg viewBox="0 0 24 24">
                <path d="m5 7 2-4h10l2 4 2 3v8H3v-8ZM3 10h18M6 14h2M16 14h2M5 18v3M19 18v3" />
              </svg>
              <div>
                <h2>
                  ETA 12 min
                  <small>(in theory)</small>
                </h2>
                <p>1.2 km · Traffic has creative differences</p>
              </div>
            </div>
            <div class="route-detail">
              <span>Fastest route</span>
              <span>One chai stop optional</span>
            </div>
            <button class="primary" :class="{end:navigating}" @click="navigating ? close() : navigating=true">{{ navigating?'End route':'Start simulated route' }}</button>
          </template>
          <template v-else>
            <p class="place-description">
              A small landmark in an entirely made-up neighbourhood. Come for the
              {{ selected.id===4?'quiet':'chai' }}
              , stay because the next signal is red.
            </p>
            <button class="primary" @click="directions">
              <svg viewBox="0 0 24 24">
                <path d="m3 12 9-9 9 9-9 9ZM9 16v-6h7m-3-3 3 3-3 3" />
              </svg>
              Directions · 12 min
            </button>
          </template>
        </template>
        <template v-else>
          <input
            v-model="query"
            class="search"
            aria-label="Search fictional places"
            placeholder="Search Maps"
            @focus="expanded=true"
           />
          <div v-if="!query" class="quick-places">
            <button @click="select(places[0]!)">
              <span>
                <AppGlyph name="cup" />
              </span>
              Chai
            </button>
            <button @click="select(places[3]!)">
              <span>
                <AppGlyph name="leaf" />
              </span>
              Parks
            </button>
            <button @click="select(places[4]!)">
              <span>
                <AppGlyph name="food" />
              </span>
              Food
            </button>
          </div>
          <div class="bar suggested-heading">
            <h3>{{ query?'Search results':'Nearby, in imagination' }}</h3>
            <span class="muted">Pocket District</span>
          </div>
          <button v-for="place in filtered" :key="place.id" class="place-row" @click="select(place)">
            <span class="place-icon">
              <AppGlyph :name="placeGlyphs[place.icon] ?? 'pin'" />
            </span>
            <div>
              <h3>{{ place.name }}</h3>
              <p>{{ place.category }}</p>
            </div>
            <small>
              ★
              {{ place.rating }}
              <br />
              {{ place.distance }}
            </small>
          </button>
          <p v-if="!filtered.length" class="empty">No places found. Try “chai”.</p>
        </template>
        <p class="footnote">Illustrated simulation · not for real navigation</p>
      </div>
    </section>
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
  background: #f4f0e9;
  color: #202024;
}

.map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  stroke: none;
  touch-action: none;
  cursor: grab;
}

.map:active {
  cursor: grabbing;
}

.map-labels text {
  font-size: 12px;
  fill: #9b958a;
  paint-order: stroke;
  stroke: #f4f0e9;
  stroke-width: 2px;
}

.map-labels .park-label {
  font-size: 12px;
  fill: #68894f;
  stroke: #c4dcab;
}

.map-labels .lake-label {
  fill: #598fa8;
  stroke: #acd5e5;
  font-size: 12px;
}

.map-labels .district-label {
  font-size: 12px;
  letter-spacing: 2px;
  fill: #8a857c;
}

.map-top {
  position: relative;
  padding: calc(var(--safe-top,62px) + 16px) 16px 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  pointer-events: none;
}

.district {
  border-radius: 22px;
  padding: 12px 16px;
  background: #ffffffc9;
  box-shadow: 0 4px 12px #0000000c;
  font-size: 14px;
  font-weight: 600;
}

.district small {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  font-weight: 400;
}

.map-controls {
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  border-radius: 24px;
  background: #ffffffd9;
  box-shadow: 0 5px 15px #0001;
  padding: 3px;
  color: #007aff;
}

.map-controls button {
  display: grid;
  place-items: center;
  border-bottom: 1px solid #00000008;
}

.map-controls button:last-child {
  border: 0;
}

.turn-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 15px;
  background: #fffdf3d9;
  border-radius: 22px;
  margin: 25px 16px 0;
  padding: 20px;
  box-shadow: 0 5px 20px #0001;
}

.turn-banner svg {
  color: #007aff;
  width: 35px;
  height: 35px;
  stroke-width: 2.5;
}

.turn-banner h2 {
  font-size: 20px;
}

.turn-banner p {
  font-size: 13px;
  color: #888;
  margin-top: 7px;
}

.bottom-sheet {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 420px;
  display: flex;
  flex-direction: column;
  background: #f9f9fbdf;
  border-radius: 30px 30px 0 0;
  box-shadow: 0 -8px 35px #00000012;
  padding-bottom: var(--safe-bottom,34px);
  transition: transform 250ms ease, opacity 250ms ease;
}

.bottom-sheet.expanded {
  height: 630px;
}

.handle-row {
  display: flex;
  justify-content: center;
  height: 44px;
  flex-shrink: 0;
}

.handle-row button {
  width: 100px;
  min-height: 44px;
  padding: 10px;
}

.handle-row span {
  display: block;
  width: 36px;
  height: 5px;
  border-radius: 4px;
  background: #b4b4ba;
  margin: auto;
}

.sheet-content {
  padding: 0 20px;
  flex: 1;
}

.search {
  background: #e5e5eaaf;
  font-size: 17px;
  height: 50px;
}

.quick-places {
  display: flex;
  justify-content: space-around;
  gap: 16px;
  margin: 14px 0 16px;
}

.quick-places button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  flex: 1;
  min-height: 62px;
}

.quick-places button>span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  background: #ffdfad;
  border: 1px solid #ffffff90;
  border-radius: 50%;
  font-size: 23px;
  color: #b57f3c;
}

.suggested-heading {
  margin: 15px 0;
}

.suggested-heading h3 {
  font-size: 15px;
}

.suggested-heading .muted {
  font-size: 12px;
}

.place-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 76px;
  width: 100%;
  text-align: left;
  padding: 12px 0;
  border-bottom: 1px solid #0000000c;
}

.place-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 13px;
  background: #f1e3d2;
  color: #b38753;
  font-size: 22px;
  flex-shrink: 0;
}

.place-row>div {
  flex: 1;
}

.place-row h3 {
  font-size: 15px;
}

.place-row p {
  font-size: 12px;
  color: #888;
  margin-top: 5px;
}

.place-row>small {
  font-size: 12px;
  line-height: 1.7;
  color: #a18d69;
  text-align: right;
}

.footnote {
  font-size: 12px;
  color: #aaa;
  text-align: center;
  margin: 20px 0 12px;
}

.category {
  font-size: 12px;
  color: #8e8e93;
}

.sheet-content>.bar h2 {
  font-size: 23px;
  line-height: 1.2;
  max-width: 320px;
  margin-top: 5px;
}

.close {
  background: #e7e7ea;
  font-size: 18px;
  align-self: flex-start;
  flex-shrink: 0;
}

.rating {
  font-size: 13px;
  color: #b08741;
  margin-top: 8px;
}

.rating span {
  color: #888;
}

.place-description {
  font-size: 15px;
  line-height: 1.6;
  color: #777;
  margin: 22px 0;
}

.primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #007aff;
  color: #fff;
  border-radius: 16px;
  width: 100%;
  height: 56px;
  font-size: 17px;
  font-weight: 600;
}

.primary.end {
  background: #ff453a;
}

.route-summary {
  display: flex;
  gap: 16px;
  align-items: center;
  margin: 22px 0;
  background: #fff9;
  border-radius: 16px;
  padding: 14px;
}

.route-summary>svg {
  color: #007aff;
  width: 30px;
  height: 30px;
}

.route-summary h2 {
  font-size: 20px;
}

.route-summary h2 small {
  font-size: 13px;
  font-weight: 400;
  color: #888;
}

.route-summary p {
  font-size: 12px;
  color: #888;
  margin-top: 6px;
}

.route-detail {
  display: flex;
  justify-content: space-between;
  color: #888;
  font-size: 12px;
  margin: 15px 0 24px;
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

.map-controls {
  position: absolute;
  right: 16px;
  top: calc(var(--safe-top,62px) + 16px);
}

.bottom-sheet {
  height: 46%;
  max-height: calc(100% - var(--safe-top,62px) - 12px);
}

.bottom-sheet.expanded {
  height: 76%;
}

.sheet-content > .bar {
  align-items: flex-start;
}

.sheet-content > .bar > div {
  min-width: 0;
}

.place-row > div {
  min-width: 0;
  flex: 1;
}

.place-row h3, .sheet-content h2 {
  overflow-wrap: anywhere;
}

.place-row > small {
  flex: 0 0 auto;
  color: #76623f;
}

.place-row p, .category, .footnote, .suggested-heading .muted {
  color: #64646b;
}

.turn-banner {
  margin-top: 12px;
  padding: 14px;
}

.turn-banner > div {
  min-width: 0;
}

.turn-banner h2 {
  font-size: 18px;
}

@container (max-height: 700px) {
  .place-description {
    margin-block: 16px;
  }
  .sheet-content {
    padding-inline: 16px;
  }
  .map-top {
    padding-top: calc(var(--safe-top,62px) + 8px);
  }
}

.map-labels text {
  font-size: 15px;
}

.map-labels .park-label, .map-labels .district-label {
  font-size: 14px;
}

.route-summary {
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
  .route-summary {
    animation: none;
  }
}
</style>
