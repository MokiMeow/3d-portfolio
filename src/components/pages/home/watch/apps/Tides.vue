<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { clamp, useWatch, useWatchHardware } from '../watch';
const ctx = useWatch();
const beaches = ['Marina Beach', 'Half Moon Bay', 'Moonlit Cove'];
const beach = ref(0);
const exploring = ref(false);
const tideId = useId();
const currentHour = () => ctx.now.value.getHours() + ctx.now.value.getMinutes() / 60;
const hour = ref(currentHour());
function liveTide(): void {
  exploring.value = false;
  hour.value = currentHour();
}
watch(ctx.now, () => {
  if (!exploring.value) hour.value = currentHour();
});
const heightAt = (value: number) => 1.25 + Math.sin((value - 2) * Math.PI / 6.2) * 0.85;
const tideHeight = computed(() => heightAt(hour.value));
const curve = computed(() => Array.from({
  length: 97
}, (_, i) => (18 + i / 96 * 330).toFixed(1) + ',' + (178 - heightAt(i / 4) * 65).toFixed(1)).join(' '));
const point = computed(() => ({
  x: 18 + hour.value / 24 * 330,
  y: 178 - tideHeight.value * 65
}));
function nextTide(first: number) {
  let value = first;
  while (value <= hour.value) value += 12.4;
  const day = Math.floor(value / 24);
  const minute = Math.round(value % 24 * 60);
  return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0') + (day ? ' +' + day + 'd' : '');
}
const nextHigh = computed(() => nextTide(5.1));
const nextLow = computed(() => nextTide(11.3));
useWatchHardware('tides', {
  crown: delta => {
    exploring.value = true;
    hour.value = clamp(hour.value + delta * .25, 0, 24);
    return true;
  }
});
</script>

<template>
  <section class="watch-app tides-app">
    <h1>Tides</h1>
    <button class="beach-button" @click="beach=(beach+1)%beaches.length">
      {{ beaches[beach] }}
      <span>
        <WatchGlyph name="down" />
      </span>
    </button>
    <span class="caption muted">Fictional beach forecast</span>
    <div class="tide-metric">
      <strong>
        {{ tideHeight.toFixed(1) }}
        <small>m</small>
      </strong>
      <span class="caption">
        {{ Math.cos((hour-2)*Math.PI/6.2)>0?'Rising':'Falling' }}
        tide
      </span>
    </div>
    <svg
      viewBox="0 0 366 218"
      class="tide-graph"
      role="img"
      aria-label="Demonstration tide heights over twenty four hours"
    >
      <defs>
        <linearGradient
          :id="tideId"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0"
            stop-color="#39AFFF"
            stop-opacity=".45"
          />
          <stop
            offset="1"
            stop-color="#39AFFF"
            stop-opacity="0"
          />
        </linearGradient>
      </defs>
      <path :d="'M18,192 L'+curve.replaceAll(' ',' L')+' L348,192 Z'" :fill="'url(#' + tideId + ')'" />
      <line
        v-for="y in [48,105,162]"
        :key="y"
        x1="18"
        :y1="y"
        x2="348"
        :y2="y"
        stroke="#33343A"
        stroke-dasharray="4 5"
      />
      <polyline
        :points="curve"
        fill="none"
        stroke="#39AFFF"
        stroke-width="5"
        stroke-linecap="round"
      />
      <line
        :x1="point.x"
        y1="20"
        :x2="point.x"
        y2="192"
        stroke="#fff"
        opacity=".35"
      />
      <circle
        :cx="point.x"
        :cy="point.y"
        r="8"
        fill="white"
        stroke="#39AFFF"
        stroke-width="3"
      />
      <text x="18" y="216">00</text>
      <text x="96" y="216">06</text>
      <text x="178" y="216">12</text>
      <text x="262" y="216">18</text>
      <text x="322" y="216">24</text>
    </svg>
    <p class="caption muted">
      {{ Math.floor(hour).toString().padStart(2,'0') }}
      :
      {{ Math.round(hour%1*60).toString().padStart(2,'0') }}
      · Turn the Crown to explore
    </p>
    <div class="platter tide-row">
      <span class="arrow">
        <WatchGlyph name="up" />
      </span>
      <div>
        <span class="caption muted">Next high tide</span>
        <strong>
          {{ nextHigh }}
        </strong>
      </div>
      <strong>2.1 m</strong>
    </div>
    <div class="platter tide-row">
      <span class="arrow low">
        <WatchGlyph name="down" />
      </span>
      <div>
        <span class="caption muted">Next low tide</span>
        <strong>
          {{ nextLow }}
        </strong>
      </div>
      <strong>0.4 m</strong>
    </div>
    <button
      v-if="exploring"
      class="watch-button"
      @click="liveTide"
    >Return to now</button>
    <p class="caption muted">Illustrative data only. Check local tide information before entering the water.</p>
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

.beach-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 80px;
  width: 100%;
  border: 0;
  background: transparent;
  color: #39AFFF;
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
  text-align: left;
  padding: 0;
}

.tide-metric {
  display: flex;
  flex-direction: column;
  color: #75CBFF;
  margin-top: 16px;
}

.tide-metric strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(68px * var(--text-size, 1)));
  color: white;
  line-height: 1.2;
}

.tide-metric small {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
}

.tide-graph {
  width: 100%;
  margin-top: 16px;
}

.tide-graph text {
  fill: #99999F;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
}

.tide-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.tide-row div {
  display: flex;
  flex-direction: column;
}

.tide-row strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.arrow {
  font-size: max(calc(12px / var(--watch-scale)), calc(35px * var(--text-size, 1)));
  color: #39AFFF;
}

.low {
  color: #ADDDFF;
}

.tide-metric {
  margin-top: 8px;
}

.tide-metric strong {
  font-size: 64px;
}

.tide-graph {
  margin-top: 8px;
  height: 142px;
}
</style>
