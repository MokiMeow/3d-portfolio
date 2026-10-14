<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import ActivityRings from '../ActivityRings.vue';
import WatchChart from '../WatchChart.vue';
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const page = ref<'today' | 'history' | 'awards'>('today');
const celebratedAt = ref<number | null>(null);
const celebration = computed(() => celebratedAt.value !== null && watch.now.value.getTime() - celebratedAt.value < 2400 && watch.activeApp.value === 'activity');
const allClosed = computed(() =>
    watch.health.move >= watch.health.goals.move &&
    watch.health.exercise >= watch.health.goals.exercise &&
    watch.health.stand >= watch.health.goals.stand
);
const previousClosed = ref(allClosed.value);
watchEffect(() => {
    if (allClosed.value && !previousClosed.value) {
        celebratedAt.value = watch.now.value.getTime();
        watch.haptic('success');
        watch.notify({
            app: 'activity', title: 'All rings closed', text: 'Your simulated daily goals are complete.'
        });
    }
    previousClosed.value = allClosed.value;
});
function addMove() {
    watch.health.move += 25;
    watch.health.exercise += 3;
    watch.health.steps += 300;
    watch.haptic();
}
function closeRings() {
    watch.health.move = Math.max(watch.health.move, watch.health.goals.move);
    watch.health.exercise = Math.max(watch.health.exercise, watch.health.goals.exercise);
    watch.health.stand = Math.max(watch.health.stand, watch.health.goals.stand);
}
const days = computed(() => Array.from({ length: 7 }, (_, i) => {
    const date = new Date(watch.now.value);
    date.setDate(date.getDate() - (6 - i));
    return {
        label: date.toLocaleDateString([], { weekday: 'short' }),
        move: i === 6
            ? watch.health.move / watch.health.goals.move
            : [.8, 1.12, .74, .96, 1.2, 1.03][i] ?? .8,
        exercise: i === 6
            ? watch.health.exercise / watch.health.goals.exercise
            : [.7, 1.1, .9, 1.05, 1.3, .95][i] ?? .8,
        stand: i === 6
            ? watch.health.stand / watch.health.goals.stand
            : [.9, 1, .8, 1, 1, .9][i] ?? .8
    };
}));
useWatchHardware('activity', {
    action: () => {
        addMove();
        return true;
    }, back: () => {
        if (page.value !== 'today') {
            page.value = 'today';
            return true;
        }
        return false;
    }
});
</script>

<template>
  <section class="watch-app activity-app">
    <h1>Activity</h1>
    <nav class="tabs" aria-label="Activity views">
      <button
        v-for="tab in (['today', 'history', 'awards'] as const)"
        :key="tab"
        :class="{ selected: page === tab }"
        @click="page = tab"
      >
        {{ tab }}
      </button>
    </nav>
    <template v-if="page === 'today'">
      <ActivityRings
        :move="watch.health.move / watch.health.goals.move"
        :exercise="watch.health.exercise / watch.health.goals.exercise"
        :stand="watch.health.stand / watch.health.goals.stand"
        :size="224"
        :celebrate="celebration"
      />
      <p v-if="allClosed" class="closed">All rings closed!</p>
      <div class="totals">
        <article class="move">
          <h2>Move</h2>
          <p>
            <strong>
              {{ Math.round(watch.health.move) }}
            </strong>
            /
            {{ watch.health.goals.move }}
            <span>KCAL</span>
          </p>
          <WatchChart
            :values="[4, 6, 14, 9, 24, 17, 21, 35, 29, 41, 26, 48]"
            color="#FA114F"
            :height="80"
          />
        </article>
        <article class="exercise">
          <h2>Exercise</h2>
          <p>
            <strong>
              {{ watch.health.exercise }}
            </strong>
            /
            {{ watch.health.goals.exercise }}
            <span>MIN</span>
          </p>
        </article>
        <article class="stand">
          <h2>Stand</h2>
          <p>
            <strong>
              {{ watch.health.stand }}
            </strong>
            /
            {{ watch.health.goals.stand }}
            <span>HRS</span>
          </p>
          <div class="stand-bars">
            <i
              v-for="n in watch.health.goals.stand"
              :key="n"
              :class="{ filled: n <= watch.health.stand }"
            />
          </div>
        </article>
      </div>
      <div class="platter">
        <p class="caption muted">TOTAL STEPS</p>
        <p class="metric">
          {{ watch.health.steps.toLocaleString() }}
        </p>
        <p class="caption muted">
          {{ (watch.health.steps * .00072).toFixed(2) }}
          KM · SIMULATED
        </p>
      </div>
      <button class="watch-button" @click="addMove">Add a little movement</button>
      <button class="watch-button positive" @click="closeRings">Close all rings</button>
      <p class="caption muted">Demo controls update your rings.</p>
    </template>
    <template v-else-if="page === 'history'">
      <h2>This week</h2>
      <div class="week">
        <article v-for="day in days" :key="day.label">
          <p>
            {{ day.label }}
          </p>
          <ActivityRings
            :size="76"
            :move="day.move"
            :exercise="day.exercise"
            :stand="day.stand"
          />
        </article>
      </div>
      <WatchChart
        :values="days.map(d => Math.round(d.move * watch.health.goals.move))"
        color="#FA114F"
        :height="140"
      />
      <p class="caption muted">Seven days of sample activity. Today updates live.</p>
      <div
        v-for="day in [...days].reverse()"
        :key="day.label"
        class="platter history-row"
      >
        <strong>
          {{ day.label }}
        </strong>
        <span class="move">
          {{ Math.round(day.move * watch.health.goals.move) }}
          kcal
        </span>
      </div>
    </template>
    <template v-else>
      <div class="award" :class="{ earned: allClosed }">
        <span>
          <WatchGlyph name="star" />
        </span>
        <ActivityRings
          :size="180"
          :move="allClosed ? 1 : .4"
          :exercise="allClosed ? 1 : .4"
          :stand="allClosed ? 1 : .4"
        />
      </div>
      <h2 class="award-title">Perfect Day</h2>
      <p class="caption muted">
        {{ allClosed ? 'Earned today. All three goals complete.' : 'Close all three rings to earn this award.' }}
      </p>
      <div class="platter">
        <h2>Move Goal</h2>
        <p class="caption">
          {{ Math.round(watch.health.move / watch.health.goals.move * 100) }}
          % complete
        </p>
      </div>
    </template>
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
  font-size: max(calc(12px / var(--watch-scale)), calc(31px * var(--text-size, 1)));
  font-weight: 700;
  margin: 0 0 18px;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
  margin: 0;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 5px;
  background: #1c1c1e;
  padding: 5px;
  border-radius: 30px;
  margin-bottom: 20px;
}

.tabs button {
  min-height: 66px;
  flex: 1;
  border-radius: 26px;
  color: #b6b6bc;
  background: transparent;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
  text-transform: capitalize;
}

.tabs .selected {
  background: #3a3a3c;
  color: #fff;
}

.totals article {
  padding: 25px 0;
  border-bottom: 1px solid #ffffff22;
}

.totals p {
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
  margin: 0;
  line-height: 1.12;
}

.totals strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(60px * var(--text-size, 1)));
  font-weight: 650;
  letter-spacing: -4px;
}

.totals p span {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  display: block;
  letter-spacing: 1px;
}

.move {
  color: #FA114F;
}

.exercise {
  color: #A6FF00;
}

.stand {
  color: #00E0D6;
}

.stand-bars {
  display: flex;
  gap: 7px;
  margin-top: 18px;
}

.stand-bars i {
  flex: 1;
  height: 60px;
  border-radius: 7px;
  background: #00e0d624;
}

.stand-bars .filled {
  background: #00e0d6;
}

.closed {
  color: #A6FF00;
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.week {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 18px 6px;
  margin: 20px 0;
}

.week p {
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  margin-bottom: 10px;
}

.history-row {
  display: flex;
  justify-content: space-between;
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.award {
  position: relative;
  width: 230px;
  margin: 35px auto;
  padding: 25px;
  border-radius: 50%;
  background: radial-gradient(#554d2433,#1c1c1e);
  border: 6px ridge #655d35;
}

.award.earned {
  border-color: #ffd86d;
  background: radial-gradient(#877423,#211905);
}

.award>span {
  position: absolute;
  left: 95px;
  top: -35px;
  color: #e9c26a;
  font-size: max(calc(12px / var(--watch-scale)), calc(58px * var(--text-size, 1)));
}

.award-title {
  text-align: center;
  margin: 20px 0;
}

.tabs {
  margin-bottom: 12px;
}

.totals article {
  padding: 18px 0;
}

.award > span {
  left: calc(50% - 22px);
  top: -26px;
  line-height: 1;
}

.award > span :deep(svg) {
  width: 44px;
  height: 44px;
}
</style>
