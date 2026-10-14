<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import AppSheet from './arcade/AppSheet.vue';
import ClockFace from './clock/ClockFace.vue';
import StopwatchDial from './clock/StopwatchDial.vue';
import { advanceTimers, pauseTimer, resumeTimer, elapsedAt, type Timer } from './clock/timing';
import { CITIES, DAYS, readAlarms, alarmDue, pad, stopwatchText, timerText, type Alarm, type ClockCity } from './clock/model';
defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const tabs = ['World Clock', 'Alarms', 'Stopwatch', 'Timers'] as const;
type Tab = typeof tabs[number];
const tab = ref<Tab>('World Clock');
const sheet = ref<'cities' | 'alarm' | 'timer' | null>(null);
const cityIds = ref(CITIES.slice(0, 6).map(city => city.id));
const cityQuery = ref('');
const cities = computed(() => cityIds.value.map(id => CITIES.find(city => city.id === id)).filter((city): city is ClockCity => !!city));
const cityChoices = computed(() => CITIES.filter(city => (city.name + ' ' + city.region).toLowerCase().includes(cityQuery.value.trim().toLowerCase())));
const smoothNow = ref(vision.now.value.getTime());
const alarms = ref<Alarm[]>([]);
const alarmHour = ref(7), alarmMinute = ref(0), alarmLabel = ref('A fresh start');
const alarmDays = ref<number[]>([]);
const editing = ref<string | null>(null);
const storageReady = ref(false);
const alerts = ref<{ id: string; label: string }[]>([]);
const snoozes = ref<{ id: string; label: string; due: number }[]>([]);
const notice = computed(() => alerts.value[0]);
const stopwatchRunning = ref(false);
const elapsed = ref(0);
const laps = ref<{ number: number; split: number; total: number }[]>([]);
const lapRows = computed(() => [...laps.value].reverse());
const best = computed(() => laps.value.length >= 2 ? Math.min(...laps.value.map(lap => lap.split)) : -1);
const worst = computed(() => laps.value.length >= 2 ? Math.max(...laps.value.map(lap => lap.split)) : -1);
const timers = ref<Timer[]>([]);
const presets = [{ label: '1 min', minutes: 1 }, { label: '3 min', minutes: 3 }, { label: '5 min', minutes: 5 }, { label: '10 min', minutes: 10 }, { label: '25 min', minutes: 25 }, { label: 'Chai', minutes: 4 }, { label: 'Pasta', minutes: 9 }];
const customMinutes = ref(5), customLabel = ref('A little countdown');
const timerValid = computed(() => Number.isFinite(customMinutes.value) && customMinutes.value >= 1 && customMinutes.value <= 1440);
const reduced = ref(false);
let frame = 0;
let tick: ReturnType<typeof setInterval> | undefined;
let preference: MediaQueryList | undefined;
let mounted = false, disposed = false;
let anchorWall = vision.now.value.getTime(), anchorPerf = 0;
let stopwatchBase = 0, stopwatchStart = 0, lastPaint = 0;
let counter = 0;
let audio: AudioContext | undefined;
const oscillators = new Set<OscillatorNode>();
const gains = new Set<GainNode>();
const uid = (): string => 'clock-' + Date.now().toString(36) + '-' + (++counter).toString(36);
function local(city: ClockCity): Date { return new Date(smoothNow.value + city.offset * 60000); }
function digital(city: ClockCity): string { return local(city).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }); }
function difference(city: ClockCity): string {
  const reference = vision.now.value;
  const localOffset = -reference.getTimezoneOffset();
  const days = Math.floor((reference.getTime() + city.offset * 60000) / 86400000) - Math.floor((reference.getTime() + localOffset * 60000) / 86400000);
  const delta = city.offset - localOffset;
  const absolute = Math.abs(delta);
  const offset = delta === 0 ? 'local' : (delta > 0 ? '+' : '−') + Math.floor(absolute / 60) + 'h' + (absolute % 60 ? pad(absolute % 60) : '');
  return (days > 0 ? 'Tomorrow' : days < 0 ? 'Yesterday' : 'Today') + ', ' + offset;
}
function toggleCity(id: string): void { cityIds.value = cityIds.value.includes(id) ? cityIds.value.filter(value => value !== id) : [...cityIds.value, id]; }
function alarmTime(alarm: Alarm): string { return pad(alarm.hour) + ':' + pad(alarm.minute); }
function repeatText(days: number[]): string { return days.length === 0 ? 'Once' : days.length === 7 ? 'Every day' : days.slice().sort((a,b) => a - b).map(day => DAYS[day]).join(', '); }
function editAlarm(alarm?: Alarm): void {
  editing.value = alarm?.id ?? null; alarmHour.value = alarm?.hour ?? 7; alarmMinute.value = alarm?.minute ?? 0; alarmLabel.value = alarm?.label ?? 'A fresh start'; alarmDays.value = [...(alarm?.days ?? [])]; sheet.value = 'alarm';
}
function toggleDay(index: number): void { alarmDays.value = alarmDays.value.includes(index) ? alarmDays.value.filter(day => day !== index) : [...alarmDays.value, index]; }
function saveAlarm(): void {
  if (!editing.value && alarms.value.length >= 50) { vision.toast('Fifty alarms is quite a morning. Remove one first.'); return; }
  const old = alarms.value.find(alarm => alarm.id === editing.value);
  const value: Alarm = { id: editing.value ?? uid(), hour: alarmHour.value, minute: alarmMinute.value, label: alarmLabel.value.trim().slice(0, 60) || 'Alarm', days: [...alarmDays.value], enabled: old?.enabled ?? true, lastFired: old?.lastFired };
  if (old) alarms.value = alarms.value.map(alarm => alarm.id === old.id ? value : alarm);
  else alarms.value.push(value);
  sheet.value = null;
}
function deleteAlarm(): void {
  const id = editing.value;
  alarms.value = alarms.value.filter(alarm => alarm.id !== id); snoozes.value = snoozes.value.filter(alarm => alarm.id !== id); sheet.value = null;
}
function checkAlarms(date: Date): void {
  if (!storageReady.value || disposed) return;
  for (const alarm of alarms.value) {
    if (!alarmDue(alarm, date)) continue;
    alarm.lastFired = Math.floor(date.getTime() / 60000);
    if (!alarm.days.length) alarm.enabled = false;
    alerts.value.push({ id: alarm.id, label: alarm.label }); vision.toast('Alarm · ' + alarm.label);
  }
  const due = snoozes.value.filter(alarm => date.getTime() >= alarm.due);
  snoozes.value = snoozes.value.filter(alarm => date.getTime() < alarm.due);
  for (const alarm of due) { alerts.value.push({ id: alarm.id, label: alarm.label }); vision.toast('Snooze is over · ' + alarm.label); }
}
function snooze(): void {
  const alert = alerts.value.shift();
  if (alert) { snoozes.value.push({ ...alert, due: vision.now.value.getTime() + 5 * 60000 }); vision.toast('Five more minutes. A tiny luxury.'); }
}
watch(alarms, () => {
  if (!storageReady.value) return;
  try { localStorage.setItem('lab-vision-alarms', JSON.stringify(alarms.value)); } catch { vision.toast('Alarm storage is unavailable. These alarms stay in this session.'); }
}, { deep: true });
watch(() => vision.now.value.getTime(), value => {
  anchorWall = value; if (mounted) anchorPerf = performance.now();
  smoothNow.value = value;
  checkAlarms(new Date(value));
});
function stopwatchValue(): number { return elapsedAt(stopwatchBase, stopwatchStart, stopwatchRunning.value, performance.now()); }
function toggleStopwatch(): void {
  if (stopwatchRunning.value) { stopwatchBase = stopwatchValue(); stopwatchRunning.value = false; elapsed.value = stopwatchBase; }
  else { stopwatchStart = performance.now(); stopwatchRunning.value = true; }
}
function lapOrReset(): void {
  if (!stopwatchRunning.value) { stopwatchBase = 0; elapsed.value = 0; laps.value = []; return; }
  const total = stopwatchValue();
  laps.value.push({ number: laps.value.length + 1, split: total - (laps.value[laps.value.length - 1]?.total ?? 0), total });
}
async function prepareAudio(): Promise<void> {
  if (disposed) return;
  try { if (!audio && typeof AudioContext !== 'undefined') audio = new AudioContext(); if (audio?.state === 'suspended') await audio.resume(); } catch { /* Visual alerts remain available if audio is blocked. */ }
}
function chime(): void {
  const context = audio;
  if (!context || context.state !== 'running') return;
  // Timers have their own quiet chime, independent of environment ambience.
  [659.25, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    const start = context.currentTime + index * .2;
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.035, start + .025); gain.gain.exponentialRampToValueAtTime(.0001, start + .7);
    oscillator.connect(gain); gain.connect(context.destination); oscillators.add(oscillator); gains.add(gain);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); oscillators.delete(oscillator); gains.delete(gain); };
    oscillator.start(start); oscillator.stop(start + .75);
  });
}
function startTimer(minutes: number, label: string): void {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return;
  if (timers.value.length >= 20) { vision.toast('Twenty timers are plenty of suspense. Clear one first.'); return; }
  void prepareAudio();
  const duration = Math.round(minutes * 60000);
  timers.value.push({ id: uid(), label: label.trim().slice(0, 60) || 'Timer', duration, remaining: duration, deadline: performance.now() + duration, state: 'running' }); sheet.value = null;
}
function updateTimers(): void {
  const finished = advanceTimers(timers.value, performance.now());
  for (const timer of finished) vision.toast(timer.label + ' · Time is up.');
  if (finished.length) chime();
}
function toggleTimer(timer: Timer): void {
  const wasRunning = timer.state === 'running';
  updateTimers();
  if (wasRunning) { if (timer.state === 'running') pauseTimer(timer, performance.now()); }
  else { resumeTimer(timer, performance.now()); void prepareAudio(); }
}
function timerProgress(timer: Timer): number { return 1 - timer.remaining / timer.duration; }
function animate(time: number): void {
  if (disposed || document.hidden || reduced.value) return;
  if (tab.value === 'World Clock') smoothNow.value = anchorWall + time - anchorPerf;
  if (tab.value === 'Stopwatch' && stopwatchRunning.value && time - lastPaint >= 16) { elapsed.value = stopwatchValue(); lastPaint = time; }
  frame = requestAnimationFrame(animate);
}
function startFrames(): void {
  cancelAnimationFrame(frame);
  if (!mounted || disposed) return;
  updateTimers();
  if (stopwatchRunning.value) elapsed.value = stopwatchValue();
  if (!document.hidden && !reduced.value && (tab.value === 'World Clock' || (tab.value === 'Stopwatch' && stopwatchRunning.value))) frame = requestAnimationFrame(animate);
}
function motion(): void { reduced.value = preference?.matches ?? false; startFrames(); }
watch([tab, stopwatchRunning], startFrames);
function tabKeys(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = tabs.indexOf(tab.value);
  tab.value = event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[3] : tabs[(index + (event.key === 'ArrowRight' ? 1 : 3)) % tabs.length]!;
  (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button')[tabs.indexOf(tab.value)]?.focus();
}
onMounted(() => {
  mounted = true; anchorPerf = performance.now();
  try { alarms.value = readAlarms(localStorage.getItem('lab-vision-alarms')); } catch { /* Session-only alarms still work. */ }
  storageReady.value = true; checkAlarms(vision.now.value);
  preference = matchMedia('(prefers-reduced-motion: reduce)'); preference.addEventListener('change', motion); motion();
  document.addEventListener('visibilitychange', startFrames);
  tick = setInterval(() => { updateTimers(); if (!document.hidden && stopwatchRunning.value && reduced.value) elapsed.value = stopwatchValue(); }, 200);
});
onBeforeUnmount(() => {
  disposed = true; mounted = false; cancelAnimationFrame(frame); clearInterval(tick); preference?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', startFrames);
  for (const oscillator of oscillators) { oscillator.onended = null; try { oscillator.stop(); } catch { /* Already ended. */ } oscillator.disconnect(); }
  for (const gain of gains) gain.disconnect(); oscillators.clear(); gains.clear(); if (audio) void audio.close().catch(() => undefined);
});
</script>

<template>
<div class="clock-app" :class="{ compact }">
  <div class="clock-layout" :inert="sheet || notice ? true : undefined">
    <nav class="clock-tabs vk-segmented vk-scroll" aria-label="Clock tools" @keydown="tabKeys"><button v-for="item in tabs" :key="item" v-hover :aria-pressed="tab === item" @click="tab = item">{{ item }}</button></nav>
    <main class="clock-content vk-scroll">
      <template v-if="tab === 'World Clock'">
        <header class="section-heading"><div><h1 class="vk-large-title">World Clock</h1><p class="vk-footnote vk-secondary">A few different moments, all at once.</p></div><button v-hover class="vk-button" @click="sheet = 'cities'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add city</button></header>
        <div class="world-grid"><section v-for="city in cities" :key="city.id" class="world-card vk-well"><div class="world-top"><span class="vk-footnote vk-secondary">{{ difference(city) }}</span><button v-hover class="vk-icon" :aria-label="'Remove ' + city.name" @click="toggleCity(city.id)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12" /></svg></button></div><ClockFace :time="smoothNow" :offset="city.offset" /><h2 class="vk-headline">{{ city.name }}</h2><p class="city-digital">{{ digital(city) }}</p></section></div>
        <div v-if="!cities.length" class="empty vk-platter"><h2 class="vk-title">The world is still ticking.</h2><p>Add a city to give it a face.</p><button v-hover class="vk-button primary" @click="sheet = 'cities'">Choose cities</button></div>
        <p class="bottom-note vk-footnote vk-secondary">Fixed UTC offsets, without daylight saving changes. Day faces: 06:00–18:00.</p>
      </template>
      <template v-else-if="tab === 'Alarms'">
        <header class="section-heading"><div><h1 class="vk-large-title">Alarms</h1><p class="vk-footnote vk-secondary">A gentle nudge for future you.</p></div><button v-hover class="vk-button" @click="editAlarm()">Add alarm</button></header>
        <div class="alarm-list"><div v-for="alarm in alarms" :key="alarm.id" class="alarm-row vk-row vk-well"><button v-hover class="alarm-detail" :aria-label="'Edit ' + alarm.label + ', ' + alarmTime(alarm)" @click="editAlarm(alarm)"><strong :class="{ muted: !alarm.enabled }">{{ alarmTime(alarm) }}</strong><span>{{ alarm.label }} <small>· {{ repeatText(alarm.days) }}</small></span></button><label class="toggle-hit"><input v-model="alarm.enabled" type="checkbox" class="vk-toggle" :aria-label="alarm.label + ' alarm enabled'" /></label></div></div>
        <div v-if="!alarms.length" class="empty vk-platter"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="24" cy="27" r="15" /><path d="M24 17v11l7 4M8 9l7-4m25 4-7-4M13 41l-3 4m25-4 3 4" /></svg><h2 class="vk-title">Nothing to wake up for. Yet.</h2><p>Your first alarm is one small tap away.</p><button v-hover class="vk-button primary" @click="editAlarm()">Add an alarm</button></div>
        <p v-if="snoozes.length" class="snooze-note vk-footnote">{{ snoozes.length }} snoozed alarm{{ snoozes.length > 1 ? 's' : '' }} waiting patiently.</p>
        <p class="bottom-note vk-footnote vk-secondary">Alarms use your browser's local time and ring while this app is open. This is a portfolio clock, so keep your real alarm clock for real deadlines.</p>
      </template>
      <template v-else-if="tab === 'Stopwatch'">
        <header class="section-heading"><div><h1 class="vk-large-title">Stopwatch</h1><p class="vk-footnote vk-secondary">For very important tiny races.</p></div><span class="vk-chip">{{ stopwatchRunning ? 'Running' : elapsed ? 'Paused' : 'Ready' }}</span></header>
        <div class="stopwatch-layout"><section class="stopwatch-main"><StopwatchDial :elapsed="elapsed" /><output class="stopwatch-digital" aria-label="Stopwatch elapsed time">{{ stopwatchText(elapsed) }}</output><div class="stopwatch-actions"><button v-hover class="round-action neutral" :disabled="!stopwatchRunning && !elapsed" @click="lapOrReset">{{ stopwatchRunning ? 'Lap' : 'Reset' }}</button><button v-hover class="round-action" :class="stopwatchRunning ? 'stop' : 'start'" @click="toggleStopwatch">{{ stopwatchRunning ? 'Stop' : elapsed ? 'Resume' : 'Start' }}</button></div><p class="vk-footnote vk-secondary dial-caption">Outer dial: 60 seconds · Inner dial: 30 minutes</p></section><section class="laps vk-well" tabindex="0" aria-label="Stopwatch laps"><div class="laps-heading"><h2 class="vk-headline">Laps</h2><span class="vk-footnote vk-secondary">Split / Total</span></div><div v-if="!laps.length" class="laps-empty vk-footnote vk-secondary">Start, then tap Lap to bookmark a moment.</div><div v-for="lap in lapRows" :key="lap.number" class="lap-row" :class="{ best: lap.split === best, worst: lap.split === worst && best !== worst }"><span>Lap {{ lap.number }}<small v-if="lap.split === best">Best</small><small v-else-if="lap.split === worst && best !== worst">Slowest</small></span><span>{{ stopwatchText(lap.split) }}<small>{{ stopwatchText(lap.total) }}</small></span></div></section></div>
      </template>
      <template v-else>
        <header class="section-heading"><div><h1 class="vk-large-title">Timers</h1><p class="vk-footnote vk-secondary">Make a little room for later.</p></div><button v-hover class="vk-button" @click="sheet = 'timer'">New timer</button></header>
        <div class="presets" aria-label="Timer presets"><button v-for="preset in presets" :key="preset.label" v-hover class="preset vk-button" @click="startTimer(preset.minutes, preset.label)">{{ preset.label }}<small v-if="['Chai','Pasta'].includes(preset.label)">{{ preset.minutes }} min</small></button></div>
        <div v-if="timers.length" class="timer-grid"><section v-for="timer in timers" :key="timer.id" class="timer-card vk-platter" :class="{ finished: timer.state === 'finished' }"><div class="timer-top"><h2 class="vk-headline">{{ timer.label }}</h2><button v-hover class="vk-icon" :aria-label="'Cancel ' + timer.label + ' timer'" @click="timers = timers.filter(item => item.id !== timer.id)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></div><div class="timer-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="78" fill="none" stroke="#ffffff15" stroke-width="5" /><circle cx="90" cy="90" r="78" fill="none" :stroke="timer.state === 'finished' ? '#ace6c7' : '#ffb063'" stroke-width="5" stroke-linecap="round" :stroke-dasharray="2 * Math.PI * 78" :stroke-dashoffset="2 * Math.PI * 78 * timerProgress(timer)" transform="rotate(-90 90 90)" /></svg><div><output>{{ timerText(timer.remaining) }}</output><small>{{ timer.state === 'finished' ? 'Time is up' : timer.state === 'paused' ? 'Paused' : timerText(timer.duration) + ' total' }}</small></div></div><button v-hover class="vk-button" :class="{ primary: timer.state === 'finished' }" @click="toggleTimer(timer)">{{ timer.state === 'running' ? 'Pause' : timer.state === 'paused' ? 'Resume' : 'Again' }}</button><p v-if="timer.state === 'finished'" class="finished-note" role="status">A small ding. A job well timed.</p></section></div>
        <div v-else class="empty timer-empty"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="24" cy="27" r="16" /><path d="M24 19v9l7 4M18 4h12m-6 0v7m14 3 4-4" /></svg><h2 class="vk-title">Good things take a little time.</h2><p>Pick a preset. Put the kettle on.</p></div>
        <p class="bottom-note vk-footnote vk-secondary">Timers keep counting across tabs while this app is open. A quiet chime plays when browser audio is available.</p>
      </template>
    </main>
  </div>
  <AppSheet v-if="sheet" :inert="notice ? true : undefined" :title="sheet === 'cities' ? 'Add or remove cities' : sheet === 'alarm' ? editing ? 'Edit alarm' : 'Add alarm' : 'New timer'" @close="sheet = null">
    <template v-if="sheet === 'cities'"><input v-model="cityQuery" v-hover class="vk-field" type="search" aria-label="Search twenty cities" placeholder="Search 20 cities" /><p class="sheet-note vk-footnote vk-secondary">Tap a city to add or remove it. All offsets are fixed.</p><div class="city-options"><button v-for="city in cityChoices" :key="city.id" v-hover class="vk-row" :aria-pressed="cityIds.includes(city.id)" @click="toggleCity(city.id)"><span><strong>{{ city.name }}</strong><small>{{ city.region }}</small></span><span v-if="cityIds.includes(city.id)" class="city-check" aria-label="Added"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></span></button><p v-if="!cityChoices.length" class="vk-footnote vk-secondary">No city matches. This little globe has twenty stops.</p></div><button v-hover class="vk-button primary sheet-done" @click="sheet = null">Done</button></template>
    <form v-else-if="sheet === 'alarm'" @submit.prevent="saveAlarm"><div class="time-steppers"><div><span class="vk-footnote vk-secondary">Hour</span><button v-hover type="button" class="vk-icon" aria-label="Increase hour" @click="alarmHour = (alarmHour + 1) % 24">+</button><output>{{ pad(alarmHour) }}</output><button v-hover type="button" class="vk-icon" aria-label="Decrease hour" @click="alarmHour = (alarmHour + 23) % 24">−</button></div><span class="stepper-colon">:</span><div><span class="vk-footnote vk-secondary">Minute</span><button v-hover type="button" class="vk-icon" aria-label="Increase minute" @click="alarmMinute = (alarmMinute + 1) % 60">+</button><output>{{ pad(alarmMinute) }}</output><button v-hover type="button" class="vk-icon" aria-label="Decrease minute" @click="alarmMinute = (alarmMinute + 59) % 60">−</button></div></div><label class="form-label">Label<input v-model="alarmLabel" v-hover class="vk-field" maxlength="60" placeholder="Alarm" /></label><fieldset class="repeat-days"><legend class="vk-footnote vk-secondary">Repeat · {{ repeatText(alarmDays) }}</legend><button v-for="(day,index) in DAYS" :key="day" v-hover type="button" class="vk-chip" :aria-pressed="alarmDays.includes(index)" @click="toggleDay(index)">{{ day }}</button></fieldset><div class="sheet-actions"><button v-if="editing" v-hover type="button" class="vk-button destructive" @click="deleteAlarm">Delete alarm</button><button v-hover class="vk-button primary" type="submit">Save alarm</button></div></form>
    <form v-else @submit.prevent="startTimer(customMinutes, customLabel)"><label class="form-label">Minutes<input v-model.number="customMinutes" v-hover class="vk-field" type="number" min="1" max="1440" step="1" required /></label><label class="form-label">Name<input v-model="customLabel" v-hover class="vk-field" maxlength="60" placeholder="Timer" /></label><p class="sheet-note vk-footnote vk-secondary">One minute to one day. Even pasta deserves boundaries.</p><button v-hover class="vk-button primary" :disabled="!timerValid" type="submit">Start timer</button></form>
  </AppSheet>
  <AppSheet v-if="notice" title="Alarm" @close="alerts.shift()"><div class="alarm-alert"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="24" cy="27" r="15" /><path d="M24 17v11l7 4M8 9l7-4m25 4-7-4" /></svg><h2 class="vk-large-title">{{ notice.label }}</h2><p class="vk-secondary">Your moment has arrived.</p><p v-if="alerts.length > 1" class="vk-footnote vk-secondary">{{ alerts.length - 1 }} more waiting</p><div class="sheet-actions"><button v-hover class="vk-button" @click="snooze">Snooze · 5 min</button><button v-hover class="vk-button primary" @click="alerts.shift()">Stop</button></div></div></AppSheet>
</div>
</template>

<style src="../kit/kit.css"></style>
<style scoped>
.clock-app { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; color: var(--vk-text); container-type: size; } .clock-app * { box-sizing: border-box; } button,input { font: inherit; } button { background: none; border: 0; color: inherit; cursor: pointer; } :focus-visible { outline: 2px solid white; outline-offset: 3px; } button:disabled { opacity: .35; cursor: default; } h1,h2,p { margin: 0; }
.clock-layout { height: 100%; min-height: 0; display: flex; flex-direction: column; padding-top: 22px; } .clock-app .clock-tabs { flex: none; align-self: center; max-width: calc(100% - 44px); } .clock-app .clock-tabs button { min-height: 44px; white-space: nowrap; }
.clock-content { min-height: 0; flex: 1; padding: 24px 28px 28px; } .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; } .section-heading p { margin-top: 8px; } .section-heading > button { flex: none; }
.world-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 18px; } .world-card { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 10px 16px 18px; border-radius: 28px; min-width: 0; } .world-top { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 5px; } .world-top > span { font-size: 11px; } .world-top .vk-icon { width: 44px; height: 44px; background: none; } .world-card h2 { margin-top: 6px; } .city-digital { font-size: 20px; font-weight: 300; font-variant-numeric: tabular-nums; }
.bottom-note { margin-top: 22px; line-height: 1.6; max-width: 650px; } .empty { display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; padding: 42px 22px; min-height: 260px; text-align: center; } .empty > svg { width: 64px; height: 64px; color: #c5d5ef; } .empty > p { color: var(--vk-secondary); }
.alarm-list { display: flex; flex-direction: column; gap: 12px; } .alarm-row { padding: 8px 22px; border-radius: 24px; } .alarm-detail { display: flex; flex-direction: column; flex: 1; min-width: 0; border-radius: 20px; padding: 10px 0; text-align: left; gap: 4px; } .alarm-detail strong { font-size: 54px; font-weight: 300; font-variant-numeric: tabular-nums; letter-spacing: -.04em; line-height: 1.1; } .alarm-detail > span { font-size: 15px; overflow-wrap: anywhere; } .alarm-detail small { font-size: 13px; color: var(--vk-secondary); } .muted { opacity: .45; } .toggle-hit { min-width: 58px; min-height: 48px; display: grid; place-items: center; cursor: pointer; } .snooze-note { margin: 20px 4px; color: #ffcd91; }
.stopwatch-layout { display: grid; grid-template-columns: minmax(0,1fr) minmax(200px,.9fr); gap: 28px; align-items: start; } .stopwatch-main { display: flex; flex-direction: column; align-items: center; gap: 16px; } .stopwatch-digital { font-size: clamp(32px,5cqw,54px); font-weight: 200; font-variant-numeric: tabular-nums; letter-spacing: -.035em; white-space: nowrap; } .stopwatch-actions { display: flex; width: min(100%,300px); align-items: center; justify-content: space-between; padding: 0 12px; } .round-action { width: 76px; height: 76px; border-radius: 50%; font-size: 15px; font-weight: 500; outline: 2px solid #ffffff20; outline-offset: 3px; } .round-action.start { background: #39825b44; color: #97ebb8; outline-color: #9bffc22b; } .round-action.stop { background: #9b353b45; color: #ff9d9f; outline-color: #ff9d9f2b; } .round-action.neutral { background: #ffffff16; } .dial-caption { text-align: center; font-size: 11px; }
.laps { border-radius: 24px; padding: 16px; max-height: 440px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; } .laps-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 16px; } .laps-heading > span { font-size: 11px; } .laps-empty { padding: 24px 4px; line-height: 1.6; } .lap-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 13px 2px; border-top: 1px solid #ffffff15; font-size: 15px; font-variant-numeric: tabular-nums; } .lap-row span { display: flex; flex-direction: column; gap: 4px; } .lap-row span:last-child { text-align: right; } .lap-row small { font-size: 11px; color: #ffffff80; } .lap-row.best { color: #9eecbe; } .lap-row.worst { color: #ffa5a9; }
.presets { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 26px; } .preset { display: flex; gap: 7px; } .preset small { font-size: 12px; opacity: .65; } .timer-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(210px,1fr)); gap: 18px; } .timer-card { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 16px; border-radius: 28px; } .timer-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; } .timer-top h2 { overflow-wrap: anywhere; } .timer-top button { flex: none; background: none; } .timer-ring { position: relative; width: 100%; max-width: 180px; aspect-ratio: 1; } .timer-ring > svg { width: 100%; height: 100%; } .timer-ring > div { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; } .timer-ring output { font-size: 29px; font-weight: 300; letter-spacing: -.04em; font-variant-numeric: tabular-nums; } .timer-ring small { color: var(--vk-secondary); font-size: 12px; } .finished-note { font-size: 11px; color: #bbefd1; text-align: center; } .finished { box-shadow: inset 0 0 0 1px #a9ecc52a; } .timer-empty { min-height: 300px; }
.city-options { margin: 12px 0; } .city-options .vk-row { justify-content: space-between; } .city-options .vk-row > span:first-child { display: flex; flex-direction: column; gap: 4px; } .city-options small { font-size: 13px; color: var(--vk-secondary); } .city-check { width: 28px; height: 28px; color: #a6e7c0; } .city-check svg { width: 100%; } .sheet-done { width: 100%; } .sheet-note { margin: 14px 0 20px; line-height: 1.5; } .time-steppers { display: flex; justify-content: center; gap: 20px; margin-bottom: 24px; } .time-steppers > div { display: flex; flex-direction: column; align-items: center; gap: 10px; } .time-steppers output { font-size: 48px; font-weight: 300; font-variant-numeric: tabular-nums; } .stepper-colon { align-self: center; font-size: 40px; font-weight: 200; } .form-label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; margin-bottom: 20px; } .repeat-days { border: 0; padding: 0; margin: 0 0 24px; display: flex; flex-wrap: wrap; gap: 8px; } .repeat-days legend { margin-bottom: 12px; } .repeat-days .vk-chip { min-width: 44px; min-height: 44px; padding: 0 12px; } .sheet-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 12px; } .alarm-alert { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 10px 0; text-align: center; } .alarm-alert > svg { width: 70px; height: 70px; color: #ffca8d; } .alarm-alert h2 { overflow-wrap: anywhere; } .alarm-alert .sheet-actions { justify-content: center; margin-top: 12px; }
.compact .world-grid { grid-template-columns: 1fr; } .compact .world-card :deep(.clock-face) { max-width: 200px; } .compact .clock-tabs { align-self: stretch; margin: 0 22px; max-width: none; flex-wrap: nowrap; } .compact .clock-tabs button { min-width: 104px; padding: 0 12px; flex: 1 0 auto; } .compact .clock-content { padding: 22px; } .compact .stopwatch-layout { grid-template-columns: 1fr; } .compact .timer-grid { grid-template-columns: 1fr; } .compact .section-heading { align-items: flex-start; flex-wrap: wrap; } .compact .laps { max-height: none; } .compact .alarm-detail strong { font-size: 46px; }
@container (max-width: 670px) { .world-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .stopwatch-layout { grid-template-columns: 1fr; } .laps { max-height: none; } .world-card { padding: 10px 12px 18px; } .world-top { flex-wrap: wrap; } }
@container (max-width: 400px) { .world-grid { grid-template-columns: 1fr; } .clock-tabs button { font-size: 13px; padding: 0 12px; } .section-heading { flex-wrap: wrap; } }
@media (prefers-reduced-motion: reduce) { .clock-app *, .clock-app *::before, .clock-app *::after { animation: none !important; transition: none !important; } }
</style>
