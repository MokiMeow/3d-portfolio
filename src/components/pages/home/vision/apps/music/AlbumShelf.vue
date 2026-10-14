<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AlbumArt from './AlbumArt.vue';
import AppIcon from './AppIcon.vue';
import type { Artwork } from './catalog';
defineProps<{ title: string; subtitle?: string; items: (Artwork & { id: string })[] }>();
defineEmits<{ open: [id: string]; more: [id: string] }>();
</script>
<template>
 <section class="shelf-section">
  <header><div><h2>{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div><AppIcon name="right" /></header>
  <div class="shelf vk-scroll" tabindex="0" :aria-label="title + ', scroll horizontally'">
   <article v-for="item in items" :key="item.id" class="shelf-card">
    <button v-hover class="art-button" :aria-label="'Open ' + item.album" @click="$emit('open', item.id)" @contextmenu.prevent="$emit('more', item.id)"><AlbumArt :track="item" /><span class="card-copy"><strong class="title-button">{{ item.album }}</strong><span>{{ item.artist }}</span></span></button>
   </article>
  </div>
 </section>
</template>
<style scoped>
.shelf-section { min-width:0; }
header {display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px; }
h2 {font-size:20px;line-height:1.25;font-weight:700;letter-spacing:-.025em;margin:0; }
p {font-size:13px;line-height:1.4;color:var(--vk-secondary);margin:4px 0 0; }
header>svg {width:16px;height:16px;opacity:.45; }
.shelf {display:flex;gap:16px;scroll-snap-type:x mandatory;padding:4px 3px 10px;touch-action:pan-x pan-y; }
.shelf-card {flex:0 0 132px;scroll-snap-align:start;min-width:0; }
button {font:inherit;color:inherit;background:transparent;border:0;cursor:pointer;padding:0; }
.art-button {width:100%;display:block;border-radius:12px;text-align:left; }
.card-copy {display:grid;gap:3px;margin-top:8px; }
.title-button {text-align:left;font-size:14px;line-height:1.3;font-weight:600; }
.card-copy span {font-size:12px;line-height:1.3;color:var(--vk-secondary); }
:focus-visible {outline:2px solid white;outline-offset:3px; }
@container music (min-width:1000px) {.shelf-card{flex-basis:166px;}}
@container music (max-width:620px) {.shelf-card{flex-basis:132px;}.shelf{gap:14px;}}
</style>
