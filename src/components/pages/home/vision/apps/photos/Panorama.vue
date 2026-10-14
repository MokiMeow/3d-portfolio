<script setup lang="ts">
import { vHover } from '../../kit/hover';
const props = defineProps<{ src: string; title: string }>();
const canvas = ref<HTMLCanvasElement | null>(null);
const surface = ref<HTMLElement | null>(null);
const yaw = ref(0);
const pitch = ref(0);
const status = ref('Loading the panorama...');
let image: HTMLImageElement | undefined;
let observer: ResizeObserver | undefined;
let frame = 0;
let disposed = false;
let generation = 0;
let drag: { id: number; x: number; y: number; yaw: number; pitch: number } | undefined;

// Narrow perspective strips turn the equirectangular photo into a continuous cylinder.
function draw(): void {
  frame = 0;
  const element = canvas.value;
  const context = element?.getContext('2d');
  if (!element || !context || !image?.complete || !image.naturalWidth) return;
  const width = Math.min(1400, Math.max(1, element.clientWidth));
  const height = Math.min(900, Math.max(1, element.clientHeight));
  if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
  const focal = width * .65;
  context.clearRect(0, 0, width, height);
  for (let x = 0; x < width; x += 4) {
    const angle = Math.atan((x - width / 2) / focal);
    const sourceX = (((yaw.value / 360 + angle / (2 * Math.PI)) % 1 + 1) % 1) * image.naturalWidth;
    const angularWidth = Math.atan((x + 4 - width / 2) / focal) - angle;
    const sourceWidth = Math.max(1, image.naturalWidth * angularWidth / (2 * Math.PI));
    const sourceHeight = Math.min(image.naturalHeight, image.naturalWidth * height / (focal * 2 * Math.PI) * Math.cos(angle));
    const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight,
      image.naturalHeight * (.5 + pitch.value / 180) - sourceHeight / 2));
    const first = Math.min(sourceWidth, image.naturalWidth - sourceX);
    const destinationWidth = 4 * first / sourceWidth;
    context.drawImage(image, sourceX, sourceY, first, sourceHeight, x, 0, destinationWidth, height);
    if (first < sourceWidth) {
      context.drawImage(image, 0, sourceY, sourceWidth - first, sourceHeight, x + destinationWidth, 0, 4 - destinationWidth, height);
    }
  }
}
function schedule(): void {
  if (!disposed && !frame) frame = requestAnimationFrame(draw);
}
function load(): void {
  const current = ++generation;
  if (image) { image.onload = null; image.onerror = null; }
  status.value = 'Loading the panorama...';
  yaw.value = 0;
  pitch.value = 0;
  image = new Image();
  image.onload = () => {
    if (disposed || current !== generation) return;
    status.value = '';
    schedule();
  };
  image.onerror = () => {
    if (!disposed && current === generation) status.value = 'The panorama could not load. Try another photo.';
  };
  image.src = props.src;
}
function begin(event: PointerEvent): void {
  if (event.button !== 0) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: yaw.value, pitch: pitch.value };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function move(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.id) return;
  const width = surface.value?.getBoundingClientRect().width ?? 1;
  yaw.value = drag.yaw - (event.clientX - drag.x) / width * 90;
  pitch.value = Math.max(-40, Math.min(40, drag.pitch + (event.clientY - drag.y) / width * 60));
  schedule();
}
function end(): void { drag = undefined; }
function keys(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') { yaw.value = 0; pitch.value = 0; }
  if (event.key === 'ArrowLeft') yaw.value -= 8;
  if (event.key === 'ArrowRight') yaw.value += 8;
  if (event.key === 'ArrowUp') pitch.value = Math.max(-40, pitch.value - 5);
  if (event.key === 'ArrowDown') pitch.value = Math.min(40, pitch.value + 5);
  schedule();
}
watch(() => props.src, load);
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(schedule);
    if (surface.value) observer.observe(surface.value);
  }
  window.addEventListener('resize', schedule);
  load();
});
onBeforeUnmount(() => {
  disposed = true;
  ++generation;
  observer?.disconnect();
  window.removeEventListener('resize', schedule);
  cancelAnimationFrame(frame);
  drag = undefined;
  if (image) { image.onload = null; image.onerror = null; image.src = ''; }
});
</script>
<template>
  <div ref="surface" v-hover class="panorama" tabindex="0" role="group" :aria-label="title + ', panorama. Drag or use arrow keys to look around.'"
    @pointerdown="begin" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end" @keydown="keys">
    <canvas ref="canvas" :aria-label="title" role="img" />
    <div v-if="status" class="status" role="status">{{ status }}</div>
    <span class="compass">{{ ((Math.round(yaw) % 360) + 360) % 360 }}° · Drag to look around</span>
  </div>
</template>
<style scoped>
.panorama {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 26px;
  touch-action: none;
  cursor: grab;
  background: #172430;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.panorama :deep(*) {
  font-family: inherit;
}
.panorama:active {
  cursor: grabbing;
}
.panorama:focus-visible {
  outline: 2px solid white;
  outline-offset: -4px;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.status {
  position: absolute;
  inset: 0;
  padding: 30px;
  display: grid;
  place-items: center;
  text-align: center;
  background: #172430;
}
.compass {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 20px;
  background: rgb(0 0 0 / .55);
  color: white;
  font-size: 13px;
  max-width: calc(100% - 24px);
  text-align: center;
  white-space: normal;
  pointer-events: none;
}
</style>
