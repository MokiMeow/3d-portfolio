<script setup lang="ts">
import type { LabDevice } from "~/common/models/lab-device.model";
const route = useRoute();
const menu = ref<HTMLDetailsElement>();
const isContact = computed(() => route.path === "/contact");
const active = useState<LabDevice>("activeLabDevice", () => null);
const closeMenu = () => {
	if (menu.value) menu.value.open = false;
};
const pickUp = (device: LabDevice) => {
	closeMenu();
	active.value = device;
};
const outside = (event: PointerEvent) => {
	if (event.target instanceof Node && !menu.value?.contains(event.target)) closeMenu();
};
const toggled = () => {
	if (!menu.value?.open) return;
	document.querySelectorAll<HTMLDetailsElement>('footer details[open]').forEach(other => {
		if (other !== menu.value) other.open = false;
	});
};
onMounted(() => document.addEventListener('pointerdown', outside));
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside));
watch(() => route.path, closeMenu);
</script>

<template>
	<details
		v-if="isContact"
		ref="menu"
		class="desk-objects"
		@toggle="toggled"
		@pointerdown.stop
		@pointerup.stop
		@pointermove.stop
		@click.stop
		@wheel.stop
		@keydown.stop
		@keydown.esc.prevent="closeMenu"
	>
		<summary aria-label="Explore desk objects" title="Explore desk objects">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.3"
				aria-hidden="true"
			>
				<rect x="6" y="2" width="12" height="20" rx="3" />
				<path d="M10 5h4m-4 14h4" />
			</svg>
		</summary>
		<div class="desk-object-menu">
			<p>PICK SOMETHING UP</p>
			<template v-if="isContact">
				<button @click="pickUp('phone')">
					<span>Phone</span><small>03 apps ↗</small>
				</button>
				<button @click="pickUp('glasses')">
					<span>Smart glasses</span><small>▶ Play</small>
				</button>
				<button @click="pickUp('terminal')">
					<span>Pocket terminal</span><small>⌘ Local</small>
				</button>
			</template>
			<span class="desk-object-hint">You can also tap them in the room.</span>
		</div>
	</details>
</template>

<style scoped>
.desk-objects {
	position: relative;
	pointer-events: auto;
	color: #ddd;
}
.desk-objects summary {
	list-style: none;
	cursor: pointer;
	opacity: 0.7;
	width: 26px;
	height: 28px;
	display: grid;
	place-items: center;
}
.desk-objects summary::-webkit-details-marker {
	display: none;
}
.desk-objects summary:hover,
.desk-objects[open] summary {
	opacity: 1;
}
.desk-objects summary svg {
	width: 23px;
	height: 23px;
}
.desk-object-menu {
	position: absolute;
	right: 0;
	bottom: 45px;
	width: 228px;
	padding: 18px 17px 14px;
	background: #192023f2;
	border: 1px solid #ffffff24;
	border-radius: 12px;
	box-shadow: 0 16px 40px #0005;
	text-align: left;
	backdrop-filter: blur(16px);
}
.desk-object-menu p {
	font-size: 8px;
	letter-spacing: 1.8px;
	color: #a3b6b9;
	margin-bottom: 9px;
}
.desk-object-menu button {
	display: flex;
	align-items: center;
	justify-content: space-between;
	width: 100%;
	padding: 11px 0;
	border-bottom: 1px solid #ffffff10;
	font-size: 12px;
	color: #e8efed;
	gap: 15px;
}
.desk-object-menu button small {
	font-size: 9px;
	color: #93aaa5;
	white-space: nowrap;
}
.desk-object-menu button:hover span {
	color: #bfddcb;
}
.desk-object-hint {
	display: block;
	font-size: 9px;
	line-height: 1.5;
	color: #91a09e;
	margin-top: 13px;
}
summary:focus-visible,
button:focus-visible {
	outline: 2px solid #a9c9ba;
	outline-offset: 4px;
	border-radius: 3px;
}
@media (max-width: 480px) {
	.desk-object-menu {
		right: -90px;
		bottom: 42px;
	}
}
</style>
