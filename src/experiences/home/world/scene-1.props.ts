import {
	AmbientLight,
	BoxGeometry,
	MeshBasicMaterial,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	PointLight,
	SphereGeometry,
	TorusGeometry,
} from "three";
import { animate, createTimeline, spring } from "animejs";
// Side-effect import: lets animate() move Three.js objects by name (x, rotateY, scale).
import "animejs/adapters/three";

// MODELS
import type { SelectableObject } from "~/common/models/experience-interaction.model";

/**
 * Two desk toys for the workroom: a Rubik's cube on a levitation stand, and a
 * Newton's cradle. Each is a real mesh, sits on the real desk surface, and
 * answers a click.
 */

type Turn = { axis: "x" | "y" | "z"; layer: number; dir: number };

/** Top of the desk, measured from the room model. */
const DESK_Y = 1.85;

export function createDeskProps(scene: Group) {
	let disposed = false;
	const group = new Group();
	group.name = "desk_props";
	const geometries: { dispose: () => void }[] = [];
	const materials: MeshStandardMaterial[] = [];
	const loops: { cancel: () => unknown }[] = [];
	const selectables: SelectableObject[] = [];

	const geo = <T extends { dispose: () => void }>(item: T) => {
		geometries.push(item);
		return item;
	};
	const mat = (color: string, extra: Partial<{ roughness: number; metalness: number; emissive: string; emissiveIntensity: number }> = {}) => {
		const material = new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });
		materials.push(material);
		return material;
	};
	const clickable = (object: Object3D, onSelect: () => unknown) => selectables.push({ object, onSelect });

	// The room is baked, so these lights touch only the new objects: the warm
	// shelf lamp from the left, and the cool glow of the monitors.
	const lamp = new PointLight(0xffa25c, 7, 7, 1.6);
	lamp.position.set(-2.4, 3.5, 0.3);
	const screens = new PointLight(0xa9cfff, 3.2, 6, 1.6);
	screens.position.set(-0.9, 2.9, -1.2);
	const ambient = new AmbientLight(0x8091b5, 0.75);
	group.add(lamp, screens, ambient);

	// ── A levitation stand at the end of the desk: a dark base with a lit ring.
	// It is what makes the cube's hover read as a display piece and not a glitch.
	const stand = new Group();
	stand.position.set(0.5, DESK_Y, -2.12);
	const plinth = new Mesh(geo(new CylinderGeometry(0.2, 0.235, 0.05, 48)), mat("#15161a", { roughness: 0.45, metalness: 0.45 }));
	plinth.position.y = 0.025;
	const plate = new Mesh(geo(new CylinderGeometry(0.155, 0.155, 0.012, 48)), mat("#08090b", { roughness: 0.18, metalness: 0.7 }));
	plate.position.y = 0.056;
	// The same blue as the light under the desk, so it belongs to this room.
	const ringMaterial = mat("#9adfff", { emissive: "#50cdff", emissiveIntensity: 2.2, roughness: 0.4 });
	const ring = new Mesh(geo(new TorusGeometry(0.168, 0.007, 8, 72)), ringMaterial);
	ring.rotation.x = Math.PI / 2;
	ring.position.y = 0.058;
	const underglow = new PointLight(0x50cdff, 0.5, 0.9, 1.8);
	underglow.position.y = 0.16;
	stand.add(plinth, plate, ring, underglow);
	plinth.name = "desk_rubiks_stand";
	clickable(plinth, () => void workCube());

	// ── The Rubik's cube, held just above the stand and working on itself.
	const cube = new Group();
	cube.position.set(0.5, DESK_Y + 0.3, -2.12);
	const gap = 0.094;
	const cubelet = geo(new BoxGeometry(0.086, 0.086, 0.086));
	const inner = mat("#0c0d10");
	const faces = ["#d6453f", "#e88b2e", "#ecebe6", "#e9c63a", "#2f9e6b", "#3478d6"].map((color) =>
		mat(color, { roughness: 0.38, emissive: color, emissiveIntensity: 0.3 })
	);
	const cubelets: Mesh[] = [];
	const history: Turn[] = [];
	let turning = false;
	let working = false;
	const quarter = Math.PI / 2;
	const snap = (value: number, step: number) => Math.round(value / step) * step;
	const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
	for (let x = -1; x <= 1; x++) {
		for (let y = -1; y <= 1; y++) {
			for (let z = -1; z <= 1; z++) {
				const mesh = new Mesh(cubelet, [
					x === 1 ? faces[0] : inner,
					x === -1 ? faces[1] : inner,
					y === 1 ? faces[2] : inner,
					y === -1 ? faces[3] : inner,
					z === 1 ? faces[4] : inner,
					z === -1 ? faces[5] : inner,
				]);
				mesh.position.set(x * gap, y * gap, z * gap);
				mesh.name = "desk_rubiks_cube";
				cube.add(mesh);
				cubelets.push(mesh);
				clickable(mesh, () => void workCube());
			}
		}
	}
	const pivot = new Group();
	cube.add(pivot);

	// One face turns: its nine cubelets ride a pivot that Anime rotates, then snap back to the grid.
	function turn(move: Turn, duration: number): Promise<void> {
		turning = true;
		const picked = cubelets.filter((mesh) => Math.round(mesh.position[move.axis] / gap) === move.layer);
		pivot.rotation.set(0, 0, 0);
		picked.forEach((mesh) => pivot.attach(mesh));
		const property = move.axis === "x" ? "rotateX" : move.axis === "y" ? "rotateY" : "rotateZ";
		return new Promise((resolve) => {
			animate(pivot, {
				[property]: 90 * move.dir,
				duration,
				ease: "inOut(3)",
				onComplete: () => {
					pivot.updateMatrixWorld();
					picked.forEach((mesh) => {
						cube.attach(mesh);
						mesh.position.set(snap(mesh.position.x, gap), snap(mesh.position.y, gap), snap(mesh.position.z, gap));
						mesh.rotation.set(snap(mesh.rotation.x, quarter), snap(mesh.rotation.y, quarter), snap(mesh.rotation.z, quarter));
					});
					turning = false;
					resolve();
				},
			});
		});
	}
	const randomTurn = (): Turn => ({
		axis: (["x", "y", "z"] as const)[Math.floor(Math.random() * 3)],
		layer: Math.floor(Math.random() * 3) - 1,
		dir: Math.random() < 0.5 ? 1 : -1,
	});
	async function idleCube() {
		while (!disposed) {
			await wait(1100);
			if (disposed) return;
			if (working || turning || document.hidden || history.length > 40) continue;
			const move = randomTurn();
			history.push(move);
			await turn(move, 620);
		}
	}
	// A click undoes every turn, fast. A click on a solved cube scrambles it.
	async function workCube() {
		if (working) return;
		working = true;
		while (turning) await wait(30);
		if (history.length) {
			while (history.length && !disposed) {
				const move = history.pop() as Turn;
				await turn({ ...move, dir: -move.dir }, 110);
			}
			animate(cube, { scale: [1.25, 1], duration: 800, ease: spring({ stiffness: 220, damping: 9 }) });
		} else {
			for (let k = 0; k < 14 && !disposed; k++) {
				const move = randomTurn();
				history.push(move);
				await turn(move, 100);
			}
		}
		working = false;
	}
	loops.push(animate(cube, { rotateY: 360, duration: 32000, loop: true, ease: "linear" }));
	// The cube rides the field: as it sinks toward the stand, the ring brightens to hold it.
	loops.push(animate(cube, { y: [DESK_Y + 0.285, DESK_Y + 0.33], duration: 2600, loop: true, alternate: true, ease: "inOut(2)" }));
	loops.push(animate(ringMaterial, { emissiveIntensity: [3, 1.7], duration: 2600, loop: true, alternate: true, ease: "inOut(2)" }));
	void idleCube();

	// Small things are hard to hit, so each toy also has an unseen, roomier shape that takes the click.
	const unseen = new MeshBasicMaterial({ visible: false });
	const hitBox = geo(new BoxGeometry(1, 1, 1));

	// ── A Newton's cradle on the open front corner of the desk, beside the mug.
	const cradle = new Group();
	// Turned end-on to the visitor, so it stands clear of the mouse, the mug and the cube stand.
	cradle.position.set(0.3, DESK_Y, -1.47);
	cradle.rotation.y = Math.PI / 2;
	cradle.scale.setScalar(0.42);
	const steel = mat("#d9dde3", { roughness: 0.22, metalness: 0.5 });
	const post = geo(new BoxGeometry(0.03, 0.66, 0.03));
	const bar = geo(new BoxGeometry(0.92, 0.03, 0.03));
	const ball = geo(new SphereGeometry(0.078, 24, 16));
	const thread = geo(new CylinderGeometry(0.004, 0.004, 0.49, 6));
	const base = new Mesh(geo(new BoxGeometry(1.0, 0.05, 0.46)), mat("#17181c", { roughness: 0.7 }));
	base.position.y = 0.025;
	cradle.add(base);
	for (const z of [-0.17, 0.17]) {
		for (const x of [-0.44, 0.44]) {
			const upright = new Mesh(post, steel);
			upright.position.set(x, 0.36, z);
			cradle.add(upright);
		}
		const rail = new Mesh(bar, steel);
		rail.position.set(0, 0.69, z);
		cradle.add(rail);
	}
	const swings: Group[] = [];
	for (let i = 0; i < 5; i++) {
		const hinge = new Group();
		hinge.position.set((i - 2) * 0.158, 0.69, 0);
		for (const z of [-0.17, 0.17]) {
			const line = new Mesh(thread, steel);
			line.position.set(0, -0.23, z / 2);
			line.rotation.x = Math.atan2(z, 0.46);
			hinge.add(line);
		}
		const weight = new Mesh(ball, steel);
		weight.position.y = -0.46;
		weight.name = "desk_newtons_cradle";
		hinge.add(weight);
		cradle.add(hinge);
		swings.push(hinge);
		clickable(weight, () => swing.restart());
	}
	clickable(base, () => swing.restart());
	const cradleHit = new Mesh(hitBox, unseen);
	cradleHit.scale.set(1.05, 0.78, 0.5);
	cradleHit.position.y = 0.39;
	cradleHit.name = "desk_newtons_cradle";
	cradle.add(cradleHit);
	clickable(cradleHit, () => swing.restart());
	// Two eases pass the swing along: the falling ball eases in, the rising one eases out.
	const swing = createTimeline({ loop: true })
		.add(swings[0], { rotateZ: [-34, 0], duration: 430, ease: "in(2)" })
		.add(swings[4], { rotateZ: [0, 34], duration: 430, ease: "out(2)" })
		.add(swings[4], { rotateZ: 0, duration: 430, ease: "in(2)" })
		.add(swings[0], { rotateZ: -34, duration: 430, ease: "out(2)" });
	loops.push(swing);

	group.add(stand, cube, cradle);
	scene.add(group);

	return {
		selectables,
		/** With the room's lights off, only the stand's ring is left to see the cube by. */
		setLights(on: boolean) {
			animate(lamp, { intensity: on ? 7 : 0, duration: 1100, ease: "inOut(2)" });
			animate(screens, { intensity: on ? 3.2 : 0, duration: 1100, ease: "inOut(2)" });
			animate(ambient, { intensity: on ? 0.75 : 0.1, duration: 1100, ease: "inOut(2)" });
			animate(underglow, { intensity: on ? 0.5 : 1.3, duration: 1100, ease: "inOut(2)" });
		},
		dispose() {
			disposed = true;
			loops.forEach((item) => item.cancel());
			group.removeFromParent();
			geometries.forEach((item) => item.dispose());
			materials.forEach((item) => item.dispose());
			unseen.dispose();
		},
	};
}
