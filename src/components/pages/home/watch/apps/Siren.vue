<script setup lang="ts">
import { useWatch, useWatchHardware } from '../watch';
const ctx = useWatch();
const phase = ref<'idle' | 'holding' | 'countdown' | 'running'>('idle');
const holdProgress = ref(0);
const countdown = ref(3);
const audioNote = ref('Quiet browser demonstration');
let holdTimer: ReturnType<typeof setInterval> | undefined;
let holdStarted = 0;
let countdownEnds = 0;
let lastPattern = 0;
let lastSirenStart = 0;
let audioContext: AudioContext | null = null;
const oscillators = new Set<OscillatorNode>();
const soundStatus = computed(() => !ctx.settings.sound ? 'Sound is off in Settings' : audioNote.value);
function closeAudio() {
  oscillators.forEach(oscillator => {
    try {
      oscillator.stop();
    } catch {/* already stopped */}
  });
  oscillators.clear();
  const current = audioContext;
  audioContext = null;
  if (current) void current.close().catch(() => {
    audioNote.value = 'Audio could not be closed normally.';
  });
}
function cancelHold() {
  if (holdTimer) clearInterval(holdTimer);
  holdTimer = undefined;
  holdProgress.value = 0;
  if (phase.value === 'holding') {
    phase.value = 'idle';
    closeAudio();
  }
}
function stop() {
  cancelHold();
  phase.value = 'idle';
  countdown.value = 3;
  closeAudio();
}
async function prepareAudio() {
  if (!ctx.settings.sound || audioContext) return;
  try {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
      audioNote.value = 'Audio unavailable. Visual demonstration only.';
      return;
    }
    audioContext = new AudioContext();
    await audioContext.resume();
    audioNote.value = 'Quiet two-tone demonstration';
  } catch {
    audioNote.value = 'Browser blocked audio. Visual demonstration only.';
    closeAudio();
  }
}
function startCountdown() {
  if (holdTimer) clearInterval(holdTimer);
  holdTimer = undefined;
  holdProgress.value = 0;
  phase.value = 'countdown';
  countdownEnds = Date.now() + 3000;
  countdown.value = 3;
  lastPattern = 0;
  ctx.haptic('warning');
}
function consumeSirenStart() {
  const request = ctx.sirenStart.value;
  if (request === 0) {
    lastSirenStart = 0;
    return;
  }
  if (request === lastSirenStart || ctx.activeApp.value !== 'siren' || ctx.dimmed.value) return;
  lastSirenStart = request;
  stop();
  void prepareAudio();
  startCountdown();
}
watch(ctx.sirenStart, consumeSirenStart, {
  immediate: true
});
onActivated(consumeSirenStart);
function beginHold() {
  if (phase.value !== 'idle' || ctx.activeApp.value !== 'siren' || ctx.dimmed.value) return;
  phase.value = 'holding';
  holdStarted = Date.now();
  holdProgress.value = 0;
  void prepareAudio();
  holdTimer = setInterval(() => {
    holdProgress.value = Math.min(1, (Date.now() - holdStarted) / 2000);
    if (holdProgress.value >= 1) startCountdown();
  }, 40);
}
function pointerHold(event: PointerEvent) {
  if (event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  beginHold();
}
function keyHold(event: KeyboardEvent) {
  if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
    event.preventDefault();
    beginHold();
  }
}
function keyRelease(event: KeyboardEvent) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    cancelHold();
  }
}
function pattern() {
  const audio = audioContext;
  if (!ctx.settings.sound || ctx.playback.volume <= 0 || !audio || audio.state !== 'running') return;
  const start = audio.currentTime;
  for (const [offset, frequency] of [[0, 660], [0.28, 880]] as const) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start + offset);
    gain.gain.linearRampToValueAtTime(0.025 * ctx.playback.volume, start + offset + 0.025);
    gain.gain.linearRampToValueAtTime(0, start + offset + 0.2);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillators.add(oscillator);
    oscillator.onended = () => {
      oscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.22);
  }
}
watch(ctx.now, () => {
  if (ctx.activeApp.value !== 'siren' || ctx.dimmed.value) {
    stop();
    return;
  }
  if (phase.value === 'countdown') {
    countdown.value = Math.max(0, Math.ceil((countdownEnds - Date.now()) / 1000));
    if (!countdown.value) {
      phase.value = 'running';
      lastPattern = 0;
    }
  }
  if (phase.value === 'running' && Date.now() - lastPattern >= 1800) {
    lastPattern = Date.now();
    pattern();
  }
});
watch(() => ctx.activeApp.value === 'siren' && !ctx.dimmed.value, visible => {
  if (!visible) stop();
  else consumeSirenStart();
}, { flush: 'sync' });
watch(() => ctx.settings.sound, enabled => {
  if (!enabled) closeAudio();
});
onDeactivated(stop);
onBeforeUnmount(stop);
useWatchHardware('siren', {
  back: () => {
    if (phase.value !== 'idle') {
      stop();
      return true;
    }
    return false;
  }
});
</script>

<template>
  <section class="watch-app siren-app">
    <h1>Siren</h1>
    <div class="siren-symbol" :class="{active:phase==='running'}">
      <svg viewBox="0 0 160 140" aria-hidden="true">
        <path
          d="M42 111 V66 Q42 26 80 26 Q118 26 118 66 V111 M29 113 H131 M80 4 V13 M17 28 L28 39 M143 28 L132 39 M3 67 H18 M142 67 H157"
          fill="none"
          stroke="currentColor"
          stroke-width="11"
          stroke-linecap="round"
        />
        <path
          d="M62 85 V65 Q62 47 80 47"
          fill="none"
          stroke="currentColor"
          stroke-width="8"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <template v-if="phase==='idle' || phase==='holding'">
      <h2>Make some noise.</h2>
      <button
        class="watch-button hold-button"
        :style="{'--hold':holdProgress*100+'%'}"
        @pointerdown="pointerHold"
        @pointerup="cancelHold"
        @pointercancel="cancelHold"
        @lostpointercapture="cancelHold"
        @keydown="keyHold"
        @keyup="keyRelease"
        @blur="cancelHold"
      >
        {{ phase==='holding'?'Keep holding…':'Hold to start' }}
      </button>
      <p class="caption muted">Hold for 2 seconds, then a 3-second countdown starts.</p>
    </template>
    <template v-else-if="phase==='countdown'">
      <div
        class="countdown"
        role="status"
        aria-live="polite"
      >
        {{ countdown }}
      </div>
      <p class="caption">Starting quiet demonstration…</p>
      <button class="watch-button stop-button" @click="stop">Cancel</button>
    </template>
    <template v-else>
      <h2 class="running" role="status">Siren demonstration</h2>
      <p class="caption muted">
        {{ soundStatus }}
      </p>
      <button class="watch-button stop-button" @click="stop">■ Stop siren</button>
    </template>
    <p v-if="phase!=='running'" class="caption muted">
      {{ soundStatus }}
    </p>
    <p class="caption muted">This browser demo is quiet and cannot signal an emergency or contact help. Leaving this app stops it.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  line-height: 1.1;
  margin: 0 0 22px;
  font-weight: 700;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  margin: 0 0 12px;
}

.watch-app button:focus-visible,
.watch-app input:focus-visible {
  outline: 4px solid #fff;
  outline-offset: 3px;
}

.watch-app button {
  touch-action: manipulation;
}

.watch-app p {
  line-height: 1.3;
}

.watch-app input {
  box-sizing: border-box;
  width: 100%;
  height: 80px;
  border: 0;
  border-radius: 24px;
  background: #252527;
  color: white;
  padding: 0 20px;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.siren-app {
  text-align: center;
  background: radial-gradient(ellipse at 50% 25%,#481b0c,#000 65%);
}

h1 {
  text-align: left;
}

.siren-symbol {
  height: 160px;
  color: #FF6A13;
  margin: 6px auto 18px;
  width: 190px;
}

.siren-symbol svg {
  height: 100%;
  width: 100%;
}

.siren-symbol.active {
  color: #FF453A;
}

.hold-button {
  position: relative;
  background: linear-gradient(90deg,#FF9F0A var(--hold),#FF553A var(--hold)) !important;
  color: black !important;
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1))) !important;
  user-select: none;
  touch-action: none !important;
}

.stop-button {
  background: #FF453A !important;
  color: white !important;
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1))) !important;
}

.countdown {
  font-size: max(calc(12px / var(--watch-scale)), calc(93px * var(--text-size, 1)));
  line-height: 1.2;
  font-weight: 700;
  color: #FF9F0A;
}

.running {
  color: #FF9F0A;
}

.watch-button {
  margin: 16px 0;
}

.siren-symbol {
  width: 118px;
  height: 104px;
  margin: 6px auto 12px;
}
</style>
