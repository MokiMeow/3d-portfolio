<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const cards = [
  {
    id: 1,
    name: 'Studio Card',
    kind: 'DEMO CARD',
    number: '•••• 2048',
    color: '#b0a184',
    secondary: '#554a3e',

  }, {
    id: 2,
    name: 'Orbit Express',
    kind: 'BOARDING PASS',
    number: 'GATE 07 · SEAT 12A',
    color: '#62cfe4',
    secondary: '#136379',

  }, {
    id: 3,
    name: 'Coffee Club',
    kind: 'DEMO MEMBERSHIP',
    number: 'ONE IMAGINARY LATTE',
    color: '#caa877',
    secondary: '#765635',

  }
];
const expanded = ref(false);
const selected = ref<number | null>(null);
const card = computed(() => cards.find(item => item.id === selected.value));
const stage = ref<'idle' | 'checking' | 'ready'>('idle');
const at = ref(0);
const animate = computed(() => !watch.reducedMotion.value && !watch.dimmed.value);
function activate() {
  stage.value = 'checking';
  at.value = watch.now.value.getTime();
  watch.haptic();
}
watchEffect(() => {
  if (stage.value === 'checking' && watch.now.value.getTime() - at.value >= 1500) {
    stage.value = 'ready';
    watch.haptic('success');
  }
});
function reset() {
  stage.value = 'idle';
}
onDeactivated(reset);
onBeforeUnmount(reset);
useWatchHardware('wallet', {
  back: () => {
    if (stage.value !== 'idle') {
      reset();
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
  <div class="watch-app root" :class="{ still: !animate }">
    <h1>{{ card ? card.name : 'Wallet' }}</h1>
    <template v-if="card">
      <div class="card selected" :style="{ '--card': card.color, '--shade': card.secondary }">
        <div class="card-top">
          <span>
            {{ card.name }}
          </span>
          <b>
            <WatchGlyph :name="card.id === 1 ? 'coins' : card.id === 2 ? 'airplane' : 'coffee'" />
          </b>
        </div>
        <span class="kind">
          {{ card.kind }}
        </span>
        <div v-if="card.id === 1" class="chip">
          <i />
          <i />
          <i />
        </div>
        <div v-else-if="card.id === 2" class="boarding">
          <strong>EARTH</strong>
          <span><WatchGlyph name="next" /></span>
          <strong>ORBIT</strong>
        </div>
        <div v-else class="stamps">
          <svg v-for="n in 5" :key="n" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" :fill="n < 4 ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" /></svg>
        </div>
        <span class="number">
          {{ card.number }}
        </span>
      </div>
      <template v-if="stage === 'idle'">
        <button class="watch-button gold" @click="activate">Double-click demo</button>
        <p class="caption muted">Preview the Wallet animation.</p>
      </template>
      <div v-else class="payment">
        <div class="scan" :class="{ ready: stage === 'ready' }">
          <WatchGlyph :name="stage === 'ready' ? 'check' : 'signal'" />
        </div>
        <strong>
          {{ stage === 'ready' ? 'Demo ready' : 'Preparing preview' }}
        </strong>
        
        <button class="watch-button" @click="reset">Done</button>
      </div>
    </template>
    <template v-else>
      <button class="watch-button fan-toggle" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Stack cards' : 'Show cards & passes' }}</button>
      <div class="card-fan" :class="{ expanded }">
      
      <button
        v-for="item in cards"
        :key="item.id"
        class="card stack"
        :style="{ '--card': item.color, '--shade': item.secondary }"
        @click="expanded ? selected = item.id : expanded = true"
      >
        <div class="card-top">
          <span>
            {{ item.name }}
          </span>
          <b>
            <WatchGlyph :name="item.id === 1 ? 'coins' : item.id === 2 ? 'airplane' : 'coffee'" />
          </b>
        </div>
        <span class="kind">
          {{ item.kind }}
        </span>
        <span class="number">
          {{ item.number }}
        </span>
      </button>
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
  margin: 0 0 20px;
}

.back {
  min-height: 72px;
  border: 0;
  background: none;
  color: #ffd66c;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  padding: 0;
}

.card {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #ffffff35;
  border-radius: 26px;
  background: radial-gradient(ellipse at top right,#ffffff40,transparent 60%),linear-gradient(130deg,var(--card),var(--shade));
  color: white;
  text-shadow: 0 1px 2px #0005;
  position: relative;
  overflow: hidden;
  text-align: left;
  padding: 24px;
  box-shadow: 0 5px 12px #0008;
}

.card:after {
  content: '';
  position: absolute;
  width: 210px;
  height: 210px;
  border: 1px solid #ffffff20;
  border-radius: 50%;
  right: -80px;
  top: 20px;
  pointer-events: none;
}

.stack {
  height: 162px;
  margin-bottom: 15px;
}

.selected {
  height: 220px;
  margin: 12px 0 24px;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  font-weight: 650;
}

.card-top b {
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.kind {
  display: block;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  letter-spacing: 2px;
  margin-top: 5px;
}

.number {
  position: absolute;
  bottom: 23px;
  left: 24px;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  letter-spacing: 1px;
}

.chip {
  width: 44px;
  height: 34px;
  border: 2px solid #ddd2a9;
  border-radius: 7px;
  background: #e2cd85;
  margin-top: 20px;
  display: flex;
}

.chip i {
  flex: 1;
  border-right: 1px solid #ad9155;
}

.boarding {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 22px;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
}

.stamps {
  display: flex;
  gap: 14px;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  margin-top: 20px;
}

.gold {
  color: #ffe4a4;
  background: #54411a;
}

.payment {
  text-align: center;
}

.payment strong {
  display: block;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  margin: 14px 0;
}

.scan {
  width: 86px;
  height: 86px;
  margin: 0 auto;
  border: 3px solid #ffd66c;
  border-radius: 50%;
  color: #ffd66c;
  display: grid;
  place-items: center;
  font-size: max(18px, calc(44px * var(--text-size, 1)));
  animation: pulse 1s infinite alternate;
}

.scan.ready {
  border-color: #30d158;
  color: #30d158;
  animation: none;
}

.still .scan {
  animation: none;
}

@keyframes pulse {
  to {
    transform: scale(1.06);
    opacity: 0.65;
  }
}

.stack {
  height: 140px;
  margin-bottom: 12px;
}

.card {
  padding: 18px;
}

.card-top {
  gap: 10px;
}

.kind {
  font-size: 21px;
  letter-spacing: 0.8px;
}

.number {
  font-size: 21px;
  left: 18px;
  bottom: 18px;
}

.scan :deep(svg) {
  width: 42px;
  height: 42px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FFD66C; }

.card-fan { padding-top:10px; }
.card-fan .card { aspect-ratio:16 / 10; height:auto; min-height:236px; display:flex; flex-direction:column; gap:8px; padding:18px 20px; border-radius:30px; margin-bottom:0; transition:margin 160ms ease, transform 160ms ease; }
.card-fan .card + .card { margin-top:-148px; }
.card-fan.expanded .card + .card { margin-top:10px; }
.card.selected { aspect-ratio:16 / 10; height:auto; min-height:236px; display:flex; flex-direction:column; gap:8px; margin:10px 0 20px; }
.card-top { align-items:flex-start; min-height:32px; font-size:25px; line-height:1.25; }
.card-top span { flex:1; min-width:0; }
.card-top b { flex:0 0 28px; }
.card-top b :deep(svg) { width:28px; height:28px; }
.card .kind { font-size:18px; line-height:1.25; letter-spacing:.6px; margin:0; }
.card .number { position:static; display:block; margin-top:auto; font-size:20px; letter-spacing:0; line-height:1.25; overflow-wrap:anywhere; }
.card .boarding, .card .stamps, .card .chip { margin:4px 0; }
.fan-toggle { width:100%; color:var(--app-accent); }
.payment { padding:16px 0; }
.payment .watch-button { width:100%; }

.stamps svg { width:24px; height:24px; }
</style>
