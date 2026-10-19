/**
 * The frame governor. THE POCKET runs on everything from a desktop GPU to a laptop's integrated one, at
 * device pixel ratios up to 2: rather than pick one quality up front, it watches real frame times and
 * trades resolution for smoothness, a step at a time, never more often than every 1.2 s (each change
 * reallocates buffers). Down fast when frames run long, back up slowly once they have been short for a while.
 *
 * The scale multiplies the room's own pixel ratio and the black hole's trace resolution and step count.
 */
export type Governor = {
	/** The current scale, .5 to 1. */
	readonly scale: number;
	/** Feed every frame's real interval, in milliseconds. */
	tick(ms: number): void;
	/** Hold the scale (the film harness: deterministic frames). */
	hold(on: boolean): void;
};

const STEPS = [1, .9, .8, .7, .6, .5];

export function createGovernor(apply: (scale: number) => void, start = 0): Governor {
	let index = Math.max(0, Math.min(STEPS.length - 1, start));
	let held = false;
	let average = 16.7, slow = 0, fast = 0, since = 0;
	apply(STEPS[index]!);
	const set = (next: number) => {
		next = Math.max(0, Math.min(STEPS.length - 1, next));
		if (next === index) return;
		index = next; since = 0; slow = fast = 0;
		apply(STEPS[index]!);
	};
	return {
		get scale() { return STEPS[index]!; },
		tick(ms) {
			if (held || !(ms > 0) || ms > 250) return;   // ignore stalls (tab switches, loads): they are not load
			average += (ms - average) * .1;
			since += ms;
			// Over budget for ~0.6 s: drop a step. Comfortably under for ~4 s: try one up.
			if (average > 21) { slow += ms; fast = 0; } else if (average < 13.5) { fast += ms; slow = 0; } else { slow = fast = 0; }
			if (since < 1200) return;
			if (slow > 600) set(index + 1);
			else if (fast > 4000) set(index - 1);
		},
		hold(on) { held = on; if (on) set(0); },
	};
}
