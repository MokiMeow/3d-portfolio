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
    <div
      v-if="state.panel"
      class="robot-menu"
      aria-label="WALL-E companion controls"
    >
      <p>
        A LITTLE COMPANY<button
          @click="close"
          aria-label="Close WALL-E controls"
        >
          ×
        </button>
      </p>
      <div>
        <button :disabled="!state.ready" @click="robot()?.greet()">
          Say hello ↗</button
        ><button :disabled="!state.ready" @click="robot()?.dock()">
          Back to dock ⤓</button
        ><button
          :disabled="!state.ready"
          @click="new HomeExperience().world?.scene1?.focusCompanion()"
        >
          Look closer ⌕
        </button>
      </div>
      <small>{{
        state.failed
          ? "Could not load the robot. Reload to try again."
          : !state.ready
            ? "Arriving…"
            : state.phase === "docked"
              ? "Charging. Keeping you company."
              : "Your room. Your pace."
      }}</small>
    </div>
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
  color: #ded8c9;
  pointer-events: auto;
}
.robot-toggle {
  display: flex;
  gap: 9px;
  align-items: center;
  color: #c8b899;
  font: 10px monospace;
  letter-spacing: 0.12em;
  padding: 10px 0;
}
.robot-toggle svg {
  width: 30px;
  height: 23px;
}
.robot-caption {
  max-width: 280px;
  font-size: 13px;
  line-height: 1.5;
  padding: 13px 17px;
  background: #23261fed;
  border: 1px solid #c8b89940;
  border-radius: 14px 14px 14px 3px;
  box-shadow: 0 5px 26px #0003;
  margin-bottom: 8px;
}
.robot-caption span {
  display: block;
  color: #baa77e;
  font: 9px monospace;
  letter-spacing: 0.12em;
  margin-bottom: 5px;
}
.robot-menu {
  width: min(290px, calc(100vw - 36px));
  padding: 16px;
  background: #252721;
  border: 1px solid #c8b89940;
  border-radius: 14px;
}
.robot-menu p {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font: 9px monospace;
  letter-spacing: 0.13em;
  color: #bda982;
}
.robot-menu p button {
  font-size: 21px;
  padding: 0 5px;
}
.robot-menu > div {
  display: flex;
  flex-direction: column;
  margin-top: 9px;
}
.robot-menu > div button {
  text-align: left;
  font-size: 13px;
  padding: 10px 0;
  border-bottom: 1px solid #ffffff12;
}
.robot-menu small {
  display: block;
  font-size: 10px;
  color: #a5a697;
  margin-top: 13px;
}
button {
  transition:
    transform 0.16s,
    opacity 0.16s;
}
button:hover {
  color: #fff;
}
button:active {
  transform: scale(0.97);
}
button:focus-visible {
  outline: 2px solid #cdb282;
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
    max-width: 240px;
  }
  .robot-toggle {
    padding: 4px 0;
  }
  .robot-toggle span {
    font-size: 9px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .robot-caption-enter-active,
  .robot-caption-leave-active {
    transition: none;
  }
}
</style>
