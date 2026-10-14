<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ name: string }>();
const paths: Record<string, string> = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8',
  muted: 'm3 3 18 18M9 9v3a3 3 0 0 0 5 2M15 9V6a3 3 0 0 0-5-2M5 11v1a7 7 0 0 0 11 6m3-7v1M12 19v3m-4 0h8',
  camera: 'M4 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm13 4 5-3v12l-5-3',
  cameraOff: 'm3 3 18 18M8 5h7a2 2 0 0 1 2 2v5M3 7v10a2 2 0 0 0 2 2h10m2-10 5-3v12l-5-3',
  effects: 'm12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z',
  share: 'M4 4h16v12H4ZM9 20h6m-3-4v4m-2-13 5 3-5 3Z',
  captions: 'M4 5h16v14H4ZM10 9H7v6h3m7-6h-3v6h3',
  end: 'M3 15c2-7 16-7 18 0l-1 3-5-1v-4H9v4l-5 1Z',
  heart: 'M12 21 3 12C-3 5 7-1 12 6c5-7 15-1 9 6Z',
  balloon: 'M12 17c-9-2-8-14 0-14s9 12 0 14Zm-2 2 2-2 2 2m-2 0q-4 2 0 4',
  confetti: 'm4 20 4-12 8 8ZM13 3v3m5-1-2 4m5 2-4 1m-8-8 1 2m4 4 2-2m3 10 2 2',
  fireworks: 'M12 2v5m0 10v5M2 12h5m10 0h5M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3',
  send: 'm3 3 18 9-18 9 4-9Zm4 9h14',
  play: 'm8 4 12 8-12 8Z', pause: 'M8 4v16M16 4v16',
};
const path = computed(() => paths[props.name] ?? paths.camera);
</script>
<template><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="path"/></svg></template>
