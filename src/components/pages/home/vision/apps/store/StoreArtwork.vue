<script setup lang="ts">
import type { StoreApp } from './catalog';
import StoreIcon from './StoreIcon.vue';
const props = defineProps<{ app: StoreApp; scene?: number; editorial?: boolean }>();
const mode = computed(() => props.app.headsetId ? 'headset' : props.app.arcade ? 'garden' : props.app.id);
const sceneTitle = computed(() => ['A little more room', 'Make it your own', 'A quieter moment'][props.scene ?? 0] ?? 'A little more room');
</script>

<template>
  <div class="store-art" :class="[mode, { editorial }]" :style="{ '--art-color': app.color }" aria-hidden="true">
    <div class="art-halo" />
    <template v-if="mode === 'tabs'">
      <div class="tab-stack" :class="'scene-' + (scene ?? 0)">
        <div v-for="n in 4" :key="n" class="little-window" :style="{ '--n': n }">
          <div class="dots"><i /><i /><i /></div>
          <div class="mini-block" /><div class="mini-line" /><div class="mini-line short" />
          <span>{{ ['Research', 'Definitely later', 'One more idea', 'The actual task'][n - 1] }}</span>
        </div>
      </div>
    </template>
    <template v-else-if="mode === 'chai'">
      <svg class="cup" viewBox="0 0 240 200">
        <ellipse cx="124" cy="178" rx="79" ry="10" fill="#191512" opacity=".3" />
        <path d="M63 68h112l-15 95H80z" fill="#e8d8b7" />
        <path d="M71 88h95l-12 67H85z" fill="#a66a3d" />
        <path d="M178 83q50-4 32 36l-40 13" fill="none" stroke="#e8d8b7" stroke-width="11" />
        <path d="M89 48q-14-15 0-29m31 29q-14-15 0-29m31 29q-14-15 0-29"
          fill="none" stroke="#f9ead0" stroke-width="4" stroke-linecap="round" />
        <ellipse cx="119" cy="67" rx="56" ry="8" fill="#f4e4c3" />
        <ellipse cx="119" cy="67" rx="47" ry="5" fill="#b78051" />
      </svg>
      <div v-if="!editorial" class="timer-platter"><strong>{{ scene === 1 ? 'Tea, then tabs.' : '03:00' }}</strong><span>Take your time.</span></div>
    </template>
    <template v-else-if="mode === 'duck'">
      <svg class="duck-art" viewBox="0 0 280 220">
        <ellipse cx="142" cy="183" rx="78" ry="12" fill="#1c201b" opacity=".3" />
        <path d="M65 128q-22-18-25-40 44 2 57 21 2-58 46-58 52 0 49 46l32 10-37 13q-2 55-72 58-58 0-50-50z"
          fill="#f6d77a" stroke="#c79d45" stroke-width="3" />
        <path d="M112 122q-25 12-18 31 35 13 57-10" fill="#e8bc55" />
        <circle cx="169" cy="82" r="5" fill="#31322c" /><circle cx="170" cy="80" r="1.5" fill="white" />
        <path d="M192 96l31 11-36 10" fill="#dd9e57" />
      </svg>
      <div class="timer-platter"><strong>{{ scene === 1 ? 'Quack.' : 'I am listening.' }}</strong><span>No unsolicited advice.</span></div>
    </template>
    <template v-else-if="mode === 'garden'">
      <div class="garden-ground" />
      <div v-for="n in 7" :key="n" class="plant" :style="{ '--n': n }"><i /><i /><i /></div>
      <div class="game-sun" />
      <div class="game-tag">{{ app.id === 'bug' ? 'A wild edge case appears.' : app.id === 'commute' ? 'Arrival: eventually.' : 'Room to grow.' }}</div>
      <svg v-if="app.id === 'bug'" class="game-creature" viewBox="0 0 38 38" fill="none">
        <path :d="app.path" stroke="#d1f1be" stroke-width="2" stroke-linecap="round" />
      </svg>
      <svg v-if="app.id === 'commute'" class="game-creature car" viewBox="0 0 38 38" fill="none">
        <path :d="app.path" stroke="#f5dfc0" stroke-width="2" stroke-linecap="round" />
      </svg>
    </template>
    <template v-else-if="mode === 'focus'">
      <div class="focus-ring"><div /><span>{{ scene === 1 ? 'Just this.' : 'Breathe.' }}</span></div>
      <p class="art-caption">One thought at a time.</p>
    </template>
    <template v-else>
      <div class="concept-window">
        <div class="dots"><i /><i /><i /></div>
        <StoreIcon :app="app" />
        <strong>{{ app.headsetId ? app.name : sceneTitle }}</strong>
        <div class="mini-line" /><div class="mini-line short" />
        <div class="concept-row"><i /><span>{{ app.id === 'standup' ? 'Yesterday: a worthy attempt.' : 'A little more space.' }}</span></div>
        <div class="concept-row"><i /><span>{{ app.id === 'standup' ? 'Today: another worthy attempt.' : 'Everything in its place.' }}</span></div>
      </div>
    </template>
    <span v-if="!editorial" class="screen-label">{{ sceneTitle }} · Concept screen</span>
  </div>
</template>

<style scoped>
.store-art {
  box-sizing: border-box;
  width: 100%;
  height: 280px;
  container-type: inline-size;
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  color: #f6f7f4;
  background: radial-gradient(ellipse at 50% 20%, color-mix(in srgb, var(--art-color), #172331 45%), #182330 90%);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
}

.store-art :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

.art-halo {
  position: absolute;
  inset: 15% 15% 0;
  border-radius: 50%;
  background: rgb(255 255 255 / .04);
}

.editorial {
  height: 210px;
  background: transparent;
  border-radius: 0;
}

.screen-label {
  position: absolute;
  bottom: 14px;
  left: 18px;
  right: 18px;
  font-size: 12px;
  color: rgb(255 255 255 / .85);
  text-align: center;
}

.tab-stack {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 190px;
  height: 160px;
  transform: translate(-50%, -48%);
}

.little-window {
  position: absolute;
  inset: 0;
  padding: 15px;
  border-radius: 19px;
  background: linear-gradient(120deg, rgb(214 240 248 / .27), rgb(182 214 227 / .12));
  border: 1px solid rgb(240 250 255 / .3);
  box-shadow: 0 8px 24px rgb(0 0 0 / .2);
  transform: translate(calc((var(--n) - 2) * 17px), calc((var(--n) - 2) * -8px)) rotate(calc((var(--n) - 2) * 9deg));
}

.scene-1 .little-window {
  transform: translate(calc((var(--n) - 2) * 35px), calc((var(--n) - 2) * -8px));
}

.scene-2 .little-window {
  transform: translate(calc((var(--n) - 2) * 9px), calc((var(--n) - 2) * -14px));
}

.little-window span {
  width: max-content;
  max-width: 100%;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgb(18 39 49 / .7);
  font-size: 12px;
  display: block;
  margin-top: 9px;
  color: #fff;
}

.dots {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgb(255 255 255 / .6);
}

.mini-block {
  height: 38px;
  background: rgb(167 222 239 / .4);
  border-radius: 7px;
}

.mini-line {
  height: 5px;
  margin-top: 10px;
  border-radius: 3px;
  background: rgb(242 253 255 / .3);
}

.mini-line.short {
  width: 66%;
}

.cup {
  position: absolute;
  width: 230px;
  height: 200px;
  top: 8px;
  left: calc(50% - 115px);
  transform: rotate(5deg);
}

.duck-art {
  position: absolute;
  width: 250px;
  height: 190px;
  left: calc(50% - 125px);
  top: 3px;
}

.timer-platter {
  position: absolute;
  bottom: 46px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  width: calc(100% - 32px);
}

.timer-platter strong {
  display: block;
  font-size: 25px;
  letter-spacing: -.04em;
}

.timer-platter span {
  display: block;
  font-size: 13px;
  margin-top: 3px;
  color: rgb(255 255 255 / .8);
}

.garden-ground {
  position: absolute;
  inset: 52% -10% -20%;
  border-radius: 50% 50% 0 0;
  background: #254b44;
  transform: rotate(-5deg);
}

.plant {
  position: absolute;
  left: calc(var(--n) * 12%);
  bottom: 53px;
  width: 5px;
  height: calc(30px + var(--n) * 9px);
  background: #9dc596;
}

.plant i {
  position: absolute;
  width: 27px;
  height: 13px;
  background: #86b389;
  border-radius: 90% 0 90% 0;
  top: 16%;
  right: 2px;
}

.plant i:nth-child(2) {
  top: 37%;
  right: auto;
  left: 3px;
  transform: scaleX(-1);
}

.plant i:nth-child(3) {
  top: 67%;
}

.game-sun {
  position: absolute;
  width: 42px;
  height: 42px;
  top: 22px;
  right: 30px;
  background: #ead9a6;
  border-radius: 50%;
}

.game-tag {
  position: absolute;
  top: 28px;
  left: 20px;
  max-width: 60%;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -.03em;
}

.game-creature {
  position: absolute;
  bottom: 57px;
  left: 45%;
  width: 75px;
  height: 75px;
  transform: rotate(-8deg);
}

.game-creature.car {
  width: 115px;
  height: 115px;
  bottom: 45px;
}

.focus-ring {
  position: absolute;
  left: calc(50% - 76px);
  top: 30px;
  width: 152px;
  height: 152px;
  border: 1px solid #c8d8eb;
  border-radius: 50%;
}

.focus-ring > div {
  position: absolute;
  inset: 16px;
  border: 18px solid rgb(192 216 238 / .19);
  border-radius: 50%;
}

.focus-ring span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 21px;
}

.art-caption {
  position: absolute;
  bottom: 48px;
  width: 100%;
  text-align: center;
  font-size: 14px;
}

.concept-window {
  position: absolute;
  width: 230px;
  top: 20px;
  left: calc(50% - 115px);
  border-radius: 23px;
  padding: 15px;
  background: rgb(255 255 255 / .12);
}

.concept-window :deep(.store-icon) {
  width: 40px;
  height: 40px;
  float: left;
  margin: 0 10px 6px 0;
  border-radius: 12px;
}

.concept-window :deep(.store-icon svg) {
  width: 26px;
  height: 26px;
}

.concept-window strong {
  font-size: 17px;
  display: block;
  min-height: 40px;
  padding-top: 7px;
}

.concept-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
}

.concept-row i {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgb(255 255 255 / .3);
  flex: none;
}

@container (max-width: 300px) {
  .tab-stack {
    transform: translate(-50%, -48%) scale(.78);
  }
  .scene-1 .little-window {
    transform: translate(calc((var(--n) - 2) * 18px), calc((var(--n) - 2) * -8px));
  }
  .concept-window {
    width: calc(100% - 32px);
    left: 16px;
  }
  .cup {
    width: 200px;
    height: 174px;
    left: calc(50% - 100px);
  }
  .duck-art {
    width: 210px;
    height: 165px;
    left: calc(50% - 105px);
  }
  .game-tag {
    font-size: 19px;
  }
}
</style>
