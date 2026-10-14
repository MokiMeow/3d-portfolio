<script setup lang="ts">
defineProps<{ title: string; art: string; accent: string; wide?: boolean; lettered?: boolean }>();
</script>

<template>
  <div class="poster" :class="[art, { wide }]" :style="{ '--ink': accent }">
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="600" height="400" fill="#111a24" />
      <g v-if="art === 'keynote'">
        <path d="M0 400 240 0h120l240 400" fill="var(--ink)" opacity=".22" />
        <path d="m40 0 190 320M560 0 370 320" stroke="var(--ink)" stroke-width="70" opacity=".2" />
        <ellipse cx="300" cy="335" rx="220" ry="26" fill="#080d14" />
        <rect x="210" y="160" width="180" height="116" rx="12" fill="#bac9d0" />
        <rect x="217" y="167" width="166" height="100" rx="7" fill="#182633" />
        <path d="m282 199 40 18-40 18z" fill="var(--ink)" />
        <path d="m210 276-35 16h250l-35-16" fill="#718994" />
        <circle cx="455" cy="70" r="40" fill="var(--ink)" opacity=".5" />
      </g>
      <g v-else-if="art === 'traffic'">
        <rect width="600" height="400" fill="#b45e2d" />
        <path d="M0 190 70 100l80 90 90-150 110 150 75-100 175 100" fill="#f5b46c" />
        <path d="M210 90h180l165 310H45z" fill="#292d32" />
        <path d="M300 100v300" stroke="#f7d78a" stroke-width="5" stroke-dasharray="20 18" />
        <rect v-for="n in 12" :key="n" :x="n % 2 ? 170 - n * 3 : 340 + n * 3" :y="90 + n * 21" width="64" height="34" rx="8" :fill="n % 3 ? '#f0bf83' : '#668b89'" />
      </g>
      <g v-else-if="art === 'meeting'">
        <rect width="600" height="400" fill="#282140" />
        <circle cx="300" cy="145" r="100" fill="#484065" stroke="#c1b1ee" stroke-width="3" />
        <path d="M300 75v70l55 20" stroke="#ede5ff" stroke-width="7" stroke-linecap="round" />
        <ellipse cx="300" cy="330" rx="220" ry="50" fill="#625380" />
        <g v-for="n in 5" :key="n" :transform="'translate(' + (80 + n * 70) + ' 0)'">
          <circle cy="270" r="19" fill="#dbc6c4" />
          <path d="M-25 330v-33q25-35 50 0v33" fill="#121520" />
        </g>
      </g>
      <g v-else-if="art === 'planet'">
        <rect width="600" height="400" fill="#082a25" />
        <circle cx="330" cy="150" r="112" fill="#3e9c7a" />
        <path d="m278 44 37 28-17 44 60 18-4 55 35 16-18 47-44 5-34-67-46-26-28-46z" fill="#b1d7a0" />
        <ellipse cx="330" cy="150" rx="160" ry="35" fill="none" stroke="#d4e9b0" stroke-width="7" transform="rotate(-25 330 150)" />
        <path d="M0 370 100 260l80 70 80-50 120 90 80-150 140 150" fill="#103e34" />
        <circle v-for="n in 13" :key="n" :cx="(n * 137) % 600" :cy="(n * 71) % 280" r="2" fill="#d6ebcd" />
      </g>
      <g v-else-if="art === 'merge'">
        <rect width="600" height="400" fill="#47152c" />
        <path d="M190 310V90m0 100q220 0 220-100m-220 80q220 0 220 140" fill="none" stroke="#ff7994" stroke-width="15" />
        <circle v-for="(point, i) in [[190,90],[410,90],[190,310],[410,310]]" :key="i" :cx="point[0]" :cy="point[1]" r="24" fill="#47152c" stroke="#ffe0e6" stroke-width="7" />
        <path d="m310 172 30 47h-60z" fill="#fbc477" />
        <path d="M310 187v13m0 5v2" stroke="#47152c" stroke-width="4" />
      </g>
      <g v-else-if="art === 'chai'">
        <rect width="600" height="400" fill="#5a382b" />
        <circle cx="310" cy="170" r="138" fill="#daaa6d" opacity=".4" />
        <ellipse cx="300" cy="315" rx="120" ry="22" fill="#301f1d" />
        <path d="M230 160h140l-18 145H248z" fill="#e7c39a" />
        <path d="M239 200h122l-12 90h-98z" fill="#ae6c35" />
        <path d="M370 180q90 0 50 65l-57 6" fill="none" stroke="#e7c39a" stroke-width="12" />
        <path d="M276 140q-30-30 0-70m48 70q-30-30 0-70" fill="none" stroke="#f9e3c4" stroke-width="6" stroke-linecap="round" />
      </g>
      <g v-else-if="art === 'error'">
        <rect width="600" height="400" fill="#213957" />
        <rect x="80" y="65" width="440" height="255" rx="20" fill="#d3e2e8" />
        <path d="M100 85h400" stroke="#839fb2" stroke-width="22" />
        <path d="m180 160 35 60h-70z" fill="#cf704a" />
        <path d="M265 165h190m-190 30h125m-125 30h160" stroke="#6d8899" stroke-width="12" />
        <rect x="360" y="265" width="115" height="32" rx="16" fill="#527d98" />
      </g>
      <g v-else>
        <rect width="600" height="400" fill="#17384b" />
        <path d="M0 270 140 65l100 130L360 30l240 240v130H0" fill="#72919c" />
        <path d="m290 124 70-94 73 100-60-25-20 20-17-29z" fill="#e4e5df" />
        <path d="M0 310q170-65 310 0t290 0v90H0" fill="#274a5b" />
        <circle cx="480" cy="70" r="29" fill="#e4c491" />
      </g>
    </svg>
    <div v-if="lettered !== false" class="lettering"><small>POCKET LAB ORIGINAL</small><strong>{{ title }}</strong><span>AN ENTIRELY INVENTED PRODUCTION</span></div>
  </div>
</template>

<style scoped>
.poster {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  container-type: inline-size;
  overflow: hidden;
  border-radius: inherit;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.poster :deep(*) {
  font-family: inherit;
}
svg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lettering {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 5px;
  padding: 18px;
  background: linear-gradient(transparent 25%, rgb(0 0 0 / .78));
  text-shadow: 0 2px 12px #000;
}
small {
  font-size: 12px;
  letter-spacing: .13em;
  font-weight: 700;
}
strong {
  max-width: 340px;
  font-size: 25px;
  line-height: 1.08;
  letter-spacing: -.035em;
}
span {
  font-size: 12px;
  letter-spacing: .1em;
  opacity: .75;
}
.wide .lettering {
  justify-content: flex-start;
  padding: 30px;
}
.wide strong {
  font-size: clamp(30px, 5cqw, 60px);
  max-width: 70%;
  overflow-wrap: anywhere;
}
.wide svg {
  width: 100%;
}
.wide .lettering {
  background: linear-gradient(90deg, rgb(0 0 0 / .72), transparent 90%);
}
</style>
