<script setup lang="ts">
import { animate, type JSAnimation } from "animejs";
import type { LabDevice } from "~/common/models/lab-device.model";
const active = useState<LabDevice>("activeLabDevice", () => null);
const dialog = ref<HTMLDialogElement>();
const body = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const route = useRoute();
let entrance: JSAnimation | undefined;
const close = () => {
	active.value = null;
};
watch(active, async (value) => {
	entrance?.pause();
	if (!value) {
		dialog.value?.close();
		return;
	}
	await nextTick();
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
				<button ref="closeButton" class="device-close" @click="close">
					<span aria-hidden="true">×</span> Put it back <kbd>ESC</kbd></button
				><LazyHomeLabPhone v-if="active === 'phone'" /><LazyHomeLabGlasses
					v-else-if="active === 'glasses'"
				/><LazyHomeLabTerminal v-else />
			</div></dialog
	></Teleport>
</template>
<style scoped>
.lab-device-dialog {
	position: fixed;
	inset: 0;
	width: 100vw;
	height: 100dvh;
	max-width: none;
	max-height: none;
	border: 0;
	padding: 20px;
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
	backdrop-filter: blur(8px);
}
.device-stage {
	position: relative;
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 13px;
	margin: auto;
}
.device-close {
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
</style>
