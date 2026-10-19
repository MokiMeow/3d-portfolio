/**
 * Warm the browser's cache for THE POCKET while the lab sits idle, so the click on the crack starts the film
 * at once: the film's code, its models and its sound cues are fetched (not parsed, not uploaded) in the
 * background, a few at a time, at low priority. Safe to call more than once.
 */
const MODELS = ["/doomsday/draco/draco_wasm_wrapper.js", "/doomsday/draco/draco_decoder.wasm", "/doomsday/pocket-shards.glb", "/doomsday/lifeboat.glb", "/doomsday/walle-boxable.glb", "/doomsday/doom.glb", "/doomsday/emblem.mp4"];
const SOUNDS = [
	"knock_1", "knock_2", "knock_3", "crack_1", "crack_2", "crack_3", "crack_4", "crack_5", "crack_6", "crack_run", "breach", "tear",
	"hole_arrival", "debris_loop", "hole_loop", "alarm_loop", "strain_loop", "void_loop", "core_loop", "engine_loop", "hyper_loop",
	"servo_1", "servo_2", "servo_3", "servo_4", "servo_long", "hydraulic", "slide", "latch_1", "latch_2", "charge", "power_on", "glass_rise",
	"ignite", "flyby", "whoosh_1", "whoosh_2", "whoosh_3", "whoosh_4", "hyper_charge", "hyper_jump", "hyper_exit", "doom_reveal", "doom_sting", "emblem", "doom_forfeit", "doom_mohith", "doom_iam", "doom_collect", "doom_score",
].map(name => `/doomsday/sfx/${name}.mp3`);

let started = false;
export function preloadDoomsday(loadCode: () => Promise<unknown>) {
	if (started || typeof window === "undefined") return;
	started = true;
	const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
	const idle = (fn: () => void) => { if (ric) ric.call(window, fn, { timeout: 4000 }); else globalThis.setTimeout(fn, 1500); };
	idle(() => {
		void loadCode().catch(() => { /* the click will try again */ });
		const queue = [...MODELS, ...SOUNDS];
		const next = () => {
			const url = queue.shift(); if (!url) return;
			void fetch(url, { cache: "force-cache", priority: "low" } as RequestInit).then(r => r.arrayBuffer()).catch(() => {}).finally(next);
		};
		for (let i = 0; i < 3; i++) next();
	});
}
