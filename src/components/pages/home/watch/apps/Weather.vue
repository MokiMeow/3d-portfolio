<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { clamp, useWatchHardware } from '../watch';
const page = ref(0);
const titles = ['Current', 'Hourly', '10-day', 'Details'];
const city = ref(0);
const cities = ['Bengaluru', 'Cupertino', 'Cloud Nine'];
const currentTemperature = computed(() => [26, 21, 19][city.value]);
const hourly = [{
  time: 'Now',
  temp: 26,
  icon: 'sun' as const,
  rain: 0
}, {
  time: '12 PM',
  temp: 26,
  icon: 'sun' as const,
  rain: 0
}, {
  time: '1 PM',
  temp: 27,
  icon: 'sun' as const,
  rain: 5
}, {
  time: '2 PM',
  temp: 27,
  icon: 'cloud' as const,
  rain: 10
}, {
  time: '3 PM',
  temp: 26,
  icon: 'cloud' as const,
  rain: 20
}, {
  time: '4 PM',
  temp: 25,
  icon: 'rain' as const,
  rain: 45
}, {
  time: '5 PM',
  temp: 24,
  icon: 'cloud' as const,
  rain: 25
}, {
  time: '6 PM',
  temp: 23,
  icon: 'cloud' as const,
  rain: 15
}];
const days = [{
  day: 'Today',
  low: 18,
  high: 27,
  icon: 'sun' as const
}, {
  day: 'Thu',
  low: 18,
  high: 26,
  icon: 'cloud' as const
}, {
  day: 'Fri',
  low: 19,
  high: 25,
  icon: 'rain' as const
}, {
  day: 'Sat',
  low: 18,
  high: 26,
  icon: 'cloud' as const
}, {
  day: 'Sun',
  low: 17,
  high: 28,
  icon: 'sun' as const
}, {
  day: 'Mon',
  low: 18,
  high: 29,
  icon: 'sun' as const
}, {
  day: 'Tue',
  low: 19,
  high: 28,
  icon: 'cloud' as const
}, {
  day: 'Wed',
  low: 19,
  high: 26,
  icon: 'rain' as const
}, {
  day: 'Thu',
  low: 18,
  high: 27,
  icon: 'cloud' as const
}, {
  day: 'Fri',
  low: 17,
  high: 28,
  icon: 'sun' as const
}];
let swipeStart: number | null = null;
function swipeDown(event: PointerEvent) { swipeStart = event.clientX; }
function swipeCancel() { swipeStart = null; }
function swipeEnd(event: PointerEvent) {
  if (swipeStart === null) return;
  const delta = event.clientX - swipeStart;
  swipeStart = null;
  if (Math.abs(delta) > 45) page.value = clamp(page.value + (delta < 0 ? 1 : -1), 0, 3);
}
useWatchHardware('weather', {
  crown: delta => {
    page.value = clamp(page.value + Math.sign(delta), 0, 3);
    return true;
  },
  back: () => {
    if (page.value) {
      page.value = 0;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <section
    class="watch-app weather-app"
    @pointerdown="swipeDown"
    @pointerup="swipeEnd"
    @pointercancel="swipeCancel"
  >
    <h1>Weather</h1>
    <button class="city" @click="city=(city+1)%cities.length">
      {{ cities[city] }}
      <span>
        <WatchGlyph name="down" />
      </span>
    </button>
    <p class="caption demo">DEMO FORECAST</p>
    <div
      class="pages"
      role="tablist"
      aria-label="Forecast pages"
    >
      <button
        v-for="(title,index) in titles"
        :key="title"
        role="tab"
        :aria-selected="page===index"
        :class="{selected:page===index}"
        @click="page=index"
      >
        {{ title }}
      </button>
    </div>
    <div v-if="page===0" class="current">
      <div class="weather-reading">
        <svg
          viewBox="0 0 120 110"
          class="sun"
          aria-hidden="true"
        >
          <g
            stroke="#FFD65B"
            stroke-width="7"
            stroke-linecap="round"
          >
            <path d="M60 4 V15 M60 95 V106 M9 55 H20 M100 55 H111 M24 19 L32 27 M88 83 L96 91 M24 91 L32 83 M88 27 L96 19" />
            <circle
              cx="60"
              cy="55"
              r="26"
              fill="#FFD65B"
            />
          </g>
        </svg>
        <strong class="temperature">
          {{ currentTemperature }}
          °
        </strong>
      </div>
      <h2>Mostly Sunny</h2>
      <p class="high-low">
        H:27°
        <span>L:18°</span>
      </p>
      <div class="platter outlook">
        <span class="caption">A little sunshine for your next break.</span>
        <div class="row">
          <span class="caption muted">Feels like</span>
          <strong>25°</strong>
        </div>
        <div class="row">
          <span class="caption muted">Chance of rain</span>
          <strong>10%</strong>
        </div>
      </div>
    </div>
    <div v-else-if="page===1">
      <h2>Hourly forecast</h2>
      <div
        v-for="hour in hourly"
        :key="hour.time"
        class="hour-row"
      >
        <strong>
          {{ hour.time }}
        </strong>
        <span class="weather-icon" :class="{rain:hour.rain>30}">
          <WatchGlyph :name="hour.icon" />
        </span>
        <span class="rain-chance">
          {{ hour.rain }}
          %
        </span>
        <strong>
          {{ hour.temp }}
          °
        </strong>
      </div>
    </div>
    <div v-else-if="page===2">
      <h2>10-day forecast</h2>
      <div
        v-for="(day,index) in days"
        :key="index"
        class="day-row"
      >
        <strong>
          {{ day.day }}
        </strong>
        <span class="weather-icon">
          <WatchGlyph :name="day.icon" />
        </span>
        <span class="low">
          {{ day.low }}
          °
        </span>
        <div class="range">
          <span :style="{left:(day.low-16)*7+'%',width:(day.high-day.low)*7+'%'}">
          </span>
        </div>
        <strong>
          {{ day.high }}
          °
        </strong>
      </div>
    </div>
    <div v-else class="details">
      <div class="platter detail">
        <span class="caption muted">Air quality</span>
        <strong>
          42
          <small>Good</small>
        </strong>
        <div class="quality">
          <span>
          </span>
        </div>
        <p class="caption muted">Illustrative AQI value</p>
      </div>
      <div class="platter detail">
        <span class="caption muted">UV index</span>
        <strong>
          5
          <small>Moderate</small>
        </strong>
        <div class="uv">
          <span>
          </span>
        </div>
        <p class="caption muted">Demo peak at 1 PM</p>
      </div>
      <div class="platter detail wind">
        <div>
          <span class="caption muted">Wind</span>
          <strong>
            12
            <small>km/h</small>
          </strong>
          <span class="caption">From the east</span>
        </div>
        <svg viewBox="0 0 100 100" aria-label="Wind from east">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#749CB5"
            stroke-width="2"
          />
          <text
            x="50"
            y="23"
            text-anchor="middle"
            fill="white"
            font-size="17"
          >
            N
          </text>
          <path
            d="M25 50 H78 M25 50 L40 37 M25 50 L40 63"
            stroke="#75D7FF"
            stroke-width="6"
            fill="none"
            stroke-linecap="round"
          />
        </svg>
      </div>
      <div class="platter extra">
        <div>
          <span class="caption muted">Humidity</span>
          <strong>64%</strong>
        </div>
        <div>
          <span class="caption muted">Visibility</span>
          <strong>10 km</strong>
        </div>
        <div>
          <span class="caption muted">Sunset</span>
          <strong>6:05 PM</strong>
        </div>
      </div>
    </div>
    <p class="caption muted footer">Fictional weather data. Swipe or turn the Crown to change pages.</p>
    <div class="dots" aria-hidden="true">
      <span
        v-for="index in 4"
        :key="index"
        :class="{active:page===index-1}"
      >
      </span>
    </div>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  line-height: 1.1;
  margin: 0 0 22px;
  font-weight: 700;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  margin: 0 0 12px;
}

.watch-app button:focus-visible,
.watch-app input:focus-visible {
  outline: 4px solid #fff;
  outline-offset: 3px;
}

.watch-app button {
  touch-action: manipulation;
}

.watch-app p {
  line-height: 1.3;
}

.watch-app input {
  box-sizing: border-box;
  width: 100%;
  height: 80px;
  border: 0;
  border-radius: 24px;
  background: #252527;
  color: white;
  padding: 0 20px;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.weather-app {
  background: linear-gradient(#07172C,#102C45 48%,#030B12);
  touch-action: pan-y;
}

.city {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 80px;
  border: 0;
  background: transparent;
  color: white;
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  text-align: left;
  padding: 0;
  margin-top: -18px;
}

.demo {
  color: #8AD7FF;
  letter-spacing: 2px;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  margin: 2px 0 14px;
}

.pages {
  display: flex;
  background: #ffffff12;
  border-radius: 22px;
  padding: 4px;
  margin-bottom: 20px;
}

.pages button {
  min-height: 72px;
  padding: 0 8px;
  flex: 1;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: #BCD7E9;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.pages .selected {
  background: #ffffff25;
  color: white;
}

.current {
  text-align: center;
}

.sun {
  width: 110px;
  height: 94px;
}

.temperature {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(93px * var(--text-size, 1)));
  line-height: 1;
  letter-spacing: -5px;
}

.current h2 {
  margin: 12px 0 4px;
}

.high-low {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  margin: 0 0 22px;
}

.high-low span {
  color: #BCD2E0;
  margin-left: 15px;
}

.outlook {
  text-align: left;
}

.outlook .row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  min-height: 52px;
}

.outlook strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.hour-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 82px;
  border-bottom: 1px solid #ffffff15;
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.hour-row>strong:first-child {
  min-width: 100px;
}

.weather-icon {
  color: #FFD75F;
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
}

.weather-icon.rain {
  color: #74CBFF;
}

.rain-chance {
  color: #7AD0FF;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
}

.day-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 80px;
  border-bottom: 1px solid #ffffff15;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
}

.day-row>strong:first-child {
  width: 80px;
}

.day-row .weather-icon {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.low {
  color: #9DB8CA;
}

.range {
  position: relative;
  flex: 1;
  height: 8px;
  background: #ffffff15;
  border-radius: 8px;
  min-width: 45px;
}

.range span {
  position: absolute;
  height: 8px;
  border-radius: 8px;
  background: linear-gradient(90deg,#62BAF6,#FBCD54);
}

.detail {
  margin-bottom: 14px;
}

.detail>strong,
.wind strong {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(51px * var(--text-size, 1)));
  line-height: 1.3;
}

.detail small {
  font-size: max(calc(12px / var(--watch-scale)), calc(24px * var(--text-size, 1)));
  font-weight: 500;
}

.quality,
.uv {
  height: 9px;
  border-radius: 10px;
  margin-top: 16px;
  position: relative;
  background: linear-gradient(90deg,#30D158,#FFD60A,#FF453A,#AF52DE);
}

.quality span,
.uv span {
  position: absolute;
  top: -5px;
  height: 18px;
  width: 6px;
  background: white;
  border-radius: 4px;
  left: 14%;
  box-shadow: 0 0 0 2px #182E40;
}

.uv span {
  left: 45%;
}

.detail p {
  margin-bottom: 0;
}

.wind {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wind svg {
  width: 108px;
  height: 108px;
}

.extra>div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.dots {
  display: flex;
  gap: 10px;
  justify-content: center;
  padding: 8px;
}

.dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #62798A;
}

.dots .active {
  background: white;
}

.footer {
  margin-top: 22px;
}

.city {
  margin-top: 0;
  min-height: 68px;
  font-size: 28px;
}

.demo {
  margin: 4px 0 10px;
  letter-spacing: 0.8px;
}

.pages {
  margin-bottom: 12px;
}

.pages button {
  padding: 4px;
  font-size: max(21px, calc(12px / var(--watch-scale)));
}

.sun {
  width: 70px;
  height: 60px;
}

.temperature {
  font-size: 82px;
}

.high-low {
  margin-bottom: 12px;
}

.current > h2 {
  margin: 6px 0;
}

.weather-reading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 90px;
}

.weather-reading .sun {
  width: 64px;
  height: 54px;
}

.weather-reading .temperature {
  font-size: 82px;
}
</style>
