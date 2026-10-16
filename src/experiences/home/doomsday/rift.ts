import { DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector2, type Texture } from "three";

/**
 * The rift: a fracture in the empty space behind the room. First hairlines of emerald light are drawn
 * across nothing; then the main crack tears open into a jagged hole whose inside shows the black hole
 * (sampled from its buffer by screen position) and whose edge burns green and white.
 */
const MAIN = 20, BRANCHES = 10;

function fracture(width: number, height: number, seed = 7) {
	let s = seed;
	const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	const main: Vector2[] = [];
	for (let i = 0; i < MAIN; i++) {
		const t = i / (MAIN - 1);
		const x = (t - .5) * width * .86;
		// A diagonal tear with sharp, irregular kinks.
		const y = (.5 - t) * height * .34 + (random() - .5) * height * .26 * Math.sin(Math.PI * t);
		main.push(new Vector2(x, y));
	}
	const branches: Vector2[] = [];
	for (let i = 0; i < BRANCHES; i++) {
		const at = main[2 + Math.floor(random() * (MAIN - 4))]!;
		const angle = (random() - .5) * 2.4 + (random() < .5 ? Math.PI / 2 : -Math.PI / 2);
		const length = (.12 + random() * .22) * height;
		branches.push(at.clone(), at.clone().add(new Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(length)));
	}
	return { main, branches };
}

export class Rift {
	readonly mesh: Mesh;
	readonly uniforms;

	constructor(blackHole: Texture, width = 96, height = 54, tear = { width: 46, height: 26 }) {
		const { main, branches } = fracture(tear.width, tear.height);
		this.uniforms = {
			uHole: { value: blackHole }, uViewport: { value: new Vector2(1, 1) },
			uMain: { value: main }, uBranches: { value: branches },
			uCrack: { value: 0 },      // 0..1: how much of the hairline network is drawn
			uOpen: { value: 0 },       // 0..1+: how far the tear has opened
			uMaxWidth: { value: tear.height * .5 },
			uTime: { value: 0 },
			uPresence: { value: 0 },   // a flare on the rim, for the moment it holds the shape of a hooded head
		};
		const material = new ShaderMaterial({
			uniforms: this.uniforms, transparent: true, depthWrite: false, side: DoubleSide, premultipliedAlpha: true,
			defines: { MAIN, BRANCHES },
			vertexShader: /* glsl */ `
				varying vec2 vPlane;
				void main() { vPlane = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
			`,
			fragmentShader: /* glsl */ `
				precision highp float;
				varying vec2 vPlane;
				uniform sampler2D uHole; uniform vec2 uViewport;
				uniform vec2 uMain[MAIN]; uniform vec2 uBranches[BRANCHES * 2];
				uniform float uCrack, uOpen, uMaxWidth, uTime, uPresence;

				float hash(float n) { return fract(sin(n) * 43758.5453); }
				float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.), f * f * (3. - 2. * f)); }
				vec2 segment(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0., 1.); return vec2(length(p - a - ab * t), t); }

				void main() {
					// Distance to the main tear, and how far along it (0..1) the nearest point is.
					float d = 1e9, along = 0.;
					for (int i = 0; i < MAIN - 1; i++) {
						vec2 r = segment(vPlane, uMain[i], uMain[i + 1]);
						if (r.x < d) { d = r.x; along = (float(i) + r.y) / float(MAIN - 1); }
					}
					// The hairlines reveal from the middle outwards as uCrack grows.
					float reach = smoothstep(uCrack * .62 + .02, uCrack * .62 - .04, abs(along - .5));
					float db = 1e9;
					for (int i = 0; i < BRANCHES; i++) { vec2 r = segment(vPlane, uBranches[i * 2], uBranches[i * 2 + 1]); db = min(db, r.x + r.y * 2.5 * (1. - uCrack)); }
					float hair = (exp(-d / .035) + exp(-d / .3) * .25) * reach * step(.001, uCrack)
					           + (exp(-db / .03) + exp(-db / .25) * .18) * smoothstep(.45, 1., uCrack);

					// The opening: each segment of the tear opens by its own amount (widest in the middle, ragged
					// along its length); the hole is the union of all of them, so its edge has no seams.
					float sd = -1e9;
					for (int i = 0; i < MAIN - 1; i++) {
						vec2 r = segment(vPlane, uMain[i], uMain[i + 1]);
						float at = (float(i) + r.y) / float(MAIN - 1);
						float profile = pow(sin(3.14159 * clamp(at, 0., 1.)), .7);
						float ragged = .55 + .6 * noise(at * 23. + 3.) + .3 * noise(at * 67. + 11.);
						sd = max(sd, uOpen * uMaxWidth * profile * ragged - r.x);
					}
					// Shards: the edge is broken glass, not a smooth curve.
					sd += (noise(vPlane.x * 3.1 + vPlane.y * 1.7) - .5) * .35 * uOpen;
					float inside = smoothstep(-.06, .06, sd);
					float rim = exp(-abs(sd) / (.1 + .22 * uOpen)) * step(.0001, uOpen);
					float flicker = .75 + .25 * noise(uTime * 9. + along * 40.) + uPresence * 1.5;

					vec3 hole = texture2D(uHole, gl_FragCoord.xy / uViewport).rgb;
					// Just inside the edge, depth: the far universe darkens towards the burning rim.
					hole *= mix(.35, 1., smoothstep(0., 1.4, sd));
					vec3 emerald = vec3(.26, .94, .55), whiteHot = vec3(.85, 1., .9);
					vec3 rimColor = mix(emerald, whiteHot, pow(rim, 3.)) * rim * flicker * 2.2;
					vec3 hairColor = mix(emerald, whiteHot, .35) * hair * 1.6;

					vec3 color = hole * inside + rimColor + hairColor * (1. - inside);
					float alpha = clamp(inside + rim * .9 + hair, 0., 1.);
					gl_FragColor = vec4(color, alpha);
				}
			`,
		});
		this.mesh = new Mesh(new PlaneGeometry(width, height, 1, 1), material);
		this.mesh.name = "doomsday_rift";
		this.mesh.renderOrder = -1;
		this.mesh.frustumCulled = false;
	}

	setViewport(width: number, height: number) { this.uniforms.uViewport.value.set(width, height); }

	dispose() { this.mesh.geometry.dispose(); (this.mesh.material as ShaderMaterial).dispose(); }
}
