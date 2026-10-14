<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import WidgetFace from './widgets/WidgetFace.vue';

type Family = 'clock' | 'weather' | 'photos' | 'music' | 'calendar' | 'notes';
type Size = 'S' | 'M' | 'L';
type Finish = 'Paper' | 'Glass';
type Frame = 'Natural' | 'White' | 'Black' | 'Walnut';
type Appearance = { size: Size; finish: Finish; frame: Frame };
type Widget = Appearance & { id: string; family: Family; x: number; y: number; playing: boolean };
const props = defineProps<{ now: Date; compact: boolean; dark: boolean; immersed: boolean }>();
const emit = defineEmits<{ open: [appId: 'clock' | 'weather' | 'photos' | 'music' | 'notes'] }>();
const families: readonly Family[] = ['clock', 'weather', 'photos', 'music', 'calendar', 'notes'];
const sizes: readonly Size[] = ['S', 'M', 'L'];
const finishes: readonly Finish[] = ['Paper', 'Glass'];
const frames: readonly Frame[] = ['Natural', 'White', 'Black', 'Walnut'];
const titles: Record<Family, string> = { clock: 'Clock', weather: 'Weather', photos: 'Photos', music: 'Music Poster', calendar: 'Calendar', notes: 'Notes' };
const base: Record<Family, readonly [number, number]> = { clock: [230,230], weather: [250,260], photos: [290,220], music: [220,340], calendar: [270,265], notes: [270,270] };
const scales: Record<Size, number> = { S: .75, M: 1, L: 1.25 };
const STORAGE = 'lab-vision-widgets-v1';
const layer = ref<HTMLElement>();
const sheet = ref<HTMLElement>();
const widgets = ref<Widget[]>([]);
const gallery = ref(false);
const search = ref('');
const selected = ref<string | null>(null);
const dragging = ref<string | null>(null);
const placing = ref<Widget | null>(null);
const photoIndex = ref(0);
const sampledNow = ref(new Date(props.now));
const bounds = ref({ w: 1280, h: 720 });
const preferences = ref<Record<Family, Appearance>>({
  clock: { size: 'M', finish: 'Glass', frame: 'Natural' }, weather: { size: 'M', finish: 'Glass', frame: 'Natural' },
  photos: { size: 'M', finish: 'Paper', frame: 'White' }, music: { size: 'M', finish: 'Paper', frame: 'Black' },
  calendar: { size: 'M', finish: 'Glass', frame: 'White' }, notes: { size: 'M', finish: 'Paper', frame: 'Natural' },
});
const filtered = computed(() => families.filter(family => titles[family].toLowerCase().includes(search.value.toLowerCase())));
let observer: ResizeObserver | undefined;
let photoTimer = 0, hoverTimer = 0, clockTimer = 0;
let mounted = false;
let lastFocus: HTMLElement | null = null;
let drag: { widget: Widget; element: HTMLElement; pointerId: number; originX: number; originY: number; handle: HTMLElement | null; x: number; y: number; originalX: number; originalY: number } | null = null;
let ghostPosition = { x: .5, y: .4 };
watch(() => props.now.getTime(), () => {
  // A fast parent clock cannot make widget content tick more than once per second.
  if (!mounted || clockTimer) return;
  clockTimer = window.setTimeout(() => { sampledNow.value = new Date(props.now); clockTimer = 0; }, 1000);
});
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function valid(value: unknown): value is Widget {
  return record(value) && typeof value.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value.id)
    && families.some(f => f === value.family) && sizes.some(s => s === value.size)
    && finishes.some(f => f === value.finish) && frames.some(f => f === value.frame)
    && typeof value.x === 'number' && Number.isFinite(value.x) && value.x >= 0 && value.x <= 1
    && typeof value.y === 'number' && Number.isFinite(value.y) && value.y >= 0 && value.y <= 1
    && typeof value.playing === 'boolean';
}
function save() { try { localStorage.setItem(STORAGE, JSON.stringify({ version: 1, seeded: true, widgets: widgets.value })); } catch { /* Storage is optional in private sessions. */ } }
function make(family: Family, appearance: Appearance, x = .5, y = .4): Widget {
  return { id: 'w-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9), family, ...appearance, x, y, playing: false };
}
function load() {
  let seeded = false;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    if (record(value) && value.version === 1 && value.seeded === true && Array.isArray(value.widgets)) {
      seeded = true;
      const ids = new Set<string>();
      widgets.value = value.widgets.filter(valid).filter(item => { if (ids.has(item.id)) return false; ids.add(item.id); return true; }).slice(0,12);
    }
  } catch { /* Invalid JSON starts a fresh layout. */ }
  if (!seeded) widgets.value = [make('clock', { size: 'M', finish: 'Glass', frame: 'Natural' }, .14, .22)];
  save();
}
function dimensions(widget: Widget) {
  const scale = scales[widget.size] * (props.compact ? .7 : 1);
  const [w,h] = base[widget.family];
  return { w: w * scale, h: h * scale, scale };
}
function clamp(widget: Widget, x: number, y: number) {
  const d = dimensions(widget);
  return { x: Math.max(0, Math.min(x, Math.max(0, bounds.value.w - d.w - 6) / bounds.value.w)), y: Math.max(0, Math.min(y, Math.max(0, bounds.value.h - d.h - 60) / bounds.value.h)) };
}
function position(widget: Widget): CSSProperties {
  const d = dimensions(widget), p = clamp(widget,widget.x,widget.y);
  return { left: p.x * 100 + '%', top: p.y * 100 + '%', width: d.w + 'px', height: d.h + 'px', '--scale': d.scale, '--base-w': base[widget.family][0] + 'px', '--base-h': base[widget.family][1] + 'px' };
}
function toolbarPosition(widget: Widget): CSSProperties {
  const p = clamp(widget,widget.x,widget.y), d = dimensions(widget);
  const width = Math.min(316,bounds.value.w - 12);
  const left = Math.max(6, Math.min(p.x * bounds.value.w + (d.w - width) / 2, bounds.value.w - width - 6));
  return { width: width + 'px', left: (left - p.x * bounds.value.w) + 'px' };
}
function selectLater(id: string) { if (props.compact) return; window.clearTimeout(hoverTimer); hoverTimer = window.setTimeout(() => { selected.value = id; hoverTimer = 0; },300); }
function leave(event: PointerEvent, id: string) {
  window.clearTimeout(hoverTimer); hoverTimer = 0;
  if (!props.compact && !drag && selected.value === id && !(event.currentTarget instanceof HTMLElement && event.currentTarget.contains(document.activeElement))) selected.value = null;
}
function focusIn(id: string) { if (!props.compact) selected.value = id; }
function focusOut(event: FocusEvent) {
  if (event.currentTarget instanceof HTMLElement && event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
  if (!props.compact && !drag) selected.value = null;
}
function body(widget: Widget) {
  if (props.immersed || drag) return;
  if (props.compact && selected.value !== widget.id) { selected.value = widget.id; return; }
  if (widget.family === 'music') { widget.playing = !widget.playing; save(); }
  emit('open', widget.family === 'calendar' ? 'clock' : widget.family);
}
function change(widget: Widget, field: 'size' | 'finish' | 'frame') {
  if (field === 'size') widget.size = sizes[(sizes.indexOf(widget.size) + 1) % sizes.length] ?? 'M';
  else if (field === 'finish') widget.finish = widget.finish === 'Paper' ? 'Glass' : 'Paper';
  else widget.frame = frames[(frames.indexOf(widget.frame) + 1) % frames.length] ?? 'Natural';
  Object.assign(widget,clamp(widget,widget.x,widget.y)); save();
}
function remove(widget: Widget) { widgets.value = widgets.value.filter(w => w.id !== widget.id); selected.value = null; save(); }
async function openGallery() {
  if (props.immersed) return;
  cancelPlacement(); selected.value = null; search.value = ''; gallery.value = true;
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await nextTick(); sheet.value?.querySelector<HTMLInputElement>('input')?.focus();
}
defineExpose({ openGallery });
function closeGallery() { gallery.value = false; lastFocus?.focus(); }
async function add(family: Family, event: MouseEvent) {
  if (widgets.value.length >= 12) return;
  const widget = make(family,preferences.value[family]);
  if (props.compact || event.detail === 0 || window.matchMedia('(pointer: coarse)').matches) {
    const d = dimensions(widget); Object.assign(widget,clamp(widget,(bounds.value.w-d.w)/2/bounds.value.w,(bounds.value.h-d.h)/2/bounds.value.h));
    widgets.value.push(widget); save(); selected.value = widget.id; closeGallery(); return;
  }
  gallery.value = false; placing.value = widget;
  await nextTick(); moveGhost(event.clientX,event.clientY);
}
function moveGhost(clientX: number, clientY: number) {
  const widget = placing.value, rect = layer.value?.getBoundingClientRect();
  if (!widget || !rect) return;
  const d = dimensions(widget);
  ghostPosition = clamp(widget,(clientX-rect.left-d.w/2)/rect.width,(clientY-rect.top-d.h/2)/rect.height);
  const ghost = layer.value?.querySelector<HTMLElement>('.placement-preview');
  if (ghost) { ghost.style.left = ghostPosition.x*100+'%'; ghost.style.top = ghostPosition.y*100+'%'; }
}
function place(event: MouseEvent) {
  if (!placing.value || event.button !== 0 || props.immersed) return;
  moveGhost(event.clientX,event.clientY);
  widgets.value.push({ ...placing.value, ...ghostPosition }); selected.value = placing.value.id; placing.value = null; save();
}
function cancelPlacement() { placing.value = null; }
function startDrag(event: PointerEvent, widget: Widget) {
  if (event.button !== 0 || props.immersed) return;
  const element = layer.value?.querySelector<HTMLElement>('[data-widget="' + widget.id + '"]');
  if (!element) return;
  event.preventDefault(); event.stopPropagation();
  const p = clamp(widget,widget.x,widget.y);
  drag = { widget, element, pointerId:event.pointerId, originX:event.clientX, originY:event.clientY, handle:event.currentTarget instanceof HTMLElement ? event.currentTarget : null, x:p.x, y:p.y, originalX:p.x, originalY:p.y };
  dragging.value = widget.id; selected.value = widget.id;
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const rect = layer.value?.getBoundingClientRect(); if (!rect) return;
  const p = clamp(drag.widget,drag.originalX+(event.clientX-drag.originX)/rect.width,drag.originalY+(event.clientY-drag.originY)/rect.height);
  drag.x=p.x; drag.y=p.y; drag.element.style.left=p.x*100+'%'; drag.element.style.top=p.y*100+'%';
}
function endDrag(event?: PointerEvent, cancel = false) {
  if (!drag || (event && event.pointerId !== drag.pointerId)) return;
  const current = drag; drag = null; dragging.value = null;
  if (current.handle?.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  if (!cancel) { current.widget.x=current.x; current.widget.y=current.y; save(); }
  const p = clamp(current.widget,current.widget.x,current.widget.y); current.element.style.left=p.x*100+'%'; current.element.style.top=p.y*100+'%';
}
function moveKey(event: KeyboardEvent, widget: Widget) {
  const moves: Record<string, readonly [number,number]> = { ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10] };
  const step = moves[event.key]; if (!step) return;
  event.preventDefault(); event.stopPropagation();
  Object.assign(widget,clamp(widget,widget.x+step[0]/bounds.value.w,widget.y+step[1]/bounds.value.h)); save();
}
function keys(event: KeyboardEvent) {
  if (props.immersed) return;
  if (event.key === 'Escape' && (gallery.value || placing.value || drag || selected.value)) {
    event.preventDefault(); event.stopImmediatePropagation(); endDrag(undefined,true); cancelPlacement(); closeGallery(); selected.value = null;
  } else if (event.key === 'Tab' && gallery.value && sheet.value) {
    const controls = [...sheet.value.querySelectorAll<HTMLElement>('button:not(:disabled), input')];
    const first = controls[0], last = controls[controls.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
}
watch(() => props.immersed, immersed => { if (immersed) { endDrag(undefined,true); cancelPlacement(); gallery.value=false; selected.value=null; window.clearTimeout(hoverTimer); hoverTimer=0; } });
watch(() => props.compact, () => endDrag(undefined,true));
onMounted(() => {
  mounted=true; sampledNow.value=new Date(props.now); load();
  if (layer.value) {
    observer=new ResizeObserver(entries => { const r=entries[0]?.contentRect; if (r && r.width>0 && r.height>0) { endDrag(undefined,true); bounds.value={w:r.width,h:r.height}; } }); observer.observe(layer.value);
  }
  photoTimer=window.setInterval(() => { photoIndex.value=(photoIndex.value+1)%7; },12000);
  window.addEventListener('pointermove',pointerMove); window.addEventListener('pointerup',endDrag); window.addEventListener('pointercancel',cancelDrag); window.addEventListener('blur',cancelDrag);
  window.addEventListener('keydown',keys,true);
});
function cancelDrag() { endDrag(undefined,true); }
onBeforeUnmount(() => {
  mounted=false; observer?.disconnect(); window.clearInterval(photoTimer); window.clearTimeout(hoverTimer); window.clearTimeout(clockTimer);
  window.removeEventListener('pointermove',pointerMove); window.removeEventListener('pointerup',endDrag); window.removeEventListener('pointercancel',cancelDrag); window.removeEventListener('blur',cancelDrag); window.removeEventListener('keydown',keys,true);
  endDrag(undefined,true);
});
</script>

<template>
  <div ref="layer" class="widget-layer" :class="{ compact, dark, immersed }" :inert="immersed" :aria-hidden="immersed || undefined">
    <article v-for="widget in widgets" :key="widget.id" class="placed" :class="{ lifted: dragging === widget.id, selected: selected === widget.id }" :data-widget="widget.id" :style="position(widget)" @pointerenter="selectLater(widget.id)" @pointerleave="leave($event,widget.id)" @focusin="focusIn(widget.id)" @focusout="focusOut">
      <button class="widget-body" :aria-label="titles[widget.family] + (compact && selected !== widget.id ? ': tap to edit, tap again to open' : ': open app')" :aria-pressed="widget.family === 'music' ? widget.playing : undefined" @click.stop="body(widget)">
        <WidgetFace :family="widget.family" :finish="widget.finish" :frame="widget.frame" :now="sampledNow" :photo-index="photoIndex" :playing="widget.playing" />
      </button>
      <div v-if="selected === widget.id" class="toolbar" :style="toolbarPosition(widget)" role="toolbar" :aria-label="titles[widget.family] + ' customization'" @pointerdown.stop @click.stop>
        <button class="move" aria-label="Drag to move; arrow keys also move" title="Move" @pointerdown="startDrag($event,widget)" @keydown="moveKey($event,widget)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" /></svg></button>
        <button :aria-label="'Size ' + widget.size + ', cycle size'" @click="change(widget,'size')">{{ widget.size }}</button>
        <button :aria-label="'Finish ' + widget.finish + ', change finish'" @click="change(widget,'finish')">{{ widget.finish }}</button>
        <button class="frame-button" :aria-label="'Frame ' + widget.frame + ', cycle color'" :title="widget.frame + ' frame'" @click="change(widget,'frame')"><i :class="'dot-' + widget.frame.toLowerCase()" /></button>
        <button :aria-label="'Remove ' + titles[widget.family]" @click="remove(widget)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
    </article>
    <div v-if="placing" class="placement-surface" @pointermove="moveGhost($event.clientX,$event.clientY)" @pointerdown.stop @click.stop="place" @contextmenu.stop.prevent="cancelPlacement">
      <div class="placement-preview" :style="position(placing)"><div class="preview-content"><WidgetFace :family="placing.family" :finish="placing.finish" :frame="placing.frame" :now="sampledNow" :photo-index="photoIndex" /></div><span class="snap">Snap to surface</span></div>
      <p class="placement-hint">Click to place · Escape or right click to cancel</p>
    </div>
    <Transition name="sheet">
      <section v-if="gallery" ref="sheet" class="gallery" role="dialog" aria-modal="true" aria-label="Widget gallery" @pointerdown.stop @click.stop @wheel.stop>
        <header><div><small>MAKE ROOM FOR THE LITTLE THINGS</small><h2>Widgets</h2></div><button class="close" aria-label="Close gallery" @click="closeGallery"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
        <p>Quiet objects for your space. Choose a finish, then find a surface.</p>
        <input v-model="search" type="search" aria-label="Search widgets" placeholder="Search widgets" />
        <div class="gallery-grid">
          <article v-for="family in filtered" :key="family" class="gallery-item">
            <div class="gallery-preview"><div class="mini-face" :style="{ width: base[family][0] + 'px', height: base[family][1] + 'px', transform: 'scale(' + (.43 * scales[preferences[family].size]) + ')' }"><WidgetFace :family="family" :finish="preferences[family].finish" :frame="preferences[family].frame" :now="sampledNow" :photo-index="photoIndex" /></div></div>
            <b>{{ titles[family] }}</b>
            <div class="size-chips" :aria-label="titles[family] + ' size'"><button v-for="size in sizes" :key="size" :aria-pressed="preferences[family].size === size" @click="preferences[family].size = size">{{ size }}</button></div>
            <div class="finish-chips"><button v-for="finish in finishes" :key="finish" :aria-pressed="preferences[family].finish === finish" @click="preferences[family].finish = finish">{{ finish }}</button></div>
            <button class="add" :disabled="widgets.length >= 12" :aria-label="'Add ' + titles[family]" @click="add(family,$event)">Add <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
          </article>
        </div>
        <p v-if="!filtered.length">No widgets match that search.</p><footer>{{ widgets.length }} / 12 placed<span>{{ compact ? 'Tap Add to place in the centre.' : 'Hover a placed widget to customize it.' }}</span></footer>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.widget-layer{position:absolute;inset:0;pointer-events:none;color:#fff;font:400 15px/1.35 -apple-system,BlinkMacSystemFont,'SF Pro Text','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:-.015em;transition:opacity .45s ease;--sheet-color:rgb(40 43 50 / .86)}
.widget-layer :deep(*){box-sizing:border-box}.widget-layer button,.widget-layer input{font:inherit;letter-spacing:inherit}.widget-layer button{padding:0;border:0;background:none;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}.widget-layer button:focus-visible,.widget-layer input:focus-visible{outline:2px solid #fff;outline-offset:3px}.widget-layer svg{width:18px;height:18px;flex:none}
.placed{position:absolute;pointer-events:auto;transition:filter .25s;isolation:isolate}.widget-body{display:block!important;width:var(--base-w);height:var(--base-h);transform:scale(var(--scale));transform-origin:0 0}.lifted{filter:drop-shadow(0 20px 22px #0006);z-index:4}.selected{z-index:3}.placed::after{content:'';position:absolute;left:0;right:0;top:100%;height:12px}.toolbar{position:absolute;top:calc(100% + 8px);display:flex;align-items:center;justify-content:space-evenly;padding:4px 6px;gap:2px;border-radius:24px;color:#fff;pointer-events:auto;
background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .05)),rgb(45 48 54 / .7);backdrop-filter:blur(36px) saturate(125%);-webkit-backdrop-filter:blur(36px) saturate(125%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 12px 32px rgb(0 0 0 / .3);animation:rise .2s ease both}.toolbar button{min-width:36px;height:36px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:12px;padding:0 8px}.toolbar button:hover{background:#ffffff26}.toolbar .move{cursor:grab;touch-action:none}.toolbar .move:active{cursor:grabbing}.frame-button i{width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 1px #ffffff88}.dot-natural{background:#c6b39a}.dot-white{background:#eeeae4}.dot-black{background:#25262b}.dot-walnut{background:#76523c}
.placement-surface{position:absolute;inset:0;pointer-events:auto;z-index:7100;cursor:crosshair;touch-action:none}.placement-preview{position:absolute;border:2px dashed #d1d1d5;border-radius:28px;pointer-events:none;background:#7a7c821c;box-shadow:0 0 0 5px #93959b22}.preview-content{width:var(--base-w);height:var(--base-h);transform:scale(var(--scale));transform-origin:0 0;opacity:.55}.snap{position:absolute;bottom:-41px;left:50%;transform:translateX(-50%);padding:8px 15px;border-radius:20px;background:#575960d9;white-space:nowrap;font-size:12px;backdrop-filter:blur(20px)}.placement-hint{position:absolute;bottom:110px;left:50%;transform:translateX(-50%);font-size:13px;white-space:nowrap;background:#30333bdd;padding:10px 18px;border-radius:24px}
.gallery{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(740px,calc(100% - 24px));max-height:calc(100% - 110px);overflow:auto;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;z-index:7200;padding:28px;border-radius:40px;background:linear-gradient(135deg,rgb(255 255 255 / .2),rgb(255 255 255 / .05)),var(--sheet-color);backdrop-filter:blur(44px) saturate(130%);-webkit-backdrop-filter:blur(44px) saturate(130%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),inset 0 0 0 1px rgb(255 255 255 / .16),0 40px 110px rgb(0 0 0 / .5);scrollbar-width:thin}.dark{--sheet-color:rgb(25 28 35 / .92)}.dark :deep(.face.glass){background:linear-gradient(135deg,rgb(255 255 255 / .12),rgb(255 255 255 / .025)),rgb(28 31 39 / .68)}.gallery header{display:flex;align-items:center;justify-content:space-between;gap:14px}.gallery header small{font-size:9px;letter-spacing:.16em;opacity:.55}.gallery h2{margin:5px 0 0;font-size:30px;letter-spacing:-.035em}.gallery .close{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#ffffff16}.gallery>p{margin:10px 0 18px;font-size:14px;color:#ffffffb3}.gallery input{width:100%;height:42px;border:1px solid #ffffff1a;border-radius:18px;padding:0 15px;background:#0003;color:#fff;margin-bottom:16px;user-select:text;-webkit-user-select:text}.gallery input::placeholder{color:#ffffff8c}.gallery-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.gallery-item{padding:12px;border-radius:24px;background:#ffffff0b;display:flex;align-items:center;flex-direction:column;gap:8px}.gallery-preview{height:182px;width:100%;position:relative;display:flex;justify-content:center;align-items:center;pointer-events:none}.mini-face{flex:none;position:absolute;transform-origin:center}.gallery-item>b{font-size:15px;font-weight:600}.size-chips,.finish-chips{display:flex;justify-content:center;gap:3px;padding:3px;border-radius:16px;background:#0002}.size-chips button,.finish-chips button{height:28px;min-width:30px;padding:0 9px;border-radius:14px;font-size:12px}.size-chips button[aria-pressed=true],.finish-chips button[aria-pressed=true]{background:#ffffffd9;color:#202229}.gallery-item .add{display:flex;justify-content:center;align-items:center;gap:6px;width:100%;height:35px;background:#ffffff18;border-radius:18px;font-size:13px;font-weight:600}.gallery-item .add:hover{background:#ffffff30}.gallery-item .add:disabled{opacity:.35;cursor:default}.gallery footer{display:flex;justify-content:space-between;gap:12px;margin-top:19px;color:#ffffff8c;font-size:11px}
.immersed{opacity:0;pointer-events:none}.immersed :deep(*){pointer-events:none!important}.immersed :deep(.sky),.immersed :deep(.cloud),.immersed :deep(.stars),.immersed :deep(.equalizer i){animation-play-state:paused!important}.compact .gallery{padding:18px;border-radius:30px;max-height:calc(100% - 90px)}.compact .gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.compact .gallery-item{padding:10px}.compact .gallery-preview{height:160px}.compact .gallery footer{flex-direction:column;gap:4px}.sheet-enter-active,.sheet-leave-active{transition:opacity .25s,translate .35s cubic-bezier(.2,.9,.2,1)}.sheet-enter-from,.sheet-leave-to{opacity:0;translate:0 18px}@keyframes rise{from{opacity:0;translate:0 -5px}to{opacity:1;translate:0 0}}
@media(prefers-reduced-motion:reduce){.widget-layer,.widget-layer *{animation:none!important;transition:none!important}}
</style>
