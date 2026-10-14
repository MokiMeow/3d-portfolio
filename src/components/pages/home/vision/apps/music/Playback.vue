<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AlbumArt from './AlbumArt.vue';
import AppIcon from './AppIcon.vue';
import { formatTime, type Track } from './catalog';
defineProps<{ track: Track; playing: boolean; busy: boolean; elapsed: number; shuffle: boolean; repeat: 'Off'|'All'|'One'; mode: 'artwork' | 'lyrics' | 'queue' | null }>();
const emit = defineEmits<{ toggle: []; next: []; previous: []; seek: [value:number]; now: []; mode: [value:'lyrics'|'queue']; output: []; shuffle: []; repeat: [] }>();
function scrub(event: Event): void { if(event.target instanceof HTMLInputElement) emit('seek',Number(event.target.value)); }
</script>
<template>
 <footer class="playback vk-ornament" aria-label="Music playback">
  <div class="player-main">
   <button v-hover class="metadata" aria-label="Open Now Playing" @click="emit('now')"><span class="thumb"><AlbumArt :track="track" small /></span><span class="copy"><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></span></button>
   <div class="transport"><button v-hover class="vk-icon plain" aria-label="Previous track" @click="emit('previous')"><AppIcon name="previous" filled /></button><button v-hover class="vk-icon play" :aria-label="busy ? 'Cancel starting audio' : playing ? 'Pause' : 'Play'" :aria-busy="busy" @click="emit('toggle')"><AppIcon :name="playing ? 'pause' : 'play'" :filled="!playing" /></button><button v-hover class="vk-icon plain" aria-label="Next track" @click="emit('next')"><AppIcon name="next" filled /></button></div>
   <div class="utilities"><button v-hover class="vk-icon plain" aria-label="Shuffle" :aria-pressed="shuffle" @click="emit('shuffle')"><AppIcon name="shuffle" /></button><button v-hover class="vk-icon plain repeat-button" :aria-label="'Repeat: '+repeat" :aria-pressed="repeat!=='Off'" @click="emit('repeat')"><AppIcon name="repeat" /><span v-if="repeat==='One'">1</span></button><button v-hover class="vk-icon plain" aria-label="Volume and sound" @click="emit('output')"><AppIcon name="sound" /></button><button v-hover class="vk-icon plain" aria-label="Show lyrics" :aria-pressed="mode==='lyrics'" @click="emit('mode','lyrics')"><AppIcon name="lyrics" /></button><button v-hover class="vk-icon plain" aria-label="Show queue" :aria-pressed="mode==='queue'" @click="emit('mode','queue')"><AppIcon name="queue" /></button></div>
  </div>
  <div class="timeline"><span>{{ formatTime(elapsed) }}</span><input class="vk-slider" type="range" min="0" :max="track.duration" :value="elapsed" step="1" :style="{'--value':elapsed/track.duration}" aria-label="Playback position" :aria-valuetext="formatTime(elapsed) + ' of ' + formatTime(track.duration)" @input="scrub" /><span>−{{ formatTime(track.duration-elapsed) }}</span></div>
 </footer>
</template>
<style scoped>
.playback {flex-direction:column;border-radius:30px!important;padding:9px 16px 4px!important;gap:0!important;min-width:0; }
.player-main {display:flex;align-items:center;gap:14px;width:100%; }
button {font:inherit;color:inherit;border:0;cursor:pointer; }
.metadata {display:flex;align-items:center;gap:11px;flex:1;min-width:0;background:transparent;text-align:left;padding:4px;border-radius:15px;min-height:52px; }
.thumb {width:44px;flex:none; }
.copy {min-width:0;display:grid;gap:3px; }
.copy strong {font-size:13px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
.copy small {font-size:12px;color:var(--vk-secondary); }
.transport,.utilities {display:flex;align-items:center;gap:2px;flex:none; }
.repeat-button {position:relative;}.repeat-button span{position:absolute;font-size:8px;right:5px;top:3px;font-weight:750;}
.play {background:rgb(255 255 255 / .92);color:#25252b; }
.timeline {display:flex;gap:10px;align-items:center;width:100%; }
.timeline span {font-size:10px;color:var(--vk-secondary);font-variant-numeric:tabular-nums;min-width:29px; }
.timeline span:last-child {text-align:right; }
.timeline input {min-width:0; }
.timeline input::-webkit-slider-runnable-track {height:4px; }
.timeline input::-webkit-slider-thumb {width:12px;height:12px;margin-top:-4px; }
.timeline input::-moz-range-track,.timeline input::-moz-range-progress {height:4px; }
.timeline input::-moz-range-thumb {width:12px;height:12px; }
:focus-visible {outline:2px solid white;outline-offset:2px; }
@container music (max-width:620px) {
 .playback {padding:8px 12px 4px!important;border-radius:26px!important; }
 .player-main {flex-wrap:wrap;gap:2px 5px; }
 .metadata {flex:1; }.transport {gap:0;}.thumb{width:38px;}.metadata{gap:8px;}
 .utilities {width:100%;justify-content:center;order:3;border-top:1px solid #ffffff10;margin-top:3px; }
 .copy strong {font-size:12px;}.copy small{font-size:11px;}
 .timeline {gap:7px; }.timeline input {height:34px; }
 .utilities .vk-icon {width:48px;height:40px;min-height:44px; }
}
</style>
