const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const {
	BoxGeometry,
	BufferGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshBasicMaterial,
	Raycaster,
	Vector3,
} = require("three");

// Exercise the production TypeScript with Node's test runner, without adding a
// second bundler or browser framework to the project.
const file = path.resolve(
	__dirname,
	"../src/experiences/home/world/mesh-parts.ts",
);
const compiled = new Module(file, module);
compiled.paths = module.paths;
compiled._compile(
	ts.transpileModule(fs.readFileSync(file, "utf8"), {
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText,
	file,
);
const { splitMeshParts } = compiled.exports;

function fixture(indexed = true) {
	const a = new BoxGeometry(1, 1, 1).toNonIndexed();
	const b = new BoxGeometry(1, 1, 1).toNonIndexed().translate(3, 0, 0);
	const geometry = new BufferGeometry();
	for (const key of ["position", "normal", "uv"]) {
		geometry.setAttribute(
			key,
			new Float32BufferAttribute(
				[...a.getAttribute(key).array, ...b.getAttribute(key).array],
				a.getAttribute(key).itemSize,
			),
		);
	}
	if (indexed) geometry.setIndex(Array.from({ length: 72 }, (_, i) => i));
	const root = new Group(),
		mesh = new Mesh(geometry, new MeshBasicMaterial());
	root.add(mesh);
	root.updateMatrixWorld(true);
	a.dispose();
	b.dispose();
	return { root, mesh, geometry };
}

for (const indexed of [true, false])
	test(`separates a complete solid without losing triangles (${indexed ? "indexed" : "non-indexed"})`, () => {
		const { mesh, geometry } = fixture(indexed);
		const split = splitMeshParts(mesh, (box) => (box.min.x > 1 ? 0 : -1));
		const drawer = split.pieces.get(0);
		assert.ok(drawer);
		assert.equal(mesh.geometry.index.count + drawer.geometry.index.count, 72);
		assert.equal(drawer.geometry.index.count, 36);
		assert.equal(
			drawer.geometry.getAttribute("uv"),
			geometry.getAttribute("uv"),
		);
		assert.equal(
			drawer.geometry.getAttribute("normal"),
			geometry.getAttribute("normal"),
		);
		assert.equal(drawer.geometry.boundingBox.min.x, 2.5);
		assert.equal(mesh.geometry.boundingBox.max.x, 0.5);
		split.dispose();
		assert.equal(mesh.geometry, geometry);
		assert.equal(drawer.parent, null);
	});

test("classifies in world coordinates and preserves the source transform", () => {
	const { root, mesh } = fixture();
	root.position.set(10, 2, -4);
	mesh.scale.setScalar(2);
	const split = splitMeshParts(mesh, (box) => (box.min.x > 12 ? 0 : -1));
	const drawer = split.pieces.get(0);
	assert.ok(drawer);
	root.updateMatrixWorld(true);
	assert.deepEqual(drawer.matrixWorld.elements, mesh.matrixWorld.elements);
	split.dispose();
});

test("ray picking follows the moved part and does not leave a ghost surface", () => {
	const { root, mesh } = fixture();
	const split = splitMeshParts(mesh, (box) => (box.min.x > 1 ? 0 : -1));
	const drawer = split.pieces.get(0);
	drawer.position.y = 2;
	root.updateMatrixWorld(true);
	const ray = new Raycaster(new Vector3(3, 0, 4), new Vector3(0, 0, -1));
	assert.equal(ray.intersectObject(root, true).length, 0);
	ray.set(new Vector3(3, 2, 4), new Vector3(0, 0, -1));
	assert.equal(ray.intersectObject(root, true)[0].object, drawer);
	split.dispose();
});

test("an unselected mesh keeps every triangle and is restored on cleanup", () => {
	const { mesh, geometry } = fixture();
	const split = splitMeshParts(mesh, () => -1);
	assert.equal(split.pieces.size, 0);
	assert.equal(mesh.geometry.index.count, 72);
	split.dispose();
	assert.equal(mesh.geometry, geometry);
});

test("pieces can be listed for an overlay without touching the source mesh", () => {
	const { mesh, geometry } = fixture();
	const { meshPartIndices } = compiled.exports;
	const parts = meshPartIndices(mesh, (box) => (box.min.x > 1 ? 0 : -1));
	assert.equal(parts.get(0).length, 36);
	assert.equal(parts.get(-1).length, 36);
	assert.equal(mesh.geometry, geometry);
	assert.equal(mesh.geometry.index.count, 72);
	assert.equal(mesh.parent.children.length, 1);
});
