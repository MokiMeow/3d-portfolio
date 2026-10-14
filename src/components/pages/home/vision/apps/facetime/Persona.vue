<script setup lang="ts">
import { computed, useId } from 'vue';
import type { PersonaKind } from './contacts';
const props = defineProps<{ kind: PersonaKind; color: string; speaking?: boolean; variant?: number; still?: boolean }>();
const id = 'persona-' + useId().replace(/:/g, '');
const skin = computed(() => props.kind === 'amma' ? '#cda385' : props.kind === 'chai' ? ['#c99773', '#ddb395', '#aa795c'][props.variant ?? 0] : '#d7b7a2');
const hair = computed(() => props.kind === 'amma' ? '#493c40' : props.kind === 'future' ? '#55546d' : '#3b383f');
</script>
<template>
<svg class="persona-art" :class="{ speaking, still }" viewBox="0 0 280 300" fill="none" aria-hidden="true">
  <defs>
    <radialGradient :id="id+'-head'" cx=".32" cy=".24" r=".8"><stop :stop-color="kind==='duck' ? '#fff3a8' : kind==='cat' ? '#eeecf4' : kind==='bot' ? '#c7eeee' : skin"/><stop offset="1" :stop-color="kind==='duck' ? '#dc991f' : kind==='cat' ? '#9595af' : kind==='bot' ? '#568f9b' : '#926b5c'"/></radialGradient>
    <linearGradient :id="id+'-body'" x1="0" y1="0" x2="1" y2="1"><stop :stop-color="color"/><stop offset="1" stop-color="#252d45"/></linearGradient>
    <radialGradient :id="id+'-halo'"><stop :stop-color="color" stop-opacity=".45"/><stop offset="1" :stop-color="color" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="140" cy="159" rx="140" ry="140" :fill="'url(#'+id+'-halo)'"/>
  <ellipse cx="140" cy="276" rx="94" ry="15" fill="#000" opacity=".18"/>
  <g class="breathing">
    <path d="M39 294v-30c0-45 43-70 101-70s101 25 101 70v30" :fill="'url(#'+id+'-body)'"/>
    <path d="M73 267c8-33 30-48 67-48" stroke="#fff" stroke-width="2" opacity=".12"/>
    <g class="head">
      <template v-if="kind==='duck'">
        <path d="M91 94c-4-19 13-22 22-8-3-30 30-33 34-5 19-19 33-5 25 12" fill="#f4c54c"/>
        <ellipse cx="140" cy="141" rx="65" ry="68" :fill="'url(#'+id+'-head)'"/>
        <path d="M104 166q36-13 72 0l-8 21q-28 17-56 0Z" fill="#f3a43b"/>
        <g class="eyes" fill="#343446"><ellipse cx="117" cy="135" rx="6" ry="9"/><ellipse cx="163" cy="135" rx="6" ry="9"/><circle cx="115" cy="132" r="2" fill="#fff"/><circle cx="161" cy="132" r="2" fill="#fff"/></g>
        <ellipse class="mouth" cx="140" cy="178" rx="19" ry="3" fill="#80492d"/>
      </template>
      <template v-else-if="kind==='bot'">
        <path d="M140 67V44" stroke="#98d5d8" stroke-width="5" stroke-linecap="round"/><circle cx="140" cy="42" r="8" fill="#b0ffcd"/>
        <rect x="70" y="77" width="140" height="132" rx="35" :fill="'url(#'+id+'-head)'"/>
        <rect x="83" y="99" width="114" height="87" rx="23" fill="#253d4b"/>
        <g class="eyes" stroke="#9df4de" stroke-width="8" stroke-linecap="round"><path d="M109 121v13m62-13v13"/></g>
        <rect class="mouth" x="119" y="155" width="42" height="5" rx="2.5" fill="#9df4de"/>
        <path d="M58 127v29m164-29v29" stroke="#7facb6" stroke-width="12" stroke-linecap="round"/>
        <circle cx="92" cy="194" r="3" fill="#e7ffff"/><circle cx="188" cy="194" r="3" fill="#e7ffff"/>
      </template>
      <template v-else-if="kind==='cat'">
        <path d="m81 114-1-53 45 31m28 0 46-31-3 56" :fill="'url(#'+id+'-head)'"/>
        <path d="m90 92-1-18 21 18m62 0 17-18-2 21" fill="#e1a9b7"/>
        <ellipse cx="140" cy="143" rx="64" ry="61" :fill="'url(#'+id+'-head)'"/>
        <g class="eyes"><path d="M99 136q15-11 28 0m25 0q15-11 28 0" stroke="#384655" stroke-width="4" stroke-linecap="round"/><ellipse cx="114" cy="138" rx="2" ry="5" fill="#384655"/><ellipse cx="166" cy="138" rx="2" ry="5" fill="#384655"/></g>
        <path d="m134 155 6 6 6-6Z" fill="#b78399"/>
        <path class="mouth" d="M140 161v6m0 0q-6 6-11 0m11 0q6 6 11 0" stroke="#646178" stroke-width="2" stroke-linecap="round"/>
        <path d="m106 165-42-6m43 13-40 7m106-14 42-6m-43 13 40 7" stroke="#e7e7ef" stroke-width="2" stroke-linecap="round"/>
      </template>
      <template v-else>
        <path v-if="kind==='amma'" d="M75 115C56 62 118 47 148 68c56-9 76 38 50 78l-115 5Z" :fill="hair"/>
        <ellipse cx="86" cy="147" rx="11" ry="17" :fill="skin"/><ellipse cx="194" cy="147" rx="11" ry="17" :fill="skin"/>
        <rect x="122" y="188" width="36" height="37" rx="15" :fill="skin"/>
        <path d="M89 107c0-44 101-47 102 0v45c0 41-26 63-51 63s-51-22-51-63Z" :fill="'url(#'+id+'-head)'"/>
        <path :d="kind==='amma' ? 'M83 113C81 68 123 68 139 80c18-12 61 1 57 32-29-7-41-14-48-28-10 20-36 25-65 29Z' : 'M83 116C77 56 181 48 199 101l-8 23-15-26-38-7-44 28Z'" :fill="hair"/>
        <g class="eyes" fill="#393343"><ellipse cx="115" cy="142" rx="4" ry="5"/><ellipse cx="165" cy="142" rx="4" ry="5"/></g>
        <path d="M107 128q9-4 17-1m33 0q9-3 17 1M139 142l-5 18h10" stroke="#6d5149" stroke-width="2.2" stroke-linecap="round" opacity=".65"/>
        <ellipse cx="104" cy="161" rx="11" ry="5" fill="#d88983" opacity=".4"/><ellipse cx="176" cy="161" rx="11" ry="5" fill="#d88983" opacity=".4"/>
        <ellipse class="mouth" cx="140" cy="179" rx="13" ry="3" fill="#8a4c4e"/>
        <path v-if="kind==='amma'" d="M96 170v16m88-16v16" stroke="#e7bc6c" stroke-width="4" stroke-linecap="round"/><circle v-if="kind==='amma'" cx="140" cy="119" r="3" fill="#b44d5d"/>
        <g v-if="kind==='future'" stroke="#a6dcfa" stroke-width="2.2"><rect x="100" y="132" width="29" height="22" rx="7"/><rect x="151" y="132" width="29" height="22" rx="7"/><path d="M129 141h22"/></g>
        <path v-if="kind==='amma'" d="m85 224 39 49 26-53" fill="#d4a658" opacity=".55"/>
      </template>
    </g>
  </g>
</svg>
</template>
<style scoped>
.persona-art {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.breathing {
  transform-origin: 140px 250px;
  animation: persona-breathe 4.5s ease-in-out infinite;
}
.head {
  transform-origin: 140px 195px;
  animation: persona-tilt 8s ease-in-out infinite;
}
.eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: persona-blink 5.7s infinite;
}
.mouth {
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .2s;
}
.speaking .mouth {
  animation: persona-speak .24s ease-in-out infinite alternate;
}
.still * {
  animation: none!important;
}
.still .mouth {
  transform: none;
}
@keyframes persona-breathe {
  50% {
    transform: translateY(-3px) scale(1.012);
  }
}
@keyframes persona-tilt {
  30% {
    transform: rotate(-3deg);
  }
  65% {
    transform: rotate(2deg);
  }
}
@keyframes persona-blink {
  0%,43%,47%,100% {
    transform: scaleY(1);
  }
  45% {
    transform: scaleY(.08);
  }
}
@keyframes persona-speak {
  to {
    transform: scaleY(3.1) scaleX(.92);
  }
}
@media(prefers-reduced-motion:reduce) {
  .persona-art * {
    animation: none!important;
    transition: none!important;
  }
}
</style>
