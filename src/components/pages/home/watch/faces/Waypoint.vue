<script setup lang="ts">
import { useWatch } from '../watch';
import FaceDial from './FaceDial.vue';
import FaceComplication from './FaceComplication.vue';
const watch = useWatch();
const points = computed(() => watch.navigation.waypoints.map(p => ({
    ...p, x: 211 + Math.sin((p.bearing - watch.navigation.heading) * Math.PI / 180) * 102, y: 278 - Math.cos((p.bearing - watch.navigation.heading) * Math.PI / 180) * 102
})));
</script>

<template>
  <div class="face waypoint">
    <FaceDial compass :radius="151">
      <g class="map">
        <circle
          cx="211"
          cy="278"
          r="96"
          fill="none"
          stroke="#545457"
          stroke-dasharray="2 6"
        />
        <circle
          cx="211"
          cy="278"
          r="63"
          fill="none"
          stroke="#28282B"
        />
        <g v-for="p in points" :key="p.id">
          <path
            :d="'M211 278L'+p.x+' '+p.y"
            :stroke="p.color"
            stroke-width="2"
            stroke-dasharray="3 5"
            opacity=".55"
          />
          <circle
            :cx="p.x"
            :cy="p.y"
            r="8"
            :fill="p.color"
          />
          <text
            :x="p.x"
            :y="p.y-15"
            text-anchor="middle"
            :fill="p.color"
            font-size="21"
          >
            {{p.name}}
          </text>
        </g>
      </g>
    </FaceDial>
    <div class="heading">
      {{Math.round(watch.navigation.heading)}}
      °
    </div>
    <button
      class="waypoints"
      type="button"
      aria-label="Open compass and waypoints"
      @click="watch.open('compass')"
    >
    </button>
    <FaceComplication
      class="corner"
      style="left:71px;top:98px"
      app="weather"
      label="Weather"
      value="23°"
      color="#51B9F6"
    />
    <FaceComplication
      class="corner"
      style="left:351px;top:98px"
      app="calendar"
      label="Calendar"
      :value="watch.now.value.getDate()"
      color="var(--accent)"
    />
    <FaceComplication
      class="corner"
      style="left:71px;top:456px"
      app="maps"
      label="Maps"
      value="124 m"
      color="#30D158"
    />
    <FaceComplication
      class="corner"
      style="left:351px;top:456px"
      app="workout"
      label="Workout"
      value="HIKE"
      color="#B6F31B"
    />
  </div>
</template>

<style scoped>
.waypoint :deep(.dial) {
  z-index: 1;
}

.heading {
  position: absolute;
  top: 389px;
  width: 100%;
  text-align: center;
  color: var(--accent);
  font-size: 23px;
  z-index: 3;
}

.waypoints {
  position: absolute;
  top: 126px;
  left: 60px;
  width: 302px;
  height: 302px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  z-index: 2;
}

.face {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.face :deep(*) {
  font-family: inherit;
}
</style>
