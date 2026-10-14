<script setup lang="ts">
import type { PsGame } from '~/common/playstation/games';
import { vHover } from '../../kit/hover';
defineProps<{ game: PsGame }>();
defineEmits<{ play: [game: PsGame] }>();
</script>
<template><button v-hover class="game-card" :style="{ '--game-color': game.color }" :aria-label="'View ' + game.title" @click="$emit('play', game)"><span class="art"><img :src="game.cover" alt="" loading="lazy" draggable="false" /><span class="play-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m9 5 11 7-11 7Z" /></svg></span></span><strong>{{ game.title }}</strong><small>{{ game.genre }}<span v-if="game.phone"> · Touch ready</span></small></button></template>
<style scoped>
.game-card { display: flex; flex-direction: column; gap: 5px; min-width: 0; width: 240px; flex: 0 0 240px; padding: 0 0 8px; border: 0; background: none; border-radius: 20px; color: inherit; text-align: left; cursor: pointer; font: inherit; }
.art { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 20px; overflow: hidden; background: var(--game-color); transition: box-shadow .25s, transform .3s var(--vk-spring); }
img { width: 100%; height: 100%; object-fit: cover; } strong { font-size: 17px; line-height: 1.3; padding: 5px 5px 0; } small { padding: 0 5px; color: var(--vk-secondary); font-size: 14px; }
.play-mark { position: absolute; bottom: 10px; right: 10px; width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: #1118; backdrop-filter: blur(8px); } svg { width: 18px; height: 18px; }
.game-card:hover .art, .game-card:focus-visible .art { transform: translateY(-3px); box-shadow: 0 8px 24px color-mix(in srgb, var(--game-color) 40%, transparent); }
:focus-visible { outline: 2px solid white; outline-offset: 4px; }
@media (prefers-reduced-motion: reduce) { .art { transition: none; transform: none !important; } }
</style>
