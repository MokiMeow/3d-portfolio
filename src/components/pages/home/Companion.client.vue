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
    <nav
      v-if="state.panel"
      class="robot-menu"
      aria-label="WALL-E companion controls"
    >
      <button :disabled="!state.ready" @click="tour()">
        Show me around <span aria-hidden="true">→</span>
      </button>
      <button :disabled="!state.ready" @click="robot()?.greet()">
        Say hello <span aria-hidden="true">↗</span>
      </button>
      <button :disabled="!state.ready" @click="robot()?.dance()">
        Dance <span aria-hidden="true">♪</span>
      </button>
      <button :disabled="!state.ready" @click="robot()?.compact()">
        Make a cube <span aria-hidden="true">▣</span>
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
    gap: 14px;
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
 .robot-menu{width:100%;gap:4px 18px;padding:6px 12px;background:#191b1bea;border-top:1px solid #d2bd9440;max-height:calc(var(--visual-height,100dvh) - 180px);overflow:auto;}
 .robot-menu button{font-size:12px;}
 .robot-caption{max-width:calc(100vw - 48px);font-size:16px;}
}
@media(max-height:500px) and (min-width:640px){.companion-ui{bottom:calc(64px + env(safe-area-inset-bottom));}.robot-menu{width:max-content;max-width:100%;}}
</style>
