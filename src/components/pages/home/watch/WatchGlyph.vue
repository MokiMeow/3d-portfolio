<script setup lang="ts">
const paths = {
  back: 'm14 6-6 6 6 6',
  next: 'm10 6 6 6-6 6',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M18 6 6 18',
  play: 'm8 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M6 6h12v12H6Z',
  skipBack: 'M5 5v14m14-14L8 12l11 7Z',
  skipNext: 'M19 5v14M5 5l11 7-11 7Z',
  delete: 'M9 5H5l-4 7 4 7h16V5Zm1 5 5 5m0-5-5 5',
  trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  star: 'm12 3 3 6 6 1-4.5 5 1 6L12 18l-5.5 3 1-6L3 10l6-1Z',
  clock: 'M12 8v5h5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  grid: 'M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  volume: 'M3 9h4l5-4v14l-5-4H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',
  music: 'M9 18V5l11-2v13M9 7l11-2M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3',
  mic: 'M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0ZM6 10v1a6 6 0 0 0 12 0v-1m-6 7v4m-3 0h6',
  edit: 'm4 16 12-12 4 4L8 20H4Zm10-10 4 4',
  reply: 'm9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7',
  smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M8 9h.01M16 9h.01M8 15q4 4 8 0',
  wifi: 'M2 7q10-8 20 0M5 11q7-6 14 0M8 15q4-3 8 0M12 19h.01',
  airplane: 'm21 3-8 18-3-7-7-3Z M10 14l11-11',
  water: 'M12 3 5 12a8 8 0 1 0 14 0ZM8 15q0 4 4 4',
  theatre: 'M3 4h10v7a5 5 0 0 1-10 0ZM6 7h.01M10 7h.01M6 10q2 2 4 0M13 9h8v8a4 4 0 0 1-8 0M16 13h.01M19 13h.01M16 18q1.5-2 3 0',
  airplay: 'M5 17H3V4h18v13h-2M12 14l6 7H6Z',
  bolt: 'm13 2-9 11h7l-1 9 10-12h-7Z',
  power: 'M12 2v10M6 5a9 9 0 1 0 12 0',
  reset: 'M3 10a9 9 0 1 1 2 8M3 3v7h7',
  info: 'M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  settings: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2m10-10 2-2',
  watch: 'M8 2h8l1 5m0 10-1 5H8l-1-5M6 7h12v10H6Z',
  phone: 'M7 3h10v18H7ZM11 18h2',
  headphones: 'M4 14v-2a8 8 0 0 1 16 0v2M4 12h3v8H4Zm13 0h3v8h-3Z',
  coffee: 'M4 9h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4ZM16 10h2a3 3 0 0 1 0 6h-2M7 2q3 2 0 4m5-4q3 2 0 4',
  activity: 'M20 12a8 8 0 1 1-8-8m4 8a4 4 0 1 1-4-4',
  mindfulness: 'M12 12c-13-14-13 14 0 0s13 14 0 0c14-13-14-13 0 0s-14 13 0 0',
  rocket: 'M9 15 4 20l-1-6 5-5m1 6 6 1 5-5M9 15 8 9C12 3 17 2 22 2c0 5-1 10-7 14m-5 2-2 4-3-1 2-4M17 7h.01',
  coins: 'M18 9a7 7 0 1 1-14 0 7 7 0 0 1 14 0M11 5v8m-2-7h4m-4 6h4M19 7a7 7 0 1 1-9 13',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M7 7h.01M17 7h.01M12 12h.01M7 17h.01M17 17h.01',
  laptop: 'M5 3h14v12H5ZM5 15l-3 5h20l-3-5M10 18h4',
  photo: 'M3 3h18v18H3Zm0 14 6-6 4 4 3-3 5 5M16 7h.01',
  camera: 'M3 7h4l2-3h6l2 3h4v14H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  switch: 'M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4',
  battery: 'M2 6h17v12H2Zm20 4v4M5 9h8v6H5Z',
  heart: 'M12 21C9 18 2 13 2 8c0-6 7-8 10-3 3-5 10-3 10 3 0 5-7 10-10 13Z',
  chart: 'M4 20V4m0 16h17M8 16V9m5 7V5m5 11v-4',
  signal: 'M5 19v-4m5 4v-8m5 8V7m5 12V3',
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  home: 'm3 11 9-8 9 8M5 9v12h14V9M9 21v-7h6v7',
  cloud: 'M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1 0 8Z',
  rain: 'M7 14a4 4 0 1 1 1-8 5 5 0 0 1 9 1 4 4 0 0 1 1 7M8 17l-1 4m6-4-1 4m6-4-1 4',
  wind: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 17h6a2 2 0 1 1-2 2',
} as const;
defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg
    class="watch-glyph"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>

<style scoped>
.watch-glyph {
  display: inline-block;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  vertical-align: middle;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  font-family: -apple-system, "SF Pro Rounded", system-ui, sans-serif;
}

.watch-glyph :deep(*) {
  font-family: inherit;
}
</style>
