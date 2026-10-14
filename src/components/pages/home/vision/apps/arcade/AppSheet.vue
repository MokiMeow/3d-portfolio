<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { vHover } from '../../kit/hover';
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement>();
let previous: HTMLElement | null = null;
onMounted(() => { previous = document.activeElement instanceof HTMLElement ? document.activeElement : null; panel.value?.focus(); });
onBeforeUnmount(() => { if (previous?.isConnected) previous.focus(); });
function trap(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const items = Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]') ?? []).filter(item => item.getClientRects().length);
  const first = items[0], last = items[items.length - 1];
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first.focus(); }
}
</script>
<template>
  <div class="sheet-shade" @click.self="emit('close')">
    <section ref="panel" class="app-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @keydown="trap">
      <header><h2 class="vk-title">{{ title }}</h2><button v-hover class="vk-icon" aria-label="Dismiss sheet" @click="emit('close')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
      <slot />
    </section>
  </div>
</template>
<style scoped>
.sheet-shade { position: absolute; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px; background: #080b166b; backdrop-filter: blur(12px); border-radius: inherit; }
.app-sheet { width: min(100%, 480px); max-height: 100%; box-sizing: border-box; padding: 24px !important; color: white; }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
h2 { margin: 0; } button { border: 0; cursor: pointer; font: inherit; flex: none; } :focus-visible { outline: 2px solid white; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { .app-sheet { animation: none !important; } }
</style>
