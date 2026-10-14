<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const people = [
  {
    id: 1,
    name: 'Alex',
    initials: 'AL',
    location: 'Imaginary park',
    status: 'Taking a demo stroll',
    color: '#ffb46c',
    x: 100,
    y: 70
  }, {
    id: 2,
    name: 'Sam',
    initials: 'SA',
    location: 'Demo studio',
    status: 'Sketching a fictional idea',
    color: '#ad8fff',
    x: 275,
    y: 170
  }, {
    id: 3,
    name: 'River',
    initials: 'RI',
    location: 'Demo café',
    status: 'An imaginary coffee break',
    color: '#60c9ce',
    x: 95,
    y: 195
  }
];
const selected = ref<number | null>(null);
const person = computed(() => people.find(item => item.id === selected.value));
const route = ref(false);
useWatchHardware('findPeople', {
  back: () => {
    if (route.value) {
      route.value = false;
      return true;
    }
    if (selected.value !== null) {
      selected.value = null;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root">
    <h1>Find People</h1>
    <template v-if="!person">
      <p class="caption muted">Fictional friends</p>
      <button
        v-for="item in people"
        :key="item.id"
        class="person platter"
        @click="selected = item.id; route = false"
      >
        <span class="avatar" :style="{ background: item.color + '33', color: item.color }">
          {{ item.initials }}
        </span>
        <span>
          <strong>
            {{ item.name }}
          </strong>
          <small>
            {{ item.location }}
          </small>
          <small>Demo location</small>
        </span>
        <span class="arrow">
          <WatchGlyph name="next" />
        </span>
      </button>
    </template>
    <template v-else>
      <button class="back" @click="selected = null">
        <WatchGlyph name="back" />
        People
      </button>
      <div class="map">
        <svg
          viewBox="0 0 370 260"
          role="img"
          aria-label="Fictional friend location map"
        >
          <rect
            width="370"
            height="260"
            fill="#252e26"
          />
          <path d="M0 0H164V100H0Z M230 220H370V260H230Z" fill="#395738" />
          <path
            d="M312 0Q210 90 310 155T312 260"
            stroke="#244b62"
            stroke-width="58"
            fill="none"
          />
          <path
            d="M0 140H260M195 0V260M0 230L195 110"
            stroke="#63615b"
            stroke-width="20"
            fill="none"
          />
          <path
            v-if="route"
            :d="'M195 120V' + person.y + 'H' + person.x"
            stroke="#56baff"
            stroke-width="7"
            fill="none"
            stroke-linecap="round"
          />
          <circle
            cx="195"
            cy="120"
            r="9"
            fill="#0a84ff"
            stroke="white"
            stroke-width="3"
          />
          <circle
            :cx="person.x"
            :cy="person.y"
            r="26"
            :fill="person.color"
            stroke="white"
            stroke-width="3"
          />
          <text
            :x="person.x"
            :y="person.y + 7"
            text-anchor="middle"
            fill="#252326"
            font-size="20"
            font-weight="700"
          >
            {{ person.initials }}
          </text>
          <text
            x="12"
            y="33"
            fill="#a3bca9"
            font-size="16"
          >DEMO PARK</text>
        </svg>
        <span class="map-label">DEMO MAP</span>
      </div>
      <h2>
        {{ person.name }}
      </h2>
      <div class="platter details">
        <p>
          {{ person.location }}
        </p>
        <p class="caption muted">
          {{ person.status }}
        </p>
        <p class="caption" :style="{ color: person.color }">● Simulated status</p>
      </div>
      <p v-if="route" class="caption route">
        A fictional path to
        {{ person.location.toLowerCase() }}
        . No real navigation.
      </p>
      <button
        class="watch-button"
        :aria-pressed="route"
        @click="route = !route; watch.haptic()"
      >
        {{ route ? 'Hide demo path' : 'Show demo path' }}
      </button>
      <button class="watch-button" @click="watch.open('messages')">Open Messages</button>
    </template>
    <p class="caption muted">Demo contacts. No people are tracked.</p>
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
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  margin: 0 0 18px;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
  margin: 16px 0;
}

.person {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 130px;
  border: 0;
  color: white;
  text-align: left;
  margin-bottom: 12px;
}

.avatar {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
  font-weight: 700;
  flex-shrink: 0;
}

.person strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.person small {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 5px;
}

.arrow {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  color: #888;
  margin-left: auto;
}

.back {
  min-height: 72px;
  border: 0;
  background: none;
  color: #ffb46c;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
  padding: 0;
}

.map {
  position: relative;
  overflow: hidden;
  border-radius: 28px;
}

.map svg {
  display: block;
  width: 100%;
}

.map-label {
  position: absolute;
  left: 16px;
  bottom: 12px;
  color: #b9c8bd;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  letter-spacing: 2px;
}

.details {
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
  line-height: 1.2;
  margin-bottom: 20px;
}

.details p {
  margin: 10px 0;
}

.route {
  color: #65baff;
}

.watch-button {
  margin-bottom: 12px;
}

.person {
  min-height: 110px;
  gap: 12px;
}

.person > span:nth-child(2) {
  min-width: 0;
  flex: 1;
}

.avatar {
  width: 52px;
  height: 52px;
}

.map-label {
  font-size: 21px;
  background: #000a;
  padding: 3px 6px;
  letter-spacing: 0.5px;
}
</style>
