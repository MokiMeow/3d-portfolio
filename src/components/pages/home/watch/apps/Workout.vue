<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware, formatDuration } from '../watch';
const watch = useWatch();
const workout = watch.health.workout;
const page = ref(1);
const countdownAt = ref<number | null>(null);
const pendingType = ref('Outdoor Walk');
const summary = ref<{
    type: string;
    elapsed: number;
    calories: number;
    distance: number;
} | null>(null);
const choices = [
    {
        name: 'Outdoor Walk', icon: 'walk', subtitle: 'Open goal'
    }, {
        name: 'Outdoor Run', icon: 'run', subtitle: 'Open goal'
    }, {
        name: 'Cycling', icon: 'cycle', subtitle: 'Open goal'
    }, {
        name: 'Pool Swim', icon: 'swim', subtitle: 'Open goal'
    }, {
        name: 'HIIT', icon: 'hiit', subtitle: 'Open goal'
    }, {
        name: 'Yoga', icon: 'yoga', subtitle: 'Open goal'
    }
];
const countdown = computed(() => countdownAt.value === null ? 0 : Math.max(0, 3 - Math.floor((watch.now.value.getTime() - countdownAt.value) / 1000)));
function start(type: string) {
    if (workout.active)
        return;
    summary.value = null;
    pendingType.value = type;
    countdownAt.value = watch.now.value.getTime();
    watch.haptic();
}
watchEffect(() => {
    if (countdownAt.value !== null && countdown.value === 0) {
        countdownAt.value = null;
        Object.assign(workout, {
            active: true, paused: false, type: pendingType.value, elapsed: 0, calories: 0, distance: 0
        });
        page.value = 1;
        watch.haptic('success');
    }
});
function togglePause() {
    workout.paused = !workout.paused;
    watch.haptic();
}
function end() {
    if (!workout.active)
        return;
    summary.value = {
        type: workout.type, elapsed: workout.elapsed, calories: workout.calories, distance: workout.distance
    };
    workout.active = false;
    workout.paused = false;
    watch.health.move += Math.round(workout.calories);
    watch.health.exercise += Math.floor(workout.elapsed / 60);
    watch.health.steps += Math.round(workout.distance * (workout.type === 'Cycling' || workout.type === 'Pool Swim' ? 0 : 1350));
    if (workout.elapsed >= 60)
        watch.health.stand = Math.min(watch.health.goals.stand, watch.health.stand + 1);
    watch.haptic('success');
    watch.notify({
        app: 'workout', title: 'Workout complete', text: formatDuration(workout.elapsed) + ' · ' + Math.round(workout.calories) + ' active kcal'
    });
}
const pace = computed(() => workout.distance > .01 ? formatDuration(workout.elapsed / workout.distance) : '--:--');
useWatchHardware('workout', {
    crown: delta => {
        if (!workout.active)
            return false;
        page.value = Math.max(0, Math.min(2, page.value + Math.sign(delta)));
        return true;
    }, action: () => {
        if (workout.active)
            togglePause();
        else if (countdownAt.value !== null)
            countdownAt.value = null;
        else
            start('Outdoor Walk');
        return true;
    }, back: () => {
        if (countdownAt.value !== null) {
            countdownAt.value = null;
            return true;
        }
        if (summary.value) {
            summary.value = null;
            return true;
        }
        return false;
    }
});
onDeactivated(() => {
    countdownAt.value = null;
});
</script>

<template>
  <section class="watch-app workout-app">
    <h1>{{ countdownAt !== null ? 'Starting Workout' : summary ? 'Summary' : workout.active ? workout.type : 'Workout' }}</h1>
    <template v-if="countdownAt !== null">
      <div class="countdown">
        <p class="caption">
          {{ pendingType }}
        </p>
        <strong>
          {{ countdown }}
        </strong>
        <button class="watch-button" @click="countdownAt = null">Cancel</button>
      </div>
    </template>
    <template v-else-if="summary">
      <p class="caption lime">
        {{ summary.type }}
      </p>
      <div class="summary-check">
        <WatchGlyph name="check" />
      </div>
      <div class="platter">
        <p class="caption muted">TOTAL TIME</p>
        <p class="summary-time">
          {{ formatDuration(summary.elapsed) }}
        </p>
        <p class="caption muted">ACTIVE CALORIES</p>
        <p class="metric lime">
          {{ Math.round(summary.calories) }}
          <small>KCAL</small>
        </p>
        <p class="caption muted">DISTANCE</p>
        <p class="metric">
          {{ summary.distance.toFixed(2) }}
          <small>KM</small>
        </p>
      </div>
      
      <button class="watch-button positive" @click="summary = null">Done</button>
    </template>
    <template v-else-if="workout.active">
      <nav class="page-nav" aria-label="Workout pages">
        <button
          v-for="(label, i) in ['Controls', 'Metrics', 'Music']"
          :key="label"
          :class="{ selected: page === i }"
          @click="page = i"
        >
          {{ label }}
        </button>
      </nav>
      <p v-if="workout.paused" class="paused">PAUSED</p>
      <template v-if="page === 1">
        <p class="elapsed">
          {{ formatDuration(workout.elapsed) }}
        </p>
        <div class="live-metric">
          <span class="heart">
            <WatchGlyph name="heart" />
          </span>
          <strong>
            {{ watch.health.heartRate }}
          </strong>
          <small>BPM</small>
        </div>
        <div class="live-metric lime">
          <strong>
            {{ Math.round(workout.calories) }}
          </strong>
          <small>ACTIVE KCAL</small>
        </div>
        <div class="live-metric">
          <strong>
            {{ workout.distance.toFixed(2) }}
          </strong>
          <small>KM</small>
        </div>
        <p class="caption muted">
          {{ pace }}
          / KM
        </p>
      </template>
      <template v-else-if="page === 0">
        <div class="controls">
          <button class="watch-button pause" @click="togglePause">
            {{ workout.paused ? 'Resume' : 'Pause' }}
          </button>
          <button class="watch-button danger" @click="end">End workout</button>
          <button class="watch-button water" @click="watch.overlay('waterLock')">Water Lock</button>
        </div>
      </template>
      <template v-else>
        <div class="music-art">
          <WatchGlyph name="music" />
        </div>
        <h2>Workout Mix</h2>
        <p class="caption muted">Local playback controls</p>
        <div class="button-row">
          <button
            class="watch-button"
            aria-label="Previous track"
            @click="watch.playback.track = Math.max(0, watch.playback.track - 1)"
          >
            <WatchGlyph name="back" />
          </button>
          <button
            class="watch-button"
            :aria-label="watch.playback.playing ? 'Pause music' : 'Play music'"
            @click="watch.playback.playing = !watch.playback.playing"
          >
            <WatchGlyph :name="watch.playback.playing ? 'pause' : 'play'" />
          </button>
          <button
            class="watch-button"
            aria-label="Next track"
            @click="watch.playback.track++"
          >
            <WatchGlyph name="next" />
          </button>
        </div>
        <button class="watch-button" @click="watch.open('nowPlaying')">Now Playing</button>
      </template>
    </template>
    <template v-else>
      <button
        v-for="choice in choices"
        :key="choice.name"
        class="platter workout-choice"
        @click="start(choice.name)"
      >
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <circle
            cx="46"
            cy="12"
            r="7"
            fill="currentColor"
          />
          <path
            v-if="choice.icon === 'cycle'"
            d="M10 57a15 15 0 1 0 30 0a15 15 0 1 0-30 0M45 57a15 15 0 1 0 30 0a15 15 0 1 0-30 0M25 57l18-30 14 11-5 18M43 27l-12 4"
          />
          <path v-else-if="choice.icon === 'swim'" d="M8 57q10-12 20 0t20 0t20 0M18 38l26-12 18 12M44 26l8-10" />
          <path v-else-if="choice.icon === 'yoga'" d="M40 25v25M20 30l20 10 20-10M10 65l30-15 30 15M10 65h60" />
          <path v-else-if="choice.icon === 'walk'" d="M44 26 38 48l11 23M38 48 26 68M44 29l14 16M41 31 25 41" />
          <path v-else-if="choice.icon === 'hiit'" d="M40 26v25M40 30 17 17M40 30 64 17M40 51 18 73M40 51 62 73" />
          <path v-else d="M44 26l-12 22 21 10 7 16M34 47L20 70M44 26l13 13 15-8M40 32l-17 3-8 15" />
        </svg>
        <span>
          <strong>
            {{ choice.name }}
          </strong>
          <small>
            {{ choice.subtitle }}
          </small>
        </span>
        <span class="more">
          <WatchGlyph name="next" />
        </span>
      </button>
      
    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
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
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  font-weight: 700;
  margin: 0 0 20px;
}

h2 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  font-weight: 600;
}

.lime {
  color: #B6F31B;
}

.workout-choice {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  min-height: 140px;
  text-align: left;
}

.workout-choice svg {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  color: #b6f31b;
  stroke: currentColor;
  stroke-width: 6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.workout-choice strong {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  font-weight: 650;
  display: block;
  line-height: 1.2;
}

.workout-choice small {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  color: #b6f31b;
  display: block;
  margin-top: 7px;
}

.more {
  margin-left: auto;
  font-size: max(18px, calc(36px * var(--text-size, 1)));
  color: #666;
}

.countdown {
  text-align: center;
  padding-top: 35px;
}

.countdown strong {
  display: block;
  font-size: max(18px, calc(183px * var(--text-size, 1)));
  color: #b6f31b;
  font-weight: 500;
  line-height: 1.2;
}

.page-nav {
  display: flex;
  gap: 6px;
  margin-bottom: 24px;
}

.page-nav button {
  flex: 1;
  min-height: 66px;
  background: #1c1c1e;
  border-radius: 30px;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #b6b6bc;
}

.page-nav .selected {
  color: #b6f31b;
  background: #2c311c;
}

.active-title {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  color: #b6f31b;
}

.elapsed {
  font-size: max(18px, calc(58px * var(--text-size, 1)));
  color: #ffd60a;
  font-variant-numeric: tabular-nums;
  letter-spacing: -2px;
  margin: 0 0 12px;
}

.live-metric {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.live-metric strong {
  font-size: max(18px, calc(60px * var(--text-size, 1)));
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: -3px;
}

.live-metric small {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
}

.heart {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  color: #fa114f;
}

.paused {
  text-align: center;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #ffd60a;
  letter-spacing: 3px;
}

.controls {
  padding-top: 15px;
}

.controls button {
  margin-bottom: 18px;
  height: 94px;
}

.pause {
  color: #b6f31b;
}

.water {
  color: #46bcff;
}

.music-art {
  width: 150px;
  height: 150px;
  border-radius: 30px;
  background: linear-gradient(140deg,#ff2d55,#652371);
  font-size: max(18px, calc(91px * var(--text-size, 1)));
  line-height: 150px;
  text-align: center;
  margin: auto;
}

.summary-check {
  color: #b6f31b;
  font-size: max(18px, calc(73px * var(--text-size, 1)));
  text-align: center;
}

.summary-time {
  font-size: max(18px, calc(53px * var(--text-size, 1)));
  font-variant-numeric: tabular-nums;
}

.metric small {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
}

.workout-choice {
  min-height: 104px;
  gap: 12px;
}

.workout-choice svg {
  width: 52px;
  height: 52px;
}

.workout-choice strong {
  font-size: 27px;
}

.workout-choice small {
  margin-top: 4px;
  font-size: 21px;
}

.more {
  color: #aaa;
}

.summary-check {
  line-height: 1.2;
  margin: 16px 0;
}

.summary-check :deep(svg) {
  width: 64px;
  height: 64px;
}

.music-art {
  display: grid;
  place-items: center;
  line-height: 1.2;
  width: 108px;
  height: 108px;
}

.music-art :deep(svg) {
  width: 56px;
  height: 56px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #B6F31B; }

.workout-choice > span:nth-child(2) { min-width:0; flex:1; }
.workout-choice strong { font-size:25px; line-height:1.25; }
.workout-choice small { font-size:20px; line-height:1.25; }
.workout-choice .more { flex:0 0 24px; }
.countdown strong { font-size:96px; line-height:1.2; font-weight:600; }
.live-metric { align-items:baseline; flex-wrap:wrap; gap:6px; }
.live-metric strong { font-size:72px; font-weight:600; line-height:1.2; }
.live-metric small { font-size:26px; font-weight:600; }
.live-metric .heart { flex:0 0 28px; }
.summary-time { font-size:64px; font-weight:600; line-height:1.2; overflow-wrap:anywhere; }
.page-nav button { min-height:64px; font-size:22px; }
.controls button { height:76px; }
</style>
