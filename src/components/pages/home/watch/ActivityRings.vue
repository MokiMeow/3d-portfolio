<script setup lang="ts">
import { useWatch } from './watch';
const props = withDefaults(defineProps<{
    move?: number;
    exercise?: number;
    stand?: number;
    size?: number;
    celebrate?: boolean;
}>(), {
    move: .6, exercise: .7, stand: .75, size: 300, celebrate: false
});
const watch = useWatch();
const motion = computed(() => !watch.dimmed.value && !watch.reducedMotion.value);
const rings = computed(() => [
    {
        ratio: Math.max(0, props.move), radius: 145, color: '#FA114F', symbol: 'M-6-5 0 0-6 5M-7 0H7'
    },
    {
        ratio: Math.max(0, props.exercise), radius: 113, color: '#A6FF00', symbol: 'M-7-5-2 0-7 5M0-5 5 0 0 5'
    },
    {
        ratio: Math.max(0, props.stand), radius: 81, color: '#00E0D6', symbol: 'M-5-1 0-6 5-1M0-6V7'
    },
].map(r => ({
    ...r, length: 2 * Math.PI * r.radius, angle: (r.ratio % 1) * Math.PI * 2 - Math.PI / 2
})));
</script>

<template>
  <div
    class="activity-rings"
    :class="{ animated: motion }"
    :style="{ width: size + 'px', height: size + 'px' }"
    role="img"
    :aria-label="'Move ' + Math.round(move * 100) + ' percent, Exercise ' + Math.round(exercise * 100) + ' percent, Stand ' + Math.round(stand * 100) + ' percent'"
  >
    <svg viewBox="0 0 320 320" aria-hidden="true">
      <g v-for="ring in rings" :key="ring.radius">
        <circle
          cx="160"
          cy="160"
          :r="ring.radius"
          :stroke="ring.color"
          opacity=".19"
          stroke-width="25"
          fill="none"
        />
        <circle
          class="progress"
          cx="160"
          cy="160"
          :r="ring.radius"
          :stroke="ring.color"
          stroke-width="25"
          stroke-linecap="round"
          fill="none"
          :stroke-dasharray="ring.length"
          :stroke-dashoffset="ring.length * (1 - Math.min(1, ring.ratio))"
          transform="rotate(-90 160 160)"
        />
        <circle
          v-if="ring.ratio > 1"
          class="overflow-cap"
          :cx="160 + Math.cos(ring.angle) * ring.radius"
          :cy="160 + Math.sin(ring.angle) * ring.radius"
          r="12.5"
          :fill="ring.color"
        />
        <path
          :d="ring.symbol"
          :transform="'translate(160 ' + (160 - ring.radius) + ')'"
          fill="none"
          stroke="#000"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <g v-if="celebrate && motion" class="fireworks">
        <line
          v-for="n in 24"
          :key="n"
          x1="160"
          y1="148"
          x2="160"
          y2="128"
          :transform="'rotate(' + n * 15 + ' 160 160)'"
          :stroke="['#FA114F', '#A6FF00', '#00E0D6'][n % 3]"
          stroke-width="5"
          stroke-linecap="round"
          :style="{ animationDelay: (n % 4) * 70 + 'ms' }"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.activity-rings {
  position: relative;
  flex-shrink: 0;
  max-width: 100%;
  margin: auto;
}

.activity-rings svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.animated .progress {
  transition: opacity 260ms ease;
}

.overflow-cap {
  filter: drop-shadow(0 3px 3px #000a);
}

.fireworks line {
  transform-box: fill-box;
  transform-origin: center;
  animation: spark 1.3s ease-out both;
}

@keyframes spark {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }

  25% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0;
    stroke-dasharray: 0 50;
  }
}

.activity-rings {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.activity-rings :deep(*) {
  font-family: inherit;
}
</style>
