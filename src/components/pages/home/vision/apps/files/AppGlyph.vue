<script setup lang="ts">
const paths = {
  more: 'M5 12h.1M12 12h.1M19 12h.1',
  back: 'M20 12H4m7-7-7 7 7 7',
  forward: 'M4 12h16m-7-7 7 7-7 7',
  sort: 'M8 20V4m-4 4 4-4 4 4m4-4v16m-4-4 4 4 4-4',
  check: 'm5 12 4 4L19 6',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  list: 'M8 5h12M8 12h12M8 19h12M4 5h.1M4 12h.1M4 19h.1',
  columns: 'M3 4h18v16H3zM9 4v16m6-16v16',
  close: 'm6 6 12 12M6 18 18 6',
  open: 'M13 4h7v7m0-7L9 15M10 4H4v16h16v-6',
  restore: 'M4 11a8 8 0 1 1 2 7M4 4v7h7',
  rename: 'm14 5 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14z',
  duplicate: 'M9 9h11v11H9zM15 9V4H4v11h5',
  tag: 'M3 3h9l9 9-9 9-9-9zM8 8h.1',
  move: 'M3 5h7l2 3h9v12H3zM7 14h10m-3-3 3 3-3 3',
  archive: 'M3 4h18v5H3zM5 9v11h14V9M9 13h6',
  trash: 'M3 6h18M5 6l1 15h12l1-15M9 6V3h6v3M9 10v7m6-7v7',
  circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  home: 'm3 11 9-8 9 8M5 9v12h14V9M9 21v-8h6v8',
  leaf: 'M12 21V4m0 11C4 15 4 9 4 7c4 0 8 3 8 8m0-5c6 0 8-4 8-7-5 0-8 2-8 7',
  star: 'm12 3 2.8 5.7 6.2 .9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z',
  spark: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6',
} as const;
defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg class="app-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>

<style scoped>
.app-glyph {
  width: 22px;
  height: 22px;
  flex: none;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
}

.app-glyph :deep(*) {
  font-family: inherit;
}
</style>
