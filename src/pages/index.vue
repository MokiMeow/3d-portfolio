<script setup lang="ts">
// EXPERIENCES
import { HomeExperience } from "~/experiences/home";

// STATIC
import { events, pages } from "~/static";

// DATA
const appCanvasId = "home-experience";
const availableRoutes = useState<{ name: string; path: string; key: string }[]>(
	"availableRoutes",
	() => []
);
const isExperienceConstructed = useState(
	"isExperienceConstructed",
	() => false
);
const isExperienceReady = useState<boolean>("isExperienceReady", () => false);
const isFreeCamera = useState<boolean>("isFreeCamera", () => false);
const isFocusMode = useState<boolean>("isFocusMode", () => false);
const isMarkersDisplayed = useState<boolean>("isMarkersDisplayed", () => false);
const isSoundMuted = useState<boolean>("isSoundMuted", () => true);

// EVENTS;
const onUiReady = () => {
	isExperienceReady.value = true;
	new HomeExperience().world?.scene1?.companion?.welcome();
};
const onCameraAnimationChange = () => {
	const _exp = new HomeExperience();
	isFreeCamera.value = !!(
		!_exp?.cameraAnimation?.enabled && _exp?.navigation?.view.enabled
	);
};
const onInteractionFocusStarted = () => (isFocusMode.value = true);
const onInteractionFocusEnded = () => (isFocusMode.value = false);
const onMarkersDisplayed = () => (isMarkersDisplayed.value = true);
const onMarkersRemoved = () => (isMarkersDisplayed.value = false);
const onSoundChanged = () => {
	isSoundMuted.value = !!new HomeExperience()?.sound?.isMuted;
};

const init = () => {
	if (!process.client || isExperienceConstructed.value) return;
	const _exp = new HomeExperience({
		domElementRef: `#${appCanvasId}`,
	});

	_exp.construct();
	isExperienceConstructed.value = true;

	const routes = _exp.router?.availableRoutes;
	availableRoutes.value = [];
	if (routes) {
		let safeRoutes = [];
		const routeKeys = Object.keys(routes);
		for (let i = 0; i < routeKeys.length; i++) {
			const route = routes[routeKeys[i]];
			const name = (route.name?.toString() ?? "Not defined").replace(
				/index\-?/,
				""
			);
			const value = {
				name: name.length === 0 ? "home" : name,
				path: "/" + route.path,
				key: route.meta?.key?.toString() ?? "",
			};

			if (route.meta?.key === pages.HOME_PAGE)
				availableRoutes.value.unshift(value);
			else if (route.meta?.key === pages.SKILL_PAGE)
				availableRoutes.value.push(value);
			else safeRoutes.push(value);
		}

		availableRoutes.value = [...availableRoutes.value, ...safeRoutes];
	}

	onSoundChanged();
	_exp.ui?.on(events.READY, onUiReady);
	_exp.ui?.on(events.MARKERS_DISPLAYED, onMarkersDisplayed);
	_exp.ui?.on(events.MARKERS_REMOVED, onMarkersRemoved);
	_exp.cameraAnimation?.on(events.CHANGED, onCameraAnimationChange);
	_exp.interactions?.on(
		events.INTERACTION_FOCUS_STARTED,
		onInteractionFocusStarted
	);
	_exp.interactions?.on(
		events.INTERACTION_FOCUS_ENDED,
		onInteractionFocusEnded
	);
	_exp.sound?.on(events.CHANGED, onSoundChanged);
};
const dispose = () => {
	const _exp = new HomeExperience();

	_exp.ui?.off(events.READY, onUiReady);
	_exp.ui?.off(events.MARKERS_DISPLAYED, onMarkersDisplayed);
	_exp.ui?.off(events.MARKERS_REMOVED, onMarkersRemoved);
	_exp.cameraAnimation?.off(events.CHANGED, onCameraAnimationChange);
	_exp.interactions?.off(
		events.INTERACTION_FOCUS_STARTED,
		onInteractionFocusStarted
	);
	_exp.interactions?.off(
		events.INTERACTION_FOCUS_ENDED,
		onInteractionFocusEnded
	);
	_exp.sound?.off(events.CHANGED, onSoundChanged);

	_exp.destruct();
	isExperienceConstructed.value = false;
};

useHead({
	title: "Mohith Lab | Interactive 3D Portfolio",
	link: [
		{
			href: "/notes/contact",
			rel: "preload",
			as: "document",
		},
	],
	meta: [
		{
			name: "viewport",
			content:
				"width=device-width, initial-scale=1.0, viewport-fit=cover",
		},
	],
});

prerenderRoutes(["/notes/about", "/notes/contact", "/notes/credits"]);
onMounted(init);
onBeforeUnmount(dispose);
onBeforeRouteUpdate((route) => {
	const _exp = new HomeExperience();
	if(_exp.router?.currentRouteKey===pages.HOME_PAGE&&route.meta.key!==pages.HOME_PAGE)_exp.world?.scene1?.companion?.farewell();
	isFocusMode.value = false;
	_exp?.router?.emit(events.CHANGED, route);
});
</script>

<template>
	<main
		class="lab-experience relative overflow-hidden w-full bg-dark"
	>
		<LazyHomeLoader />

		<canvas
			:id="appCanvasId"
			class="fixed top-0 left-0 z-0 w-full h-full overscroll-none touch-none"
		/>

		<LazyGContainer
			:class="`lab-chrome relative flex flex-col justify-between h-full sm:py-8 md:py-12 ${
				isFreeCamera || isFocusMode ? 'pointer-events-none' : ''
			}`"
		>
			<LazyGHeader class="lab-heading px-4 pt-5 sm:pt-0 sm:px-0" />

			<section class="lab-route-area flex flex-col flex-1 min-h-0 sm:flex-row">
				<LazyHomeNav />
				<LazyNuxtPage class="w-full h-full" />
			</section>

			<LazyHomeFooter />
		</LazyGContainer>

		<LazyHomeBoardNoteDialog />
		<LazyHomeProjectsPanel />
		<LazyHomeLabDeviceDialog />
		<HomeRecordPlayer />
		<HomeCompanion />
		<HomeNewspaper />
	</main>
</template>

<style lang="scss" scoped>
main {
	height: 100dvh;
	overscroll-behavior: none;
	* {
		user-select: none;
	}
}
</style>

<style>
/* The room occupies one viewport; browser bars and notches are real space. */
@media (max-width: 639px), (max-height: 500px) and (max-width: 1023px) {
  .lab-experience .lab-chrome { width:100%; padding:0; }
  .lab-experience .lab-heading { padding: max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left)); }
  .lab-experience .lab-heading .brand-mark { width:28px;height:28px; }
  .lab-experience .lab-heading a { font-size:15px;min-height:36px; }
  .lab-experience .lab-route-area { flex-direction:column; }
  .lab-experience .lab-nav { margin:6px 0 0;flex:none; }
  .lab-experience .lab-nav ul { flex-direction:row;width:100%;gap:0; }
  .lab-experience .lab-nav li { transform:none;rotate:none;width:100%;margin:0; }
  .lab-experience .lab-nav a { display:flex;min-height:44px;align-items:center;font-size:12px; }
  .lab-experience .lab-nav a::before { bottom:7px; }
  .lab-footer { position:fixed!important;left:0;right:0;bottom:0;padding:6px max(12px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))!important;background:#1b1b1be8!important;display:flex!important;flex-direction:column!important;gap:2px; }
  .lab-footer .lab-toolbar { margin:0!important;gap:8px!important;justify-content:center;width:100%; }
  .lab-footer .lab-toolbar > * { margin-left:0!important; }
  .lab-footer .lab-toolbar > button,.lab-footer .lab-toolbar > label,.lab-footer summary { width:44px!important;height:44px!important;display:grid;place-items:center;flex-shrink:0; }
  .lab-footer .lab-toolbar svg { width:23px!important;height:23px!important; }
  .lab-footer .lab-credit { margin:0!important;font-size:10px;line-height:16px; }
  .lab-footer .lab-camera-copy { display:none; }
}
@media (max-height:500px) and (min-width:640px) and (max-width:1023px) {
  .lab-experience .lab-heading { position:absolute;left:0;top:0;width:auto; }
  .lab-experience .lab-nav { margin:8px 16px 0 auto;max-width:300px;width:50%; }
  .lab-footer { flex-direction:row!important;justify-content:space-between!important; }
  .lab-footer .lab-toolbar { width:auto; }
  .lab-footer .lab-credit { width:auto;order:-1; }
}
</style>
