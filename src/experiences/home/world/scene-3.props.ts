import gsap from "gsap";
import {
	Box3,
	BoxGeometry,
	DirectionalLight,
	HemisphereLight,
	PMREMGenerator,
	Float32BufferAttribute,
	Matrix3,
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	Vector3,
	type BufferGeometry,
	type Material,
	type Object3D,
	type Texture,
	type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { LabDevice } from "~/common/models/lab-device.model";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import { meshPartIndices, splitMeshParts } from "./mesh-parts";
import { createGlossCoat } from "./gloss-coat";
import { createContactShadow, createHeadset, createPhone, createWatch } from "./scene-3.devices";

// The desk's own scale: about 2.9 scene units to a metre, measured from the baked props.
const MILLIMETRE = 0.0029;
// Where the baked phone and glasses lay. Their pieces are lifted out and the new devices stand here.
const PHONE_SPOT = { x: 0.63, z: -0.545, min: [0.36, 1.45, -0.82], max: [1.0, 1.66, -0.28] };
// The glasses stood open around the Rubik's cube: the frame here, an arm on either side of the cube.
const HEADSET_SPOT = { x: 0.437, z: -0.175, min: [0.3, 1.48, -0.42], max: [0.56, 1.72, 0.08] };
const GLASSES_ARMS = [{ min: [0.09, 1.5, -0.39], max: [0.4, 1.66, -0.25] }, { min: [0.2, 1.5, -0.02], max: [0.52, 1.66, 0.12] }];
// The baked watch lay across the tier and onto the notebook. The new one stands where the glasses were.
const OLD_WATCH = { min: [-0.88, 1.5, 0.04], max: [-0.3, 1.64, 0.26] };
const WATCH_SPOT = { x: 0.45, z: -0.19 };
// The tall cube's top, and the small gadget that used to sit on it: the headset's display plinth now.
const PLINTH = { x: -0.47, y: 2.14, z: -0.545, min: [-0.72, 2.1, -0.84], max: [-0.24, 2.42, -0.26] };
// Top of the raised tier the devices stand on, measured from the model.
const DESK_Y = 1.5245;
// The laptop's deck, keyboard and trackpad: thin slabs on top of its riser.
const LAPTOP_DECK = { min: [-0.4, 1.9, 0], max: [0.6, 1.95, 1.1] };

export function createContactProps(scene: Group, renderer: WebGLRenderer) {
	const group = new Group();
	group.name = "contact_interactive_props";
	group.visible = false;
	scene.add(group);
	const geometries: BufferGeometry[] = [],
		materials: Material[] = [],
		textures: Texture[] = [];
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
	// Reflections and light for the two physically shaded devices. The baked desk is unlit and unaffected.
	const studio = new RoomEnvironment();
	const pmrem = new PMREMGenerator(renderer);
	const probe = pmrem.fromScene(studio, 0.04);
	studio.dispose();
	pmrem.dispose();
	const sky = new HemisphereLight(0xffffff, 0x565a66, 1.25);
	const key = new DirectionalLight(0xfff1e0, 1.9);
	key.position.set(2.4, 5, 2.2);
	key.target.position.set(0.55, DESK_Y, -0.35);
	group.add(sky, key, key.target);
	const kit = { geometries, materials, textures, envMap: probe.texture };
	const phone = createPhone(kit);
	phone.group.scale.setScalar(MILLIMETRE);
	phone.group.position.set(PHONE_SPOT.x, DESK_Y, PHONE_SPOT.z);
	// The desk is usually seen from the +x, -z side; both devices are turned to face it.
	phone.group.rotation.y = 1.95;
	const headset = createHeadset(kit);
	headset.group.scale.setScalar(MILLIMETRE * 0.7);
	headset.group.position.set(PLINTH.x + 0.03, PLINTH.y, PLINTH.z - 0.03);
	headset.group.rotation.y = 1.82;
	const watch = createWatch(kit);
	watch.group.scale.setScalar(MILLIMETRE * 1.25);
	watch.group.position.set(WATCH_SPOT.x, DESK_Y, WATCH_SPOT.z);
	watch.group.rotation.y = 2.05;
	group.add(phone.group, headset.group, watch.group);
	// The bake knows nothing of these three, so each gets a soft pool of shadow to stand in.
	for (const [x, y, z, width, depth, strength] of [
		[PHONE_SPOT.x, DESK_Y, PHONE_SPOT.z, 0.44, 0.44, 0.55],
		[WATCH_SPOT.x, DESK_Y, WATCH_SPOT.z, 0.34, 0.34, 0.5],
		[PLINTH.x + 0.03, PLINTH.y + 0.008, PLINTH.z - 0.03, 0.62, 0.62, 0.42],
	]) {
		const shadow = createContactShadow(kit, width, depth, strength);
		shadow.position.set(x, y + 0.002, z);
		group.add(shadow);
	}
	// One invisible box per device answers clicks, whatever part of it is touched.
	const touch = (name: string, object: Object3D, device: LabDevice) => {
		object.updateWorldMatrix(true, true);
		const box = new Box3().setFromObject(object);
		const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
		group.worldToLocal(centre);
		return hit(name, centre.toArray(), size.toArray(), () => open(device));
	};
	touch("phone_touch_surface", phone.group, "phone");
	touch("smart_glasses_touch_surface", headset.group, "glasses");
	touch("watch_touch_surface", watch.group, "watch");
	hit(
		"terminal_pad_touch_surface",
		[-0.273, 1.413, 0.990],
		[0.37, 0.04, 0.33],
		() => open("terminal"),
	);
	// The baked glasses lenses, phone screen and watch face step aside for the new devices.
	const retired = ["eye-glass_glass", "phone_screen_2", "watch_screen"]
		.map((name) => scene.getObjectByName(name))
		.filter((object): object is Object3D => !!object)
		.map((object) => ({ object, scale: object.scale.clone() }));
	retired.forEach(({ object }) => object.scale.setScalar(1e-5));
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
		const inside = (box: Box3, spot: { min: number[]; max: number[] }) =>
			box.min.x > spot.min[0] && box.max.x < spot.max[0] && box.min.y > spot.min[1] &&
			box.max.y < spot.max[1] && box.min.z > spot.min[2] && box.max.z < spot.max[2];
		controller = splitMeshParts(objects, (box) =>
			box.min.x > -0.02 &&
			box.max.x < 0.4 &&
			box.min.y > 1.6 &&
			box.max.y < 1.77 &&
			box.min.z > -0.95 &&
			box.max.z < -0.52
				? 0
				: inside(box, PHONE_SPOT) && (Math.max(box.max.x - box.min.x, box.max.z - box.min.z) > 0.3 || (box.min.x > 0.4 && box.max.y < 1.6))
					? 1
					: inside(box, HEADSET_SPOT) || inside(box, PLINTH) || GLASSES_ARMS.some((arm) => inside(box, arm)) || inside(box, OLD_WATCH)
						? 2
						: -1,
		);
		// Group 1 is the old phone with its buttons; group 2 the glasses, the gadget on the plinth and the old watch.
		for (const old of [1, 2]) {
			const piece = controller.pieces.get(old);
			if (piece) piece.visible = false;
		}
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
	// The laptop keeps its baked colour and gains live reflections on its lid and deck.
	const gloss = createGlossCoat(probe.texture);
	const lid = scene.getObjectByName("pc_top_2");
	if (lid instanceof Mesh) gloss.add(lid, "aluminium");
	if (objects instanceof Mesh) {
		const deck = meshPartIndices(objects, (box) =>
			LAPTOP_DECK.min.every((edge, axis) => box.min.getComponent(axis) > edge) &&
			LAPTOP_DECK.max.every((edge, axis) => box.max.getComponent(axis) < edge) ? 0 : -1);
		gloss.add(objects, "aluminium", deck.get(0));
	}
	gloss.setVisible(false);
	let minute = -1;
	return {
		selectables,
		setVisible(visible: boolean) {
			group.visible = visible;
			gloss.setVisible(visible);
			if (discord) discord.visible = visible;
		},
		/** Keeps the phone's clock current and lets the headset's front glow breathe. */
		update(seconds: number) {
			if (!group.visible) return;
			const now = new Date().getMinutes();
			if (now !== minute) { minute = now; phone.refresh(); watch.refresh(); }
			headset.veil.opacity = reducedMotion.matches ? 0.3 : 0.26 + Math.sin(seconds * 1.3) * 0.1;
		},
		dispose() {
			gsap.killTweensOf(controllerPivot.rotation);
			if (led && ledParent && ledTransform) {
				ledParent.add(led);
				led.position.copy(ledTransform.position);
				led.quaternion.copy(ledTransform.rotation);
				led.scale.copy(ledTransform.scale);
			}
			gloss.dispose();
			controller?.dispose();
			controllerPivot.removeFromParent();
			group.removeFromParent();
			geometries.forEach((g) => g.dispose());
			materials.forEach((m) => m.dispose());
			textures.forEach((t) => t.dispose());
			probe.dispose();
			retired.forEach(({ object, scale }) => object.scale.copy(scale));
			if (discord instanceof Mesh && discordOriginal) {
				discord.geometry = discordOriginal.geometry;
				discord.material = discordOriginal.material;
				discord.visible = discordOriginal.visible;
			}
		},
	};
}
