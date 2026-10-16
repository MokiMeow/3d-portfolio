import {
	BufferGeometry, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix3, Matrix4, Mesh, OrthographicCamera,
	PerspectiveCamera, Scene, ShaderMaterial, Vector3, WebGLRenderTarget, type WebGLRenderer,
} from "three";

/**
 * The collapse singularity: a Schwarzschild black hole with a thin accretion disk, ray-traced per
 * pixel. It renders once a frame into its own buffer, from the room's camera, so it sits in the same
 * 3D space as the room; the rift and the sky sample that buffer by screen position.
 *
 * Units inside the shader: G = c = 1, M = 1 (horizon 2, photon sphere 3, innermost stable orbit 6).
 * `scale` is how many world units one M is.
 */
export type BlackHoleQuality = { resolution: number; steps: number; stepK: number };
export const BLACK_HOLE_QUALITY: Record<"high" | "medium" | "low", BlackHoleQuality> = {
	high: { resolution: .75, steps: 220, stepK: .035 },
	medium: { resolution: .5, steps: 120, stepK: .06 },
	low: { resolution: .38, steps: 80, stepK: .085 },
};

const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }
`;

const fragmentShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform mat4 uInvViewProj;
	uniform vec3 uCamPos, uCenter;
	uniform mat3 uToHole;            // world direction -> the hole's frame (disk in its xz plane)
	uniform float uScale, uTime, uSteps, uStepK, uGain, uDiskSpin;

	float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
	float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }

	vec3 blackbody(float t) {
		t = clamp(t, 1000., 40000.) / 100.;
		vec3 c;
		c.r = t <= 66. ? 1. : clamp(1.2929 * pow(t - 60., -.1332), 0., 1.);
		c.g = t <= 66. ? clamp(.3901 * log(t) - .6318, 0., 1.) : clamp(1.1298 * pow(t - 60., -.0755), 0., 1.);
		c.b = t >= 66. ? 1. : t <= 19. ? 0. : clamp(.5432 * log(t - 10.) - 1.1963, 0., 1.);
		return pow(c, vec3(2.2));
	}

	// The far side of the rift: stars and a faint nebula of another universe.
	vec3 sky(vec3 d) {
		vec3 c = vec3(0.);
		vec2 sp = vec2(atan(d.z, d.x) / 6.2831853 + .5, acos(clamp(d.y, -1., 1.)) / 3.1415927);
		for (int k = 0; k < 3; k++) {
			float sc = 260. + float(k) * 310.;
			vec2 q = sp * vec2(sc * 2., sc); vec2 id = floor(q); vec2 f = fract(q) - .5;
			float h = hash(id + float(k) * 31.7);
			if (h > .988) { float b = (h - .988) / .012; vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - .5;
				c += mix(vec3(1., .82, .62), vec3(.7, .82, 1.), hash(id + 1.3)) * b * b * smoothstep(.12, 0., length(f - off * .5)) * 2.2; }
		}
		float n = fbm(vec2(atan(d.z, d.x) * 2., d.y * 3.) + 4.);
		c += vec3(.035, .02, .05) * pow(n, 3.) + vec3(.008, .012, .025) * pow(fbm(d.xy * 3. + 9.), 4.);
		return c;
	}

	vec4 disk(vec3 p, vec3 dir) {
		float r = length(p.xz);
		float rin = 6., rout = 26.;
		if (r < rin * .9 || r > rout) return vec4(0.);
		float x = rin / max(r, rin * 1.04);
		float temp = 3300. * pow(x, .75) * pow(max(1. - sqrt(x * .98), 0.), .25) * 2.6 + 1300.;
		float phi = atan(p.z, p.x);
		float swirl = phi + uTime * pow(r, -1.5) * uDiskSpin;
		float gas = fbm(vec2(swirl * 3., r * .9)) * .8 + fbm(vec2(swirl * 9. + r * .4, r * 2.6)) * .5;
		gas = pow(clamp(gas, 0., 1.4), 2.);
		gas *= .5 + .5 * smoothstep(.25, .75, fbm(vec2(r * 1.7, swirl * .5)));
		gas = gas * .6 + pow(x, 1.6) * 1.4;
		vec3 v = normalize(vec3(-p.z, 0., p.x)) * sqrt(1. / r);
		float beta = length(v), gamma = 1. / sqrt(1. - beta * beta);
		float g = 1. / (gamma * (1. - beta * dot(normalize(v), -dir))) * sqrt(1. - 2. / r);
		vec3 col = blackbody(temp * mix(1., g, .75)) * pow(g, 4.6) * 1.15;
		float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, 1.55);
		float edge = smoothstep(rin * .9, rin * 1.08, r) * smoothstep(rout, rout * .55, r);
		return vec4(col * gas * edge * .9, clamp(gas * edge * .9, 0., 1.));
	}

	void main() {
		vec4 far = uInvViewProj * vec4(vUv * 2. - 1., 1., 1.);
		vec3 rdWorld = normalize(far.xyz / far.w - uCamPos);
		vec3 pos = uToHole * ((uCamPos - uCenter) / uScale);
		vec3 vel = normalize(uToHole * rdWorld);
		// Rays that never come near the hole go straight to the stars; the rest start at the edge of its pull.
		const float R = 60.;
		float b = dot(pos, vel), c = dot(pos, pos) - R * R, h = b * b - c;
		if (c > 0. && (h < 0. || b > 0.)) { vec3 s = sky(vel); gl_FragColor = vec4(s * uGain, 1.); return; }
		if (c > 0.) pos += vel * (-b - sqrt(h));
		float h2 = dot(cross(pos, vel), cross(pos, vel));
		vec3 col = vec3(0.); float alpha = 0., rmin = 1e9; bool fell = false;
		for (int i = 0; i < 400; i++) {
			if (float(i) >= uSteps) break;
			float r = length(pos); rmin = min(rmin, r);
			float dt = clamp(r * uStepK, .02, 1.6) * (r < 4.5 ? .6 : 1.);
			vec3 prev = pos;
			vec3 acc = -3. * h2 * pos / pow(r, 5.);
			pos += vel * dt + .5 * acc * dt * dt;
			vel += .5 * (acc - 3. * h2 * pos / pow(length(pos), 5.)) * dt;
			if (prev.y * pos.y < 0.) {
				vec4 d = disk(mix(prev, pos, prev.y / (prev.y - pos.y)), normalize(vel));
				col += d.rgb * (1. - alpha); alpha += d.a * (1. - alpha);
				if (alpha > .985) break;
			}
			if (r < 2.02 || (r < 2.9 && dot(pos, vel) < 0.)) { fell = true; break; }
			if (r > R + 1.) break;
		}
		col += (fell ? vec3(0.) : sky(normalize(vel))) * (1. - alpha);
		if (!fell) col += vec3(1., .84, .62) * exp(-pow((rmin - 3.01) * 14., 2.)) * 1.6 * (1. - alpha);
		if (!fell) col += vec3(1., .55, .2) * .03 * smoothstep(14., 3., rmin);
		col *= .95 * uGain;
		col = pow(col, vec3(1.04, 1., .96)) * vec3(1.05, .98, .9);
		col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);
		gl_FragColor = vec4(col, 1.);
	}
`;

export class BlackHole {
	readonly target: WebGLRenderTarget;
	readonly uniforms = {
		uInvViewProj: { value: new Matrix4() }, uCamPos: { value: new Vector3() }, uCenter: { value: new Vector3(0, 6, -70) },
		uToHole: { value: new Matrix3() }, uScale: { value: 2.4 }, uTime: { value: 0 }, uSteps: { value: 120 }, uStepK: { value: .06 },
		uGain: { value: 1 }, uDiskSpin: { value: 9 },
	};
	private scene = new Scene();
	private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
	private material: ShaderMaterial;
	private quality: BlackHoleQuality = BLACK_HOLE_QUALITY.medium;
	private view = new Matrix4();

	constructor(width: number, height: number) {
		this.target = new WebGLRenderTarget(2, 2, { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
		this.material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms, depthTest: false, depthWrite: false });
		const triangle = new BufferGeometry();
		triangle.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
		const mesh = new Mesh(triangle, this.material);
		mesh.frustumCulled = false;
		this.scene.add(mesh);
		this.setSize(width, height);
		this.tilt(.12, -.35);
	}

	setQuality(quality: BlackHoleQuality, width: number, height: number) {
		this.quality = quality;
		this.uniforms.uSteps.value = quality.steps; this.uniforms.uStepK.value = quality.stepK;
		this.setSize(width, height);
	}
	setSize(width: number, height: number) {
		this.target.setSize(Math.max(2, Math.round(width * this.quality.resolution)), Math.max(2, Math.round(height * this.quality.resolution)));
	}
	/** Tilt the disk: pitch towards the viewer and a turn about the vertical. */
	tilt(pitch: number, yaw: number) {
		const m = new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeRotationX(pitch));
		this.uniforms.uToHole.value.setFromMatrix4(m).transpose();
	}

	render(renderer: WebGLRenderer, camera: PerspectiveCamera, time: number) {
		camera.updateMatrixWorld();
		this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
		this.uniforms.uInvViewProj.value.copy(this.view);
		this.uniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
		this.uniforms.uTime.value = time;
		const previous = renderer.getRenderTarget();
		renderer.setRenderTarget(this.target);
		renderer.render(this.scene, this.camera);
		renderer.setRenderTarget(previous);
	}

	dispose() {
		this.target.dispose(); this.material.dispose();
		this.scene.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); });
	}
}
