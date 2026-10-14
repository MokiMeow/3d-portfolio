<script setup lang="ts">
import WatchCameraScene from '../WatchCameraScene.vue';
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
type Capture = {
  id: number;
  at: string;
  front: boolean;
  flash: boolean;
};
const timer = ref(true);
const flash = ref(true);
const front = ref(false);
const shooting = ref(false);
const shutterAt = ref(0);
const flashAt = ref(0);
const gallery = ref(false);
const captures = ref<Capture[]>([]);
const selected = ref<number | null>(null);
const active = ref(true);
let nextId = 1;
const countdown = computed(() => shooting.value ? Math.max(1, Math.ceil((shutterAt.value - watch.now.value.getTime()) / 1000)) : 0);
const glowing = computed(() => active.value && flash.value && watch.now.value.getTime() - flashAt.value < 1000 && !watch.reducedMotion.value && !watch.dimmed.value);
const capture = computed(() => captures.value.find(item => item.id === selected.value));
function take() {
  const photo = {
    id: nextId++,
    at: watch.now.value.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),
    front: front.value,
    flash: flash.value
  };
  captures.value.unshift(photo);
  flashAt.value = watch.now.value.getTime();
  shooting.value = false;
  watch.haptic('success');
}
function shutter() {
  if (shooting.value) {
    shooting.value = false;
    return;
  }
  if (timer.value) {
    shooting.value = true;
    shutterAt.value = watch.now.value.getTime() + 3000;
  }
  else
    take();
}
watchEffect(() => {
  if (active.value && shooting.value && watch.now.value.getTime() >= shutterAt.value)
    take();
});
function stop() {
  active.value = false;
  shooting.value = false;
}
onActivated(() => {
  active.value = true;
});
onDeactivated(stop);
onBeforeUnmount(stop);
useWatchHardware('cameraRemote', {
  action: () => {
    if (!gallery.value) {
      shutter();
      return true;
    }
  },
  back: () => {
    if (selected.value !== null) {
      selected.value = null;
      return true;
    }
    if (gallery.value) {
      gallery.value = false;
      return true;
    }
    if (shooting.value) {
      shooting.value = false;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root">
    <h1>{{ gallery ? (capture ? 'Capture' : 'Recent Captures') : 'Camera Remote' }}</h1>
    <template v-if="gallery">
      <h2>
        {{ capture ? 'Demo capture' : 'Recent captures' }}
      </h2>
      <template v-if="capture">
        <div class="snapshot">
          <WatchCameraScene :front="capture.front" />
          <strong>
            {{ capture.front ? 'Selfie illustration' : 'Studio illustration' }}
          </strong>
          <p class="caption">
            {{ capture.at }}
            · Flash
            {{ capture.flash ? 'on' : 'off' }}
          </p>
        </div>
        <button class="watch-button danger" @click="captures = captures.filter(item => item.id !== selected); selected = null">
          Delete capture
        </button>

      </template>
      <template v-else>
        <button
          v-for="photo in captures"
          :key="photo.id"
          class="photo platter"
          @click="selected = photo.id"
        >
          <span>
            <WatchGlyph :name="photo.front ? 'smile' : 'photo'" />
          </span>
          <span>
            <strong>
              Capture
              {{ photo.id }}
            </strong>
            <small>
              {{ photo.at }}
              ·
              {{ photo.front ? 'Front' : 'Studio' }}
            </small>
          </span>
          <b>
            <WatchGlyph name="next" />
          </b>
        </button>
        <p v-if="!captures.length" class="caption muted">No captures yet. Try the demo shutter.</p>
      </template>
    </template>
    <template v-else>
      <div class="viewfinder" :class="{ flash: glowing }">
        <WatchCameraScene :front="front" />
        <span class="preview-label">DEMO PREVIEW</span>
        <span
          v-if="shooting"
          class="countdown"
          role="status"
        >
          {{ countdown }}
        </span>
      </div>
      <div class="controls">
        <button
          :aria-pressed="timer"
          aria-label="Toggle three second timer"
          @click="timer = !timer"
        >
          {{ timer ? '3s' : '0s' }}
        </button>
        <button
          :aria-pressed="flash"
          aria-label="Toggle simulated flash"
          @click="flash = !flash"
        >
          <WatchGlyph name="bolt" />
          {{ flash ? 'On' : 'Off' }}
        </button>
        <button aria-label="Switch drawn camera view" @click="front = !front">
          <WatchGlyph name="switch" />
        </button>
      </div>
      <div class="shutter-row">
        <button
          class="thumbnail"
          aria-label="Open demo captures"
          @click="gallery = true"
        >
          <span>
            <WatchGlyph name="photo" />
          </span>
          <small>
            {{ captures.length }}
          </small>
        </button>
        <button
          class="shutter"
          :class="{ cancel: shooting }"
          :aria-label="shooting ? 'Cancel countdown' : 'Capture demo image'"
          @click="shutter"
        >
          <span />
        </button>
        <div class="balance" />
      </div>
      <p v-if="shooting" class="caption status">Tap shutter to cancel.</p>
      <p v-else class="caption status">
        {{ captures.length ? 'Demo capture saved.' : 'Tap shutter or Action button.' }}
      </p>
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
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  margin: 0 0 18px;
}

h2 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  margin: 14px 0;
}

.viewfinder {
  position: relative;
  overflow: hidden;
  border-radius: 26px;
  margin-bottom: 16px;
}

.viewfinder :deep(svg) {
  display: block;
  width: 100%;
}

.viewfinder:after {
  content: '';
  position: absolute;
  inset: 0;
  background: white;
  opacity: 0;
  pointer-events: none;
}

.viewfinder.flash:after {
  opacity: .9;
}

.preview-label {
  position: absolute;
  bottom: 12px;
  left: 15px;
  color: white;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  letter-spacing: 1px;
  text-shadow: 0 1px 4px black;
}

.countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: white;
  background: #0005;
  font-size: max(18px, calc(78px * var(--text-size, 1)));
  font-weight: 500;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 17px;
}

.controls button {
  flex: 1;
  min-height: 72px;
  border: 0;
  border-radius: 28px;
  background: #252527;
  color: #ddd;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
}

.controls button[aria-pressed=true] {
  color: #ffd60a;
}

.shutter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
}

.shutter {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 4px solid white;
  background: black;
  padding: 5px;
}

.shutter span {
  display: block;
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 50%;
}

.shutter.cancel span {
  background: #ff453a;
  border-radius: 14px;
  transform: scale(.65);
}

.thumbnail {
  position: relative;
  width: 76px;
  height: 76px;
  border: 0;
  border-radius: 18px;
  background: #454541;
  color: #eee;
  font-size: max(18px, calc(33px * var(--text-size, 1)));
}

.thumbnail small {
  position: absolute;
  right: 5px;
  bottom: 3px;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  background: #111b;
  border-radius: 10px;
  padding: 1px 5px;
}

.balance {
  width: 76px;
}

.status {
  text-align: center;
  color: #ddd;
}

.back {
  min-height: 72px;
  border: 0;
  background: none;
  color: #ddd;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  padding: 0;
}

.photo {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  min-height: 106px;
  color: white;
  border: 0;
  text-align: left;
  margin-bottom: 12px;
}

.photo>span:first-child {
  font-size: max(18px, calc(34px * var(--text-size, 1)));
  color: #d4bd94;
}

.photo strong {
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.photo small {
  display: block;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 6px;
}

.photo b {
  margin-left: auto;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  color: #888;
}

.snapshot {
  border-radius: 28px;
  background: linear-gradient(145deg,#666b60,#333d40);
  padding: 30px 20px;
  margin-bottom: 24px;
  text-align: center;
}

.snapshot>span {
  display: block;
  font-size: max(18px, calc(83px * var(--text-size, 1)));
  color: #d4bd94;
}

.snapshot strong {
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.watch-button {
  margin-bottom: 12px;
}

.viewfinder {
  margin-bottom: 10px;
}

.viewfinder svg {
  height: 174px;
  background: #555b50;
}

.preview-label {
  font-size: 21px;
  background: #000a;
  padding: 3px 6px;
  border-radius: 6px;
}

.controls {
  margin-bottom: 10px;
}

.shutter {
  width: 82px;
  height: 82px;
}

.thumbnail {
  width: 68px;
  height: 68px;
}

.snapshot :deep(svg) {
  width: 100%;
  height: 174px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #BDBDC2; }

.viewfinder { border-radius:30px; }
.viewfinder :deep(svg) { width:100%; height:140px; display:block; }
.controls { gap:10px; margin-bottom:10px; }
.controls button { min-height:64px; border-radius:32px; min-width:0; }
.shutter-row { margin:12px 0 18px; }
.shutter { width:96px; height:96px; flex:0 0 96px; }
.photo { gap:12px; }
.photo > span:nth-child(2) { flex:1; min-width:0; }
.photo b { flex:0 0 24px; color:#ffffff59; }
.snapshot { border-radius:30px; padding:20px; }
.snapshot strong { display:block; margin-top:12px; line-height:1.25; }
</style>
