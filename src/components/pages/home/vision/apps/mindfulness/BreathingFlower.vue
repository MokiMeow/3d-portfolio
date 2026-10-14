<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ bloom: number; progress: number; running: boolean; paused: boolean; particles: boolean; reflect: boolean }>();
const flowerStyle = computed(() => ({ '--bloom': props.bloom, '--rotation': (-13 + props.bloom * 26) + 'deg' }));
</script>

<template>
  <div class="garden" :class="{ running, paused, reflection: reflect }" :style="flowerStyle" aria-hidden="true">
    <div class="light-field"><i /><i /><i /></div>
    <svg class="progress" viewBox="0 0 300 300">
      <circle class="track" cx="150" cy="150" r="139" />
      <circle class="fill" cx="150" cy="150" r="139" pathLength="100" stroke-dasharray="100" :stroke-dashoffset="100 * (1 - progress)" />
    </svg>
    <div v-if="particles" class="particles">
      <i v-for="dot in 14" :key="dot" :style="{ '--i': dot, '--x': (dot * 37 % 100) + '%', '--y': (dot * 53 % 100) + '%' }" />
    </div>
    <div class="flower">
      <div v-for="petal in 18" :key="petal" class="petal" :class="{ inner: petal > 12 }"
        :style="{ '--angle': ((petal - 1) * (petal > 12 ? 60 : 30) + (petal > 12 ? 15 : 0)) + 'deg', '--hue': 155 + petal * 2.6 }" />
      <div class="heart" /><div class="heart core" />
    </div>
  </div>
</template>

<style scoped>
.garden {
  position: relative; display: grid; place-items: center; width: min(100%, 330px); aspect-ratio: 1;
  flex: none; isolation: isolate;
}
.garden { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; }
.garden :deep(*) { font-family: inherit; }
.light-field { position: absolute; inset: -15%; z-index: -1; opacity: .8; pointer-events: none; }
.light-field i { position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(ellipse, rgb(119 225 198 / .18), transparent 66%); }
.light-field i:nth-child(2) { inset: 15% -8% -8% 30%; background: radial-gradient(ellipse, rgb(143 204 248 / .17), transparent 70%); }
.light-field i:nth-child(3) { inset: 36% 28% -12% -20%; background: radial-gradient(ellipse, rgb(133 245 203 / .14), transparent 70%); }
.reflection .light-field i { animation: colour-drift 24s ease-in-out infinite alternate; }
.reflection .light-field i:nth-child(2) { animation-delay: -8s; background: radial-gradient(ellipse, rgb(241 187 192 / .25), transparent 68%); }
.reflection .light-field i:nth-child(3) { animation-delay: -16s; }
.flower { position: absolute; inset: 21%; transform: rotate(var(--rotation)); transition: transform 200ms linear; }
.petal {
  position: absolute; width: 52%; height: 88%; bottom: 50%; left: 24%; transform-origin: 50% 100%;
  border-radius: 70% 70% 50% 50%;
  transform: rotate(var(--angle)) translateY(calc(var(--bloom) * -9px))
    scale(calc(.42 + var(--bloom) * .62), calc(.53 + var(--bloom) * .6));
  background: linear-gradient(155deg, hsl(var(--hue) 62% 85% / .65), hsl(var(--hue) 54% 64% / .13) 65%, rgb(102 195 176 / .03));
  border: 1px solid rgb(217 255 241 / .24); box-shadow: inset 0 2px 12px rgb(226 255 249 / .16);
  mix-blend-mode: screen; transition: transform 200ms linear;
}
.petal.inner { width: 40%; height: 65%; left: 30%; opacity: .78; }
.heart { position: absolute; inset: 35%; border-radius: 50%; background: radial-gradient(circle, rgb(234 255 248 / .65), rgb(158 255 219 / .04) 72%); }
.core { inset: 43%; background: rgb(232 255 244 / .6); filter: blur(8px); }
.progress { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.track, .fill { fill: none; stroke-width: 1.2; }
.track { stroke: rgb(220 255 241 / .1); }
.fill { stroke: rgb(207 255 234 / .78); stroke-linecap: round; }
.particles { position: absolute; inset: -10%; pointer-events: none; }
.particles i { position: absolute; left: var(--x); top: var(--y); width: 3px; height: 3px; border-radius: 50%; background: #d5fff0; opacity: .28; }
.running .particles i { animation: float-mote 12s ease-in-out infinite alternate; animation-delay: calc(var(--i) * -.7s); }
.paused .particles i, .paused .light-field i { animation-play-state: paused; }
@keyframes float-mote { to { transform: translate(8px, -18px); opacity: .6; } }
@keyframes colour-drift { to { transform: translate(15px, -12px) scale(1.16); opacity: .48; } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .flower { transform: rotate(0); }
  .petal { transform: rotate(var(--angle)) scale(.85); }
}
</style>
