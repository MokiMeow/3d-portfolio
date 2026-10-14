import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, TextureLoader, type Object3D, type Texture } from "three";
import { HOME_WINDOW } from "./window-portal";

/**
 * The view out of the home window: one painted Bengaluru street at five times of day (generated for this room),
 * following the visitor's own clock. Neighbouring times crossfade so the light changes slowly, and a gentle
 * parallax lets the view shift as the camera moves, like looking through real glass.
 */
type Time = "night" | "dawn" | "day" | "golden" | "dusk";
// Hour each picture is at its fullest; between two keys the pictures blend.
const KEYS: [number, Time][] = [
	[0, "night"], [5.2, "night"], [6.4, "dawn"], [8.2, "day"], [15.6, "day"], [17.6, "golden"], [18.7, "dusk"], [19.8, "night"], [24, "night"],
];

export function createWindowSky(parent: Object3D) {
	const loader = new TextureLoader();
	const textures = new Map<Time, Texture>();
	const w = HOME_WINDOW;
	const width = w.right - w.left, height = w.top - w.bottom;
	const material = new ShaderMaterial({
		uniforms: { uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uReady: { value: 0 } },
		vertexShader: /* glsl */ `
			varying vec3 vWorld;
			void main() {
				vec4 world = modelMatrix * vec4(position, 1.0);
				vWorld = world.xyz;
				gl_Position = projectionMatrix * viewMatrix * world;
			}`,
		// Where the sightline crosses the window decides which part of the picture is seen; the picture itself sits
		// a little behind the glass, so moving the camera slides the view a touch (parallax).
		fragmentShader: /* glsl */ `
			uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform float uReady;
			varying vec3 vWorld;
			void main() {
				float dz = vWorld.z - cameraPosition.z;
				if (cameraPosition.z <= ${w.z.toFixed(3)} || abs(dz) < 0.0001) discard;
				float t = (${w.z.toFixed(3)} - cameraPosition.z) / dz;
				vec3 opening = mix(cameraPosition, vWorld, t);
				if (t <= 0.0 || t >= 1.0 || opening.x < ${w.left.toFixed(3)} || opening.x > ${w.right.toFixed(3)}
					|| opening.y < ${w.bottom.toFixed(3)} || opening.y > ${w.top.toFixed(3)}) discard;
				vec3 dir = normalize(vWorld - cameraPosition);
				vec3 deep = opening + dir * (0.6 / max(abs(dir.z), 0.3));
				vec2 uv = vec2((deep.x - ${w.left.toFixed(3)}) / ${width.toFixed(3)}, (deep.y - ${w.bottom.toFixed(3)}) / ${height.toFixed(3)});
				uv = (uv - 0.5) * vec2(0.74, 0.8) + vec2(0.5, 0.5);
				uv = clamp(uv, 0.002, 0.998);
				vec3 colour = mix(texture2D(uA, uv).rgb, texture2D(uB, uv).rgb, uMix);
				gl_FragColor = vec4(mix(vec3(0.05, 0.07, 0.13), colour, uReady), 1.0);
				#include <colorspace_fragment>
			}`,
		side: DoubleSide,
		toneMapped: false,
	});
	const load = (name: Time) => {
		let texture = textures.get(name);
		if (!texture) {
			texture = loader.load(`/window/${name}.webp`, () => { material.uniforms.uReady!.value = 1; });
			texture.colorSpace = SRGBColorSpace;
			texture.anisotropy = 4;
			textures.set(name, texture);
		}
		return texture;
	};
	// A big plane well behind the window: only the part seen through the opening is ever drawn.
	const geometry = new PlaneGeometry(40, 30);
	const mesh = new Mesh(geometry, material);
	mesh.name = "window_sky";
	mesh.position.set((w.left + w.right) / 2, (w.top + w.bottom) / 2, w.z - 0.35);
	mesh.renderOrder = -3;
	parent.add(mesh);
	// The painted view has its own tree and street; the old low-poly scenery and its flat backdrop step aside.
	const hidden: Object3D[] = [];
	parent.traverse(object => { if (/^tree(_cube_.*)?$/.test(object.name) && object.visible) { object.visible = false; hidden.push(object); } });

	const paint = () => {
		const now = new Date();
		const hour = now.getHours() + now.getMinutes() / 60;
		const i = KEYS.findIndex(key => key[0] > hour);
		const [h0, a] = KEYS[Math.max(0, i - 1)]!, [h1, b] = KEYS[i]!;
		const t = h1 > h0 ? (hour - h0) / (h1 - h0) : 0;
		material.uniforms.uA!.value = load(a);
		material.uniforms.uB!.value = load(b);
		material.uniforms.uMix!.value = a === b ? 0 : t * t * (3 - 2 * t);
	};
	paint();

	let since = 0;
	return {
		update(delta: number) {
			since += delta;
			if (since > 30000) { since = 0; paint(); }
		},
		dispose() {
			mesh.removeFromParent();
			hidden.forEach(object => { object.visible = true; });
			geometry.dispose();
			material.dispose();
			textures.forEach(texture => texture.dispose());
		},
	};
}
