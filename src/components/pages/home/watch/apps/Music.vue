<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from "../watch";
import MusicPlayer from '../MusicPlayer.vue';
const watch = useWatch();
const player = ref(false);
const albums = [{
  title: 'After Hours',
  mood: 'Evening mix',
  color: '#8561ff'
}, {
  title: 'Coastal Drive',
  mood: 'Open-road mix',
  color: '#35c9b9'
}, {
  title: 'Quiet Orbit',
  mood: 'Focus mix',
  color: '#d180b0'
}];
function play(index: number) {
  watch.playback.track = index;
  watch.playback.position = 0;
  watch.playback.playing = true;
  player.value = true;
  watch.haptic();
}
useWatchHardware('music', {
  back: () => {
    if (!player.value) return false;
    player.value = false;
    return true;
  }
});
</script>

<template>
  <MusicPlayer
    v-if="player"
    title="Music"
    app="music"
    library
    @library="player=false"
  />
  <section v-else class="watch-app music-library">
    <h1>Music</h1>
    <button class="watch-button current" @click="player=true">
      <WatchGlyph :name="watch.playback.playing ? 'music' : 'play'" />
      {{ watch.playback.playing ? 'Now Playing' : 'Open Player' }}
    </button>
    <h2>Demo Library</h2>
    <button
      v-for="(album,index) in albums"
      :key="album.title"
      class="platter album"
      @click="play(index)"
    >
      <span class="cover" :style="{'--album-color':album.color}">
        <WatchGlyph name="music" />
      </span>
      <span>
        <strong>
          {{album.title}}
        </strong>
        <small>
          {{album.mood}}
        </small>
      </span>
      <b>
        <WatchGlyph name="play" />
      </b>
    </button>
    <p class="caption muted">Original visual artwork. Demo playback without streamed audio.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.music-library h1 {
  color: #ff526f;
}

.current {
  width: 100%;
  color: #ff526f;
  margin-bottom: 24px;
}

.album {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  text-align: left;
  gap: 16px;
  color: white;
  margin-bottom: 12px;
  min-height: 116px;
}

.cover {
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 90% 0,#fff8,transparent 50%),var(--album-color);
  color: white;
  border-radius: 15px;
  font-size: max(calc(12px / var(--watch-scale)), calc(36px * var(--text-size, 1)));
  flex-shrink: 0;
}

.album strong {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(24px * var(--text-size, 1)));
}

.album small {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 6px;
}

.album b {
  margin-left: auto;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #aaa;
}

.current {
  margin-bottom: 12px;
}

.album {
  min-height: 94px;
  gap: 12px;
}

.cover {
  width: 62px;
  height: 62px;
}

.cover svg {
  width: 36px;
  height: 36px;
}
</style>
