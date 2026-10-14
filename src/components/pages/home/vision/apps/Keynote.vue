<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import SlideArt from './keynote/SlideArt.vue';
import Audience from './keynote/Audience.vue';
import { deck, palettes, themes, transitions, type Theme, type SlideTransition } from './keynote/deck';
defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
type View = 'Edit' | 'Play' | 'Rehearse';
const view = ref<View>('Edit'), index = ref(0), theme = ref<Theme>('Midnight'), transition = ref<SlideTransition>('Dissolve');
const notes = ref(deck.map(slide=>slide.notes));
const laser = ref(false), pointer = ref({x:50,y:50}), pointerInside = ref(false);
const elapsed = ref(0), audienceReaction = ref(3), root = ref<HTMLElement>();
const current = computed(() => deck[index.value]!);
const nextIndex = computed(() => Math.min(deck.length-1,index.value+1));
const animation = computed(() => transition.value==='Magic Move' ? 'magic' : transition.value.toLowerCase());
const clock = computed(() => vision.now.value.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
const timer = computed(() => Math.floor(elapsed.value/60).toString().padStart(2,'0')+':'+Math.floor(elapsed.value%60).toString().padStart(2,'0'));
const captions = ['One listener is applauding the generous spacing.','A discreet cough. Even fictional audiences need water.','Someone checked their phone. It was probably the time.','Someone in row 3 is taking notes. Probably.'];
const audienceCaption = computed(() => index.value===7 ? 'Polite applause. The imaginary room is yours.' : captions[audienceReaction.value]!);
let rehearseTimer: ReturnType<typeof setInterval> | undefined;
let rehearseStart = 0;
function changeView(next: View): void {
  clearInterval(rehearseTimer); view.value=next; pointerInside.value=false;
  if(next==='Rehearse') { elapsed.value=0; audienceReaction.value=3; rehearseStart=performance.now(); rehearseTimer=setInterval(() => { elapsed.value=(performance.now()-rehearseStart)/1000; audienceReaction.value=Math.floor(elapsed.value/11)%4; },500); }
  root.value?.focus();
}
function advance(delta=1): void {
  const next=index.value+delta;
  if(next>=deck.length) { vision.toast('That’s the whole deck. Leave a little room for questions.'); return; }
  index.value=Math.max(0,next);
}
function keys(event: KeyboardEvent): void {
  const target=event.target;
  if(target instanceof HTMLElement && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY'].includes(target.tagName))) return;
  if(['ArrowRight','ArrowDown'].includes(event.key) || view.value==='Play' && [' ','Enter'].includes(event.key)) { event.preventDefault(); advance(); }
  else if(['ArrowLeft','ArrowUp'].includes(event.key)) { event.preventDefault(); advance(-1); }
  else if(event.key==='Home') { event.preventDefault(); index.value=0; }
  else if(event.key==='End') { event.preventDefault(); index.value=deck.length-1; }
}
function movePointer(event: PointerEvent): void {
  const target=event.currentTarget;
  if(!(target instanceof HTMLElement)) return;
  const rect=target.getBoundingClientRect();
  pointer.value={x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100}; pointerInside.value=true;
}
onBeforeUnmount(() => clearInterval(rehearseTimer));
</script>

<template>
<section ref="root" class="keynote-app" :class="[view.toLowerCase(),{compact,solid:vision.reduceTransparency.value}]" tabindex="0" aria-label="Keynote — the craft of calm demo presentation" @keydown="keys">
  <template v-if="view==='Edit'">
    <header class="workbar"><div><h1 class="vk-title">Keynote</h1><span class="vk-footnote vk-secondary">The craft of calm · Demo deck</span></div><div class="work-actions"><button v-hover class="vk-button" @click="changeView('Rehearse')"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/></svg>Rehearse</button><button v-hover class="vk-button primary" @click="changeView('Play')"><svg viewBox="0 0 24 24"><path d="m9 4 11 8-11 8Z"/></svg>Play</button></div></header>
    <div class="edit-workspace">
      <nav class="slide-navigator vk-platter vk-scroll" aria-label="Slides"><details :open="!compact"><summary class="vk-headline">Slides <span class="vk-secondary">{{ index+1 }} of 8</span></summary><button v-for="(slide,i) in deck" :key="slide.title" v-hover class="thumbnail" :class="{selected:i===index}" :aria-current="i===index ? 'true' : undefined" :aria-label="'Slide '+(i+1)+': '+slide.title" @click="index=i"><span class="slide-number">{{ i+1 }}</span><div class="thumbnail-art"><SlideArt :index="i" :theme="theme"/></div><span class="thumbnail-name">{{ slide.title }}</span></button></details></nav>
      <main class="editor-canvas"><div class="canvas-heading"><span class="vk-footnote vk-secondary">{{ String(index+1).padStart(2,'0') }} · {{ current.title }}</span><span class="vk-chip">16:9</span></div><div class="slide-frame"><SlideArt :key="index+'-'+theme" :index="index" :theme="theme" animate/></div><div class="canvas-footer"><button v-hover class="vk-icon" aria-label="Previous slide" :disabled="index===0" @click="advance(-1)"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><span class="vk-footnote vk-secondary">Slide {{ index+1 }} of 8</span><button v-hover class="vk-icon" aria-label="Next slide" :disabled="index===7" @click="advance()"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div><p class="canvas-hint vk-footnote vk-tertiary">A little space makes every detail feel considered.</p></main>
      <aside class="inspector vk-platter vk-scroll"><h2 class="vk-title">Format</h2><fieldset><legend class="vk-headline">Theme</legend><div class="theme-grid"><button v-for="t in themes" :key="t" v-hover class="theme-choice" :class="{selected:theme===t}" :aria-pressed="theme===t" @click="theme=t"><span class="theme-preview" :style="{background:palettes[t].bg,color:palettes[t].ink}"><span>Aa</span><i :style="{background:palettes[t].accent}"/></span><span>{{ t }}</span></button></div></fieldset><fieldset><legend class="vk-headline">Transition</legend><button v-for="t in transitions" :key="t" v-hover class="vk-row transition-choice" :class="{selected:transition===t}" :aria-pressed="transition===t" @click="transition=t"><svg viewBox="0 0 24 24"><path :d="t==='Dissolve' ? 'M5 5h14v14H5Zm3 3h8v8H8Z' : t==='Push' ? 'M3 6h8v12H3Zm10 6h8m-4-4 4 4-4 4' : 'M3 14h7v7H3ZM10 3h11v11H10Zm3 5h5m-2-2v5'"/></svg>{{ t }}</button></fieldset><label class="notes-label"><span class="vk-headline">Presenter notes</span><span class="vk-footnote vk-secondary">Slide {{ index+1 }}</span><textarea v-model="notes[index]" class="vk-field" rows="7" aria-label="Presenter notes for the selected slide" maxlength="3000"/></label><p class="vk-footnote vk-tertiary">Your notes stay in this app session.</p></aside>
    </div>
  </template>
  <template v-else-if="view==='Play'">
    <div class="play-stage" aria-label="Presentation. Click to advance; arrow keys move between slides." @click="advance()" @pointermove="movePointer" @pointerleave="pointerInside=false">
      <Transition :name="animation"><SlideArt :key="index+'-'+theme" class="presented-slide" :index="index" :theme="theme" animate/></Transition>
      <span v-if="laser && pointerInside" class="laser-dot" :style="{left:pointer.x+'%',top:pointer.y+'%'}" aria-hidden="true"/>
    </div>
    <div class="presentation-controls vk-ornament" @click.stop><button v-hover class="vk-icon" aria-label="Previous slide" :disabled="index===0" @click="advance(-1)"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><span class="slide-position">{{ index+1 }} <span class="vk-secondary">of 8</span></span><button v-hover class="vk-icon" aria-label="Next slide" :disabled="index===7" @click="advance()"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button><span class="ornament-divider"/><button v-hover class="vk-icon" aria-label="Laser pointer" :aria-pressed="laser" @click="laser=!laser"><svg viewBox="0 0 24 24"><path d="m4 20 10-10 3 3-10 10Zm10-10 3-3m-1-5v2m5 2h2m-4-3 2-2"/></svg></button><button v-hover class="vk-button" @click="changeView('Edit')">Done</button></div>
  </template>
  <template v-else>
    <header class="rehearse-header"><div><h1 class="vk-title">Rehearse</h1><p class="vk-footnote vk-secondary">A practice run. A very patient audience.</p></div><div class="clocks"><div><span class="vk-footnote vk-tertiary">Elapsed</span><time>{{ timer }}</time></div><div><span class="vk-footnote vk-tertiary">Local time</span><time>{{ clock }}</time></div></div><button v-hover class="vk-button" @click="changeView('Edit')">Done</button></header>
    <div class="presenter-workspace vk-scroll">
      <main class="current-slide"><div class="presenter-label"><span class="vk-headline">Current slide</span><span class="vk-footnote vk-secondary">{{ index+1 }} of 8</span></div><div class="slide-frame"><Transition :name="animation" mode="out-in"><SlideArt :key="index" :index="index" :theme="theme" animate/></Transition></div><div class="rehearse-nav"><button v-hover class="vk-button" :disabled="index===0" @click="advance(-1)">Previous</button><button v-hover class="vk-button primary" :disabled="index===7" @click="advance()">Next slide<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div></main>
      <aside class="presenter-side"><div class="presenter-label"><span class="vk-headline">{{ index===7 ? 'The final slide' : 'Up next' }}</span><span class="vk-footnote vk-secondary">{{ index===7 ? 'Questions welcome' : nextIndex+1 }}</span></div><div class="next-slide"><SlideArt :index="nextIndex" :theme="theme"/></div><div class="presenter-notes vk-platter"><h2 class="vk-headline">Presenter notes</h2><p class="vk-body">{{ notes[index] || 'A little pause is a perfectly good note.' }}</p></div></aside>
      <div class="audience-strip vk-platter"><div class="audience-label"><span class="vk-footnote vk-secondary">VIRTUAL AUDIENCE</span><span class="vk-chip">Fictional, but attentive</span></div><Audience class="audience-art" :reaction="audienceReaction" :applause="index===7"/><p class="vk-footnote vk-secondary" aria-live="polite">{{ audienceCaption }}</p></div>
    </div>
  </template>
</section>
</template>

<style src="../kit/kit.css"></style>
<style scoped>
.keynote-app {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  padding: 24px;
  color: var(--vk-text);
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: radial-gradient(ellipse at 40% 0%,#8eaaaf12,transparent 65%);
}
.keynote-app * {
  box-sizing: border-box;
}
button,textarea {
  font: inherit;
  color: inherit;
}
button {
  border: 0;
  background: transparent;
  cursor: pointer;
}
button:disabled {
  opacity: .3;
  cursor: default;
}
h1,h2,p {
  margin: 0;
}
svg:not(.slide-art):not(.audience-art) {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
}
:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}
.workbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.workbar>div:first-child {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.work-actions {
  display: flex;
  gap: 10px;
}
.edit-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 157px minmax(0,1fr) 214px;
  gap: 18px;
}
.slide-navigator {
  padding: 12px 9px;
}
.slide-navigator summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 14px;
  min-height: 44px;
  padding: 0 6px;
  cursor: pointer;
  list-style: none;
}
.slide-navigator summary::-webkit-details-marker {
  display: none;
}
.slide-navigator summary span {
  font-size: 11px;
}
.thumbnail {
  width: 100%;
  padding: 10px 6px;
  border-radius: 16px;
  display: grid;
  grid-template-columns: 14px minmax(0,1fr);
  gap: 6px;
  text-align: left;
  transition: background .2s;
}
.thumbnail.selected {
  background: #ffffff17;
}
.slide-number {
  font-size: 11px;
  padding-top: 5px;
  opacity: .55;
  font-variant-numeric: tabular-nums;
}
.thumbnail-art {
  aspect-ratio: 16/9;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 7px #0004;
  border: 1px solid #ffffff13;
}
.selected .thumbnail-art {
  outline: 2px solid #9bcac0;
  outline-offset: 2px;
}
.thumbnail-name {
  grid-column: 2;
  font-size: 10px;
  color: var(--vk-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}
.editor-canvas {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 19px;
}
.canvas-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}
.canvas-heading>.vk-footnote {
  font-size: 12px;
}
.canvas-heading .vk-chip {
  font-size: 11px;
  min-height: 28px;
  padding: 0 9px;
}
.slide-frame {
  width: 100%;
  aspect-ratio: 16/9;
  box-shadow: 0 20px 35px #0005,inset 0 0 0 1px #ffffff14;
  overflow: hidden;
  border-radius: 8px;
  position: relative;
}
.canvas-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
}
.canvas-hint {
  text-align: center;
  font-size: 12px;
}
.inspector {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
legend {
  padding: 0;
  margin-bottom: 13px;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 14px 10px;
}
.theme-choice {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  min-height: 75px;
  border-radius: 12px;
  padding: 4px;
}
.theme-preview {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  height: 50px;
  border-radius: 9px;
  box-shadow: 0 3px 9px #0003;
  overflow: hidden;
}
.theme-preview>span {
  font-size: 25px;
  letter-spacing: -1px;
}
.theme-preview i {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.theme-choice.selected .theme-preview {
  outline: 2px solid #b2d6cb;
  outline-offset: 2px;
}
.transition-choice {
  font-size: 12px;
  min-height: 48px;
  padding: 7px 10px;
  gap: 10px;
}
.transition-choice svg {
  width: 18px;
  height: 18px;
}
.notes-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.notes-label .vk-secondary {
  font-size: 11px;
}
.notes-label textarea {
  font-size: 13px;
  line-height: 1.5;
  padding: 12px;
  border-radius: 18px;
  min-height: 150px;
  resize: vertical;
}
.inspector>.vk-footnote {
  font-size: 11px;
}
.play {
  padding: 0;
  background: #15191f;
  gap: 0;
}
.play-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  cursor: pointer;
}
.presented-slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.presentation-controls {
  position: absolute;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  gap: 8px;
}
.slide-position {
  font-size: 14px;
  min-width: 64px;
  text-align: center;
  white-space: nowrap;
}
.ornament-divider {
  width: 1px;
  height: 25px;
  background: #ffffff26;
  margin: 0 4px;
}
.laser-dot {
  position: absolute;
  pointer-events: none;
  width: 11px;
  height: 11px;
  background: #ff3939;
  border-radius: 50%;
  box-shadow: 0 0 13px 4px #ff414177;
  transform: translate(-50%,-50%);
  z-index: 2;
}
.rehearse-header {
  display: flex;
  align-items: center;
  gap: 24px;
}
.rehearse-header>div:first-child {
  flex: 1;
  display: grid;
  gap: 5px;
}
.clocks {
  display: flex;
  gap: 24px;
}
.clocks>div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.clocks time {
  font-size: 25px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
}
.clocks span {
  font-size: 11px;
}
.presenter-workspace {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0,1.7fr) minmax(0,1fr);
  gap: 20px;
  align-content: start;
}
.current-slide,.presenter-side {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.presenter-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.presenter-label .vk-headline {
  font-size: 14px;
}
.presenter-label .vk-secondary {
  font-size: 12px;
}
.rehearse-nav {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-top: 5px;
}
.rehearse-nav .vk-button {
  font-size: 14px;
}
.next-slide {
  aspect-ratio: 16/9;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 9px 20px #0003;
}
.presenter-notes {
  padding: 18px;
  flex: 1;
}
.presenter-notes h2 {
  margin-bottom: 10px;
  font-size: 14px;
}
.presenter-notes p {
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.audience-strip {
  grid-column: 1/-1;
  padding: 16px 22px;
  text-align: center;
}
.audience-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  text-align: left;
}
.audience-label>span:first-child {
  font-size: 10px;
  letter-spacing: 1.5px;
}
.audience-label .vk-chip {
  font-size: 11px;
  min-height: 28px;
}
.solid .inspector,.solid .slide-navigator,.solid .presenter-notes,.solid .audience-strip {
  background: #30363f;
}
.dissolve-enter-active,.dissolve-leave-active {
  transition: opacity .5s ease;
}
.dissolve-enter-from,.dissolve-leave-to {
  opacity: 0;
}
.push-enter-active,.push-leave-active {
  transition: transform .55s var(--vk-spring),opacity .5s;
}
.push-enter-from {
  transform: translateX(100%);
  opacity: .3;
}
.push-leave-to {
  transform: translateX(-100%);
  opacity: .3;
}
.magic-enter-active,.magic-leave-active {
  transition: transform .65s var(--vk-spring),opacity .5s,filter .5s;
}
.magic-enter-from {
  transform: scale(1.13);
  opacity: 0;
  filter: blur(6px);
}
.magic-leave-to {
  transform: scale(.87);
  opacity: 0;
  filter: blur(6px);
}
.compact.keynote-app {
  padding: 20px 16px;
  gap: 18px;
}
.compact .workbar {
  align-items: flex-start;
  flex-direction: column;
  gap: 15px;
}
.compact .work-actions {
  width: 100%;
}
.compact .work-actions .vk-button {
  flex: 1;
  font-size: 14px;
}
.compact.edit {
  overflow: auto;
  display: block;
}
.compact .edit-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 24px;
}
.compact .editor-canvas {
  order: 0;
  gap: 15px;
  flex: none;
}
.compact .slide-navigator {
  order: 2;
  flex: none;
}
.compact .inspector {
  order: 1;
  overflow: visible;
  padding: 20px;
}
.compact .inspector .theme-grid {
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 16px;
}
.compact .theme-preview {
  height: 68px;
}
.compact .transition-choice {
  font-size: 15px;
}
.compact .thumbnail {
  grid-template-columns: 22px minmax(0,1fr);
  padding: 14px;
  max-width: 100%;
}
.compact .thumbnail-art {
  width: 100%;
  max-width: 300px;
}
.compact .thumbnail-name {
  font-size: 13px;
  white-space: normal;
}
.compact .slide-number {
  font-size: 15px;
}
.compact .slide-navigator summary {
  font-size: 17px;
}
.compact .canvas-hint {
  display: none;
}
.compact.play {
  padding: 0;
  overflow: hidden;
}
.compact .presentation-controls {
  bottom: 16px;
  gap: 5px;
  max-width: calc(100% - 20px);
  padding: 8px;
}
.compact .presentation-controls .vk-button {
  padding: 0 14px;
  font-size: 14px;
}
.compact .slide-position {
  min-width: 47px;
  font-size: 12px;
}
.compact .ornament-divider {
  display: none;
}
.compact .rehearse-header {
  flex-wrap: wrap;
  gap: 15px;
}
.compact .rehearse-header>div:first-child {
  flex-basis: calc(100% - 95px);
}
.compact .clocks {
  order: 2;
  width: 100%;
  justify-content: space-between;
}
.compact .rehearse-header>.vk-button {
  margin-left: auto;
}
.compact .presenter-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.compact .audience-strip {
  padding: 15px;
}
.compact .audience-label {
  flex-wrap: wrap;
  gap: 7px;
}
.compact .rehearse-nav .vk-button {
  flex: 1;
  padding: 0 12px;
}
.compact .notes-label textarea {
  min-height: 145px;
}
@media(max-width:900px) {
  .edit-workspace {
    grid-template-columns: 130px minmax(0,1fr) 185px;
    gap: 12px;
  }
  .keynote-app {
    padding: 22px;
  }
  .inspector {
    padding: 16px 12px;
  }
  .workbar .vk-footnote {
    font-size: 12px;
  }
}
@media(prefers-reduced-motion:reduce) {
  .keynote-app * {
    animation: none!important;
    transition: none!important;
  }
}
</style>
