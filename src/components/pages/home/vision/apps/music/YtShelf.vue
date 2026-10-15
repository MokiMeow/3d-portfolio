<script setup lang="ts">
import { vHover } from '../../kit/hover';
import type { Video } from '../../youtube/catalogue';

/** A shelf of songs from YouTube Music: a row of covers, or a list of results. */
defineProps<{ items: Video[]; title: string; subtitle?: string; layout?: 'row' | 'list'; loading?: boolean }>();
const emit = defineEmits<{ play: [index: number] }>();
const cover = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
</script>

<template>
  <section class="yt-shelf">
    <div class="heading"><h2><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#ff0033" /><circle cx="12" cy="12" r="5.6" fill="none" stroke="#fff" stroke-width="1.4" /><path d="m10.4 9.4 4 2.6-4 2.6Z" fill="#fff" /></svg>{{ title }}</h2><span v-if="subtitle">{{ subtitle }}</span></div>
    <p v-if="loading && !items.length" class="hint">Asking YouTube Music…</p>
    <div v-if="layout !== 'list'" class="row vk-scroll">
      <button v-for="(item, index) in items" :key="item.id" v-hover class="cover" @click="emit('play', index)">
        <span class="art"><img :src="cover(item.id)" alt="" loading="lazy" /><i>{{ item.duration }}</i></span>
        <b>{{ item.title }}</b><small>{{ item.channel }}</small>
      </button>
    </div>
    <div v-else class="list">
      <button v-for="(item, index) in items" :key="item.id" v-hover class="line" @click="emit('play', index)">
        <img :src="cover(item.id)" alt="" loading="lazy" /><span><b>{{ item.title }}</b><small>{{ item.channel }} · {{ item.duration }}</small></span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z" fill="currentColor" /></svg>
      </button>
    </div>
  </section>
</template>

<style scoped>
.yt-shelf{margin:22px 0 4px}
.heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:12px}
.heading h2{margin:0;display:flex;align-items:center;gap:8px;font-size:21px;font-weight:700;letter-spacing:-.02em}
.heading h2 svg{width:22px;height:22px;flex:none;align-self:center}
.heading span{font-size:13px;color:rgb(255 255 255 / .6)}
.hint{font-size:13.5px;color:rgb(255 255 255 / .6)}
.row{display:grid;grid-auto-flow:column;grid-auto-columns:200px;gap:14px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.cover{display:grid;gap:3px;text-align:left;border:0;background:none;color:inherit;padding:0;cursor:pointer;min-width:0}
.art{position:relative;aspect-ratio:16/9;border-radius:16px;overflow:hidden;box-shadow:0 10px 24px rgb(0 0 0 / .3);margin-bottom:6px}
.art img{width:100%;height:100%;object-fit:cover;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.cover:hover .art img{transform:scale(1.06)}
.art i{position:absolute;right:8px;bottom:8px;padding:2px 6px;border-radius:6px;background:rgb(0 0 0 / .7);font:600 11.5px/1.3 inherit;font-style:normal}
.cover b{font-size:14px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cover small{font-size:12.5px;color:rgb(255 255 255 / .6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.list{display:grid;gap:4px}
.line{display:flex;align-items:center;gap:14px;padding:8px 12px 8px 8px;border-radius:16px;border:0;background:none;color:inherit;text-align:left;cursor:pointer}
.line:hover{background:rgb(255 255 255 / .08)}
.line img{width:96px;aspect-ratio:16/9;object-fit:cover;border-radius:10px;flex:none}
.line span{flex:1;min-width:0;display:grid;gap:2px}
.line b{font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.line small{font-size:12.5px;color:rgb(255 255 255 / .6)}
.line svg{width:20px;height:20px;opacity:.7}
</style>
