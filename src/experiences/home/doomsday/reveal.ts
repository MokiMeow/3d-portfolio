import gsap from "gsap";
import {
	AdditiveBlending, CanvasTexture, Color, DirectionalLight, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, Quaternion, Vector3,
	type Material, type Object3D, type PerspectiveCamera, type Texture,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Act V: the one who was waiting. Three original assets built in Blender (doom/bl/sovereign.py): the
 * Sovereign, his gauntlet and his sigil. He stands ahead of where the ship was going, already facing it;
 * the hand rises under the ship and closes; the eyes light last. Then black, and the sigil alone.
 *
 * Everything is in the model's frame, at the room's scale: the hand is twice the ship, he is a mountain.
 */
const DRACO = "https://www.gstatic.com/draco/versioned/decoders/1.4.3/";
const SHIP = new Vector3(2.85, 3, 3);
/** The palm's resting place: just under the ship's keel, wrist towards him. */
const PALM = new Vector3(SHIP.x, -2.6, SHIP.z + 1);
const HAND_SCALE = 6.4, BODY_SCALE = 12;

/** Every material under a named node, whether the node is the mesh or a group of them. */
const materialsOf = (node: Object3D | undefined) => {
	const found: Material[] = [];
	node?.traverse(n => { if (n instanceof Mesh) found.push(...([] as Material[]).concat(n.material)); });
	return found;
};
/** A soft emerald bloom far behind him, so the silhouette has something to stand against. */
const auraTexture = () => {
	const c = document.createElement("canvas"); c.width = c.height = 256;
	const g = c.getContext("2d")!, grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
	grad.addColorStop(0, "rgba(67,240,142,.55)"); grad.addColorStop(.35, "rgba(30,120,80,.22)"); grad.addColorStop(1, "rgba(0,0,0,0)");
	g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
	return new CanvasTexture(c);
};

export function createReveal(parent: Object3D, env: Texture) {
	const root = new Group(); root.name = "doomsday_reveal"; root.visible = false; parent.add(root);
	const fingers: Object3D[] = []; let thumb: Object3D | null = null;
	let eyes: Material[] = [], inlay: Material[] = [];
	const sovereign = new Group(), gauntlet = new Group(), sigil = new Group();
	root.add(sovereign, gauntlet);

	// He faces the ship (-z); the hand comes up from far below.
	sovereign.position.set(SHIP.x - 4, PALM.y - 41, SHIP.z + 74); sovereign.rotation.set(-.08, Math.PI, 0); sovereign.scale.setScalar(BODY_SCALE);
	gauntlet.position.set(PALM.x, PALM.y - 70, PALM.z); gauntlet.rotation.set(0, Math.PI, 0); gauntlet.scale.setScalar(HAND_SCALE);
	sigil.visible = false; sigil.scale.setScalar(2.2);

	// Light that only finds edges: an emerald rim from behind him, a faint cold fill from the ship.
	const rim = new DirectionalLight(new Color("#3ee08a"), 0); rim.position.set(SHIP.x - 70, 70, SHIP.z + 170); rim.target.position.set(SHIP.x, 10, SHIP.z + 60);
	const auraTex = auraTexture();
	const auraMat = new MeshBasicMaterial({ map: auraTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
	const aura = new Mesh(new PlaneGeometry(1, 1), auraMat); aura.position.set(SHIP.x - 4, 34, SHIP.z + 320); aura.scale.setScalar(420); aura.rotation.y = Math.PI;
	root.add(aura);
	// The mark is shown on black: a plate behind it hides whatever is left of the scene.
	// Transparent only so it sorts with (and after) the scene's own additive glows.
	const blackMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, depthTest: false });
	const black = new Mesh(new PlaneGeometry(1, 1), blackMat); black.renderOrder = 900; black.visible = false;
	const under = new PointLight(new Color("#43f08e"), 0, 120, 1.6); under.position.set(SHIP.x, PALM.y + 4, PALM.z + 6);
	const glare = new PointLight(new Color("#43f08e"), 0, 90, 1.4);
	root.add(rim, rim.target, under, glare);

	const draco = new DRACOLoader().setDecoderPath(DRACO);
	const loader = new GLTFLoader().setDRACOLoader(draco);
	const owned: { geometry: { dispose(): void }; material: Material | Material[] }[] = [];
	const take = async (url: string, into: Group) => {
		const gltf = await loader.loadAsync(url);
		gltf.scene.traverse(node => {
			if (!(node instanceof Mesh)) return;
			owned.push(node);
			const material = node.material as MeshStandardMaterial;
			if (material.isMeshStandardMaterial && material.emissiveIntensity < 1) { material.envMap = env; material.envMapIntensity = .4; }
		});
		into.add(gltf.scene);
		return gltf.scene;
	};
	const ready = Promise.all([
		take("/doomsday/sovereign.glb", sovereign).then(scene => {
			eyes = materialsOf(scene.getObjectByName("sovereign_eyes"));
			eyes.forEach(m => { (m as MeshStandardMaterial).emissiveIntensity = 0; });
		}),
		take("/doomsday/gauntlet.glb", gauntlet).then(scene => {
			for (let i = 1; i <= 4; i++) { const f = scene.getObjectByName(`gauntlet_finger_${i}`); if (f) fingers.push(f); }
			thumb = scene.getObjectByName("gauntlet_thumb") ?? null;
			inlay = materialsOf(scene.getObjectByName("gauntlet_inlay"));
		}),
		take("/doomsday/sigil.glb", sigil).then(scene => {
			// Flat emerald light, untouched by tone mapping, so it stays green rather than washing to white.
			scene.traverse(n => { if (n instanceof Mesh) { ([] as Material[]).concat(n.material).forEach(m => m.dispose()); n.material = new MeshBasicMaterial({ color: new Color("#43f08e"), transparent: true, opacity: 0, toneMapped: false, depthTest: false }); n.renderOrder = 901; } });
		}),
	]).catch(error => { console.warn("[doomsday] reveal assets", error); }).finally(() => draco.dispose());

	const eyeLevel = { value: 0 };
	const markState = { size: 1, up: 0 };
	let marked: PerspectiveCamera | null = null;
	return {
		root, ready,
		/** He was there all along: show him in the dark before anyone can see him. */
		arrive(tl: gsap.core.Timeline, at: number) {
			tl.call(() => { root.visible = true; root.updateMatrixWorld(true); const e = root.getObjectByName("sovereign_eyes"); if (e) glare.position.copy(parent.worldToLocal(e.getWorldPosition(new Vector3()))); }, [], at);
			tl.to(rim, { intensity: 5, duration: 5, ease: "power1.in" }, at + .5);
			tl.to(auraMat, { opacity: 1, duration: 4, ease: "power1.in" }, at + 6.5);
		},
		/** The hand comes up under the ship and takes it. */
		take(tl: gsap.core.Timeline, at: number) {
			tl.to(gauntlet.position, { y: PALM.y, duration: 3.4, ease: "power3.out" }, at);
			tl.to(under, { intensity: 40, duration: 2.4 }, at + 1);
			tl.call(() => {
				fingers.forEach((f, i) => gsap.to(f.rotation, { x: 1.05, duration: 2.6, delay: i * .12, ease: "power2.inOut" }));
				if (thumb) gsap.to(thumb.rotation, { z: .8, duration: 2.4, delay: .3, ease: "power2.inOut" });
				inlay.forEach(m => gsap.to(m, { emissiveIntensity: 14, duration: 1.6 }));
			}, [], at + 2.6);
		},
		/** The last thing to light. */
		look(tl: gsap.core.Timeline, at: number) {
			tl.to(eyeLevel, { value: 1, duration: 1.8, ease: "power2.in", onUpdate: () => {
				eyes.forEach(m => { (m as MeshStandardMaterial).emissiveIntensity = eyeLevel.value * 3.2; });
				glare.intensity = eyeLevel.value * 120;
			} }, at);
		},
		/** Black, then the mark alone in front of the lens. */
		/** Black, then his mark alone, held in front of the lens wherever the lens is. */
		mark(camera: PerspectiveCamera) {
			root.visible = false; marked = camera;
			parent.add(sigil, black); sigil.visible = true; black.visible = true;
			sigil.traverse(n => { if (n instanceof Mesh) gsap.to(n.material as MeshBasicMaterial, { opacity: 1, duration: 1.6, ease: "power2.out" }); });
			gsap.fromTo(markState, { size: 1.18 }, { size: 1, duration: 3, ease: "power2.out" });
		},
		/** Make room for the end card: the mark rises above the words and shrinks to a seal. */
		settle() {
			gsap.to(markState, { size: .32, up: .33, duration: 1.4, ease: "power3.inOut" });
		},
		/** Each frame: keep the mark (and its black) square to the camera, at a fixed share of the frame. */
		update() {
			if (!marked) return;
			const camera = marked, distance = 6;
			const facing = camera.quaternion.clone().premultiply(parent.getWorldQuaternion(new Quaternion()).invert());
			const scale = parent.getWorldScale(new Vector3()).x;
			const frame = (d: number) => 2 * d * Math.tan(camera.fov * Math.PI / 360) / scale;
			const place = (object: Object3D, d: number, up: number) => {
				const ahead = camera.getWorldPosition(new Vector3())
					.add(camera.getWorldDirection(new Vector3()).multiplyScalar(d))
					.add(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(up * frame(d) * scale));
				object.position.copy(parent.worldToLocal(ahead)); object.quaternion.copy(facing);
			};
			place(black, distance + 1, 0); black.scale.set(frame(distance + 1) * camera.aspect * 1.2, frame(distance + 1) * 1.2, 1);
			place(sigil, distance, markState.up);
			// About two fifths of the frame, whatever the lens and the model's scale.
			sigil.scale.setScalar(frame(distance) * .42 / 1.78 * markState.size);
		},
		dispose() {
			gsap.killTweensOf([rim, under, eyeLevel, auraMat, markState, ...fingers.map(f => f.rotation), ...(thumb ? [thumb.rotation] : []), ...inlay, ...eyes]);
			root.removeFromParent(); sigil.removeFromParent(); black.removeFromParent();
			auraMat.dispose(); auraTex.dispose(); aura.geometry.dispose(); blackMat.dispose(); black.geometry.dispose();
			for (const mesh of owned) { mesh.geometry.dispose(); ([] as Material[]).concat(mesh.material).forEach(m => m.dispose()); }
		},
	};
}
