<script setup lang="ts">
import { PROJECTS } from "~/static/projects.static";

const layoutState = useContentLayout();

const projects = PROJECTS;

useHead({
	title: "Mohith Lab | Projects",
	meta: [{ name: "description", content: "Selected projects built by Mohith." }],
});

definePageMeta({ layout: "content" });

onMounted(() => {
	layoutState.value.displayLeftSide = true;
	layoutState.value.subTitle = "Selected systems, experiments, and shipped products.";
});
</script>

<template>
	<div>
		<LazyContentCard
			v-for="project in projects"
			:key="project.title"
			:title="project.title"
			:url="project.url"
			:description="project.description"
		>
			<template #footer>
				<span class="text-sm text-right opacity-80">Built by Mohith</span>
			</template>
		</LazyContentCard>
	</div>
</template>
