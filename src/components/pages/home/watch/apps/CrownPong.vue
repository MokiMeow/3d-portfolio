<script setup lang="ts">
import { clamp, useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const visible = ref(false);
const playing = ref(false);
const player = ref(180);
const opponent = ref(180);
const ball = reactive({ x: 180, y: 115, vx: 75, vy: 135 });
const you = ref(0);
const ai = ref(0);
const level = ref(1);
const rally = ref(0);
const message = ref('Your wrist. Your court.');
let frame = 0;
let lastFrame = 0;
const running = computed(() => visible.value && playing.value && !watch.dimmed.value && watch.activeApp.value === 'crownPong');
function move(delta: number) {
  player.value = clamp(player.value + delta, 48, 312);
}
useWatchHardware('crownPong', {
  crown: (delta) => {
    move(delta * 13);
    return true;
  }, action: () => {
    toggle();
    return true;
  }
});
function serve(towardPlayer = true) {
  ball.x = 180;
  ball.y = 115;
  ball.vx = (Math.random() < .5 ? -1 : 1) * (65 + level.value * 8);
  ball.vy = (towardPlayer ? 1 : -1) * (130 + Math.min(level.value, 6) * 12);
  rally.value = 0;
}
function toggle() {
  if (ai.value >= 5) {
    ai.value = 0;
    you.value = 0;
    level.value = 1;
    serve();
  }
  playing.value = !playing.value;
  message.value = playing.value ? 'Crown or drag to move' : 'Paused';
}
function score(visitor: boolean) {
  if (visitor) {
    you.value++;
    watch.fun.pongBest = Math.max(watch.fun.pongBest, you.value);
    watch.haptic('success');
    if (you.value % 5 === 0) {
      level.value++;
      ai.value = 0;
      message.value = 'Level ' + level.value + ' · faster wrist';
    }
    else
      message.value = 'Point to you!';
  }
  else {
    ai.value++;
    watch.haptic('tick');
    message.value = ai.value >= 5 ? 'The wrist wins. Rematch?' : 'Point to the wrist';
  }
  if (ai.value >= 5)
    playing.value = false;
  serve(!visitor);
}
function tick(timestamp: number) {
  if (!running.value) {
    frame = 0;
    lastFrame = 0;
    return;
  }
  const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, .035) : 0;
  lastFrame = timestamp;
  const dt = delta * (watch.reducedMotion.value ? .55 : 1);
  const aiSpeed = 75 + Math.min(level.value, 7) * 17;
  opponent.value = clamp(opponent.value + clamp(ball.x - opponent.value, -aiSpeed * dt, aiSpeed * dt), 38, 322);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.x < 7 || ball.x > 353) {
    ball.x = clamp(ball.x, 7, 353);
    ball.vx *= -1;
  }
  if (ball.vy < 0 && ball.y <= 25) {
    if (Math.abs(ball.x - opponent.value) <= 44) {
      ball.y = 25;
      ball.vy = Math.abs(ball.vy);
      ball.vx += (ball.x - opponent.value) * 1.2;
    }
    else if (ball.y < 7)
      score(true);
  }
  if (ball.vy > 0 && ball.y >= 205) {
    if (Math.abs(ball.x - player.value) <= 54) {
      ball.y = 205;
      ball.vy = -Math.min(270, Math.abs(ball.vy) + 8);
      ball.vx = clamp(ball.vx + (ball.x - player.value) * 2, -210, 210);
      rally.value++;
      watch.haptic('tick');
    }
    else if (ball.y > 223)
      score(false);
  }
  if (running.value)
    frame = requestAnimationFrame(tick);
}
function stopFrame() {
  if (frame)
    cancelAnimationFrame(frame);
  frame = 0;
  lastFrame = 0;
}
watchEffect(() => {
  if (running.value) {
    if (!frame)
      frame = requestAnimationFrame(tick);
  }
  else
    stopFrame();
});
function drag(event: PointerEvent) {
  const court = event.currentTarget as HTMLElement;
  if (event.type === 'pointerdown')
    court.setPointerCapture(event.pointerId);
  if (event.type === 'pointermove' && !court.hasPointerCapture(event.pointerId))
    return;
  const rect = court.getBoundingClientRect();
  player.value = clamp((event.clientX - rect.left) / rect.width * 360, 48, 312);
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    event.stopPropagation();
    move(event.key === 'ArrowLeft' ? -22 : 22);
  }
}
onMounted(() => {
  visible.value = true;
});
onActivated(() => {
  visible.value = true;
});
onDeactivated(() => {
  visible.value = false;
  stopFrame();
});
onBeforeUnmount(() => {
  visible.value = false;
  stopFrame();
});
</script>

<template>
  <section class="watch-app pong-app">
    <h1>Crown Pong</h1>
    <div class="scores">
      <div>
        <span class="caption muted">WRIST</span>
        <strong>
          {{ ai }}
        </strong>
      </div>
      <span class="level">
        LV
        {{ level }}
      </span>
      <div>
        <span class="caption">YOU</span>
        <strong>
          {{ you }}
        </strong>
      </div>
    </div>
    <div
      class="court"
      tabindex="0"
      role="application"
      aria-label="Pong court. Drag your paddle, turn the crown, or use left and right arrow keys."
      @pointerdown.prevent.stop="drag"
      @pointermove.prevent.stop="drag"
      @keydown="keyboard"
    >
      <svg viewBox="0 0 360 230" aria-hidden="true">
        <path d="M0 115h360" class="midline" />
        <rect
          :transform="'translate(' + (opponent - 36) + ' 0)'"
          y="13"
          width="72"
          height="10"
          rx="5"
          class="opponent"
        />
        <rect
          :transform="'translate(' + (player - 48) + ' 0)'"
          y="207"
          width="96"
          height="10"
          rx="5"
          class="player"
        />
        <circle
          :transform="'translate(' + ball.x + ' ' + ball.y + ')'"
          r="7"
          class="ball"
        />
      </svg>
      <div v-if="!playing" class="court-label">
        {{ ai >= 5 ? 'GAME OVER' : 'READY?' }}
      </div>
    </div>
    <p class="caption status" aria-live="polite">
      {{ message }}
    </p>
    <button class="watch-button primary" @click="toggle">
      {{ ai >= 5 ? 'Rematch' : playing ? 'Pause' : you || ai ? 'Resume' : 'Play' }}
    </button>
    <p class="caption muted footer">
      Best
      {{ watch.fun.pongBest }}
      · Rally
      {{ rally }}
      <br />
      {{ watch.reducedMotion.value ? 'Gentle speed · ' : '' }}
      Crown, drag, or ← →
    </p>
  </section>
</template>

<style scoped>
.pong-app {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;
}

.pong-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  margin: 0 0 10px;
}

.scores {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 12px;
}

.scores>div {
  text-align: center;
  display: flex;
  flex-direction: column;
}

.scores>div:last-child {
  color: #b6f31b;
}

.scores strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(34px * var(--text-size, 1)));
  line-height: 1.1;
}

.scores .caption {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  letter-spacing: 2px;
}

.level {
  background: #242426;
  border-radius: 20px;
  padding: 8px 15px;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
  color: #aeaeB2;
}

.court {
  position: relative;
  width: 100%;
  border: 2px solid #3a3a3c;
  border-radius: 24px;
  background: linear-gradient(#10151b,#12190d);
  touch-action: none;
  overflow: hidden;
  cursor: ew-resize;
}

.court svg {
  display: block;
  width: 100%;
}

.midline {
  stroke: #ffffff25;
  stroke-dasharray: 8 9;
  stroke-width: 2;
}

.opponent {
  fill: #f5f5f7;
}

.player {
  fill: #b6f31b;
}

.ball {
  fill: white;
}

.court-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  font-weight: 800;
  letter-spacing: 4px;
  color: #ffffffa0;
  pointer-events: none;
}

.court:focus-visible {
  outline: 4px solid #b6f31b;
  outline-offset: 3px;
}

.status {
  margin: 13px 0;
  text-align: center;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  min-height: 29px;
}

.primary {
  background: #b6f31b;
  color: black;
  font-weight: 700;
}

.footer {
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
  text-align: center;
  line-height: 1.6;
  margin: 13px 0 0;
}

.court {
  max-width: 320px;
  margin: auto;
}

.status {
  margin: 8px 0;
}

.footer {
  line-height: 1.35;
}
</style>
