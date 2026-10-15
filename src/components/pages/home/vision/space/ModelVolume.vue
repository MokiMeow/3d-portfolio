<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ObjectStage } from '../apps/objects/stage';
import type { ObjectId } from '../apps/objects/models';

/**
 * A volume: how visionOS shows a 3D file you bring out of a window. The model floats in a bounded
 * space of its own, over a glass floor, with nothing around it but an ornament beneath. Drag the model
 * to turn it, scroll to come closer, move the volume by its bar, resize it from its corner, close it,
 * or set the model loose in the room to pick up and throw.
 */
export type Volume = { key: number; id: ObjectId; name: string; x: number; y: number; w: number; h: number; z: number };
const props = defineProps<{ volume: Volume; compact: boolean; behind?: boolean; bounds: { w: number; h: number; top: number; bottom: number } }>();
const emit = defineEmits<{ close: []; raise: []; loose: [] }>();

const host = ref<HTMLElement>();
const status = ref('');
const failed = ref(false);
const spinning = ref(true);
let stage: ObjectStage | undefined;

onMounted(() => {
  if (!host.value) return;
  try {
    stage = new ObjectStage(host.value, props.compact, { rotate: true, explode: false, wireframe: false, night: false }, (message, broke) => { status.value = message; failed.value = !!broke; }, () => {}, false);
    // A step further back than the Objects app, so the model and its glass floor sit inside the volume.
    void stage.select(props.volume.id).then(() => stage?.zoom(1.1));
  } catch { failed.value = true; status.value = 'This model needs WebGL to float in your space.'; }
});
onBeforeUnmount(() => stage?.dispose());

function spin() { spinning.value = !spinning.value; stage?.set({ rotate: spinning.value, explode: false, wireframe: false, night: false }); }

/* Moving by the bar, resizing from the corner: the same feel as a window, kept on screen. */
let drag: { mode: 'move' | 'size'; x: number; y: number; left: number; top: number; w: number; h: number } | null = null;
function grab(event: PointerEvent, mode: 'move' | 'size') {
  emit('raise');
  const v = props.volume;
  drag = { mode, x: event.clientX, y: event.clientY, left: v.x, top: v.y, w: v.w, h: v.h };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function pull(event: PointerEvent) {
  if (!drag) return;
  const v = props.volume, b = props.bounds, dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (drag.mode === 'move') {
    // Most of it stays in view, so its ornament is always within reach.
    v.x = Math.max(-v.w * .25, Math.min(b.w - v.w * .75, drag.left + dx));
    v.y = Math.max(b.top, Math.min(b.h - b.bottom - v.h, drag.top + dy));
  } else {
    // Volumes keep their proportions, the way a box does.
    const scale = Math.max(260 / drag.w, Math.min((b.w - v.x - 8) / drag.w, (b.h - b.bottom - v.y) / drag.h, 1 + Math.max(dx / drag.w, dy / drag.h)));
    v.w = Math.round(drag.w * scale); v.h = Math.round(drag.h * scale);
  }
}
function letGo() { drag = null; }
</script>

<template>
  <section class="volume" :class="{ compact, behind }" :aria-label="`${volume.name}, in a volume`" :style="{ left: `${volume.x}px`, top: `${volume.y}px`, width: `${volume.w}px`, height: `${volume.h}px`, zIndex: volume.z }"
    @pointerdown.capture="emit('raise')" @pointerdown.stop @wheel.stop>
    <!-- The bounds you only see while you work with it, as on the device. -->
    <i class="edges" aria-hidden="true"><i /><i /><i /><i /></i>
    <div ref="host" class="stage" />
    <p v-if="status" class="status" :class="{ failed }">{{ status }}</p>

    <div class="ornament" role="toolbar" :aria-label="`${volume.name} controls`">
      <span class="name">{{ volume.name }}</span>
      <i class="rule" />
      <button :aria-pressed="spinning" :aria-label="spinning ? 'Stop turning' : 'Turn slowly'" :title="spinning ? 'Stop turning' : 'Turn slowly'" @click="spin">
        <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" /></svg>
      </button>
      <button aria-label="Further away" title="Further away" @click="stage?.zoom(.7)"><svg viewBox="0 0 24 24"><path d="M6 12h12" /></svg></button>
      <button aria-label="Closer" title="Closer" @click="stage?.zoom(-.7)"><svg viewBox="0 0 24 24"><path d="M6 12h12M12 6v12" /></svg></button>
      <button aria-label="Reset the view" title="Reset the view" @click="stage?.reset(); stage?.zoom(1.1)"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" /></svg></button>
      <i class="rule" />
      <button class="loose" title="Set it in the room, to pick up and throw" @click="emit('loose')">
        <svg viewBox="0 0 24 24"><path d="M12 3 4 7.5v9L12 21l8-4.5v-9Zm0 0v9m0 0 8-4.5M12 12l-8-4.5" /></svg><span>Set in room</span>
      </button>
    </div>

    <div class="grip-row">
      <button class="shut" :aria-label="`Close ${volume.name}`" :title="`Close ${volume.name}`" @click="emit('close')">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 3 6 6m0-6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </button>
      <button class="bar" :aria-label="`Move ${volume.name}`" :title="`${volume.name}: drag to move`" @pointerdown="grab($event, 'move')" @pointermove="pull" @pointerup="letGo" @pointercancel="letGo"><i /></button>
    </div>
    <button class="corner" :aria-label="`Resize ${volume.name}`" title="Drag to resize" @pointerdown="grab($event, 'size')" @pointermove="pull" @pointerup="letGo" @pointercancel="letGo"><i /></button>
  </section>
</template>

<style scoped>
.volume{position:absolute;pointer-events:auto;color:#fff;font:500 13px/1.3 'Inter',system-ui,sans-serif;animation:arrive .6s cubic-bezier(.2,.8,.2,1) both;transition:opacity .35s,filter .35s;container-type:inline-size}
/* Home View in front: the volume steps back, as windows do. */
.volume.behind{opacity:.14;filter:blur(8px);pointer-events:none}
@keyframes arrive{from{opacity:0;scale:.86;translate:0 18px}}
:where(.volume) button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}
.volume button:focus-visible{outline:2px solid rgb(255 255 255 / .8);outline-offset:2px}

/* The model's space: a faint floor of light, and corner marks that appear when you reach for it. */
.stage{position:absolute;inset:0 0 58px;border-radius:34px;overflow:hidden;background:radial-gradient(ellipse 62% 22% at 50% 82%,rgb(190 215 255 / .14),transparent 72%)}
.stage :deep(canvas){cursor:grab}.stage :deep(canvas:active){cursor:grabbing}
.edges{position:absolute;inset:0 0 58px;pointer-events:none;opacity:0;transition:opacity .3s}
.edges i{position:absolute;width:26px;height:26px;border:2px solid rgb(255 255 255 / .55)}
.edges i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0;border-top-left-radius:16px}
.edges i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0;border-top-right-radius:16px}
.edges i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0;border-bottom-left-radius:16px}
.edges i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0;border-bottom-right-radius:16px}
.volume:hover .edges,.volume:focus-within .edges{opacity:1}
.status{position:absolute;left:50%;top:44%;translate:-50% -50%;margin:0;max-width:80%;padding:8px 14px;border-radius:14px;text-align:center;font-size:12.5px;background:rgb(30 32 38 / .6);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);pointer-events:none}
.status.failed{color:#ffd0c8}

/* The ornament: a glass capsule under the model, as on the device. */
.ornament{position:absolute;left:50%;bottom:4px;translate:-50% 0;display:flex;align-items:center;gap:2px;height:46px;padding:0 6px 0 16px;border-radius:23px;white-space:nowrap;
  background:linear-gradient(180deg,rgb(255 255 255 / .2),rgb(255 255 255 / .07)),rgb(48 50 58 / .55);backdrop-filter:blur(30px) saturate(150%);-webkit-backdrop-filter:blur(30px) saturate(150%);
  box-shadow:inset 0 0 0 1px rgb(255 255 255 / .16),inset 0 1px 0 rgb(255 255 255 / .22),0 16px 40px rgb(0 0 0 / .35)}
.name{font-weight:600;font-size:13.5px;letter-spacing:-.01em;padding-right:6px;max-width:150px;overflow:hidden;text-overflow:ellipsis}
.rule{width:1px;height:22px;margin:0 6px;background:rgb(255 255 255 / .18)}
.ornament button{height:36px;min-width:36px;border-radius:18px;display:grid;place-items:center;transition:background .2s}
.ornament button:hover{background:rgb(255 255 255 / .16)}
.ornament button[aria-pressed=true]{background:rgb(255 255 255 / .9);color:#1c1d22}
.ornament svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ornament .loose{display:flex;gap:7px;padding:0 14px 0 11px;background:rgb(255 255 255 / .12)}
.ornament .loose:hover{background:rgb(255 255 255 / .24)}

/* The window bar and close control, matching every window in the headset. */
.grip-row{position:absolute;left:0;right:0;top:calc(100% + 8px);display:flex;justify-content:center;align-items:center;gap:10px}
.shut{position:relative;width:34px;height:34px;border-radius:50%;display:grid;place-items:center}
.shut::before{content:'';position:absolute;inset:11px;border-radius:50%;background:rgb(255 255 255 / .55);box-shadow:0 2px 8px rgb(0 0 0 / .3);transition:inset .22s cubic-bezier(.2,.9,.3,1.2),background .2s}
.shut svg{position:relative;width:13px;height:13px;opacity:0;transform:scale(.6);transition:opacity .18s,transform .22s}
.shut:hover::before,.shut:focus-visible::before{inset:0;background:rgb(70 72 80 / .78);backdrop-filter:blur(20px)}
.shut:hover svg,.shut:focus-visible svg{opacity:1;transform:none}
.bar{width:150px;height:34px;display:grid;place-items:center;cursor:grab;touch-action:none}.bar:active{cursor:grabbing}
.bar i{width:112px;height:9px;border-radius:5px;background:rgb(255 255 255 / .6);box-shadow:0 2px 10px rgb(0 0 0 / .3);transition:background .2s,transform .2s}
.bar:hover i{background:#fff;transform:scaleX(1.05)}
.corner{position:absolute;right:-16px;bottom:38px;width:54px;height:54px;cursor:nwse-resize;touch-action:none;opacity:0;transition:opacity .2s}
.volume:hover .corner,.corner:focus-visible{opacity:1}
.corner i{position:absolute;right:8px;bottom:8px;width:26px;height:26px;border:4px solid rgb(255 255 255 / .8);border-left-color:transparent;border-top-color:transparent;border-radius:0 0 22px 0}

.compact .ornament{height:42px;padding-left:12px}.compact .name{max-width:96px}
/* A narrow volume keeps its ornament within its own width. */
@container (max-width:420px){.loose span{display:none}.ornament .loose{padding:0 11px}}
@container (max-width:330px){.name,.name+.rule{display:none}.ornament{padding-left:6px}}
@media (hover:none){.edges,.corner{opacity:1}}
@media (prefers-reduced-motion:reduce){.volume{animation:none}}
</style>
