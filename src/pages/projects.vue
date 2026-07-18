<script setup lang="ts">
const layoutState = useContentLayout();

const projects = [
	{
		title: "AURORA",
		description: "An AI engineering workspace for planning, executing, and evaluating complex software tasks.",
		url: "https://github.com/MokiMeow/AURORA",
	},
	{
		title: "OARS",
		description: "AI security governance for policies, approvals, tenant isolation, secrets hygiene, and audit visibility.",
		url: "https://github.com/MokiMeow/OARS",
	},
	{
		title: "ZKAuth",
		description: "Privacy-preserving authentication built around zero-knowledge proofs and safer identity verification.",
		url: "https://zkauth.dev",
	},
	{
		title: "Flash UI",
		description: "A fast UI generation experiment for moving from an idea to an editable interface quickly.",
		url: "https://flashs-ui.vercel.app",
	},
];

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
