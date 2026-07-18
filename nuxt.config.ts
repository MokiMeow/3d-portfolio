import { glslify } from "vite-plugin-glslify";

export default defineNuxtConfig({
	compatibilityDate: "2026-07-18",
	devtools: { enabled: false },
	ssr: false,
	app: {
		head: {
			title: "Mohith Lab | Interactive 3D Portfolio",
			charset: "utf-8",
			viewport: "width=device-width, initial-scale=1",
			meta: [
				{
					key: "description",
					name: "description",
					content: "Explore Mohith's interactive 3D workroom, projects, skills, and ways to connect.",
				},
				{ name: "format-detection", content: "telephone=no" },
				{ name: "x-ua-compatible", content: "IE=edge" },
				{ name: "og:site_name", content: "Mohith Lab" },
				{ name: "og:type", content: "website" },
				{ name: "og:title", content: "Mohith Lab | Interactive 3D Portfolio" },
				{
					name: "og:description",
					content: "Step inside Mohith's interactive 3D workroom and explore how he builds.",
				},
				{ name: "og:image", content: "/imgs/screenshot.png" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: "Mohith Lab | Interactive 3D Portfolio" },
				{ name: "twitter:creator", content: "@mohith50478695" },
				{ name: "twitter:image", content: "/imgs/screenshot.png" },
				{
					name: "twitter:description",
					content: "Step inside Mohith's interactive 3D workroom and explore how he builds.",
				},
				{ name: "application-name", content: "Mohith Lab" },
			],
			link: [
				{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
				{ rel: "manifest",  href: "/favicon/site.webmanifest" },

		],
		},
	},
	srcDir: "./src",
	components: [
		// ~/components/pages/home/Update.vue => <HomeUpdate />
		{ path: "~/components/pages" },

		// ~/components/global/Btn.vue => <G-Btn />
		{ path: "~/components/global", prefix: "G-" },

		"~/components",
	],
	modules: ["@nuxtjs/i18n", "@nuxt/content", "@nuxtjs/tailwindcss"],
	runtimeConfig: {
		public: {
			MODE: process.env.MODE,
			GITHUB_LINK: process.env.GITHUB_LINK || "https://github.com/MokiMeow",
			LINKEDIN_LINK: process.env.LINKEDIN_LINK || "https://www.linkedin.com/in/smohiths",
			TWITTER_LINK: process.env.TWITTER_LINK || "https://x.com/mohith50478695",
			PORTFOLIO_LINK: process.env.PORTFOLIO_LINK || "https://smohith.vercel.app",
			EMAIL_LINK: process.env.EMAIL_LINK || "mailto:smohith.sm@gmail.com",
			GITHUB_CONTENT_LINK: process.env.GITHUB_REPO_NAME,
		},
	},
	typescript: {
		// Keep production builds deterministic and run vue-tsc explicitly in the build script.
		typeCheck: false,
		strict: true,
	},
	spaLoadingTemplate: false,
	nitro: {
		compressPublicAssets: true,
	},
	vite: {
		plugins: [glslify()],
	},
	i18n: {
		vueI18n: "../i18n.config.ts",
		customRoutes: "config",
		detectBrowserLanguage: false,
		bundle: {
			optimizeTranslationDirective: false,
		},
	},
	content: {
		highlight: {
			theme: "github-dark",
		},
	},
	tailwindcss: {},
	css: ["~/assets/styles/index.scss"],
	postcss: {
		plugins: {
			tailwindcss: {},
			autoprefixer: {},
		},
	},
});
