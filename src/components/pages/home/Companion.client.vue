<script setup lang="ts">
import { HomeExperience } from "~/experiences/home";
import {
  initialCompanionState,
  type CompanionState,
} from "~/common/models/companion.model";
const state = useState<CompanionState>("labCompanion", initialCompanionState);
const route = useRoute();
const ready = useState<boolean>("isExperienceReady");
const robot = () => new HomeExperience().world?.scene1?.companion;
const close = () => {
  state.value.panel = false;
};
watch(() => route.path, close);
</script>
<template>
  <div
    v-if="route.path === '/' && ready"
    class="companion-ui"
    @pointerdown.stop
    @pointerup.stop
    @pointermove.stop
    @mousedown.stop
    @mouseup.stop
    @mousemove.stop
    @wheel.stop
    @touchstart.stop
    @touchmove.stop
    @keydown.esc="close"
  >
    <Transition name="robot-caption"
      ><p v-if="state.caption" class="robot-caption" role="status">
        <span>WALL·E</span>{{ state.caption }}
      </p></Transition
    >
    <nav
      v-if="state.panel"
      class="robot-menu"
      aria-label="WALL-E companion controls"
    >
      <button :disabled="!state.ready" @click="robot()?.greet()">
        Say hello <span aria-hidden="true">↗</span>
      </button>
      <button :disabled="!state.ready" @click="robot()?.dock()">
        Back to dock <span aria-hidden="true">↙</span>
      </button>
      <button :disabled="!state.ready" @click="robot()?.togglePlant()" :aria-expanded="state.plantOpen">
        {{ state.plantOpen ? 'Close hatch' : 'A little green hope' }} <span aria-hidden="true">✳</span>
      </button>
      <button @click="close" aria-label="Close WALL-E controls">×</button>
    </nav>
    <button
      class="robot-toggle"
      @click="state.panel = !state.panel"
      :aria-expanded="state.panel"
      aria-label="WALL-E companion"
      title="WALL-E companion"
    >
      <svg
        viewBox="0 0 34 22"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      >
        <path
          d="M3 3Q9 0 16 6L14 14Q7 18 2 12ZM31 3Q25 0 18 6L20 14Q27 18 32 12Z"
        />
        <circle cx="9" cy="9" r="3" />
        <circle cx="25" cy="9" r="3" />
        <path d="M14 17h6v4h-6z" /></svg
      ><span>WALL·E</span>
    </button>
  </div>
</template>
<style scoped>
.companion-ui {
  position: fixed;
  z-index: 32;
  left: clamp(18px, 4vw, 64px);
  bottom: 84px;
  color: #fff6de;
  pointer-events: auto;
  text-shadow:
    0 1px 4px #000,
    0 2px 16px #000b;
}
.robot-caption {
  max-width: 300px;
  font-size: clamp(16px, 2vw, 20px);
  line-height: 1.45;
  margin: 0 0 12px;
  letter-spacing: -0.025em;
}
.robot-caption span {
  display: block;
  color: #d2bd94;
  font: 9px/2 monospace;
  letter-spacing: 0.16em;
}
.robot-menu {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
}
.robot-menu button {
  font-size: 12px;
  min-height: 44px;
  border-bottom: 1px solid #d2bd9466;
}
.robot-menu button span {
  padding-left: 3px;
  color: #d2bd94;
}
.robot-menu button:last-child {
  border: 0;
  font-size: 22px;
  padding: 0 10px;
}
.robot-toggle {
  display: flex;
  gap: 9px;
  align-items: center;
  color: #d2bd94;
  font: 10px monospace;
  letter-spacing: 0.12em;
  padding: 10px 0;
}
.robot-toggle svg {
  width: 30px;
  height: 23px;
}
button {
  transition: opacity 0.16s;
}
button:hover {
  color: #fff;
}
button:focus-visible {
  outline: 2px solid #d2bd94;
  outline-offset: 4px;
}
button:disabled {
  opacity: 0.4;
}
.robot-caption-enter-active,
.robot-caption-leave-active {
  transition:
    opacity 0.22s,
    transform 0.22s;
}
.robot-caption-enter-from,
.robot-caption-leave-to {
  opacity: 0;
  transform: translateY(5px);
}
@media (max-width: 600px) {
  .companion-ui {
    bottom: 112px;
    left: 17px;
  }
  .robot-caption {
    max-width: 260px;
  }
  .robot-menu {
    gap: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .robot-caption-enter-active,
  .robot-caption-leave-active {
    transition: none;
  }
}
</style>
