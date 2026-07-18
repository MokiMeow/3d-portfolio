<script setup lang="ts">
defineProps<{ content: string; title?: string }>();
</script>

<template>
	<div
		class="flex flex-col items-start opacity-0 animate-[0.5s_linear_show-with-transition_forwards] border-light text-[4vw] xs:text-[12px] sm:text-sm"
	>
		<h3
			v-if="!!title"
			class="mb-2 text-[4.5vw] xs:text-base sm:text-lg capitalize border-b-2"
		>
			{{ title }}
		</h3>

		<p class="content-copy leading-[160%]">{{ content }}</p>
	</div>
</template>

<style scoped lang="scss">
.content-copy {
	animation: copy-enter 480ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes copy-enter {
	from { opacity: 0; transform: translate3d(0, 0.75rem, 0); }
	to { opacity: 1; transform: translate3d(0, 0, 0); }
}
</style>
