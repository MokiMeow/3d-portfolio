<script setup lang="ts">
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const startedAt = ref<number | null>(null);
const complete = ref(false);
const remaining = computed(() => startedAt.value === null ? 15 : Math.max(0, 15 - Math.floor((watch.now.value.getTime() - startedAt.value) / 1000)));
const moving = computed(() => startedAt.value !== null && watch.activeApp.value === 'bloodOxygen' && !watch.dimmed.value && !watch.reducedMotion.value);
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
    if (startedAt.value !== null && remaining.value === 0) {
        startedAt.value = null;
        complete.value = true;
        watch.health.oxygen = 97 + Math.abs(Math.round(Math.sin(watch.now.value.getTime() / 17000)));
        watch.haptic('success');
    }
});
useWatchHardware('bloodOxygen', {
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
  <section class="watch-app oxygen-app">
    <h1>{{ complete ? 'Results' : startedAt !== null ? 'Measuring' : 'Blood Oxygen' }}</h1>
    <div class="oxygen-orb" :class="{ moving }">
      <svg viewBox="0 0 240 240" aria-hidden="true">
        <circle
          cx="120"
          cy="120"
          r="106"
          class="track"
        />
        <circle
          v-if="startedAt !== null"
          cx="120"
          cy="120"
          r="106"
          class="progress"
          stroke-dasharray="666"
          :stroke-dashoffset="666 * remaining / 15"
          transform="rotate(-90 120 120)"
        />
        <ellipse
          cx="120"
          cy="120"
          rx="85"
          ry="43"
          transform="rotate(45 120 120)"
          class="red"
        />
        <ellipse
          cx="120"
          cy="120"
          rx="85"
          ry="43"
          transform="rotate(-45 120 120)"
          class="blue"
        />
      </svg>
      <span v-if="startedAt !== null">
        {{ remaining }}
      </span>
    </div>
    <template v-if="complete">
      <p class="oxygen-value">
        {{ watch.health.oxygen }}
        <small>%</small>
      </p>
      <h2>Sample complete</h2>
      
      <button class="watch-button" @click="start">Measure again</button>
    </template>
    <template v-else-if="startedAt !== null">
      <h2>Keep still</h2>
      
      <button class="watch-button danger" @click="cancel">Cancel</button>
    </template>
    <template v-else>
      <h2>15-second sample</h2>
      <button class="watch-button start" @click="start">Start demo</button>
      <p class="caption muted">Explore the measurement flow.</p>
      <div class="platter">
        <p class="caption muted">LAST SAMPLE</p>
        <p class="metric">
          {{ watch.health.oxygen }}
          <small>%</small>
        </p>
      </div>
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
  margin: 0 0 12px;
}

h2 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  font-weight: 600;
  text-align: center;
  margin: 16px 0;
}

.demo-label {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  letter-spacing: 1px;
  color: #77baff;
}

.oxygen-orb {
  position: relative;
  width: 235px;
  height: 235px;
  margin: 25px auto;
}

.oxygen-orb svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke-width: 14;
}

.track {
  stroke: #1b293c;
}

.progress {
  stroke: #fff;
  stroke-width: 5;
}

.red {
  stroke: #ff453a;
  opacity: .85;
}

.blue {
  stroke: #0a84ff;
  opacity: .85;
}

.oxygen-orb span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: max(18px, calc(70px * var(--text-size, 1)));
  font-weight: 650;
  line-height: 1.2;
  text-shadow: 0 2px 12px #000;
}

.moving ellipse {
  animation: orbit 4s ease-in-out infinite;
  transform-origin: 120px 120px;
}

.oxygen-value {
  text-align: center;
  font-size: max(18px, calc(93px * var(--text-size, 1)));
  line-height: 1.2;
  letter-spacing: -6px;
  color: #67baff;
  margin: 15px 0;
}

.oxygen-value small,
.metric small {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  letter-spacing: 0;
}

.start {
  color: #6db7ff;
}

@keyframes orbit {
  50% {
    opacity: .4;
    opacity: .6;
  }
}

.oxygen-orb {
  width: 132px;
  height: 132px;
  margin: 12px auto;
}

.demo-label {
  margin: 6px 0;
  letter-spacing: 0.3px;
}

.oxygen-app h2 {
  margin: 8px 0;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #0A84FF; }

.oxygen-orb { width:184px; height:184px; margin:18px auto; }
.oxygen-app .oxygen-value { justify-content:center; font-size:96px; margin:12px 0; }
.oxygen-app .metric { font-size:80px; }
.oxygen-app .platter .caption { margin:0 0 8px; }
</style>
