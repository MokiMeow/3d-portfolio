
<script setup lang="ts">
import { vHover } from '../../kit/hover';
defineProps<{
    label: string;
    detail?: string;
    modelValue: boolean;
    disabled?: boolean;
}>();
defineEmits<{
    'update:modelValue': [
        value: boolean
    ];
}>();
</script>

<template>
<label v-hover class="toggle-row vk-row" :class="{ disabled }">
<span>
<strong>{{ label }}</strong>
<small v-if="detail">{{ detail }}</small>
</span>
<span class="switch-target">
<input
  v-hover
  class="vk-toggle"
  type="checkbox"
  role="switch"
  :aria-label="label"
  :checked="modelValue"
  :disabled="disabled"
  @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
/>
</span>
</label>
</template>

<style scoped>
.toggle-row {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
}
.toggle-row :deep(*) {
  font-family: inherit;
}
.toggle-row {
  justify-content: space-between;
  min-height: 72px;
  gap: 18px;
  cursor: pointer
}
.toggle-row span:first-child {
  min-width: 0
}
.toggle-row strong {
  font-weight: 500;
  font-size: calc(17px * var(--settings-type, 1))
}
.toggle-row small {
  display: block;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vk-secondary);
  margin-top: 4px
}
.switch-target {
  display: grid;
  place-items: center;
  width: 60px;
  min-width: 60px;
  height: 44px
}
.disabled {
  opacity: .45;
  cursor: default
}
input:focus-visible {
  outline: 2px solid white;
  outline-offset: 5px
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
