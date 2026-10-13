<script setup lang="ts">
import { HomeExperience } from "~/experiences/home";
import { initialAtelierState, type AtelierAction, type AtelierState } from "~/common/models/atelier.model";

const route = useRoute();
const menu = ref<HTMLDetailsElement>();
const state = useState<AtelierState>("atelierState", initialAtelierState);
const studies = ["Orbit", "Rhythm", "Field"];
const palettes = ["Clay & ink", "Moss & cream", "Blue hour"];
const close = () => { if (menu.value) menu.value.open = false; };
const act = (action: AtelierAction) => new HomeExperience().world?.scene1?.actAtelier(action);
const save = () => new HomeExperience().world?.scene1?.saveAtelierPrint();
const outside = (event: PointerEvent) => {
  if (event.target instanceof Node && !menu.value?.contains(event.target)) close();
};
const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
const toggled = () => {
  if (!menu.value?.open) return;
  // Only one small footer menu should cover the room at a time.
  document.querySelectorAll<HTMLDetailsElement>('footer details[open]').forEach(other => {
    if (other !== menu.value) other.open = false;
  });
};
watch(() => route.path, close);
onMounted(() => {
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("keydown", escape);
});
</script>

<template>
  <details v-if="route.path === '/'" ref="menu" class="drawing-tools"
    @toggle="toggled" @pointerdown.stop @pointerup.stop @pointermove.stop @click.stop @wheel.stop
    @keydown.stop @keydown.esc.prevent="close">
    <summary aria-label="Drawing tools" title="Drawing tools">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
        <path d="m5 15 10-10a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Zm8-8 3 3M4 22h16" />
      </svg>
    </summary>
    <div class="drawing-tools-menu">
      <p>ON THE DRAWING DESK</p>
      <button @click="act('study')"><span>Composition</span><small>{{ studies[state.study] }} ↻</small></button>
      <button @click="act('palette')"><span>Ink palette</span><small>{{ palettes[state.palette] }} ↻</small></button>
      <button :aria-pressed="state.wireframe" @click="act('wireframe')"><span>Construction lines</span><small>{{ state.wireframe ? 'On' : 'Off' }}</small></button>
      <button :disabled="state.printing" @click="act('print')"><span>{{ state.printing ? 'Printing…' : 'Pull a print' }}</span><small>↳</small></button>
      <button v-if="state.printed" @click="save"><span>Save this print</span><small>PNG ↓</small></button>
      <span class="hint">Or tap the paper, inks, ruler and printer.</span>
      <span class="sr-only" role="status">{{ studies[state.study] }}, {{ palettes[state.palette] }}. {{ state.printing ? 'Printing' : state.printed ? 'Print ready' : '' }}</span>
    </div>
  </details>
</template>

<style scoped>
.drawing-tools { position: relative; pointer-events: auto; color: #ddd; }
summary { list-style: none; cursor: pointer; opacity: .7; width: 26px; height: 28px; display: grid; place-items: center; }
summary::-webkit-details-marker { display: none; }
summary:hover, details[open] summary { opacity: 1; }
summary svg { width: 23px; height: 23px; }
.drawing-tools-menu { position: absolute; right: -34px; bottom: 45px; width: 244px; max-height: min(420px, 65vh); overflow-y: auto; padding: 18px 17px 14px; background: #202020f5; border: 1px solid #ffffff24; border-radius: 12px; box-shadow: 0 16px 40px #0005; text-align: left; backdrop-filter: blur(12px); }
p { font-size: 8px; letter-spacing: 1.8px; color: #b4aaa0; margin-bottom: 9px; }
button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; border-bottom: 1px solid #ffffff10; font-size: 12px; color: #e8e6e3; gap: 10px; }
small { font-size: 9px; color: #b9aaa0; white-space: nowrap; }
button:hover span { color: #e2bd98; }
button:disabled { opacity: .5; cursor: wait; }
.hint { display: block; font-size: 9px; line-height: 1.5; color: #a09a95; margin-top: 13px; }
summary:focus-visible, button:focus-visible { outline: 2px solid #c9b3a2; outline-offset: 4px; border-radius: 3px; }
@media (max-width: 480px) { .drawing-tools-menu { right: -98px; bottom: 42px; } }

@media(max-width:639px),(max-height:500px) and (max-width:1023px){
 .drawing-tools-menu{position:fixed;left:max(12px,env(safe-area-inset-left));right:auto;bottom:calc(82px + env(safe-area-inset-bottom));width:min(280px,calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));max-height:calc(var(--visual-height,100dvh) - 105px - env(safe-area-inset-bottom));overflow:auto;overscroll-behavior:contain;}
}
@media(max-height:500px) and (min-width:640px) and (max-width:1023px){.drawing-tools-menu{bottom:calc(64px + env(safe-area-inset-bottom));}}
</style>
