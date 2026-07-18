<script setup lang="ts">
import { pages } from "~/static";

const route = useRoute();
const isExperienceReady = useState<boolean>("isExperienceReady");
const isFreeCamera = useState<boolean>("isFreeCamera");
const isVisible = useState<boolean>("isCameraHintVisible", () => false);
const homeLanding = useState<boolean>(`canDisplayLanding_${pages.HOME_PAGE}`, () => true);
const contactLanding = useState<boolean>(`canDisplayLanding_${pages.CONTACT_PAGE}`, () => true);
const isTouchDevice = ref(false);

let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const page = computed(() => {
	if (route.meta.key === pages.HOME_PAGE || route.path === "/") return "home";
	if (route.meta.key === pages.CONTACT_PAGE || route.path === "/contact") return "contact";
	return undefined;
});
const canDisplayLanding = computed(() =>
	page.value === "contact" ? contactLanding.value : homeLanding.value
);
const title = computed(() =>
	page.value === "contact" ? "Explore the full contact scene" : "Explore the room"
);
const instructions = computed(() =>
	isTouchDevice.value
		? "Select the camera icon to unlock free movement. Drag to look, pinch to zoom, and use two fingers to move."
		: "Select the camera icon to unlock free movement. Drag to look, scroll to zoom, and hold Shift while dragging to move."
);
const storageSuffix = computed(() => page.value ?? "scene");

const clearTimers = () => {
	if (showTimer) clearTimeout(showTimer);
	if (hideTimer) clearTimeout(hideTimer);
	showTimer = undefined;
	hideTimer = undefined;
};

const hide = (remember = false) => {
	clearTimers();
	isVisible.value = false;
	try {
		sessionStorage.setItem(`mohith-camera-hint-seen-${storageSuffix.value}`, "true");
		if (remember)
			localStorage.setItem(`mohith-camera-hint-dismissed-${storageSuffix.value}`, "true");
	} catch {
		// The hint still works when browser storage is unavailable.
	}
};

const schedule = () => {
	clearTimers();
	isVisible.value = false;
	if (!page.value || !isExperienceReady.value || canDisplayLanding.value || isFreeCamera.value)
		return;

	try {
		if (
			localStorage.getItem(`mohith-camera-hint-dismissed-${storageSuffix.value}`) === "true" ||
			sessionStorage.getItem(`mohith-camera-hint-seen-${storageSuffix.value}`) === "true"
		)
			return;
	} catch {
		// Continue without persistence.
	}

	showTimer = setTimeout(() => {
		isVisible.value = true;
		hideTimer = setTimeout(() => hide(false), 10000);
	}, page.value === "home" ? 1800 : 1400);
};

const onKeyDown = (event: KeyboardEvent) => {
	if (isVisible.value && event.key === "Escape") hide(false);
};

watch([page, isExperienceReady, canDisplayLanding], schedule, { immediate: true });
watch(isFreeCamera, (enabled) => {
	if (enabled) hide(false);
});

onMounted(() => {
	isTouchDevice.value = window.matchMedia("(pointer: coarse)").matches;
	window.addEventListener("keydown", onKeyDown);
	schedule();
});

onBeforeUnmount(() => {
	clearTimers();
	isVisible.value = false;
	window.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
	<Transition name="controls-hint">
		<aside
			v-if="isVisible"
			class="absolute z-30 w-[min(20rem,calc(100vw-2rem))] right-0 bottom-12 p-4 overflow-hidden border rounded-2xl border-white/20 bg-black/90 shadow-2xl shadow-black/40 backdrop-blur-md pointer-events-auto"
			aria-label="Scene exploration controls"
			aria-live="polite"
		>
			<div class="flex items-start gap-3">
				<span
					class="flex items-center justify-center w-9 h-9 shrink-0 border rounded-full border-primary/60 bg-primary/10 text-primary"
					aria-hidden="true"
				>
					<svg viewBox="0 0 24 24" class="w-4 h-4" fill="none">
						<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h7A2.5 2.5 0 0 1 16 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5v-7Z" stroke="currentColor" stroke-width="1.5" />
						<path d="m16 10 4-2v8l-4-2" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
					</svg>
				</span>

				<div class="min-w-0 pr-6">
					<p class="text-sm font-medium text-light">{{ title }}</p>
					<p class="mt-1 text-xs leading-relaxed text-light/70">{{ instructions }}</p>
					<button
						type="button"
						class="mt-3 text-xs font-medium text-primary transition-colors hover:text-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						@click="hide(true)"
					>
						Got it
					</button>
				</div>

				<button
					type="button"
					class="absolute flex items-center justify-center transition-colors rounded-full top-3 right-3 w-7 h-7 text-light/60 hover:text-light hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					aria-label="Dismiss exploration instructions"
					@click="hide(true)"
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>
		</aside>
	</Transition>
</template>

<style scoped>
.controls-hint-enter-active,
.controls-hint-leave-active {
	transition: opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.controls-hint-enter-from,
.controls-hint-leave-to {
	opacity: 0;
	transform: translate3d(0, 0.75rem, 0) scale(0.98);
}
</style>
