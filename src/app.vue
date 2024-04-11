<script setup lang="ts">
useServerSeoMeta({
	charset: "utf-8",
	xUaCompatible: "IE=edge",
	viewport: "width=device-width, initial-scale=1",
	title: "Sai Mohith 's Site",
	description: "A 3D experience representing Sai Mohith 's room",
	ogSiteName: "Sai Mohith 's Site",
	ogTitle: "Sai Mohith 's website",
	ogDescription: "A 3D experience representing Sai Mohith 's room",
	ogImage: "/imgs/screenshot.png",
	ogType: "website",
	twitterCard: "summary_large_image",
	twitterCreator: "https://twitter.com/nsl_nathan",
	twitterImage: "/imgs/screenshot.png",
	twitterDescription: "A 3D experience representing Sai Mohith 's room",
	robots: "index, skills, contact,  writing, notes/credits",
	colorScheme: "dark light",
});
</script>

<template>
	<NuxtLayout>
		<NuxtPage />
	</NuxtLayout>
</template>
