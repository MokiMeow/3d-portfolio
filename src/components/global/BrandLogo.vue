<script setup lang="ts">
import { computed } from "vue";
import { name } from "~~/package.json";

const props = defineProps<{ link?: string; logoHeight?: number }>();

const displayName = computed(() =>
	name
		.replace(/[-_]+/g, " ")
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.toUpperCase()
		.trim()
);
const characters = computed(() => displayName.value.split(""));
</script>

<template>
	<NuxtLink
		ref="linkRef"
		:href="props.link"
		class="flex flex-row items-center justify-start text-lg font-medium uppercase cursor-pointer"
	>
		<img
			src="~/assets/img/logo.png"
			:class="`h-7 sm:h-8 mb-1 mr-2 transition-all`"
			:style="{
				height: props.logoHeight ? `${props.logoHeight}px` : undefined,
			}"
		/>

		<span class="flex flex-row">
			<div v-for="(l, i) in characters" :key="i" class="transition-all">
				{{ l }}
			</div>
		</span>
	</NuxtLink>
</template>

<style scoped lang="scss">
$length: 20;

a > span {
	letter-spacing: 0.25em;
}

a {
	@for $i from 1 through $length {
		> span > div:nth-child(#{$i}) {
			transition-delay: 0.03s * ($i + 1);
			scale: 1;
		}
	}

	&:hover {
		> img {
			scale: 1.05;
		}

		@for $i from 1 through $length {
			> span > div:nth-child(#{$i}) {
				translate: 5px * ($i * 0.25);
			}
		}
	}
}
</style>
