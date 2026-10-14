<script setup lang="ts">
import { vHover } from '../../kit/hover';
import PhotoArt from './PhotoArt.vue';
const props = defineProps<{ src?: string; fallbackSrc?: string; kind?: string; title: string; reduced: boolean }>();
const surface = ref<HTMLElement>();
let offset = { x: 0, y: 0 };
function setOffset(x: number, y: number): void {
  offset = props.reduced ? {x:0,y:0} : {x:Math.max(-.5,Math.min(.5,x)),y:Math.max(-.5,Math.min(.5,y))};
  surface.value?.style.setProperty('--scene-x', String(offset.x));
  surface.value?.style.setProperty('--scene-y', String(offset.y));
}
const missing = ref(false);
const useFallback = ref(false);
const imageSource = computed(() => useFallback.value ? props.fallbackSrc : props.src);
function imageFailed(): void {
  if (!useFallback.value && props.fallbackSrc && props.fallbackSrc !== props.src) useFallback.value = true;
  else missing.value = true;
}
watch(() => props.src, () => { missing.value = false; useFallback.value = false; });
watch(() => props.reduced, value => { if (value) setOffset(0,0); });
function move(event: PointerEvent): void {
  if (props.reduced) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  setOffset((event.clientX - box.left) / Math.max(box.width, 1) - .5, (event.clientY - box.top) / Math.max(box.height, 1) - .5);
}
function layer(depth: number): Record<string, string> {
  return { '--depth': String(depth) };
}
</script>
<template>
  <div ref="surface" v-hover class="portal" tabindex="0" role="img" :aria-label="title + ', simulated spatial depth'"
    @pointermove="move" @pointerleave="setOffset(0,0)" @blur="setOffset(0,0)"
    @keydown.left.prevent="setOffset(-.5,offset.y)" @keydown.right.prevent="setOffset(.5,offset.y)"
    @keydown.up.prevent="setOffset(offset.x,-.5)" @keydown.down.prevent="setOffset(offset.x,.5)">
    <div class="layer distant" :style="layer(12)">
      <img v-if="imageSource && !missing" :src="imageSource" :alt="title" draggable="false" @error="imageFailed" />
      <PhotoArt v-else :kind="kind ?? 'desk'" :title="title" />
    </div>
    <svg class="layer middle" :style="layer(28)" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M-20 420q160-65 330-8t250-12 260 20v100H-20z" fill="#9ea9a8" opacity=".2" />
      <path d="M-20 450q160-20 320 10t250-10 260 20" fill="none" stroke="#d3dfdb" stroke-width="4" opacity=".25" />
    </svg>
    <svg class="layer foreground" :style="layer(60)" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <ellipse cx="400" cy="250" rx="385" ry="235" fill="none" stroke="#c1e5df" stroke-width="1.8" opacity=".2" />
      <path d="M30 370v75h75m590 0h75v-75M30 130V55h75m590 0h75v75" fill="none" stroke="#e9fff9" stroke-width="1.8" opacity=".3" />
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

.portal { --scene-x:0; --scene-y:0; background:radial-gradient(ellipse,#88b5b519,transparent); }
.layer { transform:translate3d(calc(var(--scene-x) * var(--depth) * 1px),calc(var(--scene-y) * var(--depth) * 1px),0) scale(1.12); }
.middle { opacity:.45; }
.foreground { opacity:.65; }
.depth-label { font-size:9px; letter-spacing:.15em; top:18px; }
@media(prefers-reduced-motion:reduce) { .layer { transform:none !important; } }

</style>
