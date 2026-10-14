<script setup lang="ts">
import WatchGlyph from "./WatchGlyph.vue";
import { WATCH_APPS, useWatch, type WatchAppId } from './watch';
import WatchIcon from './WatchIcon.vue';
const emit = defineEmits<{
  open: [id: WatchAppId, event: MouseEvent];
}>();
const watch = useWatch();
const sorted = [...WATCH_APPS].sort((a, b) => a.name.localeCompare(b.name));

// The honeycomb: rows of four and three, offset like cells, every app exactly once.
const SCREEN = { width: 422, height: 514 };
const ICON = 84;
const GAP_X = 98;
const ROW = 86;
const TOP = 168;
const cells = (() => {
  const list: { id: WatchAppId; name: string; x: number; y: number }[] = [];
  let index = 0;
  for (let row = 0; index < WATCH_APPS.length; row++) {
    const count = row % 2 ? 3 : 4;
    for (let column = 0; column < count && index < WATCH_APPS.length; column++, index++) {
      const app = WATCH_APPS[index]!;
      list.push({ id: app.id, name: app.name, x: SCREEN.width / 2 + (column - (count - 1) / 2) * GAP_X, y: TOP + row * ROW });
    }
  }
  return list;
})();
const contentHeight = (cells.at(-1)?.y ?? 0) + 230;

const viewport = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
let frame = 0;
function track(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    scrollTop.value = viewport.value?.scrollTop ?? 0;
  });
}
// Icons are full size near the middle of the screen and shrink and draw inward towards the rim,
// the fisheye that makes the real grid feel like a dome under glass.
const placed = computed(() => cells.map(cell => {
  const dx = (cell.x - SCREEN.width / 2) / 196;
  const dy = (cell.y - scrollTop.value - SCREEN.height / 2 - 18) / 250;
  const distance = Math.hypot(dx, dy);
  const scale = distance < 0.56 ? 1 : Math.max(0.34, 1 - (distance - 0.56) * 0.95);
  const pull = (1 - scale) * 0.32;
  return {
    ...cell,
    style: {
      left: cell.x + 'px',
      top: cell.y + 'px',
      transform: 'translate(-50%, -50%) translate(' + (-dx * 196 * pull) + 'px, ' + (-dy * 250 * pull) + 'px) scale(' + scale + ')',
      opacity: String(Math.min(1, scale * 1.6 - 0.2)),
    },
  };
}));

// Mouse users can drag the grid like a finger would.
let drag: { id: number; y: number; top: number; moved: boolean } | null = null;
let suppressClick = false;
function panStart(event: PointerEvent): void {
  if (event.button !== 0 || !event.isPrimary || !viewport.value || event.pointerType === 'touch') return;
  drag = { id: event.pointerId, y: event.clientY, top: viewport.value.scrollTop, moved: false };
  suppressClick = false;
}
function panMove(event: PointerEvent): void {
  if (!drag || drag.id !== event.pointerId || !viewport.value) return;
  if (Math.abs(event.clientY - drag.y) < 6) return;
  drag.moved = true;
  const scale = viewport.value.getBoundingClientRect().width / SCREEN.width;
  viewport.value.scrollTop = drag.top - (event.clientY - drag.y) / scale;
}
function panEnd(): void {
  if (drag?.moved) suppressClick = true;
  drag = null;
}
function blockDragClick(event: MouseEvent): void {
  if (!suppressClick) return;
  event.preventDefault();
  event.stopPropagation();
  suppressClick = false;
}
onMounted(() => {
  window.addEventListener('pointermove', panMove);
  window.addEventListener('pointerup', panEnd);
  window.addEventListener('pointercancel', panEnd);
  track();
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('pointermove', panMove);
  window.removeEventListener('pointerup', panEnd);
  window.removeEventListener('pointercancel', panEnd);
});
</script>

<template>
  <section
    ref="viewport"
    class="app-view"
    :class="watch.settings.appView"
    data-watch-scroll
    aria-label="Watch apps"
    @pointerdown="panStart"
    @click.capture="blockDragClick"
    @scroll.passive="track"
  >
    <template v-if="watch.settings.appView === 'list'">
      <h1>Apps</h1>
      <button
        v-for="app in sorted"
        :key="app.id"
        class="app-row"
        @click="emit('open', app.id, $event)"
      >
        <WatchIcon :name="app.id" :size="58" />
        <span>
          {{ app.name }}
        </span>
        <span class="chevron">
          <WatchGlyph name="next" />
        </span>
      </button>
    </template>
    <div
      v-else
      class="honeycomb"
      :style="{ height: contentHeight + 'px' }"
    >
      <button
        v-for="app in placed"
        :key="app.id"
        class="app-orb"
        :aria-label="app.name"
        :title="app.name"
        :style="app.style"
        @click="emit('open', app.id, $event)"
      >
        <WatchIcon :name="app.id" :size="ICON" />
      </button>
    </div>
    <button class="view-toggle" @click="watch.settings.appView = watch.settings.appView === 'grid' ? 'list' : 'grid'">
      <WatchGlyph :name="watch.settings.appView === 'grid' ? 'list' : 'grid'" />
      {{ watch.settings.appView === 'grid' ? 'List View' : 'Grid View' }}
    </button>
  </section>
</template>

<style scoped>
.app-view {
  position: absolute;
  inset: 0;
  background: #000;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  border-radius: inherit;
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
  touch-action: pan-y;
}

.app-view.list {
  padding: 98px 22px 40px;
}

.app-view :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: 34px;
  padding-left: 8px;
  margin: 0 0 14px;
}

.app-row {
  width: 100%;
  min-height: 84px;
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
  border: 0;
  padding: 10px 18px 10px 12px;
  font-size: 26px;
  font-weight: 550;
  background: #1c1c1e;
  border-radius: 30px;
  margin: 8px 0;
  transition: transform 140ms ease, background 160ms ease;
}

.app-row:hover {
  background: #262629;
}

.app-row:active {
  transform: scale(0.97);
}

.app-row :deep(svg) {
  flex-shrink: 0;
}

.chevron {
  margin-left: auto;
  color: #6e6e74;
}

.honeycomb {
  position: relative;
  width: 422px;
}

.app-orb {
  position: absolute;
  display: grid;
  place-items: center;
  width: 92px;
  height: 92px;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  will-change: transform;
  transition: filter 160ms ease;
}

.app-orb:hover {
  filter: brightness(1.12);
}

.app-orb:active :deep(svg) {
  transform: scale(0.88);
}

.app-orb :deep(svg) {
  border-radius: 50%;
  transition: transform 140ms ease;
  box-shadow: 0 6px 16px #0009;
}

.view-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: calc(100% - 64px);
  min-height: 70px;
  margin: 0 32px 64px;
  border: 0;
  border-radius: 36px;
  background: #1f1f22;
  box-shadow: inset 0 1px 0 #ffffff1a;
  font-size: 25px;
  font-weight: 600;
}

.list .view-toggle {
  width: 100%;
  margin: 14px 0 30px;
}

.view-toggle :deep(svg) {
  width: 24px;
  height: 24px;
}
</style>
