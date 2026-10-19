import gsap from "gsap";
import {
	Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, VideoTexture,
	type Object3D, type PerspectiveCamera, type Texture,
} from "three";
import { createFinale, DOOM_SCALE } from "./finale";
import type { FilmLights } from "./lights";

/**
 * Act V: the one who was waiting. Doom (an original figure built in Blender: doom/pass*.py) stands ahead
 * of where the fold put the ship, vast, in green smoke, already facing it. He was there all along: the light
 * finds him from behind, his arm comes up towards the ship, the eyes light last. Then black, and his mark.
 *
 * Everything is in the model's frame, at the room's scale.
 */
const SHIP = new Vector3(2.85, 3, 3);
/** Where he stands: ahead of the ship and far below it, so it hangs at his chest. */
const FEET = new Vector3(SHIP.x - 1.2, -40, SHIP.z + 62);
type Level = "smoke" | "rim" | "eyes" | "reach" | "gust" | "flame";

export function createReveal(parent: Object3D, env: Texture, lights: FilmLights) {
	let finale: Awaited<ReturnType<typeof createFinale>> | null = null;
	const ready = createFinale(parent, env, lights).then(f => {
		finale = f;
		f.root.position.copy(FEET);
		return f;
	}).catch(error => { console.warn("[doomsday] reveal assets", error); return null; });

	// A green light that rises under the ship as he reaches for it, and one at his face for the eyes.
	// The film's shared point lights (lights.ts), re-aimed when Act V begins.
	const under = lights.a, glare = lights.b;
	const aim = () => {
		under.color.set("#43f08e"); under.distance = 90; under.decay = 1.6; under.position.set(SHIP.x, SHIP.y - 4, SHIP.z + 6); under.intensity = 0;
		glare.color.set("#43f08e"); glare.distance = 80; glare.decay = 1.4; glare.position.set(FEET.x, FEET.y + 1.78 * DOOM_SCALE, FEET.z - 6); glare.intensity = 0;
	};

	// The mark: the emblem film (rendered in Blender), shown on black in front of the lens.
	const video = document.createElement("video");
	video.src = "/doomsday/emblem.mp4"; video.muted = true; video.playsInline = true; video.preload = "auto"; video.crossOrigin = "anonymous";
	const markTexture = new VideoTexture(video); markTexture.colorSpace = SRGBColorSpace;
	const markMat = new MeshBasicMaterial({ map: markTexture, transparent: true, opacity: 0, toneMapped: false, depthTest: false, depthWrite: false });
	const sigil = new Mesh(new PlaneGeometry(1, 1), markMat); sigil.renderOrder = 901; sigil.visible = false;
	// A plate behind it hides whatever is left of the scene; transparent only so it sorts after the glows.
	const blackMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, depthWrite: false, depthTest: false });
	const black = new Mesh(new PlaneGeometry(1, 1), blackMat); black.renderOrder = 900; black.visible = false;

	const markState = { size: 1, up: 0 };
	let flaming = false;
	const fireAt = new Vector3();
	let marked: PerspectiveCamera | null = null;
	let viewer: PerspectiveCamera | null = null;
	/** Tween one of the finale's levels from wherever it is, whenever the figure has loaded. */
	const level = (tl: gsap.core.Timeline, name: Level, value: number, duration: number, at: number, ease = "power1.inOut") => {
		const progress = { v: 0 }; let from = 0;
		tl.fromTo(progress, { v: 0 }, { v: 1, duration, ease, immediateRender: false,
			onStart() { from = finale?.levels[name] ?? 0; },
			onUpdate() { if (finale) finale.levels[name] = from + (value - from) * progress.v; },
		}, at);
	};
	return {
		ready,
		get finale() { return finale; },
		/** Stand him in the world (not in the ship's frame), so the ship can drift towards him. Ship-frame offset
		 * of his feet from the ship's centre is `FEET - SHIP`; `shipMatrix` is where the ship will be when it stops. */
		placeInWorld(world: Object3D, shipMatrix: Matrix4, shipQuaternion: Quaternion, scale: number) {
			if (!finale) return;
			world.add(finale.root);
			finale.root.position.copy(FEET).applyMatrix4(shipMatrix);
			finale.root.quaternion.copy(shipQuaternion);
			finale.root.scale.setScalar(scale);
			finale.root.updateMatrixWorld(true);
		},
		/** Where his eyes are, in the world (after placeInWorld). */
		faceWorld(out = new Vector3()) {
			if (!finale) return out;
			return finale.root.localToWorld(out.set(.05 * DOOM_SCALE, 1.8 * DOOM_SCALE, -.2 * DOOM_SCALE));
		},
		/** Where his chest is, in the world. */
		chestWorld(out = new Vector3()) {
			if (!finale) return out;
			return finale.root.localToWorld(out.set(0, 1.35 * DOOM_SCALE, 0));
		},
		/** He was there all along: in the dark first, then the smoke and the light from behind find him. */
		arrive(tl: gsap.core.Timeline, at: number, camera: PerspectiveCamera) {
			tl.call(() => { viewer = camera; aim(); if (finale) finale.root.visible = true; }, [], at);
			level(tl, "smoke", 1, 6, at + .2);
			level(tl, "rim", 1, 5, at + .5, "power1.in");
		},
		/** He speaks. No gesture, no fire: him standing there is enough. Only the wind rises in his cape.
		 * (The hand-fire and its light still exist in finale.ts at level 0, unused.) */
		take(tl: gsap.core.Timeline, at: number) {
			level(tl, "gust", .8, 2.2, at + .6);
		},
		/** The last thing to light. */
		look(tl: gsap.core.Timeline, at: number) {
			level(tl, "eyes", 1, 1.8, at, "power2.in");
			tl.to(glare, { intensity: 90, duration: 1.8, ease: "power2.in" }, at);
		},
		/** Black, then his mark alone, held in front of the lens wherever the lens is. */
		mark(camera: PerspectiveCamera) {
			if (finale) finale.root.visible = false;
			marked = camera;
			parent.add(sigil, black); sigil.visible = true; black.visible = true;
			video.currentTime = 0; void video.play().catch(() => {});
			gsap.to(markMat, { opacity: 1, duration: 1.6, ease: "power2.out" });
			gsap.fromTo(markState, { size: 1.12 }, { size: 1, duration: 3.4, ease: "power2.out" });
		},
		/** Make room for the end card: the mark rises above the words and shrinks to a seal. */
		settle() {
			gsap.to(markState, { size: .36, up: .3, duration: 1.4, ease: "power3.inOut" });
		},
		/** Each frame: the figure lives; the mark (and its black) stays square to the camera. */
		update(time: number) {
			if (finale && viewer) finale.update(time, viewer.getWorldQuaternion(new Quaternion()));
			// Once the fire is lit, the green light lives in his palm (and flickers with it).
			if (finale && flaming) { under.position.copy(parent.worldToLocal(finale.flameWorld(fireAt))); under.distance = 2.2 * DOOM_SCALE; under.decay = 1.4; }
			if (!marked) return;
			const camera = marked, distance = 6;
			const facing = camera.quaternion.clone().premultiply(parent.getWorldQuaternion(new Quaternion()).invert());
			const scale = parent.getWorldScale(new Vector3()).x;
			const frame = (d: number) => 2 * d * Math.tan(camera.fov * Math.PI / 360) / scale;
			const place = (object: Object3D, d: number, up: number) => {
				const ahead = camera.getWorldPosition(new Vector3())
					.add(camera.getWorldDirection(new Vector3()).multiplyScalar(d))
					.add(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(up * frame(d) * scale));
				object.position.copy(parent.worldToLocal(ahead)); object.quaternion.copy(facing);
			};
			place(black, distance + 1, 0); black.scale.set(frame(distance + 1) * camera.aspect * 1.2, frame(distance + 1) * 1.2, 1);
			place(sigil, distance, markState.up);
			// About three fifths of the frame's height, whatever the lens and the model's scale.
			sigil.scale.setScalar(frame(distance) * .6 * markState.size);
		},
		dispose() {
			gsap.killTweensOf([under, glare, markMat, markState]);
			video.pause(); video.removeAttribute("src"); video.load();
			finale?.dispose(); finale?.root.removeFromParent(); sigil.removeFromParent(); black.removeFromParent();
			markMat.dispose(); markTexture.dispose(); sigil.geometry.dispose(); blackMat.dispose(); black.geometry.dispose();
		},
	};
}
