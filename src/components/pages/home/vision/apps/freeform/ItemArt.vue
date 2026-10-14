<script setup lang="ts">
import type { Item } from './model';
import { shapePath, smooth, textLines } from './model';
defineProps<{ item: Item }>();
</script>

<template>
  <svg class="item-art" :viewBox="'0 0 ' + item.w + ' ' + item.h" width="100%" height="100%" aria-hidden="true">
    <path v-if="item.kind === 'stroke' || item.kind === 'marker'" :d="smooth(item.points)" fill="none"
      :stroke="item.color" :stroke-width="item.thickness" :opacity="item.kind === 'marker' ? .45 : 1" stroke-linecap="round" />
    <ellipse v-else-if="item.kind === 'ellipse'" :cx="item.w / 2" :cy="item.h / 2"
      :rx="item.w / 2 - 5" :ry="item.h / 2 - 5" :fill="item.color" />
    <path v-else-if="shapePath(item)" :d="shapePath(item)"
      :fill="item.kind === 'line' || item.kind === 'arrow' ? 'none' : item.color" :stroke="item.color" stroke-width="4" />
    <template v-else-if="item.kind !== 'text'">
      <rect :width="item.w" :height="item.h" :rx="item.kind === 'sticky' ? 4 : 20" :fill="item.color" />
      <template v-if="item.kind === 'sticky'">
        <rect :x="item.w / 2 - 16" y="12" width="32" height="8" rx="4" fill="white" opacity=".3" />
        <path :d="'M ' + (item.w - 22) + ' ' + item.h + ' V ' + (item.h - 22) + ' H ' + item.w + ' Z'" fill="black" opacity=".12" />
      </template>
    </template>
    <text :fill="item.kind === 'text' ? item.color : '#26333b'" font-size="20" font-weight="600" text-anchor="middle">
      <tspan v-for="(line, index) in textLines(item.text, item.w - 24)" :key="index"
        :x="item.w / 2" :y="item.h / 2 + (index - (textLines(item.text, item.w - 24).length - 1) / 2) * 25">{{ line }}</tspan>
    </text>
  </svg>
</template>

<style scoped>
.item-art { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif; }
.item-art :deep(*) { font-family: inherit; }
</style>
