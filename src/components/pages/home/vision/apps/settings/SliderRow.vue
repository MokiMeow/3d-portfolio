
<script setup lang="ts">
import { vHover } from '../../kit/hover';
defineProps<{
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    detail?: string; disabled?: boolean;
}>();
defineEmits<{
    'update:modelValue': [
        value: number
    ];
}>();
</script>

<template>
<label class="slider-row">
<span>{{ label }}<output>{{ Math.round(modelValue) }}{{ suffix ?? '%' }}</output>
</span>
<input
  v-hover
  class="vk-slider"
  type="range"
  :aria-label="label"
  :min="min ?? 0"
  :max="max ?? 100"
  :step="step ?? 1"
  :value="modelValue"
  :disabled="disabled"
  :style="{ '--value': (modelValue - (min ?? 0)) / ((max ?? 100) - (min ?? 0)) }"
  @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
/>
<small v-if="detail">{{ detail }}</small>
</label>
</template>

<style scoped>
.slider-row {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
}
.slider-row :deep(*) {
  font-family: inherit;
}
.slider-row {
  display: block;
  padding: 18px 16px
}
.slider-row>span {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: calc(17px * var(--settings-type, 1))
}
.slider-row output {
  color: var(--vk-secondary);
  font-variant-numeric: tabular-nums
}
.slider-row small {
  display: block;
  font-size: 13px;
  color: var(--vk-secondary);
  line-height: 1.5
}
input {
  display: block;
  margin: 7px 0!important;
  min-height: 44px
}
input:focus-visible {
  outline: 2px solid white;
  outline-offset: 4px;
  border-radius: 14px
}
</style>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  :deep(*), :deep(*::before), :deep(*::after) {
    animation: none !important;
    transition: none !important;
  }
}
</style>
