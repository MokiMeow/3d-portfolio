<script setup lang="ts">
import { APP_ICONS, IOS_SQUIRCLE_PATH } from '../icons/app-icons';
import type { PhoneAppId } from './phone';

const props = defineProps<{ name: PhoneAppId }>();
const uid = 'phone-icon-' + useId().replace(/[^a-zA-Z0-9_-]/g, '-');
const now = shallowRef<Date>();
let minuteTimer: ReturnType<typeof setTimeout> | undefined;
let mounted = false;

function stopClock(): void {
  if (minuteTimer !== undefined) {
    clearTimeout(minuteTimer);
    minuteTimer = undefined;
  }
}

function refreshClock(): void {
  stopClock();
  if (!mounted || props.name !== 'clock') return;
  now.value = new Date();
  // Align with the next minute so the hour and minute hands stay accurate.
  minuteTimer = setTimeout(refreshClock, 60_000 - Date.now() % 60_000 + 20);
}

watch(() => props.name, refreshClock);

onMounted(() => {
  mounted = true;
  refreshClock();
});

onBeforeUnmount(() => {
  mounted = false;
  stopClock();
});

const markup = computed(() => {
  const artwork = APP_ICONS[props.name](uid, now.value);
  return `
    <defs>
      <clipPath id="${uid}-clip"><path d="${IOS_SQUIRCLE_PATH}"/></clipPath>
      <linearGradient id="${uid}-rim" x1="0" y1="0" x2=".6" y2="1">
        <stop stop-color="#fff" stop-opacity=".58"/>
        <stop offset=".45" stop-color="#fff" stop-opacity=".08"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${uid}-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset=".68" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".09"/>
      </linearGradient>
      <filter id="${uid}-lift" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB">
        <feDropShadow dx="0" dy=".55" stdDeviation=".45" flood-color="#000" flood-opacity=".15"/>
      </filter>
    </defs>
    <g clip-path="url(#${uid}-clip)">
      ${artwork.background}
      <g filter="url(#${uid}-lift)">${artwork.svg}</g>
      <rect width="100" height="100" fill="url(#${uid}-shade)" pointer-events="none"/>
      <path d="${IOS_SQUIRCLE_PATH}" transform="translate(.55 .55) scale(.989)"
        fill="none" stroke="url(#${uid}-rim)" stroke-width=".9" pointer-events="none"/>
    </g>
  `;
});
</script>

<template>
  <!-- The parent button supplies the accessible app name. Artwork is trusted local SVG. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg class="phone-icon" viewBox="0 0 100 100" aria-hidden="true" focusable="false" v-html="markup" />
</template>

<style scoped>
.phone-icon {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 18%));
  isolation: isolate;
}

.phone-icon :deep(*) {
  font-family: inherit;
}
</style>
