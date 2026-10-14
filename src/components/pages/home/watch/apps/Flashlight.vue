<script setup lang="ts">
import { useWatch, useWatchHardware, clamp } from "../watch";
const watch = useWatch();
const page = ref(0);
const brightness = ref(.8);
const modes = ['White', 'Flashing', 'Red'];
const pointerX = ref<number | null>(null);
function cycle(delta: number) {
  page.value = (page.value + delta + 3) % 3;
  watch.haptic();
}
function swipe(event: PointerEvent) {
  if (pointerX.value === null) return;
  const delta = event.clientX - pointerX.value;
  if (Math.abs(delta) > 24) cycle(delta < 0 ? 1 : -1);
  pointerX.value = null;
}
useWatchHardware('flashlight', {
  crown: delta => {
    brightness.value = clamp(brightness.value + delta * .05, .15, 1);
    return true;
  }
});
</script>

<template>
  <section
    class="watch-app flashlight-app"
    :class="{red:page===2,flashing:page===1&&!watch.reducedMotion.value&&!watch.dimmed.value,dimmed:watch.dimmed.value}"
    @pointerdown.stop="pointerX=$event.clientX"
    @pointerup.stop="swipe"
    @pointercancel="pointerX=null"
  >
    <h1>Flashlight</h1>
    <div class="beam" :style="{ opacity: brightness }" />
    <div class="flash-content">

      <p>
        {{modes[page]}}
      </p>
      <p v-if="page===1&&watch.reducedMotion.value" class="caption">Flashing paused for reduced motion</p>
      <div class="pages">
        <button
          v-for="(mode,index) in modes"
          :key="mode"
          :aria-label="mode+' light'"
          :aria-pressed="page===index"
          @click.stop="page=index"
        >
          <span :class="{selected:page===index}" />
        </button>
      </div>
      <p class="caption">Crown for brightness · swipe for mode</p>
      <label class="brightness-control">Brightness {{ Math.round(brightness * 100) }}%<input v-model.number="brightness" type="range" min=".15" max="1" step=".05" aria-label="Flashlight brightness" /></label>
      <button class="off" @click="watch.home()">Turn Off</button>
    </div>
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

.flashlight-app {
  position: relative;
  background: white;
  color: #141414;
  isolation: isolate;
  text-align: center;
  height: 100%;
}

.flashlight-app h1 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.beam {
  position: absolute;
  inset: 0;
  background: #fff;
  z-index: -1;
}

.beam::after {
  content: "";
  position: absolute;
  inset: 0;
  background: #000;
  opacity: 0;
}

.red .beam {
  background: #ff2626;
}

.red {
  color: #350000;
}

.flashing .beam::after {
  animation: flash 1.4s steps(1,end) infinite;
}

.dimmed .beam {
  filter: brightness(.25);
}

.flash-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flash-content>p:first-of-type {
  font-size: max(18px, calc(36px * var(--text-size, 1)));
  font-weight: 600;
  margin: auto 0 20px;
}

.pages {
  display: flex;
  justify-content: center;
}

.pages button {
  width: 76px;
  height: 76px;
  border: 0;
  background: none;
  display: grid;
  place-items: center;
}

.pages span {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #0004;
}

.pages .selected {
  background: #111;
}

.caption {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.off {
  min-height: 80px;
  border-radius: 40px;
  padding: 0 45px;
  border: 0;
  background: #0002;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  color: inherit;
  margin-top: auto;
}

@keyframes flash {
  0%,
  100% {
    opacity: 0;
  }

  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion:reduce) {
  .flashing .beam::after {
    animation: none;
  }
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FFFFFF; }

.flashlight-app { background:#000; color:white; height:auto; min-height:100%; }
.flashlight-app .beam { position:relative; inset:auto; z-index:0; height:180px; width:100%; border-radius:30px; margin:10px 0 18px; overflow:hidden; }
.flash-content { height:auto; }
.flash-content > p:first-of-type { margin:0 0 10px; font-size:30px; }
.flashlight-app .caption { color:#ffffff99; }
.pages span { background:#ffffff55; }
.pages .selected { background:white; }
.brightness-control { display:flex; flex-direction:column; gap:10px; width:100%; font-size:20px; }
.brightness-control input { width:100%; min-height:64px; accent-color:white; }
.off { width:100%; min-height:64px; border-radius:32px; background:#1c1c1e; margin-top:16px; color:white; }
.red { color:white; }
</style>
