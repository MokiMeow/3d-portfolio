
<script setup lang="ts">
const artId = useId();
defineProps<{
    capturing?: boolean;
    step?: number;
    glasses?: boolean;
}>();
</script>

<template>
<svg class="persona" :class="{ capturing }" viewBox="0 0 220 230" role="img" aria-label="Drawn practice Persona, not a camera capture">
<defs>
<radialGradient :id="artId + '-settings-face'">
<stop stop-color="#d7b59f"/>
<stop offset="1" stop-color="#967d82"/>
</radialGradient>
<linearGradient :id="artId + '-settings-fade'" x2="0" y2="1">
<stop stop-color="white"/>
<stop offset=".7" stop-color="white"/>
<stop offset="1" stop-color="black"/>
</linearGradient>
<mask :id="artId + '-settings-mask'">
<rect width="220" height="230" :fill="'url(#' + artId + '-settings-fade)'"/>
</mask>
</defs>
<g :mask="'url(#' + artId + '-settings-mask)'">
<path d="M32 230q2-57 49-65h58q47 8 49 65" fill="#869ca9" opacity=".65"/>
<path d="M92 145v26q18 20 36 0v-26" fill="#b2998e"/>
<ellipse cx="110" cy="101" rx="48" ry="64" :fill="'url(#' + artId + '-settings-face)'"/>
<path d="M64 82q-14-58 44-58 63-1 48 65l-11-35q-34 21-65 7Z" fill="#414550"/>
<path d="M78 87q11-7 23-1m18 0q12-7 23 1" fill="none" stroke="#554c51" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="89" cy="100" rx="5" :ry="step === 2 ? 1 : 4" fill="#394049"/>
<ellipse cx="131" cy="100" rx="5" :ry="step === 2 ? 1 : 4" fill="#394049"/>
<path d="m110 103-5 17h11" fill="none" stroke="#957777" stroke-width="2" stroke-linecap="round"/>
<path :d="step === 3 ? 'M93 135q17 18 34 0' : 'M98 137q12 6 24 0'" fill="none" stroke="#7a5960" stroke-width="3" stroke-linecap="round"/>
<g v-if="glasses" fill="none" stroke="#d0d6dd" stroke-width="3">
<rect x="72" y="89" width="33" height="23" rx="7"/>
<rect x="115" y="89" width="33" height="23" rx="7"/>
<path d="M105 96h10"/>
</g>
</g>
<path v-if="capturing" class="scan" d="M45 100h130" stroke="#aee1ed" stroke-width="2"/>
</svg>
</template>

<style scoped>
.persona {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
}
.persona :deep(*) {
  font-family: inherit;
}
.persona {
  width: min(220px,65%);
  height: auto;
  filter: drop-shadow(0 0 20px rgb(175 219 234 / .1))
}
.scan {
  animation: scan 2s ease-in-out infinite
}
@keyframes scan {
  0%,100% {
    transform: translateY(-45px);
    opacity: .4
  }
  50% {
    transform: translateY(45px);
    opacity: 1
  }
}
@media(prefers-reduced-motion:reduce) {
  .scan {
    animation: none
  }
}
</style>
