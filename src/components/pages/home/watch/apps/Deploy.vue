<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const holdButton = ref<HTMLButtonElement | null>(null);
const holding = ref(false);
const held = ref(0);
const startedAt = ref(0);
const failed = ref(false);
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let progressTimer: ReturnType<typeof setInterval> | undefined;
let holdStartedAt = 0;
const steps = ['Installing dependencies', 'Checking types', 'Running tests', 'Shipping pixels'];
const elapsed = computed(() => startedAt.value ? Math.max(0, watch.now.value.getTime() - startedAt.value) : 0);
const step = computed(() => Math.min(3, Math.floor(elapsed.value / 1400)));
const busy = computed(() => watch.fun.lastBuild === 'running');
const incidentDays = computed(() => Math.max(0, Math.floor((watch.now.value.getTime() - watch.fun.incidentAt) / 86400000)));
const celebrate = ref(false);
let celebrateTimer: ReturnType<typeof setTimeout> | undefined;
function cancelHold() {
  if (holdTimer)
    clearTimeout(holdTimer);
  if (progressTimer)
    clearInterval(progressTimer);
  holdTimer = undefined;
  progressTimer = undefined;
  holding.value = false;
  held.value = 0;
}
function confettiStyle(n: number) {
  return {
    left: (n * 19 % 100) + '%',
    '--delay': (n % 6) * .06 + 's',
    '--turn': (n % 2 ? 1 : -1) * 180 + 'deg',
    background: ['#ff453a', '#ffd60a', '#30d158', '#0a84ff'][n % 4],
  };
}
function deploy() {
  cancelHold();
  if (busy.value)
    return;
  failed.value = Math.random() < .22;
  startedAt.value = Date.now();
  watch.fun.deploys++;
  watch.fun.incidentAt = startedAt.value;
  watch.fun.lastBuild = 'running';
  watch.haptic('warning');
}
function beginHold() {
  if (busy.value || watch.dimmed.value || holding.value)
    return;
  holding.value = true;
  holdStartedAt = Date.now();
  progressTimer = setInterval(() => {
    held.value = Math.min(1, (Date.now() - holdStartedAt) / 1000);
  }, 40);
  holdTimer = setTimeout(deploy, 1000);
}
function pointerHold(event: PointerEvent) {
  if (event.button !== 0)
    return;
  (event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
  beginHold();
}
function keyHold(event: KeyboardEvent) {
  if (event.key !== ' ' && event.key !== 'Enter')
    return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat)
    beginHold();
}
function keyRelease(event: KeyboardEvent) {
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    cancelHold();
  }
}
watchEffect(() => {
  if (!busy.value || !startedAt.value || elapsed.value < 5600)
    return;
  watch.fun.lastBuild = failed.value ? 'failed' : 'passed';
  watch.haptic(failed.value ? 'warning' : 'success');
  watch.notify({
    app: 'deploy',
    title: failed.value ? 'Works on my wrist' : 'Deployment complete',
    text: failed.value ? 'A simulated build failed. Try shipping it again.' : 'Your simulated pixels are in production.'
  });
  if (!failed.value && !watch.reducedMotion.value) {
    celebrate.value = true;
    celebrateTimer = setTimeout(() => {
      celebrate.value = false;
    }, 1800);
  }
});
watchEffect(() => {
  if (watch.dimmed.value || watch.activeApp.value !== 'deploy')
    cancelHold();
});
useWatchHardware('deploy', { action: () => {
    holdButton.value?.focus();
    return true;
  } });
onMounted(() => {
  if (busy.value)
    startedAt.value = Date.now();
});
onDeactivated(() => {
  cancelHold();
  celebrate.value = false;
});
onBeforeUnmount(() => {
  cancelHold();
  if (celebrateTimer)
    clearTimeout(celebrateTimer);
});
</script>

<template>
  <section class="watch-app deploy-app">
    <h1>Deploy</h1>
    <p class="caption muted">Production. From your wrist.</p>
    <div
      v-if="busy"
      class="platter pipeline"
      role="status"
      aria-live="polite"
    >
      <div class="build-icon">
        <WatchGlyph name="rocket" />
      </div>
      <strong>
        {{ steps[step] }}
      </strong>
      <div class="step-dots">
        <span
          v-for="(label, index) in steps"
          :key="label"
          :class="{ done: index < step, current: index === step }"
        >
        </span>
      </div>
      <p class="caption muted">
        Step
        {{ step + 1 }}
        of 4
      </p>
    </div>
    <template v-else>
      <button
        ref="holdButton"
        class="launch"
        :class="{ holding }"
        :style="{ '--held': held }"
        aria-label="Hold for one second to deploy a simulated build"
        @pointerdown.prevent="pointerHold"
        @pointerup="cancelHold"
        @pointercancel="cancelHold"
        @lostpointercapture="cancelHold"
        @keydown="keyHold"
        @keyup="keyRelease"
        @blur="cancelHold"
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M25 39 14 50l-2-12 9-9M25 39l10 4 9-9-9-9M25 39 21 29c8-14 18-20 32-20 0 14-6 24-20 32M30 46l-4 12-8-2 5-9" />
          <circle
            cx="41"
            cy="21"
            r="4"
          />
        </svg>
        <strong>
          {{ holding ? 'Keep holding…' : 'DEPLOY' }}
        </strong>
        <span>Hold 1 second</span>
      </button>
      <p
        v-if="watch.fun.lastBuild === 'passed'"
        class="result positive"
        role="status"
      >✓ Shipped. Take a breath.</p>
      <p
        v-else-if="watch.fun.lastBuild === 'failed'"
        class="result danger"
        role="status"
      >Works on my wrist.™</p>
      <p v-else class="caption muted instruction">Space or Enter works too.</p>
    </template>
    <div class="platter stats">
      <div>
        <strong>
          {{ watch.fun.deploys }}
        </strong>
        <span class="caption muted">Deploys</span>
      </div>
      <div>
        <strong>
          {{ incidentDays }}
        </strong>
        <span class="caption muted">Incident-free days</span>
      </div>
    </div>
    
    <div
      v-if="celebrate && !watch.dimmed.value && !watch.reducedMotion.value"
      class="confetti"
      aria-hidden="true"
    >
      <i
        v-for="n in 18"
        :key="n"
        :style="confettiStyle(n)"
      >
      </i>
    </div>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.deploy-app {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;
  position: relative;
}

.deploy-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  margin: 0 0 8px;
}

.launch {
  width: 100%;
  height: 192px;
  border: 3px solid #ff7770;
  border-radius: 44px;
  background: linear-gradient(0deg, #d52a27 0%, #c51628 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  margin: 20px 0 12px;
  position: relative;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  box-shadow: 0 8px 28px #ff453a33;
}

.launch::after {
  content: '';
  position: absolute;
  inset: 0;
  background: #fff3;
  transform: scaleX(var(--held,0));
  transform-origin: left;
  pointer-events: none;
}

.launch svg {
  width: 64px;
  height: 64px;
  fill: none;
  stroke: currentColor;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.launch strong {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  letter-spacing: 3px;
}

.launch span {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  margin-top: 3px;
}

.launch:focus-visible {
  outline: 5px solid white;
  outline-offset: 4px;
}

.launch.holding {
  border-color: white;
}

.result {
  text-align: center;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  margin: 18px 0;
}

.instruction {
  text-align: center;
  margin: 16px 0;
}

.stats {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 12px;
  text-align: center;
}

.stats strong {
  font-size: max(18px, calc(36px * var(--text-size, 1)));
  display: block;
}

.stats span {
  display: block;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.pipeline {
  margin: 24px 0;
  text-align: center;
  min-height: 236px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.pipeline strong {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.build-icon {
  color: #ff453a;
  font-size: max(18px, calc(60px * var(--text-size, 1)));
}

.step-dots {
  display: flex;
  gap: 15px;
  margin: 20px 0 0;
}

.step-dots span {
  width: 18px;
  height: 18px;
  background: #454548;
  border-radius: 50%;
}

.step-dots .done {
  background: #30d158;
}

.step-dots .current {
  background: #ff453a;
}

.disclaimer {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  text-align: center;
  margin: 20px 0 0;
}

.confetti {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.confetti i {
  position: absolute;
  top: -15px;
  width: 10px;
  height: 20px;
  animation: confetti 1.6s var(--delay) ease-out both;
}

@keyframes confetti {
  to {
    transform: translateY(490px) rotate(var(--turn));
    opacity: 0;
  }
}

@media (prefers-reduced-motion:reduce) {
  .confetti {
    display: none;
  }
}

.launch {
  height: 142px;
  margin: 12px 0;
  border-radius: 36px;
}

.launch svg {
  width: 46px;
  height: 46px;
}

.launch strong {
  font-size: 30px;
  letter-spacing: 2px;
}

.stats {
  grid-template-columns: 1fr 1fr;
}

.pipeline {
  min-height: 190px;
}

.build-icon {
  line-height: 1.2;
  margin-bottom: 12px;
}

.build-icon :deep(svg) {
  width: 52px;
  height: 52px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FA114F; }

.stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
.stats > div { display:flex; flex-direction:column; align-items:center; gap:6px; }
.stats strong { font-size:48px; line-height:1.2; font-weight:600; }
.stats .caption { line-height:1.25; text-align:center; }
.pipeline strong { font-size:25px; line-height:1.25; }
</style>
