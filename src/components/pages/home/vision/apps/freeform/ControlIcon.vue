<script setup lang="ts">
defineProps<{ name: string }>();

const paths: Record<string, string> = {
  select: 'M5 3v17l5-5 4 7 3-2-4-7h7Z',
  hand: 'M12 3v18M3 12h18m-12-6 3-3 3 3m-9 3-3 3 3 3m3 3 3 3 3-3m3-9 3 3-3 3',
  marquee: 'M3 7V3h4m3 0h4m3 0h4v4m0 3v4m0 3v4h-4m-3 0h-4m-3 0H3v-4m0-3v-4',
  pen: 'm4 16 12-12 4 4L8 20l-5 1Zm10-10 4 4M4 16l4 4',
  marker: 'm5 14 7-10 7 5-7 10Zm0 0-2 5 5 2 4-2M3 21h8',
  eraser: 'm3 14 10-11 8 8-9 10H9Zm5 5 8-9M12 21h9',
  sticky: 'M4 3h16v13l-5 5H4Zm11 18v-5h5M8 8h8M8 12h6',
  rectangle: 'M4 5h16v14H4Z',
  ellipse: 'M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0Z',
  triangle: 'm12 3 10 18H2Z',
  arrow: 'M4 20 20 4M8 4h12v12',
  line: 'M4 20 20 4',
  star: 'm12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4L2.8 9.7l6.4-.9Z',
  text: 'M4 5h16M12 5v16M8 21h8',
  connector: 'M3 6h5v12h13M3 3v6m18 6v6',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0ZM9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1',
  export: 'M12 16V3m-4 4 4-4 4 4M5 13v8h14v-8',
  more: 'M4 12h.1m7.9 0h.1m7.9 0h.1',
  minus: 'M5 12h14',
  plus: 'M5 12h14M12 5v14',
  undo: 'M8 4 3 9l5 5M3 9h10a7 7 0 0 1 7 9',
  redo: 'm16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 9',
  style: 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  close: 'm6 6 12 12M6 18 18 6',
  resize: 'M5 5 19 19m-9 0h9v-9',
  chevron: 'm9 5 7 7-7 7',
  back: 'm15 5-7 7 7 7',
  check: 'm5 12 4 4L19 6',
  pin: 'm8 3 8 0-1 7 4 4H5l4-4Zm4 11v7',
  play: 'm8 4 12 8-12 8Z',
  stop: 'M6 6h12v12H6Z',
  reply: 'm8 4-5 5 5 5M3 9h11a7 7 0 0 1 7 7v4',
  link: 'M8 16 16 8M14 4l2-2a5 5 0 0 1 7 7l-3 3M10 20l-2 2a5 5 0 0 1-7-7l3-3',
  emoji: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0ZM8 9h.1m7.9 0h.1M8 14q4 5 8 0',
  sparkle: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  mic: 'M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0ZM6 11v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6',
  General: 'm9 3 1-1h4l1 1v2l2 1 2-1 2 3-1 2v3l1 2-2 3-2-1-2 1v2l-1 1h-4l-1-1v-2l-2-1-2 1-2-3 1-2v-3L3 8l2-3 2 1 2-1ZM16 12a4 4 0 1 1-8 0 4 4 0 1 1 8 0Z',
  Environments: 'M3 18 9 8l4 6 3-5 5 9ZM17 5a2 2 0 1 1-4 0 2 2 0 1 1 4 0Z',
  'People Awareness': 'M8 7a4 4 0 1 1 8 0 4 4 0 1 1-8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  Persona: 'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0ZM8 9h.1m7.9 0h.1M8 14q4 5 8 0',
  'Eyes & Hands': 'M2 12q10-14 20 0-10 14-20 0ZM15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0Z',
  'Optic ID & Passcode': 'M8 10V7a4 4 0 0 1 8 0v3M5 10h14v11H5ZM12 14v3',
  Displays: 'M3 4h18v13H3Zm9 13v4m-4 0h8',
  Sounds: 'M9 17V5l11-2v12M9 5v4l11-2M9 17a3 2 0 1 1-6 0 3 2 0 1 1 6 0ZM20 15a3 2 0 1 1-6 0 3 2 0 1 1 6 0Z',
  Focus: 'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z',
  Notifications: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4',
  Apps: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  'Control Centre': 'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
  Battery: 'M2 6h18v12H2Zm20 4v4M5 9v6m4-6v6m4-6v6',
  Accessibility: 'M14 4a2 2 0 1 1-4 0 2 2 0 1 1 4 0ZM3 8l9 2 9-2M12 10v5l-5 6m5-6 5 6',
  'Build Bot': 'M5 5h14v14H5ZM9 9h.1m5.9 0h.1M9 15h6M12 2v3M2 9v6m20-6v6',
  'Rubber Duck': 'M14 4a4 4 0 0 1 4 6l4 2h-6c-1 1-2 1-3 1l-2-2c-3 4-5 4-8 2-1 5 2 8 7 8h3c5 0 6-4 4-7M15 7h.1',
  Amma: 'M12 12c-7-9-12-1-6 2-5 5 3 10 6 3 3 7 11 2 6-3 6-3 1-11-6-2ZM14 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0Z',
  'Chai & Debug': 'M4 8h13v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM17 9h2a3 3 0 0 1 0 6h-2M7 5V2m5 3V2',
};
</script>

<template>
  <svg class="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path :d="paths[name] ?? paths.grid" />
  </svg>
</template>

<style scoped>
.control-icon {
  width: 22px;
  height: 22px;
  flex: none;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
}
.control-icon :deep(*) {
  font-family: inherit;
}
</style>
