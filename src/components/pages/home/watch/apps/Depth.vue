<script setup lang="ts">
import { formatDuration, useWatch, useWatchHardware } from '../watch';
const ctx = useWatch();
const mode = ref<'desk' | 'dive' | 'complete'>('desk');
const elapsed = ref(0);
const lastTick = ref(0);
const paused = ref(false);
const diveDepth = computed(() => {
  if (mode.value === 'desk') return 0;
  if (elapsed.value < 16) return elapsed.value * 1.5;
  if (elapsed.value < 28) return 24;
  if (elapsed.value < 40) return 24 - (elapsed.value - 28) * 1.75;
  if (elapsed.value < 48) return 3;
  return Math.max(0, 3 - (elapsed.value - 48));
});
const maxDepth = computed(() => Math.min(24, elapsed.value * 1.5));
const phase = computed(() => {
  if (mode.value === 'desk') return 'On dry land';
  if (mode.value === 'complete') return 'Back at the surface';
  if (elapsed.value < 16) return 'Descending';
  if (elapsed.value < 28) return 'Exploring';
  if (elapsed.value < 40) return 'Ascending';
  if (elapsed.value < 48) return 'Safety stop · demo';
  return 'Surfacing';
});
function start() {
  mode.value = 'dive';
  elapsed.value = 0;
  paused.value = false;
  lastTick.value = ctx.now.value.getTime();
  ctx.haptic('tick');
}
function reset() {
  mode.value = 'desk';
  elapsed.value = 0;
  paused.value = false;
}
watch(ctx.now, value => {
  const timestamp = value.getTime();
  if (mode.value === 'dive' && !paused.value && !ctx.dimmed.value && ctx.activeApp.value === 'depth') {
    elapsed.value = Math.min(51, elapsed.value + Math.min(1.5, Math.max(0, (timestamp - lastTick.value) / 1000)));
    if (elapsed.value >= 51) {
      mode.value = 'complete';
      ctx.haptic('success');
    }
  }
  lastTick.value = timestamp;
});
useWatchHardware('depth', {
  action: () => {
    if (mode.value !== 'dive') start();else paused.value = !paused.value;
    return true;
  }, back: () => {
    if (mode.value === 'desk') return false;
    reset();
    return true;
  }
});
</script>

<template>
  <section class="watch-app depth-app" :class="{submerged:mode==='dive'}">
    <h1>Depth</h1>
    <div class="water-scene">
      <div class="waterline" :style="{transform:'translateY('+(90-diveDepth*2.6)+'%)'}">
      </div>
      <div class="depth-reading">
        <span class="caption cyan">
          {{ phase }}
        </span>
        <strong>
          {{ diveDepth.toFixed(1) }}
          <small>m</small>
        </strong>
        <span class="caption muted">
          {{ mode === 'desk' ? 'No depth sensor connected' : 'SIMULATED DIVE' }}
        </span>
      </div>
    </div>
    <div v-if="mode==='dive' && elapsed>=40 && elapsed<48" class="platter safety">
      <span>Stop at 3 m</span>
      <strong>
        {{ Math.ceil(48-elapsed) }}
        s
      </strong>
      <span class="caption">Accelerated demonstration</span>
    </div>
    <template v-if="mode==='dive'">
      <button class="watch-button" @click="paused=!paused">
        {{ paused?'Resume dive':'Pause dive' }}
      </button>
      <button class="watch-button" @click="reset">End simulation</button>
    </template>
    <template v-else>
      <button class="watch-button dive-button" @click="start">
        {{ mode==='complete'?'Dive again':'Simulate a dive' }}
      </button>
      <button
        v-if="mode==='complete'"
        class="watch-button"
        @click="reset"
      >Return to dry land</button>
    </template>
    <div class="platter readings">
      <div>
        <span class="caption muted">Max depth</span>
        <strong>
          {{ maxDepth.toFixed(1) }}
          m
        </strong>
      </div>
      <div>
        <span class="caption muted">Underwater</span>
        <strong>
          {{ formatDuration(elapsed) }}
        </strong>
      </div>
      <div>
        <span class="caption muted">Water temp</span>
        <strong>
          {{ mode==='desk' ? '--' : '22° C' }}
        </strong>
      </div>
    </div>
    

    <p class="polish-footnote">Demo data, for fun. Not a dive instrument.</p>
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
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  line-height: 1.2;
  margin: 0 0 22px;
  font-weight: 700;
}

h2 {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
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
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.depth-app {
  background: linear-gradient(#000 15%,#031422);
}

.water-scene {
  height: 220px;
  position: relative;
  overflow: hidden;
  border-radius: 28px;
  background: #06131e;
}

.waterline {
  position: absolute;
  top: 0;
  transition: transform 800ms linear;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(#065980,#08213f);
  border-top: 3px solid #32CFFF;
}

.depth-reading {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  flex-direction: column;
  padding-top: 24px;
}

.depth-reading strong {
  font-size: max(18px, calc(80px * var(--text-size, 1)));
  line-height: 1.3;
  letter-spacing: -4px;
}

.depth-reading small {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  font-weight: 500;
  margin-left: 8px;
}

.cyan {
  color: #36CFFF;
}

.readings {
  margin: 16px 0;
}

.readings>div {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
}

.readings strong {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.dive-button {
  background: #00C8FF !important;
  color: #001421 !important;
}

.safety {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #FFD60A;
  margin-top: 16px;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.safety strong {
  font-size: max(18px, calc(45px * var(--text-size, 1)));
}

.watch-button {
  margin-bottom: 12px;
}

.water-scene {
  height: 172px;
}

.depth-reading {
  padding: 16px 12px;
  gap: 6px;
}

.depth-reading strong {
  font-size: 70px;
  line-height: 1.2;
}

.depth-reading .muted {
  background: #031422cc;
  border-radius: 12px;
  padding: 4px 8px;
  text-align: center;
}

.readings {
  margin: 12px 0;
}

.readings > div {
  min-height: 42px;
}

.waterline {
  transition: transform 300ms ease;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #00C8FF; }

.water-scene { height:auto; min-height:242px; }
.depth-reading { padding:20px 18px; gap:8px; }
.depth-reading strong { display:flex; align-items:baseline; gap:6px; font-size:80px; font-weight:600; line-height:1.2; }
.depth-reading strong small { font-size:26px; font-weight:600; margin:0; }
.depth-reading .muted { line-height:1.3; max-width:100%; }
.readings > div { min-height:76px; gap:12px; }
</style>
