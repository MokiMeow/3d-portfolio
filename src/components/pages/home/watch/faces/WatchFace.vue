<script setup lang="ts">
import { useWatch } from '../watch';
import Wayfinder from './Wayfinder.vue';
import ModularUltra from './ModularUltra.vue';
import Waypoint from './Waypoint.vue';
import ActivityDigital from './ActivityDigital.vue';
import Utility from './Utility.vue';
import Deploy from './Deploy.vue';
const watch = useWatch();
const component = computed(() => ({
    wayfinder: Wayfinder, modularUltra: ModularUltra, waypoint: Waypoint, activityDigital: ActivityDigital, utility: Utility, deploy: Deploy
}[watch.settings.face]));
</script>

<template>
  <div
    class="root"
    :class="{night:watch.settings.nightMode,dimmed:watch.dimmed.value}"
    :style="{'--accent':watch.settings.nightMode?'#FF2D20':watch.settings.accent}"
  >
    <component :is="component" />
  </div>
</template>

<style scoped>
.root {
  position: relative;
  width: 422px;
  height: 514px;
  background: #000;
  color: #F5F5F7;
  --ink: #F5F5F7;
  --accent: #FF6A13;
  overflow: hidden;
  font-family: ui-rounded,'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-variant-numeric: tabular-nums;
}

.root :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

.root :deep(button) {
  -webkit-tap-highlight-color: transparent;
}

.night {
  --ink: #FF2D20;
}

.dimmed {
  opacity: .64;
}

.root :deep(.face) {
  position: relative;
  width: 422px;
  height: 514px;
}

.root :deep(.corner) {
  position: absolute;
  transform: translate(-50%,-50%);
  z-index: 3;
}

.root :deep(button:focus-visible) {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}
</style>
