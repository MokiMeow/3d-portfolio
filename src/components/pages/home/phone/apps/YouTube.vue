<script setup lang="ts">
// The phone runs the same YouTube client as the headset; it lays itself out for whatever box it is given.
import YouTubeClient from '../../vision/apps/YouTube.vue';
</script>

<template>
  <div class="phone-youtube">
    <div class="fit">
      <YouTubeClient compact />
    </div>
  </div>
</template>

<style scoped>
.phone-youtube {
  position: absolute;
  inset: 0;
  background: #0f0f0f;
}

/* The client fills this box, which keeps clear of the status bar and Dynamic Island above and the home bar below. */
.fit {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--safe-top, 58px);
  bottom: var(--safe-bottom, 24px);
  overflow: hidden;
}
</style>
