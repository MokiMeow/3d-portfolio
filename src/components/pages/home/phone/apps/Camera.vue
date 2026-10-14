<script setup lang="ts">
// The camera stays off until the visitor turns it on. Nothing leaves the browser.
const video = ref<HTMLVideoElement>();
const status = ref('Camera stays off until you enable it.');
const live = ref(false);
const busy = ref(false);
const photo = ref<string>();
const flash = ref(false);
const zoom = ref(1);
let stream: MediaStream | undefined;
let request = 0, flashTimer = 0;
function stop() {
    request++;
    stream?.getTracks().forEach(track => track.stop());
    stream = undefined;
    if (video.value)
        video.value.srcObject = null;
    live.value = false;
    busy.value = false;
}
async function enable() {
    if (busy.value)
        return;
    const mine = ++request;
    busy.value = true;
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            busy.value = false;
            status.value = 'No camera is available here. Try a browser with camera access.';
            return;
        }
        const result = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: {
                    ideal: 720
                },
                height: {
                    ideal: 960
                }
            },
            audio: false
        });
        if (mine !== request) {
            result.getTracks().forEach(track => track.stop());
            return;
        }
        stream = result;
        live.value = true;
        await nextTick();
        if (mine !== request || !video.value) {
            result.getTracks().forEach(track => track.stop());
            return;
        }
        video.value.srcObject = stream;
        await video.value.play();
        if (mine === request)
            status.value = 'Live · nothing is uploaded';
    }
    catch (error) {
        if (mine !== request)
            return;
        stop();
        status.value = error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'Camera access was declined. You can allow it in your browser’s site settings and try again.'
            : 'No camera is available here. Try a device or browser with camera access.';
    }
    finally {
        if (mine === request)
            busy.value = false;
    }
}
function release() {
    if (photo.value)
        URL.revokeObjectURL(photo.value);
    photo.value = undefined;
}
function shoot() {
    if (!video.value?.videoWidth)
        return;
    const mine = request, canvas = document.createElement('canvas');
    const frame = video.value;
    const ratio = frame.clientWidth > 0 && frame.clientHeight > 0
        ? frame.clientWidth / frame.clientHeight
        : frame.videoWidth / frame.videoHeight;
    const width = Math.min(frame.videoWidth, frame.videoHeight * ratio);
    const height = width / ratio;
    const cropWidth = width / zoom.value;
    const cropHeight = height / zoom.value;
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext('2d');
    if (!context)
        return;
    // Mirror the saved frame so it matches the preview.
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(frame, (frame.videoWidth - cropWidth) / 2, (frame.videoHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    flash.value = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
        flash.value = false;
    }, 160);
    canvas.toBlob(blob => {
        if (!blob || mine !== request)
            return;
        release();
        photo.value = URL.createObjectURL(blob);
    }, 'image/jpeg', 0.9);
}
const onVisibility = () => {
    if (document.hidden) {
        stop();
        status.value = 'Camera is off. Enable it when you’re ready.';
    }
};
onMounted(() => document.addEventListener('visibilitychange', onVisibility));
onBeforeUnmount(() => {
    stop();
    release();
    clearTimeout(flashTimer);
    document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
  <div class="app">
    <div class="top">
      <span class="chip">{{ live ? 'PHOTO' : 'OFF' }}</span>
      <span class="chip" :class="{ on: live }">{{ live ? '● LIVE' : 'PRIVATE' }}</span>
    </div>
    <div class="finder">
      <video
        v-show="live"
        ref="video"
        playsinline
        muted
        :style="{ transform: `scaleX(-1) scale(${zoom})` }"
       />
      <div v-if="!live" class="off">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path
            d="M8 17a3 3 0 0 1 3-3h5l2.500-4h11l2.500 4h5a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z"
            fill="none"
            stroke="currentColor"
            stroke-width="2.400"
           />
          <circle cx="24" cy="26" r="7" fill="none" stroke="currentColor" stroke-width="2.400" />
        </svg>
        <p>{{ status }}</p>
        <button class="enable" :disabled="busy" @click="enable">{{ busy ? 'Asking your browser…' : 'Turn on camera' }}</button>
      </div>
      <i v-if="live" class="grid" aria-hidden="true" />
      <i class="flash" :class="{ on: flash }" aria-hidden="true" />
      <div v-if="live" class="zooms" role="group" aria-label="Zoom">
        <button v-for="level in [1, 2, 4]" :key="level" :aria-pressed="zoom === level" @click="zoom = level">
          {{ level }}
          <small v-if="zoom === level">×</small>
        </button>
      </div>
    </div>
    <p class="modes" aria-hidden="true">
      <span>CINEMATIC</span>
      <span>VIDEO</span>
      <b>PHOTO</b>
      <span>PORTRAIT</span>
      <span>PANO</span>
    </p>
    <div class="controls">
      <a
        v-if="photo"
        class="last"
        :href="photo"
        download="pocket-lab-photo.jpg"
        aria-label="Save the last photo"
      >
        <img :src="photo" alt="" />
      </a>
      <span v-else class="last empty" />
      <button class="shutter" :disabled="!live" aria-label="Take photo" @click="shoot">
        <i />
      </button>
      <button
        class="flip"
        :aria-label="live ? 'Turn camera off' : 'Camera is off'"
        :disabled="!live"
        @click="stop(); status = 'Camera is off. Enable it when you’re ready.'"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4v8M7 6.500a7.500 7.500 0 1 0 10 0"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
           />
        </svg>
      </button>
    </div>
    <p class="hint">
      {{ photo ? 'Tap the thumbnail to save your photo.' : live ? status : 'Nothing leaves this browser.' }}
    </p>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  padding: var(--safe-top,62px) 0 var(--safe-bottom,34px);
}

button {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  padding: 0;
}

button:focus-visible, a:focus-visible {
  outline: 2px solid #ffd60a;
  outline-offset: 3px;
}

.top {
  display: flex;
  justify-content: space-between;
  padding: 4px 20px 10px;
}

.chip {
  padding: 5px 10px;
  border-radius: 12px;
  background: #ffffff1f;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .04em;
}

.chip.on {
  color: #ffd60a;
}

.finder {
  position: relative;
  flex: 1;
  min-height: 0;
  margin: 0 8px;
  border-radius: 28px;
  overflow: hidden;
  background: #101114;
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 250ms ease, opacity 250ms ease;
}

.off {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 44px;
  text-align: center;
  color: #aeb2bb;
}

.off svg {
  width: 58px;
  height: 58px;
}

.off p {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
}

.enable {
  min-height: 50px;
  padding: 0 24px;
  border-radius: 25px;
  background: #ffd60a;
  color: #000;
  font-weight: 600;
}

.enable:disabled {
  opacity: .6;
}

.grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg,transparent calc(33.330% - .5px),#ffffff40 0 calc(33.330% + .5px),transparent 0 calc(66.660% - .5px),#ffffff40 0 calc(66.660% + .5px),transparent 0),
    linear-gradient(180deg,transparent calc(33.330% - .5px),#ffffff40 0 calc(33.330% + .5px),transparent 0 calc(66.660% - .5px),#ffffff40 0 calc(66.660% + .5px),transparent 0);
}

.flash {
  position: absolute;
  inset: 0;
  background: #fff;
  opacity: 0;
  pointer-events: none;
  transition: transform 250ms ease, opacity 250ms ease;
}

.flash.on {
  opacity: .9;
  transition: none;
}

.zooms {
  position: absolute;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 24px;
  background: #0000005c;
  backdrop-filter: blur(18px);
}

.zooms button {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
}

.zooms button[aria-pressed=true] {
  background: #00000080;
  color: #ffd60a;
  font-size: 16px;
}

.zooms small {
  font-size: 12px;
}

.modes {
  margin: 14px 0 6px;
  display: flex;
  justify-content: center;
  gap: 18px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .03em;
  color: #fffc;
}

.modes b {
  color: #ffd60a;
  font-weight: 700;
}

.controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 36px 0;
}

.last {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  overflow: hidden;
  background: #1c1c1e;
  display: block;
}

.last img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.last.empty {
  box-shadow: inset 0 0 0 1px #ffffff26;
}

.shutter {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  border: 4px solid #fff;
  display: grid;
  place-items: center;
}

.shutter i {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: #fff;
  transition: transform 250ms ease, opacity 250ms ease;
}

.shutter:active:not(:disabled) i {
  transform: scale(.88);
}

.shutter:disabled {
  opacity: .35;
  cursor: default;
}

.flip {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #ffffff26;
  display: grid;
  place-items: center;
}

.flip svg {
  width: 24px;
  height: 24px;
}

.flip:disabled {
  opacity: .35;
  cursor: default;
}

.hint {
  margin: 8px 0 0;
  min-height: 18px;
  text-align: center;
  font-size: 12px;
  color: #aeb2bb;
}

@media(prefers-reduced-motion:reduce) {
  video, .shutter i, .flash {
    transition: none;
  }
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  container-type: size;
  min-width: 0;
  min-height: 0;
}

.app :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

button, a[download] {
  min-width: 44px;
  min-height: 44px;
  touch-action: manipulation;
  transition: transform 220ms ease, opacity 220ms ease;
}

button:active:not(:disabled), a[download]:active {
  transform: scale(.96);
}

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid var(--accent, #007aff);
  outline-offset: 3px;
}

.icon, .tool, .glass-round, .round, .go, .send {
  flex-shrink: 0;
}

.scroll, .scroller, .feed, .page, .tiles {
  min-width: 0;
  min-height: 0;
  overscroll-behavior: contain;
}

.tabs button {
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
}

@media (hover: hover) {
  button:hover:not(:disabled), a[download]:hover {
    opacity: .82;
  }
}

@media (pointer: coarse) {
  button, a[download] {
    min-width: 58px;
    min-height: 58px;
  }
  .tabs button {
    min-width: 0;
    min-height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app :deep(*), .app :deep(*::before), .app :deep(*::after) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.app {
  font-size: 17px;
}

.top, .modes, .controls, .hint {
  flex-shrink: 0;
}

.off {
  padding: 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.modes {
  gap: 12px;
  font-size: 12px;
  letter-spacing: 0;
  padding-inline: 10px;
}

.last, .shutter, .flip {
  flex-shrink: 0;
}

.hint {
  padding-inline: 16px;
  line-height: 1.4;
}

@container (max-height: 700px) {
  .finder {
    border-radius: 22px;
  }
  .off {
    gap: 10px;
  }
  .off svg {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }
  .off p {
    font-size: 14px;
  }
  .controls {
    padding-inline: 24px;
  }
}
</style>
