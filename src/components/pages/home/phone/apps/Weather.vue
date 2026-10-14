<script setup lang="ts">
import { PHONE } from '../phone';
import { APP_ICONS as icons } from './icons';
const phone = inject(PHONE);
type City = {
    name: string;
    temp: number;
    condition: string;
    high: number;
    low: number;
    humidity: number;
    wind: number;
    uv: number;
    sunrise: string;
    sunset: string;
    sky: string;
    note: string;
};
const cities = [
    {
        name: 'Bengaluru',
        temp: 26,
        condition: 'Partly Cloudy',
        high: 29,
        low: 21,
        humidity: 68,
        wind: 12,
        uv: 5,
        sunrise: '6:12',
        sunset: '6:04',
        sky: 'linear-gradient(155deg,#43769f,#6797b4 55%,#adc6d1)',
        note: 'A pleasant day for chai. Forecast confidence: more than the traffic ETA.'
    },
    {
        name: 'London',
        temp: 17,
        condition: 'Considerably Cloudy',
        high: 19,
        low: 12,
        humidity: 82,
        wind: 18,
        uv: 2,
        sunrise: '7:02',
        sunset: '5:46',
        sky: 'linear-gradient(155deg,#455d78,#788eaa 60%,#b1bcc8)',
        note: 'Clouds are attending the daily standup. All of them.'
    },
    {
        name: 'Tokyo',
        temp: 22,
        condition: 'Mostly Sunny',
        high: 25,
        low: 18,
        humidity: 54,
        wind: 9,
        uv: 4,
        sunrise: '5:48',
        sunset: '5:22',
        sky: 'linear-gradient(155deg,#35729d,#7bb1ca 55%,#d2d3c1)',
        note: 'A good day to close a few tabs and open a window.'
    }
] satisfies [
    City,
    ...City[]
];
const selected = ref<number>(0);
const picker = ref<boolean>(false);
const city = computed<City>(() => cities[selected.value] ?? cities[0]);
const hours = computed(() => Array.from({
    length: 12
}, (_, i) => ({
    label: i === 0 ? 'Now' : String((new Date(phone?.now.value ?? new Date()).getHours() + i) % 24).padStart(2, '0'),
    temp: city.value.temp + ([
        0,
        1,
        2,
        2,
        1,
        0,
        -1,
        -2,
        -2,
        -3,
        -3,
        -4
    ][i] ?? 0),
    cloudy: i % 3 === 0,
    rain: i === 4 ? '20%' : ''
})));
const forecast = computed(() => Array.from({
    length: 10
}, (_, i) => ({
    day: i === 0 ? 'Today' : new Intl.DateTimeFormat('en-GB', {
        weekday: 'short'
    }).format(new Date((phone?.now.value ?? new Date()).getTime() + i * 86400000)),
    low: city.value.low + ([
        0,
        -1,
        0,
        1,
        -1,
        0,
        2,
        1,
        0,
        -1
    ][i] ?? 0),
    high: city.value.high + ([
        0,
        1,
        0,
        -1,
        1,
        2,
        0,
        -1,
        0,
        1
    ][i] ?? 0),
    cloudy: i % 3 === 0,
    rain: i === 3 || i === 6 ? '30%' : ''
})));
const rangeMin = computed(() => Math.min(...forecast.value.map(d => d.low)) - 1);
const rangeMax = computed(() => Math.max(...forecast.value.map(d => d.high)) + 1);
function rangeStyle(low: number, high: number) {
    const spread = rangeMax.value - rangeMin.value;
    return {
        left: (low - rangeMin.value) / spread * 100 + '%',
        width: (high - low) / spread * 100 + '%'
    };
}
</script>

<template>
  <div class="app" :style="{background:city.sky}">
    <div class="sky-layer" aria-hidden="true">
      <div class="sky-glow" />
      <div class="sky-cloud one" />
      <div class="sky-cloud two" />
    </div>
    <main class="scroll weather-content">
      <header class="weather-heading">
        <p>My Location</p>
        <h1>{{ city.name }}</h1>
        <div class="temperature">
          {{ city.temp }}
          °
        </div>
        <h3>{{ city.condition }}</h3>
        <p class="high-low">
          H:
          {{ city.high }}
          ° L:
          {{ city.low }}
          °
        </p>
      </header>
      <section class="card glass hourly-card">
        <p class="summary">{{ city.note }}</p>
        <div
          class="hourly scroll"
          tabindex="0"
          role="region"
          aria-label="Hourly forecast, scroll for more hours"
        >
          <article v-for="(hour,i) in hours" :key="i">
            <h3>{{ hour.label }}</h3>
            <svg viewBox="0 0 24 24" :class="{sun:!hour.cloudy}">
              <path :d="icons[hour.cloudy?'cloud':'sun']" />
            </svg>
            <small>{{ hour.rain || ' ' }}</small>
            <strong>
              {{ hour.temp }}
              °
            </strong>
          </article>
        </div>
      </section>
      <section class="card glass forecast">
        <h3 class="card-label">
          <svg viewBox="0 0 24 24">
            <path d="M3 5h18v16H3ZM7 2v5M17 2v5M3 10h18" />
          </svg>
          10-DAY FORECAST
        </h3>
        <div v-for="(day,i) in forecast" :key="i" class="day-row">
          <h3>{{ day.day }}</h3>
          <div class="day-icon">
            <svg viewBox="0 0 24 24" :class="{sun:!day.cloudy}">
              <path :d="icons[day.cloudy?'cloud':'sun']" />
            </svg>
            <small v-if="day.rain">{{ day.rain }}</small>
          </div>
          <span class="low">
            {{ day.low }}
            °
          </span>
          <div class="range-track">
            <i :style="rangeStyle(day.low,day.high)" />
            <b v-if="i===0" :style="{left:(city.temp-rangeMin)/(rangeMax-rangeMin)*100+'%'}" />
          </div>
          <span>
            {{ day.high }}
            °
          </span>
        </div>
      </section>
      <div class="card-grid">
        <section class="card glass metric">
          <h3 class="card-label">
            <svg viewBox="0 0 24 24">
              <path :d="icons.sun" />
            </svg>
            UV INDEX
          </h3>
          <strong>{{ city.uv }}</strong>
          <h3>{{ city.uv>3?'Moderate':'Low' }}</h3>
          <div class="uv-bar">
            <i :style="{left:city.uv/11*100+'%'}" />
          </div>
          <p>
            {{ city.uv>3?'A little shade is a good idea.':'The clouds are doing their part.' }}
          </p>
        </section>
        <section class="card glass metric wind">
          <h3 class="card-label">
            <svg viewBox="0 0 24 24">
              <path d="M2 8h13a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M2 16h7a3 3 0 1 1-3 3" />
            </svg>
            WIND
          </h3>
          <div class="compass">
            <span class="north">N</span>
            <span class="east">E</span>
            <span class="south">S</span>
            <span class="west">W</span>
            <div class="wind-arrow">
              <svg viewBox="0 0 24 24">
                <path d="M12 3v18m-4-4 4 4 4-4" />
              </svg>
            </div>
            <div>
              <strong>{{ city.wind }}</strong>
              <small>km/h</small>
            </div>
          </div>
        </section>
        <section class="card glass metric">
          <h3 class="card-label">
            <svg viewBox="0 0 24 24">
              <path d="M12 2S4 12 4 16a8 8 0 0 0 16 0c0-4-8-14-8-14Z" />
            </svg>
            HUMIDITY
          </h3>
          <strong>
            {{ city.humidity }}
            <span>%</span>
          </strong>
          <p>The air is holding on to things. Relatable.</p>
          <div class="humidity-track">
            <i :style="{width:city.humidity+'%'}" />
          </div>
        </section>
        <section class="card glass metric sunrise">
          <h3 class="card-label">
            <svg viewBox="0 0 24 24">
              <path d="M3 19h18M5 15a7 7 0 0 1 14 0M12 2v5M4 6l3 3M20 6l-3 3" />
            </svg>
            SUNRISE
          </h3>
          <strong>
            {{ city.sunrise }}
            <small>AM</small>
          </strong>
          <svg class="sun-arc" viewBox="0 0 160 65">
            <path d="M0 55H160" stroke="#ffffff45" />
            <path d="M5 55Q80-35 155 55" stroke="#fff8" />
            <circle cx="55" cy="13" r="6" fill="#ffe399" stroke="#fff" />
          </svg>
          <p>
            Sunset:
            {{ city.sunset }}
            PM
          </p>
        </section>
      </div>
      <section class="card glass outlook">
        <h3 class="card-label">
          <svg viewBox="0 0 24 24">
            <path :d="icons.cloud" />
          </svg>
          POCKET FORECAST
        </h3>
        <h2>100% chance of another tab.</h2>
        <p>And a reasonably good chance of chai.</p>
      </section>
      <p class="data-footnote">
        All weather data is invented and simulated.
        <br />
        For portfolio browsing, not weather planning.
      </p>
    </main>
    <footer class="weather-footer glass">
      <button class="icon" aria-label="Open illustrated map" @click="phone?.open('maps')">
        <svg viewBox="0 0 24 24">
          <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16" />
        </svg>
      </button>
      <div class="city-dots">
        <i v-for="(item,i) in cities" :key="item.name" :class="{active:selected===i}" />
      </div>
      <button class="icon" aria-label="Switch location" @click="picker=true">
        <svg viewBox="0 0 24 24">
          <path d="M7 5h14M7 12h14M7 19h14M3 5h.01M3 12h.01M3 19h.01" />
        </svg>
      </button>
    </footer>
    <div v-if="picker" class="picker">
      <header class="picker-head bar">
        <h1>Weather</h1>
        <button class="pill glass" @click="picker=false">Done</button>
      </header>
      <main class="scroll city-list">
        <button
          v-for="(item,i) in cities"
          :key="item.name"
          :style="{background:item.sky}"
          :aria-label="'Show simulated weather in '+item.name"
          @click="selected=i;picker=false"
        >
          <div>
            <h2>{{ item.name }}</h2>
            <p>{{ i===0?'My Location':'Simulated location' }}</p>
            <small>{{ item.condition }}</small>
          </div>
          <div>
            <strong>
              {{ item.temp }}
              °
            </strong>
            <small>
              H:
              {{ item.high }}
              ° L:
              {{ item.low }}
              °
            </small>
          </div>
        </button>
        <p class="data-footnote">Three cities. Three entirely invented forecasts.</p>
      </main>
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
  color: #fff;
  transition: transform 250ms ease, opacity 250ms ease;
}

.sky-glow {
  position: absolute;
  top: -160px;
  left: -80px;
  width: 660px;
  height: 700px;
  background: radial-gradient(ellipse,#ffffff23,transparent 70%);
  pointer-events: none;
  animation: sky-shift 12s ease-in-out infinite alternate;
  z-index: -1;
}

.sky-cloud {
  position: absolute;
  pointer-events: none;
  width: 310px;
  height: 100px;
  filter: blur(15px);
  background: radial-gradient(ellipse,#fff4,transparent 68%);
  z-index: -1;
  animation: cloud-drift 15s ease-in-out infinite alternate;
}

.sky-cloud.one {
  top: 150px;
  left: -90px;
}

.sky-cloud.two {
  top: 330px;
  right: -90px;
  opacity: .5;
  animation-delay: -7s;
}

@keyframes sky-shift {
  to {
    transform: translate(70px,60px);
    opacity: .5;
  }
}

@keyframes cloud-drift {
  to {
    transform: translateX(65px);
  }
}

.weather-content {
  flex: 1;
  padding: var(--safe-top,62px) 18px 16px;
}

.weather-heading {
  text-align: center;
  padding: 20px 0 30px;
  text-shadow: 0 1px 3px #0001;
}

.weather-heading>p:first-child {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 5px;
}

.weather-heading h1 {
  font-size: 34px;
  font-weight: 400;
}

.temperature {
  font-size: 91px;
  line-height: 1.05;
  font-weight: 200;
  letter-spacing: -.055em;
  margin-left: 18px;
}

.weather-heading>h3 {
  font-size: 20px;
  font-weight: 500;
  color: #eef6ffcb;
  margin-top: 5px;
}

.high-low {
  font-size: 18px;
  margin-top: 7px;
}

.card {
  background: #365f8154;
  border-radius: 20px;
  margin-bottom: 15px;
  border-color: #ffffff20;
  box-shadow: inset 0 1px 0 #ffffff16;
  padding: 16px;
}

.summary {
  font-size: 14px;
  line-height: 1.45;
  padding-bottom: 13px;
  border-bottom: 1px solid #ffffff20;
}

.hourly {
  display: flex;
  gap: 24px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-top: 13px;
}

.hourly article {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 38px;
}

.hourly h3 {
  font-size: 14px;
  font-weight: 500;
}

.hourly strong {
  font-size: 20px;
  font-weight: 500;
}

.hourly small {
  height: 12px;
  font-size: 12px;
  color: #bfe3ff;
}

.hourly svg {
  width: 25px;
  height: 25px;
  fill: #ffffff20;
  stroke-width: 1.6;
}

.sun {
  color: #ffe19a;
  fill: #ffe19a40!important;
}

.card-label {
  font-size: 12px;
  letter-spacing: .03em;
  font-weight: 600;
  color: #e0ebf4a6;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 12px;
}

.card-label svg {
  height: 15px;
  width: 15px;
  stroke-width: 1.8;
}

.forecast {
  padding-bottom: 8px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 51px;
  border-top: 1px solid #ffffff19;
  font-size: 17px;
}

.day-row h3 {
  width: 52px;
  font-weight: 500;
  font-size: 17px;
}

.day-icon {
  width: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.day-icon svg {
  width: 23px;
  height: 23px;
}

.day-icon small {
  font-size: 12px;
  color: #bfe3ff;
  position: absolute;
  bottom: -10px;
}

.day-row .low {
  color: #d6e6f39c;
}

.range-track {
  position: relative;
  flex: 1;
  min-width: 30px;
  height: 5px;
  background: #183c6740;
  border-radius: 4px;
}

.range-track i {
  position: absolute;
  height: 5px;
  border-radius: 4px;
  background: linear-gradient(90deg,#97dace,#f2df92);
}

.range-track b {
  position: absolute;
  top: -1px;
  width: 7px;
  height: 7px;
  border: 1px solid #56798d;
  border-radius: 50%;
  background: #fff;
}

.card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.metric {
  min-height: 192px;
  margin: 0;
  min-width: 0;
}

.metric>strong {
  font-size: 34px;
  font-weight: 500;
  line-height: 1.1;
}

.metric>h3:not(.card-label) {
  font-size: 19px;
  font-weight: 500;
  margin-top: 3px;
}

.metric p {
  font-size: 12px;
  line-height: 1.4;
  color: #ffffffc9;
  margin-top: 13px;
}

.metric strong>span {
  font-size: 27px;
}

.uv-bar {
  position: relative;
  height: 5px;
  background: linear-gradient(90deg,#74ce79,#f6df7a,#eaa169,#d682a9);
  border-radius: 5px;
  margin-top: 15px;
}

.uv-bar i {
  position: absolute;
  width: 5px;
  height: 9px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #718299;
  top: -2px;
}

.compass {
  width: 128px;
  height: 128px;
  border: 2px dotted #ffffff55;
  border-radius: 50%;
  position: relative;
  margin: 0 auto;
  display: grid;
  place-items: center;
}

.compass>span {
  font-size: 12px;
  color: #ffffffaa;
  position: absolute;
}

.north {
  top: 3px;
}

.south {
  bottom: 3px;
}

.east {
  right: 5px;
  top: 55px;
}

.west {
  left: 5px;
  top: 55px;
}

.compass>div:last-child {
  text-align: center;
  background: #507b9c;
  position: relative;
  padding: 4px;
  border-radius: 50%;
}

.compass strong {
  font-size: 27px;
  font-weight: 500;
  display: block;
}

.compass small {
  font-size: 12px;
  color: #ffffffaa;
}

.wind-arrow {
  position: absolute;
  inset: 12px;
  transform: rotate(-45deg);
  display: flex;
  justify-content: center;
  align-items: center;
}

.wind-arrow svg {
  width: 20px;
  height: 100px;
  stroke: #fff;
  stroke-width: 2;
}

.humidity-track {
  height: 5px;
  background: #ffffff18;
  border-radius: 5px;
  margin-top: 20px;
}

.humidity-track i {
  height: 100%;
  background: #b6d9e8;
  border-radius: 5px;
  display: block;
}

.sunrise strong {
  font-size: 31px;
}

.sunrise strong small {
  font-size: 13px;
}

.sun-arc {
  width: 100%;
  height: 55px;
  stroke-width: 1.5;
  margin-top: 7px;
}

.sunrise p {
  margin-top: 0;
  font-size: 12px;
}

.outlook {
  margin-top: 15px;
}

.outlook h2 {
  font-size: 20px;
}

.outlook p {
  font-size: 14px;
  color: #ffffffaa;
  margin-top: 7px;
}

.data-footnote {
  text-align: center;
  color: #ffffff8c;
  font-size: 12px;
  line-height: 1.6;
  margin: 25px 0 16px;
}

.weather-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #396582b0;
  padding: 7px 18px var(--safe-bottom,34px);
  border-top-color: #ffffff20;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
}

.city-dots {
  display: flex;
  gap: 8px;
}

.city-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff40;
}

.city-dots .active {
  background: #fff;
}

.picker {
  position: absolute;
  inset: 0;
  background: linear-gradient(#173449,#1c3e53);
  padding: var(--safe-top,62px) 20px var(--safe-bottom,34px);
  display: flex;
  flex-direction: column;
}

.picker-head {
  padding: 20px 0 25px;
}

.picker-head .pill {
  font-size: 16px;
  background: #ffffff15;
  border-color: #ffffff20;
}

.city-list {
  flex: 1;
}

.city-list>button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 165px;
  width: 100%;
  padding: 20px;
  border-radius: 22px;
  margin-bottom: 16px;
  text-align: left;
  border: 1px solid #ffffff25;
}

.city-list h2 {
  font-size: 24px;
}

.city-list p {
  font-size: 13px;
  margin-top: 4px;
}

.city-list small {
  font-size: 12px;
  display: block;
  margin-top: 30px;
  color: #ffffffb0;
}

.city-list>button>div:last-child {
  text-align: right;
}

.city-list strong {
  font-size: 60px;
  font-weight: 200;
  line-height: 1;
}

.city-list>button>div:last-child small {
  margin-top: 24px;
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

.sky-layer {
  position: absolute;
  inset: 0;
  overflow: clip;
  pointer-events: none;
  z-index: -1;
}

.sky-glow {
  inset: 0;
  width: 100%;
  height: 100%;
}

.weather-content, .hourly-card, .hourly {
  min-width: 0;
  max-width: 100%;
}

.weather-content {
  overflow-x: clip;
}

.card {
  background: #224e70b8;
}

.card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card-label, .day-row .low, .data-footnote, .outlook p {
  color: #e2edf7;
}

.hourly {
  gap: 22px;
  padding-bottom: 10px;
  scrollbar-width: thin;
  scrollbar-color: #ffffff70 transparent;
}

.hourly::-webkit-scrollbar {
  display: block;
  height: 4px;
}

.hourly::-webkit-scrollbar-thumb {
  background: #ffffff70;
  border-radius: 4px;
}

.hourly article {
  flex: 0 0 40px;
}

.hourly small, .day-icon small {
  color: #d5edff;
}

.day-icon {
  flex-shrink: 0;
}

.day-row {
  gap: 8px;
}

.day-row h3 {
  flex: 0 0 44px;
}

.compass {
  width: 112px;
  max-width: 100%;
  height: auto;
  aspect-ratio: 1;
}

.east, .west {
  top: 50%;
  transform: translateY(-50%);
}

.wind-arrow svg {
  max-height: 100%;
}

.picker-head, .weather-footer {
  flex-shrink: 0;
}

@container (max-width: 380px) {
  .weather-content {
    padding-inline: 14px;
  }
  .card {
    padding: 14px;
  }
  .metric {
    padding: 12px;
  }
  .metric strong {
    font-size: 30px;
  }
  .sunrise strong {
    font-size: 26px;
  }
  .card-label {
    flex-wrap: wrap;
    font-size: 12px;
  }
}

.picker {
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
  .picker {
    animation: none;
  }
}
</style>
