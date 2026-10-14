<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const level = ref(48);
const simulatedBase = ref(48);
const mode = ref<'simulated' | 'microphone'>('simulated');
const pending = ref(false);
const message = ref('');
let stream: MediaStream | null = null;
let audio: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let mediaSource: MediaStreamAudioSourceNode | null = null;
const endedHandlers = new Map<MediaStreamTrack, () => void>();
let requestId = 0;
const visible = computed(() => watch.activeApp.value === 'noise' && !watch.dimmed.value);
const elevated = computed(() => level.value >= 80);
function stopMicrophone() {
    if (mode.value === 'microphone' || pending.value)
        message.value = 'Microphone stopped. Simulated sound is active.';
    requestId++;
    pending.value = false;
    endedHandlers.forEach((handler, track) => track.removeEventListener('ended', handler));
    endedHandlers.clear();
    mediaSource?.disconnect();
    analyser?.disconnect();
    mediaSource = null;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (audio) {
        const closing = audio;
        audio = null;
        void closing.close().catch(() => {
        });
    }
    analyser = null;
    mode.value = 'simulated';
}
async function enableMicrophone() {
    if (pending.value || mode.value === 'microphone')
        return;
    if (!visible.value)
        return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
        message.value = 'Microphone sampling is unavailable in this browser. The demo remains active.';
        return;
    }
    const id = ++requestId;
    pending.value = true;
    message.value = '';
    let acquired: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio: {
                echoCancellation: false, noiseSuppression: false, autoGainControl: false
            } });
        if (id !== requestId || !visible.value) {
            acquired.getTracks().forEach(track => track.stop());
            return;
        }
        context = new AudioContext();
        await context.resume();
        if (id !== requestId || !visible.value) {
            acquired.getTracks().forEach(track => track.stop());
            void context.close().catch(() => {
            });
            return;
        }
        const node = context.createAnalyser();
        node.fftSize = 2048;
        mediaSource = context.createMediaStreamSource(acquired);
        mediaSource.connect(node);
        stream = acquired;
        audio = context;
        analyser = node;
        mode.value = 'microphone';
        watch.haptic('success');
        const sourceStream = acquired;
        acquired.getTracks().forEach(track => {
            const handler = () => {
                if (stream === sourceStream) stopMicrophone();
            };
            endedHandlers.set(track, handler);
            track.addEventListener('ended', handler, { once: true });
        });
        message.value = 'Relative microphone estimate. Uncalibrated; no audio is saved.';
    }
    catch (error: unknown) {
        acquired?.getTracks().forEach(track => track.stop());
        if (context)
            void context.close().catch(() => {
            });
        if (id === requestId)
            message.value = error instanceof Error && error.name === 'NotAllowedError'
                ? 'Microphone access was declined. Simulated sound is still available.'
                : 'Could not start the microphone. Simulated sound is still available.';
    }
    finally {
        if (id === requestId)
            pending.value = false;
    }
}
watchEffect(() => {
    const now = watch.now.value.getTime();
    if (!visible.value) {
        if (mode.value === 'microphone' || pending.value) {
            stopMicrophone();
            message.value = 'Microphone stopped when the watch became inactive.';
        }
        return;
    }
    if (mode.value === 'microphone' && analyser) {
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
        level.value = Math.max(25, Math.min(110, Math.round(100 + 20 * Math.log10(Math.max(.00001, rms)))));
    }
    else if (mode.value === 'simulated')
        level.value = Math.round(simulatedBase.value + Math.sin(now / 7500) * 7 + Math.sin(now / 2300) * 3);
});
useWatchHardware('noise', { action: () => {
        if (mode.value === 'microphone' || pending.value)
            stopMicrophone();
        else {
            simulatedBase.value = simulatedBase.value >= 80 ? 48 : 88;
            message.value = 'Simulated environment changed with the Action button.';
        }
        return true;
    } });
onDeactivated(stopMicrophone);
onBeforeUnmount(stopMicrophone);
</script>

<template>
  <section class="watch-app noise-app">
    <h1>Noise</h1>
    <p class="source-label">
      {{ mode === 'microphone' ? 'MICROPHONE · RELATIVE ESTIMATE' : 'SIMULATED SOUND LEVEL' }}
    </p>
    <p class="decibels" :class="{ elevated }">
      {{ level }}
      <small>
        dB
        {{ mode === 'microphone' ? '*' : '' }}
      </small>
    </p>
    <div
      class="sound-meter"
      role="meter"
      aria-label="Sample sound level"
      aria-valuemin="25"
      aria-valuemax="110"
      :aria-valuenow="level"
    >
      <i
        v-for="n in 20"
        :key="n"
        :class="{ lit: n <= (level - 25) / 85 * 20, yellow: n > 12 }"
      />
    </div>
    <div class="status" :class="{ elevated }">
      <span>
        <span v-if="elevated">!</span>
        <WatchGlyph v-else name="check" />
      </span>
      <h2>
        {{ elevated ? 'Elevated' : 'Quiet' }}
        <small>
          {{ mode === 'microphone' ? 'Uncalibrated estimate' : 'Sample environment' }}
        </small>
      </h2>
    </div>
    <div class="platter">
      <p class="caption">
        {{ elevated ? 'The demo is showing a louder environment.' : 'The demo is showing a quieter environment.' }}
      </p>
      <p class="caption muted">This display cannot measure safe exposure or assess hearing risk.</p>
    </div>
    <button
      v-if="mode === 'microphone' || pending"
      class="watch-button danger"
      @click="stopMicrophone"
    >
      {{ pending ? 'Cancel microphone request' : 'Stop microphone' }}
    </button>
    <button
      v-else
      class="watch-button microphone"
      @click="enableMicrophone"
    >Use microphone</button>
    <button
      v-if="mode === 'simulated' && !pending"
      class="watch-button"
      @click="simulatedBase = simulatedBase >= 80 ? 48 : 88"
    >
      {{ simulatedBase >= 80 ? 'Try a quiet environment' : 'Try a louder environment' }}
    </button>
    <p class="caption muted">
      {{ message || 'Optional microphone access is requested only when you tap. Audio is never recorded or uploaded.' }}
    </p>
    <p v-if="mode === 'microphone'" class="caption muted">*Browser amplitude converted to a relative estimate. This is not calibrated dB SPL.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,'SF Pro Rounded','Segoe UI',sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(calc(12px / var(--watch-scale)), calc(31px * var(--text-size, 1)));
  font-weight: 700;
  margin: 0 0 22px;
}

.source-label {
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
  letter-spacing: .8px;
  color: #a5a5a8;
  line-height: 1.2;
  margin-bottom: 18px;
}

.decibels {
  font-size: max(calc(12px / var(--watch-scale)), calc(120px * var(--text-size, 1)));
  font-weight: 600;
  line-height: 1;
  letter-spacing: -7px;
  margin: 25px 0;
  color: #b6f31b;
}

.decibels small {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  letter-spacing: -1px;
  margin-left: 12px;
  color: #fff;
}

.decibels.elevated {
  color: #ffd60a;
}

.sound-meter {
  display: flex;
  gap: 6px;
  height: 54px;
  margin: 25px 0 35px;
}

.sound-meter i {
  flex: 1;
  border-radius: 5px;
  background: #b6f31b25;
}

.sound-meter .yellow {
  background: #ffd60a25;
}

.sound-meter .lit {
  background: #b6f31b;
}

.sound-meter .lit.yellow {
  background: #ffd60a;
}

.status {
  display: flex;
  align-items: center;
  gap: 18px;
  color: #b6f31b;
  margin: 22px 0;
}

.status>span {
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  border: 3px solid currentColor;
  border-radius: 50%;
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
}

.status h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  font-weight: 600;
  margin: 0;
  line-height: 1.1;
}

.status small {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #9c9c9f;
  margin-top: 7px;
}

.status.elevated {
  color: #ffd60a;
}

.microphone {
  color: #ffd60a;
}

.decibels {
  font-size: 100px;
  margin: 12px 0;
}

.sound-meter {
  height: 36px;
  margin: 14px 0;
  gap: 4px;
}

.status {
  margin: 14px 0;
  gap: 12px;
}

.source-label {
  margin: 8px 0;
}
</style>
