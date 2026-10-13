<script setup lang="ts">
import { HomeExperience } from "~/experiences/home";
import {
  initialAtelierState,
  type AtelierAction,
  type AtelierState,
  type AtelierView,
} from "~/common/models/atelier.model";
import {
  ATELIER_PALETTES,
  ATELIER_STUDIES,
} from "~/experiences/home/world/atelier-art";

const route = useRoute();
const ready = useState<boolean>("isExperienceReady", () => false);
const state = useState<AtelierState>("atelierState", initialAtelierState);
const muted = useState<boolean>("isSoundMuted", () => true);
const active = computed(() => state.value.view !== "workroom");
const visible = computed(() => ready.value && route.path === "/");
const visit = (view: AtelierView) =>
  new HomeExperience().world?.scene1?.visitAtelier(view);
const act = (action: AtelierAction) =>
  new HomeExperience().world?.scene1?.actAtelier(action);
const save = () => new HomeExperience().world?.scene1?.saveAtelierPrint();
const views: { key: AtelierView; label: string; number: string }[] = [
  { key: "atelier", label: "The room", number: "01" },
  { key: "table", label: "Light table", number: "02" },
  { key: "listen", label: "After hours", number: "03" },
];
watch(
  () => route.path,
  (path) => {
    if (path !== "/") new HomeExperience().world?.scene1?.resetAtelierView();
  },
);
</script>

<template>
  <div
    v-if="visible"
    class="atelier-ui"
    :class="{
      'is-open': active,
      'is-detail': active && state.view !== 'atelier',
    }"
    @pointerdown.stop
    @pointerup.stop
    @mousedown.stop
    @mouseup.stop
    @touchstart.stop
    @touchend.stop
  >
    <button
      v-if="!active"
      class="atelier-door"
      :disabled="state.busy"
      @click="visit('atelier')"
    >
      <span class="door-drawing" aria-hidden="true"><i /></span>
      <span
        ><small>THERE’S ANOTHER ROOM</small
        ><strong>Step into the atelier <b>↗</b></strong></span
      >
    </button>
    <template v-else>
      <header class="atelier-heading">
        <button
          class="back-room"
          :disabled="state.busy"
          @click="visit('workroom')"
        >
          ← Workroom
        </button>
        <div class="room-title">
          <span>AN OPEN EXPERIMENT</span>
          <h2>The atelier<span>.</span></h2>
          <p>Make a little something. Stay a while.</p>
        </div>
      </header>
      <nav class="room-views" aria-label="Atelier camera views">
        <button
          v-for="view in views"
          :key="view.key"
          :aria-current="state.view === view.key ? 'location' : undefined"
          :disabled="state.busy"
          @click="visit(view.key)"
        >
          <small>{{ view.number }}</small
          >{{ view.label }}<span>↗</span>
        </button>
      </nav>
      <section class="atelier-workbench" aria-label="Atelier objects">
        <div class="workbench-caption">
          <span>{{
            state.view === "listen"
              ? "SLOW THINGS DOWN"
              : "PLAY WITH THE COMPOSITION"
          }}</span>
          <p>Tap the objects, or use these controls.</p>
        </div>
        <div v-if="state.view !== 'listen'" class="workbench-tools">
          <button :disabled="state.busy" @click="act('study')">
            <span class="tool-mark">◒</span
            ><span
              ><small>STUDY {{ state.study + 1 }} / 3</small
              >{{ ATELIER_STUDIES[state.study] }}</span
            ><b>↻</b>
          </button>
          <button :disabled="state.busy" @click="act('palette')">
            <span class="palette-mark"
              ><i
                v-for="c in [
                  ATELIER_PALETTES[state.palette].accent,
                  ATELIER_PALETTES[state.palette].ink,
                  ATELIER_PALETTES[state.palette].secondary,
                ]"
                :key="c"
                :style="{ background: c }" /></span
            ><span
              ><small>PALETTE</small
              >{{ ATELIER_PALETTES[state.palette].name }}</span
            ><b>↻</b>
          </button>
          <button
            :disabled="state.busy"
            :aria-pressed="state.wireframe"
            @click="act('wireframe')"
          >
            <span class="tool-mark">▧</span
            ><span
              ><small>SEE THE BONES</small
              >{{ state.wireframe ? "Construction" : "Composition" }}</span
            >
          </button>
          <button
            class="print-button"
            :disabled="state.busy || state.printing"
            @click="act('print')"
          >
            <span class="tool-mark">↳</span
            ><span
              ><small>FORM / PRESS</small
              >{{ state.printing ? "Printing…" : "Pull a print" }}</span
            >
          </button>
        </div>
        <div v-else class="workbench-tools listening-tools">
          <button
            :disabled="state.busy"
            :aria-pressed="!muted"
            @click="act('sound')"
          >
            <span class="tool-mark">{{ muted ? "▷" : "Ⅱ" }}</span
            ><span
              ><small>THE TURNTABLE</small
              >{{ muted ? "Put a record on" : "Let it rest" }}</span
            >
          </button>
          <button
            :disabled="state.busy"
            :aria-pressed="state.lamp"
            @click="act('lamp')"
          >
            <span class="tool-mark">☼</span
            ><span
              ><small>READING LIGHT</small
              >{{ state.lamp ? "Lights down" : "A little warmth" }}</span
            >
          </button>
        </div>
        <div class="workbench-bottom">
          <span>Drag to look around · Scroll to get closer</span
          ><button v-if="state.printed" @click="save">
            Save your print <span>↓</span>
          </button>
        </div>
      </section>
      <p class="sr-only" aria-live="polite">
        {{
          state.busy
            ? "Moving to your view."
            : state.printing
              ? "Printing your composition."
              : state.printed
                ? "Your print is ready to save."
                : ""
        }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.atelier-ui {
  position: fixed;
  inset: 0;
  z-index: 28;
  pointer-events: none;
  color: #e5dfd1;
  font-family: Arial, sans-serif;
}
.atelier-ui button {
  pointer-events: auto;
  cursor: pointer;
  transition:
    background 0.18s,
    color 0.18s,
    opacity 0.18s;
  touch-action: manipulation;
}
.atelier-ui button:disabled {
  cursor: wait;
  opacity: 0.5;
}
.atelier-ui button:focus-visible {
  outline: 2px solid #d9b779;
  outline-offset: 5px;
}
.atelier-door {
  position: absolute;
  right: 5.5vw;
  top: 40px;
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  background: #252722ed;
  border: 1px solid #71695180;
  padding: 15px 20px;
  border-radius: 3px;
  box-shadow: 0 8px 30px #0002;
}
.atelier-door:hover {
  background: #363a30;
}
.atelier-door small {
  font-size: 8px;
  letter-spacing: 0.2em;
  color: #b2ac9d;
  display: block;
  margin-bottom: 7px;
}
.atelier-door strong {
  font-size: 14px;
  font-weight: 400;
}
.atelier-door b {
  font-weight: 400;
  margin-left: 18px;
  color: #d3b379;
}
.door-drawing {
  width: 24px;
  height: 36px;
  border: 1px solid #978971;
  display: block;
  position: relative;
  perspective: 80px;
}
.door-drawing i {
  position: absolute;
  inset: 0;
  background: #b79868;
  transform: rotateY(-38deg);
  transform-origin: left;
  transition: transform 0.4s;
}
.door-drawing i:after {
  content: "";
  position: absolute;
  right: 4px;
  top: 18px;
  width: 2px;
  height: 2px;
  background: #2a2d25;
}
.atelier-door:hover .door-drawing i {
  transform: rotateY(-68deg);
}
.atelier-heading {
  position: absolute;
  left: 5.5vw;
  top: 100px;
  pointer-events: none;
}
.back-room {
  font-size: 11px;
  color: #d0c8b5;
  border-bottom: 1px solid #7f786644;
  padding: 8px 0;
  margin-bottom: 30px;
}
.back-room:hover {
  color: white;
}
.room-title > span {
  font-size: 9px;
  letter-spacing: 0.22em;
  color: #b1a68d;
}
.room-title h2 {
  font-family: Georgia, serif;
  font-weight: 400;
  font-size: clamp(34px, 3.7vw, 48px);
  letter-spacing: -0.05em;
  line-height: 1.1;
  margin: 10px 0;
}
.room-title h2 span {
  color: #c5a273;
}
.room-title p {
  font-size: 11px;
  color: #b2ad9f;
  margin-top: 12px;
}
.room-views {
  position: absolute;
  right: 5.5vw;
  top: 40px;
  display: flex;
  border: 1px solid #7d786052;
  background: #252822f0;
  border-radius: 3px;
  overflow: hidden;
}
.room-views button {
  padding: 15px 16px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-right: 1px solid #7d786032;
  white-space: nowrap;
}
.room-views button:last-child {
  border: 0;
}
.room-views small {
  font-size: 8px;
  opacity: 0.5;
}
.room-views button > span {
  opacity: 0.35;
}
.room-views button:hover {
  background: #414237;
}
.room-views button[aria-current] {
  background: #d7c7a5;
  color: #292c25;
}
.room-views button[aria-current] > span {
  opacity: 1;
}
.atelier-workbench {
  position: absolute;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  width: min(660px, 90vw);
  pointer-events: auto;
  background: #242821f5;
  border: 1px solid #8a806346;
  border-radius: 4px;
  padding: 15px 18px 10px;
  box-shadow: 0 12px 40px #0003;
}
.workbench-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 13px;
}
.workbench-caption > span {
  font-size: 8px;
  letter-spacing: 0.18em;
  color: #baa67f;
}
.workbench-caption p {
  font-size: 9px;
  color: #aaa899;
}
.workbench-tools {
  display: flex;
  gap: 0;
}
.workbench-tools > button {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 9px;
  text-align: left;
  padding: 8px 12px;
  border-left: 1px solid #837e6544;
  font-size: 11px;
  white-space: nowrap;
}
.workbench-tools > button:first-child {
  border-left: 0;
  padding-left: 0;
}
.workbench-tools > button:hover {
  background: #51524145;
}
.workbench-tools small {
  display: block;
  font-size: 7px;
  letter-spacing: 0.1em;
  color: #a7a38d;
  margin-bottom: 5px;
}
.workbench-tools b {
  font-weight: 400;
  color: #b3a88b;
  margin-left: auto;
}
.tool-mark {
  font-size: 25px;
  line-height: 1;
  font-family: Georgia, serif;
  color: #c7b891;
}
.palette-mark {
  display: flex;
  width: 29px;
  flex-wrap: wrap;
  gap: 2px;
}
.palette-mark i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid #fff3;
}
.workbench-tools > button[aria-pressed="true"] {
  color: #ddcba5;
}
.print-button {
  color: #e5c594;
}
.workbench-bottom {
  margin-top: 11px;
  padding-top: 10px;
  border-top: 1px solid #80785c33;
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #959986;
  min-height: 22px;
}
.workbench-bottom button {
  font-size: 10px;
  color: #e5c594;
}
.workbench-bottom button span {
  margin-left: 10px;
}
.listening-tools {
  max-width: 440px;
}
.listening-tools > button {
  padding-block: 14px;
}
@media (max-width: 700px) {
  .atelier-ui button {
    min-height: 44px;
  }
  .atelier-door {
    top: 115px;
    right: 16px;
    padding: 10px 13px;
    gap: 10px;
  }
  .atelier-door small {
    font-size: 7px;
  }
  .atelier-door strong {
    font-size: 11px;
  }
  .atelier-door b {
    margin-left: 7px;
  }
  .door-drawing {
    width: 18px;
    height: 29px;
  }
  .atelier-heading {
    top: 20px;
    left: 20px;
  }
  .back-room {
    margin-bottom: 40px;
    padding-block: 6px;
  }
  .room-title h2 {
    font-size: 34px;
    margin: 7px 0;
  }
  .room-title > span {
    font-size: 7px;
  }
  .room-title p {
    display: none;
  }
  .room-views {
    top: 20px;
    right: 16px;
  }
  .room-views button {
    padding: 12px 10px;
    font-size: 9px;
    gap: 6px;
  }
  .room-views small {
    display: none;
  }
  .room-views button > span {
    display: none;
  }
  .atelier-workbench {
    bottom: 22px;
    width: calc(100% - 32px);
    padding: 12px;
  }
  .workbench-caption {
    margin-bottom: 7px;
  }
  .workbench-caption > span {
    font-size: 7px;
  }
  .workbench-caption p {
    display: none;
  }
  .workbench-tools {
    flex-wrap: wrap;
    row-gap: 7px;
  }
  .workbench-tools > button {
    flex-basis: 50%;
    padding: 8px 10px;
    font-size: 10px;
  }
  .workbench-tools > button:nth-child(odd) {
    border-left: 0;
    padding-left: 0;
  }
  .workbench-tools small {
    font-size: 6px;
  }
  .workbench-bottom {
    font-size: 7px;
    min-height: 20px;
  }
  .tool-mark {
    font-size: 22px;
  }
  .listening-tools {
    flex-wrap: nowrap;
  }
}
.is-detail .room-title {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .atelier-ui button,
  .door-drawing i {
    transition: none;
  }
}
</style>
