<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
 featured: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
 build: 'm12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8m-9 5v9',
 shoot: 'M12 3v4m0 10v4M3 12h4m10 0h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
 race: 'm3 16 3-9h12l3 9M5 12h14M4 16h16v4h-3v-2H7v2H4Z',
 chill: 'M20 4C8 3 3 9 5 16c7 5 15-1 15-12ZM5 20 16 9',
 classic: 'M7 7h10c3 0 5 12 2 13l-4-4H9l-4 4C2 19 4 7 7 7Zm0 4v4m-2-2h4m6-1h.1m3 2h.1M9 7V4h6',
 search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm5 12L21 21',
 back: 'm10 5-7 7 7 7M3 12h18', reload: 'M20 10a8 8 0 1 0-1 8M20 3v7h-7',
 fullscreen: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', info: 'M12 10v7m0-10h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z', play: 'm9 5 11 7-11 7Z'
};
</script>
<template><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.featured" /></svg></template>
