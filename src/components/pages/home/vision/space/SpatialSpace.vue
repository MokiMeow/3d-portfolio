<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Vector3 } from 'three';
import { SpaceEngine, GRAVITY } from './engine';
import type { GravityMode, Structure, Thing } from './engine';
import { MATERIALS, SHAPES, SHAPE_NAMES, materialFor, outline } from './shapes';
import { loadModel, objects, type ObjectId } from '../apps/objects/models';
import type { MaterialId, ShapeId } from './shapes';

/**
 * Making things in your space, the way the headset does it: not in a window, but out in the place you
 * are in, with gravity. Pick a shape and click to place it, or draw any outline and it becomes a solid.
 * Grab anything and throw it. Everything stays while you use your apps, until you clear it.
 */
const props = defineProps<{ view: () => { yaw: number; pitch: number; fov: number }; environment: string | null; compact: boolean; hidden: boolean }>();
const emit = defineEmits<{ creating: [on: boolean]; toast: [text: string] }>();

const canvas = ref<HTMLCanvasElement>();
const ink = ref<HTMLCanvasElement>();
const root = ref<HTMLElement>();
const engine = shallowRef<SpaceEngine | null>(null);
const creating = ref(false);
const tool = ref<'place' | 'draw'>('place');
const shape = ref<ShapeId>('cube');
const material = ref<MaterialId>('glass');
const size = ref<'S' | 'M' | 'L'>('M');
const gravity = ref<GravityMode>('earth');
const count = ref(0);
const palette = ref(false);
const gravityMenu = ref(false);
const selected = shallowRef<Thing | null>(null);
const ornament = ref({ x: 0, y: 0, visible: false });
const SIZES = { S: .2, M: .32, L: .5 } as const;
const currentMaterial = computed(() => MATERIALS.find(item => item.id === material.value)!);

watch(() => props.environment, url => engine.value?.setEnvironment(url));
watch(creating, on => {
  if (!engine.value) return;
  engine.value.showGrid = on;
  if (on) engine.value.aimGrid();
  engine.value.wake();
  palette.value = gravityMenu.value = false;
  if (!on) selected.value = null;
  emit('creating', on);
});
watch(gravity, mode => engine.value?.setGravity(mode));
watch(() => creating.value && tool.value === 'draw', drawing => { if (host) host.style.cursor = drawing ? 'crosshair' : ''; });

/* Pointer handling sits on the space behind the windows, so dragging empty scenery still looks around. */
let host: HTMLElement | null = null;
let press: { id: number; x: number; y: number; t: number; thing?: Thing; stroke?: { x: number; y: number }[] } | null = null;
function local(event: PointerEvent) { const rect = root.value!.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
function down(event: PointerEvent) {
  if (!engine.value || props.hidden || event.button !== 0 || event.target !== host) return;
  const p = local(event);
  if (creating.value && tool.value === 'draw') {
    press = { id: event.pointerId, ...p, t: performance.now(), stroke: [p] };
  } else {
    const thing = engine.value.grab(p.x, p.y);
    if (thing) { press = { id: event.pointerId, ...p, t: performance.now(), thing }; selected.value = null; }
    else if (creating.value) { place(p.x, p.y); }
    else return;
  }
  event.stopPropagation(); event.preventDefault();
  host?.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (!press || press.id !== event.pointerId || !engine.value) return;
  const p = local(event);
  if (press.stroke) { press.stroke.push(p); drawStroke(press.stroke); }
  else engine.value.drag(p.x, p.y);
  event.stopPropagation();
}
function up(event: PointerEvent) {
  if (!press || press.id !== event.pointerId || !engine.value) return;
  const current = press; press = null;
  event.stopPropagation();
  if (current.stroke) { finishStroke(current.stroke); return; }
  const p = local(event);
  const tap = Math.hypot(p.x - current.x, p.y - current.y) < 6 && performance.now() - current.t < 260;
  engine.value.release();
  if (tap && current.thing) { selected.value = current.thing; follow(); }
}
function wheel(event: WheelEvent) {
  if (!engine.value?.holding) return;
  event.preventDefault(); event.stopPropagation();
  const rect = root.value!.getBoundingClientRect();
  engine.value.drag(event.clientX - rect.left, event.clientY - rect.top, event.deltaY * -.0025);
}

function place(x: number, y: number) {
  const e = engine.value!;
  const s = SIZES[size.value];
  e.spawn(shape.value, material.value, s, e.placeAt(x, y, s));
}

/* Drawing: a glowing gold stroke that lifts into a solid when you let go. */
function drawStroke(points: { x: number; y: number }[]) {
  const c = ink.value;
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(c.clientWidth * dpr)) { c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr); }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const [width, color, blur] of [[9, 'rgba(255,170,60,.35)', 18], [3, '#ffe2a8', 8]] as const) {
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.shadowColor = '#ffb04a'; ctx.shadowBlur = blur;
    ctx.beginPath(); points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
  const first = points[0]!, last = points[points.length - 1]!;
  if (points.length > 12 && Math.hypot(first.x - last.x, first.y - last.y) < 60) {
    ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,226,168,.7)';
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(first.x, first.y); ctx.stroke(); ctx.setLineDash([]);
  }
}
function finishStroke(points: { x: number; y: number }[]) {
  const c = ink.value, e = engine.value!;
  const made = outline(points);
  if (c) { c.style.transition = 'opacity .45s'; c.style.opacity = '0'; window.setTimeout(() => { c.getContext('2d')?.clearRect(0, 0, c.width, c.height); c.style.transition = 'none'; c.style.opacity = '1'; }, 460); }
  if (!made) { emit('toast', 'Draw a closed outline, a little larger.'); return; }
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  // The bigger you draw, the bigger it is, within reason.
  const s = Math.max(.22, Math.min(.9, span / root.value!.clientWidth * 3.2));
  e.spawn('drawn', material.value, s, e.placeAt(cx, cy, s), { drawn: made.shape, spin: false });
}

/* The little ornament over a selected object. */
let followFrame = 0;
function follow() {
  cancelAnimationFrame(followFrame);
  const step = () => {
    const thing = selected.value;
    if (!thing || !engine.value || thing.dying) { selected.value = null; return; }
    ornament.value = engine.value.project(thing);
    followFrame = requestAnimationFrame(step);
  };
  step();
}
function scaleSelected(factor: number) { if (selected.value) engine.value?.resize_thing(selected.value, factor); }
function restyleSelected(id: MaterialId) { if (selected.value) engine.value?.restyle(selected.value, id); }
function duplicateSelected() {
  const thing = selected.value, e = engine.value;
  if (!thing || !e || thing.model) return;
  const p = thing.body.position;
  e.spawn(thing.shape, thing.material, thing.size, new Vector3(p.x + thing.size * .4, p.y + thing.size * 1.4, p.z), { drawn: thing.mesh.userData.drawn });
}
function deleteSelected() { if (selected.value) { engine.value?.remove(selected.value); selected.value = null; } }

/* For JARVIS and the rest of the headset. */
function spawnMany(kind: string, amount: number, finish?: string) {
  const e = engine.value;
  if (!e) return 0;
  const id = (SHAPES as readonly string[]).includes(kind) ? kind as ShapeId : kind === 'duck' ? 'capsule' : 'cube';
  const chosen = materialFor(finish) ?? (finish ? undefined : undefined);
  const n = Math.max(1, Math.min(40, amount));
  const palette = ['coral', 'cobalt', 'lemon', 'mint', 'glass', 'gold'] as const;
  for (let i = 0; i < n; i++) {
    window.setTimeout(() => {
      const s = SIZES.M * (n > 10 ? .7 : 1) * (.85 + Math.random() * .3);
      const at = e.inFront(n > 1 ? 1.4 : 0).setY(n > 1 ? .2 + Math.random() * .9 : .1);
      e.spawn(id, chosen ?? (n > 1 && !finish ? palette[i % palette.length]! : material.value), s, at, { fabricate: n <= 8 });
    }, i * (n > 12 ? 70 : 120));
  }
  return n;
}
function clear() { engine.value?.clear(); selected.value = null; }

/** Structures JARVIS can build, placed block by block in front of you. */
function build(kind: Structure, finish?: string) {
  const e = engine.value;
  if (!e) return 0;
  const material = materialFor(finish) ?? (kind === 'dominoes' ? 'obsidian' : kind === 'circle' ? 'chrome' : 'gold');
  const { origin, forward, right, yaw } = e.site(kind === 'dominoes' ? 2.1 : 2.4);
  const at = (x: number, y: number, z = 0) => origin.clone().addScaledVector(right, x).addScaledVector(forward, z).setY(e.floor + y);
  const jobs: { shape: ShapeId; size: number; position: Vector3; yaw?: number }[] = [];
  const s = .24;
  if (kind === 'tower') for (let i = 0; i < 9; i++) jobs.push({ shape: 'cube', size: s, position: at(0, s / 2 + i * s * 1.01), yaw: yaw + (i % 2) * .2 });
  else if (kind === 'pyramid') for (let level = 0; level < 4; level++) { const n = 4 - level; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) jobs.push({ shape: 'cube', size: s, position: at((i - (n - 1) / 2) * s * 1.02, s / 2 + level * s * 1.01, (j - (n - 1) / 2) * s * 1.02), yaw }); }
  else if (kind === 'wall') for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) jobs.push({ shape: 'cube', size: s * .9, position: at((i - 2.5 + (row % 2) * .5) * s * .92, s * .45 + row * s * .91), yaw });
  else if (kind === 'stairs') for (let step = 0; step < 6; step++) for (let h = 0; h <= step; h++) jobs.push({ shape: 'cube', size: s * .9, position: at(0, s * .45 + h * s * .91, (step - 2.5) * -s * .92), yaw });
  else if (kind === 'circle') for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; jobs.push({ shape: 'cylinder', size: .32, position: at(Math.cos(a) * .9, .17, Math.sin(a) * .9), yaw }); }
  else for (let i = 0; i < 16; i++) {
    // A gentle S of dominoes, each facing along the curve.
    const t = i / 15, x = Math.sin(t * Math.PI * 1.6) * .5, z = (t - .5) * -2.6;
    const next = Math.sin((i + 1) / 15 * Math.PI * 1.6) * .5 - x;
    jobs.push({ shape: 'domino', size: .3, position: at(x, .155, z), yaw: yaw + Math.atan2(next, -2.6 / 15) });
  }
  const made: Thing[] = [];
  jobs.forEach((job, index) => window.setTimeout(() => {
    made.push(e.spawn(job.shape, material, job.size, job.position, { spin: false, yaw: job.yaw, fabricate: true }));
    // Once the run is standing, tip the first domino.
    if (kind === 'dominoes' && index === jobs.length - 1) window.setTimeout(() => { const first = made[0]; if (first) e.nudge(first, forward.clone().multiplyScalar(-1).applyAxisAngle(new Vector3(0, 1, 0), 0), 1.6); }, 1500);
  }, index * (kind === 'pyramid' || kind === 'wall' || kind === 'stairs' ? 70 : 140)));
  return jobs.length;
}
function setGravity(mode: GravityMode) { gravity.value = mode; }
/** A model dragged out of the Mac lands where it was let go, at arm's length. */
async function dropModel(id: ObjectId, x: number, y: number) {
  const e = engine.value;
  if (!e) return;
  const env = e.envMap;
  const model = await loadModel(id, env as Parameters<typeof loadModel>[1]);
  e.spawnModel(model.root, objects.find(item => item.id === id)!.name, model.dispose, e.placeAt(x, y, .42));
}
defineExpose({
  dropModel,
  open: () => { creating.value = true; }, close: () => { creating.value = false; }, toggle: () => { creating.value = !creating.value; },
  spawn: spawnMany, build, clear, setGravity, get count() { return count.value; }, get creating() { return creating.value; },
});

function keys(event: KeyboardEvent) {
  if (!creating.value) return;
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (selected.value) selected.value = null; else if (palette.value || gravityMenu.value) palette.value = gravityMenu.value = false; else creating.value = false; }
  else if (!typing && (event.key === 'Delete' || event.key === 'Backspace') && selected.value) { event.preventDefault(); deleteSelected(); }
  else if (!typing && event.key === 'd' && !(event.target as HTMLElement | null)?.closest?.('.window, .jarvis-hud, .quick')) { tool.value = tool.value === 'draw' ? 'place' : 'draw'; }
}

onMounted(() => {
  if (!canvas.value || !root.value) return;
  const e = new SpaceEngine(canvas.value, props.view);
  e.onChange = () => { count.value = e.count; };
  e.setEnvironment(props.environment);
  engine.value = e;
  host = root.value.parentElement;
  host?.addEventListener('pointerdown', down, true);
  host?.addEventListener('pointermove', move, true);
  host?.addEventListener('pointerup', up, true);
  host?.addEventListener('pointercancel', up, true);
  host?.addEventListener('wheel', wheel, { capture: true, passive: false });
  window.addEventListener('keydown', keys, true);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(followFrame);
  host?.removeEventListener('pointerdown', down, true);
  host?.removeEventListener('pointermove', move, true);
  host?.removeEventListener('pointerup', up, true);
  host?.removeEventListener('pointercancel', up, true);
  host?.removeEventListener('wheel', wheel, true);
  window.removeEventListener('keydown', keys, true);
  engine.value?.dispose();
});
const ICONS: Record<string, string> = {
  cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9Zm0 0v9m0 0 8-4.5M12 12l-8-4.5',
  sphere: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9c0 2 4 3.6 9 3.6s9-1.6 9-3.6',
  cylinder: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3v12c0 1.7-3.1 3-7 3s-7-1.3-7-3Zm0 0c0 1.7 3.1 3 7 3s7-1.3 7-3',
  cone: 'M12 3 5 18c0 1.7 3.1 3 7 3s7-1.3 7-3Zm-7 15c0-1.7 3.1-3 7-3s7 1.3 7 3',
  pyramid: 'M12 3 3 18l9 3 9-3Zm0 0v18',
  torus: 'M12 6c5 0 9 2.7 9 6s-4 6-9 6-9-2.7-9-6 4-6 9-6Zm0 3.6c2.4 0 4.2 1.1 4.2 2.4s-1.8 2.4-4.2 2.4-4.2-1.1-4.2-2.4 1.8-2.4 4.2-2.4Z',
  capsule: 'M9 3h6a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z',
  star: 'm12 2.8 2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3L2.9 9.4l6.4-.7Z',
  heart: 'M12 20s-8-4.9-8-10.4A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.6C20 15.1 12 20 12 20Z',
  domino: 'M8 3h8v18H8Zm0 9h8M12 6.6v.1M12 16.4v.1',
};
</script>

<template>
  <div ref="root" class="spatial" :class="{ creating, compact, drawing: creating && tool === 'draw', hidden }">
    <canvas ref="canvas" class="world" aria-hidden="true" />
    <canvas ref="ink" class="ink" aria-hidden="true" />

    <!-- Over a selected object -->
    <Transition name="pop">
      <div v-if="selected && ornament.visible && !hidden" class="thing-ornament" :style="{ left: `${ornament.x}px`, top: `${ornament.y}px` }" @pointerdown.stop>
        <button aria-label="Smaller" @click="scaleSelected(.8)"><svg viewBox="0 0 24 24"><path d="M6 12h12" /></svg></button>
        <button aria-label="Bigger" @click="scaleSelected(1.25)"><svg viewBox="0 0 24 24"><path d="M6 12h12M12 6v12" /></svg></button>
        <i />
        <button v-for="item in MATERIALS.slice(0, 7)" :key="item.id" class="swatch" :aria-label="item.name" :aria-pressed="selected.material === item.id" :style="{ background: item.swatch }" @click="restyleSelected(item.id)" />
        <i />
        <button aria-label="Duplicate" @click="duplicateSelected"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2.5" /><path d="M5 15V7a2 2 0 0 1 2-2h8" /></svg></button>
        <button aria-label="Delete" class="danger" @click="deleteSelected"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg></button>
      </div>
    </Transition>

    <!-- The creation ornament -->
    <Transition name="bar">
      <div v-if="creating && !hidden" class="create" role="toolbar" aria-label="Create in your space" @pointerdown.stop @wheel.stop>
        <!-- Pop-overs sit above the bar, outside its scroller, so nothing clips them. -->
        <Transition name="pop" mode="out-in">
          <div v-if="palette" key="palette" class="palette">
            <button v-for="item in MATERIALS" :key="item.id" :aria-pressed="material === item.id" @click="material = item.id; palette = false"><i :style="{ background: item.swatch }" /><span>{{ item.name }}</span></button>
          </div>
          <div v-else-if="gravityMenu" key="gravity" class="palette gravity">
            <button v-for="(item, key) in GRAVITY" :key="key" :aria-pressed="gravity === key" @click="gravity = key; gravityMenu = false"><span>{{ item.name }}</span><small>{{ item.g ? `${Math.abs(item.g).toFixed(2)} m/s²` : 'Float' }}</small></button>
          </div>
        </Transition>
        <p v-if="!palette && !gravityMenu" class="hint">{{ tool === 'draw' ? 'Draw any closed outline. It becomes a solid and falls.' : `Click anywhere to place a ${SHAPE_NAMES[shape].toLowerCase()}. Grab things to throw them; scroll while holding to push them away.` }}</p>
        <div class="bar">
          <div class="seg tools">
            <button :aria-pressed="tool === 'place'" @click="tool = 'place'"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18" /></svg><span>Place</span></button>
            <button :aria-pressed="tool === 'draw'" @click="tool = 'draw'"><svg viewBox="0 0 24 24"><path d="M4 20c4-1 6-3 9-8l4-6 3 2-4 6c-3 5-7 6-12 6Z" /></svg><span>Draw</span></button>
          </div>
          <div class="shapes" :class="{ muted: tool === 'draw' }">
            <button v-for="item in SHAPES" :key="item" :aria-label="SHAPE_NAMES[item]" :title="SHAPE_NAMES[item]" :aria-pressed="shape === item && tool === 'place'" @click="shape = item; tool = 'place'">
              <svg viewBox="0 0 24 24"><path :d="ICONS[item]" /></svg>
            </button>
          </div>
          <div class="pop-wrap">
            <button class="finish" :aria-expanded="palette" @click="palette = !palette; gravityMenu = false"><i :style="{ background: currentMaterial.swatch }" /><span>{{ currentMaterial.name }}</span></button>
          </div>
          <div class="seg sizes">
            <button v-for="item in (['S', 'M', 'L'] as const)" :key="item" :aria-pressed="size === item" :aria-label="`Size ${item}`" @click="size = item">{{ item }}</button>
          </div>
          <div class="pop-wrap">
            <button class="finish" :aria-expanded="gravityMenu" @click="gravityMenu = !gravityMenu; palette = false">
              <svg viewBox="0 0 24 24"><path d="M12 4v13m-5-5 5 5 5-5M5 20h14" /></svg><span>{{ GRAVITY[gravity].name }}</span>
            </button>
          </div>
          <button class="clear" :disabled="!count" @click="clear">Clear<em v-if="count">{{ count }}</em></button>
          <button class="done" @click="creating = false">Done</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.spatial{position:absolute;inset:0;pointer-events:none;z-index:6}
.world,.ink{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.ink{z-index:1}
:where(.spatial) button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}
.spatial svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

.create{position:absolute;left:50%;bottom:22px;translate:-50% 0;width:max-content;pointer-events:auto;display:grid;justify-items:center;gap:10px;z-index:7300;max-width:calc(100% - 20px)}
.hint{margin:0;padding:7px 14px;border-radius:14px;font-size:12.5px;color:rgb(255 255 255 / .85);background:rgb(30 32 38 / .38);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);text-align:center}
.bar{display:flex;align-items:center;gap:8px;padding:8px;border-radius:30px;color:#fff;background:linear-gradient(180deg,rgb(255 255 255 / .17),rgb(255 255 255 / .06)),rgb(38 40 48 / .5);backdrop-filter:blur(40px) saturate(150%);-webkit-backdrop-filter:blur(40px) saturate(150%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .12),0 24px 60px rgb(0 0 0 / .35);max-width:100%;overflow-x:auto;scrollbar-width:none}
.seg{display:flex;padding:3px;gap:2px;border-radius:22px;background:rgb(0 0 0 / .18);flex:none}
.seg button{height:38px;min-width:38px;padding:0 13px;border-radius:19px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:13.5px;font-weight:600;transition:background .2s,color .2s}
.seg button:hover{background:rgb(255 255 255 / .12)}
.seg button[aria-pressed=true]{background:rgb(255 255 255 / .92);color:#17181c}
.sizes button{padding:0;width:38px}
.shapes{display:flex;gap:2px;flex:none;transition:opacity .3s}
.shapes.muted{opacity:.45}
.shapes button{width:40px;height:40px;border-radius:20px;display:grid;place-items:center;transition:background .2s,transform .2s}
.shapes button:hover{background:rgb(255 255 255 / .14);transform:translateY(-1px)}
.shapes button[aria-pressed=true]{background:rgb(255 255 255 / .92);color:#17181c}
.pop-wrap{position:relative;flex:none}
.finish{height:40px;padding:0 14px 0 8px;border-radius:20px;display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;background:rgb(255 255 255 / .1);transition:background .2s}
.finish:hover,.finish[aria-expanded=true]{background:rgb(255 255 255 / .2)}
.finish i{width:26px;height:26px;border-radius:50%;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .35),0 2px 6px rgb(0 0 0 / .3)}
.finish svg{margin-left:4px}
.palette{display:grid;justify-self:center;grid-template-columns:repeat(4,64px);gap:6px;padding:12px;border-radius:24px;background:linear-gradient(180deg,rgb(255 255 255 / .17),rgb(255 255 255 / .06)),rgb(38 40 48 / .72);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .14),0 24px 60px rgb(0 0 0 / .4)}
.palette button{display:grid;justify-items:center;gap:6px;padding:8px 2px;border-radius:14px;font-size:11.5px;font-weight:600;transition:background .2s}
.palette button:hover{background:rgb(255 255 255 / .1)}
.palette button[aria-pressed=true]{background:rgb(255 255 255 / .18)}
.palette i{width:34px;height:34px;border-radius:50%;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .35),0 3px 10px rgb(0 0 0 / .35)}
.palette.gravity{grid-template-columns:1fr;width:170px}
.palette.gravity button{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;font-size:14px}
.palette.gravity small{font-weight:500;opacity:.6;font-size:11.5px}
.clear,.done{height:40px;padding:0 15px;border-radius:20px;font-size:13.5px;font-weight:600;flex:none;display:flex;align-items:center;gap:7px;transition:background .2s}
.clear{background:rgb(255 255 255 / .1)}
.clear:hover:not(:disabled){background:rgb(255 255 255 / .2)}
.clear:disabled{opacity:.4;cursor:default}
.clear em{font-style:normal;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:rgb(255 255 255 / .2);font-size:12px;display:grid;place-items:center}
.done{background:#fff;color:#17181c}
.done:hover{background:#e9eaee}

.thing-ornament{position:absolute;translate:-50% calc(-100% - 10px);pointer-events:auto;display:flex;align-items:center;gap:4px;padding:6px;border-radius:24px;color:#fff;background:linear-gradient(180deg,rgb(255 255 255 / .18),rgb(255 255 255 / .06)),rgb(38 40 48 / .55);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .14),0 14px 40px rgb(0 0 0 / .35);z-index:7350;white-space:nowrap}
.thing-ornament button{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;transition:background .2s}
.thing-ornament button:hover{background:rgb(255 255 255 / .16)}
.thing-ornament .swatch{width:24px;height:24px;margin:0 2px;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .35)}
.thing-ornament .swatch[aria-pressed=true]{box-shadow:0 0 0 2px #fff}
.thing-ornament .danger{color:#ff6b61}
.thing-ornament i{width:1px;height:20px;background:rgb(255 255 255 / .18);margin:0 2px}
.drawing{cursor:crosshair}

.bar-enter-active,.bar-leave-active{transition:opacity .4s,translate .55s cubic-bezier(.2,.8,.2,1)}
.bar-enter-from,.bar-leave-to{opacity:0;translate:-50% 30px}
.pop-enter-active,.pop-leave-active{transition:opacity .25s,scale .3s cubic-bezier(.2,.8,.2,1)}
.pop-enter-from,.pop-leave-to{opacity:0;scale:.9}

.compact .bar{gap:5px;padding:6px}
.compact .seg button{height:34px;padding:0 10px;font-size:12.5px}
.compact .tools span{display:none}
.compact .shapes button{width:34px;height:34px}
.compact .finish span{display:none}
.compact .finish{padding:0 6px}
.compact .hint{font-size:11.5px}
</style>
