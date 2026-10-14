<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
const paths: Record<string, string> = {
  pads:'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  sequencer:'M3 6h3v3H3zM8 6h3v3H8zM13 6h3v3h-3zM18 6h3v3h-3zM3 15h3v3H3zM8 15h3v3H8zM13 15h3v3h-3zM18 15h3v3h-3z',
  mixer:'M5 3v8m0 4v6m7-18v3m0 4v11m7-18v10m0 4v4M2 11h6v4H2zM9 6h6v4H9zM16 13h6v4h-6z',
  synth:'M3 5h18v14H3zM7 5v9h3V5m4 0v9h3V5M8 14v5m8-5v5',
  play:'m9 5 10 7-10 7Z',stop:'M6 6h12v12H6z',record:'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  metro:'m9 3-5 18h16L15 3Zm1 7 6-5M8 16h8',
  export:'M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4',
  chevron:'m8 10 4 4 4-4',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
  close:'m6 6 12 12M6 18 18 6',more:'M4 12h.01M12 12h.01M20 12h.01',
  chain:'M10 8 8 6a4 4 0 0 0-6 6l4 4a4 4 0 0 0 6 0m2-8 2 2a4 4 0 0 1-6 6m0-8 2-2a4 4 0 0 1 6 6l-2 2',
  check:'m5 12 4 4L19 6',volume:'M3 9h4l5-4v14l-5-4H3zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  wave:'M2 12h3l2-7 4 14 4-14 2 7h5',help:'M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  copy:'M8 8h12v13H8zM4 16H2V2h13v2',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
};
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.wave" /></svg></template>
