import type { FilmLights } from "./lights";
import {
	AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, CircleGeometry, Color, CylinderGeometry,
	DoubleSide, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight, Points, RepeatWrapping,
	RingGeometry, ShaderMaterial, Shape, SphereGeometry, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector3, type Material, type Object3D,
	type Texture,
} from "three";

/**
 * Protocol 02: the heart. WALL·E rolls to the middle of the lab, folds himself into his cube, and the floor
 * opens under him: an iris in the tiles, a well beneath it. He sinks into the well, his chest opens, and
 * the core he carries rises out of him on its clamps, burning gold. Cables snake in across the floor from
 * the walls, lock onto the socket one by one, and the light runs back out along them to every wall.
 *
 * Everything is driven by a handful of 0..1 levels (`state`), tweened by the director's timeline, so the
 * sequence seeks cleanly. The floor is the room's baked mesh, which cannot be cut: the iris opening resets
 * depth to the far plane where the floor is in front (and only there), and the well and WALL·E draw after
 * it, so the hole is real to the eye without touching the floor.
 */
export const CORE_AT = new Vector3(2.6, .32, 2.2);
const R = .86, WELL = 1.5;
/**
 * Where the power goes. Four couplings open in the floor round the core, each feeding one of the ship's
 * systems; a cable runs out from the core's rim to each, lying flat on the tiles, and plugs in.
 * Offsets from the core on the floor (x, z), in the model's frame, and the system each one feeds.
 */
const COUPLINGS: { at: [number, number]; name: string }[] = [
	{ at: [0, -2.55], name: "ENGINES" }, { at: [-2.2, .4], name: "HELM" }, { at: [2.4, .25], name: "HULL" }, { at: [.25, 2.3], name: "SHIELDS" },
];

const stripes = () => {
	const c = document.createElement("canvas"); c.width = 64; c.height = 256;
	const g = c.getContext("2d")!;
	g.fillStyle = "#1b1c1f"; g.fillRect(0, 0, 64, 256);
	for (let y = 0; y < 256; y += 32) { g.fillStyle = "#2a2c30"; g.fillRect(0, y, 64, 3); g.fillStyle = "#c98a4b"; g.fillRect(0, y + 14, 64, 2); }
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(10, 1);
	return t;
};

export function createCore(parent: Object3D, env: Texture | null, lights: FilmLights) {
	const root = new Group(); root.name = "doomsday_core"; root.position.copy(CORE_AT); parent.add(root);
	const owned: { dispose(): void }[] = [];
	const own = <T extends { dispose(): void }>(x: T) => { owned.push(x); return x; };
	const state = { iris: 0, well: 0, rise: 0, clamps: 0, glow: 0, spin: 0, pulse: 0, cables: COUPLINGS.map(() => 0), hatches: 0 };

	// --- The opening: where the floor is the nearest thing, depth goes back to the far plane --------------
	const opening = new Mesh(own(new CircleGeometry(R, 48)), own(new ShaderMaterial({
		vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
		fragmentShader: "void main() { gl_FragColor = vec4(0.); gl_FragDepth = 1.; }",
		colorWrite: false, depthWrite: true,
	})));
	opening.rotation.x = -Math.PI / 2; opening.position.y = .004; opening.renderOrder = 50; opening.visible = false;
	root.add(opening);

	// --- The well: dark machined walls with gold rings, a glowing floor --------------------------------
	const wellTexture = own(stripes());
	const well = new Mesh(own(new CylinderGeometry(R, R * .9, WELL, 48, 1, true)), own(new MeshStandardMaterial({ map: wellTexture, metalness: .7, roughness: .45, side: BackSide, emissive: new Color("#c98a4b"), emissiveMap: wellTexture, emissiveIntensity: 0, envMap: env })));
	well.position.y = -WELL / 2; well.renderOrder = 51; well.visible = false;
	const wellFloorMaterial = own(new MeshBasicMaterial({ color: new Color("#ffb766"), transparent: true, opacity: 0 }));
	const wellFloor = new Mesh(own(new CircleGeometry(R * .9, 48)), wellFloorMaterial);
	wellFloor.rotation.x = -Math.PI / 2; wellFloor.position.y = -WELL + .01; wellFloor.renderOrder = 51; wellFloor.visible = false;
	root.add(well, wellFloor);

	// --- The floor opens: eight triangular petals, each hinged along its edge at the rim, fold down into the well
	const metal = own(new MeshStandardMaterial({ color: new Color("#3b3e44"), metalness: .85, roughness: .32, envMap: env }));
	const brass = own(new MeshStandardMaterial({ color: new Color("#c98a4b"), metalness: .9, roughness: .3, envMap: env, emissive: new Color("#f2b65a"), emissiveIntensity: 0 }));
	const PETALS = 8, half = Math.PI / PETALS, chord = R * Math.cos(half);
	const petalShape = new Shape();
	// Drawn with its hinge (the chord at the rim) along x = 0 and its tip pointing in, towards -x.
	petalShape.moveTo(0, -R * Math.sin(half)); petalShape.lineTo(0, R * Math.sin(half)); petalShape.lineTo(-chord, 0); petalShape.closePath();
	const petalGeometry = own(new ExtrudeGeometry(petalShape, { depth: .03, bevelEnabled: true, bevelSize: .008, bevelThickness: .006, bevelSegments: 1 }));
	petalGeometry.rotateX(-Math.PI / 2); // lie flat, top face up
	const seamMaterial = own(new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0 }));
	const blades = Array.from({ length: PETALS }, (_, i) => {
		const turn = new Group(); turn.rotation.y = -(i / PETALS) * Math.PI * 2 - half; root.add(turn);
		const hinge = new Group(); hinge.position.set(chord, .012, 0); turn.add(hinge);
		const petal = new Mesh(petalGeometry, metal); petal.renderOrder = 60; hinge.add(petal);
		// A thin gold seam along each petal's sides, lit as the floor unlocks.
		const seam = new Mesh(own(new PlaneGeometry(chord, .012)), seamMaterial); seam.rotation.x = -Math.PI / 2; seam.position.set(-chord / 2, .045, 0); hinge.add(seam);
		return hinge;
	});
	const rim = new Mesh(own(new RingGeometry(R * .985, R + .14, 64)), brass);
	rim.rotation.x = -Math.PI / 2; rim.position.y = .045;
	const rimWall = new Mesh(own(new CylinderGeometry(R + .14, R + .16, .05, 64, 1, true)), metal);
	rimWall.position.y = .022;
	const rimLip = new Mesh(own(new CylinderGeometry(R * .985, R * .985, .05, 64, 1, true)), metal);
	rimLip.position.y = .022;
	root.add(rim, rimWall, rimLip);
	root.visible = false;

	// --- The core: a small star in a cage of rings ------------------------------------------------------
	const coreMaterial = own(new ShaderMaterial({
		uniforms: { uTime: { value: 0 }, uGlow: { value: 0 } },
		vertexShader: /* glsl */ `
			varying vec3 vNormal, vView, vLocal;
			void main() {
				vLocal = position; vNormal = normalize(normalMatrix * normal);
				vec4 mv = modelViewMatrix * vec4(position, 1.); vView = -mv.xyz;
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */ `
			uniform float uTime, uGlow;
			varying vec3 vNormal, vView, vLocal;
			float hash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
			float noise(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
				return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
				           mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
			void main() {
				vec3 p = normalize(vLocal) * 3.;
				float n = noise(p + vec3(0., uTime * .8, 0.)) * .55 + noise(p * 2.3 - vec3(uTime * 1.1)) * .3 + noise(p * 5.1 + uTime) * .15;
				float facing = abs(dot(normalize(vNormal), normalize(vView)));
				vec3 hot = mix(vec3(1., .55, .18), vec3(1., .93, .78), smoothstep(.35, .8, n));
				vec3 col = hot * (1.4 + n * 1.8) * mix(.7, 1.2, facing) + vec3(1., .7, .35) * pow(1. - facing, 2.) * 1.6;
				gl_FragColor = vec4(col * uGlow, 1.);
			}`,
	}));
	const core = new Group(); core.visible = false; root.add(core);
	const sphere = new Mesh(own(new SphereGeometry(.24, 48, 32)), coreMaterial); core.add(sphere);
	sphere.renderOrder = 60; // drawn after the opening, so it shows while still down in the well
	const ringMaterial = own(new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
	const rings = [.36, .44, .52].map((r, i) => {
		const m = new Mesh(own(new TorusGeometry(r, .008 + i * .003, 8, 96)), ringMaterial);
		m.rotation.set(Math.PI / 2 + i * .7, i * 1.1, 0); core.add(m); return m;
	});
	const haloTexture = (() => {
		const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
		const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		grad.addColorStop(0, "rgba(255,214,150,1)"); grad.addColorStop(.25, "rgba(255,170,80,.45)"); grad.addColorStop(1, "rgba(0,0,0,0)");
		g.fillStyle = grad; g.fillRect(0, 0, 128, 128); return own(new CanvasTexture(c));
	})();
	const haloMaterial = own(new MeshBasicMaterial({ map: haloTexture, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
	const halo = new Mesh(own(new PlaneGeometry(2.4, 2.4)), haloMaterial); core.add(halo);
	// The film's shared point light B (lights.ts), at the core.
	const light = lights.b; light.color.set("#ffb066"); light.distance = 14; light.position.copy(CORE_AT).add(new Vector3(0, 1, 0));
	const poolMaterial = own(new MeshBasicMaterial({ map: haloTexture, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, color: new Color("#ffb066") }));
	const pool = new Mesh(own(new PlaneGeometry(7, 7)), poolMaterial); pool.rotation.x = -Math.PI / 2; pool.position.y = .02; root.add(pool);

	// Clamps: four arms that wait upright down in the well, rise through the opening with the core, and lean
	// in to hold it. They are never seen lying on the floor.
	const clamps = [0, 1, 2, 3].map(i => {
		const pivot = new Group(); pivot.rotation.y = i * Math.PI / 2 + Math.PI / 4; root.add(pivot);
		const hinge = new Group(); hinge.position.set(R * .72, -1.4, 0); pivot.add(hinge);
		const arm = new Mesh(own(new CylinderGeometry(.035, .05, 1.0, 10)), metal); arm.position.y = .5; arm.renderOrder = 60; hinge.add(arm);
		const claw = new Mesh(own(new TorusGeometry(.09, .022, 8, 16, Math.PI)), brass); claw.position.y = 1.0; claw.rotation.y = Math.PI / 2; claw.renderOrder = 60; hinge.add(claw);
		return hinge;
	});

	// --- Couplings: floor hatches that slide open on a brass socket, labelled with what they feed ---------
	const labelTexture = (text: string) => {
		const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!;
		g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 256, 64);
		g.strokeStyle = "rgba(242,182,90,.9)"; g.lineWidth = 3; g.strokeRect(4, 6, 248, 52);
		g.fillStyle = "#f2b65a"; g.font = "600 30px ui-monospace, Consolas, monospace"; g.textAlign = "center"; g.fillText(text, 128, 43);
		const t = own(new CanvasTexture(c)); t.colorSpace = SRGBColorSpace; return t;
	};
	const couplings = COUPLINGS.map(({ at, name }) => {
		const g = new Group(); g.position.set(at[0], 0, at[1]); root.add(g);
		g.rotation.y = Math.atan2(at[0], at[1]); // the label reads from the core
		const frame = new Mesh(own(new CylinderGeometry(.27, .29, .03, 40)), metal); frame.position.y = .015; g.add(frame);
		const socketMaterial = own(new MeshStandardMaterial({ color: new Color("#c98a4b"), metalness: .9, roughness: .3, envMap: env, emissive: new Color("#ffb347"), emissiveIntensity: 0 }));
		const socket = new Mesh(own(new TorusGeometry(.11, .035, 10, 32)), socketMaterial); socket.rotation.x = -Math.PI / 2; socket.position.y = .035; g.add(socket);
		const doors = [-1, 1].map(side => {
			const door = new Mesh(own(new BoxGeometry(.25, .02, .5)), metal); door.position.set(side * .125, .045, 0); g.add(door); return { door, side };
		});
		const labelMaterial = own(new MeshBasicMaterial({ map: labelTexture(name), transparent: true, opacity: 0, depthWrite: false }));
		const label = new Mesh(own(new PlaneGeometry(.62, .155)), labelMaterial); label.rotation.x = -Math.PI / 2; label.rotation.z = Math.PI; label.position.set(0, .034, .45); g.add(label);
		g.visible = false;
		return { group: g, doors, socketMaterial, labelMaterial, lit: 0 };
	});

	// --- Cables: from the core's rim out across the floor to each coupling, flat on the tiles ---------------
	const cableMaterial = own(new MeshStandardMaterial({ color: new Color("#1d1e21"), roughness: .55, metalness: .3, envMap: env }));
	const pulse = { value: 0 }, live = { value: 0 };
	cableMaterial.onBeforeCompile = shader => {
		shader.uniforms.uPulse = pulse; shader.uniforms.uLive = live;
		shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float vAlong;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvAlong = uv.x;");
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", "#include <common>\nuniform float uPulse, uLive;\nvarying float vAlong;")
			.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
				// Power leaves the core (along = 0) and runs out to the coupling (along = 1); then the cable stays warm.
				float front = uPulse * 1.2;
				float band = exp(-pow((vAlong - front) * 14., 2.));
				totalEmissiveRadiance += vec3(1., .62, .26) * (band * 3. * step(.001, uPulse) * step(uPulse, .999) + uLive * (.25 + .15 * sin(vAlong * 40. - uPulse * 30.)));`);
	};
	const centre = new Vector3();
	const LIE = .045; // cable centre height above the tiles: radius .034 plus a hair, so it never sinks in
	const cables = COUPLINGS.map(({ at }, i) => {
		const end = new Vector3(at[0], 0, at[1]);
		const dir = end.clone().normalize();
		const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar((i % 2 ? 1 : -1) * .35);
		const length = end.length();
		const points = [
			dir.clone().multiplyScalar(R * .96).setY(.09),
			dir.clone().multiplyScalar(R + .25).setY(LIE),
			dir.clone().multiplyScalar(length * .5).add(side).setY(LIE),
			dir.clone().multiplyScalar(length - .4).setY(LIE),
			end.clone().setY(.07),
		];
		const curve = new CatmullRomCurve3(points, false, "centripetal");
		const geometry = own(new TubeGeometry(curve, 160, .034, 8, false));
		const mesh = new Mesh(geometry, cableMaterial); mesh.visible = false; root.add(mesh);
		const head = new Group();
		head.add(new Mesh(own(new CylinderGeometry(.055, .055, .14, 12)), brass).rotateX(Math.PI / 2));
		head.add(new Mesh(own(new CylinderGeometry(.04, .045, .06, 12)), metal).rotateX(Math.PI / 2).translateY(.09));
		head.visible = false; root.add(head);
		return { curve, mesh, head, total: geometry.index!.count };
	});

	// Sparks when each cable locks on.
	const SPARKS = 60 * COUPLINGS.length;
	const sparkPositions = new Float32Array(SPARKS * 3), sparkVelocity = new Float32Array(SPARKS * 3), sparkTime = new Float32Array(SPARKS).fill(-100);
	const sparkGeometry = own(new BufferGeometry());
	sparkGeometry.setAttribute("position", new BufferAttribute(sparkPositions, 3));
	sparkGeometry.setAttribute("aVelocity", new BufferAttribute(sparkVelocity, 3));
	sparkGeometry.setAttribute("aBorn", new BufferAttribute(sparkTime, 1));
	const sparkMaterial = own(new ShaderMaterial({
		uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
		vertexShader: /* glsl */ `
			attribute vec3 aVelocity; attribute float aBorn; uniform float uTime; varying float vLife;
			void main() {
				float age = uTime - aBorn; vLife = age > 0. && age < .7 ? 1. - age / .7 : 0.;
				vec3 p = position + aVelocity * age + vec3(0., -4.9 * age * age, 0.);
				vec4 mv = modelViewMatrix * vec4(p, 1.); gl_PointSize = 26. * vLife / -mv.z * 6.; gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: "varying float vLife; void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1., .78, .45) * vLife * smoothstep(.5, 0., d) * 2., 1.); }",
	}));
	const sparks = new Points(sparkGeometry, sparkMaterial); sparks.frustumCulled = false; root.add(sparks);
	cables.forEach((cable, c) => {
		const at = cable.curve.getPointAt(1);
		for (let i = 0; i < 60; i++) {
			const k = c * 60 + i;
			sparkPositions.set([at.x, at.y, at.z], k * 3);
			sparkVelocity.set([(Math.random() - .5) * 3, Math.random() * 2.5, (Math.random() - .5) * 3], k * 3);
		}
	});

	const tangent = new Vector3(), point = new Vector3();
	return {
		root, state, pulse, live,
		/** When cable `i` locked on (seconds on the director's clock), for its spark burst. */
		spark(i: number, at: number) {
			for (let k = i * 60; k < i * 60 + 60; k++) sparkTime[k] = at + Math.random() * .08;
			sparkGeometry.attributes.aBorn!.needsUpdate = true;
		},
		update(time: number) {
			const s = state;
			root.visible = s.iris > 0 || s.hatches > 0 || s.cables.some(c => c > 0);
			// The petals unlock (seams glow), then swing down on their hinges into the well.
			seamMaterial.opacity = Math.min(1, s.iris * 6) * (1 - s.iris);
			blades.forEach((hinge, i) => { hinge.rotation.z = Math.min(1, Math.max(0, s.iris * 1.15 - i * .015)) * Math.PI * .5; });
			const open = s.iris > .02;
			opening.visible = open; well.visible = open; wellFloor.visible = open;
			opening.scale.setScalar(Math.max(.001, s.iris));
			(well.material as MeshStandardMaterial).emissiveIntensity = s.well * 1.4;
			wellFloorMaterial.opacity = s.well;
			brass.emissiveIntensity = s.glow * .6;
			// The core climbs out of the well on its clamps.
			core.visible = s.rise > 0;
			core.position.y = -1.05 + s.rise * 2.05;
			core.rotation.y = time * .6;
			coreMaterial.uniforms.uTime.value = time; coreMaterial.uniforms.uGlow.value = s.glow;
			rings.forEach((m, i) => { m.rotation.z = time * (.7 + i * .35) * (i % 2 ? -1 : 1); });
			ringMaterial.opacity = s.glow * .9;
			haloMaterial.opacity = s.glow * .7;
			light.intensity = s.glow * 24;
			poolMaterial.opacity = s.glow * .55 + s.well * .15;
			// The clamps climb out of the well upright (first 60%), then lean in to hold the core.
			const climb = Math.min(1, s.clamps / .6), lean = Math.max(0, (s.clamps - .6) / .4);
			clamps.forEach(h => { h.position.y = -1.4 + climb * 1.42; h.rotation.z = lean * .55; h.visible = s.clamps > 0; });
			// The couplings: doors slide apart, the label lights; each socket glows once its cable is home.
			couplings.forEach((c, i) => {
				c.group.visible = s.hatches > 0;
				c.doors.forEach(({ door, side }) => { door.position.x = side * (.125 + s.hatches * .2); });
				c.labelMaterial.opacity = s.hatches * .85;
				const home = s.cables[i]! >= 1 ? 1 : 0;
				c.socketMaterial.emissiveIntensity = home * (1.2 + live.value * 1.5);
			});
			cables.forEach((cable, i) => {
				const g = Math.min(1, Math.max(0, s.cables[i]!));
				cable.mesh.visible = g > 0; cable.head.visible = g > 0 && g < 1;
				const count = Math.floor(g * cable.total / 6) * 6;
				cable.mesh.geometry.setDrawRange(0, count);
				if (g > 0) {
					cable.curve.getPointAt(g, point); cable.curve.getTangentAt(g, tangent);
					cable.head.position.copy(point);
					cable.head.lookAt(root.localToWorld(centre.copy(point).add(tangent)));
					// It snakes as it comes: a sideways weave that settles once the head is home.
					cable.head.position.x += Math.sin(time * 9 + i) * .03 * (1 - g);
					cable.head.position.y = Math.max(cable.head.position.y, LIE);
				}
			});
			sparkMaterial.uniforms.uTime.value = time;
		},
		/** Keep the halo square to the camera. */
		face(cameraQuaternion: { x: number; y: number; z: number; w: number }) { halo.quaternion.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z, cameraQuaternion.w).premultiply(parent.getWorldQuaternion(halo.quaternion.clone()).invert()); },
		/** Renders after the opening resets depth: give these objects a render order above it. */
		lift(objects: Object3D[]) {
			const was = new Map<Object3D, number>();
			for (const o of objects) o.traverse(n => { was.set(n, n.renderOrder); n.renderOrder = 60; });
			return () => was.forEach((order, n) => { n.renderOrder = order; });
		},
		dispose() {
			root.removeFromParent();
			owned.forEach(o => o.dispose());
			(opening.material as Material).dispose();
		},
	};
}
