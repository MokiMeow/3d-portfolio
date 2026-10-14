<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AlbumArt from './AlbumArt.vue';
import AppIcon from './AppIcon.vue';
import { formatTime, type Track } from './catalog';

defineProps<{ tracks: Track[]; currentId: string; playing: boolean; favorites: string[] }>();
defineEmits<{ play: [track: Track]; favorite: [id: string]; enqueue: [id: string] }>();
</script>

<template>
  <div class="song-list">
    <div v-for="song in tracks" :key="song.id" class="song-row" :class="{ selected: currentId === song.id }">
      <button v-hover class="vk-row play-row" :aria-label="'Play ' + song.title"
        :aria-pressed="currentId === song.id && playing" @click="$emit('play', song)">
        <span class="cover"><AlbumArt :track="song" small /></span>
        <span class="song-copy"><strong>{{ song.title }}</strong><small>{{ song.artist }} · {{ song.genre }}</small></span>
        <span class="duration"><AppIcon v-if="currentId === song.id && playing" name="queue" /><template v-else>{{ formatTime(song.duration) }}</template></span>
      </button>
      <button v-hover class="vk-icon plain" :aria-label="(favorites.includes(song.id) ? 'Unfavorite ' : 'Favorite ') + song.title"
        :aria-pressed="favorites.includes(song.id)" @click="$emit('favorite', song.id)"><AppIcon name="heart" :filled="favorites.includes(song.id)" /></button>
      <button v-hover class="vk-icon plain" :aria-label="'Add ' + song.title + ' to queue'" @click="$emit('enqueue', song.id)"><AppIcon name="plus" /></button>
    </div>
  </div>
</template>

<style scoped>
.song-list { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; display: grid; gap: 4px; }
.song-list :deep(*) { font-family: inherit; }
.song-row { display: flex; align-items: center; border-radius: 22px; min-width: 0; }
.song-row.selected { background: rgb(255 255 255 / .1); }
button { color: inherit; border: 0; cursor: pointer; background: transparent; font: inherit; }
.play-row { flex: 1; min-width: 0; padding: 8px; gap: 12px; }
.cover { flex: none; width: 46px; height: 46px; }
.song-copy { min-width: 0; flex: 1; }
strong { display: block; font-size: 17px; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; }
small, .duration { font-size: 14px; color: rgb(255 255 255 / .75); }
.duration { flex: none; }
:focus-visible { outline: 2px solid white; outline-offset: 2px; }
@container (max-width: 550px) {
  .cover { width: 36px; height: 36px; }
  .play-row { gap: 8px; }
  .duration { display: none; }
}
@container (max-width: 320px) {
  .song-row { flex-wrap: wrap; padding-bottom: 3px; }
  .play-row { flex-basis: 100%; }
  .song-row > .vk-icon { margin-left: 8px; }
}
@media (prefers-reduced-motion: reduce) { .song-list :deep(*) { animation: none !important; transition: none !important; } }
</style>
