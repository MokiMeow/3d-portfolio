import { Box3, Group, Mesh, Quaternion, Vector3, type Material, type Object3D } from "three";

/**
 * How things fall into the hole. A Newtonian pull (strong enough to be honest about the last few metres),
 * a swirl that lays the debris into the disk's plane, tidal stretching along the fall, and the horizon:
 * nothing is ever seen to cross it. Close in, an object slows, reddens and fades where it is, which is what
 * a distant observer of a real horizon would see.
 *
 * Paths are integrated once, up front, and sampled by time, so the director's timeline can seek freely.
 * Units are the model's (metres); the hole's numbers come from the director.
 */
export type Hole = {
	/** Centre, in the model's frame. */
	centre: Vector3;
	/** Event horizon radius (2M). */
	horizon: number;
	/** G·M, in m³/s². Sets how fast things fall: ~17 500 brings a shard 75 m away in about five seconds. */
	gm: number;
	/** The disk's axis: debris is drawn towards the plane through the centre, perpendicular to it. */
	axis: Vector3;
};

const STEP = 1 / 120, SAMPLE = 1 / 60;

export class Fall {
	/** x, y, z, stretch, fade per sample (one every 1/60 s). */
	private samples: Float32Array;
	readonly duration: number;
	/** The direction of travel at each sample, for stretching along it. */
	private directions: Float32Array;

	/**
	 * @param start where it lets go
	 * @param push its velocity at the moment it lets go (m/s)
	 * @param swirl 0..1: how much sideways speed it has, as a share of circular speed at its distance
	 */
	constructor(hole: Hole, start: Vector3, push: Vector3, swirl: number, size = 1) {
		const p = start.clone(), v = push.clone();
		const toHole = new Vector3(), side = new Vector3(), a = new Vector3();
		// Sideways speed around the disk's axis, so things curve in rather than drop straight.
		toHole.subVectors(hole.centre, p);
		const r0 = toHole.length();
		side.crossVectors(hole.axis, toHole).normalize();
		v.addScaledVector(side, swirl * Math.sqrt(hole.gm / r0));

		const out: number[] = [], dirs: number[] = [];
		const slowAt = hole.horizon * 3.2;
		let t = 0, nextSample = 0, slowFrom = -1;
		const slowPoint = new Vector3(), slowDir = new Vector3();
		for (let i = 0; i < 120 * 40; i++) {
			toHole.subVectors(hole.centre, p);
			const r = toHole.length();
			if (slowFrom < 0 && r < slowAt) { slowFrom = t; slowPoint.copy(p); slowDir.copy(toHole).normalize(); }
			if (slowFrom >= 0) {
				// The last metres: an exponential approach to just outside the horizon, ever slower, ever redder.
				const s = t - slowFrom;
				const left = (slowAt - hole.horizon * 1.04) * (1 - Math.exp(-s / .55));
				p.copy(slowPoint).addScaledVector(slowDir, left);
				if (s > 2.6) break;
			} else {
				// Velocity Verlet with a gentle pull into the disk plane (the gas drags it flat).
				a.copy(toHole).multiplyScalar(hole.gm / (r * r * r));
				const height = toHole.dot(hole.axis);
				a.addScaledVector(hole.axis, height * .35);
				v.addScaledVector(a, STEP * .5);
				p.addScaledVector(v, STEP);
				toHole.subVectors(hole.centre, p);
				const r2 = toHole.length();
				a.copy(toHole).multiplyScalar(hole.gm / (r2 * r2 * r2)).addScaledVector(hole.axis, toHole.dot(hole.axis) * .35);
				v.addScaledVector(a, STEP * .5);
			}
			t += STEP;
			if (t >= nextSample) {
				nextSample += SAMPLE;
				const r3 = p.distanceTo(hole.centre);
				// Tidal stretch: the difference in pull across the object, grows as 1/r³. Capped: past that it is gone.
				const stretch = 1 + Math.min(5, .55 * hole.gm * size / (r3 * r3 * r3));
				const fade = Math.min(1, Math.max(0, (r3 - hole.horizon * 1.06) / (hole.horizon * 1.6)));
				out.push(p.x, p.y, p.z, stretch, fade);
				const d = slowFrom >= 0 ? slowDir : v.clone().normalize();
				dirs.push(d.x, d.y, d.z);
			}
		}
		this.samples = new Float32Array(out);
		this.directions = new Float32Array(dirs);
		this.duration = (out.length / 5) * SAMPLE;
	}

	/** Where it is `t` seconds after letting go. Writes position and direction; returns stretch and fade. */
	at(t: number, position: Vector3, direction: Vector3) {
		const n = this.samples.length / 5;
		const f = Math.min(n - 1, Math.max(0, t / SAMPLE));
		const i = Math.floor(f), j = Math.min(n - 1, i + 1), k = f - i;
		const s = this.samples, d = this.directions;
		position.set(s[i * 5]! + (s[j * 5]! - s[i * 5]!) * k, s[i * 5 + 1]! + (s[j * 5 + 1]! - s[i * 5 + 1]!) * k, s[i * 5 + 2]! + (s[j * 5 + 2]! - s[i * 5 + 2]!) * k);
		direction.set(d[i * 3]!, d[i * 3 + 1]!, d[i * 3 + 2]!);
		return { stretch: s[i * 5 + 3]! + (s[j * 5 + 3]! - s[i * 5 + 3]!) * k, fade: s[i * 5 + 4]! + (s[j * 5 + 4]! - s[i * 5 + 4]!) * k };
	}
}

/**
 * The shader side of the horizon, shared by everything that can fall in: colour reddens and dims as it
 * nears the horizon, and is black at it. `vHoleDistance` must be set in the vertex shader.
 */
export const horizonChunk = /* glsl */ `
	uniform vec3 uHoleCentre;
	uniform float uHorizon;
	varying float vHoleDistance;
	vec3 horizonShift(vec3 colour) {
		float near = smoothstep(uHorizon * 1.04, uHorizon * 4.2, vHoleDistance);
		vec3 red = colour * vec3(1., .42, .22) * .7;
		return mix(red * smoothstep(uHorizon * 1.04, uHorizon * 1.9, vHoleDistance), colour, near);
	}
`;

/**
 * A room object falling in: it is lifted into a two-level rig (an outer frame that stretches along the
 * fall, an inner one that tumbles), its materials are swapped for copies that redden at the horizon,
 * and everything is put back exactly by `restore()`.
 */
export class FallingObject {
	private outer = new Group();
	private inner = new Group();
	private parent: Object3D;
	private home: { position: Vector3; quaternion: Quaternion; scale: Vector3; visible: boolean };
	private swapped: { mesh: Mesh; material: Material | Material[] }[] = [];
	private fall: Fall | null = null;
	private release = Infinity;
	private spin = new Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize();
	private rate = .5 + Math.random();
	private position = new Vector3();
	private direction = new Vector3();

	constructor(readonly object: Object3D, private hole: Hole, private frame: Object3D, uniforms: { uHoleCentre: { value: Vector3 }; uHorizon: { value: number } }) {
		this.parent = object.parent!;
		this.home = { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone(), visible: object.visible };
		object.traverse(node => {
			if (!(node instanceof Mesh)) return;
			this.swapped.push({ mesh: node, material: node.material });
			const reddened = (Array.isArray(node.material) ? node.material : [node.material]).map(m => horizonMaterial(m, uniforms));
			node.material = Array.isArray(node.material) ? reddened : reddened[0]!;
		});
		this.outer.name = `doomsday_fall_${object.name}`;
		this.outer.add(this.inner);
	}

	/** Let go at `at`, with an initial shove (m/s) and some sideways swirl. */
	schedule(at: number, push: Vector3, swirl = .3) {
		const centre = new Box3().setFromObject(this.object).getCenter(new Vector3());
		this.frame.worldToLocal(centre);
		const size = new Box3().setFromObject(this.object).getSize(new Vector3()).length() * .5;
		this.fall = new Fall(this.hole, centre, push, swirl, Math.min(size, 4));
		this.release = at;
		// The rig sits at the object's centre; the object hangs inside it, unmoved.
		this.outer.position.copy(centre);
		this.frame.add(this.outer);
		this.outer.updateMatrixWorld(true);
		this.inner.attach(this.object);
	}

	update(time: number) {
		if (!this.fall) return;
		const age = time - this.release;
		if (age < 0) { this.object.visible = this.home.visible; return; }
		if (age > this.fall.duration) { this.object.visible = false; return; }
		const { stretch } = this.fall.at(age, this.position, this.direction);
		this.outer.position.copy(this.position);
		this.outer.quaternion.setFromUnitVectors(Z, this.direction);
		const across = 1 / Math.sqrt(stretch);
		this.outer.scale.set(across, across, stretch);
		// Tumble inside the stretched frame, expressed against it so the stretch stays along the fall.
		this.inner.quaternion.setFromAxisAngle(this.spin, this.rate * age * (1 + age * .3)).premultiply(this.outer.quaternion.clone().invert());
	}

	restore() {
		this.parent.add(this.object);
		this.object.position.copy(this.home.position); this.object.quaternion.copy(this.home.quaternion); this.object.scale.copy(this.home.scale);
		this.object.visible = this.home.visible;
		for (const { mesh, material } of this.swapped) {
			(Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m.dispose());
			mesh.material = material;
		}
		this.outer.removeFromParent();
	}
}
const Z = new Vector3(0, 0, 1);

/** A copy of `material` that reddens and darkens near the horizon (world-space distance to the hole). */
export function horizonMaterial(material: Material, uniforms: { uHoleCentre: { value: Vector3 }; uHorizon: { value: number } }) {
	const copy = material.clone();
	copy.onBeforeCompile = shader => {
		shader.uniforms.uHoleCentre = uniforms.uHoleCentre; shader.uniforms.uHorizon = uniforms.uHorizon;
		shader.vertexShader = shader.vertexShader
			.replace("#include <common>", "#include <common>\nuniform vec3 uHoleCentre;\nvarying float vHoleDistance;")
			.replace("#include <project_vertex>", "#include <project_vertex>\nvHoleDistance = distance((modelMatrix * vec4(transformed, 1.)).xyz, uHoleCentre);");
		shader.fragmentShader = shader.fragmentShader
			.replace("#include <common>", `#include <common>\n${horizonChunk}`)
			.replace("#include <dithering_fragment>", "gl_FragColor.rgb = horizonShift(gl_FragColor.rgb);\n#include <dithering_fragment>");
	};
	return copy;
}
