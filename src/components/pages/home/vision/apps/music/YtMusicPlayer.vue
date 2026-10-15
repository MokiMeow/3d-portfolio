<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { vHover } from '../../kit/hover';
import { usePlayer } from '../../youtube/usePlayer';
import type { Video } from '../../youtube/catalogue';

/**
 * Songs from YouTube Music, played in a small visible player docked in the Music window. YouTube's terms
 * ask for the player to stay on screen and at least 200 pixels tall, so it does.
 */
const props = defineProps<{ queue: Video[]; index: number }>();
const emit = defineEmits<{ close: []; index: [index: number] }>();
const host = ref<HTMLElement>();
const player = usePlayer(host, () => {}, () => step(1), () => step(1));
const song = computed(() => props.queue[props.index]);
watch(() => [props.queue, props.index] as const, () => { if (song.value) player.select(song.value); }, { immediate: true });
function step(by: number) { const next = props.index + by; if (next >= 0 && next < props.queue.length) emit('index', next); }
const progress = computed(() => player.duration.value ? player.position.value / player.duration.value : 0);
defineExpose({ pause: player.pause });
</script>

<template>
  <section class="yt-player vk-ornament" aria-label="YouTube Music player">
    <div class="screen"><div ref="host" class="host" /></div>
    <div class="side">
      <p class="eyebrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" fill="#ff0033" /><path d="m10 8.5 6 3.5-6 3.5Z" fill="#fff" /></svg>YouTube Music</p>
      <b :title="song?.title">{{ song?.title }}</b>
      <small>{{ song?.channel }}</small>
      <i class="bar"><i :style="{ width: `${progress * 100}%` }" /></i>
      <div class="controls">
        <button v-hover class="vk-icon" aria-label="Previous" :disabled="index === 0" @click="step(-1)"><svg viewBox="0 0 24 24"><path d="M6 5v14M18 5 8 12l10 7Z" /></svg></button>
        <button v-hover class="vk-icon play" :aria-label="player.playing.value ? 'Pause' : 'Play'" @click="player.togglePlayback()">
          <svg v-if="player.playing.value" viewBox="0 0 24 24"><path d="M8 5h3v14H8ZM13 5h3v14h-3Z" class="fill" /></svg>
          <svg v-else viewBox="0 0 24 24"><path d="M8 5v14l11-7Z" class="fill" /></svg>
        </button>
        <button v-hover class="vk-icon" aria-label="Next" :disabled="index >= queue.length - 1" @click="step(1)"><svg viewBox="0 0 24 24"><path d="M18 5v14M6 5l10 7-10 7Z" /></svg></button>
        <button v-hover class="vk-icon" aria-label="Close YouTube player" @click="player.close(); emit('close')"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      <p v-if="player.error.value" class="error">{{ player.error.value }}</p>
    </div>
  </section>
</template>

<style scoped>
.yt-player{position:absolute;right:18px;bottom:16px;z-index:8;display:flex;gap:14px;padding:10px;border-radius:26px;align-items:stretch;max-width:calc(100% - 36px)}
.screen{width:356px;height:200px;flex:none;border-radius:18px;overflow:hidden;background:#000;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .1)}
.host,.host :deep(iframe){width:100%;height:100%;display:block;border:0}
.side{width:210px;display:flex;flex-direction:column;gap:3px;padding:6px 4px 4px 0;min-width:0}
.eyebrow{margin:0 0 4px;display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgb(255 255 255 / .7)}
.eyebrow svg{width:16px;height:16px}
.side b{font-size:15px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.side small{font-size:12.5px;color:rgb(255 255 255 / .62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{display:block;height:4px;border-radius:2px;background:rgb(255 255 255 / .16);margin:auto 0 8px;overflow:hidden}
.bar i{display:block;height:100%;background:#fff;border-radius:inherit;transition:width .25s linear}
.controls{display:flex;gap:4px;align-items:center}
.controls .vk-icon{width:40px;height:40px}
.controls .play{background:#fff;color:#111}
.controls svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.controls svg .fill{fill:currentColor;stroke:none}
.error{margin:4px 0 0;font-size:12px;color:#ff8a80}
@container (max-width:700px){.yt-player{left:10px;right:10px;bottom:10px;flex-direction:column}.screen{width:100%;height:auto;aspect-ratio:16/9;min-height:200px}.side{width:auto}}
</style>
