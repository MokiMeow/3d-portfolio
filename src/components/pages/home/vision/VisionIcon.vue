<script setup lang="ts">
import { APP_ICONS } from '../icons/app-icons';
import type { VisionAppId } from './vision';

const props = defineProps<{ name: VisionAppId }>();
const uid = 'vision-icon-' + useId().replace(/[^a-zA-Z0-9_-]/g, '-');
const hovered = ref(false);
let button: HTMLButtonElement | null = null;
const element = useTemplateRef<SVGSVGElement>('icon');

function enter(): void {
  hovered.value = true;
}

function leave(): void {
  hovered.value = false;
}

onMounted(() => {
  // Only the nearest button controls depth, even inside other interactive regions.
  button = element.value?.closest('button') ?? null;
  button?.addEventListener('pointerenter', enter);
  button?.addEventListener('pointerleave', leave);
  button?.addEventListener('pointercancel', leave);
  button?.addEventListener('focus', enter);
  button?.addEventListener('blur', leave);
});

onBeforeUnmount(() => {
  button?.removeEventListener('pointerenter', enter);
  button?.removeEventListener('pointerleave', leave);
  button?.removeEventListener('pointercancel', leave);
  button?.removeEventListener('focus', enter);
  button?.removeEventListener('blur', leave);
  button = null;
});

const markup = computed(() => {
  const artwork = APP_ICONS[props.name](uid);
  return `
    <defs>
      <clipPath id="${uid}-clip"><circle cx="50" cy="50" r="49.5"/></clipPath>
      <linearGradient id="${uid}-shade" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#fff" stop-opacity=".16"/>
        <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".78" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".16"/>
      </linearGradient>
      <linearGradient id="${uid}-rim" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#fff" stop-opacity=".78"/>
        <stop offset="1" stop-color="#fff" stop-opacity=".05"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#${uid}-clip)">
      <g class="vision-plate">${artwork.background}</g>
      <g class="vision-glyph">
        <g transform="translate(4 4) scale(.92)">${artwork.svg}</g>
      </g>
      <rect width="100" height="100" fill="url(#${uid}-shade)" pointer-events="none"/>
      <path d="M12 21a48.2 48.2 0 0 1 76 0" fill="none" stroke="url(#${uid}-rim)"
        stroke-width="1.25" stroke-linecap="round" pointer-events="none"/>
      <circle cx="50" cy="50" r="49" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".7"/>
    </g>
  `;
});
</script>

<template>
  <!-- The parent button supplies the accessible app name. Artwork is trusted local SVG. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg ref="icon" class="vision-icon" :class="{ 'is-lifted': hovered }"
    viewBox="0 0 100 100" aria-hidden="true" focusable="false" v-html="markup" />
</template>

<style scoped>
.vision-icon {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  filter: drop-shadow(0 3px 5px rgb(0 0 0 / 24%));
  isolation: isolate;
}

.vision-icon :deep(*) {
  font-family: inherit;
}

.vision-icon :deep(.vision-glyph) {
  transform-box: view-box;
  transform-origin: 50% 50%;
  filter: drop-shadow(0 1.4px 1.2px rgb(0 0 0 / 24%));
  transition: transform 200ms ease, filter 200ms ease;
}

.vision-icon.is-lifted :deep(.vision-glyph) {
  transform: translateY(-1px) scale(1.06);
  filter: drop-shadow(0 3px 2px rgb(0 0 0 / 30%));
}

.vision-icon :deep(.vision-plate) {
  transform-box: view-box;
  transform-origin: 50% 50%;
  transition: transform 200ms ease;
}

.vision-icon.is-lifted :deep(.vision-plate) {
  transform: scale(.99);
}

@media (prefers-reduced-motion: reduce) {
  .vision-icon :deep(.vision-glyph),
  .vision-icon :deep(.vision-plate) {
    transition: none;
  }

  .vision-icon.is-lifted :deep(.vision-glyph),
  .vision-icon.is-lifted :deep(.vision-plate) {
    transform: none;
  }
}
</style>
