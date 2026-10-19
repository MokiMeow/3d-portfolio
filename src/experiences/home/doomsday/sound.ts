/**
 * THE POCKET's sound: designed cues (public/doomsday/sfx, built from CC0 recordings, see SOURCES.md) played
 * through one small mix: cues and loops -> a shared space reverb -> a "horizon" low-pass -> glue compressor
 * -> limiter -> gate -> master. Create it in the launch click (browsers only start audio from a gesture);
 * call load() while the film warms up; everything after is fire-and-forget and seek-safe.
 *
 * Loops (the hole, debris, strain, the core, the engines, hyperspace, the void) run continuously at a level
 * the director sets; one-shots are cues. A cue that has not decoded yet is simply skipped.
 */
const MUTE_KEY = "doomsday-muted";
const BASE = "/doomsday/sfx/";
const CUES = [
	"knock_1", "knock_2", "knock_3", "crack_1", "crack_2", "crack_3", "crack_4", "crack_5", "crack_6", "crack_run", "breach", "tear",
	"hole_arrival", "servo_1", "servo_2", "servo_3", "servo_4", "servo_long", "hydraulic", "slide", "latch_1", "latch_2",
	"charge", "power_on", "glass_rise", "ignite", "flyby", "whoosh_1", "whoosh_2", "whoosh_3", "whoosh_4",
	"hyper_charge", "hyper_jump", "hyper_exit", "doom_reveal", "doom_sting", "emblem", "doom_forfeit", "doom_mohith", "doom_iam", "doom_collect", "doom_score",
] as const;
const LOOPS = ["debris_loop", "hole_loop", "alarm_loop", "strain_loop", "void_loop", "core_loop", "engine_loop", "hyper_loop"] as const;
export type Cue = typeof CUES[number];
export type Loop = typeof LOOPS[number];

const unit = (v: number) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
const db = (v: number) => Math.pow(10, v / 20);
function glide(param: AudioParam, value: number, now: number, time = .15) {
	if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
	else { const v = param.value; param.cancelScheduledValues(now); param.setValueAtTime(v, now); }
	param.setTargetAtTime(value, now, time);
}

type Bus = { ctx: AudioContext; input: GainNode; send: GainNode; horizon: BiquadFilterNode; gate: GainNode; master: GainNode; nodes: AudioNode[] };
type Playing = { source: AudioBufferSourceNode; gain: GainNode; rate: number };

class PocketSound {
	private bus: Bus | null = null;
	private buffers = new Map<string, AudioBuffer>();
	private loops = new Map<Loop, Playing>();
	private loopLevels = new Map<Loop, number>();
	private live = new Set<AudioBufferSourceNode>();
	private loading: Promise<void> | null = null;
	private isMuted = false;
	private stretched = false;
	private silent = false;
	private disposed = false;
	private lastCrack = -1;
	private volume = .9;

	constructor() {
		if (typeof window === "undefined") return;
		try { const s = window.localStorage.getItem(MUTE_KEY); this.isMuted = s === "true" || s === "1"; } catch { /* storage may be unavailable */ }
		this.ensure();
		window.addEventListener("pointerdown", this.gesture, true);
		window.addEventListener("keydown", this.gesture, true);
		document.addEventListener("visibilitychange", this.visibility);
	}
	private gesture = () => { const b = this.ensure(); if (b && b.ctx.state === "suspended") void b.ctx.resume().catch(() => {}); };
	private visibility = () => {
		const b = this.bus; if (!b || this.disposed) return;
		if (document.hidden) void b.ctx.suspend().catch(() => {}); else void b.ctx.resume().catch(() => {});
	};
	private ensure(): Bus | null {
		if (this.disposed || typeof window === "undefined") return null;
		if (this.bus) return this.bus;
		const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		let ctx: AudioContext;
		try { ctx = new Ctor({ latencyHint: "playback" }); } catch { return null; }
		const input = ctx.createGain(), send = ctx.createGain(), wet = ctx.createGain(), reverb = ctx.createConvolver();
		const horizon = ctx.createBiquadFilter(); horizon.type = "lowpass"; horizon.frequency.value = 20000; horizon.Q.value = .6;
		const rumble = ctx.createBiquadFilter(); rumble.type = "highpass"; rumble.frequency.value = 24;
		const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -18; glue.knee.value = 12; glue.ratio.value = 2.5; glue.attack.value = .02; glue.release.value = .25;
		const limit = ctx.createDynamicsCompressor(); limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = .002; limit.release.value = .1;
		const gate = ctx.createGain(), master = ctx.createGain(); master.gain.value = this.isMuted ? 0 : this.volume;
		// A big dark space: the far side of the pocket, the void. One convolver for every cue's send.
		const seconds = 3.4, ir = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
		for (let ch = 0; ch < 2; ch++) {
			const d = ir.getChannelData(ch); let lp = 0;
			for (let i = 0; i < d.length; i++) { lp = lp * .55 + (Math.random() * 2 - 1) * .45; d[i] = lp * Math.pow(1 - i / d.length, 2.6) * Math.min(1, i / (ctx.sampleRate * .02)); }
		}
		reverb.buffer = ir; wet.gain.value = .5;
		input.connect(horizon); send.connect(reverb); reverb.connect(wet); wet.connect(horizon);
		horizon.connect(rumble); rumble.connect(glue); glue.connect(limit); limit.connect(gate); gate.connect(master); master.connect(ctx.destination);
		this.bus = { ctx, input, send, horizon, gate, master, nodes: [input, send, wet, reverb, horizon, rumble, glue, limit, gate, master] };
		return this.bus;
	}

	/** Fetch and decode every cue; resolves when all have settled (failures just leave a cue silent). */
	load() {
		if (this.loading) return this.loading;
		const bus = this.ensure(); if (!bus) return (this.loading = Promise.resolve());
		const one = async (name: string) => {
			try {
				const response = await fetch(BASE + name + ".mp3");
				if (!response.ok) return;
				const buffer = await bus.ctx.decodeAudioData(await response.arrayBuffer());
				if (!this.disposed) this.buffers.set(name, buffer);
			} catch { /* a missing cue stays silent */ }
		};
		// Loops and the early acts first, so the opening never waits on the ending.
		const order = [...LOOPS, ...CUES];
		this.loading = (async () => { for (let i = 0; i < order.length; i += 6) await Promise.all(order.slice(i, i + 6).map(one)); })();
		return this.loading;
	}

	get muted() { return this.isMuted; }
	set muted(value: boolean) {
		this.isMuted = !!value;
		try { window.localStorage.setItem(MUTE_KEY, String(this.isMuted)); } catch { /* session only */ }
		const b = this.bus; if (b) glide(b.master.gain, this.isMuted ? 0 : this.volume, b.ctx.currentTime, .03);
	}

	/** A one-shot. gain in dB; rate < 1 lowers and lengthens it; pan -1..1; space is the reverb send. */
	play(name: Cue, { gain = 0, rate = 1, pan = 0, space = .25, delay = 0 }: { gain?: number; rate?: number; pan?: number; space?: number; delay?: number } = {}) {
		const b = this.ensure(), buffer = this.buffers.get(name);
		if (!b || !buffer || b.ctx.state !== "running") return;
		this.wake();
		const source = b.ctx.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate * (this.stretched ? .8 : 1);
		const g = b.ctx.createGain(); g.gain.value = db(gain);
		const panner = b.ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan));
		const s = b.ctx.createGain(); s.gain.value = space;
		source.connect(g); g.connect(panner); panner.connect(b.input); panner.connect(s); s.connect(b.send);
		source.onended = () => { this.live.delete(source); source.disconnect(); g.disconnect(); panner.disconnect(); s.disconnect(); };
		this.live.add(source);
		source.start(b.ctx.currentTime + Math.max(0, delay));
	}

	/** A continuous bed at `level` (0..1, perceptual), optionally re-pitched. Level 0 fades it out. */
	loop(name: Loop, level: number, { rate = 1, gain = 0, time = .4 }: { rate?: number; gain?: number; time?: number } = {}) {
		level = unit(level);
		const b = this.ensure(); if (!b) return;
		let playing = this.loops.get(name);
		const target = level === 0 ? 0 : db(gain) * level * level;
		if (!playing) {
			if (!level) return;
			const buffer = this.buffers.get(name); if (!buffer || b.ctx.state !== "running") return;
			this.wake();
			const source = b.ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
			const g = b.ctx.createGain(); g.gain.value = 0;
			const s = b.ctx.createGain(); s.gain.value = .12;
			source.connect(g); g.connect(b.input); g.connect(s); s.connect(b.send);
			source.start(b.ctx.currentTime, Math.random() * buffer.duration);
			playing = { source, gain: g, rate: 1 }; this.loops.set(name, playing);
		}
		if (this.loopLevels.get(name) !== target) { this.loopLevels.set(name, target); glide(playing.gain.gain, target, b.ctx.currentTime, time); }
		const r = rate * (this.stretched ? .8 : 1);
		if (Math.abs(playing.rate - r) > .003) { playing.rate = r; glide(playing.source.playbackRate, r, b.ctx.currentTime, .5); }
		if (!level) {
			const p = playing; this.loops.delete(name); this.loopLevels.delete(name);
			try { p.source.stop(b.ctx.currentTime + time * 5); } catch { /* already stopped */ }
			p.source.onended = () => { p.source.disconnect(); p.gain.disconnect(); };
		}
	}

	/** Near the horizon: the whole mix darkens and drops in pitch. */
	stretch(on: boolean) {
		if (on === this.stretched) return; this.stretched = on;
		const b = this.bus; if (!b) return;
		const now = b.ctx.currentTime;
		glide(b.horizon.frequency, on ? 900 : 20000, now, .6);
		for (const p of this.loops.values()) { p.rate = p.rate * (on ? .8 : 1.25); glide(p.source.playbackRate, p.rate, now, .6); }
	}
	/** Fade everything to nothing; the next cue opens the gate again. */
	silence(seconds = .1) {
		const b = this.bus; if (!b) return;
		glide(b.gate.gain, 0, b.ctx.currentTime, Math.max(.01, seconds / 3));
		for (const name of [...this.loops.keys()]) this.loop(name, 0, { time: Math.max(.01, seconds / 3) });
		this.silent = true;
	}
	private wake() { const b = this.bus; if (!b || !this.silent) return; this.silent = false; glide(b.gate.gain, 1, b.ctx.currentTime, .01); }

	// --- The director's vocabulary --------------------------------------------------------------------
	knock(i = 0) { this.play((["knock_1", "knock_2", "knock_3"] as const)[i % 3]!, { gain: 0, space: .5 }); }
	/** Fracture ticks: rate-limited so a tween calling it every frame gives a scatter, not a buzz. */
	crack(intensity: number) {
		intensity = unit(intensity); const b = this.bus; if (!intensity || !b) return;
		const now = b.ctx.currentTime; if (now - this.lastCrack < .16 - intensity * .08) return; this.lastCrack = now;
		const n = (1 + Math.floor(Math.random() * 6)) as 1 | 2 | 3 | 4 | 5 | 6;
		this.play(`crack_${n}`, { gain: -10 + intensity * 8, rate: .8 + Math.random() * .35, pan: Math.random() * 1.2 - .6, space: .35 });
	}
	tear() { this.play("tear", { gain: -2, space: .4 }); }
	breach() { this.play("breach", { gain: 0, space: .5 }); }
	hole(level: number) { this.loop("hole_loop", level, { gain: 2, time: 1.2 }); }
	debris(level: number) { this.loop("debris_loop", level, { gain: -2, time: 1 }); }
	strain(level: number) { this.loop("strain_loop", level, { gain: 2, rate: .9 + level * .15, time: .8 }); }
	alarm(on: boolean) { this.loop("alarm_loop", on ? .7 : 0, { gain: -4, time: on ? .2 : .6 }); }
	void(level: number) { this.loop("void_loop", level, { gain: 0, time: 2 }); }
	servo(duration: number, pitch = .5) {
		const long = duration > 2.2;
		this.play(long ? "servo_long" : (["servo_1", "servo_2", "servo_3", "servo_4"] as const)[Math.floor(Math.random() * 4)]!, { gain: long ? -12 : -11, rate: .85 + unit(pitch) * .3, pan: Math.random() * .6 - .3, space: .2 });
	}
	latch() { this.play(Math.random() < .5 ? "latch_1" : "latch_2", { gain: -6, rate: .9 + Math.random() * .2, space: .3 }); }
	seal() { this.play("slide", { gain: -6, space: .3 }); this.play("latch_2", { gain: -5, delay: .8 }); }
	reactor(level: number) { this.loop("core_loop", level, { gain: 0, rate: .85 + level * .2, time: .8 }); }
	engine(level: number) { this.loop("engine_loop", level, { gain: 0, rate: .8 + level * .3, time: .25 }); }
	ignite() { this.play("ignite", { gain: 0, space: .4 }); }
	whoosh(gain = -4) { this.play((["whoosh_1", "whoosh_2", "whoosh_3", "whoosh_4"] as const)[Math.floor(Math.random() * 4)]!, { gain, pan: Math.random() * .8 - .4, space: .3 }); }
	/** The jump in one call (the spool-up is play("hyper_charge")). */
	hyperspace() { this.play("hyper_jump", { gain: 0, space: .5 }); this.loop("hyper_loop", .9, { time: .3 }); }
	sting() { this.play("doom_sting", { gain: -2, space: .5 }); }

	dispose() {
		if (this.disposed) return; this.disposed = true;
		if (typeof window !== "undefined") { window.removeEventListener("pointerdown", this.gesture, true); window.removeEventListener("keydown", this.gesture, true); document.removeEventListener("visibilitychange", this.visibility); }
		const b = this.bus; this.bus = null;
		for (const s of this.live) { try { s.stop(); } catch { /* ended */ } }
		for (const p of this.loops.values()) { try { p.source.stop(); } catch { /* ended */ } }
		this.live.clear(); this.loops.clear(); this.buffers.clear();
		if (b) { glide(b.master.gain, 0, b.ctx.currentTime, .05); window.setTimeout(() => { b.nodes.forEach(n => n.disconnect()); void b.ctx.close().catch(() => {}); }, 300); }
	}
}

export function createSound() { return new PocketSound(); }
export type Sound = PocketSound;
