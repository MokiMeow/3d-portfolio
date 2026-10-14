<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware, formatDuration } from "../watch";
import type { WatchAppId } from '../watch';
const props = defineProps<{
  title: string;
  app: WatchAppId;
  library?: boolean;
}>();
const emit = defineEmits<{
  library: [];
}>();
const watch = useWatch();
const tracks = [{
  title: 'After Hours',
  artist: 'Demo Sessions',
  duration: 214,
  colors: ['#654cff', '#ff7089']
}, {
  title: 'Coastal Drive',
  artist: 'Demo Sessions',
  duration: 188,
  colors: ['#036b92', '#55dbc6']
}, {
  title: 'Quiet Orbit',
  artist: 'Demo Sessions',
  duration: 246,
  colors: ['#182751', '#df7fab']
}] as const;
const track = computed(() => tracks[watch.playback.track % tracks.length] ?? tracks[0]);
const panel = ref<'queue' | 'output' | null>(null);
const output = ref('Watch Speaker');
function skip(delta: number) {
  watch.playback.track = (watch.playback.track + delta + tracks.length) % tracks.length;
  watch.playback.position = 0;
  watch.haptic();
}
function choose(index: number) {
  watch.playback.track = index;
  watch.playback.position = 0;
  watch.playback.playing = true;
  panel.value = null;
}
function seek(event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement) watch.playback.position = Number(target.value);
}
function volume(event: Event) {
  const target = event.target;
  if (target instanceof HTMLInputElement) watch.playback.volume = Number(target.value);
}
useWatchHardware(props.app, {
  back: () => {
    if (!panel.value) {
      if (props.library) { emit('library'); return true; }
      return false;
    }
    panel.value = null;
    return true;
  }
});
</script>

<template>
  <section class="watch-app music-player">
    <h1>
      {{ panel === 'queue' ? 'Up Next' : panel === 'output' ? 'Output' : title }}
    </h1>
    <template v-if="panel==='queue'">
      <h2>Up Next</h2>
      <button
        v-for="(item,index) in tracks"
        :key="item.title"
        class="watch-button queue"
        :class="{selected:index===watch.playback.track}"
        @click="choose(index)"
      >
        {{item.title}}
      </button>
      
    </template>
    <template v-else-if="panel==='output'">
      <h2>Demo Output</h2>
      <button
        v-for="device in ['Watch Speaker','Headphones']"
        :key="device"
        class="watch-button queue"
        @click="output=device;panel=null"
      >
        {{device}}
        {{output===device?'✓':''}}
      </button>

    </template>
    <template v-else>
      <div class="artwork" :style="{'--art-a':track.colors[0],'--art-b':track.colors[1]}">
        <div />
        <span>
          DEMO
          <br />
          SESSIONS
        </span>
        <i />
      </div>
      <h2 class="track-title">
        {{track.title}}
      </h2>
      <p class="caption muted artist">
        {{track.artist}}
        ·
        {{output}}
      </p>
      <input
        class="scrubber"
        aria-label="Playback position"
        type="range"
        min="0"
        :max="track.duration"
        :value="Math.min(track.duration,watch.playback.position)"
        @input="seek"
      />
      <div class="times">
        <span>
          {{formatDuration(watch.playback.position)}}
        </span>
        <span>
          {{formatDuration(track.duration)}}
        </span>
      </div>
      <div class="transport">
        <button aria-label="Previous track" @click="skip(-1)">
          <WatchGlyph name="skipBack" />
        </button>
        <button
          class="play"
          :aria-label="watch.playback.playing?'Pause':'Play'"
          @click="watch.playback.playing=!watch.playback.playing"
        >
          <WatchGlyph :name="watch.playback.playing ? 'pause' : 'play'" />
        </button>
        <button aria-label="Next track" @click="skip(1)">
          <WatchGlyph name="skipNext" />
        </button>
      </div>
      <div class="volume">
        <span aria-hidden="true">
          <WatchGlyph name="volume" />
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="watch.playback.volume"
          aria-label="Volume"
          @input="volume"
        />
        <span>
          {{Math.round(watch.playback.volume*100)}}
          %
        </span>
      </div>
      <div class="button-row">
        <button class="watch-button" @click="panel='output'">Output</button>
        <button class="watch-button" @click="panel='queue'">Queue</button>
      </div>

    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.music-player h1 {
  color: #ff526f;
}

.artwork {
  height: 150px;
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  background: linear-gradient(140deg,var(--art-a),var(--art-b));
  margin: 12px 0 16px;
}

.artwork>div {
  position: absolute;
  width: 200px;
  height: 200px;
  border: 24px solid #ffffff30;
  border-radius: 50%;
  right: -28px;
  top: -48px;
  box-shadow: 0 0 0 25px #ffffff12;
}

.artwork>i {
  position: absolute;
  height: 4px;
  width: 170px;
  background: #ffffffa0;
  bottom: 30px;
  right: 20px;
  transform: rotate(-35deg);
}

.artwork>span {
  position: absolute;
  top: 22px;
  left: 22px;
  font-weight: 800;
  font-size: 29px;
  line-height: 1.1;
  letter-spacing: 2px;
}

.track-title {
  font-size: 32px;
  margin-bottom: 3px;
}

.artist {
  margin: 0;
  font-size: 22px;
}

.scrubber {
  width: 100%;
  height: 72px;
  display: block;
  accent-color: #ff526f;
  margin: 0;
}

.times {
  display: flex;
  justify-content: space-between;
  color: #888;
  font-size: 21px;
  margin-top: -10px;
  font-variant-numeric: tabular-nums;
}

.transport {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0;
}

.transport button {
  min-width: 82px;
  min-height: 80px;
  background: none;
  color: #fff;
  border: 0;
  font-size: 30px;
}

.transport .play {
  font-size: 49px;
}

.volume {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
  color: #aaa;
}

.volume input {
  min-width: 0;
  flex: 1;
  height: 72px;
  accent-color: white;
}

.volume span:last-child {
  width: 52px;
}

.queue {
  width: 100%;
  margin: 10px 0;
}

.selected {
  color: #ff526f;
}

.demo {
  text-align: center;
  font-size: 20px;
}

.artwork {
  height: 88px;
  margin: 6px 0 10px;
}

.artwork > span {
  top: 12px;
  left: 16px;
  font-size: 23px;
}

.music-player .track-title {
  margin: 8px 0 4px;
  font-size: 29px;
}

.music-player .artist {
  margin: 4px 0;
}

.transport {
  margin: 4px 0;
}

.transport button {
  border-radius: 50%;
  background: #222225;
}

.transport .play {
  background: #343438;
}

.times {
  color: #b6b6bc;
  font-size: 21px;
}

.transport .play :deep(svg) {
  width: 38px;
  height: 38px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent:#ff526f; }
.artwork { height:130px; border-radius:30px; }
.artwork > span { line-height:1.25; font-size:24px; }
.music-player .track-title { font-size:28px; text-transform:none; letter-spacing:0; color:white; }
.transport button { width:82px; min-width:0; height:82px; }
.volume { flex-wrap:wrap; }
.times { font-size:20px; margin-top:0; }
</style>
