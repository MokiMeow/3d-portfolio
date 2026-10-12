import gsap from "gsap";
import {
	BoxGeometry,
	CanvasTexture,
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	Vector3,
	type BufferGeometry,
	type Material,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { LabDevice } from "~/common/models/lab-device.model";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import { splitMeshParts } from "./mesh-parts";

export function createContactProps(scene: Group) {
	const group = new Group();
	group.name = "contact_interactive_props";
	group.visible = false;
	scene.add(group);
	const geometries: BufferGeometry[] = [],
		materials: Material[] = [],
		textures: CanvasTexture[] = [];
	const selectables: SelectableObject[] = [];
	const open = (device: LabDevice) => {
		useState<LabDevice>("activeLabDevice", () => null).value = device;
	};
	const hitMaterial = new MeshBasicMaterial({ visible: false });
	materials.push(hitMaterial);
	const hit = (
		name: string,
		center: number[],
		size: number[],
		action: () => void,
	) => {
		const geometry = new BoxGeometry(size[0], size[1], size[2]);
		geometries.push(geometry);
		const mesh = new Mesh(geometry, hitMaterial);
		mesh.name = name;
		mesh.position.fromArray(center);
		group.add(mesh);
		selectables.push({ object: mesh, onSelect: action });
		return mesh;
	};
	hit("phone_touch_surface", [0.684, 1.558, -0.545], [0.51, 0.027, 0.38], () =>
		open("phone"),
	);
	hit(
		"smart_glasses_touch_surface",
		[0.429, 1.588, -0.17],
		[0.14, 0.14, 0.41],
		() => open("glasses"),
	);
	hit(
		"terminal_pad_touch_surface",
		[-0.273, 1.413, 0.990],
		[0.37, 0.04, 0.33],
		() => open("terminal"),
	);
	const lenses = scene.getObjectByName("eye-glass_glass");
	if (lenses)
		selectables.push({ object: lenses, onSelect: () => open("glasses") });
	// The original hidden logo left a dark baked silhouette. A real enamel
	// plaque occupies that same footprint, including its shadow, on the plinth.
	const discord = scene.getObjectByName("discord_logo");
	if (discord) discord.visible = false;
	const plaque = new Group();
	plaque.name = "discord_enamel_plaque";
	plaque.position.set(0.445, 1.672, 0.365);
	// The logo's original +Y points out of the face; use +Z for our plaque.
	plaque.lookAt(
		plaque.position.clone().add(new Vector3(0.84396, 0.22432, -0.48726)),
	);
	const backingGeometry = new RoundedBoxGeometry(0.49, 0.355, 0.037, 3, 0.018);
	geometries.push(backingGeometry);
	const backingMaterial = new MeshBasicMaterial({
		color: new Color(0.22, 0.25, 0.61),
	});
	materials.push(backingMaterial);
	const backing = new Mesh(backingGeometry, backingMaterial);
	plaque.add(backing);
	const canvas = document.createElement("canvas");
	canvas.width = 512;
	canvas.height = 368;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = "#5865f2";
	ctx.fillRect(0, 0, 512, 368);
	// Discord's Clyde mark, drawn crisply rather than sampling the baked atlas.
	ctx.save();
	ctx.translate(74, 36);
	ctx.scale(15.2, 15.2);
	const clyde = new Path2D(
		"M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.445.865-.609 1.25a18.27 18.27 0 0 0-5.487 0c-.164-.394-.406-.875-.618-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.675 4.37a.07.07 0 0 0-.032.027C.533 9.043-.32 13.574.099 18.05a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.095.252-.194.372-.294a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.1.246.2.373.294a.077.077 0 0 1-.006.128 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.771 1.362 1.225 1.992a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.67-3.549-13.653a.061.061 0 0 0-.03-.028Z",
	);
	ctx.fillStyle = "#fff";
	ctx.fill(clyde);
	ctx.fillStyle = "#5865f2";
	ctx.beginPath();
	ctx.ellipse(8.02, 12.97, 1.46, 1.67, 0, 0, Math.PI * 2);
	ctx.ellipse(15.98, 12.97, 1.46, 1.67, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
	const texture = new CanvasTexture(canvas);
	textures.push(texture);
	const faceGeometry = new PlaneGeometry(0.455, 0.326);
	geometries.push(faceGeometry);
	const faceMaterial = new MeshBasicMaterial({ map: texture });
	materials.push(faceMaterial);
	const face = new Mesh(faceGeometry, faceMaterial);
	face.position.z = 0.0195;
	plaque.add(face);
	group.add(plaque);
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

	// The game controller rocks once when tapped. Its real shell and buttons
	// move together, preserving the existing baked model and all its details.
	const objects = scene.getObjectByName("scene_3_objects");
	let controller: ReturnType<typeof splitMeshParts> | undefined;
	const controllerPivot = new Group();
	controllerPivot.position.set(0.19, 1.64, -0.73);
	scene.add(controllerPivot);
	const led = scene.getObjectByName("gamepad_led");
	const ledParent = led?.parent;
	const ledTransform = led && {
		position: led.position.clone(),
		rotation: led.quaternion.clone(),
		scale: led.scale.clone(),
	};
	if (objects instanceof Mesh) {
		controller = splitMeshParts(objects, (box) =>
			box.min.x > -0.02 &&
			box.max.x < 0.4 &&
			box.min.y > 1.6 &&
			box.max.y < 1.77 &&
			box.min.z > -0.95 &&
			box.max.z < -0.52
				? 0
				: -1,
		);
		const piece = controller.pieces.get(0);
		if (piece) {
			controllerPivot.attach(piece);
			if (led) controllerPivot.attach(led);
			selectables.push({
				object: piece,
				onSelect: () => {
					if (reducedMotion.matches) return;
					gsap.killTweensOf(controllerPivot.rotation);
					gsap.fromTo(
						controllerPivot.rotation,
						{ z: -0.07 },
						{ z: 0, duration: 0.28, ease: "power2.out" },
					);
				},
			});
		}
	}
	return {
		selectables,
		setVisible(visible: boolean) {
			group.visible = visible;
		},
		dispose() {
			gsap.killTweensOf(controllerPivot.rotation);
			if (led && ledParent && ledTransform) {
				ledParent.add(led);
				led.position.copy(ledTransform.position);
				led.quaternion.copy(ledTransform.rotation);
				led.scale.copy(ledTransform.scale);
			}
			controller?.dispose();
			controllerPivot.removeFromParent();
			group.removeFromParent();
			geometries.forEach((g) => g.dispose());
			materials.forEach((m) => m.dispose());
			textures.forEach((t) => t.dispose());
		},
	};
}
