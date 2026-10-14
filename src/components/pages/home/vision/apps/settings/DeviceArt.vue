<script setup lang="ts">
const artId = useId();
</script>

<template>
<svg class="device" viewBox="0 0 300 160" role="img" aria-label="Illustration of a Vision Pro headset with a knit headband">
<defs>
<linearGradient :id="artId + '-settings-lens'" x2="1" y2="1">
<stop stop-color="#111727"/>
<stop offset=".45" stop-color="#626c80"/>
<stop offset=".65" stop-color="#172432"/>
<stop offset="1" stop-color="#090e18"/>
</linearGradient>
<linearGradient :id="artId + '-settings-metal'" x2="0" y2="1">
<stop stop-color="#f0f1f3"/>
<stop offset=".5" stop-color="#b9bcc4"/>
<stop offset="1" stop-color="#6f737e"/>
</linearGradient>
<pattern :id="artId + '-settings-knit'" width="5" height="5" patternUnits="userSpaceOnUse">
<path d="m0 0 2.5 5L5 0" fill="none" stroke="#d5d6da" stroke-width="1"/>
</pattern>
</defs>
<path d="M65 64C68 6 232 6 235 64" fill="none" stroke="#9b9ea5" stroke-width="23"/>
<path d="M65 64C68 6 232 6 235 64" fill="none" :stroke="'url(#' + artId + '-settings-knit)'" stroke-width="19"/>
<path d="M58 71 37 60l-8 28 29 13M242 71l21-11 8 28-29 13" :fill="'url(#' + artId + '-settings-metal)'"/>
<path d="M61 56q89-18 178 0 17 7 16 31l-6 29q-7 26-39 22l-60-8-60 8q-32 4-39-22l-6-29q-1-24 16-31" :fill="'url(#' + artId + '-settings-metal)'"/>
<path d="M65 63q85-16 170 0 13 5 12 23l-5 28q-6 19-31 16l-61-9-61 9q-25 3-31-16l-5-28q-1-18 12-23" :fill="'url(#' + artId + '-settings-lens)'"/>
<path d="M76 70q74-13 148 0" stroke="white" opacity=".45" fill="none" stroke-width="2"/>
<ellipse cx="94" cy="92" rx="12" ry="10" fill="#122034" opacity=".65"/>
<ellipse cx="206" cy="92" rx="12" ry="10" fill="#122034" opacity=".65"/>
<rect x="213" y="50" width="14" height="5" rx="2.5" fill="#dadddf"/>
<circle cx="63" cy="53" r="7" fill="#bbc0c9"/>
</svg>
</template>

<style scoped>
.device {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
}
.device :deep(*) {
  font-family: inherit;
}
.device {
  display: block;
  width: min(270px,80%);
  height: auto;
  filter: drop-shadow(0 18px 18px rgb(0 0 0 / .22))
}
</style>
