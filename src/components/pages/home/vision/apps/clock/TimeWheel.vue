<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { pad } from './model';
const props = defineProps<{ modelValue: number; count: number; label: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
const wheel = ref<HTMLElement>();
let settling: ReturnType<typeof setTimeout> | undefined;
function align(): void { if (wheel.value) wheel.value.scrollTop = props.modelValue * 48; }
function scroll(): void { clearTimeout(settling); settling = setTimeout(() => { if (wheel.value) emit('update:modelValue', Math.max(0, Math.min(props.count - 1, Math.round(wheel.value.scrollTop / 48)))); }, 90); }
function key(event: KeyboardEvent): void { if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return; event.preventDefault(); emit('update:modelValue', event.key==='Home'?0:event.key==='End'?props.count-1:Math.max(0,Math.min(props.count-1,props.modelValue+(event.key==='ArrowDown'?1:-1)))); }
watch(() => props.modelValue, () => nextTick(align));
onMounted(align);
// The pending callback cannot emit after the picker disappears.
import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => clearTimeout(settling));
</script>
<template><div class="wheel-wrap"><span>{{ label }}</span><div class="wheel-selection" aria-hidden="true"/><div ref="wheel" class="time-wheel vk-scroll" role="spinbutton" tabindex="0" :aria-label="label" :aria-valuenow="modelValue" :aria-valuemin="0" :aria-valuemax="count-1" :aria-valuetext="pad(modelValue)" @scroll="scroll" @keydown="key"><div class="spacer"/><button v-for="value in count" :key="value" type="button" tabindex="-1" :class="{ chosen: value-1 === modelValue }" @click="emit('update:modelValue', value-1)">{{ pad(value-1) }}</button><div class="spacer"/></div></div></template>
<style scoped>
.wheel-wrap { position:relative;width:116px;text-align:center; }.wheel-wrap>span { display:block;margin-bottom:8px;color:var(--vk-secondary);font-size:12px; }.time-wheel { height:144px;scroll-snap-type:y mandatory;mask-image:linear-gradient(transparent,#000 30%,#000 70%,transparent); }.time-wheel button { display:block;width:100%;height:48px;scroll-snap-align:center;background:none;border:0;color:#ffffff55;font:300 36px -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer; }.time-wheel button.chosen { color:white; }.spacer { height:48px; }.wheel-selection { position:absolute;left:0;right:0;top:73px;height:48px;border-radius:14px;background:#ffffff0b;border-block:1px solid #ffffff15;pointer-events:none; }
</style>
