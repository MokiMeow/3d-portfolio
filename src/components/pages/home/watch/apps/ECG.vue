<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const startedAt = ref<number | null>(null);
const complete = ref(false);
const seconds = computed(() => startedAt.value === null ? 30 : Math.max(0, 30 - Math.floor((watch.now.value.getTime() - startedAt.value) / 1000)));
const moving = computed(() => startedAt.value !== null && watch.activeApp.value === 'ecg' && !watch.dimmed.value && !watch.reducedMotion.value);
const trace = 'M0 70h25l5-8 5 16 5-8h18l8-4 6 4 6-47 9 92 8-45 5-4 12 4h29l7-8 6 16 6-8h15l8-4 6 4 6-47 9 92 8-45 5-4 12 4h35l6-8 6 16 6-8h20';
function start() {
    complete.value = false;
    startedAt.value = watch.now.value.getTime();
    watch.haptic();
}
function cancel() {
    startedAt.value = null;
    complete.value = false;
}
watchEffect(() => {
    if (startedAt.value !== null && seconds.value === 0) {
        startedAt.value = null;
        complete.value = true;
        watch.haptic('success');
    }
});
useWatchHardware('ecg', {
    action: () => {
        if (startedAt.value === null)
            start();
        else
            cancel();
        return true;
    }, back: () => {
        if (startedAt.value !== null || complete.value) {
            cancel();
            return true;
        }
        return false;
    }
});
onDeactivated(() => {
    startedAt.value = null;
});
</script>

<template>
  <section class="watch-app ecg-app">
    <h1>{{ complete ? 'Recording' : 'ECG' }}</h1>
    <template v-if="complete">
      <div class="done">
        <WatchGlyph name="check" />
      </div>
      <h2>Sample recorded</h2>
      <p class="caption muted">
        30 seconds ·
        {{ watch.health.heartRate }}
        BPM
      </p>
      <svg
        class="trace"
        viewBox="0 0 360 140"
        aria-hidden="true"
      >
        <path :d="trace" />
      </svg>
      
      <button class="watch-button" @click="start">Record again</button>
      <button class="watch-button" @click="complete = false">Done</button>
    </template>
    <template v-else-if="startedAt !== null">
      <p class="count">
        {{ seconds }}
        <small>seconds remaining</small>
      </p>
      <svg
        class="trace"
        :class="{ moving }"
        viewBox="0 0 360 140"
        aria-hidden="true"
      >
        <path :d="trace" />
      </svg>
      
      <p class="caption muted">On a real watch, rest your finger on the Digital Crown.</p>
      <button class="watch-button danger" @click="cancel">Cancel</button>
    </template>
    <template v-else>
      <svg
        class="intro-trace"
        viewBox="0 0 360 140"
        aria-hidden="true"
      >
        <path :d="trace" />
      </svg>
      <h2>A moment for your heart</h2>
      <button class="watch-button start" @click="start">Start demo ECG</button>
      <p class="caption muted">Explore a 30-second sample recording. No hardware contact is required.</p>
      
    </template>
    <p class="polish-footnote">Not a medical device.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,'SF Pro Rounded','Segoe UI',sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  font-weight: 700;
  margin: 0 0 14px;
}

h2 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  line-height: 1.2;
  margin: 20px 0;
}

.demo-label {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  letter-spacing: 1px;
  color: #ff7590;
  margin-bottom: 25px;
}

.trace,
.intro-trace {
  width: 100%;
  height: 140px;
  overflow: hidden;
}

.trace path,
.intro-trace path {
  stroke: #ff375f;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.intro-trace {
  margin: 20px 0;
}

.moving path {
  stroke-dasharray: 420;
  animation: trace 2s linear infinite;
}

.count {
  font-size: max(18px, calc(93px * var(--text-size, 1)));
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
  margin: 15px 0;
  color: #ff375f;
}

.count small {
  display: block;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  color: #fff;
  letter-spacing: 0;
}

.done {
  font-size: max(18px, calc(83px * var(--text-size, 1)));
  color: #ff375f;
  text-align: center;
}

.start {
  color: #ff375f;
}

@keyframes trace {
  from {
    opacity: 0.45;
  }

  to {
    opacity: 1;
  }
}

.demo-label {
  margin: 6px 0;
  letter-spacing: 0.3px;
}

.intro-trace {
  height: 92px;
  margin: 10px 0;
}

.ecg-app h2 {
  margin: 8px 0;
}

.done {
  display: grid;
  place-items: center;
  margin: 16px 0;
  line-height: 1.2;
}

.done :deep(svg) {
  width: 64px;
  height: 64px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF375F; }

.intro-trace, .trace { display:block; border-radius:30px; background:#1c1c1e; padding:10px; }
.count { font-size:96px; font-weight:600; margin:14px 0; }
.count small { font-size:20px; margin-top:6px; }
.ecg-app .platter:empty { display:none; }
</style>
