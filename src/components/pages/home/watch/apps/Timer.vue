<script setup lang="ts">
import { useWatch, useWatchHardware, clamp, formatDuration } from "../watch";
interface TimerItem {
  id: number;
  total: number;
  remaining: number;
  deadline: number | null;
  done: boolean;
}
const watch = useWatch();
const timers = ref<TimerItem[]>([]);
const custom = ref(false);
const minutes = ref(5);
const seconds = ref(0);
const editing = ref<'minutes' | 'seconds'>('minutes');
let nextId = 1;
const remaining = (timer: TimerItem) => timer.deadline === null ? timer.remaining : Math.max(0, (timer.deadline - watch.now.value.getTime()) / 1000);
function add(total: number) {
  if (total <= 0) return;
  timers.value.unshift({
    id: nextId++,
    total,
    remaining: total,
    deadline: Date.now() + total * 1000,
    done: false
  });
  custom.value = false;
  watch.haptic('success');
}
function toggle(timer: TimerItem) {
  if (timer.done) {
    timer.done = false;
    timer.remaining = timer.total;
    timer.deadline = Date.now() + timer.total * 1000;
  } else if (timer.deadline === null) timer.deadline = Date.now() + timer.remaining * 1000;else {
    timer.remaining = Math.max(0, (timer.deadline - Date.now()) / 1000);
    timer.deadline = null;
  }
  watch.haptic();
}
watchEffect(() => {
  const now = watch.now.value.getTime();
  for (const timer of timers.value) if (timer.deadline !== null && now >= timer.deadline && !timer.done) {
    timer.deadline = null;
    timer.remaining = 0;
    timer.done = true;
    watch.notify({
      app: 'timer',
      title: 'Timer finished',
      text: formatDuration(timer.total) + ' timer complete'
    });
    watch.haptic('success');
  }
});
useWatchHardware('timer', {
  crown: delta => {
    if (!custom.value) return false;
    if (editing.value === 'minutes') minutes.value = clamp(minutes.value + Math.sign(delta), 0, 1440);else seconds.value = clamp(seconds.value + Math.sign(delta), 0, 59);
    return true;
  },
  back: () => {
    if (!custom.value) return false;
    custom.value = false;
    return true;
  }
});
</script>

<template>
  <section class="watch-app timer-app">
    <h1>Timers</h1>
    <template v-if="custom">
      <p class="caption muted">Turn the Crown to adjust</p>
      <div class="time-picker">
        <button :class="{selected:editing==='minutes'}" @click="editing='minutes'">
          {{ minutes }}
          <small>min</small>
        </button>
        <button :class="{selected:editing==='seconds'}" @click="editing='seconds'">
          {{ seconds.toString().padStart(2,'0') }}
          <small>sec</small>
        </button>
      </div>
      <div class="button-row">
        <button class="watch-button" @click="custom=false">Cancel</button>
        <button
          class="watch-button positive"
          :disabled="!minutes&&!seconds"
          @click="add(Math.min(86400,minutes*60+seconds))"
        >
          Start
        </button>
      </div>
    </template>
    <template v-else>
      <article
        v-for="timer in timers"
        :key="timer.id"
        class="platter running"
        :class="{finished:timer.done}"
      >
        <p class="caption muted">
          {{ timer.done?'Time is up':formatDuration(timer.total)+' timer' }}
        </p>
        <div class="metric">
          {{ formatDuration(Math.ceil(remaining(timer))) }}
        </div>
        <div class="progress">
          <span :style="{width:remaining(timer)/timer.total*100+'%'}" />
        </div>
        <div class="button-row">
          <button class="watch-button" @click="toggle(timer)">
            {{ timer.done?'Repeat':timer.deadline===null?'Resume':'Pause' }}
          </button>
          <button class="watch-button danger" @click="timers=timers.filter(item=>item.id!==timer.id)">
            {{timer.done?'Dismiss':'Cancel'}}
          </button>
        </div>
      </article>
      <p class="caption muted">Quick timers</p>
      <div class="presets">
        <button
          v-for="preset in [1,3,5,10,15,30]"
          :key="preset"
          @click="add(preset*60)"
        >
          <strong>
            {{preset}}
          </strong>
          <span>min</span>
        </button>
      </div>
      <button class="watch-button add" @click="custom=true">＋ Custom Timer</button>
    </template>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.timer-app h1 {
  color: #ff9f0a;
}

.presets {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 12px;
}

.presets button {
  min-height: 104px;
  border-radius: 28px;
  background: #302211;
  color: #ff9f0a;
  border: 0;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.presets strong {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(34px * var(--text-size, 1)));
}

.presets span {
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
}

.add {
  width: 100%;
  margin-top: 18px;
}

.running {
  margin-bottom: 16px;
  text-align: center;
}

.running .metric {
  font-size: max(calc(12px / var(--watch-scale)), calc(55px * var(--text-size, 1)));
  font-variant-numeric: tabular-nums;
}

.progress {
  height: 5px;
  background: #44311c;
  border-radius: 5px;
  margin: 14px 0 18px;
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  background: #ff9f0a;
}

.finished {
  outline: 2px solid #ff9f0a;
}

.time-picker {
  display: flex;
  gap: 12px;
  margin: 35px 0;
}

.time-picker button {
  flex: 1;
  border: 2px solid transparent;
  border-radius: 28px;
  min-height: 150px;
  background: #1c1c1e;
  color: white;
  font-size: max(calc(12px / var(--watch-scale)), calc(55px * var(--text-size, 1)));
}

.time-picker small {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #aaa;
}

.time-picker .selected {
  border-color: #ff9f0a;
  color: #ff9f0a;
}
</style>
