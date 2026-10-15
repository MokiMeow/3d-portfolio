<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import CityPreview from './maps/CityPreview.vue';
import AppSheet from './arcade/AppSheet.vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const uid = 'pocket-' + useId().replace(/:/g, '');
type Category = 'Food' | 'Coffee' | 'Parks' | 'Transit' | 'Books';
type MapStyle = 'Explore' | 'Driving' | 'Satellite' | 'Night';
type TravelMode = 'Drive' | 'Walk' | 'Cycle' | 'Transit';
interface Point { x: number; y: number }
interface Place extends Point { id: string; name: string; category: Category; color: string; rating: string; detail: string; hours: string }
const places: Place[] = [
  { id: 'chai', name: 'The Last Chai', category: 'Food', x: 840, y: 360, color: '#db894e', rating: '4.9', detail: 'Small cups. Very large opinions.', hours: 'Open until the chai runs out' },
  { id: 'espresso', name: 'Cloud Nine Espresso', category: 'Coffee', x: 1120, y: 160, color: '#9d7562', rating: '4.7', detail: 'A tiny café with lofty ambitions.', hours: 'Open until 7 PM' },
  { id: 'coffee', name: 'Soft Launch Café', category: 'Coffee', x: 360, y: 360, color: '#ae785f', rating: '4.8', detail: 'Coffee with a gentle learning curve.', hours: 'Open until 8 PM' },
  { id: 'park', name: 'Pause Park', category: 'Parks', x: 360, y: 800, color: '#48a36f', rating: '4.9', detail: 'No notifications. Plenty of squirrels.', hours: 'Open all day' },
  { id: 'station', name: 'Pocket Central', category: 'Transit', x: 600, y: 160, color: '#728bdd', rating: '4.7', detail: 'The next train is almost certainly fictional.', hours: 'Service until midnight' },
  { id: 'books', name: 'One More Chapter', category: 'Books', x: 160, y: 580, color: '#b184cf', rating: '5.0', detail: 'A bookstore with no sense of urgency.', hours: 'Open until 9 PM' },
  { id: 'lake', name: 'Little Lake Lookout', category: 'Parks', x: 1120, y: 580, color: '#4aa4b8', rating: '4.9', detail: 'A front-row seat to doing absolutely nothing.', hours: 'Open all day' },
  { id: 'bakery', name: 'Crumb & Circumstance', category: 'Food', x: 840, y: 800, color: '#d99565', rating: '4.8', detail: 'An excellent reason to take the scenic route.', hours: 'Open until 6 PM' },
];
const categories: Category[] = ['Food', 'Coffee', 'Parks', 'Transit'];
const styles: MapStyle[] = ['Explore', 'Driving', 'Satellite', 'Night'];
const modes: TravelMode[] = ['Drive', 'Walk', 'Cycle', 'Transit'];
const modeData: Record<TravelMode, { eta: number; color: string; label: string }> = {
  Drive: { eta: 4, color: '#438dff', label: 'Head along' }, Walk: { eta: 12, color: '#c780ff', label: 'Walk along' },
  Cycle: { eta: 6, color: '#29be95', label: 'Ride along' }, Transit: { eta: 8, color: '#f2a647', label: 'Take the Pocket Loop along' },
};
const lookAround = ref(false), guideOpen = ref<'slow' | 'water' | null>(null);
const guidePlaces = computed(() => places.filter(p => guideOpen.value==='water' ? ['lake','park','bakery'].includes(p.id) : ['coffee','books','chai'].includes(p.id)));
const savedPlaces = ref<string[]>([]);
const trees = Array.from({length:52},(_,i)=>({x:90+(i*167%1190),y:95+(i*113%720),r:6+i%5})).filter(t=>!((t.x>900 && t.y>400) || [160,360,600,840,1120].some(x=>Math.abs(t.x-x)<24) || [160,360,580,800].some(y=>Math.abs(t.y-y)<24)));
const query = ref(''), category = ref<Category | null>(null), selected = ref<Place | null>(null);
const style = ref<MapStyle>('Explore'), mode = ref<TravelMode>('Walk');
const threeD = ref(true), styleSheet = ref(false), panel = ref(true), directions = ref(false), navigating = ref(false), arrived = ref(false);
const map = ref<SVGSVGElement>();
const mapRoot = ref<HTMLElement>();
const viewport = ref({ width:1080, height:660 });
let mapObserver: ResizeObserver | undefined;
let visibilityObserver: IntersectionObserver | undefined;
const appVisible=ref(true), pageHidden=ref(false);
const markerScale = computed(() => 1 / (Math.min(viewport.value.width * 1.2 / 1400, viewport.value.height * 1.2 / 1000) * camera.value.zoom * (threeD.value ? .8 : 1)));
const camera = ref({ x: 690, y: 500, zoom: 1, bearing: 0 });
const progress = ref(0);
const origin: Point = { x: 600, y: 580 };
const results = computed(() => places.filter(p => (!category.value || p.category === category.value) && (p.name + ' ' + p.category).toLowerCase().includes(query.value.toLowerCase().trim())));
const route = computed<Point[]>(() => selected.value ? [origin, { x: selected.value.x, y: origin.y }, { x: selected.value.x, y: selected.value.y }] : [origin]);
const lengths = computed(() => route.value.slice(1).map((p, i) => Math.hypot(p.x - route.value[i]!.x, p.y - route.value[i]!.y)));
const total = computed(() => lengths.value.reduce((sum, n) => sum + n, 0));
const routePath = computed(() => route.value.map((p, i) => (i ? 'L' : 'M') + p.x + ',' + p.y).join(' '));
const location = computed(() => {
  let distance = progress.value * total.value;
  for (let i = 0; i < lengths.value.length; i++) {
    const length = lengths.value[i]!;
    if (distance <= length && length > 0) {
      const a = route.value[i]!, b = route.value[i + 1]!;
      return { x: a.x + (b.x - a.x) * distance / length, y: a.y + (b.y - a.y) * distance / length };
    }
    distance -= length;
  }
  return navigating.value || arrived.value ? route.value.at(-1)! : origin;
});
const step = computed(() => progress.value * total.value < (lengths.value[0] ?? 0) ? 0 : 1);
const streets: Record<number, string> = { 160:'Chapter Lane', 360:'Coffee Street', 600:'Central Avenue', 840:'Chai Lane', 1120:'Lake Drive' };
const street = (x: number): string => streets[x] ?? 'Pocket Lane';
const steps = computed(() => [modeData[mode.value].label + ' Lantern Boulevard', 'Turn onto ' + street(selected.value?.x ?? 600), 'Arrive at ' + (selected.value?.name ?? 'your destination')]);
const transform = computed(() => 'translate(700 500) rotate(' + camera.value.bearing + ') scale(' + camera.value.zoom + ') translate(' + -camera.value.x + ' ' + -camera.value.y + ')');
const buildings = Array.from({ length: 168 }, (_, i) => {
  const col = i % 14, row = Math.floor(i / 14), x = 42 + col * 93, y = 40 + row * 76;
  return { x, y, w: 36 + i % 3 * 9, h: 28 + i % 4 * 6, height: 16 + i % 7 * 8, color: ['#d6c7b5', '#cbc9ce', '#dbc6b6', '#bbc8c5'][i % 4] };
}).filter(b => ![160, 360, 600, 840, 1120].some(x => b.x < x + 32 && b.x + b.w > x - 30)
  && ![160, 360, 580, 800].some(y => b.y < y + 32 && b.y + b.h > y - 30)
  && !(b.x > 900 && b.y > 400 && b.y < 770) && !(b.x < 420 && b.y > 670));
const pointers = new Map<number, Point>();
let gestureDistance = 0, gestureAngle = 0, frame = 0;
let navigationTimer: ReturnType<typeof setInterval> | undefined;
let navigationStart = 0;
const clamp = (n: number, low: number, high: number): number => Math.max(low, Math.min(high, n));
function stopNavigation(): void { clearInterval(navigationTimer); navigating.value = false; }
function fly(point: Point, zoom = 1.7): void {
  // Event-driven camera updates; no reactive state is written in an animation loop.
  camera.value = { ...camera.value, x: point.x, y: point.y, zoom };
}
function choose(place: Place): void {
  stopNavigation(); progress.value = 0; arrived.value = false; directions.value = false;
  selected.value = place; panel.value = true; fly(place);
}
function showRoute(): void { directions.value = true; progress.value = 0; arrived.value = false; fly({ x: (origin.x + selected.value!.x) / 2, y: (origin.y + selected.value!.y) / 2 }, 1.25); }
function go(): void {
  stopNavigation(); progress.value = 0; navigating.value = true; arrived.value = false; navigationStart = performance.now();
  if (props.compact) panel.value = false;
  scheduleNavigation();
}
function scheduleNavigation(): void {
  clearInterval(navigationTimer); navigationTimer=undefined;
  if(!navigating.value || !appVisible.value || document.hidden) return;
  navigationStart=performance.now()-progress.value*24000;
  navigationTimer=setInterval(() => {
    progress.value=Math.min(1,(performance.now()-navigationStart)/24000);
    if(progress.value===1) { stopNavigation(); arrived.value=true; vision.toast('You have arrived. Your fictional adventure was a success.'); }
  },1000);
}
function zoom(amount: number): void { cancelAnimationFrame(frame); camera.value.zoom = clamp(camera.value.zoom * amount, .55, 3.2); }
function pointerDown(event: PointerEvent): void {
  if (event.button !== 0) return;
  cancelAnimationFrame(frame); map.value?.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    gestureDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y); gestureAngle = Math.atan2(b!.y - a!.y, b!.x - a!.x);
  }
}
function pointerMove(event: PointerEvent): void {
  const old = pointers.get(event.pointerId); if (!old || !map.value) return;
  const next = { x: event.clientX, y: event.clientY }; pointers.set(event.pointerId, next);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()], distance = Math.hypot(a!.x - b!.x, a!.y - b!.y), angle = Math.atan2(b!.y - a!.y, b!.x - a!.x);
    if (gestureDistance > 0) zoom(distance / gestureDistance);
    camera.value.bearing += (angle - gestureAngle) * 180 / Math.PI;
    gestureDistance = distance; gestureAngle = angle;
  } else {
    const bounds = map.value.getBoundingClientRect(), ratio = Math.max(1400 / bounds.width, 1000 / bounds.height) / camera.value.zoom;
    const dx = (next.x - old.x) * ratio, dy = (next.y - old.y) * ratio, angle = camera.value.bearing * Math.PI / 180;
    camera.value.x = clamp(camera.value.x - dx * Math.cos(angle) - dy * Math.sin(angle), -200, 1600);
    camera.value.y = clamp(camera.value.y + dx * Math.sin(angle) - dy * Math.cos(angle), -200, 1200);
  }
}
function pointerUp(event: PointerEvent): void { pointers.delete(event.pointerId); gestureDistance = 0; }
function wheel(event: WheelEvent): void { if (event.shiftKey) camera.value.bearing += event.deltaY / 6; else zoom(Math.exp(-event.deltaY * .0015)); }
function sheetKeys(event:KeyboardEvent):void { if(event.key==='Escape' && (lookAround.value || guideOpen.value || styleSheet.value)) { event.stopPropagation(); lookAround.value=false; guideOpen.value=null; styleSheet.value=false; } }
function mapKeys(event: KeyboardEvent): void {
  const moves: Record<string, Point> = { ArrowLeft: { x: -70, y: 0 }, ArrowRight: { x: 70, y: 0 }, ArrowUp: { x: 0, y: -70 }, ArrowDown: { x: 0, y: 70 } };
  const move = moves[event.key];
  if (move) { event.preventDefault(); cancelAnimationFrame(frame); camera.value.x += move.x / camera.value.zoom; camera.value.y += move.y / camera.value.zoom; }
  else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
  else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
}
onMounted(() => {
  if (!mapRoot.value) return;
  mapObserver = new ResizeObserver(entries => {
    const size = entries[0]?.contentRect;
    if (size && size.width > 0 && size.height > 0) viewport.value = { width:size.width, height:size.height };
  });
  mapObserver.observe(mapRoot.value);
  visibilityObserver=new IntersectionObserver(entries=>{appVisible.value=entries[0]?.isIntersecting ?? false; scheduleNavigation();});visibilityObserver.observe(mapRoot.value);
  document.addEventListener('visibilitychange',mapVisibility);
});
function mapVisibility():void { pageHidden.value=document.hidden; scheduleNavigation(); }
onBeforeUnmount(() => { visibilityObserver?.disconnect(); document.removeEventListener('visibilitychange',mapVisibility); cancelAnimationFrame(frame); clearInterval(navigationTimer); mapObserver?.disconnect(); pointers.clear(); });
</script>

<template>
<section ref="mapRoot" class="maps-app" :class="[{ compact, paused:!appVisible || pageHidden, 'three-d': threeD, solid: vision.reduceTransparency.value }, style.toLowerCase()]" aria-label="Maps — fictional Pocket District" @keydown="sheetKeys">
  <div class="map-stage">
    <svg ref="map" class="city" viewBox="0 0 1400 1000" tabindex="0" role="group" aria-label="Pocket District map. Drag to pan; pinch or scroll to zoom. Arrow keys pan; plus and minus zoom."
      @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @lostpointercapture="pointerUp" @wheel.prevent="wheel" @dblclick.prevent="zoom(1.4)" @keydown="mapKeys">
      <defs>
        <pattern :id="uid + '-grain'" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M2 4l6 2m8 8 4-3M6 18l3-2" stroke="#d7dcad" opacity=".22" stroke-width="2"/></pattern>
        <linearGradient :id="uid + '-water'" x2="0" y2="1"><stop stop-color="#87cad3"/><stop offset="1" stop-color="#4b9dab"/></linearGradient>
        <filter :id="uid + '-shadow'" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dy="5" stdDeviation="4" flood-opacity=".22"/></filter>
        <symbol :id="uid + '-food'" viewBox="0 0 24 24"><path d="M5 3v6m3-6v6M4 8h5v3H6v10M17 3c-4 4-4 9 0 9v9m0-18v9"/></symbol>
        <symbol :id="uid + '-coffee'" viewBox="0 0 24 24"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Zm13 1h2a3 3 0 0 1 0 6h-2M7 3v2m5-2v2"/></symbol>
        <symbol :id="uid + '-parks'" viewBox="0 0 24 24"><path d="m12 3 6 7h-3l5 6H4l5-6H6Zm0 13v5"/></symbol>
        <symbol :id="uid + '-transit'" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14M8 21l2-3m6 3-2-3m-5-3h.1m6 0h.1"/></symbol>
        <symbol :id="uid + '-books'" viewBox="0 0 24 24"><path d="M12 6C9 4 6 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/></symbol>
      </defs>
      <g :transform="transform">
        <rect x="-1800" y="-1600" width="5000" height="4200" class="ground"/>
        <rect x="0" y="0" width="1400" height="1000" class="texture" :fill="'url(#' + uid + '-grain)'"/>
        <path d="M-100 920C260 880 450 1070 780 935S1190 880 1500 920" fill="none" :stroke="'url(#' + uid + '-water)'" stroke-width="120"/>
        <path d="M-100 920C260 880 450 1070 780 935S1190 880 1500 920" fill="none" stroke="#c6f1ed" stroke-width="2" stroke-dasharray="60 20" opacity=".45"/>
        <path d="M945 423Q1080 373 1178 452T1233 665Q1120 777 966 691T945 423" :fill="'url(#' + uid + '-water)'" stroke="#b6d0ad" stroke-width="18"/>
        <rect x="70" y="665" width="350" height="192" rx="60" class="park"/>
        <rect x="920" y="50" width="275" height="170" rx="50" class="park"/>
        <path d="M110 747q130-95 265-8m-185-44 70 113m714-666q89-45 185 12" fill="none" stroke="#c5d6a3" stroke-width="9"/>
        <g fill="#67946b"><circle v-for="i in 20" :key="i" :cx="100 + (i * 57 % 280)" :cy="695 + (i * 41 % 145)" :r="8 + i % 4"/></g>
        <g class="minor-roads" fill="none" stroke-width="12"><path v-for="x in [70,260,480,720,970,1260]" :key="x" :d="'M'+x+' 40V880'"/><path v-for="y in [75,260,465,685,860]" :key="y" :d="'M40 '+y+'H900'"/></g>
        <g v-for="b in buildings" :key="b.x+'-'+b.y" class="building">
          <path :d="'M'+b.x+' '+(b.y+b.h)+'h'+b.w+'l'+(threeD ? b.height*.65 : 5)+' '+(threeD ? b.height*.4 : 5)+'h-'+b.w+'Z'" fill="#4f5f5933"/>
          <rect :x="b.x" :y="b.y + b.h - (threeD ? b.height : 0)" :width="b.w" :height="threeD ? b.height : 4" :fill="b.color" class="building-facade"/>
          <path v-if="threeD" :d="'M'+(b.x+b.w)+' '+(b.y-b.height)+'l10 7v'+(b.h+b.height)+'l-10-7Z'" class="building-side"/>
          <rect :x="b.x" :y="b.y-(threeD ? b.height : 0)" :width="b.w" :height="b.h" rx="2" :fill="b.color" stroke="#ffffff50" stroke-width="1.5"/>
          <rect :x="b.x+7" :y="b.y+7-(threeD ? b.height : 0)" :width="b.w-14" :height="Math.max(8,b.h-14)" rx="2" fill="#647c7425" stroke="#ffffff40"/>
          <path v-for="floor in (threeD ? Math.max(1,Math.floor(b.height/12)) : 0)" :key="floor" :d="'M'+(b.x+5)+' '+(b.y+b.h-b.height+floor*10)+'h'+(b.w-10)" stroke="#5d7476" opacity=".6" stroke-width="4" stroke-dasharray="4 5"/>
        </g>
        <g v-for="(tree,i) in trees" :key="'tree'+i" :transform="'translate('+tree.x+' '+tree.y+')'"><ellipse :rx="tree.r+3" :ry="tree.r*.6" cy="3" fill="#3a583c26"/><path v-if="threeD" d="M0 0v-12" stroke="#7f805a" stroke-width="2"/><circle :cy="threeD ? -12 : 0" :r="tree.r" fill="#648d65"/><circle cx="-2" :cy="threeD ? -15 : -3" :r="tree.r*.65" fill="#92b582"/></g>
        <g class="water-shimmer" fill="none" stroke="#dbf5ed" opacity=".35" stroke-linecap="round"><path v-for="i in 12" :key="i" :d="'M'+(965+i*13%145)+' '+(450+i*17)+'h'+(18+i%4*8)" stroke-width="2"/></g>
        <g class="road-border" fill="none" stroke-linecap="round" stroke-width="32"><path v-for="x in [160,360,600,840,1120]" :key="x" :d="'M'+x+' -40V1000'"/><path v-for="y in [160,360,580,800]" :key="y" :d="'M-40 '+y+'H1440'"/></g>
        <g class="major-roads" fill="none" stroke-linecap="round" stroke-width="26"><path v-for="x in [160,360,600,840,1120]" :key="x" :d="'M'+x+' -40V1000'"/><path v-for="y in [160,360,580,800]" :key="y" :d="'M-40 '+y+'H1440'"/></g>
        <g class="road-labels" font-size="13" text-anchor="middle"><text v-for="x in [160,360,600,840,1120]" :key="x" :transform="'translate('+x+' 475) rotate(-90)'">{{ street(x) }}</text><text x="760" y="164">Station Road</text><text x="460" y="364">Kindred Street</text><text x="990" y="584">Lantern Boulevard</text><text x="655" y="804">Slow Sunday Road</text><text x="260" y="272" font-size="10">Tiny Terrace</text><text x="475" y="467" font-size="10">Acorn Alley</text></g>
        <g class="district-labels" text-anchor="middle"><text x="650" y="275">POCKET DISTRICT</text><text x="238" y="840" font-size="15">Pause Park</text><text x="1066" y="530" font-size="20">Little Lake</text><text x="780" y="978" font-size="15">The Meander River</text></g>
        <g v-if="directions"><path :d="routePath" fill="none" stroke="#fff" stroke-width="14" stroke-linejoin="round"/><path :d="routePath" fill="none" :stroke="modeData[mode].color" stroke-width="9" stroke-linejoin="round"/><path :d="routePath" class="route-dashes" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="8 15" stroke-linejoin="round"/></g>
        <g v-for="place in places" :key="place.id" :transform="'translate('+place.x+' '+place.y+') scale('+markerScale+')'" class="poi" role="button" tabindex="0" :aria-label="place.name + ', ' + place.category" @pointerdown.stop @dblclick.stop @click.stop="choose(place)" @keydown.enter.prevent="choose(place)" @keydown.space.prevent="choose(place)">
          <circle r="28" fill="transparent"/><circle r="20" :fill="place.color" stroke="#fff" stroke-width="3" :filter="'url(#'+uid+'-shadow)'"/>
          <svg x="-12" y="-12" width="24" height="24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><use :href="'#'+uid+'-'+place.category.toLowerCase()"/></svg>
          <text v-if="!compact || selected?.id===place.id" y="40" text-anchor="middle" class="poi-label">{{ place.name }}</text>
        </g>
        <g :transform="'translate('+location.x+' '+location.y+') scale('+markerScale+')'"><circle class="accuracy" r="29" fill="#328aff" opacity=".18"/><circle r="11" fill="#2486ff" stroke="#fff" stroke-width="4"/><circle r="3" fill="#fff" opacity=".8"/></g>
      </g>
    </svg>
  </div>
  <aside v-if="panel" class="search-panel vk-platter">
    <header><div><h1 class="vk-title">Maps</h1><p class="vk-footnote vk-secondary">Pocket District · Fictional city</p></div><button v-hover class="vk-icon" aria-label="Hide places panel" @click="panel=false"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></header>
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input v-model="query" class="vk-field" type="search" placeholder="Search Pocket District" aria-label="Search places" @input="selected=null; directions=false; stopNavigation(); arrived=false; progress=0"/></label>
    <div class="categories"><button v-for="item in categories" :key="item" v-hover class="vk-chip" :aria-pressed="category===item" @click="category=category===item ? null : item; selected=null; directions=false; stopNavigation(); arrived=false; progress=0">{{ item }}</button></div>
    <div class="panel-content vk-scroll"><template v-if="selected">
      <button v-hover class="vk-button back" @click="selected=null; directions=false; stopNavigation(); arrived=false; progress=0">All places</button>
      <div class="place-art" :style="{ '--place-color': selected.color }" aria-hidden="true"><span class="sun"/><span class="hill"/><div class="shop"><i/><i/><i/><span>{{ selected.category === 'Parks' ? 'TAKE A BREATH' : selected.category === 'Transit' ? 'POCKET CENTRAL' : selected.category === 'Books' ? 'ONE MORE CHAPTER' : 'A LITTLE GOOD THING' }}</span></div><div class="art-water" v-if="selected.id==='lake'"/></div>
      <h2 class="vk-title place-title">{{ selected.name }}</h2><p class="vk-footnote vk-secondary">{{ selected.category }} · {{ selected.rating }} / 5 · Demo ratings</p><p class="vk-body">{{ selected.detail }}</p><p class="vk-footnote hours">{{ selected.hours }}</p>
      <button v-hover class="look-card" aria-label="Open illustrated Look Around" @click="lookAround=true"><CityPreview :title="selected.name"/><span>Look Around <svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></button><div class="place-actions"><button v-hover class="vk-button tinted" @click="showRoute">Directions</button><button v-hover class="vk-button" :aria-pressed="savedPlaces.includes(selected.id)" @click="savedPlaces.includes(selected.id) ? savedPlaces=savedPlaces.filter(id=>id!==selected!.id) : savedPlaces.push(selected.id)">{{ savedPlaces.includes(selected.id) ? 'Saved' : 'Save' }}</button><button v-hover class="vk-button" @click="vision.toast('This lovely place exists only in Pocket District.')">Website</button></div>
      <div v-if="directions" class="route-card vk-well">
        <div class="vk-segmented modes" aria-label="Travel mode"><button v-for="m in modes" :key="m" :aria-pressed="mode===m" :disabled="navigating" @click="mode=m">{{ m }}</button></div>
        <div class="route-summary"><strong class="vk-title">{{ modeData[mode].eta }} min</strong><span class="vk-footnote vk-secondary">{{ (total / 500).toFixed(1) }} km · Demo route</span></div>
        <ol><li v-for="(line,i) in steps" :key="line" :class="{ active: navigating && step===i }">{{ line }}</li></ol>
        <button v-hover class="vk-button primary" @click="navigating ? stopNavigation() : go()">{{ navigating ? 'Stop navigation' : arrived ? 'Go again' : 'Go' }}</button>
      </div>
    </template>
    <template v-else><section v-if="!query && !category" class="guides"><div class="section-heading"><h2>Curated Guides</h2><span>Demo collection</span></div><button v-hover class="guide-card slow-guide" @click="guideOpen='slow'"><span class="guide-art"><svg viewBox="0 0 80 70"><path d="M17 23h36v22a13 13 0 0 1-13 13H30a13 13 0 0 1-13-13Zm36 3h7a9 9 0 0 1 0 18h-7M29 8v7m12-7v7"/></svg></span><span><small>A POCKET DISTRICT GUIDE</small><strong>The slow morning</strong><em>Coffee, books & one more chai · 3 stops</em></span></button><button v-hover class="guide-card water-guide" @click="guideOpen='water'"><span class="guide-art"><svg viewBox="0 0 80 70"><path d="M9 43q13-12 26 0t26 0M9 56q13-12 26 0t26 0M40 8l14 20H26Zm0 20v9"/></svg></span><span><small>TAKE THE SCENIC ROUTE</small><strong>A little blue, a little green</strong><em>By the lake & through the park · 3 stops</em></span></button></section><p class="vk-footnote vk-secondary list-heading">{{ query ? 'Search suggestions' : 'A few good places to get lost' }}</p><button v-for="place in results" :key="place.id" v-hover class="vk-row" @click="choose(place)"><span class="result-marker" :style="{background:place.color}"><svg viewBox="0 0 24 24"><use :href="'#'+uid+'-'+place.category.toLowerCase()"/></svg></span><span><strong class="vk-headline">{{ place.name }}</strong><small class="vk-footnote vk-secondary">{{ place.category }} · {{ place.rating }}</small></span></button><p v-if="!results.length" class="vk-secondary empty">No places found. Try “chai” or clear a filter.</p></template>
    </div>
  </aside>
  <div class="map-controls vk-ornament"><button v-hover class="vk-icon compass" aria-label="Reset map to north" @click="camera.bearing=0"><svg viewBox="0 0 24 24" :style="{transform:'rotate('+camera.bearing+'deg)'}"><path d="m12 2 5 10-5-2-5 2Z" fill="#ff6c66" stroke="#ff6c66"/><path d="m12 22 5-10-5 2-5-2Z"/><text x="12" y="14" fill="currentColor" stroke="none" text-anchor="middle" font-size="5">N</text></svg></button><button v-hover class="vk-button" :aria-pressed="threeD" @click="threeD=!threeD">{{ threeD ? '3D' : '2D' }}</button><button v-hover class="vk-icon" aria-label="Locate me" @click="fly(location,1.5)"><svg viewBox="0 0 24 24"><path d="m20 4-6 16-3-7-7-3Z"/></svg></button><button v-hover class="vk-icon" :aria-expanded="styleSheet" aria-label="Map styles" @click="styleSheet=!styleSheet"><svg viewBox="0 0 24 24"><path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></svg></button></div>
  <div class="zoom-controls vk-ornament"><button v-hover class="vk-icon" aria-label="Zoom in" @click="zoom(1.25)"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg></button><button v-hover class="vk-icon" aria-label="Zoom out" @click="zoom(.8)"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button><button v-hover class="vk-icon" aria-label="Rotate map clockwise" @click="camera.bearing+=30"><svg viewBox="0 0 24 24"><path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5"/></svg></button></div>
  <button v-if="!panel" v-hover class="vk-button vk-ornament reveal" @click="panel=true">Search & places</button>
  <div v-if="styleSheet" class="style-sheet vk-sheet" role="group" aria-label="Map style"><h2 class="vk-headline">Choose your view</h2><button v-for="s in styles" :key="s" v-hover class="vk-row" :class="{selected:style===s}" :aria-pressed="style===s" @click="style=s; styleSheet=false"><span class="style-swatch" :class="s.toLowerCase()"/>{{ s }}<span v-if="style===s" class="selected-dot"/></button><button class="vk-button" @click="styleSheet=false">Done</button></div>
  <div v-if="navigating || arrived" class="navigation-banner vk-ornament" role="status"><svg viewBox="0 0 24 24"><path :d="arrived ? 'm5 12 4 4L20 5' : step===0 ? 'M12 21V3m-6 6 6-6 6 6' : 'M6 21V9h14m-6-6 6 6-6 6'"/></svg><div><strong>{{ arrived ? 'You have arrived' : steps[step] }}</strong><small>{{ arrived ? selected?.name : 'Simulated navigation · ' + Math.ceil((1-progress)*24) + ' seconds remaining' }}</small></div><button v-if="navigating" class="vk-button" @click="stopNavigation">Stop</button></div>
  <button v-if="!compact && !selected && !navigating" v-hover class="floating-look vk-platter" aria-label="Open illustrated street view" @click="lookAround=true"><CityPreview title="Kindred Street"/><span>Look Around <svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></button><span class="map-credit">Pocket District · Hand-drawn demo map</span>
<AppSheet v-if="lookAround" title="Look Around" @close="lookAround=false"><CityPreview :title="selected?.name || 'Kindred Street'" interactive/><p class="sheet-description">A hand-drawn street-level preview of our fictional district. Use the arrows to look along the street.</p><button v-hover class="vk-button primary" @click="lookAround=false">Back to map</button></AppSheet><AppSheet v-if="guideOpen" :title="guideOpen==='slow' ? 'The slow morning' : 'A little blue, a little green'" @close="guideOpen=null"><CityPreview :title="guideOpen==='slow' ? 'Kindred Street' : 'Lake Drive'"/><p class="sheet-description">{{ guideOpen==='slow' ? 'A small ritual for a morning with nowhere urgent to be.' : 'A gentle loop along the water, with a bakery on the way home.' }} Three fictional stops, chosen with care.</p><button v-for="(place,i) in guidePlaces" :key="place.id" v-hover class="vk-row" @click="guideOpen=null; choose(place)"><span class="guide-stop">{{ i+1 }}</span><span><strong>{{ place.name }}</strong><small class="vk-secondary">{{ place.category }} · {{ place.detail }}</small></span><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></AppSheet>
</section>
</template>

<style src="../kit/kit.css"></style>
<style scoped>
.maps-app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  color: var(--vk-text);
  background: #adc8ba;
  isolation: isolate;
}
.maps-app * {
  box-sizing: border-box;
}
button,input {
  font: inherit;
}
button {
  border: 0;
  cursor: pointer;
}
h1,h2,p {
  margin: 0;
}
svg:not(.city) {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}
.map-stage {
  position: absolute;
  inset: -10%;
  perspective: 1200px;
}
.city {
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;
  transition: transform .8s var(--vk-spring);
  transform-origin: 50% 50%;
}
.city:active {
  cursor: grabbing;
}
.three-d .city {
  transform: rotateX(50deg) scale(1.35);
}
.ground {
  fill: #e3e5d8;
}
.park {
  fill: #a6c697;
}
.minor-roads {
  stroke: #f2eee2;
}
.road-border {
  stroke: #d2cdbc;
}
.major-roads {
  stroke: #fff9e9;
}
.building-side {
  fill: #a29d97;
}
.road-labels {
  fill: #817b6c;
  font-weight: 600;
}
.district-labels {
  fill: #6c877a;
  letter-spacing: 4px;
  font-size: 25px;
  font-weight: 650;
}
.poi {
  cursor: pointer;
}
.poi-label {
  fill: #3d4944;
  stroke: #eef0e3;
  stroke-width: 4px;
  paint-order: stroke;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0;
}
.texture {
  opacity: 0;
}
.satellite .ground {
  fill: #879a75;
}
.satellite .texture {
  opacity: 1;
}
.satellite .park {
  fill: #547f59;
}
.satellite .building {
  filter: brightness(.85);
}
.satellite .major-roads {
  stroke: #c8c1ab;
}
.driving .major-roads {
  stroke: #ffe3a7;
}
.driving .road-border {
  stroke: #d8b578;
}
.night .ground {
  fill: #263a40;
}
.night .major-roads {
  stroke: #536069;
}
.night .minor-roads {
  stroke: #39484f;
}
.night .road-border {
  stroke: #66716b;
}
.night .park {
  fill: #2a5b48;
}
.night .building {
  filter: brightness(.52);
}
.night .road-labels,.night .district-labels {
  fill: #a6bec1;
}
.night .poi-label {
  fill: #fff;
  stroke: #263a40;
}
.accuracy {
  transform-origin: center;
  animation: accuracy-pulse 2.5s ease-out infinite;
}
.route-dashes {
  animation: route-flow 1.2s linear infinite;
}
.search-panel {
  position: absolute;
  top: 24px;
  left: 24px;
  bottom: 50px;
  width: 320px;
  padding: 20px;
  background: rgb(38 44 48 / .84);
  backdrop-filter: blur(28px);
  box-shadow: 0 16px 50px #0003;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.solid .search-panel {
  background: #30373b;
  backdrop-filter: none;
}
header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.search {
  position: relative;
}
.search>svg {
  position: absolute;
  left: 15px;
  top: 11px;
  opacity: .6;
  width: 20px;
  height: 20px;
}
.search input {
  padding-left: 44px;
}
.categories {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.categories .vk-chip {
  min-height: 44px;
}
.list-heading {
  margin-top: 5px;
}
.result-marker {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
.result-marker svg {
  width: 22px;
  height: 22px;
}
.vk-row {
  flex: none;
}
.vk-row strong {
  font-size: 15px;
}
.vk-row small {
  display: block;
  margin-top: 4px;
}
.back {
  align-self: flex-start;
}
.place-art {
  position: relative;
  flex: none;
  height: 130px;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(140deg,#fce0ad,var(--place-color));
  box-shadow: inset 0 0 30px #0002;
}
.sun {
  position: absolute;
  right: 27px;
  top: 18px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #fff3c8;
  box-shadow: 0 0 30px #ffeec4;
}
.hill {
  position: absolute;
  inset: 70px -30px -50px;
  border-radius: 50% 50% 0 0;
  background: #57775a;
}
.shop {
  position: absolute;
  bottom: 10px;
  left: 40px;
  right: 40px;
  height: 72px;
  border-radius: 6px 6px 0 0;
  background: #e6ca9d;
  box-shadow: 8px 8px 0 #553e3233;
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  padding: 12px;
}
.shop:before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 14px;
  background: repeating-linear-gradient(90deg,var(--place-color) 0 16px,#f4e6cf 16px 32px);
  border-radius: 6px;
}
.shop i {
  width: 30px;
  height: 34px;
  border-radius: 20px 20px 0 0;
  background: #434c50;
}
.shop span {
  position: absolute;
  top: 19px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #674e40;
}
.art-water {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 35px;
  background: linear-gradient(#83bac1,#498a9d);
  opacity: .85;
}
.place-title {
  margin-top: 3px;
}
.hours {
  color: #a9e4b9;
}
.place-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.place-actions .vk-button {
  padding: 0 13px;
  font-size: 14px;
}
.route-card {
  padding: 14px;
  display: grid;
  gap: 14px;
}
.modes {
  width: 100%;
  display: flex;
}
.modes>button {
  padding: 0 7px;
  flex: 1;
  font-size: 12px;
  min-height: 44px;
}
.modes>button:disabled {
  opacity: .5;
}
.route-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.route-card ol {
  padding-left: 21px;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}
.route-card li.active {
  color: #b9d9ff;
}
.map-controls {
  position: absolute;
  right: 24px;
  top: 24px;
}
.compass svg {
  transition: transform .4s var(--vk-spring);
}
.zoom-controls {
  position: absolute;
  right: 24px;
  bottom: 55px;
  flex-direction: column;
}
.reveal {
  position: absolute;
  bottom: 55px;
  left: 24px;
}
.map-credit {
  position: absolute;
  bottom: 20px;
  right: 25px;
  font-size: 12px;
  color: #485b52;
  background: #ffffffad;
  padding: 5px 10px;
  border-radius: 20px;
}
.style-sheet {
  position: absolute;
  right: 24px;
  top: 92px;
  width: 250px;
  z-index: 4;
}
.style-sheet h2 {
  padding: 10px;
}
.style-sheet .vk-button {
  width: 100%;
}
.style-swatch {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(45deg,#a4c398 35%,#fff3da 35% 45%,#8ac8d2 45%);
}
.style-swatch.driving {
  background: linear-gradient(45deg,#dfe3d7 40%,#ffce76 40% 55%,#dfdfd5 55%);
}
.style-swatch.satellite {
  background: repeating-linear-gradient(35deg,#577552 0 8px,#8a9d6c 8px 15px);
}
.style-swatch.night {
  background: linear-gradient(45deg,#294238 45%,#768889 45% 55%,#23363c 55%);
}
.selected-dot {
  margin-left: auto;
  width: 8px;
  height: 8px;
  background: #fff;
  border-radius: 50%;
}
.navigation-banner {
  position: absolute;
  top: 24px;
  left: 365px;
  right: 250px;
  gap: 12px;
  border-radius: 24px;
  padding: 15px;
}
.navigation-banner svg {
  flex: none;
  width: 30px;
  height: 30px;
}
.navigation-banner small {
  display: block;
  font-size: 12px;
  opacity: .65;
  margin-top: 4px;
}
.navigation-banner .vk-button {
  margin-left: auto;
  font-size: 13px;
  padding: 0 12px;
}
.empty {
  padding: 20px 4px;
}
.compact .search-panel {
  top: auto;
  bottom: 18px;
  left: 16px;
  right: 16px;
  width: auto;
  max-height: 53%;
  padding: 16px;
}
.compact .map-controls {
  right: 16px;
  top: 16px;
}
.compact .zoom-controls {
  right: 16px;
  top: 82px;
  bottom: auto;
  flex-direction: row;
}
.compact .navigation-banner {
  left: 16px;
  right: 16px;
  top: 145px;
}
.compact .map-credit {
  bottom: 3px;
  right: 16px;
  font-size: 10.5px;
}
.compact .reveal {
  left: 16px;
  bottom: 35px;
}
.compact .style-sheet {
  right: 16px;
  top: 85px;
}
.compact .place-art {
  height: 115px;
}
.compact .city {
  min-height: 100%;
}
@media(max-width:700px) {
  .search-panel {
    width: 280px;
  }
  .navigation-banner {
    left: 24px;
    right: 24px;
    top: 100px;
    z-index: 2;
  }
}
@keyframes accuracy-pulse {
  0% {
    opacity: .3;
    transform: scale(.65);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}
@keyframes route-flow {
  to {
    stroke-dashoffset: -46;
  }
}
@media(prefers-reduced-motion:reduce) {
  .maps-app * {
    animation: none!important;
    transition: none!important;
  }
}

.maps-app{container-type:size;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}.three-d .city{transform:rotateX(32deg) scale(1.16)}.ground{fill:#dce4d7}.building-facade{filter:brightness(.83)}.building-side{fill:#7e8f89}.search-panel{width:312px;bottom:24px;padding:20px;gap:14px;background:linear-gradient(140deg,#6f837438,#ffffff08),#293c3cc9;overflow:hidden}.search-panel>header,.search-panel>.search,.categories{flex:none}.search-panel .vk-title{font-size:24px}.panel-content{min-height:0;flex:1;display:flex;flex-direction:column;gap:14px;padding-bottom:4px}.categories{flex-wrap:nowrap;gap:5px}.categories .vk-chip{font-size:12px;padding:0 10px;flex:1;justify-content:center}.section-heading{display:flex;align-items:center;justify-content:space-between;margin:2px 0 12px}.section-heading h2{font-size:16px;font-weight:600}.section-heading span{font-size:10.5px;color:#fff8}.guides{flex:none}.guide-card{display:flex;text-align:left;gap:12px;width:100%;padding:12px;border-radius:20px;margin-bottom:10px;background:linear-gradient(120deg,#d0b39430,#ffffff0b);color:inherit;min-height:94px;align-items:center}.water-guide{background:linear-gradient(120deg,#9bcdcf2c,#ffffff0b)}.guide-art{height:60px;width:60px;display:grid;place-items:center;border-radius:15px;background:#af927643;flex:none}.water-guide .guide-art{background:#6dabb333}.guide-art svg{width:48px;height:48px;stroke:#e5d5b7;stroke-width:1.8}.water-guide .guide-art svg{stroke:#d1e8de}.guide-card strong,.guide-card small,.guide-card em{display:block}.guide-card small{font-size:7px;letter-spacing:1px;color:#fff9}.guide-card strong{font-size:14px;font-weight:600;line-height:1.3;margin:5px 0}.guide-card em{font-size:10.5px;font-style:normal;color:#fffa;line-height:1.4}.panel-content>.vk-row{padding:9px 8px;min-height:64px}.list-heading{font-size:12px}.look-card{border-radius:22px;overflow:hidden;display:block;padding:0;background:#ffffff12;text-align:left;color:inherit;flex:none}.look-card>span,.floating-look>span{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:9px 14px;min-height:44px}.look-card>span svg,.floating-look>span svg{width:16px;height:16px}.floating-look{position:absolute;bottom:28px;right:100px;width:232px;padding:8px;color:#fff;text-align:left;background:#283c3ab8;backdrop-filter:blur(24px);border-radius:26px;box-shadow:0 15px 36px #0002}.floating-look :deep(.street-preview){border-radius:19px}.floating-look :deep(.street-caption){font-size:11.5px;left:12px;right:12px}.floating-look :deep(.street-caption small){display:none}.floating-look>span{padding:5px 8px;min-height:36px}.map-credit{font-size:10.5px;background:#ffffff94;bottom:10px}.sheet-description{font-size:14px;color:#ffffffb8;line-height:1.6;margin:18px 0}.guide-stop{width:34px;height:34px;border-radius:50%;background:#ffffff16;display:grid;place-items:center;flex:none}.water-shimmer{opacity:.3}.navigation-banner{left:350px;right:270px;top:96px;z-index:3;min-width:0}.navigation-banner strong{font-size:13px}.navigation-banner small{font-size:11.5px}.style-sheet{max-height:calc(100% - 115px);overflow:auto}.place-art{height:110px}.panel-content .back{min-height:44px}.style-sheet .vk-row{min-height:56px}
@container(max-height:560px) and (min-width:701px){.search-panel{top:20px;left:20px;bottom:20px}.guide-card{min-height:78px;padding:10px}.guide-art{width:48px;height:48px}.guide-art svg{width:39px;height:39px}.floating-look{width:212px;bottom:22px}.floating-look :deep(.street-preview){min-height:108px}.map-controls{top:20px;right:20px}.zoom-controls{right:20px;bottom:40px}}
@container(max-width:700px){.search-panel{top:auto;bottom:18px;left:16px;right:16px;width:auto;height:52%;max-height:52%;padding:16px;gap:12px}.categories .vk-chip{font-size:12px;padding:0 8px}.panel-content{gap:12px}.search-panel>header{min-height:44px}.search-panel>header .vk-title{font-size:23px}.floating-look{display:none}.navigation-banner{top:140px;left:16px;right:16px}.map-controls{right:16px;top:16px}.zoom-controls{top:82px;right:16px;bottom:auto;flex-direction:row}.map-credit{bottom:3px;font-size:8px}.style-sheet{right:16px;top:82px;max-height:calc(100% - 110px)}.guides{display:grid;grid-template-columns:1fr}.guide-card{min-height:80px}.guide-art{height:50px;width:50px}.city{transform-origin:50% 25%}.three-d .city{transform:rotateX(26deg) scale(1.2)}.panel-content .place-title{font-size:20px}}

.paused *{animation-play-state:paused!important}
</style>