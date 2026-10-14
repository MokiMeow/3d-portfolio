<script setup lang="ts">
// Plain line icons in the console's own weight: 24 unit grid, 1.6 stroke, round caps.
const paths = {
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm4.8 11.3L20 20",
  gear: "M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8ZM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7",
  power: "M12 3v8M7.2 6.2a7.5 7.5 0 1 0 9.6 0",
  home: "M4 11.5 12 4.5l8 7M6.5 9.5V19.5h11V9.5M10 19.5v-5h4v5",
  library: "M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z",
  bell: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15ZM10 20.5h4",
  sound: "M4.5 9.5h3l4.5-4v13l-4.5-4h-3ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  mute: "M4.5 9.5h3l4.5-4v13l-4.5-4h-3ZM16 9.5l5 5M21 9.5l-5 5",
  controller: "M7.5 8h9a4.5 4.5 0 0 1 4.3 3.2l1 3.6a2.6 2.6 0 0 1-4.6 2.2L15.5 15h-7l-1.7 2a2.6 2.6 0 0 1-4.6-2.2l1-3.6A4.5 4.5 0 0 1 7.5 8ZM8 10.5v3M6.5 12h3M15.5 11.2h.01M17.5 12.8h.01",
  trophy: "M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0ZM7.5 6.5H4.5a3 3 0 0 0 3 3.5M16.5 6.5h3a3 3 0 0 1-3 3.5M12 13v3.5M8.5 20h7M9.5 16.5h5V20h-5Z",
  dots: "M6 12h.01M12 12h.01M18 12h.01",
  back: "M14.5 5.5 8 12l6.5 6.5",
  next: "M9.5 5.5 16 12l-6.5 6.5",
  close: "M6 6l12 12M18 6 6 18",
  play: "M8 5.5v13l10.5-6.5Z",
  info: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17ZM12 11v5.5M12 7.8h.01",
  keyboard: "M3.5 7h17v10h-17ZM6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M17.5 10h.01M8 14h8",
  touch: "M9.5 11V5.5a1.5 1.5 0 0 1 3 0V11l4.6 1a2.4 2.4 0 0 1 1.8 2.8l-.9 4.7h-8l-3.4-4.6a1.5 1.5 0 0 1 2.3-1.9l1.1 1.2",
  globe: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17ZM3.5 12h17M12 3.5c2.4 2.6 3.4 5.4 3.4 8.5s-1 5.9-3.4 8.5c-2.4-2.6-3.4-5.4-3.4-8.5s1-5.9 3.4-8.5Z",
  switcher: "M4.5 6.5h11v11h-11ZM8.5 3.5h11v11",
  user: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4.5 20.5a7.5 7.5 0 0 1 15 0",
  reload: "M19 8a7.5 7.5 0 1 0 1 6M19.5 3.5V8H15",
  expand: "M4.5 9.5v-5h5M14.5 4.5h5v5M19.5 14.5v5h-5M9.5 19.5h-5v-5",
  film: "M4.5 4.5h15v15h-15ZM8.5 4.5v15M15.5 4.5v15M4.5 9h4M4.5 15h4M15.5 9h4M15.5 15h4",
  music: "M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
} as const;
defineProps<{ name: keyof typeof paths }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
