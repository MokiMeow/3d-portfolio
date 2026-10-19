import gsap from "gsap";
import {
	AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DoubleSide, Euler, Mesh,
	Box3, BoxGeometry, CircleGeometry, CylinderGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, RingGeometry, PlaneGeometry, PMREMGenerator, Points, Quaternion, ShaderMaterial, Vector3, Vector4,
	type Material, type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FilmLights } from "./lights";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The Lifeboat (ASTER 07): the ship the lab becomes, designed in Blender around the room itself
 * (doom/ship2/lifeboat.py). Every moving part is modelled where it ends up, and carries in its glTF extras
 * how it sits before it deploys ("stow": a rotation and a translation added to, and a scale multiplied by,
 * its final local transform). Parts deploy group by group, in their authored order, each on its own
 * progress level so the director's timeline can seek freely.
 *
 * Engines: each nozzle carries an empty at its throat whose local -Z points aft; the exhaust is drawn there
 * as an axis-aligned beam with a white-hot core, a blue body and shock diamonds near the bell.
 */
const DRACO = "/doomsday/draco/";
/** How far each engine slides aft out of the hull. */
const ENGINE_STROKE = 3.4;
export type LifeboatGroup = "seal" | "roof" | "hull" | "bow" | "wings" | "engines" | "spine" | "emblem";
type Part = {
	node: Object3D; group: LifeboatGroup; order: number; level: { p: number };
	deployed: { position: Vector3; quaternion: Quaternion; scale: Vector3 };
	stowed: { position: Vector3; quaternion: Quaternion; scale: Vector3 };
	last: number;
};

// The flame: a cone of fire behind each nozzle, drawn as a volume (both faces add, and the centre of the cone,
// where a ray crosses the most flame, burns brightest). Like a launch seen close: a white-hot core with standing
// shock diamonds just behind the bell, a blue lip at the nozzle, then a turbulent body that runs yellow to
// orange to deep red, licking and breaking up at its tail. `uStrain` is the engines pushed past their limit:
// longer, wilder, flickering.
const plumeVertex = /* glsl */ `
	attribute vec2 aCone;             // x: angle round (0..1), y: along (0 at the nozzle .. 1 at the tail)
	uniform float uLength, uRadius, uLevel, uStrain, uTime, uSeed;
	varying vec2 vCone;
	varying float vFacing;
	float h1(float n) { return fract(sin(n) * 43758.5453); }
	float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i), h1(i + 1.), f); }
	void main() {
		vec3 start = (modelMatrix * vec4(0., 0., 0., 1.)).xyz;
		vec3 axis = normalize((modelMatrix * vec4(0., 0., -1., 0.)).xyz);
		vec3 u = normalize((modelMatrix * vec4(1., 0., 0., 0.)).xyz), v = normalize(cross(axis, u));
		float t = aCone.y, a = aCone.x * 6.2831853;
		float reach = uLength * (.25 + .75 * uLevel) * (1. + uStrain * (.35 + .12 * sin(uTime * 23. + uSeed)));
		// Narrow at the bell, swelling, then pinching a little into the tail; the edge wobbles with turbulence.
		float wob = 1. + (n1(t * 9. - uTime * 14. + a * 1.3 + uSeed * 5.) - .5) * (.15 + t * .5) * (1. + uStrain);
		float r = uRadius * (.85 + t * 2.4 - t * t * 1.1) * wob * (.7 + .3 * uLevel);
		vec3 n = u * cos(a) + v * sin(a);
		vec3 p = start + axis * t * reach + n * r;
		vec3 view = normalize(cameraPosition - p);
		vFacing = abs(dot(n, view));
		vCone = aCone;
		gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
	}
`;
const plumeFragment = /* glsl */ `
	uniform float uLevel, uStrain, uTime, uSeed;
	varying vec2 vCone;
	varying float vFacing;
	float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
	float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 3.1; a *= .5; } return s; }
	void main() {
		float t = vCone.y, f = vFacing;
		// Periodic round the cone (no seam).
		float ang = vCone.x;
		float speed = 18. + uStrain * 10.;
		float turb = mix(fbm(vec2(ang * 6., t * 7. - uTime * speed + uSeed * 3.)), fbm(vec2((ang - 1.) * 6., t * 7. - uTime * speed + uSeed * 3.)), ang);
		float fine = mix(noise(vec2(ang * 22., t * 26. - uTime * speed * 1.8)), noise(vec2((ang - 1.) * 22., t * 26. - uTime * speed * 1.8)), ang);
		// How hot: the cone's middle (f high) and near the bell.
		float heat = pow(f, 2.2) * exp(-t * (2.2 - uStrain * .6)) * (.75 + .5 * turb);
		// Licks: the flame breaks up towards its tail.
		float body = smoothstep(.0, .35, turb + (1. - t) * .9 - .35) * pow(max(0., 1. - t), 1.2);
		vec3 white = vec3(1., .97, .9), yellow = vec3(1., .78, .36), orange = vec3(1., .45, .1), red = vec3(.75, .14, .04);
		vec3 col = mix(red, orange, smoothstep(.05, .45, heat));
		col = mix(col, yellow, smoothstep(.35, .75, heat));
		col = mix(col, white, smoothstep(.75, 1.2, heat));
		float glow = body * (.35 + .9 * f) * (.6 + .5 * fine);
		// Shock diamonds: bright standing knots in the core, just behind the bell.
		float knots = pow(.5 + .5 * cos(t * 48. - 1.2), 12.) * exp(-t * 5.5) * pow(f, 6.) * 2.2;
		// The blue lip right at the nozzle exit.
		float lip = exp(-t * 26.) * (.4 + .6 * (1. - f)) * .9;
		vec3 c = col * glow * 1.6 + white * knots + vec3(.4, .55, 1.) * lip;
		float flick = .9 + .1 * sin(uTime * 53. + uSeed) + uStrain * .12 * sin(uTime * 31. + uSeed * 2.);
		gl_FragColor = vec4(c * uLevel * flick, 1.);
	}
`;

export async function createLifeboat(parent: Object3D, renderer: WebGLRenderer, lights: FilmLights) {
	const draco = new DRACOLoader().setDecoderPath(DRACO);
	const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync("/doomsday/lifeboat.glb").finally(() => draco.dispose());
	const root = gltf.scene; root.name = "doomsday_lifeboat";
	parent.add(root);

	// Image-based light for the ceramic and titanium; the room's baked look is untouched.
	const pmrem = new PMREMGenerator(renderer);
	const env = pmrem.fromScene(new RoomEnvironment(), .04);
	pmrem.dispose();
	const materials = new Set<Material>();
	root.traverse(node => {
		if (!(node instanceof Mesh)) return;
		for (const m of [node.material].flat() as Material[]) {
			materials.add(m);
			if (m instanceof MeshStandardMaterial) { m.envMap = env.texture; m.envMapIntensity = .9; }
			// The recesses and seams were near-black carbon, which in space reads as holes in the hull. They are
			// recessed plating: dark machined metal that still catches the light.
			if (m instanceof MeshStandardMaterial && /^Cavities/i.test(m.name)) { m.color.set("#34363b"); m.metalness = .62; m.roughness = .4; m.envMapIntensity = 1.2; }
			// The canopy and skylights: near-black glass reads as a hole into space. Smoked glass instead, catching
			// the light, with the cabin's warm light faintly behind it: sealed windows, not openings.
			// The mechanism wells (roof hatch bays, the lower equipment band) were graphite so dark they read as
			// openings. Its texture was near-black and multiplied any light away; the detail there is geometry (slots,
			// seams), so it goes: plain anodised gunmetal, clearly a surface, catching the light.
			if (m instanceof MeshStandardMaterial && /^Graphite/i.test(m.name)) { m.map = null; m.color.set("#5d616a"); m.metalness = .45; m.roughness = .38; m.envMapIntensity = 1.5; m.emissive.set("#16181c"); m.emissiveIntensity = 1; m.needsUpdate = true; }
			if (m instanceof MeshStandardMaterial && /^Canopy/i.test(m.name)) { m.color.set("#2a3d4f"); m.metalness = .35; m.roughness = .06; m.envMapIntensity = 2.4; m.emissive.set("#ffb35c"); m.emissiveIntensity = .08; }
		}
	});

	// --- The parts and their stowed poses -----------------------------------------------------------------
	const parts: Part[] = [];
	const euler = new Euler();
	root.traverse(node => {
		const raw = node.userData?.stow;
		if (!raw) return;
		const stow = (typeof raw === "string" ? JSON.parse(raw) : raw) as { group: LifeboatGroup; order: number; rotate?: number[]; translate?: number[]; scale?: number[] };
		const deployed = { position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() };
		euler.copy(node.rotation);
		const r = stow.rotate ?? [0, 0, 0], t = stow.translate ?? [0, 0, 0], s = stow.scale ?? [1, 1, 1];
		const stowed = {
			position: deployed.position.clone().add(new Vector3(t[0], t[1], t[2])),
			quaternion: new Quaternion().setFromEuler(new Euler(euler.x + r[0]!, euler.y + r[1]!, euler.z + r[2]!, euler.order)),
			scale: deployed.scale.clone().multiply(new Vector3(s[0], s[1], s[2])),
		};
		// The engines do not grow out of nothing: full size, they wait inside the hull and slide aft on their
		// rails, out through ports that open in the stern (see `ports` below).
		if (/^engine_(nacelle|nozzle)_/.test(node.name)) { stowed.scale.copy(deployed.scale); stowed.position.copy(deployed.position).add(new Vector3(0, 0, ENGINE_STROKE)); }
		parts.push({ node, group: stow.group, order: stow.order, level: { p: 0 }, deployed, stowed, last: -1 });
	});
	const byGroup = new Map<LifeboatGroup, Part[]>();
	for (const part of parts) { if (!byGroup.has(part.group)) byGroup.set(part.group, []); byGroup.get(part.group)!.push(part); }
	for (const list of byGroup.values()) list.sort((a, b) => a.order - b.order);

	// --- Lights for the hull: the disk's warm light from wherever the hole is, a cool fill, the engines ----
	// The film's shared key and fill (lights.ts): the hull's look, aimed from wherever the hole is.
	const { key, fill } = lights;
	key.color.set("#ffcf96"); fill.color.set("#9cb8ff"); fill.intensity = .9; fill.position.set(40, 30, 60);
	key.target.position.set(2.85, 3, 2.4); fill.target.position.set(2.85, 3, 2.4);

	// --- Exhaust ------------------------------------------------------------------------------------------
	const AROUND = 36, ALONG = 48;
	const strip = new BufferGeometry();
	{
		const data = new Float32Array((AROUND + 1) * (ALONG + 1) * 2), index: number[] = [];
		for (let j = 0; j <= ALONG; j++) for (let i = 0; i <= AROUND; i++) data.set([i / AROUND, Math.pow(j / ALONG, 1.3)], (j * (AROUND + 1) + i) * 2);
		for (let j = 0; j < ALONG; j++) for (let i = 0; i < AROUND; i++) { const a = j * (AROUND + 1) + i, b = a + AROUND + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
		strip.setAttribute("aCone", new BufferAttribute(data, 2));
		strip.setAttribute("position", new BufferAttribute(new Float32Array((AROUND + 1) * (ALONG + 1) * 3), 3));
		strip.setIndex(index);
	}
	const thrustLevel = { value: 0 }, time = { value: 0 }, strain = { value: 0 };
	const throatTexture = (() => {
		const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!;
		const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		grad.addColorStop(0, "rgba(255,246,225,1)"); grad.addColorStop(.3, "rgba(255,170,80,.6)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grad; g.fillRect(0, 0, 64, 64); return new CanvasTexture(c);
	})();
	const throatMaterial = new MeshBasicMaterial({ map: throatTexture, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0, side: DoubleSide });
	// A point that stays a few pixels wide however far away the ship is.
	const flareGeometry = new BufferGeometry(); flareGeometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, -.6]), 3));
	const flareMaterial = new ShaderMaterial({
		uniforms: { uLevel: thrustLevel }, transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: "uniform float uLevel; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = 6. + 22. * uLevel; gl_Position = projectionMatrix * mv; }",
		fragmentShader: "uniform float uLevel; void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1., .78, .45) * uLevel * exp(-d * d * 18.) * 1.6, 1.); }",
	});
	const plumes = ["engine_exhaust_L", "engine_exhaust_R"].map((name, i) => {
		const at = root.getObjectByName(name);
		if (!at) return null;
		const material = new ShaderMaterial({
			vertexShader: plumeVertex, fragmentShader: plumeFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
			uniforms: { uLength: { value: 30 }, uRadius: { value: 1.25 }, uLevel: thrustLevel, uStrain: strain, uTime: time, uSeed: { value: i * 3.7 } },
		});
		const plume = new Mesh(strip, material); plume.frustumCulled = false; plume.renderOrder = 5;
		at.add(plume);
		const throat = new Mesh(new PlaneGeometry(3.4, 3.4), throatMaterial); at.add(throat);
		const flare = new Points(flareGeometry, flareMaterial); flare.frustumCulled = false; flare.renderOrder = 6; at.add(flare);
		return { plume, material, throat, flare };
	}).filter((p): p is NonNullable<typeof p> => !!p);
	// The centre engine: the reactor's own throat between the two, held for the last full-force push. It fires
	// a wider, longer jet of its own.
	const centreLevel = { value: 0 };
	const centre = (() => {
		const side = root.getObjectByName("engine_exhaust_L"), ring = root.getObjectByName("reactor_ring_4") ?? root.getObjectByName("reactor_ring_1");
		if (!side || !ring) return null;
		const at = new Object3D(); at.name = "engine_exhaust_C";
		ring.parent!.add(at); at.position.set(ring.position.x, ring.position.y, ring.position.z - .4); at.quaternion.copy(side.quaternion);
		const material = new ShaderMaterial({
			vertexShader: plumeVertex, fragmentShader: plumeFragment, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
			uniforms: { uLength: { value: 46 }, uRadius: { value: 1.9 }, uLevel: centreLevel, uStrain: strain, uTime: time, uSeed: { value: 7 } },
		});
		const plume = new Mesh(strip, material); plume.frustumCulled = false; plume.renderOrder = 5; plume.visible = false; at.add(plume);
		const throat = new Mesh(new PlaneGeometry(6.4, 6.4), throatMaterial.clone()); at.add(throat);
		return { plume, material, throat, throatMaterial: throat.material as MeshBasicMaterial };
	})();
	// One light for both engines: the film's shared point light A, at the stern, firelight.
	const engineLight = lights.a;
	// The bells heat with the burn: dull red at the rim to orange.
	const nozzles = [...materials].filter((m): m is MeshStandardMaterial => m instanceof MeshStandardMaterial && /^Nozzle/i.test(m.name));
	{ const ends = ["engine_exhaust_L", "engine_exhaust_R"].map(n => root.getObjectByName(n)).filter((o): o is NonNullable<typeof o> => !!o);
		if (ends.length) { parent.updateMatrixWorld(true); const c = new Vector3(); ends.forEach(e => c.add(parent.worldToLocal(e.getWorldPosition(new Vector3())))); engineLight.position.copy(c.divideScalar(ends.length)).add(new Vector3(0, 0, -2)); } }

	const toHole = new Vector3();
	function apply(part: Part) {
		const p = part.level.p;
		if (p === part.last) return;
		part.last = p;
		part.node.visible = p > 0;
		part.node.position.lerpVectors(part.stowed.position, part.deployed.position, p);
		part.node.quaternion.slerpQuaternions(part.stowed.quaternion, part.deployed.quaternion, p);
		part.node.scale.lerpVectors(part.stowed.scale, part.deployed.scale, p);
	}
	parts.forEach(apply);

	// --- The finished hull, merged: one draw per material instead of one per part ------------------------
	// While it assembles every part must move on its own; once it flies nothing does. Built now (all parts
	// posed deployed for a moment) so the swap at lift-off costs nothing.
	const merged: Mesh[] = [];
	const originals: Mesh[] = [];
	{
		for (const part of parts) { part.node.position.copy(part.deployed.position); part.node.quaternion.copy(part.deployed.quaternion); part.node.scale.copy(part.deployed.scale); }
		root.updateMatrixWorld(true);
		const toRoot = new Matrix4().copy(root.matrixWorld).invert();
		const buckets = new Map<string, { material: Material; geometries: BufferGeometry[] }>();
		root.traverse(node => {
			if (!(node instanceof Mesh) || Array.isArray(node.material) || !(node.material instanceof MeshStandardMaterial)) return;
			if (node.morphTargetInfluences?.length) return;
			const geometry = node.geometry as BufferGeometry;
			const signature = Object.keys(geometry.attributes).sort().join(",") + (geometry.index ? "+i" : "");
			const key = node.material.uuid + "|" + signature;
			if (!buckets.has(key)) buckets.set(key, { material: node.material, geometries: [] });
			const copy = geometry.clone(); copy.applyMatrix4(new Matrix4().multiplyMatrices(toRoot, node.matrixWorld));
			if (node.matrixWorld.determinant() < 0) { const idx = copy.index; if (idx) for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); } }
			buckets.get(key)!.geometries.push(copy);
			originals.push(node);
		});
		for (const { material, geometries } of buckets.values()) {
			const geometry = mergeGeometries(geometries, false);
			geometries.forEach(g => g.dispose());
			if (!geometry) continue;
			const mesh = new Mesh(geometry, material); mesh.name = "lifeboat_merged"; mesh.visible = false; mesh.matrixAutoUpdate = false;
			root.add(mesh); merged.push(mesh);
		}
		for (const part of parts) part.last = -1;
		parts.forEach(apply);
	}
	let isMerged = false;

	// --- The keel: the hull's underside. The lab's own floor falls away during the hull phase, which would leave
	// the ship open beneath; two keel plates slide in from the sides and seal it. Sized from the assembled hull's
	// own lowest vertices (its footprint at the bottom), in the root's frame.
	const keelLevel = { value: 0 };
	const keel: Mesh[] = [];
	{
		// The belly is the box the side and stern cladding close round (not the lowest vertices: those are the
		// ventral fins, which hang a metre below and would leave the belly's edges open). The plates tuck into the
		// side cladding and run from the stern cladding to the bow, flush under the cladding's bottom edge.
		const lo = new Vector3(Infinity, 0, Infinity), hi = new Vector3(-Infinity, 0, -Infinity);
		let minY = Infinity;
		{
			const box = new Box3(), inv = new Matrix4();
			// Measured with the cladding in its deployed (assembled) pose, then put back.
			const clad = parts.filter(q => /^hull_clad_(L|R|stern)_/.test(q.node.name));
			for (const q of clad) { q.node.position.copy(q.deployed.position); q.node.quaternion.copy(q.deployed.quaternion); q.node.scale.copy(q.deployed.scale); }
			root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
			const inner = { left: -Infinity, right: Infinity };
			for (const c of root.children) {
				if (!/^hull_clad_(L|R|stern)_/.test(c.name)) continue;
				box.setFromObject(c).applyMatrix4(inv);
				minY = Math.min(minY, box.min.y);
				if (/_L_/.test(c.name)) inner.left = Math.max(inner.left, box.max.x);
				else if (/_R_/.test(c.name)) inner.right = Math.min(inner.right, box.min.x);
				// Fore and aft: exactly the side cladding's run, never past the stern face or into the bow.
				if (!/stern/.test(c.name)) { lo.z = Math.min(lo.z, box.min.z); hi.z = Math.max(hi.z, box.max.z); }
			}
			lo.x = inner.left - .5; hi.x = inner.right + .5; lo.z += .05; hi.z -= .05; minY -= .09;
			for (const q of clad) { q.last = -1; apply(q); }
		}
		// The keel is plated in the hull's ceramic, so it reads as the same skin (the most common material by
		// vertex count is the gold inlay, which goes black from below).
		let skin: Material | null = null, best = 0;
		for (const m of merged) { const n = m.geometry.getAttribute("position").count; if (/^Ceramic/i.test((m.material as Material).name) && n > best) { best = n; skin = m.material as Material; } }
		if (!skin) for (const m of merged) { const n = m.geometry.getAttribute("position").count; if (n > best) { best = n; skin = m.material as Material; } }
		if (isFinite(lo.x) && skin) {
			const w = hi.x - lo.x, d = hi.z - lo.z, cx = (lo.x + hi.x) / 2, cz = (lo.z + hi.z) / 2;
			for (const side of [-1, 1]) {
				// Bomb-bay doors: each hinged along the bottom edge of a side wall, stowed folded up inside the hull,
				// swinging down and in to close. Nothing slides through anything; nothing appears from nowhere.
				const hinge = new Object3D(); hinge.position.set(side < 0 ? lo.x : hi.x, minY + .02, cz);
				const plate = new Mesh(new BoxGeometry(w / 2 + .02, .14, d), skin);
				plate.position.set(-side * (w / 4 + .01), 0, 0); hinge.add(plate);
				hinge.userData = { side }; hinge.visible = false; root.add(hinge); keel.push(plate);
			}
		}
	}

	// --- Engine ports: where each engine leaves the hull, a mechanical iris in the stern -------------------
	// Eight curved metal blades, closed flush with the stern; they turn and draw back like a camera's aperture,
	// and behind them the engine is already there, waiting; then it slides out through the opening.
	const irisOpen = { value: 0 };
	const turbines: Mesh[] = [];
	const turbineMaterial = new ShaderMaterial({
		uniforms: { uTime: { value: 0 }, uHeat: { value: 0 } }, side: DoubleSide,
		vertexShader: "varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
		fragmentShader: /* glsl */ `
			uniform float uTime, uHeat; varying vec2 vP;
			void main() {
				float a = atan(vP.y, vP.x), r = length(vP);
				float R = max(r, 1e-4);
				// Turbine face: a bright hub, twenty-four swept blades, a dark shroud ring.
				float blades = smoothstep(.35, .5, abs(fract(a / 6.2831853 * 24. + R * .35 - uTime * .4 * uHeat) - .5));
				vec3 metal = vec3(.2, .21, .24) * (.6 + .4 * blades);
				float hub = smoothstep(.55, .45, R);
				metal = mix(metal, vec3(.42, .43, .47), hub);
				vec3 heat = vec3(1., .45, .12) * uHeat * (.25 + .75 * smoothstep(2., .3, R)) * (.6 + .4 * blades);
				gl_FragColor = vec4(metal + heat, 1.);
			}`,
	});
	const irisMaterial = new ShaderMaterial({
		uniforms: { uOpen: irisOpen }, side: DoubleSide, transparent: true,
		vertexShader: "varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
		fragmentShader: /* glsl */ `
			uniform float uOpen; varying vec2 vP;
			void main() {
				float r = length(vP), a = atan(vP.y, vP.x);
				float aperture = uOpen * 1.02;
				if (r > 1. || r < aperture) discard;
				// Blade seams: eight curved lines that turn as the iris opens.
				float s = fract(a / 6.2831853 * 8. + (r - aperture) * 1.4 - uOpen * .9);
				float seam = smoothstep(.0, .035, s) * smoothstep(1., .965, s);
				vec3 metal = vec3(.46, .4, .33) * (.72 + .28 * cos(a - .9)) * (.8 + .2 * r);
				metal *= .85 + .15 * smoothstep(.9, .97, r);                                  // a raised bezel at the edge
				float lip = smoothstep(aperture + .06, aperture, r) * step(.001, uOpen);   // the blades' edges catch the light
				vec3 col = metal * (.45 + .55 * seam) + vec3(.55, .58, .64) * lip * .6;
				gl_FragColor = vec4(col, 1.);
			}`,
	});
	const portLevel = { value: 0 };
	// The old flat dark disc is not drawn: through the opening iris you see the engine itself.
	const portMaterial = new MeshBasicMaterial({ color: new Color("#050608"), visible: false });
	const portRimMaterial = new MeshBasicMaterial({ color: new Color("#ffb766"), transparent: true, opacity: 0, toneMapped: false });
	const ports: Mesh[] = [];
	const holes: Vector4[] = [];
	const sleeveMaterial = new MeshStandardMaterial({ color: new Color("#4b4f57"), metalness: .7, roughness: .35, envMap: env.texture, envMapIntensity: 1.3, side: DoubleSide });
	const holesUniform = { value: [new Vector4(), new Vector4()] };
	const toRootUniform = { value: new Matrix4() };
	{
		for (const part of parts) { part.node.position.copy(part.deployed.position); part.node.quaternion.copy(part.deployed.quaternion); part.node.scale.copy(part.deployed.scale); }
		root.updateMatrixWorld(true);
		// All in the ship's own frame (the root's): the stern face is the stern cladding's outer face.
		const toRoot = root.matrixWorld.clone().invert();
		let sternFace = Infinity, sternLeft = Infinity, sternRight = -Infinity;
		root.children.forEach(c => { if (!/^hull_clad_stern_/.test(c.name)) return; const b = new Box3().setFromObject(c).applyMatrix4(toRoot); sternFace = Math.min(sternFace, b.min.z); sternLeft = Math.min(sternLeft, b.min.x); sternRight = Math.max(sternRight, b.max.x); });
		for (const side of ["L", "R"]) {
			const nacelle = root.getObjectByName(`engine_nacelle_${side}`); if (!nacelle) continue;
			const box = new Box3().setFromObject(nacelle).applyMatrix4(toRoot), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
			const sternZ = isFinite(sternFace) ? sternFace : box.max.z;
			// Wide enough for the engine to pass, never past the hull's sides.
			// Just wider than the engine, so it passes cleanly through the opening (never bursting through plating).
			const engineRadius = Math.max(size.x, size.y) / 2;
			const radius = Math.min(engineRadius * 1.04, centre.x - sternLeft - .04, sternRight - .04 - centre.x);
			// The engine is not a hollow ring: a turbine face closes it, so looking in you see engine, not the wall.
			const cap = new Mesh(new CircleGeometry(engineRadius * .93, 64), turbineMaterial);
			cap.position.set(centre.x, centre.y, centre.z); cap.rotation.y = Math.PI; root.add(cap); nacelle.attach(cap); cap.userData.home = nacelle; turbines.push(cap);
			const port = new Mesh(new CircleGeometry(radius, 48), portMaterial);
			port.position.set(centre.x, centre.y, sternZ - .03); port.rotation.y = Math.PI;
			const rim = new Mesh(new RingGeometry(radius, radius * 1.025, 64), portRimMaterial); rim.position.z = .005; port.add(rim);
			const iris = new Mesh(new CircleGeometry(radius, 64), irisMaterial); iris.scale.setScalar(1); iris.position.z = .012;
			iris.geometry.scale(1 / radius, 1 / radius, 1); iris.scale.setScalar(radius); port.add(iris);
			// A machined sleeve lines the opening through the wall's depth: a clean round port, not raw cut plating.
			const sleeve = new Mesh(new CylinderGeometry(radius * .99, radius * .99, 2.7, 72, 1, true), sleeveMaterial);
			sleeve.geometry.rotateX(Math.PI / 2); sleeve.position.z = -1.33; port.add(sleeve);
			root.add(port); ports.push(port);
			holes.push(new Vector4(centre.x, centre.y, radius * .985, sternZ));
			cap.userData.flightZ = sternZ - .35;   // in flight, just aft of the wall, inside the engine's ring
		}
		// Real openings in the stern wall: the hull's own surfaces are cut away inside each port's circle, only
		// through the wall's depth, so the iris opens onto the engine bay and the engine slides out through a hole
		// that is really there. Only hull meshes are cut (tagged per vertex); the engines never are.
		if (holes.length) {
			root.traverse(n => {
				if (!(n instanceof Mesh) || n.name === "lifeboat_merged" || /engine|reactor/i.test(n.name + (n.parent?.name ?? ""))) return;
				if (!(n.material instanceof MeshStandardMaterial)) return;
				const g = n.geometry as BufferGeometry;
				if (!g.getAttribute("aClip")) g.setAttribute("aClip", new BufferAttribute(new Float32Array(g.getAttribute("position").count).fill(1), 1));
			});
			for (const m of materials) {
				if (!(m instanceof MeshStandardMaterial)) continue;
				m.onBeforeCompile = shader => {
					shader.uniforms.uHoles = holesUniform; shader.uniforms.uToRoot = toRootUniform;
					shader.vertexShader = shader.vertexShader
						.replace("#include <common>", "#include <common>\nattribute float aClip; uniform mat4 uToRoot; varying float vClip; varying vec3 vRootPos;")
						.replace("#include <begin_vertex>", "#include <begin_vertex>\nvClip = aClip; vRootPos = (uToRoot * modelMatrix * vec4(transformed, 1.)).xyz;");
					shader.fragmentShader = shader.fragmentShader
						.replace("#include <common>", "#include <common>\nuniform vec4 uHoles[2]; varying float vClip; varying vec3 vRootPos;")
						.replace("void main() {", "void main() {\n\tif (vClip > .5) for (int i = 0; i < 2; i++) { vec4 h = uHoles[i]; if (h.z > 0. && vRootPos.z > h.w - .3 && vRootPos.z < h.w + 2.6 && distance(vRootPos.xy, h.xy) < h.z) discard; }");
				};
				m.customProgramCacheKey = () => "lifeboat-stern-holes";
				m.needsUpdate = true;
			}
		}
		holes.forEach((h, i) => { if (i < 2) holesUniform.value[i]!.copy(h); });
		for (const part of parts) part.last = -1;
		parts.forEach(apply);
	}

	const engineParts = parts.filter(q => /^engine_(nacelle|nozzle|rail)/.test(q.node.name));
	return {
		root, env: env.texture, parts, byGroup,
		/** Deploy a group from `at`, part by part in its authored order. Returns when the last one settles. */
		deploy(tl: gsap.core.Timeline, group: LifeboatGroup, at: number, { duration = 1.1, stagger = .12, ease = "power3.inOut", onPart }: { duration?: number; stagger?: number; ease?: string; onPart?: (i: number, at: number) => void } = {}) {
			const list = byGroup.get(group) ?? [];
			// Parts that share an order move together.
			const orders = [...new Set(list.map(p => p.order))];
			list.forEach(part => {
				const start = at + orders.indexOf(part.order) * stagger;
				tl.to(part.level, { p: 1, duration, ease }, start);
			});
			orders.forEach((_, i) => onPart?.(i, at + i * stagger));
			return at + (orders.length - 1) * stagger + duration;
		},
		/** Light the hull from wherever the hole is (model frame). */
		lightFrom(hole: Vector3, strength = 1) {
			if (lights.owner !== "boat") return;
			toHole.copy(hole).sub(key.target.position).normalize();
			key.position.copy(key.target.position).addScaledVector(toHole, 60);
			key.intensity = 3.2 * strength;
		},
		/** The centre engine, 0..1. */
		centre(level: number) {
			centreLevel.value = level;
			if (centre) { centre.plume.visible = level > .001; centre.throatMaterial.opacity = Math.min(1, level * 1.4); }
		},
		thrust(level: number) {
			thrustLevel.value = level; turbineMaterial.uniforms.uHeat.value = level;
			throatMaterial.opacity = Math.min(1, level * 1.4);
			if (lights.owner === "boat") engineLight.color.set("#ffa24a");
			engineLight.intensity = level * 120 * (1 + strain.value * .4); for (const p of plumes) p.plume.visible = level > .001;
			for (const m of nozzles) { m.emissive.setRGB(1, .32, .08); m.emissiveIntensity = Math.max(level, centreLevel.value) * (.55 + strain.value * .4); }
		},
		/** The engines pushed past their limit, 0..1: longer, wilder flames. */
		strain(level: number) { strain.value = level; },
		update(seconds: number) {
			time.value = seconds; turbineMaterial.uniforms.uTime.value = seconds;
			toRootUniform.value.copy(root.matrixWorld).invert();
			for (const plate of keel) {
				const hinge = plate.parent!, side = (hinge.userData as { side: number }).side, k = keelLevel.value;
				hinge.visible = k > .001; hinge.rotation.z = side * -(1 - k) * Math.PI / 2;
			}
			// The irises are there whenever the stern is (if the stern panels are animated parts, once they are on).
			const sternParts = parts.filter(q => /^hull_clad_stern_/.test(q.node.name));
			const sternDone = sternParts.length === 0 || sternParts.every(q => q.level.p >= .999);
			irisOpen.value = portLevel.value;
			for (const port of ports) port.visible = sternDone || isMerged;
			if (!isMerged && portLevel.value > 0) for (const q of engineParts) q.node.visible = true;
			portRimMaterial.opacity = Math.min(1, portLevel.value * (1 - portLevel.value) * 4) * .7;   // a glow only while it opens
			if (!isMerged) for (const part of parts) apply(part);
		},
		/** The stern ports, 0 closed .. 1 open. */
		portLevel,
		/** The keel doors, 0 folded up inside the hull .. 1 closed under it. */
		keelLevel,
		/** Swap to the merged hull (every part deployed) for flight, or back to the parts. */
		merge(on: boolean) {
			if (on === isMerged) return;
			isMerged = on;
			merged.forEach(m => { m.visible = on; });
			// The turbine faces stay with the flying hull (their engines' own meshes are hidden when merged).
			root.updateMatrixWorld(true);
			turbines.forEach(c => {
				(on ? root : c.userData.home as Object3D).attach(c);
				// Flying, the turbine face sits just aft of the (uncut) merged stern wall, inside the engine ring.
				if (on) { c.userData.buildZ = c.position.z; c.position.z = c.userData.flightZ as number; }
				else if (c.userData.buildZ !== undefined) { root.attach(c); c.position.z = c.userData.buildZ as number; (c.userData.home as Object3D).attach(c); }
			});
			originals.forEach(m => { m.visible = !on; });
			if (!on) { for (const part of parts) part.last = -1; parts.forEach(apply); }
		},
		dispose() {
			root.removeFromParent();
			root.traverse(node => { if (node instanceof Mesh && node.geometry !== strip) node.geometry.dispose(); }); merged.forEach(m => m.geometry.dispose());
			materials.forEach(m => m.dispose());
			plumes.forEach(p => p.material.dispose()); if (centre) { centre.material.dispose(); centre.throatMaterial.dispose(); centre.throat.geometry.dispose(); }
			ports.forEach(p => { p.geometry.dispose(); (p.children[0] as Mesh).geometry.dispose(); }); keel.forEach(k => k.geometry.dispose()); portMaterial.dispose(); portRimMaterial.dispose();
			strip.dispose(); throatMaterial.dispose(); throatTexture.dispose(); env.dispose(); flareGeometry.dispose(); flareMaterial.dispose();
		},
	};
}

export type Lifeboat = Awaited<ReturnType<typeof createLifeboat>>;
