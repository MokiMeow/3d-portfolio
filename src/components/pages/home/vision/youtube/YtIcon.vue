<script setup lang="ts">
export type IconName =
  | "home" | "shorts" | "subscriptions" | "history" | "playlist" | "later"
  | "like" | "dislike" | "share" | "save" | "bell" | "search" | "mic"
  | "menu" | "cinema" | "mini" | "close" | "create" | "more" | "play"
  | "pause" | "next" | "back" | "check" | "comment" | "up" | "down" | "volume"
  | "forward" | "reload" | "external" | "download" | "heart" | "info"
  | "grid" | "album" | "trash" | "spatial" | "shield" | "globe" | "sidebar"
  | "bookmark" | "moon" | "screen" | "rewind" | "fastForward";
defineProps<{ name: IconName }>();
const paths: Record<IconName, string> = {
  forward: "m9 5 7 7-7 7",
  reload: "M20 8a9 9 0 1 0 1 7M20 3v5h-5",
  external: "M14 3h7v7M21 3 10 14M10 3H4v17h17v-6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  heart: "M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7Z",
  info: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6M12 7v.1",
  grid: "M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z",
  album: "M3 7h18v14H3ZM5 3h14M7 5h10M6 17l4-5 4 4 3-2 3 4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  spatial: "m12 3 9 6v6l-9 6-9-6V9ZM3 9l9 6 9-6M12 15v6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6",
  globe: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
  sidebar: "M3 4h18v16H3ZM9 4v16M5 8h2M5 12h2M5 16h2",
  bookmark: "M6 3h12v18l-6-4-6 4Z",
  moon: "M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z",
  screen: "M3 4h18v14H3ZM8 22h8M12 18v4",
  rewind: "m11 5-9 7 9 7ZM22 5l-9 7 9 7Z",
  fastForward: "m2 5 9 7-9 7ZM13 5l9 7-9 7Z",
  home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  shorts: "m15 3-8 4a4 4 0 0 0 0 7l2 1-2 1a3 3 0 0 0 3 5l8-4a4 4 0 0 0 0-7l-2-1 2-1a3 3 0 0 0-3-5ZM10 9l5 3-5 3Z",
  subscriptions: "M7 3h10M5 6h14M3 9h18v12H3ZM10 12l5 3-5 3Z",
  history: "M3 4v6h6M3 10a9 9 0 1 1 1 8M12 7v6l4 2",
  playlist: "M3 5h15M3 10h15M3 15h9M15 14l6 4-6 4Z",
  later: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 3",
  like: "M8 21H3V10h5M8 10l5-7c2 0 3 2 2 4l-1 3h5c2 0 2 2 2 3l-2 6c0 1-1 2-3 2H8Z",
  dislike: "M8 3H3v11h5M8 14l5 7c2 0 3-2 2-4l-1-3h5c2 0 2-2 2-3l-2-6c0-1-1-2-3-2H8Z",
  share: "m14 4 7 7-7 7v-4c-5 0-8 2-11 6 0-7 4-12 11-12Z",
  save: "M4 4h16v17l-8-5-8 5ZM9 9h6M12 6v6",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4",
  search: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6",
  mic: "M9 4a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8",
  menu: "M3 6h18M3 12h18M3 18h18",
  cinema: "M2 5h20v14H2ZM6 8v8M18 8v8",
  mini: "M2 5h20v14H2ZM12 12h8v5h-8Z",
  close: "m6 6 12 12M18 6 6 18",
  create: "M12 5v14M5 12h14",
  more: "M12 4v.1M12 12v.1M12 20v.1",
  play: "m8 4 12 8-12 8Z",
  pause: "M8 4v16M16 4v16",
  next: "m4 4 12 8-12 8ZM20 4v16",
  back: "m15 5-7 7 7 7",
  check: "m5 12 4 4 10-10",
  comment: "M3 3h18v14H9l-6 4Z",
  up: "m5 15 7-7 7 7",
  down: "m5 9 7 7 7-7",
  volume: "M3 9h4l5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14",
};
</script>

<template>
  <svg class="yt-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path :d="paths[name]" stroke="currentColor" :stroke-width="name === 'more' ? 3.5 : 1.6"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>

<style scoped>
.yt-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  font-family: Roboto, -apple-system, "Segoe UI", Arial, sans-serif;
}
.yt-icon :deep(*) {
  font-family: inherit;
}

</style>
