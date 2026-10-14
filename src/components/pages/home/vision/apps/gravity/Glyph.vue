<script setup lang="ts">
const props = defineProps<{ name: string }>();
const paths: Readonly<Record<string, string>> = {
  cube: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm-8 4.5 8 4.5 8-4.5M12 12v9',
  gravity: 'M12 3v12m-4-4 4 4 4-4M5 19h14',
  slow: 'M8 4h8M8 20h8M9 4v4l3 4-3 4v4m6-16v4l-3 4 3 4v4',
  explode: 'M8 8 3 3m0 4V3h4m9 5 5-5m-4 0h4v4M8 16l-5 5m0-4v4h4m9-5 5 5m-4 0h4v-4M9 9h6v6H9Z',
  tidy: 'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z',
  clear: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v6m4-6v6',
  play: 'm9 5 11 7-11 7V5Z',
  pause: 'M8 5v14m8-14v14',
  search: 'M17 17l4 4M19 10a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  help: 'M9.5 8a2.7 2.7 0 1 1 3.6 2.6c-1.1.5-1.1 1.1-1.1 2.4M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  sound: 'm11 4-5 4H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted: 'm11 4-5 4H3v8h3l5 4V4Zm5 5 5 6m0-6-5 6',
  close: 'm6 6 12 12M6 18 18 6',
  chevron: 'm8 10 4 4 4-4',
  plus: 'M5 12h14M12 5v14',
  check: 'm5 12 4 4 10-10',
  hand: 'M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8c0 4-2 7-6 7h-1c-2 0-3-1-4-3l-4-6a2 2 0 0 1 3-2l3 3',
  preset: 'm3 8 9-5 9 5-9 5-9-5Zm0 4 9 5 9-5M3 16l9 5 9-5',
  launch: 'M12 4v12m-5-5 5 5 5-5M4 20h16',
};
</script>
<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[props.name] || paths.cube"/></svg></template>
