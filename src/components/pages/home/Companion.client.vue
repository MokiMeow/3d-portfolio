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
// The tour moves the camera, so the menu steps out of the way first.
const tour = () => {
  state.value.panel = false;
  new HomeExperience().world?.scene1?.startTour();
};
const close = () => {
  state.value.panel = false;
};
watch(() => route.path, close);
function togglePanel(){
 document.querySelectorAll<HTMLDetailsElement>('.lab-footer details[open]').forEach(menu=>menu.open=false);
 state.value.panel=!state.value.panel;
}
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
    <Transition name="robot-card">
    <nav
      v-if="state.panel"
      class="robot-menu"
      aria-label="WALL-E companion controls"
    >
      <header>
        <b>WALL·E</b>
        <small>{{ state.ready ? 'At your service' : 'Warming up…' }}</small>
        <button class="robot-close" @click="close" aria-label="Close WALL-E controls">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8" /></svg>
        </button>
      </header>
      <div class="robot-actions">
        <button class="wide" :disabled="!state.ready" @click="tour()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          <span><b>Show me around</b><small>A short guided tour</small></span>
        </button>
        <button :disabled="!state.ready" @click="robot()?.greet()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5V5a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-12.4 4.4L3.4 15a1.6 1.6 0 0 1 2.4-2.1L8 15" /></svg>
          <span>Say hello</span>
        </button>
        <button :disabled="!state.ready" @click="robot()?.dance()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>
          <span>Dance</span>
        </button>
        <button :disabled="!state.ready" @click="robot()?.compact()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9" /></svg>
          <span>Make a cube</span>
        </button>
        <button :disabled="!state.ready" @click="robot()?.togglePlant()" :aria-expanded="state.plantOpen">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-9m0 0C12 7 8.5 4 4 4c0 4.5 3.5 8 8 8Zm0 0c0-4 3-7 7-7 0 4-3 7-7 7" /></svg>
          <span>{{ state.plantOpen ? 'Close hatch' : 'The plant' }}</span>
        </button>
        <button :disabled="!state.ready" @click="robot()?.dock()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M7 20v-6h10v6M9 14V9l3-3 3 3v5" /></svg>
          <span>Back to dock</span>
        </button>
      </div>
    </nav>
    </Transition>
    <button
      class="robot-toggle"
      @click="togglePanel"
      :aria-expanded="state.panel"
      aria-label="WALL-E companion"
      title="WALL-E companion"
    >
      <svg viewBox="0 0 44 34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <!-- WALL-E: two tilted binocular eyes on a thin neck, over the boxy body and its treads. -->
        <g transform="rotate(-9 11.500 11)">
          <path d="M20.800 12.400C20.300 6.600 15.800 2.700 10.300 3 5.300 3.300 1.900 7.100 2.300 11.500c.4 4.600 4.400 7.500 9.200 6.900 4.100-.5 8.100-2.500 9.300-6Z" />
          <circle cx="11" cy="10.900" r="4.500" />
          <circle cx="11" cy="10.900" r="1.900" fill="currentColor" stroke="none" />
        </g>
        <g transform="rotate(9 32.500 11)">
          <path d="M23.200 12.400C23.700 6.600 28.200 2.700 33.700 3c5 .3 8.400 4.100 8 8.500-.4 4.600-4.400 7.500-9.200 6.900-4.100-.5-8.100-2.500-9.300-6Z" />
          <circle cx="33" cy="10.900" r="4.500" />
          <circle cx="33" cy="10.900" r="1.900" fill="currentColor" stroke="none" />
        </g>
        <path d="M20.600 13.200h2.800M22 14.600v6" />
        <path d="M18.200 20.600h7.600l1.400 2.800H16.800Z" />
        <path d="M13 23.400h18v6.800a1.300 1.300 0 0 1-1.300 1.300H14.300a1.300 1.300 0 0 1-1.300-1.300Z" />
        <path d="M7.200 26.200 10 23.600h3v8H7.600a1.600 1.600 0 0 1-1.500-2.200ZM36.800 26.200 34 23.600h-3v8h5.400a1.600 1.600 0 0 0 1.500-2.200Z" />
        <path d="M17.500 27.400h4.200M25 27.400h2" opacity=".75" /></svg
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
/* The companion's controls: a small warm glass card, icon tiles in a grid. */
.robot-menu {
  width: min(330px, calc(100vw - 32px));
  margin-bottom: 12px;
  padding: 14px;
  border-radius: 22px;
  background: linear-gradient(160deg, #3a332bde, #1f1c19eb);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
  box-shadow: inset 0 1px 0 #ffffff1c, inset 0 0 0 1px #d2bd9426, 0 24px 60px #000a;
  text-shadow: none;
}
.robot-menu header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: 2px 4px 12px;
}
.robot-menu header b {
  font: 600 11px/1.2 monospace;
  letter-spacing: 0.18em;
  color: #d2bd94;
}
.robot-menu header small {
  grid-row: 2;
  font-size: 13px;
  color: #fff6dea6;
  margin-top: 2px;
}
.robot-close {
  grid-row: 1 / 3;
  grid-column: 2;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #ffffff12;
}
.robot-close svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}
.robot-close:hover {
  background: #ffffff24;
}
.robot-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.robot-actions button {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 7px;
  min-height: 76px;
  padding: 10px 6px;
  border-radius: 16px;
  background: #ffffff0d;
  box-shadow: inset 0 0 0 1px #ffffff0f;
  font-size: 12px;
  line-height: 1.2;
  color: #fff6de;
  transition: background 0.16s, transform 0.16s;
}
.robot-actions button:hover:not(:disabled) {
  background: #d2bd9426;
  transform: translateY(-2px);
}
.robot-actions button:active:not(:disabled) {
  transform: scale(0.97);
}
.robot-actions svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: #d2bd94;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.robot-actions .wide {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  min-height: 58px;
  padding: 10px 14px;
  text-align: left;
  background: linear-gradient(120deg, #d2bd9433, #d2bd9414);
}
.robot-actions .wide span {
  display: grid;
  gap: 2px;
}
.robot-actions .wide b {
  font-size: 14px;
  font-weight: 600;
}
.robot-actions .wide small {
  font-size: 12px;
  color: #fff6de99;
}
.robot-card-enter-active,
.robot-card-leave-active {
  transition: opacity 0.22s, transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}
.robot-card-enter-from,
.robot-card-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.97);
  transform-origin: bottom left;
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
  width: 34px;
  height: 26px;
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
    width: calc(100vw - 34px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .robot-caption-enter-active,
  .robot-caption-leave-active {
    transition: none;
  }
}

@media(max-width:639px),(max-height:500px) and (max-width:1023px){
 .companion-ui{bottom:calc(82px + env(safe-area-inset-bottom));left:max(16px,env(safe-area-inset-left));right:max(16px,env(safe-area-inset-right));pointer-events:none;}
 .robot-toggle,.robot-menu{pointer-events:auto;}
 .robot-toggle{min-height:44px;}
 .robot-menu{width:100%;padding:12px;max-height:calc(var(--visual-height,100dvh) - 180px);overflow:auto;}
 .robot-actions button{min-height:68px;}
 .robot-caption{max-width:calc(100vw - 48px);font-size:16px;}
}
@media(max-height:500px) and (min-width:640px){.companion-ui{bottom:calc(64px + env(safe-area-inset-bottom));}.robot-menu{max-height:calc(100dvh - 120px);overflow:auto;}}
</style>
