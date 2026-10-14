<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const mode = ref<'dice' | 'coin'>('dice');
const face = ref(1);
const coin = ref<'Heads' | 'Tails'>('Heads');
const rolled = ref(false);
const rolling = ref(false);
const history = ref<{
  id: number;
  mode: 'dice' | 'coin';
  result: string;
}[]>([]);
let serial = 0;
let animationTimer: ReturnType<typeof setTimeout> | undefined;
const pips = computed(() => ({
  1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
})[face.value as 1 | 2 | 3 | 4 | 5 | 6]);
function random(limit: number) {
  const values = new Uint32Array(1);
  const ceiling = Math.floor(4294967296 / limit) * limit;
  do {
    crypto.getRandomValues(values);
  } while ((values[0] ?? 0) >= ceiling);
  return (values[0] ?? 0) % limit;
}
function stopAnimation() {
  if (animationTimer)
    clearTimeout(animationTimer);
  animationTimer = undefined;
  rolling.value = false;
}
function roll() {
  if (rolling.value)
    return;
  rolled.value = true;
  let result: string;
  if (mode.value === 'dice') {
    face.value = random(6) + 1;
    result = String(face.value);
  }
  else {
    coin.value = random(2) === 0 ? 'Heads' : 'Tails';
    result = coin.value;
  }
  history.value.unshift({ id: ++serial, mode: mode.value, result });
  history.value = history.value.slice(0, 12);
  watch.haptic('success');
  if (!watch.reducedMotion.value) {
    rolling.value = true;
    animationTimer = setTimeout(stopAnimation, 480);
  }
}
function setMode(value: 'dice' | 'coin') {
  stopAnimation();
  mode.value = value;
  rolled.value = false;
}
useWatchHardware('dice', {
  action: () => {
    roll();
    return true;
  }, crown: (delta) => {
    setMode(delta > 0 ? 'coin' : 'dice');
    return true;
  }
});
watchEffect(() => {
  if (watch.dimmed.value || watch.reducedMotion.value)
    stopAnimation();
});
onDeactivated(stopAnimation);
onBeforeUnmount(stopAnimation);
</script>

<template>
  <section class="watch-app dice-app">
    <h1>Dice & Coin</h1>
    <div
      class="mode"
      role="group"
      aria-label="Choose randomizer"
    >
      <button
        :class="{ selected: mode === 'dice' }"
        :aria-pressed="mode === 'dice'"
        @click="setMode('dice')"
      >
        Dice
      </button>
      <button
        :class="{ selected: mode === 'coin' }"
        :aria-pressed="mode === 'coin'"
        @click="setMode('coin')"
      >
        Coin
      </button>
    </div>
    <div class="result" :class="{ rolling, 'coin-result': mode === 'coin' }">
      <div
        v-if="mode === 'dice'"
        class="die"
        role="img"
        :aria-label="'Die showing ' + face"
      >
        <span
          v-for="n in 9"
          :key="n"
          :class="{ pip: pips.includes(n) }"
        >
        </span>
      </div>
      <div
        v-else
        class="coin"
        role="img"
        :aria-label="coin"
      >
        <span>
          <WatchGlyph :name="coin === 'Heads' ? 'smile' : 'star'" />
        </span>
      </div>
    </div>
    <button
      class="watch-button roll-button"
      :disabled="rolling"
      @click="roll"
    >
      {{ rolling ? 'Rolling…' : mode === 'dice' ? 'Roll a die' : 'Flip a coin' }}
    </button>
    <p class="result-label" aria-live="polite">
      {{ rolled ? mode === 'dice' ? 'You rolled ' + face : coin : mode === 'dice' ? 'Feeling lucky?' : 'Make the call.' }}
    </p>
    <div v-if="history.length" class="history">
      <div class="row">
        <h2>Recent luck</h2>
        <button class="clear" @click="history = []">Clear</button>
      </div>
      <div class="chips">
        <span
          v-for="entry in history"
          :key="entry.id"
          :class="{ 'coin-chip': entry.mode === 'coin' }"
        >
          <span aria-hidden="true">
            <WatchGlyph :name="entry.mode === 'dice' ? 'dice' : 'coins'" />
          </span>
          {{ entry.result }}
        </span>
      </div>
    </div>
    <p class="caption muted footnote">Crown switches. Action rolls.</p>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.dice-app {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;
}

.dice-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  margin: 0 0 15px;
}

.mode {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 5px;
  gap: 5px;
  background: #222027;
  border-radius: 32px;
}

.mode button {
  min-height: 72px;
  border: 0;
  border-radius: 28px;
  background: transparent;
  color: #aeaeb2;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.mode button.selected {
  background: #66518b;
  color: white;
}

.mode button:focus-visible,
.clear:focus-visible {
  outline: 4px solid white;
  outline-offset: 2px;
}

.result {
  height: 180px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
}

.die {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  grid-template-rows: repeat(3,1fr);
  width: 144px;
  height: 144px;
  border-radius: 30px;
  background: linear-gradient(140deg,#e9e2ff,#ac8aff);
  padding: 25px;
  gap: 14px;
  box-sizing: border-box;
  box-shadow: inset 0 2px 1px white,0 8px 0 #6a5396;
  transform: rotate(-7deg);
}

.die span {
  border-radius: 50%;
}

.die .pip {
  background: #2c1d43;
  box-shadow: inset 0 2px 3px #0006;
}

.coin {
  width: 158px;
  height: 158px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 9px double #f2cf75;
  background: linear-gradient(135deg,#ffdc77,#b78127);
  box-shadow: inset 0 0 0 5px #ad7427,0 7px 0 #76501e;
  color: #825015;
}

.coin span {
  font-size: max(18px, calc(87px * var(--text-size, 1)));
  line-height: 1.2;
}

.result-label {
  font-size: max(18px, calc(29px * var(--text-size, 1)));
  text-align: center;
  font-weight: 650;
  margin: 10px 0 18px;
  min-height: 40px;
}

.roll-button {
  background: #ac8aff;
  color: #221234;
  font-weight: 750;
}

.roll-button:disabled {
  opacity: .8;
}

.rolling {
  animation: shake .48s ease-in-out;
}

.rolling.coin-result {
  animation: flip .48s ease-in-out;
}

.history {
  margin-top: 18px;
}

.history h2 {
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  margin: 0;
}

.clear {
  min-height: 72px;
  min-width: 86px;
  border: 0;
  background: transparent;
  color: #ac8aff;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  border-radius: 24px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chips>span {
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  border-radius: 18px;
  background: #272131;
  color: #d7c3ff;
  padding: 10px 15px;
}

.chips>span.coin-chip {
  background: #342b19;
  color: #e7c674;
}

.footnote {
  text-align: center;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  margin: 22px 0 0;
}

@keyframes shake {
  0%,
  100% {
    transform: rotate(0);
  }

  20% {
    transform: rotate(14deg) translateY(-10px);
  }

  50% {
    transform: rotate(-20deg);
  }

  75% {
    transform: rotate(11deg);
  }
}

@keyframes flip {
  50% {
    transform: rotateY(270deg) translateY(-14px);
  }
}

@media (prefers-reduced-motion:reduce) {
  .rolling,
  .rolling.coin-result {
    animation: none;
  }
}

.result {
  height: 106px;
  margin: 12px 0;
}

.die {
  width: 96px;
  height: 96px;
  padding: 16px;
  gap: 8px;
  border-radius: 22px;
}

.coin {
  width: 106px;
  height: 106px;
}

.coin svg {
  width: 62px;
  height: 62px;
}

.result-label {
  margin: 8px 0;
  min-height: 32px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #AC8AFF; }

.mode { gap:10px; }
.mode button { min-height:64px; border-radius:32px; font-size:25px; }
.history .row { flex-wrap:wrap; }
.chips { flex-wrap:wrap; gap:10px; }
.chips > span { font-size:24px; line-height:1.25; }
.clear { min-height:64px; border-radius:32px; font-size:22px; }
</style>
