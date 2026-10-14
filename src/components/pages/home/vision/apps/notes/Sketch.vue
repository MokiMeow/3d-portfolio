<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { vHover } from '../../kit/hover';
import AppIcon from '../music/AppIcon.vue';
import { INK_COLORS, type InkStroke, type InkPoint } from './model';
const props = defineProps<{ strokes: InkStroke[] }>();
const emit = defineEmits<{ change: [strokes: InkStroke[]] }>();
const canvas = ref<HTMLCanvasElement>();
const tool = ref<InkStroke['tool']>('pen');
const color = ref(INK_COLORS[0] ?? '#17191e');
const tools = [{ id: 'pen', label: 'Pen' }, { id: 'marker', label: 'Marker' },
  { id: 'eraser', label: 'Eraser' }] as const;
let observer: ResizeObserver | undefined;
let pending: InkStroke | undefined;
let pointer: number | undefined;
function draw(): void {
  const element = canvas.value;
  const ctx = element?.getContext('2d');
  if (!ctx || !element) return;
  ctx.clearRect(0, 0, element.width, element.height);
  const scale = element.width / Math.max(1, element.clientWidth);
  for (const stroke of [...props.strokes, ...(pending ? [pending] : [])]) {
    const first = stroke.points[0];
    if (!first) continue;
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = stroke.tool === 'marker' ? 0.32 : 1;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = (stroke.tool === 'eraser' ? 22 : stroke.tool === 'marker' ? 13 : 2.8) * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(first.x * element.width, first.y * element.height);
    for (const point of stroke.points.slice(1)) ctx.lineTo(point.x * element.width, point.y * element.height);
    if (stroke.points.length === 1) {
      ctx.arc(first.x * element.width, first.y * element.height, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function resize(): void {
  const element = canvas.value;
  if (!element) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  element.width = Math.max(1, Math.round(element.clientWidth * ratio));
  element.height = Math.max(1, Math.round(element.clientHeight * ratio));
  draw();
}
function point(event: PointerEvent): InkPoint {
  const rect = canvas.value?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width))),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height))) };
}
function start(event: PointerEvent): void {
  if (pointer !== undefined || props.strokes.length >= 160 || event.button !== 0) return;
  pointer = event.pointerId;
  pending = { tool: tool.value, color: color.value, points: [point(event)] };
  canvas.value?.setPointerCapture(pointer);
  draw();
}
function move(event: PointerEvent): void {
  if (event.pointerId !== pointer || !pending || pending.points.length >= 1200) return;
  pending.points.push(point(event));
  draw();
}
function end(event?: PointerEvent): void {
  if (event && event.pointerId !== pointer) return;
  const stroke = pending;
  const captured = pointer;
  // Release can dispatch lostpointercapture before this handler returns.
  pending = undefined;
  pointer = undefined;
  if (stroke) emit('change', [...props.strokes, stroke]);
  if (captured !== undefined && canvas.value?.hasPointerCapture(captured)) canvas.value.releasePointerCapture(captured);
  draw();
}
function undo(): void { emit('change', props.strokes.slice(0, -1)); }
function clear(): void { emit('change', []); }
watch(() => props.strokes, draw, { deep: true });
onMounted(() => { resize(); observer = new ResizeObserver(resize); if (canvas.value) observer.observe(canvas.value); });
onBeforeUnmount(() => {
  observer?.disconnect();
  const captured = pointer;
  pending = undefined;
  pointer = undefined;
  if (captured !== undefined && canvas.value?.hasPointerCapture(captured)) canvas.value.releasePointerCapture(captured);
  if (canvas.value) { canvas.value.width = 0; canvas.value.height = 0; }
});
</script>

<template>
  <section class="sketch" aria-label="Note sketch">
    <div class="sketch-tools vk-ornament vk-scroll" aria-label="Drawing tools">
      <button v-for="item in tools" :key="item.id" v-hover class="vk-icon" :aria-label="item.label"
        :title="item.label" :aria-pressed="tool === item.id" @click="tool = item.id"><AppIcon :name="item.id" /></button>
      <span class="tool-divider" />
      <button v-for="shade in INK_COLORS" :key="shade" v-hover class="vk-icon swatch" :aria-label="'Ink colour ' + shade"
        :style="{ '--ink': shade }" :title="'Ink ' + shade" :aria-pressed="color === shade" @click="color = shade"><span /></button>
      <button v-hover class="vk-icon" aria-label="Undo last stroke" title="Undo stroke" :disabled="!strokes.length" @click="undo"><AppIcon name="undo" /></button>
      <button v-hover class="vk-icon" aria-label="Clear sketch" title="Clear sketch" :disabled="!strokes.length" @click="clear"><AppIcon name="close" /></button>
    </div>
    <canvas ref="canvas" v-hover aria-label="Draw with pointer or touch" class="ink-surface" @pointerdown.prevent="start"
      @pointermove.prevent="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end" />
    <p class="sketch-tip">{{ strokes.length >= 160 ? 'Sketch full. Undo a stroke to keep drawing.' : 'A small space for a big idea. Draw with your pointer.' }}</p>
  </section>
</template>

<style scoped>
.sketch { font-family: inherit; margin: 14px 0 20px; }
.sketch :deep(*) { font-family: inherit; }
.sketch-tools { max-width: 100%; justify-content: flex-start; overflow-x: auto; border-radius: 24px; }
.sketch-tools button { flex: 0 0 44px; }
.swatch span { width: 23px; height: 23px; border-radius: 50%; background: var(--ink); border: 1px solid #ffffff80; }
.swatch[aria-pressed='true'] span { box-shadow: 0 0 0 3px #222, 0 0 0 5px #fff; }
.tool-divider { width: 1px; height: 24px; background: #ffffff40; flex: 0 0 1px; margin: 0 5px; }
.ink-surface { width: 100%; height: 260px; display: block; background: #fffdf5; margin-top: 12px;
  border: 1px solid #d5cebd; border-radius: 16px; touch-action: none; cursor: crosshair; }
.sketch-tip { font-size: 14px; color: #746e61; margin: 8px 0 0; }
:focus-visible { outline: 2px solid #ffd60a; outline-offset: 3px; }
</style>
