import { Box3, BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Vector3, type Object3D } from "three";
import { splitMeshParts } from "../world/mesh-parts";

/**
 * The room, taken apart into pieces that can move on their own hinges, without changing how any of it
 * looks: the baked room and wood meshes are split by where each piece sits (the same rules that were
 * checked in Blender), and each group hangs from a pivot at its hinge. `restore` puts everything back.
 */
export type RigGroup = "floor" | "back_wall" | "left_wall" | "desk" | "monitor_a" | "monitor_b" | "chair_base" | "phone";
const GROUPS: RigGroup[] = ["floor", "back_wall", "left_wall", "desk", "monitor_a", "monitor_b", "chair_base", "phone"];

/** Hinges in the model's own frame (x right, y up, z towards the viewer; the back wall is at z = -2.96). */
const HINGES: Record<RigGroup, [number, number, number]> = {
	floor: [0, 0, 0], back_wall: [0, .32, -2.96], left_wall: [-3.2, .32, 0], desk: [-.82, .31, -.47],
	monitor_a: [-2.6, 1.87, 0], monitor_b: [-.7, 1.87, -2.04], phone: [-2.05, 1.86, .34], chair_base: [1.05, .32, .75],
};

/** Each monitor whole (bezel, back, stand and base plate), as a box in the model's frame. */
const MONITOR_REGIONS: Partial<Record<RigGroup, Box3>> = {
	monitor_a: new Box3(new Vector3(-3.12, 1.845, -.92), new Vector3(-2.52, 3.22, .98)),
	monitor_b: new Box3(new Vector3(-1.62, 1.845, -2.64), new Vector3(.24, 3.22, -1.98)),
	// The phone on its stand, in front of the left monitor: it lies down before the monitor comes down over it.
	phone: new Box3(new Vector3(-2.42, 1.845, .17), new Vector3(-1.99, 2.42, .52)),
};

/** The Blender rules, in Blender's frame (x right, y towards the back wall, z up). */
function classify(lo: Vector3, hi: Vector3): RigGroup | null {
	const c = lo.clone().add(hi).multiplyScalar(.5), s = hi.clone().sub(lo);
	if (s.x > 6 && s.y > 6 && s.z < .5) return "floor";
	if (s.z < .35 && hi.z < .6 && (s.x > 5.5 || s.y > 5.5)) return "floor";
	if (s.y < .45 && lo.y > 2.7 && s.z > 2.5) return "back_wall";
	if (s.y < .35 && hi.y > 2.78 && c.x > -2.9) return "back_wall";
	if (hi.y > 2.78 && lo.z > 2.35 && c.x > -2.9 && !(lo.z < 3.3 && -1.7 < c.x && c.x < .5 && s.y > .25)) return "back_wall";
	if (s.x < .45 && hi.x < -2.9 && s.z > 2.5) return "left_wall";
	if (s.x < .35 && lo.x < -2.95) return "left_wall";
	if (lo.x < -2.9 && lo.z > 2.35) return "left_wall";
	if (lo.x < -2.6 && c.z > 3.3) return "left_wall";
	if (c.x > 1 && lo.y > 2.6 && c.z > 1.4) return "back_wall";
	// The whole monitor: bezel, stand and base plate (the base sits on the desk top at ~1.86).
	if (lo.z > 1.84 && hi.z < 3.25 && c.y > 1.9 && -1.7 < c.x && c.x < .5) return "monitor_b";
	if (lo.z > 1.84 && hi.z < 3.2 && c.x < -2.45 && -1 < c.y && c.y < 1) return "monitor_a";
	if (hi.z < 1.6 && .3 < c.x && c.x < 1.7 && -1.9 < c.y && c.y < .4) return "chair_base";
	if (c.x < 1 && c.y > -1.6 && hi.z < 3.2 && c.z > .2) return "desk";
	return null;
}

export function rigRoom(modelScene: Object3D) {
	const pivots = {} as Record<RigGroup, Group>;
	for (const group of GROUPS) {
		const pivot = new Group();
		pivot.name = `doomsday_pivot_${group}`;
		pivot.position.fromArray(HINGES[group]);
		modelScene.add(pivot);
		pivots[group] = pivot;
	}
	const splits: ReturnType<typeof splitMeshParts>[] = [];
	const moved: { object: Object3D; parent: Object3D }[] = [];
	// The monitors are welded into the desk's geometry, so connected parts cannot free them: every triangle
	// inside a monitor's box (bezel, back, stand, base plate) is lifted out into its own piece, from every
	// variant of the room mesh (they share one geometry), and the shared index is put back on restore.
	const extracted: { geometry: BufferGeometry; index: BufferAttribute; pieces: Mesh[] }[] = [];
	{
		const roomMeshes: Mesh[] = [];
		modelScene.traverse(o => { if (o instanceof Mesh && /^scene_1_room(_gloss_[a-z]+)?$/.test(o.name)) roomMeshes.push(o); });
		modelScene.updateMatrixWorld(true);
		const toModel = new Matrix4().copy(modelScene.matrixWorld).invert();
		const byGeometry = new Map<BufferGeometry, Mesh[]>();
		for (const m of roomMeshes) { const g = m.geometry as BufferGeometry; if (!byGeometry.has(g)) byGeometry.set(g, []); byGeometry.get(g)!.push(m); }
		for (const [geometry, meshes] of byGeometry) {
			const index = geometry.getIndex(); if (!index) continue;
			const position = geometry.getAttribute("position");
			const toLocal = new Matrix4().multiplyMatrices(toModel, meshes[0]!.matrixWorld);
			const a = new Vector3(), b = new Vector3(), c = new Vector3();
			const keep: number[] = [], take: Record<string, number[]> = {};
			for (let t = 0; t < index.count; t += 3) {
				const i0 = index.getX(t), i1 = index.getX(t + 1), i2 = index.getX(t + 2);
				a.fromBufferAttribute(position, i0); b.fromBufferAttribute(position, i1); c.fromBufferAttribute(position, i2);
				const centre = a.add(b).add(c).divideScalar(3).applyMatrix4(toLocal);
				const region = (Object.keys(MONITOR_REGIONS) as RigGroup[]).find(k => MONITOR_REGIONS[k]!.containsPoint(centre));
				if (region) (take[region] ??= []).push(i0, i1, i2); else keep.push(i0, i1, i2);
			}
			if (!Object.keys(take).length) continue;
			const original = index.clone();
			const pieces: Mesh[] = [];
			for (const [region, list] of Object.entries(take)) {
				const part = new BufferGeometry();
				for (const [name, attribute] of Object.entries(geometry.attributes)) part.setAttribute(name, attribute);
				part.setIndex(list);
				for (const mesh of meshes) {
					const piece = new Mesh(part, mesh.material); piece.name = `${mesh.name}_${region}`;
					piece.renderOrder = mesh.renderOrder;
					mesh.parent!.add(piece); piece.position.copy(mesh.position); piece.quaternion.copy(mesh.quaternion); piece.scale.copy(mesh.scale);
					pivots[region as RigGroup].attach(piece); pieces.push(piece);
				}
			}
			geometry.setIndex(keep);
			extracted.push({ geometry, index: original, pieces });
		}
	}
	// The room is baked into several merged meshes: matte, wood, and glossy variants (the monitors' bezels and
	// stands, the metal trim). Every one of them is split by the same rules, so a monitor folds as one object.
	const sources: Mesh[] = [];
	modelScene.traverse(o => { if (o instanceof Mesh && /^scene_1_(room|woods)(_gloss_[a-z]+)?$/.test(o.name)) sources.push(o); });
	for (const source of sources) {
		source.updateWorldMatrix(true, false);
		const toLocal = new Matrix4().copy(source.matrixWorld).invert();
		const split = splitMeshParts(source, world => {
			// World bounds back into the model's frame, then into Blender's (x, -z, y).
			const local = world.clone().applyMatrix4(toLocal);
			const lo = new Vector3(local.min.x, -local.max.z, local.min.y), hi = new Vector3(local.max.x, -local.min.z, local.max.y);
			const group = classify(lo, hi);
			return group ? GROUPS.indexOf(group) : -1;
		});
		splits.push(split);
		for (const [index, piece] of split.pieces) {
			const pivot = pivots[GROUPS[index]!];
			// Keep the piece exactly where it was while it hangs from its hinge.
			moved.push({ object: piece, parent: piece.parent! });
			pivot.attach(piece);
		}
	}
	/** Other objects that should travel with a group (screens with their monitors, the window glass with its wall). */
	const carry = (object: Object3D | undefined, group: RigGroup) => {
		if (!object?.parent) return;
		moved.push({ object, parent: object.parent });
		pivots[group].attach(object);
	};
	const pivotWorld = (group: RigGroup) => pivots[group].getWorldPosition(new Vector3());
	return {
		pivots,
		carry,
		pivotWorld,
		/** Every piece back where it was, as the room it started as. */
		restore() {
			for (const pivot of Object.values(pivots)) { pivot.position.fromArray(HINGES[pivot.name.replace("doomsday_pivot_", "") as RigGroup]); pivot.rotation.set(0, 0, 0); pivot.scale.set(1, 1, 1); }
			for (const { object, parent } of moved.reverse()) parent.attach(object);
			for (const split of splits.reverse()) split.dispose();
			for (const { geometry, index, pieces } of extracted) { geometry.setIndex(index); pieces.forEach(p => p.removeFromParent()); new Set(pieces.map(p => p.geometry)).forEach(g => { g.setIndex(null); g.dispose(); }); }
			for (const pivot of Object.values(pivots)) pivot.removeFromParent();
		},
	};
}

/** Every mesh's bounds, for finding props by place when names are not enough. */
export function worldBounds(object: Object3D) { return new Box3().setFromObject(object); }
