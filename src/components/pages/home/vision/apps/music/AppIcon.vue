<script setup lang="ts">
defineProps<{ name: string; filled?: boolean }>();
const paths: Record<string, string> = {
  play: 'm9 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  previous: 'M5 5v14m14-14L8 12l11 7Z',
  next: 'M19 5v14M5 5l11 7-11 7Z',
  browse: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
  radio: 'M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14M12 12h.01',
  music: 'M9 17V5l11-2v12M9 8l11-2M9 17c0 3-6 4-6 1s6-4 6-1Zm11-2c0 3-6 4-6 1s6-4 6-1Z',
  search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  queue: 'M4 5h16M4 10h16M4 15h9m3 0 5 3-5 3Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  up: 'm6 10 6-6 6 6M12 4v16',
  down: 'm6 14 6 6 6-6M12 4v16',
  left: 'm14 5-7 7 7 7',
  right: 'm10 5 7 7-7 7',
  close: 'm6 6 12 12M18 6 6 18',
  plus: 'M12 4v16M4 12h16',
  minus: 'M4 12h16',
  shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6m3-5c1-1 2-1 3-1h3m-4-4 4 4-4 4',
  repeat: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3',
  heart: 'M20 5c-3-3-7-1-8 2-1-3-5-5-8-2-4 4 1 9 8 15 7-6 12-11 8-15Z',
  lyrics: 'M4 4h16v13H9l-5 4ZM8 8h8M8 12h6',
  sound: 'M4 9v6h4l5 4V5L8 9Zm12-1c2 2 2 6 0 8m3-11c4 4 4 10 0 14',
  check: 'm5 12 4 4L19 6',
  folder: 'M3 7V5h7l2 2h9v13H3Zm0 3h18',
  note: 'M6 3h9l4 4v14H6Zm9 0v5h4M9 12h7M9 16h7',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5Zm7 4v3',
  pin: 'M8 3h8l-1 7 3 3v2H6v-2l3-3Zm4 12v6',
  pen: 'm4 20 1-6L17 2l5 5-12 12Zm11-16 5 5M5 14l5 5',
  marker: 'm6 14 9-11 5 4-9 11Zm-1 0 7 5-5 2H3Z',
  eraser: 'm3 14 9-11 9 8-8 10H9Zm5-6 9 8M13 21h8',
  undo: 'M9 4 3 10l6 6M3 10h11a6 6 0 0 1 0 12',
  share: 'M12 16V2m-4 4 4-4 4 4M6 10H4v11h16V10h-2',
  copy: 'M9 9h12v12H9ZM15 5V3H3v12h2',
  system: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M9 9h6v6H9Z',
  finder: 'M3 3h18v18H3ZM12 3l-2 10h3v8M7 8v1m10-1v1M7 16c3 2 7 2 10 0',
  terminal: 'm5 6 6 6-6 6m8 0h6',
  editor: 'm8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18',
  notes: 'M5 3h14v18H5ZM8 7h8M8 11h8M8 15h6',
  settings: 'M3 4h18v13H3Zm5 17h8m-4-4v4',
  tune: 'M4 6h16M4 18h16M8 3v6m8 6v6',
  enter: 'M20 5v8H4m5-5-5 5 5 5',
};
</script>

<template>
  <svg class="app-icon" :class="{ dots: name === 'more', paused: name === 'pause' }" viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" aria-hidden="true">
    <path :d="paths[name] ?? paths.music" />
  </svg>
</template>

<style scoped>
.app-icon { width: 22px; height: 22px; flex: none; display: block; font-family: inherit; }
.app-icon :deep(*) { font-family: inherit; }
path { stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.dots path { stroke-width: 4; }
.paused path { stroke-width: 3.4; }
</style>
