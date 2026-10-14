<script setup lang="ts">
import { APP_ICONS } from './icons';
const props = defineProps<{
    name: string;
}>();
</script>

<template>
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path :d="APP_ICONS[props.name] ?? APP_ICONS.info" />
  </svg>
</template>

<style scoped>
.glyph {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.glyph :deep(*) {
  font-family: inherit;
}
</style>
