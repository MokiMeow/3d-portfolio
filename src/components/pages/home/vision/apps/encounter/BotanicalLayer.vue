<script setup lang="ts">
defineProps<{ lagoon: boolean }>();
const uid = 'botany-' + useId().replace(/[^a-zA-Z0-9]/g, '');
const fronds = [{ x: 34, y: 586, rotate: -23, scale: 1.1 }, { x: 152, y: 604, rotate: 18, scale: .82 }, { x: 902, y: 604, rotate: 27, scale: 1.15 }, { x: 974, y: 602, rotate: -18, scale: .9 }];
</script>
<template>
  <svg class="botanical-art" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient :id="uid + '-leaf'" x1="0" x2="1" y2="1"><stop stop-color="#afbe7f"/><stop offset=".4" stop-color="#536f42"/><stop offset="1" stop-color="#102f29"/></linearGradient>
      <linearGradient :id="uid + '-light'" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#f8eac0" stop-opacity=".25"/><stop offset="1" stop-color="#f8eac0" stop-opacity="0"/></linearGradient>
      <radialGradient :id="uid + '-shade'"><stop offset=".45" stop-color="#031b13" stop-opacity="0"/><stop offset="1" stop-color="#031b13" stop-opacity=".6"/></radialGradient>
    </defs>
    <path d="M580 0 94 600H382L695 0ZM686 0 480 600H590L729 0Z" :fill="'url(#' + uid + '-light)'"/>
    <g fill="#112f2a" opacity=".7"><path d="M0 0h285c-17 38-49 35-57 62-28-8-65 26-95 10-32 31-71 1-99 40L0 100ZM1000 0H845c-15 29 8 50 30 54 17 28 59 11 75 40l50-8Z"/></g>
    <g fill="#9ab18a" opacity=".22"><path d="M223 37q-33 64-74 57 2-54 74-57Zm-69 15q-31 47-63 39 8-37 63-39Zm773-30q-24 44-58 36 1-33 58-36Z"/></g>
    <g fill="#305444"><path d="M0 552q78-91 113-17 33-56 82-20 21-19 47 33 147-40 262 27 201-62 330-13 66-40 102-7 31-49 64-36v81H0Z"/></g>
    <g v-for="(fern, index) in fronds" :key="index" :transform="'translate(' + fern.x + ' ' + fern.y + ') rotate(' + fern.rotate + ') scale(' + fern.scale + ')'">
      <path d="M0 0Q-12-149 36-283" fill="none" stroke="#79965f" stroke-width="3"/>
      <g v-for="leaf in 10" :key="leaf" :transform="'translate(' + (leaf * 2.5 - 12) + ' ' + (-leaf * 25) + ')'" :fill="'url(#' + uid + '-leaf)'">
        <path :d="'M0 0Q' + (-87 + leaf * 5) + ' -4 ' + (-102 + leaf * 6) + ' -35Q-25-36 0 0Z'"/>
        <path :d="'M0 0Q' + (88 - leaf * 5) + ' -10 ' + (104 - leaf * 6) + ' -48Q24-39 0 0Z'"/>
        <path d="M-42-19 0 0 44-26" stroke="#bdce91" stroke-opacity=".2" stroke-width="1" fill="none"/>
      </g>
    </g>
    <g fill="#111f20" opacity=".65"><path d="M430 162q14-16 24-6 10-15 22-15-8 15-19 17l-3 6-4-4q-9-2-20 2Zm79-48q9-10 16-5 8-10 15-10-5 10-13 12l-3 4-3-3q-5-1-12 2Z"/></g>
    <g v-if="lagoon" fill="none" stroke="#b7d8c8" stroke-width="1.5" opacity=".22"><ellipse cx="694" cy="496" rx="66" ry="5"/><ellipse cx="694" cy="496" rx="38" ry="3"/><path d="M244 475h116m342 62h91m-232 27h66"/></g>
    <g transform="translate(247 566)"><path d="M0 25 2 3m20 26-2-14" stroke="#dbca9f" stroke-width="4"/><path d="M-12 6q12-28 25 0Zm22 11q11-22 22 0Z" fill="#bf865b"/><g fill="#edcbaa"><circle cx="-3" cy="1" r="2"/><circle cx="7" cy="2" r="1.5"/><circle cx="21" cy="13" r="1.5"/></g></g>
    <rect width="1000" height="600" :fill="'url(#' + uid + '-shade)'"/>
  </svg>
</template>
<style scoped>
.botanical-art { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; transform:translate(calc(var(--px, 0) * -8px),calc(var(--py, 0) * -4px)); }
@media(prefers-reduced-motion:reduce) { .botanical-art { transform:none; } }
</style>
