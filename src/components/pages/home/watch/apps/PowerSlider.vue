<script setup lang="ts">
import WatchGlyph from '../WatchGlyph.vue';
const props = defineProps<{ label: string; glyph: 'power' | 'heart' | 'phone'; tone: string }>();
const emit = defineEmits<{ complete: [] }>();
const value = ref(0);
const dragging = ref(false);
let origin = 0;
let travel = 1;
function down(event: PointerEvent) {
  if (event.button !== 0) return;
  const knob = event.currentTarget as HTMLElement;
  const track = knob.parentElement!;
  origin = event.clientX;
  travel = Math.max(1, track.getBoundingClientRect().width * (1 - 76 / track.offsetWidth));
  dragging.value = true;
  knob.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (dragging.value) value.value = Math.max(0, Math.min(100, (event.clientX - origin) / travel * 100));
}
function release(event?: PointerEvent, cancel = false) {
  if (event && !dragging.value) return;
  dragging.value = false;
  const complete = !cancel && value.value >= 96;
  value.value = 0;
  if (event) { const knob = event.currentTarget as HTMLElement; if (knob.hasPointerCapture(event.pointerId)) knob.releasePointerCapture(event.pointerId); }
  if (complete) emit('complete');
}
function keyboard(event: KeyboardEvent) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault(); event.stopPropagation();
  value.value = event.key === 'Home' ? 0 : event.key === 'End' ? 100 : Math.max(0, Math.min(100, value.value + (event.key === 'ArrowRight' ? 10 : -10)));
  if (value.value >= 96) release();
}
</script>
<template>
  <div class="slide-track" :style="{ '--slider-tone': tone }">
    <span class="slide-label">{{ label }}</span>
    <button class="slide-knob" :class="{ dragging }" :style="{ left: 'calc(6px + (100% - 76px) * ' + value / 100 + ')' }" role="slider" tabindex="0" :aria-label="'Slide to ' + label" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(value)" :aria-valuetext="Math.round(value) + '%; drag right to activate'" @pointerdown.prevent="down" @pointermove="move" @pointerup="release($event)" @pointercancel="release($event, true)" @keydown="keyboard"><WatchGlyph :name="glyph" /></button>
  </div>
</template>
<style scoped>
.slide-track { position:relative; height:76px; width:100%; border-radius:38px; background:#2c2c2e; margin:14px 0; overflow:hidden; }
.slide-label { position:absolute; inset:0 20px 0 84px; display:flex; align-items:center; justify-content:center; color:var(--slider-tone); font-size:24px; font-weight:600; line-height:1.25; pointer-events:none; }
.slide-knob { position:absolute; top:6px; width:64px; height:64px; min-height:64px !important; border:0; border-radius:50%; display:grid; place-items:center; color:#000; background:var(--slider-tone); touch-action:none; transition:left 160ms ease; }
.slide-knob.dragging { transition:none; }
.slide-knob :deep(svg) { width:32px; height:32px; }
.slide-knob:focus-visible { outline:3px solid white; outline-offset:-5px; }
@media (prefers-reduced-motion:reduce) { .slide-knob { transition:none; } }
</style>