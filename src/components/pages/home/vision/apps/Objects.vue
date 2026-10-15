<script setup lang="ts">
import { listenAsApp, openVolume } from '../bus';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { objects, type ObjectId } from './objects/models';
import { ObjectStage, type StageBounds, type StageFinish } from './objects/stage';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const host = ref<HTMLElement>();
const list = ref<HTMLElement>();
const selected = ref<ObjectId>('walle');
const rotate = ref(false);
const inspect = ref(true), measurements = ref(false), annotations = ref(false);
const activeHotspot = ref(0), finish = ref<StageFinish>('Original');
const bounds = ref<StageBounds>();
const finishes: {name:StageFinish;color:string}[]=[{name:'Original',color:'#a6b7a2'},{name:'Porcelain',color:'#ebe7dc'},{name:'Graphite',color:'#4f565c'},{name:'Copper',color:'#ba805c'}];
const details: Record<ObjectId, {materials:string;points:readonly [string,string,string]}> = {
 walle:{materials:'Weathered paint · dark treads · glass lenses',points:['Binocular lenses','Weathered shell','Track assembly']},
 watch:{materials:'Titanium tones · sapphire-like glass · woven band',points:['Digital Crown','Display housing','Woven loop']},
 phone:{materials:'Polished glass · satin frame · charging stand',points:['Camera housing','Glass front','Charging stand']},
 headset:{materials:'Curved glass · aluminum tones · woven fabric',points:['Curved front glass','Light Seal','Knit band']},
 turntable:{materials:'Wood tones · vinyl · brushed metal',points:['Tonearm','Vinyl grooves','Plinth']},
 ps5:{materials:'Matte white panels · glossy core · blue seams',points:['Sculpted panel','Dark core','Blue light seam']},
 controller:{materials:'Matte polymer · dark grips · soft blue light',points:['Touchpad','Analog sticks','Grip contour']}
};
async function loadSelected(id:ObjectId): Promise<void> { await stage?.select(id); if(selected.value===id) bounds.value=stage?.bounds(); }
function setFinish(value:StageFinish): void { finish.value=value; stage?.setFinish(value); }
function toggleInspection(): void { inspect.value=!inspect.value; }
function sceneKeys(event:KeyboardEvent): void { if(event.target instanceof HTMLInputElement) return; if(event.key.toLowerCase()==='m') measurements.value=!measurements.value; if(event.key.toLowerCase()==='i') toggleInspection(); }

const explode = ref(false);
const wireframe = ref(false);
const night = ref(false);
const status = ref('Preparing your close-up…');
const error = ref('');
const failed = ref(false);
const thumbnails = ref<Partial<Record<ObjectId,string>>>({});
const current = computed(() => objects.find(item => item.id === selected.value) ?? objects[0]);
let stage: ObjectStage | undefined;
let observer: IntersectionObserver | undefined;
function choose(id: ObjectId): void { selected.value = id; explode.value = false; bounds.value=undefined; activeHotspot.value=0; void loadSelected(id); }
function settings(): void { stage?.set({ rotate: rotate.value, explode: explode.value, wireframe: wireframe.value, night: night.value }); }
watch([rotate,explode,wireframe,night],settings);
function listKeys(event: KeyboardEvent): void {
  if (!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return;
  const buttons = [...(list.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length) % buttons.length;
  event.preventDefault(); buttons[next]?.focus(); buttons[next]?.click();
}
onMounted(() => {
  if (!host.value) return;
  try {
    stage = new ObjectStage(host.value, !!props.compact, { rotate: rotate.value, explode: false, wireframe: false, night: false }, (message,loadFailed) => { status.value = message; failed.value = !!loadFailed; }, (id,url) => { thumbnails.value[id] = url; });
    void loadSelected(selected.value);
    observer = new IntersectionObserver(entries => { for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const id = entry.target.getAttribute('data-object');
      if (objects.some(item => item.id === id)) stage?.requestThumbnail(id as ObjectId);
      observer?.unobserve(entry.target);
    } }, { root: list.value });
    list.value?.querySelectorAll('[data-object]').forEach(row => observer?.observe(row));
  } catch { error.value = 'This close-up needs WebGL. The object collection is still here to browse.'; status.value = ''; }
});
watch(() => props.compact, value => stage?.view.setCompact(!!value));
// JARVIS can work in Objects: show.
const stopJarvis = listenAsApp('objects', async command => {
  let line = "I can't do that in Objects yet.";
  try {
    await nextTick();
    if (command.action === 'do' && command.verb === 'show') {
      const normalize = (value: string) => value.toLowerCase().replace(/\b(the|my)\b/g, '').replace(/[^a-z0-9]/g, '');
      const term = normalize(String(command.arg ?? ''));
      const object = term ? objects.find(item => normalize(item.id) === term || normalize(item.name) === term)
        ?? objects.find(item => normalize(item.id).includes(term) || normalize(item.name).includes(term)) : undefined;
      if (object) {
        selected.value = object.id; explode.value = false; bounds.value = undefined; activeHotspot.value = 0;
        await loadSelected(object.id);
        line = selected.value !== object.id ? 'The selected object changed before it finished loading.'
          : !stage || failed.value ? 'Selected ' + object.name + ', but its 3D view is unavailable.' : 'Showing ' + object.name + '.';
      } else line = "I couldn't find that model in Objects.";
    }
  } catch { line = "I couldn't complete that in Objects."; }
  try { if (typeof command.reply === 'function') command.reply?.(line); } catch { /* A reply must not interrupt the app. */ }
});
onBeforeUnmount(() => { stopJarvis(); observer?.disconnect(); stage?.dispose(); });
</script>

<template>
  <div class="objects-app vk-scroll" :class="{ compact, night, inspecting:inspect, solid: vision.reduceTransparency.value }" tabindex="-1" aria-label="Objects inspection workspace" @keydown="sceneKeys">
    <aside class="object-sidebar vk-platter">
      <div class="collection-heading"><p class="eyebrow">THE ROOM, A LITTLE CLOSER</p><h1 class="vk-large-title">Objects</h1><p class="vk-footnote vk-secondary">Seven things. All the little details.</p></div>
      <nav ref="list" class="object-list vk-scroll" aria-label="Object collection" @keydown="listKeys">
        <button v-for="item in objects" :key="item.id" v-hover class="vk-row object-row" :class="{ selected: selected === item.id }" :data-object="item.id" :aria-pressed="selected === item.id" @click="choose(item.id)">
          <span class="object-thumb vk-well"><img v-if="thumbnails[item.id]" :src="thumbnails[item.id]" alt="" width="56" height="56" draggable="false"/><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v8"/></svg></span>
          <span class="object-name"><strong>{{ item.name }}</strong><small class="vk-secondary">{{ item.category }}</small></span>
        </button>
      </nav>
      <p class="collection-note vk-footnote vk-tertiary">Room models · a simulated Quick Look</p>
    </aside>
    <main class="object-main">
      <div class="view-port"><div class="studio-glow" aria-hidden="true"/><div ref="host" class="object-stage"/><svg v-if="measurements && bounds" class="measurement-overlay" viewBox="0 0 500 350" role="img" :aria-label="'Model bounds: '+bounds.width.toFixed(2)+' wide, '+bounds.height.toFixed(2)+' high, '+bounds.depth.toFixed(2)+' deep. Scene units, not physical dimensions.'"><g stroke="#d6e9dc" fill="none" stroke-width="1.2"><path d="M110 84V292M102 84h16M102 292h16M137 314h227M137 306v16M364 306v16"/><path d="M122 84h22M122 292h22M137 292v13M364 292v13" stroke-dasharray="3 4" opacity=".5"/></g><g fill="#dceee2" font-size="11" text-anchor="middle"><text x="83" y="190" transform="rotate(-90 83 190)">{{ bounds.height.toFixed(2) }} u</text><text x="251" y="338">{{ bounds.width.toFixed(2) }} u</text></g></svg><div v-if="annotations" class="hotspots"><button v-for="(label,i) in details[selected].points" :key="label" v-hover class="hotspot" :class="{active:activeHotspot===i}" :style="{left:[53,40,62][i]+'%',top:[26,48,67][i]+'%'}" :aria-label="label" :aria-pressed="activeHotspot===i" @click="activeHotspot=i; inspect=true">{{ i+1 }}</button></div></div>
      <div class="stage-heading"><span class="vk-chip">{{ String(objects.findIndex(item => item.id === selected)+1).padStart(2,'0') }} / 07</span><p class="vk-footnote vk-secondary">Drag to orbit · pinch or scroll to zoom</p><button v-hover class="vk-icon inspector-toggle" aria-label="Toggle object inspector" :aria-pressed="inspect" @click="toggleInspection"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/></svg></button></div>
      <aside v-if="inspect" class="inspection-panel vk-platter vk-scroll"><header><p>OBJECT INSPECTOR</p><span class="vk-chip">3D</span></header><h3>{{ current.name }}</h3><p class="materials-copy">{{ details[selected].materials }}</p><div class="inspection-section"><h4>Studio finish</h4><div class="material-swatches"><button v-for="look in finishes" :key="look.name" v-hover :aria-pressed="finish===look.name" :aria-label="look.name+' finish'" @click="setFinish(look.name)"><i :style="{background:look.name==='Original' ? 'linear-gradient(135deg,#e5cc95,#758f84)' : look.color}"/><span>{{ look.name }}</span></button></div><small>Appearance study · {{ finish }}</small></div><div class="inspection-section"><h4>Inspect details</h4><button v-hover class="inspection-toggle" :aria-pressed="measurements" @click="measurements=!measurements"><svg viewBox="0 0 24 24"><path d="m4 16 12-12 4 4L8 20Zm3-3 2 2m1-5 2 2m1-5 2 2"/></svg>Measurements<span>{{ measurements ? 'On' : 'Off' }}</span></button><button v-hover class="inspection-toggle" :aria-pressed="annotations" @click="annotations=!annotations"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 11v6M12 7h.1"/></svg>Annotations<span>{{ annotations ? 'On' : 'Off' }}</span></button><div v-if="measurements && bounds" class="bounds-grid"><span v-for="axis in (['width','height','depth'] as const)" :key="axis"><small>{{ axis }}</small><strong>{{ bounds[axis].toFixed(2) }} <em>u</em></strong></span></div><p v-if="measurements" class="inspection-note">Scene units after model normalization. These are not physical product dimensions.</p><div v-if="annotations" class="annotation-note vk-well"><span>0{{ activeHotspot+1 }} · DETAIL</span><strong>{{ details[selected].points[activeHotspot] }}</strong><p>Illustrative callout. Orbit the model to explore its construction.</p></div></div><footer>Quick Look study <span>Room collection</span></footer></aside>
      <div class="view-controls vk-ornament" aria-label="View controls"><button v-hover class="vk-icon" aria-label="Zoom out" @click="stage?.zoom(.5)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><button v-hover class="vk-icon" aria-label="Reset object view" @click="stage?.reset()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg></button><button v-hover class="vk-icon" aria-label="Zoom in" @click="stage?.zoom(-.5)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button></div>
      <p v-if="status || error" class="object-status vk-sheet" role="status">{{ error || status }}<button v-if="failed && !error" v-hover class="vk-button" @click="choose(selected)">Try again</button></p>
      <div class="object-caption"><h2 class="vk-title">{{ current.name }}</h2><p class="vk-body">{{ current.caption }}</p><p class="vk-footnote vk-secondary">{{ current.detail }}</p></div>
      <div class="object-ornament vk-ornament" aria-label="Object controls">
        <button v-hover class="vk-button" :aria-pressed="rotate" @click="rotate = !rotate"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-14 0M19 3v5h-5M5 16a8 8 0 0 0 14 0M5 21v-5h5"/></svg><span>Rotate</span></button>
        <button v-hover class="vk-button" :aria-pressed="explode" @click="explode = !explode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-5-5m0 4V3h4m9 5 5-5m-4 0h4v4M8 16l-5 5m0-4v4h4m9-5 5 5m-4 0h4v-4M9 9h6v6H9Z"/></svg><span>Explode</span></button>
        <button v-hover class="vk-button" :aria-pressed="wireframe" @click="wireframe = !wireframe"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v8M3 8l18 8M21 8 3 16"/></svg><span>Wireframe</span></button>
        <button v-hover class="vk-button" :aria-pressed="night" @click="night = !night"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/></svg><span>{{ night ? 'Night' : 'Day' }}</span></button>
        <button v-hover class="vk-button primary place-button" @click="openVolume(selected)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5m-9-9 5 3v5l-5 3-5-3v-5l5-3Zm-5 3 5 3 5-3m-5 3v5"/></svg><span>Place in room</span></button>
      </div>
    </main>
  </div>
</template>

<style src="../kit/kit.css"></style>
<style src="./objects/objects.css" scoped></style>
