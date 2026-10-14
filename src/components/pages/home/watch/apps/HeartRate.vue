<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const readings = ref([
    72, 71, 73, 74, 72, 70, 71, 74, 76, 74, 72, watch.health.heartRate
]);
const hourlyRanges = computed(() => Array.from({ length: 24 }, (_, hour) => {
  const low = 56 + Math.round(9 * Math.abs(Math.sin(hour * .7)));
  const high = low + 14 + Math.round(20 * Math.abs(Math.sin(hour * .4)));
  return { hour, low, high };
}));
const measuringAt = ref<number | null>(null);
const visible = computed(() => watch.activeApp.value === 'heartRate' && !watch.dimmed.value);
const pulse = computed(() => visible.value && !watch.reducedMotion.value);
function measure() {
    measuringAt.value = watch.now.value.getTime();
    watch.haptic();
}
watchEffect(() => {
    if (measuringAt.value !== null && watch.now.value.getTime() - measuringAt.value >= 4000) {
        const value = 70 + Math.round(Math.sin(watch.now.value.getTime() / 11000) * 5);
        watch.health.heartRate = value;
        readings.value = [...readings.value.slice(-19), value];
        measuringAt.value = null;
        watch.haptic('success');
    }
});
useWatchHardware('heartRate', { action: () => {
        measure();
        return true;
    } });
onDeactivated(() => {
    measuringAt.value = null;
});
</script>

<template>
  <section class="watch-app heart-app">
    <header class="heart-header">
      <span class="heart" :class="{ pulse }" aria-hidden="true"><WatchGlyph name="heart" /></span>
      <h1>Heart Rate</h1>
    </header>
    <div class="bpm"><strong>{{ watch.health.heartRate }}</strong><small>BPM</small></div>
    <p class="caption muted now">{{ measuringAt !== null ? 'Measuring…' : 'Now' }}</p>
    <svg class="range-chart" viewBox="0 0 378 180" role="img" aria-label="Sample hourly heart rate ranges over 24 hours">
      <path d="M8 40H370 M8 90H370 M8 140H370" stroke="#ffffff16" />
      <line v-for="range in hourlyRanges" :key="range.hour" :x1="14 + range.hour * 15.2" :x2="14 + range.hour * 15.2" :y1="145 - (range.high - 45) * 1.6" :y2="145 - (range.low - 45) * 1.6" stroke="#FF2D55" stroke-width="7" stroke-linecap="round" />
      <g fill="#ffffff99" font-size="18"><text x="8" y="173">00</text><text x="98" y="173">06</text><text x="190" y="173">12</text><text x="280" y="173">18</text></g>
    </svg>
    <div class="platter heart-row"><span>Resting</span><strong>{{ watch.health.resting }} <small>BPM</small></strong></div>
    <div class="platter heart-row"><span>Walking Average</span><strong>{{ watch.health.walking }} <small>BPM</small></strong></div>
    <div class="platter heart-row"><span>Today's range</span><strong>{{ Math.min(...hourlyRanges.map(r => r.low), ...readings) }}–{{ Math.max(...hourlyRanges.map(r => r.high), ...readings) }} <small>BPM</small></strong></div>
    <button class="watch-button primary" :disabled="measuringAt !== null" @click="measure">Measure again</button>
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
  margin: 0 0 18px;
}

.heart {
  font-size: max(18px, calc(93px * var(--text-size, 1)));
  line-height: 1.2;
  color: #ff2d55;
  width: 120px;
  text-align: center;
  margin: 10px 0 22px;
  transform-origin: center;
}

.heart.pulse {
  animation: pulse 1.2s ease-in-out infinite;
}

.bpm {
  font-size: max(18px, calc(93px * var(--text-size, 1)));
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -5px;
  margin: 5px 0 10px;
}

.bpm small {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  letter-spacing: 0;
  margin-left: 12px;
  color: #ff2d55;
}

.metric small,
.range small {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.range {
  font-size: max(18px, calc(50px * var(--text-size, 1)));
  margin: 10px 0;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }

  20% {
    transform: scale(1.09);
  }

  40% {
    transform: scale(1);
  }
}

button:disabled {
  opacity: .6;
}

.heart {
  width: 62px;
  height: 62px;
  margin: 8px 0;
}

.heart svg {
  width: 100%;
  height: 100%;
  fill: #ff2d55;
  stroke-width: 0;
}

.bpm {
  margin: 4px 0;
  font-size: 90px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF2D55; }

.heart-header { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.heart-header h1 { margin:0; }
.heart-header .heart { width:30px; height:30px; flex:0 0 30px; margin:0; }
.heart-header .heart :deep(svg) { width:30px; height:30px; }
.heart-app .bpm { font-size:96px; margin:0; }
.bpm strong { font-weight:600; }
.now { margin:0 0 12px; }
.range-chart { display:block; width:100%; height:180px; margin:12px 0 18px; }
.heart-row { display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:76px; font-size:24px; }
.heart-row strong { white-space:nowrap; color:#ff2d55; font-size:26px; font-weight:600; }
.heart-row small { font-size:18px; }
.heart-app > .watch-button { width:100%; }

.heart-header .heart :deep(svg) { fill:#ff2d55; stroke-width:0; }
</style>
