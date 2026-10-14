<script setup lang="ts">
import WatchIcon from '../WatchIcon.vue';
import { WATCH_APPS, timeText, type WatchNotification } from '../watch';
const props = defineProps<{ note: WatchNotification; hour24: boolean }>();
const emit = defineEmits<{ open: []; clear: [] }>();
const appName = computed(() => WATCH_APPS.find(app => app.id === props.note.app)?.name || props.note.app);
const offset = ref(0);
const dragging = ref(false);
let startX = 0;
let startY = 0;
let startOffset = 0;
let moved = false;
let scale = 1;
function down(event: PointerEvent) {
  if (event.button !== 0) return;
  startX = event.clientX; startY = event.clientY;
  startOffset = offset.value; moved = false; dragging.value = true;
  scale = 378 / (event.currentTarget as HTMLElement).getBoundingClientRect().width;
}
function move(event: PointerEvent) {
  if (!dragging.value) return;
  const dx = (event.clientX - startX) * scale;
  const dy = (event.clientY - startY) * scale;
  if (!moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { dragging.value = false; return; }
  if (Math.abs(dx) > 8) {
    moved = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    offset.value = Math.max(0, Math.min(102, startOffset - dx));
  }
}
function end(event: PointerEvent, cancel = false) {
  dragging.value = false;
  offset.value = cancel ? startOffset : offset.value > 46 ? 102 : 0;
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
}
function open(event: MouseEvent) { if (!moved || event.detail === 0) emit('open'); }
</script>
<template>
  <article class="notification-card">
    <button class="clear" :tabindex="offset === 102 ? 0 : -1" :aria-hidden="offset !== 102" :aria-label="'Clear ' + note.title" @click="emit('clear')">Clear</button>
    <button class="notification-front" :class="{ dragging }" :style="{ transform: 'translateX(-' + offset + 'px)' }" :aria-label="note.title + '. ' + note.text" aria-description="Swipe left or press Left Arrow to reveal Clear." @pointerdown="down" @pointermove="move" @pointerup="end($event)" @pointercancel="end($event, true)" @click="open" @keydown.left.prevent.stop="offset=102" @keydown.right.prevent.stop="offset=0">
      <span class="note-meta"><WatchIcon :name="note.app" :size="36" /><span class="app-name">{{ appName }}</span><time :datetime="new Date(note.at).toISOString()">{{ timeText(new Date(note.at), hour24) }}</time></span>
      <strong>{{ note.title }}</strong><span class="note-body">{{ note.text }}</span>
    </button>
  </article>
</template>
<style scoped>
.notification-card { position:relative; overflow:hidden; border-radius:30px; margin-bottom:10px; background:#ff453a; }
.notification-front { position:relative; display:flex; flex-direction:column; gap:10px; width:100%; padding:18px 20px; border:0; border-radius:30px; background:#1c1c1e; color:white; text-align:left; touch-action:pan-y; transition:transform 160ms ease; }
.notification-front.dragging { transition:none; }
.note-meta { display:flex; align-items:center; gap:8px; width:100%; }
.note-meta :deep(svg) { width:36px; height:36px; flex:0 0 36px; }
.app-name { flex:1; min-width:0; font-size:18px; font-weight:650; letter-spacing:.6px; text-transform:uppercase; line-height:1.25; }
time { flex-shrink:0; color:#ffffff99; font-size:18px; }
strong { font-size:24px; font-weight:700; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.note-body { font-size:20px; line-height:1.25; color:#ffffffb3; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.clear { position:absolute; inset:0 0 0 auto; width:102px; border:0; background:#ff453a; color:white; font-size:22px; font-weight:600; }
button:focus-visible { outline:3px solid white; outline-offset:-4px; }
@media (prefers-reduced-motion:reduce) { .notification-front { transition:none; } }
</style>