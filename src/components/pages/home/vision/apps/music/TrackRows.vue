<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AlbumArt from './AlbumArt.vue';
import AppIcon from './AppIcon.vue';
import { formatTime, type Track } from './catalog';
defineProps<{ tracks: Track[]; currentId: string; playing: boolean; favorites: string[]; numbered?: boolean }>();
defineEmits<{ play: [track: Track]; favorite: [id: string]; more: [track: Track] }>();
</script>
<template>
 <div class="song-list">
  <div v-for="(song,index) in tracks" :key="song.id" class="song-row" :class="{selected:currentId===song.id}" @contextmenu.prevent="$emit('more',song)">
   <button v-hover class="play-row" :aria-label="'Play ' + song.title" :aria-pressed="currentId===song.id && playing" @click="$emit('play',song)">
    <span v-if="numbered" class="number"><AppIcon v-if="currentId===song.id && playing" name="sound" /><template v-else>{{ index+1 }}</template></span>
    <span v-else class="cover"><AlbumArt :track="song" small /></span>
    <span class="song-copy"><strong>{{ song.title }}</strong><small v-if="!numbered">{{ song.artist }}</small></span>
    <span class="duration">{{ formatTime(song.duration) }}</span>
   </button>
   <button v-hover class="vk-icon plain favorite" :aria-label="(favorites.includes(song.id) ? 'Unfavorite ' : 'Favorite ') + song.title" :aria-pressed="favorites.includes(song.id)" @click="$emit('favorite',song.id)"><AppIcon name="star" :filled="favorites.includes(song.id)" /></button>
   <button v-hover class="vk-icon plain" :aria-label="'Options for ' + song.title" @click="$emit('more',song)"><AppIcon name="more" /></button>
  </div>
 </div>
</template>
<style scoped>
.song-list {display:grid;gap:2px;min-width:0; }
.song-row {display:flex;align-items:center;min-width:0;border-bottom:1px solid #ffffff10;border-radius:12px; }
.song-row.selected {background:#ffffff0e; }
button {font:inherit;color:inherit;border:0;cursor:pointer;background:transparent; }
.play-row {display:flex;align-items:center;gap:12px;min-height:54px;flex:1;min-width:0;padding:7px 10px;text-align:left;border-radius:12px; }
.number {width:24px;flex:none;text-align:center;font-size:13px;color:var(--vk-tertiary); }
.number svg {width:18px;height:18px;color:#ff8895; }
.cover {width:40px;flex:none; }
.song-copy {flex:1;min-width:0;display:grid;gap:3px; }
strong {font-size:14px;line-height:1.35;font-weight:500;overflow-wrap:anywhere; }
small,.duration {font-size:12px;color:var(--vk-secondary); }
.selected strong {color:#ff9aa5; }
.duration {font-variant-numeric:tabular-nums;flex:none; }
.favorite svg {width:17px;height:17px; }
.favorite[aria-pressed='true'] {color:#ff9aa5;background:transparent; }
:focus-visible {outline:2px solid white;outline-offset:2px; }
@container music (max-width:620px) {.favorite{display:none;}.duration{font-size:11px;}.play-row{gap:10px;padding-left:6px;}}
</style>
