<script setup lang="ts">
import WatchGlyph from "./WatchGlyph.vue";
import { useWatch } from './watch';
const emit = defineEmits<{
  close: [
  ];
}>();
const watch = useWatch();
const playing = ref(false);
const audioAvailable = ref(true);
let context: AudioContext | undefined;
let finishTimer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
const oscillators = new Set<OscillatorNode>();
function stop() {
  generation++;
  playing.value = false;
  if (finishTimer)
    clearTimeout(finishTimer);
  finishTimer = undefined;
  oscillators.forEach(oscillator => {
    try {
      oscillator.stop();
    }
    catch {
    }
    oscillator.disconnect();
  });
  oscillators.clear();
  const previous = context;
  context = undefined;
  if (previous && previous.state !== 'closed')
    void previous.close().catch(() => {
    });
}
async function play() {
  if (playing.value) {
    stop();
    return;
  }
  stop();
  playing.value = true;
  audioAvailable.value = true;
  const token = generation;
  finishTimer = setTimeout(stop, 10000);
  if (!watch.settings.sound || watch.playback.volume <= 0)
    return;
  try {
    const audio = new AudioContext();
    context = audio;
    await audio.resume();
    if (token !== generation || !playing.value || !watch.settings.sound) {
      if (audio.state !== 'closed')
        await audio.close();
      return;
    }
    const melody: [number, number][] = [
      [74, .25],
      [76, .25],
      [69, .5],
      [76, .25],
      [78, .25],
      [81, .12],
      [79, .12],
      [78, .5],
      [74, .25],
      [76, .25],
      [69, .75],
      [69, .25],
      [71, .25],
      [74, .25],
      [69, .25],
      [78, .5],
      [78, .25],
      [76, .75],
      [74, .25],
      [76, .25],
      [69, .5],
      [76, .25],
      [78, .25],
      [81, .12],
      [79, .12],
      [78, .5],
      [74, .25],
      [76, .25],
      [69, .5],
      [71, .25],
      [74, .25],
      [69, .25],
      [76, .5],
      [74, .75]
    ];
    let at = audio.currentTime + .03;
    for (const [note, beats] of melody) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const duration = beats * .72;
      oscillator.type = 'sine';
      oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.025 * watch.playback.volume, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + Math.max(.02, duration * .88));
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillators.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        oscillators.delete(oscillator);
      };
      oscillator.start(at);
      oscillator.stop(at + duration);
      at += duration;
    }
  }
  catch {
    audioAvailable.value = false;
  }
}
function close() {
  stop();
  emit('close');
}
watchEffect(() => {
  if (watch.dimmed.value || watch.activeApp.value !== 'settings' || !watch.settings.sound) {
    if (context)
      stop();
  }
});
onMounted(() => { void play(); });
onDeactivated(stop);
onBeforeUnmount(stop);
</script>

<template>
  <section class="watch-app wrist-roll" :class="{ dancing: playing && !watch.reducedMotion.value && !watch.dimmed.value }">
    <p class="caption secret">YOU FOUND THE SECRET</p>
    <h1>Wrist Roll</h1>
    <div class="stage">
      <div class="spotlight">
      </div>
      <svg viewBox="0 0 250 230" aria-hidden="true">
        <g class="dancer">
          <circle
            cx="125"
            cy="43"
            r="22"
            fill="#ffd1b1"
          />
          <path d="M106 66h38l13 80h-62Z" fill="#f3ebd7" />
          <path
            d="m98 79-32 34-14-27M147 79l35 19 18-24"
            fill="none"
            stroke="#ffd1b1"
            stroke-width="13"
            stroke-linecap="round"
          />
          <path
            d="m110 144-15 55-20 7m65-62 14 52 20 10"
            fill="none"
            stroke="#4e81bb"
            stroke-width="19"
            stroke-linecap="round"
          />
          <path d="M104 27q25-28 42 10" fill="#c37b43" />
          <path
            d="M124 100v40"
            stroke="#b65151"
            stroke-width="7"
          />
          <path
            d="M112 53q13 10 26 0"
            fill="none"
            stroke="#ad6555"
            stroke-width="3"
          />
        </g>
        <path
          d="M185 63v136M169 66h25"
          stroke="#777"
          stroke-width="6"
          stroke-linecap="round"
        />
        <circle
          cx="175"
          cy="66"
          r="9"
          fill="#ccc"
        />
      </svg>
    </div>
    <p class="caption tagline">Never gonna let your wrist down.</p>
    <button class="watch-button play" @click="play">
      <WatchGlyph :name="playing ? 'stop' : 'play'" />
      {{ playing ? 'Stop' : 'Play' }}
    </button>
    <p class="caption muted audio-note">
      {{ !watch.settings.sound ? 'Silent Mode · dancing only' : !audioAvailable ? 'Audio unavailable · enjoy the moves' : 'Tiny tune. Big commitment.' }}
    </p>
    <button class="watch-button close" @click="close">Back to Settings</button>
  </section>
</template>

<style scoped>
.wrist-roll {
  position: absolute;
  inset: 0;
  z-index: 15;
  background: #000;
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;
  text-align: center;
}

.wrist-roll :deep(*) {
  font-family: inherit;
}

.secret {
  font-size: 20px;
  letter-spacing: 2px;
  color: #ac8aff;
  margin: 0 0 8px;
}

h1 {
  font-size: 43px;
  margin: 0;
}

.stage {
  height: 205px;
  position: relative;
  overflow: hidden;
  margin: 12px 0;
  background: radial-gradient(ellipse at center,#352349 0%,transparent 65%);
  border-radius: 30px;
}

.stage svg {
  height: 205px;
  width: 100%;
  position: relative;
}

.spotlight {
  position: absolute;
  left: 15%;
  top: 0;
  width: 70%;
  height: 100%;
  background: linear-gradient(#ac8aff20,#ac8aff00);
  clip-path: polygon(35% 0,65% 0,100% 100%,0 100%);
}

.tagline {
  font-size: 23px;
  margin: 10px 0 20px;
}

.play {
  background: #ac8aff;
  color: #211134;
  font-weight: 700;
}

.audio-note {
  font-size: 20px;
  margin: 13px 0;
}

.close {
  background: #26232b;
  font-size: 26px;
}

.dancing .dancer {
  transform-origin: 125px 210px;
  animation: wrist-dance .55s ease-in-out infinite alternate;
}

.dancing .spotlight {
  animation: wrist-light 1.1s ease-in-out infinite alternate;
}

@keyframes wrist-dance {
  from {
    transform: rotate(-8deg) translateX(-9px);
  }

  to {
    transform: rotate(8deg) translateX(9px);
  }
}

@keyframes wrist-light {
  to {
    opacity: .4;
    transform: translateX(20px);
  }
}

@media (prefers-reduced-motion:reduce) {
  .dancing .dancer,
  .dancing .spotlight {
    animation: none;
  }
}

.stage,
.stage svg {
  height: 148px;
}

.secret,
.audio-note {
  font-size: max(21px, calc(12px / var(--watch-scale)));
}
</style>
