<script setup lang="ts">
import type { Track } from './catalog';
defineProps<{ track: Track; small?: boolean }>();
</script>

<template>
  <div class="album-art" :class="[track.art, { small }]" :style="{ '--art-a': track.colors[0], '--art-b': track.colors[1], '--art-c': track.colors[2] }">
    <svg viewBox="0 0 300 300" fill="none" aria-hidden="true">
      <g v-if="track.art === 'vinyl'">
        <circle cx="218" cy="127" r="110" fill="#242330" />
        <circle v-for="ring in 12" :key="ring" cx="218" cy="127" :r="25 + ring * 6" stroke="white" stroke-opacity=".1" />
        <circle cx="218" cy="127" r="28" fill="var(--art-a)" />
        <circle cx="218" cy="127" r="5" fill="var(--art-c)" />
        <path d="M20 245 90 20" stroke="white" stroke-opacity=".5" stroke-width="2" />
      </g>
      <g v-else-if="track.art === 'landscape'">
        <circle cx="212" cy="85" r="38" fill="var(--art-a)" />
        <path d="M0 182Q75 85 155 170T300 170V300H0Z" fill="var(--art-c)" opacity=".55" />
        <path d="M0 218Q80 152 161 207T300 193V300H0Z" fill="var(--art-c)" opacity=".65" />
        <path d="M0 233Q90 212 153 228T300 221" stroke="var(--art-a)" stroke-opacity=".55" />
        <path d="M0 246Q90 225 153 242T300 235" stroke="var(--art-a)" stroke-opacity=".35" />
      </g>
      <g v-else-if="track.art === 'grid'">
        <circle cx="150" cy="107" r="68" fill="var(--art-a)" />
        <path v-for="line in 8" :key="line" :d="'M82 ' + (90 + line * 12) + 'H218'" stroke="var(--art-c)" stroke-width="5" />
        <path d="M0 196 64 152 101 180 181 137 240 185 300 154V300H0Z" fill="var(--art-c)" />
        <path v-for="line in 7" :key="'h' + line" :d="'M0 ' + (210 + line * 15) + 'H300'" stroke="var(--art-a)" stroke-opacity=".35" />
        <path v-for="line in 9" :key="'v' + line" :d="'M150 194 ' + ((line - 5) * 76 + 150) + ' 300'"
          stroke="var(--art-a)" stroke-opacity=".35" />
      </g>
      <g v-else-if="track.art === 'keys'" transform="rotate(-28 150 150)">
        <rect x="29" y="43" width="242" height="224" rx="12" fill="var(--art-c)" opacity=".8" />
        <rect v-for="key in 8" :key="key" :x="33 + (key - 1) * 30" y="48" width="26" height="202" rx="4" fill="var(--art-a)" opacity=".85" />
        <rect v-for="key in [1, 2, 4, 5, 6]" :key="'black' + key" :x="21 + key * 30" y="48" width="20" height="124"
          rx="3" fill="var(--art-c)" />
      </g>
      <g v-else-if="track.art === 'rings'">
        <circle v-for="ring in 9" :key="ring" cx="162" cy="130" :r="15 + ring * 14" stroke="var(--art-a)"
          :stroke-width="ring % 3 === 0 ? 9 : 3" :stroke-opacity=".9 - ring * .065" />
        <path d="M58 198 115 165 154 202 195 158 245 185" stroke="white" stroke-width="5" stroke-linecap="round" />
      </g>
      <g v-else>
        <circle cx="155" cy="111" r="78" fill="var(--art-a)" opacity=".85" />
        <circle cx="126" cy="91" r="16" fill="var(--art-b)" opacity=".35" />
        <circle cx="184" cy="135" r="27" fill="var(--art-b)" opacity=".25" />
        <circle cx="164" cy="61" r="10" fill="var(--art-b)" opacity=".4" />
        <path d="M0 226Q113 171 300 222V300H0Z" fill="var(--art-c)" opacity=".7" />
        <circle v-for="star in 12" :key="star" :cx="(star * 71) % 290" :cy="(star * 43) % 240" r="1.5" fill="white" opacity=".6" />
      </g>
    </svg>
    <div class="art-type"><span>{{ track.album }}</span><small>{{ track.artist }} · SIDE A</small></div>
  </div>
</template>

<style scoped>
.album-art {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
  position: relative; isolation: isolate; width: 100%; container-type: inline-size; aspect-ratio: 1; overflow: hidden; border-radius: 22px;
  background: linear-gradient(145deg, var(--art-a), var(--art-b) 45%, var(--art-c));
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .2), 0 14px 30px rgb(0 0 0 / .2);
}
.album-art :deep(*) { font-family: inherit; }
svg { display: block; width: 100%; height: 100%; }
.art-type {
  position: absolute; inset: auto 0 0; padding: 24% 8% 8%;
  background: linear-gradient(transparent, rgb(0 0 0 / .55)); display: flex; flex-direction: column; gap: 5px;
}
.art-type span { font-size: clamp(14px, 10cqw, 28px); font-weight: 700; line-height: 1.08; letter-spacing: -.035em; }
.art-type small { font-size: 12px; text-transform: uppercase; letter-spacing: .11em; line-height: 1.3; }
@container (max-width: 180px) {
  .art-type { gap: 3px; padding: 32% 9% 9%; }
  .art-type span { font-size: 16px; line-height: 1.15; }
  .art-type small { display: none; }
}
.small { border-radius: 12px; box-shadow: inset 0 0 0 1px rgb(255 255 255 / .15); }
.small .art-type { display: none; }
</style>
