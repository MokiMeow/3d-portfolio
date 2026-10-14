<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from "../watch";
const watch = useWatch();
const running = ref(false);
const startedAt = ref(0);
const banked = ref(0);
const tick = ref(Date.now());
const style = ref<'digital' | 'analogue' | 'graph'>('digital');
const laps = ref<number[]>([]);
const visible = ref(false);
let interval: ReturnType<typeof setInterval> | undefined;
const elapsed = computed(() => banked.value + (running.value ? Math.max(tick.value, watch.now.value.getTime()) - startedAt.value : 0));
const display = computed(() => stamp(elapsed.value));
const lastLap = computed(() => elapsed.value - laps.value.reduce((sum, lap) => sum + lap, 0));
function stamp(ms: number) {
  const centi = Math.floor(ms / 10);
  return String(Math.floor(centi / 6000)).padStart(2, '0') + ':' + String(Math.floor(centi / 100) % 60).padStart(2, '0') + '.' + String(centi % 100).padStart(2, '0');
}
function toggle() {
  const now = Date.now();
  if (running.value) banked.value += now - startedAt.value;else startedAt.value = now;
  tick.value = now;
  running.value = !running.value;
  watch.haptic();
}
function lapOrReset() {
  if (running.value) {
    tick.value = Date.now();
    laps.value.unshift(lastLap.value);
  } else {
    banked.value = 0;
    laps.value = [];
  }
  watch.haptic();
}
function stopUpdates() {
  if (interval) clearInterval(interval);
  interval = undefined;
}
watchEffect(() => {
  const shouldUpdate = visible.value && running.value && watch.activeApp.value === 'stopwatch' && !watch.dimmed.value && !watch.reducedMotion.value;
  if (!shouldUpdate) {
    stopUpdates();
    return;
  }
  if (interval !== undefined) return;
  tick.value = Date.now();
  interval = setInterval(() => {
    tick.value = Date.now();
  }, 31);
});
onMounted(() => {
  visible.value = true;
});
onActivated(() => {
  visible.value = true;
});
onDeactivated(() => {
  visible.value = false;
  stopUpdates();
});
onBeforeUnmount(() => {
  visible.value = false;
  stopUpdates();
});
useWatchHardware('stopwatch', {
  action: () => {
    toggle();
    return true;
  }
});
</script>

<template>
  <section class="watch-app stopwatch-app">
    <h1>Stopwatch</h1>
    <div class="styles" aria-label="Display style">
      <button
        v-for="option in ['digital','analogue','graph'] as const"
        :key="option"
        :class="{chosen:style===option}"
        @click="style=option"
        :aria-label="option + ' display'"
        :aria-pressed="style === option"
      >
        <span v-if="option === 'digital'">123</span>
        <WatchGlyph v-else :name="option === 'analogue' ? 'clock' : 'chart'" />
      </button>
    </div>
    <div v-if="style==='analogue'" class="dial">
      <i
        v-for="n in 60"
        :key="n"
        :class="{major:n%5===0}"
        :style="{transform:'rotate('+n*6+'deg)'}"
      />
      <span class="dial-label">
        {{ Math.floor(elapsed/60000) }}
        min
      </span>
      <b class="hand" :style="{transform:'rotate('+(elapsed/1000%60)*6+'deg)'}" />
      <b class="pin" />
    </div>
    <div
      v-else-if="style==='graph'"
      class="graph"
      aria-label="Lap duration graph"
    >
      <div
        v-for="(lap,index) in laps.slice(0,8).reverse()"
        :key="index"
        :style="{height:Math.max(8,lap/Math.max(...laps,1)*100)+'%'}"
      >
        <span>
          {{index+1}}
        </span>
      </div>
      <p v-if="!laps.length" class="caption muted">Record a lap to see the graph</p>
    </div>
    <div class="elapsed" :class="{compact:style!=='digital'}">
      {{display}}
    </div>
    <div class="button-row">
      <button
        class="watch-button"
        :disabled="!running&&!banked"
        @click="lapOrReset"
      >
        {{running?'Lap':'Reset'}}
      </button>
      <button
        class="watch-button"
        :class="running?'danger':'positive'"
        @click="toggle"
      >
        {{running?'Stop':'Start'}}
      </button>
    </div>
    <div class="laps">
      <div v-if="running" class="row current">
        <span>
          Lap
          {{laps.length+1}}
        </span>
        <span>
          {{stamp(lastLap)}}
        </span>
      </div>
      <div
        v-for="(lap,index) in laps"
        :key="laps.length-index"
        class="row"
      >
        <span>
          Lap
          {{laps.length-index}}
        </span>
        <span>
          {{stamp(lap)}}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.stopwatch-app h1 {
  color: #ff9f0a;
}

.styles {
  display: flex;
  background: #1c1c1e;
  border-radius: 25px;
  padding: 4px;
}

.styles button {
  flex: 1;
  min-height: 72px;
  background: none;
  border: 0;
  color: #888;
  font-size: max(calc(12px / var(--watch-scale)), calc(27px * var(--text-size, 1)));
  border-radius: 22px;
}

.styles .chosen {
  background: #38383b;
  color: #ff9f0a;
}

.elapsed {
  font-size: max(calc(12px / var(--watch-scale)), calc(59px * var(--text-size, 1)));
  font-weight: 300;
  text-align: center;
  letter-spacing: -3px;
  font-variant-numeric: tabular-nums;
  margin: 48px 0 38px;
}

.elapsed.compact {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  letter-spacing: 0;
  margin: 16px 0;
}

.dial {
  position: relative;
  width: 228px;
  height: 228px;
  border-radius: 50%;
  margin: 20px auto 0;
  background: #131313;
}

.dial i {
  position: absolute;
  left: 50%;
  top: 0;
  height: 50%;
  width: 2px;
  transform-origin: bottom;
}

.dial i:before {
  content: '';
  display: block;
  background: #888;
  width: 2px;
  height: 7px;
}

.dial i.major:before {
  height: 16px;
  background: white;
  width: 3px;
}

.dial-label {
  position: absolute;
  top: 65%;
  width: 100%;
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #aaa;
}

.hand {
  position: absolute;
  left: calc(50% - 2px);
  bottom: 50%;
  width: 4px;
  height: 100px;
  background: #ff9f0a;
  transform-origin: bottom;
  border-radius: 4px;
}

.pin {
  position: absolute;
  left: calc(50% - 7px);
  top: calc(50% - 7px);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ff9f0a;
}

.graph {
  height: 200px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 22px 8px;
  margin-top: 18px;
  border-bottom: 1px solid #555;
}

.graph>div {
  background: #ff9f0a;
  flex: 1;
  border-radius: 8px 8px 0 0;
  position: relative;
  min-width: 12px;
}

.graph span {
  position: absolute;
  bottom: -24px;
  width: 100%;
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
}

.graph p {
  align-self: center;
  text-align: center;
}

.laps {
  margin-top: 16px;
  font-variant-numeric: tabular-nums;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.current {
  color: #ff9f0a;
}

.elapsed {
  margin: 32px 0;
}

.styles button svg {
  width: 30px;
  height: 30px;
}
</style>
