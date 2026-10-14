<script setup lang="ts">
import { computed } from 'vue';
import { vHover } from '../../kit/hover';
const props = withDefaults(defineProps<{ modelValue: number; min: number; max: number; step?: number; label: string; display?: string; color?: string }>(), { step: 1, color: '#edbd87', display: '' });
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const fraction = computed(() => (props.modelValue - props.min) / (props.max - props.min));
let drag: { y: number; value: number; id: number } | undefined;
function set(value: number) { emit('update:modelValue', Math.max(props.min, Math.min(props.max, Math.round(value / props.step) * props.step))); }
function down(event: PointerEvent) { if (event.button !== 0) return; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); drag = { y: event.clientY, value: props.modelValue, id: event.pointerId }; }
function move(event: PointerEvent) { if (drag?.id === event.pointerId) set(drag.value + (drag.y - event.clientY) * (props.max - props.min) / (event.shiftKey ? 900 : 180)); }
function key(event: KeyboardEvent) {
  if (!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Home','End'].includes(event.key)) return;
  event.preventDefault();
  set(event.key === 'Home' ? props.min : event.key === 'End' ? props.max : props.modelValue + (event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : -1) * props.step * (event.shiftKey ? 10 : 1));
}
</script>
<template>
  <div class="knob-wrap" :style="{ '--knob-color': color }">
    <div v-hover class="knob" role="slider" tabindex="0" :aria-label="label" :aria-valuemin="min" :aria-valuemax="max" :aria-valuenow="modelValue" :aria-valuetext="display || String(modelValue)" :title="label + ': drag vertically, or use arrow keys'" @pointerdown.prevent="down" @pointermove="move" @pointerup="drag = undefined" @pointercancel="drag = undefined" @lostpointercapture="drag = undefined" @keydown="key">
      <svg viewBox="0 0 72 72" aria-hidden="true"><circle class="rail" cx="36" cy="36" r="30" pathLength="100" /><circle class="arc" cx="36" cy="36" r="30" pathLength="100" :stroke-dasharray="(fraction * 75) + ' 100'" /></svg>
      <span class="cap"><i :style="{ transform: 'rotate(' + (-135 + fraction * 270) + 'deg)' }" /></span>
    </div>
    <span class="knob-label">{{ label }}</span><strong class="knob-value">{{ display || modelValue }}</strong>
  </div>
</template>
<style scoped>
.knob-wrap{display:grid;justify-items:center;gap:3px;min-width:0;--knob-color:#edbd87}.knob{position:relative;width:64px;height:64px;border-radius:50%;cursor:ns-resize;touch-action:none;outline-offset:3px}.knob svg{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke-width:2.6;transform:rotate(135deg);stroke-linecap:round}.rail{stroke:rgb(255 255 255 / .12);stroke-dasharray:75 100}.arc{stroke:var(--knob-color)}.cap{position:absolute;inset:11px;border-radius:50%;background:radial-gradient(ellipse at 40% 15%,#64666b,#393c40 55%,#25282c);box-shadow:inset 0 1px 1px #ffffff65,inset 0 -2px 3px #0008,0 5px 8px #0006;display:grid;place-items:center}.cap i{position:absolute;inset:5px;display:block}.cap i:before{content:'';position:absolute;width:3px;height:10px;left:calc(50% - 1.5px);top:0;background:var(--knob-color);border-radius:2px;box-shadow:0 0 5px color-mix(in srgb,var(--knob-color) 35%,transparent)}.knob-label{font-size:11px;font-weight:600;color:rgb(255 255 255 / .62)}.knob-value{font:500 11px ui-monospace,SFMono-Regular,monospace;color:rgb(255 255 255 / .9);font-variant-numeric:tabular-nums}.knob:focus-visible{outline:2px solid white}
</style>
