<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps<{ time: number; offset: number; hero?: boolean; daylight?: boolean }>();
const id = 'dial-' + getCurrentInstance()!.uid;
const date = computed(() => new Date(props.time + props.offset * 60000));
const seconds = computed(() => date.value.getUTCSeconds() + date.value.getUTCMilliseconds() / 1000);
const minutes = computed(() => date.value.getUTCMinutes() + seconds.value / 60);
const hours = computed(() => date.value.getUTCHours() + minutes.value / 60);
const day = computed(() => props.daylight ?? (hours.value >= 6 && hours.value < 18));
const phase = ref(seconds.value), revision = ref(0), hidden = ref(false);
let previous = props.time;
watch(() => props.time, value => { if (Math.abs(value - previous) > 2500) { phase.value = seconds.value; revision.value++; } previous = value; });
function visibility(): void { hidden.value = document.hidden; if (!hidden.value) { phase.value = seconds.value; revision.value++; } }
onMounted(() => { visibility(); document.addEventListener('visibilitychange', visibility); });
onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility));
</script>
<template>
<svg class="clock-face" :class="{ day, hero, hidden }" viewBox="0 0 240 240" aria-hidden="true">
  <defs><radialGradient :id="id"><stop stop-color="var(--dial-centre)"/><stop offset="1" stop-color="var(--dial-edge)"/></radialGradient><linearGradient :id="id+'-rim'" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient></defs>
  <circle cx="120" cy="120" r="117" class="bezel" :stroke="'url(#'+id+'-rim)'"/><circle cx="120" cy="120" r="111" :fill="'url(#'+id+')'"/><circle cx="120" cy="120" r="106" fill="none" stroke="currentColor" opacity=".07"/>
  <g v-for="i in 60" :key="i" :transform="'rotate('+i*6+' 120 120)'" stroke="currentColor" :opacity="i%5 ? .3 : .85" :stroke-width="i%5 ? .9 : 2.8"><path :d="i%5 ? 'M120 17v4' : 'M120 17v11'"/></g>
  <g class="numerals"><text v-for="i in 12" :key="i" :x="120+78*Math.sin(i*Math.PI/6)" :y="126-78*Math.cos(i*Math.PI/6)">{{ i }}</text></g>
  <text x="120" y="81" class="signature">LOCAL TIME</text><text x="120" y="164" class="signature">{{ day ? 'DAYLIGHT' : 'AFTER HOURS' }}</text>
  <rect x="149" y="111" width="23" height="18" rx="4" class="date-window"/><text x="160.5" y="124" class="date-text">{{ date.getUTCDate() }}</text>
  <g class="hands" stroke="currentColor" stroke-linecap="round"><path d="M120 132V70" :transform="'rotate('+hours*30+' 120 120)'" stroke-width="6"/><path d="M120 135V36" :transform="'rotate('+minutes*6+' 120 120)'" stroke-width="3.5"/></g>
  <g :key="revision" class="sweeping" :style="{ animationDelay: -phase+'s', '--static-angle': seconds*6+'deg' }"><path d="M120 140V29" stroke="#ffad66" stroke-width="1.8"/><circle cx="120" cy="34" r="3.2" fill="#ffad66"/></g>
  <circle cx="120" cy="120" r="6" fill="#ffad66"/><circle cx="120" cy="120" r="2" fill="#fff4de"/>
</svg>
</template>
<style scoped>
.clock-face { --dial-centre:#23364b; --dial-edge:#101b2a; display:block;width:100%;aspect-ratio:1;color:#ecf2f8;filter:drop-shadow(0 10px 14px #0004); }
.clock-face.day { --dial-centre:#fffdf7;--dial-edge:#dddcd5;color:#26313a; }
.bezel { fill:#ffffff10;stroke-width:1.2; }.numerals { fill:currentColor;font:500 19px -apple-system,BlinkMacSystemFont,sans-serif;text-anchor:middle; }.signature { fill:currentColor;opacity:.4;font:5px -apple-system,BlinkMacSystemFont,sans-serif;text-anchor:middle;letter-spacing:1.4px; }.date-window { fill:currentColor;opacity:.07; }.date-text { fill:currentColor;font:10px -apple-system,BlinkMacSystemFont,sans-serif;text-anchor:middle; }.hands { filter:drop-shadow(1px 3px 1px #0003); }.sweeping { transform-origin:120px 120px;animation:sweep 60s linear infinite; }.hidden .sweeping { animation-play-state:paused; }@keyframes sweep { to { transform:rotate(360deg); } }@media(prefers-reduced-motion:reduce) { .sweeping { animation:none;transform:rotate(var(--static-angle)); } }
</style>
