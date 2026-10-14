<script setup lang="ts">
import { useWatch } from '../watch';
import FaceDial from './FaceDial.vue';
import FaceComplication from './FaceComplication.vue';
const watch = useWatch();
</script>

<template>
  <div class="face utility">
    <FaceDial :radius="173" />
    <FaceComplication
      class="corner"
      style="left:68px;top:90px"
      app="weather"
      label="Weather"
      value="23°"
      color="#51B9F6"
    />
    <FaceComplication
      class="corner"
      style="left:354px;top:90px"
      app="calendar"
      label="Calendar"
      :value="watch.now.value.getDate()"
      color="var(--accent)"
    />
    <FaceComplication
      class="corner bottom"
      style="left:211px;top:459px"
      app="activity"
      label="Open Activity"
      :value="watch.health.steps.toLocaleString()+' STEPS'"
      color="var(--accent)"
    />
    <div class="brand">UTILITY</div>
  </div>
</template>

<style scoped>
.brand {
  position: absolute;
  left: 0;
  right: 0;
  top: 323px;
  text-align: center;
  font-size: max(21px, calc(12px / var(--watch-scale)));
  letter-spacing: 2px;
  color: #8D8D92;
  pointer-events: none;
}

.bottom {
  width: 240px !important;
  flex-direction: row !important;
  gap: 12px !important;
}

.bottom :deep(.value) {
  font-size: 23px;
}

.face {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.face :deep(*) {
  font-family: inherit;
}
</style>
