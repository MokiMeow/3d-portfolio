<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware, type ActionId } from '../watch';
import WatchIcon from '../WatchIcon.vue';
import WristRoll from './AppWristRoll.vue';
const watch = useWatch();
type Page = 'main' | 'about' | 'general' | 'display' | 'sounds' | 'appView' | 'action' | 'clock' | 'band' | 'reset';
const page = ref<Page>('main');
const wristRoll = ref(false);
const tapCount = ref(0);
let lastTap = 0;
const items: {
  page: Page;
  title: string;
  icon: 'info' | 'settings' | 'sun' | 'volume' | 'grid' | 'bolt' | 'clock' | 'watch';
}[] = [{
  page: 'about',
  title: 'About',
  icon: 'info'
}, {
  page: 'general',
  title: 'General',
  icon: 'settings'
}, {
  page: 'display',
  title: 'Display & Brightness',
  icon: 'sun'
}, {
  page: 'sounds',
  title: 'Sounds & Haptics',
  icon: 'volume'
}, {
  page: 'appView',
  title: 'App View',
  icon: 'grid'
}, {
  page: 'action',
  title: 'Action Button',
  icon: 'bolt'
}, {
  page: 'clock',
  title: 'Clock',
  icon: 'clock'
}, {
  page: 'band',
  title: 'Band & Case',
  icon: 'watch'
}];
const actions: {
  id: ActionId;
  name: string;
}[] = [{
  id: 'workout',
  name: 'Workout'
}, {
  id: 'stopwatch',
  name: 'Stopwatch'
}, {
  id: 'waypoint',
  name: 'Waypoint'
}, {
  id: 'backtrack',
  name: 'Backtrack'
}, {
  id: 'depth',
  name: 'Dive'
}, {
  id: 'flashlight',
  name: 'Flashlight'
}, {
  id: 'deploy',
  name: 'Shortcut: Deploy'
}];
const bands = [{
  color: '#DE6A2B',
  name: 'Orange'
}, {
  color: '#535849',
  name: 'Dark Olive'
}, {
  color: '#B8A68B',
  name: 'Desert'
}, {
  color: '#683A43',
  name: 'Burgundy'
}, {
  color: '#D2D2CC',
  name: 'Starlight'
}, {
  color: '#353432',
  name: 'Charcoal'
}];
const title = computed(() => items.find(item => item.page === page.value)?.title ?? (page.value === 'reset' ? 'Reset Watch' : 'Settings'));
function goBack(): boolean {
  if (wristRoll.value) {
    wristRoll.value = false;
    return true;
  }
  if (page.value !== 'main') {
    page.value = 'main';
    return true;
  }
  return false;
}
function versionTap(): void {
  const current = Date.now();
  tapCount.value = current - lastTap < 1100 ? tapCount.value + 1 : 1;
  lastTap = current;
  watch.haptic();
  if (tapCount.value >= 7) {
    tapCount.value = 0;
    wristRoll.value = true;
  }
}
useWatchHardware('settings', {
  back: goBack
});
</script>

<template>
  <section class="watch-app settings-app" data-watch-scroll>
    <h1>{{ wristRoll ? 'Wrist Roll' : title }}</h1>
    <WristRoll v-if="wristRoll" @close="wristRoll = false" />
    <template v-else>

      <template v-if="page === 'main'">
        <div class="settings-intro">
          <WatchIcon name="settings" :size="66" />
          <span>A little wrist administration.</span>
        </div>
        <button
          v-for="item in items"
          :key="item.page"
          class="row"
          @click="page = item.page"
        >
          <span class="setting-symbol">
            <WatchGlyph :name="item.icon" />
          </span>
          <span>
            {{ item.title }}
          </span>
          <b>
            <WatchGlyph name="next" />
          </b>
        </button>
        <button
          class="row"
          :aria-pressed="watch.settings.nightMode"
          @click="watch.settings.nightMode = !watch.settings.nightMode"
        >
          <span class="setting-symbol red">
            <WatchGlyph name="moon" />
          </span>
          <span>Night Mode</span>
          <i class="toggle" :class="{ on: watch.settings.nightMode }" />
        </button>
        <button class="row" @click="page = 'reset'">
          <span class="setting-symbol red">
            <WatchGlyph name="reset" />
          </span>
          <span>Reset</span>
          <b>
            <WatchGlyph name="next" />
          </b>
        </button>
      </template>
      <template v-else-if="page === 'about'">
        <div class="about-watch" aria-hidden="true">
          <i />
          <span>ULTRA</span>
          <i />
        </div>
        <div class="info-row">
          <span>Model</span>
          <b>Apple Watch Ultra</b>
        </div>
        <div class="info-row">
          <span>Case</span>
          <b>49 mm titanium</b>
        </div>
        <button
          class="version info-row"
          aria-label="watchOS version, tap seven times quickly for a surprise"
          @click="versionTap"
        >
          <span>Version</span>
          <b>watchOS 11</b>
        </button>
        <div class="info-row">
          <span>Display</span>
          <b>422 × 514</b>
        </div>
        <div class="info-row">
          <span>Storage</span>
          <b>64 GB · simulated</b>
        </div>
        
      </template>
      <template v-else-if="page === 'general'">
        <div class="platter">
          <b>Date & Time</b>
          <p>
            {{ watch.now.value.toLocaleDateString([], { dateStyle: 'long' }) }}
          </p>
          <p class="caption muted">Uses this browser's clock and time zone.</p>
        </div>
        <button
          class="row"
          :aria-pressed="watch.settings.charging"
          @click="watch.settings.charging = !watch.settings.charging"
        >
          <span>On charger</span>
          <i class="toggle" :class="{ on: watch.settings.charging }" />
        </button>
        <button
          class="row"
          :aria-pressed="watch.settings.wifi"
          @click="watch.settings.wifi = !watch.settings.wifi"
        >
          <span>Wi-Fi demo</span>
          <i class="toggle" :class="{ on: watch.settings.wifi }" />
        </button>
        <button
          class="row"
          :aria-pressed="watch.settings.airplane"
          @click="watch.settings.airplane = !watch.settings.airplane"
        >
          <span>Airplane Mode</span>
          <i class="toggle" :class="{ on: watch.settings.airplane }" />
        </button>
        <button class="watch-button" @click="watch.overlay('power')">Power controls</button>
        <button class="watch-button" @click="page = 'reset'">Reset</button>
      </template>
      <template v-else-if="page === 'display'">
        <label class="platter slider-setting">
          <span>Brightness</span>
          <b>
            {{ Math.round(watch.settings.brightness * 100) }}
            %
          </b>
          <input
            v-model.number="watch.settings.brightness"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            aria-label="Screen brightness"
          />
        </label>
        <button
          class="row"
          :aria-pressed="watch.settings.alwaysOn"
          @click="watch.settings.alwaysOn = !watch.settings.alwaysOn"
        >
          <span>Always On</span>
          <i class="toggle" :class="{ on: watch.settings.alwaysOn }" />
        </button>
        <p class="caption muted">After 25 seconds the display rests. Touch or turn the crown to wake it.</p>
        <label class="platter slider-setting">
          Text Size
          <input
            v-model.number="watch.settings.textSize"
            type="range"
            min="0.85"
            max="1.15"
            step="0.05"
            aria-label="Text size"
          />
        </label>
        <div class="platter caption">Motion follows your device's reduced-motion preference.</div>
      </template>
      <template v-else-if="page === 'sounds'">
        <button
          class="row"
          :aria-pressed="watch.settings.sound"
          @click="watch.settings.sound = !watch.settings.sound"
        >
          <span>Sounds</span>
          <i class="toggle" :class="{ on: watch.settings.sound }" />
        </button>
        <label class="platter slider-setting">
          Volume
          <input
            v-model.number="watch.playback.volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Sound volume"
          />
        </label>
        <button
          class="row"
          :aria-pressed="watch.settings.haptics"
          @click="watch.settings.haptics = !watch.settings.haptics"
        >
          <span>Haptic Alerts</span>
          <i class="toggle" :class="{ on: watch.settings.haptics }" />
        </button>
        <button class="watch-button" @click="watch.haptic('success')">Try a wrist tap</button>
        <p class="caption muted">Vibration depends on your browser and device. Audio begins only after an explicit action.</p>
      </template>
      <template v-else-if="page === 'appView'">
        <button
          class="row"
          :aria-pressed="watch.settings.appView === 'grid'"
          @click="watch.settings.appView = 'grid'"
        >
          <span>
            <WatchGlyph name="grid" />
            Grid View
          </span>
          <b>
            {{ watch.settings.appView === 'grid' ? '✓' : '' }}
          </b>
        </button>
        <button
          class="row"
          :aria-pressed="watch.settings.appView === 'list'"
          @click="watch.settings.appView = 'list'"
        >
          <span>
            <WatchGlyph name="list" />
            List View
          </span>
          <b>
            {{ watch.settings.appView === 'list' ? '✓' : '' }}
          </b>
        </button>
        <p class="caption muted">Turn the Digital Crown to zoom the grid or scroll the list.</p>
        <button class="watch-button" @click="watch.back(); watch.back()">Show apps</button>
      </template>
      <template v-else-if="page === 'action'">
        <div class="action-example" aria-hidden="true" />
        <p class="caption muted">Choose what the orange button starts.</p>
        <button
          v-for="action in actions"
          :key="action.id"
          class="row"
          :aria-pressed="watch.settings.action === action.id"
          @click="watch.settings.action = action.id"
        >
          <span>
            {{ action.name }}
          </span>
          <b class="orange">
            {{ watch.settings.action === action.id ? '✓' : '' }}
          </b>
        </button>
        <p class="caption muted">Hold for two seconds to open Siren. Siren audio needs a deliberate hold on its screen.</p>
      </template>
      <template v-else-if="page === 'clock'">
        <button
          class="row"
          :aria-pressed="watch.settings.hour24"
          @click="watch.settings.hour24 = !watch.settings.hour24"
        >
          <span>24-Hour Time</span>
          <i class="toggle" :class="{ on: watch.settings.hour24 }" />
        </button>
        <button
          class="row"
          :aria-pressed="watch.settings.seconds"
          @click="watch.settings.seconds = !watch.settings.seconds"
        >
          <span>Show Seconds</span>
          <i class="toggle" :class="{ on: watch.settings.seconds }" />
        </button>
        <label class="platter slider-setting">
          Ultra bezel
          <select v-model="watch.settings.bezel" aria-label="Ultra bezel information">
            <option value="seconds">Seconds</option>
            <option value="elevation">Elevation</option>
            <option value="depth">Depth</option>
          </select>
        </label>
        <button class="watch-button" @click="watch.overlay('gallery')">Faces & Accents</button>
      </template>
      <template v-else-if="page === 'band'">
        <p class="caption muted">Alpine Loop colour</p>
        <button
          v-for="band in bands"
          :key="band.color"
          class="row"
          :aria-pressed="watch.settings.band === band.color"
          @click="watch.settings.band = band.color"
        >
          <i class="band-swatch" :style="{ backgroundColor: band.color }" />
          <span>
            {{ band.name }}
          </span>
          <b>
            {{ watch.settings.band === band.color ? '✓' : '' }}
          </b>
        </button>
        <h2>Titanium Case</h2>
        <button
          class="row"
          :aria-pressed="watch.settings.case === 'natural'"
          @click="watch.settings.case = 'natural'"
        >
          <i class="case-swatch natural" />
          <span>Natural</span>
          <b>
            {{ watch.settings.case === 'natural' ? '✓' : '' }}
          </b>
        </button>
        <button
          class="row"
          :aria-pressed="watch.settings.case === 'black'"
          @click="watch.settings.case = 'black'"
        >
          <i class="case-swatch black" />
          <span>Black</span>
          <b>
            {{ watch.settings.case === 'black' ? '✓' : '' }}
          </b>
        </button>
      </template>
      <template v-else-if="page === 'reset'">
        <div class="platter">
          <b>A fresh wrist</b>
          <p>Reset settings, rings, coffee, scores and build history saved by this watch.</p>
          <p class="caption muted">Other portfolio devices are unaffected.</p>
        </div>
        <button class="watch-button danger" @click="watch.reset(); page = 'main'">Reset Watch</button>
        <button class="watch-button" @click="page = 'main'">Keep my wrist</button>
      </template>
    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.settings-app {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.settings-app :deep(*) {
  font-family: inherit;
}

.back-button {
  display: block;
  min-height: 72px;
  width: 100%;
  text-align: left;
  color: #65b4ff;
  border: 0;
  background: transparent;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.settings-intro {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  color: #bbb;
}

.settings-intro :deep(svg) {
  flex-shrink: 0;
}

.setting-symbol {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 15px;
  background: #37373c;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.setting-symbol.red {
  color: #ff625a;
}

.row > span:nth-child(2) {
  margin: 0;
  flex: 1;
}

.row b {
  color: #919198;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.toggle {
  position: relative;
  width: 72px;
  height: 44px;
  border-radius: 24px;
  background: #55555d;
  flex-shrink: 0;
  margin-left: auto;
}

.toggle::before {
  content: '';
  position: absolute;
  top: 5px;
  left: 5px;
  width: 34px;
  height: 34px;
  background: #fff;
  border-radius: 50%;
  transition: transform 150ms;
}

.toggle.on {
  background: #30d158;
}

.toggle.on::before {
  transform: translateX(28px);
}

.about-watch {
  display: flex;
  align-items: center;
  flex-direction: column;
  margin: 24px auto;
  width: 148px;
  height: 172px;
  border: 7px solid #b7b2a9;
  border-radius: 40px;
  background: #000;
  justify-content: center;
  gap: 16px;
  box-shadow: 0 0 0 2px #5a5752;
}

.about-watch span {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #ff6a13;
  letter-spacing: 4px;
}

.about-watch i {
  width: 64px;
  height: 4px;
  background: #777;
}

.info-row {
  display: block;
  width: 100%;
  padding: 20px 12px;
  min-height: 84px;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid #333;
}

.info-row span {
  display: block;
  color: #b4b4bb;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
}

.info-row b {
  display: block;
  margin-top: 6px;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  font-weight: 500;
}

.version:active {
  background: #252528;
}

.slider-setting {
  display: block;
}

.slider-setting b {
  float: right;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  color: #aaa;
}

.slider-setting select {
  display: block;
  margin-top: 18px;
}

.action-example {
  width: 100px;
  height: 48px;
  margin: 30px auto;
  background: linear-gradient(#ff903d, #ff6a13 45%, #aa3800);
  border: 3px solid #ffad59;
  border-radius: 16px;
  box-shadow: 0 3px 0 #742805;
}

.row b.orange {
  color: #ff9f0a;
}

.band-swatch {
  width: 50px;
  height: 66px;
  border-radius: 12px;
  border: 2px solid #ffffff60;
  flex-shrink: 0;
  background-image: repeating-linear-gradient(0deg, #0004 0 4px, transparent 4px 9px);
}

.case-swatch {
  width: 54px;
  height: 60px;
  border: 6px solid;
  border-radius: 18px;
  background: #000;
  flex-shrink: 0;
}

.case-swatch.natural {
  border-color: #aaa59c;
}

.case-swatch.black {
  border-color: #454541;
}

.settings-intro {
  margin-bottom: 12px;
  gap: 12px;
}

.setting-symbol {
  width: 42px;
  height: 42px;
  border-radius: 12px;
}

.setting-symbol svg {
  width: 28px;
  height: 28px;
}

.settings-app .row {
  gap: 12px;
}

.settings-app .row > span:nth-child(2) {
  font-size: 25px;
}

.toggle::before {
  transition: transform 240ms ease;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #AEAEB2; }

.settings-app .row { min-height:76px; border-radius:30px; background:#1c1c1e; padding:18px 20px; }
.settings-app .row > span { min-width:0; }
.settings-app .row > span:nth-child(2) { font-size:24px; line-height:1.25; }
.settings-app .row b { color:#ffffff59; }
.info-row { background:#1c1c1e; border:0; border-radius:30px; margin-bottom:10px; padding:18px 20px; }
.info-row b { font-size:24px; line-height:1.25; overflow-wrap:anywhere; }
.slider-setting { font-size:24px; line-height:1.25; }
.toggle::before { transition:transform 160ms ease; }
</style>
