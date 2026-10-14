<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware, clamp } from "../watch";
const watch = useWatch();
const connected = ref(true);
const power = ref(true);
const playing = ref(false);
const selected = ref(0);
const screen = ref<'home' | 'media'>('home');
const volume = ref(35);
const muted = ref(false);
const device = ref('Demo TV');
const status = ref('Choose a title');
const titles = ['Ocean', 'Orbit', 'Forest', 'City'];
function move(delta: number) {
  if (!connected.value || !power.value) return;
  selected.value = (selected.value + delta + titles.length) % titles.length;
  status.value = titles[selected.value] + ' selected';
  watch.haptic();
}
function select() {
  if (!connected.value || !power.value) return;
  screen.value = 'media';
  playing.value = true;
  status.value = 'Playing ' + titles[selected.value];
  watch.haptic('success');
}
function back() {
  screen.value = 'home';
  playing.value = false;
  status.value = 'Choose a title';
  watch.haptic();
}
function togglePlay() {
  if (!connected.value || !power.value) return;
  if (screen.value === 'home') select();else {
    playing.value = !playing.value;
    status.value = (playing.value ? 'Playing ' : 'Paused ') + titles[selected.value];
  }
}
useWatchHardware('remote', {
  crown: delta => {
    if (!connected.value || !power.value) return false;
    volume.value = clamp(volume.value + Math.sign(delta) * 5, 0, 100);
    return true;
  }
});
</script>

<template>
  <section class="watch-app remote-app">
    <h1>Remote</h1>
    <label class="device">
      <select v-model="device" aria-label="Demo device">
        <option>Demo TV</option>
        <option>Demo Media Box</option>
      </select>
      <button
        :aria-label="connected?'Disconnect demo device':'Connect demo device'"
        @click="connected=!connected;status=connected?'Connected':'Disconnected'"
      >
        <WatchGlyph name="signal" />
      </button>
    </label>
    <div class="tv" :class="{off:!power||!connected}">
      <template v-if="connected&&power">
        <div v-if="screen==='home'" class="tiles">
          <span
            v-for="(title,index) in titles"
            :key="title"
            :class="{selected:index===selected}"
            :style="{'--tile':index}"
          >
            {{title}}
          </span>
        </div>
        <div v-else class="demo-media">
          <b>
            {{titles[selected]}}
          </b>
          <span>
            <WatchGlyph :name="playing ? 'play' : 'pause'" />
            {{ playing ? 'Playing' : 'Paused' }}
          </span>
        </div>
      </template>
      <span v-else>
        {{!connected?'Disconnected':'Power off'}}
      </span>
    </div>
    <p class="status caption" role="status">
      {{status}}
    </p>
    <div class="dpad" :class="{disabled:!connected||!power}">
      <button
        class="up"
        aria-label="Move up"
        :disabled="!connected||!power"
        @click="move(-2)"
      >
        <WatchGlyph name="up" />
      </button>
      <button
        class="left"
        aria-label="Move left"
        :disabled="!connected||!power"
        @click="move(-1)"
      >
        <WatchGlyph name="back" />
      </button>
      <button
        class="select"
        :disabled="!connected||!power"
        @click="select"
      >Select</button>
      <button
        class="right"
        aria-label="Move right"
        :disabled="!connected||!power"
        @click="move(1)"
      >
        <WatchGlyph name="next" />
      </button>
      <button
        class="down"
        aria-label="Move down"
        :disabled="!connected||!power"
        @click="move(2)"
      >
        <WatchGlyph name="down" />
      </button>
    </div>
    <div class="remote-controls">
      <button :disabled="!connected||!power" @click="back">Back</button>
      <button
        :disabled="!connected||!power"
        :aria-label="playing?'Pause':'Play'"
        @click="togglePlay"
      >
        <WatchGlyph :name="playing ? 'pause' : 'play'" />
      </button>
      <button
        :disabled="!connected"
        :aria-label="power?'Power off':'Power on'"
        @click="power=!power;status=power?'Power on':'Power off'"
      >
        <WatchGlyph name="power" />
      </button>
    </div>
    <div class="volume-controls">
      <button
        aria-label="Decrease volume"
        :disabled="!connected||!power"
        @click="volume=clamp(volume-5,0,100)"
      >
        −
      </button>
      <button :disabled="!connected||!power" @click="muted=!muted">
        {{muted?'Muted':volume+'%'}}
      </button>
      <button
        aria-label="Increase volume"
        :disabled="!connected||!power"
        @click="volume=clamp(volume+5,0,100)"
      >
        ＋
      </button>
    </div>
    <p class="caption muted disclaimer">Local demo controller. No television connection.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.remote-app h1 {
  color: #3c88fe;
}

.device {
  display: flex;
  gap: 10px;
}

.device select {
  flex: 1;
  min-width: 0;
  min-height: 76px;
  border: 0;
  border-radius: 22px;
  background: #1c1c1e;
  color: white;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
  padding: 10px 16px;
}

.device>button {
  width: 72px;
  height: 76px;
  color: #30d158;
  font-size: max(calc(12px / var(--watch-scale)), calc(27px * var(--text-size, 1)));
  background: #1c1c1e;
  border: 0;
  border-radius: 22px;
}

.tv {
  height: 134px;
  border: 5px solid #444;
  border-radius: 18px;
  margin-top: 18px;
  background: #101826;
  display: grid;
  place-items: center;
  padding: 12px;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
}

.tv.off {
  background: #111;
  color: #888;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 6px;
  width: 100%;
  height: 100%;
}

.tiles span {
  display: flex;
  align-items: flex-end;
  padding: 9px 5px;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  background: linear-gradient(160deg,hsl(calc(180 + var(--tile)*50) 50% 42%),#122138);
  border-radius: 8px;
  border: 2px solid transparent;
}

.tiles .selected {
  border-color: white;
  box-shadow: 0 0 12px #ffffff60;
}

.demo-media {
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at 75% 0,#5eb4b67a,transparent 70%),linear-gradient(30deg,#26365b,#192324);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.demo-media b {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
}

.demo-media span {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #bbb;
}

.status {
  text-align: center;
  margin: 14px 0;
  color: #7cafff;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.dpad {
  position: relative;
  border-radius: 50%;
  width: 270px;
  height: 270px;
  background: #212126;
  margin: 0 auto;
}

.dpad button {
  position: absolute;
  width: 84px;
  height: 84px;
  border: 0;
  background: none;
  color: #ccc;
  font-size: max(calc(12px / var(--watch-scale)), calc(35px * var(--text-size, 1)));
  border-radius: 50%;
}

.dpad .up {
  left: 93px;
  top: 0;
}

.dpad .down {
  left: 93px;
  bottom: 0;
}

.dpad .left {
  left: 0;
  top: 93px;
}

.dpad .right {
  right: 0;
  top: 93px;
}

.dpad .select {
  left: 93px;
  top: 93px;
  background: #44444a;
  color: white;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.remote-controls,
.volume-controls {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.remote-controls button,
.volume-controls button {
  flex: 1;
  min-height: 80px;
  min-width: 0;
  border: 0;
  background: #252529;
  color: white;
  border-radius: 40px;
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.remote-controls button:first-child {
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
}

.volume-controls button:nth-child(2) {
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.disabled {
  opacity: .5;
}

.disclaimer {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  line-height: 1.4;
}

.tv {
  height: 94px;
  margin-top: 12px;
  padding: 6px;
}

.tiles span {
  font-size: 21px;
  padding: 5px 2px;
}

.dpad {
  width: 222px;
  height: 222px;
}

.dpad button {
  width: 74px;
  height: 74px;
}

.dpad .up {
  left: 74px;
}

.dpad .down {
  left: 74px;
}

.dpad .left {
  top: 74px;
}

.dpad .right {
  top: 74px;
}

.dpad .select {
  top: 74px;
  left: 74px;
}

.status {
  margin: 8px 0;
}
</style>
