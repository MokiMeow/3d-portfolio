<script setup lang="ts">
useServerSeoMeta({
	charset: "utf-8",
	xUaCompatible: "IE=edge",
	viewport: "width=device-width, initial-scale=1",
	title: "Mohith Lab | Interactive 3D Portfolio",
	description: "Explore Mohith's interactive 3D workroom, projects, skills, and ways to connect.",
	ogSiteName: "Mohith Lab",
	ogTitle: "Mohith Lab | Interactive 3D Portfolio",
	ogDescription: "Step inside Mohith's interactive 3D workroom and explore how he builds.",
	ogImage: "/imgs/screenshot.png",
	ogType: "website",
	twitterCard: "summary_large_image",
	twitterCreator: "@mohith50478695",
	twitterImage: "/imgs/screenshot.png",
	twitterDescription: "Step inside Mohith's interactive 3D workroom and explore how he builds.",
	robots: "index, follow",
	colorScheme: "dark light",
});
</script>

<template>
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
