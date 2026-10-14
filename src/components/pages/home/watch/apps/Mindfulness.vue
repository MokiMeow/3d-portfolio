<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware, formatDuration } from '../watch';
const watch = useWatch();
const duration = ref(1);
const session = ref<'breathe' | 'reflect' | null>(null);
const startedAt = ref<number | null>(null);
const completed = ref(false);
const completedKind = ref<'breathe' | 'reflect'>('breathe');
const prompts = [
    'Think of one small thing that made today feel lighter.',
    'Recall a place where you felt at ease. Notice the details.',
    'Think of someone who helped you. Hold that gratitude for a moment.',
];
const promptIndex = ref(0);
const elapsed = computed(() => startedAt.value === null ? 0 : Math.max(0, Math.floor((watch.now.value.getTime() - startedAt.value) / 1000)));
const remaining = computed(() => Math.max(0, duration.value * 60 - elapsed.value));
const moving = computed(() => session.value !== null && watch.activeApp.value === 'mindfulness' && !watch.dimmed.value && !watch.reducedMotion.value);
const phase = computed(() => moving.value ? (1 - Math.cos((elapsed.value % 10) / 10 * Math.PI * 2)) / 2 : .55);
const petalScale = computed(() => .58 + phase.value * .42);
const instruction = computed(() => elapsed.value % 10 < 5 ? 'Breathe in' : 'Breathe out');
function start(kind: 'breathe' | 'reflect') {
    session.value = kind;
    completed.value = false;
    startedAt.value = watch.now.value.getTime();
    watch.haptic();
}
function stop() {
    session.value = null;
    startedAt.value = null;
}
watchEffect(() => {
    if (session.value !== null && remaining.value === 0) {
        completedKind.value = session.value;
        completed.value = true;
        stop();
        watch.haptic('success');
        watch.notify({
            app: 'mindfulness',
            title: 'A mindful minute',
            text: duration.value + ' minute' + (duration.value > 1 ? 's' : '') + ' of ' +
                (completedKind.value === 'breathe' ? 'breathing' : 'reflection') + ' complete.'
        });
    }
});
useWatchHardware('mindfulness', {
    crown: delta => {
        if (session.value !== null)
            return false;
        duration.value = Math.max(1, Math.min(3, duration.value + Math.sign(delta)));
        return true;
    }, action: () => {
        if (session.value !== null)
            stop();
        else
            start('breathe');
        return true;
    }, back: () => {
        if (session.value !== null) {
            stop();
            return true;
        }
        if (completed.value) {
            completed.value = false;
            return true;
        }
        return false;
    }
});
</script>

<template>
  <section class="watch-app mindfulness-app">
    <h1>Mindfulness</h1>
    <div class="flower" :class="{ moving }">
      <svg viewBox="0 0 320 320" aria-hidden="true">
        <defs>
          <radialGradient id="watch-mindful-petal">
            <stop
              offset="0"
              stop-color="#c2ffed"
              stop-opacity=".85"
            />
            <stop
              offset=".65"
              stop-color="#68ddc0"
              stop-opacity=".62"
            />
            <stop
              offset="1"
              stop-color="#189a98"
              stop-opacity=".28"
            />
          </radialGradient>
        </defs>
        <g :style="{ transform: 'translate(160px,160px) scale(' + (session ? petalScale : .82) + ') translate(-160px,-160px)' }">
          <ellipse
            v-for="n in 8"
            :key="n"
            cx="160"
            cy="109"
            rx="48"
            ry="93"
            :transform="'rotate(' + n * 45 + ' 160 160)'"
            fill="url(#watch-mindful-petal)"
          />
        </g>
      </svg>
    </div>
    <template v-if="completed">
      <h2 class="center mint">Well done</h2>
      <p class="caption center">
        {{ duration }}
        mindful
        {{ duration === 1 ? 'minute' : 'minutes' }}
      </p>
      <p class="caption muted center">Take this calm with you.</p>
      <button class="watch-button" @click="completed = false">Done</button>
    </template>
    <template v-else-if="session">
      <h2 class="center mint">
        {{ session === 'breathe' ? instruction : 'Let your mind settle' }}
      </h2>
      <p v-if="session === 'reflect'" class="reflect-prompt">
        {{ prompts[promptIndex] }}
      </p>
      <p class="remaining">
        {{ formatDuration(remaining) }}
      </p>
      <p v-if="session === 'breathe'" class="caption muted center">Follow the unfolding petals.</p>
      <button class="watch-button" @click="stop">End session</button>
    </template>
    <template v-else>
      <div class="duration">
        <button aria-label="Shorter session" @click="duration = Math.max(1, duration - 1)">−</button>
        <span>
          {{ duration }}
          min
        </span>
        <button aria-label="Longer session" @click="duration = Math.min(3, duration + 1)">+</button>
      </div>
      <button class="platter choice" @click="start('breathe')">
        <span class="choice-icon">
          <WatchGlyph name="mindfulness" />
        </span>
        <span>
          <strong>Breathe</strong>
          <small>Find a little stillness</small>
        </span>
        <span class="chevron">
          <WatchGlyph name="next" />
        </span>
      </button>
      <button class="platter choice" @click="promptIndex = (promptIndex + 1) % prompts.length; start('reflect')">
        <span class="choice-icon">
          <WatchGlyph name="star" />
        </span>
        <span>
          <strong>Reflect</strong>
          <small>Make space for a thought</small>
        </span>
        <span class="chevron">
          <WatchGlyph name="next" />
        </span>
      </button>
      <p class="caption muted">Turn the Crown to choose your duration. Action starts Breathe.</p>
    </template>
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
  margin: 0 0 18px;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  font-weight: 600;
  margin: 16px 0;
}

.mint {
  color: #91eed1;
}

.center {
  text-align: center;
}

.flower {
  width: 280px;
  height: 280px;
  margin: 10px auto;
  filter: drop-shadow(0 0 25px #49d1ae15);
}

.flower svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.flower.moving g {
  transition: transform .95s ease-in-out;
}

.duration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 20px 0;
}

.duration span {
  font-size: max(calc(12px / var(--watch-scale)), calc(27px * var(--text-size, 1)));
  font-weight: 600;
  color: #9cefd9;
}

.duration button {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  background: #15352f;
  color: #92edcf;
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
}

.choice {
  display: flex;
  gap: 16px;
  align-items: center;
  min-height: 124px;
  width: 100%;
  text-align: left;
  background: linear-gradient(120deg,#183b33,#132322);
}

.choice strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  display: block;
  font-weight: 600;
}

.choice small {
  display: block;
  color: #93bdb1;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
  line-height: 1.2;
  margin-top: 6px;
}

.choice-icon {
  color: #92efd2;
  font-size: max(calc(12px / var(--watch-scale)), calc(41px * var(--text-size, 1)));
}

.chevron {
  color: #65968a;
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  margin-left: auto;
}

.remaining {
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(56px * var(--text-size, 1)));
  color: #a7eedc;
  margin: 18px 0;
  font-variant-numeric: tabular-nums;
}

.reflect-prompt {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  line-height: 1.35;
  text-align: center;
  color: #ccebe3;
  margin: 20px 0;
}

.flower {
  width: 108px;
  height: 108px;
  margin: 6px auto;
}

.flower.moving g {
  transition: transform 300ms ease;
}

.duration {
  margin: 8px 0;
}

.choice {
  min-height: 88px;
  gap: 12px;
  padding: 12px 16px;
}

.choice strong {
  font-size: 26px;
}

.choice small {
  font-size: 21px;
  margin-top: 4px;
}

.choice-icon svg {
  width: 36px;
  height: 36px;
}
</style>
