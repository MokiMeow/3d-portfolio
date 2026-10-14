<script setup lang="ts">
defineProps<{ kind: string; title: string }>();
</script>
<template>
  <div class="photo-art" :class="kind">
    <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" role="img" :aria-label="title">
      <rect width="800" height="500" :fill="kind === 'cat' ? '#7e9a98' : kind === 'tea' ? '#b07a50' : '#172435'" />
      <template v-if="kind === 'cat'">
        <ellipse cx="400" cy="420" rx="230" ry="38" fill="#304c51" opacity=".5" />
        <path d="M210 400q-60-140 48-228l-8-108 103 64h128l73-70 16 131q140 243-143 237z" fill="#ddc5a3" />
        <path d="M302 281h48m87 0h48" stroke="#484743" stroke-width="11" stroke-linecap="round" />
        <path d="m370 313 29 24 27-24" fill="#9e7671" />
        <path d="m205 316 94 14m-98 18 91 1m207-19 94-14m-87 32 91-1" stroke="#484743" stroke-width="4" />
        <text x="35" y="45" fill="#fdf4dc" font-size="24" font-weight="600">Cat.exe has stopped responding.</text>
      </template>
      <template v-else-if="kind === 'tea'">
        <rect y="380" width="800" height="120" fill="#765038" />
        <ellipse cx="400" cy="410" rx="170" ry="24" fill="#493830" />
        <path d="M285 165h230l-28 230H314z" fill="#f6e4c8" />
        <path d="M300 220h200l-22 160H322z" fill="#a66432" />
        <path d="M517 190q110-5 57 107l-63 9" fill="none" stroke="#f6e4c8" stroke-width="15" />
        <path d="M365 138q-33-28 0-78m68 78q-33-28 0-78" stroke="#fae8cf" stroke-width="8" fill="none" />
        <text x="40" y="50" fill="#fff5e6" font-size="26" font-weight="600">Tea break in three dimensions.</text>
      </template>
      <template v-else-if="kind === 'desk'">
        <rect y="380" width="800" height="120" fill="#8a7160" />
        <rect x="155" y="92" width="490" height="290" rx="18" fill="#0c1420" />
        <rect x="177" y="114" width="446" height="244" rx="8" fill="#324956" />
        <path d="M215 165h175m-175 45h290m-290 45h110" stroke="#aad3b6" stroke-width="14" />
        <path d="m155 383-45 23h580l-45-23" fill="#a6a8a4" />
        <text x="40" y="50" fill="#dbe5e6" font-size="26" font-weight="600">A very productive desk.</text>
      </template>
      <template v-else>
        <rect x="95" y="95" width="610" height="330" rx="22" fill="#edf0ed" />
        <path d="M110 128h580" stroke="#879dab" stroke-width="28" />
        <path d="m185 210 43 70h-86z" fill="#cf8d65" />
        <text x="290" y="235" fill="#334e62" font-size="27" font-weight="600">Unexpectedly expected error.</text>
        <text x="290" y="280" fill="#526878" font-size="22">Task failed successfully.</text>
        <rect x="530" y="345" width="130" height="42" rx="21" fill="#587c95" />
        <text x="569" y="373" fill="#fff" font-size="20">Okay</text>
      </template>
    </svg>
  </div>
</template>
<style scoped>
.photo-art {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.photo-art :deep(*) {
  font-family: inherit;
}
svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
