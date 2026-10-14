<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import AppSheet from './arcade/AppSheet.vue';
import ClockFace from './clock/ClockFace.vue';
import StopwatchDial from './clock/StopwatchDial.vue';
import WorldMap from './clock/WorldMap.vue';
import TimeWheel from './clock/TimeWheel.vue';
import { cityOffset, daylight, sunAltitude } from './clock/solar';
import { advanceTimers, pauseTimer, resumeTimer, elapsedAt, type Timer } from './clock/timing';
import { CITIES, DAYS, readAlarms, alarmDue, pad, stopwatchText, timerText, type Alarm, type ClockCity } from './clock/model';
const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION)!;
const tabs = ['World Clock', 'Alarms', 'Stopwatch', 'Timers'] as const;
type Tab = typeof tabs[number];
const tab = ref<Tab>('World Clock');
const sheet = ref<'cities' | 'alarm' | 'timer' | 'bedtime' | null>(null);
const cityIds = ref(CITIES.slice(1, 5).map(city => city.id));
const cityQuery = ref('');
const appRoot = ref<HTMLElement>();
const contentScroll = ref<HTMLElement>();
const contextMenu = ref<HTMLElement>();
let menuFocus: HTMLElement | undefined;
watch(tab, async () => { await nextTick(); if (contentScroll.value) contentScroll.value.scrollTop = 0; });
const localZone = ref('Asia/Kolkata');
const canonicalZone = (zone: string): string => new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
const heroCity = computed(() => CITIES.find(item => canonicalZone(item.zone) === canonicalZone(localZone.value)) ?? CITIES[0]!);
const heroIsLocal = computed(() => canonicalZone(heroCity.value.zone) === canonicalZone(localZone.value));
const cityMenu = ref<{ city: ClockCity; x: number; y: number }>();
function openCityMenu(city: ClockCity, event: MouseEvent): void {
  const rect = appRoot.value?.getBoundingClientRect(); if (!rect) return;
  menuFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  cityMenu.value = { city, x: Math.max(12, Math.min(rect.width - 232, event.clientX - rect.left)), y: Math.max(12, Math.min(rect.height - 174, event.clientY - rect.top)) };
}
watch(cityMenu, async value => { if(value) { await nextTick(); contextMenu.value?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus(); } else menuFocus?.focus(); });
async function copyCityTime(): Promise<void> { if (!cityMenu.value) return; const city = cityMenu.value.city; try { await navigator.clipboard.writeText(city.name + ' · ' + digital(city)); vision.toast('City time copied'); } catch { vision.toast(city.name + ' · ' + digital(city)); } cityMenu.value = undefined; }
const cityPage = ref(0);
const worldCities = computed(() => cities.value.filter(item => item.id !== heroCity.value.id));
const cityPageSize = computed(() => props.compact ? 2 : 4);
const pageCount = computed(() => Math.max(1, Math.ceil(worldCities.value.length / cityPageSize.value)));
const pageCities = computed(() => worldCities.value.slice(cityPage.value * cityPageSize.value, (cityPage.value + 1) * cityPageSize.value));
const heroDate = computed(() => new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', timeZone: heroCity.value.zone }).format(smoothNow.value));
const solar = (city: ClockCity) => daylight(city, smoothNow.value);
const isDay = (city: ClockCity): boolean => sunAltitude(smoothNow.value, city.lat, city.lon) > -.833;
const bedHour = ref(23), wakeHour = ref(7);
const sleepHours = computed(() => (wakeHour.value - bedHour.value + 24) % 24 || 24);
const timerPage = ref(0);
const timerPages = computed(() => Math.max(1, Math.ceil(timers.value.length / 3)));
const visibleTimers = computed(() => timers.value.slice(timerPage.value * 3, timerPage.value * 3 + 3));
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
watch(pageCount, value => { cityPage.value = Math.min(cityPage.value, value - 1); });
watch(timerPages, value => { timerPage.value = Math.min(timerPage.value, value - 1); });
const presets = [{ label: '1 min', minutes: 1 }, { label: '3 min', minutes: 3 }, { label: '5 min', minutes: 5 }, { label: '10 min', minutes: 10 }, { label: '25 min', minutes: 25 }, { label: 'Chai', minutes: 4 }, { label: 'Pasta', minutes: 9 }];
const customMinutes = ref(5), customLabel = ref('A little countdown');
const timerValid = computed(() => Number.isFinite(customMinutes.value) && customMinutes.value >= 1 && customMinutes.value <= 1440);
const reduced = ref(false);

let tick: ReturnType<typeof setInterval> | undefined;
let preference: MediaQueryList | undefined;
let mounted = false, disposed = false;

let stopwatchBase = 0, stopwatchStart = 0;
let counter = 0;
let audio: AudioContext | undefined;
const oscillators = new Set<OscillatorNode>();
const gains = new Set<GainNode>();
const uid = (): string => 'clock-' + Date.now().toString(36) + '-' + (++counter).toString(36);
function digital(city: ClockCity): string { return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: city.zone }).format(smoothNow.value); }
function difference(city: ClockCity): string {
  const delta = cityOffset(city, smoothNow.value) - cityOffset(heroCity.value, smoothNow.value);
  if (!delta) return 'Same time';
  const amount = Math.abs(delta);
  return (delta > 0 ? '+' : '−') + Math.floor(amount / 60) + 'h' + (amount % 60 ? ' ' + amount % 60 + 'm' : '');
}
function saveBedtime(): void {
  alarms.value = alarms.value.filter(alarm => alarm.id !== 'bedtime');
  alarms.value.unshift({ id: 'bedtime', hour: wakeHour.value, minute: 0, label: 'Wake up', days: [0,1,2,3,4,5,6], enabled: true });
  try { localStorage.setItem('lab-vision-bed-hour', String(bedHour.value)); } catch { /* Schedule remains in session. */ }
  void prepareAudio(); sheet.value = null; vision.toast('Sleep schedule saved · wake at ' + pad(wakeHour.value) + ':00');
}
function shortcut(event: KeyboardEvent): void {
  if (event.key === 'Escape' && cityMenu.value) { cityMenu.value = undefined; event.stopPropagation(); return; }
  if ((event.target instanceof HTMLElement && event.target.closest('button,input,textarea,select,[role=spinbutton]')) || sheet.value || notice.value) return;
  if (event.key === ' ' && tab.value === 'Stopwatch') { event.preventDefault(); toggleStopwatch(); }
  else if (event.key.toLowerCase() === 'l' && tab.value === 'Stopwatch') { event.preventDefault(); lapOrReset(); }
  else if (event.key.toLowerCase() === 'n') { if (tab.value === 'Alarms') editAlarm(); else if (tab.value === 'Timers') sheet.value = 'timer'; else if (tab.value === 'World Clock') sheet.value = 'cities'; }
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
  void prepareAudio(); sheet.value = null;
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
    alerts.value.push({ id: alarm.id, label: alarm.label }); chime(); vision.toast('Alarm · ' + alarm.label);
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
  timers.value.push({ id: uid(), label: label.trim().slice(0, 60) || 'Timer', duration, remaining: duration, deadline: performance.now() + duration, state: 'running' }); timerPage.value = Math.floor((timers.value.length - 1) / 3); sheet.value = null;
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
function startFrames(): void {
  if (!mounted || disposed || document.hidden) return;
  smoothNow.value = vision.now.value.getTime(); updateTimers();
  if (stopwatchRunning.value) elapsed.value = stopwatchValue();
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
  mounted = true;
  localZone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try { const raw: unknown = JSON.parse(localStorage.getItem('lab-vision-clock-cities') ?? 'null'); if (Array.isArray(raw)) cityIds.value = [...new Set(raw.filter((id): id is string => typeof id === 'string' && CITIES.some(city => city.id === id)))]; } catch { /* Defaults remain usable. */ }
  try { const stored = localStorage.getItem('lab-vision-alarms'); alarms.value = stored === null ? [{ id: 'sample-morning', hour: 7, minute: 0, label: 'Morning', days: [1,2,3,4,5], enabled: false }, { id: 'sample-weekend', hour: 8, minute: 30, label: 'Slow morning', days: [0,6], enabled: false }] : readAlarms(stored); } catch { /* Session-only alarms still work. */ }
  const wakeAlarm = alarms.value.find(alarm => alarm.id === 'bedtime'); if (wakeAlarm) wakeHour.value = wakeAlarm.hour;
  try { const storedBed = Number(localStorage.getItem('lab-vision-bed-hour') ?? 23); if (Number.isInteger(storedBed) && storedBed >= 0 && storedBed < 24) bedHour.value = storedBed; } catch { /* Session-only schedule. */ }
  storageReady.value = true; checkAlarms(vision.now.value);
  preference = matchMedia('(prefers-reduced-motion: reduce)'); preference.addEventListener('change', motion); motion();
  document.addEventListener('visibilitychange', startFrames);
  let tickCount = 0;
  tick = setInterval(() => { if (document.hidden) return; if (++tickCount % 5 === 0) updateTimers(); if (tab.value === 'Stopwatch' && stopwatchRunning.value) elapsed.value = stopwatchValue(); }, 50);
  appRoot.value?.addEventListener('keydown', shortcut);
});
onBeforeUnmount(() => {
  disposed = true; mounted = false; clearInterval(tick); appRoot.value?.removeEventListener('keydown', shortcut); preference?.removeEventListener('change', motion); document.removeEventListener('visibilitychange', startFrames);
  for (const oscillator of oscillators) { oscillator.onended = null; try { oscillator.stop(); } catch { /* Already ended. */ } oscillator.disconnect(); }
  for (const gain of gains) gain.disconnect(); oscillators.clear(); gains.clear(); if (audio) void audio.close().catch(() => undefined);
});

watch(cityIds, () => { if (!storageReady.value) return; try { localStorage.setItem('lab-vision-clock-cities', JSON.stringify(cityIds.value)); } catch { vision.toast('Cities will stay in this session.'); } }, { deep: true });
</script>
<template>
<div ref="appRoot" class="clock-app" :class="{ compact, solid: vision.reduceTransparency.value }" tabindex="-1">
  <div class="clock-layout" :inert="sheet || notice || cityMenu ? true : undefined">
    <nav class="clock-tabs vk-ornament vk-segmented" aria-label="Clock tools" @keydown="tabKeys"><button v-for="(item,index) in tabs" :key="item" v-hover :aria-pressed="tab===item" :title="item" @click="tab=item"><svg viewBox="0 0 24 24" aria-hidden="true"><template v-if="index===0"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></template><template v-else-if="index===1"><circle cx="12" cy="13" r="7"/><path d="m4 4 3-2m13 2-3-2M12 9v4l3 2m-9 4-2 2m14-2 2 2"/></template><template v-else-if="index===2"><circle cx="12" cy="13" r="7"/><path d="M9 2h6m-3 0v4m7 1 2-2M12 9v4"/></template><template v-else><path d="M7 3h10M7 21h10M8 3v4l4 5-4 5v4m8-18v4l-4 5 4 5v4"/></template></svg><span>{{ item }}</span></button></nav>
    <main ref="contentScroll" class="clock-content vk-scroll">
      <template v-if="tab==='World Clock'">
        <header class="section-heading"><div><p class="overline">EVERY MOMENT, CONNECTED</p><h1 class="vk-large-title">World Clock</h1></div><button v-hover class="vk-button" @click="sheet='cities'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add city</button></header>
        <div class="world-composition">
          <section class="local-hero vk-platter"><div class="hero-top"><span class="overline">{{ heroIsLocal ? 'YOUR LOCAL TIME' : 'REFERENCE CITY' }}</span><span class="day-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><template v-if="isDay(heroCity)"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></template><path v-else d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/></svg>{{ isDay(heroCity) ? 'Day' : 'Night' }}</span></div><ClockFace :time="smoothNow" :offset="cityOffset(heroCity,smoothNow)" :daylight="isDay(heroCity)" hero/><div class="hero-info"><h2>{{ heroCity.name }}</h2><output>{{ digital(heroCity) }}</output><p>{{ heroDate }}</p></div></section>
          <section class="world-cities"><div class="city-grid"><article v-for="city in pageCities" :key="city.id" class="city-instrument vk-well" tabindex="0" @contextmenu.prevent="openCityMenu(city,$event)"><div class="city-name"><div><h2>{{ city.name }}</h2><span>{{ difference(city) }}</span></div><button v-hover class="vk-icon plain" :aria-label="'Remove '+city.name" @click="toggleCity(city.id)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg></button></div><div class="city-clock"><ClockFace :time="smoothNow" :offset="cityOffset(city,smoothNow)" :daylight="isDay(city)"/><div><output>{{ digital(city) }}</output><span class="city-condition vk-secondary"><svg viewBox="0 0 24 24" aria-hidden="true"><template v-if="isDay(city)"><circle cx="12" cy="12" r="4"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M6 6l1 1m10 10 1 1M6 18l1-1m10-10 1-1"/></template><path v-else d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/></svg>{{ isDay(city) ? 'Daylight' : 'After sunset' }}</span></div></div><div class="sun-arc"><svg viewBox="0 0 110 26" aria-hidden="true"><path d="M5 23Q55 -17 105 23" stroke="#ffffff22"/><path d="M5 23Q55 -17 105 23" stroke="#ffd19d" pathLength="100" :stroke-dasharray="solar(city).fraction*100+' 100'"/><path d="M2 24h106" stroke="#ffffff15"/></svg><span>{{ solar(city).rise }}</span><span>{{ solar(city).set }}</span></div></article></div><div v-if="!worldCities.length" class="empty vk-well"><h2 class="vk-title">A world of possibilities</h2><p>Add cities to compare their time with yours.</p><button v-hover class="vk-button" @click="sheet='cities'">Choose cities</button></div></section>
        </div>
        <div v-if="pageCount>1" class="pagination"><button v-hover class="vk-icon" aria-label="Previous cities" :disabled="cityPage===0" @click="cityPage--"><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg></button><span>{{ cityPage+1 }} of {{ pageCount }}</span><button v-hover class="vk-icon" aria-label="Next cities" :disabled="cityPage===pageCount-1" @click="cityPage++"><svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg></button></div>
        <WorldMap :time="smoothNow" :cities="[heroCity,...worldCities]"/><p class="world-note">Live time zones · Sunrise and sunset are approximate · Clear-sky symbols, no weather feed</p>
      </template>
      <template v-else-if="tab==='Alarms'">
        <header class="section-heading"><div><p class="overline">A RHYTHM OF YOUR OWN</p><h1 class="vk-large-title">Alarms</h1></div><button v-hover class="vk-button" @click="editAlarm()"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>Add alarm</button></header>
        <div class="alarm-composition"><section class="bedtime vk-platter"><div class="bedtime-title"><svg viewBox="0 0 24 24"><path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/></svg><h2 class="vk-headline">Sleep / Wake up</h2></div><div class="sleep-dial"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="68" fill="none" stroke="#ffffff12" stroke-width="10"/><circle cx="90" cy="90" r="68" fill="none" stroke="#9baeff" stroke-width="10" stroke-linecap="round" :stroke-dasharray="sleepHours/24*427.26+' 427.26'" :stroke-dashoffset="-bedHour/24*427.26" transform="rotate(-90 90 90)"/><g v-for="i in 24" :key="i" :transform="'rotate('+i*15+' 90 90)'" stroke="#ffffff44"><path d="M90 10v4"/></g><text x="90" y="88">{{ sleepHours }}h</text><text x="90" y="107" class="small">SLEEP SCHEDULE</text></svg></div><div class="sleep-times"><div><small>BEDTIME</small><strong>{{ pad(bedHour) }}:00</strong></div><div><small>WAKE UP</small><strong>{{ pad(wakeHour) }}:00</strong></div></div><button v-hover class="vk-button" @click="sheet='bedtime'">{{ alarms.some(a=>a.id==='bedtime') ? 'Edit schedule' : 'Set up schedule' }}</button></section><section class="alarm-list vk-scroll"><div v-for="alarm in alarms" :key="alarm.id" class="alarm-row vk-well"><button v-hover class="alarm-detail" :aria-label="'Edit '+alarm.label+', '+alarmTime(alarm)" @click="editAlarm(alarm)"><strong :class="{ muted: !alarm.enabled }">{{ alarmTime(alarm) }}</strong><span>{{ alarm.label }}</span><div class="repeat-chips"><small v-for="(day,index) in DAYS" :key="day" :class="{ active: alarm.days.includes(index) }">{{ day.slice(0,1) }}</small><span v-if="!alarm.days.length">Once</span></div></button><label class="toggle-hit"><input v-model="alarm.enabled" type="checkbox" class="vk-toggle" :aria-label="alarm.label+' alarm enabled'" @change="prepareAudio"/></label></div><div v-if="!alarms.length" class="empty vk-well"><h2 class="vk-title">Your morning starts here</h2><p>Add an alarm for something that matters.</p><button v-hover class="vk-button" @click="editAlarm()">Add alarm</button></div></section></div>
        <p v-if="snoozes.length" class="snooze-note">{{ snoozes.length }} snoozed alarm(s) · 5 minute snooze</p><p class="bottom-note">Alarms ring while Clock is open. The sample morning alarms start switched off.</p>
      </template>
      <template v-else-if="tab==='Stopwatch'">
        <header class="section-heading"><div><p class="overline">PRECISION IN EVERY SECOND</p><h1 class="vk-large-title">Stopwatch</h1></div><span class="status-chip"><i :class="{ running: stopwatchRunning }"/>{{ stopwatchRunning?'Running':elapsed?'Paused':'Ready' }}</span></header>
        <div class="stopwatch-layout"><section class="stopwatch-main"><StopwatchDial :elapsed="elapsed"/><output class="stopwatch-digital" aria-label="Stopwatch elapsed time">{{ stopwatchText(elapsed) }}</output><div class="stopwatch-actions vk-ornament"><button v-hover class="vk-button" :disabled="!stopwatchRunning&&!elapsed" @click="lapOrReset">{{ stopwatchRunning?'Lap':'Reset' }}</button><button v-hover class="vk-button" :class="stopwatchRunning?'stop':'start'" @click="toggleStopwatch">{{ stopwatchRunning?'Stop':elapsed?'Resume':'Start' }}</button></div><p class="dial-caption">60 seconds · 30 minutes · 12 hours</p></section><section class="laps vk-well"><div class="laps-heading"><h2 class="vk-headline">Lap times</h2><span>{{ laps.length }} recorded</span></div><svg v-if="laps.length" class="lap-chart" viewBox="0 0 300 80" role="img" aria-label="Comparison of lap durations"><path d="M0 74h300M0 40h300M0 6h300" stroke="#ffffff12"/><rect v-for="(lap,index) in laps.slice(-20)" :key="lap.number" :x="index*300/Math.min(20,laps.length)+2" :y="74-lap.split/Math.max(...laps.map(l=>l.split),1)*64" :width="Math.max(3,300/Math.min(20,laps.length)-5)" :height="lap.split/Math.max(...laps.map(l=>l.split),1)*64" rx="3" :fill="lap.split===best?'#8fdcba':lap.split===worst&&best!==worst?'#ff9a95':'#c2d5ed'"/></svg><div class="lap-scroll vk-scroll"><div v-if="!laps.length" class="laps-empty"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 37h38M10 29V17m9 12V8m10 21V13m9 16V5"/></svg><h3>Make every lap count</h3><p>Start the chronograph, then record a lap. Your fastest and slowest splits appear here.</p></div><div v-for="lap in lapRows" :key="lap.number" class="lap-row" :class="{ best:lap.split===best,worst:lap.split===worst&&best!==worst }"><span>Lap {{ pad(lap.number) }}<small>{{ lap.split===best?'Fastest':lap.split===worst&&best!==worst?'Slowest':'Split' }}</small></span><span>{{ stopwatchText(lap.split) }}<small>{{ stopwatchText(lap.total) }} total</small></span></div></div><p class="lap-footnote">Space to start / stop · L to lap / reset</p></section></div>
      </template>
      <template v-else>
        <header class="section-heading"><div><p class="overline">A LITTLE TIME, WELL SPENT</p><h1 class="vk-large-title">Timers</h1></div><button v-hover class="vk-button" @click="sheet='timer'"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>New timer</button></header>
        <div class="presets" aria-label="Timer presets"><button v-for="preset in presets" :key="preset.label" v-hover class="vk-button" @click="startTimer(preset.minutes,preset.label)">{{ preset.label }}</button></div>
        <div v-if="timers.length" class="timer-grid"><section v-for="timer in visibleTimers" :key="timer.id" class="timer-card vk-platter" :class="{ finished:timer.state==='finished' }"><div class="timer-top"><h2 class="vk-headline">{{ timer.label }}</h2><button v-hover class="vk-icon plain" :aria-label="'Cancel '+timer.label+' timer'" @click="timers=timers.filter(item=>item.id!==timer.id)"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="timer-ring"><svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="77" fill="none" stroke="#ffffff12" stroke-width="4"/><g v-for="i in 60" :key="i" :transform="'rotate('+i*6+' 90 90)'" stroke="#ffffff30"><path d="M90 6v3"/></g><circle cx="90" cy="90" r="77" fill="none" :stroke="timer.state==='finished'?'#ace6c7':'#ffb66e'" stroke-width="4" stroke-linecap="round" :stroke-dasharray="2*Math.PI*77" :stroke-dashoffset="2*Math.PI*77*timerProgress(timer)" transform="rotate(-90 90 90)"/></svg><div><output>{{ timerText(timer.remaining) }}</output><small>{{ timer.state==='finished'?'Complete':timer.state==='paused'?'Paused':timerText(timer.duration)+' total' }}</small></div></div><button v-hover class="vk-button" @click="toggleTimer(timer)">{{ timer.state==='running'?'Pause':timer.state==='paused'?'Resume':'Restart' }}</button></section></div>
        <div v-else class="timer-grid timer-suggestions"><button v-for="preset in [{label:'Steep tea',minutes:4,kind:'A quiet ritual'},{label:'Take a break',minutes:5,kind:'A moment to reset'},{label:'Focus',minutes:25,kind:'One thing at a time'}]" :key="preset.label" v-hover class="timer-card vk-platter" @click="startTimer(preset.minutes,preset.label)"><span class="overline">{{ preset.kind }}</span><div class="suggested-ring"><span>{{ preset.minutes }}<small>MINUTES</small></span></div><strong>{{ preset.label }}</strong><span class="suggested-start">Start timer <svg viewBox="0 0 24 24"><path d="m9 5 10 7-10 7Z"/></svg></span></button></div>
        <div v-if="timerPages>1" class="pagination"><button v-hover class="vk-icon" aria-label="Previous timers" :disabled="timerPage===0" @click="timerPage--"><svg viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg></button><span>{{ timerPage+1 }} of {{ timerPages }}</span><button v-hover class="vk-icon" aria-label="Next timers" :disabled="timerPage===timerPages-1" @click="timerPage++"><svg viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg></button></div><p class="bottom-note">Multiple timers, one quiet chime. Countdowns continue across Clock’s tabs while the app is open.</p>
      </template>
    </main>
  </div>
  <div v-if="cityMenu" class="context-backdrop" @click.self="cityMenu=undefined"><section ref="contextMenu" class="city-context vk-sheet" role="menu" :style="{ left:cityMenu.x+'px',top:cityMenu.y+'px' }" :aria-label="cityMenu.city.name+' actions'"><div class="context-title"><strong>{{ cityMenu.city.name }}</strong><button v-hover class="vk-icon plain" aria-label="Close city actions" @click="cityMenu=undefined"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></svg></button></div><button v-hover class="vk-row" role="menuitem" @click="copyCityTime">Copy local time</button><button v-hover class="vk-row" role="menuitem" @click="toggleCity(cityMenu.city.id);cityMenu=undefined">Remove city</button></section></div>
  <AppSheet v-if="sheet" :inert="notice ? true : undefined" :title="sheet === 'cities' ? 'Add or remove cities' : sheet === 'alarm' ? editing ? 'Edit alarm' : 'Add alarm' : sheet === 'bedtime' ? 'Sleep schedule' : 'New timer'" @close="sheet = null">
    <template v-if="sheet === 'cities'"><input v-model="cityQuery" v-hover class="vk-field" type="search" aria-label="Search twenty cities" placeholder="Search 20 cities" /><p class="sheet-note vk-footnote vk-secondary">Time zones update with daylight saving. Tap to add or remove a city.</p><div class="city-options"><button v-for="city in cityChoices" :key="city.id" v-hover class="vk-row" :aria-pressed="cityIds.includes(city.id)" @click="toggleCity(city.id)"><span><strong>{{ city.name }}</strong><small>{{ city.region }}</small></span><span v-if="cityIds.includes(city.id)" class="city-check" aria-label="Added"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></span></button><p v-if="!cityChoices.length" class="vk-footnote vk-secondary">No city matches. This little globe has twenty stops.</p></div><button v-hover class="vk-button primary sheet-done" @click="sheet = null">Done</button></template>
    <form v-else-if="sheet === 'alarm'" @submit.prevent="saveAlarm"><div class="time-steppers"><TimeWheel v-model="alarmHour" :count="24" label="Hour"/><span class="stepper-colon">:</span><TimeWheel v-model="alarmMinute" :count="60" label="Minute"/></div><label class="form-label">Label<input v-model="alarmLabel" v-hover class="vk-field" maxlength="60" placeholder="Alarm" /></label><fieldset class="repeat-days"><legend class="vk-footnote vk-secondary">Repeat · {{ repeatText(alarmDays) }}</legend><button v-for="(day,index) in DAYS" :key="day" v-hover type="button" class="vk-chip" :aria-pressed="alarmDays.includes(index)" @click="toggleDay(index)">{{ day }}</button></fieldset><div class="sheet-actions"><button v-if="editing" v-hover type="button" class="vk-button destructive" @click="deleteAlarm">Delete alarm</button><button v-hover class="vk-button primary" type="submit">Save alarm</button></div></form>
    <form v-else-if="sheet === 'bedtime'" @submit.prevent="saveBedtime"><p class="sheet-note vk-secondary">Choose a bedtime and a daily wake-up alarm. Times use your browser’s local time.</p><div class="time-steppers"><TimeWheel v-model="bedHour" :count="24" label="Bedtime hour"/><span class="stepper-colon">→</span><TimeWheel v-model="wakeHour" :count="24" label="Wake-up hour"/></div><p class="sheet-note">{{ sleepHours }} hours in your schedule</p><button v-hover type="submit" class="vk-button primary">Save schedule</button></form>
    <form v-else @submit.prevent="startTimer(customMinutes, customLabel)"><label class="form-label">Minutes<input v-model.number="customMinutes" v-hover class="vk-field" type="number" min="1" max="1440" step="1" required /></label><label class="form-label">Name<input v-model="customLabel" v-hover class="vk-field" maxlength="60" placeholder="Timer" /></label><p class="sheet-note vk-footnote vk-secondary">One minute to one day. Even pasta deserves boundaries.</p><button v-hover class="vk-button primary" :disabled="!timerValid" type="submit">Start timer</button></form>
  </AppSheet>
  <AppSheet v-if="notice" title="Alarm" @close="alerts.shift()"><div class="alarm-alert"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="24" cy="27" r="15" /><path d="M24 17v11l7 4M8 9l7-4m25 4-7-4" /></svg><h2 class="vk-large-title">{{ notice.label }}</h2><p class="vk-secondary">Your moment has arrived.</p><p v-if="alerts.length > 1" class="vk-footnote vk-secondary">{{ alerts.length - 1 }} more waiting</p><div class="sheet-actions"><button v-hover class="vk-button" @click="snooze">Snooze · 5 min</button><button v-hover class="vk-button primary" @click="alerts.shift()">Stop</button></div></div></AppSheet>
</div>
</template>
<style src="../kit/kit.css"></style>
<style src="./clock/clock.css" scoped></style>
