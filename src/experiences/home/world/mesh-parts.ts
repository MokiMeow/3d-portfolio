import { Box3, BufferGeometry, Mesh, Sphere, Vector3 } from "three";

/**
 * Group a baked mesh's triangles by which disconnected piece they belong to.
 * `classify` sees each piece's world bounds and names its group; -1 means "leave it".
 * Nothing is changed: the result is index lists into the mesh's own attributes.
 */
export function meshPartIndices(
	source: Mesh,
	classify: (bounds: Box3) => number,
) {
	const positions = source.geometry.getAttribute("position");
	const index = source.geometry.index;
	const count = positions.count;
	const parents = new Int32Array(count);
	for (let i = 0; i < count; i++) parents[i] = i;
	const find = (value: number): number => {
		let root = value;
		while (parents[root] !== root) root = parents[root];
		while (parents[value] !== value) {
			const next = parents[value];
			parents[value] = root;
			value = next;
		}
		return root;
	};
	const join = (a: number, b: number) => {
		parents[find(a)] = find(b);
	};
	const welded = new Map<string, number>();
	for (let i = 0; i < count; i++) {
		const key = `${Math.round(positions.getX(i) * 10000)},${Math.round(positions.getY(i) * 10000)},${Math.round(positions.getZ(i) * 10000)}`;
		const previous = welded.get(key);
		if (previous !== undefined) join(i, previous);
		else welded.set(key, i);
	}
	const total = index?.count ?? count;
	const vertexAt = (i: number) => (index ? index.getX(i) : i);
	for (let i = 0; i < total; i += 3) {
		join(vertexAt(i), vertexAt(i + 1));
		join(vertexAt(i), vertexAt(i + 2));
	}
	source.updateWorldMatrix(true, false);
	const bounds = new Map<number, Box3>();
	const point = new Vector3();
	for (let i = 0; i < count; i++) {
		const root = find(i);
		if (!bounds.has(root)) bounds.set(root, new Box3());
		point.fromBufferAttribute(positions, i).applyMatrix4(source.matrixWorld);
		bounds.get(root)!.expandByPoint(point);
	}
	const groups = new Map<number, number>();
	for (const [root, box] of bounds) groups.set(root, classify(box));
	const triangles = new Map<number, number[]>();
	for (let i = 0; i < total; i += 3) {
		const group = groups.get(find(vertexAt(i))) ?? -1;
		if (!triangles.has(group)) triangles.set(group, []);
		triangles.get(group)!.push(vertexAt(i), vertexAt(i + 1), vertexAt(i + 2));
	}
	return triangles;
}

/** Split disconnected pieces of a baked mesh while keeping its UVs and normals. */
export function splitMeshParts(
	source: Mesh,
	classify: (bounds: Box3) => number,
) {
	const original = source.geometry;
	const positions = original.getAttribute("position");
	const triangles = meshPartIndices(source, classify);
	const point = new Vector3();
	const owned: BufferGeometry[] = [];
	const makeGeometry = (indices: number[]) => {
		const geometry = new BufferGeometry();
		for (const [name, attribute] of Object.entries(original.attributes))
			geometry.setAttribute(name, attribute);
		geometry.setIndex(indices);
		// Attributes stay shared to avoid duplicating the baked atlas data. Bounds
		// must use this part's indices, not every vertex of the original room.
		geometry.boundingBox = new Box3();
		for (const index of indices)
			geometry.boundingBox.expandByPoint(
				point.fromBufferAttribute(positions, index),
			);
		geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(
			new Sphere(),
		);
		owned.push(geometry);
		return geometry;
	};
	source.geometry = makeGeometry(triangles.get(-1) ?? []);
	const pieces = new Map<number, Mesh>();
	for (const [group, indices] of triangles) {
		if (group < 0) continue;
		const piece = new Mesh(makeGeometry(indices), source.material);
		piece.position.copy(source.position);
		piece.quaternion.copy(source.quaternion);
		piece.scale.copy(source.scale);
		piece.visible = source.visible;
		piece.renderOrder = source.renderOrder;
		piece.castShadow = source.castShadow;
		piece.receiveShadow = source.receiveShadow;
		piece.name = `${source.name}_part_${group}`;
		source.parent?.add(piece);
		pieces.set(group, piece);
	}
	return {
		pieces,
		dispose() {
			source.geometry = original;
			for (const piece of pieces.values()) piece.removeFromParent();
			for (const geometry of owned) geometry.dispose();
		},
	};
}
