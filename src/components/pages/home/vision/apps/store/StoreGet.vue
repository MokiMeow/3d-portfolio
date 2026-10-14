<script setup lang="ts">
import { vHover } from '../../kit/hover';
import type { DownloadState } from './catalog';
const props = defineProps<{ name: string; state: DownloadState; update?: boolean; large?: boolean }>();
defineEmits<{ activate: [] }>();
const downloading = computed(() => props.state.started !== null);
const label = computed(() => downloading.value ? 'Cancel download of ' + props.name
  : (props.update ? 'Update ' : props.state.version ? 'Open ' : 'Get ') + props.name);
</script>

<template>
  <button v-hover class="store-get vk-button" :class="{ large }" :aria-label="label" @click="$emit('activate')">
    <svg v-if="downloading" viewBox="0 0 40 40" class="progress" aria-hidden="true">
      <circle class="track" cx="20" cy="20" r="16" />
      <circle class="fill" cx="20" cy="20" r="16" :stroke-dashoffset="100.53 * (1 - state.progress)" />
      <rect x="15" y="15" width="10" height="10" rx="2" fill="currentColor" />
    </svg>
    <span v-else>{{ update ? 'Update' : state.version ? 'Open' : 'Get' }}</span>
    <span v-if="downloading" class="sr-only" role="progressbar" :aria-label="'Downloading ' + name"
      :aria-valuenow="Math.round(state.progress * 100)" :aria-valuemin="0" :aria-valuemax="100">
      {{ Math.round(state.progress * 100) }} percent
    </span>
  </button>
</template>

<style scoped>
.store-get.vk-button {
  min-width: 80px;
  min-height: 44px;
  flex: none;
  color: #c3e3ff;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
}

.store-get :deep(*) {
  font-family: inherit;
}

.store-get.large {
  min-height: 60px;
  min-width: 102px;
}

.store-get .progress {
  width: 36px;
  height: 36px;
}

.progress circle {
  fill: none;
  stroke-width: 2.5;
}

.track {
  stroke: rgb(195 227 255 / .18);
}

.fill {
  stroke: currentColor;
  stroke-dasharray: 100.53;
  transform: rotate(-90deg);
  transform-origin: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
