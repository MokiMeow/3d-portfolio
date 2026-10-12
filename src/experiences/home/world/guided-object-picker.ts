import { Raycaster, Vector2, type Group, type PerspectiveCamera } from "three";
import type { SelectableObject } from "~/common/models/experience-interaction.model";

/** Action-only picking for the guided tour, with the same occlusion as free mode. */
export function createGuidedObjectPicker(options: {
	active: () => boolean;
	scene: () => Group | undefined;
	camera: () => PerspectiveCamera | undefined;
	selectables: () => SelectableObject[];
}) {
	const ray = new Raycaster(),
		point = new Vector2();
	let pressed: { x: number; y: number; item: SelectableObject } | undefined;
	let hovered: SelectableObject | undefined;
	const pick = (event: PointerEvent) => {
		const scene = options.scene(),
			camera = options.camera();
		if (
			!options.active() ||
			!scene ||
			!camera ||
			!(event.target instanceof Element) ||
			event.target.closest(
				"button, a, input, textarea, select, iframe, dialog, [role='dialog']",
			)
		)
			return;
		point.set(
			(event.clientX / innerWidth) * 2 - 1,
			(-event.clientY / innerHeight) * 2 + 1,
		);
		ray.setFromCamera(point, camera);
		const surface = ray.intersectObject(scene, true).find((hit) => {
			let object = hit.object;
			while (object.parent) {
				if (!object.visible) return false;
				object = object.parent;
			}
			return object.visible;
		})?.object;
		return options
			.selectables()
			.find((item) => item.object === surface && item.onSelect);
	};
	const down = (event: PointerEvent) => {
		if (!event.isPrimary) return;
		const item = pick(event);
		pressed = item ? { x: event.clientX, y: event.clientY, item } : undefined;
	};
	const up = (event: PointerEvent) => {
		const start = pressed;
		pressed = undefined;
		if (
			event.isPrimary &&
			start &&
			Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 &&
			pick(event) === start.item
		)
			start.item.onSelect?.();
	};
	const move = (event: PointerEvent) => {
		if (event.pointerType !== "mouse") return;
		const item = pick(event);
		if (item === hovered) return;
		hovered?.onHover?.(false);
		item?.onHover?.(true);
		hovered = item;
		if (options.active())
			document.documentElement.style.cursor = item ? "pointer" : "";
	};
	const cancel = () => {
		pressed = undefined;
	};
	window.addEventListener("pointerdown", down);
	window.addEventListener("pointerup", up);
	window.addEventListener("pointermove", move);
	window.addEventListener("pointercancel", cancel);
	return {
		dispose() {
			window.removeEventListener("pointerdown", down);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointercancel", cancel);
			hovered?.onHover?.(false);
			document.documentElement.style.cursor = "";
		},
	};
}
