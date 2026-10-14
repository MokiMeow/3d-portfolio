<script setup lang="ts">
import { PHONE } from '../phone';
import { APP_ICONS as icons } from './icons';
const phone = inject(PHONE);
const tab = ref<string>('World Clock');
const pulse = ref<number>(Date.now());
const now = computed(() => phone?.now.value ?? new Date(pulse.value));
const cities = [
    {
        name: 'Bengaluru',
        zone: 'Asia/Kolkata',
        detail: 'Home · chai standard time'
    },
    {
        name: 'London',
        zone: 'Europe/London',
        detail: 'A different kind of cloudy'
    },
    {
        name: 'Tokyo',
        zone: 'Asia/Tokyo',
        detail: 'Tomorrow, probably'
    },
    {
        name: 'New York',
        zone: 'America/New_York',
        detail: 'The other standup'
    }
];
function cityTime(zone: string) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(now.value);
}
function cityDate(zone: string) {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    }).format(now.value);
}
type Alarm = {
    id: number;
    time: string;
    label: string;
    on: boolean;
};
const alarms = ref<Alarm[]>([
    {
        id: 1,
        time: '07:00',
        label: 'Become a morning person',
        on: false
    },
    {
        id: 2,
        time: '07:05',
        label: 'Negotiate with the morning',
        on: true
    },
    {
        id: 3,
        time: '16:00',
        label: 'Critical chai reminder',
        on: true
    }
]);
const adding = ref<boolean>(false);
const alarmTime = ref<string>('08:00');
const alarmLabel = ref<string>('One more snooze');
const alarmField = ref<HTMLInputElement | null>(null);
const alarmDialog = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;
watch(adding, async value => {
    if (value) {
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        await nextTick();
        if (adding.value) alarmField.value?.focus();
    } else {
        returnFocus?.focus();
        returnFocus = null;
    }
});
function trapAlarmFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const controls = alarmDialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input');
    const first = controls?.item(0);
    const last = controls?.item((controls?.length ?? 1) - 1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}
const editing = ref<boolean>(false);
let nextAlarmId = 4;
function saveAlarm() {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(alarmTime.value))
        return;
    alarms.value.push({
        id: nextAlarmId++,
        time: alarmTime.value,
        label: alarmLabel.value.trim() || 'Alarm',
        on: true,
    });
    adding.value = false;
}
const swRunning = ref<boolean>(false);
const swStart = ref<number>(0);
const swStored = ref<number>(0);
const swElapsed = computed(() => swStored.value + (swRunning.value ? pulse.value - swStart.value : 0));
const laps = ref<Array<{
    number: number;
    time: number;
}>>([]);
const lastLap = ref<number>(0);
function stopwatch() {
    if (swRunning.value) {
        swStored.value = swElapsed.value;
        swRunning.value = false;
    }
    else {
        swStart.value = Date.now();
        pulse.value = swStart.value;
        swRunning.value = true;
    }
}
function lapOrReset() {
    if (swRunning.value) {
        laps.value.unshift({
            number: laps.value.length + 1,
            time: swElapsed.value - lastLap.value
        });
        lastLap.value = swElapsed.value;
    }
    else {
        swStored.value = 0;
        laps.value = [];
        lastLap.value = 0;
    }
}
function stopwatchText(ms: number) {
    const total = Math.max(0, Math.floor(ms / 10));
    return String(Math.floor(total / 6000)).padStart(2, '0') + ':' + String(Math.floor(total / 100) % 60).padStart(2, '0') + '.' + String(total % 100).padStart(2, '0');
}
const minutes = ref<number>(1);
const hours = ref<number>(0);
const seconds = ref<number>(0);
const running = ref<boolean>(false);
const remaining = ref<number>(0);
const total = ref<number>(0);
const deadline = ref<number>(0);
const finished = ref<boolean>(false);
const timerLabel = ref<string>('Chai steeping');
const timerText = computed(() => {
    const s = Math.ceil(remaining.value / 1000);
    return (s >= 3600 ? String(Math.floor(s / 3600)).padStart(2, '0') + ':' : '') + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
});
const progress = computed(() => total.value ? Math.max(0, remaining.value / total.value) : 1);
function boundedUnit(value: number, maximum: number) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(maximum, Math.max(0, Math.floor(numeric))) : 0;
}
function startTimer() {
    if (running.value) {
        remaining.value = Math.max(0, deadline.value - Date.now());
        running.value = false;
        return;
    }
    if (remaining.value <= 0) {
        hours.value = boundedUnit(hours.value, 23);
        minutes.value = boundedUnit(minutes.value, 59);
        seconds.value = boundedUnit(seconds.value, 59);
        total.value = (hours.value * 3600 + minutes.value * 60 + seconds.value) * 1000;
        remaining.value = total.value;
    }
    if (!remaining.value)
        return;
    finished.value = false;
    deadline.value = Date.now() + remaining.value;
    running.value = true;
}
function cancelTimer() {
    running.value = false;
    remaining.value = 0;
    total.value = 0;
    finished.value = false;
}
function preset(value: number) {
    cancelTimer();
    hours.value = 0;
    minutes.value = value;
    seconds.value = 0;
}
let ticker: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
    ticker = setInterval(() => {
        pulse.value = Date.now();
        if (running.value) {
            remaining.value = Math.max(0, deadline.value - pulse.value);
            if (remaining.value === 0) {
                running.value = false;
                finished.value = true;
                phone?.notify({
                    app: 'clock',
                    title: 'Timer',
                    text: 'Time is up.'
                });
            }
        }
    }, 50);
});
onBeforeUnmount(() => {
    returnFocus = null;
    if (ticker)
        clearInterval(ticker);
});
</script>

<template>
  <div class="app">
    <header class="top" :inert="adding">
      <div class="bar">
        <button v-if="tab==='Alarms'" class="orange pill" @click="editing=!editing">{{ editing?'Done':'Edit' }}</button>
        <span v-else class="muted">{{ tab==='World Clock'?'Everywhere, right now':'' }}</span>
        <button v-if="tab==='Alarms'" class="icon orange" aria-label="Add alarm" @click="adding=true">
          <svg viewBox="0 0 24 24">
            <path :d="icons.plus" />
          </svg>
        </button>
      </div>
      <h1>{{ tab }}</h1>
    </header>
    <main class="scroll content" :inert="adding">
      <template v-if="tab==='World Clock'">
        <article v-for="city in cities" :key="city.zone" class="world-row">
          <div>
            <p>{{ cityDate(city.zone) }}</p>
            <h2>{{ city.name }}</h2>
            <small>{{ city.detail }}</small>
          </div>
          <time>{{ cityTime(city.zone) }}</time>
        </article>
        <p class="footnote">Live world times. Same unfinished to-do list.</p>
      </template>
      <template v-else-if="tab==='Alarms'">
        <div class="sleep-card glass">
          <svg viewBox="0 0 24 24">
            <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />
          </svg>
          <div>
            <h3>Sleep | Wake Up</h3>
            <p>No sleep schedule. Bold choice.</p>
          </div>
          <button class="pill" @click="adding=true;alarmTime='07:00';alarmLabel='A fresh start'">Set up</button>
        </div>
        <h2 class="other">Other</h2>
        <article v-for="alarm in alarms" :key="alarm.id" class="alarm-row" :class="{off:!alarm.on}">
          <button
            v-if="editing"
            class="remove"
            :aria-label="'Delete '+alarm.label"
            @click="alarms=alarms.filter(a=>a.id!==alarm.id)"
          >
            −
          </button>
          <div>
            <time>{{ alarm.time }}</time>
            <p>{{ alarm.label }}</p>
          </div>
          <button
            class="toggle"
            role="switch"
            :aria-label="alarm.label"
            :aria-checked="alarm.on"
            :class="{on:alarm.on}"
            @click="alarm.on=!alarm.on"
          >
            <span />
          </button>
        </article>
        <p class="footnote">Alarms are simulated. Keep your real alarm set.</p>
      </template>
      <template v-else-if="tab==='Stopwatch'">
        <div class="stopwatch-display" aria-live="off">{{ stopwatchText(swElapsed) }}</div>
        <div class="dual-controls">
          <button class="round neutral" :disabled="!swRunning && !swStored" @click="lapOrReset">{{ swRunning?'Lap':'Reset' }}</button>
          <button class="round" :class="swRunning?'red':'green'" @click="stopwatch">{{ swRunning?'Stop':'Start' }}</button>
        </div>
        <div class="dots">
          <i />
          <i />
        </div>
        <div class="laps">
          <div v-if="swRunning" class="lap-row">
            <span>
              Lap
              {{ laps.length+1 }}
            </span>
            <time>{{ stopwatchText(swElapsed-lastLap) }}</time>
          </div>
          <div
            v-for="lap in laps"
            :key="lap.number"
            class="lap-row"
            :class="{fast:laps.length>1 && lap.time===Math.min(...laps.map(l=>l.time)),slow:laps.length>1 && lap.time===Math.max(...laps.map(l=>l.time))}"
          >
            <span>
              Lap
              {{ lap.number }}
            </span>
            <time>{{ stopwatchText(lap.time) }}</time>
          </div>
        </div>
      </template>
      <template v-else>
        <div v-if="total>0 || finished" class="timer-face">
          <svg viewBox="0 0 320 320" class="ring">
            <circle cx="160" cy="160" r="144" class="track" />
            <circle
              cx="160"
              cy="160"
              r="144"
              class="progress"
              :stroke-dasharray="905"
              :stroke-dashoffset="905*(1-progress)"
             />
          </svg>
          <div>
            <time>{{ timerText }}</time>
            <p>{{ finished?'Time is up.':timerLabel }}</p>
            <span v-if="!running && !finished">Paused</span>
          </div>
        </div>
        <div v-else class="timer-setup">
          <div class="time-fields">
            <label>
              <input v-model="hours" type="number" min="0" max="23" aria-label="Timer hours" />
              hours
            </label>
            <label>
              <input v-model="minutes" type="number" min="0" max="59" aria-label="Timer minutes" />
              min
            </label>
            <label>
              <input v-model="seconds" type="number" min="0" max="59" aria-label="Timer seconds" />
              sec
            </label>
          </div>
          <div class="presets">
            <button v-for="value in [1,5,25]" :key="value" class="pill glass" @click="preset(value)">
              {{ value }}
              min
            </button>
          </div>
        </div>
        <div class="dual-controls">
          <button class="round neutral" @click="cancelTimer">Cancel</button>
          <button class="round" :class="running?'amber':'green'" @click="startTimer">{{ running?'Pause':remaining>0?'Resume':'Start' }}</button>
        </div>
        <label class="timer-label">
          Label
          <input v-model="timerLabel" maxlength="40" aria-label="Timer label" />
        </label>
        <div class="sound-row">
          <span>When Timer Ends</span>
          <span>Friendly notification ›</span>
        </div>
        <p class="footnote">A gentle nudge. No audio. No drama.</p>
      </template>
    </main>
    <nav class="tabs" :inert="adding">
      <button
        v-for="(item,i) in ['World Clock','Alarms','Stopwatch','Timers']"
        :key="item"
        :class="{active:tab===item}"
        @click="tab=item"
      >
        <svg viewBox="0 0 24 24">
          <path :d="icons[i===1?'bell':'clock']" />
        </svg>
        {{ item }}
      </button>
    </nav>
    <div
      v-if="adding"
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Add alarm"
      @keydown.esc="adding=false"
    >
      <div ref="alarmDialog" class="alarm-sheet glass" @keydown="trapAlarmFocus">
        <div class="bar">
          <button class="orange pill" @click="adding=false">Cancel</button>
          <h3>Add Alarm</h3>
          <button
            class="orange pill"
            :disabled="!(/^(?:[01]\d|2[0-3]):[0-5]\d$/).test(alarmTime)"
            @click="saveAlarm"
          >
            Save
          </button>
        </div>
        <input ref="alarmField" v-model="alarmTime" class="alarm-time-input" type="time" aria-label="Alarm time" />
        <label class="form-row">
          Label
          <input v-model="alarmLabel" maxlength="50" aria-label="Alarm label" />
        </label>
        <div class="form-row">
          Repeat
          <span>Every imaginary day</span>
        </div>
        <div class="form-row">
          Sound
          <span>Silent optimism</span>
        </div>
        <p class="footnote">This alarm lives only in the pocket lab.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  letter-spacing: -.02em;
  font-size: 17px;
  isolation: isolate;
}

.app * {
  box-sizing: border-box;
}

button, input, textarea {
  font: inherit;
  letter-spacing: inherit;
}

button {
  cursor: pointer;
  border: 0;
  background: none;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  touch-action: manipulation;
  transition: transform 250ms ease, opacity 250ms ease;
}

button:active {
  transform: scale(.96);
}

button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid #4d9fff;
  outline-offset: 2px;
}

button:disabled {
  opacity: .45;
  cursor: default;
}

input, textarea {
  font-size: 16px;
  min-height: 44px;
  color: inherit;
  border: 0;
  outline: none;
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -.035em;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

h3 {
  font-size: 17px;
  font-weight: 600;
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  min-height: 0;
}

.scroll::-webkit-scrollbar {
  display: none;
}

.glass {
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255,255,255,.35);
}

.top {
  padding: var(--safe-top,62px) 20px 12px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  padding: 10px;
}

.muted {
  color: #8e8e93;
  font-size: 13px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  gap: 2px;
  flex-shrink: 0;
  padding: 8px 10px var(--safe-bottom,34px);
  background: rgba(249,249,250,.85);
  backdrop-filter: blur(25px) saturate(180%);
  border-top: 1px solid rgba(0,0,0,.08);
}

.tabs button {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  min-height: 52px;
  border-radius: 22px;
  color: #8e8e93;
}

.tabs button.active {
  color: var(--accent,#007aff);
  background: rgba(127,127,127,.1);
}

.pill {
  border-radius: 24px;
  padding: 8px 16px;
}

.empty {
  padding: 44px 24px;
  text-align: center;
  color: #8e8e93;
  line-height: 1.5;
}

.search {
  width: 100%;
  background: rgba(127,127,127,.12);
  border-radius: 14px;
  padding: 10px 14px;
}

.section-label {
  font-size: 13px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: .03em;
  padding: 22px 16px 8px;
}

.hairline {
  border-bottom: 1px solid rgba(127,127,127,.18);
}

@media(prefers-reduced-motion:reduce) {
  .app *, .app *::before, .app *::after {
    animation: none!important;
    transition: none!important;
    scroll-behavior: auto!important;
  }
}

.app {
  background: #000;
  color: #fff;
  --accent: #ff9f0a;
}

.top {
  padding-bottom: 20px;
}

.top h1 {
  margin-top: 14px;
}

.orange {
  color: #ff9f0a;
}

.content {
  flex: 1;
  padding: 0 20px;
}

.tabs {
  background: #181818cc;
  border-top-color: #ffffff12;
}

.world-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px 0;
  border-bottom: 1px solid #ffffff24;
}

.world-row p {
  font-size: 14px;
  color: #98989d;
  margin-bottom: 7px;
}

.world-row h2 {
  font-size: 29px;
  font-weight: 400;
}

.world-row small {
  font-size: 12px;
  color: #777;
  margin-top: 6px;
  display: block;
}

.world-row time {
  font-size: 47px;
  font-weight: 300;
  letter-spacing: -.045em;
  font-variant-numeric: tabular-nums;
}

.footnote {
  font-size: 12px;
  color: #777;
  text-align: center;
  margin: 26px 12px;
  line-height: 1.5;
}

.sleep-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #1c1c1e;
  border-radius: 20px;
  padding: 18px 12px;
  border-color: #ffffff15;
}

.sleep-card>div {
  flex: 1;
}

.sleep-card p {
  font-size: 12px;
  color: #888;
  margin-top: 5px;
}

.sleep-card svg {
  color: #ff9f0a;
}

.sleep-card button {
  font-size: 13px;
  color: #ff9f0a;
  background: #2c2c2e;
}

.other {
  margin: 28px 0 8px;
}

.alarm-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #ffffff22;
  padding: 16px 0;
}

.alarm-row>div {
  flex: 1;
}

.alarm-row time {
  font-size: 58px;
  font-weight: 300;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.alarm-row p {
  font-size: 15px;
  margin-top: 6px;
}

.alarm-row.off>div {
  color: #777;
}

.toggle {
  width: 59px;
  height: 44px;
  min-width: 59px;
  position: relative;
  padding: 0;
}

.toggle::before {
  content: '';
  position: absolute;
  inset: 6px 4px;
  background: #39393d;
  border-radius: 22px;
  transition: transform 250ms ease, opacity 250ms ease;
}

.toggle span {
  position: absolute;
  left: 6px;
  top: 8px;
  width: 28px;
  height: 28px;
  background: #fff;
  border-radius: 50%;
  transition: transform 250ms ease, opacity 250ms ease;
}

.toggle.on::before {
  background: #30d158;
}

.toggle.on span {
  transform: translateX(19px);
}

.remove {
  color: #ff453a;
  font-size: 28px;
}

.stopwatch-display {
  font-size: 72px;
  font-weight: 200;
  letter-spacing: -.045em;
  font-variant-numeric: tabular-nums;
  text-align: center;
  padding: 100px 0 75px;
}

.dual-controls {
  display: flex;
  justify-content: space-between;
  margin: 0 4px 24px;
}

.round {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  outline: 2px solid currentColor;
  outline-offset: -6px;
  border: 2px solid #000;
  font-size: 17px;
}

.neutral {
  background: #242426;
  color: #a5a5a8;
}

.green {
  background: #082f16;
  color: #30d158;
}

.red {
  background: #3a0d0c;
  color: #ff453a;
}

.amber {
  background: #34230c;
  color: #ff9f0a;
}

.dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 16px 0 20px;
}

.dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #555;
}

.dots i:first-child {
  background: #fff;
}

.lap-row {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #ffffff25;
  padding: 17px 0;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}

.fast {
  color: #30d158;
}

.slow {
  color: #ff453a;
}

.timer-setup {
  height: 320px;
  padding-top: 75px;
}

.time-fields {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.time-fields label {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 14px;
  color: #999;
}

.time-fields input {
  width: 103px;
  height: 90px;
  background: #161618;
  border: 1px solid #ffffff18;
  border-radius: 20px;
  text-align: center;
  font-size: 47px;
  color: #fff;
  margin-bottom: 10px;
}

.presets {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 30px;
}

.presets button {
  background: #262322;
  color: #ff9f0a;
  font-size: 14px;
  border-color: #ffffff15;
}

.timer-face {
  width: 320px;
  height: 320px;
  position: relative;
  margin: 12px auto 25px;
}

.ring {
  width: 320px;
  height: 320px;
  stroke-width: 5;
  transform: rotate(-90deg);
}

.track {
  stroke: #2c2c2e;
}

.progress {
  stroke: #ff9f0a;
}

.timer-face>div {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.timer-face time {
  font-size: 61px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
}

.timer-face p {
  color: #a1a1a6;
  font-size: 14px;
  margin-top: 9px;
}

.timer-face span {
  color: #ff9f0a;
  font-size: 13px;
  margin-top: 10px;
}

.timer-label, .sound-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1c1c1e;
  padding: 10px 16px;
  border-bottom: 1px solid #ffffff15;
  min-height: 60px;
}

.timer-label {
  border-radius: 15px 15px 0 0;
}

.timer-label input {
  background: transparent;
  text-align: right;
  width: 210px;
  color: #aaa;
}

.sound-row {
  border-radius: 0 0 15px 15px;
}

.sound-row span:last-child {
  color: #888;
  font-size: 13px;
}

.modal {
  position: absolute;
  inset: 0;
  background: #0008;
  display: flex;
  align-items: flex-end;
  padding-top: var(--safe-top,62px);
}

.alarm-sheet {
  width: 100%;
  height: 650px;
  max-height: 100%;
  padding: 20px 18px var(--safe-bottom,34px);
  background: #1c1c1e;
  border-radius: 32px 32px 0 0;
  border-color: #ffffff20;
}

.alarm-time-input {
  display: block;
  width: 100%;
  text-align: center;
  font-size: 58px;
  background: transparent;
  color: #fff;
  color-scheme: dark;
  margin: 60px 0 50px;
  min-height: 95px;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 60px;
  padding: 12px;
  background: #2c2c2e;
  border-bottom: 1px solid #ffffff10;
}

.form-row input {
  max-width: 220px;
  text-align: right;
  background: transparent;
}

.form-row span {
  font-size: 14px;
  color: #999;
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

.top, .tabs {
  flex-shrink: 0;
}

.time-fields label {
  flex: 1;
  min-width: 0;
  max-width: 103px;
}

.time-fields input {
  width: 100%;
  min-width: 0;
}

.timer-label input {
  width: 0;
  min-width: 0;
  flex: 1;
}

.timer-label, .sound-row {
  gap: 12px;
}

.timer-setup {
  height: auto;
  padding: clamp(24px, 8cqh, 75px) 0 38px;
}

.timer-face {
  width: min(100%, 320px, 44cqh);
  height: auto;
  aspect-ratio: 1;
}

.ring {
  width: 100%;
  height: 100%;
}

.timer-face time {
  font-size: clamp(38px, 14cqw, 61px);
}

.alarm-sheet {
  overflow-y: auto;
  overscroll-behavior: contain;
}

.world-row > div, .alarm-row > div {
  min-width: 0;
}

.world-row time {
  flex-shrink: 0;
}

.world-row small, .footnote, .time-fields label, .sound-row span:last-child {
  color: #aeb0b6;
}

.stopwatch-display {
  font-size: clamp(48px, 16cqw, 72px);
  padding: 10cqh 0 8cqh;
}

@container (max-width: 380px) {
  .content {
    padding-inline: 16px;
  }
  .world-row h2 {
    font-size: 25px;
  }
  .world-row time {
    font-size: 40px;
  }
  .world-row {
    gap: 8px;
  }
  .alarm-row time {
    font-size: 50px;
  }
  .sleep-card {
    flex-wrap: wrap;
  }
}

@container (max-height: 700px) {
  .time-fields input {
    height: 76px;
    font-size: 40px;
  }
  .timer-setup {
    padding-top: 22px;
  }
  .timer-face {
    margin-block: 8px 20px;
  }
}

.alarm-sheet {
  animation: pocket-reveal 250ms ease both;
}

@keyframes pocket-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .alarm-sheet {
    animation: none;
  }
}
</style>
