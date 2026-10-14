<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const offset = ref(0);
const selected = ref<number | null>(null);
const day = computed(() => {
  const value = new Date(watch.now.value);
  value.setDate(value.getDate() + offset.value);
  return value;
});
const label = computed(() => day.value.toLocaleDateString([], {
  weekday: 'long',
  month: 'short',
  day: 'numeric'
}));
const events = computed(() => offset.value === 0 ? [
  {
    id: 1,
    title: 'Prototype playground',
    time: '09:30',
    end: '10:15',
    location: 'Demo studio',
    note: 'Explore an idea, break it kindly, and keep the interesting part.',
    color: '#ff9f0a'
  }, {
    id: 2,
    title: 'Walk and wonder',
    time: '13:00',
    end: '13:30',
    location: 'Imaginary park',
    note: 'A fictional break with absolutely no calendar invitation.',
    color: '#30d158'
  }, {
    id: 3,
    title: 'Ship something small',
    time: '17:00',
    end: '17:45',
    location: 'Demo desk',
    note: 'Finish one tiny experiment. Confetti is optional.',
    color: '#0a84ff'
  }
] : offset.value % 2 === 0 ? [
  {
    id: 4,
    title: 'Unscheduled curiosity',
    time: '11:00',
    end: '11:45',
    location: 'Demo workshop',
    note: 'A fictional appointment with a fresh idea.',
    color: '#bf5af2'
  }
] : []);
const event = computed(() => events.value.find(item => item.id === selected.value));
function navigate(delta: number) {
  offset.value += delta;
  selected.value = null;
  watch.haptic();
}
useWatchHardware('calendar', {
  back: () => {
    if (selected.value !== null) {
      selected.value = null;
      return true;
    }
    if (offset.value) {
      offset.value = 0;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root">
    <h1>{{ event ? event.title : 'Calendar' }}</h1>
    <template v-if="event">
      <div class="event-detail platter" :style="{ borderColor: event.color }">
        <p class="caption muted">
          {{ label }}
        </p>
        <h2>
          {{ event.title }}
        </h2>
        <p class="time">
          {{ event.time }}
          –
          {{ event.end }}
        </p>
        <p class="place">
          <WatchGlyph name="location" />
          {{ event.location }}
        </p>
        <p>
          {{ event.note }}
        </p>
      </div>
      
    </template>
    <template v-else>
      <div class="date">
        <span class="caption weekday">
          {{ day.toLocaleDateString([], { weekday: 'long' }) }}
        </span>
        <strong>
          {{ day.getDate() }}
        </strong>
        <span class="caption muted">
          {{ day.toLocaleDateString([], { month: 'long', year: 'numeric' }) }}
        </span>
      </div>
      <div class="navigation">
        <button aria-label="Previous day" @click="navigate(-1)">
          <WatchGlyph name="back" />
        </button>
        <button @click="offset = 0; selected = null">Today</button>
        <button aria-label="Next day" @click="navigate(1)">
          <WatchGlyph name="next" />
        </button>
      </div>
      <button
        v-for="item in events"
        :key="item.id"
        class="event platter"
        :style="{ borderColor: item.color }"
        @click="selected = item.id"
      >
        <span class="caption" :style="{ color: item.color }">
          {{ item.time }}
        </span>
        <strong>
          {{ item.title }}
        </strong>
        <span class="caption muted">
          {{ item.location }}
        </span>
      </button>
      <div v-if="!events.length" class="platter empty">
        <span>
          <WatchGlyph name="clock" />
        </span>
        <p>No events today.</p>
        
      </div>
      
    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
  </div>
</template>

<style scoped>
.root {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}

.root :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  margin: 0 0 16px;
}

h2 {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  margin: 16px 0;
}

.date {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 20px;
}

.weekday {
  color: #ff453a;
}

.date strong {
  font-size: max(18px, calc(75px * var(--text-size, 1)));
  font-weight: 500;
  line-height: 1.2;
}

.navigation {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.navigation button {
  min-height: 76px;
  border: 0;
  border-radius: 28px;
  background: #222225;
  color: #ff6960;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  flex: 1;
}

.navigation button:nth-child(2) {
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  flex: 2;
}

.event {
  width: 100%;
  min-height: 132px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  border: 0;
  border-left: 7px solid;
  text-align: left;
  color: white;
  margin-bottom: 12px;
}

.event strong {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  line-height: 1.2;
}

.back {
  min-height: 72px;
  border: 0;
  background: none;
  color: #ff6960;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  padding: 0;
}

.event-detail {
  border-left: 7px solid;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  line-height: 1.3;
  margin: 14px 0;
}

.time {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.place {
  color: #aaa;
}

.empty {
  text-align: center;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  line-height: 1.3;
}

.empty>span {
  font-size: max(18px, calc(44px * var(--text-size, 1)));
  color: #ff6960;
}

.date {
  padding-bottom: 12px;
}

.date strong {
  font-size: 64px;
}

.navigation {
  margin-bottom: 12px;
}

.event {
  min-height: 96px;
  gap: 4px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF453A; }

.date strong { font-size:80px; font-weight:600; }
.navigation button { min-height:64px; border-radius:32px; font-size:25px; }
.event strong { font-size:24px; line-height:1.25; }
.event-detail { overflow-wrap:anywhere; }
.place { display:flex; gap:8px; align-items:center; }
.place :deep(svg) { width:24px; height:24px; flex:0 0 24px; }
.empty { padding:28px 20px; }
.empty p { font-size:24px; }
</style>
