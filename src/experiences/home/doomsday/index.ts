import gsap from "gsap";
import { Box3, Color, Group, Matrix4, Mesh, Object3D, PerspectiveCamera, Quaternion, Vector2, Vector3, type WebGLRenderer } from "three";
import { events as quickEvents } from "quick-threejs/lib/static";
import { BlackHole, BLACK_HOLE_QUALITY } from "./blackhole";
import { Overlay } from "./overlay";
import { rigRoom } from "./room";
import { createHologram, WATCH_SPOT, WATCH_TURN } from "./hologram";
import { createPortal, createStreaks, createTunnel } from "./warp";
import { createReveal } from "./reveal";
import { createSound } from "./sound";
import { createLifeboat } from "./lifeboat";
import { createPocket, IMPACT } from "./pocket";
import { FallingObject, type Hole } from "./infall";
import { createHeart } from "./heart";
import { createFilmWalle } from "./walle";
import { dockTrackPose } from "~/utils/room-mechanics";
import { takeScreens } from "./screens";
import { createGovernor } from "./perf";
import { filmLights } from "./lights";
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
	/** The room's own soundtrack (the lo-fi, the hum): held silent for the film, given back after. */
	music?: { hold(on: boolean): void };
	/** The room's render quality: a scale on its pixel ratio, and its live portal (the PC screen) on or off. */
	render?: { scale(scale: number): void; portals(on: boolean): void };
	companion?: { say(text: string): void; position?: Vector3; puppet?(on: boolean): void; carriage?: Object3D; robot?: Object3D } | undefined;
	onEnd?: () => void;
};

let running: { stop(): void } | null = null;

/** A Vector3 as plain x/y/z, for tweening another Vector3 towards it. */
const vec = (v: Vector3) => ({ x: v.x, y: v.y, z: v.z });

export function isDoomsdayRunning() { return !!running; }

export async function startDoomsday(ctx: DoomsdayContext) {
	if (running) return;
	// Claimed at once (a second click while loading does nothing), and the frame goes cinematic at once.
	let finished = false, ready = false, skipRequested = false;
	running = { stop: () => { void finish(true); } };
	const overlay = new Overlay(() => { void finish(true); });
	overlay.letterbox(true);
	const t0 = performance.now(); const mark = (label: string) => { if (import.meta.dev) console.log(`[doomsday] ${label} ${((performance.now() - t0) / 1000).toFixed(2)}s`); };
	const { renderer, camera, modelScene } = ctx;
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const size = renderer.getDrawingBufferSize(new Vector2());
	// Everything that exists before the film; whatever is added after belongs to it (see the warm-up below).
	const before = new Set<Object3D>();
	{ let w: Object3D = modelScene; while (w.parent) w = w.parent; w.traverse(o => before.add(o)); }

	// --- Quality: start high; the frame governor (perf.ts) steps down within a second on a slow device ---------
	const tier = "high" as const;

	// --- The cast --------------------------------------------------------------------------------
	// The hole is soft light and glare: it is traced against CSS pixels, never the device's 2x buffer.
	const css = renderer.getSize(new Vector2());
	const hole = new BlackHole(css.x, css.y);
	hole.setQuality(BLACK_HOLE_QUALITY[tier], css.x, css.y);
	// Where it comes to rest: behind the pocket's back wall, a little high, close enough to fill the sky.
	// Gargantua's lesson: weight comes from scale. The hole is enormous (M = 18, a shadow ~190 m across) and far
	// behind the pocket, so the cube stands small against it; the debris falls a long way to reach it.
	const HOLE_REST = new Vector3(0, 40, -420), HOLE_FAR = new Vector3(-2400, 900, -18000), M = 18;
	const worldScale = modelScene.getWorldScale(new Vector3()).x;
	hole.uniforms.uCenter.value.copy(modelScene.localToWorld(HOLE_FAR.clone()));
	hole.uniforms.uScale.value = M * worldScale;
	hole.uniforms.uGain.value = 0;
	// Until the void takes over, the hole's sky is the page's own grey, so the pull-back is seamless.
	const clear = renderer.getClearColor(new Color());
	hole.uniforms.uBackdrop.value.set(clear.r, clear.g, clear.b);
	hole.uniforms.uVoid.value = 0;
	hole.tilt(.12, -.35);
	const holeAxis = new Vector3(0, 1, 0).applyMatrix4(new Matrix4().makeRotationY(-.35).multiply(new Matrix4().makeRotationX(.12)));
	const holeModel: Hole = { centre: HOLE_REST.clone(), horizon: 2 * M, gm: 1.6e6, axis: holeAxis };
	// The pocket: the container, replaced by its fractured twin (loaded before anything moves).
	const containerMesh = modelScene.parent?.getObjectByName("scene_container") ?? (() => { let w: Object3D = modelScene; while (w.parent) w = w.parent; return w.getObjectByName("scene_container"); })();
	if (!(containerMesh instanceof Mesh)) throw new Error("[doomsday] the pocket's container is missing");
	// Everything is fetched at once (and usually already sitting in the cache: see preload.ts).
	const lights = filmLights(modelScene);
	const [pocket, boat, walleFilm] = await Promise.all([
		createPocket(modelScene, containerMesh, holeModel, hole.target.texture).finally(() => mark("pocket")),
		createLifeboat(modelScene, renderer, lights).finally(() => mark("lifeboat")),
		// The film's WALL·E (the boxable rebuild); without it, the sequence keeps him as he is.
		createFilmWalle().catch(error => { console.warn("[doomsday] walle", error); return null; }).finally(() => mark("walle")),
	]);
	mark("assets");
	pocket.setViewport(size.x, size.y);
	const hologram = createHologram(modelScene, boat.env);
	// Parked hidden in the scene from the start, so the warm-up compiles its materials.
	if (walleFilm) { modelScene.add(walleFilm.root); walleFilm.root.visible = false; }
	// The room loads the container more than once (one per scene); all of them give way to the pocket.
	const containers: { object: Object3D; visible: boolean }[] = [];
	{ let w: Object3D = modelScene; while (w.parent) w = w.parent; w.traverse(o => { if (o.name === "scene_container") containers.push({ object: o, visible: o.visible }); }); }
	containers.forEach(c => { c.object.visible = false; });
	const rig = rigRoom(modelScene); mark("rig");
	// Each monitor's screen and its glass travel with it.
	for (const name of ["monitor_a_screen", "monitor_a_screen_gloss_glass"]) rig.carry(modelScene.getObjectByName(name), "monitor_a");
	for (const name of ["monitor_b._screen", "monitor_b_screen", "monitor_b_screen_gloss_glass"]) rig.carry(modelScene.getObjectByName(name), "monitor_b");
	rig.carry(modelScene.getObjectByName("scene_1_phone_screen"), "phone");
	rig.carry(modelScene.getObjectByName("window_glasses"), "back_wall");
	rig.carry(modelScene.getObjectByName("chair_top"), "chair_base");
	ctx.music?.hold(true);
	// The sound starts in the click that launched this, so the browser lets it play.
	const sound = createSound();
	const reveal = createReveal(modelScene, boat.env, lights);
	// The whole world, for the moment the pocket's void shatters and the far universe surrounds us.
	let world: Object3D = modelScene; while (world.parent) world = world.parent;
	const backgroundWas = (world as Scene).background ?? null;
	const ground = ["scene_1_floor"].map(name => world.getObjectByName(name)).filter((o): o is Object3D => !!o);
	(world as Scene).background = hole.target.texture;

	// --- The camera is the director's for the duration --------------------------------------
	const navigation = ctx.navigation;
	const navigationWas = navigation?.view.enabled ?? true;
	if (navigation) navigation.view.enabled = false;
	const startPosition = camera.position.clone(), startQuaternion = camera.quaternion.clone(), startFov = camera.fov;
	const sceneHome = { position: modelScene.position.clone(), quaternion: modelScene.quaternion.clone() };
	const shot = { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, shake: 0, fov: startFov };
	const look = modelScene.worldToLocal(camera.position.clone().add(camera.getWorldDirection(new Vector3()).multiplyScalar(30)));
	const from = modelScene.worldToLocal(camera.position.clone());
	Object.assign(shot, { x: from.x, y: from.y, z: from.z, lx: look.x, ly: look.y, lz: look.z });
	const aim = new Vector3(), at = new Vector3();
	const worldCamera = { on: false, position: new Vector3(), target: new Vector3() };
	const cameraLocal = new Vector3();
	const applyShot = (time: number) => {
		if (worldCamera.on) {
			modelScene.worldToLocal(cameraLocal.copy(worldCamera.position)); shot.x = cameraLocal.x; shot.y = cameraLocal.y; shot.z = cameraLocal.z;
			modelScene.worldToLocal(cameraLocal.copy(worldCamera.target)); shot.lx = cameraLocal.x; shot.ly = cameraLocal.y; shot.lz = cameraLocal.z;
		}
		const s = shot.shake * (reduced ? 0 : 1);
		camera.position.copy(modelScene.localToWorld(aim.set(shot.x + Math.sin(time * 37) * s * .06, shot.y + Math.sin(time * 41 + 1) * s * .06, shot.z)));
		camera.lookAt(modelScene.localToWorld(at.set(shot.lx, shot.ly, shot.lz)));
		if (camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
	};

	// --- Every frame: the hole renders first, then the room draws with the rift in it ----------
	const clock = { time: 0, last: performance.now() };
	/** Held at zero while the shaders compile, so the film never starts mid-stall. */
	let warming = true;
	/** Dev only: hold the clock still so frames can be captured one seek at a time. */
	let frozen = false;
	const holeLocal = new Vector3(), keyLight = { level: 1 };
	let heard = -1;
	// The PC screen's portal re-renders the whole scene 30 times a second; nobody can read it during this.
	ctx.render?.portals(false);
	const governor = createGovernor(scale => { ctx.render?.scale(scale); hole.scale(scale, css.x, css.y); });
	let driveTimeline: (() => void) | null = null;
	const frame = () => {
		const now = performance.now();
		governor.tick(now - clock.last);
		if (!frozen && !warming) clock.time += Math.min(.05, (now - clock.last) / 1000);
		clock.last = now;
		// The story moves first, then the camera is placed: both from the same instant. (Driven the other way
		// round, the camera lagged one frame behind a fast ship, which bobbed back and forth as frame times varied.)
		driveTimeline?.();
		applyShot(clock.time);
		hole.render(renderer, camera, clock.time);
		pocket.uniforms.uHoleCentre.value.copy(modelScene.worldToLocal(holeLocal.copy(hole.uniforms.uCenter.value)));
		pocket.update(clock.time);
		for (const f of falling) f.update(clock.time);
		screens.update(clock.time); heart.update(clock.time, camera);
		boat.lightFrom(modelScene.worldToLocal(holeLocal.copy(hole.uniforms.uCenter.value)), (.35 + hole.uniforms.uGain.value * .65) * keyLight.level);
		boat.update(clock.time); hologram.update(clock.time); reveal.update(clock.time);
		portal.uniforms.uTime.value = clock.time; exitPortal.uniforms.uTime.value = clock.time; streaks.update(clock.time, camera.aspect);
		// The hole's roar follows how much of it there is, in coarse steps so the audio graph isn't rescheduled every frame.
		const roar = Math.round(hole.uniforms.uGain.value * 20) / 20;
		if (roar !== heard) { heard = roar; sound.hole(roar); }
	};
	ctx.app.on(quickEvents.PRE_UPDATED, frame);

	// --- The overlay and the way out -----------------------------------------------------------
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
	/** Room objects that will fall in, each restored exactly at the end. */
	const falling: FallingObject[] = [];
	const fallable = (object: Object3D | undefined | null) => {
		if (!object?.parent) return null;
		const f = new FallingObject(object, holeModel, modelScene, pocket.uniforms);
		falling.push(f); return f;
	};

	const tl = gsap.timeline({ paused: true });
	// A camera move inside the lab that arcs up over the furniture (a straight line would pass through chairs
	// and desks), easing in and out.
	type ShotKey = "x" | "y" | "z" | "lx" | "ly" | "lz" | "fov";
	const arcTo = (at: number, duration: number, to: Partial<Record<ShotKey, number>>, lift: number) => {
		const from: Partial<Record<ShotKey, number>> = {}, keys = Object.keys(to) as ShotKey[], p = { k: 0 };
		const capture = () => { for (const key of keys) from[key] = shot[key]; };
		tl.fromTo(p, { k: 0 }, { k: 1, duration, ease: "power2.inOut", immediateRender: false, onStart: capture, onUpdate: () => {
			if (from.x === undefined && from.lx === undefined) capture();
			for (const key of keys) shot[key] = from[key]! + (to[key]! - from[key]!) * p.k;
			shot.y += Math.sin(Math.PI * p.k) * lift;
		} }, at);
	};
	/** Act III onwards was timed before Act II grew: its marks are shifted to follow it. */
	const T = (s: number) => s + (s >= 72.4 ? 18 : s >= 69 ? 15.5 : 9.5);
	const strain = { level: 0 };
	const strainTo = (level: number, at: number, duration = 2) => tl.to(strain, { level, duration, onUpdate: () => sound.strain(strain.level) }, at);

	// --- Act I: The Pocket ------------------------------------------------------------------------
	// We pull back out of the lab, out past the walls of the pocket, until it hangs alone in nothing.
	tl.call(() => overlay.letterbox(true), [], 0);
	const voidBed = { level: 0 };
	tl.to(voidBed, { level: .55, duration: 7, ease: "power1.in", onUpdate: () => sound.void(voidBed.level) }, .5);
	const FAR = { x: 46, y: 26, z: 64, lx: 0, ly: 7, lz: -12 };
	tl.to(shot, { ...FAR, fov: startFov, duration: reduced ? 4 : 8.6, ease: "power2.inOut" }, .3);
	tl.to(hole.uniforms.uVoid, { value: 1, duration: 5, ease: "power1.inOut" }, 2.4);
	tl.to(hole.uniforms.uGain, { value: .55, duration: 4.5, ease: "power1.inOut" }, 3);
	tl.call(() => overlay.protocol("Pocket dimension", "Mohith Lab · stable"), [], 6.4);

	// Something outside strikes the back wall, three times; each blow runs across the whole shell.
	const KNOCKS: [number, Vector3][] = [
		[9.4, IMPACT.clone().add(new Vector3(-4, 2.5, 0))],
		[11.0, IMPACT.clone().add(new Vector3(3.5, -2, 0))],
		[12.6, IMPACT.clone()],
	];
	KNOCKS.forEach(([at, point], i) => {
		tl.call(() => { pocket.knock(i, point, at); sound.knock(i); }, [], at);
		tl.to(ctx.night, { value: Math.min(1, nightWas + .5), duration: .07 }, at).to(ctx.night, { value: nightWas, duration: .6, ease: "power2.in" }, at + .1);
		tl.to(shot, { shake: .8 + i * .3, duration: .05 }, at).to(shot, { shake: 0, duration: .9 }, at + .06);
		// Each blow leaves a star of fractures where it landed.
		tl.to(pocket.cracks.uReveal, { value: [.9, 1.7, 3.2][i]!, duration: .3, ease: "expo.out", onStart: () => sound.crack(.4 + i * .2) }, at);
	});
	// In towards the back wall for the knocks: close enough to see each blow run across the shell.
	tl.to(shot, { x: 27, y: 15, z: 30, lx: 1, ly: 8, lz: -17, duration: 5.4, ease: "power2.inOut" }, 8.2);
	tl.call(() => overlay.say("jarvis", "Sir. Something is knocking on the outside of reality.", 3.2), [], 10.4);

	// --- Act II: The Breach -----------------------------------------------------------------------
	// It arrives: a pinprick far off, lensing the stars as it comes, until it fills the sky behind the pocket.
	// Twelve seconds, on its own swell; the camera backs away to give it room, the lab's light sags towards it.
	tl.call(() => { overlay.clearProtocol(); sound.play("hole_arrival", { gain: 0, space: .3 }); }, [], 14);
	const approach = { s: 0 };
	const restWorld = modelScene.localToWorld(HOLE_REST.clone()), farWorld = modelScene.localToWorld(HOLE_FAR.clone());
	const restDistance = HOLE_REST.length(), farDistance = HOLE_FAR.length();
	tl.to(approach, {
		// Far and small for a long time, then it comes on and arrives with momentum (the landing below).
		s: 1, duration: 12, ease: "power2.in",
		onUpdate: () => {
			const distance = 1 / (1 / farDistance + (1 / restDistance - 1 / farDistance) * approach.s);
			hole.uniforms.uCenter.value.lerpVectors(restWorld, farWorld, (distance - restDistance) / (farDistance - restDistance));
		},
	}, 14);
	tl.to(hole.uniforms.uGain, { value: 1, duration: 9, ease: "power1.in" }, 14.4);
	tl.to(voidBed, { level: .25, duration: 6, onUpdate: () => sound.void(voidBed.level) }, 16);
	tl.to(shot, { x: 38, y: 32, z: 122, lx: 0, ly: 16, lz: -80, duration: 11.4, ease: "sine.inOut" }, 14.2);
	tl.to(ctx.night, { value: Math.min(1, nightWas + .35), duration: 11, ease: "power1.in" }, 15);
	tl.call(() => overlay.say("jarvis", "A black hole, sir. It isn't passing us. It's coming for the pocket.", 3.4), [], 17.2);
	strainTo(.3, 20, 5);
	// It lands: the whole shell takes the weight.
	tl.to(shot, { shake: 1.3, duration: .06 }, 26).to(shot, { shake: .15, duration: 2.4, ease: "power2.out" }, 26.08);
	tl.to(ctx.night, { value: Math.min(1, nightWas + .7), duration: .1 }, 26).to(ctx.night, { value: Math.min(1, nightWas + .4), duration: 1.2 }, 26.15);

	// The crack runs. One continuous move from outside, through the shell, to the back wall: the fracture
	// spreads out from the blow, the wall bows towards what is pulling it, and light comes through the gaps.
	tl.to(shot, { x: 13, y: 10, z: -7, lx: 2, ly: 8.5, lz: -19, fov: startFov * 1.05, duration: 3.6, ease: "power2.inOut" }, 26.3);
	tl.to(shot, { x: 11.5, y: 9.6, z: -9.5, duration: 8.5, ease: "sine.inOut" }, 29.95);
	tl.call(() => sound.whoosh(-8), [], 26.8);
	tl.call(() => { pocket.knock(3, IMPACT, 29.4); sound.knock(2); sound.tear(); sound.play("crack_run", { gain: -2, space: .3 }); }, [], 29.4);
	tl.to(shot, { shake: 1.4, duration: .05 }, 29.4).to(shot, { shake: .3, duration: 1.4 }, 29.46);
	tl.to(pocket.cracks.uReveal, { value: 30, duration: 8.4, ease: "power2.in", onUpdate() { sound.crack(.4 + this.progress() * .6); } }, 29.4);
	tl.to(pocket.uniforms.uBulge, { value: 1.6, duration: 8, ease: "power2.in" }, 29.8);
	tl.to(pocket.uniforms.uSpill, { value: .9, duration: 7, ease: "power1.in" }, 30.4);
	tl.call(() => overlay.say("jarvis", "That isn't a crack, sir. It's a door. And it's being opened from the other side.", 3.6), [], 30.8);
	strainTo(.75, 33.4, 3);
	tl.call(() => { overlay.protocol("Pocket integrity", "Shell failing", true); overlay.setAlarm(true); sound.alarm(true); }, [], 34.6);
	tl.to(ctx.night, { value: 1, duration: .6 }, 34.6);
	tl.call(() => { overlay.say("doom", "This pocket is forfeit.", 2.6); sound.play("doom_forfeit", { gain: 0, space: .35 }); }, [], 36);

	// The breach, seen from inside: the wall in front of us gives, shard by shard, and through it, the hole.
	// Then back out through the gap to watch the rest of the pocket follow.
	const walls = pocket.order("walls");
	tl.call(() => { pocket.release(walls.slice(0, 40), 38.4, 40.6, 4.5); pocket.pour(38.6, 78); sound.breach(); }, [], 38);
	tl.call(() => pocket.release(walls.slice(40, 130), 40.6, 47, 3.5), [], 38.05);
	tl.call(() => pocket.release(walls.slice(130), 48, 82, 2.5), [], 38.1);
	const debrisBed = { level: 0 };
	tl.to(debrisBed, { level: .85, duration: 1.5, onUpdate: () => sound.debris(debrisBed.level) }, 38.2);
	tl.to(debrisBed, { level: .35, duration: 8, onUpdate: () => sound.debris(debrisBed.level) }, 44);
	tl.to(shot, { shake: 1.6, duration: .05 }, 38.4).to(shot, { shake: .5, duration: 2 }, 38.5);
	tl.to(shot, { x: 10.5, y: 9.2, z: -6, duration: 2.6, ease: "power2.out" }, 38.4);
	tl.to(shot, { x: 62, y: 36, z: 78, lx: 0, ly: 14, lz: -110, fov: startFov, duration: 4.2, ease: "power3.inOut" }, 41.2);
	tl.call(() => sound.whoosh(-6), [], 41.3);
	tl.to(shot, { x: 56, y: 33, z: 84, duration: 1.4, ease: "sine.inOut" }, 45.42);
	tl.to(shot, { shake: .6, duration: 1 }, 41.4);
	// The garden behind the lab window is the first thing inside to go.
	const garden = ["tree", "tree_cube_left", "tree_cube_front", "tree_cube_right", "tree_cube_back", "tree_cube_top"]
		.map(name => modelScene.getObjectByName(name)).filter((o): o is Object3D => !!o);
	const windowSky = modelScene.getObjectByName("window_sky");
	const windowSkyWas = windowSky?.visible ?? true;
	tl.call(() => {
		garden.forEach((object, i) => fallable(object)?.schedule(41.6 + i * .25, new Vector3((Math.random() - .5) * 2, 1.5 + Math.random(), -3), .3));
		if (windowSky) windowSky.visible = false;
	}, [], 41.4);
	// Inside the lab, everything leans towards the back wall: the steam bends, the notes lift on their pins.
	if (steam && steamRotation) tl.to(steam.rotation, { z: steamRotation.z + .9, x: steamRotation.x - .5, duration: 3, ease: "power2.inOut" }, 39);
	loose.forEach((object, i) => tl.to(object.rotation, { x: object.rotation.x - .35 - Math.random() * .2, z: object.rotation.z + (Math.random() - .5) * .3, duration: 1.4, ease: "back.out(2)", yoyo: true, repeat: 3 }, 39.5 + i * .12));
	tl.call(() => overlay.say("jarvis", "The pocket won't hold. Initiating Lifeboat protocol. Running is not cowardice, sir, when the alternative is ceasing to exist.", 4.2), [], 42);
	tl.call(() => { overlay.protocol("Lifeboat protocol", "Authorised"); overlay.setAlarm(false); sound.alarm(false); }, [], 44);
	strainTo(.4, 44, 3);

	// --- Act III: Lifeboat protocol -----------------------------------------------------------
	const p = rig.pivots;
	// 01 · Batten down. Close on the desk: the pull reaches the screens first.
	const screens = takeScreens(modelScene);
	// Not a cut: from out in the void, one long move back in through the lab's open side, down to the desk.
	tl.to(shot, { x: -.1, y: 3.15, z: 2.7, lx: -1.75, ly: 2.55, lz: -1.4, fov: startFov * 1.1, duration: 3.2, ease: "power2.inOut" }, T(37.4));
	tl.to(shot, { x: -.35, y: 3, z: 2.2, duration: 4.4, ease: "sine.inOut" }, T(40.62));
	tl.call(() => overlay.protocol("Protocol 01", "Batten down"), [], T(38.4));
	tl.to(ctx.night, { value: .62, duration: 1.2, ease: "power1.inOut" }, T(37.6));
	tl.to(screens.levels, { interference: 1, duration: 2.2, ease: "power2.in" }, T(38.4));
	// The pull drags on the lab's power: one slow brown-out and recovery (no strobing).
	tl.to(ctx.night, { value: .85, duration: .9, ease: "sine.inOut" }, T(39.2)).to(ctx.night, { value: .62, duration: 1.4, ease: "sine.inOut" }, T(40.2));
	// Then JARVIS takes them: black, a line, the protocol screen typing in.
	tl.to(screens.levels, { interference: 0, duration: .08 }, T(41));
	tl.to(screens.levels.boot, { 0: 1, duration: .9, ease: "power2.out" }, T(41.05)).to(screens.levels.rows, { 0: 1, duration: 2.2, ease: "none" }, T(41.6));
	tl.to(screens.levels.boot, { 1: 1, duration: .9, ease: "power2.out" }, T(41.5)).to(screens.levels.rows, { 1: 1, duration: 2.2, ease: "none" }, T(42.1));
	tl.call(() => sound.servo(.4, 1), [], T(41.05)).call(() => sound.servo(.4, 1), [], T(41.5));
	tl.call(() => overlay.say("jarvis", "Securing the lab, sir. Everything that can move, won't.", 2.8), [], T(42.2));
	// The monitors rise off their seats, fold flat onto the desk and lock; the chair swings in and sinks.
	// The phone first: it lays itself face-down on the desk, away from the monitor that will come down over it.
	tl.to(p.phone.rotation, { z: -Math.PI * .5, duration: .7, ease: "power2.in" }, T(44.0)).to(p.phone.rotation, { z: -Math.PI * .485, duration: .18, ease: "power2.out" }, T(44.7));
	tl.call(() => sound.latch(), [], T(44.7));
	// Each monitor goes down whole (bezel, stand and screen together): it lifts off its seat, then lays itself
	// face-down on the desk, hinged at the front of its base, and settles.
	tl.to(p.monitor_a.position, { y: "+=.05", duration: .3, ease: "power2.out" }, T(44.6)).to(p.monitor_a.rotation, { z: -1.42, duration: 1.3, ease: "power2.in" }, T(44.9)).to(p.monitor_a.rotation, { z: -1.36, duration: .25, ease: "power2.out" }, T(46.2)).to(p.monitor_a.position, { y: "-=.05", duration: .25, ease: "power2.in" }, T(46.1));
	tl.to(p.monitor_b.position, { y: "+=.05", duration: .3, ease: "power2.out" }, T(44.9)).to(p.monitor_b.rotation, { x: 1.42, duration: 1.3, ease: "power2.in" }, T(45.2)).to(p.monitor_b.rotation, { x: 1.36, duration: .25, ease: "power2.out" }, T(46.5)).to(p.monitor_b.position, { y: "-=.05", duration: .25, ease: "power2.in" }, T(46.4));
	tl.to(p.chair_base.rotation, { y: Math.PI * .92, duration: 1.6, ease: "back.out(1.2)" }, T(45)).to(p.chair_base.position, { y: "-=.12", duration: .6, ease: "power2.in" }, T(46.4));
	for (const [at, d, pitch] of [[44.6, 1.4, .55], [44.9, 1.4, .6], [45, 1.6, .35]] as const) tl.call(() => sound.servo(d, pitch), [], T(at));
	for (const at of [46.05, 46.35, 47]) tl.call(() => sound.latch(), [], T(at));
	// A look outside: the pocket still coming apart around us.
	// From the desk across the lab to the heart's place on the floor: one move, no cut.
	arcTo(T(46.8), 2.6, { x: 4.6, y: 2.3, z: 7.6, lx: 1.2, ly: .7, lz: 4.2, fov: startFov * 1.05 }, .9);

	// 02 · The heart. WALL·E leaves his dock (which retracts into the ground behind him), rolls to the middle of
	// the lab where the floor opens onto a glass platform, closes himself into his box, and becomes the core.
	const heart = createHeart(modelScene, boat.env, lights);
	const companion = ctx.companion;
	const carriage = companion?.carriage, robot = companion?.robot;
	const carriageHome = carriage ? { position: carriage.position.clone(), rotation: carriage.rotation.clone() } : null;
	const H = heart.at;
	const P0 = T(49.4);
	tl.call(() => overlay.protocol("Protocol 02", "The heart"), [], P0);
	tl.call(() => overlay.say("jarvis", "WALL·E, to the core, if you'd be so kind.", 2.6), [], P0 + .2);
	tl.to(shot, { x: 4.2, y: 2.9, z: 7.9, lx: 1.3, ly: .55, lz: 4.3, duration: 3.2, ease: "sine.inOut" }, P0 + .02);
	if (carriage && carriageHome && walleFilm) {
		const w = walleFilm;
		const dockAt = carriageHome.position;
		// The swap: the film's WALL·E (identical standing, but able to close) takes the companion's place and pose.
		tl.call(() => {
			companion?.puppet?.(true);
			if (robot) { w.root.position.copy(robot.position); w.root.quaternion.copy(robot.quaternion); w.root.scale.copy(robot.scale); w.copyPose(robot); robot.visible = false; }
			carriage.add(w.root); w.root.visible = true;
		}, [], P0);
		const neck = w.control("CONTROL | neck pitch"), upper = w.control("CONTROL | upper neck"), headPan = w.control("CONTROL | head pan");
		const eyes = [w.control("CONTROL | left eye roll"), w.control("CONTROL | right eye roll")];
		const arms = [w.control("CONTROL | left arm lift"), w.control("CONTROL | right arm lift")];
		// Settle the copied pose to rest, then look up towards the voice; a small nod: understood.
		const settle: Object3D[] = [neck, upper, headPan, ...eyes, ...arms].filter((o): o is Object3D => !!o);
		settle.forEach(o => { const r = w.restOf(o); if (r) tl.to(o.rotation, { x: r.x, y: r.y, z: r.z, duration: .5, ease: "power2.inOut" }, P0 + .05); });
		if (neck && upper) {
			tl.to(neck.rotation, { x: "-=.32", duration: .6, ease: "power2.out" }, P0 + .7).to(upper.rotation, { x: "-=.2", duration: .6, ease: "power2.out" }, P0 + .7);
			tl.to(neck.rotation, { x: "+=.22", duration: .22, ease: "power1.inOut", yoyo: true, repeat: 1 }, P0 + 1.5);
			tl.to([neck.rotation, upper.rotation], { x: (i: number) => w.restOf(i === 0 ? neck : upper)!.x, duration: .6, ease: "power2.inOut" }, P0 + 2.1);
		}
		// The dock becomes a ramp: its back panel goes down into the base, a ramp slides out of the deck onto the
		// lab floor. He turns to face the lab while it happens, rolls along his deck and climbs.
		tl.call(() => sound.play("hydraulic", { gain: -6, space: .3 }), [], P0 + 1.6);
		tl.to(heart.state, { dock: 1, duration: 1.4, ease: "power2.inOut" }, P0 + 1.6);
		tl.call(() => sound.play("slide", { gain: -6, space: .3 }), [], P0 + 2.7);
		tl.to(heart.state, { ramp: 1, duration: 1.4, ease: "power2.out" }, P0 + 2.7);
		tl.call(() => sound.latch(), [], P0 + 4.1);
		let lastX = dockAt.x, lastZ = dockAt.z, lastTurn = 0, rolled = 0, turned = 0;
		const roll = () => {
			const d = Math.hypot(carriage.position.x - lastX, carriage.position.z - lastZ); rolled += d; lastX = carriage.position.x; lastZ = carriage.position.z;
			turned += (carriage.rotation.y - lastTurn) * .3; lastTurn = carriage.rotation.y;
			w.roll(rolled - turned, rolled + turned);
		};
		tl.call(() => { lastX = carriage.position.x; lastZ = carriage.position.z; lastTurn = carriage.rotation.y; }, [], P0 + 1.7);
		tl.to(carriage.rotation, { y: Math.PI, duration: 1.1, ease: "power2.inOut", onUpdate: roll }, P0 + 1.8);
		tl.call(() => sound.servo(4, .75), [], P0 + 1.8);
		// One path, deck -> ramp -> floor, sampled by distance: height and pitch follow the surface under the treads.
		const foot = heart.rampFoot, lip = heart.rampLip, floorY = H.y;
		const slope = Math.atan2(lip.y - foot.y, foot.z - lip.z);
		const route = { z: dockAt.z };
		const surface = (z: number) => {
			if (z >= foot.z) return { y: dockAt.y, pitch: 0 };
			if (z >= lip.z) { const k = (foot.z - z) / (foot.z - lip.z); return { y: foot.y + (lip.y - foot.y) * k + (dockAt.y - foot.y) * (1 - k), pitch: slope }; }
			return { y: floorY, pitch: 0 };
		};
		// The treads are long: the body pitches up as the front reaches the ramp, and levels as the back leaves it.
		const pitchAt = (z: number) => {
			const half = .28, front = z - half, back = z + half;
			const lift = (Math.min(foot.z, Math.max(lip.z, back)) - Math.min(foot.z, Math.max(lip.z, front))) / (2 * half);
			return slope * Math.max(0, Math.min(1, lift));
		};
		// From wherever he actually is on his deck (not where the film found him), straight along the ramp's line.
		const routeFrom = { x: dockAt.x, z: dockAt.z };
		tl.call(() => { routeFrom.x = carriage.position.x; routeFrom.z = carriage.position.z; route.z = routeFrom.z; }, [], P0 + 4.15);
		// He steers: wherever he moves, he faces the way he is going (treads, not skates), turning smoothly.
		const steer = (fromX: number, fromZ: number) => {
			const dx = carriage.position.x - fromX, dz = carriage.position.z - fromZ;
			if (dx * dx + dz * dz < 1e-8) return;
			let yaw = Math.atan2(dx, dz);
			while (yaw - carriage.rotation.y > Math.PI) yaw -= Math.PI * 2;
			while (yaw - carriage.rotation.y < -Math.PI) yaw += Math.PI * 2;
			carriage.rotation.y += (yaw - carriage.rotation.y) * .35;
		};
		tl.to(route, { z: lip.z - .55, duration: 2.8, ease: "power1.inOut", onUpdate: () => {
			const k = Math.min(1, Math.abs(routeFrom.z - route.z) / 1.2), e = k * k * (3 - 2 * k);
			const px = carriage.position.x, pz = carriage.position.z;
			carriage.position.set(routeFrom.x + (foot.x - routeFrom.x) * e, surface(route.z).y, route.z); carriage.rotation.x = pitchAt(route.z);
			steer(px, pz); roll();
		} }, P0 + 4.2);
		tl.call(() => sound.latch(), [], P0 + 6.5);
		// Off the ramp, a smooth curve to the glass: it leaves straight ahead (the way he is facing) and bends to
		// the platform, so he drives round to it rather than sliding sideways onto it.
		const leg = { k: 0 }, legFrom = new Vector3(), legMid = new Vector3();
		let legging = false;
		tl.to(leg, { k: 1, duration: 2.1, ease: "power2.inOut", onReverseComplete: () => { legging = false; }, onUpdate: () => {
			if (!legging) { legFrom.copy(carriage.position); legMid.set(legFrom.x, floorY, legFrom.z + (H.z - legFrom.z) * .75); legging = true; }
			const k = leg.k, a = 1 - k, px = carriage.position.x, pz = carriage.position.z;
			carriage.position.set(a * a * legFrom.x + 2 * a * k * legMid.x + k * k * H.x, floorY, a * a * legFrom.z + 2 * a * k * legMid.z + k * k * H.z);
			steer(px, pz); roll();
		} }, P0 + 6.9);
		tl.to(carriage.rotation, { x: 0, duration: .25 }, P0 + 6.9);
		// He turns on the spot to face us on the glass.
		tl.to(carriage.rotation, { y: () => { let y = .62; while (y - carriage.rotation.y > Math.PI) y -= Math.PI * 2; while (y - carriage.rotation.y < -Math.PI) y += Math.PI * 2; return y; }, duration: 1.1, ease: "power2.inOut", onUpdate: roll }, P0 + 9.05);
		// The floor irises open in front of him; the glass platform rises flush to meet him.
		tl.call(() => sound.servo(1.5, .35), [], P0 + 5.6);
		tl.to(heart.state, { iris: 1, duration: 1.4, ease: "power2.inOut" }, P0 + 5.6);
		tl.to(heart.state, { well: .7, duration: 1.2 }, P0 + 5.9);
		tl.to(heart.state, { platform: 1, duration: 1.2, ease: "power2.out" }, P0 + 6.4);
		// Camera: low and wide, the dock going down behind as he crosses to the glass; then close in front of him.
		// High and wide (clear of the console and the record crate): the dock going down, WALL·E crossing to the glass.
		tl.to(shot, { x: 3.3, y: 3.9, z: 8.1, lx: 1.9, ly: .4, lz: 3.4, duration: 3.4, ease: "sine.inOut" }, P0 + 3.2);
		tl.to(shot, { x: H.x + 1.55, y: 1.05, z: H.z + 1.85, lx: H.x, ly: .8, lz: H.z, duration: 1.6, ease: "power2.inOut" }, P0 + 8.1);
		tl.to(shot, { x: H.x + 1.25, y: .95, z: H.z + 1.55, duration: 3, ease: "sine.inOut" }, P0 + 9.72);
		// On the glass: he looks up at us, a little worried; a breath; a nod. Then he closes.
		if (neck && upper) {
			tl.to(neck.rotation, { x: "-=.55", duration: .7, ease: "power2.out" }, P0 + 9.4).to(upper.rotation, { x: "-=.25", duration: .7, ease: "power2.out" }, P0 + 9.4);
			eyes.forEach((e, i) => { if (e) tl.to(e.rotation, { z: (i ? -1 : 1) * .2, duration: .4 }, P0 + 9.7).to(e.rotation, { z: 0, duration: .5 }, P0 + 10.7); });
			tl.to(neck.rotation, { x: "+=.3", duration: .25, ease: "power1.inOut", yoyo: true, repeat: 1 }, P0 + 10.6);
			tl.to([neck.rotation, upper.rotation], { x: (i: number) => w.restOf(i === 0 ? neck : upper)!.x, duration: .45, ease: "power2.inOut" }, P0 + 11.15);
		}
		const F = P0 + 11.6, closing = { t: -1 };
		tl.to(closing, { t: w.foldLength, duration: w.foldLength, ease: "none", onUpdate: () => w.fold(closing.t), onReverseComplete: () => w.fold(-1) }, F);
		for (const [at, kind] of [[.1, "servo"], [.6, "servo"], [1.1, "slide"], [1.5, "servo"], [2.5, "latch"], [2.6, "hydraulic"], [3.8, "latch"]] as const) {
			tl.call(() => { if (kind === "servo") sound.servo(1, .4); else if (kind === "latch") sound.latch(); else sound.play(kind, { gain: -9, space: .3 }); }, [], F + at);
		}
		// The camera comes round him slowly as he closes.
		tl.to(shot, { x: H.x - .4, y: 1.25, z: H.z + 1.9, duration: w.foldLength + .6, ease: "sine.inOut" }, F);
		// The box burns in his solar amber, and is a tesseract.
		const B = F + w.foldLength + .3;
		const burn = { v: 0 };
		tl.call(() => sound.play("charge", { gain: -4, space: .3 }), [], B - .2);
		// The crystal starts exactly where his box is.
		tl.call(() => {
			const box = new Box3().setFromObject(w.root); const c = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
			heart.root.worldToLocal(c); const k = 1 / heart.root.getWorldScale(new Vector3()).x;
			heart.setBox(Math.max(size.x, size.y, size.z) * k * .98, c.y);
		}, [], B);
		tl.to(burn, { v: 1, duration: 1.6, ease: "power2.in", onUpdate: () => w.burn(burn.v) }, B);
		tl.to(heart.state, { glow: .5, duration: 1.6 }, B);
		tl.to(heart.state, { tess: 1, duration: .45, ease: "power2.out" }, B + 1.5);
		const fade = { v: 1 };
		tl.to(fade, { v: 0, duration: .5, onUpdate: () => w.opacity(fade.v), onComplete: () => { w.root.visible = false; }, onReverseComplete: () => { w.root.visible = true; } }, B + 1.55);
		tl.to(heart.state, { fold: 1.5, duration: 5.5, ease: "sine.inOut" }, B + 1.5);
		tl.to(heart.state, { shrink: 1, duration: 3.2, ease: "power2.inOut" }, B + 2.1);
		tl.call(() => sound.whoosh(-10), [], B + 2.1);
		// The glass column rises out of the floor round him.
		tl.call(() => sound.play("glass_rise", { gain: -4, space: .3 }), [], B + 2.9);
		tl.to(heart.state, { tube: 1, duration: 2.6, ease: "power2.out" }, B + 2.9);
		tl.to(shot, { x: H.x + 2.3, y: 2, z: H.z + 2.7, lx: H.x, ly: .85, lz: H.z, duration: 4, ease: "power2.inOut" }, B + 1.6);
		// Power: the floor lights in rings, the lab comes back up warm, the reactor settles into its hum.
		const C = B + 5.8;
		tl.call(() => { sound.play("power_on", { gain: -3, space: .4 }); }, [], C);
		tl.to(heart.state, { glow: 1, duration: .6 }, C).to(heart.state, { pulse: 1, duration: 1.2 }, C);
		const reactorBed = { level: 0 };
		tl.to(reactorBed, { level: .5, duration: 2, onUpdate: () => sound.reactor(reactorBed.level) }, C + .2);
		tl.to(ctx.night, { value: nightWas, duration: 1.4 }, C + .2);
		tl.to(shot, { shake: .5, duration: .05 }, C).to(shot, { shake: 0, duration: 1 }, C + .06);
		tl.call(() => overlay.say("jarvis", "Core online. Power to engines, helm, hull and shields. He volunteered before I finished asking.", 3.6), [], C + .5);
	}

	// 03 · Watch link. The watch on the desk takes the helm.
	tl.call(() => overlay.protocol("Protocol 03", "Watch link"), [], T(69.6));
	// On the desk: the watch on its stand beside the cube, face-on, with room above it for the helm to rise
	// into and be read.
	const watchFacing = new Vector3(Math.sin(WATCH_TURN), 0, Math.cos(WATCH_TURN));
	const watchCam = (d: number, h: number) => WATCH_SPOT.clone().addScaledVector(watchFacing, d).add(new Vector3(0, h, 0));
	{ const a = watchCam(1.9, .5), b = watchCam(2.3, 1.3);
		// Across the lab from the heart to the desk: one move, no cut.
		const W = T(69.6);
		arcTo(W - .2, 1.6, { x: a.x, y: a.y, z: a.z, lx: WATCH_SPOT.x, ly: WATCH_SPOT.y + .22, lz: WATCH_SPOT.z, fov: startFov }, 2.6);
		// As the helm rises, back off and up so its panel is whole and readable above the watch.
		tl.to(shot, { x: b.x, y: b.y, z: b.z, ly: WATCH_SPOT.y + 1.05, duration: 1.7, ease: "sine.inOut" }, W + 1.42);
		// Then in on the helm itself, square to it, close enough to read every line.
		const c = watchCam(1.35, 1.42);
		tl.to(shot, { x: c.x, y: c.y, z: c.z, ly: WATCH_SPOT.y + 1.4, duration: 1.8, ease: "sine.inOut" }, W + 3.14); }
	tl.call(() => { hologram.open(); sound.servo(.8, 1); }, [], T(69.9));
	tl.call(() => overlay.say("jarvis", "Your watch has the helm, sir. Do try not to scratch it.", 2.6), [], T(70.3));
	tl.call(() => overlay.readouts([["HULL", "OPEN"], ["HORIZON", "2.1 KM"], ["HEADING", "AWAY"]]), [], T(70.8));

	// 04 · Seal. Outside the lab now: the open sides close behind blast shutters on rails; the roof goes on,
	// frame first, then plates.
	tl.call(() => { overlay.protocol("Protocol 04", "Seal the pocket"); hologram.close(); }, [], T(72.6));
	// Out of the lab through its open side, rising, as the shutters start to close: one move.
	arcTo(T(72.6), 2.6, { x: 25, y: 13, z: 27, lx: 2.9, ly: 3, lz: 2.4, fov: startFov }, 2.2);
	tl.to(shot, { x: 22, y: 15, z: 30, duration: 5.4, ease: "sine.inOut" }, T(72.6) + 2.62);
	tl.call(() => overlay.say("jarvis", "Sealing the open walls. Apologies to the décor.", 2.6), [], T(73));
	const sealed = boat.deploy(tl, "seal", T(73), { duration: 1.1, stagger: .16, onPart: (i, at) => { if (i % 2 === 0) tl.call(() => sound.servo(.9, .5), [], at); } });
	tl.call(() => sound.seal(), [], sealed);
	const roofed = boat.deploy(tl, "roof", sealed - .3, { duration: .9, stagger: .14, onPart: (i, at) => { if (i % 3 === 0) tl.call(() => sound.latch(), [], at + .8); } });
	tl.to(ctx.night, { value: .25, duration: 1.5 }, sealed);
	strainTo(.8, T(74), 4);

	// 05 · Hull. Cladding, the bow telescoping out to a point, wings, spine, and the colours.
	const H0 = roofed + .4;
	tl.call(() => overlay.protocol("Protocol 05", "Hull"), [], H0);
	tl.to(shot, { x: 30, y: 9, z: -2, lx: 2.9, ly: 3, lz: 3, duration: 2.4, ease: "power2.inOut" }, H0);
	tl.to(shot, { x: 26, y: 13, z: 22, duration: 6.6, ease: "sine.inOut" }, H0 + 2.42);
	tl.call(() => overlay.say("jarvis", "Hull plating. She was always a ship, sir. She simply hadn't been told.", 3.2), [], H0 + .4);
	const clad = boat.deploy(tl, "hull", H0 + .3, { duration: 1.5, stagger: .17, onPart: (i, at) => { if (i % 3 === 0) tl.call(() => sound.latch(), [], at + .9); } });
	const bowed = boat.deploy(tl, "bow", clad - .2, { duration: 1.5, stagger: .16, onPart: (i, at) => { if (i % 4 === 0) tl.call(() => sound.servo(1, .4), [], at); } });
	const winged = boat.deploy(tl, "wings", bowed - .3, { duration: 2.4, stagger: .45, ease: "back.out(1.15)" });
	tl.call(() => sound.servo(2.4, .3), [], bowed - .3);
	const spined = boat.deploy(tl, "spine", winged - .8, { duration: 1.3, stagger: .22 });
	// The colours: the insignia panels turn over.
	tl.to(shot, { x: 14, y: 5, z: 24, lx: 2.9, ly: 3, lz: 9, duration: 3, ease: "power2.inOut" }, spined - 1.2);
	const coloured = boat.deploy(tl, "emblem", spined + .4, { duration: 1.2, stagger: .32, ease: "power2.inOut" });
	tl.call(() => sound.latch(), [], coloured);
	// She is finished: a slow walk round her, from the bow quarter, along her flank, to the stern.
	const SHOWCASE = 7.5;
	const tour = { k: 0 };
	tl.to(tour, { k: 1, duration: SHOWCASE, ease: "sine.inOut", onUpdate: () => {
		const k = tour.k, a = .476 + (2.68 - .476) * k, r = 24.3 + (29.5 - 24.3) * k;
		shot.x = 2.85 + Math.sin(a) * r; shot.z = 2.4 + Math.cos(a) * r; shot.y = 5 + 2 * k + Math.sin(k * Math.PI) * 2.5;
		shot.lx = 2.9; shot.ly = 3 + .2 * k; shot.lz = 9 + (-3 - 9) * k;
	} }, coloured + .3);
	tl.call(() => overlay.say("jarvis", "Aster Seven. Lifeboat class. Rated for exactly this.", 2.8), [], coloured + 1.4);
	// The floor the lab stood on goes; the ship hangs free.
	const floorPlane = modelScene.getObjectByName("scene_1_floor");
	// Once it is gone the keel plates slide in from both sides and seal the hull underneath.
	tl.to(boat.keelLevel, { value: 1, duration: 1.6, ease: "power2.inOut" }, H0 + 6.2);
	tl.call(() => { sound.play("slide", { gain: -8, space: .3 }); }, [], H0 + 6.2);
	tl.call(() => sound.latch(), [], H0 + 7.8);
	// It drops away straight down, beneath us (never across the lens), and is gone.
	const floorHome = floorPlane ? { y: floorPlane.position.y, visible: floorPlane.visible } : null;
	tl.call(() => { pocket.release(pocket.order("floor"), H0 + 2, H0 + 7, 2); }, [], H0 + 1.8);
	if (floorPlane && floorHome) {
		tl.to(floorPlane.position, { y: floorHome.y - 80, duration: 4.5, ease: "power2.in", onComplete: () => { floorPlane.visible = false; }, onReverseComplete: () => { floorPlane.visible = floorHome.visible; } }, H0 + 2.6);
	}

	// 06 · Heart. The core's power runs back to the stern; the engines slide out on their rails.
	const E0 = coloured + .4 + SHOWCASE;
	tl.call(() => overlay.protocol("Protocol 06", "Heart"), [], E0);
	tl.to(shot, { x: 11, y: 5.5, z: -19, lz: -5, duration: 6.6, ease: "sine.inOut" }, E0 + .1);
	tl.call(() => overlay.say("jarvis", "Routing the core to the engines.", 2), [], E0 + .3);
	// The stern opens first: two ports iris open; then the engines slide aft through them on their rails.
	tl.to(boat.portLevel, { value: 1, duration: 1.5, ease: "power2.inOut" }, E0 + .7);
	tl.call(() => sound.play("hydraulic", { gain: -8, space: .3 }), [], E0 + .7);
	// Out in space now: the sky fill comes up, so nothing on the hull falls to pure black (lights.ts).
	tl.fromTo(lights.sky, { intensity: 0 }, { intensity: 1.8, duration: 2.5, ease: "sine.inOut", immediateRender: false }, E0 - 1);
	const engined = boat.deploy(tl, "engines", E0 + 2.3, { duration: 2.2, stagger: .55, onPart: (i, at) => { tl.call(() => sound.servo(1.2, .25 + i * .05), [], at); } });
	const reactorLevel = { level: .35 };
	tl.to(reactorLevel, { level: 1, duration: 2.5, onUpdate: () => sound.reactor(reactorLevel.level) }, E0 + .5);

	// 07 · Ignition. Vents breathe, the engines spool, then they light.
	const I0 = engined + 1;
	const thrust = { level: 0 };
	const setThrust = () => { boat.thrust(thrust.level); sound.engine(thrust.level); };
	tl.call(() => { overlay.protocol("Protocol 07", "Ignition"); overlay.say("jarvis", "Ignition in three. Two—", 1.6); }, [], I0);
	// Out to the side and back from the stern, where the fire will be seen whole.
	tl.to(shot, { x: 36, y: 9, z: -4, lx: 2.9, ly: 3, lz: -16, fov: startFov * 1.02, duration: 2.8, ease: "power2.inOut" }, I0 - .4);
	tl.to(shot, { x: 60, y: 13, z: 0, lx: 2.9, ly: 3, lz: -11, duration: 3, ease: "sine.inOut" }, I0 + 2.42);
	tl.to(thrust, { level: .12, duration: .15, onUpdate: setThrust }, I0 + 1).to(thrust, { level: 0, duration: .5, onUpdate: setThrust }, I0 + 1.2);
	tl.to(thrust, { level: .3, duration: 1.2, ease: "power1.in", onUpdate: setThrust }, I0 + 2.2);
	tl.call(() => sound.ignite(), [], I0 + 3.6);
	tl.to(thrust, { level: 1, duration: .9, ease: "power2.in", onUpdate: setThrust }, I0 + 3.6);
	tl.to(shot, { shake: 1.2, duration: .15 }, I0 + 3.6).to(shot, { shake: .5, duration: 1.5 }, I0 + 3.8);
	tl.call(() => overlay.clearProtocol(), [], I0 + 4.6);

	// --- Act IV: Escape ----------------------------------------------------------------------------
	// One continuous flight. The lab's whole frame (and the camera riding in it) moves through the world on a
	// single precomputed path; the hole, its disk and the stars stay put. Beats, on the ship's own clock:
	//   0.0  full burn away; it gains ground                    3.4  it slows; gravity is winning
	//   5.2  a second surge, engines past their limit           ~8   dragged backwards anyway
	//   10   "we'll go around it"; a slow turn on thrusters     18   full burn into the dive
	//   18   falling in, the hole filling the frame              ~27  periapsis, low over the disk
	//   ~35  flung clear; a look back                            ~48  hyperspace: a window opens
	//   ~59  the jump; the ride; out
	const A0 = I0 + 5.4;
	const shipCentre = new Vector3(2.85, 3, 2.4);
	const startWorldEarly = modelScene.localToWorld(shipCentre.clone());
	// For the flight the hole is shown at its true scale against the ship: three times the size and three times
	// as far (scaled about the ship, so from beside her it looks the same at the instant it changes, hidden in
	// the ignition's flash). The ship is a speck against it; she passes high over the disk, never near the dark.
	const HOLE_K = 3;
	const holeWorld = modelScene.localToWorld(HOLE_REST.clone()).sub(startWorldEarly).multiplyScalar(HOLE_K).add(startWorldEarly);
	tl.call(() => { hole.uniforms.uCenter.value.copy(holeWorld); hole.uniforms.uScale.value = M * worldScale * HOLE_K; }, [], I0 + 3.62);
	const startWorld = modelScene.localToWorld(shipCentre.clone());
	const up = new Vector3(0, 1, 0), Z = new Vector3(0, 0, 1);
	// The slingshot: a hyperbola about the hole (eccentricity 1.5, periapsis 170 m, ~9.5 M), turned so it
	// begins where the ship is when the dive starts, and passing above the disk.
	const E = 1.5, RP = 170 * HOLE_K, P = RP * (1 + E);
	const radiusAt = (phi: number) => P / (1 + E * Math.cos(phi));
	const BURN = 10, TURN = 8, DIVE = 26, AWAY = 26;
	// The struggle, integrated rather than drawn: the hole's pull is GM/r² (and grows as the ship falls back),
	// against the engines' thrust: a full burn that wins at first and fades as they heat, a second surge past
	// their limit that only holds the line, then they give; after the burn, idle thrust on the turn.
	const holeDistance0 = startWorld.distanceTo(holeWorld);
	const G0 = 14;   // the pull where the ship starts, in units/s²
	const thrustAt = (t: number) => {
		if (t < BURN) {
			const first = 21 * Math.exp(-Math.max(0, t - 1.2) / 2.6) * Math.min(1, t / .6);
			const second = t > 5.2 ? 14.5 * Math.min(1, (t - 5.2) / .5) * (t < 7.6 ? 1 : Math.max(0, 1 - (t - 7.6) / 1.8)) * (.92 + .08 * Math.sin(t * 23)) : 0;
			return Math.max(first, second, 9);
		}
		return 11.5;
	};
	const alongTable: number[] = [];
	{
		let x = 0, v = 0; const dt = 1 / 120;
		for (let i = 0; i <= (BURN + TURN) * 120 + 2; i++) {
			alongTable.push(x);
			const r = holeDistance0 + x, g = G0 * (holeDistance0 / r) ** 2, t = i * dt;
			// After the burn, on the turn, the thrusters hold station against the pull: the fall bleeds away to a
			// standstill (otherwise a long, slow turn would fall straight through the hole).
			if (t < BURN) v += (thrustAt(t) - g) * dt; else v -= v * Math.min(1, 1.1 * dt);
			x += v * dt;
		}
	}
	const along = (t: number) => {
		const f = Math.max(0, t) * 120, i = Math.min(alongTable.length - 2, Math.floor(f)), k = f - i;
		return alongTable[i]! + (alongTable[i + 1]! - alongTable[i]!) * k;
	};
	// Where the dive begins (end of the turn), and the hyperbola rotated to meet it.
	const diveStart = startWorld.clone().addScaledVector(Z, along(BURN + TURN));
	const fromHole = diveStart.clone().sub(holeWorld); fromHole.y = 0;
	const r0 = fromHole.length();
	const phi0 = Math.acos(Math.max(-1, Math.min(1, (P / r0 - 1) / E)));
	const turnTo = Math.atan2(fromHole.z, fromHole.x) - phi0;   // rotate the orbit plane's x axis to put phi0 at the ship
	const PHI1 = -Math.PI * .58;
	const orbitPoint = (phi: number, out: Vector3) => {
		const r = radiusAt(phi), a = phi + turnTo;
		return out.set(holeWorld.x + r * Math.cos(a), 0, holeWorld.z + r * Math.sin(a));
	};
	// Angle against time, fast at periapsis (equal areas in equal times).
	const arcTimes: number[] = [0];
	{ let acc = 0; for (let i = 1; i <= 400; i++) { const phi = phi0 + (PHI1 - phi0) * i / 400; const r = radiusAt(phi); acc += r * r; arcTimes.push(acc); } }
	const phiAt = (u: number) => {
		const target = arcTimes[400]! * Math.min(1, Math.max(0, u)); let i = 0; while (i < 400 && arcTimes[i + 1]! < target) i++;
		const f = (target - arcTimes[i]!) / Math.max(1e-6, arcTimes[i + 1]! - arcTimes[i]!);
		return phi0 + (PHI1 - phi0) * (i + f) / 400;
	};
	const exitPoint = orbitPoint(PHI1, new Vector3()), exitDirection = orbitPoint(PHI1 - .002, new Vector3()).sub(exitPoint).normalize();
	const exitSpeed = orbitPoint(phiAt(1), new Vector3()).distanceTo(orbitPoint(phiAt(.995), new Vector3())) / (DIVE * .005);
	// Well above the disk at closest approach: it skims over the disk, never under it.
	const PERIAPSIS_Y = holeWorld.y + 80 * HOLE_K, CLIMB = 30 * HOLE_K;
	/** The whole flight: position and heading of the ship's centre at flight time t (seconds after A0). */
	/** The kick into hyperspace, on the flight's clock: from here the ship gains on its line with the cube of time. */
	const JUMP_T = BURN + TURN + DIVE + 15;
	// The heading through the slingshot and after is the path's own direction (a short step along it), so it
	// turns smoothly where the orbit hands over to the straight run out: no snap, no flip.
	const flightAt = (t: number, position: Vector3, heading: Vector3) => {
		pathAt(t, position, heading);
		if (t >= BURN + TURN) {
			pathAt(t + .12, flightAt.step, flightAt.spare); flightAt.step.sub(position);
			// Only a hint of the climb and fall in her attitude: she flies the line, she doesn't nose into it.
			flightAt.step.y *= .2; heading.copy(flightAt.step).normalize();
		}
	};
	flightAt.step = new Vector3(); flightAt.spare = new Vector3();
	const pathAt = (t: number, position: Vector3, heading: Vector3) => {
		if (t < BURN + TURN) {
			position.copy(startWorld).addScaledVector(Z, along(t));
			heading.copy(Z).applyAxisAngle(up, Math.PI * Math.min(1, Math.max(0, (t - BURN) / TURN)) ** 2 * (3 - 2 * Math.min(1, Math.max(0, (t - BURN) / TURN))));
			return;
		}
		const u = (t - BURN - TURN) / DIVE;
		if (u <= 1) {
			orbitPoint(phiAt(u), position);
			// Height: down from where we were to just above the disk at periapsis, then climbing away.
			const k = Math.min(1, u / .45), l = Math.min(1, Math.max(0, (u - .55) / .45)), lift = l * l * (3 - 2 * l);
			position.y = diveStart.y + (PERIAPSIS_Y - diveStart.y) * (k * k * (3 - 2 * k)) + lift * CLIMB;
			// Ease from the drifting line onto the orbit over the first second, so nothing jumps.
			const blend = Math.min(1, (t - BURN - TURN) / 1.2);
			if (blend < 1) position.lerpVectors(diveStart, position, blend * blend * (3 - 2 * blend));
			pathAt.ahead ??= new Vector3();
			const next = pathAt.ahead;
			orbitPoint(phiAt(Math.min(1, u + .004)), next); next.y = position.y + (u > .55 ? .3 : -.05);
			heading.copy(next).sub(position).normalize();
			return;
		}
		const kick = Math.max(0, t - JUMP_T);
		position.copy(exitPoint).addScaledVector(exitDirection, (t - BURN - TURN - DIVE) * exitSpeed + 620 * kick * kick * kick + 60 * kick * kick); position.y = PERIAPSIS_Y + CLIMB;
		heading.copy(exitDirection);
	};
	pathAt.ahead = undefined as Vector3 | undefined;
	const flight = { t: 0, roll: 0 };
	const here = new Vector3(), heading = new Vector3(), q = new Quaternion(), qRoll = new Quaternion();
	const placeShip = () => {
		if (!flying) return;
		flightAt(flight.t, here, heading);
		q.setFromUnitVectors(Z, heading);
		qRoll.setFromAxisAngle(Z, flight.roll);
		modelScene.quaternion.copy(sceneHome.quaternion).multiply(q).multiply(qRoll);
		modelScene.position.copy(here).sub(shipCentre.clone().applyQuaternion(modelScene.quaternion));
		modelScene.updateMatrixWorld(true);
	};
	let flying = true;
	const FLY = BURN + TURN + DIVE + AWAY;
	tl.to(flight, { t: FLY, duration: FLY, ease: "none", onUpdate: placeShip }, A0);
	// Bank into the slingshot and out again.
	tl.to(flight, { roll: -.45, duration: DIVE * .3, ease: "sine.inOut" }, A0 + BURN + TURN + DIVE * .2).to(flight, { roll: 0, duration: DIVE * .3, ease: "sine.inOut" }, A0 + BURN + TURN + DIVE * .55);

	// --- One camera for the whole escape, no cuts -------------------------------------------------------------
	// It starts still in space, side-on (so the drag back reads against the stars), then flies round behind the
	// ship as it turns and dives; swings out to the side at periapsis (the ship tiny against the hole); comes
	// round in front to look back at the hole falling away; and settles behind for the window and the jump.
	// `w` blends from the still camera (0) to the ship-relative rig (1); `hole` and `portal` blend what it
	// looks at, from just ahead of the ship towards the hole or the window.
	const cam4 = { w: 0, yaw: 0, pitch: .22, dist: 36, hole: 0, portal: 0, lift: 6 };
	// Close enough that being dragged back reads against the frame: the ship drifts back across it.
	const stillCamera = startWorld.clone().add(new Vector3(58, 12, 8));
	const stillTarget = startWorld.clone().add(new Vector3(0, 1, -8));
	const camShip = new Vector3(), camAhead = new Vector3(), camLook = new Vector3(), camPos = new Vector3();
	const portalWorld = new Vector3(), portalHeading = new Vector3();
	const level = new Vector3(), side4 = new Vector3();
	const camera4 = () => {
		if (!flying) return;   // out of the warp, Act V's own camera has it
		// A level frame that follows the ship's heading (never its pitch or bank), so "up" stays up.
		modelScene.localToWorld(camAhead.copy(shipCentre));
		level.set(heading.x, 0, heading.z); if (level.lengthSq() < 1e-6) level.set(0, 0, 1); level.normalize();
		side4.crossVectors(up, level).normalize();
		const yaw = cam4.yaw, p = cam4.pitch;
		camShip.copy(camAhead)
			.addScaledVector(level, -Math.cos(yaw) * Math.cos(p) * cam4.dist)
			.addScaledVector(side4, Math.sin(yaw) * Math.cos(p) * cam4.dist)
			.addScaledVector(up, Math.sin(p) * cam4.dist + cam4.lift);
		const shipNow = camLook.copy(camAhead);
		camAhead.addScaledVector(level, 40).addScaledVector(up, 2);
		// Looking at the hole means framing the ship and the hole together: aim between them, nearer the ship.
		const between = shipNow.clone().lerp(holeWorld, .18 / HOLE_K);
		camLook.copy(camAhead).lerp(between, cam4.hole).lerp(portalWorld, cam4.portal);
		worldCamera.position.copy(stillCamera).lerp(camShip, cam4.w);
		worldCamera.target.copy(stillTarget).lerp(camLook, cam4.w);
		if (tunnel.uniforms.uTravel.value > .001) tunnel.follow(shipNow, tunnelQuat.setFromUnitVectors(Z, level), clock.time);
		else tunnel.group.visible = false;
	};
	// Out here distances are large (the window opens hundreds of units ahead): draw further for the flight.
	const farWas = camera.far;
	// The flight's still camera takes over exactly where the ignition shot is: no cut.
	tl.call(() => {
		stillCamera.copy(camera.position); modelScene.localToWorld(stillTarget.set(shot.lx, shot.ly, shot.lz));
		worldCamera.on = true; camera4(); camera.far = Math.max(farWas, 30000); camera.updateProjectionMatrix();
	}, [], A0);
	const cam4Driver = { t: 0 };
	tl.to(cam4Driver, { t: 1, duration: FLY + 30, ease: "none", onUpdate: camera4 }, A0);   // runs the rig every frame of the act

	// 1 · The struggle. Full burn: it gains. The pull takes the gain back. A second surge holds the line, and
	// then it is dragged backwards anyway, engines screaming.
	tl.call(() => boat.merge(true), [], A0 - .1);
	tl.call(() => overlay.say("jarvis", "Full burn.", 1.4), [], A0);
	// Every engine she has, the centre one too, pushed past their limit: the fire long and ragged.
	const centre = { level: 0, strain: 0 };
	const setCentre = () => { boat.centre(centre.level); boat.strain(centre.strain); };
	tl.to(centre, { strain: .45, duration: 1.2, onUpdate: setCentre }, A0 + .2);
	tl.to(centre, { level: 1, strain: 1, duration: .6, ease: "power2.in", onUpdate: setCentre }, A0 + 5.2);
	tl.to(centre, { level: .25, strain: 0, duration: 1.4, ease: "power1.inOut", onUpdate: setCentre }, A0 + BURN - .3);
	tl.call(() => overlay.readouts([["HULL", "92%"], ["HORIZON", "1.4 KM"], ["HEADING", "AWAY"]]), [], A0 + .4);
	tl.call(() => overlay.say("jarvis", "We're slowing, sir. It's pulling us back.", 2.4), [], A0 + 3.4);
	tl.call(() => overlay.readouts([["HULL", "88%"], ["HORIZON", "1.2 KM"], ["HEADING", "HOLDING"]]), [], A0 + 4.2);
	tl.call(() => { sound.play("ignite", { gain: -5, rate: .9, space: .4 }); overlay.say("jarvis", "Everything we have, sir.", 1.8); }, [], A0 + 5.2);
	const flicker = { k: 0 };
	tl.to(flicker, { k: 1, duration: 4.4, ease: "none", onUpdate: () => {
		const k = flicker.k, n = Math.sin(k * 61) * .5 + Math.sin(k * 37 + 1) * .5;
		thrust.level = 1 - Math.max(0, n) * .35 * Math.sin(k * Math.PI); setThrust();
	} }, A0 + 5.2);
	tl.to(shot, { shake: .5, duration: 1 }, A0 + 5.2).to(shot, { shake: .8, duration: 3 }, A0 + 6.2).to(shot, { shake: .3, duration: 1.5 }, A0 + 9.4);
	tl.call(() => overlay.readouts([["HULL", "79%"], ["HORIZON", "0.9 KM"], ["HEADING", "FALLING"]]), [], A0 + 7.6);
	tl.call(() => overlay.say("jarvis", "Its pull is stronger than our engines, sir. We're being dragged back.", 3), [], A0 + 7.9);
	tl.call(() => sound.play("crack_run", { gain: -10, rate: .7, space: .4 }), [], A0 + 7);
	strainTo(1, A0 + 2.5, 5);
	// 2 · The decision and the turn: the bow swings round to face the hole. The camera starts its flight round.
	tl.call(() => overlay.say("jarvis", "We can't outrun it, sir. So we won't. We'll go around it.", 3.2), [], A0 + BURN - .6);
	tl.to(thrust, { level: .18, duration: .8, onUpdate: setThrust }, A0 + BURN - .2);
	tl.call(() => sound.servo(TURN, .2), [], A0 + BURN);
	tl.call(() => overlay.readouts([["HULL", "74%"], ["HORIZON", "0.8 KM"], ["HEADING", "INBOUND"]]), [], A0 + BURN + 1);
	// Slow, heavy: the bow comes round on thrusters while the camera flies round behind it, so by the end of the
	// turn we are looking over the ship's shoulder straight down at the hole it is about to fall into.
	tl.fromTo(cam4, { w: 0, yaw: -1.4, pitch: .2, dist: 60, hole: 0 }, { w: 1, yaw: 0, pitch: .24, dist: 40, hole: .3, duration: TURN + 2, ease: "sine.inOut", immediateRender: false }, A0 + BURN + .2);
	tl.call(() => overlay.say("jarvis", "Coming about. Slowly, sir. Anything sudden and it takes us.", 3), [], A0 + BURN + 2.4);
	// 3 · The last full-force push: all three engines, the centre one too, for the dive.
	const D0 = A0 + BURN + TURN;

	tl.call(() => { overlay.say("jarvis", "All three engines. Every last drop.", 2.2); sound.ignite(); }, [], D0 - .6);
	tl.to(thrust, { level: 1, duration: .7, ease: "power2.in", onUpdate: setThrust }, D0 - .5);
	tl.to(centre, { level: 1, strain: .8, duration: .5, ease: "power2.in", onUpdate: setCentre }, D0 - .3);
	tl.to(shot, { shake: 1.2, duration: .08 }, D0 - .3).to(shot, { shake: .7, duration: 2 }, D0 - .2);
	tl.call(() => overlay.readouts([["HULL", "61%"], ["HORIZON", "0.5 KM"], ["HEADING", "DIVE"]]), [], D0 + 1.5);
	// 4 · Falling in: riding close behind the ship as it drops towards the hole, the disk swelling until it
	// fills the frame. The hull groans; the light bends; the engines are a candle against it.
	tl.to(cam4, { dist: 150, pitch: .14, hole: .45, lift: 14, duration: DIVE * .26, ease: "sine.inOut" }, D0 + .4);
	tl.call(() => overlay.say("jarvis", "Event horizon in four hundred metres, sir. Three hundred.", 2.8), [], D0 + DIVE * .08);
	tl.call(() => { sound.play("crack_run", { gain: -12, rate: .55, space: .5 }); overlay.readouts([["HULL", "52%"], ["HORIZON", "0.3 KM"], ["HEADING", "FALLING"]]); }, [], D0 + DIVE * .16);
	tl.call(() => overlay.say("jarvis", "Time is bending around us. Out there, a minute is passing for every second in here.", 3.4), [], D0 + DIVE * .2);
	tl.to(shot, { shake: 1, duration: DIVE * .1 }, D0 + DIVE * .12);
	// 5 · Periapsis: the camera swings slowly out to the side and back; the ship a sliver against the disk.
	tl.call(() => { overlay.readouts([["HULL", "41%"], ["HORIZON", "0.2 KM"], ["HEADING", "PERIAPSIS"]]); sound.stretch(true); }, [], D0 + DIVE * .35);
	tl.to(cam4, { yaw: 1.25, pitch: .3, dist: 230, hole: .5, lift: 10, duration: DIVE * .3, ease: "sine.inOut" }, D0 + DIVE * .3);
	tl.call(() => overlay.say("jarvis", "Hold on to something. Preferably something bolted down.", 2.6), [], D0 + DIVE * .44);
	tl.to(shot, { shake: .35, duration: 2.5 }, D0 + DIVE * .4);
	// 6 · Flung clear: the camera comes round in front, the hole falling away behind the ship.
	tl.call(() => { overlay.readouts([["HULL", "12%"], ["HORIZON", "CLEAR"], ["HEADING", "AWAY"]]); sound.stretch(false); sound.play("flyby", { gain: -4 }); }, [], D0 + DIVE * .7);
	// A view we have not had: high above and behind the climbing ship, looking back and down at the hole, the
	// disk opening out nearly face-on and shrinking as the ship leaves its grip.
	tl.to(cam4, { yaw: Math.PI * .92, pitch: .4, dist: 120, hole: .35, lift: 14, duration: DIVE * .34, ease: "sine.inOut" }, D0 + DIVE * .64);
	tl.to(shot, { shake: 0, duration: 2 }, D0 + DIVE * .75);
	tl.to(centre, { level: 0, strain: 0, duration: 1.4, onUpdate: setCentre }, D0 + DIVE + .5);
	tl.to(thrust, { level: .6, duration: 2, onUpdate: setThrust }, D0 + DIVE + .5);
	strainTo(.2, D0 + DIVE, 3);
	tl.call(() => overlay.say("jarvis", "We made it, sir. We actually made it.", 2.4), [], D0 + DIVE + .8);

	// 6 · Hyperspace. "Opening a hyperspace window." The camera comes back round behind the ship; ahead, a circle
	// tears open in space, the starlight in it already drawn into lines; we watch it open as the ship closes on
	// it. Then the kick: the ship lurches forward and flies into the window, which flashes as it goes through,
	// all in the one shot. Inside: the tunnel, the ship riding it. Then out.
	const Y0 = D0 + DIVE + 4;
	const portal = createPortal();
	const streaks = createStreaks(reduced); streaks.mesh.renderOrder = 998; modelScene.add(streaks.mesh);
	const tunnel = createTunnel(reduced); world.add(tunnel.group);
	const tunnelQuat = new Quaternion();
	const J0 = Y0 + 11;
	flightAt(JUMP_T + .95, portalWorld, portalHeading);
	portal.mesh.position.copy(portalWorld); portal.mesh.scale.setScalar(70);
	portal.mesh.lookAt(portalWorld.clone().sub(portalHeading));
	tl.call(() => { overlay.protocol("Hyperspace", "Window opening"); overlay.say("jarvis", "Opening a hyperspace window, sir.", 2.4); sound.play("hyper_charge", { gain: -1, space: .4 }); }, [], Y0);
	tl.to(cam4, { yaw: 0, pitch: .1, dist: 48, hole: 0, lift: 6, duration: 9, ease: "sine.inOut" }, Y0 - 6);
	tl.to(cam4, { portal: 1, duration: 3, ease: "sine.inOut" }, Y0 + .5);
	tl.call(() => { world.add(portal.mesh); }, [], Y0 + .3);
	tl.to(portal.uniforms.uOpen, { value: 1, duration: 6.4, ease: "sine.out" }, Y0 + .4);
	tl.call(() => sound.whoosh(-10), [], Y0 + .4);
	tl.to(thrust, { level: 1, duration: 3, ease: "power2.in", onUpdate: setThrust }, Y0 + 6.5);
	tl.call(() => overlay.say("jarvis", "Hyperspace travel initiated, sir.", 2.2), [], Y0 + 7.6);
	// The kick: the camera lets the ship go (it holds its place in space) and watches it rocket into the window.
	// Then the camera dives in after it, through the rim, and catches the ship up inside the tunnel. One shot.
	tl.call(() => { cam4.w = 1; stillCamera.copy(worldCamera.position); stillTarget.copy(portalWorld); }, [], J0 - .05);
	tl.to(cam4, { w: 0, duration: .25, ease: "power1.out" }, J0);
	tl.call(() => { overlay.readouts(null); overlay.clearProtocol(); sound.hyperspace(); sound.strain(0); }, [], J0);
	tl.to(streaks.uniforms.uJump, { value: .5, duration: .9, ease: "power3.in" }, J0);
	tl.to(shot, { shake: 1.2, duration: .05 }, J0 + .9).to(shot, { shake: .4, duration: .8 }, J0 + .95);
	// The window flares as the ship goes through it.
	tl.to(portal.uniforms.uFlare, { value: 1.2, duration: .12 }, J0 + .88).to(portal.uniforms.uFlare, { value: .2, duration: .6 }, J0 + 1);
	// The dive: the held camera accelerates at the window, the lens widening, and passes through the rim.
	const diveTo = portalWorld.clone().addScaledVector(portalHeading, 40), diveLook = portalWorld.clone().addScaledVector(portalHeading, 600);
	tl.to(stillCamera, { x: diveTo.x, y: diveTo.y + 2, z: diveTo.z, duration: .8, ease: "power3.in", immediateRender: false }, J0 + .55);
	tl.to(stillTarget, { x: diveLook.x, y: diveLook.y, z: diveLook.z, duration: .8, ease: "power2.in", immediateRender: false }, J0 + .55);
	tl.to(shot, { fov: startFov * 1.4, duration: .8, ease: "power2.in" }, J0 + .55);
	tl.to(tunnel.uniforms.uTravel, { value: 1, duration: .5, ease: "power2.out" }, J0 + 1.05);
	// Through: the window is behind us; the tunnel all round; ahead, the ship, small, which we close on.
	tl.call(() => {
		portal.mesh.removeFromParent();
		hole.uniforms.uGain.value = 0;
		streaks.uniforms.uJump.value = 1;
		modelScene.localToWorld(camShip.copy(shipCentre));
		const gap = Math.max(40, camShip.distanceTo(worldCamera.position));
		Object.assign(cam4, { yaw: 0, pitch: .02, dist: gap, hole: 0, portal: 0, lift: 0 }); cam4.w = 1;
		// Hyperspace light on the hull: cold blue from ahead and all round.
		lights.owner = "tunnel"; lights.sky.color.set("#9fc0ff"); lights.sky.groundColor.set("#1c2a6e");
		lights.key.color.set("#8fb8ff"); lights.key.intensity = 4.2; lights.key.position.copy(shipCentre).add(new Vector3(0, 30, 60)); lights.key.target.position.copy(shipCentre);
		lights.fill.color.set("#5b6cff"); lights.fill.intensity = 1.6; lights.fill.position.copy(shipCentre).add(new Vector3(-40, -10, -20)); lights.fill.target.position.copy(shipCentre);
	}, [], J0 + 1.35);
	tl.to(streaks.uniforms.uTravel, { value: 1, duration: .6, ease: "power2.out" }, J0 + 1.35);
	tl.to(cam4, { dist: 26, pitch: .1, lift: 2.5, duration: 3, ease: "power3.out" }, J0 + 1.4);
	tl.to(shot, { fov: startFov * 1.1, duration: 2.4, ease: "power2.out" }, J0 + 1.4);
	// Riding it: the ship banks gently one way and the other, the camera drifting with it a beat behind.
	tl.to(flight, { roll: .14, duration: 1.3, ease: "sine.inOut", yoyo: true, repeat: 3 }, J0 + 1.6);
	tl.to(cam4, { yaw: .07, duration: 1.7, ease: "sine.inOut", yoyo: true, repeat: 2 }, J0 + 1.8);
	tl.call(() => overlay.say("jarvis", "Hyperspace stable, sir.", 2.2), [], J0 + 2.6);
	// Out: the lines snap back to points; a last flash; quiet.
	const X0 = J0 + 7;
	tl.call(() => { sound.play("hyper_exit", { gain: -2, space: .4 }); }, [], X0 - 2.3);
	// Out: the tunnel unravels outward and is gone, and we are in the exit window's funnel, riding out with the
	// ship (Act V picks the camera up exactly where the tunnel left it).
	tl.to(streaks.uniforms.uExit, { value: 1, duration: .45, ease: "power2.in" }, X0);
	tl.to(streaks.uniforms.uTravel, { value: 0, duration: .45, ease: "power2.in" }, X0);
	tl.to(tunnel.uniforms.uExit, { value: 1, duration: .5, ease: "power2.in" }, X0 - .05);
	tl.call(() => { tunnel.uniforms.uTravel.value = 0; tunnel.uniforms.uExit.value = 0; tunnel.group.visible = false; }, [], X0 + .46);
	tl.call(() => { lights.owner = "boat"; lights.sky.color.set("#ffd8b0"); lights.sky.groundColor.set("#6878a8"); lights.key.color.set("#ffcf96"); lights.fill.color.set("#9cb8ff"); lights.fill.intensity = .9; }, [], X0 + .45);
	tl.call(() => { streaks.uniforms.uJump.value = 0; streaks.uniforms.uExit.value = 0; boat.thrust(0); boat.centre(0); sound.engine(0); sound.loop("hyper_loop", 0, { time: .2 }); sound.reactor(.3); }, [], X0 + .5);


	// --- Act V: Already Here ---------------------------------------------------------------------
	// Out of the warp into new, quiet space: an exit window tears open and the ship bursts out of it, braking
	// hard; the window seals behind it. It coasts. "Safe." Then Jarvis sees something ahead; the light finds it
	// from behind; the camera tilts up from the ship to a figure standing in space, vast. The eyes light. He speaks.
	// He stands still in the world; the ship drifts towards him.
	const arriveAt = new Vector3(), arriveHeading = new Vector3(); flightAt(JUMP_T - 1, arriveAt, arriveHeading);
	arriveHeading.setY(0).normalize();
	const arriveSide = new Vector3().crossVectors(up, arriveHeading).normalize();
	const arriveQuat = sceneHome.quaternion.clone().multiply(new Quaternion().setFromUnitVectors(Z, arriveHeading));
	const arrival = { out: 0, drift: 0 };
	let arriving = false;
	const BURST = 150, DRIFT = 24;
	const placeArrival = () => {
		if (!arriving) return;
		const along = -BURST * (1 - arrival.out) + DRIFT * arrival.drift;
		const centre = arriveAt.clone().addScaledVector(arriveHeading, along);
		modelScene.quaternion.copy(arriveQuat);
		modelScene.position.copy(centre).sub(shipCentre.clone().applyQuaternion(arriveQuat));
		modelScene.updateMatrixWorld(true);
		if (riding) placeRideOut();
	};
	// Where the ship will stop: Doom is placed in the world relative to that.
	const restMatrix = (() => {
		const m = new Matrix4(), centre = arriveAt.clone().addScaledVector(arriveHeading, DRIFT);
		const pos = centre.clone().sub(shipCentre.clone().applyQuaternion(arriveQuat));
		return m.compose(pos, arriveQuat, modelScene.scale.clone());
	})();
	const exitPortal = createPortal();
	// The ship starts inside the window's funnel (and the camera behind it, deeper still), so we come out of it.
	exitPortal.mesh.position.copy(arriveAt).addScaledVector(arriveHeading, -BURST + 22);
	exitPortal.mesh.scale.setScalar(70);
	exitPortal.mesh.lookAt(exitPortal.mesh.position.clone().add(arriveHeading));
	// The camera rides out behind the ship exactly as it sat in the tunnel, then lets it go and swings out to the
	// side to watch the window seal behind it.
	const rideOut = { k: 0 }, rideCentre = new Vector3();
	let riding = false;
	const ease = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
	function placeRideOut() {
		const along = -BURST * (1 - arrival.out) + DRIFT * arrival.drift;
		rideCentre.copy(arriveAt).addScaledVector(arriveHeading, along);
		// First out wide to the side (well clear of the hull), then forward of it, turning to look back.
		const k = rideOut.k, wide = ease(.05, .6, k), fore = ease(.3, 1, k);
		worldCamera.position.copy(rideCentre)
			.addScaledVector(arriveHeading, -25.9 + (25.9 + 46) * fore)
			.addScaledVector(arriveSide, 64 * wide)
			.addScaledVector(up, 5.1 + (12 - 5.1) * wide);
		worldCamera.target.copy(rideCentre).addScaledVector(arriveHeading, 40 * (1 - ease(.1, .75, k))).addScaledVector(up, 2);
	}
	tl.call(() => {
		// New space: the hole is far behind now, a dim smudge; nothing ahead but stars.
		flying = false; arriving = true; placeArrival();
		hole.uniforms.uCenter.value.copy(arriveAt.clone().addScaledVector(arriveHeading, -9000).add(new Vector3(-3000, 600, 0)));
		hole.tilt(.4, 1.2); hole.uniforms.uGain.value = .5;
		world.add(exitPortal.mesh); exitPortal.uniforms.uOpen.value = 1;
		worldCamera.on = true; rideOut.k = 0; riding = true; placeRideOut();
		shot.shake = 0;
		reveal.placeInWorld(world, restMatrix, arriveQuat, worldScale);
	}, [], X0 + .45);
	tl.to(shot, { fov: startFov, duration: 2.4, ease: "sine.inOut" }, X0 + .5);
	tl.to(rideOut, { k: 1, duration: 3.1, ease: "none", onUpdate: placeRideOut, onComplete: () => { riding = false; }, onReverseComplete: () => { riding = false; } }, X0 + .5);
	// Out of it at speed, braking hard: the main engines dark, the bow's retro jets doing the work.
	tl.call(() => { sound.play("flyby", { gain: -2 }); sound.whoosh(-4); }, [], X0 + .5);
	tl.to(arrival, { out: 1, duration: 3.4, ease: "power3.out", onUpdate: placeArrival }, X0 + .5);
	tl.to(exitPortal.uniforms.uOpen, { value: 0, duration: 2, ease: "power2.inOut", onComplete: () => { exitPortal.mesh.removeFromParent(); } }, X0 + 2.6);
	tl.to(shot, { shake: .5, duration: .05 }, X0 + .55).to(shot, { shake: 0, duration: 2 }, X0 + .6);
	// It coasts. The camera comes round ahead of it and looks back at it, so whatever is ahead is behind us.
	tl.to(arrival, { drift: 1, duration: 24, ease: "sine.out", onUpdate: placeArrival }, X0 + 3.9);
	const shipMid = arriveAt.clone().addScaledVector(arriveHeading, DRIFT * .4);
	const frontCamera = shipMid.clone().addScaledVector(arriveHeading, 36).addScaledVector(arriveSide, 26).addScaledVector(up, 7);
	tl.to(worldCamera.position, { x: frontCamera.x, y: frontCamera.y, z: frontCamera.z, duration: 5, ease: "sine.inOut" }, X0 + 3.6);
	tl.to(worldCamera.target, { x: shipMid.x, y: shipMid.y + 1, z: shipMid.z, duration: 5, ease: "sine.inOut" }, X0 + 3.6);
	tl.call(() => overlay.fade(0, .6), [], X0 + .45);
	tl.call(() => overlay.say("jarvis", "Sir. We are safe now.", 2.4), [], X0 + 4.6);
	tl.call(() => sound.void(.35), [], X0 + 4);
	// Something ahead. His light starts to come up, still behind us.
	tl.call(() => { overlay.protocol("Proximity", "Unknown entity", true); overlay.say("jarvis", "Sir… there is something ahead of us. Energy readings off every scale. That is not a star.", 3.6); }, [], X0 + 8);
	tl.call(() => sound.play("doom_sting", { gain: -6, space: .5 }), [], X0 + 8.2);
	// The score (an original cue, synthesised for this: sfx/SOURCES.md) from the warning to the fade: it builds
	// to its peak on "I am Doom", ducks under each of his lines, and cuts with the picture.
	tl.call(() => sound.play("doom_score", { gain: -3, space: .15 }), [], X0 + 7.5);
	reveal.arrive(tl, X0 + 8.3, camera);
	tl.to(keyLight, { level: .15, duration: 4 }, X0 + 9);
	// The turn: the camera pulls back and rises past the ship and pans round to find him, the light filling him.
	const doomChest = new Vector3(), doomFace = new Vector3();
	tl.call(() => { reveal.chestWorld(doomChest); reveal.faceWorld(doomFace); }, [], X0 + 8.4);
	const revealCamera = arriveAt.clone().addScaledVector(arriveHeading, DRIFT * .5 - 34).addScaledVector(arriveSide, 30).addScaledVector(up, 12);
	const pan = { k: 0 }, panFrom = new Vector3();
	// Each move takes its start from wherever the camera is on its first frame (an onStart can be skipped when
	// the playhead lands inside a tween; a first-update capture cannot).
	let panning = false;
	tl.to(pan, { k: 1, duration: 5, ease: "sine.inOut", onReverseComplete: () => { panning = false; }, onUpdate: () => {
		if (!panning) { panFrom.copy(worldCamera.position); panning = true; }
		const k = pan.k;
		worldCamera.position.lerpVectors(panFrom, revealCamera, k);
		worldCamera.target.copy(shipMid).lerp(doomChest, Math.min(1, k * 1.15));
	} }, X0 + 10);
	tl.call(() => sound.play("doom_reveal", { gain: -1, space: .5 }), [], X0 + 12.6);
	tl.to(shot, { shake: .6, duration: .06 }, X0 + 12.6).to(shot, { shake: 0, duration: 2.2 }, X0 + 12.7);
	// Low beneath the ship: he towers over it. Then up to his face.
	const tilt = { k: 0 }, tiltFrom = new Vector3();
	const lowCamera = arriveAt.clone().addScaledVector(arriveHeading, DRIFT + 14).addScaledVector(up, -16).addScaledVector(arriveSide, 34);
	let tilting = false;
	tl.to(tilt, { k: 1, duration: 5, ease: "sine.inOut", onReverseComplete: () => { tilting = false; }, onUpdate: () => {
		if (!tilting) { tiltFrom.copy(worldCamera.position); tilting = true; }
		worldCamera.position.lerpVectors(tiltFrom, lowCamera, tilt.k);
		worldCamera.target.copy(doomChest).lerp(doomFace, tilt.k * .6);
	} }, X0 + 15.2);
	const faceCamera = new Vector3();
	// Out to the side of the ship (clear of its hull), wide enough for the fire in his open hand and the mask.
	tl.call(() => { faceCamera.copy(doomFace).addScaledVector(arriveHeading, -42).addScaledVector(up, -12).addScaledVector(arriveSide, -16); }, [], X0 + 19.8);
	const rise = { k: 0 }, riseFrom = new Vector3();
	let rising = false;
	tl.to(rise, { k: 1, duration: 6, ease: "sine.inOut", onReverseComplete: () => { rising = false; }, onUpdate: () => { if (!rising) { riseFrom.copy(worldCamera.position); rising = true; } worldCamera.position.lerpVectors(riseFrom, faceCamera, rise.k); worldCamera.target.copy(doomChest).lerp(doomFace, .6 + .4 * rise.k); } }, X0 + 19.9);
	reveal.look(tl, X0 + 19.4);
	reveal.take(tl, X0 + 19.6);   // the wind rises in his cape as he speaks
	// His line, in three beats.
	// His voice (an original voice shaped behind an iron mask: see sfx/SOURCES.md), with the words on screen.
	tl.call(() => { overlay.say("doom", "Mr. Mohith.", 1.6); sound.play("doom_mohith", { gain: 0, space: .3 }); }, [], X0 + 20.6);
	tl.call(() => { overlay.say("doom", "I am Doom.", 2.2); sound.play("doom_iam", { gain: 0, space: .3 }); }, [], X0 + 22.4);
	tl.call(() => { overlay.say("doom", "And I am here to collect you.", 2.8); sound.play("doom_collect", { gain: 0, space: .3 }); }, [], X0 + 25.2);
	tl.call(() => { overlay.clearProtocol(); overlay.clearCaption(); overlay.fade(1, .35); }, [], X0 + 28.6);
	// Black, then his mark alone.
	tl.call(() => { worldCamera.on = false; reveal.mark(camera); overlay.fade(0, 1.4); sound.play("emblem", { gain: -2, space: .5 }); }, [], X0 + 29.4);
	tl.call(() => {
		const end = overlay.showEnd(`<h2>You escaped the pocket.<br>Not him.</h2><p>Doom is already here</p><small>Avengers: Doomsday · 18 December 2026 · a fan homage, not affiliated with Marvel</small><button type="button">Return to the pocket</button>`);
		end.querySelector("button")?.addEventListener("click", () => { void finish(true); });
		reveal.settle();
	}, [], X0 + 34.5);
	tl.call(() => { void finish(false); }, [], X0 + 47);



	// The timeline follows the scene's own clock, so it pauses with the tab.
	driveTimeline = () => { if (!finished) tl.seek(clock.time, false); };

	async function finish(skipped: boolean) {
		// Skipped while still loading: honoured the moment it is ready.
		if (!ready) { skipRequested = true; return; }
		if (finished) return; finished = true;
		overlay.clearCaption(); overlay.clearProtocol(); overlay.setAlarm(false); overlay.hideEnd();
		overlay.fade(1, skipped ? .45 : 1.4);
		await new Promise(resolve => window.setTimeout(resolve, skipped ? 500 : 1500));
		// Everything back where it was.
		tl.kill();
		ctx.app.off(quickEvents.PRE_UPDATED, frame); driveTimeline = null;
		for (const home of homes) {
			home.parent.attach(home.object);
			home.object.position.copy(home.position); home.object.quaternion.copy(home.quaternion); home.object.scale.copy(home.scale); home.object.visible = home.visible;
		}
		debris.removeFromParent();
		if (steam && steamRotation) steam.rotation.copy(steamRotation);
		ctx.night.value = nightWas;
		rig.restore();
		for (const f of falling) f.restore();
		if (windowSky) windowSky.visible = windowSkyWas;
		screens.restore(); heart.dispose(); walleFilm?.dispose(); if (robot) robot.visible = true;
		if (carriage && carriageHome) { carriage.position.copy(carriageHome.position); carriage.rotation.copy(carriageHome.rotation); }
		companion?.puppet?.(false);
		pocket.dispose(); hole.dispose();
		governor.hold(true); ctx.render?.scale(1); ctx.render?.portals(true); ctx.music?.hold(false);
		containers.forEach(c => { c.object.visible = c.visible; });
		boat.dispose(); hologram.dispose(); reveal.dispose(); lights.reset(); portal.dispose(); exitPortal.dispose(); streaks.dispose(); tunnel.dispose(); sound.dispose();
		(world as Scene).background = backgroundWas; ground.forEach(o => { o.visible = true; });
		if (floorPlane && floorHome) { floorPlane.position.y = floorHome.y; floorPlane.visible = floorHome.visible; }
		if (walle && walleFrom) walle.copy(walleFrom);
		modelScene.position.copy(sceneHome.position); modelScene.quaternion.copy(sceneHome.quaternion); modelScene.updateMatrixWorld(true);
		camera.position.copy(startPosition); camera.quaternion.copy(startQuaternion); camera.fov = startFov; camera.far = farWas; camera.updateProjectionMatrix();
		if (navigation) navigation.view.enabled = navigationWas;
		window.removeEventListener("keydown", onKey, true);
		overlay.letterbox(false);
		overlay.fade(0, 1.2);
		window.setTimeout(() => overlay.dispose(), 1400);
		running = null;
		ctx.onEnd?.();
	}

	ready = true;
	if (skipRequested) void finish(true);

	// --- Warm-up -------------------------------------------------------------------------------------------
	// Only what is on screen now is compiled before the film starts (the pocket, the hole), so it starts at
	// once. Everything for the later acts (hidden until then) is compiled in the background during Act I: each
	// hidden piece is moved for a moment into an off-screen scene, compiled there with the world's lights, and
	// put back, so it can never be seen early. Without this, each act's first frame stalled on its shaders.
	mark("timeline");
	try { await renderer.compileAsync(world, camera); await hole.warm(renderer); } catch (error) { console.warn("[doomsday] warm-up", error); }
	mark("compiled");
	warming = false; clock.last = performance.now();
	const compileHidden = async () => {
		const offstage = new Scene();
		const hidden: { object: Object3D; parent: Object3D; index: number }[] = [];
		world.traverse(o => { if (!before.has(o) && !o.visible && o.parent && o !== offstage) hidden.push({ object: o, parent: o.parent, index: o.parent.children.indexOf(o) }); });
		const set = new Set(hidden.map(h => h.object));
		const tops = hidden.filter(h => { for (let p: Object3D | null = h.parent; p; p = p.parent) if (set.has(p)) return false; return true; });
		const inner = hidden.filter(h => !tops.includes(h));
		const extra = [portal.mesh, exitPortal.mesh].filter(m => !m.parent);
		tops.forEach(h => { offstage.add(h.object); h.object.visible = true; });
		inner.forEach(h => { h.object.visible = true; });
		extra.forEach(m => offstage.add(m));
		try { await renderer.compileAsync(offstage, camera, world as Scene); } catch (error) { console.warn("[doomsday] background compile", error); }
		inner.forEach(h => { h.object.visible = false; });
		tops.forEach(h => { h.object.visible = false; h.parent.add(h.object); });
		extra.forEach(m => m.removeFromParent());
	};
	void (async () => {
		await compileHidden();
		// The figure and the sounds arrive on their own time; the figure is compiled the same way once it lands.
		await Promise.all([reveal.ready, sound.load()]);
		if (!finished) await compileHidden();
	})();
	if (import.meta.dev) (window as unknown as { __doomsday?: unknown }).__doomsday = { seek: (s: number) => { clock.time = s; }, timeline: tl, renderer, tier, clockTime: () => clock.time, pocket, hole, shot, freeze: (on: boolean) => { frozen = on; governor.hold(on); }, governor, worldCamera, cam4, reveal, warp: { portal, exitPortal, tunnel }, marks: { P0: T(49.4), W0: T(69.6), S0: T(72.6), H0, E0, I0, A0, D0, Y0, J0, X0 } };
}
