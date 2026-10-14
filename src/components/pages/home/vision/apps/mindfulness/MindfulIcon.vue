<script setup lang="ts">
defineProps<{ name: 'breathe' | 'reflect' | 'activity' | 'sound' | 'silent' | 'pause' | 'play' | 'sparkles' | 'tune' | 'next' }>();
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <g v-if="name === 'breathe'">
      <ellipse cx="12" cy="9" rx="3.5" ry="7" /><ellipse cx="12" cy="9" rx="3.5" ry="7" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="9" rx="3.5" ry="7" transform="rotate(120 12 12)" />
    </g>
    <g v-else-if="name === 'reflect'"><path d="M15.8 3.5a8.5 8.5 0 1 0 4.7 12.8A8 8 0 0 1 15.8 3.5Z" /><path d="m19 3 .6 1.7L21 5.3l-1.4.6L19 7.5l-.6-1.6-1.6-.6 1.6-.6Z" /></g>
    <g v-else-if="name === 'activity'"><path d="M4 20V13m5 7V8m5 12V4m5 16v-9" /></g>
    <g v-else-if="name === 'sound' || name === 'silent'">
      <path d="m11 5-5 4H3v6h3l5 4Z" /><path v-if="name === 'sound'" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      <path v-else d="m16 9 5 6m0-6-5 6" />
    </g>
    <g v-else-if="name === 'pause'"><path d="M8 5v14M16 5v14" stroke-width="4" /></g>
    <path v-else-if="name === 'play'" d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none" />
    <g v-else-if="name === 'sparkles'"><path d="m11 3 2.5 6.5L20 12l-6.5 2.5L11 21l-2.5-6.5L2 12l6.5-2.5Z" /><path d="M20 2v5m-2.5-2.5h5" /></g>
    <g v-else-if="name === 'tune'"><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="2.5" fill="currentColor" /><circle cx="16" cy="17" r="2.5" fill="currentColor" /></g>
    <path v-else d="m9 5 7 7-7 7" />
  </svg>
</template>
