<script setup lang="ts">
import type { Condition } from './model';
defineProps<{ condition: Condition; night?: boolean }>();
</script>
<template>
<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <template v-if="condition === 'clear'"><path v-if="night" d="M28 28A13 13 0 0 1 16 6a13 13 0 1 0 12 22Z" fill="#d3e7ff" stroke="#e1eeff" /><g v-else stroke="#ffd888"><circle cx="20" cy="20" r="7" fill="#ffd888" /><path d="M20 3v4m0 26v4M3 20h4m26 0h4M8 8l3 3m18 18 3 3M8 32l3-3M29 11l3-3" /></g></template>
  <template v-else><g v-if="condition === 'cloudy'" stroke="#ffda8d"><circle cx="25" cy="12" r="6" fill="#ffda8d" /><path d="M25 2v2m10 8h3M33 4l2-2" /></g><path d="M10 27a7 7 0 0 1-1-14 10 10 0 0 1 19-1 7.5 7.5 0 1 1 2 15Z" fill="#dceaff44" stroke="#e3efff" />
  <path v-if="condition === 'rain'" d="m12 31-2 5m10-5-2 5m10-5-2 5" stroke="#92d2ff" />
  <path v-if="condition === 'storm'" d="m21 22-6 9h7l-5 8" stroke="#ffe899" />
  <g v-if="condition === 'snow'" stroke="#c7e9ff"><path d="M12 31v7m-3-5 6 3m0-3-6 3m17-5v7m-3-5 6 3m0-3-6 3" /></g>
  <path v-if="condition === 'fog'" d="M5 31h30M9 36h22" stroke="#e3efff" /></template>
</svg>
</template>
