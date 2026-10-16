/**
 * Original sound for THE POCKET. Call createSound in the launch click, before any await.
 * Construction outside a gesture waits for the next trusted pointer/key/click event. No frame loop,
 * worklet or ScriptProcessor: AudioParams and the audio clock do the work. Level setters allocate
 * only when a layer starts. Four beds (11 sources), 12 effect groups and two voices share one convolver.
 * Excess effects/voices and cues before unlock are dropped; no delayed surprise playback.
 * Generated buffers cost about 1.1 MB at 48 kHz; voice files are additional (six cached URLs).
 */
const MUTE_KEY = "doomsday-muted";
const MAX_EFFECTS = 12;
const unit = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const seconds = (value: number, fallback: number, max: number) => Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback;

function hold(param: AudioParam, now: number) {
	if (typeof param.cancelAndHoldAtTime === "function") param.cancelAndHoldAtTime(now);
	else { const value = param.value; param.cancelScheduledValues(now); param.setValueAtTime(value, now); }
}
function target(param: AudioParam, value: number, now: number, time = .12) {
	hold(param, now); param.setTargetAtTime(value, now, time);
}

/** One owned group of sources. Ending the last source disconnects every node in the group. */
class SoundLayer {
	readonly output: GainNode;
	readonly pitches: { param: AudioParam; base: number }[] = [];
	private nodes: AudioNode[] = [];
	private sources: { node: AudioScheduledSourceNode; end: number }[] = [];
	private remaining = 0;
	private dead = false;
	private ratio = 1;
	level = 0;

	constructor(readonly ctx: AudioContext, dry: AudioNode, wet: AudioNode, send: number, private done: (layer: SoundLayer) => void) {
		this.output = this.own(ctx.createGain()); this.output.connect(dry);
		if (send > 0) { const gain = this.own(ctx.createGain()); gain.gain.value = send; this.output.connect(gain); gain.connect(wet); }
	}
	own<T extends AudioNode>(node: T): T { this.nodes.push(node); return node; }
	pitch(param: AudioParam, base: number) { param.value = base; this.pitches.push({ param, base }); }
	start(node: AudioScheduledSourceNode, at: number, end = Infinity, offset?: number) {
		this.own(node); this.sources.push({ node, end }); this.remaining++;
		node.onended = this.ended;
		if (offset !== undefined) (node as AudioBufferSourceNode).start(at, offset);
		else node.start(at);
		if (Number.isFinite(end)) node.stop(end);
	}
	private ended = () => { if (--this.remaining === 0) this.dispose(); };
	tune(ratio: number, now: number) {
		if (ratio === this.ratio) return;
		this.ratio = ratio;
		for (let i = 0; i < this.pitches.length; i++) {
			const pitch = this.pitches[i]!;
			target(pitch.param, pitch.base * ratio, now, .28);
		}
	}
	fade(duration: number, delay = 0) {
		const now = this.ctx.currentTime + delay, end = now + duration;
		hold(this.output.gain, now); this.output.gain.linearRampToValueAtTime(0, end);
		for (let i = 0; i < this.sources.length; i++) {
			const source = this.sources[i]!;
			source.node.stop(Math.min(source.end, end));
		}
	}
	dispose() {
		if (this.dead) return; this.dead = true;
		for (let i = 0; i < this.sources.length; i++) { const source = this.sources[i]!.node; source.onended = null; source.stop(); }
		for (let i = 0; i < this.nodes.length; i++) this.nodes[i]!.disconnect();
		this.sources.length = 0; this.nodes.length = 0; this.pitches.length = 0;
		this.done(this);
	}
}

type Graph = {
	ctx: AudioContext; effects: GainNode; send: GainNode; wet: GainNode; mix: GainNode; convolver: ConvolverNode;
	lowpass: BiquadFilterNode; gate: GainNode; output: GainNode; nodes: AudioNode[];
	noise: AudioBuffer; wander: AudioBuffer; impulse: AudioBuffer;
};
type VoiceJob = { cancel(duration?: number): void; duck: number; playing: boolean };

class PocketSound {
	private graph: Graph | null = null;
	private disposed = false;
	private unlocked = false;
	private volume = .7;
	private isMuted = false;
	private silent = false;
	private stretched = false;
	private groups = new Set<SoundLayer>();
	private effects = new Set<SoundLayer>();
	private voices = new Set<VoiceJob>();
	private cache = new Map<string, AudioBuffer>();
	private holeLayer: SoundLayer | null = null;
	private strainLayer: SoundLayer | null = null;
	private reactorLayer: SoundLayer | null = null;
	private engineLayer: SoundLayer | null = null;
	private alarmLayer: SoundLayer | null = null;
	private alarmOn = false;
	private alarmTimer: number | undefined;
	private lastAlarm = -Infinity;
	private lastCrack = -Infinity;

	constructor() {
		if (typeof window === "undefined") return;
		try { const stored = window.localStorage.getItem(MUTE_KEY); this.isMuted = stored === "true" || stored === "1"; } catch { /* Private storage may be unavailable. */ }
		window.addEventListener("pointerdown", this.gesture, true);
		window.addEventListener("keydown", this.gesture, true);
		window.addEventListener("click", this.gesture);
		document.addEventListener("visibilitychange", this.visibility);
		if (window.navigator.userActivation?.isActive) { this.unlocked = true; this.ready(); }
	}
	get muted() { return this.isMuted; }
	set muted(value: boolean) {
		this.isMuted = !!value;
		if (typeof window !== "undefined") { try { window.localStorage.setItem(MUTE_KEY, String(this.isMuted)); } catch { /* The current session still honours mute. */ } }
		const graph = this.graph;
		if (graph) {
			const now = graph.ctx.currentTime; hold(graph.output.gain, now);
			graph.output.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.volume, now + .025);
		}
	}
	private gesture = (event: Event) => {
		if (!event.isTrusted) return;
		this.unlocked = true; this.ready();
	};
	private visibility = () => {
		const graph = this.graph; if (!graph || this.disposed) return;
		if (document.hidden) void graph.ctx.suspend().catch(() => { /* Audio is optional if the browser refuses or interrupts playback. */ });
		else void graph.ctx.resume().catch(() => { /* Audio is optional if the browser refuses or interrupts playback. */ });
	};
	private removeGestures() {
		if (typeof window === "undefined") return;
		window.removeEventListener("pointerdown", this.gesture, true);
		window.removeEventListener("keydown", this.gesture, true);
		window.removeEventListener("click", this.gesture);
	}
	private ready(): Graph | null {
		if (this.disposed || typeof window === "undefined") return null;
		if (!this.unlocked) {
			if (!window.navigator.userActivation?.isActive) return null;
			this.unlocked = true;
		}
		if (!this.graph) {
			const Constructor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!Constructor) return null;
			let ctx: AudioContext;
			try { ctx = new Constructor({ latencyHint: "interactive" }); } catch { return null; }
			const effects = ctx.createGain(), send = ctx.createGain(), mix = ctx.createGain();
			const convolver = ctx.createConvolver(), wet = ctx.createGain(); wet.gain.value = .18;
			const lowpass = ctx.createBiquadFilter(); lowpass.type = "lowpass"; lowpass.frequency.value = this.stretched ? 680 : Math.min(18000, ctx.sampleRate * .45); lowpass.Q.value = .5;
			const rumble = ctx.createBiquadFilter(); rumble.type = "highpass"; rumble.frequency.value = 22; rumble.Q.value = .5;
			const compressor = ctx.createDynamicsCompressor();
			compressor.threshold.value = -16; compressor.knee.value = 15; compressor.ratio.value = 5; compressor.attack.value = .008; compressor.release.value = .22;
			const trim = ctx.createGain(); trim.gain.value = .65;
			const gate = ctx.createGain(), output = ctx.createGain(); output.gain.value = this.isMuted ? 0 : this.volume;
			// A reusable white-noise loop, with short seam fades, supplies all noise voices.
			const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate), data = noise.getChannelData(0);
			for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
			const seam = Math.ceil(ctx.sampleRate * .015);
			for (let i = 0; i < seam; i++) { const t = i / seam; data[i] = data[i]! * t; data[data.length - 1 - i] = data[data.length - 1 - i]! * t; }
			// Low-rate, smooth circular randomness moves metal modes without a JS update timer.
			const wander = ctx.createBuffer(1, 18000, 3000), drift = wander.getChannelData(0), points = new Float32Array(12);
			for (let i = 0; i < points.length; i++) points[i] = Math.random() * 2 - 1;
			for (let i = 0; i < drift.length; i++) { const p = i / 1500, k = Math.floor(p), t = p - k; drift[i] = points[k]! + (points[(k + 1) % 12]! - points[k]!) * t * t * (3 - 2 * t); }
			// One dark, gently decaying stereo room; no asset downloads or per-impact convolvers.
			const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 1.7), ctx.sampleRate);
			for (let ch = 0; ch < 2; ch++) {
				const channel = impulse.getChannelData(ch); let smooth = 0;
				for (let i = 0; i < channel.length; i++) { smooth = smooth * .72 + (Math.random() * 2 - 1) * .28; channel[i] = smooth * Math.pow(1 - i / channel.length, 3) * Math.min(1, i / (ctx.sampleRate * .012)); }
			}
			convolver.buffer = impulse;
			effects.connect(mix); send.connect(convolver); convolver.connect(wet); wet.connect(mix);
			mix.connect(lowpass); lowpass.connect(rumble); rumble.connect(compressor); compressor.connect(trim); trim.connect(gate); gate.connect(output); output.connect(ctx.destination);
			this.graph = { ctx, effects, send, wet, mix, convolver, lowpass, gate, output, noise, wander, impulse,
				nodes: [effects, send, mix, convolver, wet, lowpass, rumble, compressor, trim, gate, output] };
		}
		const graph = this.graph;
		// resume() is invoked synchronously in the gesture; rejection leaves captions usable.
		if (graph.ctx.state === "suspended" && !document.hidden) void graph.ctx.resume().catch(() => { /* Audio is optional if the browser refuses or interrupts playback. */ });
		if (graph.ctx.state === "running") this.removeGestures();
		return graph;
	}
	private wake(graph: Graph) {
		if (!this.silent) return;
		this.silent = false;
		// A new cue must not resurrect the old room tail after a brief fade to black.
		graph.convolver.buffer = null; graph.convolver.buffer = graph.impulse;
		target(graph.gate.gain, 1, graph.ctx.currentTime, .015);
	}
	private release = (layer: SoundLayer) => {
		this.groups.delete(layer); this.effects.delete(layer);
		if (this.holeLayer === layer) this.holeLayer = null;
		if (this.strainLayer === layer) this.strainLayer = null;
		if (this.reactorLayer === layer) this.reactorLayer = null;
		if (this.engineLayer === layer) this.engineLayer = null;
		if (this.alarmLayer === layer) this.alarmLayer = null;
	};
	private group(graph: Graph, send: number, effect = true): SoundLayer | null {
		if (effect && this.effects.size >= MAX_EFFECTS) return null;
		this.wake(graph);
		const layer = new SoundLayer(graph.ctx, graph.effects, graph.send, send, this.release);
		this.groups.add(layer); if (effect) this.effects.add(layer);
		return layer;
	}
	private envelope(layer: SoundLayer, amp: number, at: number, duration: number, attack: number, sustain = false) {
		const gain = layer.own(layer.ctx.createGain()), end = at + duration;
		gain.gain.setValueAtTime(0, at);
		gain.gain.linearRampToValueAtTime(amp, at + Math.min(attack, duration * .3));
		if (sustain) {
			gain.gain.setValueAtTime(amp, end - Math.min(.08, duration * .25));
			gain.gain.linearRampToValueAtTime(.00001, end - .003);
		} else gain.gain.exponentialRampToValueAtTime(.00001, end - .003);
		gain.gain.linearRampToValueAtTime(0, end); gain.connect(layer.output);
		return gain;
	}
	private tone(layer: SoundLayer, type: OscillatorType, from: number, to: number, amp: number, at: number, duration: number, attack = .008, sustain = false) {
		const oscillator = layer.ctx.createOscillator(); oscillator.type = type;
		oscillator.frequency.setValueAtTime(from, at); oscillator.frequency.exponentialRampToValueAtTime(to, at + duration * .85);
		oscillator.connect(this.envelope(layer, amp, at, duration, attack, sustain)); layer.start(oscillator, at, at + duration);
	}
	private burst(layer: SoundLayer, type: BiquadFilterType, from: number, to: number, q: number, amp: number, at: number, duration: number, attack = .005, sustain = false) {
		const graph = this.graph!, source = graph.ctx.createBufferSource(), filter = layer.own(graph.ctx.createBiquadFilter());
		source.buffer = graph.noise; source.loop = true; source.playbackRate.value = .8 + Math.random() * .4;
		filter.type = type; filter.Q.value = q; filter.frequency.setValueAtTime(from, at); filter.frequency.exponentialRampToValueAtTime(to, at + duration * .9);
		source.connect(filter); filter.connect(this.envelope(layer, amp, at, duration, attack, sustain));
		layer.start(source, at, at + duration, Math.random());
	}
	private bedTone(layer: SoundLayer, frequency: number, amp: number, type: OscillatorType = "sine") {
		const oscillator = layer.ctx.createOscillator(), gain = layer.own(layer.ctx.createGain());
		oscillator.type = type; layer.pitch(oscillator.frequency, frequency); gain.gain.value = amp;
		oscillator.connect(gain); gain.connect(layer.output); layer.start(oscillator, layer.ctx.currentTime);
	}
	private bedNoise(layer: SoundLayer, frequency: number, amp: number, type: BiquadFilterType = "lowpass", q = .7) {
		const graph = this.graph!, source = graph.ctx.createBufferSource(), filter = layer.own(graph.ctx.createBiquadFilter()), gain = layer.own(graph.ctx.createGain());
		source.buffer = graph.noise; source.loop = true; layer.pitch(source.playbackRate, 1);
		filter.type = type; filter.Q.value = q; layer.pitch(filter.frequency, frequency); gain.gain.value = amp;
		source.connect(filter); filter.connect(gain); gain.connect(layer.output); layer.start(source, graph.ctx.currentTime, Infinity, Math.random());
	}
	private level(layer: SoundLayer, value: number, spin = 1) {
		const now = layer.ctx.currentTime;
		if (Math.abs(value - layer.level) >= .002 || value === 0 || value === 1) {
			if (value !== layer.level) { layer.level = value; target(layer.output.gain, value, now, .18); }
		}
		layer.tune(spin * (this.stretched ? .62 : 1), now);
	}

	/** User volume is independent of mute, voice ducking and the silence gate. */
	master(level: number) {
		this.volume = unit(level);
		const graph = this.ready();
		if (graph) {
			const now = graph.ctx.currentTime; hold(graph.output.gain, now);
			graph.output.gain.linearRampToValueAtTime(this.isMuted ? 0 : this.volume, now + .025);
		}
	}
	/** One dull 43-to-32 Hz impact, a small audible body and a dark room tail. Call three times. */
	knock() {
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .8); if (!layer) return; const t = graph.ctx.currentTime;
		this.tone(layer, "sine", 43, 32, .7, t, 1.65);
		this.tone(layer, "triangle", 117, 72, .12, t, .36);
		this.burst(layer, "lowpass", 480, 90, .7, .35, t, .14);
	}
	/** Dry, randomly tuned splinters; rate limiting prevents a fracture tween flooding the graph. */
	crack(intensity: number) {
		intensity = unit(intensity); if (!intensity) return;
		const graph = this.ready(); if (!graph || graph.ctx.currentTime - this.lastCrack < .12) return;
		const layer = this.group(graph, 0); if (!layer) return; this.lastCrack = graph.ctx.currentTime;
		const count = 1 + Math.floor(intensity * 2);
		for (let i = 0; i < count; i++) {
			const f = 1600 + Math.random() * 3500;
			this.burst(layer, "bandpass", f, f * .65, 8, .12 * intensity, graph.ctx.currentTime + i * .035, .06 + Math.random() * .06);
		}
	}
	/** A widening tear climbs in spectral pitch while its low foundation drops away. */
	tear() {
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .4); if (!layer) return; const t = graph.ctx.currentTime;
		this.burst(layer, "bandpass", 180, 3800, 2.5, .7, t, 2.3, .6);
		this.burst(layer, "highpass", 900, 5500, .6, .14, t + .3, 1.6, .45);
		this.tone(layer, "sine", 82, 27, .55, t + .08, 2.6, .03);
	}
	/** Two slowly beating subs, a laptop-readable harmonic, and a distant upper shimmer. */
	hole(level: number) {
		level = unit(level); let layer = this.holeLayer; if (!level && !layer) return;
		const graph = this.ready(); if (!graph) return;
		if (!layer) {
			layer = this.group(graph, .25, false)!; layer.output.gain.value = 0;
			this.bedTone(layer, 36, .24); this.bedTone(layer, 36.55, .22); this.bedTone(layer, 109, .035, "triangle");
			this.bedNoise(layer, 2300, .04, "bandpass", 2); this.holeLayer = layer;
		}
		this.level(layer, level);
		if (!level) { layer.fade(.8); this.holeLayer = null; }
	}
	/** Smooth random excitation bends three nonharmonic metal resonances into irregular groans. */
	strain(level: number) {
		level = unit(level); let layer = this.strainLayer; if (!level && !layer) return;
		const graph = this.ready(); if (!graph) return;
		if (!layer) {
			layer = this.group(graph, .35, false)!; layer.output.gain.value = 0;
			const source = graph.ctx.createBufferSource(), drift = graph.ctx.createBufferSource(), bend = layer.own(graph.ctx.createGain());
			source.buffer = graph.noise; source.loop = true; layer.pitch(source.playbackRate, 1);
			drift.buffer = graph.wander; drift.loop = true; layer.pitch(drift.playbackRate, .7); bend.gain.value = 145; drift.connect(bend);
			for (const frequency of [87, 193, 347]) {
				const mode = layer.own(graph.ctx.createBiquadFilter()), gain = layer.own(graph.ctx.createGain());
				mode.type = "bandpass"; mode.Q.value = 16; layer.pitch(mode.frequency, frequency); gain.gain.value = .7;
				bend.connect(mode.detune); source.connect(mode); mode.connect(gain); gain.connect(layer.output);
			}
			layer.start(source, graph.ctx.currentTime, Infinity, Math.random()); layer.start(drift, graph.ctx.currentTime);
			this.strainLayer = layer;
		}
		this.level(layer, level);
		if (!level) { layer.fade(.8); this.strainLayer = null; }
	}
	/** A soft two-note warning every 1.25 s; repeated on calls never restart its clock. */
	alarm(on: boolean) {
		if (!on) {
			this.alarmOn = false;
			if (this.alarmTimer !== undefined) window.clearInterval(this.alarmTimer); this.alarmTimer = undefined;
			this.alarmLayer?.fade(.04); this.alarmLayer = null; return;
		}
		if (this.alarmOn || !this.ready()) return;
		this.alarmOn = true; this.alarmPulse(); this.alarmTimer = window.setInterval(this.alarmPulse, 1250);
	}
	private alarmPulse = () => {
		const graph = this.graph;
		if (!graph || !this.alarmOn || graph.ctx.state !== "running" || graph.ctx.currentTime - this.lastAlarm < 1) return;
		const layer = this.group(graph, .05); if (!layer) return;
		const t = graph.ctx.currentTime; this.lastAlarm = t; this.alarmLayer = layer;
		this.tone(layer, "sine", 518, 518, .095, t, .2, .025);
		this.tone(layer, "sine", 653, 653, .08, t + .26, .23, .025);
	};
	/** A panel motor rises under load, with soft rail friction; duration is clamped to ten seconds. */
	servo(duration: number, pitch: number) {
		duration = seconds(duration, .7, 10); if (!duration) return;
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .08); if (!layer) return;
		const t = graph.ctx.currentTime, f = 90 + unit(pitch) * 240, d = Math.max(.06, duration);
		this.tone(layer, "triangle", f * .65, f, .075, t, d, Math.min(.14, d * .2), true);
		this.burst(layer, "bandpass", f * 4, f * 2.5, 1, .12, t, d, Math.min(.1, d * .2), true);
	}
	/** A weighted lock seats twice, with a short iron resonance rather than a sharp gunshot. */
	latch() {
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .25); if (!layer) return; const t = graph.ctx.currentTime;
		this.burst(layer, "lowpass", 1200, 160, .7, .3, t, .16);
		this.tone(layer, "triangle", 145, 61, .23, t, .42);
		this.tone(layer, "sine", 287, 193, .07, t + .075, .25);
	}
	/** Air pressure equalises, then a single low locking contact closes the seam. */
	seal() {
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .16); if (!layer) return; const t = graph.ctx.currentTime;
		this.burst(layer, "bandpass", 3200, 450, .8, .32, t, .85, .12);
		this.tone(layer, "triangle", 132, 52, .28, t + .68, .4);
		this.burst(layer, "lowpass", 700, 100, .7, .23, t + .68, .12);
	}
	/** Three related partials rise with the reactor level, giving the rings a coherent spin-up. */
	reactor(level: number) {
		level = unit(level); let layer = this.reactorLayer; if (!level && !layer) return;
		const graph = this.ready(); if (!graph) return;
		if (!layer) {
			layer = this.group(graph, .12, false)!; layer.output.gain.value = 0;
			this.bedTone(layer, 58, .15, "triangle"); this.bedTone(layer, 116, .09); this.bedTone(layer, 232, .035);
			this.reactorLayer = layer;
		}
		this.level(layer, level, .8 + level * 1.6);
		if (!level) { layer.fade(.8); this.reactorLayer = null; }
	}
	/** Filtered air and a low triangular thrust body broaden and climb as power increases. */
	engine(level: number) {
		level = unit(level); let layer = this.engineLayer; if (!level && !layer) return;
		const graph = this.ready(); if (!graph) return;
		if (!layer) {
			layer = this.group(graph, .14, false)!; layer.output.gain.value = 0;
			this.bedNoise(layer, 900, .38); this.bedTone(layer, 47, .2, "triangle"); this.engineLayer = layer;
		}
		this.level(layer, level, .65 + level * .8);
		if (!level) { layer.fade(.6); this.engineLayer = null; }
	}
	/** A pressure thump and restrained hot-air burst mark ignition before the steady roar. */
	ignite() {
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .35); if (!layer) return; const t = graph.ctx.currentTime;
		this.tone(layer, "sine", 94, 33, .55, t, .9);
		this.burst(layer, "lowpass", 1700, 170, .7, .48, t, .75, .025);
	}
	/** Narrow the entire mix, including voices and tails; pitch beds down without stretching speech. */
	stretch(on: boolean) {
		on = !!on; if (on === this.stretched) return;
		this.stretched = on; const graph = this.ready(); if (!graph) return;
		target(graph.lowpass.frequency, on ? 680 : Math.min(18000, graph.ctx.sampleRate * .45), graph.ctx.currentTime, .3);
		if (this.holeLayer) this.level(this.holeLayer, this.holeLayer.level);
		if (this.strainLayer) this.level(this.strainLayer, this.strainLayer.level);
		if (this.reactorLayer) this.level(this.reactorLayer, this.reactorLayer.level, .8 + this.reactorLayer.level * 1.6);
		if (this.engineLayer) this.level(this.engineLayer, this.engineLayer.level, .65 + this.engineLayer.level * .8);
	}
	/** One accelerating whoosh opens into a broad roar, then cuts at 2.4 s, including the room tail. */
	hyperspace() {
		const graph = this.ready(); if (!graph) return;
		this.stretch(false); this.alarm(false);
		const layer = this.group(graph, .15); if (!layer) return; const t = graph.ctx.currentTime;
		this.burst(layer, "bandpass", 240, 6500, .8, .6, t, 1.7, 1);
		this.burst(layer, "lowpass", 2800, 11000, .7, .65, t + 1.25, 1.15, .18);
		this.tone(layer, "sine", 46, 180, .26, t, 2.4, .6);
		// Retire every old bed at the threshold so a later sting cannot bring propulsion back.
		for (const group of this.groups) group.fade(.04, 2.36);
		for (const job of this.voices) job.cancel(2.4);
		// Schedule on the audio clock, not a JS timeout. An explicit later cue can reopen the gate.
		hold(graph.gate.gain, t); graph.gate.gain.setValueAtTime(1, t);
		graph.gate.gain.setValueAtTime(1, t + 2.36); graph.gate.gain.linearRampToValueAtTime(0, t + 2.4);
		this.silent = true;
	}
	/** Fade duration in seconds (default 80 ms). Latched silence; the next explicit cue wakes it. */
	silence(duration = .08) {
		const graph = this.graph; if (!graph || this.disposed) return;
		duration = seconds(duration, .08, 30); this.alarm(false);
		for (const job of this.voices) job.cancel(duration);
		for (const layer of this.groups) layer.fade(duration);
		this.holeLayer = null; this.strainLayer = null; this.reactorLayer = null; this.engineLayer = null;
		const now = graph.ctx.currentTime; hold(graph.gate.gain, now); graph.gate.gain.linearRampToValueAtTime(0, now + duration);
		this.silent = true;
	}
	/** Close-spaced low fundamentals carry a sparse, nonharmonic metallic edge for the last image. */
	sting() {
		const graph = this.ready(); if (!graph) return;
		const layer = this.group(graph, .55); if (!layer) return; const t = graph.ctx.currentTime;
		this.tone(layer, "sine", 38, 35, .3, t, 6, .12);
		this.tone(layer, "sine", 40.3, 37.2, .24, t, 5.6, .14);
		this.tone(layer, "triangle", 114, 107, .07, t, 5.2, .1);
		this.burst(layer, "bandpass", 719, 641, 18, .2, t, 4, .07);
	}
	private duck() {
		const graph = this.graph; if (!graph) return;
		let level = 1;
		for (const job of this.voices) if (job.playing) level = Math.min(level, job.duck);
		target(graph.effects.gain, level, graph.ctx.currentTime, level < graph.effects.gain.value ? .035 : .2);
		// Duck the return as well, including reflections already inside the convolver.
		target(graph.wet.gain, .18 * level, graph.ctx.currentTime, level < graph.effects.gain.value ? .035 : .2);
	}
	/** Pre-rendered original speech only. duck is the remaining effects level; zero fully ducks.
	 * Resolves on end/cancellation; fetch or decode failures reject. Cross-origin URLs need CORS.
	 */
	voice(url: string, opts?: { duck?: number }): Promise<void> {
		const graph = this.ready(); if (!graph || this.voices.size >= 2) return Promise.resolve();
		return new Promise<void>((resolve, reject) => {
			const abort = new AbortController(); let source: AudioBufferSourceNode | null = null, gain: GainNode | null = null, started = false, settled = false, cancelled = false;
			const finish = (error?: unknown) => {
				if (settled) return; settled = true; abort.abort();
				if (source) { source.onended = null; if (started) source.stop(); source.disconnect(); }
				gain?.disconnect(); this.voices.delete(job); this.duck();
				if (error !== undefined) reject(error); else resolve();
			};
			const job: VoiceJob = {
				cancel: (duration = 0) => {
					cancelled = true; abort.abort();
					if (!started || !source || !gain || !duration) { finish(); return; }
					const now = graph.ctx.currentTime; hold(gain.gain, now); gain.gain.linearRampToValueAtTime(0, now + duration);
					source.stop(now + duration);
				},
				duck: unit(opts?.duck ?? .5), playing: false,
			};
			this.voices.add(job);
			void (async () => {
				try {
					let buffer = this.cache.get(url);
					if (!buffer) {
						const response = await fetch(url, { signal: abort.signal });
						if (!response.ok) throw new Error("Voice request failed: " + response.status);
						buffer = await graph.ctx.decodeAudioData(await response.arrayBuffer());
						if (settled || cancelled || this.disposed) return;
						if (this.cache.size >= 6) { const oldest = this.cache.keys().next().value; if (oldest !== undefined) this.cache.delete(oldest); }
						this.cache.set(url, buffer);
					}
					if (settled || cancelled || this.disposed) return;
					this.wake(graph); source = graph.ctx.createBufferSource(); source.buffer = buffer;
					gain = graph.ctx.createGain(); source.connect(gain); gain.connect(graph.mix); source.onended = () => finish();
					source.start(graph.ctx.currentTime + .035); started = true; job.playing = true; this.duck();
				} catch (error) { if (!settled) finish(error); }
			})();
		});
	}
	/** Skip/navigation teardown is final and idempotent, including pending fetches and decodes. */
	dispose() {
		if (this.disposed) return; this.disposed = true; this.removeGestures(); this.alarm(false);
		if (typeof document !== "undefined") document.removeEventListener("visibilitychange", this.visibility);
		for (const job of this.voices) job.cancel();
		for (const layer of this.groups) layer.dispose();
		const graph = this.graph; this.graph = null;
		if (graph) { for (const node of graph.nodes) node.disconnect(); void graph.ctx.close().catch(() => { /* Audio is optional if the browser refuses or interrupts playback. */ }); }
		this.cache.clear(); this.holeLayer = null; this.strainLayer = null; this.reactorLayer = null; this.engineLayer = null;
	}
}

export function createSound() { return new PocketSound(); }
