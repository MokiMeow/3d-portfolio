<script setup lang="ts">
const props = withDefaults(defineProps<{
    values: number[];
    color?: string;
    height?: number;
}>(), {
    color: '#FF2D55', height: 100
});
const points = computed(() => {
    if (!props.values.length)
        return '';
    const low = Math.min(...props.values) - 3;
    const high = Math.max(...props.values) + 3;
    return props.values.map((v, i) => (8 + i / Math.max(1, props.values.length - 1) * 344) + ',' + (props.height - 8 - (v - low) / (high - low) * (props.height - 16))).join(' ');
});
</script>

<template>
  <svg
    class="watch-chart"
    :viewBox="'0 0 360 ' + height"
    :style="{ height: height + 'px' }"
    role="img"
    :aria-label="values.length ? 'Trend from ' + values[0] + ' to ' + values[values.length - 1] : 'No readings'"
  >
    <line
      v-for="n in 3"
      :key="n"
      x1="8"
      x2="352"
      :y1="n * height / 4"
      :y2="n * height / 4"
      stroke="#ffffff14"
    />
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.watch-chart {
  display: block;
  width: 100%;
  overflow: visible;
}

.watch-chart {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.watch-chart :deep(*) {
  font-family: inherit;
}
</style>
