// ERRORS
import { ErrorFactory } from "~/errors";

// CONFIG

export default defineNuxtPlugin((nuxtApp) => {
	const getSizes = () => {
		const sw = window.innerWidth;
		const sh = window.innerHeight;
		const vh = sh * 0.01;
		const vw = sw * 0.01;
		const vl = sw > sh ? sw : sh;
		const vs = sw > sh ? sh : sw;

		return {
			sw,
			sh,
			vh,
			vw,
			vl,
			vs,
		};
	};

	const setSizes = () => {
		try {
			const { vh, vw, vl, vs } = getSizes();

			document.documentElement.style.setProperty("--vl", `${vl}px`);
			document.documentElement.style.setProperty("--vs", `${vs}px`);
			document.documentElement.style.setProperty("--vh", `${vh}px`);
			document.documentElement.style.setProperty("--vw", `${vw}px`);
			const viewport = window.visualViewport;
			document.documentElement.style.setProperty("--visual-height", `${viewport?.height ?? window.innerHeight}px`);
			document.documentElement.style.setProperty("--visual-top", `${viewport?.offsetTop ?? 0}px`);
		} catch (error) {
			new ErrorFactory(error);
		}
	};

	const onResize = () => {
		setSizes();
	};

	const init = () => {
		onResize();
		window.removeEventListener("resize", onResize);
		window.addEventListener("resize", onResize);
		window.visualViewport?.addEventListener("resize", onResize);
		window.visualViewport?.addEventListener("scroll", onResize);
	};

	nuxtApp.vueApp.use(init);

	return {
		provide: {
			getSizes,
			setSizes,
		},
	};
});
