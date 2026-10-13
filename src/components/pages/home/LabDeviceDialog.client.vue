<script setup lang="ts">
import { animate, type JSAnimation } from "animejs";
import type { LabDevice } from "~/common/models/lab-device.model";
// Keep the small device interfaces in the dialog's bundle. Loading another
// deployment-specific chunk on click previously left only the close button.
import LabPhone from "./LabPhone.client.vue";
import LabGlasses from "./LabGlasses.client.vue";
import LabTerminal from "./LabTerminal.client.vue";
const active = useState<LabDevice>("activeLabDevice", () => null);
const dialog = ref<HTMLDialogElement>();
const body = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const route = useRoute();
let entrance: JSAnimation | undefined;
let opening = 0;
const reload = () => window.location.reload();
const close = () => {
	active.value = null;
};
watch(active, async (value) => {
	const request = ++opening;
	entrance?.pause();
	if (!value) {
		dialog.value?.close();
		return;
	}
	await nextTick();
	if (request !== opening || active.value !== value) return;
	dialog.value?.showModal();
	closeButton.value?.focus();
	if (
		body.value &&
		!window.matchMedia("(prefers-reduced-motion: reduce)").matches
	)
		entrance = animate(body.value, {
			opacity: [0, 1],
			translateY: [14, 0],
			scale: [0.98, 1],
			duration: 250,
			ease: "out(3)",
		});
});
watch(() => route.path, close);
onBeforeUnmount(() => {
	entrance?.pause();
	dialog.value?.close();
	active.value = null;
});
</script>
<template>
	<Teleport to="body"
		><dialog
			ref="dialog"
			class="lab-device-dialog"
			:aria-label="
				active === 'phone'
					? 'Mohith’s phone'
					: active === 'glasses'
						? 'Smart glasses player'
						: 'Pocket terminal'
			"
			@pointerdown.stop
			@pointerup.stop
			@pointermove.stop
			@mousedown.stop
			@mouseup.stop
			@mousemove.stop
			@wheel.stop
			@touchstart.stop
			@touchmove.stop
			@touchend.stop
			@cancel.prevent="close"
			@click.stop="
				(event) => {
					if (event.target === dialog) close();
				}
			"
		>
			<div v-if="active" ref="body" class="device-stage">
				<button ref="closeButton" class="device-close" aria-label="Put it back" @click="close">
					<span aria-hidden="true">×</span> Put it back <kbd>ESC</kbd></button
				>
				<NuxtErrorBoundary :key="active">
					<LabPhone v-if="active === 'phone'" />
					<LabGlasses v-else-if="active === 'glasses'" />
					<LabTerminal v-else />
					<template #error>
						<div class="device-recovery" role="alert">
							<p>This device needs a fresh start.</p>
							<button @click="reload">Reload the lab</button>
						</div>
					</template>
				</NuxtErrorBoundary>
			</div></dialog
	></Teleport>
</template>
<style scoped>
.lab-device-dialog {
	position: fixed;
	inset: var(--visual-top, 0px) 0 auto;
	width: 100vw;
	height: var(--visual-height, 100dvh);
	max-width: none;
	max-height: none;
	border: 0;
	padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
	margin: 0;
	color: #fff;
	background: transparent;
	overflow: auto;
	overscroll-behavior: contain;
}
.lab-device-dialog[open] {
	display: flex;
	align-items: center;
	justify-content: center;
}
.lab-device-dialog::backdrop {
	background: #070c10c4;

}
.device-stage {
	position: relative;
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 13px;
	margin: auto;
	max-width:100%;
	max-height:100%;
	min-height:0;
}
.device-recovery { padding: 36px; border: 1px solid #ffffff30; border-radius: 18px; background: #122127; }
.device-recovery button { margin-top: 20px; padding: 12px 18px; border: 1px solid #a8c5c5; border-radius: 24px; }
.device-close {
	flex-shrink:0;
	min-height:44px;
	position:sticky;top:0;z-index:5;
	display: flex;
	align-items: center;
	align-self: flex-end;
	gap: 10px;
	font:
		11px/1.4 Arial,
		sans-serif;
	color: #dce6e7;
	padding: 7px 4px;
	transition: opacity 150ms;
}
.device-close:hover {
	color: white;
}
.device-close span {
	font-size: 20px;
}
.device-close kbd {
	font:
		8px Arial,
		sans-serif;
	border: 1px solid #ffffff30;
	padding: 3px 5px;
	border-radius: 3px;
	color: #96a3a9;
}
.device-close:focus-visible {
	outline: 1px solid #b3d6d4;
	outline-offset: 4px;
}
.device-close:active {
	transform: scale(0.97);
}
@media (max-height: 600px) {
	.lab-device-dialog {
		padding: 8px;
	}
	.device-stage {
		gap: 3px;
	}
	.device-close {
		padding: 3px;
	}
}

@media(max-width:639px),(max-height:500px){
 .device-stage{gap:4px;}
 .device-close{font-size:12px;min-height:44px;}
 .device-close kbd{display:none;}
}
</style>
