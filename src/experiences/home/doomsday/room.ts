import { Box3, Group, Matrix4, Mesh, Vector3, type Object3D } from "three";
import { splitMeshParts } from "../world/mesh-parts";

/**
 * The room, taken apart into pieces that can move on their own hinges, without changing how any of it
 * looks: the baked room and wood meshes are split by where each piece sits (the same rules that were
 * checked in Blender), and each group hangs from a pivot at its hinge. `restore` puts everything back.
 */
export type RigGroup = "floor" | "back_wall" | "left_wall" | "desk" | "monitor_a" | "monitor_b" | "chair_base";
const GROUPS: RigGroup[] = ["floor", "back_wall", "left_wall", "desk", "monitor_a", "monitor_b", "chair_base"];

/** Hinges in the model's own frame (x right, y up, z towards the viewer; the back wall is at z = -2.96). */
const HINGES: Record<RigGroup, [number, number, number]> = {
	floor: [0, 0, 0], back_wall: [0, .32, -2.96], left_wall: [-3.2, .32, 0], desk: [-.82, .31, -.47],
	monitor_a: [-2.68, 2.03, 0], monitor_b: [-.4, 1.95, -2.36], chair_base: [1.05, .32, .75],
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
	if (lo.z > 1.95 && hi.z < 3.25 && c.y > 1.9 && -1.7 < c.x && c.x < .5) return "monitor_b";
	if (lo.z > 1.95 && hi.z < 3.2 && c.x < -2.45 && -1 < c.y && c.y < 1) return "monitor_a";
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
	for (const name of ["scene_1_room", "scene_1_woods"]) {
		const source = modelScene.getObjectByName(name);
		if (!(source instanceof Mesh)) continue;
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
			for (const pivot of Object.values(pivots)) pivot.removeFromParent();
		},
	};
}

/** Every mesh's bounds, for finding props by place when names are not enough. */
export function worldBounds(object: Object3D) { return new Box3().setFromObject(object); }
