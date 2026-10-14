<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const page = ref<'overview' | 'schedule'>('overview');
const editing = ref(false);
const bedtime = ref(watch.health.sleep.bedtime);
const wakeTime = ref(watch.health.sleep.wake);
const scoreLabel = computed(() => {
    const s = watch.health.sleep.score;
    return s > 95 ? 'Very High' : s > 80 ? 'High' : s > 60 ? 'OK' : s > 40 ? 'Low' : 'Very Low';
});
const durationScore = computed(() => Math.min(50, Math.round(watch.health.sleep.score * .55)));
const consistencyScore = computed(() => Math.min(30, Math.round(watch.health.sleep.score * .3)));
const interruptionScore = computed(() => watch.health.sleep.score - durationScore.value - consistencyScore.value);
const hourText = computed(() => Math.floor(watch.health.sleep.hours) + ' hr ' + Math.round((watch.health.sleep.hours % 1) * 60) + ' min');
const stages = [
    {
        label: 'Awake', color: '#fda185', minutes: 18, y: 20
    }, {
        label: 'REM', color: '#83d5fa', minutes: 96, y: 55
    }, {
        label: 'Core', color: '#1489ef', minutes: 274, y: 90
    }, {
        label: 'Deep', color: '#4546c8', minutes: 56, y: 125
    }
];
const segments = [
    {
        x: 5, width: 30, stage: 2
    }, {
        x: 35, width: 27, stage: 3
    }, {
        x: 62, width: 31, stage: 2
    }, {
        x: 93, width: 22, stage: 1
    }, {
        x: 115, width: 6, stage: 0
    }, {
        x: 121, width: 45, stage: 2
    }, {
        x: 166, width: 18, stage: 3
    }, {
        x: 184, width: 37, stage: 2
    }, {
        x: 221, width: 26, stage: 1
    }, {
        x: 247, width: 8, stage: 0
    }, {
        x: 255, width: 54, stage: 2
    }, {
        x: 309, width: 38, stage: 1
    }
];
function save() {
    watch.health.sleep.bedtime = bedtime.value;
    watch.health.sleep.wake = wakeTime.value;
    editing.value = false;
    watch.haptic('success');
}
useWatchHardware('sleep', {
    action: () => {
        page.value = page.value === 'overview' ? 'schedule' : 'overview';
        return true;
    }, back: () => {
        if (editing.value) {
            editing.value = false;
            return true;
        }
        if (page.value !== 'overview') {
            page.value = 'overview';
            return true;
        }
        return false;
    }
});
</script>

<template>
  <section class="watch-app sleep-app">
    <h1>{{ page === 'schedule' ? (editing ? 'Edit Schedule' : 'Sleep Schedule') : 'Sleep' }}</h1>
    <nav class="tabs">
      <button :class="{ selected: page === 'overview' }" @click="page = 'overview'">Overview</button>
      <button :class="{ selected: page === 'schedule' }" @click="page = 'schedule'">Schedule</button>
    </nav>
    <template v-if="page === 'overview'">
      <p class="caption muted">LAST NIGHT · SAMPLE</p>
      <div class="score">
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle
            cx="110"
            cy="110"
            r="96"
            stroke="#162d46"
          />
          <circle
            cx="110"
            cy="110"
            r="96"
            stroke="#66d5ff"
            stroke-dasharray="603"
            :stroke-dashoffset="603 * (1 - watch.health.sleep.score / 100)"
            transform="rotate(-90 110 110)"
          />
        </svg>
        <strong>
          {{ watch.health.sleep.score }}
        </strong>
      </div>
      <h2 class="rating">
        {{ scoreLabel }}
      </h2>
      <p class="sleep-time">
        {{ hourText }}
      </p>
      <p class="caption muted center">TIME ASLEEP</p>
      <div class="platter">
        <h2>Score breakdown</h2>
        <div class="score-row">
          <span>Duration</span>
          <strong>
            {{ durationScore }}
            <small>/50</small>
          </strong>
        </div>
        <div class="score-row">
          <span>Consistency</span>
          <strong>
            {{ consistencyScore }}
            <small>/30</small>
          </strong>
        </div>
        <div class="score-row">
          <span>Interruptions</span>
          <strong>
            {{ interruptionScore }}
            <small>/20</small>
          </strong>
        </div>
      </div>
      <h2>Sleep stages</h2>
      <svg
        class="stages"
        viewBox="0 0 355 155"
        role="img"
        aria-label="Sample sleep stage timeline"
      >
        <line
          v-for="stage in stages"
          :key="stage.label"
          x1="0"
          x2="355"
          :y1="stage.y"
          :y2="stage.y"
          stroke="#ffffff18"
        />
        <rect
          v-for="(segment, i) in segments"
          :key="i"
          :x="segment.x"
          :y="(stages[segment.stage]?.y ?? 90) - 12"
          :width="segment.width"
          height="24"
          rx="5"
          :fill="stages[segment.stage]?.color"
        />
      </svg>
      <div class="stage-times">
        <span>
          {{ watch.health.sleep.bedtime }}
        </span>
        <span>
          {{ watch.health.sleep.wake }}
        </span>
      </div>
      <div
        v-for="stage in stages"
        :key="stage.label"
        class="stage-row"
      >
        <i :style="{ background: stage.color }" />
        <span>
          {{ stage.label }}
        </span>
        <strong>
          {{ Math.floor(stage.minutes / 60) ? Math.floor(stage.minutes / 60) + 'h ' : '' }}
          {{ stage.minutes % 60 }}
          m
        </strong>
      </div>
      <p class="caption muted">A sample night to explore sleep insights.</p>
    </template>
    <template v-else>
      <div class="moon">
        <WatchGlyph name="moon" />
      </div>
      <h2>Sleep schedule</h2>
      
      <template v-if="editing">
        <label class="time-input">
          Bedtime
          <input
            v-model="bedtime"
            type="time"
            aria-label="Bedtime"
          />
        </label>
        <label class="time-input">
          Wake up
          <input
            v-model="wakeTime"
            type="time"
            aria-label="Wake up time"
          />
        </label>
        <button class="watch-button" @click="save">Save schedule</button>
        <button class="watch-button" @click="editing = false">Cancel</button>
      </template>
      <template v-else>
        <div class="platter">
          <p class="caption muted">BEDTIME</p>
          <p class="schedule-time">
            {{ watch.health.sleep.bedtime }}
          </p>
          <p class="caption muted">WAKE UP</p>
          <p class="schedule-time">
            {{ watch.health.sleep.wake }}
          </p>
          <p class="caption">Every day</p>
        </div>
        <button class="watch-button" @click="bedtime = watch.health.sleep.bedtime; wakeTime = watch.health.sleep.wake; editing = true">
          Edit schedule
        </button>
        <button class="watch-button" @click="watch.settings.focus = !watch.settings.focus">
          Sleep Focus
          {{ watch.settings.focus ? 'On' : 'Off' }}
        </button>
      </template>
    </template>
    <p class="polish-footnote">Not a medical device.</p>
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
  margin: 0 0 18px;
}

h2 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  font-weight: 600;
  margin: 14px 0;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 25px;
}

.tabs button {
  min-height: 70px;
  background: #192838;
  color: #9ab5c8;
  flex: 1;
  border-radius: 32px;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
}

.tabs .selected {
  background: #244b66;
  color: #83dbff;
}

.score {
  width: 220px;
  height: 220px;
  margin: 15px auto;
  position: relative;
}

.score svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke-width: 13;
  stroke-linecap: round;
}

.score strong {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: max(18px, calc(93px * var(--text-size, 1)));
  font-weight: 600;
  color: #a4e4ff;
  letter-spacing: -5px;
}

.rating {
  text-align: center;
  color: #7ad6ff;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.sleep-time {
  text-align: center;
  font-size: max(18px, calc(37px * var(--text-size, 1)));
  margin: 22px 0 5px;
  letter-spacing: -1px;
}

.center {
  text-align: center;
}

.score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.score-row strong {
  color: #8adeff;
  font-size: max(18px, calc(27px * var(--text-size, 1)));
}

.score-row small {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #7b919d;
}

.stages {
  width: 100%;
  height: 160px;
  margin-top: 15px;
}

.stage-times {
  display: flex;
  justify-content: space-between;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  color: #92a4b3;
  margin-bottom: 20px;
}

.stage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  min-height: 76px;
  border-top: 1px solid #ffffff15;
}

.stage-row i {
  width: 12px;
  height: 32px;
  border-radius: 6px;
}

.stage-row strong {
  margin-left: auto;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  font-weight: 500;
}

.moon {
  text-align: center;
  font-size: max(18px, calc(91px * var(--text-size, 1)));
  color: #8de1ff;
}

.schedule-time {
  font-size: max(18px, calc(60px * var(--text-size, 1)));
  letter-spacing: -3px;
  margin: 0 0 25px;
}

.time-input {
  display: block;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  color: #a4e4ff;
  margin: 20px 0;
}

.time-input input {
  display: block;
  width: 100%;
  height: 90px;
  font-size: max(18px, calc(37px * var(--text-size, 1)));
  background: #1c2c3a;
  color: white;
  border-radius: 25px;
  padding: 14px;
  color-scheme: dark;
}

.tabs {
  margin-bottom: 12px;
}

.score {
  width: 154px;
  height: 154px;
  margin: 10px auto;
}

.score strong {
  font-size: 78px;
}

.sleep-time {
  margin: 12px 0 4px;
}

.moon {
  line-height: 1.2;
  margin: 12px 0;
}

.moon :deep(svg) {
  width: 68px;
  height: 68px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #37B7D6; }

.score { width:196px; height:196px; margin:16px auto; }
.score strong { font-size:88px; line-height:1.2; font-weight:600; }
.score-row { min-height:76px; gap:12px; font-size:24px; }
.stage-row { font-size:24px; line-height:1.25; gap:10px; }
.schedule-time { font-size:72px; line-height:1.2; font-weight:600; }
.time-input input { border-radius:30px; }
</style>
