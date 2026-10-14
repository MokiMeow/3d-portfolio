<script setup lang="ts">
import type { StoreApp } from './catalog';
defineProps<{ app: StoreApp; large?: boolean }>();
</script>

<template>
  <span class="store-icon" :class="{ large }" :style="{ '--app-color': app.color }" aria-hidden="true">
    <svg viewBox="0 0 38 38" fill="none">
      <path :d="app.path" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
</template>

<style scoped>
.store-icon {
  display: inline-grid;
  place-items: center;
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 19px;
  color: var(--app-color);
  background: linear-gradient(150deg, rgb(255 255 255 / .15), transparent), color-mix(in srgb, var(--app-color), #17202b 76%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .24), inset 0 0 0 1px rgb(255 255 255 / .12), 0 5px 14px rgb(0 0 0 / .12);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
}
.store-icon :deep(*) { font-family: inherit; }
.store-icon svg { width: 40px; height: 40px; }
.store-icon.large { width: 96px; height: 96px; border-radius: 27px; }
.store-icon.large svg { width: 60px; height: 60px; }
</style>
