<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import AppSheet from './arcade/AppSheet.vue';
import Persona from './facetime/Persona.vue';
import CallGlyph from './facetime/CallGlyph.vue';
import { contacts, replyTo, type Contact } from './facetime/contacts';
defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
type Phase = 'start' | 'ringing' | 'call' | 'ended' | 'busy';
type Reaction = 'heart' | 'balloon' | 'confetti' | 'fireworks';
const sharePicker = ref(false), shareMedia = ref<'film' | 'music'>('film');
const homeTab = ref<'People' | 'Recents'>('People');
const appRootElement = ref<HTMLElement>(), searchField = ref<HTMLInputElement>();
const paused = ref(false), pageHidden=ref(false);
let visibilityObserver: IntersectionObserver | undefined;
function startSharing(media: 'film' | 'music'): void { shareMedia.value=media; share.value=true; movieTime.value=0; sharePicker.value=false; }
function appKeys(event: KeyboardEvent): void {
  if (event.key === 'Escape' && (sharePicker.value || effects.value)) { event.stopPropagation(); sharePicker.value=false; effects.value=false; }
  if (event.key==='/' && phase.value==='start' && !(event.target instanceof HTMLInputElement)) { event.preventDefault(); searchField.value?.focus(); }
}
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
function clearCall(): void { clearTimeout(ringingTimer); clearTimeout(captionTimer); clearInterval(callTimer); clearInterval(lineTimer); clearTimeout(reactionTimer); speaking.value=false; reaction.value=null; effects.value=false; sharePicker.value=false; }
function say(line: string): void { clearTimeout(captionTimer); spoken.value=line; speaking.value=true; captionTimer=setTimeout(() => speaking.value=false, 2800); }
function nextLine(): void { speaker.value=lineIndex % callers.value.length; say(contact.value.lines[lineIndex % contact.value.lines.length]!); lineIndex++; }
function connect(): void {
  phase.value='call'; startedAt=performance.now(); lastTick=startedAt; lineIndex=0; nextLine();
  startCallTimers();
}
function startCallTimers(): void {
  clearInterval(callTimer); clearInterval(lineTimer);
  if(paused.value || document.hidden || phase.value!=='call') return;
  startedAt=performance.now()-elapsed.value*1000; lastTick=performance.now();
  callTimer=setInterval(() => { const now=performance.now(); elapsed.value=Math.floor((now-startedAt)/1000); if(share.value && moviePlaying.value) movieTime.value=(movieTime.value+(now-lastTick)/1000)%24; lastTick=now; },1000);
  lineTimer=setInterval(nextLine,5200);
}
function syncVisibility(): void { pageHidden.value=document.hidden; if(paused.value || document.hidden) { clearInterval(callTimer); clearInterval(lineTimer); } else startCallTimers(); }
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
  startCallTimers();
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
onMounted(() => {
  visibilityObserver=new IntersectionObserver(entries => { paused.value=!(entries[0]?.isIntersecting ?? false); syncVisibility(); });
  if(appRootElement.value) visibilityObserver.observe(appRootElement.value);
  document.addEventListener('visibilitychange',syncVisibility);
});
onBeforeUnmount(() => { clearCall(); visibilityObserver?.disconnect(); document.removeEventListener('visibilitychange',syncVisibility); });
</script>

<template>
<section ref="appRootElement" class="facetime-app" :class="{ compact, paused:paused || pageHidden, solid:vision.reduceTransparency.value }" aria-label="FaceTime demo" tabindex="-1" @keydown="appKeys">
  <div v-if="phase==='start'" class="start-view">
    <header class="start-header"><div><p class="eyebrow">A LITTLE CLOSER, FROM ANYWHERE</p><h1 class="vk-large-title">FaceTime</h1><p class="vk-secondary">Good company. Entirely imaginary.</p></div><div class="vk-segmented home-tabs" role="group" aria-label="FaceTime view"><button v-hover :aria-pressed="homeTab==='People'" @click="homeTab='People'">People</button><button v-hover :aria-pressed="homeTab==='Recents'" @click="homeTab='Recents'">Recents</button></div></header>
    <form class="name-search" @submit.prevent="callSearch"><input ref="searchField" v-model="name" class="vk-field" placeholder="Enter a name" aria-label="Enter a fictional contact name" maxlength="80"/><button v-hover class="vk-button primary" type="submit"><CallGlyph name="camera"/>Call</button></form>
    <div class="home-workspace vk-scroll"><div v-if="homeTab==='People'" class="people-column"><div class="section-label"><h2>Favorites</h2><span>6 fictional friends</span></div><div class="contact-grid"><button v-for="person in filtered" :key="person.id" v-hover class="contact-card vk-platter" @click="call(person)"><div class="avatar-orb" :style="{'--orb':person.color}"><Persona :kind="person.kind" :color="person.color" still/></div><strong class="vk-headline">{{ person.name }}</strong><span class="vk-footnote vk-secondary">{{ person.subtitle }}</span><span class="call-hint"><CallGlyph name="camera"/>FaceTime Video</span></button></div>
    <p v-if="!filtered.length" class="empty vk-secondary">No contact found. These six fictional friends are our whole address book.</p>
    </div><aside class="home-rail" :class="{ 'recents-only':homeTab==='Recents' }"><button v-if="homeTab==='People'" v-hover class="spatial-invite vk-platter" @click="call(contacts.find(c=>c.id==='committee')!)"><div class="mini-personas"><span v-for="i in 3" :key="i" :style="{'--orb':['#bd8765','#88a994','#d6ad75'][i-1]}"><Persona kind="chai" :variant="i-1" :color="['#bd8765','#88a994','#d6ad75'][i-1]!" still/></span></div><span class="feature-kicker">SPATIAL PERSONAS</span><strong>Make a little room<br/>for good company.</strong><small>The Chai Committee · 3 demo Personas</small><span class="feature-action">Start a group call <CallGlyph name="camera"/></span></button><div class="recent vk-platter"><h2 class="vk-title">Recent calls</h2><div class="recent-list vk-scroll"><button v-for="(item,i) in recent" :key="i" v-hover class="vk-row" @click="call(contacts.find(c=>c.id===item.id)!)"><span class="recent-icon"><CallGlyph name="camera"/></span><span><strong class="vk-headline">{{ item.name }}</strong><small class="vk-footnote vk-secondary">{{ item.duration }}</small></span><time class="vk-footnote vk-secondary">{{ item.time }}</time></button></div></div>
    </aside></div><p class="demo-note vk-footnote vk-tertiary">Scripted Personas and captions. No camera, microphone, or real calls.</p>
  </div>
  <div v-else-if="phase==='ringing'" class="ringing-view" :style="{'--caller':contact.color}">
    <div class="ringing-orb"><span class="ring"/><span class="ring second"/><span class="ring third"/><Persona :kind="contact.kind" :color="contact.color"/></div>
    <h1 class="vk-large-title">{{ contact.name }}</h1><p class="vk-body vk-secondary">FaceTime Video…</p><p class="vk-footnote vk-tertiary">Connecting an entirely fictional friend</p><button v-hover class="vk-button cancel" @click="clearCall(); phase='start'"><CallGlyph name="end"/>Cancel</button>
  </div>
  <div v-else-if="phase==='call'" class="call-view" :inert="sharePicker ? true : undefined">
    <header class="call-header"><div><span class="live-dot"/>{{ contact.name }}<span class="vk-chip call-kind">{{ callers.length>1 ? 'Spatial group' : 'Spatial Persona' }} · Demo</span></div><time>{{ duration }}</time></header>
    <div ref="stage" class="call-stage vk-scroll" :class="{group:callers.length>1,'sharing':share}">
      <div class="spatial-floor" aria-hidden="true"/><div class="persona-tiles"><article v-for="(person,i) in callers" :key="person.name" class="persona-tile vk-platter" :class="{ 'active-speaker':speaker===i && speaking }" :style="{'--persona':person.color,'--order':i}"><div class="portrait"><Persona :kind="person.kind" :color="person.color" :variant="person.variant" :speaking="speaker===i && speaking"/></div><div class="persona-name"><span class="speaker-dot" :class="{talking:speaker===i && speaking}"/>{{ person.name }}</div><p v-if="captions && speaker===i" class="caption" aria-live="polite">{{ spoken }}</p><p v-else class="caption-placeholder">{{ captions ? 'Listening, in excellent company.' : 'Captions are off' }}</p></article></div>
      <div v-if="share" class="shared-panel vk-platter"><header class="share-header"><CallGlyph name="share"/><span>SharePlay <small>Everyone is watching together · Demo</small></span><span class="sync-dot"/>In sync</header><div class="movie" :class="{paused:!moviePlaying}"><div class="movie-orbit one"/><div class="movie-orbit two"/><span>{{ shareMedia==='film' ? 'THE QUIET BETWEEN' : 'SLOW SUNDAY' }}</span><strong>{{ shareMedia==='film' ? 'A film about taking your time.' : 'A little music. A little company.' }}</strong><small>{{ shareMedia==='film' ? 'Illustrative gradient film' : 'Visual album preview · No audio' }} · Demo SharePlay</small></div><div class="movie-controls"><button v-hover class="vk-icon" :aria-label="moviePlaying ? 'Pause shared film' : 'Play shared film'" @click="moviePlaying=!moviePlaying"><CallGlyph :name="moviePlaying ? 'pause' : 'play'"/></button><div class="playbar"><span :style="{width:movieTime/24*100+'%'}"/></div><button v-hover class="vk-button" @click="share=false">Stop sharing</button></div></div>
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
      <button v-hover class="control" :aria-pressed="share" @click="share ? share=false : sharePicker=true"><span class="vk-icon" :class="{chosen:share}"><CallGlyph name="share"/></span><span>SharePlay</span></button>
      <button v-hover class="control" :aria-pressed="captions" @click="captions=!captions"><span class="vk-icon" :class="{chosen:captions}"><CallGlyph name="captions"/></span><span>Captions</span></button>
      <button v-hover class="control end-control" @click="end"><span class="vk-icon"><CallGlyph name="end"/></span><span>End</span></button>
    </div></div>
  </div>
  <div v-else class="ended-view"><div class="ended-card vk-platter"><div class="ended-avatar"><Persona :kind="contact.kind" :color="contact.color" still/></div><h1 class="vk-large-title">{{ phase==='busy' ? 'A little ahead of schedule' : 'Call ended' }}</h1><p class="vk-secondary">{{ phase==='busy' ? 'Future You is busy. Try again in 5 years. Or in a few seconds.' : contact.name + ' · ' + duration }}</p><p class="vk-footnote vk-tertiary">{{ phase==='busy' ? 'Time travel is a demo feature with imperfect availability.' : 'A fictional call. A perfectly good little break.' }}</p><button v-hover class="vk-button primary" @click="call(contact)"><CallGlyph name="camera"/>Call Again</button><button v-hover class="vk-button" @click="phase='start'">Back to contacts</button></div></div>
<AppSheet v-if="sharePicker" title="Share a moment" @close="sharePicker=false"><p class="share-intro vk-secondary">Choose a demo experience. Playback stays in sync with the fictional call.</p><button v-hover class="share-choice vk-platter" @click="startSharing('film')"><span class="share-art film-art"><CallGlyph name="play"/></span><span><small>WATCH TOGETHER</small><strong>The Quiet Between</strong><em>A 24-second visual film loop</em></span><CallGlyph name="play"/></button><button v-hover class="share-choice vk-platter" @click="startSharing('music')"><span class="share-art album-art"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18V5l12-2v13M9 8l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span><span><small>EXPLORE TOGETHER</small><strong>Slow Sunday</strong><em>Visual album preview · No audio</em></span><CallGlyph name="play"/></button><p class="vk-footnote vk-tertiary">No media service, camera, or microphone is connected.</p></AppSheet>
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

.facetime-app{container-type:size;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}.start-view{display:flex;flex-direction:column;min-height:0;padding:28px}.start-header h1{font-size:34px;margin:4px 0}.start-header .vk-secondary{font-size:14px}.home-tabs button{min-height:44px}.name-search{margin:18px 0}.name-search input{max-width:none}.home-workspace{display:grid;grid-template-columns:minmax(0,1fr) 274px;gap:24px;flex:1;min-height:0;align-content:start;padding:3px 3px 10px}.people-column{min-width:0}.section-label{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.section-label h2{font-size:16px;font-weight:600}.section-label span{font-size:11px;color:var(--vk-tertiary)}.contact-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.contact-card{min-height:128px;padding:12px;display:grid;grid-template-columns:58px minmax(0,1fr);grid-template-rows:auto auto auto;gap:4px 10px;text-align:left;align-content:center;align-items:center}.avatar-orb{width:58px;height:58px;grid-row:1/4}.contact-card .vk-headline{font-size:14px;line-height:1.3}.contact-card>.vk-footnote{font-size:10px;min-height:0;line-height:1.4}.call-hint{font-size:10px;margin:0}.call-hint svg{width:13px;height:13px}.home-rail{display:flex;flex-direction:column;gap:16px;min-width:0}.spatial-invite{text-align:left;padding:18px;background:radial-gradient(ellipse at 90% 0%,#91c3b044,#ffffff0d);display:flex;flex-direction:column;gap:8px;overflow:hidden;color:inherit;border-radius:28px}.mini-personas{display:flex;height:56px;padding-left:2px;margin-bottom:4px}.mini-personas>span{height:56px;width:56px;border-radius:50%;background:radial-gradient(circle at 25% 25%,var(--orb),#354747);border:2px solid #ffffff44;overflow:hidden;margin-right:-10px}.mini-personas :deep(svg){width:100%;height:100%}.feature-kicker{font-size:9px;letter-spacing:1.3px;color:#bfe3d3}.spatial-invite strong{font-size:20px;line-height:1.2;letter-spacing:-.04em}.spatial-invite small{font-size:10px;color:#ffffffa6}.feature-action{display:flex;align-items:center;gap:8px;font-size:12px;color:#d2eadf;margin-top:6px}.feature-action svg{width:17px;height:17px}.recent{padding:16px 10px;margin:0}.recent h2{font-size:16px;margin:0 8px 6px}.recent .vk-row{padding:10px 8px;gap:9px;min-height:60px;flex-wrap:wrap}.recent .vk-headline{font-size:12px}.recent .vk-footnote{font-size:10px}.recent time{margin-left:43px}.recent-icon{width:32px;height:32px;flex:none}.recent-icon svg{width:17px;height:17px}.home-workspace:has(.recents-only){grid-template-columns:1fr}.recents-only .recent time{margin-left:auto}.recents-only .recent .vk-headline{font-size:16px}.recents-only .recent .vk-footnote{font-size:12px}.demo-note{font-size:10px;margin-top:10px;flex:none}.spatial-floor{position:absolute;left:10%;right:10%;top:45%;height:40%;border-radius:50%;background:radial-gradient(ellipse,#a4c9bc14,transparent 65%);border:1px solid #ffffff09;transform:perspective(500px) rotateX(55deg);pointer-events:none}.call-kind{font-size:10px;min-height:26px}.call-stage{flex-direction:row;align-items:center;padding:12px 4px}.persona-tiles{padding:0 95px;min-height:0;align-self:stretch;position:relative}.portrait{height:clamp(100px,28cqh,235px)}.group .portrait{height:clamp(100px,27cqh,210px)}.group .persona-tile:first-child{transform:rotateY(15deg) translateY(18px)}.group .persona-tile:last-child{transform:rotateY(-15deg) translateY(18px)}.caption,.caption-placeholder,.group .caption,.group .caption-placeholder{min-height:76px;font-size:13px;padding:12px 16px;line-height:1.4}.sharing .persona-tiles{padding:0;flex:1;min-width:0;gap:10px;flex-direction:column}.sharing .persona-tile{width:100%;max-width:290px;flex:none;transform:none}.sharing .portrait{height:82px}.sharing .persona-name{margin:0 10px 4px;font-size:12px}.sharing .caption,.sharing .caption-placeholder{min-height:44px;padding:8px;font-size:11px}.sharing.group .persona-tile{display:grid;grid-template-columns:64px minmax(0,1fr);align-items:center;border-radius:18px}.sharing.group .portrait{height:70px;grid-row:1/3}.sharing.group .persona-name{justify-content:flex-start;margin:8px 8px 0}.sharing.group .caption,.sharing.group .caption-placeholder{font-size:10px;min-height:40px;background:none;text-align:left;padding:8px}.shared-panel{width:55%;align-self:center;padding:14px;min-width:0}.share-header{display:flex;align-items:center;gap:8px;font-size:10px;margin-bottom:12px;color:#c9e8d9}.share-header>span:first-of-type{flex:1;font-size:13px;color:white}.share-header small{display:block;font-size:9px;color:#ffffff8c;margin-top:3px}.share-header svg{width:17px;height:17px}.sync-dot{width:5px;height:5px;border-radius:50%;background:#91d1ac}.movie{height:210px}.movie>strong{font-size:20px;padding:0 18px}.movie>span{letter-spacing:2px}.self-view{width:76px;height:92px;bottom:8px;right:8px}.control-ornament{padding:8px 14px;gap:14px}.control{min-height:60px}.share-intro{font-size:14px;line-height:1.5;margin:0 0 20px}.share-choice{width:100%;display:flex;align-items:center;gap:14px;padding:14px;margin-bottom:14px;text-align:left;color:inherit}.share-choice>span:nth-child(2){flex:1}.share-choice strong,.share-choice small,.share-choice em{display:block}.share-choice strong{font-size:16px;margin:6px 0}.share-choice small{font-size:9px;letter-spacing:1px;color:#ffffff90}.share-choice em{font-size:11px;font-style:normal;color:#ffffffa8}.share-art{width:70px;height:70px;display:grid;place-items:center;border-radius:17px;background:linear-gradient(140deg,#daa887,#615c80,#47677a);flex:none}.album-art{background:radial-gradient(circle at 30% 20%,#c2ccb2,#486f64 50%,#203f37)}.paused :deep(*){animation-play-state:paused!important}
@container (max-height:560px) and (min-width:701px){.start-view{padding:24px}.contact-card{min-height:98px}.start-header h1{font-size:30px}.name-search{margin:14px 0}.spatial-invite{padding:14px}.spatial-invite .mini-personas{height:38px}.mini-personas>span{width:38px;height:38px}.spatial-invite strong{font-size:17px}.home-workspace{gap:18px}.call-view{padding:20px 24px 16px;gap:10px}.portrait,.group .portrait{height:145px}.sharing .portrait{height:80px}.movie{height:170px}}
@container (max-width:700px){.start-view{padding:24px 20px}.start-header{align-items:flex-start;flex-direction:column;gap:12px}.home-tabs{width:100%}.home-tabs button{flex:1}.home-workspace{grid-template-columns:1fr;gap:18px;display:block}.contact-grid{grid-template-columns:1fr}.contact-card{grid-template-columns:60px minmax(0,1fr);min-height:108px;padding:14px;column-gap:14px}.contact-card .vk-headline{font-size:15px}.avatar-orb{width:60px;height:60px}.contact-card>.vk-footnote{font-size:11px}.home-rail{margin-top:18px}.spatial-invite{display:none}.demo-note{line-height:1.4}.section-label{margin-bottom:12px}.call-stage{flex-direction:column;align-items:stretch}.persona-tiles,.group .persona-tiles,.sharing .persona-tiles{padding:0;flex-direction:column;min-height:0;width:100%;gap:12px}.persona-tile,.group .persona-tile{width:100%;flex:none;max-width:none;transform:none!important}.portrait,.group .portrait{height:158px}.shared-panel{width:100%;flex:none}.sharing.group .persona-tile{grid-template-columns:66px minmax(0,1fr);display:grid}.sharing .persona-tile{max-width:none}.sharing .portrait{height:84px}.sharing .caption{min-height:48px}.movie{height:168px}.call-view{padding:20px 16px 16px}.control-ornament{display:flex!important;gap:5px!important;padding:8px!important;justify-content:space-between}.control{min-width:0;flex:1;min-height:58px;gap:4px}.control .vk-icon{height:40px;width:40px}.control>span:last-child{font-size:8px}.effects-sheet{bottom:85px}.call-header>div{gap:7px}.call-header{font-size:13px}.self-view{width:60px;height:74px;top:8px}.share-choice{gap:10px;padding:12px}.share-art{width:56px;height:56px}.recents-only .recent time{margin-left:42px}.compact .contact-card{min-height:108px}.compact .avatar-orb{width:60px;height:60px}}


.home-workspace{align-content:stretch}.home-rail{height:100%;min-height:0}.spatial-invite{flex:none}.recent{flex:1;min-height:0;display:flex;flex-direction:column}.recent h2{flex:none}.recent-list{min-height:0;flex:1}.recent .vk-row{flex-wrap:nowrap}.recent time{margin-left:auto;font-size:9px;flex:none;max-width:58px;text-align:right}.recent .vk-row>span:nth-child(2){min-width:0;flex:1}.recents-only .recent time{max-width:none}
@container(max-height:560px) and (min-width:701px){.contact-card{min-height:112px}.spatial-invite{gap:5px}.spatial-invite .feature-action{margin-top:2px}.home-rail{gap:12px}}
@container(max-width:700px){.home-rail{height:auto}.recent{flex:none;min-height:230px}.recent-list{max-height:300px;flex:none}.recents-only .recent{min-height:0}.recents-only .recent-list{max-height:none}.recent .vk-row{min-height:68px}.recent .vk-row .vk-headline{font-size:14px}.recent .vk-row .vk-footnote{font-size:11px}.compact .recent time{margin-left:auto}}
</style>