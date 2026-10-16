import {
	AddEquation, BackSide, Color, CustomBlending, Matrix4, Mesh, OneFactor, OneMinusSrcColorFactor,
	PlaneGeometry, ShaderMaterial, SphereGeometry, Vector2, Vector3, ZeroFactor, type Camera, type OrthographicCamera,
} from "three";

/**
 * The Fold, 87–95 seconds: a cool sphere opens rim first, with another sky folded into its edge.
 * The jump starts invisible; at .15 points stretch, at .5 blue-white trails fill the frame, at .8
 * they join a softly banded tunnel, and at 1 they become white. Trails accumulate instead of blink:
 * progress alone raises luminance; time only moves a faint, equal-luminance swirl through the colour.
 *
 * Cost: two optional draws, no textures or render targets. The quad has three star layers; the
 * sphere has one analytic intersection, two star layers and four noise octaves per covered pixel.
 * Both update methods reuse their storage. Hide either mesh when its shot ends. For reduced motion,
 * pass true to the constructors: the jump becomes a plain fade and the destination sky stays still.
 */

// Match the hole's shoulder and contrast, without its warm grade. These are display-referred
// shaders like blackhole.ts: use after HDR tone mapping, without a second material tone map.
const filmic = /* glsl */ `
	vec3 filmic(vec3 c) {
		return clamp((c * (2.51 * c + .03)) / (c * (2.43 * c + .59) + .14), 0., 1.);
	}
`;

const jumpVertex = /* glsl */ `
	varying vec2 vNdc;
	void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0., 1.); }
`;

const jumpFragment = /* glsl */ `
	precision highp float;
	varying vec2 vNdc;
	uniform float progress, time, motion;
	uniform vec2 center, viewport;
	${filmic}
	float hash(vec2 p) {
		p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32);
		return fract(p.x * p.y);
	}
	void main() {
		float p = clamp(progress, 0., 1.);
		if (p <= 0.) { gl_FragColor = vec4(0.); return; }
		vec2 q = (vNdc - center) * vec2(viewport.x / viewport.y, 1.);
		float radius = length(q);
		float angle = radius > .000001 ? atan(q.y, q.x) : 0.;
		float pixel = 2. / viewport.y;
		float stretch = smoothstep(.12, .8, p);
		float trails = 0.;
		// Each angular lane owns a seed. Its tail stays put while its head accelerates outward.
		// Every mask expands with progress, so no travelling bright/dark stripes can strobe.
		for (int k = 0; k < 3; k++) {
			float layer = float(k), lanes = 144. + layer * 64.;
			float a = (angle / 6.2831853 + .5) * lanes;
			float lane = mod(floor(a), lanes);
			vec2 id = vec2(lane, layer * 31.7);
			float seed = hash(id), r0 = .035 + .92 * hash(id + 7.1);
			float offset = .3 + .4 * hash(id + 2.3);
			float transverse = abs(fract(a) - offset) * radius * 6.2831853 / lanes;
			float width = .0008 + .0016 * stretch;
			float side = 1. - smoothstep(width, width + pixel, transverse);
			float head = r0 + .003 + stretch * stretch * (.4 + r0 * 9.);
			float radial = smoothstep(r0 - pixel, r0 + pixel, radius)
			             * (1. - smoothstep(head - pixel, head + pixel, radius));
			float awake = smoothstep(.09 + seed * .12, .18 + seed * .2, p);
			trails += side * radial * awake * (.35 + seed * .65);
		}
		// The banding is stationary in luminance, low contrast, and soft at the vanishing point.
		float bands = .94 + .06 * sin(log(1. + radius * 7.) * 8.);
		float rays = mix(1., .86 + .14 * sin(angle * 12. + log(1. + radius * 6.) * 3.),
		                 smoothstep(.015, .12, radius));
		float tunnel = smoothstep(.48, .85, p) * bands * rays;
		float energy = motion * (trails * (.18 + p * .65) + tunnel * 1.6);
		float light = filmic(vec3(energy)).r;
		float wash = smoothstep(.68, 1., p);
		if (motion < .5) wash = p * p * (3. - 2. * p);
		light = mix(light, 1., wash);
		// Blue/violet variation has zero Rec.709 luminance and never modulates brightness.
		float swirl = sin(angle * 2. + log(1. + radius * 5.) * 3. - time * .24) * motion;
		vec3 tint = vec3(-.72, (.72 * .2126 - .0722) / .7152, 1.);
		vec3 violet = vec3(.18, -.18 * .2126 / .7152, 0.);
		vec3 color = vec3(light) + (tint + violet * swirl) * light * (1. - light) * .8;
		gl_FragColor = vec4(color, 1.);
	}
`;

export class Hyperspace {
	readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
	readonly uniforms = {
		progress: { value: 0 }, center: { value: new Vector2() }, time: { value: 0 },
		viewport: { value: new Vector2(1, 1) }, motion: { value: 1 },
	};

	/** center is NDC (-1..1), with positive y up. Sizes are drawing-buffer pixels. */
	constructor(width = 1, height = 1, reducedMotion = false) {
		this.uniforms.motion.value = reducedMotion ? 0 : 1;
		const material = new ShaderMaterial({
			vertexShader: jumpVertex, fragmentShader: jumpFragment, uniforms: this.uniforms,
			transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
			// Screen blending approaches white without dimming the scene under the early trails.
			blending: CustomBlending, blendEquation: AddEquation,
			blendSrc: OneFactor, blendDst: OneMinusSrcColorFactor,
			blendEquationAlpha: AddEquation, blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor,
		});
		this.mesh = new Mesh(new PlaneGeometry(2, 2), material);
		this.mesh.name = "doomsday_hyperspace";
		this.mesh.renderOrder = 1000;
		this.mesh.frustumCulled = false;
		this.mesh.visible = false;
		this.setSize(width, height);
	}

	/** A 0..1 envelope, not an oscillation. The director chooses shake frequency and units. */
	get shake() {
		const p = Math.min(1, Math.max(0, this.uniforms.progress.value));
		const rise = Math.min(1, Math.max(0, (p - .12) / .5));
		const settle = Math.min(1, Math.max(0, (1 - p) / .18));
		return rise * rise * settle * settle * this.uniforms.motion.value;
	}

	/** Seconds on the director's pausable clock; no wall clock or retained frame history. */
	update(time: number) {
		this.uniforms.time.value = time;
		this.mesh.visible = this.uniforms.progress.value > 0;
	}

	setSize(width: number, height: number) {
		this.uniforms.viewport.value.set(Math.max(1, width), Math.max(1, height));
	}

	dispose() {
		this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose();
	}
}

const mouthVertex = /* glsl */ `
	varying vec3 vLocal;
	uniform float open;
	void main() {
		float radius = max(.00001, smoothstep(0., 1., clamp(open, 0., 1.)));
		vLocal = position * radius;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(vLocal, 1.);
	}
`;

const mouthFragment = /* glsl */ `
	precision highp float;
	varying vec3 vLocal;
	uniform vec3 cameraLocal, rayLocal, edgeColor;
	uniform mat4 localToClip;
	uniform float open, time, motion, orthographic;
	${filmic}
	float hash(vec3 p) {
		p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
		return fract((p.x + p.y) * p.z);
	}
	float noise(vec3 p) {
		vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
		return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
		               mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
		           mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
		               mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
	}
	vec3 destination(vec3 d) {
		// A 3D lattice avoids longitude seams and polar pinching. Stars never twinkle.
		vec3 color = vec3(.006, .011, .027);
		for (int k = 0; k < 2; k++) {
			float layer = float(k);
			vec3 q = d * (92. + layer * 113.);
			vec3 cell = floor(q), f = fract(q) - .5;
			float seed = hash(cell + layer * 17.);
			vec3 offset = vec3(hash(cell + 3.), hash(cell + 7.), hash(cell + 11.)) - .5;
			float dist = length(f - offset * .4);
			float footprint = max(.025, length(fwidth(q)));
			float width = min(.24, .075 + footprint);
			float star = (1. - smoothstep(.015, width, dist)) * .006 / (width * width);
			color += mix(vec3(.48, .67, 1.), vec3(.9, .94, 1.), seed)
			       * star * smoothstep(.965, 1., seed) * 2.;
		}
		vec3 q = d * 3.2 + vec3(5.7, 1.2, time * motion * .006);
		float cloud = 0., amplitude = .5;
		for (int i = 0; i < 4; i++) {
			cloud += noise(q) * amplitude; q = q * 2.03 + 13.1; amplitude *= .5;
		}
		float belt = exp(-pow((d.y + .28 * d.x) * 2.8, 2.));
		color += mix(vec3(.025, .072, .2), vec3(.085, .035, .13), cloud)
		       * pow(cloud, 2.) * belt * 2.4;
		return color;
	}
	void main() {
		float opening = clamp(open, 0., 1.);
		if (opening <= 0.) discard;
		float radius = max(.00001, smoothstep(0., 1., opening));
		vec3 origin = cameraLocal;
		vec3 ray = normalize(vLocal - origin);
		if (orthographic > .5) {
			ray = rayLocal;
			origin = vLocal - ray * dot(vLocal - cameraLocal, ray);
		}
		float b = dot(origin, ray), c = dot(origin, origin) - radius * radius;
		float discriminant = b * b - c;
		float aa = max(fwidth(discriminant) * 1.5, radius * radius * .00001);
		if (discriminant < 0.) discard;
		float root = sqrt(discriminant), distance = -b - root;
		if (distance < 0.) distance = -b + root;
		if (distance <= 0.) discard;
		vec3 hit = origin + ray * distance;
		vec3 normal = normalize(hit);
		float facing = clamp(abs(dot(-ray, normal)), 0., 1.);
		float edge = pow(1. - facing, 3.);
		vec3 tangent = normal - ray * dot(ray, normal);
		tangent /= max(length(tangent), .0001);
		// A single authored bend, strongest at grazing incidence; not a geodesic simulation.
		float bend = edge * 2.65;
		vec3 refracted = normalize(ray * cos(bend) - tangent * sin(bend));
		vec3 color = destination(refracted);
		// A mirrored, distorted suggestion of nearby warm light, without sampling the local scene.
		vec3 mirrored = reflect(ray, normal);
		float reflection = .35 + .65 * pow(.5 + .5 * sin(mirrored.y * 9. + mirrored.x * 4.), 3.);
		color = mix(color, edgeColor * reflection, edge * .48);
		float rim = exp(-facing * facing / .006);
		float interior = smoothstep(.07, .36, opening);
		color *= interior;
		color += vec3(.5, .72, 1.) * rim * 2.4;
		float coverage = smoothstep(0., aa, discriminant);
		float alpha = coverage * smoothstep(0., .045, opening) * max(interior, rim);
		color = filmic(color);
		gl_FragColor = vec4(color * alpha, alpha);
		// The back faces only bound the work; occlusion uses the actual sphere entrance.
		#if defined(GL_EXT_frag_depth) || __VERSION__ >= 300
			vec4 clip = localToClip * vec4(hit, 1.);
			gl_FragDepthEXT = clamp(clip.z / clip.w * .5 + .5, 0., 1.);
		#endif
	}
`;

export class Wormhole {
	readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
	readonly uniforms = {
		open: { value: 0 }, time: { value: 0 }, edgeColor: { value: new Color("#C98A4B") },
		cameraLocal: { value: new Vector3() }, rayLocal: { value: new Vector3(0, 0, -1) },
		localToClip: { value: new Matrix4() }, orthographic: { value: 0 }, motion: { value: 1 },
	};
	private inverseWorld = new Matrix4();

	/** Unit radius at open=1; position, rotate and scale mesh to place the destination sky. */
	constructor(reducedMotion = false) {
		this.uniforms.motion.value = reducedMotion ? 0 : 1;
		const material = new ShaderMaterial({
			vertexShader: mouthVertex, fragmentShader: mouthFragment, uniforms: this.uniforms,
			transparent: true, premultipliedAlpha: true, depthTest: true, depthWrite: false,
			side: BackSide, toneMapped: false, extensions: { derivatives: true, fragDepth: true },
		});
		// A slightly oversized shell covers the analytic silhouette between polygon edges.
		// Back faces keep the same single draw working when the camera enters the mouth.
		this.mesh = new Mesh(new SphereGeometry(1.015, 48, 32), material);
		this.mesh.name = "doomsday_wormhole";
		this.mesh.renderOrder = 2;
		this.mesh.visible = false;
		// Full-radius geometry bounds already contain every stage of the opening.
	}

	/** Call after moving the mesh and camera, before rendering; time is in seconds. */
	update(camera: Camera, time: number) {
		this.uniforms.time.value = time;
		this.mesh.visible = this.uniforms.open.value > 0;
		if (!this.mesh.visible) return;
		camera.updateWorldMatrix(true, false);
		this.mesh.updateWorldMatrix(true, false);
		this.inverseWorld.copy(this.mesh.matrixWorld).invert();
		this.uniforms.cameraLocal.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(this.inverseWorld);
		camera.getWorldDirection(this.uniforms.rayLocal.value).transformDirection(this.inverseWorld);
		this.uniforms.orthographic.value = (camera as OrthographicCamera).isOrthographicCamera ? 1 : 0;
		this.uniforms.localToClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(this.mesh.matrixWorld);
	}

	dispose() {
		this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose();
	}
}
