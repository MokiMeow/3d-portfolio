<script setup lang="ts">
import VisionIcon from './VisionIcon.vue';
import type { VisionAppId } from './vision';

/** Spotlight: one field that finds apps, places, people and quick actions, like visionOS search. */
export type SpotlightResult =
  | { kind: 'app'; id: VisionAppId; title: string; note: string }
  | { kind: 'place'; id: string; title: string; note: string }
  | { kind: 'action'; id: 'dark' | 'solid' | 'capture' | 'recentre' | 'closeAll' | 'widgets' | 'siri' | 'home' | 'sound'; title: string; note: string }
  | { kind: 'person'; id: string; title: string; note: string }
  | { kind: 'web'; id: string; title: string; note: string };

const props = defineProps<{
  apps: readonly { id: VisionAppId; name: string }[];
  environments: readonly { id: string; name: string; line: string }[];
  people: readonly { name: string; line: string }[];
  compact: boolean;
}>();
const emit = defineEmits<{ pick: [result: SpotlightResult] }>();

const open = ref(false);
const query = ref('');
const active = ref(0);
const field = ref<HTMLInputElement>();

// Words that people type for apps whose names they do not remember.
const ALIASES: Partial<Record<VisionAppId, string>> = {
  tv: 'movies films apple tv watch', youtube: 'videos', photos: 'pictures gallery memories', safari: 'browser web internet',
  music: 'songs audio player', notes: 'write text memo', mindfulness: 'breathe calm meditate', mac: 'computer desktop screen',
  freeform: 'whiteboard board draw canvas', settings: 'preferences options', messages: 'chat text sms', files: 'documents folders',
  encounter: 'dinosaurs dino', store: 'app store download', arcade: 'games play pinball minecraft', facetime: 'call video persona',
  weather: 'forecast rain sun', maps: 'directions navigation city', clock: 'alarm timer stopwatch time', keynote: 'slides presentation deck',
  nightsky: 'stars planets astronomy constellations', objects: 'models 3d wall-e', beatstudio: 'drums music beats synth', zengarden: 'sand relax rake', gravity: 'physics playground blocks drop throw',
};
const ACTIONS: SpotlightResult[] = [
  { kind: 'action', id: 'dark', title: 'Dark environments', note: 'Turn the evening look on or off' },
  { kind: 'action', id: 'solid', title: 'Solid glass', note: 'Reduce transparency' },
  { kind: 'action', id: 'sound', title: 'Environment sound', note: 'Turn ambient sound on or off' },
  { kind: 'action', id: 'capture', title: 'Capture', note: 'Take a picture of your view' },
  { kind: 'action', id: 'recentre', title: 'Recentre', note: 'Bring windows back in front of you' },
  { kind: 'action', id: 'closeAll', title: 'Close all apps', note: 'Clear your space' },
  { kind: 'action', id: 'widgets', title: 'Add a widget', note: 'Pin something to your room' },
  { kind: 'action', id: 'siri', title: 'Ask Siri', note: 'Hold the Digital Crown or press Alt + Space' },
  { kind: 'action', id: 'home', title: 'Home View', note: 'All your apps' },
];

function score(text: string, words: string[]): number {
  const hay = text.toLowerCase();
  let total = 0;
  for (const word of words) {
    const at = hay.indexOf(word);
    if (at < 0) return 0;
    total += at === 0 ? 3 : hay[at - 1] === ' ' ? 2 : 1;
  }
  return total;
}
const results = computed<SpotlightResult[]>(() => {
  const words = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const found: { result: SpotlightResult; score: number }[] = [];
  for (const app of props.apps) {
    const s = score(app.name, words) * 2 || score(`${app.name} ${ALIASES[app.id] ?? ''}`, words);
    if (s) found.push({ result: { kind: 'app', id: app.id, title: app.name, note: 'Application' }, score: s + 3 });
  }
  for (const place of props.environments) {
    const s = score(`${place.name} ${place.line} environment place`, words);
    if (s) found.push({ result: { kind: 'place', id: place.id, title: place.name, note: place.line }, score: s + 1 });
  }
  for (const person of props.people) {
    const s = score(`${person.name} ${person.line} people contact`, words);
    if (s) found.push({ result: { kind: 'person', id: person.name, title: person.name, note: person.line }, score: s });
  }
  for (const action of ACTIONS) {
    const s = score(`${action.title} ${action.note}`, words);
    if (s) found.push({ result: action, score: s });
  }
  found.sort((a, b) => b.score - a.score);
  const list = found.slice(0, 9).map(item => item.result);
  list.push({ kind: 'web', id: query.value.trim(), title: `Search the web for “${query.value.trim()}”`, note: 'Safari' });
  return list;
});
const groups = computed(() => {
  const order: [SpotlightResult['kind'], string][] = [['app', 'Apps'], ['place', 'Environments'], ['person', 'People'], ['action', 'Actions'], ['web', 'Web']];
  const top = results.value[0] && results.value[0].kind !== 'web' ? results.value[0] : null;
  const rest = top ? results.value.slice(1) : results.value;
  return {
    top,
    sections: order.map(([kind, title]) => ({ kind, title, items: rest.filter(item => item.kind === kind) })).filter(section => section.items.length),
  };
});
const flat = computed(() => [groups.value.top, ...groups.value.sections.flatMap(section => section.items)].filter((item): item is SpotlightResult => !!item));
watch(query, () => { active.value = 0; });

function show() {
  open.value = true;
  query.value = '';
  void nextTick(() => field.value?.focus());
}
function hide() { open.value = false; }
function choose(result: SpotlightResult) { hide(); emit('pick', result); }
function keys(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); hide(); }
  else if (event.key === 'ArrowDown') { event.preventDefault(); active.value = Math.min(flat.value.length - 1, active.value + 1); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); active.value = Math.max(0, active.value - 1); }
  else if (event.key === 'Enter') { event.preventDefault(); const item = flat.value[active.value]; if (item) choose(item); }
}
const isActive = (item: SpotlightResult) => flat.value[active.value] === item;
const SUGGESTIONS = ['Night Sky', 'The Moon', 'Arcade', 'Dark', 'Widgets', 'Beat Studio'];
defineExpose({ show, hide, open });
</script>

<template>
  <Transition name="spot">
    <div v-if="open" class="spot-veil" @pointerdown.self="hide">
      <section class="spotlight" :class="{ compact }" role="dialog" aria-label="Spotlight search" @keydown="keys">
        <label class="spot-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm4.8 11.3L20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          <input ref="field" v-model="query" type="search" placeholder="Search apps, places and more" aria-label="Search" autocomplete="off" spellcheck="false">
          <kbd v-if="!compact">esc</kbd>
        </label>
        <div v-if="!query.trim()" class="spot-suggest">
          <small>Suggestions</small>
          <div><button v-for="item in SUGGESTIONS" :key="item" @click="query = item">{{ item }}</button></div>
        </div>
        <div v-else class="spot-results" role="listbox">
          <button v-if="groups.top" class="spot-top" role="option" :aria-selected="isActive(groups.top)" :class="{ on: isActive(groups.top) }" @click="choose(groups.top)" @pointerenter="active = 0">
            <span class="spot-art big">
              <VisionIcon v-if="groups.top.kind === 'app'" :name="groups.top.id" />
              <img v-else-if="groups.top.kind === 'place' && groups.top.id !== 'room'" :src="`/vision/env/${groups.top.id}-thumb.webp`" alt="">
              <i v-else class="glyph">{{ groups.top.title.charAt(0) }}</i>
            </span>
            <span><small>Top Hit</small><b>{{ groups.top.title }}</b><em>{{ groups.top.note }}</em></span>
          </button>
          <template v-for="section in groups.sections" :key="section.kind">
            <h3>{{ section.title }}</h3>
            <button v-for="item in section.items" :key="item.kind + item.id" class="spot-row" role="option" :aria-selected="isActive(item)" :class="{ on: isActive(item) }"
              @click="choose(item)" @pointerenter="active = flat.indexOf(item)">
              <span class="spot-art">
                <VisionIcon v-if="item.kind === 'app'" :name="item.id" />
                <img v-else-if="item.kind === 'place' && item.id !== 'room'" :src="`/vision/env/${item.id}-thumb.webp`" alt="">
                <svg v-else-if="item.kind === 'web'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="M3.5 12h17M12 3.5c2.6 2.6 3.6 5.3 3.6 8.5s-1 5.9-3.6 8.5c-2.6-2.6-3.6-5.3-3.6-8.5s1-5.9 3.6-8.5Z" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
                <i v-else class="glyph">{{ item.title.charAt(0) }}</i>
              </span>
              <span><b>{{ item.title }}</b><em>{{ item.note }}</em></span>
            </button>
          </template>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.spot-veil { position: absolute; inset: 0; z-index: 7800; display: flex; justify-content: center; align-items: flex-start; padding-top: 88px; background: rgb(0 0 0 / .18); }
.spotlight { width: min(620px, calc(100vw - 24px)); max-height: calc(100% - 200px); display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; border-radius: 34px; color: #fff;
  background: linear-gradient(135deg, rgb(255 255 255 / .2), rgb(255 255 255 / .05)), rgb(44 46 52 / .8); backdrop-filter: blur(44px) saturate(140%); -webkit-backdrop-filter: blur(44px) saturate(140%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .3), inset 0 0 0 1px rgb(255 255 255 / .15), 0 40px 100px rgb(0 0 0 / .45); }
.spot-field { display: flex; align-items: center; gap: 12px; height: 70px; padding: 0 22px; border-bottom: 1px solid rgb(255 255 255 / .1); }
.spot-field svg { width: 24px; height: 24px; opacity: .7; flex: none; }
.spot-field input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: #fff; font: 400 22px/1 inherit; letter-spacing: -.01em; }
.spot-field input::placeholder { color: rgb(255 255 255 / .45); }
.spot-field input::-webkit-search-cancel-button { display: none; }
.spot-field kbd { padding: 3px 8px; border-radius: 8px; background: rgb(255 255 255 / .12); font: 500 11px/1.2 inherit; color: rgb(255 255 255 / .6); }
.spot-suggest { padding: 16px 22px 20px; }
.spot-suggest small, .spot-results h3 { display: block; margin: 0 0 10px; font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: rgb(255 255 255 / .5); }
.spot-suggest div { display: flex; flex-wrap: wrap; gap: 8px; }
.spot-suggest button { height: 38px; padding: 0 16px; border-radius: 19px; background: rgb(255 255 255 / .1); color: #fff; font-size: 14px; transition: background .15s; }
.spot-suggest button:hover { background: rgb(255 255 255 / .2); }
.spot-results { overflow-y: auto; padding: 12px 12px 16px; scrollbar-width: none; }
.spot-results h3 { margin: 14px 10px 6px; }
.spot-top, .spot-row { display: flex; align-items: center; gap: 14px; width: 100%; padding: 8px 10px; border-radius: 18px; text-align: left; color: #fff; transition: background .12s; }
.spot-top { padding: 12px; }
.spot-top.on, .spot-row.on { background: rgb(255 255 255 / .16); }
.spot-art { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; overflow: hidden; }
.spot-art.big { width: 64px; height: 64px; }
.spot-art img { width: 100%; height: 100%; object-fit: cover; }
.spot-art svg { width: 24px; height: 24px; }
.spot-art .glyph { width: 100%; height: 100%; display: grid; place-items: center; background: rgb(255 255 255 / .14); font-style: normal; font-weight: 600; font-size: 17px; }
.spot-top span:last-child, .spot-row span:last-child { display: grid; min-width: 0; }
.spot-top small { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: rgb(255 255 255 / .55); }
.spot-top b { font-size: 21px; font-weight: 600; }
.spot-row b { font-size: 15px; font-weight: 500; }
.spot-top em, .spot-row em { font-style: normal; font-size: 13px; color: rgb(255 255 255 / .6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.compact.spotlight { border-radius: 26px; }
.compact .spot-field { height: 58px; }
.compact .spot-field input { font-size: 18px; }
.spot-enter-active, .spot-leave-active { transition: opacity .22s ease; }
.spot-enter-active .spotlight, .spot-leave-active .spotlight { transition: transform .3s cubic-bezier(.2, .9, .3, 1.1); }
.spot-enter-from, .spot-leave-to { opacity: 0; }
.spot-enter-from .spotlight, .spot-leave-to .spotlight { transform: translateY(-14px) scale(.97); }
@media (prefers-reduced-motion: reduce) { .spot-enter-active, .spot-leave-active, .spot-enter-active .spotlight, .spot-leave-active .spotlight { transition: none; } }
</style>
