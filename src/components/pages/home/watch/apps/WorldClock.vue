<script setup lang="ts">
import { useWatch, useWatchHardware } from "../watch";
interface City {
  name: string;
  zone: string;
}
const watch = useWatch();
const catalog: City[] = [{
  name: 'Bengaluru',
  zone: 'Asia/Kolkata'
}, {
  name: 'London',
  zone: 'Europe/London'
}, {
  name: 'New York',
  zone: 'America/New_York'
}, {
  name: 'Tokyo',
  zone: 'Asia/Tokyo'
}, {
  name: 'Sydney',
  zone: 'Australia/Sydney'
}, {
  name: 'Paris',
  zone: 'Europe/Paris'
}, {
  name: 'San Francisco',
  zone: 'America/Los_Angeles'
}, {
  name: 'Dubai',
  zone: 'Asia/Dubai'
}];
const cities = ref<City[]>(catalog.slice(0, 4));
const adding = ref(false);
const selected = ref<City | null>(null);
function hour(city: City) {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: city.zone,
    hour: 'numeric',
    hourCycle: 'h23'
  }).format(watch.now.value));
}
function time(city: City) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: city.zone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: !watch.settings.hour24
  }).format(watch.now.value);
}
function date(city: City) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: city.zone,
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(watch.now.value);
}
function offset(city: City) {
  const zoneDate = new Date(watch.now.value.toLocaleString('en-US', {
    timeZone: city.zone
  }));
  const difference = Math.round((zoneDate.getTime() - watch.now.value.getTime()) / 60000);
  const sign = difference >= 0 ? '+' : '−';
  if (difference === 0) return 'Same as local';
  const hours = Math.floor(Math.abs(difference) / 60);
  const minutes = Math.abs(difference) % 60;
  return sign + hours + 'h' + (minutes ? ' ' + minutes + 'm' : '') + ' from local';
}
const minute = computed(() => watch.now.value.getMinutes());
useWatchHardware('worldClock', {
  back: () => {
    if (selected.value) {
      selected.value = null;
      return true;
    }
    if (adding.value) {
      adding.value = false;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <section class="watch-app world-app">
    <h1>World Clock</h1>
    <template v-if="adding">
      <p class="caption muted">Choose a city</p>
      <button
        v-for="city in catalog.filter(item=>!cities.some(existing=>existing.zone===item.zone))"
        :key="city.zone"
        class="watch-button city-option"
        @click="cities.push(city);adding=false"
      >
        ＋
        {{city.name}}
      </button>
      <button class="watch-button city-option" @click="adding=false">Cancel</button>
    </template>
    <template v-else-if="selected">
      <h2>
        {{selected.name}}
      </h2>
      <div class="clock-dial" :class="{night:hour(selected)<6||hour(selected)>=18}">
        <span
          v-for="n in 12"
          :key="n"
          :style="{transform:'rotate('+n*30+'deg) translateY(-104px) rotate(-'+n*30+'deg)'}"
        >
          {{n}}
        </span>
        <i class="hour-hand" :style="{transform:'rotate('+(hour(selected)%12*30+minute/2)+'deg)'}" />
        <i class="minute-hand" :style="{transform:'rotate('+minute*6+'deg)'}" />
        <b />
      </div>
      <div class="city-time">
        {{time(selected)}}
      </div>
      <p class="caption muted">
        {{date(selected)}}
      </p>
      <p class="caption muted">
        {{offset(selected)}}
      </p>
      <button class="watch-button danger city-option" @click="cities=cities.filter(city=>city.zone!==selected?.zone);selected=null">
        Remove City
      </button>
    </template>
    <template v-else>
      <button
        v-for="city in cities"
        :key="city.zone"
        class="platter city"
        @click="selected=city"
      >
        <span>
          <strong>
            {{city.name}}
          </strong>
          <small>
            {{offset(city)}}
          </small>
        </span>
        <span class="time">
          <b>
            {{time(city)}}
          </b>
          <small>
            {{hour(city)>=6&&hour(city)<18?'☀ Day':'☾ Night'}}
          </small>
        </span>
      </button>
      <button
        class="watch-button city-option"
        :disabled="cities.length===catalog.length"
        @click="adding=true"
      >
        ＋ Add City
      </button>
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

.world-app h1 {
  color: #7cafff;
}

.city {
  width: 100%;
  border: 0;
  color: white;
  text-align: left;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  min-height: 104px;
  margin-bottom: 12px;
}

.city strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
  display: block;
}

.city small {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 8px;
}

.time {
  text-align: right;
}

.time b {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  font-weight: 400;
  white-space: nowrap;
}

.time small {
  color: #ffdc8c;
}

.city-option {
  width: 100%;
  margin-top: 12px;
}

.clock-dial {
  width: 270px;
  height: 270px;
  position: relative;
  background: #e5e5e7;
  color: #161616;
  border-radius: 50%;
  margin: 22px auto;
}

.clock-dial.night {
  background: #171e2a;
  color: #eee;
}

.clock-dial>span {
  position: absolute;
  left: calc(50% - 18px);
  top: calc(50% - 18px);
  width: 36px;
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
}

.clock-dial i {
  position: absolute;
  left: calc(50% - 4px);
  bottom: 50%;
  transform-origin: bottom;
  border-radius: 5px;
  background: currentColor;
  width: 8px;
}

.hour-hand {
  height: 65px;
}

.minute-hand {
  height: 92px;
}

.clock-dial b {
  position: absolute;
  width: 14px;
  height: 14px;
  left: calc(50% - 7px);
  top: calc(50% - 7px);
  border-radius: 50%;
  background: #ff9f0a;
}

.city-time {
  font-size: max(calc(12px / var(--watch-scale)), calc(41px * var(--text-size, 1)));
  text-align: center;
}

.world-app h2,
.world-app>p {
  text-align: center;
}
</style>
