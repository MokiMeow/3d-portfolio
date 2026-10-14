<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import WatchChart from '../WatchChart.vue';
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const readings = ref([
    72, 71, 73, 74, 72, 70, 71, 74, 76, 74, 72, watch.health.heartRate
]);
const lastMeasured = ref(watch.now.value.getTime());
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
        lastMeasured.value = watch.now.value.getTime();
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
    <h1>Heart Rate</h1>
    <div
      class="heart"
      :class="{ pulse }"
      aria-hidden="true"
    >
      <WatchGlyph name="heart" />
    </div>
    <p class="caption muted">
      {{ measuringAt !== null ? 'Reading sample…' : 'CURRENT' }}
    </p>
    <p class="bpm">
      {{ watch.health.heartRate }}
      <small>BPM</small>
    </p>
    <p class="caption muted">
      {{ new Date(lastMeasured).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
      · SIMULATED
    </p>
    <button
      class="watch-button"
      :disabled="measuringAt !== null"
      @click="measure"
    >
      {{ measuringAt !== null ? 'Measuring…' : 'Measure again' }}
    </button>
    <WatchChart
      :values="readings"
      color="#ff2d55"
      :height="80"
    />
    <div class="platter">
      <p class="caption muted">RESTING</p>
      <p class="metric">
        {{ watch.health.resting }}
        <small>BPM</small>
      </p>
    </div>
    <div class="platter">
      <p class="caption muted">WALKING AVERAGE</p>
      <p class="metric">
        {{ watch.health.walking }}
        <small>BPM</small>
      </p>
    </div>
    <div class="platter">
      <p class="caption muted">TODAY'S SAMPLE RANGE</p>
      <p class="range">
        {{ Math.min(...readings) }}
        –
        {{ Math.max(...readings) }}
        <small>BPM</small>
      </p>
    </div>
    <p class="caption muted">Sample readings for this watch demo. No sensor is connected.</p>
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
  font-size: max(calc(12px / var(--watch-scale)), calc(31px * var(--text-size, 1)));
  font-weight: 700;
  margin: 0 0 18px;
}

.heart {
  font-size: max(calc(12px / var(--watch-scale)), calc(93px * var(--text-size, 1)));
  line-height: 1;
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
  font-size: max(calc(12px / var(--watch-scale)), calc(93px * var(--text-size, 1)));
  font-weight: 650;
  line-height: 1;
  letter-spacing: -5px;
  margin: 5px 0 10px;
}

.bpm small {
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
  letter-spacing: 0;
  margin-left: 12px;
  color: #ff2d55;
}

.metric small,
.range small {
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
}

.range {
  font-size: max(calc(12px / var(--watch-scale)), calc(50px * var(--text-size, 1)));
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
