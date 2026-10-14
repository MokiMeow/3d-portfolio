<script setup lang="ts">
import { computed } from 'vue';
import type { Artwork } from './catalog';
const props = defineProps<{ track: Artwork; small?: boolean }>();
const lines = computed(() => {
 const words = props.track.album.split(' '); const rows: string[] = []; let line = '';
 for (const word of words) { if ((line + ' ' + word).trim().length > 16 && line) { rows.push(line); line = word; } else line = (line + ' ' + word).trim(); }
 if (line) rows.push(line); return rows;
});
</script>
<template>
 <div class="album-art" :class="[track.art, { small }]" :style="{ '--a': track.colors[0], '--b': track.colors[1], '--c': track.colors[2] }">
  <img v-if="track.photo" :src="track.photo" alt="" loading="lazy" draggable="false" class="photograph" />
  <svg viewBox="0 0 400 400" fill="none" aria-hidden="true">
   <g v-if="track.art === 'paper'">
    <path d="M0 0h400v400H0Z" fill="var(--a)" />
    <circle cx="288" cy="172" r="143" fill="var(--b)" />
    <circle v-for="ring in 13" :key="ring" cx="288" cy="172" :r="22+ring*8" stroke="var(--c)" stroke-opacity=".25" />
    <path d="M31 226C82 212 56 150 110 164S115 255 171 223s40-126 104-94" stroke="var(--c)" stroke-width="3" />
    <circle cx="288" cy="172" r="22" fill="var(--a)" /><circle cx="288" cy="172" r="4" fill="var(--c)" />
    <text x="26" y="36" class="micro" fill="var(--c)">AN EXERCISE IN TAKING IT EASY</text>
    <path d="M27 56h110M27 60h75" stroke="var(--c)" stroke-opacity=".45" />
   </g>
   <g v-else-if="track.art === 'monsoon'">
    <path d="M0 0h400v400H0Z" fill="var(--c)" opacity=".3" />
    <path v-for="i in 22" :key="i" :d="'M'+(i*22-50)+' 0l-96 400'" stroke="white" stroke-opacity=".17" />
    <rect x="18" y="18" width="364" height="364" stroke="white" stroke-opacity=".5" />
    <text x="30" y="48" class="micro" fill="white">FIELD NOTES / VOL. 02</text>
    <circle cx="323" cy="76" r="25" stroke="white" stroke-opacity=".65" /><path d="M310 76h26m-13-13v26" stroke="white" stroke-opacity=".65" />
   </g>
   <g v-else-if="track.art === 'signal'">
    <path d="M0 0h400v400H0Z" fill="var(--c)" />
    <circle cx="200" cy="148" r="110" fill="var(--a)" />
    <path v-for="i in 12" :key="i" :d="'M80 '+(145+i*10)+'h240'" stroke="var(--c)" :stroke-width="i*1.1" />
    <path d="M0 255 85 195 134 236 232 168 310 229 400 183v217H0Z" fill="var(--c)" />
    <path v-for="i in 6" :key="'h'+i" :d="'M0 '+(267+i*24)+'h400'" stroke="var(--b)" stroke-opacity=".6" />
    <path v-for="i in 9" :key="'v'+i" :d="'M200 255 '+((i-5)*120+200)+' 400'" stroke="var(--b)" stroke-opacity=".6" />
    <text x="25" y="37" class="micro" fill="var(--a)">STEREO / TRANSMISSION 003</text>
   </g>
   <g v-else-if="track.art === 'chai'">
    <path d="M0 0h400v400H0Z" fill="var(--a)" :opacity="track.photo ? .35 : 1" />
    <circle cx="250" cy="155" r="112" fill="var(--b)" opacity=".88" />
    <circle cx="250" cy="155" r="86" stroke="var(--a)" stroke-width="2" /><circle cx="250" cy="155" r="67" fill="var(--c)" />
    <path d="M324 126c67-8 68 80 1 65" stroke="var(--a)" stroke-width="12" />
    <path d="M222 119c-30-35 40-37 10-76m33 77c-28-38 39-39 9-78" stroke="var(--a)" stroke-width="4" stroke-linecap="round" />
    <text x="25" y="37" class="micro" fill="var(--c)">SLOWLY BREWED / SIDE A</text>
   </g>
   <g v-else-if="track.art === 'orbit'">
    <path d="M0 0h400v400H0Z" fill="var(--c)" />
    <circle cx="240" cy="177" r="103" fill="var(--b)" />
    <circle cx="240" cy="177" r="81" fill="var(--a)" opacity=".7" />
    <ellipse v-for="i in 7" :key="i" cx="210" cy="174" :rx="125+i*10" :ry="32+i*8" transform="rotate(-33 210 174)" stroke="var(--a)" stroke-opacity=".38" />
    <circle v-for="i in 24" :key="'s'+i" :cx="(i*73)%388" :cy="(i*41)%256" :r="i%4===0 ? 2 : 1" fill="white" opacity=".7" />
    <text x="25" y="37" class="micro" fill="var(--a)">A STUDY OF DISTANCE & TIME</text>
   </g>
   <g v-else-if="track.art === 'bloom'">
    <path d="M0 0h400v400H0Z" fill="var(--a)" />
    <path d="M-25 30h450M-25 95h450M-25 160h450M-25 225h450" stroke="var(--b)" stroke-opacity=".17" />
    <path d="M223 254c-20-96-42-139-2-215m-6 163c-95 2-126-57-108-93 69-1 118 24 108 93m-1-39c85-5 115-61 93-94-64 0-100 35-93 94m8-75c-44-19-51-64-29-83 39 10 52 36 29 83" fill="var(--b)" />
    <path d="M224 254c-16-91-24-155-2-208" stroke="var(--c)" stroke-width="3" />
    <text x="25" y="37" class="micro" fill="var(--c)">PIANO SKETCHES FOR A FREE DAY</text>
   </g>
   <g v-else-if="track.art === 'afterhours'">
    <path d="M0 0h400v400H0Z" fill="var(--c)" :opacity="track.photo ? .28 : 1" />
    <path d="m28 0 160 400M102 0l160 400M230 0 70 400M368 0l-40 400" stroke="var(--a)" stroke-opacity=".33" stroke-width="4" />
    <circle cx="301" cy="102" r="53" fill="var(--a)" opacity=".74" />
    <text x="25" y="37" class="micro" fill="white">BENGALURU / BLUE HOUR SESSIONS</text>
    <path d="M28 72h42m-21-21v42" stroke="white" stroke-width="2" />
   </g>
   <g v-else>
    <path d="M0 0h400v400H0Z" fill="var(--a)" />
    <g transform="rotate(-25 200 170)"><rect x="91" y="-70" width="265" height="333" fill="var(--c)" />
     <rect v-for="i in 9" :key="i" :x="96+(i-1)*28" y="-65" width="25" height="317" fill="var(--a)" />
     <rect v-for="i in [1,2,4,5,6,8]" :key="'k'+i" :x="85+i*28" y="-65" width="17" height="192" fill="var(--c)" />
    </g>
    <text x="25" y="37" class="micro" fill="var(--c)">WINDOW SEAT / NO. 08</text>
   </g>
   <g class="lettering" :fill="['paper','chai','bloom','keys'].includes(track.art) ? 'var(--c)' : 'white'">
    <text v-for="(line,i) in lines" :key="line" x="25" :y="302+(i-(lines.length-2))*31" class="cover-title" :class="{ serif: ['monsoon','bloom','keys'].includes(track.art) }">{{ line }}</text>
    <text x="27" y="374" class="artist-type">{{ track.artist }}</text>
   </g>
  </svg>
 </div>
</template>
<style scoped>
.album-art { width:100%; aspect-ratio:1; position:relative; overflow:hidden; isolation:isolate; border-radius:12px; background:var(--c); box-shadow:0 8px 22px #0003, inset 0 0 0 1px #ffffff24; container-type:inline-size; }
svg { width:100%;height:100%;position:relative;display:block; }
.photograph { position:absolute;width:100%;height:100%;object-fit:cover;filter:saturate(.65); }
.monsoon .photograph { filter:saturate(.45) brightness(.68); }
.afterhours .photograph { filter:saturate(.7) brightness(.65); }
.micro { font:500 9px -apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;letter-spacing:1.6px; }
.cover-title { font:750 32px -apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;letter-spacing:-1.5px; }
.serif { font-family:Georgia,serif;font-weight:500;font-size:34px;letter-spacing:-1px; }
.artist-type { font:600 10px -apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;letter-spacing:1.3px;text-transform:uppercase; }
.small { border-radius:8px;box-shadow:inset 0 0 0 1px #ffffff20; }
@container (max-width:65px) { .lettering,.micro { display:none; } }
</style>
