<script setup lang="ts">
import WatchGlyph from "./WatchGlyph.vue";
import { useWatch, timeText, type FaceId, type OverlayId } from './watch';
import WatchIcon from './WatchIcon.vue';
import ActivityRings from './ActivityRings.vue';
const props = defineProps<{
  kind: Exclude<OverlayId, null>;
}>();
const watch = useWatch();
const detail = ref<'main' | 'medical' | 'sos' | 'airplay' | 'edit'>('main');
const powerSliders = reactive({
  off: 0,
  medical: 0,
  sos: 0,
  backtrack: 0
});
const answer = ref(0);
const replies = [
  'I checked your wrist. The bug is probably one level up the stack.',
  'You have 43 apps and one wrist. I admire the confidence.',
  'Deploy on Friday? I am a simulated assistant, but even I have boundaries.',
  'Your next meeting is with a glass of water. It accepts walk-ins.',
];
const faces: {
  id: FaceId;
  name: string;
  sample: string;
}[] = [{
  id: 'wayfinder',
  name: 'Wayfinder',
  sample: '◉'
}, {
  id: 'modularUltra',
  name: 'Modular Ultra',
  sample: '10:09'
}, {
  id: 'waypoint',
  name: 'Waypoint',
  sample: '042°'
}, {
  id: 'activityDigital',
  name: 'Activity Digital',
  sample: '◎'
}, {
  id: 'utility',
  name: 'Utility',
  sample: 'Ⅻ'
}, {
  id: 'deploy',
  name: 'Deploy',
  sample: '✓ main'
}];
const accents = ['#FF6A13', '#A6FF00', '#00E0D6', '#6CAFFF', '#FF5E8E', '#FFFFFF'];
const currentFace = computed(() => faces.find(face => face.id === watch.settings.face)?.name);
watchEffect(() => {
  void props.kind;
  detail.value = 'main';
});
function slider(action: keyof typeof powerSliders): void {
  if (powerSliders[action] < 96) return;
  powerSliders[action] = 0;
  if (action === 'off') watch.powerOff();
  if (action === 'medical') detail.value = 'medical';
  if (action === 'sos') detail.value = 'sos';
  if (action === 'backtrack') {
    watch.navigation.request = 'backtrack';
    watch.open('compass');
  }
}
function pickFace(face: FaceId): void {
  watch.settings.face = face;
  watch.haptic();
}
function airplay(): void {
  detail.value = 'airplay';
}
</script>

<template>
  <section
    class="watch-overlay"
    data-watch-scroll
    :aria-label="kind + ' panel'"
  >
    <header class="overlay-header">
      <button
        class="dismiss"
        aria-label="Close panel"
        @click="watch.overlay(null)"
      >
        <WatchGlyph name="down" />
      </button>
      <span>
        {{ timeText(watch.now.value, watch.settings.hour24) }}
      </span>
    </header>
    <template v-if="kind === 'control'">
      <h1>Control Centre</h1>
      <template v-if="detail === 'airplay'">
        <p class="muted caption">Simulated audio output</p>
        <button class="watch-button positive" @click="detail = 'main'">
          <WatchGlyph name="check" />
          Watch speaker
        </button>
        <button
          class="watch-button"
          @click="detail = 'main'; watch.notify({ app: 'music', title: 'Demo output', text: 'The imaginary headphones are connected.' })"
        >
          Imaginary headphones
        </button>
      </template>
      <div v-else class="control-grid">
        <button
          class="tile battery"
          :class="{ enabled: watch.settings.lowPower }"
          :aria-pressed="watch.settings.lowPower"
          @click="watch.settings.lowPower = !watch.settings.lowPower"
        >
          <b>87%</b>
          <small>
            {{ watch.settings.lowPower ? 'Low Power on' : 'Battery' }}
          </small>
        </button>
        <button
          class="tile"
          :class="{ enabled: watch.settings.wifi }"
          :aria-pressed="watch.settings.wifi"
          @click="watch.settings.wifi = !watch.settings.wifi"
        >
          <b>
            <WatchGlyph name="wifi" />
          </b>
          <small>
            Wi-Fi
            {{ watch.settings.wifi ? 'on' : 'off' }}
          </small>
        </button>
        <button
          class="tile"
          :class="{ enabled: watch.settings.airplane }"
          :aria-pressed="watch.settings.airplane"
          @click="watch.settings.airplane = !watch.settings.airplane"
        >
          <b>
            <WatchGlyph name="airplane" />
          </b>
          <small>Airplane</small>
        </button>
        <button
          class="tile"
          :class="{ enabled: watch.settings.focus }"
          :aria-pressed="watch.settings.focus"
          @click="watch.settings.focus = !watch.settings.focus"
        >
          <b>
            <WatchGlyph name="moon" />
          </b>
          <small>
            Focus
            {{ watch.settings.focus ? 'on' : 'off' }}
          </small>
        </button>
        <button class="tile" @click="watch.open('findDevices')">
          <WatchIcon name="findDevices" />
          <small>Ping iPhone</small>
        </button>
        <button class="tile" @click="watch.open('flashlight')">
          <WatchIcon name="flashlight" />
          <small>Flashlight</small>
        </button>
        <button
          class="tile"
          :class="{ enabled: !watch.settings.sound }"
          :aria-pressed="!watch.settings.sound"
          @click="watch.settings.sound = !watch.settings.sound"
        >
          <b>
            <WatchGlyph name="volume" />
          </b>
          <small>
            {{ watch.settings.sound ? 'Sound on' : 'Silent' }}
          </small>
        </button>
        <button class="tile" @click="watch.overlay('waterLock')">
          <b>
            <WatchGlyph name="water" />
          </b>
          <small>Water Lock</small>
        </button>
        <button
          class="tile"
          :class="{ enabled: watch.settings.theatre }"
          :aria-pressed="watch.settings.theatre"
          @click="watch.settings.theatre = !watch.settings.theatre"
        >
          <b>
            <WatchGlyph name="theatre" />
          </b>
          <small>Theatre</small>
        </button>
        <button
          class="tile night"
          :class="{ enabled: watch.settings.nightMode }"
          :aria-pressed="watch.settings.nightMode"
          @click="watch.settings.nightMode = !watch.settings.nightMode"
        >
          <b>
            <WatchGlyph name="moon" />
          </b>
          <small>Night Mode</small>
        </button>
        <button class="tile" @click="airplay">
          <b>
            <WatchGlyph name="airplay" />
          </b>
          <small>AirPlay demo</small>
        </button>
        <button
          class="tile"
          :class="{ enabled: watch.settings.charging }"
          :aria-pressed="watch.settings.charging"
          @click="watch.settings.charging = !watch.settings.charging"
        >
          <b>
            <WatchGlyph name="bolt" />
          </b>
          <small>
            {{ watch.settings.charging ? 'On charger' : 'Off charger' }}
          </small>
        </button>
      </div>
      <label class="platter range-label">
        Volume
        <input
          v-model.number="watch.playback.volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label="Volume"
        />
      </label>
      <label class="platter range-label">
        Text size
        <input
          v-model.number="watch.settings.textSize"
          type="range"
          min="0.85"
          max="1.15"
          step="0.05"
          aria-label="Text size"
        />
      </label>
      <button class="watch-button" @click="watch.open('settings')">Edit in Settings</button>
    </template>
    <template v-else-if="kind === 'notifications'">
      <h1>Notifications</h1>
      <p v-if="!watch.notifications.value.length" class="empty">
        All caught up.
        <br />
        Your wrist approves.
      </p>
      <article
        v-for="note in watch.notifications.value"
        :key="note.id"
        class="notification platter"
      >
        <button class="note-open" @click="watch.open(note.app)">
          <WatchIcon :name="note.app" :size="56" />
          <span>
            <b>
              {{ note.title }}
            </b>
            <small>
              {{ note.text }}
            </small>
          </span>
        </button>
        <button
          class="note-clear"
          :aria-label="'Dismiss ' + note.title"
          @click="watch.notifications.value = watch.notifications.value.filter(item => item.id !== note.id)"
        >
          <WatchGlyph name="close" />
        </button>
      </article>
      <button
        v-if="watch.notifications.value.length"
        class="watch-button"
        @click="watch.notifications.value = []"
      >
        Clear All
      </button>
    </template>
    <template v-else-if="kind === 'stack'">
      <div class="stack-date">
        {{ watch.now.value.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) }}
      </div>
      <div class="stack-time">
        {{ timeText(watch.now.value, watch.settings.hour24) }}
      </div>
      <button class="stack-card weather-card" @click="watch.open('weather')">
        <span>Demo weather · Bengaluru</span>
        <strong>26° ☀</strong>
        <small>A fine day to leave the desk.</small>
      </button>
      <button class="stack-card ring-card" @click="watch.open('activity')">
        <ActivityRings
          :size="102"
          :move="watch.health.move / watch.health.goals.move"
          :exercise="watch.health.exercise / watch.health.goals.exercise"
          :stand="watch.health.stand / watch.health.goals.stand"
        />
        <span>
          <b>Activity</b>
          <small>
            {{ Math.round(watch.health.move) }}
            cal ·
            {{ Math.round(watch.health.exercise) }}
            min
          </small>
        </span>
      </button>
      <button class="stack-card" @click="watch.open('calendar')">
        <span>UP NEXT</span>
        <strong>Stretch break</strong>
        <small>No agenda. Excellent meeting.</small>
      </button>
      <button class="stack-card" @click="watch.open('nowPlaying')">
        <span>NOW PLAYING · SIMULATED</span>
        <strong>
          {{ watch.playback.playing ? 'A small soundtrack' : 'Quiet is also a playlist' }}
        </strong>
        <small>Tap for playback controls</small>
      </button>
      <button class="watch-button" @click="watch.open('coffee')">
        Coffee check-in ·
        {{ watch.fun.cups }}
        cups
      </button>
    </template>
    <template v-else-if="kind === 'power'">
      <template v-if="detail === 'medical'">
        <h1>Medical ID</h1>
        <div class="platter">
          <b>Demo profile</b>
          <p>No personal medical information is stored here.</p>
        </div>
        <button class="watch-button" @click="detail = 'main'">Back to power controls</button>
      </template>
      <template v-else-if="detail === 'sos'">
        <h1>Emergency SOS</h1>
        <div class="platter">
          <b>Demo only</b>
          <p>The only emergency is an uncommitted change.</p>
          <p class="caption muted">No calls are placed and no location is sent.</p>
        </div>
        <button class="watch-button" @click="detail = 'main'">Cancel</button>
      </template>
      <template v-else>
        <h1>Power controls</h1>
        <label class="power-slider">
          Power Off
          <input
            v-model.number="powerSliders.off"
            type="range"
            min="0"
            max="100"
            aria-label="Slide to power off"
            @input="slider('off')"
          />
        </label>
        <label class="power-slider">
          Medical ID
          <input
            v-model.number="powerSliders.medical"
            type="range"
            min="0"
            max="100"
            aria-label="Slide to show simulated Medical ID"
            @input="slider('medical')"
          />
        </label>
        <label class="power-slider sos-slider">
          Emergency SOS
          <input
            v-model.number="powerSliders.sos"
            type="range"
            min="0"
            max="100"
            aria-label="Slide to open simulated SOS"
            @input="slider('sos')"
          />
        </label>
        <label class="power-slider">
          Compass Backtrack
          <input
            v-model.number="powerSliders.backtrack"
            type="range"
            min="0"
            max="100"
            aria-label="Slide to start Backtrack"
            @input="slider('backtrack')"
          />
        </label>
        <p class="caption muted">Slide all the way right. Side button boots the watch after power off.</p>
      </template>
    </template>
    <template v-else-if="kind === 'siri'">
      <h1 class="siri-title">Siri simulation</h1>
      <div
        class="siri-orb"
        :class="{ still: watch.dimmed.value || watch.reducedMotion.value }"
        aria-hidden="true"
      />
      <p class="siri-answer" aria-live="polite">
        {{ replies[answer % replies.length] }}
      </p>
      <button class="watch-button" @click="answer++">Ask for wrist wisdom</button>
    </template>
    <template v-else-if="kind === 'gallery'">
      <h1>
        {{ detail === 'edit' ? 'Edit ' + currentFace : 'Face Gallery' }}
      </h1>
      <template v-if="detail !== 'edit'">
        <button
          v-for="face in faces"
          :key="face.id"
          class="gallery-card"
          :class="{ selected: watch.settings.face === face.id }"
          @click="pickFace(face.id)"
        >
          <span class="face-sample" :style="{ color: watch.settings.accent }">
            {{ face.sample }}
          </span>
          <span>
            {{ face.name }}
            <small>
              {{ watch.settings.face === face.id ? 'Selected ✓' : 'Tap to select' }}
            </small>
          </span>
        </button>
        <div class="button-row">
          <button class="watch-button" @click="detail = 'edit'">Edit</button>
          <button class="watch-button positive" @click="watch.overlay(null)">Done</button>
        </div>
      </template>
      <template v-else>
        <p class="caption muted">Accent colour</p>
        <div class="accents">
          <button
            v-for="accent in accents"
            :key="accent"
            :style="{ background: accent }"
            :aria-label="'Use accent ' + accent"
            :aria-pressed="watch.settings.accent === accent"
            @click="watch.settings.accent = accent"
          >
            <span v-if="watch.settings.accent === accent">✓</span>
          </button>
        </div>
        <label class="range-label platter">
          Modular Ultra bezel
          <select v-model="watch.settings.bezel" aria-label="Bezel information">
            <option value="seconds">Seconds</option>
            <option value="elevation">Elevation</option>
            <option value="depth">Depth</option>
          </select>
        </label>
        <button class="watch-button" @click="watch.settings.seconds = !watch.settings.seconds">
          Seconds
          {{ watch.settings.seconds ? 'on' : 'off' }}
        </button>
        <button class="watch-button positive" @click="watch.overlay(null)">Done</button>
      </template>
    </template>
    <template v-else-if="kind === 'waterLock'">
      <div class="water-symbol" aria-hidden="true">
        <WatchGlyph name="water" />
      </div>
      <h1>Water Lock</h1>
      <p class="muted">Press and hold the Digital Crown to unlock.</p>
      <p class="caption muted">The water is simulated. The button still works.</p>
      <button class="watch-button" @click="watch.overlay(null); watch.haptic('success')">Unlock</button>
    </template>
  </section>
</template>

<style scoped>
.watch-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 70px 24px 38px;
  background: #050507f5;
  font-size: 32px;
  line-height: 1.25;
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.watch-overlay :deep(*) {
  font-family: inherit;
}

.overlay-header {
  position: absolute;
  top: 9px;
  left: 24px;
  right: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 27px;
}

.dismiss {
  width: 74px;
  height: 60px;
  border: 0;
  background: #ffffff16;
  border-radius: 34px;
  font-size: 42px;
}

h1 {
  font-size: 36px;
  margin: 8px 0 22px;
}

.control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 128px;
  border: 1px solid #ffffff35;
  border-radius: 42px;
  background: linear-gradient(140deg, #ffffff24, #ffffff05), #242427;
}

.tile b {
  font-size: 46px;
  font-weight: 550;
}

.tile small {
  font-size: 24px;
}

.tile :deep(svg) {
  width: 58px;
  height: 58px;
}

.tile.enabled {
  background-color: #0a61c9;
}

.tile.night.enabled {
  background-color: #8b1919;
}

.tile.battery {
  color: #b4ff9b;
}

.range-label {
  display: block;
}

.notification {
  position: relative;
  padding: 18px 12px;
}

.note-open {
  display: flex;
  align-items: center;
  gap: 14px;
  width: calc(100% - 56px);
  padding: 6px;
  background: transparent;
  border: 0;
  text-align: left;
  min-height: 90px;
}

.note-open :deep(svg) {
  flex: 0 0 56px;
}

.note-open b {
  font-size: 28px;
}

.note-open small {
  display: block;
  margin-top: 8px;
  color: #d3d3d7;
  font-size: 26px;
}

.note-clear {
  position: absolute;
  right: 4px;
  top: 10px;
  border: 0;
  background: #ffffff15;
  border-radius: 50%;
  width: 66px;
  height: 72px;
  font-size: 34px;
}

.empty {
  padding: 70px 10px;
  text-align: center;
  color: #b8b8be;
}

.stack-date {
  text-align: center;
  font-size: 28px;
  color: #bbb;
}

.stack-time {
  text-align: center;
  font-size: 90px;
  font-weight: 650;
  letter-spacing: -4px;
  margin-bottom: 22px;
}

.stack-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  padding: 24px;
  margin: 14px 0;
  border: 1px solid #ffffff28;
  border-radius: 36px;
  background: linear-gradient(130deg, #353538, #1b1b1e);
  text-align: left;
  gap: 10px;
}

.stack-card span {
  font-size: 25px;
}

.stack-card strong {
  font-size: 34px;
}

.stack-card small {
  font-size: 25px;
  color: #c3c3c9;
}

.weather-card {
  background: linear-gradient(130deg, #265e87, #132b42);
}

.weather-card strong {
  font-size: 64px;
}

.ring-card {
  flex-direction: row;
  align-items: center;
}

.ring-card span {
  flex: 1;
}

.ring-card small {
  display: block;
  margin-top: 10px;
}

.power-slider {
  display: block;
  padding: 24px;
  margin: 16px 0;
  background: #29292c;
  border-radius: 40px;
  font-size: 28px;
}

.power-slider input {
  display: block;
}

.sos-slider {
  color: #ff8686;
}

.siri-title {
  text-align: center;
  font-size: 29px;
  color: #aaa;
}

.siri-orb {
  width: 148px;
  height: 148px;
  margin: 32px auto;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 25%, #fff 0, #41c7ff 20%, #7867fd 40%, #ff599f 63%, #43cfff 88%);
  box-shadow: 0 0 38px #4ba8ff70, inset 0 0 20px #fff;
  animation: orb 4s ease-in-out infinite;
}

.siri-orb.still {
  animation: none;
}

.siri-answer {
  font-size: 30px;
  text-align: center;
  min-height: 120px;
}

.gallery-card {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 20px;
  min-height: 128px;
  padding: 16px;
  margin: 12px 0;
  background: #202023;
  border: 2px solid #ffffff25;
  border-radius: 32px;
  text-align: left;
  font-size: 28px;
}

.gallery-card.selected {
  border-color: #ff9f0a;
}

.gallery-card small {
  display: block;
  margin-top: 8px;
  font-size: 23px;
  color: #b4b4bb;
}

.face-sample {
  display: grid;
  place-items: center;
  width: 120px;
  height: 96px;
  background: #000;
  border-radius: 24px;
  font-size: 36px;
}

.accents {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 24px 0;
}

.accents button {
  min-height: 82px;
  border-radius: 26px;
  border: 3px solid #ffffff70;
  color: #000;
  font-size: 40px;
}

.water-symbol {
  margin: 42px auto;
  text-align: center;
  color: #00cfff;
  font-size: 100px;
}

@keyframes orb {
  50% {
    transform: scale(1.08) rotate(20deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .siri-orb {
    animation: none;
  }
}

.watch-overlay {
  padding: 80px 22px 64px;
  font-size: max(calc(12px / var(--watch-scale)), 25px);
  border-radius: inherit;
  scroll-padding-block: 70px;
}

.overlay-header {
  top: 12px;
  left: 28px;
  font-size: 23px;
}

.dismiss {
  width: 68px;
  height: 64px;
  display: grid;
  place-items: center;
}

.watch-overlay h1 {
  font-size: 30px;
  margin: 0 0 14px;
}

.control-grid {
  gap: 10px;
}

.tile {
  height: 100px;
  border-radius: 32px;
  gap: 6px;
}

.tile b {
  font-size: 36px;
  line-height: 1;
}

.tile small {
  font-size: max(calc(12px / var(--watch-scale)), 21px);
  line-height: 1.2;
}

.tile :deep(svg) {
  width: 42px;
  height: 42px;
}

.tile b :deep(svg) {
  width: 36px;
  height: 36px;
}

.note-open b {
  font-size: 25px;
}

.note-open small {
  font-size: 23px;
}

.stack-card {
  padding: 18px;
}

.stack-card small {
  font-size: 22px;
}

.gallery-card {
  min-height: 110px;
  font-size: 25px;
  gap: 14px;
}

.face-sample {
  flex-shrink: 0;
  width: 94px;
  height: 80px;
}

.water-symbol :deep(svg) {
  width: 90px;
  height: 90px;
}
</style>
