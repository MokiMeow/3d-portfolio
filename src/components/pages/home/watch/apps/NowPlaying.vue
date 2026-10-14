<script setup lang="ts">
import MusicPlayer from './AppMusicPlayer.vue';
</script>

<template>
<MusicPlayer title="Now Playing" app="nowPlaying" />
</template>

<style scoped>
.watch-app { font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif; }
.watch-app :deep(*) { font-family: inherit; }
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF526F; }
</style>
