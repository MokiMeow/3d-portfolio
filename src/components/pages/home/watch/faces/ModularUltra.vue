<script setup lang="ts">
import { useWatch, timeText } from '../watch';
import FaceComplication from './FaceComplication.vue';
import ActivityRings from '../ActivityRings.vue';
const watch = useWatch();
const time = computed(() => timeText(watch.now.value, watch.settings.hour24).replace(/\s?(AM|PM)/i, ''));
const date = computed(() => watch.now.value.toLocaleDateString([], {
    weekday: 'short', day: 'numeric'
}).toUpperCase());
const edgeValue = computed(() => {
    if (watch.settings.bezel === 'elevation') return '124 M';
    if (watch.settings.bezel === 'depth') return '0 M';
    if (watch.dimmed.value || watch.reducedMotion.value) return '';
    return String(watch.now.value.getSeconds()).padStart(2, '0');
});
</script>

<template>
  <div class="face modular">
    <svg
      class="edge"
      viewBox="0 0 422 514"
      aria-hidden="true"
    >
      <g
        v-for="n in 60"
        :key="n"
        :stroke="n <= watch.now.value.getSeconds() && watch.settings.bezel==='seconds' && !watch.dimmed.value && !watch.reducedMotion.value ? 'var(--accent)' : '#4B4B4E'"
        :stroke-width="n%5===0?4:2"
      >
        <line
          :x1="n<31?12:410"
          :x2="n<31?(n%5===0?24:19):(n%5===0?398:403)"
          :y1="70+(n%30)*13.3"
          :y2="70+(n%30)*13.3"
        />
      </g>
    </svg>
    <FaceComplication
      class="corner"
      style="left:85px;top:86px"
      app="weather"
      label="Weather"
      value="23°"
      color="#51B9F6"
    />
    <FaceComplication
      class="corner"
      style="left:211px;top:86px"
      app="calendar"
      label="Calendar"
      :value="date"
      color="var(--accent)"
    />
    <FaceComplication
      class="corner"
      style="left:337px;top:86px"
      app="compass"
      label="Compass"
      :value="Math.round(watch.navigation.heading)+'°'"
      color="var(--accent)"
    />
    <div class="digital">
      {{time}}
    </div>
    <button
      class="wide"
      type="button"
      aria-label="Open Activity"
      @click="watch.open('activity')"
    >
      <ActivityRings
        :size="89"
        :move="watch.health.move/watch.health.goals.move"
        :exercise="watch.health.exercise/watch.health.goals.exercise"
        :stand="watch.health.stand/watch.health.goals.stand"
      />
      <div>
        <span class="move">
          {{watch.health.move}}
          CAL
        </span>
        <span class="exercise">
          {{watch.health.exercise}}
          MIN
        </span>
        <span class="stand">
          {{watch.health.stand}}
          HRS
        </span>
      </div>
      <svg viewBox="0 0 110 65" aria-hidden="true">
        <path
          d="M0 57 11 48 20 53 30 37 40 44 50 18 60 35 70 12 80 29 90 7 100 23 110 14"
          fill="none"
          stroke="#FA114F"
          stroke-width="5"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <FaceComplication
      class="corner"
      style="left:85px;top:399px"
      app="heartRate"
      label="Heart Rate"
      :value="watch.health.heartRate"
      color="#FF2D55"
    />
    <FaceComplication
      class="corner"
      style="left:211px;top:399px"
      app="workout"
      label="Workout"
      value="START"
      color="#B6F31B"
    />
    <FaceComplication
      class="corner"
      style="left:337px;top:399px"
      app="timer"
      label="Timers"
      value="10:00"
      color="var(--accent)"
    />
    <div class="edge-value">
      {{edgeValue}}
      <span v-if="edgeValue && watch.settings.bezel!=='seconds'">
        {{watch.settings.bezel.toUpperCase()}}
      </span>
    </div>
  </div>
</template>

<style scoped>
.edge {
  position: absolute;
  inset: 0;
  width: 422px;
  height: 514px;
}

.digital {
  position: absolute;
  top: 135px;
  left: 21px;
  right: 21px;
  text-align: center;
  font-size: 105px;
  font-weight: 650;
  letter-spacing: -7px;
  line-height: 1.15;
  color: var(--ink);
  font-stretch: condensed;
}

.wide {
  position: absolute;
  left: 36px;
  top: 267px;
  width: 350px;
  height: 94px;
  border: 0;
  border-radius: 23px;
  background: #171719;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  text-align: left;
  cursor: pointer;
}

.wide div {
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  font-size: 22px;
  font-weight: 650;
}

.wide svg {
  width: 100px;
  height: 65px;
}

.move {
  color: #FA114F;
}

.exercise {
  color: #A4FF00;
}

.stand {
  color: #00D7FF;
}

.edge-value {
  position: absolute;
  bottom: 17px;
  width: 100%;
  text-align: center;
  font-size: 25px;
  font-weight: 600;
  color: var(--accent);
}

.edge-value span {
  display: block;
  font-size: max(21px, calc(12px / var(--watch-scale)));
  letter-spacing: 1px;
}

.modular :deep(.value) {
  font-size: 23px;
}

.modular :deep(.corner:nth-of-type(3) .value),
.modular :deep(.corner:nth-last-of-type(3) .value) {
  font-size: max(21px, calc(12px / var(--watch-scale)));
}

.face {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.face :deep(*) {
  font-family: inherit;
}
</style>
