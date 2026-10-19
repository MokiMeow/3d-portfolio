import {
	AdditiveBlending, BatchedMesh, DoubleSide, BufferAttribute, BufferGeometry, Color, DataTexture, FloatType, Group, Matrix4, Mesh,
	MeshStandardMaterial, Points, Quaternion, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, RedFormat, ShaderMaterial, Vector2, Vector3, Vector4,
	type Material, type MeshBasicMaterial, type Object3D, type Texture,
} from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Fall, horizonChunk, type Hole } from "./infall";

/**
 * The pocket itself: the dark cube the lab floats in, as the hole sees it. It is the original container,
 * cut in Blender (doom/frac/fracture.py) into ~240 shards that start exactly where the cube was, so nothing
 * changes until something hits it. Then: knocks ripple across it from outside; a fracture runs out from
 * the impact with light behind it; the back wall bows towards the hole; and shard by shard it comes apart
 * and falls in, nearest the impact first.
 *
 * Two batched draws carry every shard: the original surface (its baked texture, untouched) and the
 * shell behind it (dark rock with edges that glow as they tear), which only appears once a shard is loose,
 * so from outside the cube still reads as a room you can see into. One more draw for the cracks, one for dust.
 */
const DRACO = "/doomsday/draco/";
/** Where it is struck: the middle of the back wall, which faces the hole. */
export const IMPACT = new Vector3(2, 8, -19.06);
/** A shard trembles this long before it lets go. */
const LOOSEN = 1.4;
const NEVER = 1e6;
const ONE = new Vector3(1, 1, 1);

type Shard = { home: Vector3; size: number; release: number; fall: Fall | null; spin: Vector3; rate: number; out: Vector3; shown: boolean };

export async function createPocket(parent: Object3D, container: Mesh, hole: Hole, sky: Texture) {
	const draco = new DRACOLoader().setDecoderPath(DRACO);
	const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync("/doomsday/pocket-shards.glb").finally(() => draco.dispose());

	// --- Unpack: per shard, its original surface and its shell (far side + broken edges) ------------
	const inner: BufferGeometry[] = [], shell: BufferGeometry[] = [], shards: Shard[] = [];
	let cracks: BufferGeometry | null = null;
	const byId = new Map<number, Object3D>();
	gltf.scene.traverse(node => {
		const m = /^shard_(\d+)$/.exec(node.name);
		if (m && !byId.has(+m[1]!)) byId.set(+m[1]!, node);
		if (node.name === "pocket_cracks" && node instanceof Mesh) cracks = node.geometry as BufferGeometry;
	});
	const ids = [...byId.keys()].sort((a, b) => a - b);
	const centre = new Vector3(0, 8.35, 0);
	for (const id of ids) {
		const node = byId.get(id)!;
		const parts: { geometry: BufferGeometry; material: string }[] = [];
		node.traverse(n => { if (n instanceof Mesh) parts.push({ geometry: n.geometry as BufferGeometry, material: (n.material as Material).name }); });
		const surface = parts.find(p => p.material === "pocket_inner")?.geometry;
		const backs = parts.filter(p => p.material !== "pocket_inner").map(p => {
			const g = new BufferGeometry();
			g.setAttribute("position", p.geometry.getAttribute("position"));
			g.setAttribute("normal", p.geometry.getAttribute("normal"));
			g.setAttribute("aRim", new BufferAttribute(new Float32Array(p.geometry.getAttribute("position").count).fill(p.material === "pocket_rim" ? 1 : 0), 1));
			g.setIndex(p.geometry.getIndex());
			return g;
		});
		if (!surface || !backs.length) continue;
		const back = mergeGeometries(backs);
		if (!back) continue;
		surface.computeBoundingSphere();
		const home = node.getWorldPosition(new Vector3());
		inner.push(surface); shell.push(back);
		shards.push({
			home, size: surface.boundingSphere!.radius, release: NEVER, fall: null, shown: false,
			spin: new Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(), rate: .4 + Math.random() * 1.2,
			out: home.clone().sub(centre).normalize(),
		});
	}

	// --- The release schedule, readable by every shader: one float per shard ------------------------
	const releaseData = new Float32Array(512).fill(NEVER);
	const releaseTexture = new DataTexture(releaseData, 512, 1, RedFormat, FloatType);
	releaseTexture.needsUpdate = true;

	const shared = {
		uTime: { value: 0 }, uRelease: { value: releaseTexture }, uHoleCentre: { value: hole.centre.clone() }, uHorizon: { value: hole.horizon },
		uKnock: { value: [0, 1, 2, 3].map(() => new Vector4(0, 0, 0, -100)) },
		uImpact: { value: IMPACT.clone() }, uBulge: { value: 0 }, uSpill: { value: 0 },
	};

	const releaseLookup = /* glsl */ `
		uniform sampler2D uRelease;
		uniform float uTime;
		float shardRelease() {
			#ifdef USE_BATCHING
				return texelFetch(uRelease, ivec2(int(batchId), 0), 0).r;
			#else
				return ${NEVER.toFixed(1)};
			#endif
		}
	`;

	/** The shell's motion: knock rings across it and the bow towards the hole. Shared by surface and cracks. */
	const shellMotion = /* glsl */ `
		uniform vec4 uKnock[4];
		uniform vec3 uImpact, uHoleCentre;
		uniform float uBulge;
		float knockWave(vec3 p) {
			float wave = 0.;
			for (int i = 0; i < 4; i++) {
				float age = uTime - uKnock[i].w;
				if (age > 0. && age < 5.) {
					float d = distance(p, uKnock[i].xyz);
					float front = d - age * 26.;
					wave += sin(front * .5) * exp(-front * front * .01) * exp(-age * 1.05) * exp(-d * .012);
				}
			}
			return wave;
		}
		vec3 bowTowardsHole(vec3 p) {
			return normalize(uHoleCentre - p) * uBulge * exp(-dot(p - uImpact, p - uImpact) / 240.);
		}
	`;

	// --- The surface: the container's own material, taught to ripple, bow and redden ------------------
	const surfaceMaterial = (container.material as MeshBasicMaterial).clone();
	surfaceMaterial.onBeforeCompile = shader => {
		Object.assign(shader.uniforms, shared);
		shader.vertexShader = shader.vertexShader
			.replace("#include <batching_pars_vertex>", `#include <batching_pars_vertex>\n${releaseLookup}\n${shellMotion}`)
			.replace("#include <common>", `#include <common>\nvarying float vHoleDistance;\nvarying vec3 vPlaced;\nvarying float vWave;`)
			.replace("#include <project_vertex>", /* glsl */ `
				#ifdef USE_BATCHING
					mat4 placeM = batchingMatrix;
				#else
					mat4 placeM = mat4(1.);
				#endif
				vec3 placed = (placeM * vec4(transformed, 1.)).xyz;
				float intact = step(uTime, shardRelease() - ${LOOSEN.toFixed(2)});
				// Knocks run across the shell as rings; the wall nearest the hole bows out towards it before it gives.
				float wave = knockWave(placed);
				transformed += intact * (normal * wave * 1.1 + bowTowardsHole(placed));
				vWave = wave * intact;
				vPlaced = (placeM * vec4(transformed, 1.)).xyz;
				vHoleDistance = distance(vPlaced, uHoleCentre);
				#include <project_vertex>`);
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", `#include <common>\n${horizonChunk}\nuniform vec3 uImpact;\nuniform float uSpill, uTime;\nuniform vec4 uKnock[4];\nvarying vec3 vPlaced;\nvarying float vWave;`)
			.replace("#include <opaque_fragment>", /* glsl */ `
				// The wave catches the light as it passes: crests brighten, troughs darken.
				outgoingLight *= 1. + clamp(vWave, -1., 1.) * .32;
				// Each blow flashes emerald where it lands, the colour of whatever is outside.
				for (int i = 0; i < 4; i++) {
					float age = uTime - uKnock[i].w;
					if (age > 0. && age < 2.5) outgoingLight += vec3(.26, .94, .56) * exp(-distance(vPlaced, uKnock[i].xyz) * .55) * exp(-age * 2.6) * 2.2;
				}
				// Light from the far side, spilling in close around the breach.
				outgoingLight += uSpill * vec3(1., .62, .34) * exp(-distance(vPlaced, uImpact) * .2) * .8;
				outgoingLight = horizonShift(outgoingLight);
				#include <opaque_fragment>`);
	};

	// --- The shell: dark rock, edges that glow as they tear and cool as they fall ----------------------
	const shellMaterial = new MeshStandardMaterial({ color: new Color("#3a3d44"), roughness: .62, metalness: .25 });
	shellMaterial.onBeforeCompile = shader => {
		Object.assign(shader.uniforms, shared);
		shader.vertexShader = shader.vertexShader
			.replace("#include <batching_pars_vertex>", `#include <batching_pars_vertex>\n${releaseLookup}`)
			.replace("#include <common>", `#include <common>\nattribute float aRim;\nuniform vec3 uHoleCentre;\nvarying float vRim, vRelease, vHoleDistance;`)
			.replace("#include <project_vertex>", /* glsl */ `
				vRim = aRim; vRelease = shardRelease();
				#ifdef USE_BATCHING
					vHoleDistance = distance((batchingMatrix * vec4(transformed, 1.)).xyz, uHoleCentre);
				#else
					vHoleDistance = distance(transformed, uHoleCentre);
				#endif
				#include <project_vertex>`);
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", `#include <common>\n${horizonChunk}\nuniform float uTime;\nvarying float vRim, vRelease;`)
			.replace("#include <emissivemap_fragment>", /* glsl */ `
				#include <emissivemap_fragment>
				float tearing = smoothstep(vRelease - ${LOOSEN.toFixed(2)}, vRelease, uTime);
				float cooling = exp(-max(uTime - vRelease, 0.) * .45);
				totalEmissiveRadiance += vRim * tearing * (cooling * 3.2 + .25) * vec3(1., .46, .16);
				// A thin silhouette edge so tumbling rock reads against the dark.
				float edge = pow(1. - abs(dot(normalize(vViewPosition), normal)), 3.);
				totalEmissiveRadiance += edge * vec3(.55, .62, .75) * .55;`)
			.replace("#include <opaque_fragment>", "outgoingLight = horizonShift(outgoingLight);\n#include <opaque_fragment>");
	};

	const count = shards.length;
	const vertexTotal = (list: BufferGeometry[]) => list.reduce((n, g) => n + g.getAttribute("position").count, 0);
	const indexTotal = (list: BufferGeometry[]) => list.reduce((n, g) => n + (g.getIndex()?.count ?? 0), 0);
	const surfaceBatch = new BatchedMesh(count, vertexTotal(inner), indexTotal(inner), surfaceMaterial);
	const shellBatch = new BatchedMesh(count, vertexTotal(shell), indexTotal(shell), shellMaterial);
	surfaceBatch.name = "doomsday_pocket_surface"; shellBatch.name = "doomsday_pocket_shell";
	const matrix = new Matrix4();
	for (let i = 0; i < count; i++) {
		surfaceBatch.addGeometry(inner[i]!); shellBatch.addGeometry(shell[i]!);
		matrix.makeTranslation(shards[i]!.home);
		surfaceBatch.setMatrixAt(i, matrix); shellBatch.setMatrixAt(i, matrix);
		shellBatch.setVisibleAt(i, false);
	}
	// The batches own copies; the loaded geometries can go.
	[...inner, ...shell].forEach(g => g.dispose());

	const root = new Group(); root.name = "doomsday_pocket"; parent.add(root);
	root.add(surfaceBatch, shellBatch);

	// --- The cracks: thin, anti-aliased lines that show what is on the other side ---------------------
	const viewport = new Vector2(1, 1);
	const crackUniforms = {
		...shared, uReveal: { value: 0 }, uSky: { value: sky }, uViewport: { value: viewport },
		uGlow: { value: new Color("#43f08e") }, uIntensity: { value: 1 },
	};
	let crackMesh: Mesh | null = null;
	if (cracks) {
		const g = cracks as BufferGeometry;
		// Plain names, so nothing in three's own shader prefix treats them as texture coordinates.
		// glTF stores texture coordinates with V flipped; flip the shard ids back.
		const ids = g.getAttribute("uv1");
		for (let i = 0; i < ids.count; i++) ids.setY(i, 1 - ids.getY(i));
		g.setAttribute("aCrack", g.getAttribute("uv")); g.setAttribute("aShards", ids);
		g.deleteAttribute("uv"); g.deleteAttribute("uv1");
		const shape = g.getAttribute("uv2");
		g.setAttribute("aShape", shape); g.deleteAttribute("uv2");
		crackMesh = new Mesh(g, new ShaderMaterial({
			uniforms: crackUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
			polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
			vertexShader: /* glsl */ `
				attribute vec2 aCrack, aShards, aShape;
				uniform sampler2D uRelease;
				uniform float uTime;
				${shellMotion}
				varying vec2 vCrack, vShape;
				varying vec3 vWorld;
				varying float vGone;
				// The inward normal of the box the shell is, near enough for its flat walls.
				vec3 inward(vec3 p) {
					vec3 q = (p - vec3(0., 8.35, 0.)) / vec3(19.06, 8.35, 19.06);
					vec3 a = abs(q);
					return a.x > a.y && a.x > a.z ? vec3(-sign(q.x), 0., 0.) : a.y > a.z ? vec3(0., -sign(q.y), 0.) : vec3(0., 0., -sign(q.z));
				}
				void main() {
					vCrack = aCrack; vShape = aShape; vWorld = position;
					float a = texelFetch(uRelease, ivec2(int(aShards.x + .5), 0), 0).r;
					float b = texelFetch(uRelease, ivec2(int(aShards.y + .5), 0), 0).r;
					// Once either side has let go, the crack is a gap, not a line.
					vGone = step(min(a, b) - .4, uTime);
					vec3 p = position + inward(position) * knockWave(position) * 1.1 + bowTowardsHole(position);
					gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
				}`,
			fragmentShader: /* glsl */ `
				uniform float uReveal, uTime, uIntensity;
				uniform sampler2D uSky;
				uniform vec2 uViewport;
				uniform vec3 uGlow;
				varying vec2 vCrack, vShape;
				varying vec3 vWorld;
				varying float vGone;
				float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
				float noise(vec3 x) {
					vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
					return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
					           mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
				}
				void main() {
					if (vGone > .5) discard;
					float radial = vShape.x, chance = vShape.y;
					// Radial cracks run first; the rings that join them follow some way behind the front.
					float at = vCrack.x * (1. + (1. - radial) * .6) + chance * 1.3;
					float behind = uReveal - at;
					if (behind < 0.) discard;
					float fresh = exp(-behind / 1.8);
					float open = 1. - exp(-behind / 7.);
					// A jagged path inside the ribbon: real fractures wander, they are not polygon edges.
					float centre = .5 + (noise(vWorld * 1.6) - .5) * .34 + (noise(vWorld * 6.1) - .5) * .1;
					float px = fwidth(vCrack.y);
					float x = abs(vCrack.y - centre);
					float strength = mix(.3, 1., radial * radial) * (.65 + .7 * chance) * exp(-at * .018);
					float hw = max((.004 + open * .028 * (.35 + .65 * radial)) / .7, px * .7);
					float core = (1. - smoothstep(hw, hw + px * 1.4, x)) * strength;
					float halo = exp(-x / (hw * 2.5 + px * 2.)) * strength;
					// What comes through: the far side's own light, and the disk's warmth; emerald only where it is breaking.
					vec3 far = texture2D(uSky, gl_FragCoord.xy / uViewport).rgb;
					// Hairlines: finer fractures that wander alongside the main one and split off it, a beat behind
					// the front; they never open, they only catch the light.
					float c2 = centre + .2 * (noise(vWorld * 3.3 + 7.) - .5) + .14 * (noise(vWorld * .9 + 3.) - .5);
					float hw2 = max(.0018, px * .55);
					float hair = (1. - smoothstep(hw2, hw2 + px * 1.2, abs(vCrack.y - c2))) * strength * .6 * smoothstep(.2, 2.4, behind) * (1. - open * .6);
					// The leak breathes: whatever is on the other side is not still.
					float breathe = .82 + .18 * noise(vec3(vWorld.xy * .35, uTime * 3.1));
					vec3 col = (core * (vec3(1., .74, .46) * (.55 + 1.5 * fresh) + far * 3.)
						+ halo * (uGlow * fresh * .9 + vec3(1., .6, .3) * .12)
						+ vec3(1.) * core * fresh * fresh * 1.2) * breathe
						+ hair * (vec3(.9, .78, .62) * .5 + far * 1.4);
					gl_FragColor = vec4(col * uIntensity, 1.);
				}`,
		}));
		crackMesh.name = "doomsday_pocket_cracks";
		crackMesh.renderOrder = 3;
		crackMesh.frustumCulled = false;
		root.add(crackMesh);
	}

	// --- Dust shaken loose inside by each knock --------------------------------------------------------
	const DUST = 900;
	const dustStart = new Float32Array(DUST * 3), dustVelocity = new Float32Array(DUST * 3), dustKnock = new Float32Array(DUST), dustSeed = new Float32Array(DUST);
	for (let i = 0; i < DUST; i++) {
		const nearWall = Math.random() < .6;
		dustStart.set(nearWall
			? [IMPACT.x + (Math.random() - .5) * 30, 2 + Math.random() * 14, -18.6 + Math.random() * 3]
			: [(Math.random() - .5) * 36, 15.6 + Math.random() * .9, (Math.random() - .5) * 36], i * 3);
		dustVelocity.set([(Math.random() - .5) * .6, -.2 - Math.random() * .6, nearWall ? .3 + Math.random() * 1.2 : (Math.random() - .5) * .4], i * 3);
		dustKnock[i] = i % 3; dustSeed[i] = Math.random();
	}
	const dustGeometry = new BufferGeometry();
	dustGeometry.setAttribute("position", new BufferAttribute(dustStart, 3));
	dustGeometry.setAttribute("aVelocity", new BufferAttribute(dustVelocity, 3));
	dustGeometry.setAttribute("aKnock", new BufferAttribute(dustKnock, 1));
	dustGeometry.setAttribute("aSeed", new BufferAttribute(dustSeed, 1));
	const dust = new Points(dustGeometry, new ShaderMaterial({
		uniforms: { uTime: shared.uTime, uKnock: shared.uKnock, uPixel: { value: 1 } },
		transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute vec3 aVelocity;
			attribute float aKnock, aSeed;
			uniform vec4 uKnock[4];
			uniform float uTime, uPixel;
			varying float vAlpha;
			void main() {
				float t0 = aKnock < .5 ? uKnock[0].w : aKnock < 1.5 ? uKnock[1].w : uKnock[2].w;
				float age = uTime - t0 - aSeed * .35;
				vAlpha = age > 0. ? smoothstep(0., .25, age) * (1. - smoothstep(2.5, 6., age)) * (.4 + .6 * aSeed) : 0.;
				vec3 p = position + aVelocity * age + vec3(sin(age * 2. + aSeed * 30.) * .15, -.35 * age * age, 0.);
				vec4 mv = modelViewMatrix * vec4(p, 1.);
				gl_PointSize = uPixel * (.06 + aSeed * .1) * 900. / -mv.z;
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */ `
			varying float vAlpha;
			void main() {
				float d = length(gl_PointCoord - .5);
				gl_FragColor = vec4(vec3(1., .82, .6) * vAlpha * smoothstep(.5, .1, d) * .55, 1.);
			}`,
	}));
	dust.name = "doomsday_pocket_dust"; dust.frustumCulled = false;
	root.add(dust);

	// --- The stream: grit and splinters pouring from the breach, spiralling down into the hole -------------
	// A handful of real fall paths from around the breach; each grain rides one, with its own offset that
	// shrinks as the path narrows, so the stream starts as a spray and ends as a thread.
	const GRAINS = 2200, PATHS = 10;
	const streamPaths: Fall[] = [];
	for (let k = 0; k < PATHS; k++) {
		const a = (k / PATHS) * Math.PI * 2, r = 2 + (k % 3) * 2.5;
		const from = IMPACT.clone().add(new Vector3(Math.cos(a) * r, Math.sin(a) * r * .7, -.4));
		streamPaths.push(new Fall(hole, from, new Vector3(Math.cos(a) * 2.5, Math.sin(a) * 2.5 + 1, -4), .2 + (k % 4) * .1, .2));
	}
	const grainPath = new Uint8Array(GRAINS), grainSpawn = new Float32Array(GRAINS).fill(NEVER), grainOffset = new Float32Array(GRAINS * 3);
	const grainPositions = new Float32Array(GRAINS * 3), grainSeed = new Float32Array(GRAINS);
	for (let i = 0; i < GRAINS; i++) {
		grainPath[i] = i % PATHS; grainSeed[i] = Math.random();
		grainOffset.set([(Math.random() - .5) * 7, (Math.random() - .5) * 7, (Math.random() - .5) * 3], i * 3);
	}
	const streamGeometry = new BufferGeometry();
	streamGeometry.setAttribute("position", new BufferAttribute(grainPositions, 3).setUsage(35048 /* DynamicDrawUsage */));
	streamGeometry.setAttribute("aSeed", new BufferAttribute(grainSeed, 1));
	const stream = new Points(streamGeometry, new ShaderMaterial({
		uniforms: { uHoleCentre: shared.uHoleCentre, uHorizon: shared.uHorizon },
		transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute float aSeed;
			uniform vec3 uHoleCentre;
			varying float vHoleDistance, vSeed;
			void main() {
				vSeed = aSeed;
				vHoleDistance = distance(position, uHoleCentre);
				vec4 mv = modelViewMatrix * vec4(position, 1.);
				gl_PointSize = (.05 + aSeed * .14) * 900. / -mv.z;
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */ `
			${horizonChunk}
			varying float vSeed;
			void main() {
				float d = length(gl_PointCoord - .5);
				// Grit lit by the disk: warm, a few brighter splinters catching the light.
				vec3 c = mix(vec3(.55, .42, .32), vec3(1., .78, .5), step(.85, vSeed)) * smoothstep(.5, .05, d);
				gl_FragColor = vec4(horizonShift(c) * .8, 1.);
			}`,
	}));
	stream.name = "doomsday_pocket_stream"; stream.frustumCulled = false;
	root.add(stream);
	let streaming = false;
	const grain = new Vector3(), grainDirection = new Vector3();
	function updateStream(time: number) {
		if (!streaming) return;
		for (let i = 0; i < GRAINS; i++) {
			const path = streamPaths[grainPath[i]!]!;
			const age = time - grainSpawn[i]!;
			if (age < 0 || age > path.duration) { grainPositions[i * 3 + 1] = -1e4; continue; }
			path.at(age, grain, grainDirection);
			const spread = Math.max(0, 1 - age / (path.duration * .8));
			grainPositions[i * 3] = grain.x + grainOffset[i * 3]! * spread;
			grainPositions[i * 3 + 1] = grain.y + grainOffset[i * 3 + 1]! * spread;
			grainPositions[i * 3 + 2] = grain.z + grainOffset[i * 3 + 2]! * spread;
		}
		streamGeometry.attributes.position!.needsUpdate = true;
	}

	// --- Spall: small chips that burst off a shard's broken edges the moment it tears free, and off the outside
	// of the wall with each knock. One instanced draw; every chip's flight is computed in its vertex shader
	// from the shard's release time, so nothing here runs per frame on the CPU.
	const CHIPS = 1100;
	const chipGeometry = (() => {
		// An irregular little rock: a jittered icosahedron, flat-shaded.
		const g = new IcosahedronGeometry(1, 0).toNonIndexed();
		const p = g.getAttribute("position");
		const seen = new Map<string, number>();
		for (let i = 0; i < p.count; i++) {
			const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
			if (!seen.has(key)) seen.set(key, .55 + Math.random() * .7);
			const k = seen.get(key)!; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .7, p.getZ(i) * k);
		}
		g.computeVertexNormals();
		return g;
	})();
	const chipShard = new Float32Array(CHIPS), chipOffset = new Float32Array(CHIPS * 3), chipVelocity = new Float32Array(CHIPS * 3), chipSeed = new Float32Array(CHIPS * 4);
	const knockChips = 260;
	for (let i = 0; i < CHIPS; i++) {
		const seed = [Math.random(), Math.random(), Math.random(), Math.random()];
		chipSeed.set(seed, i * 4);
		if (i < knockChips) {
			// Knock spall: thrown off the outside face of the back wall, back towards whatever struck it.
			chipShard[i] = -1 - (i % 3);
			chipOffset.set([(Math.random() - .5) * 5, (Math.random() - .5) * 4, -.3], i * 3);
			chipVelocity.set([(Math.random() - .5) * 5, 1 + Math.random() * 4, -3 - Math.random() * 6], i * 3);
		} else {
			const k = Math.floor(Math.random() * shards.length), sh = shards[k]!;
			chipShard[i] = k;
			const r = sh.size * (.3 + Math.random() * .7), a = new Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize().multiplyScalar(r);
			chipOffset.set([sh.home.x + a.x, sh.home.y + a.y, sh.home.z + a.z], i * 3);
			const v = sh.out.clone().multiplyScalar(2 + Math.random() * 7).add(a.normalize().multiplyScalar(1.5 + Math.random() * 3));
			chipVelocity.set([v.x, v.y, v.z], i * 3);
		}
	}
	chipGeometry.setAttribute("aShard", new InstancedBufferAttribute(chipShard, 1));
	chipGeometry.setAttribute("aOffset", new InstancedBufferAttribute(chipOffset, 3));
	chipGeometry.setAttribute("aVelocity", new InstancedBufferAttribute(chipVelocity, 3));
	chipGeometry.setAttribute("aSeed", new InstancedBufferAttribute(chipSeed, 4));
	const chipMaterial = new MeshStandardMaterial({ color: new Color("#4a4d55"), roughness: .7, metalness: .2, flatShading: true });
	chipMaterial.onBeforeCompile = shader => {
		Object.assign(shader.uniforms, shared);
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", /* glsl */ `#include <common>
				attribute float aShard; attribute vec3 aOffset, aVelocity; attribute vec4 aSeed;
				uniform sampler2D uRelease; uniform float uTime; uniform vec4 uKnock[4]; uniform vec3 uHoleCentre, uImpact;
				varying float vHeat, vHoleDistance;
				mat3 spin(vec3 axis, float a) { axis = normalize(axis); float c = cos(a), s = sin(a), t = 1. - c;
					return mat3(t*axis.x*axis.x + c, t*axis.x*axis.y + s*axis.z, t*axis.x*axis.z - s*axis.y,
					            t*axis.x*axis.y - s*axis.z, t*axis.y*axis.y + c, t*axis.y*axis.z + s*axis.x,
					            t*axis.x*axis.z + s*axis.y, t*axis.y*axis.z - s*axis.x, t*axis.z*axis.z + c); }`)
			// (three computes normals before positions: the chip's clock and turn are set up with the normal.)
			.replace("#include <beginnormal_vertex>", /* glsl */ `
				float start; vec3 origin = aOffset;
				if (aShard < 0.) {
					int k = int(-aShard - 1.);
					vec4 knock = k == 0 ? uKnock[0] : k == 1 ? uKnock[1] : uKnock[2];
					start = knock.w + aSeed.x * .08; origin = knock.xyz + aOffset;
				} else start = texelFetch(uRelease, ivec2(int(aShard + .5), 0), 0).r - ${LOOSEN.toFixed(2)} * .35 + aSeed.x * .5;
				float age = uTime - start;
				mat3 chipTurn = spin(aSeed.yzw - .5, age * (2. + aSeed.w * 9.));
				#include <beginnormal_vertex>
				objectNormal = chipTurn * objectNormal;`)
			.replace("#include <begin_vertex>", /* glsl */ `
				float life = aShard < 0. ? 2.6 + aSeed.y * 1.6 : 5. + aSeed.y * 4.;
				float alive = step(0., age) * step(age, life);
				float size = (aShard < 0. ? .04 + aSeed.z * .1 : .05 + aSeed.z * aSeed.z * .24) * alive * (1. - smoothstep(life * .6, life, age));
				// Thrown out, slowing in nothing, then taken by the pull: the hole gains on it with the square of time.
				vec3 toHole = normalize(uHoleCentre - origin);
				vec3 drift = aVelocity * (1. - exp(-age * 1.4)) / 1.4 + toHole * age * age * (aShard < 0. ? .6 : 1.4 + aSeed.w * 2.);
				vec3 transformed = chipTurn * position * size + origin + drift;
				vHeat = exp(-age * 2.4) * step(0., aShard) * step(.6, aSeed.w);
				vHoleDistance = distance(transformed, uHoleCentre);`);
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", `#include <common>
${horizonChunk}
varying float vHeat;`)
			.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
totalEmissiveRadiance += vHeat * vHeat * vec3(1., .42, .14) * 1.4;
totalEmissiveRadiance += pow(1. - abs(dot(normalize(vViewPosition), normal)), 3.) * vec3(.55, .62, .75) * .4;`)
			.replace("#include <opaque_fragment>", "outgoingLight = horizonShift(outgoingLight);\n#include <opaque_fragment>");
	};
	const chips = new InstancedMesh(chipGeometry, chipMaterial, CHIPS);
	chips.name = "doomsday_pocket_chips"; chips.frustumCulled = false;
	root.add(chips);

	// The original container hides under its replica for the duration.
	const containerWas = container.visible;
	container.visible = false;

	// --- Per frame -------------------------------------------------------------------------------------
	const position = new Vector3(), direction = new Vector3(), align = new Quaternion(), tumble = new Quaternion();
	const zAxis = new Vector3(0, 0, 1), m1 = new Matrix4(), m2 = new Matrix4(), m3 = new Matrix4();
	const active = new Set<number>();

	function place(i: number, time: number) {
		const s = shards[i]!;
		const age = time - s.release;
		if (age < -LOOSEN || !s.fall) {
			if (s.shown) { matrix.makeTranslation(s.home); surfaceBatch.setMatrixAt(i, matrix); shellBatch.setMatrixAt(i, matrix); shellBatch.setVisibleAt(i, false); surfaceBatch.setVisibleAt(i, true); s.shown = false; }
			return;
		}
		if (!s.shown) { shellBatch.setVisibleAt(i, true); s.shown = true; }
		if (age < 0) {
			// Loosening: it shifts in its socket, a hairline gap opening round it, and trembles.
			const k = 1 + age / LOOSEN;
			position.copy(s.home).addScaledVector(s.out, k * k * .22);
			tumble.setFromAxisAngle(s.spin, Math.sin(time * 41 + i) * .012 * k + k * k * .03);
			matrix.compose(position, tumble, ONE);
		} else {
			if (age > s.fall.duration) { surfaceBatch.setVisibleAt(i, false); shellBatch.setVisibleAt(i, false); return; }
			const { stretch } = s.fall.at(age, position, direction);
			align.setFromUnitVectors(zAxis, direction);
			const across = 1 / Math.sqrt(stretch);
			// Stretch along the fall, thin across it, then the shard's own tumble.
			m1.makeRotationFromQuaternion(align);
			m2.makeScale(across, across, stretch);
			m3.copy(m1).transpose();
			tumble.setFromAxisAngle(s.spin, .03 + s.rate * age * (1 + age * .35));
			matrix.makeRotationFromQuaternion(tumble).premultiply(m3).premultiply(m2).premultiply(m1);
			matrix.setPosition(position);
		}
		surfaceBatch.setVisibleAt(i, true);
		surfaceBatch.setMatrixAt(i, matrix); shellBatch.setMatrixAt(i, matrix);
	}

	return {
		root, count: shards.length, cracks: crackUniforms, uniforms: shared,
		/** Shard ids nearest the impact first, excluding the floor the lab stands on (that goes last). */
		order(filter: "walls" | "floor") {
			return shards.map((s, i) => ({ s, i })).filter(({ s }) => {
				const underLab = s.home.y < 1.2 && Math.abs(s.home.x - 2.8) < 10.5 && Math.abs(s.home.z - 2.4) < 9.5;
				return filter === "floor" ? underLab : !underLab;
			}).map(({ i }) => i);
		},
		/** A blow from outside at `point` (model frame) at time `at`; up to four ripple at once. */
		knock(slot: number, point: Vector3, at: number) {
			const k = shared.uKnock.value[slot % 4]!; k.set(point.x, point.y, point.z, at);
		},
		/** Let these shards go, one after another between `from` and `to`, each pushed out towards the hole. */
		release(list: number[], from: number, to: number, push = 3) {
			list.forEach((i, n) => {
				const s = shards[i]!;
				const t = from + (to - from) * (list.length > 1 ? n / (list.length - 1) : 0) * (.85 + Math.random() * .3);
				s.release = t; releaseData[i] = t;
				const out = s.out.clone().multiplyScalar(push * (.6 + Math.random() * .8)).add(new Vector3((Math.random() - .5) * 2, (Math.random() - .5) * 2, (Math.random() - .5) * 2));
				s.fall = new Fall(hole, s.home.clone().addScaledVector(s.out, .22), out, .25 + Math.random() * .35, s.size);
				active.add(i);
			});
			releaseTexture.needsUpdate = true;
		},
		/** Pour grit from the breach between `from` and `to` (seconds), thickest at first. */
		pour(from: number, to: number) {
			for (let i = 0; i < GRAINS; i++) grainSpawn[i] = from + Math.pow(Math.random(), 1.6) * (to - from);
			streaming = true;
		},
		setViewport(width: number, height: number) { viewport.set(width, height); },
		update(time: number) {
			shared.uTime.value = time;
			for (const i of active) place(i, time);
			updateStream(time);
		},
		dispose() {
			container.visible = containerWas;
			root.removeFromParent();
			surfaceBatch.dispose(); shellBatch.dispose(); surfaceMaterial.dispose(); shellMaterial.dispose();
			releaseTexture.dispose();
			if (crackMesh) { crackMesh.geometry.dispose(); (crackMesh.material as Material).dispose(); }
			dust.geometry.dispose(); (dust.material as Material).dispose();
			stream.geometry.dispose(); (stream.material as Material).dispose();
			chipGeometry.dispose(); chipMaterial.dispose();
		},
	};
}

export type Pocket = Awaited<ReturnType<typeof createPocket>>;
