<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { clamp, useWatch, useWatchHardware } from '../watch';
const ctx = useWatch();
const zoom = ref(1);
const pan = ref({
  x: 0,
  y: 0
});
const places = [{
  name: 'The Good Coffee',
  subtitle: 'Coffee · 240 m',
  x: 270,
  y: 90
}, {
  name: 'Bug-Free Park',
  subtitle: 'Park · 450 m',
  x: 85,
  y: 55
}, {
  name: '404: Home Found',
  subtitle: 'Home · 380 m',
  x: 260,
  y: 245
}, {
  name: 'Merge Conflict Café',
  subtitle: 'Café · 320 m',
  x: 55,
  y: 255
}];
const saved = ref([0, 2]);
const selected = ref<number | null>(null);
const routing = ref(false);
const progress = ref(0);
const dragging = ref(false);
let pointerStart = {
  x: 0,
  y: 0,
  panX: 0,
  panY: 0
};
const place = computed(() => selected.value === null ? null : places[selected.value] ?? null);
const location = computed(() => {
  if (!place.value || !routing.value) return {
    x: 170,
    y: 170
  };
  const dx = place.value.x - 170;
  const dy = place.value.y - 170;
  const traveled = (Math.abs(dx) + Math.abs(dy)) * progress.value;
  return traveled <= Math.abs(dx) ? {
    x: 170 + Math.sign(dx) * traveled,
    y: 170
  } : {
    x: place.value.x,
    y: 170 + Math.sign(dy) * (traveled - Math.abs(dx))
  };
});
function select(index: number) {
  selected.value = index;
  routing.value = false;
  progress.value = 0;
}
function startRoute() {
  routing.value = true;
  progress.value = 0;
  ctx.haptic('tick');
}
function endRoute() {
  routing.value = false;
  progress.value = 0;
}
function toggleSaved() {
  if (selected.value === null) return;
  const index = selected.value;
  saved.value = saved.value.includes(index) ? saved.value.filter(value => value !== index) : [...saved.value, index];
}
function pointerDown(event: PointerEvent) {
  if (event.button !== 0) return;
  dragging.value = true;
  pointerStart = {
    x: event.clientX,
    y: event.clientY,
    panX: pan.value.x,
    panY: pan.value.y
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  if (!dragging.value) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  pan.value = {
    x: clamp(pointerStart.panX + (event.clientX - pointerStart.x) * 340 / rect.width, -160, 160),
    y: clamp(pointerStart.panY + (event.clientY - pointerStart.y) * 340 / rect.height, -160, 160)
  };
}
watch(ctx.now, () => {
  if (routing.value && ctx.activeApp.value === 'maps' && !ctx.dimmed.value && !ctx.reducedMotion.value && progress.value < 1) {
    progress.value = Math.min(1, progress.value + .04);
    if (progress.value === 1) ctx.haptic('success');
  }
});
useWatchHardware('maps', {
  crown: delta => {
    zoom.value = clamp(zoom.value + delta * .1, .6, 3);
    return true;
  },
  back: () => {
    if (selected.value !== null) {
      selected.value = null;
      endRoute();
      return true;
    }
    return false;
  }
});
</script>

<template>
  <section class="watch-app maps-app">
    <h1>Maps</h1>
    <div class="map-caption">
      <span class="caption">Offline demo</span>
      <button
        class="recenter"
        @click="pan={x:0,y:0};zoom=1"
        aria-label="Recenter map"
      >
        <WatchGlyph name="location" />
      </button>
    </div>
    <svg
      class="map"
      viewBox="0 0 340 340"
      role="img"
      aria-label="Fictional neighborhood offline map. Turn Crown to zoom, drag to pan."
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="dragging=false"
      @pointercancel="dragging=false"
      @lostpointercapture="dragging=false"
    >
      <rect
        width="340"
        height="340"
        fill="#242a28"
      />
      <g :transform="'translate('+pan.x+' '+pan.y+') translate(170 170) scale('+zoom+') translate(-170 -170)'">
        <path d="M0 0 H155 V111 H0Z M23 217 H115 V320 H23Z M232 179 H340 V340 H232Z" fill="#294b35" />
        <path
          d="M280 -30 Q195 95 297 176 T275 385"
          fill="none"
          stroke="#284f68"
          stroke-width="38"
        />
        <g fill="none" stroke-linecap="round">
          <path
            d="M-40 170 H380 M170 -40 V380 M70 -40 V110 H270 V265 H-40 M-40 55 H190 M65 245 H210 M60 340 V165 M335 93 H165"
            stroke="#46504c"
            stroke-width="28"
          />
          <path
            d="M-40 170 H380 M170 -40 V380 M70 -40 V110 H270 V265 H-40 M-40 55 H190 M65 245 H210 M60 340 V165 M335 93 H165"
            stroke="#747b75"
            stroke-width="16"
          />
        </g>
        <text
          x="18"
          y="36"
          fill="#80B990"
          :font-size="Math.max(31, 31 / zoom)"
        >BUG-FREE PARK</text>
        <text
          x="144"
          y="150"
          fill="#D0D3CE"
          font-size="21"
        >COMMIT ST</text>
        <polyline
          v-if="place"
          :points="'170,170 '+place.x+',170 '+place.x+','+place.y"
          fill="none"
          stroke="#0A84FF"
          stroke-width="9"
          stroke-linejoin="round"
        />
        <g v-for="(item,index) in places" :key="item.name">
          <circle
            :cx="item.x"
            :cy="item.y"
            r="15"
            :fill="index===selected?'#FF9F0A':'#D99D55'"
            stroke="#1c211f"
            stroke-width="3"
          />
          <g :transform="'translate(' + (item.x - 9) + ' ' + (item.y - 9) + ') scale(0.75)'" color="#171717">
            <WatchGlyph :name="index === 1 ? 'mindfulness' : index === 2 ? 'home' : 'coffee'" />
          </g>
        </g>
        <circle
          :cx="location.x"
          :cy="location.y"
          r="24"
          fill="#0A84FF"
          opacity=".2"
        />
        <circle
          :cx="location.x"
          :cy="location.y"
          r="10"
          fill="#0A84FF"
          stroke="white"
          stroke-width="4"
        />
      </g>
      <g>
        <rect
          x="12"
          y="304"
          width="89"
          height="25"
          rx="8"
          fill="#000"
          fill-opacity=".65"
        />
        <text
          x="24"
          y="322"
          fill="white"
          font-size="15"
        >
          {{ Math.round(100/zoom) }}
          m
        </text>
      </g>
    </svg>
    <p class="caption muted">Crown to zoom · drag to explore</p>
    <template v-if="place">
      <div class="platter">
        <h2>
          {{ place.name }}
        </h2>
        <p class="caption muted">
          {{ place.subtitle }}
          · fictional
        </p>
        <button class="watch-button" @click="toggleSaved">
          <WatchGlyph name="star" />
          {{ selected !== null && saved.includes(selected) ? 'Saved' : 'Save place' }}
        </button>
      </div>
      <button
        v-if="!routing"
        class="watch-button directions"
        @click="startRoute"
      >Walking directions</button>
      <template v-else>
        <div class="platter instruction">
          <strong>
            <WatchGlyph :name="progress === 1 ? 'check' : 'up'" />
            {{ progress === 1 ? 'You have arrived' : 'Continue on Commit St' }}
          </strong>
          <p class="caption muted">
            {{ progress===1?'Enjoy your fictional destination.':Math.round(240*(1-progress))+' m remaining · demo route' }}
          </p>
          <div class="route-progress">
            <span :style="{width:progress*100+'%'}">
            </span>
          </div>
        </div>
        <button class="watch-button" @click="endRoute">End route</button>
      </template>
      <button class="watch-button" @click="selected=null;endRoute()">All places</button>
    </template>
    <template v-else>
      <h2>Saved places</h2>
      <button
        v-for="index in saved"
        :key="index"
        class="place-button platter"
        @click="select(index)"
      >
        <strong>
          {{ places[index]?.name }}
        </strong>
        <span class="caption muted">
          {{ places[index]?.subtitle }}
          <WatchGlyph name="next" />
        </span>
      </button>
      <h2>Nearby</h2>
      <button
        v-for="(item,index) in places"
        :key="item.name"
        class="place-button platter"
        @click="select(index)"
      >
        <strong>
          {{ item.name }}
        </strong>
        <span class="caption muted">
          {{ item.subtitle }}
          <WatchGlyph name="next" />
        </span>
      </button>
    </template>
    <p class="caption muted">Drawn offline map. No live location or real directions.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  line-height: 1.1;
  margin: 0 0 22px;
  font-weight: 700;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  margin: 0 0 12px;
}

.watch-app button:focus-visible,
.watch-app input:focus-visible {
  outline: 4px solid #fff;
  outline-offset: 3px;
}

.watch-app button {
  touch-action: manipulation;
}

.watch-app p {
  line-height: 1.3;
}

.watch-app input {
  box-sizing: border-box;
  width: 100%;
  height: 80px;
  border: 0;
  border-radius: 24px;
  background: #252527;
  color: white;
  padding: 0 20px;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.map-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #30D158;
  margin-top: -18px;
}

.recenter {
  height: 76px;
  width: 76px;
  border: 0;
  border-radius: 50%;
  background: #202124;
  color: #0A84FF;
  font-size: max(calc(12px / var(--watch-scale)), calc(33px * var(--text-size, 1)));
}

.map {
  display: block;
  width: 100%;
  border-radius: 28px;
  overflow: hidden;
  touch-action: none;
  margin-top: 8px;
}

.place-button {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  color: white;
  border: 0;
  min-height: 100px;
  margin-bottom: 12px;
}

.place-button strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.maps-app h2 {
  margin-top: 20px;
}

.directions {
  background: #0A84FF !important;
}

.watch-button {
  margin: 12px 0;
}

.instruction strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.route-progress {
  height: 8px;
  border-radius: 5px;
  background: #353538;
  overflow: hidden;
}

.route-progress span {
  height: 100%;
  background: #30D158;
  display: block;
}

.map {
  height: 244px;
}

.map-caption {
  margin-bottom: 10px;
}
</style>
