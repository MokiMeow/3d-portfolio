import gsap from "gsap";
import {
	BoxGeometry,
	Float32BufferAttribute,
	Matrix3,
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	Vector3,
	type BufferGeometry,
	type Material,
} from "three";
import type { LabDevice } from "~/common/models/lab-device.model";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import { splitMeshParts } from "./mesh-parts";

export function createContactProps(scene: Group) {
	const group = new Group();
	group.name = "contact_interactive_props";
	group.visible = false;
	scene.add(group);
	const geometries: BufferGeometry[] = [],
		materials: Material[] = [];
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
	// Reuse the actual sculpted Clyde mesh, including its eye openings and
	// bevels. A clean material replaces the dark atlas; no backing rectangle.
	const discord = scene.getObjectByName("discord_logo");
	const discordOriginal = discord instanceof Mesh ? {
		geometry: discord.geometry, material: discord.material, visible: discord.visible,
	} : undefined;
	if (discord instanceof Mesh) {
		discord.updateWorldMatrix(true, false);
		const geometry = discord.geometry.clone();
		if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
		const normals = geometry.getAttribute("normal");
		const colors = new Float32Array(normals.count * 3);
		const normalMatrix = new Matrix3().getNormalMatrix(discord.matrixWorld);
		const normal = new Vector3();
		const key = new Vector3(0.8, 0.9, -0.6).normalize();
		for (let i = 0; i < normals.count; i++) {
			normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
			const light = 0.54 + 0.46 * Math.max(0, normal.dot(key));
			colors.set([light, light, light], i * 3);
		}
		geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
		const material = new MeshBasicMaterial({
			color: new Color(0.39, 0.46, 0.96), vertexColors: true,
		});
		geometries.push(geometry); materials.push(material);
		discord.geometry = geometry; discord.material = material;
	}
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
			if (discord) discord.visible = visible;
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
			if (discord instanceof Mesh && discordOriginal) {
				discord.geometry = discordOriginal.geometry;
				discord.material = discordOriginal.material;
				discord.visible = discordOriginal.visible;
			}
		},
	};
}
