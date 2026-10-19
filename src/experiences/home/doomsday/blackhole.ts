import {
	BufferGeometry, Float32BufferAttribute, HalfFloatType, LinearFilter, Matrix3, Matrix4, Mesh, OrthographicCamera,
	PerspectiveCamera, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, type WebGLRenderer,
} from "three";

/**
 * The collapse singularity, in the manner of Gargantua: a Schwarzschild black hole with a thin, cool,
 * marginally opaque disk, ray-traced per pixel into its own buffer from the room's camera, so it sits in
 * the same 3D space as the room. Following Double Negative's choices for Interstellar (James, von
 * Tunzelmann, Franklin & Thorne 2015): no Doppler colour or brightness asymmetry, a warm ivory disk of
 * sheared strands, up to three images of the disk (the arch over the shadow and the ring under it come
 * from the same disk), and broad veiling glare from the optics, which is what makes it feel photographed.
 *
 * Three passes: the tracer writes linear radiance (and the disk's share of it) at reduced resolution;
 * a quarter-resolution horizontal glare blur; then a vertical blur, a tight core bloom, one display curve,
 * a hint of grain and the backdrop mix into `target`, which the scene and the cracks sample.
 *
 * Units inside the shader: G = c = 1, M = 1 (horizon 2, photon sphere 3, innermost stable orbit 6).
 * `uScale` is how many world units one M is.
 */
export type BlackHoleQuality = { resolution: number; steps: number };
export const BLACK_HOLE_QUALITY: Record<"high" | "medium" | "low", BlackHoleQuality> = {
	high: { resolution: .6, steps: 256 },
	medium: { resolution: .5, steps: 192 },
	low: { resolution: .38, steps: 128 },
};

const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }
`;

const traceShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform mat4 uInvViewProj;
	uniform vec3 uCamPos, uCenter;
	uniform mat3 uToHole, uFromHole;   // world <-> the hole's frame (disk in its xz plane)
	uniform float uScale, uTime, uSteps, uGain, uPixelAngle;

	float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }

	// The far sky, in the world's frame so it never turns with the hole: sparse stars, a very faint nebula.
	vec3 sky(vec3 d) {
		vec3 c = vec3(0.);
		vec2 sp = vec2(atan(d.z, d.x) / 6.2831853 + .5, acos(clamp(d.y, -1., 1.)) / 3.1415927);
		for (int k = 0; k < 3; k++) {
			float sc = 240. + float(k) * 290.;
			vec2 q = sp * vec2(sc * 2., sc); vec2 id = floor(q); vec2 f = fract(q) - .5;
			float h = hash(id + float(k) * 31.7);
			if (h > .989) { float b = (h - .989) / .011; vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - .5;
				c += mix(vec3(1., .86, .7), vec3(.75, .84, 1.), hash(id + 1.3)) * b * b * (1. - smoothstep(0., .16, length(f - off * .5))) * 1.8; }
		}
		float n = noise(vec2(atan(d.z, d.x) * 2., d.y * 3.) + 4.) * .6 + noise(vec2(atan(d.z, d.x) * 5., d.y * 7.)) * .4;
		c += vec3(.012, .009, .014) * pow(n, 3.);
		return c;
	}

	// The disk (after DNeg's look, not its code): thin, cool, sheared into long ribbons, with no Doppler
	// asymmetry. Returns premultiplied emission and opacity for a crossing at p, along dir.
	vec4 disk(vec3 p, vec3 dir, float dr) {
		float r = length(p.xz);
		if (r < 6. || r > 20.) return vec4(0.);
		float a = atan(p.z, p.x) + uTime * .035 * pow(8. / r, 1.5);
		// Periodic angular coordinates: no seam where atan wraps.
		float w = .10 * sin(3. * a + .6 * r) + .04 * sin(7. * a - .9 * r);
		float n = noise(vec2(r * 1.1, 1.6 * sin(a) + .4 * cos(3. * a)));
		float nf = noise(vec2((r + w) * 8., 2. * sin(a) + .7 * cos(3. * a)));
		nf = mix(nf, .5, smoothstep(.25, .8, dr * 8.));
		float f = 48. * (r + w) + 1.8 * sin(2. * a);
		float ribbon = .5 + .5 * sin(f) * exp(-.5 * pow(48. * dr, 2.));
		float strands = mix(.35, 1., nf) * mix(.55, 1., ribbon);
		float edge = smoothstep(6., 6.8, r) * (1. - smoothstep(15., 20., r));
		float density = edge * (.12 + 1.15 * strands * strands) * mix(.4, 1.2, n);
		float opacity = 1. - exp(-.9 * density / max(abs(dir.y), .18));
		float radial = pow(8. / max(r, 8.), 1.8);
		vec3 tint = mix(vec3(1., .43, .16), vec3(1., .86, .61), smoothstep(.2, .85, strands));
		vec3 E = tint * (.4 + 2.6 * strands * strands) * radial;
		return vec4(E * opacity, opacity);
	}

	void main() {
		vec4 far = uInvViewProj * vec4(vUv * 2. - 1., 1., 1.);
		vec3 rdWorld = normalize(far.xyz / far.w - uCamPos);
		vec3 pos = uToHole * ((uCamPos - uCenter) / uScale);
		vec3 vel = normalize(uToHole * rdWorld);
		// Rays that never come near the hole go straight to the stars.
		const float R = 80.;
		float b = dot(pos, vel), c = dot(pos, pos) - R * R, h = b * b - c;
		if (c > 0. && (h < 0. || b > 0.)) { gl_FragColor = vec4(sky(rdWorld) * uGain, 0.); return; }
		float travelled = 0.;
		if (c > 0.) { float enter = -b - sqrt(h); pos += vel * enter; travelled = enter; }
		vec3 L = cross(pos, vel); float h2 = dot(L, L);
		vec3 C = vec3(0.); float T = 1.; int hits = 0;
		bool escaped = false;
		// A bound read from a uniform: ANGLE's D3D compiler cannot unroll it (an unrolled 300-step march
		// with the disk inlined took many seconds to compile on Windows).
		int steps = int(uSteps);
		for (int i = 0; i < steps; i++) {
			float r2 = dot(pos, pos), r = sqrt(r2);
			float dt = r > 8. ? min(3., r * .1) : (r > 3.6 ? .2 : .08);
			vec3 prev = pos;
			vec3 acc = -3. * h2 * pos / (r2 * r2 * r);
			pos += vel * dt + .5 * acc * dt * dt;
			float n2 = dot(pos, pos);
			vel += .5 * (acc - 3. * h2 * pos / (n2 * n2 * sqrt(n2))) * dt;
			travelled += dt;
			if (prev.y * pos.y < 0. && hits < 3) {
				vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
				vec4 d = disk(hit, normalize(vel), travelled * uPixelAngle);
				if (d.a > .001) { C += T * d.rgb; T *= 1. - d.a; hits++; }
				if (T < .02) break;
			}
			if (n2 < 4.08 || (n2 < 8.4 && dot(pos, vel) < 0.)) break;
			if (n2 > R * R && dot(pos, vel) > 0.) { escaped = true; break; }
		}
		float diskLight = dot(C, vec3(.2126, .7152, .0722));
		// Only rays that truly escaped see the stars, and they see them where the world puts them.
		if (escaped) C += T * sky(normalize(uFromHole * vel));
		gl_FragColor = vec4(C * uGain, diskLight * uGain);
	}
`;

/** Pass 2: bright disk light only, blurred horizontally at quarter resolution. */
const glareHShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D uRaw;
	uniform vec2 uTexel;     // one quarter-res pixel, in uv
	vec3 bright(vec4 s) {
		float Y = dot(s.rgb, vec3(.2126, .7152, .0722));
		float diskFraction = clamp(s.a / max(Y, 1e-4), 0., 1.);
		float L = s.a, soft = clamp(L - .5, 0., 1.);
		float excess = max(L - 1., .5 * soft * soft);
		return s.rgb * diskFraction * excess / max(L, 1e-4);
	}
	void main() {
		vec3 sum = vec3(0.); float wsum = 0.;
		for (int i = -6; i <= 6; i++) {
			float x = float(i) * 5.;                 // 13 taps over +-3 sigma, sigma = 10 px
			float w = exp(-x * x / 200.);
			sum += bright(texture2D(uRaw, vUv + vec2(x * uTexel.x, 0.))) * w; wsum += w;
		}
		gl_FragColor = vec4(sum / wsum, 1.);
	}
`;

/** Pass 3: vertical glare, a tight core bloom, the display curve, grain, the backdrop. */
const composeShader = /* glsl */ `
	precision highp float;
	varying vec2 vUv;
	uniform sampler2D uRaw, uGlare;
	uniform vec2 uRawTexel, uGlareTexel;
	uniform vec3 uBackdrop;
	uniform float uVoid, uFrame, uGrain;
	float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
	void main() {
		vec3 raw = texture2D(uRaw, vUv).rgb;
		vec3 broad = vec3(0.); float wsum = 0.;
		for (int i = -6; i <= 6; i++) {
			float y = float(i) * 5.;
			float w = exp(-y * y / 200.);
			broad += texture2D(uGlare, vUv + vec2(0., y * uGlareTexel.y)).rgb * w; wsum += w;
		}
		broad /= wsum;
		vec3 core = vec3(0.); float csum = 0.;
		for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
			vec4 s = texture2D(uRaw, vUv + vec2(float(x), float(y)) * uRawTexel * 1.5);
			float w = exp(-float(x * x + y * y) / 4.5);
			core += max(s.rgb - .6, 0.) * w; csum += w;
		}
		core /= csum;
		vec3 c = raw + core * .3 + broad * .35 * vec3(1., .92, .8);
		c = max(c, vec3(0.));
		c = clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.);
		// Barely-there grain, quiet in the blacks and the whites.
		float g = hash(gl_FragCoord.xy + uFrame * 17.31) - .5;
		float l = dot(c, vec3(.33));
		c += g * uGrain * smoothstep(0., .08, l) * (1. - smoothstep(.85, 1., l));
		gl_FragColor = vec4(mix(uBackdrop, c, uVoid), 1.);
	}
`;

export class BlackHole {
	/** The finished, display-referred image (scene background, crack light). */
	readonly target: WebGLRenderTarget;
	private raw: WebGLRenderTarget;
	private glare: WebGLRenderTarget;
	readonly uniforms = {
		uInvViewProj: { value: new Matrix4() }, uCamPos: { value: new Vector3() }, uCenter: { value: new Vector3(0, 6, -70) },
		uToHole: { value: new Matrix3() }, uFromHole: { value: new Matrix3() }, uScale: { value: 2.4 }, uTime: { value: 0 },
		uSteps: { value: 192 }, uGain: { value: 1 }, uPixelAngle: { value: .002 },
		uVoid: { value: 1 }, uBackdrop: { value: new Vector3() },
	};
	private glareUniforms = { uRaw: { value: null as unknown }, uTexel: { value: new Vector2() } };
	private composeUniforms = {
		uRaw: { value: null as unknown }, uGlare: { value: null as unknown }, uRawTexel: { value: new Vector2() }, uGlareTexel: { value: new Vector2() },
		uBackdrop: this.uniforms.uBackdrop, uVoid: this.uniforms.uVoid, uFrame: { value: 0 }, uGrain: { value: .006 },
	};
	private scene = new Scene();
	private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
	private mesh: Mesh;
	private trace: ShaderMaterial;
	private glareH: ShaderMaterial;
	private compose: ShaderMaterial;
	private quality: BlackHoleQuality = BLACK_HOLE_QUALITY.medium;
	private view = new Matrix4();
	private frame = 0;

	constructor(width: number, height: number) {
		const options = { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
		this.target = new WebGLRenderTarget(2, 2, options);
		this.raw = new WebGLRenderTarget(2, 2, options);
		this.glare = new WebGLRenderTarget(2, 2, options);
		const common = { vertexShader, depthTest: false, depthWrite: false, toneMapped: false };
		this.trace = new ShaderMaterial({ ...common, fragmentShader: traceShader, uniforms: this.uniforms });
		this.glareH = new ShaderMaterial({ ...common, fragmentShader: glareHShader, uniforms: this.glareUniforms });
		this.compose = new ShaderMaterial({ ...common, fragmentShader: composeShader, uniforms: this.composeUniforms });
		const triangle = new BufferGeometry();
		triangle.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
		this.mesh = new Mesh(triangle, this.trace);
		this.mesh.frustumCulled = false;
		this.scene.add(this.mesh);
		this.setSize(width, height);
		this.tilt(.12, -.35);
	}

	setQuality(quality: BlackHoleQuality, width: number, height: number) {
		this.quality = quality;
		this.uniforms.uSteps.value = quality.steps;
		this.setSize(width, height);
	}
	/** The frame governor's share of the quality: fewer pixels and steps under load, back up when it eases. */
	scale(scale: number, width: number, height: number) {
		this.uniforms.uSteps.value = Math.round(this.quality.steps * (.6 + .4 * scale));
		const w = Math.max(2, Math.round(width * this.quality.resolution * scale)), h = Math.max(2, Math.round(height * this.quality.resolution * scale));
		if (w !== this.raw.width || h !== this.raw.height) this.resize(w, h);
	}
	setSize(width: number, height: number) {
		this.resize(Math.max(2, Math.round(width * this.quality.resolution)), Math.max(2, Math.round(height * this.quality.resolution)));
	}
	private resize(w: number, h: number) {
		this.raw.setSize(w, h); this.target.setSize(w, h);
		this.glare.setSize(Math.max(2, Math.round(w / 2)), Math.max(2, Math.round(h / 2)));
		this.glareUniforms.uTexel.value.set(1 / this.glare.width, 1 / this.glare.height);
		this.composeUniforms.uRawTexel.value.set(1 / w, 1 / h);
		this.composeUniforms.uGlareTexel.value.set(1 / this.glare.width, 1 / this.glare.height);
	}
	/** Tilt the disk: pitch towards the viewer and a turn about the vertical. */
	tilt(pitch: number, yaw: number) {
		const m = new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeRotationX(pitch));
		this.uniforms.uFromHole.value.setFromMatrix4(m);
		this.uniforms.uToHole.value.copy(this.uniforms.uFromHole.value).transpose();
	}

	render(renderer: WebGLRenderer, camera: PerspectiveCamera, time: number) {
		camera.updateMatrixWorld();
		this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
		this.uniforms.uInvViewProj.value.copy(this.view);
		this.uniforms.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
		this.uniforms.uTime.value = time;
		// One pixel of the trace, as an angle: how fine the disk's detail can be before it should blur.
		this.uniforms.uPixelAngle.value = (camera.fov * Math.PI / 180) / this.raw.height;
		this.composeUniforms.uFrame.value = this.frame++ % 997;
		const previous = renderer.getRenderTarget();
		this.mesh.material = this.trace; renderer.setRenderTarget(this.raw); renderer.render(this.scene, this.camera);
		this.glareUniforms.uRaw.value = this.raw.texture;
		this.mesh.material = this.glareH; renderer.setRenderTarget(this.glare); renderer.render(this.scene, this.camera);
		this.composeUniforms.uRaw.value = this.raw.texture; this.composeUniforms.uGlare.value = this.glare.texture;
		this.mesh.material = this.compose; renderer.setRenderTarget(this.target); renderer.render(this.scene, this.camera);
		renderer.setRenderTarget(previous);
	}

	/** Compile all three passes ahead of time (see the director's warm-up). */
	async warm(renderer: WebGLRenderer) {
		for (const material of [this.trace, this.glareH, this.compose]) { this.mesh.material = material; await renderer.compileAsync(this.scene, this.camera); }
		this.mesh.material = this.trace;
	}
	dispose() {
		this.target.dispose(); this.raw.dispose(); this.glare.dispose();
		this.trace.dispose(); this.glareH.dispose(); this.compose.dispose();
		this.mesh.geometry.dispose();
	}
}
