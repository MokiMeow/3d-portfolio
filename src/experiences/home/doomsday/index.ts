import gsap from "gsap";
import { Group, Object3D, PerspectiveCamera, Vector2, Vector3, type WebGLRenderer } from "three";
import { events as quickEvents } from "quick-threejs/lib/static";
import { BlackHole, BLACK_HOLE_QUALITY } from "./blackhole";
import { Rift } from "./rift";
import { Overlay } from "./overlay";
import { rigRoom } from "./room";
import { createShip } from "./ship";
import { createHologram } from "./hologram";
import { Hyperspace, Wormhole } from "./hyperspace";
import { createReveal } from "./reveal";
import { createSound } from "./sound";
import { Scene } from "three";

/**
 * THE POCKET — a Doomsday prelude. The director: it takes the camera, builds the rift and the hole
 * into the room's own scene, runs the acts on one timeline, and gives everything back afterwards.
 */
export type DoomsdayContext = {
	// quick-threejs's event keys are its own constants, not plain strings.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	app: { on(event: any, fn: () => void): unknown; off(event: any, fn: () => void): unknown };
	renderer: WebGLRenderer;
	camera: PerspectiveCamera;
	modelScene: Object3D;
	navigation?: { view: { enabled: boolean } };
	/** The room's lights: 0 lit, 1 dark. */
	night: { value: number };
	/** Small things in the room that can be torn away first (notes, desk toys). */
	loose: Object3D[];
	companion?: { say(text: string): void; position?: Vector3 } | undefined;
	onEnd?: () => void;
};

let running: { stop(): void } | null = null;

export function isDoomsdayRunning() { return !!running; }

export async function startDoomsday(ctx: DoomsdayContext) {
	if (running) return;
	const { renderer, camera, modelScene } = ctx;
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const size = renderer.getDrawingBufferSize(new Vector2());

	// --- Quality: a quick look at how fast this device is -------------------------------------
	const probe = await new Promise<number>(resolve => {
		let frames = 0; const t0 = performance.now();
		const tick = () => { frames++; if (performance.now() - t0 < 400) requestAnimationFrame(tick); else resolve((performance.now() - t0) / frames); };
		requestAnimationFrame(tick);
	});
	const tier = probe < 11 ? "high" : probe < 20 ? "medium" : "low";

	// --- The cast --------------------------------------------------------------------------------
	const hole = new BlackHole(size.x, size.y);
	hole.setQuality(BLACK_HOLE_QUALITY[tier], size.x, size.y);
	hole.uniforms.uCenter.value.copy(modelScene.localToWorld(new Vector3(1, 9, -95)));
	hole.uniforms.uScale.value = 3.1 * modelScene.getWorldScale(new Vector3()).x;
	hole.uniforms.uGain.value = 0;
	const rift = new Rift(hole.target.texture);
	rift.setViewport(size.x, size.y);
	rift.mesh.position.set(1.2, 7.5, -15);
	modelScene.add(rift.mesh);
	const rig = rigRoom(modelScene);
	rig.carry(modelScene.getObjectByName("monitor_a_screen"), "monitor_a");
	rig.carry(modelScene.getObjectByName("monitor_b._screen") ?? modelScene.getObjectByName("monitor_b_screen"), "monitor_b");
	rig.carry(modelScene.getObjectByName("window_glasses"), "back_wall");
	rig.carry(modelScene.getObjectByName("chair_top"), "chair_base");
	const ship = createShip(renderer, modelScene);
	const hologram = createHologram(modelScene);
	// The sound starts in the click that launched this, so the browser lets it play.
	const sound = createSound();
	// The fold ahead of the ship, and the jump through it.
	const fold = new Wormhole(reduced); fold.mesh.position.set(3, 5, 74); fold.mesh.scale.setScalar(20); modelScene.add(fold.mesh);
	const jump = new Hyperspace(size.x, size.y, reduced); modelScene.add(jump.mesh);
	const reveal = createReveal(modelScene, ship.env);
	// The whole world, for the moment the pocket's void shatters and the far universe surrounds us.
	let world: Object3D = modelScene; while (world.parent) world = world.parent;
	const backgroundWas = (world as Scene).background ?? null;
	const ground = ["scene_1_floor", "scene_container"].map(name => world.getObjectByName(name)).filter((o): o is Object3D => !!o);

	// --- The camera is the director's for the duration --------------------------------------
	const navigation = ctx.navigation;
	const navigationWas = navigation?.view.enabled ?? true;
	if (navigation) navigation.view.enabled = false;
	const startPosition = camera.position.clone(), startQuaternion = camera.quaternion.clone(), startFov = camera.fov;
	const shot = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, shake: 0, fov: startFov };
	const look = modelScene.worldToLocal(camera.position.clone().add(camera.getWorldDirection(new Vector3()).multiplyScalar(30)));
	const from = modelScene.worldToLocal(camera.position.clone());
	Object.assign(shot, { x: from.x, y: from.y, z: from.z, lx: look.x, ly: look.y, lz: look.z });
	const aim = new Vector3(), at = new Vector3();
	const applyShot = (time: number) => {
		const s = (shot.shake + jump.shake * 1.8) * (reduced ? 0 : 1);
		camera.position.copy(modelScene.localToWorld(aim.set(shot.x + Math.sin(time * 37) * s * .06, shot.y + Math.sin(time * 41 + 1) * s * .06, shot.z)));
		camera.lookAt(modelScene.localToWorld(at.set(shot.lx, shot.ly, shot.lz)));
		if (camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
	};

	// --- Every frame: the hole renders first, then the room draws with the rift in it ----------
	const clock = { time: 0, last: performance.now() };
	const holeLocal = new Vector3(), foldCentre = new Vector3(), keyLight = { level: 1 };
	let heard = -1;
	const frame = () => {
		const now = performance.now();
		clock.time += Math.min(.05, (now - clock.last) / 1000); clock.last = now;
		applyShot(clock.time);
		rift.uniforms.uTime.value = clock.time;
		if (hole.uniforms.uGain.value > .001) hole.render(renderer, camera, clock.time);
		ship.lightFrom(modelScene.worldToLocal(holeLocal.copy(hole.uniforms.uCenter.value)), (.35 + hole.uniforms.uGain.value * .65) * keyLight.level);
		ship.update(1 / 60); hologram.update(clock.time); reveal.update();
		fold.update(camera, clock.time); jump.update(clock.time);
		if (jump.mesh.visible) { fold.mesh.getWorldPosition(foldCentre).project(camera); jump.uniforms.center.value.set(foldCentre.x, foldCentre.y); }
		// The hole's roar follows how much of it there is, in coarse steps so the audio graph isn't rescheduled every frame.
		const roar = Math.round(hole.uniforms.uGain.value * 20) / 20;
		if (roar !== heard) { heard = roar; sound.hole(roar); }
	};
	ctx.app.on(quickEvents.PRE_UPDATED, frame);

	// --- The overlay and the way out -----------------------------------------------------------
	let finished = false;
	const overlay = new Overlay(() => { void finish(true); });
	overlay.sound(sound.muted, () => (sound.muted = !sound.muted));
	const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); void finish(true); } };
	window.addEventListener("keydown", onKey, true);

	// Things that will be torn away: remember where they belong.
	const loose = ctx.loose.filter(object => object.parent);
	const homes = loose.map(object => ({ object, parent: object.parent!, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), visible: object.visible }));
	const debris = new Group(); debris.name = "doomsday_debris"; modelScene.add(debris);
	const steam = modelScene.getObjectByName("coffee_steam");
	const steamRotation = steam?.rotation.clone();
	const nightWas = ctx.night.value;

	/** Pull an object out of the room and into the rift: it accelerates, spins, stretches and is gone. */
	const fallIn = (tl: gsap.core.Timeline, object: Object3D, start: number, duration = 2.6) => {
		tl.call(() => { debris.attach(object); }, [], start);
		const p0 = new Vector3(), p1 = new Vector3(), spin = new Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
		const state = { p: 0 };
		const scale0 = new Vector3();
		tl.to(state, {
			p: 1, duration, ease: "power3.in",
			onStart: () => { p0.copy(object.position); p1.set(1.2 + (Math.random() - .5) * 4, 7.5 + (Math.random() - .5) * 3, -15.5); scale0.copy(object.scale); },
			onUpdate: () => {
				const p = state.p;
				// A curving path that swings out sideways before it is pulled straight in.
				object.position.lerpVectors(p0, p1, p);
				object.position.x += Math.sin(p * Math.PI) * 1.4 * (p0.x > p1.x ? 1 : -1);
				object.position.y += Math.sin(p * Math.PI) * 1.2;
				object.rotation.x += spin.x * .016 * (1 + p * 6); object.rotation.y += spin.y * .016 * (1 + p * 6); object.rotation.z += spin.z * .016 * (1 + p * 6);
				const shrink = 1 - Math.pow(p, 4);
				object.scale.set(scale0.x * shrink, scale0.y * shrink * (1 + p * 2.2), scale0.z * shrink);
			},
			onComplete: () => { object.visible = false; },
		}, start);
	};

	const walle = ctx.companion?.position;
	const walleFrom = walle?.clone();
	// --- The timeline: Act I, The Knock; Act II, The Maw --------------------------------------
	const tl = gsap.timeline({ paused: true });
	const T = (s: number) => s;
	tl.call(() => overlay.letterbox(true), [], 0);
	// The lights dip with each knock, and the room holds its breath.
	for (const k of [2.6, 3.3, 4.0]) {
		tl.to(ctx.night, { value: Math.min(1, nightWas + .55), duration: .08, ease: "power2.out" }, k)
			.to(ctx.night, { value: nightWas, duration: .5, ease: "power2.in" }, k + .1)
			.to(shot, { shake: 1.2, duration: .05 }, k).to(shot, { shake: 0, duration: .5 }, k + .06)
			.call(() => sound.knock(), [], k);
	}
	// Back out of the room into the void; the fracture draws itself across nothing.
	tl.to(shot, { x: 8, y: 12.5, z: 31, lx: .8, ly: 5.8, lz: -9, duration: reduced ? 4 : 8, ease: "power2.inOut" }, T(4.6));
	tl.to(rift.uniforms.uCrack, { value: 1, duration: 6, ease: "power1.inOut", onUpdate() { sound.crack(this.progress()); } }, T(5.6));
	tl.call(() => overlay.say("jarvis", "Sir. Something is knocking on the outside of reality.", 3), [], T(7));
	// The tear opens. The far universe shows through; the hole within it wakes.
	tl.to(rift.uniforms.uOpen, { value: .38, duration: 3.4, ease: "expo.out" }, T(11.6));
	tl.call(() => sound.tear(), [], T(11.6));
	tl.to(shot, { shake: 1.6, duration: .1 }, T(11.6)).to(shot, { shake: .25, duration: 2.5 }, T(11.8));
	tl.to(hole.uniforms.uGain, { value: 1, duration: 3, ease: "power2.out" }, T(11.8));
	tl.call(() => overlay.say("jarvis", "That isn't a crack, sir. It's a door. And it is being opened from the other side.", 3.4), [], T(12.6));
	tl.to(rift.uniforms.uOpen, { value: .62, duration: 8, ease: "sine.inOut" }, T(16));
	tl.to(shot, { x: 5.5, y: 9.5, z: 24, lx: 1, ly: 6.8, lz: -12, duration: 12, ease: "sine.inOut" }, T(15.5));
	// The pull: the steam bends, then the small things go.
	const strain = { level: 0 };
	const strainTo = (level: number, at: number, duration = 2) => tl.to(strain, { level, duration, onUpdate: () => sound.strain(strain.level) }, at);
	strainTo(.35, T(19));
	if (steam && steamRotation) tl.to(steam.rotation, { z: steamRotation.z + .9, x: steamRotation.x - .5, duration: 3, ease: "power2.inOut" }, T(19));
	loose.forEach((object, i) => fallIn(tl, object, T(20 + i * .55), 2.4 + Math.random()));
	tl.call(() => { overlay.protocol("Pocket integrity", "Gravitational shear 40%", true); overlay.setAlarm(true); sound.alarm(true); }, [], T(24));
	strainTo(.75, T(24), 1);
	tl.to(ctx.night, { value: 1, duration: .6 }, T(24));
	tl.to(shot, { shake: .5, duration: 1 }, T(24));
	// For one moment the burning edge holds a shape. Most people will doubt they saw it.
	tl.to(rift.uniforms.uPresence, { value: 1, duration: .12 }, T(29)).to(rift.uniforms.uPresence, { value: 0, duration: .5 }, T(29.15));
	tl.call(() => overlay.say("doom", "This pocket is forfeit.", 2.6), [], T(29.4));
	tl.call(() => overlay.say("jarvis", "The pocket won't hold. Initiating Lifeboat protocol. Running is not cowardice, sir, when the alternative is ceasing to exist.", 4.2), [], T(34));
	tl.call(() => { overlay.protocol("Lifeboat protocol", "Authorised"); overlay.setAlarm(false); sound.alarm(false); }, [], T(36));
	strainTo(.3, T(36), 3);

	// --- Act III: Lifeboat protocol -----------------------------------------------------------
	const p = rig.pivots;
	// Into the room, close: the desk, the monitors, the chair.
	tl.to(shot, { x: 3.2, y: 4.6, z: 7.5, lx: -1.2, ly: 2.2, lz: -.8, duration: 3.4, ease: "power2.inOut" }, T(38.5));
	tl.call(() => overlay.protocol("Protocol 01", "Batten down"), [], T(40));
	tl.to(p.monitor_a.rotation, { z: -1.35, duration: 1.1, ease: "power3.inOut" }, T(40.4));
	for (const [at, d, pitch] of [[40.4, 1.1, .55], [40.7, 1.1, .6], [41.2, 1.6, .35]] as const) tl.call(() => sound.servo(d, pitch), [], T(at));
	tl.call(() => sound.latch(), [], T(41.6));
	tl.to(p.monitor_b.rotation, { x: -1.35, duration: 1.1, ease: "power3.inOut" }, T(40.7));
	tl.to(p.chair_base.rotation, { y: Math.PI * .92, duration: 1.6, ease: "back.out(1.4)" }, T(41.2));
	// WALL·E leaves his pad and drives in under the desk; the pad is torn away behind him.
	tl.call(() => overlay.protocol("Protocol 02", "Crew to stations"), [], T(44));
	tl.call(() => overlay.say("jarvis", "WALL·E, to the core, if you'd be so kind.", 2.4), [], T(44.2));
	if (walle) tl.to(walle, { x: -.8, z: .6, duration: 3.2, ease: "power2.inOut" }, T(44.6)).call(() => sound.servo(3.2, .8), [], T(44.6));
	const pad = modelScene.getObjectByName("exterior_service_bay");
	if (pad) fallIn(tl, pad, T(46.8), 3);
	// The watch wakes: the ship's interface rises above the desk.
	tl.call(() => overlay.protocol("Protocol 03", "Watch online"), [], T(49));
	tl.call(() => { hologram.open(); sound.servo(.8, 1); }, [], T(49.2));
	tl.call(() => overlay.readouts([["HULL", "100%"], ["HORIZON", "1.2 KM"], ["HEADING", "AWAY"]]), [], T(50));
	// Seal the pocket: we watch from outside as the open sides close and the lid slides shut.
	tl.to(shot, { x: 26, y: 12, z: 27, lx: 3, ly: 3.2, lz: 2.2, duration: 3, ease: "power2.inOut" }, T(51.6));
	tl.call(() => { overlay.protocol("Protocol 04", "Seal the pocket"); hologram.close(); }, [], T(53));
	tl.call(() => overlay.say("jarvis", "Sealing the open walls. Apologies to the décor.", 2.4), [], T(53.3));
	ship.seal(tl, T(53.4));
	for (let i = 0; i < 4; i++) tl.call(() => sound.latch(), [], T(54.4 + i * .45));
	tl.call(() => sound.seal(), [], T(56.4));
	strainTo(.9, T(55), 5);
	// The tear spreads until the void itself shatters: the far universe is all around us now.
	tl.to(rift.uniforms.uOpen, { value: 2.6, duration: 6, ease: "power2.in" }, T(55));
	tl.to(shot, { shake: .9, duration: 1 }, T(58));
	tl.call(() => { (world as Scene).background = hole.target.texture; ground.forEach(o => { o.visible = false; }); rift.mesh.visible = false; }, [], T(60.6));
	// The hull: prow, wings, fin, mast; the back wall leans into the spine.
	tl.call(() => overlay.protocol("Protocol 05", "Hull"), [], T(58));
	ship.shape(tl, T(58.2));
	for (const at of [58.6, 59.6, 60.8, 62]) tl.call(() => sound.servo(1.2, .3 + Math.random() * .3), [], T(at));
	strainTo(.5, T(61), 3);
	tl.to(p.back_wall.rotation, { x: -.1, duration: 2, ease: "power2.inOut" }, T(59));
	tl.to(shot, { x: 30, y: 8, z: -2, lx: 3, ly: 3, lz: 2, duration: 7, ease: "sine.inOut" }, T(58.6));
	ship.tearWing(tl, T(63.4));
	tl.call(() => overlay.readouts([["HULL", "71%"], ["HORIZON", "0.6 KM"], ["HEADING", "AWAY"]]), [], T(64));
	// The heart: the reactor rings and the engines, around WALL·E's light.
	tl.call(() => overlay.protocol("Protocol 06", "Heart"), [], T(67));
	tl.call(() => overlay.say("jarvis", "The record player, sir, is about to become a reactor. Please don't ask.", 3), [], T(67.2));
	tl.to(shot, { x: 9, y: 9, z: -24, lx: 2.5, ly: 3, lz: -2, duration: 4.5, ease: "power2.inOut" }, T(66));
	ship.heart(tl, T(67.6));
	const core = { level: 0 };
	tl.to(core, { level: 1, duration: 3, onUpdate: () => sound.reactor(core.level) }, T(67.6));
	// The colours: the prow's last plate turns over.
	tl.call(() => overlay.protocol("Protocol 07", "Colours"), [], T(72));
	tl.to(shot, { x: 4, y: 4.2, z: 24, lx: 2.8, ly: 2.6, lz: 10, duration: 2.6, ease: "power2.inOut" }, T(70.8));
	ship.colours(tl, T(72.6));

	// --- Act IV: The Fold ------------------------------------------------------------------------
	tl.call(() => { overlay.clearProtocol(); overlay.say("jarvis", "We can't outrun it, sir. So we won't. We'll go around it.", 3.2); }, [], T(75.4));
	tl.to(shot, { x: 6, y: 6, z: 34, lx: 2.6, ly: 3.5, lz: -30, fov: startFov * 1.05, duration: 3, ease: "power2.inOut" }, T(74.8));
	const thrust = { level: 0 };
	tl.call(() => sound.ignite(), [], T(76));
	tl.to(thrust, { level: 1, duration: 1.4, ease: "power2.in", onUpdate: () => { ship.thrust(thrust.level); sound.engine(thrust.level); } }, T(76));
	strainTo(1, T(78), 3);
	// The hole gains on us: it grows behind the ship as we slide back towards it.
	tl.to(hole.uniforms.uCenter.value, { z: modelScene.localToWorld(new Vector3(0, 0, -42)).z, y: modelScene.localToWorld(new Vector3(0, 6, 0)).y, duration: 5, ease: "power2.in" }, T(77));
	tl.to(shot, { shake: 1.4, duration: 2 }, T(78));
	tl.call(() => overlay.readouts([["HULL", "38%"], ["HORIZON", "0.09 KM"], ["HEADING", "INBOUND"]]), [], T(79));
	// The slingshot: we stop fighting and dive around the photon sphere. The hole swings past us.
	const orbit = { a: 0 };
	const centre0 = new Vector3();
	tl.call(() => { centre0.copy(modelScene.worldToLocal(hole.uniforms.uCenter.value.clone())); }, [], T(82));
	tl.to(orbit, {
		a: Math.PI * .95, duration: 6, ease: "sine.inOut",
		onUpdate: () => {
			const r = 30 - Math.sin(orbit.a) * 6;
			hole.uniforms.uCenter.value.copy(modelScene.localToWorld(new Vector3(2.6 + Math.sin(orbit.a) * r, 6 - Math.sin(orbit.a) * 4, -Math.cos(orbit.a) * r)));
			hole.tilt(.12 + Math.sin(orbit.a) * .5, -.35 + orbit.a * .5);
		},
	}, T(82));
	tl.to(shot, { x: -22, y: 10, z: 2, lx: 3, ly: 3, lz: 2, fov: startFov * 1.18, duration: 6, ease: "sine.inOut" }, T(82));
	tl.call(() => { overlay.readouts([["HULL", "9%"], ["HORIZON", "PERIAPSIS"], ["HEADING", "SLINGSHOT"]]); sound.stretch(true); }, [], T(84));
	// Ahead, the fold opens: another sky, rim first.
	tl.to(fold.uniforms.open, { value: 1, duration: 4, ease: "power2.out" }, T(84.5));
	tl.call(() => overlay.say("jarvis", "Hold on to something. Preferably something bolted down.", 2.6), [], T(87));
	// The fold ahead, and the jump: a white wash (one fade, never a strobe), then silence.
	tl.to(shot, { x: 3, y: 8.5, z: -14, lx: 3, ly: 3.4, lz: 60, fov: startFov * 1.3, duration: 3, ease: "power3.in" }, T(88));
	tl.call(() => { overlay.readouts(null); sound.stretch(false); sound.hyperspace(); }, [], T(88.6));
	tl.to(jump.uniforms.progress, { value: 1, duration: 3.3, ease: "power2.in" }, T(88.6));
	tl.call(() => { overlay.fade(1, .01); jump.uniforms.progress.value = 0; fold.uniforms.open.value = 0; sound.engine(0); sound.reactor(0); sound.strain(0); sound.silence(1.2); }, [], T(92));

	// --- Act V: Already Here ---------------------------------------------------------------------
	tl.call(() => {
		// Quiet space. The hole is far away now; the ship drifts, scorched, one wing gone.
		ship.thrust(0);
		hole.uniforms.uCenter.value.copy(modelScene.localToWorld(new Vector3(-260, 40, -900)));
		hole.tilt(.4, 1.2); hole.uniforms.uGain.value = .7;
		Object.assign(shot, { x: 16, y: 7, z: 26, lx: 2.6, ly: 3, lz: 2, shake: 0, fov: startFov });
	}, [], T(93));
	tl.call(() => overlay.fade(0, 2.4), [], T(94.2));
	tl.call(() => overlay.say("jarvis", "We made it, sir. We actually made—", 2.6), [], T(96));
	tl.call(() => overlay.protocol("Arrival complete", "Occupancy mismatch", true), [], T(98.6));
	// The stars go out ahead: something vast is in front of them. Green light rises.
	tl.to(hole.uniforms.uGain, { value: 0, duration: 3.2, ease: "power2.in" }, T(99.5));
	// He was there all along. The hand comes up under the ship and takes it; the eyes light last.
	reveal.arrive(tl, T(93));
	reveal.take(tl, T(97.4));
	tl.to(shot, { shake: .9, duration: .08 }, T(98.3)).to(shot, { shake: 0, duration: 1.4 }, T(98.4));
	// Far back and low: the ship small in the palm, and above it, where the stars were, a face.
	// A hard cut, then the slowest push-in of the film.
	tl.call(() => { Object.assign(shot, { x: 9, y: -3, z: -98, lx: 2, ly: 16, lz: 40, fov: startFov * .94 }); }, [], T(100.6));
	tl.to(shot, { x: 6, y: 0, z: -80, ly: 18, fov: startFov, duration: 7, ease: "sine.out" }, T(100.62));
	tl.to(keyLight, { level: .12, duration: 3 }, T(99.5));
	reveal.look(tl, T(102.4));
	tl.call(() => sound.sting(), [], T(102.6));
	tl.call(() => overlay.say("doom", "I permitted the door. I did not promise an exit.", 3.4), [], T(103.5));
	tl.call(() => { overlay.clearProtocol(); overlay.fade(1, .25); }, [], T(107.5));
	// Black, then his mark alone.
	tl.call(() => { reveal.mark(camera); overlay.fade(0, 1.4); }, [], T(108.2));
	tl.call(() => {
		const end = overlay.showEnd(`<h2>You escaped the pocket.<br>Not him.</h2><p>Doom is already here</p><small>Avengers: Doomsday · 18 December 2026 · a fan homage, not affiliated with Marvel</small><button type="button">Return to the pocket</button>`);
		end.querySelector("button")?.addEventListener("click", () => { void finish(true); });
		reveal.settle();
	}, [], T(111.2));
	tl.call(() => { void finish(false); }, [], T(126));


	// The timeline follows the scene's own clock, so it pauses with the tab.
	const drive = () => { if (!finished) tl.seek(clock.time, false); };
	ctx.app.on(quickEvents.PRE_UPDATED, drive);

	async function finish(skipped: boolean) {
		if (finished) return; finished = true;
		overlay.clearCaption(); overlay.clearProtocol(); overlay.setAlarm(false); overlay.hideEnd();
		overlay.fade(1, skipped ? .45 : 1.4);
		await new Promise(resolve => window.setTimeout(resolve, skipped ? 500 : 1500));
		// Everything back where it was.
		tl.kill();
		ctx.app.off(quickEvents.PRE_UPDATED, frame); ctx.app.off(quickEvents.PRE_UPDATED, drive);
		for (const home of homes) {
			home.parent.attach(home.object);
			home.object.position.copy(home.position); home.object.quaternion.copy(home.quaternion); home.object.scale.copy(home.scale); home.object.visible = home.visible;
		}
		debris.removeFromParent();
		if (steam && steamRotation) steam.rotation.copy(steamRotation);
		ctx.night.value = nightWas;
		rig.restore();
		rift.mesh.removeFromParent(); rift.dispose(); hole.dispose();
		ship.dispose(); hologram.dispose(); reveal.dispose(); fold.dispose(); jump.dispose(); sound.dispose();
		(world as Scene).background = backgroundWas; ground.forEach(o => { o.visible = true; });
		if (walle && walleFrom) walle.copy(walleFrom);
		camera.position.copy(startPosition); camera.quaternion.copy(startQuaternion); camera.fov = startFov; camera.updateProjectionMatrix();
		if (navigation) navigation.view.enabled = navigationWas;
		window.removeEventListener("keydown", onKey, true);
		overlay.letterbox(false);
		overlay.fade(0, 1.2);
		window.setTimeout(() => overlay.dispose(), 1400);
		running = null;
		ctx.onEnd?.();
	}

	running = { stop: () => { void finish(true); } };
	if (import.meta.dev) (window as unknown as { __doomsday?: unknown }).__doomsday = { seek: (s: number) => { clock.time = s; }, timeline: tl, rift, hole, shot };
}
