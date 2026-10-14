<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ time: number; offset: number }>();
const date = computed(() => new Date(props.time + props.offset * 60000));
const seconds = computed(() => date.value.getUTCSeconds() + date.value.getUTCMilliseconds() / 1000);
const minutes = computed(() => date.value.getUTCMinutes() + seconds.value / 60);
const hours = computed(() => date.value.getUTCHours() + minutes.value / 60);
const day = computed(() => hours.value >= 6 && hours.value < 18);
</script>
<template><svg class="clock-face" :class="{ day }" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" class="face" /><g v-for="i in 60" :key="i" :transform="'rotate(' + i * 6 + ' 100 100)'" stroke="currentColor" :opacity="i % 5 === 0 ? .8 : .3" :stroke-width="i % 5 === 0 ? 2 : 1"><path :d="i % 5 === 0 ? 'M100 10v11' : 'M100 10v5'" /></g><g class="numerals"><text v-for="i in 12" :key="i" :x="100 + 64 * Math.sin(i * Math.PI / 6)" :y="106 - 64 * Math.cos(i * Math.PI / 6)">{{ i }}</text></g><g stroke="currentColor" stroke-linecap="round"><path d="M100 109V57" :transform="'rotate(' + hours * 30 + ' 100 100)'" stroke-width="5" /><path d="M100 112V30" :transform="'rotate(' + minutes * 6 + ' 100 100)'" stroke-width="3" /></g><path d="M100 117V21" :transform="'rotate(' + seconds * 6 + ' 100 100)'" stroke="#ff9f45" stroke-width="1.8" stroke-linecap="round" /><circle cx="100" cy="100" r="5" fill="#ff9f45" /><circle cx="100" cy="100" r="2" fill="currentColor" /></svg></template>
<style scoped>
.clock-face { display: block; width: 100%; max-width: 176px; aspect-ratio: 1; color: #f6f4f0; filter: drop-shadow(0 8px 16px #0002); } .face { fill: #19202b; stroke: #ffffff1a; stroke-width: 1; } .day { color: #242731; } .day .face { fill: #f2eee5; stroke: #fff; } .numerals { fill: currentColor; font: 17px -apple-system,BlinkMacSystemFont,sans-serif; text-anchor: middle; }
</style>
