import { glslify } from "vite-plugin-glslify";

/**
 * web-llm ships as one 6.8 MB file. Vite's asset plugin screens every module with
 * /new\s+URL.+import\.meta\.url/s, and on a file that size the regex overflows the stack. web-llm's
 * `new URL(...)` calls resolve model files at run time and must not be touched by Vite anyway, so
 * they are spelled `new (URL)(...)`: identical behaviour, invisible to the screen.
 */
const webLlmUnscanned = () => ({
	name: "web-llm-unscanned",
	enforce: "pre" as const,
	transform(code: string, id: string) {
		if (!id.includes("@mlc-ai/web-llm") || code.length < 1e6) return null;
		return { code: code.replace(/new URL\(/g, "new (URL)("), map: null };
	},
});

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
				{ name: "twitter:creator", content: "@smohiths" },
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
		// Server only: the YouTube Data API key, from NUXT_YOUTUBE_KEY. Never sent to the browser.
		youtubeKey: "",
		// Server only: JARVIS's hosted mind, any OpenAI-compatible endpoint (NUXT_JARVIS_URL, _KEY, _MODEL, _NAME).
		// NUXT_JARVIS_NO_THINK=1 asks Qwen-family models to skip their thinking phase.
		jarvisUrl: "",
		jarvisKey: "",
		jarvisModel: "",
		jarvisName: "",
		jarvisNoThink: "",
		// The JARVIS server's voice (…/v1/audio/speech); its key defaults to NUXT_JARVIS_KEY.
		jarvisVoiceUrl: "",
		jarvisVoiceKey: "",
		// Whisper behind the relay (…/v1/transcribe); same key as the mind.
		jarvisHearUrl: "",
		public: {
			MODE: process.env.MODE,
			GITHUB_LINK: process.env.GITHUB_LINK || "https://github.com/MokiMeow",
			LINKEDIN_LINK: process.env.LINKEDIN_LINK || "https://www.linkedin.com/in/smohiths",
			TWITTER_LINK: process.env.TWITTER_LINK || "https://x.com/smohiths",
			PORTFOLIO_LINK: process.env.PORTFOLIO_LINK || "https://smohith.vercel.app",
			EMAIL_LINK: process.env.EMAIL_LINK || "mailto:smohith.sm@gmail.com",
			GITHUB_CONTENT_LINK: process.env.GITHUB_CONTENT_LINK || "https://github.com/MokiMeow/3d-portfolio/tree/main/src/content",
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
		plugins: [glslify(), webLlmUnscanned()],
		// JARVIS's workers (web-llm, Kokoro) are module workers, and web-llm is bundled into one of them.
		worker: { format: "es", plugins: () => [webLlmUnscanned()] },
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
