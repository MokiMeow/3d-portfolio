<script setup lang="ts">
import WatchIcon from '../WatchIcon.vue';
import { useWatch, type WatchAppId } from '../watch';
withDefaults(defineProps<{
    app: WatchAppId;
    label: string;
    value?: string | number;
    color?: string;
    small?: boolean;
}>(), {
    color: 'var(--ink)', value: '', small: false
});
const watch = useWatch();
</script>

<template>
  <button
    type="button"
    class="complication"
    :class="{small}"
    :aria-label="label"
    :style="{color}"
    @click.stop="watch.open(app)"
  >
    <slot>
      <WatchIcon :name="app" :size="small ? 25 : 31" />
      <span v-if="value !== ''" class="value">
        {{value}}
      </span>
    </slot>
  </button>
</template>

<style scoped>
.complication {
  width: 76px;
  min-height: 72px;
  border: 0;
  padding: 5px 2px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 23px;
  font: inherit;
  color: var(--ink);
  cursor: pointer;
}

.complication:active {
  background: #ffffff20;
}

.complication:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 1px;
}

.value {
  font-size: max(24px, calc(12px / var(--watch-scale)));
  line-height: 1;
  letter-spacing: -.6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.small {
  width: 64px;
  min-height: 64px;
}

.small .value {
  font-size: max(21px, calc(12px / var(--watch-scale)));
}

.complication {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.complication :deep(*) {
  font-family: inherit;
}
</style>
