import { ErrorFactory } from "~/errors";

export type Theme = "dark" | "light" | undefined;

export default defineNuxtPlugin((nuxtApp) => {
	const setTheme = (theme: Theme) => {
		try {
			const safeTheme: Exclude<Theme, undefined> = theme || "dark";
			/* Tailwind support */
			document.documentElement.classList.remove("dark");
			document.documentElement.classList.add(safeTheme);

			document.documentElement.setAttribute("data-theme", safeTheme);

			try {
				localStorage.theme = theme;
			} catch {
				// A cross-site frame can be refused storage; the theme still applies.
			}
		} catch (error) {
			new ErrorFactory(error);
		}
	};

	const onThemeChange = () => {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem("theme");
		} catch {
			// No storage: follow the system theme.
		}

		setTheme(
			stored === "dark" ||
				(stored === null &&
					window.matchMedia("(prefers-color-scheme: dark)").matches)
				? "dark"
				: "light"
		);
	};

	const init = () => {
		onThemeChange();

		window
			.matchMedia("(prefers-color-scheme: dark)")
			.removeEventListener("change", onThemeChange);

		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", onThemeChange);
	};

	nuxtApp.vueApp.use(init);

	return {
		provide: {
			setTheme,
		},
	};
});
