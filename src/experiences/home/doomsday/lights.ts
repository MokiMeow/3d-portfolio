import { Color, DirectionalLight, HemisphereLight, PointLight, type Object3D } from "three";

/**
 * The film's own lights: two directional, two point and a sky fill, shared by every act. The room has ~460 lit
 * materials, and any change to the light count recompiles them all (seconds, on the click). So the four are
 * made once, when the lab is built, and stay in it dark (intensity 0): the room's shaders are compiled with
 * them from the start, and the film only re-aims, re-colours and dims them. Whoever is aiming the key and
 * fill says so (`owner`).
 */
export type FilmLights = ReturnType<typeof filmLights>;

const made = new WeakMap<Object3D, ReturnType<typeof make>>();

function make(parent: Object3D) {
	const key = new DirectionalLight(new Color("#ffcf96"), 0);
	const fill = new DirectionalLight(new Color("#9cb8ff"), 0);
	const a = new PointLight(new Color("#8fb8ff"), 0, 34, 2);
	const b = new PointLight(new Color("#ffb066"), 0, 14, 1.6);
	// In space nothing fills the shadows, so whatever faces away from the key (the belly, the engine bay, the
	// lower hull) went pure black and read as holes. A faint sky light: warm from above, cold from below.
	const sky = new HemisphereLight(new Color("#ffd8b0"), new Color("#6878a8"), 0);
	key.name = "film_key"; fill.name = "film_fill"; a.name = "film_a"; b.name = "film_b"; sky.name = "film_sky";
	parent.add(key, key.target, fill, fill.target, a, b, sky);
	const rig = {
		key, fill, a, b, sky,
		owner: "boat" as "boat" | "finale" | "tunnel",
		/** After the film: all dark again, still in place (removing them would recompile the room). */
		reset() {
			for (const l of [key, fill, a, b, sky]) l.intensity = 0;
			sky.color.set("#ffd8b0"); sky.groundColor.set("#6878a8");
			key.color.set("#ffcf96"); fill.color.set("#9cb8ff"); a.color.set("#8fb8ff"); b.color.set("#ffb066");
			a.distance = 34; a.decay = 2; b.distance = 14; b.decay = 1.6;
			rig.owner = "boat";
		},
	};
	return rig;
}

/** The lab's film lights (made on first call, then the same four every time). */
export function filmLights(parent: Object3D) {
	let rig = made.get(parent);
	if (!rig) { rig = make(parent); made.set(parent, rig); }
	return rig;
}
