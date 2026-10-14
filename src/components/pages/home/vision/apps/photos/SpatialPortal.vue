<script setup lang="ts">
import { vHover } from '../../kit/hover';
import PhotoArt from './PhotoArt.vue';
const props = defineProps<{ src?: string; fallbackSrc?: string; kind?: string; title: string; reduced: boolean }>();
const offset = ref({ x: 0, y: 0 });
const missing = ref(false);
const useFallback = ref(false);
const imageSource = computed(() => useFallback.value ? props.fallbackSrc : props.src);
function imageFailed(): void {
  if (!useFallback.value && props.fallbackSrc && props.fallbackSrc !== props.src) useFallback.value = true;
  else missing.value = true;
}
watch(() => props.src, () => { missing.value = false; useFallback.value = false; });
watch(() => props.reduced, value => { if (value) offset.value = { x: 0, y: 0 }; });
function move(event: PointerEvent): void {
  if (props.reduced) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  offset.value = { x: (event.clientX - box.left) / Math.max(box.width, 1) - .5, y: (event.clientY - box.top) / Math.max(box.height, 1) - .5 };
}
function layer(depth: number): Record<string, string> {
  return { transform: 'translate3d(' + offset.value.x * depth + 'px,' + offset.value.y * depth + 'px,0) scale(1.12)' };
}
</script>
<template>
  <div v-hover class="portal" tabindex="0" role="img" :aria-label="title + ', simulated spatial depth'"
    @pointermove="move" @pointerleave="offset = { x: 0, y: 0 }" @blur="offset = { x: 0, y: 0 }"
    @keydown.left.prevent="offset.x = -.5" @keydown.right.prevent="offset.x = .5"
    @keydown.up.prevent="offset.y = -.5" @keydown.down.prevent="offset.y = .5">
    <div class="layer distant" :style="layer(12)">
      <img v-if="imageSource && !missing" :src="imageSource" :alt="title" draggable="false" @error="imageFailed" />
      <PhotoArt v-else :kind="kind ?? 'desk'" :title="title" />
    </div>
    <svg class="layer middle" :style="layer(28)" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-20 420q160-65 330-8t250-12 260 20v100H-20z" fill="#9ea9a8" opacity=".2" />
      <path d="M-20 450q160-20 320 10t250-10 260 20" fill="none" stroke="#d3dfdb" stroke-width="4" opacity=".25" />
    </svg>
    <svg class="layer foreground" :style="layer(60)" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M0 500V315l22 42 9-85 25 130 24-72 12 170m708 0V305l-25 61-14-114-28 157-21-58-8 149" fill="#172b2a" opacity=".92" />
      <path d="M0 487q170-29 260 13m540-13q-170-29-260 13" fill="none" stroke="#203c36" stroke-width="36" />
    </svg>
    <span class="depth-label">SIMULATED SPATIAL SCENE</span>
  </div>
</template>
<style scoped>
.portal {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 32px;
  mask-image: radial-gradient(ellipse, #000 56%, rgb(0 0 0 / .85) 76%, transparent 99%);
  background: rgb(0 0 0 / .15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.portal :deep(*) {
  font-family: inherit;
}
.portal:focus-visible {
  outline: 3px solid white;
  outline-offset: -15px;
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transition: transform .24s ease-out;
}
.distant img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.depth-label {
  position: absolute;
  left: 50%;
  top: 24px;
  transform: translateX(-50%);
  padding: 7px 14px;
  border-radius: 20px;
  background: rgb(0 0 0 / .35);
  font-size: 12px;
  letter-spacing: .1em;
  max-width: calc(100% - 24px);
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .layer {
    transition: none;
    transform: none !important;
  }
}
</style>
