<script setup lang="ts">
import { useWatch } from "../watch";
const watch = useWatch();
const available = ref(true);
const friend = ref('Alex');
const holding = ref(false);
const reply = ref(false);
const status = ref('Touch and hold to talk');
const friends = ['Alex', 'Taylor', 'Sam'];
let audioContext: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let toneGain: GainNode | null = null;
let responseTimer: ReturnType<typeof setTimeout> | undefined;
let visible = true;
let startedAt = 0;
function stopTone() {
  if (oscillator) {
    try {
      oscillator.stop();
    } catch {}
    oscillator.disconnect();
    oscillator = null;
  }
  toneGain?.disconnect();
  toneGain = null;
}
function beep(frequency: number) {
  if (
    !watch.settings.sound || watch.playback.volume <= 0 || watch.dimmed.value || !visible ||
    watch.activeApp.value !== 'walkieTalkie' || typeof window === 'undefined' || !window.AudioContext
  ) return;
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContext();
    const context = audioContext;
    void context.resume().catch(() => {});
    stopTone();
    const tone = context.createOscillator();
    const gain = context.createGain();
    oscillator = tone;
    toneGain = gain;
    tone.type = 'sine';
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(.018 * watch.playback.volume, context.currentTime + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .13);
    tone.connect(gain);
    gain.connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + .15);
    tone.onended = () => {
      tone.disconnect();
      gain.disconnect();
      if (oscillator === tone) {
        oscillator = null;
        toneGain = null;
      }
    };
  } catch {
    oscillator = null;
    toneGain = null;
  }
}
function cancelReply() {
  if (responseTimer) clearTimeout(responseTimer);
  responseTimer = undefined;
  reply.value = false;
}
function start() {
  if (!available.value || holding.value || watch.dimmed.value || watch.activeApp.value !== 'walkieTalkie') return;
  cancelReply();
  holding.value = true;
  startedAt = Date.now();
  status.value = 'Demo transmitting…';
  watch.haptic();
  beep(600);
}
function finish() {
  if (!holding.value) return;
  holding.value = false;
  const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  status.value = seconds + 's sent · waiting for ' + friend.value + '…';
  beep(800);
  responseTimer = setTimeout(() => {
    if (!visible || !available.value || watch.dimmed.value || watch.activeApp.value !== 'walkieTalkie') return;
    reply.value = true;
    status.value = friend.value + ': “Loud and clear!”';
    beep(480);
    responseTimer = setTimeout(() => {
      reply.value = false;
      responseTimer = undefined;
    }, 1400);
  }, 700);
}
function cancelHold() {
  holding.value = false;
  status.value = 'Touch and hold to talk';
}
function availability() {
  available.value = !available.value;
  cancelHold();
  cancelReply();
  status.value = available.value ? 'Touch and hold to talk' : 'Unavailable';
}
function changeFriend() {
  cancelHold();
  cancelReply();
  status.value = 'Touch and hold to talk';
}
function closeAudio() {
  stopTone();
  const context = audioContext;
  audioContext = null;
  if (context && context.state !== 'closed') void context.close().catch(() => {});
}
function cleanup() {
  visible = false;
  cancelHold();
  cancelReply();
  closeAudio();
}
onActivated(() => {
  visible = true;
});
onDeactivated(cleanup);
onBeforeUnmount(cleanup);
watchEffect(() => {
  if (!watch.settings.sound) closeAudio();
  if (watch.dimmed.value || watch.activeApp.value !== 'walkieTalkie') {
    cancelHold();
    cancelReply();
    closeAudio();
  }
});
</script>

<template>
  <section class="watch-app walkie-app">
    <h1>Walkie-Talkie</h1>
    <label class="friend-select caption">
      Friend
      <select v-model="friend" @change="changeFriend">
        <option v-for="name in friends" :key="name">
          {{name}}
        </option>
      </select>
    </label>
    <div class="talk-area" :class="{transmitting:holding,receiving:reply}">
      <div class="signal" :class="{animate:(holding||reply)&&!watch.reducedMotion.value&&!watch.dimmed.value}" />
      <button
        class="talk"
        :disabled="!available"
        :aria-label="'Hold to send a demo message to '+friend"
        @pointerdown.prevent="start"
        @pointerup.prevent="finish"
        @pointerleave="holding&&finish()"
        @pointercancel="cancelHold"
        @keydown.space.prevent="start"
        @keyup.space.prevent="finish"
        @keydown.enter.prevent="start"
        @keyup.enter.prevent="finish"
        @blur="cancelHold"
      >
        <strong>
          {{holding?'TALKING':reply?'LISTENING':'TALK'}}
        </strong>
        <span>
          {{friend}}
        </span>
      </button>
    </div>
    <p class="status" role="status">
      {{status}}
    </p>
    
        <button
      class="availability"
      role="switch"
      :aria-checked="available"
      @click="availability"
    >
      <span>
        {{available?'Available':'Unavailable'}}
      </span>
      <i :class="{on:available}">
        <b />
      </i>
    </button>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.walkie-app h1 {
  color: #ffd60a;
  font-size: max(18px, calc(29px * var(--text-size, 1)));
}

.availability {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 82px;
  width: 100%;
  border: 0;
  background: #202020;
  color: white;
  border-radius: 26px;
  padding: 12px 18px;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
}

.availability i {
  width: 76px;
  height: 44px;
  border-radius: 30px;
  background: #444;
  position: relative;
}

.availability b {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 36px;
  height: 36px;
  background: white;
  border-radius: 50%;
}

.availability .on {
  background: #30d158;
}

.availability .on b {
  left: 36px;
}

.friend-select {
  display: block;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 18px;
}

.friend-select select {
  width: 100%;
  min-height: 76px;
  margin-top: 6px;
  background: #202020;
  color: #ffd60a;
  border: 0;
  border-radius: 24px;
  padding: 0 18px;
  font-size: max(18px, calc(27px * var(--text-size, 1)));
}

.talk-area {
  position: relative;
  width: 240px;
  height: 240px;
  display: grid;
  place-items: center;
  margin: 30px auto;
}

.signal {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 2px solid #ffd60a55;
}

.signal.animate {
  animation: radio 1s ease-out infinite;
}

.talk {
  width: 220px;
  height: 220px;
  border-radius: 50%;
  border: 0;
  background: #ffd60a;
  color: #000;
  touch-action: none;
  user-select: none;
  position: relative;
}

.talk strong {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  display: block;
}

.talk span {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  display: block;
  margin-top: 10px;
  opacity: .65;
}

.transmitting .talk {
  background: white;
}

.receiving .talk {
  background: #d8ab00;
}

.status {
  color: #ffd60a;
  text-align: center;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  min-height: 65px;
  margin: 0 0 20px;
  line-height: 1.25;
}

.disclaimer {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  line-height: 1.3;
}

@keyframes radio {
  to {
    transform: scale(1.17);
    opacity: 0;
  }
}

.friend-select {
  margin-top: 12px;
}

.talk-area {
  width: 172px;
  height: 172px;
  margin: 14px auto;
}

.talk {
  width: 154px;
  height: 154px;
}

.status {
  min-height: 52px;
  margin-bottom: 12px;
}

.availability b {
  transition: transform 240ms ease;
}

.availability .on b {
  left: 4px;
  transform: translateX(32px);
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FFD60A; }

.friend-select { display:flex; align-items:center; gap:10px; margin:8px 0; font-size:20px; }
.friend-select select { flex:1; min-width:0; width:auto; min-height:64px; margin:0; border-radius:32px; font-size:24px; }
.talk-area { width:204px; height:204px; margin:14px auto 18px; }
.talk { width:188px; height:188px; }
.talk strong { font-size:25px; }
.talk span { font-size:20px; margin-top:8px; }
.status { min-height:50px; font-size:22px; }
.availability { min-height:76px; border-radius:30px; }
.availability b { transition:transform 160ms ease; }

.talk { min-height:188px !important; }
</style>
