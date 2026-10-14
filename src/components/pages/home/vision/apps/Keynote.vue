<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import SlideArt from './keynote/SlideArt.vue';
import Audience from './keynote/Audience.vue';
import { deck, palettes, themes, transitions, type Theme, type SlideTransition } from './keynote/deck';
defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
type View = 'Edit' | 'Play' | 'Rehearse';
const view = ref<View>('Edit'), index = ref(0), theme = ref<Theme>('Midnight'), transition = ref<SlideTransition>('Dissolve');
const inspectorTab=ref<'Design' | 'Animate' | 'Notes'>('Design');
const inspectorTabs=['Design','Animate','Notes'] as const;
const transitionDuration=ref(.6), previewNonce=ref(0);
const rehearsalRoom=ref<'Theater' | 'Boardroom'>('Theater'), lightsDown=ref(true), timerPaused=ref(false);
const appVisible=ref(true);
let visibilityObserver: IntersectionObserver | undefined;
function previewTransition(): void { previewNonce.value++; }
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
  if(next==='Rehearse') { elapsed.value=0; audienceReaction.value=3; timerPaused.value=false; startRehearsalTimer(); }
  root.value?.focus();
}
function startRehearsalTimer(): void {
  clearInterval(rehearseTimer);
  if(view.value!=='Rehearse' || timerPaused.value || !appVisible.value || document.hidden) return;
  rehearseStart=performance.now()-elapsed.value*1000;
  rehearseTimer=setInterval(() => { elapsed.value=Math.floor((performance.now()-rehearseStart)/1000); audienceReaction.value=Math.floor(elapsed.value/11)%4; },1000);
}
function toggleTimer(): void { timerPaused.value=!timerPaused.value; startRehearsalTimer(); }
function advance(delta=1): void {
  const next=index.value+delta;
  if(next>=deck.length) { vision.toast('That’s the whole deck. Leave a little room for questions.'); return; }
  index.value=Math.max(0,next);
}
function keys(event: KeyboardEvent): void {
  if(event.key==='Escape' && view.value!=='Edit') { event.stopPropagation(); changeView('Edit'); return; }
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
onMounted(() => {
 visibilityObserver=new IntersectionObserver(entries=>{appVisible.value=entries[0]?.isIntersecting ?? false; startRehearsalTimer();});
 if(root.value) visibilityObserver.observe(root.value);
 document.addEventListener('visibilitychange',startRehearsalTimer);
});
onBeforeUnmount(() => { clearInterval(rehearseTimer); visibilityObserver?.disconnect(); document.removeEventListener('visibilitychange',startRehearsalTimer); });
</script>

<template>
<section ref="root" class="keynote-app" :class="[view.toLowerCase(),{compact,solid:vision.reduceTransparency.value}]"  :style="{'--transition-duration':transitionDuration+'s'}" tabindex="0" aria-label="Keynote — the craft of calm demo presentation" @keydown="keys">
  <template v-if="view==='Edit'">
    <header class="workbar"><div><h1 class="vk-title">Keynote</h1><span class="vk-footnote vk-secondary">The craft of calm <span class="save-state"><i/> In this session</span></span></div><div class="work-actions"><button v-hover class="vk-button" @click="changeView('Rehearse')"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/></svg>Rehearse</button><button v-hover class="vk-button primary" @click="changeView('Play')"><svg viewBox="0 0 24 24"><path d="m9 4 11 8-11 8Z"/></svg>Play</button></div></header>
    <div class="edit-workspace">
      <nav class="slide-navigator vk-platter vk-scroll" aria-label="Slides"><details :open="!compact"><summary class="vk-headline">Slides <span class="vk-secondary">{{ index+1 }} of 8</span></summary><button v-for="(slide,i) in deck" :key="slide.title" v-hover class="thumbnail" :class="{selected:i===index}" :aria-current="i===index ? 'true' : undefined" :aria-label="'Slide '+(i+1)+': '+slide.title" @click="index=i"><span class="slide-number">{{ i+1 }}</span><div class="thumbnail-art"><SlideArt :index="i" :theme="theme"/></div><span class="thumbnail-name">{{ slide.title }}</span></button></details></nav>
      <main class="editor-canvas"><div class="canvas-heading"><span class="vk-footnote vk-secondary">{{ String(index+1).padStart(2,'0') }} · {{ current.title }}</span><span class="vk-chip">16:9</span></div><div class="slide-frame"><Transition :name="animation" mode="out-in"><SlideArt :key="index+'-'+theme+'-'+previewNonce" :index="index" :theme="theme" animate/></Transition></div><div class="canvas-footer vk-ornament"><button v-hover class="vk-icon" aria-label="Previous slide" :disabled="index===0" @click="advance(-1)"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button><span class="vk-footnote vk-secondary">Slide {{ index+1 }} of 8</span><button v-hover class="vk-icon" aria-label="Next slide" :disabled="index===7" @click="advance()"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div><div class="slide-story vk-platter"><span class="story-label">SLIDE STORY</span><strong>{{ current.title }}</strong><p>{{ current.subtitle }}</p><button v-hover class="vk-button" aria-label="Edit presenter notes" @click="inspectorTab='Notes'">Notes <svg viewBox="0 0 24 24"><path d="m4 20 4-1L20 7l-3-3L5 16Zm11-14 3 3"/></svg></button></div></main>
      <aside class="inspector vk-platter vk-scroll"><header class="inspector-heading"><h2 class="vk-title">Inspector</h2><span class="vk-footnote vk-secondary">Slide {{ index+1 }}</span></header><div class="vk-segmented inspector-tabs" aria-label="Inspector panel"><button v-for="item in inspectorTabs" :key="item" v-hover :aria-pressed="inspectorTab===item" @click="inspectorTab=item">{{ item }}</button></div><div class="inspector-content vk-scroll"><fieldset v-if="inspectorTab==='Design'"><legend class="vk-headline">Theme</legend><div class="theme-grid"><button v-for="t in themes" :key="t" v-hover class="theme-choice" :class="{selected:theme===t}" :aria-pressed="theme===t" @click="theme=t"><span class="theme-preview" :style="{background:palettes[t].bg,color:palettes[t].ink}"><span>Aa</span><i :style="{background:palettes[t].accent}"/></span><span>{{ t }}</span></button></div></fieldset><fieldset v-if="inspectorTab==='Animate'"><legend class="vk-headline">Transition</legend><button v-for="t in transitions" :key="t" v-hover class="vk-row transition-choice" :class="{selected:transition===t}" :aria-pressed="transition===t" @click="transition=t"><svg viewBox="0 0 24 24"><path :d="t==='Dissolve' ? 'M5 5h14v14H5Zm3 3h8v8H8Z' : t==='Push' ? 'M3 6h8v12H3Zm10 6h8m-4-4 4 4-4 4' : 'M3 14h7v7H3ZM10 3h11v11H10Zm3 5h5m-2-2v5'"/></svg>{{ t }}</button><label class="duration-control"><span>Duration <strong>{{ transitionDuration.toFixed(1) }} s</strong></span><input v-model.number="transitionDuration" class="vk-slider" type="range" min="0.2" max="1.8" step="0.1" :style="{'--value':(transitionDuration-.2)/1.6}" aria-label="Transition duration"/></label><button v-hover class="vk-button primary preview-transition" @click="previewTransition"><svg viewBox="0 0 24 24"><path d="m9 4 11 8-11 8Z"/></svg>Preview transition</button><p class="inspector-help">{{ transition==='Magic Move' ? 'An illustrated zoom transition, inspired by Magic Move.' : transition==='Push' ? 'Slide the next idea gently into view.' : 'A soft fade between one thought and the next.' }}</p></fieldset><label v-if="inspectorTab==='Notes'" class="notes-label"><span class="vk-headline">Presenter notes</span><span class="vk-footnote vk-secondary">Slide {{ index+1 }}</span><textarea v-model="notes[index]" class="vk-field" rows="7" aria-label="Presenter notes for the selected slide" maxlength="3000"/></label><p v-if="inspectorTab==='Notes'" class="inspector-help">Notes stay in this session and appear in your rehearsal display.</p><section v-if="inspectorTab==='Design'" class="layout-card vk-well"><span>SLIDE LAYOUT</span><div class="layout-preview"><i/><b/><em/></div><strong>{{ index===0 ? 'Title & artwork' : index===3 ? 'Data & story' : 'Editorial layout' }}</strong><small>Widescreen · 16:9 · {{ theme }}</small><p>Eight thoughtfully composed slides. Change the theme to recolor the entire deck.</p></section></div></aside>
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
    <div class="rehearsal-options"><div class="vk-segmented" aria-label="Rehearsal environment"><button v-hover :aria-pressed="rehearsalRoom==='Theater'" @click="rehearsalRoom='Theater'">Theater</button><button v-hover :aria-pressed="rehearsalRoom==='Boardroom'" @click="rehearsalRoom='Boardroom'">Boardroom</button></div><button v-hover class="vk-button" :aria-pressed="lightsDown" @click="lightsDown=!lightsDown">{{ lightsDown ? 'Lights down' : 'Lights up' }}</button><button v-hover class="vk-icon" :aria-label="timerPaused ? 'Resume rehearsal timer' : 'Pause rehearsal timer'" :aria-pressed="timerPaused" @click="toggleTimer"><svg viewBox="0 0 24 24"><path :d="timerPaused ? 'm9 4 11 8-11 8Z' : 'M8 5v14M16 5v14'"/></svg></button></div><div class="presenter-workspace vk-scroll" :class="{ 'lights-down':lightsDown, boardroom:rehearsalRoom==='Boardroom' }">
      <main class="current-slide"><div class="presenter-label"><span class="vk-headline">Current slide</span><span class="vk-footnote vk-secondary">{{ index+1 }} of 8</span></div><div class="slide-frame"><Transition :name="animation" mode="out-in"><SlideArt :key="index" :index="index" :theme="theme" animate/></Transition></div><div class="rehearse-nav"><button v-hover class="vk-button" :disabled="index===0" @click="advance(-1)">Previous</button><button v-hover class="vk-button primary" :disabled="index===7" @click="advance()">Next slide<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button></div></main>
      <aside class="presenter-side"><div class="presenter-label"><span class="vk-headline">{{ index===7 ? 'The final slide' : 'Up next' }}</span><span class="vk-footnote vk-secondary">{{ index===7 ? 'Questions welcome' : nextIndex+1 }}</span></div><div class="next-slide"><SlideArt :index="nextIndex" :theme="theme"/></div><div class="presenter-notes vk-platter vk-scroll"><h2 class="vk-headline">Presenter notes</h2><p class="vk-body">{{ notes[index] || 'A little pause is a perfectly good note.' }}</p></div></aside>
      <div class="audience-strip vk-platter"><div class="audience-label"><span class="vk-footnote vk-secondary">{{ rehearsalRoom.toUpperCase() }} · VIRTUAL AUDIENCE</span><span class="vk-chip">Fictional, but attentive</span></div><div class="room-architecture" aria-hidden="true"><i/><i/><i/><span/></div><Audience class="audience-art" :reaction="audienceReaction" :applause="index===7"/><p class="vk-footnote vk-secondary" aria-live="polite">{{ audienceCaption }}</p></div>
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

.keynote-app{container-type:size;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}.save-state{display:inline-flex;align-items:center;gap:5px;margin-left:10px;font-size:10px}.save-state i{width:5px;height:5px;border-radius:50%;background:#aacdb8}.edit-workspace{grid-template-columns:148px minmax(0,1fr) 244px;gap:20px;overflow:hidden}.inspector{padding:20px 16px;gap:14px;overflow:hidden}.inspector-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;flex:none}.inspector-heading h2{font-size:21px}.inspector-heading span{font-size:10px}.inspector-tabs{width:100%;flex:none}.inspector-tabs>button{flex:1;padding:0 8px;font-size:11px;min-height:44px}.inspector-content{flex:1;min-height:0;display:flex;flex-direction:column;gap:18px;padding:4px 3px}.theme-grid{gap:12px}.theme-preview{height:55px}.theme-choice{font-size:11px}.theme-choice.selected{background:#ffffff0c}.layout-card{padding:16px;display:flex;flex-direction:column;gap:10px}.layout-card>span{font-size:9px;letter-spacing:1px;color:#ffffff8a}.layout-card strong{font-size:14px}.layout-card small{font-size:10px;color:#ffffff90}.layout-card p{font-size:11px;line-height:1.5;color:#ffffffa6}.layout-preview{height:82px;border-radius:9px;background:#182537;position:relative;overflow:hidden}.layout-preview i{position:absolute;left:14px;top:18px;width:42%;height:10px;background:#e8eeea;border-radius:3px}.layout-preview b{position:absolute;left:14px;top:36px;width:33%;height:5px;background:#a5d7cb;border-radius:2px}.layout-preview em{position:absolute;width:48px;height:48px;right:17px;top:17px;border-radius:50%;background:radial-gradient(circle at 20% 20%,#b9d5c4,#536f76 50%,#253749)}.duration-control{display:block;font-size:13px;margin-top:24px}.duration-control>span{display:flex;justify-content:space-between}.duration-control strong{font-weight:500;color:#b8dacf}.preview-transition{width:100%;margin-top:16px;font-size:12px}.inspector-help{font-size:12px;line-height:1.6;color:#ffffff90;margin-top:14px}.transition-choice{font-size:13px;min-height:52px}.notes-label textarea{min-height:250px;resize:none;font-size:14px}.editor-canvas{justify-content:flex-start;padding-top:8px;gap:16px;overflow:auto;min-height:0;overscroll-behavior:contain;scrollbar-width:none}.editor-canvas .slide-frame{flex:none;width:min(100%,calc((100cqh - 295px) * 1.7778));align-self:center;min-width:240px}.canvas-heading{flex:none}.canvas-footer{align-self:center;flex:none;padding:6px;gap:16px;border-radius:99px}.canvas-footer .vk-icon{width:40px;height:40px}.slide-story{padding:18px 20px;width:100%;display:grid;gap:6px;flex:none}.story-label{font-size:9px;letter-spacing:1.5px;color:#ffffff7a}.slide-story strong{font-size:16px;letter-spacing:-.025em}.slide-story p{font-size:12px;line-height:1.5;color:#ffffffa6}.slide-story .vk-button{margin-top:7px;font-size:11px;padding:0 13px;justify-self:start;min-height:44px}.slide-story svg{width:15px;height:15px}.rehearsal-options{display:flex;align-items:center;gap:10px;flex:none}.rehearsal-options .vk-button{font-size:12px}.rehearsal-options .vk-icon{margin-left:auto}.rehearsal-options .vk-segmented button{min-height:44px;font-size:13px}.rehearse-header{gap:18px}.clocks time{font-size:24px}.presenter-workspace{gap:18px}.current-slide .slide-frame{max-width:min(100%,calc((100cqh - 340px) * 1.7778));min-width:210px;align-self:center;flex:none}.presenter-notes{min-height:130px}.presenter-notes p{font-size:13px}.rehearse-nav{margin-top:0}.audience-strip{position:relative;isolation:isolate;overflow:hidden;min-height:150px;background:linear-gradient(#39404466,#1a253566);padding:16px 22px}.room-architecture{position:absolute;inset:0;z-index:-1;opacity:.4;background:linear-gradient(180deg,#17252a,#465951)}.room-architecture i{position:absolute;top:-20px;left:20%;width:2px;height:150px;background:#e8caa0;transform:rotate(16deg)}.room-architecture i:nth-child(2){left:50%;transform:none}.room-architecture i:nth-child(3){left:80%;transform:rotate(-16deg)}.room-architecture span{position:absolute;left:20%;right:20%;top:28px;height:50px;background:#fff2;border-radius:10px;box-shadow:0 0 30px #fff2}.boardroom .room-architecture{background:linear-gradient(90deg,#64807b55,#b0c1af55,#64807b55)}.boardroom .room-architecture i{width:90px;height:100%;border:2px solid #cadbd34a;background:#b8d4d32a;transform:none;top:0}.lights-down .room-architecture{filter:brightness(.55)}.audience-art{max-height:82px}.presentation-controls{bottom:20px}.dissolve-enter-active,.dissolve-leave-active,.push-enter-active,.push-leave-active,.magic-enter-active,.magic-leave-active{transition-duration:var(--transition-duration,.6s)}
@container(max-height:560px) and (min-width:701px){.keynote-app .edit-workspace{gap:16px}.editor-canvas{gap:12px}.editor-canvas .slide-frame{width:min(100%,calc((100cqh - 260px) * 1.7778));min-width:210px}.slide-story{padding:14px 18px}.slide-story .vk-button{display:none}.layout-card{padding:12px}.layout-preview{height:60px}.inspector{padding:16px 14px}.inspector-content{gap:14px}.rehearse-header .vk-title{font-size:23px}.current-slide .slide-frame{max-width:min(100%,calc((100cqh - 280px)*1.7778))}.audience-strip{min-height:140px}.rehearse-header .vk-footnote{font-size:11px}}
@container(max-width:750px){.edit-workspace{display:flex;flex-direction:column;gap:20px;overflow:visible}.keynote-app.edit{overflow-y:auto;display:block;overscroll-behavior:contain;padding:22px 20px}.workbar{flex-direction:column;align-items:flex-start;gap:16px}.work-actions{width:100%}.work-actions .vk-button{flex:1;font-size:14px}.edit-workspace{margin-top:20px}.editor-canvas{order:0;overflow:visible;gap:14px}.editor-canvas .slide-frame{width:100%;min-width:0}.slide-story{padding:16px}.inspector{order:1;overflow:visible;padding:20px;gap:18px}.inspector-content{overflow:visible;flex:none}.slide-navigator{order:2}.inspector-tabs>button{font-size:13px}.theme-preview{height:75px}.theme-choice{font-size:13px}.inspector-heading h2{font-size:23px}.rehearsal-options{flex-wrap:wrap;gap:8px}.rehearsal-options .vk-segmented button{padding:0 12px;font-size:12px}.rehearsal-options .vk-button{padding:0 13px;font-size:11px}.presenter-workspace{display:flex;flex-direction:column}.current-slide .slide-frame{width:100%;max-width:none;min-width:0}.rehearse-header{flex-wrap:wrap}.clocks{order:3;width:100%;justify-content:space-between}.rehearse-header>div:first-child{flex-basis:65%}.rehearse-header .vk-title{font-size:25px}.notes-label textarea{min-height:220px}.save-state{display:none}}


.editor-canvas .slide-frame{width:min(100%,calc((100cqh - 360px)*1.7778))}.slide-story{grid-template-columns:minmax(0,1fr) auto;gap:5px 14px;padding:14px 18px}.slide-story .vk-button{grid-column:2;grid-row:1/4;align-self:center;margin:0}.slide-story .story-label,.slide-story strong,.slide-story p{grid-column:1}.slide-story strong{font-size:14px}.slide-story p{font-size:11px}.layout-preview{height:54px}.layout-preview em{height:36px;width:36px;top:9px}.layout-preview i{top:15px}.layout-preview b{top:31px}.current-slide .slide-frame{max-width:min(100%,calc((100cqh - 470px)*1.7778))}.next-slide{max-height:124px;width:100%;align-self:center}.presenter-notes{max-height:160px;min-height:130px;overflow:auto}
@container(max-height:560px) and (min-width:701px){.editor-canvas .slide-frame{width:min(100%,calc((100cqh - 330px)*1.7778));min-width:210px}.slide-story .vk-button{display:inline-flex}.layout-card{display:none}.current-slide .slide-frame{max-width:min(100%,calc((100cqh - 390px)*1.7778));min-width:190px}.next-slide{max-height:90px}.audience-strip{display:none}.presenter-notes{max-height:145px;min-height:120px}}
@container(max-width:750px){.editor-canvas .slide-frame{width:100%;min-width:0}.current-slide .slide-frame{max-width:none;min-width:0}.next-slide{max-height:none}.presenter-notes{max-height:none;overflow:visible}.slide-story{grid-template-columns:minmax(0,1fr) auto;gap:6px 12px}.layout-preview{height:75px}}
</style>