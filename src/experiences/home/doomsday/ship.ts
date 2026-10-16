import gsap from "gsap";
import {
	AdditiveBlending, BoxGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide,
	DynamicDrawUsage, ExtrudeGeometry, Group, HemisphereLight, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshBasicMaterial,
	MeshPhysicalMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, PMREMGenerator, PointLight, Quaternion, SRGBColorSpace, Shape,
	TorusGeometry, Vector2, Vector3, type BufferGeometry, type Material, type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * The Lifeboat: everything the room grows to become a ship. All of it hides inside, under or flat against
 * the room until its protocol, then unfolds on a hinge (release, clear, rotate, lock), staggered so a few
 * dozen motions read as a few big events.
 *
 * Dimensions are the room's own, in the model's frame: x -3.7 .. 9.4 (left wall to the open right side),
 * z -3.3 .. 8.1 (back wall to the open front), floor at 0.32, walls 5.9 high. The ship flies towards +z;
 * its stern, engines and the old window face the hole.
 */
const X0 = -3.7, X1 = 9.4, Z0 = -3.3, Z1 = 8.1, FLOOR = .32, TOP = 6.05;
const W = X1 - X0, D = Z1 - Z0, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void) {
	const c = document.createElement("canvas"); c.width = c.height = size;
	draw(c.getContext("2d")!);
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
	return t;
}
/** Plate grain, panel seams and rivets, so the hull reads as engineered metal at any distance. */
const hullTexture = () => canvasTexture(256, g => {
	g.fillStyle = "#8a8a8a"; g.fillRect(0, 0, 256, 256);
	for (let i = 0; i < 1100; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,255"},${Math.random() * .04})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 40, 1 + Math.random() * 2); }
	g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 2.5; g.strokeRect(1, 1, 254, 254);
	g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 86); g.lineTo(256, 86); g.moveTo(0, 172); g.lineTo(256, 172); g.moveTo(128, 0); g.lineTo(128, 86); g.stroke();
	g.fillStyle = "rgba(0,0,0,.5)";
	for (let i = 8; i < 256; i += 16) for (const y of [6, 250]) { g.beginPath(); g.arc(i, y, 1.4, 0, 7); g.fill(); }
});
/** Where the hull glows: sparse gold lines along a few seams, the ship's running lights. */
const seamGlow = () => canvasTexture(256, g => {
	g.fillStyle = "#000"; g.fillRect(0, 0, 256, 256);
	g.fillStyle = "#ffb347"; g.fillRect(0, 84, 256, 3); g.fillRect(24, 170, 90, 2); g.fillRect(150, 170, 80, 2);
});
/** The engine plume: bright at the nozzle (the top of the canvas, v = 1), fading to nothing along its length. */
const plumeTexture = () => canvasTexture(64, g => {
	// An alpha map reads the green channel, so the fade is drawn in grey on black.
	const grad = g.createLinearGradient(0, 0, 0, 64);
	grad.addColorStop(0, "#fff"); grad.addColorStop(.45, "#404040"); grad.addColorStop(1, "#000");
	g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
});
/** An original circle-and-A in the spirit the owner asked for: a single swappable asset. */
const emblemTexture = () => canvasTexture(512, g => {
	g.strokeStyle = "#ffd28a"; g.fillStyle = "#ffd28a"; g.shadowColor = "#ffb347"; g.shadowBlur = 26;
	g.lineWidth = 30; g.beginPath(); g.arc(256, 256, 200, 0, Math.PI * 2); g.stroke();
	g.beginPath(); g.moveTo(256, 34); g.lineTo(96, 470); g.lineTo(168, 470); g.lineTo(256, 196); g.lineTo(300, 330); g.lineTo(236, 330); g.lineTo(220, 380); g.lineTo(316, 380); g.lineTo(344, 470); g.lineTo(416, 470); g.closePath(); g.fill();
});

export function createShip(renderer: WebGLRenderer, parent: Object3D) {
	const root = new Group(); root.name = "doomsday_ship"; parent.add(root);
	const geometries: BufferGeometry[] = [], materials: Material[] = [];
	const own = <T extends BufferGeometry>(g: T) => { geometries.push(g); return g; };
	const ownM = <T extends Material>(m: T) => { materials.push(m); return m; };
	const textures = [hullTexture(), seamGlow(), plumeTexture(), emblemTexture()];
	const [hullTex, glowTex, plumeTex, emblemTex] = textures as [CanvasTexture, CanvasTexture, CanvasTexture, CanvasTexture];

	// --- Light, for the new metal only; the baked room keeps its own look -------------------
	const pmrem = new PMREMGenerator(renderer);
	const envTarget = pmrem.fromScene(new RoomEnvironment(), .04);
	pmrem.dispose();
	// The key is the disk itself: warm, strong, and it follows the hole wherever the hole goes.
	const key = new DirectionalLight(new Color("#ffb066"), 4.2); key.position.set(-6, 10, -40); key.target.position.set(CX, 3, CZ);
	const rim = new DirectionalLight(new Color("#9cc0ff"), 2.4); rim.position.set(CX + 26, 20, CZ + 30); rim.target.position.set(CX, 3, CZ);
	const hemi = new HemisphereLight(new Color("#8a7660"), new Color("#1a1d24"), 1.9);
	root.add(key, key.target, rim, rim.target, hemi);
	const engineLight = new PointLight(new Color("#8fb8ff"), 0, 40, 2); engineLight.position.set(CX, 3, Z0 - 4); root.add(engineLight);

	const hull = ownM(new MeshStandardMaterial({ color: new Color("#c4bcb2"), metalness: .5, roughness: .42, map: hullTex, emissive: new Color("#ffb347"), emissiveMap: glowTex, emissiveIntensity: 0, envMap: envTarget.texture, envMapIntensity: 1.25 }));
	const armour = ownM(new MeshStandardMaterial({ color: new Color("#7a746d"), metalness: .62, roughness: .34, map: hullTex, envMap: envTarget.texture, envMapIntensity: 1.4 }));
	const dark = ownM(new MeshStandardMaterial({ color: new Color("#3a3a40"), metalness: .7, roughness: .4, envMap: envTarget.texture }));
	const gold = ownM(new MeshBasicMaterial({ color: new Color("#f2b65a") }));
	const glass = ownM(new MeshPhysicalMaterial({ color: new Color("#1c140e"), roughness: .06, transparent: true, opacity: .45, envMap: envTarget.texture, envMapIntensity: 2, emissive: new Color("#ff9a4a"), emissiveIntensity: .12, side: DoubleSide }));
	const plumeMat = ownM(new MeshBasicMaterial({ color: new Color("#9cc4ff"), alphaMap: plumeTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
	const throatMat = ownM(new MeshBasicMaterial({ color: new Color("#cfe0ff"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));

	const hidden = (o: Object3D) => { o.visible = false; root.add(o); return o; };
	/** A hull plate on a hinge: the pivot sits on the hinge line; the plate hangs from it, with a gold seam. */
	const plate = (w: number, h: number, t: number, at: [number, number, number], offset: [number, number, number], material: Material = hull, seam = true) => {
		const pivot = new Group(); pivot.position.fromArray(at);
		const mesh = new Mesh(own(new BoxGeometry(w, h, t)), material); mesh.position.fromArray(offset);
		pivot.add(mesh);
		if (seam) { const line = new Mesh(own(new BoxGeometry(Math.max(w * .96, .05), .04, Math.max(t + .02, .05))), gold); line.position.set(offset[0], offset[1] + h / 2 - .05, offset[2]); pivot.add(line); }
		return hidden(pivot);
	};

	// --- 04 · Seal the pocket ----------------------------------------------------------------
	const FRONT = 6, RIGHT = 5, ROOF = 6;
	const front = Array.from({ length: FRONT }, (_, i) => {
		const w = W / FRONT;
		const p = plate(w - .03, TOP - FLOOR, .24, [X0 + w * (i + .5), FLOOR, Z1], [0, (TOP - FLOOR) / 2, 0], i === 2 || i === 3 ? glass : hull);
		p.rotation.x = Math.PI / 2;
		return p;
	});
	const right = Array.from({ length: RIGHT }, (_, i) => {
		const d = D / RIGHT;
		const p = plate(.24, TOP - FLOOR, d - .03, [X1, FLOOR, Z0 + d * (i + .5)], [0, (TOP - FLOOR) / 2, 0]);
		p.rotation.z = -Math.PI / 2;
		return p;
	});
	// The room is an L: its front-left corner (where WALL·E's pad was) has no wall and no floor.
	const GAP0 = 3.37, GAP_X1 = 2.02;
	const left = [0, 1].map(i => {
		const d = (Z1 - GAP0) / 2;
		const p = plate(.24, TOP - FLOOR, d - .03, [X0, FLOOR, GAP0 + d * (i + .5)], [0, (TOP - FLOOR) / 2, 0]);
		p.rotation.z = Math.PI / 2;
		return p;
	});
	const belly = plate(GAP_X1 - X0, .24, Z1 - GAP0, [(X0 + GAP_X1) / 2, FLOOR - .12, (GAP0 + Z1) / 2], [0, 0, 0], armour, false);
	belly.userData.z = belly.position.z; belly.position.z = GAP0 - (Z1 - GAP0) / 2;
	const roof = Array.from({ length: ROOF }, (_, i) => {
		const d = D / ROOF;
		const p = plate(W, .22, d + .05, [CX, TOP + .11, Z0 + d * (i + .5)], [0, 0, 0]);
		p.userData.z = p.position.z; p.position.z = Z0 - .2; p.scale.z = .02;
		return p;
	});

	// --- 05 · Hull ----------------------------------------------------------------------------
	// Armour that swings up over the top edges: the box's corners become facets.
	const chamfers = [-1, 1].map(side => {
		const pivot = new Group(); pivot.position.set(side < 0 ? X0 - .14 : X1 + .14, TOP - 1.75, CZ);
		const mesh = new Mesh(own(new BoxGeometry(.22, 2.5, D + .4)), armour); mesh.position.y = 1.25;
		const trim = new Mesh(own(new BoxGeometry(.24, .05, D + .3)), gold); trim.position.y = 2.42;
		pivot.add(mesh, trim); pivot.scale.y = .01;
		pivot.userData.angle = side < 0 ? -.8 : .8;
		return hidden(pivot);
	});
	// Engine pods slide out from under the floor along both sides; the wings will ride on them.
	const pods = [-1, 1].map(side => {
		const g = new Group();
		const x = side < 0 ? X0 - 1.15 : X1 + 1.15;
		g.position.set(x, FLOOR - 3, CZ + .3); g.userData.y = FLOOR + 1.05;
		const body = new Mesh(own(new CylinderGeometry(1.05, 1.05, D + 2.6, 28, 1)), armour); body.rotation.x = Math.PI / 2;
		const intake = new Mesh(own(new TorusGeometry(1.0, .12, 10, 32)), dark); intake.position.z = (D + 2.6) / 2;
		const nozzle = new Mesh(own(new LatheGeometry([new Vector2(.5, 0), new Vector2(.75, .5), new Vector2(.95, 1.1)], 24)), dark); nozzle.rotation.x = -Math.PI / 2; nozzle.position.z = -(D + 2.6) / 2;
		const stripe = new Mesh(own(new BoxGeometry(.06, .06, D + 2)), gold); stripe.position.set(side * -.92, .5, 0);
		g.add(body, intake, nozzle, stripe);
		return hidden(g);
	});
	// The prow: three telescoping sections, each narrower, sliding out of the front wall to a point.
	const prowShape = (w: number, h: number) => { const s = new Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w * .36, h * .82); s.lineTo(w * .2, h); s.lineTo(-w * .2, h); s.lineTo(-w * .36, h * .82); s.closePath(); return s; };
	const prow = [0, 1, 2].map(i => {
		const g = new Group();
		const w = W * (.94 - i * .27), h = (TOP - FLOOR) * (.9 - i * .22), len = 3 - i * .3;
		const body = new Mesh(own(new ExtrudeGeometry(prowShape(w, h), { depth: len, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 1 })), i === 1 ? armour : hull);
		const edge = new Mesh(own(new BoxGeometry(w * .4, .05, .05)), gold); edge.position.set(0, h - .02, len + .08);
		g.add(body, edge);
		g.position.set(CX, FLOOR + i * .3, Z1 - len - .1);
		g.userData.out = Z1 + [.1, 3, 5.7][i]!;
		return hidden(g);
	});
	const emblemMat = ownM(new MeshBasicMaterial({ map: emblemTex, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
	const emblem = new Mesh(own(new PlaneGeometry(2.4, 2.4)), emblemMat);
	emblem.position.set(0, (TOP - FLOOR) * .42, 2.5); emblem.rotation.y = Math.PI;
	prow[2]!.add(emblem);
	// Swept wings, folded up against the pods, swinging down to level.
	const wingShape = new Shape(); wingShape.moveTo(0, -1); wingShape.lineTo(0, 7.6); wingShape.lineTo(6.8, 1.6); wingShape.lineTo(7.2, -.4); wingShape.closePath();
	const wings = [-1, 1].map(side => {
		const pivot = new Group(); pivot.position.set(side < 0 ? X0 - 2.1 : X1 + 2.1, FLOOR + 1.1, Z0 + 1.2);
		const mesh = new Mesh(own(new ExtrudeGeometry(wingShape, { depth: .18, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 1 })), hull);
		mesh.rotation.set(Math.PI / 2, 0, side < 0 ? Math.PI : 0);
		const tip = new Mesh(own(new BoxGeometry(.16, .16, .16)), gold); tip.position.set(side * 7, 0, 1.2);
		pivot.add(mesh, tip);
		pivot.rotation.z = side < 0 ? -Math.PI / 2 : Math.PI / 2;
		return hidden(pivot);
	});
	const finShape = new Shape(); finShape.moveTo(0, 0); finShape.lineTo(6.2, 0); finShape.lineTo(1.4, 3.4); finShape.lineTo(-.2, 3.4); finShape.closePath();
	const fin = new Mesh(own(new ExtrudeGeometry(finShape, { depth: .16, bevelEnabled: false })), armour);
	fin.rotation.y = -Math.PI / 2; fin.position.set(CX - .08, TOP + .2, Z0 + .3); fin.scale.y = .01; hidden(fin);
	const mast = new Group(); mast.position.set(8.5, TOP + .2, 7); mast.scale.y = .01; hidden(mast);
	mast.add(new Mesh(own(new CylinderGeometry(.06, .1, 3.2, 10)), dark).translateY(1.6));
	const beaconMat = ownM(new MeshBasicMaterial({ color: new Color("#ff5a3c") }));
	const beacon = new Mesh(own(new TorusGeometry(.18, .05, 8, 20)), beaconMat); beacon.position.y = 3.25; beacon.rotation.x = Math.PI / 2; mast.add(beacon);
	// Scale: a few hundred small fittings over the roof and sides, one draw call.
	const GREEBLES = 420;
	const greebles = new InstancedMesh(own(new BoxGeometry(1, 1, 1)), dark, GREEBLES);
	greebles.instanceMatrix.setUsage(DynamicDrawUsage);
	{
		const m = new Matrix4(), q = new Quaternion(), p = new Vector3(), s = new Vector3();
		let seed = 3; const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
		for (let i = 0; i < GREEBLES; i++) {
			const onRoof = i < GREEBLES * .7;
			s.set(.12 + random() * .55, .06 + random() * .28, .12 + random() * .9);
			if (onRoof) p.set(X0 + 1.6 + random() * (W - 3.2), TOP + .22 + s.y / 2, Z0 + .6 + random() * (D - 1.2));
			else { const side = random() < .5 ? -1 : 1, depth = .05 + random() * .12; p.set(side < 0 ? X0 - .12 - depth / 2 : X1 + .12 + depth / 2, TOP - .9 + random() * .55, Z0 + .5 + random() * (D - 1)); s.set(depth, .08 + random() * .22, .2 + random() * 1.1); }
			greebles.setMatrixAt(i, m.compose(p, q, s));
		}
	}
	hidden(greebles);

	// --- 06 · Heart: engine bells unfold behind the back wall; the reactor rings spin up between them ---
	const bellProfile = [new Vector2(.45, 0), new Vector2(.7, .35), new Vector2(1.1, 1.2), new Vector2(1.5, 2.3), new Vector2(1.6, 2.5)];
	const engines = [[CX - 3.6, 1.95], [CX + 3.6, 1.95], [CX - 3.6, 4.45], [CX + 3.6, 4.45]].map(([x, y]) => {
		const pivot = new Group(); pivot.position.set(x!, y!, Z0 - .15);
		const bell = new Mesh(own(new LatheGeometry(bellProfile, 32)), dark); bell.rotation.x = -Math.PI / 2;
		const throat = new Mesh(own(new CircleGeometry(.6, 24)), throatMat); throat.position.z = -.4; throat.rotation.y = Math.PI;
		// Wide at the nozzle, narrowing as it burns out; the open tube's top (+y) turns to face the bell.
		const plume = new Mesh(own(new CylinderGeometry(1.15, .3, 9, 24, 1, true)), plumeMat); plume.rotation.x = Math.PI / 2; plume.position.z = -7;
		pivot.add(bell, throat, plume);
		pivot.scale.setScalar(.01);
		return hidden(pivot);
	});
	const reactor = new Group(); reactor.position.set(CX, 3.2, Z0 - .6); hidden(reactor);
	const ringMat = ownM(new MeshBasicMaterial({ color: new Color("#ffb347"), transparent: true, opacity: .95, blending: AdditiveBlending, depthWrite: false }));
	const rings = [1.2, 1.75, 2.3].map((r, i) => { const m = new Mesh(own(new TorusGeometry(r, .06 + i * .02, 8, 72)), ringMat); m.userData.spin = (i % 2 ? -1 : 1) * (1.3 - i * .3); reactor.add(m); return m; });
	const core = new Mesh(own(new BoxGeometry(.75, .75, .75)), ownM(new MeshBasicMaterial({ color: new Color("#ffe1a8") })));
	reactor.add(core); // WALL·E's light at the centre of the rings

	// --- The choreography, protocol by protocol ----------------------------------------------
	const show = (o: Object3D) => () => { o.visible = true; };
	const seal = (tl: gsap.core.Timeline, at: number) => {
		front.forEach((p, i) => tl.call(show(p), [], at + i * .13).to(p.rotation, { x: 0, duration: 1.15, ease: "back.out(1.15)" }, at + i * .13));
		right.forEach((p, i) => tl.call(show(p), [], at + .45 + i * .13).to(p.rotation, { z: 0, duration: 1.15, ease: "back.out(1.15)" }, at + .45 + i * .13));
		left.forEach((p, i) => tl.call(show(p), [], at + .3 + i * .13).to(p.rotation, { z: 0, duration: 1.15, ease: "back.out(1.15)" }, at + .3 + i * .13));
		tl.call(show(belly), [], at).to(belly.position, { z: belly.userData.z as number, duration: 1, ease: "power3.inOut" }, at);
		roof.forEach((p, i) => tl.call(show(p), [], at + 1.5 + i * .2)
			.to(p.position, { z: p.userData.z as number, duration: .9, ease: "power3.inOut" }, at + 1.5 + i * .2)
			.to(p.scale, { z: 1, duration: .6, ease: "power2.out" }, at + 1.5 + i * .2));
		tl.call(show(greebles), [], at + 2.9);
	};
	const shape = (tl: gsap.core.Timeline, at: number) => {
		chamfers.forEach((c, i) => tl.call(show(c), [], at + i * .2)
			.to(c.scale, { y: 1, duration: .5, ease: "power2.out" }, at + i * .2)
			.to(c.rotation, { z: c.userData.angle as number, duration: 1.1, ease: "back.out(1.4)" }, at + .35 + i * .2));
		pods.forEach((g, i) => tl.call(show(g), [], at + .6 + i * .2).to(g.position, { y: g.userData.y as number, duration: 1.3, ease: "power3.out" }, at + .6 + i * .2));
		prow.forEach((g, i) => tl.call(show(g), [], at + 1.2 + i * .35).to(g.position, { z: g.userData.out as number, duration: 1.4, ease: "power3.inOut" }, at + 1.2 + i * .35));
		wings.forEach((p, i) => tl.call(show(p), [], at + 2.4 + i * .25).to(p.rotation, { z: 0, duration: 1.6, ease: "back.out(1.3)" }, at + 2.4 + i * .25));
		tl.call(show(fin), [], at + 3.2).to(fin.scale, { y: 1, duration: 1.1, ease: "back.out(1.6)" }, at + 3.2);
		tl.call(show(mast), [], at + 3.6).to(mast.scale, { y: 1, duration: .9, ease: "power3.out" }, at + 3.6);
		tl.to(hull, { emissiveIntensity: 1.4, duration: 1.2 }, at + 3.8);
	};
	const heart = (tl: gsap.core.Timeline, at: number) => {
		tl.call(show(reactor), [], at);
		rings.forEach((m, i) => tl.from(m.scale, { x: .01, y: .01, z: .01, duration: .8, ease: "back.out(2)" }, at + i * .2));
		engines.forEach((p, i) => tl.call(show(p), [], at + .8 + i * .15).to(p.scale, { x: 1, y: 1, z: 1, duration: 1, ease: "back.out(1.5)" }, at + .8 + i * .15));
	};
	const colours = (tl: gsap.core.Timeline, at: number) => {
		tl.to(emblem.rotation, { y: 0, duration: 1.2, ease: "power3.inOut" }, at).to(emblemMat, { opacity: 1, duration: 1.4 }, at + .3);
	};
	/** The port wing rips loose in the pull and spins away towards the rift. */
	const tearWing = (tl: gsap.core.Timeline, at: number) => {
		const wing = wings[0]!;
		tl.to(wing.rotation, { x: -1.4, z: -2.4, duration: 2.6, ease: "power2.in" }, at)
			.to(wing.position, { y: wing.position.y + 7, z: Z0 - 18, x: X0 - 8, duration: 2.6, ease: "power3.in" }, at)
			.to(wing.scale, { x: .15, y: .15, z: .15, duration: 2.6, ease: "power4.in" }, at)
			.call(() => { wing.visible = false; }, [], at + 2.6);
	};
	const thrust = (level: number) => { plumeMat.opacity = level * .8; throatMat.opacity = level; engineLight.intensity = level * 90; };
	const toHole = new Vector3();

	let beaconTime = 0;
	return {
		root, seal, shape, heart, colours, tearWing, thrust, env: envTarget.texture,
		/** Light the hull from wherever the hole is, given its position in the model's frame. */
		lightFrom(hole: Vector3, strength = 1) {
			toHole.copy(hole).sub(key.target.position).normalize();
			key.position.copy(key.target.position).addScaledVector(toHole, 40);
			key.intensity = 4.2 * strength;
		},
		update(dt: number) {
			for (const m of rings) m.rotation.z += (m.userData.spin as number) * dt * (1 + plumeMat.opacity * 4);
			beaconTime += dt; beaconMat.color.setHex(Math.sin(beaconTime * 3) > .6 ? 0xff5a3c : 0x3a120c);
		},
		dispose() {
			root.removeFromParent();
			geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
			envTarget.dispose(); greebles.dispose();
		},
	};
}
