<script setup lang="ts">
import type { FileKind } from './model';
defineProps<{ kind: FileKind }>();
</script>

<template>
  <svg class="file-glyph" viewBox="0 0 76 86" aria-hidden="true">
    <template v-if="kind === 'folder'">
      <path d="M5 24V14q0-7 7-7h21l10 11h22q6 0 6 7v49q0 6-6 6H11q-6 0-6-6z" fill="#4599d6" />
      <path d="M5 30q0-6 6-6h54q6 0 6 6v43q0 7-7 7H12q-7 0-7-7z" fill="#8dcff2" />
      <path d="M8 31h60" stroke="#c9ecff" stroke-opacity=".7" />
    </template>
    <template v-else>
      <path d="M16 3h29l19 19v56q0 6-6 6H16q-6 0-6-6V9q0-6 6-6z" fill="#e0e9ed" />
      <path d="M45 3v19h19" fill="#a3bdc4" />
      <path v-if="kind === 'zip'" d="M36 7h8v8h-8zm0 14h8v8h-8zm0 14h8v8h-8zm0 14h8v17h-8z" fill="#768b97" />
      <g v-else-if="kind === 'image'">
        <rect x="18" y="34" width="38" height="31" rx="4" fill="#8cbbbd" />
        <circle cx="45" cy="42" r="5" fill="#f0da9c" />
        <path d="m18 62 12-15 8 10 7-6 11 14H18z" fill="#527887" />
      </g>
      <g v-else-if="kind === 'design'">
        <rect x="19" y="33" width="16" height="15" rx="4" fill="#d59b96" />
        <rect x="39" y="33" width="16" height="15" rx="4" fill="#af9cc5" />
        <rect x="19" y="52" width="36" height="15" rx="4" fill="#9ebfba" />
      </g>
      <g v-else-if="kind === 'model'" fill="none" stroke="#758dca" stroke-width="3" stroke-linejoin="round">
        <path d="m37 33 18 11v21L37 76 19 65V44zm0 21 18-10M37 54 19 44m18 10v22m0-43v21" />
      </g>
      <path v-else-if="kind === 'audio'" d="M21 48v10m8-21v32m8-26v20m8-28v31m8-18v9" stroke="#8b78b8" stroke-width="4" stroke-linecap="round" />
      <text v-else-if="kind === 'json'" x="37" y="60" text-anchor="middle" fill="#678ea5" font-size="24">{ }</text>
      <text v-else-if="kind === 'markdown'" x="37" y="59" text-anchor="middle" fill="#678ea5" font-size="22" font-weight="700">M↓</text>
      <g v-else>
        <path d="M22 37h29M22 47h29M22 57h20M22 67h25" stroke="#97aeb8" stroke-width="4" stroke-linecap="round" />
        <rect v-if="kind === 'pdf'" x="13" y="60" width="48" height="18" rx="4" fill="#c97973" />
        <text v-if="kind === 'pdf'" x="37" y="73" text-anchor="middle" font-size="13" fill="white" font-weight="700">PDF</text>
      </g>
    </template>
  </svg>
</template>

<style scoped>
.file-glyph {
  width: 58px;
  height: 66px;
  flex: none;
  filter: drop-shadow(0 5px 7px rgb(0 0 0 / .14));
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
}
.file-glyph :deep(*) { font-family: inherit; }
</style>
