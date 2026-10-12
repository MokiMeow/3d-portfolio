import gsap from "gsap";
import { Group, Mesh, Vector3 } from "three";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import { splitMeshParts } from "./mesh-parts";

export function createInteractiveDrawers(scene: Group) {
	const groups = [new Group(), new Group(), new Group()];
	const open = [false, false, true]; // Keep the original slightly open top drawer.
	const splits: ReturnType<typeof splitMeshParts>[] = [];
	const selectables: SelectableObject[] = [];
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	groups.forEach((group, i) => {
		group.name = `drawer_${i}`;
		scene.add(group);
	});
	const toggle = (i: number) => {
		open[i] = !open[i];
		const travel = i === 2 ? 0.55368 : 0.55;
		gsap.to(groups[i].position, {
			x: (open[i] ? travel : 0) - (i === 2 ? travel : 0),
			duration: reducedMotion.matches ? 0 : 0.28,
			ease: "power2.out",
			overwrite: true,
		});
		return open[i];
	};
	for (const name of ["scene_1_woods", "scene_1_room"]) {
		const source = scene.getObjectByName(name);
		if (!(source instanceof Mesh)) continue;
		const split = splitMeshParts(source, (box) => {
			const c = box.getCenter(new Vector3());
			if (
				box.min.z < 0.2 ||
				box.max.z > 1.451 ||
				box.min.x < -2.92 ||
				box.max.x > -1.27
			)
				return -1;
			if (box.min.y >= 0.45 && box.max.y <= 1.024) return 0;
			if (box.min.y >= 1.024 && box.max.y <= 1.398) return 1;
			if (box.min.y >= 1.4 && box.max.y <= 1.774 && c.x > -2.37) return 2;
			return -1;
		});
		splits.push(split);
		for (const [i, piece] of split.pieces) {
			groups[i].attach(piece);
			selectables.push({ object: piece, onSelect: () => toggle(i) });
		}
	}
	return {
		selectables,
		toggle,
		dispose() {
			groups.forEach((group) => {
				gsap.killTweensOf(group.position);
				group.removeFromParent();
			});
			splits.forEach((split) => split.dispose());
		},
	};
}
