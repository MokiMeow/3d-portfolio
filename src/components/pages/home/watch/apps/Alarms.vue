<script setup lang="ts">
import { useWatch, useWatchHardware } from "../watch";
interface Alarm {
  id: number;
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  lastDay: string;
}
const watch = useWatch();
const alarms = ref<Alarm[]>([{
  id: 1,
  hour: 7,
  minute: 0,
  days: [1, 2, 3, 4, 5],
  enabled: true,
  lastDay: ''
}, {
  id: 2,
  hour: 9,
  minute: 30,
  days: [0, 6],
  enabled: false,
  lastDay: ''
}]);
const editor = ref(false);
const hour = ref(7);
const minute = ref(0);
const days = ref<number[]>([]);
const field = ref<'hour' | 'minute'>('hour');
const editingId = ref<number | null>(null);
const ringing = ref<Alarm | null>(null);
let nextId = 3;
const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
function label(alarm: Alarm) {
  return alarm.days.length === 7 ? 'Every day' : alarm.days.length ? alarm.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 'Once';
}
function time(alarm: Pick<Alarm, 'hour' | 'minute'>) {
  return String(alarm.hour).padStart(2, '0') + ':' + String(alarm.minute).padStart(2, '0');
}
function edit(alarm?: Alarm) {
  editingId.value = alarm?.id ?? null;
  hour.value = alarm?.hour ?? 7;
  minute.value = alarm?.minute ?? 0;
  days.value = [...(alarm?.days ?? [])];
  editor.value = true;
}
function save() {
  const alarm = alarms.value.find(a => a.id === editingId.value);
  if (alarm) {
    alarm.hour = hour.value;
    alarm.minute = minute.value;
    alarm.days = [...days.value];
    alarm.enabled = true;
    alarm.lastDay = '';
  } else alarms.value.push({
    id: nextId++,
    hour: hour.value,
    minute: minute.value,
    days: [...days.value],
    enabled: true,
    lastDay: ''
  });
  editor.value = false;
  watch.haptic('success');
}
function toggleDay(day: number) {
  days.value = days.value.includes(day) ? days.value.filter(d => d !== day) : [...days.value, day].sort();
}
watchEffect(() => {
  const now = watch.now.value;
  const day = now.toDateString();
  for (const alarm of alarms.value) {
    if (alarm.enabled && alarm.hour === now.getHours() && alarm.minute === now.getMinutes() && alarm.lastDay !== day && (!alarm.days.length || alarm.days.includes(now.getDay()))) {
      alarm.lastDay = day;
      if (!alarm.days.length) alarm.enabled = false;
      ringing.value = alarm;
      watch.notify({
        app: 'alarms',
        title: 'Alarm',
        text: time(alarm)
      });
      watch.haptic('warning');
    }
  }
});
useWatchHardware('alarms', {
  crown: delta => {
    if (!editor.value) return false;
    if (field.value === 'hour') hour.value = (hour.value + Math.sign(delta) + 24) % 24;else minute.value = (minute.value + Math.sign(delta) + 60) % 60;
    return true;
  },
  back: () => {
    if (!editor.value) return false;
    editor.value = false;
    return true;
  }
});
</script>

<template>
  <section class="watch-app alarm-app">
    <h1>Alarms</h1>
    <article v-if="ringing" class="platter ringing">
      <p class="caption">Alarm</p>
      <div class="metric">
        {{time(ringing)}}
      </div>
      <button class="watch-button" @click="ringing=null">Dismiss</button>
    </article>
    <template v-if="editor">
      <p class="caption muted">24-hour time · turn the Crown</p>
      <div class="time-picker">
        <button :class="{selected:field==='hour'}" @click="field='hour'">
          {{hour.toString().padStart(2,'0')}}
        </button>
        <span>:</span>
        <button :class="{selected:field==='minute'}" @click="field='minute'">
          {{minute.toString().padStart(2,'0')}}
        </button>
      </div>
      <p class="caption muted">Repeat</p>
      <div class="days">
        <button
          v-for="(day,index) in labels"
          :key="index"
          :aria-label="['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][index]"
          :aria-pressed="days.includes(index)"
          :class="{selected:days.includes(index)}"
          @click="toggleDay(index)"
        >
          {{day}}
        </button>
      </div>
      <div class="button-row">
        <button class="watch-button" @click="editor=false">Cancel</button>
        <button class="watch-button positive" @click="save">Save</button>
      </div>
      <button
        v-if="editingId!==null"
        class="watch-button danger delete"
        @click="alarms=alarms.filter(a=>a.id!==editingId);editor=false"
      >
        Delete Alarm
      </button>
    </template>
    <template v-else>
      <article
        v-for="alarm in alarms"
        :key="alarm.id"
        class="platter alarm"
      >
        <button class="alarm-edit" @click="edit(alarm)">
          <strong>
            {{time(alarm)}}
          </strong>
          <small>
            {{label(alarm)}}
          </small>
        </button>
        <button
          class="toggle"
          :class="{enabled:alarm.enabled}"
          role="switch"
          :aria-checked="alarm.enabled"
          :aria-label="time(alarm)+' alarm'"
          @click="alarm.enabled=!alarm.enabled"
        >
          <span />
        </button>
      </article>
      <button class="watch-button add" @click="edit()">＋ Add Alarm</button>
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

.alarm-app h1 {
  color: #ff9f0a;
}

.alarm {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.alarm-edit {
  flex: 1;
  min-width: 0;
  background: none;
  border: 0;
  text-align: left;
  color: #ff9f0a;
  min-height: 92px;
}

.alarm-edit strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(51px * var(--text-size, 1)));
  line-height: 1;
  font-weight: 400;
}

.alarm-edit small {
  display: block;
  color: #aaa;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
  margin-top: 8px;
}

.toggle {
  width: 90px;
  min-height: 76px;
  position: relative;
  border: 0;
  background: none;
  flex-shrink: 0;
}

.toggle:before {
  content: '';
  position: absolute;
  inset: 13px 0;
  background: #39393d;
  border-radius: 28px;
}

.toggle.enabled:before {
  background: #30d158;
}

.toggle span {
  position: absolute;
  width: 44px;
  height: 44px;
  left: 5px;
  top: 16px;
  border-radius: 50%;
  background: white;
}

.toggle.enabled span {
  left: 41px;
}

.add,
.delete {
  width: 100%;
  margin-top: 16px;
}

.time-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 22px 0;
  font-size: max(calc(12px / var(--watch-scale)), calc(50px * var(--text-size, 1)));
}

.time-picker button {
  background: #1c1c1e;
  border: 2px solid transparent;
  color: #fff;
  font-size: max(calc(12px / var(--watch-scale)), calc(55px * var(--text-size, 1)));
  min-height: 100px;
  width: 43%;
  border-radius: 25px;
}

.time-picker .selected {
  border-color: #ff9f0a;
  color: #ff9f0a;
}

.days {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 8px;
  margin-bottom: 20px;
}

.days button {
  min-height: 76px;
  border: 0;
  background: #1c1c1e;
  color: #aaa;
  border-radius: 50%;
  font-size: max(calc(12px / var(--watch-scale)), calc(24px * var(--text-size, 1)));
}

.days .selected {
  background: #ff9f0a;
  color: #000;
}

.ringing {
  text-align: center;
  border: 2px solid #ff9f0a;
  margin-bottom: 20px;
}

.ringing .watch-button {
  width: 100%;
}

.alarm {
  gap: 8px;
}

.alarm-edit {
  min-height: 76px;
}

.alarm-edit strong {
  font-size: 48px;
  white-space: nowrap;
}

.alarm-edit small {
  line-height: 1.3;
}

.toggle span {
  transition: transform 240ms ease;
}

.toggle.enabled span {
  left: 5px;
  transform: translateX(36px);
}
</style>
