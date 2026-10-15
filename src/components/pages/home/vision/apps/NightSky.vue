<script setup lang="ts">
import { listenAsApp } from '../bus';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { stars, type SkyObject } from './nightsky/catalog';
import { cities, planets, solarAltitude, moonIllumination } from './nightsky/astronomy';
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
const figures = ref(false);
const speed = ref(60);
const appRoot = ref<HTMLElement>();
const dateOpen = ref(false);
const dateDialog = ref<HTMLElement>();
let dateFocus: HTMLElement | undefined;
watch(dateOpen, async value => { if(value) { dateFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined; await nextTick(); dateDialog.value?.querySelector<HTMLInputElement>('input')?.focus(); } else dateFocus?.focus(); });
function dialogKeys(event: KeyboardEvent): void { if (event.key !== 'Tab') return; const controls = Array.from(dateDialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]') ?? []); const first=controls[0],last=controls[controls.length-1]; if (event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();} else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();} }

const pickDate = ref(''), pickTime = ref('');
const altitude = computed(() => solarAltitude(time.value, city.value));
const skyMood = computed(() => altitude.value > 0 ? 'Daylight' : altitude.value > -6 ? 'Blue hour' : altitude.value > -18 ? 'Twilight' : 'Deep night');
const moonPhase = computed(() => Math.round(moonIllumination(time.value) * 100));
const layerControls = computed(() => [
  { id:'lines', label:'Constellation lines', active:lines.value, path:'M4 17 9 7l7 5 4-8M4 17l12-5 4 8', circles:true },
  { id:'figures', label:'Constellation figures', active:figures.value, path:'M12 3c-2 0-3 2-3 4l-5 5 2 2 4-3-3 9 3 1 2-6 2 6 3-1-3-9 4 3 2-2-5-5c0-2-1-4-3-4Z' },
  { id:'labels', label:'Object labels', active:labels.value, path:'M4 5h16M12 5v14m-4 0h8' },
  { id:'ground', label:'Horizon', active:ground.value, path:'m3 18 6-9 4 5 3-4 5 8M3 20h18' },
  { id:'planets', label:'Planets', active:showPlanets.value, path:'M8 7a7 7 0 1 1-1 9M3 18c-2-3 15-13 18-10S6 22 3 18Z' },
]);
function toggleLayer(id:string):void { if(id==='lines')lines.value=!lines.value;else if(id==='figures')figures.value=!figures.value;else if(id==='labels')labels.value=!labels.value;else if(id==='ground')ground.value=!ground.value;else showPlanets.value=!showPlanets.value; }
const dayTicks = computed(() => [-48,-24,0,24,48].map(hours => ({ hours, text:new Intl.DateTimeFormat('en',{weekday:'short',timeZone:place.value.zone}).format(base.value+hours*3600000) })));
const visibleTonight = computed(() => {
  const observer=cities[city.value] ?? cities[0];
  return [...planets(time.value),...stars.filter(s=>s.magnitude<1.2)].filter(object => {
    const jd=time.value/86400000+2440587.5;const h=(280.46061837+360.98564736629*(jd-2451545)+observer.lon-object.ra*15)*Math.PI/180;
    const lat=observer.lat*Math.PI/180,dec=object.dec*Math.PI/180;
    return Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(h)>.1;
  }).slice(0,3);
});
function openDate():void { const values=new Intl.DateTimeFormat('en-CA',{timeZone:place.value.zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(time.value);const p=(key:string):string=>values.find(v=>v.type===key)?.value??'00';pickDate.value=p('year')+'-'+p('month')+'-'+p('day');pickTime.value=p('hour')+':'+p('minute');dateOpen.value=true; }
function setDate():void {
  if (!pickDate.value || !pickTime.value) return;
  const intended=Date.parse(pickDate.value+'T'+pickTime.value+':00Z');if(!Number.isFinite(intended))return;
  let candidate=intended;
  for(let i=0;i<2;i++){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:place.value.zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(candidate);const p=(key:string):string=>parts.find(v=>v.type===key)?.value??'00';const represented=Date.parse(p('year')+'-'+p('month')+'-'+p('day')+'T'+p('hour')+':'+p('minute')+':00Z');candidate+=intended-represented;}
  followNow.value=false;playing.value=false;unreportedTime=0;base.value=candidate;offset.value=0;dateOpen.value=false;
}
function scrub():void { followNow.value=false;playing.value=false;unreportedTime=0;sky?.set(state()); }
function pointAt():void { if(selected.value && sky?.fly(selected.value)) {ground.value=false;vision.toast('This object is below the horizon. Horizon hidden for this view.');} }
function keys(event:KeyboardEvent):void {
  if(event.key==='Escape' && (dateOpen.value || selected.value || searchOpen.value)) { event.stopPropagation(); if(dateOpen.value) dateOpen.value=false; else if(selected.value) closeCard(); else searchOpen.value=false; return; }
  if(dateOpen.value || (event.target instanceof HTMLElement && event.target.closest('button,input,select,textarea'))) return;
  if(event.key===' ') {event.preventDefault();playing.value=!playing.value;}else if(event.key.toLowerCase()==='n')now();
}

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
  return object.planet ? object.name==='Moon' ? '≈ '+Math.round(object.distance*9460730472580.8).toLocaleString()+' km' : '≈ '+(object.distance*63241.077).toFixed(2)+' AU' : '≈ ' + object.distance.toLocaleString() + ' light years';
});
const fact = computed(() => selected.value?.fact ?? (selected.value ? 'The light you see left this star about ' + selected.value.distance.toLocaleString() + ' years ago. Its apparent brightness depends on both its luminosity and its distance from Earth.' : ''));
const state = (): SkyState => ({ time: time.value + unreportedTime, city: city.value, lines: lines.value, labels: labels.value, ground: ground.value, planets: showPlanets.value, playing: playing.value, speed:speed.value, figures:figures.value });
function choose(object: SkyObject, fly = true): void {
  if (document.activeElement instanceof HTMLElement) previousFocus = document.activeElement;
  selected.value = object; searchOpen.value = false; query.value = '';
  if (object.planet) showPlanets.value = true;
  if (fly && sky?.fly(object)) { ground.value = false; vision.toast('This object is below the horizon. Horizon hidden for this view.'); }
}
function closeCard(): void { selected.value = undefined; previousFocus?.focus(); }
function now(): void { unreportedTime = 0; followNow.value = true; playing.value = false; base.value = vision.now.value.getTime(); offset.value = 0; }
let lastTimeReport=0;
function advance(milliseconds: number): void {
  unreportedTime+=milliseconds;
  if(performance.now()-lastTimeReport<250)return;
  internalAdvance=true;base.value+=unreportedTime;unreportedTime=0;lastTimeReport=performance.now();internalAdvance=false;
}
let internalAdvance = false;
let unreportedTime = 0;
watch([city,offset,playing,speed,lines,figures,labels,ground,showPlanets], () => sky?.set(state()), { flush: 'sync' });
watch(base, () => { if (!internalAdvance) sky?.set(state()); }, { flush: 'sync' });
watch(time, value => { if (selected.value?.planet) selected.value = planets(value).find(item => item.name === selected.value?.name); });
watch(playing, value => {
  if (value) followNow.value = false;
  else if (unreportedTime > 0) { const pending = unreportedTime; unreportedTime = 0; base.value += pending; }
}, { flush: 'sync' });
watch(() => vision.now.value.getTime(), () => { if (followNow.value && !playing.value) { unreportedTime = 0; base.value = vision.now.value.getTime(); } });
// Opened in daylight, the sky is an empty blue; show tonight's instead, and say so.
function tonight():void {
  if(solarAltitude(time.value,city.value)<=-6)return;
  const values=new Intl.DateTimeFormat('en-CA',{timeZone:place.value.zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(time.value);const p=(key:string):string=>values.find(v=>v.type===key)?.value??'00';
  pickDate.value=p('year')+'-'+p('month')+'-'+p('day');pickTime.value='21:00';setDate();
  vision.toast('It is daytime in '+place.value.name+', so here is tonight’s sky at 9 pm. Press Now to come back.');
}
onMounted(() => {
  tonight();
  appRoot.value?.addEventListener('keydown', keys);
  if (!host.value) return;
  try { sky = new Planetarium(host.value, !!props.compact, state(), object => choose(object,false), advance); }
  catch { error.value = 'WebGL is unavailable. Search the object atlas to explore stars and planets; the interactive sky needs WebGL.'; }
});
watch(() => props.compact, value => sky?.view.setCompact(!!value));
// JARVIS can work in Night Sky: find, now, tonight, lines_on, lines_off.
const stopJarvis = listenAsApp('nightsky', async command => {
  let line = "I can't do that in Night Sky yet.";
  try {
    await nextTick();
    switch (command.action === 'do' ? command.verb : '') {
      case 'find': {
        const normalize = (value: string) => value.toLowerCase().replace(/\b(the|my)\b/g, '').replace(/[^a-z0-9]/g, '');
        const term = normalize(String(command.arg ?? ''));
        const all = [...planets(time.value), ...stars];
        const object = term ? all.find(item => normalize(item.name) === term)
          ?? all.find(item => normalize(item.name).includes(term) || normalize(item.constellation).includes(term)) : undefined;
        if (object) {
          choose(object);
          line = !sky ? 'Selected ' + object.name + '; the interactive sky is unavailable.' : normalize(object.name).includes(term) ? 'Found ' + object.name + ' in ' + object.constellation + '.' : 'Found ' + object.constellation + '; ' + object.name + ' is selected.';
        } else line = "I couldn't find that sky object.";
        break;
      }
      case 'now':
        now();
        line = 'Returned to the current time.';
        break;
      case 'tonight':
        now();
        tonight();
        if (followNow.value) { openDate(); pickTime.value = '21:00'; setDate(); }
        line = 'Showing tonight at 9 pm in ' + place.value.name + '.';
        break;
      case 'lines_on':
      case 'lines_off':
        lines.value = command.verb === 'lines_on';
        line = 'Constellation lines are ' + (lines.value ? 'on.' : 'off.');
        break;
    }
  } catch { line = "I couldn't complete that in Night Sky."; }
  try { if (typeof command.reply === 'function') command.reply?.(line); } catch { /* A reply must not interrupt the app. */ }
});
onBeforeUnmount(() => { stopJarvis(); sky?.dispose(); appRoot.value?.removeEventListener('keydown', keys); });
</script>
<template>
<div ref="appRoot" class="night-app" :class="{ compact, solid:vision.reduceTransparency.value }">
  <div class="night-layout">
    <div ref="host" class="sky-stage" :inert="dateOpen"/>
    <div class="sky-vignette" aria-hidden="true"/>
    <header class="sky-top" :inert="dateOpen"><div class="sky-heading"><p class="eyebrow">YOUR PERSONAL OBSERVATORY</p><h1>Night Sky</h1><p class="sky-status"><i/>{{ skyMood }} <span>·</span> {{ moonPhase }}% moon illumination</p></div><div class="sky-tools"><label class="location vk-ornament"><svg viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></svg><select v-model.number="city" aria-label="Observer location"><option v-for="(item,index) in cities" :key="item.name" :value="index">{{ item.name }}</option></select></label><div class="object-search"><label class="search-field"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input v-model="query" v-hover class="vk-field" type="search" placeholder="Search the sky" aria-label="Search stars and planets" :aria-expanded="searchOpen" aria-controls="sky-search-results" @focus="searchOpen=true" @input="searchOpen=true" @keydown.enter="results[0]&&choose(results[0])"/></label><section v-if="searchOpen" id="sky-search-results" class="search-results vk-sheet vk-scroll" aria-label="Sky search results"><p class="eyebrow">{{ query?'OBJECT ATLAS':'EXPLORE THE SKY' }}</p><button v-for="item in results" :key="item.name" v-hover class="vk-row" @click="choose(item)"><svg viewBox="0 0 24 24"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg><span>{{ item.name }}<small>{{ item.constellation }}</small></span><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button><p v-if="!results.length" class="empty-search">No objects found. Try a star name, a planet, or a constellation such as Orion.</p><button v-hover class="vk-button" @click="searchOpen=false">Done</button></section></div></div></header>
    <aside v-if="!selected&&!searchOpen" class="tonight" :inert="dateOpen"><p class="eyebrow">ABOVE THE HORIZON</p><div><button v-for="object in visibleTonight" :key="object.name" v-hover @click="choose(object)"><i :class="{ planet:object.planet }"/><span>{{ object.name }}</span><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div></aside>
    <p v-if="error" class="sky-error vk-sheet" role="status">{{ error }}</p>
    <section v-if="selected" class="sky-card vk-sheet vk-scroll" :inert="dateOpen" aria-label="Celestial object details"><div class="card-top"><span class="eyebrow">{{ selected.planet?'SOLAR SYSTEM':selected.constellation.toUpperCase() }}</span><button v-hover class="vk-icon plain" aria-label="Dismiss object details" @click="closeCard"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><div class="object-title"><div class="object-portrait" :class="{ moon:selected.name==='Moon',planet:selected.planet, warm:selected.bv>1 }" aria-hidden="true"><i/><b v-if="selected.name==='Saturn'"/></div><div><h2>{{ selected.name }}</h2><p>{{ selected.planet ? selected.name==='Moon'?'Earth’s natural satellite':'Planet' : 'Bright-star atlas' }}</p></div></div><p class="object-fact">{{ fact }}</p><dl><div><dt>Distance</dt><dd>{{ distance }}</dd></div><div><dt>Magnitude</dt><dd>{{ selected.magnitude.toFixed(2) }}<small v-if="selected.planet">typical</small></dd></div><div v-if="selected.name==='Moon'"><dt>Illuminated</dt><dd>{{ moonPhase }}%</dd></div><div v-else><dt>Constellation</dt><dd>{{ selected.constellation }}</dd></div></dl><button v-hover class="vk-button point-button" @click="pointAt"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg>Point at it</button><p class="atlas-note">{{ selected.planet?'Approximate orbital model. Disc and glow sizes are illustrative.':'Rounded catalogue values. Multiple systems appear as one point.' }}</p></section>
    <div class="sky-bottom" :inert="dateOpen"><div class="sky-footer-line"><p>Drag to explore <span>·</span> Scroll to zoom <span>·</span> Tap a star</p><span>SKY FROM NASA DEEP STAR MAPS · {{ stars.length }} NAMED STARS</span></div><section class="time-strip vk-ornament" aria-label="Time machine"><div class="time-row"><button v-hover class="time-readout" aria-label="Choose date and time" @click="openDate"><span class="eyebrow">{{ followNow?'LIVE SKY':'TIME MACHINE' }}</span><strong>{{ timestamp }}</strong><small>{{ place.name }} · {{ Math.abs(place.lat).toFixed(2) }}° {{ place.lat>=0?'N':'S' }} · {{ Math.abs(place.lon).toFixed(2) }}° {{ place.lon>=0?'E':'W' }}</small></button><div class="time-actions"><button v-hover class="vk-button now-button" :aria-pressed="followNow" @click="now">Now</button><label class="speed-select"><select v-model.number="speed" aria-label="Time playback speed"><option :value="1">1×</option><option :value="60">60×</option><option :value="3600">3600×</option></select></label><button v-hover class="vk-icon play-button" :aria-label="playing?'Pause time':'Play time at '+speed+' times speed'" :aria-pressed="playing" @click="playing=!playing"><svg viewBox="0 0 24 24"><path v-if="playing" d="M8 5v14M16 5v14"/><path v-else d="m8 4 12 8-12 8Z"/></svg></button></div><div class="sky-switches" aria-label="Sky layers"><button v-for="layer in layerControls" :key="layer.id" v-hover class="vk-icon plain" :title="layer.label" :aria-label="layer.label" :aria-pressed="layer.active" @click="toggleLayer(layer.id)"><svg viewBox="0 0 24 24"><path :d="layer.path"/><template v-if="layer.circles"><circle cx="4" cy="17" r="1.5"/><circle cx="9" cy="7" r="1.5"/><circle cx="16" cy="12" r="1.5"/></template></svg></button></div></div><div class="scrubber"><input v-model.number="offset" class="vk-slider" type="range" min="-48" max="48" step=".025" :style="{ '--value':(offset+48)/96 }" aria-label="Scrub time over four days" :aria-valuetext="timestamp" @input="scrub"/><div class="day-ticks"><button v-for="tick in dayTicks" :key="tick.hours" :aria-label="tick.text+', '+tick.hours+' hours from base time'" @click="offset=tick.hours;scrub()"><i/>{{ tick.text }}<small>{{ tick.hours===0?'Reference':tick.hours<0?tick.hours/24+'d':'+'+tick.hours/24+'d' }}</small></button></div></div></section></div>
    <div v-if="dateOpen" class="date-overlay" @click.self="dateOpen=false"><form ref="dateDialog" @keydown="dialogKeys" class="date-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true" aria-labelledby="sky-date-title" @submit.prevent="setDate"><div class="card-top"><h2 id="sky-date-title">Travel through time</h2><button v-hover type="button" class="vk-icon" aria-label="Close date picker" @click="dateOpen=false"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><p>View the sky above {{ place.name }} at a different moment.</p><label>Date<input v-model="pickDate" class="vk-field" type="date" min="1900-01-01" max="2100-12-31" required/></label><label>Local time<input v-model="pickTime" class="vk-field" type="time" required/></label><button v-hover type="submit" class="vk-button primary">Show this sky</button></form></div>
  </div>
</div>
</template>
<style src="../kit/kit.css"></style>
<style src="./nightsky/night.css" scoped></style>
