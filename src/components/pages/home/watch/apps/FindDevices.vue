<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const devices = [
  {
    id: 1,
    name: 'Demo iPhone',
    glyph: '▯',
    location: 'Studio desk',
    battery: 82,
    x: 212,
    y: 126
  }, {
    id: 2,
    name: 'Demo AirPods',
    glyph: '♬',
    location: 'Imaginary backpack',
    battery: 64,
    x: 126,
    y: 168
  }, {
    id: 3,
    name: 'Demo laptop',
    glyph: '▱',
    location: 'Studio table',
    battery: 95,
    x: 254,
    y: 180
  }
];
const selected = ref<number | null>(null);
const device = computed(() => devices.find(item => item.id === selected.value));
const ringing = ref(false);
const ringAt = ref(0);
const directions = ref(false);
const animate = computed(() => !watch.reducedMotion.value && !watch.dimmed.value);
function ping() {
  ringing.value = !ringing.value;
  ringAt.value = watch.now.value.getTime();
  watch.haptic('success');
}
watchEffect(() => {
  if (ringing.value && watch.now.value.getTime() - ringAt.value > 8000)
    ringing.value = false;
});
function stop() {
  ringing.value = false;
}
onDeactivated(stop);
onBeforeUnmount(stop);
useWatchHardware('findDevices', {
  back: () => {
    if (directions.value) {
      directions.value = false;
      return true;
    }
    if (selected.value !== null) {
      selected.value = null;
      stop();
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root" :class="{ still: !animate }">
    <h1>{{ device ? device.name : 'Find Devices' }}</h1>
    <template v-if="!device">
      
      <button
        v-for="item in devices"
        :key="item.id"
        class="device platter"
        @click="selected = item.id; directions = false"
      >
        <span class="glyph">
          <WatchGlyph :name="item.id === 1 ? 'phone' : item.id === 2 ? 'headphones' : 'laptop'" />
        </span>
        <span>
          <strong>
            {{ item.name }}
          </strong>
          <small>
            {{ item.location }}
          </small>
          <small class="online">Online</small>
        </span>
        <span class="arrow">
          <WatchGlyph name="next" />
        </span>
      </button>
    </template>
    <template v-else>
      <h2>
        {{ device.name }}
      </h2>
      <div class="map">
        <svg
          viewBox="0 0 370 230"
          role="img"
          aria-label="Fictional studio map"
        >
          <rect
            width="370"
            height="230"
            fill="#1c2c25"
          />
          <path d="M0 20H130V105H0 M270 0V100H370 M0 220H95V175H0 M245 145H370V230H245Z" fill="#2b5035" />
          <path
            d="M0 140H370 M185 0V230 M90 0L285 230"
            fill="none"
            stroke="#48524d"
            stroke-width="25"
          />
          <path
            d="M0 140H370 M185 0V230"
            fill="none"
            stroke="#899184"
            stroke-width="2"
          />
          <path
            v-if="directions"
            :d="'M75 140H185V' + device.y + 'H' + device.x"
            fill="none"
            stroke="#56baff"
            stroke-width="8"
            stroke-linecap="round"
          />
          <text
            x="23"
            y="50"
            fill="#a3bca9"
            font-size="18"
          >IMAGINARY PARK</text>
          <text
            x="225"
            y="216"
            fill="#9ca69d"
            font-size="18"
          >STUDIO</text>
          <circle
            cx="75"
            cy="140"
            r="9"
            fill="#0a84ff"
            stroke="white"
            stroke-width="3"
          />
          <circle
            :cx="device.x"
            :cy="device.y"
            r="26"
            fill="#30d15822"
          />
          <circle
            :cx="device.x"
            :cy="device.y"
            r="12"
            fill="#30d158"
            stroke="white"
            stroke-width="3"
          />
        </svg>
        <span class="map-label">DEMO MAP</span>
      </div>
      <div class="row status">
        <span>
          {{ device.location }}
        </span>
        <span class="positive">
          <WatchGlyph name="battery" />
          {{ device.battery }}
          %
        </span>
      </div>
      <div
        v-if="ringing"
        class="ringing"
        role="status"
      >
        <span class="sound">
          <WatchGlyph name="volume" />
        </span>
        <span>Simulated ringing</span>
      </div>
      <p v-if="directions" class="caption route">
        Demo route: follow Studio Lane,
        <br />
        then turn right. 120 imaginary metres.
      </p>
      <button class="watch-button positive" @click="ping">
        {{ ringing ? 'Stop sound preview' : 'Play sound preview' }}
      </button>
      <button
        class="watch-button"
        :aria-pressed="directions"
        @click="directions = !directions"
      >
        {{ directions ? 'Hide demo route' : 'Show demo directions' }}
      </button>
    </template>

    <p class="polish-footnote">Demo data, for fun.</p>
  </div>
</template>

<style scoped>
.root {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}

.root :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  margin: 0 0 18px;
}

h2 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  margin: 8px 0 18px;
}

.device {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 142px;
  margin-bottom: 12px;
  border: 0;
  color: white;
  text-align: left;
}

.glyph {
  font-size: max(18px, calc(53px * var(--text-size, 1)));
  color: #ddd;
  min-width: 55px;
  text-align: center;
}

.device strong {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.device small {
  display: block;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 6px;
}

.device .online {
  color: #30d158;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
}

.arrow {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  color: #888;
  margin-left: auto;
}

.back {
  min-height: 72px;
  border: 0;
  background: none;
  color: #30d158;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  padding: 0;
}

.map {
  position: relative;
  border-radius: 28px;
  overflow: hidden;
  margin-bottom: 16px;
}

.map svg {
  display: block;
  width: 100%;
}

.map-label {
  position: absolute;
  bottom: 12px;
  left: 15px;
  color: #b9c8bd;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  letter-spacing: 2px;
}

.status {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  margin-bottom: 18px;
}

.ringing {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 18px;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  color: #30d158;
  margin-bottom: 18px;
}

.sound {
  font-size: max(18px, calc(34px * var(--text-size, 1)));
  animation: ring .5s infinite alternate;
}

.still .sound {
  animation: none;
}

.route {
  color: #65baff;
  line-height: 1.3;
}

.watch-button {
  margin-bottom: 12px;
}

@keyframes ring {
  to {
    transform: scale(1.2);
    opacity: .5;
  }
}

.device {
  min-height: 108px;
  gap: 12px;
}

.device > span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.device .glyph {
  display: grid;
  place-items: center;
  min-width: 48px;
}

.device .glyph svg {
  width: 42px;
  height: 42px;
}

.device .online {
  color: #69e58b;
}

.map-label {
  font-size: 21px;
  background: #000a;
  padding: 3px 6px;
  letter-spacing: 0.5px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #30D158; }

.device > span:nth-child(2) { min-width:0; flex:1; }
.device strong { font-size:24px; line-height:1.25; }
.arrow { flex:0 0 24px; color:#ffffff59; }
.map { border-radius:30px; }
.map-label { font-size:18px; line-height:1.25; }
.route { padding:16px 0; overflow-wrap:anywhere; }
</style>
