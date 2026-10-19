import { AnimationMixer, Color, Mesh, MeshStandardMaterial, type AnimationAction, type Material, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * WALL·E for the film: the same model as the room's companion (identical standing), rebuilt in Blender with
 * the mechanics to close into his box (roof hatch, side channels, tread wells; doom/walle job2) and two clips,
 * Box_Fold and Box_Unfold. The director swaps him in for the companion in the moment the companion is still,
 * copies the pose across, and from then on drives him: `pose` for the hand-animated look and nod, `fold(t)`
 * for the closing (sampled at any time, so the timeline can seek).
 */
export async function createFilmWalle(url = "/doomsday/walle-boxable.glb") {
	const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
	const root = gltf.scene; root.name = "doomsday_walle";
	const mixer = new AnimationMixer(root);
	const clip = (name: string) => gltf.animations.find(a => a.name === name);
	const actions: Record<"fold" | "unfold", AnimationAction | null> = {
		fold: clip("Box_Fold") ? mixer.clipAction(clip("Box_Fold")!) : null,
		unfold: clip("Box_Unfold") ? mixer.clipAction(clip("Box_Unfold")!) : null,
	};
	for (const a of Object.values(actions)) if (a) { a.clampWhenFinished = true; a.setLoop(2200 /* LoopOnce */, 1); }
	const foldLength = actions.fold?.getClip().duration ?? 4.5;

	// Controls, by normalised name, and their rest pose.
	const controls = new Map<string, Object3D>();
	root.traverse(o => { const key = o.name.toLowerCase().replace(/[^a-z0-9]/g, ""); if (key.startsWith("control")) controls.set(key, o); });
	const rest = new Map<Object3D, { x: number; y: number; z: number }>();
	controls.forEach(o => rest.set(o, { x: o.rotation.x, y: o.rotation.y, z: o.rotation.z }));

	// His own materials, cloned once, so he can burn amber without touching the companion's.
	const materials: MeshStandardMaterial[] = [];
	root.traverse(o => {
		if (!(o instanceof Mesh)) return;
		const list = ([] as Material[]).concat(o.material).map(m => {
			const c = m.clone(); if (c instanceof MeshStandardMaterial) materials.push(c); return c;
		});
		o.material = Array.isArray(o.material) ? list : list[0]!;
	});
	const emissiveWas = materials.map(m => ({ color: m.emissive.clone(), intensity: m.emissiveIntensity }));
	const amber = new Color("#ffb347");

	// The treads' surface, scrolled as he drives (if the model's track material has a texture to move).
	const treads: { material: MeshStandardMaterial; side: number }[] = [];
	root.traverse(o => {
		if (!(o instanceof Mesh) || !/^track \| (left|right)$/i.test(o.name)) return;
		const m = o.material as MeshStandardMaterial;
		if (m.map) { m.map = m.map.clone(); m.map.needsUpdate = true; treads.push({ material: m, side: /left/i.test(o.name) ? -1 : 1 }); }
	});

	let folding = -1;
	return {
		root, controls, foldLength,
		control(name: string) { return controls.get(name.toLowerCase().replace(/[^a-z0-9]/g, "")); },
		/** Copy another model's control pose (the companion's, at the swap). */
		copyPose(from: Object3D) {
			from.traverse(o => {
				const key = o.name.toLowerCase().replace(/[^a-z0-9]/g, "");
				const mine = controls.get(key); if (mine) { mine.rotation.copy(o.rotation); mine.position.copy(o.position); }
			});
		},
		/** Back to standing rest, exactly. */
		rest() { rest.forEach((r, o) => o.rotation.set(r.x, r.y, r.z)); },
		restOf(o: Object3D) { return rest.get(o); },
		/** The box fold, sampled at `seconds` into the clip (negative: not started; past the end: closed). */
		fold(seconds: number) {
			const action = actions.fold; if (!action) return;
			if (seconds < 0) { if (folding >= 0) { action.stop(); folding = -1; } return; }
			const t = Math.min(seconds, foldLength - 1e-3);
			if (folding < 0) { action.reset(); action.play(); }
			folding = t; action.time = t; mixer.update(0);
		},
		/** Treads: distance driven (model units) on each side, for the belt to roll by. */
		roll(left: number, right: number) { for (const t of treads) t.material.map!.offset.y = (t.side < 0 ? left : right) * .9; },
		/** Burn amber, 0..1: his seams first, then all of him, white at the heart. */
		burn(level: number) {
			materials.forEach((m, i) => {
				const was = emissiveWas[i]!;
				m.emissive.copy(was.color).lerp(amber, Math.min(1, level * 1.4));
				m.emissiveIntensity = was.intensity + level * level * 2.4;
			});
		},
		opacity(value: number) {
			for (const m of materials) { m.transparent = value < 1; m.opacity = value; m.depthWrite = value > .5; }
		},
		dispose() {
			mixer.stopAllAction(); root.removeFromParent();
			root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); ([] as Material[]).concat(o.material).forEach(m => m.dispose()); } });
			treads.forEach(t => t.material.map?.dispose());
		},
	};
}
export type FilmWalle = Awaited<ReturnType<typeof createFilmWalle>>;
