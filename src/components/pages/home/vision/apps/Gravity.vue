<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import Glyph from './gravity/Glyph.vue';
import ToyArt from './gravity/ToyArt.vue';
import { gravities, objects, presets, surfaces, type GravityMode, type ObjectKind, type ObjectInspection, type PlaygroundStats, type Preset, type Surface } from './gravity/catalog';
import type { GravityStage } from './gravity/stage';

const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION);
const app = ref<HTMLElement>();
const host = ref<HTMLElement>();
const searchField = ref<HTMLInputElement>();
const ready = ref(false);
const error = ref('');
const tool = ref<ObjectKind>('cube');
const surface = ref<Surface>('plastic');
const gravity = ref<GravityMode>('earth');
const slow = ref(false);
const paused = ref(false);
const sound = ref(vision?.sound.value ?? false);
const panel = ref<'materials' | 'gravity' | 'presets' | 'library' | 'help' | 'object' | null>(null);
const search = ref('');
const inspection = ref<ObjectInspection | null>(null);
const inspected = computed(() => objects.find(item => item.id === inspection.value?.kind));
const stats = ref<PlaygroundStats>({ count: 0, awake: 0, state: 'resting' });
const experiment = ref<Preset | null>(null);
const sheet = ref<HTMLElement>();
const notice = ref('Pick a shape. Make a little magic.');
const current = computed(() => objects.find(item => item.id === tool.value)!);
const finish = computed(() => surfaces.find(item => item.id === surface.value)!);
const field = computed(() => gravities.find(item => item.id === gravity.value)!);
const results = computed(() => objects.filter(item => (item.name + ' ' + item.detail).toLowerCase().includes(search.value.toLowerCase())));
const experimentLabel = computed(() => experiment.value === 'bowling' ? 'Roll the ball' : experiment.value === 'domino' ? 'Start the run' : 'Topple tower');
let stage: GravityStage | undefined;
let disposed = false;
let returnFocus: HTMLElement | null = null;
let noticeTimer = 0;

function announce(message: string): void {
  notice.value = message;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => { notice.value = 'Tap to drop · hold to sprinkle · drag to throw'; }, 4500);
}
function choose(kind: ObjectKind): void {
  tool.value = kind;
  stage?.setTool(kind, surface.value);
  announce(current.value.name + ' selected. Tap the studio to drop one.');
}
function material(value: Surface): void {
  surface.value = value; stage?.setTool(tool.value, value);
  closePanel(); announce(finish.value.name + ' selected for your next objects.');
}
function setGravity(value: GravityMode): void {
  gravity.value = value; stage?.setGravity(value); closePanel();
  announce(field.value.name + ' gravity · ' + field.value.label);
}
function preset(value: Preset): void {
  experiment.value = value; paused.value = false; stage?.setPaused(false);
  stage?.loadPreset(value); closePanel();
  announce(presets.find(item => item.id === value)!.description);
}
function action(value: 'clear' | 'tidy' | 'explode'): void {
  stage?.[value]();
  if (value === 'clear') experiment.value = null;
  announce(value === 'clear' ? 'A fresh start. Your next idea goes here.' : value === 'tidy' ? 'A little order, ready for more play.' : 'A small burst of beautiful chaos.');
}
function inspectAction(value: 'duplicate' | 'remove' | 'pop'): void {
  if (inspection.value) stage?.inspectObject(inspection.value.id, value);
  closePanel(); announce(value === 'remove' ? 'Object removed.' : value === 'duplicate' ? 'One more, just like it.' : 'A little lift.');
}
function togglePause(): void { paused.value = !paused.value; stage?.setPaused(paused.value); }
function toggleSlow(): void { slow.value = !slow.value; stage?.setSlow(slow.value); }
function toggleSound(): void { sound.value = !sound.value; stage?.setSound(sound.value); stage?.unlockSound(); }
function closePanel(): void { panel.value = null; void nextTick(() => returnFocus?.focus({ preventScroll: true })); }
async function showPanel(value: NonNullable<typeof panel.value>): Promise<void> {
  if (panel.value === value) { closePanel(); return; }
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  panel.value = value; search.value = '';
  await nextTick();
  if (value === 'library') searchField.value?.focus();
  else sheet.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
}
function sheetKeys(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const targets = Array.from(sheet.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input,[tabindex="0"]') ?? []);
  const first = targets[0], last = targets[targets.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function keys(event: KeyboardEvent): void {
  if (event.key === 'Escape' && panel.value) { event.stopPropagation(); event.preventDefault(); closePanel(); return; }
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.ctrlKey || event.metaKey || event.altKey) return;
  if (panel.value) return;
  if (event.code === 'Space' && event.target === host.value) { event.preventDefault(); event.stopPropagation(); togglePause(); }
  else if (event.key.toLowerCase() === 's') { event.preventDefault(); toggleSlow(); }
  else if (event.key.toLowerCase() === 'e') { event.preventDefault(); action('explode'); }
  else if (event.key.toLowerCase() === 't') { event.preventDefault(); action('tidy'); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); action('clear'); }
  else if (event.key === '?' || event.key === '/') { event.preventDefault(); event.stopPropagation(); void showPanel(event.key === '?' ? 'help' : 'library'); }
  else if (/^[1-9]$/.test(event.key)) { const item = objects[Number(event.key) - 1]; if (item) choose(item.id); }
  else if (event.key === 'Enter' && event.target === host.value) { event.preventDefault(); stage?.dropAtCenter(); }
}
function paletteKeys(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
  const nav = event.currentTarget as HTMLElement;
  const buttons = Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-toy]'));
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (index < 0) return;
  const step = event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : event.key === 'ArrowLeft' ? -1 : 1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + step + buttons.length) % buttons.length;
  event.preventDefault(); buttons[next]?.focus(); buttons[next]?.click();
}

onMounted(async () => {
  try {
    // Both the renderer chunk and cannon-es download only after this app opens.
    const [physics, runtime] = await Promise.all([import('cannon-es'), import('./gravity/stage')]);
    if (disposed || !host.value) return;
    stage = new runtime.GravityStage(host.value, physics, value => { stats.value = value; }, message => { error.value = message; }, object => { inspection.value = object; void showPanel('object'); });
    stage.setTool(tool.value, surface.value); stage.setGravity(gravity.value);
    stage.setSlow(slow.value); stage.setSound(sound.value);
    ready.value = true;
  } catch {
    error.value = 'This studio needs WebGL to play. Try reopening Gravity in a browser with graphics acceleration.';
  }
});
watch(() => vision?.sound.value, value => { if (value !== undefined) { sound.value = value; stage?.setSound(value); } });
onBeforeUnmount(() => { disposed = true; window.clearTimeout(noticeTimer); stage?.dispose(); });
</script>

<template>
  <section ref="app" class="gravity-app" :class="{ compact: props.compact, solid: vision?.reduceTransparency.value }" aria-label="Gravity physics playground" @keydown="keys">
    <header class="gravity-header">
      <span class="brand-mark"><Glyph name="cube"/><span class="brand-ball"/></span>
      <div class="heading"><h1>Gravity</h1><p>A little space to play.</p></div>
      <span class="studio-label">PHYSICS STUDIO</span>
      <div class="header-actions">
        <button v-hover class="vk-button material-trigger" aria-haspopup="dialog" :aria-expanded="panel === 'materials'" @click="showPanel('materials')"><span class="surface-swatch" :class="surface"/><span>{{ finish.name }}</span><Glyph name="chevron"/></button>
        <button v-hover class="vk-icon" :aria-label="sound ? 'Mute impact sounds' : 'Enable impact sounds'" :aria-pressed="sound" @click="toggleSound"><Glyph :name="sound ? 'sound' : 'muted'"/></button>
        <button v-hover class="vk-icon help-trigger" aria-label="How to play and keyboard shortcuts" aria-haspopup="dialog" @click="showPanel('help')"><Glyph name="help"/></button>
      </div>
    </header>

    <div class="workspace">
      <aside class="create-rail">
        <div class="rail-heading"><span>CREATE</span><button v-hover class="vk-icon plain" aria-label="Search objects" aria-haspopup="dialog" @click="showPanel('library')"><Glyph name="search"/></button></div>
        <nav class="toy-palette vk-tabbar vk-scroll" aria-label="Create an object" @keydown="paletteKeys">
          <button v-for="item in objects" :key="item.id" v-hover data-toy class="toy-tool" :class="{ selected: tool === item.id }" :aria-pressed="tool === item.id" :title="item.name + ' · ' + item.detail" :disabled="!ready || !!error" @click="choose(item.id)">
            <ToyArt :kind="item.id" :color="item.color"/><span>{{ item.name }}</span>
          </button>
        </nav>
        <button v-hover class="vk-button drop-button" :disabled="!ready || !!error" @click="stage?.dropAtCenter()"><Glyph name="plus"/><span>Drop {{ current.name }}</span></button>
      </aside>

      <main class="studio vk-well">
        <div ref="host" class="stage" tabindex="0" role="application" aria-label="Physics studio. Tap empty floor to drop. Hold to spray. Drag an object and release to throw. Enter drops at center. Space pauses." :aria-busy="!ready && !error"/>
        <div class="studio-top">
          <span class="scene-badge"><span class="status-dot" :class="stats.state"/>{{ paused ? 'Paused' : gravity === 'zero' ? 'Floating' : 'Live studio' }}</span>
          <div class="scene-stats"><strong>{{ stats.count }}</strong><span>objects</span><span class="stat-divider"/><span>{{ field.label }}</span></div>
        </div>
        <div class="starter-row">
          <button v-for="item in presets" :key="item.id" v-hover class="starter" :class="{ active: experiment === item.id }" :disabled="!ready || !!error" @click="preset(item.id)"><Glyph :name="item.id === 'tower' ? 'cube' : item.id === 'domino' ? 'preset' : 'launch'"/><span>{{ item.name }}</span></button>
        </div>
        <div v-if="!ready || error" class="stage-message vk-sheet" role="status"><span class="message-art"><Glyph :name="error ? 'cube' : 'gravity'"/></span><h2>{{ error ? 'The studio is taking a break' : 'Setting the scene' }}</h2><p>{{ error || 'A few shapes. A little gravity. Endless possibilities.' }}</p></div>
        <div v-else-if="stats.count === 0" class="empty-studio">
          <span class="empty-orbit"><ToyArt :kind="tool" :color="current.color"/></span><h2>What falls next?</h2><p>Tap the floor to drop a {{ current.name.toLowerCase() }}.<br/>Or start with a ready-made experiment.</p><button v-hover class="vk-button" @click="stage?.dropAtCenter()"><Glyph name="plus"/>Drop your first object</button>
        </div>
        <div v-if="experiment && ready && !error && stats.count" class="experiment-callout"><span>{{ presets.find(item => item.id === experiment)?.description }}</span><button v-hover class="vk-button" @click="stage?.nudge()"><Glyph name="play"/>{{ experimentLabel }}</button></div>
        <div class="studio-bottom"><span class="object-caption"><strong>{{ current.name }}</strong><span>{{ finish.name }} · {{ current.detail }}</span></span><button v-hover class="vk-icon scene-pause" :aria-label="paused ? 'Resume physics' : 'Pause physics'" :aria-pressed="paused" :disabled="!ready || !!error" @click="togglePause"><Glyph :name="paused ? 'play' : 'pause'"/></button></div>
      </main>
    </div>

    <footer class="gravity-footer">
      <p class="gesture-hint" role="status">{{ notice }}</p>
      <div class="play-ornament vk-ornament" role="toolbar" aria-label="Playground controls">
        <button v-hover class="vk-button gravity-select" aria-haspopup="dialog" :aria-expanded="panel === 'gravity'" :disabled="!ready || !!error" @click="showPanel('gravity')"><Glyph name="gravity"/><span>{{ field.name }}</span><Glyph name="chevron"/></button>
        <span class="toolbar-divider"/>
        <button v-hover class="vk-button slow-button" :aria-pressed="slow" :disabled="!ready || !!error" @click="toggleSlow"><Glyph name="slow"/><span>{{ slow ? '¼ speed' : 'Slow motion' }}</span></button>
        <button v-hover class="vk-button tool-action" aria-label="Explode: push all objects outward" :disabled="!ready || !!error || !stats.count" @click="action('explode')"><Glyph name="explode"/><span>Explode</span></button>
        <button v-hover class="vk-button tool-action" aria-label="Tidy objects into a grid" :disabled="!ready || !!error || !stats.count" @click="action('tidy')"><Glyph name="tidy"/><span>Tidy</span></button>
        <button v-hover class="vk-button tool-action clear-button" aria-label="Clear the studio" :disabled="!ready || !!error || !stats.count" @click="action('clear')"><Glyph name="clear"/><span>Clear</span></button>
        <span class="toolbar-divider"/>
        <button v-hover class="vk-button preset-trigger" aria-haspopup="dialog" :aria-expanded="panel === 'presets'" :disabled="!ready || !!error" @click="showPanel('presets')"><Glyph name="preset"/><span>Experiments</span></button>
      </div>
    </footer>

    <div v-if="panel" class="sheet-backdrop" @pointerdown.self="closePanel">
      <section ref="sheet" class="gravity-sheet vk-sheet" :class="'panel-' + panel" role="dialog" aria-modal="true" aria-labelledby="gravity-sheet-title" @keydown="sheetKeys">
        <header class="sheet-header"><div><p class="eyebrow">{{ panel === 'help' ? 'A SMALL GUIDE' : panel === 'presets' ? 'READY TO PLAY' : panel === 'gravity' ? 'CHANGE THE FEEL' : panel === 'library' ? 'YOUR TOY BOX' : panel === 'object' ? 'A CLOSER LOOK' : 'LOOK & FEEL' }}</p><h2 id="gravity-sheet-title">{{ panel === 'materials' ? 'Made of possibilities' : panel === 'gravity' ? 'A different kind of fall' : panel === 'presets' ? 'Little experiments' : panel === 'library' ? 'Find your next shape' : panel === 'object' ? inspected?.name : 'Let curiosity take over.' }}</h2></div><button v-hover class="vk-icon" aria-label="Close panel" @click="closePanel"><Glyph name="close"/></button></header>
        <div class="sheet-content vk-scroll">
          <template v-if="panel === 'object'"><div class="inspect-preview vk-platter"><ToyArt v-if="inspected" :kind="inspected.id" :color="inspected.color"/><div><strong>{{ inspected?.name }}</strong><p>{{ surfaces.find(item => item.id === inspection?.surface)?.name }} finish</p></div></div><div class="inspect-actions"><button v-hover class="vk-row" @click="inspectAction('duplicate')"><Glyph name="plus"/><span>Duplicate object</span></button><button v-hover class="vk-row" @click="inspectAction('pop')"><Glyph name="launch"/><span>Give it a little lift</span></button><button v-hover class="vk-row remove-object" @click="inspectAction('remove')"><Glyph name="clear"/><span>Remove object</span></button></div></template><template v-else-if="panel === 'materials'"><p class="sheet-intro">Choose a finish for the next objects you create.</p><button v-for="item in surfaces" :key="item.id" v-hover class="material-row vk-row" :aria-pressed="surface === item.id" @click="material(item.id)"><span class="surface-swatch large" :class="item.id"/><span><strong>{{ item.name }}</strong><small>{{ item.description }}</small><span class="material-metrics">Bounce <b>{{ Math.round(item.bounce * 100) }}%</b><span class="metric-track"><i :style="{ width: item.bounce * 100 + '%' }"/></span></span></span><Glyph v-if="surface === item.id" name="check"/></button><p class="panel-note">Glass is a frosted, glass-like finish. Properties are playful simulation values.</p><div class="sheet-links"><button v-hover class="vk-button" @click="showPanel('library')"><Glyph name="search"/>Toy box</button><button v-hover class="vk-button" @click="showPanel('help')"><Glyph name="help"/>How to play</button></div></template>
          <template v-else-if="panel === 'gravity'"><p class="sheet-intro">Same objects. A whole new rhythm.</p><button v-for="item in gravities" :key="item.id" v-hover class="gravity-row vk-row" :aria-pressed="gravity === item.id" @click="setGravity(item.id)"><span class="planet" :class="item.id"/><span><strong>{{ item.name }}</strong><small>{{ item.label }}</small></span><Glyph v-if="gravity === item.id" name="check"/></button><p class="panel-note">Zero-G adds a gentle drift. The studio walls keep everything close.</p></template>
          <template v-else-if="panel === 'presets'"><p class="sheet-intro">Start a fresh scene. Then make it your own.</p><button v-for="item in presets" :key="item.id" v-hover class="preset-card vk-platter" @click="preset(item.id)"><span class="preset-art" :class="item.id"><i v-for="i in (item.id === 'bowling' ? 6 : 7)" :key="i" :style="{ '--i': i }"/><b v-if="item.id === 'bowling'"/></span><span class="preset-copy"><span><strong>{{ item.name }}</strong><small>{{ item.count }} objects</small></span><span>{{ item.description }}</span></span><Glyph name="play"/></button><p class="panel-note">Loading an experiment replaces the current scene.</p></template>
          <template v-else-if="panel === 'library'"><label class="object-search vk-field"><Glyph name="search"/><input ref="searchField" v-model="search" type="search" placeholder="Search shapes and toys" aria-label="Search shapes and toys"/></label><div class="library-grid"><button v-for="item in results" :key="item.id" v-hover class="library-item vk-platter" :aria-pressed="tool === item.id" @click="choose(item.id); closePanel()"><ToyArt :kind="item.id" :color="item.color"/><strong>{{ item.name }}</strong><small>{{ item.detail }}</small></button></div><p v-if="!results.length" class="no-results">No shapes found. Try “ball”, “wood”, or “cup”.</p></template>
          <template v-else><button v-hover class="vk-button guide-search" @click="showPanel('library')"><Glyph name="search"/>Browse the toy box</button><div class="guide-lead vk-platter"><ToyArt kind="duck" color="#ffd56e"/><p>No scores. No rules.<br/><strong>Just one more bounce.</strong></p></div><div class="guide-steps"><div><span class="guide-symbol"><Glyph name="plus"/></span><p><strong>Drop something</strong><span>Choose a shape, then tap empty floor. Hold to sprinkle several.</span></p></div><div><span class="guide-symbol"><Glyph name="hand"/></span><p><strong>Give it a throw</strong><span>Grab an object, lift it, and release while moving. A quick flick goes farther. Right-click for object actions.</span></p></div><div><span class="guide-symbol"><Glyph name="gravity"/></span><p><strong>Follow your curiosity</strong><span>Try Moon gravity, a rubber ball, or a domino run. Tidy whenever you like.</span></p></div></div><div class="shortcuts vk-well"><h3>At your keyboard</h3><span><kbd>1–9</kbd> Select a shape</span><span><kbd>Enter</kbd> Drop at center</span><span><kbd>Space</kbd> Pause / resume</span><span><kbd>S</kbd> Slow motion</span><span><kbd>E</kbd> Explode</span><span><kbd>T</kbd> Tidy</span><span><kbd>Delete</kbd> Clear</span><span><kbd>/</kbd> Search shapes</span></div><p class="panel-note">Enter and Space work while the studio has focus. Sound is optional. This is a simulated playground.</p></template>
        </div>
      </section>
    </div>
  </section>
</template>

<style src="../kit/kit.css"></style>
<style src="./gravity/gravity.css" scoped></style>
