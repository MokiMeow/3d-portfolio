<script setup lang="ts">
import { useWatch } from '../watch';
import FaceDial from './FaceDial.vue';
import FaceComplication from './FaceComplication.vue';
import ActivityRings from '../ActivityRings.vue';
const watch = useWatch();
const compass = ref(false);
const date = computed(() => watch.now.value.getDate());
const heading = computed(() => Math.round(watch.navigation.heading) + '°');
</script>

<template>
  <div class="face wayfinder">
    <button
      class="bezel"
      type="button"
      :aria-label="compass?'Show clock bezel':'Show compass bezel'"
      :aria-pressed="compass"
      @click="compass=!compass;watch.haptic()"
    >
    </button>
    <FaceDial
      explorer
      :compass="compass"
      :radius="169"
    />
    <div class="coordinates" :class="{compass}">
      <template v-if="compass">
        {{ heading }}
      </template>
      <template v-else>
        <span>37°20′ N</span>
        <span>122°00′ W</span>
      </template>
    </div>
    <FaceComplication
      class="corner"
      style="left:68px;top:92px"
      app="weather"
      label="Weather, 23 degrees"
      value="23°"
      color="#51B9F6"
    />
    <FaceComplication
      class="corner"
      style="left:354px;top:92px"
      app="calendar"
      label="Open Calendar"
      :value="date"
      color="var(--accent)"
    />
    <FaceComplication
      class="corner"
      style="left:68px;top:459px"
      app="compass"
      label="Open Compass"
      :value="heading"
      color="var(--accent)"
    />
    <FaceComplication
      class="corner"
      style="left:354px;top:459px"
      app="timer"
      label="Open Timers"
      value="10:00"
      color="var(--accent)"
    />
    <FaceComplication
      class="corner"
      style="left:211px;top:192px"
      small
      app="activity"
      label="Open Activity rings"
    >
      <ActivityRings
        :size="57"
        :move="watch.health.move/watch.health.goals.move"
        :exercise="watch.health.exercise/watch.health.goals.exercise"
        :stand="watch.health.stand/watch.health.goals.stand"
      />
    </FaceComplication>
    <FaceComplication
      class="corner"
      style="left:127px;top:278px"
      small
      app="heartRate"
      label="Open Heart Rate"
      :value="watch.health.heartRate"
      color="#FF2D55"
    />
    <FaceComplication
      class="corner"
      style="left:295px;top:278px"
      small
      app="workout"
      label="Open Workout"
      value="RUN"
      color="#B6F31B"
    />
    <FaceComplication
      class="corner"
      style="left:211px;top:365px"
      small
      app="depth"
      label="Open Depth"
      value="0 m"
      color="#00C8FF"
    />
  </div>
</template>

<style scoped>
.bezel {
  position: absolute;
  left: 39px;
  top: 106px;
  width: 344px;
  height: 344px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  z-index: 1;
}

.coordinates {
  position: absolute;
  top: 448px;
  width: 100%;
  text-align: center;
  font-size: 21px;
  letter-spacing: 1px;
  color: #c4c4c9;
  pointer-events: none;
}

.coordinates span {
  display: block;
  line-height: 1.2;
}

.coordinates.compass {
  color: #080809;
  font-size: max(21px, calc(12px / var(--watch-scale)));
  top: 460px;
}

.face {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.face :deep(*) {
  font-family: inherit;
}
</style>
