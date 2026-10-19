import {
	AdditiveBlending, AnimationMixer, BufferAttribute, Euler, LoopRepeat, BufferGeometry, CanvasTexture, Color, DirectionalLight, DoubleSide, Group, HemisphereLight, Mesh,
	MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, Points, Quaternion, ShaderMaterial, SRGBColorSpace, Vector3,
	type Material, type Texture,
} from "three";
import type { FilmLights } from "./lights";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * Act V: he was already here. The sovereign (Mohith's own Blender build: hooded, masked, rigged, with a
 * breathing idle and cape wind baked as morph targets) stands vast ahead of where the fold put us.
 * Nothing about him is still: the cape and tunic breathe in a slow wind, the chest rises, the head settles;
 * smoke rolls round his legs, lit from behind; embers drift up through it.
 *
 * Levels the director tweens: `smoke` (how much of the world is smoke), `rim` (the back light), `eyes`, `reach`
 * (his left arm opening, palm up, towards the ship) and `flame` (the green fire that wakes in that palm).
 */
const DRACO = "/doomsday/draco/";
/** Room units per metre of him: a little over sixty units tall, a mountain beside the ship. */
export const DOOM_SCALE = 30;

const smokeVertex = /* glsl */ `
	attribute vec4 aPuff;          // xyz offset (unit), w seed
	uniform float uTime, uSize;
	varying vec2 vUv;
	varying float vSeed;
	void main() {
		vUv = uv; vSeed = aPuff.w;
		// Each puff drifts and turns slowly; billboards always face the camera.
		vec3 centre = aPuff.xyz + vec3(sin(uTime * .05 + aPuff.w * 9.) * .06, uTime * .008 * (.5 + aPuff.w), cos(uTime * .04 + aPuff.w * 5.) * .06);
		vec4 mv = modelViewMatrix * vec4(centre, 1.);
		float angle = uTime * .03 * (aPuff.w - .5) + aPuff.w * 6.28;
		vec2 corner = (uv - .5) * uSize * (.7 + aPuff.w * .8);
		corner = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * corner;
		mv.xy += corner;
		gl_Position = projectionMatrix * mv;
	}
`;
const smokeFragment = /* glsl */ `
	uniform float uTime, uLevel;
	uniform vec3 uLit, uShade;
	uniform vec2 uLightDir;        // screen-space direction the rim light comes from
	varying vec2 vUv;
	varying float vSeed;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
	float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= .5; } return s; }
	void main() {
		vec2 p = vUv - .5;
		float r = length(p);
		vec2 q = vUv * 2.6 + vSeed * 13.;
		float n = fbm(q + vec2(uTime * .02, -uTime * .015) + fbm(q * 1.7 - uTime * .01) * .9);
		float density = smoothstep(.5, .12, r) * smoothstep(.32, .75, n);
		// Light from behind: the edge of each puff facing the light glows, the body stays dark.
		float rim = clamp(dot(normalize(p + 1e-4), uLightDir) * .5 + .5, 0., 1.);
		float edge = smoothstep(.05, .35, density) * (1. - smoothstep(.35, .9, density));
		vec3 col = mix(uShade, uLit, pow(rim, 3.) * (.35 + edge * 1.4));
		gl_FragColor = vec4(col, density * uLevel * .38);
	}
`;

export async function createFinale(parent: Object3D, env: Texture, lights: FilmLights) {
	const draco = new DRACOLoader().setDecoderPath(DRACO);
	const gltf = await new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder).loadAsync("/doomsday/doom.glb").finally(() => draco.dispose());
	const root = new Group(); root.name = "doomsday_finale"; root.visible = false; parent.add(root);
	const figure = gltf.scene; figure.scale.setScalar(DOOM_SCALE); root.add(figure);
	const levels = { smoke: 0, rim: 0, eyes: 0, gust: 0, breathe: 1, reach: 0, flame: 0 };
	// His own breathing idle (from the Blender rig) runs under everything the director adds.
	const mixer = new AnimationMixer(figure);
	const idle = gltf.animations.find(a => /idle/i.test(a.name));
	if (idle) { const action = mixer.clipAction(idle); action.setLoop(LoopRepeat, Infinity); action.play(); }
	let lastTime = -1;

	// Materials: fabric keeps its sheen, metals get the environment, eyes start dark.
	const eyeMaterials: MeshStandardMaterial[] = [];
	const morphMeshes: Mesh[] = [];
	figure.traverse(node => {
		if (!(node instanceof Mesh)) return;
		if (node.morphTargetDictionary && Object.keys(node.morphTargetDictionary).some(k => /^(wind|skirt|billow)/.test(k))) morphMeshes.push(node);
		for (const m of [node.material].flat() as Material[]) {
			if (m instanceof MeshStandardMaterial) { m.envMap = env; m.envMapIntensity = m instanceof MeshPhysicalMaterial && m.sheen > 0 ? .25 : .55; }
		}
		// The eye slots: by name, or by their material (the build names it "doom_eyes …").
		const isEyes = /eye/i.test(node.name) || ([node.material].flat() as Material[]).some(m => /doom_eyes/i.test(m.name));
		if (isEyes) eyeMaterials.push(...([node.material].flat() as MeshStandardMaterial[]).filter(m => m instanceof MeshStandardMaterial));
	});
	eyeMaterials.forEach(m => { m.emissiveIntensity = 0; });

	// Light: a hard warm rim from behind-left (the reference's key), an emerald fill from below, a cold top.
	// The film's shared key and fill (lights.ts), taken over for Act V: the key becomes his rim.
	const rim = lights.key, fill = lights.fill;
	const aimLights = () => {
		lights.owner = "finale";
		rim.color.set("#ffd2a0"); fill.color.set("#3e9e6e");
		root.updateMatrixWorld(true);
		const centre = parent.worldToLocal(root.localToWorld(new Vector3(0, 1, 0)));
		rim.target.position.copy(centre); fill.target.position.copy(centre);
		rim.position.copy(centre).add(new Vector3(-1.2, 1.4, -1.6).multiplyScalar(400));
		fill.position.copy(centre).add(new Vector3(.6, -.4, 1).multiplyScalar(400));
	};

	// Smoke frames him, never veils him: a backlit bank well behind, and a low mist round the boots. Nothing in
	// front of the body above the knees, so the figure (and the fire in his hand) always reads.
	const PUFFS = 46;
	const puffData = new Float32Array(PUFFS * 4 * 4), uvs = new Float32Array(PUFFS * 4 * 2), index: number[] = [];
	for (let i = 0; i < PUFFS; i++) {
		const behind = i < PUFFS * .55;
		// He faces -z: "behind" him is +z.
		const x = behind ? (Math.random() - .5) * 4 : (Math.random() - .5) * 2.6;
		const y = behind ? .2 + Math.random() * 2 : Math.random() * .35;
		const z = behind ? .9 + Math.random() * 1.6 : (Math.random() - .5) * 1.6;
		const seed = Math.random();
		for (let k = 0; k < 4; k++) { puffData.set([x * DOOM_SCALE, y * DOOM_SCALE, z * DOOM_SCALE, seed], (i * 4 + k) * 4); uvs.set([k & 1, k >> 1], (i * 4 + k) * 2); }
		const a = i * 4; index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
	}
	const smokeGeometry = new BufferGeometry();
	smokeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(PUFFS * 4 * 3), 3));
	smokeGeometry.setAttribute("aPuff", new BufferAttribute(puffData, 4));
	smokeGeometry.setAttribute("uv", new BufferAttribute(uvs, 2));
	smokeGeometry.setIndex(index);
	const smokeUniforms = {
		uTime: { value: 0 }, uLevel: { value: 0 }, uSize: { value: DOOM_SCALE * 1.1 },
		uLit: { value: new Color("#c9d6b0") }, uShade: { value: new Color("#0d1a12") }, uLightDir: { value: new Vector3(-.6, .8, 0) },
	};
	const smoke = new Mesh(smokeGeometry, new ShaderMaterial({ vertexShader: smokeVertex, fragmentShader: smokeFragment, uniforms: smokeUniforms, transparent: true, depthWrite: false, side: DoubleSide }));
	smoke.frustumCulled = false; smoke.renderOrder = 8;
	root.add(smoke);

	// Embers: warm and a few emerald, rising slowly through the smoke.
	const EMBERS = 220;
	const emberStart = new Float32Array(EMBERS * 3), emberSeed = new Float32Array(EMBERS);
	for (let i = 0; i < EMBERS; i++) { emberStart.set([(Math.random() - .5) * 3 * DOOM_SCALE, Math.random() * 2 * DOOM_SCALE, (Math.random() - .5) * 2 * DOOM_SCALE], i * 3); emberSeed[i] = Math.random(); }
	const emberGeometry = new BufferGeometry();
	emberGeometry.setAttribute("position", new BufferAttribute(emberStart, 3));
	emberGeometry.setAttribute("aSeed", new BufferAttribute(emberSeed, 1));
	const embers = new Points(emberGeometry, new ShaderMaterial({
		uniforms: { uTime: smokeUniforms.uTime, uLevel: smokeUniforms.uLevel, uHeight: { value: 2 * DOOM_SCALE } },
		transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute float aSeed; uniform float uTime, uLevel, uHeight; varying float vA, vSeed;
			void main() {
				vec3 p = position; p.y = mod(p.y + uTime * (6. + aSeed * 14.), uHeight); p.x += sin(uTime * .3 + aSeed * 40.) * 8.;
				vec4 mv = modelViewMatrix * vec4(p, 1.);
				vA = uLevel * (.4 + .6 * fract(aSeed * 7.3)) * (.6 + .4 * sin(uTime * 3. + aSeed * 50.)); vSeed = aSeed;
				gl_PointSize = (1.5 + aSeed * 2.5) * 140. / -mv.z; gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */ `
			varying float vA, vSeed;
			void main() { float d = length(gl_PointCoord - .5); vec3 c = vSeed > .85 ? vec3(.35, 1., .6) : vec3(1., .66, .32); gl_FragColor = vec4(c * vA * smoothstep(.5, 0., d), 1.); }`,
	}));
	embers.frustumCulled = false;
	root.add(embers);

	// Eye glints: two small additive sprites that bloom when the eyes light.
	const glintTexture = (() => {
		const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d")!;
		const grad = g.createRadialGradient(64, 16, 0, 64, 16, 64); grad.addColorStop(0, "rgba(200,255,220,1)"); grad.addColorStop(.12, "rgba(67,240,142,.6)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grad; g.fillRect(0, 0, 128, 32); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
	})();
	const glintMaterial = new MeshBasicMaterial({ map: glintTexture, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 });
	const glints = [0, 1].map(() => { const m = new Mesh(new PlaneGeometry(.09 * DOOM_SCALE, .022 * DOOM_SCALE), glintMaterial); root.add(m); return m; });

	// --- Life ---------------------------------------------------------------------------------------------
	const head = figure.getObjectByName("doom_head");
	const headRest = head?.rotation.clone();
	// The eyes' centre, carried by the head bone (a skinned mesh's own origin is the rig's, not the eyes').
	let eyes: Mesh | undefined;
	figure.traverse(n => { if (!eyes && n instanceof Mesh && (/eye/i.test(n.name) || ([n.material].flat() as Material[]).some(m => /doom_eyes/i.test(m.name)))) eyes = n; });
	const eyePosition = new Vector3(), eyeOffset = new Vector3();
	if (eyes && head) {
		figure.updateMatrixWorld(true);
		eyes.geometry.computeBoundingBox(); eyes.geometry.boundingBox!.getCenter(eyeOffset);
		head.worldToLocal(eyes.localToWorld(eyeOffset));
	}
	// The gesture: his left arm opens out from his side, the forearm comes up and the palm turns to the sky.
	// (This build faces the other way in Blender, so its "_r" bones are on his left.)
	// Offsets are layered on the idle's pose each frame, in each bone's own frame.
	const arm = figure.getObjectByName("doom_arm_r_upper"), fore = figure.getObjectByName("doom_arm_r_fore"), hand = figure.getObjectByName("doom_hand_r");
	// Like the reference: the arm stays down at his side, the forearm comes out and up a little, palm to the sky,
	// holding the fire at his hip, clear of the body and the face.
	// (Solved by measuring the hand in his frame from the rest pose: at his left hip, a fifth of a metre forward.)
	const REACH = { upper: new Euler(.8, 0, 0), fore: new Euler(-.9, 0, 0), hand: new Euler(0, 0, 0) };
	const offset = new Quaternion(), turned = new Euler();
	// Their rest pose, restored every frame before the gesture is layered on (the idle clip does not drive
	// the arm bones, so without this the layered turn would compound frame after frame).
	const restPose = [arm, fore, hand].map(b => b?.quaternion.clone());
	const layer = (bone: Object3D | undefined, e: Euler, k: number) => { if (bone && k > 0) bone.quaternion.multiply(offset.setFromEuler(turned.set(e.x * k, e.y * k, e.z * k))); };

	// --- The fire in his palm ------------------------------------------------------------------------
	// Green flame, alive: tongues that lick up and curl into wisps, a white-green heart in the palm, sparks
	// rising off it. Crossed sheets of animated fire (always upright, whatever the hand is doing), a soft glow.
	const flame = new Group(); flame.name = "doom_hand_flame"; root.add(flame);
	const flameUniforms = { uTime: { value: 0 }, uLevel: { value: 0 } };
	const flameMaterial = new ShaderMaterial({
		uniforms: flameUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
		vertexShader: "varying vec2 vUv; attribute float aSheet; varying float vSheet; void main() { vUv = uv; vSheet = aSheet; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
		fragmentShader: /* glsl */ `
			uniform float uTime, uLevel; varying vec2 vUv; varying float vSheet;
			float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
				return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
			float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.07 + 1.7; a *= .5; } return s; }
			void main() {
				vec2 uv = vUv; float y = uv.y, t = uTime + vSheet * 13.;
				// Rising, domain-warped noise: tongues that sway, split and curl into wisps at the top.
				vec2 q = vec2((uv.x - .5) * 3., y * 2.6 - t * 1.9);
				vec2 w = vec2(fbm(q * .8 + vec2(0., -t * .35)), fbm(q * .8 + vec2(5.2, 1.3 - t * .25)));
				float n = fbm(q + w * 2.2);
				// The flame's profile: narrow in the palm, opening upward, swaying.
				float halfWidth = .09 + .22 * pow(y, .7);
				float sway = (w.x - .5) * .35 * y;
				float d = abs(uv.x - .5 - sway) / halfWidth;
				float field = n * 1.45 - d * 1. - y * .8 + .52;
				// Crisp tongues with dark gaps between them; their edges burn brightest.
				float tongue = smoothstep(.45, .52, field);
				float inner = smoothstep(.72, .9, field) * (1. - y);
				float edge = tongue - smoothstep(.52, .6, field);
				vec3 deep = vec3(.02, .3, .1), green = vec3(.16, .95, .34), mint = vec3(.55, 1., .62), white = vec3(.92, 1., .9);
				vec3 col = deep * tongue * .55 + green * tongue * .45 + mint * edge * .8 + mint * inner * .3 + white * pow(inner, 3.) * (1. - y) * .6;
				col *= smoothstep(0., .05, y) * smoothstep(1., .8, y) * smoothstep(0., .14, uv.x) * smoothstep(1., .86, uv.x);
				gl_FragColor = vec4(col * uLevel * .22, 1.);   // faint: the licks and wisps over the body of the fire
			}`,
	});
	{
		const SHEETS = 4, W = .56, Hh = .7;
		for (let i = 0; i < SHEETS; i++) {
			const g = new PlaneGeometry(W, Hh, 1, 1); g.translate(0, Hh / 2, 0);
			g.setAttribute("aSheet", new BufferAttribute(new Float32Array(4).fill(i / SHEETS), 1));
			const sheet = new Mesh(g, flameMaterial); sheet.rotation.y = i * Math.PI / SHEETS; sheet.frustumCulled = false; sheet.renderOrder = 12;
			flame.add(sheet);
		}
	}
	const glowMaterial = new MeshBasicMaterial({ map: (() => {
		const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
		const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32); grad.addColorStop(0, "rgba(190,255,200,1)"); grad.addColorStop(.25, "rgba(60,230,120,.55)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grad; g.fillRect(0, 0, 64, 64); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
	})(), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 });
	const glow = new Mesh(new PlaneGeometry(.7, .7), glowMaterial); glow.position.y = .12; glow.renderOrder = 11; flame.add(glow);
	// The body of the fire: soft flame particles rising out of the palm in turbulence, swelling and fading from a
	// white-green heart to green to dark, each a ragged teardrop tongue. (The way real-time fire is made.)
	const TONGUES = 90, tongueSeed = new Float32Array(TONGUES * 4);
	for (let i = 0; i < TONGUES; i++) tongueSeed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
	const tongueGeometry = new BufferGeometry();
	tongueGeometry.setAttribute("position", new BufferAttribute(new Float32Array(TONGUES * 3), 3));
	tongueGeometry.setAttribute("aSeed", new BufferAttribute(tongueSeed, 4));
	const tongueMaterial = new ShaderMaterial({
		uniforms: { ...flameUniforms, uViewport: { value: 900 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute vec4 aSeed; uniform float uTime, uLevel, uViewport; varying float vK, vSeed;
			void main() {
				float k = fract(aSeed.x + uTime * (1.05 + aSeed.y * .55));
				float t = uTime * (2.5 + aSeed.z * 2.) + aSeed.w * 40.;
				float spread = (.025 + .09 * k) * (.6 + .4 * uLevel);
				vec3 p = vec3((aSeed.z - .5) * .1 + sin(t) * spread, pow(k, .85) * .36 * (.55 + .45 * uLevel), (aSeed.w - .5) * .1 + cos(t * .8) * spread);
				vec4 mv = modelViewMatrix * vec4(p, 1.);
				float size = (.07 + .13 * sin(k * 3.14159)) * length(modelMatrix[0].xyz);
				gl_PointSize = clamp(size * projectionMatrix[1][1] * .5 * uViewport / -mv.z, 1., 512.);
				gl_Position = projectionMatrix * mv;
				vK = k; vSeed = aSeed.y;
			}`,
		fragmentShader: /* glsl */ `
			uniform float uTime, uLevel; varying float vK, vSeed;
			float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
			float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
				return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
			void main() {
				vec2 p = gl_PointCoord - .5; p.y = -p.y;
				// A teardrop, pointed upward, its edge torn by noise that streams up.
				float d = length(vec2(p.x * (1.5 + vK), (p.y + .08) * (.85 - p.y * .6)));
				float n = noise(p * 6. + vec2(vSeed * 17., -uTime * 3.)) * .6 + noise(p * 13. + vec2(vSeed * 5., -uTime * 5.)) * .4;
				float a = smoothstep(.46, .12, d) * smoothstep(.25, .65, n + .35 - d * .4);
				vec3 col = mix(vec3(.6, 1., .66), vec3(.12, .9, .32), smoothstep(.0, .3, vK));
				col = mix(col, vec3(.02, .32, .12), smoothstep(.55, 1., vK));
				gl_FragColor = vec4(col * a * pow(1. - vK, .7) * .2 * uLevel, 1.);
			}`,
	});
	const tongues = new Points(tongueGeometry, tongueMaterial); tongues.frustumCulled = false; tongues.renderOrder = 12; flame.add(tongues);
	// Sparks rising off it.
	const SPARKS = 140, sparkSeed = new Float32Array(SPARKS * 3);
	for (let i = 0; i < SPARKS; i++) sparkSeed.set([Math.random(), Math.random(), Math.random()], i * 3);
	const sparkGeometry = new BufferGeometry();
	sparkGeometry.setAttribute("position", new BufferAttribute(new Float32Array(SPARKS * 3), 3));
	sparkGeometry.setAttribute("aSeed", new BufferAttribute(sparkSeed, 3));
	const sparks = new Points(sparkGeometry, new ShaderMaterial({
		uniforms: flameUniforms, transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute vec3 aSeed; uniform float uTime, uLevel; varying float vA;
			void main() {
				float k = fract(aSeed.x + uTime * (.35 + aSeed.y * .5));
				float a = aSeed.z * 6.2831853 + uTime * (.8 + aSeed.y);
				vec3 p = vec3(cos(a) * (.05 + k * .18), k * .9, sin(a) * (.05 + k * .18));
				vec4 mv = modelViewMatrix * vec4(p, 1.);
				vA = uLevel * sin(k * 3.14159) * (.5 + .5 * aSeed.y);
				gl_PointSize = clamp((1.2 + aSeed.y * 2.) * 260. / -mv.z, 1., 6.); gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */ `
			varying float vA;
			void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.55, 1., .62) * vA * smoothstep(.5, 0., d) * 1.6, 1.); }`,
	}));
	sparks.frustumCulled = false; sparks.renderOrder = 12; flame.add(sparks);
	flame.scale.setScalar(DOOM_SCALE); flame.visible = false;
	const palm = new Vector3(), palmUp = new Vector3(), handWorld = new Vector3();
	function windWeights(mesh: Mesh, time: number) {
		const dict = mesh.morphTargetDictionary!, w = mesh.morphTargetInfluences!;
		const cycle = Object.keys(dict).filter(k => /^wind_\d+$/.test(k)).sort();
		const skirt = Object.keys(dict).filter(k => /^skirt_\d+$/.test(k)).sort();
		for (const list of [cycle, skirt]) {
			if (!list.length) continue;
			// Walk round the cycle smoothly: two neighbouring keys share the weight at any moment.
			const speed = list === cycle ? .16 : .11;
			const f = ((time * speed) % 1 + 1) % 1 * list.length, i = Math.floor(f), k = f - i, s = k * k * (3 - 2 * k);
			list.forEach((name, j) => { w[dict[name]!] = j === i ? 1 - s : j === (i + 1) % list.length ? s : 0; });
		}
		if (dict.billow_big !== undefined) w[dict.billow_big] = levels.gust;
	}

	return {
		root, figure, levels,
		/** Where the fire in his palm is, in the world (for the light it casts). */
		flameWorld(out = new Vector3()) { return root.localToWorld(out.copy(flame.position)); },
		/** The light's direction on screen, so the smoke's lit edges face it. */
		setLightOnScreen(x: number, y: number) { smokeUniforms.uLightDir.value.set(x, y, 0).normalize(); },
		update(time: number, cameraQuaternion: { x: number; y: number; z: number; w: number }) {
			if (!root.visible) return;
			smokeUniforms.uTime.value = time; smokeUniforms.uLevel.value = levels.smoke;
			if (lights.owner !== "finale") aimLights();
			rim.intensity = levels.rim * 7; fill.intensity = levels.rim * 1.1;
			for (const mesh of morphMeshes) windWeights(mesh, time);
			// His own breathing idle (seekable: the mixer is set to the film's clock, not stepped).
			[arm, fore, hand].forEach((b, i) => { if (b && restPose[i]) b.quaternion.copy(restPose[i]!); });
			mixer.setTime(time); lastTime = time;   // every frame: the gesture is layered on a fresh pose
			if (head && headRest && !idle) { head.rotation.x = headRest.x + Math.sin(time * .23) * .02; head.rotation.y = headRest.y + Math.sin(time * .17 + 1) * .03; }
			// The gesture, layered on the idle: the arm opens, the forearm rises, the palm turns up.
			const dev = import.meta.dev ? (window as unknown as { __doomReach?: { upper: number[]; fore: number[]; hand: number[] } }).__doomReach : undefined;
			if (dev) { REACH.upper.set(dev.upper[0]!, dev.upper[1]!, dev.upper[2]!); REACH.fore.set(dev.fore[0]!, dev.fore[1]!, dev.fore[2]!); REACH.hand.set(dev.hand[0]!, dev.hand[1]!, dev.hand[2]!); }
			const k = levels.reach * levels.reach * (3 - 2 * levels.reach);
			layer(arm, REACH.upper, k); layer(fore, REACH.fore, k); layer(hand, REACH.hand, k);
			// The fire sits in the cupped palm, upright in his frame whatever the wrist is doing.
			flameUniforms.uTime.value = time; flameUniforms.uLevel.value = levels.flame;
			flame.visible = levels.flame > .002;
			if (flame.visible && hand) {
				figure.updateMatrixWorld(true);
				hand.getWorldPosition(handWorld);
				// The palm's centre is a little out along the hand from the wrist bone.
				const finger = figure.getObjectByName("doom_hand_r_finger_2");
				if (finger) palm.copy(handWorld).lerp(finger.getWorldPosition(palmUp), .55); else palm.copy(handWorld);
				root.worldToLocal(palm); flame.position.copy(palm).add(new Vector3(0, .03 * DOOM_SCALE, 0));
				const s = DOOM_SCALE * (.55 + .45 * levels.flame); flame.scale.set(s, s * (.6 + .4 * levels.flame), s);
				glowMaterial.opacity = levels.flame * .45;
				glow.quaternion.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z, cameraQuaternion.w).premultiply(flame.getWorldQuaternion(new Quaternion()).invert());
			}
			eyeMaterials.forEach(m => { m.emissiveIntensity = levels.eyes * 6; });
			glintMaterial.opacity = levels.eyes * .9;
			if (eyes && head) {
				root.worldToLocal(head.localToWorld(eyePosition.copy(eyeOffset)));
				// He faces -z: the glints sit just in front of the slots.
				glints.forEach((g, i) => { g.position.copy(eyePosition).add(new Vector3((i ? 1 : -1) * .026 * DOOM_SCALE, 0, -.03 * DOOM_SCALE)); g.quaternion.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z, cameraQuaternion.w); });
			}
		},
		dispose() {
			root.removeFromParent();
			figure.traverse(n => { if (n instanceof Mesh) { n.geometry.dispose(); ([n.material].flat() as Material[]).forEach(m => m.dispose()); } });
			smokeGeometry.dispose(); (smoke.material as Material).dispose(); emberGeometry.dispose(); (embers.material as Material).dispose();
			glintMaterial.dispose(); glintTexture.dispose(); glints.forEach(g => g.geometry.dispose());
			mixer.stopAllAction();
			flame.traverse(n => { if (n instanceof Mesh || n instanceof Points) n.geometry.dispose(); }); flameMaterial.dispose(); tongueMaterial.dispose(); glowMaterial.map?.dispose(); glowMaterial.dispose(); (sparks.material as Material).dispose();
		},
	};
}
