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
		<span class="brand-mark" aria-hidden="true">M</span>

		<span class="flex flex-row">
			<div v-for="(l, i) in characters" :key="i" class="transition-all">
				{{ l }}
			</div>
		</span>
	</NuxtLink>
</template>

<style scoped lang="scss">
$length: 20;

.brand-mark {
	display: grid;
	width: 2rem;
	height: 2rem;
	margin-right: 0.65rem;
	place-items: center;
	border: 1px solid rgba(244, 247, 245, 0.65);
	border-radius: 0.6rem 0.2rem 0.6rem 0.2rem;
	font-size: 0.8rem;
	font-weight: 700;
	letter-spacing: 0;
	transition: transform 220ms ease, background-color 220ms ease;
}

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
		> .brand-mark {
			transform: rotate(-6deg) scale(1.04);
			background: rgba(244, 247, 245, 0.1);
		}

		@for $i from 1 through $length {
			> span > div:nth-child(#{$i}) {
				translate: 5px * ($i * 0.25);
			}
		}
	}
}
</style>
