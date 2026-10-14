<script setup lang="ts">
const props = defineProps<{ id: string; title: string; duration?: string; progress?: number }>();
const loaded = ref(false);
const failed = ref(false);
watch(() => props.id, () => { loaded.value = false; failed.value = false; });
</script>

<template>
  <div class="yt-thumbnail" :class="{ loaded, failed }">
    <img v-if="!failed" :src="`https://i.ytimg.com/vi/${id}/hqdefault.jpg`" :alt="title"
      loading="lazy" decoding="async" @load="loaded = true" @error="failed = true" />
    <span v-if="failed" class="fallback">{{ title }}</span>
    <span v-if="duration" class="duration">{{ duration }}</span>
    <span v-if="progress && progress < 0.98" class="progress" :style="{ width: `${Math.min(100, progress * 100)}%` }" />
  </div>
</template>

<style scoped>
.yt-thumbnail {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 16px;
  background: #242424;
  color: #f1f1f1;
  font-family:inherit;
}
.yt-thumbnail :deep(*) {
  font-family: inherit;
}
.yt-thumbnail::before {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(110deg, transparent 25%, #ffffff12 45%, transparent 65%);
  animation:none;
}
.loaded::before, .failed::before {
  display: none;
}
img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  opacity: 0;
  transition: opacity 220ms;
}
.loaded img {
  opacity: 1;
}
.fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #aaa;
  font-size: 13px;
}
.duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  padding: 3px 5px;
  border-radius: 4px;
  background: #000d;
  font-size: 12px;
  line-height: 16px;
}
.progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: #f03;
}
@keyframes shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  img {
    transition: none;
  }
  .yt-thumbnail::before {
    animation: none;
  }
}


.yt-thumbnail { background:radial-gradient(circle at 25% 20%,#52727b,#29364d 65%); }
.fallback { padding:24px; text-align:center; color:#ffffffc9; font-size:17px; line-height:1.3; letter-spacing:-.02em; }
.duration { border-radius:7px; padding:3px 6px; font-size:10px; background:#111a24cc; backdrop-filter:blur(8px); }

</style>
