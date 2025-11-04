<script lang="ts" setup>
withDefaults(defineProps<{ active?: boolean }>(), { active: false });
</script>

<template>
	<button type="button" class="hidden" aria-hidden="true" />
</template>
