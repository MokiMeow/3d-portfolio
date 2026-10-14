<script setup lang="ts">
import WatchGlyph from "./WatchGlyph.vue";
import { WATCH_APPS, useWatch, type WatchAppId } from './watch';
import WatchIcon from './WatchIcon.vue';
defineProps<{
  zoom: number;
}>();
const emit = defineEmits<{
  open: [id: WatchAppId, event: MouseEvent];
}>();
const watch = useWatch();
const sorted = [...WATCH_APPS].sort((a, b) => a.name.localeCompare(b.name));
const positions = WATCH_APPS.map((app, index) => ({
  ...app,
  x: 48 + index % 4 * 88 + (Math.floor(index / 4) % 2 ? 44 : 0),
  y: 40 + Math.floor(index / 4) * 78
}));

const viewport = ref<HTMLElement | null>(null);
const panX = ref(0);
let drag: { id: number; x: number; y: number; top: number; pan: number; moved: boolean } | null = null;
let suppressClick = false;
function panStart(event: PointerEvent): void {
  if (event.button !== 0 || !event.isPrimary || !viewport.value) return;
  if (event.pointerType === 'touch' && watch.settings.appView === 'list') return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, top: viewport.value.scrollTop, pan: panX.value, moved: false };
  suppressClick = false;
}
function panMove(event: PointerEvent): void {
  if (!drag || drag.id !== event.pointerId || !viewport.value) return;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
  drag.moved = true;
  const scale = viewport.value.getBoundingClientRect().width / 422;
  viewport.value.scrollTop = drag.top - (event.clientY - drag.y) / scale;
  if (watch.settings.appView === 'grid') panX.value = Math.min(100, Math.max(-100, drag.pan + (event.clientX - drag.x) / scale));
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
});
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', panMove);
  window.removeEventListener('pointerup', panEnd);
  window.removeEventListener('pointercancel', panEnd);
});
</script>

<template>
  <section
    ref="viewport"
    @pointerdown.stop="panStart"
    @click.capture="blockDragClick"
    class="app-view"
    data-watch-scroll
    aria-label="Watch apps"
  >
    <template v-if="watch.settings.appView === 'list'">
      <h1>Apps</h1>
      <button
        v-for="app in sorted"
        :key="app.id"
        class="app-row"
        @click="emit('open', app.id, $event)"
      >
        <WatchIcon :name="app.id" :size="64" />
        <span>
          {{ app.name }}
        </span>
        <span class="chevron">
          <WatchGlyph name="next" />
        </span>
      </button>
    </template>
    <template v-else>
      <div class="suggested">
        <span>SUGGESTED APPS</span>
        <div>
          <button
            v-for="app in WATCH_APPS.slice(0, 5)"
            :key="app.id"
            :aria-label="app.name"
            @click="emit('open', app.id, $event)"
          >
            <WatchIcon :name="app.id" :size="64" />
          </button>
        </div>
      </div>
      <div class="honey-space" :style="{ height: (940 * zoom) + 'px' }">
        <div class="honeycomb" :style="{ transform: 'translateX(' + panX + 'px) scale(' + zoom + ')' }">
          <button
            v-for="app in positions"
            :key="app.id"
            class="app-orb"
            :aria-label="app.name"
            :title="app.name"
            :style="{ left: app.x + 'px', top: app.y + 'px' }"
            @click="emit('open', app.id, $event)"
          >
            <WatchIcon :name="app.id" :size="80" />
          </button>
        </div>
      </div>
    </template>
    <button class="view-toggle" @click="watch.settings.appView = watch.settings.appView === 'grid' ? 'list' : 'grid'">
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
  padding: 76px 16px 64px;
  scroll-padding-block: 76px;
  border-radius: inherit;
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.app-view :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: 36px;
  padding-left: 16px;
  margin: 12px 0 20px;
}

.app-row {
  width: 100%;
  min-height: 94px;
  display: flex;
  align-items: center;
  gap: 18px;
  text-align: left;
  border: 0;
  padding: 14px 10px;
  font-size: 26px;
  background: #161618;
  border-radius: 32px;
  margin: 8px 0;
}

.app-row :deep(svg) {
  flex-shrink: 0;
}

.chevron {
  margin-left: auto;
  color: #85858a;
}

.suggested {
  text-align: center;
  margin: 2px 0 6px;
}

.suggested > span {
  font-size: max(21px, calc(12px / var(--watch-scale)));
  letter-spacing: 1px;
  color: #8e8e98;
}

.suggested > div {
  display: flex;
  justify-content: center;
  margin-top: 14px;
  gap: 4px;
}

.suggested button {
  display: grid;
  place-items: center;
  background: transparent;
  border: 0;
  padding: 0;
  width: 74px;
  height: 78px;
}

.honey-space {
  touch-action: none;
  position: relative;
  margin-left: -16px;
}

.honeycomb {
  position: absolute;
  left: 0;
  top: 0;
  width: 422px;
  height: 940px;
  transform-origin: 211px 0;
  transition: transform 240ms ease-out;
}

.app-orb {
  position: absolute;
  display: grid;
  place-items: center;
  width: 90px;
  height: 90px;
  background: transparent;
  padding: 0;
  border: 0;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: transform 240ms ease, opacity 240ms ease;
}

.app-orb:hover {
  opacity: 0.8;
}

.app-orb:active {
  transform: translate(-50%, -50%) scale(0.9);
}

.view-toggle {
  width: 100%;
  min-height: 80px;
  border: 1px solid #ffffff30;
  border-radius: 44px;
  background: #222225;
  font-size: 28px;
}

@media (prefers-reduced-motion: reduce) {
  .honeycomb {
    transition: none;
  }
}
</style>
