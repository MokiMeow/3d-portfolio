<script setup lang="ts">
import { useWatch, timeText } from '../watch';
import ActivityRings from '../ActivityRings.vue';
import FaceComplication from './FaceComplication.vue';
const watch = useWatch();
const time = computed(() => timeText(watch.now.value, watch.settings.hour24).replace(/\s?(AM|PM)/i, ''));
const date = computed(() => watch.now.value.toLocaleDateString([], {
    weekday: 'short', month: 'short', day: 'numeric'
}).toUpperCase());
</script>

<template>
  <div class="face activity">
    <div class="date">
      {{date}}
    </div>
    <div class="time">
      {{time}}
      <span v-if="watch.settings.seconds&&!watch.dimmed.value&&!watch.reducedMotion.value">
        {{String(watch.now.value.getSeconds()).padStart(2,'0')}}
      </span>
    </div>
    <button
      class="rings"
      type="button"
      aria-label="Open Activity rings"
      @click="watch.open('activity')"
    >
      <ActivityRings
        :size="247"
        :move="watch.health.move/watch.health.goals.move"
        :exercise="watch.health.exercise/watch.health.goals.exercise"
        :stand="watch.health.stand/watch.health.goals.stand"
      />
    </button>
    <button
      class="totals"
      type="button"
      aria-label="Open daily activity totals"
      @click="watch.open('activity')"
    >
      <span>
        {{watch.health.move}}
        <small>CAL</small>
      </span>
      <span>
        {{watch.health.exercise}}
        <small>MIN</small>
      </span>
      <span>
        {{watch.health.stand}}
        <small>HRS</small>
      </span>
    </button>
    <FaceComplication
      class="corner"
      style="left:68px;top:464px"
      app="heartRate"
      label="Heart Rate"
      :value="watch.health.heartRate"
      color="#FF2D55"
    />
    <FaceComplication
      class="corner"
      style="left:211px;top:464px"
      app="workout"
      label="Workout"
      value="START"
      color="#B6F31B"
    />
    <FaceComplication
      class="corner"
      style="left:354px;top:464px"
      app="weather"
      label="Weather"
      value="23°"
      color="#51B9F6"
    />
  </div>
</template>

<style scoped>
.date {
  position: absolute;
  top: 52px;
  width: 100%;
  text-align: center;
  font-size: 23px;
  font-weight: 600;
  color: #FA114F;
}

.time {
  position: absolute;
  top: 76px;
  width: 100%;
  text-align: center;
  font-size: 78px;
  font-weight: 650;
  letter-spacing: -4px;
  line-height: 1.1;
  color: var(--ink);
}

.time span {
  font-size: 30px;
  letter-spacing: 0;
  margin-left: 8px;
  font-weight: 500;
}

.rings {
  position: absolute;
  left: 85px;
  top: 166px;
  width: 252px;
  height: 248px;
  padding: 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  border-radius: 50%;
}

.totals {
  position: absolute;
  top: 389px;
  left: 26px;
  width: 370px;
  min-height: 64px;
  padding: 3px 0;
  display: flex;
  justify-content: space-evenly;
  background: #000;
  border: 0;
  cursor: pointer;
  border-radius: 20px;
}

.totals span {
  font-size: 29px;
  color: #FA114F;
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.totals span:nth-child(2) {
  color: #A4FF00;
}

.totals span:nth-child(3) {
  color: #00D7FF;
}

.totals small {
  font-size: max(21px, calc(12px / var(--watch-scale)));
}

.face {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.face :deep(*) {
  font-family: inherit;
}
</style>
