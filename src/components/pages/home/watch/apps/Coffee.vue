<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const confirming = ref(false);
const timestamp = computed(() => watch.now.value.getTime());
const cupsToday = computed(() => watch.fun.coffeeTimes.filter(time => new Date(time).toDateString() === watch.now.value.toDateString()).length);
function caffeineAt(time: number) {
  return watch.fun.coffeeTimes.reduce((sum, cup) => sum + (cup <= time ? 80 * 2 ** (-(time - cup) / 18000000) : 0), 0);
}
const remaining = computed(() => Math.round(caffeineAt(timestamp.value)));
const forecast = computed(() => Array.from({ length: 49 }, (_, index) => caffeineAt(timestamp.value + index * 900000)));
const curve = computed(() => {
  const max = Math.max(80, ...forecast.value);
  return forecast.value.map((mg, i) => (i ? 'L' : 'M') + (i / 48 * 320 + 10).toFixed(1) + ',' + (100 - mg / max * 85).toFixed(1)).join(' ');
});
const history = computed(() => watch.fun.coffeeTimes.map((at, index) => ({ at, index })).reverse());
function logCup() {
  watch.fun.coffeeTimes.push(Date.now());
  watch.fun.cups = watch.fun.coffeeTimes.length;
  watch.haptic('success');
  confirming.value = false;
}
function remove(index: number) {
  watch.fun.coffeeTimes.splice(index, 1);
  watch.fun.cups = watch.fun.coffeeTimes.length;
  watch.haptic();
}
function reset() {
  watch.fun.coffeeTimes.splice(0);
  watch.fun.cups = 0;
  confirming.value = false;
}
function stamp(at: number) {
  const date = new Date(at);
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !watch.settings.hour24,
  });
  const isToday = date.toDateString() === watch.now.value.toDateString();
  const day = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return time + (isToday ? '' : ' · ' + day);
}
useWatchHardware('coffee', { action: () => {
    logCup();
    return true;
  }, back: () => {
    if (!confirming.value) return false;
    confirming.value = false;
    return true;
  } });
</script>

<template>
  <section class="watch-app coffee-app">
    <h1>Coffee</h1>
    <div class="cup-count">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d="M67 33h12a16 16 0 0 1 0 32H68M20 32h49v35a19 19 0 0 1-19 19H39a19 19 0 0 1-19-19Z" />
        <path d="M31 22c-8-10 8-11 0-20M48 22c-8-10 8-11 0-20M65 22c-8-10 8-11 0-20" class="steam" />
      </svg>
      <div>
        <strong class="metric">
          {{ cupsToday }}
        </strong>
        <span class="caption muted">cups today</span>
      </div>
    </div>
    <button class="watch-button coffee-button" @click="logCup">+ Log a coffee</button>
    <div class="platter caffeine">
      <div class="row">
        <span>Caffeine left</span>
        <strong>
          {{ remaining }}
          <small>mg</small>
        </strong>
      </div>
      <svg
        viewBox="0 0 340 110"
        role="img"
        aria-label="Illustrative caffeine remaining over the next twelve hours"
      >
        <path d="M10 100H330M10 55H330" class="grid" />
        <path :d="curve" class="curve" />
      </svg>
      <div class="axis caption muted">
        <span>Now</span>
        <span>+6h</span>
        <span>+12h</span>
      </div>
    </div>
    
    <h2>Recent cups</h2>
    <div v-if="!history.length" class="platter caption muted">No coffee yet. A rare calm.</div>
    <div
      v-for="entry in history"
      :key="entry.at + '-' + entry.index"
      class="platter entry"
    >
      <div>
        <strong><WatchGlyph name="coffee" /> Coffee</strong>
        <span class="caption muted">
          {{ stamp(entry.at) }}
        </span>
      </div>
      <button
        class="remove"
        :aria-label="'Remove coffee logged at ' + stamp(entry.at)"
        @click="remove(entry.index)"
      >
        −
      </button>
    </div>
    <template v-if="history.length">
      <button
        v-if="!confirming"
        class="watch-button reset muted"
        @click="confirming = true"
      >Clear coffee log</button>
      <div v-else class="platter">
        <p class="caption">
          Clear all
          {{ history.length }}
          cups?
        </p>
        <div class="button-row">
          <button class="watch-button" @click="confirming = false">Keep</button>
          <button class="watch-button danger" @click="reset">Clear</button>
        </div>
      </div>
    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.coffee-app {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;
}

.coffee-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  margin: 0 0 8px;
}

.cup-count {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin: 15px 0 20px;
}

.cup-count>svg {
  width: 108px;
  height: 108px;
  fill: #c7976a;
  stroke: #c7976a;
  stroke-width: 5;
  stroke-linejoin: round;
}

.cup-count .steam {
  fill: none;
  stroke: #d5b497;
  stroke-width: 4;
  stroke-linecap: round;
}

.cup-count .metric {
  font-size: max(18px, calc(70px * var(--text-size, 1)));
  line-height: 1.2;
  display: block;
}

.cup-count .caption {
  display: block;
  margin-top: 8px;
}

.coffee-button {
  background: #c7976a;
  color: #21140c;
  font-weight: 700;
  margin-bottom: 18px;
}

.caffeine {
  padding: 22px;
}

.caffeine .row {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.caffeine strong {
  color: #d5b497;
  font-size: max(18px, calc(27px * var(--text-size, 1)));
}

.caffeine small {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.caffeine svg {
  display: block;
  width: 100%;
  margin-top: 16px;
}

.grid {
  stroke: #ffffff19;
  stroke-width: 1;
  fill: none;
}

.curve {
  stroke: #c7976a;
  stroke-width: 5;
  stroke-linecap: round;
  fill: none;
}

.axis {
  display: flex;
  justify-content: space-between;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
}

.note {
  text-align: center;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  line-height: 1.3;
  margin: 18px 0 22px;
}

h2 {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  margin: 12px 0;
}

.entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 12px 16px 12px 22px;
}

.entry strong {
  display: block;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
}

.entry .caption {
  display: block;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  margin-top: 6px;
}

.remove {
  min-width: 72px;
  min-height: 72px;
  border: 0;
  border-radius: 50%;
  background: #39332f;
  color: #d5b497;
  font-size: max(18px, calc(31px * var(--text-size, 1)));
}

.remove:focus-visible {
  outline: 4px solid white;
}

.reset {
  margin-top: 10px;
  background: #252220;
}

.cup-count {
  gap: 18px;
  margin: 8px 0 12px;
}

.cup-count > svg {
  width: 84px;
  height: 84px;
}

.caffeine {
  padding: 14px;
}

.caffeine .row {
  margin: 0;
  padding: 10px 12px;
  min-height: 68px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #C7976A; }

.cup-count { gap:18px; }
.cup-count .metric { margin:0; }
.caffeine .row { flex-wrap:wrap; }
.caffeine strong { display:flex; align-items:baseline; gap:6px; font-size:36px; font-weight:600; }
.entry > div { min-width:0; flex:1; }
.entry strong { display:flex; align-items:center; gap:8px; font-size:24px; }
.entry strong :deep(svg) { width:26px; height:26px; }
.entry .remove { flex:0 0 64px; width:64px; height:64px; }
</style>
