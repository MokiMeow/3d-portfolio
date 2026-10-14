<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import { objects, type ObjectId } from './objects/models';
import { ObjectStage } from './objects/stage';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const host = ref<HTMLElement>();
const list = ref<HTMLElement>();
const selected = ref<ObjectId>('walle');
const rotate = ref(true);
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
function choose(id: ObjectId): void { selected.value = id; explode.value = false; void stage?.select(id); }
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
    void stage.select(selected.value);
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
onBeforeUnmount(() => { observer?.disconnect(); stage?.dispose(); });
</script>

<template>
  <div class="objects-app" :class="{ compact, night, solid: vision.reduceTransparency.value }">
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
      <div ref="host" class="object-stage" />
      <div class="stage-heading"><span class="vk-chip">{{ String(objects.findIndex(item => item.id === selected)+1).padStart(2,'0') }} / 07</span><p class="vk-footnote vk-secondary">Drag to orbit · pinch or scroll to zoom</p></div>
      <div class="view-controls vk-ornament" aria-label="View controls"><button v-hover class="vk-icon" aria-label="Zoom out" @click="stage?.zoom(.5)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><button v-hover class="vk-icon" aria-label="Reset object view" @click="stage?.reset()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/></svg></button><button v-hover class="vk-icon" aria-label="Zoom in" @click="stage?.zoom(-.5)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg></button></div>
      <p v-if="status || error" class="object-status vk-sheet" role="status">{{ error || status }}<button v-if="failed && !error" v-hover class="vk-button" @click="choose(selected)">Try again</button></p>
      <div class="object-caption"><h2 class="vk-title">{{ current.name }}</h2><p class="vk-body">{{ current.caption }}</p><p class="vk-footnote vk-secondary">{{ current.detail }}</p></div>
      <div class="object-ornament vk-ornament" aria-label="Object controls">
        <button v-hover class="vk-button" :aria-pressed="rotate" @click="rotate = !rotate"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-14 0M19 3v5h-5M5 16a8 8 0 0 0 14 0M5 21v-5h5"/></svg><span>Rotate</span></button>
        <button v-hover class="vk-button" :aria-pressed="explode" @click="explode = !explode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-5-5m0 4V3h4m9 5 5-5m-4 0h4v4M8 16l-5 5m0-4v4h4m9-5 5 5m-4 0h4v-4M9 9h6v6H9Z"/></svg><span>Explode</span></button>
        <button v-hover class="vk-button" :aria-pressed="wireframe" @click="wireframe = !wireframe"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5m-9 5v8M3 8l18 8M21 8 3 16"/></svg><span>Wireframe</span></button>
        <button v-hover class="vk-button" :aria-pressed="night" @click="night = !night"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/></svg><span>{{ night ? 'Night' : 'Day' }}</span></button>
        <button v-hover class="vk-button primary place-button" @click="vision.toast('Placed. It looks right at home.')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5m-9-9 5 3v5l-5 3-5-3v-5l5-3Zm-5 3 5 3 5-3m-5 3v5"/></svg><span>Place in room</span></button>
      </div>
    </main>
  </div>
</template>

<style src="../kit/kit.css"></style>
<style src="./objects/objects.css" scoped></style>
