import {
	AdditiveBlending,
	Box3,
	BufferGeometry,
	Mesh,
	MeshPhysicalMaterial,
	Sphere,
	Vector3,
	type Texture,
} from "three";

/**
 * A reflective layer for baked hero devices. The bake already holds the colour
 * and soft light of each surface, but nothing in it moves with the camera. A
 * coat is a second, black, physically shaded skin drawn additively over the
 * same triangles, so only its reflections and highlights reach the screen:
 * glass picks up the room, aluminium gets a sheen, and the bake is untouched.
 */
export type Finish = "glass" | "gloss" | "aluminium" | "satin";

// Glass and gloss leave lamps out: on a surface that smooth each one is a hard white dot.
const FINISHES: Record<Finish, { roughness: number; ior: number; clearcoat: number; strength: number; lamps: boolean }> = {
	// Screens: a faint mirror of the room that never fights the picture.
	glass: { roughness: 0.05, ior: 1.9, clearcoat: 1, strength: 2.4, lamps: false },
	// Piano-black bezels and cases: the same mirror, turned up.
	gloss: { roughness: 0.14, ior: 2, clearcoat: 1, strength: 2.4, lamps: false },
	// Anodised lids and decks: a broad, soft sheen.
	aluminium: { roughness: 0.46, ior: 1.65, clearcoat: 0.2, strength: 0.9, lamps: true },
	// Keys and matte plastics: just enough to catch a light.
	satin: { roughness: 0.5, ior: 1.6, clearcoat: 0, strength: 1.4, lamps: true },
};

export function createGlossCoat(envMap: Texture) {
	const materials = new Map<Finish, MeshPhysicalMaterial>();
	const geometries: BufferGeometry[] = [];
	const coats: Mesh[] = [];
	const point = new Vector3();
	const material = (finish: Finish) => {
		let made = materials.get(finish);
		if (!made) {
			const { roughness, ior, clearcoat, strength, lamps } = FINISHES[finish];
			made = new MeshPhysicalMaterial({
				color: 0x000000, metalness: 0, roughness, ior, clearcoat, clearcoatRoughness: 0.08,
				envMap, envMapIntensity: strength,
				// The baked models ship without normals; faces are flat, so derive them per pixel.
				flatShading: true,
				blending: AdditiveBlending, transparent: true, depthWrite: false,
				polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
			});
			if (!lamps)
				made.onBeforeCompile = (shader) => {
					shader.fragmentShader = shader.fragmentShader.replace(
						"#include <lights_fragment_end>",
						[
							"#include <lights_fragment_end>",
							"reflectedLight.directSpecular = vec3( 0.0 );",
							"#ifdef USE_CLEARCOAT",
							"clearcoatSpecularDirect = vec3( 0.0 );",
							"#endif",
						].join("\n"),
					);
				};
			made.userData.strength = strength;
			materials.set(finish, made);
		}
		return made;
	};
	return {
		/** Coat a whole mesh, or only the triangles listed in `indices`. */
		add(source: Mesh, finish: Finish, indices?: number[]) {
			let geometry = source.geometry;
			if (indices) {
				if (!indices.length) return;
				geometry = new BufferGeometry();
				for (const [name, attribute] of Object.entries(source.geometry.attributes)) geometry.setAttribute(name, attribute);
				geometry.setIndex(indices);
				const positions = source.geometry.getAttribute("position");
				geometry.boundingBox = new Box3();
				for (const index of indices) geometry.boundingBox.expandByPoint(point.fromBufferAttribute(positions, index));
				geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
				geometries.push(geometry);
			}
			const coat = new Mesh(geometry, material(finish));
			coat.name = `${source.name}_gloss_${finish}`;
			coat.renderOrder = source.renderOrder + 1;
			// Clicks belong to the surface underneath.
			coat.raycast = () => {};
			source.add(coat);
			coats.push(coat);
			return coat;
		},
		/** 1 is a lit room; lower values dim every reflection together. */
		setLevel(level: number) {
			for (const made of materials.values()) made.envMapIntensity = made.userData.strength * level;
		},
		setVisible(visible: boolean) {
			for (const coat of coats) coat.visible = visible;
		},
		dispose() {
			for (const coat of coats) coat.removeFromParent();
			for (const geometry of geometries) geometry.dispose();
			for (const made of materials.values()) made.dispose();
			coats.length = 0;
		},
	};
}
