<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';

type Entry = { id: string; name: string };
type Command =
  | { type: 'open'; app: string }
  | { type: 'environment'; id: string }
  | { type: 'immersion'; value: number }
  | { type: 'immersionBy'; delta: number }
  | { type: 'home' }
  | { type: 'closeAll' }
  | { type: 'widgets' }
  | { type: 'capture' }
  | { type: 'dark'; on: boolean };
type State = 'idle' | 'listening' | 'thinking' | 'replying';
type Answer = { text: string; command?: Command };
// Browser speech recognition is not part of the standard DOM TypeScript library.
interface RecognitionResult { readonly isFinal: boolean; readonly length: number; readonly [index: number]: { readonly transcript: string } }
interface RecognitionEvent extends Event { readonly resultIndex: number; readonly results: { readonly length: number; readonly [index: number]: RecognitionResult } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start(): void; abort(): void;
}
type RecognitionConstructor = new () => Recognition;
const props = defineProps<{ apps: readonly Entry[]; environments: readonly Entry[]; compact: boolean; sound: boolean }>();
const emit = defineEmits<{ command: [cmd: Command] }>();
const state = ref<State>('idle');
const question = ref('');
const reply = ref('');
const lastQuestion = ref('');
const micAvailable = ref(false);
const micListening = ref(false);
const surface = ref<HTMLElement>();
const dock = ref<HTMLElement>();
const card = ref<HTMLElement>();
const input = ref<HTMLInputElement>();
const bounds = ref({ w: 1280, h: 720 });
const position = ref<{ x: number; y: number } | null>(null);
const cardHeight = ref(335);
const suggestionPage = ref(0);
const active = computed(() => state.value !== 'idle');
const orbSize = computed(() => props.compact ? 44 : 48);
const suggestionSets = [
  ['Take me to the Moon', 'Open Night Sky', 'Make it darker', 'What can you do?'],
  ['Add a widget', 'Tell me a joke', 'Immersion 50%', 'What time is it?'],
  ['Visit Jupiter', 'Back to my room', 'Take a picture', 'Who made this?'],
] as const;
const suggestions = computed(() => suggestionSets[suggestionPage.value % suggestionSets.length] ?? suggestionSets[0]);
const jokes = [
  'My spaceship runs on JavaScript. The launch is still pending.',
  'The Moon tried pair programming. It needed more space.',
  'I asked a black hole for feedback. It absorbed the whole meeting.',
  'My code has zero gravity. Every bug floats to the top.',
  'The astronaut closed one browser tab. Mission control applauded.',
  'Saturn has excellent uptime. It never drops a ring.',
  'I put my bugs in orbit. Now they are satellite issues.',
  'The compiler visited Mars. It found no signs of semicolons.',
  'My rubber duck joined NASA. Debugging is now a space walk.',
  'The server went stargazing. It returned a constellation of logs.',
] as const;
const fallbacks = [
  'That one is outside my orbit. Try “Open Photos.”',
  'My crystal ball is a glass window. Try “Take me to the Moon.”',
  'A tiny syntax error in the universe. Try “Add a widget.”',
  'I have room for improvement. Try “Back to my room.”',
  'That command drifted into deep space. Try “Open Night Sky.”',
  'My demo brain needs a clearer heading. Try “Immersion 50%.”',
  'I consulted the rubber duck. It suggests “Tell me a joke.”',
  'That request needs a bigger telescope. Try “What can you do?”',
] as const;
let idleTimer=0, thinkTimer=0, suggestionTimer=0;
let observer: ResizeObserver | undefined;
let recognition: Recognition | null=null;
let recognitionConstructor: RecognitionConstructor | undefined;
let mounted=false, disposed=false, swallowClick=false;
let returnFocus: HTMLElement | null=null;
let speechOwned=false;
let drag: { id:number; startX:number; startY:number; originX:number; originY:number; handle:HTMLElement | null; x:number; y:number; moved:boolean } | null=null;
const STORAGE='lab-vision-siri-pos';
function normalize(text: string) { return text.toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9%]+/g,' ').trim().replace(/\s+/g,' '); }
function randomLine(lines: readonly string[]) { return lines[Math.floor(Math.random()*lines.length)] ?? lines[0] ?? ''; }
function match(query: string, entries: readonly Entry[], kind: 'app' | 'environment'): { entry: Entry; score: number } | undefined {
  const clean=query.replace(/^(?:the|my) /,'');
  if (!clean) return undefined;
  let best: { entry: Entry; score:number } | undefined;
  for (const entry of entries) {
    const name=normalize(entry.name).replace(/^(?:the|my) /,'');
    const id=normalize(entry.id);
    let score=clean===name ? 100 : clean===id ? 98 : 0;
    const aliases: string[]=[];
    if (kind==='app' && (name==='night sky' || id==='nightsky')) aliases.push('sky');
    if (kind==='environment' && (name==='milky way' || id==='night')) aliases.push('starry night','stars','starry');
    if (aliases.includes(clean)) score=Math.max(score,96);
    const words=clean.split(' ').filter(word => !['a','an','the','my','please','environment','app'].includes(word));
    const targets=name.split(' ');
    if (words.length && words.every(word => targets.includes(word))) score=Math.max(score,75+Math.min(words.length,9));
    else if (words.length && words.every(word => word.length>=3 && targets.some(target => target.startsWith(word)))) score=Math.max(score,60+Math.min(words.length,9));
    if (score>0 && (!best || score>best.score)) best={entry,score};
  }
  return best;
}
function parse(text: string): Answer {
  const n=normalize(text).replace(/^(?:hey siri|siri) /,'').replace(/ please$/,'');
  if (/^(who made this|whose lab is this|who built this)/.test(n)) return {text:"This is Mohith's lab. Everything here is a demo built for fun."};
  if (/what can you do|help|your abilities/.test(n)) return {text:'I can open apps, visit environments, change immersion and lighting, go Home, close apps, add widgets, and take a picture. I also tell the time, demo weather, and questionable space jokes.'};
  if (/what(?:s| is) the time|what time is it|tell me the time/.test(n)) return {text:'It is '+new Intl.DateTimeFormat('en', {hour:'numeric',minute:'2-digit'}).format(new Date())+'.'};
  if (/what(?:s| is) the weather|weather forecast/.test(n)) return {text:'Demo forecast for Bengaluru: 27 degrees and partly cloudy, with a high chance of opening another tab.'};
  if (/joke|make me laugh/.test(n)) return {text:randomLine(jokes)};
  if (/who are you|what are you/.test(n)) return {text:'I am the little glow in the corner. A local demo assistant with big space energy and a very small command list.'};
  if (/close (?:everything|all)(?: apps)?/.test(n)) return {text:'Closing all apps. Room to breathe.',command:{type:'closeAll'}};
  if (/^(?:go )?home$|home view/.test(n)) return {text:'Taking you Home.',command:{type:'home'}};
  if (/add (?:a )?widget|^(?:open |show )?widgets$|widget gallery/.test(n)) return {text:'Opening the widget gallery.',command:{type:'widgets'}};
  if (/take (?:a )?(?:picture|photo)|screenshot|^capture$/.test(n)) return {text:'Taking a picture.',command:{type:'capture'}};
  if (/back to (?:my |the )?room|passthrough/.test(n)) return {text:'Back to your room.',command:{type:'immersion',value:0}};
  if (/full immersion|fully immersive/.test(n)) return {text:'Full immersion. Welcome to elsewhere.',command:{type:'immersion',value:1}};
  const percent=n.match(/immersion(?: to| at)?\s+(\d+(?:\.\d+)?)\s*%?/);
  if (percent?.[1]) {const value=Math.max(0,Math.min(1,Number(percent[1])/100));return {text:'Immersion set to '+Math.round(value*100)+' percent.',command:{type:'immersion',value}};}
  if (/more immersive|more immersion|increase immersion/.test(n)) return {text:'A little further into the environment.',command:{type:'immersionBy',delta:.2}};
  if (/less immersive|less immersion|decrease immersion/.test(n)) return {text:'A little more of your room.',command:{type:'immersionBy',delta:-.2}};
  if (/^(?:make (?:it |the room )?|turn |switch |set )?(?:dark|darker|dark mode)(?: on)?$|turn (?:off|down) the lights/.test(n)) return {text:'Making it darker.',command:{type:'dark',on:true}};
  if (/^(?:make (?:it |the room )?|turn |switch |set )?(?:light|lighter|brighter|light mode)(?: on)?$|turn (?:on|up) the lights|dark mode off/.test(n)) return {text:'Letting in a little light.',command:{type:'dark',on:false}};
  const exactApp=match(n,props.apps,'app'), exactEnvironment=match(n,props.environments,'environment');
  if (exactApp?.score===100) return {text:'Opening '+exactApp.entry.name+'.',command:{type:'open',app:exactApp.entry.id}};
  if (exactEnvironment?.score===100) return {text:"Here's "+exactEnvironment.entry.name.replace(/^The /,'the ')+'.',command:{type:'environment',id:exactEnvironment.entry.id}};
  const appVerb=/^(?:open|launch|show|start)\s+/;
  const envVerb=/^(?:go to|take me to|switch to|visit)\s+/;
  const isApp=appVerb.test(n), isEnv=envVerb.test(n);
  const query=n.replace(appVerb,'').replace(envVerb,'').replace(/^(?:an? )?(?:app|environment) /,'');
  const app=match(query,props.apps,'app'), environment=match(query,props.environments,'environment');
  if (isEnv && environment) return {text:"Here's "+environment.entry.name.replace(/^The /,'the ')+'.',command:{type:'environment',id:environment.entry.id}};
  if (isApp && app) return {text:'Opening '+app.entry.name+'.',command:{type:'open',app:app.entry.id}};
  // Bare names prefer exact matches across both lists. Explicit verbs constrain the target.
  if (!isApp && !isEnv) {
    if (app && (!environment || app.score>=environment.score)) return {text:'Opening '+app.entry.name+'.',command:{type:'open',app:app.entry.id}};
    if (environment) return {text:"Here's "+environment.entry.name.replace(/^The /,'the ')+'.',command:{type:'environment',id:environment.entry.id}};
  }
  return {text:randomLine(fallbacks)};
}
function pixelPosition() {
  const maxX=Math.max(0,bounds.value.w-orbSize.value-12), maxY=Math.max(0,bounds.value.h-orbSize.value-12);
  return position.value ? {x:Math.max(12,position.value.x*maxX),y:Math.max(12,position.value.y*maxY)}
    : {x:Math.max(12,bounds.value.w-orbSize.value-(props.compact?16:28)),y:Math.max(12,bounds.value.h-orbSize.value-(props.compact?112:120))};
}
const dockStyle=computed<CSSProperties>(() => position.value ? {left:pixelPosition().x+'px',top:pixelPosition().y+'px',right:'auto',bottom:'auto'} : {});
const cardStyle=computed<CSSProperties>(() => {
  const p=pixelPosition(), w=Math.max(0,Math.min(370,bounds.value.w-24));
  const height=Math.min(cardHeight.value,Math.max(0,bounds.value.h-24));
  const desired=p.y-height-24;
  return {width:(props.compact?Math.max(0,bounds.value.w-24):w)+'px',left:(props.compact?12:Math.max(12,Math.min(p.x+orbSize.value-w,bounds.value.w-w-12)))+'px',top:Math.max(12,Math.min(desired<12?p.y+orbSize.value+20:desired,bounds.value.h-height-12))+'px',maxHeight:Math.max(0,bounds.value.h-24)+'px'};
});
function stopSpeech() { if (speechOwned && 'speechSynthesis' in window) window.speechSynthesis.cancel(); speechOwned=false; }
function speak(text: string) {
  stopSpeech();
  if (!props.sound || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  const utterance=new SpeechSynthesisUtterance(text); utterance.lang='en-US'; utterance.rate=1.05;
  const voice=window.speechSynthesis.getVoices().find(item => /^en(?:-|_)/i.test(item.lang)); if (voice) utterance.voice=voice;
  speechOwned=true; window.speechSynthesis.speak(utterance);
}
function stopMic() {
  if (recognition) { recognition.onresult=null; recognition.onerror=null; recognition.onend=null; recognition.abort(); recognition=null; }
  micListening.value=false;
}
function resetIdle() { window.clearTimeout(idleTimer); idleTimer=window.setTimeout(deactivate,6000); }
function deactivate() {
  window.clearTimeout(idleTimer); window.clearTimeout(thinkTimer); window.clearInterval(suggestionTimer); idleTimer=thinkTimer=suggestionTimer=0;
  stopMic(); stopSpeech(); state.value='idle';
  if (card.value?.contains(document.activeElement)) { if (returnFocus?.isConnected) returnFocus.focus(); else dock.value?.querySelector<HTMLButtonElement>('button')?.focus(); }
}
async function activate() {
  if (disposed || !mounted) return;
  if (!active.value) returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  window.clearTimeout(thinkTimer); thinkTimer=0; stopMic(); stopSpeech(); state.value='listening'; reply.value=''; question.value=''; lastQuestion.value='';
  window.clearInterval(suggestionTimer); suggestionTimer=window.setInterval(() => { suggestionPage.value=(suggestionPage.value+1)%suggestionSets.length; },8000);
  resetIdle(); await nextTick(); if (!disposed && active.value) input.value?.focus();
}
defineExpose({ activate });
function inputChanged() { if (state.value==='thinking') {window.clearTimeout(thinkTimer);thinkTimer=0;} state.value='listening';stopSpeech();resetIdle(); }
function submit(text=question.value) {
  const clean=text.trim().slice(0,240); if (!clean || state.value==='thinking') return;
  stopMic(); stopSpeech(); window.clearTimeout(idleTimer); window.clearTimeout(thinkTimer);
  question.value='';lastQuestion.value=clean;reply.value='';state.value='thinking';
  thinkTimer=window.setTimeout(() => {
    thinkTimer=0;if(disposed)return;
    const answer=parse(clean); if(answer.command)emit('command',answer.command);
    reply.value=answer.text;state.value='replying';speak(answer.text);resetIdle();
  },500+Math.floor(Math.random()*401));
}
function microphone() {
  if (micListening.value) { stopMic();resetIdle();return; }
  if (!recognitionConstructor || state.value==='thinking') return;
  stopMic(); stopSpeech(); window.clearTimeout(idleTimer); state.value='listening';
  const instance=new recognitionConstructor(); recognition=instance; instance.lang='en-US';instance.continuous=false;instance.interimResults=false;
  instance.onresult=event => {
    const result=event.results[event.resultIndex];const transcript=result?.[0]?.transcript;
    if(result?.isFinal && transcript) {question.value=transcript;submit(transcript);}
  };
  instance.onerror=() => {stopMic();reply.value='The microphone could not hear that. You can type your request.';resetIdle();};
  instance.onend=() => {micListening.value=false;recognition=null;if(state.value==='listening')resetIdle();};
  try {micListening.value=true;instance.start();resetIdle();} catch {stopMic();reply.value='The microphone is unavailable. Try typing instead.';resetIdle();}
}
function pointerDown(event: PointerEvent) {
  if(event.button!==0)return;
  swallowClick=false;const p=pixelPosition();drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,originX:p.x,originY:p.y,handle:event.currentTarget instanceof HTMLElement?event.currentTarget:null,x:p.x,y:p.y,moved:false};
  if(event.currentTarget instanceof HTMLElement)event.currentTarget.setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  if(!drag || drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
  if(!drag.moved && Math.hypot(dx,dy)<5)return;
  drag.moved=true;swallowClick=true;event.preventDefault();
  drag.x=Math.max(12,Math.min(drag.originX+dx,bounds.value.w-orbSize.value-12));drag.y=Math.max(12,Math.min(drag.originY+dy,bounds.value.h-orbSize.value-12));
  if(dock.value){dock.value.style.left=drag.x+'px';dock.value.style.top=drag.y+'px';dock.value.style.right='auto';dock.value.style.bottom='auto';}
}
function pointerUp(event?: PointerEvent, cancel=false) {
  if(!drag || (event && event.pointerId!==drag.id))return;
  const current=drag;drag=null;
  if(current.handle?.hasPointerCapture(current.id))current.handle.releasePointerCapture(current.id);
  if(current.moved && !cancel){position.value={x:current.x/Math.max(1,bounds.value.w-orbSize.value-12),y:current.y/Math.max(1,bounds.value.h-orbSize.value-12)};try{localStorage.setItem(STORAGE,JSON.stringify(position.value));}catch{/* Optional storage. */}}
  const p=pixelPosition();if(dock.value){dock.value.style.left=position.value?p.x+'px':'';dock.value.style.top=position.value?p.y+'px':'';dock.value.style.right='';dock.value.style.bottom='';}
  if(active.value)resetIdle();
}
function cancelDrag(){pointerUp(undefined,true);}
function orbClick(event: MouseEvent){if(swallowClick && event.detail!==0){swallowClick=false;return;}if(active.value)deactivate();else void activate();}
function keys(event: KeyboardEvent){if(event.key==='Escape' && active.value){event.preventDefault();event.stopImmediatePropagation();deactivate();}}
watch(() => props.sound, sound => {if(!sound && mounted)stopSpeech();});
watch(() => props.compact, () => cancelDrag());
onMounted(() => {
  mounted=true;
  try {const p:unknown=JSON.parse(localStorage.getItem(STORAGE)??'null');if(typeof p==='object' && p!==null && 'x' in p && 'y' in p && typeof p.x==='number' && typeof p.y==='number' && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x>=0 && p.x<=1 && p.y>=0 && p.y<=1)position.value={x:p.x,y:p.y};}catch{/* Ignore malformed positions. */}
  const speechWindow=window as Window & {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
  recognitionConstructor=speechWindow.SpeechRecognition??speechWindow.webkitSpeechRecognition;micAvailable.value=Boolean(recognitionConstructor);
  if(surface.value){observer=new ResizeObserver(entries=>{for(const entry of entries){if(entry.target===surface.value && entry.contentRect.width>0 && entry.contentRect.height>0){cancelDrag();bounds.value={w:entry.contentRect.width,h:entry.contentRect.height};}else if(entry.target===card.value)cardHeight.value=entry.borderBoxSize[0]?.blockSize??entry.contentRect.height;}});observer.observe(surface.value);}
  window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',cancelDrag);window.addEventListener('blur',cancelDrag);window.addEventListener('keydown',keys,true);
});
watch(card,(value,old)=>{if(old)observer?.unobserve(old);if(value)observer?.observe(value);});
onBeforeUnmount(() => {
  disposed=true;mounted=false;window.clearTimeout(idleTimer);window.clearTimeout(thinkTimer);window.clearInterval(suggestionTimer);observer?.disconnect();stopMic();stopSpeech();cancelDrag();window.clearTimeout(idleTimer);
  window.removeEventListener('pointermove',pointerMove);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('pointercancel',cancelDrag);window.removeEventListener('blur',cancelDrag);window.removeEventListener('keydown',keys,true);
});
</script>

<template>
  <div ref="surface" class="siri-layer" :class="[state,{compact}]">
    <Transition name="conversation">
      <section v-if="active" ref="card" class="conversation-card" :style="cardStyle" role="dialog" aria-label="Siri conversation" @pointerdown.stop @click.stop @wheel.stop>
        <header><div><b>Siri</b><small>Local demo assistant</small></div><button class="dismiss" aria-label="Dismiss Siri" @click="deactivate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
        <p v-if="lastQuestion" class="question">{{ lastQuestion }}</p>
        <p class="answer" role="status" aria-live="polite" aria-atomic="true">{{ state === 'thinking' ? 'Just a moment…' : reply || (micListening ? 'Listening. Go ahead.' : 'A little help, right here.') }}</p>
        <form @submit.prevent="submit()">
          <input ref="input" v-model="question" type="text" maxlength="240" placeholder="Ask Siri…" aria-label="Ask Siri" autocomplete="off" @input="inputChanged" @focus="resetIdle" @keydown.stop />
          <button v-if="micAvailable" type="button" class="mic" :class="{ on: micListening }" :aria-label="micListening ? 'Stop listening' : 'Use microphone'" :aria-pressed="micListening" :disabled="state === 'thinking'" @click="microphone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8" /></svg></button>
          <button type="submit" class="send" aria-label="Send request" :disabled="!question.trim() || state === 'thinking'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>
        </form>
        <div class="suggestions" aria-label="Suggested requests"><button v-for="suggestion in suggestions" :key="suggestion" :disabled="state === 'thinking'" @click="submit(suggestion)">{{ suggestion }}</button></div>
        <footer><span>Type a request or try a suggestion.</span><button aria-label="More suggestions" @click="suggestionPage++; resetIdle()">More <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg></button></footer>
      </section>
    </Transition>
    <div ref="dock" class="orb-dock" :style="dockStyle" @pointerdown.stop>
      <button class="orb-button" :class="{ active }" :aria-label="active ? 'Dismiss Siri' : 'Activate Siri; drag to reposition'" :aria-expanded="active" @pointerdown="pointerDown" @click.stop="orbClick"><span class="orb" aria-hidden="true"><span class="swirl" /><span class="orb-light" /></span></button>
    </div>
  </div>
</template>

<style scoped>
.siri-layer{position:absolute;inset:0;pointer-events:none;z-index:7600;color:#fff;font:400 15px/1.35 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:-.015em}
.siri-layer :deep(*){box-sizing:border-box}.siri-layer button,.siri-layer input{font:inherit;letter-spacing:inherit}.siri-layer button{border:0;background:none;color:inherit;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}.siri-layer button:focus-visible,.siri-layer input:focus-visible{outline:2px solid #fff;outline-offset:3px}.siri-layer svg{width:19px;height:19px;flex:none}.orb-dock{position:absolute;right:28px;bottom:120px;width:48px;height:48px;pointer-events:auto;z-index:2}.orb-button{width:100%;height:100%;border-radius:50%;touch-action:none;display:grid;place-items:center}.orb{display:block;position:relative;width:48px;height:48px;border-radius:50%;background:#143069;box-shadow:inset 0 1px 2px #ffffffb3,0 0 18px #69a9ff55,0 8px 22px #0005;overflow:hidden;isolation:isolate;animation:breathe 6s ease-in-out infinite;transition:transform .4s cubic-bezier(.2,.9,.3,1),box-shadow .4s}.swirl{position:absolute;inset:-25%;border-radius:50%;background:conic-gradient(from 0deg,#62e1ff,#276eff 22%,#b661f1 38%,#f461b3 55%,#ffad60 72%,#7894ff 85%,#62e1ff);filter:blur(8px);animation:swirl 14s linear infinite}.orb-light{position:absolute;inset:0;border-radius:50%;background:radial-gradient(ellipse at 32% 24%,#fff9,transparent 30%),radial-gradient(ellipse at 60% 80%,#ffffff55,transparent 55%);box-shadow:inset 0 0 9px #fff7}.active .orb{transform:scale(1.3);box-shadow:0 0 26px #8db5ff88,0 0 50px #ff93cb44}.listening .orb{animation:pulse 1.8s ease-in-out infinite}.thinking .swirl{animation-duration:1.2s}.thinking .orb{animation:think 1.1s ease-in-out infinite}.replying .orb{animation:reply-glow 3s ease-in-out infinite}
.conversation-card{position:absolute;pointer-events:auto;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;padding:21px;border-radius:30px;scrollbar-width:thin;background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .05)),rgb(40 43 50 / .87);backdrop-filter:blur(44px) saturate(130%);-webkit-backdrop-filter:blur(44px) saturate(130%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 30px 80px rgb(0 0 0 / .4)}.conversation-card header{display:flex;justify-content:space-between;align-items:center}.conversation-card header>div{display:flex;flex-direction:column;gap:3px}.conversation-card header b{font-size:22px;letter-spacing:-.03em;font-weight:600}.conversation-card header small{font-size:10px;opacity:.55}.conversation-card .dismiss{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#ffffff12}.question{margin:16px 0 0;font-size:12px;color:#ffffff90;overflow-wrap:anywhere}.answer{margin:13px 0 18px;font-size:16px;line-height:1.5;min-height:48px;overflow-wrap:anywhere}.conversation-card form{display:flex;align-items:center;gap:5px;border-radius:22px;padding:5px;background:#0003;border:1px solid #ffffff12}.conversation-card input{min-width:0;width:100%;height:36px;padding:0 8px;color:#fff;background:none;border:0;user-select:text;-webkit-user-select:text}.conversation-card input::placeholder{color:#ffffff8c}.conversation-card form button{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center}.conversation-card form button:hover{background:#ffffff18}.conversation-card form .send{background:#ffffffd9;color:#242735}.conversation-card form .mic.on{color:#ffc3d7;background:#e861a233}.conversation-card button:disabled{opacity:.35;cursor:default}.suggestions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.suggestions button{min-height:36px;text-align:left;font-size:11px;padding:8px 11px;border-radius:16px;background:#ffffff0d;transition:background .2s}.suggestions button:hover{background:#ffffff21}.conversation-card footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;font-size:9px;color:#ffffff80}.conversation-card footer button{display:flex;align-items:center;gap:2px;color:#ffffffb3;min-height:28px}.conversation-card footer svg{width:12px;height:12px}.compact .orb-dock{right:16px;bottom:112px;width:44px;height:44px}.compact .orb{width:44px;height:44px}.compact .conversation-card{padding:18px;border-radius:28px}.conversation-enter-active,.conversation-leave-active{transition:opacity .25s,translate .35s cubic-bezier(.2,.9,.2,1)}.conversation-enter-from,.conversation-leave-to{opacity:0;translate:0 14px}
@keyframes swirl{to{transform:rotate(360deg)}}@keyframes breathe{50%{transform:scale(1.045);filter:brightness(1.08)}}@keyframes pulse{50%{transform:scale(1.38);filter:brightness(1.18)}}@keyframes think{50%{transform:scale(1.25);filter:brightness(1.15)}}@keyframes reply-glow{50%{filter:brightness(1.18);box-shadow:0 0 30px #8db5ffaa,0 0 54px #ff93cb66}}
@media(prefers-reduced-motion:reduce){.siri-layer *{animation:none!important;transition:none!important}.active .orb{transform:scale(1.15)}}
</style>
