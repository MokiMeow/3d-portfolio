<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const daytime = ref(false);
const selected = ref<string | null>(null);
const metrics = computed(() => [
    {
        name: 'Heart Rate',
        value: daytime.value ? watch.health.heartRate : watch.health.resting,
        unit: 'BPM',
        position: daytime.value ? .55 : .42,
        range: '52–76 BPM',
        note: 'A sample heart rate compared with a generated personal range.'
    },
    {
        name: 'Respiratory Rate',
        value: watch.health.respiratory,
        unit: 'BR/MIN',
        position: .5,
        range: '12–19 breaths/min',
        note: 'A sample breathing rate. No sensor measurement is taken.'
    },
    {
        name: 'Wrist Temperature',
        value: watch.health.temperature.toFixed(1),
        unit: '°C',
        position: .53,
        range: 'Sample baseline ±0.5°C',
        note: 'A generated wrist-temperature value for the demo.'
    },
    {
        name: 'Blood Oxygen', value: watch.health.oxygen, unit: '%', position: .65, range: '95–100%', note: 'A simulated oxygen value. This is not a medical reading.'
    },
    {
        name: 'Sleep Duration', value: watch.health.sleep.hours.toFixed(1), unit: 'HR', position: .58, range: '6.5–8.5 hours', note: 'The sample night displayed in the Sleep app.'
    },
]);
const detail = computed(() => metrics.value.find(m => m.name === selected.value));
useWatchHardware('vitals', {
    action: () => {
        daytime.value = !daytime.value;
        return true;
    }, back: () => {
        if (selected.value) {
            selected.value = null;
            return true;
        }
        return false;
    }
});
</script>

<template>
  <section class="watch-app vitals-app">
    <h1>{{ detail ? detail.name : 'Vitals' }}</h1>
    <template v-if="detail">
      <h2>
        {{ detail.name }}
      </h2>
      <p class="detail-value">
        {{ detail.value }}
        <small>
          {{ detail.unit }}
        </small>
      </p>
      <div class="baseline">
        <div class="typical-band" />
        <i :style="{ left: detail.position * 100 + '%' }" />
      </div>
      <p class="caption blue">Within sample range</p>
      <div class="platter">
        <p class="caption muted">SAMPLE PERSONAL RANGE</p>
        <p class="caption">
          {{ detail.range }}
        </p>
      </div>
      <p class="caption muted">
        {{ detail.note }}
      </p>
      <button
        v-if="detail.name === 'Heart Rate'"
        class="watch-button"
        @click="watch.open('heartRate')"
      >
        Heart Rate
      </button>
      <button
        v-if="detail.name === 'Sleep Duration'"
        class="watch-button"
        @click="watch.open('sleep')"
      >Sleep</button>
    </template>
    <template v-else>
      <nav class="tabs">
        <button :class="{ selected: !daytime }" @click="daytime = false">Overnight</button>
        <button :class="{ selected: daytime }" @click="daytime = true">Daytime</button>
      </nav>
      <div class="overview-bars" aria-hidden="true">
        <span
          v-for="(metric, i) in metrics"
          :key="metric.name"
          :style="{ height: 75 + i % 3 * 25 + 'px' }"
        >
          <i :style="{ top: metric.position * 100 + '%' }" />
        </span>
      </div>
      <h2 class="blue">Within sample range</h2>
      <p class="caption muted">
        {{ daytime ? 'Current sample readings' : 'Last night’s sample readings' }}
      </p>
      <button
        v-for="metric in metrics"
        :key="metric.name"
        class="platter vital-row"
        @click="selected = metric.name"
      >
        <div>
          <h3>
            {{ metric.name }}
          </h3>
          <p>
            {{ metric.value }}
            <small>
              {{ metric.unit }}
            </small>
          </p>
        </div>
        <div class="mini-baseline">
          <span />
          <i :style="{ left: metric.position * 100 + '%' }" />
        </div>
        <span class="chevron">
          <WatchGlyph name="next" />
        </span>
      </button>
      
    </template>
    <p class="polish-footnote">Not a medical device.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,'SF Pro Rounded','Segoe UI',sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  font-weight: 700;
  margin: 0 0 20px;
}

h2 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  font-weight: 600;
  line-height: 1.2;
  margin: 20px 0;
}

.blue {
  color: #65cfff;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 30px;
}

.tabs button {
  min-height: 70px;
  flex: 1;
  background: #182332;
  border-radius: 32px;
  color: #8aafc5;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
}

.tabs .selected {
  background: #234c67;
  color: #a3e7ff;
}

.overview-bars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22px;
  height: 140px;
  margin: 15px 0 28px;
}

.overview-bars>span {
  position: relative;
  width: 32px;
  border-radius: 16px;
  background: #123957;
}

.overview-bars i {
  position: absolute;
  left: 0;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  background: #67d6ff;
  box-shadow: 0 0 20px #4bc8ff35;
  transform: translateY(-50%);
}

.vital-row {
  width: 100%;
  display: flex;
  align-items: center;
  text-align: left;
  gap: 10px;
  min-height: 134px;
}

.vital-row h3 {
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  font-weight: 500;
  margin: 0 0 8px;
}

.vital-row p {
  font-size: max(18px, calc(33px * var(--text-size, 1)));
  margin: 0;
  line-height: 1.2;
}

.vital-row small {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  color: #8cadc3;
  margin-left: 7px;
}

.mini-baseline {
  width: 84px;
  height: 12px;
  border-radius: 8px;
  background: #0d293f;
  position: relative;
  margin-left: auto;
  flex-shrink: 0;
}

.mini-baseline span {
  position: absolute;
  left: 22%;
  width: 56%;
  height: 12px;
  background: #256286;
  border-radius: 8px;
}

.mini-baseline i {
  position: absolute;
  top: -7px;
  width: 11px;
  height: 26px;
  border-radius: 5px;
  background: #67d6ff;
}

.chevron {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  color: #6c8090;
}

.back-detail {
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  color: #67d6ff;
  min-height: 70px;
}

.detail-value {
  font-size: max(18px, calc(83px * var(--text-size, 1)));
  letter-spacing: -5px;
  line-height: 1.2;
  margin: 35px 0;
  color: #8addff;
}

.detail-value small {
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  letter-spacing: 0;
  margin-left: 10px;
}

.baseline {
  position: relative;
  height: 28px;
  background: #10273b;
  border-radius: 14px;
  margin: 35px 0;
}

.typical-band {
  position: absolute;
  left: 25%;
  width: 50%;
  height: 100%;
  border-radius: 14px;
  background: #215e84;
}

.baseline i {
  position: absolute;
  width: 14px;
  height: 48px;
  top: -10px;
  border-radius: 7px;
  background: #83e3ff;
}

.tabs {
  margin-bottom: 14px;
}

.overview-bars {
  height: 96px;
  margin: 8px 0 14px;
  gap: 20px;
}

.vital-row {
  min-height: 102px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #46BCFF; }

.vital-row { min-height:104px; gap:12px; }
.vital-row > div:first-child { flex:1; min-width:0; }
.vital-row p { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px; font-size:32px; font-weight:600; }
.vital-row small { margin:0; font-size:20px; }
.mini-baseline { width:64px; }
.chevron { flex:0 0 24px; }
.detail-value { margin:20px 0; }
.baseline { margin:28px 0; }
</style>
