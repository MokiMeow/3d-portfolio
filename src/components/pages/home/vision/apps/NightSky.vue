<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { stars, type SkyObject } from './nightsky/catalog';
import { cities, planets } from './nightsky/astronomy';
import { Planetarium, type SkyState } from './nightsky/sky';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const host = ref<HTMLElement>();
const query = ref('');
const city = ref(0);
const base = ref(vision.now.value.getTime());
const offset = ref(0);
const playing = ref(false);
const followNow = ref(true);
const lines = ref(true);
const labels = ref(true);
const ground = ref(true);
const showPlanets = ref(true);
const selected = ref<SkyObject>();
const error = ref('');
const searchOpen = ref(false);
let previousFocus: HTMLElement | undefined;
let sky: Planetarium | undefined;
const formatters = cities.map(item => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: item.zone, timeZoneName: 'short' }));
const time = computed(() => base.value + offset.value * 3600000);
const place = computed(() => cities[city.value] ?? cities[0]);
const timestamp = computed(() => (formatters[city.value] ?? formatters[0]!).format(time.value));
const results = computed(() => {
  const term = query.value.trim().toLowerCase();
  const all = [...planets(time.value), ...stars];
  return term ? all.filter(item => (item.name + ' ' + item.constellation).toLowerCase().includes(term)).slice(0,7) : all.filter(item => ['Moon','Venus','Saturn','Sirius','Vega','Polaris'].includes(item.name));
});
const distance = computed(() => {
  const object = selected.value;
  if (!object) return '';
  return object.planet ? object.distance.toExponential(2) + ' light years' : '≈ ' + object.distance.toLocaleString() + ' light years';
});
const fact = computed(() => selected.value?.fact ?? (selected.value ? 'The light arriving tonight has travelled for about ' + selected.value.distance.toLocaleString() + ' years. Some things are worth the wait.' : ''));
const state = (): SkyState => ({ time: time.value + unreportedTime, city: city.value, lines: lines.value, labels: labels.value, ground: ground.value, planets: showPlanets.value, playing: playing.value });
function choose(object: SkyObject, fly = true): void {
  if (document.activeElement instanceof HTMLElement) previousFocus = document.activeElement;
  selected.value = object; searchOpen.value = false; query.value = '';
  if (object.planet) showPlanets.value = true;
  if (fly && sky?.fly(object)) { ground.value = false; vision.toast('Below the horizon. Ground hidden for your cosmic detour.'); }
}
function closeCard(): void { selected.value = undefined; previousFocus?.focus(); }
function now(): void { unreportedTime = 0; followNow.value = true; playing.value = false; base.value = vision.now.value.getTime(); offset.value = 0; }
function advance(milliseconds: number): void {
  // Four UI updates per real second at 1 hour/second; the sphere still rotates every rendered frame.
  internalAdvance = true;
  unreportedTime += milliseconds;
  if (unreportedTime >= 900000) { base.value += unreportedTime; unreportedTime = 0; }
  internalAdvance = false;
}
let internalAdvance = false;
let unreportedTime = 0;
watch([city,offset,playing,lines,labels,ground,showPlanets], () => sky?.set(state()), { flush: 'sync' });
watch(base, () => { if (!internalAdvance) sky?.set(state()); }, { flush: 'sync' });
watch(time, value => { if (selected.value?.planet) selected.value = planets(value).find(item => item.name === selected.value?.name); });
watch(playing, value => {
  if (value) followNow.value = false;
  else if (unreportedTime > 0) { const pending = unreportedTime; unreportedTime = 0; base.value += pending; }
}, { flush: 'sync' });
watch(() => vision.now.value.getTime(), () => { if (followNow.value && !playing.value) { unreportedTime = 0; base.value = vision.now.value.getTime(); } });
onMounted(() => {
  if (!host.value) return;
  try { sky = new Planetarium(host.value, !!props.compact, state(), object => choose(object,false), advance); }
  catch { error.value = 'The sky needs WebGL to shine here. You can still explore the object atlas below.'; }
});
watch(() => props.compact, value => sky?.view.setCompact(!!value));
onBeforeUnmount(() => sky?.dispose());
</script>

<template>
  <div class="night-app" :class="{ compact, solid: vision.reduceTransparency.value }">
    <div class="night-layout">
    <div ref="host" class="sky-stage" />
    <div class="sky-top">
      <div class="sky-heading"><p class="eyebrow">A LITTLE PERSPECTIVE</p><h1 class="vk-large-title">Night Sky</h1><p class="vk-footnote vk-secondary">An approximate planetarium · {{ stars.length }} catalogued stars</p></div>
      <div class="sky-tools">
        <label class="location vk-well"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg><select v-model.number="city" aria-label="Observer location"><option v-for="(item,index) in cities" :key="item.name" :value="index">{{ item.name }}</option></select></label>
        <div class="object-search">
          <label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input v-model="query" v-hover class="vk-field" type="search" placeholder="Find a little wonder" aria-label="Search stars and planets" :aria-expanded="searchOpen" aria-controls="sky-search-results" @focus="searchOpen = true" @input="searchOpen = true" @keydown.enter="results[0] && choose(results[0])" /></label>
          <section v-if="searchOpen" id="sky-search-results" class="search-results vk-sheet vk-scroll" aria-label="Sky search results">
            <button v-for="item in results" :key="item.name" v-hover class="vk-row" @click="choose(item)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg><span>{{ item.name }}<small class="vk-secondary">{{ item.constellation }}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
            <p v-if="!results.length" class="vk-footnote vk-secondary">No matches. Try Vega, Orion, or Moon.</p>
            <button v-hover class="vk-button" @click="searchOpen = false">Done</button>
          </section>
        </div>
      </div>
    </div>
    <p v-if="error" class="sky-error vk-sheet" role="status">{{ error }}</p>
    <p v-else class="sky-hint vk-footnote vk-secondary">Drag to look · pinch or scroll to zoom · tap a bright point</p>
    <section v-if="selected" class="sky-card vk-platter vk-scroll" :class="{ 'vk-sheet': compact }" aria-label="Selected celestial object">
      <div class="card-top"><span class="vk-chip">{{ selected.planet ? 'Our neighbourhood' : selected.constellation }}</span><button v-hover class="vk-icon" aria-label="Dismiss object details" @click="closeCard"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div>
      <h2 class="vk-title">{{ selected.name }}</h2>
      <p class="vk-body">{{ fact }}</p>
      <dl><div><dt class="vk-footnote vk-secondary">Distance</dt><dd>{{ distance }}</dd></div><div><dt class="vk-footnote vk-secondary">Magnitude</dt><dd>{{ selected.magnitude.toFixed(2) }}{{ selected.planet ? ' · typical' : '' }}</dd></div></dl>
      <p v-if="selected.planet" class="vk-footnote vk-secondary">Approximate position and distance. Planet brightness varies; glow sizes are illustrative.</p>
    </section>
    <div class="sky-bottom">
      <div class="time-strip vk-ornament">
        <div class="time-readout"><strong>{{ timestamp }}</strong><small class="vk-secondary">{{ Math.abs(place.lat).toFixed(2) }}° {{ place.lat >= 0 ? 'N' : 'S' }} · {{ Math.abs(place.lon).toFixed(2) }}° {{ place.lon >= 0 ? 'E' : 'W' }} <span v-if="playing">· 1 hour / second</span></small></div>
        <div class="time-actions"><button v-hover class="vk-button" @click="now">Now</button><button v-hover class="vk-icon" :aria-label="playing ? 'Pause time lapse' : 'Play time lapse at one hour per second'" :aria-pressed="playing" @click="playing = !playing"><svg viewBox="0 0 24 24" aria-hidden="true"><path v-if="playing" d="M8 5v14M16 5v14"/><path v-else d="m8 4 12 8-12 8Z"/></svg></button></div>
        <label class="time-slider"><span class="vk-footnote vk-secondary">−12h</span><input v-model.number="offset" class="vk-slider" type="range" min="-12" max="12" step=".05" :style="{ '--value': (offset+12)/24 }" aria-label="Time offset in hours" :aria-valuetext="offset.toFixed(1)+' hours from base time'" @input="followNow = false; playing = false"/><span class="vk-footnote vk-secondary">+12h</span></label>
      </div>
      <div class="sky-switches vk-ornament" aria-label="Sky layers"><button v-hover class="vk-button" :aria-pressed="lines" @click="lines = !lines">Lines</button><button v-hover class="vk-button" :aria-pressed="labels" @click="labels = !labels">Labels</button><button v-hover class="vk-button" :aria-pressed="ground" @click="ground = !ground">Ground</button><button v-hover class="vk-button" :aria-pressed="showPlanets" @click="showPlanets = !showPlanets">Planets</button></div>
    </div>
    </div>
  </div>
</template>

<style src="../kit/kit.css"></style>
<style src="./nightsky/night.css" scoped></style>
