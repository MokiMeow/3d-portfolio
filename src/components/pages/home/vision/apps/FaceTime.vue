<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import Persona from './facetime/Persona.vue';
import CallGlyph from './facetime/CallGlyph.vue';
import { contacts, replyTo, type Contact } from './facetime/contacts';
defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
type Phase = 'start' | 'ringing' | 'call' | 'ended' | 'busy';
type Reaction = 'heart' | 'balloon' | 'confetti' | 'fireworks';
const phase = ref<Phase>('start'), name = ref(''), contact = ref<Contact>(contacts[0]!);
const muted = ref(false), camera = ref(true), captions = ref(true), effects = ref(false), share = ref(false), moviePlaying = ref(true);
const elapsed = ref(0), movieTime = ref(0), speaker = ref(0), spoken = ref(''), speaking = ref(false), message = ref('');
const reaction = ref<Reaction | null>(null), effectKey = ref(0), callCount = ref(0);
const stage = ref<HTMLElement>(), self = ref<HTMLElement>();
const selfPosition = ref<{x:number; y:number} | null>(null);
const recent = ref<{id:string;name:string;time:string;duration:string}[]>([
  {id:'duck',name:'Rubber Duck',time:'Today, 10:42',duration:'Incoming · 3 min'},
  {id:'committee',name:'The Chai Committee',time:'Yesterday, 4:00',duration:'Group · 8 min'},
  {id:'cat',name:'A Very Polite Cat',time:'Yesterday, 2:15',duration:'Incoming · mostly silence'},
]);
const filtered = computed(() => contacts.filter(c => c.name.toLowerCase().includes(name.value.toLowerCase().trim())));
const callers = computed(() => contact.value.kind === 'chai' ? [
  { name:'Ginger', kind:contact.value.kind, color:'#bd8765', variant:0 },
  { name:'Cardamom', kind:contact.value.kind, color:'#88a994', variant:1 },
  { name:'Biscuit', kind:contact.value.kind, color:'#d6ad75', variant:2 },
] : [{ name:contact.value.name, kind:contact.value.kind, color:contact.value.color, variant:0 }]);
const duration = computed(() => Math.floor(elapsed.value / 60).toString().padStart(2,'0') + ':' + Math.floor(elapsed.value % 60).toString().padStart(2,'0'));
const reactions: {id:Reaction;label:string}[] = [{id:'heart',label:'Hearts'},{id:'balloon',label:'Balloons'},{id:'confetti',label:'Confetti'},{id:'fireworks',label:'Fireworks'}];
let ringingTimer: ReturnType<typeof setTimeout> | undefined, captionTimer: ReturnType<typeof setTimeout> | undefined, reactionTimer: ReturnType<typeof setTimeout> | undefined;
let callTimer: ReturnType<typeof setInterval> | undefined, lineTimer: ReturnType<typeof setInterval> | undefined;
let startedAt = 0, lineIndex = 0, lastTick = 0;
let drag: {id:number;x:number;y:number;startX:number;startY:number} | undefined;
function clearCall(): void { clearTimeout(ringingTimer); clearTimeout(captionTimer); clearInterval(callTimer); clearInterval(lineTimer); clearTimeout(reactionTimer); speaking.value=false; reaction.value=null; effects.value=false; }
function say(line: string): void { clearTimeout(captionTimer); spoken.value=line; speaking.value=true; captionTimer=setTimeout(() => speaking.value=false, 2800); }
function nextLine(): void { speaker.value=lineIndex % callers.value.length; say(contact.value.lines[lineIndex % contact.value.lines.length]!); lineIndex++; }
function connect(): void {
  phase.value='call'; startedAt=performance.now(); lastTick=startedAt; lineIndex=0; nextLine();
  callTimer=setInterval(() => { const now=performance.now(); elapsed.value=(now-startedAt)/1000; if(share.value && moviePlaying.value) movieTime.value=(movieTime.value+(now-lastTick)/1000)%24; lastTick=now; },250);
  lineTimer=setInterval(nextLine, 5200);
}
function call(person: Contact): void {
  clearCall(); contact.value=person; phase.value='ringing'; elapsed.value=0; share.value=false; movieTime.value=0;
  muted.value=false; camera.value=true; selfPosition.value=null; callCount.value++;
  ringingTimer=setTimeout(() => {
    if(person.kind==='future' && callCount.value % 2===1) { phase.value='busy'; return; }
    connect();
  },2400);
}
function callSearch(): void { const person=filtered.value[0]; if(person) call(person); else vision.toast('Only the six fictional demo contacts are available. Try “Duck” or “Cat”.'); }
function end(): void { clearCall(); phase.value='ended'; recent.value=[{id:contact.value.id,name:contact.value.name,time:'Just now',duration:'Video · '+duration.value},...recent.value].slice(0,6); }
function submit(): void {
  const text=message.value.trim(); if(!text) return; message.value='';
  say(replyTo(contact.value,text));
  clearInterval(lineTimer); lineTimer=setInterval(nextLine,6200);
}
function react(id: Reaction): void { clearTimeout(reactionTimer); reaction.value=id; effectKey.value++; effects.value=false; reactionTimer=setTimeout(() => reaction.value=null,4200); }
function selfDown(event: PointerEvent): void {
  if(event.button!==0 || !stage.value || !self.value) return;
  const bounds=stage.value.getBoundingClientRect(), box=self.value.getBoundingClientRect();
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:box.left-bounds.left,startY:box.top-bounds.top};
  self.value.setPointerCapture(event.pointerId);
}
function selfMove(event: PointerEvent): void {
  if(!drag || drag.id!==event.pointerId || !stage.value || !self.value) return;
  selfPosition.value={x:Math.max(0,Math.min(stage.value.clientWidth-self.value.offsetWidth,drag.startX+event.clientX-drag.x)),y:Math.max(0,Math.min(stage.value.clientHeight-self.value.offsetHeight,drag.startY+event.clientY-drag.y))};
}
function selfUp(): void { drag=undefined; }
onBeforeUnmount(clearCall);
</script>

<template>
<section class="facetime-app" :class="{ compact, solid:vision.reduceTransparency.value }" aria-label="FaceTime demo">
  <div v-if="phase==='start'" class="start-view vk-scroll">
    <header class="start-header"><div><p class="eyebrow">A LITTLE CLOSER, FROM ANYWHERE</p><h1 class="vk-large-title">FaceTime</h1><p class="vk-secondary">Good company. Entirely imaginary.</p></div><span class="vk-chip">Demo contacts</span></header>
    <form class="name-search" @submit.prevent="callSearch"><input v-model="name" class="vk-field" placeholder="Enter a name" aria-label="Enter a fictional contact name" maxlength="80"/><button v-hover class="vk-button primary" type="submit"><CallGlyph name="camera"/>Call</button></form>
    <div class="contact-grid"><button v-for="person in filtered" :key="person.id" v-hover class="contact-card vk-platter" @click="call(person)"><div class="avatar-orb" :style="{'--orb':person.color}"><Persona :kind="person.kind" :color="person.color" still/></div><strong class="vk-headline">{{ person.name }}</strong><span class="vk-footnote vk-secondary">{{ person.subtitle }}</span><span class="call-hint"><CallGlyph name="camera"/>FaceTime Video</span></button></div>
    <p v-if="!filtered.length" class="empty vk-secondary">No contact found. These six fictional friends are our whole address book.</p>
    <div class="recent vk-platter"><h2 class="vk-title">Recent calls</h2><button v-for="(item,i) in recent" :key="i" v-hover class="vk-row" @click="call(contacts.find(c=>c.id===item.id)!)"><span class="recent-icon"><CallGlyph name="camera"/></span><span><strong class="vk-headline">{{ item.name }}</strong><small class="vk-footnote vk-secondary">{{ item.duration }}</small></span><time class="vk-footnote vk-secondary">{{ item.time }}</time></button></div>
    <p class="demo-note vk-footnote vk-tertiary">Scripted Personas and captions. No camera, microphone, or real calls.</p>
  </div>
  <div v-else-if="phase==='ringing'" class="ringing-view" :style="{'--caller':contact.color}">
    <div class="ringing-orb"><span class="ring"/><span class="ring second"/><span class="ring third"/><Persona :kind="contact.kind" :color="contact.color"/></div>
    <h1 class="vk-large-title">{{ contact.name }}</h1><p class="vk-body vk-secondary">FaceTime Video…</p><p class="vk-footnote vk-tertiary">Connecting an entirely fictional friend</p><button v-hover class="vk-button cancel" @click="clearCall(); phase='start'"><CallGlyph name="end"/>Cancel</button>
  </div>
  <div v-else-if="phase==='call'" class="call-view">
    <header class="call-header"><div><span class="live-dot"/>{{ contact.name }}<span class="vk-footnote vk-secondary">Demo call</span></div><time>{{ duration }}</time></header>
    <div ref="stage" class="call-stage vk-scroll" :class="{group:callers.length>1,'sharing':share}">
      <div class="persona-tiles"><article v-for="(person,i) in callers" :key="person.name" class="persona-tile vk-platter" :class="{ 'active-speaker':speaker===i && speaking }" :style="{'--persona':person.color,'--order':i}"><div class="portrait"><Persona :kind="person.kind" :color="person.color" :variant="person.variant" :speaking="speaker===i && speaking"/></div><div class="persona-name"><span class="speaker-dot" :class="{talking:speaker===i && speaking}"/>{{ person.name }}</div><p v-if="captions && speaker===i" class="caption" aria-live="polite">{{ spoken }}</p><p v-else class="caption-placeholder">{{ captions ? 'Listening, in excellent company.' : 'Captions are off' }}</p></article></div>
      <div v-if="share" class="shared-panel vk-platter"><div class="movie" :class="{paused:!moviePlaying}"><div class="movie-orbit one"/><div class="movie-orbit two"/><span>THE QUIET BETWEEN</span><strong>A film about taking your time.</strong><small>Looping gradient film · Demo SharePlay</small></div><div class="movie-controls"><button v-hover class="vk-icon" :aria-label="moviePlaying ? 'Pause shared film' : 'Play shared film'" @click="moviePlaying=!moviePlaying"><CallGlyph :name="moviePlaying ? 'pause' : 'play'"/></button><div class="playbar"><span :style="{width:movieTime/24*100+'%'}"/></div><button v-hover class="vk-button" @click="share=false">Stop sharing</button></div></div>
      <div ref="self" class="self-view vk-platter" :class="{off:!camera}" :style="selfPosition ? {left:selfPosition.x+'px',top:selfPosition.y+'px',right:'auto',bottom:'auto'} : undefined" tabindex="0" role="group" aria-label="You — simulated self view. Drag to move." @pointerdown="selfDown" @pointermove="selfMove" @pointerup="selfUp" @pointercancel="selfUp" @lostpointercapture="selfUp">
        <svg v-if="camera" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="36" r="19" fill="#dbe1ef" opacity=".7"/><path d="M14 100V88c0-42 72-42 72 0v12" fill="#dbe1ef" opacity=".5"/></svg><CallGlyph v-else name="cameraOff"/><span>You{{ muted ? ' · muted' : '' }}</span>
      </div>
      <div v-if="reaction" :key="effectKey" class="reaction-layer" :class="reaction" aria-hidden="true"><span v-for="i in 32" :key="i" class="particle" :style="{'--x':(i*37%100)+'%','--delay':(i%8*.12)+'s','--turn':(i*47)+'deg','--hue':(i*43)+'deg','--size':(18+i%5*7)+'px'}"><CallGlyph v-if="reaction==='heart' || reaction==='balloon' || reaction==='fireworks'" :name="reaction"/></span></div>
    </div>
    <form class="message-bar" @submit.prevent="submit"><label class="sr-only" for="demo-call-message">Type a message to the caller</label><input id="demo-call-message" v-model="message" class="vk-field" placeholder="Say something… try “bug”, “lunch”, or “chai”" maxlength="240"/><button v-hover class="vk-icon" type="submit" aria-label="Send message" :disabled="!message.trim()"><CallGlyph name="send"/></button></form>
    <div class="call-controls"><div v-if="effects" class="effects-sheet vk-sheet" role="group" aria-label="Choose a reaction"><button v-for="item in reactions" :key="item.id" v-hover class="vk-button" @click="react(item.id)"><CallGlyph :name="item.id"/>{{ item.label }}</button><button class="vk-button" @click="effects=false">Done</button></div><div class="vk-ornament control-ornament">
      <button v-hover class="control" :aria-pressed="muted" @click="muted=!muted"><span class="vk-icon" :class="{chosen:muted}"><CallGlyph :name="muted ? 'muted' : 'mic'"/></span><span>{{ muted ? 'Unmute' : 'Mute' }}</span></button>
      <button v-hover class="control" :aria-pressed="camera" @click="camera=!camera"><span class="vk-icon" :class="{chosen:!camera}"><CallGlyph :name="camera ? 'camera' : 'cameraOff'"/></span><span>Camera</span></button>
      <button v-hover class="control" :aria-expanded="effects" @click="effects=!effects"><span class="vk-icon" :class="{chosen:effects}"><CallGlyph name="effects"/></span><span>Effects</span></button>
      <button v-hover class="control" :aria-pressed="share" @click="share=!share"><span class="vk-icon" :class="{chosen:share}"><CallGlyph name="share"/></span><span>SharePlay</span></button>
      <button v-hover class="control" :aria-pressed="captions" @click="captions=!captions"><span class="vk-icon" :class="{chosen:captions}"><CallGlyph name="captions"/></span><span>Captions</span></button>
      <button v-hover class="control end-control" @click="end"><span class="vk-icon"><CallGlyph name="end"/></span><span>End</span></button>
    </div></div>
  </div>
  <div v-else class="ended-view"><div class="ended-card vk-platter"><div class="ended-avatar"><Persona :kind="contact.kind" :color="contact.color" still/></div><h1 class="vk-large-title">{{ phase==='busy' ? 'A little ahead of schedule' : 'Call ended' }}</h1><p class="vk-secondary">{{ phase==='busy' ? 'Future You is busy. Try again in 5 years. Or in a few seconds.' : contact.name + ' · ' + duration }}</p><p class="vk-footnote vk-tertiary">{{ phase==='busy' ? 'Time travel is a demo feature with imperfect availability.' : 'A fictional call. A perfectly good little break.' }}</p><button v-hover class="vk-button primary" @click="call(contact)"><CallGlyph name="camera"/>Call Again</button><button v-hover class="vk-button" @click="phase='start'">Back to contacts</button></div></div>
</section>
</template>

<style src="../kit/kit.css"></style>
<style scoped>
.facetime-app {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  color: var(--vk-text);
  background: radial-gradient(ellipse at 70% 0%,#71978633,transparent 65%);
}
.facetime-app * {
  box-sizing: border-box;
}
button,input {
  font: inherit;
  color: inherit;
}
button {
  cursor: pointer;
  border: 0;
  background: transparent;
}
button:disabled {
  opacity: .35;
  cursor: default;
}
h1,h2,p {
  margin: 0;
}
svg {
  width: 22px;
  height: 22px;
  flex: none;
}
:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}
.start-view {
  height: 100%;
  padding: 28px 32px 24px;
}
.start-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}
.start-header h1 {
  font-size: 40px;
  margin: 6px 0 8px;
}
.eyebrow {
  font-size: 10px;
  letter-spacing: 2.2px;
  color: #bbd9c8;
}
.start-header .vk-chip {
  flex: none;
}
.name-search {
  display: flex;
  gap: 12px;
  margin: 22px 0;
}
.name-search input {
  max-width: 480px;
}
.contact-grid {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 14px;
}
.contact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 18px 14px 15px;
  gap: 7px;
  min-height: 206px;
  transition: transform .3s var(--vk-spring);
}
.contact-card:hover {
  transform: translateY(-3px);
}
.avatar-orb {
  width: 90px;
  height: 90px;
  overflow: hidden;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 15%,var(--orb),#20273f);
  box-shadow: inset 0 1px 2px #ffffff4d,0 8px 20px #0003;
}
.avatar-orb :deep(svg) {
  width: 100%;
  height: 100%;
  transform: scale(1.12) translateY(8px);
}
.contact-card>.vk-footnote {
  font-size: 12px;
  max-width: 210px;
  min-height: 31px;
}
.call-hint {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: #bcd9c9;
  margin-top: 5px;
}
.call-hint svg {
  width: 15px;
  height: 15px;
}
.recent {
  margin-top: 24px;
  padding: 19px 16px;
}
.recent h2 {
  margin: 0 12px 12px;
}
.recent-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #83bc9a26;
  color: #b4d6c1;
}
.recent small {
  display: block;
  margin-top: 4px;
}
.recent time {
  margin-left: auto;
}
.demo-note {
  text-align: center;
  margin-top: 19px;
}
.empty {
  padding: 20px;
}
.ringing-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 15px;
  padding: 30px;
  text-align: center;
  background: radial-gradient(ellipse at 50% 30%,var(--caller),#273146 75%);
}
.ringing-orb {
  width: 195px;
  height: 195px;
  position: relative;
  margin-bottom: 25px;
  background: #ffffff15;
  border-radius: 50%;
  box-shadow: inset 0 1px 2px #fff5;
}
.ringing-orb :deep(svg) {
  position: relative;
  width: 100%;
  height: 100%;
  z-index: 1;
}
.ring {
  position: absolute;
  inset: 0;
  border: 1px solid #fff7;
  border-radius: 50%;
  animation: ringing 2.4s ease-out infinite;
}
.ring.second {
  animation-delay: .8s;
}
.ring.third {
  animation-delay: 1.6s;
}
.cancel {
  margin-top: 25px;
  background: #ffffff24;
}
.call-view {
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0,1fr) auto auto;
  background: radial-gradient(ellipse at 50% 0%,#526b7855,#23293633 75%);
  padding: 24px 28px 20px;
  gap: 14px;
}
.call-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font-size: 16px;
}
.call-header>div {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.call-header time {
  font-variant-numeric: tabular-nums;
  opacity: .7;
}
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #77d4a0;
  box-shadow: 0 0 13px #7fd19c;
}
.call-stage {
  position: relative;
  min-height: 0;
  border-radius: 24px;
  padding: 8px 2px 4px;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 14px;
}
.persona-tiles {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  perspective: 1200px;
  min-height: 100%;
  width: 100%;
  padding: 0 85px;
}
.persona-tile {
  position: relative;
  flex: 1;
  max-width: 395px;
  min-width: 0;
  align-self: center;
  overflow: hidden;
  background: radial-gradient(ellipse at 45% 30%,color-mix(in srgb,var(--persona) 32%,transparent),#29334466);
  border: 1px solid #ffffff15;
  border-radius: 30px;
  box-shadow: 0 15px 28px #0003;
  transition: box-shadow .4s,transform .4s var(--vk-spring);
}
.persona-tile.active-speaker {
  box-shadow: 0 0 0 2px #bdded17d,0 15px 28px #0003;
}
.portrait {
  height: 235px;
  display: flex;
  justify-content: center;
}
.portrait :deep(svg) {
  width: 100%;
  height: 100%;
  max-width: 310px;
}
.persona-name {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 650;
  margin: 0 14px 9px;
}
.speaker-dot {
  height: 6px;
  width: 6px;
  border-radius: 50%;
  background: #ffffff4d;
}
.speaker-dot.talking {
  background: #9beab7;
}
.caption,.caption-placeholder {
  padding: 12px 18px 18px;
  text-align: center;
  font-size: 16px;
  line-height: 1.45;
  min-height: 88px;
  background: linear-gradient(transparent,#12192355);
}
.caption-placeholder {
  font-size: 13px;
  opacity: .5;
  display: flex;
  align-items: center;
  justify-content: center;
}
.group .persona-tiles {
  padding: 12px 0;
  gap: 14px;
}
.group .persona-tile {
  max-width: 285px;
}
.group .persona-tile:first-child {
  transform: rotateY(8deg) translateY(15px);
}
.group .persona-tile:last-child {
  transform: rotateY(-8deg) translateY(15px);
}
.group .portrait {
  height: 210px;
}
.group .caption {
  font-size: 14px;
  min-height: 105px;
}
.group .caption-placeholder {
  min-height: 105px;
}
.self-view {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 102px;
  height: 122px;
  border-radius: 22px;
  background: linear-gradient(140deg,#8b92b077,#455368);
  overflow: hidden;
  box-shadow: 0 10px 20px #0003;
  cursor: grab;
  touch-action: none;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  max-width: 100%;
  max-height: 100%;
}
.self-view>svg {
  width: 100%;
  height: auto;
  min-height: 0;
  flex: 1;
}
.self-view.off>svg {
  width: 32px;
  height: 32px;
  flex: none;
  margin: auto;
}
.self-view span {
  font-size: 11px;
  padding: 7px 0;
  background: #1c233c66;
  width: 100%;
  text-align: center;
}
.self-view:active {
  cursor: grabbing;
}
.message-bar {
  display: flex;
  gap: 10px;
  max-width: 680px;
  justify-self: center;
  width: 100%;
}
.message-bar input {
  font-size: 14px;
}
.call-controls {
  position: relative;
  justify-self: center;
  width: max-content;
  max-width: 100%;
}
.control-ornament {
  gap: 12px;
  padding: 9px 18px;
  border-radius: 35px;
}
.control {
  min-width: 57px;
  min-height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  border-radius: 18px;
  padding: 0;
}
.control>span:last-child {
  font-size: 11px;
  opacity: .8;
}
.control .vk-icon {
  width: 44px;
  height: 44px;
}
.control .chosen {
  background: #dceee7;
  color: #253a35;
}
.end-control .vk-icon {
  background: #ff453a;
  color: #fff;
}
.effects-sheet {
  position: absolute;
  bottom: 95px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  width: 310px;
  max-width: 85vw;
}
.effects-sheet .vk-button {
  flex: 1;
  font-size: 13px;
  padding: 0 12px;
}
.sharing .persona-tiles {
  min-height: 0;
  padding: 0 70px;
}
.sharing .portrait {
  height: 110px;
}
.sharing .caption,.sharing .caption-placeholder {
  min-height: 64px;
  font-size: 13px;
  padding: 10px;
}
.sharing .persona-tile {
  border-radius: 24px;
}
.shared-panel {
  width: min(560px,90%);
  padding: 12px;
  flex: none;
}
.movie {
  position: relative;
  height: 175px;
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(140deg,#c69376,#685980 50%,#415e79);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
}
.movie>span,.movie>strong,.movie>small {
  z-index: 1;
  position: relative;
  text-align: center;
}
.movie>span {
  font-size: 11px;
  letter-spacing: 4px;
}
.movie>strong {
  font-size: 22px;
  letter-spacing: -.5px;
}
.movie>small {
  font-size: 11px;
  opacity: .6;
}
.movie-orbit {
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%,#edce96,#cea69422 65%);
  filter: blur(4px);
  animation: movie-drift 24s ease-in-out infinite alternate;
}
.movie-orbit.one {
  left: -30px;
  top: 20px;
}
.movie-orbit.two {
  right: -35px;
  top: -100px;
  background: radial-gradient(circle,#94bdd4,#6392ac00 70%);
  animation-delay: -12s;
}
.movie.paused .movie-orbit {
  animation-play-state: paused;
}
.movie-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  padding-top: 9px;
}
.movie-controls .vk-button {
  font-size: 12px;
  padding: 0 12px;
}
.playbar {
  height: 5px;
  flex: 1;
  border-radius: 4px;
  background: #ffffff26;
  overflow: hidden;
}
.playbar span {
  display: block;
  height: 100%;
  background: #fff;
  border-radius: 4px;
}
.reaction-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 4;
}
.particle {
  position: absolute;
  left: var(--x);
  bottom: -70px;
  width: var(--size);
  height: var(--size);
  color: #ff8eaa;
  animation: reaction-rise 3.7s var(--delay) ease-out both;
}
.particle svg {
  width: 100%;
  height: 100%;
  fill: #f17d96;
  filter: drop-shadow(0 5px 9px #dc739566);
}
.balloon .particle {
  color: hsl(var(--hue) 80% 75%);
}
.balloon .particle svg {
  fill: currentColor;
}
.confetti .particle {
  width: 10px;
  height: 17px;
  background: hsl(var(--hue) 80% 75%);
  top: -30px;
  bottom: auto;
  animation: confetti-fall 3.4s var(--delay) ease-in both;
  border-radius: 2px;
}
.fireworks .particle {
  top: calc(var(--x) * .65);
  bottom: auto;
  animation: firework-pop 1.8s var(--delay) ease-out both;
  color: hsl(var(--hue) 90% 80%);
}
.fireworks .particle svg {
  fill: none;
  filter: drop-shadow(0 0 8px currentColor);
}
.ended-view {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 28px;
  overflow: auto;
}
.ended-card {
  padding: 28px;
  text-align: center;
  max-width: 490px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.ended-avatar {
  width: 125px;
  height: 125px;
  border-radius: 50%;
  overflow: hidden;
  background: #ffffff12;
}
.ended-avatar :deep(svg) {
  width: 100%;
  height: 100%;
}
.solid .persona-tile,.solid .contact-card,.solid .recent,.solid .ended-card,.solid .shared-panel {
  background: #353d48;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.compact .start-view {
  padding: 24px 20px;
}
.compact .start-header {
  align-items: flex-start;
  flex-direction: column;
  gap: 12px;
}
.compact .contact-grid {
  grid-template-columns: 1fr;
}
.compact .contact-card {
  display: grid;
  grid-template-columns: 76px 1fr;
  min-height: 116px;
  text-align: left;
  align-items: center;
  column-gap: 16px;
  padding: 15px;
}
.compact .avatar-orb {
  width: 76px;
  height: 76px;
  grid-row: 1/4;
}
.compact .contact-card>.vk-footnote {
  min-height: 0;
  max-width: none;
}
.compact .call-hint {
  margin: 0;
}
.compact .recent {
  padding: 16px 6px;
}
.compact .recent .vk-row {
  flex-wrap: wrap;
  gap: 10px;
}
.compact .recent time {
  margin-left: 48px;
}
.compact .call-view {
  padding: 20px 16px 14px;
  gap: 12px;
}
.compact .call-header {
  align-items: flex-start;
  font-size: 14px;
}
.compact .call-header .vk-footnote {
  font-size: 11px;
}
.compact .persona-tiles,.compact .group .persona-tiles,.compact .sharing .persona-tiles {
  flex-direction: column;
  padding: 0;
  width: 100%;
  gap: 18px;
  min-height: 0;
}
.compact .persona-tile,.compact .group .persona-tile {
  width: 100%;
  max-width: none;
  flex: none;
  transform: none;
}
.compact .portrait {
  height: 220px;
}
.compact .group .portrait {
  height: 190px;
}
.compact .caption,.compact .caption-placeholder {
  font-size: 15px;
  min-height: 80px;
}
.compact .self-view {
  width: 75px;
  height: 95px;
  right: 8px;
  top: 8px;
  bottom: auto;
  border-radius: 18px;
}
.compact .control-ornament {
  border-radius: 28px;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  padding: 10px;
  gap: 8px 14px;
}
.compact .call-controls {
  width: 100%;
}
.compact .control {
  min-height: 64px;
}
.compact .shared-panel {
  width: 100%;
}
.compact .movie>strong {
  font-size: 17px;
}
.compact .effects-sheet {
  bottom: 165px;
}
.compact .name-search {
  gap: 8px;
}
.compact .name-search .vk-button {
  padding: 0 14px;
}
.compact .ringing-orb {
  width: 160px;
  height: 160px;
}
.compact .ringing-view h1 {
  font-size: 28px;
}
.compact .ended-card {
  padding: 22px;
}
.compact .ended-card h1 {
  font-size: 27px;
}
.compact .message-bar input {
  font-size: 13px;
}
@media(max-width:700px) {
  .contact-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
  .persona-tiles {
    padding: 0 30px;
  }
  .control-ornament {
    gap: 6px;
  }
}
@keyframes ringing {
  to {
    transform: scale(1.65);
    opacity: 0;
  }
}
@keyframes reaction-rise {
  0% {
    opacity: 0;
    transform: translateY(0) rotate(-10deg);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-520px) rotate(20deg);
  }
}
@keyframes confetti-fall {
  to {
    transform: translateY(650px) rotate(var(--turn));
    opacity: 0;
  }
}
@keyframes firework-pop {
  0% {
    opacity: 0;
    transform: scale(.1);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(4);
  }
}
@keyframes movie-drift {
  to {
    transform: translate(140px,30px) rotate(90deg);
  }
}
@media(prefers-reduced-motion:reduce) {
  .facetime-app * {
    animation: none!important;
    transition: none!important;
  }
  .particle {
    bottom: 40%;
    opacity: .6;
  }
  .confetti .particle {
    top: 40%;
  }
  .ring {
    display: none;
  }
}
</style>
