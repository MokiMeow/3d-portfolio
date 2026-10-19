import type { FilmLights } from "./lights";
import {
	AdditiveBlending, BackSide, Box3, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry,
	DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Points,
	Quaternion, RepeatWrapping, RingGeometry, ShaderMaterial, Shape, SRGBColorSpace, TorusGeometry, Vector3, type Object3D, type Texture,
} from "three";

/**
 * Protocol 02, the heart. WALL·E's charging dock retracts into the ground; he rolls to the middle of the lab,
 * where the floor irises open and a glass platform rises flush under him. He closes himself into his box
 * (the film's own box mode), the box burns in his solar amber and becomes a tesseract, which folds through
 * itself and shrinks to fit the glass; a glass column rises out of the floor round it, and he powers the ship.
 *
 * Everything is driven by 0..1 levels in `state`, tweened by the director, so the sequence seeks cleanly.
 * The lab floor is a baked mesh that cannot be cut: openings reset depth to the far plane where the floor
 * is nearest, and what is below draws after them (see core.ts, whose iris this keeps).
 */
export const HEART_AT = new Vector3(2.6, .32, 2.2);
const R = .62, WELL = 1.6;
/** The column's glass: radius and height (model units; WALL·E stands 1.17). */
const TUBE_R = .3, TUBE_H = 1.05;
/** The box WALL·E closes into is about this wide; the tesseract starts at his size and ends inside the tube. */
export const BOX = .62, CORE_SIZE = .3;

const AMBER = new Color("#ffb347"), HOT = new Color("#fff1d0");

function stripes() {
	const c = document.createElement("canvas"); c.width = 64; c.height = 256;
	const g = c.getContext("2d")!;
	g.fillStyle = "#17181b"; g.fillRect(0, 0, 64, 256);
	for (let y = 0; y < 256; y += 32) { g.fillStyle = "#25272b"; g.fillRect(0, y, 64, 3); g.fillStyle = "#b9874c"; g.fillRect(0, y + 14, 64, 2); }
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(10, 1);
	return t;
}
const depthReset = () => new ShaderMaterial({
	vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
	fragmentShader: "void main() { gl_FragColor = vec4(0.); gl_FragDepth = 1.; }",
	colorWrite: false, depthWrite: true,
});

/** Glass without a transmission pass: a thin tinted body, bright at grazing angles, catching the core's light. */
function glassMaterial(level: { value: number }, glow: { value: number }) {
	return new ShaderMaterial({
		uniforms: { uLevel: level, uGlow: glow, uTint: { value: new Color("#cfe6ff") }, uWarm: { value: AMBER.clone() } },
		transparent: true, depthWrite: false, side: DoubleSide,
		vertexShader: /* glsl */ `
			varying vec3 vN, vV; varying vec2 vUv;
			void main() { vUv = uv; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `
			uniform float uLevel, uGlow; uniform vec3 uTint, uWarm;
			varying vec3 vN, vV; varying vec2 vUv;
			void main() {
				float f = 1. - abs(dot(normalize(vN), normalize(vV)));
				float fres = pow(f, 3.);
				// Two faint vertical highlight bands, like a studio light reflected in a cylinder.
				float band = exp(-pow((fract(vUv.x * 2. + .12) - .5) * 26., 2.)) * .6;
				vec3 col = uTint * (.05 + fres * .9 + band * .35) + uWarm * uGlow * (.12 + fres * .5);
				float a = (.06 + fres * .55 + band * .2) * uLevel;
				gl_FragColor = vec4(col * uLevel, a);
			}`,
	});
}

export function createHeart(parent: Object3D, env: Texture | null, lights: FilmLights) {
	const owned: { dispose(): void }[] = [];
	const own = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };
	const state = { iris: 0, well: 0, platform: 0, box: 0, tess: 0, fold: 0, shrink: 0, tube: 0, glow: 0, pulse: 0, dock: 0, ramp: 0 };
	const root = new Group(); root.name = "doomsday_heart"; root.position.copy(HEART_AT); parent.add(root);
	const metal = own(new MeshStandardMaterial({ color: new Color("#3a3d43"), metalness: .85, roughness: .32, envMap: env }));
	const brushed = own(new MeshStandardMaterial({ color: new Color("#a7aab0"), metalness: 1, roughness: .28, envMap: env }));
	const brass = own(new MeshStandardMaterial({ color: new Color("#b9874c"), metalness: .9, roughness: .3, envMap: env, emissive: new Color("#f2b65a"), emissiveIntensity: 0 }));

	// --- The iris in the floor and the well beneath it ---------------------------------------------------
	const opening = new Mesh(own(new CircleGeometry(R, 48)), own(depthReset()));
	opening.rotation.x = -Math.PI / 2; opening.position.y = .004; opening.renderOrder = 50;
	const wellTexture = own(stripes());
	const well = new Mesh(own(new CylinderGeometry(R, R, WELL, 48, 1, true)), own(new MeshStandardMaterial({ map: wellTexture, metalness: .7, roughness: .45, side: BackSide, emissive: new Color("#c98a4b"), emissiveMap: wellTexture, emissiveIntensity: 0, envMap: env })));
	well.position.y = -WELL / 2; well.renderOrder = 51;
	const wellFloorMaterial = own(new MeshBasicMaterial({ color: new Color("#ffb766"), transparent: true, opacity: 0 }));
	const wellFloor = new Mesh(own(new CircleGeometry(R, 48)), wellFloorMaterial);
	wellFloor.rotation.x = -Math.PI / 2; wellFloor.position.y = -WELL + .01; wellFloor.renderOrder = 51;
	const below = new Group(); below.add(opening, well, wellFloor); below.visible = false; root.add(below);

	const PETALS = 8, half = Math.PI / PETALS, chord = R * Math.cos(half);
	const petalShape = new Shape();
	petalShape.moveTo(0, -R * Math.sin(half)); petalShape.lineTo(0, R * Math.sin(half)); petalShape.lineTo(-chord, 0); petalShape.closePath();
	const petalGeometry = own(new ExtrudeGeometry(petalShape, { depth: .03, bevelEnabled: true, bevelSize: .008, bevelThickness: .006, bevelSegments: 1 }));
	petalGeometry.rotateX(-Math.PI / 2);
	const seamMaterial = own(new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0 }));
	const irisGroup = new Group(); root.add(irisGroup);
	const blades = Array.from({ length: PETALS }, (_, i) => {
		const turn = new Group(); turn.rotation.y = -(i / PETALS) * Math.PI * 2 - half; irisGroup.add(turn);
		const hinge = new Group(); hinge.position.set(chord, .012, 0); turn.add(hinge);
		const petal = new Mesh(petalGeometry, metal); petal.renderOrder = 60; hinge.add(petal);
		const seam = new Mesh(own(new PlaneGeometry(chord, .012)), seamMaterial); seam.rotation.x = -Math.PI / 2; seam.position.set(-chord / 2, .045, 0); hinge.add(seam);
		return hinge;
	});
	const rim = new Mesh(own(new RingGeometry(R * .985, R + .12, 64)), brass); rim.rotation.x = -Math.PI / 2; rim.position.y = .045;
	const rimWall = new Mesh(own(new CylinderGeometry(R + .12, R + .14, .05, 64, 1, true)), metal); rimWall.position.y = .022;
	irisGroup.add(rim, rimWall);

	// --- The glass platform: a lit disc that rises from the well to sit flush with the floor --------------
	const platform = new Group(); root.add(platform);
	const deck = new Mesh(own(new CylinderGeometry(R * .97, R * .97, .05, 64)), own(new MeshStandardMaterial({ color: new Color("#9fb6c8"), metalness: .1, roughness: .05, transparent: true, opacity: .55, envMap: env, emissive: AMBER, emissiveIntensity: 0 })));
	deck.position.y = -.025; deck.renderOrder = 61;
	const deckRing = new Mesh(own(new TorusGeometry(R * .97, .018, 10, 64)), brushed); deckRing.rotation.x = Math.PI / 2; deckRing.renderOrder = 61;
	// Under-light: a soft amber pool seen through the glass.
	const underTexture = (() => {
		const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
		const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, "rgba(255,200,130,1)"); grad.addColorStop(.5, "rgba(255,150,60,.35)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return own(new CanvasTexture(c));
	})();
	const underMaterial = own(new MeshBasicMaterial({ map: underTexture, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
	const under = new Mesh(own(new PlaneGeometry(R * 2, R * 2)), underMaterial); under.rotation.x = -Math.PI / 2; under.position.y = -.06; under.renderOrder = 61;
	platform.add(deck, deckRing, under);

	// --- The tesseract: two crystal cubes, one inside the other, that turn against each other and fold through
	// each other (the inner swells out as the outer draws in), in his solar amber. Each is a box whose faces are
	// faint glass and whose edges are crisp lines of light; energy drifts inside.
	const crystal = (hot: boolean) => new ShaderMaterial({
		uniforms: { uLevel: { value: 0 }, uTime: { value: 0 }, uHot: { value: hot ? 1 : 0 } },
		transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
		vertexShader: /* glsl */ `
			varying vec2 vUv; varying vec3 vN, vV, vP;
			void main() { vUv = uv; vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `
			uniform float uLevel, uTime, uHot; varying vec2 vUv; varying vec3 vN, vV, vP;
			float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
			float noise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
				return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
				           mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
			void main() {
				// Distance to the nearest edge of this face, in pixels: a line of constant width, anti-aliased.
				vec2 e = min(vUv, 1. - vUv);
				vec2 px = fwidth(vUv);
				vec2 d = e / max(px, vec2(1e-5));
				float edge = 1. - smoothstep(.6, 2.2, min(d.x, d.y));
				float halo = exp(-min(d.x, d.y) * .12) * .35;
				float facing = abs(dot(normalize(vN), normalize(vV)));
				float energy = noise(vP * 3.5 + vec3(0., uTime * .6, uTime * .3)) * noise(vP * 7. - uTime * .4);
				vec3 amber = vec3(1., .66, .24), white = vec3(1., .93, .8);
				vec3 col = mix(amber, white, uHot * .6 + edge * .5) * (edge * 2.4 + halo)
				         + amber * (.05 + (1. - facing) * .12 + energy * (.1 + uHot * .35));
				gl_FragColor = vec4(col * uLevel, 1.);
			}`,
	});
	const tess = new Group(); root.add(tess);
	const cubeGeometry = own(new BoxGeometry(1, 1, 1));
	const outerMaterial = own(crystal(false)), innerMaterial = own(crystal(true));
	const outer = new Mesh(cubeGeometry, outerMaterial), inner = new Mesh(cubeGeometry, innerMaterial);
	outer.renderOrder = 70; inner.renderOrder = 71;
	tess.add(outer, inner);
	// A soft glow behind it all, so it reads as a light, not a model.
	const haloTexture = (() => {
		const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
		const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64); grad.addColorStop(0, "rgba(255,190,110,.9)"); grad.addColorStop(.35, "rgba(255,140,50,.25)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return own(new CanvasTexture(c));
	})();
	const haloMaterial = own(new MeshBasicMaterial({ map: haloTexture, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
	const halo = new Mesh(own(new PlaneGeometry(1, 1)), haloMaterial); halo.renderOrder = 69; tess.add(halo);
	tess.visible = false;
	/** Where the box he closed into actually is (set by the director at the burn), in this root's frame. */
	const boxStart = { size: BOX, y: BOX / 2 };

	// --- The column: glass, with brushed collars, rising out of the well -----------------------------------
	const tubeLevel = { value: 0 }, tubeGlow = { value: 0 };
	const column = new Group(); root.add(column);
	const glass = new Mesh(own(new CylinderGeometry(TUBE_R, TUBE_R, TUBE_H, 64, 1, true)), own(glassMaterial(tubeLevel, tubeGlow)));
	glass.position.y = TUBE_H / 2 + .06; glass.renderOrder = 80;
	const collarGeometry = own(new CylinderGeometry(TUBE_R + .045, TUBE_R + .05, .09, 64));
	const base = new Mesh(collarGeometry, brushed); base.position.y = .045;
	const cap = new Mesh(collarGeometry, brushed); cap.position.y = TUBE_H + .1;
	const baseLight = new Mesh(own(new TorusGeometry(TUBE_R + .01, .008, 8, 64)), own(new MeshBasicMaterial({ color: AMBER.clone().multiplyScalar(2), transparent: true, opacity: 0, toneMapped: false })));
	baseLight.rotation.x = Math.PI / 2; baseLight.position.y = .1;
	const capLight = baseLight.clone(); capLight.position.y = TUBE_H + .05;
	column.add(glass, base, cap, baseLight, capLight);
	column.visible = false;

	// --- Power: rings that run out across the floor from the column -----------------------------------------
	const pulseMaterial = own(new ShaderMaterial({
		uniforms: { uPulse: { value: 0 }, uLevel: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
		fragmentShader: /* glsl */ `
			uniform float uPulse, uLevel; varying vec2 vUv;
			void main() {
				float r = length(vUv - .5) * 2.;
				float ring = 0.;
				for (int i = 0; i < 3; i++) { float front = fract(uPulse - float(i) * .33); ring += exp(-pow((r - front) * 22., 2.)) * (1. - front); }
				float pool = exp(-r * 5.) * .5;
				gl_FragColor = vec4(vec3(1., .66, .3) * (ring + pool) * uLevel * smoothstep(1., .85, r), 1.);
			}`,
	}));
	const pulsePlane = new Mesh(own(new PlaneGeometry(9, 9)), pulseMaterial); pulsePlane.rotation.x = -Math.PI / 2; pulsePlane.position.y = .02; pulsePlane.renderOrder = 45;
	root.add(pulsePlane); pulsePlane.visible = false;
	root.visible = false;

	// --- The dock becomes a ramp ----------------------------------------------------------------------------
	// WALL·E's charging dock stands on the apron in front of the lab, its tall back panel between him and the
	// lab floor (which is a step of 0.15 above the dock's deck). When he is called, the back panel retracts
	// straight down into the dock's base until it is flush with the deck, and a ramp plate slides out of the
	// deck towards the lab and tips up until its lip rests on the lab floor's edge. He rolls along his deck and
	// up the ramp. The dock is batched into a few merged meshes, so the panel's triangles are lifted out into
	// their own pieces (by where they are), and everything is put back after.
	const DECK_Y = .19, BACK = { min: new Vector3(.3, .14, 3.8), max: new Vector3(2.05, .76, 4.24) };
	// The lab floor's top is .34 and its edge is at z 3.33: the ramp's underside rests on that corner.
	const FLOOR_EDGE = new Vector3(1.15, .342, 3.33), RAMP_FOOT = new Vector3(1.15, DECK_Y - .03, 3.86);
	const dock = parent.getObjectByName("exterior_service_bay");
	const dockSwaps: { mesh: Mesh; geometry: BufferGeometry }[] = [];
	const backPieces: Mesh[] = [];
	let backDrop = .5;
	if (dock) {
		parent.updateMatrixWorld(true);
		const toModel = parent.matrixWorld.clone().invert();
		const v = [new Vector3(), new Vector3(), new Vector3()], c = new Vector3();
		dock.traverse(o => {
			if (!(o instanceof Mesh)) return;
			const g = o.geometry as BufferGeometry, position = g.getAttribute("position");
			const m = toModel.clone().multiply(o.matrixWorld);
			const triangles = g.index ? g.index.count / 3 : position.count / 3;
			const at = (t: number, k: number) => g.index ? g.index.getX(t * 3 + k) : t * 3 + k;
			const keep: number[] = [], take: number[] = [];
			for (let t = 0; t < triangles; t++) {
				for (let k = 0; k < 3; k++) v[k]!.fromBufferAttribute(position, at(t, k)).applyMatrix4(m);
				c.copy(v[0]!).add(v[1]!).add(v[2]!).divideScalar(3);
				(c.x > BACK.min.x && c.x < BACK.max.x && c.y > BACK.min.y && c.y < BACK.max.y && c.z > BACK.min.z && c.z < BACK.max.z ? take : keep).push(t);
			}
			if (!take.length) return;
			const subset = (list: number[]) => {
				const out = new BufferGeometry();
				for (const [name, attribute] of Object.entries(g.attributes)) {
					const size = attribute.itemSize, array = new Float32Array(list.length * 3 * size);
					list.forEach((t, i) => { for (let k = 0; k < 3; k++) for (let j = 0; j < size; j++) array[(i * 3 + k) * size + j] = attribute.getComponent(at(t, k), j); });
					out.setAttribute(name, new BufferAttribute(array, size, attribute.normalized));
				}
				return own(out);
			};
			dockSwaps.push({ mesh: o, geometry: g });
			o.geometry = subset(keep);
			const piece = new Mesh(subset(take), o.material); piece.name = "doomsday_dock_back";
			o.parent!.add(piece); piece.position.copy(o.position); piece.quaternion.copy(o.quaternion); piece.scale.copy(o.scale);
			piece.userData.y = piece.position.y; backPieces.push(piece);
		});
		backDrop = BACK.max.y - DECK_Y + .02;
	}
	// The ramp plate: graphite, side rails, yellow chevrons; hinged at its foot on the deck's edge.
	const chevrons = (() => {
		const cv = document.createElement("canvas"); cv.width = 128; cv.height = 256; const g = cv.getContext("2d")!;
		g.fillStyle = "#2b2c30"; g.fillRect(0, 0, 128, 256);
		g.strokeStyle = "#d8a23a"; g.lineWidth = 14;
		for (let y = -64; y < 320; y += 56) { g.beginPath(); g.moveTo(8, y + 40); g.lineTo(64, y); g.lineTo(120, y + 40); g.stroke(); }
		g.fillStyle = "#1c1d20"; for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 128, 1);
		const t = own(new CanvasTexture(cv)); t.colorSpace = SRGBColorSpace; return t;
	})();
	const rampLength = Math.hypot(FLOOR_EDGE.z - RAMP_FOOT.z, FLOOR_EDGE.y - RAMP_FOOT.y) + .1;
	const rampAngle = Math.atan2(FLOOR_EDGE.y - RAMP_FOOT.y, RAMP_FOOT.z - FLOOR_EDGE.z);
	const ramp = new Group(); ramp.name = "doomsday_dock_ramp"; parent.add(ramp);
	ramp.position.copy(RAMP_FOOT);
	const plate = new Mesh(own(new BoxGeometry(.92, .03, rampLength)), [metal, metal, own(new MeshStandardMaterial({ map: chevrons, metalness: .4, roughness: .55, envMap: env })), metal, metal, metal]);
	// Above its hinge line, so the underside (not the middle of the plate) is what meets the floor.
	plate.position.set(0, .015, -rampLength / 2);
	const railGeometry = own(new BoxGeometry(.04, .06, rampLength));
	const rails = [-1, 1].map(side => { const r = new Mesh(railGeometry, brushed); r.position.set(side * .47, .03, -rampLength / 2); return r; });
	const slide = new Group(); slide.add(plate, ...rails); ramp.add(slide);
	ramp.visible = false;

	const SIZE_END = CORE_SIZE;
	const camQuaternion = new Quaternion();
	return {
		root, state, tube: column, tesseract: tess, platform,
		/** Where WALL·E stands on the glass (model frame). */
		at: HEART_AT,
		/** The ramp: its foot on the dock's deck and its lip on the lab floor (model frame). */
		rampFoot: RAMP_FOOT, rampLip: FLOOR_EDGE,
		/** The box's size and the height of its centre above the floor, where he actually closed (root frame). */
		setBox(size: number, centreY: number) { boxStart.size = size; boxStart.y = centreY; },
		update(time: number, camera?: { quaternion: Quaternion }) {
			if (camera) camQuaternion.copy(camera.quaternion);
			const s = state;
			// The dock's back panel goes down into its base; the ramp slides out of the deck and tips up onto the floor.
			for (const piece of backPieces) piece.position.y = (piece.userData.y as number) - s.dock * backDrop;
			ramp.visible = s.ramp > 0;
			if (ramp.visible) {
				// It runs out along its own slope (tucked, it sits below the deck surface behind the hinge), so its
				// lip rises as it travels and lands on the floor's edge instead of striking the step.
				ramp.rotation.x = rampAngle;
				slide.position.z = (1 - s.ramp) * rampLength * .96;
			}
			root.visible = s.iris > 0 || s.tube > 0 || s.platform > 0;
			below.visible = s.iris > .01 && s.tube < 1;
			// Each petal folds down into the well on its hinge, one a beat after another.
			blades.forEach((h, i) => { h.rotation.z = Math.min(1, Math.max(0, s.iris * 1.15 - i * .015)) * Math.PI * .5; });
			seamMaterial.opacity = Math.min(1, s.iris * 4) * (1 - s.iris);
			(well.material as MeshStandardMaterial).emissiveIntensity = s.well * .6;
			wellFloorMaterial.opacity = s.well * .8;
			brass.emissiveIntensity = s.glow * .8 + s.iris * .2;
			// Platform: from the bottom of the well up to flush.
			platform.visible = s.iris > .5 || s.platform > 0;
			platform.position.y = -WELL * .7 * (1 - s.platform);
			(deck.material as MeshStandardMaterial).emissiveIntensity = .15 + s.glow * .8;
			underMaterial.opacity = .35 + s.glow * .6;
			// Tesseract: appears as the box burns, folds through itself, shrinks and rises to the column's heart.
			tess.visible = s.tess > 0;
			if (tess.visible) {
				const size = boxStart.size + (SIZE_END - boxStart.size) * s.shrink;
				tess.position.y = boxStart.y + (TUBE_H / 2 + .06 - boxStart.y) * s.shrink;
				// Fold: the inner cube swells out through the outer as the outer draws in, and back (s.fold turns).
				const f = .5 - .5 * Math.cos(s.fold * Math.PI * 2);
				const outerScale = size * (1 - .42 * f), innerScale = size * (.5 + .42 * f);
				outer.scale.setScalar(outerScale); inner.scale.setScalar(innerScale);
				const turn = s.fold * Math.PI * .5 + time * .25 * s.shrink;
				outer.rotation.set(turn * .35, turn, 0); inner.rotation.set(-turn * .5, -turn * 1.3, turn * .2);
				outerMaterial.uniforms.uLevel.value = s.tess * (.8 + s.glow * .4); innerMaterial.uniforms.uLevel.value = s.tess * (1 + s.glow * .6);
				outerMaterial.uniforms.uTime.value = innerMaterial.uniforms.uTime.value = time;
				halo.scale.setScalar(size * 4); halo.quaternion.copy(camQuaternion);
				haloMaterial.opacity = s.tess * (.35 + s.glow * .4);
			}
			// Column.
			column.visible = s.tube > 0;
			column.position.y = -(TUBE_H + .3) * (1 - s.tube);
			tubeLevel.value = Math.min(1, s.tube * 1.5); tubeGlow.value = s.glow;
			(baseLight.material as MeshBasicMaterial).opacity = s.glow;
			// Power on the floor, and the room's light from the core.
			pulsePlane.visible = s.pulse > 0;
			pulseMaterial.uniforms.uPulse.value = time * .45; pulseMaterial.uniforms.uLevel.value = s.pulse;
			lights.b.intensity = s.glow * 18; lights.b.position.copy(HEART_AT).add(new Vector3(0, .8, 0)); lights.b.color.copy(AMBER);
		},
		dispose() {
			for (const { mesh, geometry } of dockSwaps) mesh.geometry = geometry;
			backPieces.forEach(p => p.removeFromParent()); ramp.removeFromParent();
			root.removeFromParent();
			owned.forEach(o => o.dispose());
			lights.b.intensity = 0;
		},
	};
}
