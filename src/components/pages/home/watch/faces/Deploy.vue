<script setup lang="ts">
import { useWatch, timeText } from '../watch';
import FaceComplication from './FaceComplication.vue';
const watch = useWatch();
const time = computed(() => timeText(watch.now.value, watch.settings.hour24).replace(/\s?(AM|PM)/i, ''));
const days = computed(() => Math.max(0, Math.floor((watch.now.value.getTime() - watch.fun.incidentAt) / 86400000)));
const progress = computed(() => watch.fun.lastBuild === 'passed' ? 1 : watch.fun.lastBuild === 'running' ? .68 : watch.fun.lastBuild === 'failed' ? .42 : .93);
const circumference = 2 * Math.PI * 93;
function incident() {
    watch.fun.incidentAt = watch.now.value.getTime();
    watch.haptic('warning');
    watch.notify({
        app: 'deploy', title: 'Incident clock reset', text: 'A fresh start. The counter is back to zero.'
    });
}
</script>

<template>
  <div class="face deploy">
    <button
      class="branch"
      type="button"
      aria-label="Open Deploy on main branch"
      @click="watch.open('deploy')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 4v15m0-7c0-7 12 1 12-8"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        />
        <circle
          cx="6"
          cy="4"
          r="3"
          fill="#000"
          stroke="currentColor"
          stroke-width="2"
        />
        <circle
          cx="6"
          cy="19"
          r="3"
          fill="#000"
          stroke="currentColor"
          stroke-width="2"
        />
        <circle
          cx="18"
          cy="4"
          r="3"
          fill="#000"
          stroke="currentColor"
          stroke-width="2"
        />
      </svg>
      main
      <span>● production</span>
    </button>
    <div class="time">
      {{time}}
    </div>
    <button
      class="tests"
      type="button"
      aria-label="Open Deploy build and tests"
      @click="watch.open('deploy')"
    >
      <svg viewBox="0 0 224 224" aria-hidden="true">
        <circle
          cx="112"
          cy="112"
          r="93"
          fill="none"
          stroke="#202026"
          stroke-width="14"
        />
        <circle
          cx="112"
          cy="112"
          r="93"
          fill="none"
          :stroke="watch.fun.lastBuild==='failed'?'#FF453A':'#B18CFF'"
          stroke-width="14"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="circumference*(1-progress)"
          transform="rotate(-90 112 112)"
        />
        <path
          v-if="watch.fun.lastBuild!=='failed'"
          d="m85 84 19 19 34-38"
          stroke="#B6F31B"
          stroke-width="8"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
        <path
          v-else
          d="m94 66 36 36m0-36-36 36"
          stroke="#FF453A"
          stroke-width="8"
          stroke-linecap="round"
        />
      </svg>
      <strong>
        {{watch.fun.lastBuild==='running'?'BUILDING':watch.fun.lastBuild==='failed'?'CHECK FAILED':'TESTS PASS'}}
      </strong>
      <span>
        {{watch.fun.deploys}}
        DEPLOYS
      </span>
    </button>
    <button
      class="incident"
      type="button"
      aria-label="Reset days since incident to zero"
      @click="incident"
    >
      <strong>
        {{days}}
      </strong>
      <span>DAYS SINCE INCIDENT</span>
      <small>TAP TO RESET</small>
    </button>
    <FaceComplication
      class="corner"
      style="left:60px;top:455px"
      app="coffee"
      label="Coffee"
      :value="watch.fun.cups+' CUPS'"
      color="#C7976A"
    />
    <FaceComplication
      class="corner"
      style="left:362px;top:455px"
      app="rubberDuck"
      label="Rubber Duck"
      value="DEBUG"
      color="#FFD60A"
    />
  </div>
</template>

<style scoped>
.branch {
  position: absolute;
  top: 47px;
  left: 35px;
  width: 352px;
  height: 64px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: #B18CFF;
  border: 0;
  border-radius: 20px;
  font-size: 25px;
  text-align: left;
  cursor: pointer;
}

.branch svg {
  width: 26px;
  height: 26px;
}

.branch span {
  font-size: max(21px, calc(12px / var(--watch-scale)));
  color: #A4FF00;
  margin-left: auto;
}

.time {
  position: absolute;
  top: 108px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 78px;
  font-weight: 650;
  letter-spacing: -4px;
  line-height: 1;
}

.tests {
  position: absolute;
  top: 189px;
  left: 99px;
  width: 224px;
  height: 224px;
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--ink);
  border-radius: 50%;
  cursor: pointer;
}

.tests svg {
  position: absolute;
  inset: 0;
  width: 224px;
  height: 224px;
}

.tests strong {
  position: absolute;
  left: 0;
  right: 0;
  top: 115px;
  text-align: center;
  font-size: 22px;
}

.tests span {
  position: absolute;
  left: 0;
  right: 0;
  top: 143px;
  text-align: center;
  font-size: max(21px, calc(12px / var(--watch-scale)));
  color: #8B8B94;
  letter-spacing: .8px;
}

.incident {
  position: absolute;
  top: 414px;
  left: 102px;
  width: 218px;
  min-height: 86px;
  background: transparent;
  border: 0;
  border-radius: 22px;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.incident strong {
  font-size: 37px;
  line-height: 1;
}

.incident span {
  font-size: max(21px, calc(12px / var(--watch-scale)));
  font-weight: 650;
  letter-spacing: .4px;
}

.incident small {
  font-size: max(21px, calc(12px / var(--watch-scale)));
  color: #8D8D94;
  margin-top: 4px;
}

.face {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.face :deep(*) {
  font-family: inherit;
}
</style>
