import {
	AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, Mesh,
	PlaneGeometry, Points, RingGeometry, ShaderMaterial, Vector2, Vector3, type Material, type Quaternion,
} from "three";

/**
 * The hyperspace drive (Act IV's way out). Original, built from how the films make it read, not from them:
 *
 *  - Portal: a window torn in space. It is born as a point of light with a wide anamorphic streak, slashes
 *    open sideways, then rips open into a circle (overshooting, settling). Its rim is plasma: hairline
 *    filaments, white-hot inside, gold sparks outside, arcs crawling round it. Through it: a real funnel of
 *    light (geometry, so it has depth and parallax) spiralling down to a white-hot throat, with sparks drawn
 *    into it. The ship flies in; the camera dives through after it.
 *  - Tunnel: the ride. Three nested tubes of light round the ship's line, each moving at its own speed (fine
 *    white hairlines racing close, blue streaked light behind them, slow nebula walls furthest out), pulses of
 *    light rushing past, and a white point ahead you never reach. At the end it unravels outward and is gone.
 *  - Streaks: a screen pass for the instant of the jump: stars stretched to lines, and snapped back at the end.
 *
 * Everything is driven by 0..1 levels the director tweens, and by its clock; nothing here keeps time itself.
 */
const hash = /* glsl */ `
	float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
	float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
		return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
	float fbm(vec2 p) { float s = 0., a = .5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.07 + 7.3; a *= .5; } return s; }
`;

// The window's shape against its opening (0..1): a point, a sideways slash, then torn open to a circle with an
// elastic overshoot. x and y are the radii as fractions of the full rim; z is the funnel's depth.
const shape = /* glsl */ `
	vec3 shape(float o) {
		float slash = smoothstep(.06, .3, o);
		float tear = clamp((o - .3) / .7, 0., 1.);
		float overshoot = 1. + sin(tear * 7.5) * exp(-tear * 4.5) * .18 * step(.001, tear);
		float sx = mix(.002, 1., slash) * mix(1.12, 1., tear) * mix(1., overshoot, tear);
		float sy = mix(.002, .035, slash) + (1. - .035) * (1. - pow(1. - tear, 3.)) * overshoot;
		return vec3(sx, min(sy, sx * 1.3), tear);
	}
`;

const RIM = 1.3;   // the rim's radius in the portal's own units (the director scales it ~70)

export function createPortal() {
	const uniforms = { uOpen: { value: 0 }, uTime: { value: 0 }, uFlare: { value: 0 } };
	const group = new Group(); group.name = "doomsday_portal";
	const materials: Material[] = [];
	const geometries: BufferGeometry[] = [];
	const add = (geometry: BufferGeometry, material: ShaderMaterial, order: number) => {
		const mesh = new Mesh(geometry, material); mesh.frustumCulled = false; mesh.renderOrder = order;
		group.add(mesh); materials.push(material); geometries.push(geometry); return mesh;
	};
	const common = { transparent: true, depthWrite: false, blending: AdditiveBlending };

	// 1 · The funnel: a trumpet of light behind the opening, down to a throat deep in it. Its walls are spiral
	// streaks flowing inward, rings pulsing down it, brightening to white at the throat.
	{
		const DEPTH = 5, profile = (k: number) => { const points: Vector2[] = [];
			for (let i = 0; i <= 64; i++) { const f = i / 64; points.push(new Vector2(RIM * k * (.05 + .95 * Math.pow(1 - f, 2.2)), -f * DEPTH)); }
			return points; };
		const geometry = new LatheGeometry(profile(1), 160); geometry.rotateX(Math.PI / 2);
		// A hole in space has no outside: an invisible shell just round the funnel writes depth only, so from any
		// angle outside the window you see into it and never its tail. From inside, its faces are turned away.
		const shellGeometry = new LatheGeometry(profile(1.04), 96); shellGeometry.rotateX(Math.PI / 2);
		add(shellGeometry, new ShaderMaterial({
			uniforms, colorWrite: false, depthWrite: true, side: BackSide,
			vertexShader: /* glsl */ `
				uniform float uOpen; ${shape}
				void main() { vec3 s = shape(uOpen); vec3 p = position; p.x *= s.x; p.y *= s.y; p.z *= .05 + .95 * s.z;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
			fragmentShader: "void main() { gl_FragColor = vec4(0.); }",
		}), 19);
		add(geometry, new ShaderMaterial({
			...common, side: DoubleSide, uniforms,
			vertexShader: /* glsl */ `
				uniform float uOpen; varying vec2 vUv; ${shape}
				void main() { vUv = uv; vec3 s = shape(uOpen); vec3 p = position; p.x *= s.x; p.y *= s.y; p.z *= .05 + .95 * s.z;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
			fragmentShader: /* glsl */ `
				uniform float uOpen, uTime; varying vec2 vUv; ${hash}
				void main() {
					float u = vUv.x, v = vUv.y;              // u round, v from the opening (0) to the throat (1)
					float t = uTime;
					// Spiral lanes, periodic round the funnel (no seam): streaks race inward along them.
					float lanes = 90.;
					float s = u * lanes + v * 26. - t * 2.2;
					float lane = floor(s), fx = fract(s);
					float seed = hash(vec2(mod(lane, lanes), 1.7));
					float head = fract(seed * 7. + t * (.5 + seed * .9));
					float run = smoothstep(head - .35, head, v) * (1. - smoothstep(head, head + .015, v));
					float line = (1. - smoothstep(.0, .14, abs(fx - .5))) * run * step(.45, seed);
					// Soft cloud on the walls, turning.
					float cloud = mix(fbm(vec2(u * 8. + v * 3. - t * .4, v * 6. - t * 1.6)), fbm(vec2((u - 1.) * 8. + v * 3. - t * .4, v * 6. - t * 1.6)), u);
					float rings = pow(.5 + .5 * sin(v * 34. - t * 9.), 10.) * smoothstep(.05, .4, v);
					vec3 deep = vec3(.03, .08, .32), blue = vec3(.25, .52, 1.), ice = vec3(.75, .9, 1.), hot = vec3(1., .97, .92);
					vec3 col = mix(deep, blue, cloud) * (.35 + cloud * .9) * (.7 + v * 1.2);
					col += ice * line * (.6 + v * 1.6);
					col += blue * rings * .45;
					col += mix(ice, hot, v) * pow(v, 9.) * 1.8;                      // the throat, white-hot
					col += vec3(.55, .3, 1.) * pow(cloud, 5.) * .5 * (1. - v);       // a little violet near the mouth
					float mouth = smoothstep(0., .06, v);                            // fades into the rim
					gl_FragColor = vec4(col * mouth * smoothstep(.25, .6, uOpen), 1.);
				}`,
		}), 21);
	}

	// 2 · The rim: plasma. Hairline filaments, white-hot on the inside edge, a gold corona and sparks outside,
	// arcs crawling round. Plus the halo and the shock ring when it tears open.
	add(new RingGeometry(RIM * .8, RIM * 1.6, 360, 1), new ShaderMaterial({
		...common, side: DoubleSide, uniforms,
		vertexShader: /* glsl */ `
			uniform float uOpen; varying vec2 vP; ${shape}
			void main() { vP = position.xy; vec3 s = shape(uOpen); vec3 p = position; p.x *= s.x; p.y *= s.y;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
		fragmentShader: /* glsl */ `
			uniform float uOpen, uTime; varying vec2 vP; ${hash}
			#define TAU 6.2831853
			float wrap(float a, float k, float y) { float w = (a + 3.14159265) / TAU; return mix(noise(vec2(a * k, y)), noise(vec2((a - TAU) * k, y)), w); }
			void main() {
				float a = atan(vP.y, vP.x), r = length(vP) / ${RIM.toFixed(2)};
				float t = uTime;
				float wob = (wrap(a, 3., t * .5) - .5) * .05 + (wrap(a, 11., t * 1.3) - .5) * .015;
				float d = r - 1. - wob;
				// Filaments: several hairlines just off the edge, each wavering on its own.
				float fil = 0.;
				for (int i = 0; i < 5; i++) {
					float fi = float(i);
					float off = (wrap(a, 5. + fi * 3., t * (.8 + fi * .3) + fi * 9.) - .5) * .09;
					float w = .007 + .004 * fi;
					fil += exp(-pow((d - off) / w, 2.)) * (1. - fi * .15) * (.4 + .9 * wrap(a, 7. + fi * 2., t * (.6 + fi * .2) + fi * 4.));
				}
				float flick = .35 + 1.1 * pow(wrap(a, 16., t * 1.6), 1.5) + .35 * wrap(a, 41., t * 3.1);
				float edge = exp(-pow(d / .014, 2.)) * 1.5 * flick;                                     // the white-hot inner edge
				float corona = exp(-max(d, 0.) * 8.) * step(0., d) * (.3 + .7 * wrap(a, 9., r * 5. - t * 2.));
				// Tendrils: plasma reaching out from the rim and curling back, a few at a time.
				float ten = pow(wrap(a, 14., t * .7), 6.) * exp(-max(d, 0.) * 5.) * step(0., d) * smoothstep(.0, .02, d) * 2.2;
				float glowIn = exp(min(d, 0.) * 22.) * step(d, 0.) * .35;                      // light spilling inward
				// Arcs: short bright runs that crawl round the rim and jump.
				float arcLane = floor(t * 3.);
				float arcA = (hash(vec2(arcLane, 2.)) - .5) * TAU + t * 1.7;
				float da = abs(mod(a - arcA + 3.14159265, TAU) - 3.14159265);
				float arc = exp(-da * da * 60.) * exp(-pow((d - .04 * sin(da * 40. + t * 30.)) / .006, 2.)) * 2.5;
				// Sparks thrown off outside, gold.
				float sparkField = pow(wrap(a, 60., r * 30. - t * 6.), 14.) * exp(-max(d, 0.) * 9.) * step(.0, d) * 4.;
				vec3 hot = vec3(1., .97, .92), ice = vec3(.65, .85, 1.), gold = vec3(1., .72, .36);
				vec3 violet = vec3(.6, .4, 1.);
				vec3 col = mix(ice, hot, .55) * edge + mix(vec3(.3, .55, 1.), ice, flick * .6) * fil * .55 + mix(gold, ice, .45) * corona * .9 + ice * glowIn
					+ mix(ice, hot, .6) * arc + gold * sparkField + mix(violet, ice, wrap(a, 3., t)) * ten;
				float live = smoothstep(.04, .2, uOpen);
				gl_FragColor = vec4(col * live, 1.);
			}`,
	}), 23);

	// 3 · Halo and shock: a soft glow round the window, and a ring of light thrown out as it tears open.
	add(new CircleGeometry(RIM * 4.5, 128), new ShaderMaterial({
		...common, side: DoubleSide, uniforms,
		vertexShader: /* glsl */ `
			varying vec2 vP; varying float vNear;
			void main() { vP = position.xy; vec4 mv = modelViewMatrix * vec4(position, 1.);
				vNear = smoothstep(1.5, 5., length((modelViewMatrix * vec4(0., 0., 0., 1.)).xyz) / length(modelMatrix[0].xyz));
				gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `
			uniform float uOpen; varying vec2 vP; varying float vNear; ${shape}
			void main() {
				vec3 s = shape(uOpen);
				vec2 q = vP / ${RIM.toFixed(2)} / max(vec2(s.x, s.y), vec2(.002));
				float r = length(vP) / ${RIM.toFixed(2)}, e = length(q);
				float halo = exp(-max(e - 1., 0.) * 2.6) * step(1., e) * .22 * smoothstep(.2, .5, uOpen);
				float shockR = 1. + s.z * 3.2, shock = exp(-pow((r - shockR) * 3.5, 2.)) * pow(1. - s.z, 3.) * step(.001, s.z) * .5;
				vec3 col = vec3(.45, .62, 1.) * halo + vec3(.8, .9, 1.) * shock;
				gl_FragColor = vec4(col * vNear, 1.);
			}`,
	}), 20);

	// 4 · The birth flare: a point and a wide anamorphic streak, turned to face the camera. Huge at the birth,
	// then a faint line across the frame while the window holds.
	add(new PlaneGeometry(1, 1), new ShaderMaterial({
		...common, uniforms,
		vertexShader: /* glsl */ `
			uniform float uOpen; varying vec2 vUv; varying float vNear;
			void main() { vUv = uv - .5;
				float scale = length(modelMatrix[0].xyz);
				vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.);
				vNear = smoothstep(2.5, 7., -mv.z / scale);
				mv.xy += position.xy * vec2(14., 2.2) * scale;
				gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `
			uniform float uOpen, uFlare; varying vec2 vUv; varying float vNear;
			void main() {
				vec2 p = vUv * vec2(14., 2.2);
				float birth = smoothstep(.0, .06, uOpen) * (1. - smoothstep(.22, .5, uOpen));
				float hold = smoothstep(.3, .7, uOpen) * .16;
				float k = birth * 1.6 + hold + uFlare;
				float streak = exp(-p.y * p.y * 900.) * exp(-abs(p.x) * .55);
				float wide = exp(-p.y * p.y * 60.) * exp(-abs(p.x) * 1.2) * .25;
				float core = exp(-dot(p, p) * 40.) * 3.;
				vec3 col = vec3(.55, .75, 1.) * (streak + wide) + vec3(1., .97, .92) * core * birth;
				gl_FragColor = vec4(col * k * vNear, 1.);
			}`,
	}), 24);

	// 5 · Sparks drawn in: specks spiralling round the mouth and down into the throat.
	{
		const N = 900, seeds = new Float32Array(N * 4);
		for (let i = 0; i < N; i++) seeds.set([Math.random() * Math.PI * 2, .85 + Math.random() * .9, Math.random(), .25 + Math.random() * .6], i * 4);
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3));
		geometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));
		const material = new ShaderMaterial({
			...common, uniforms,
			vertexShader: /* glsl */ `
				uniform float uOpen, uTime; attribute vec4 aSeed; varying float vA; ${shape}
				void main() {
					vec3 s = shape(uOpen);
					float k = fract(aSeed.z + uTime * aSeed.w * .35);
					float r = ${RIM.toFixed(2)} * mix(aSeed.y, .05, k * k);
					float a = aSeed.x + k * 5.5;
					vec3 p = vec3(cos(a) * r * s.x, sin(a) * r * s.y, -k * k * 6. * s.z);
					vec4 mv = modelViewMatrix * vec4(p, 1.);
					gl_Position = projectionMatrix * mv;
					gl_PointSize = clamp(900. / -mv.z, 1., 5.) * (1.2 - k * .6);
					vA = sin(k * 3.14159) * smoothstep(.45, .8, uOpen);
				}`,
			fragmentShader: /* glsl */ `
				varying float vA;
				void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.75, .88, 1.) * exp(-d * d * 14.) * vA * 1.6, 1.); }`,
		});
		const points = new Points(geometry, material); points.frustumCulled = false; points.renderOrder = 22;
		group.add(points); materials.push(material); geometries.push(geometry);
	}

	group.frustumCulled = false;
	return {
		mesh: group, uniforms,
		dispose() { group.removeFromParent(); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
	};
}

/** The ride: tubes of light round the ship's line. Place it with `follow` every frame of the ride. */
export function createTunnel(reduced: boolean) {
	const uniforms = { uTravel: { value: 0 }, uExit: { value: 0 }, uTime: { value: 0 }, uMotion: { value: reduced ? .15 : 1 } };
	const group = new Group(); group.name = "doomsday_tunnel"; group.visible = false;
	const LENGTH = 6000, BEHIND = 400;
	const tube = new CylinderGeometry(1, 1, 1, 128, 1, true); tube.rotateX(Math.PI / 2);   // axis along z, z in -.5 .. .5
	const materials: ShaderMaterial[] = [];
	const layer = (radius: number, kind: number, order: number) => {
		const material = new ShaderMaterial({
			transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, side: BackSide,
			uniforms: { ...uniforms, uKind: { value: kind }, uRadius: { value: radius } },
			vertexShader: /* glsl */ `
				uniform float uExit, uRadius; varying vec2 vUv; varying float vZ;
				void main() {
					vUv = uv;
					vec3 p = position; p.xy *= uRadius * (1. + uExit * uExit * 4.); p.z = (p.z + .5) * ${LENGTH.toFixed(1)} - ${BEHIND.toFixed(1)};
					vZ = p.z;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
				}`,
			fragmentShader: /* glsl */ `
				uniform float uTravel, uExit, uTime, uMotion, uKind; varying vec2 vUv; varying float vZ; ${hash}
				void main() {
					float u = vUv.x, z = vZ, t = uTime * uMotion;
					// Fades: from behind the camera, and far ahead into the white.
					float fade = smoothstep(-${BEHIND.toFixed(1)}, -100., z) * (1. - smoothstep(1800., ${(LENGTH - BEHIND).toFixed(1)}, z));
					vec3 col = vec3(0.);
					if (uKind < .5) {
						// Fine: white hairlines racing past, close.
						float lanes = 220., x = u * lanes, lane = floor(x);
						float seed = hash(vec2(lane, 3.));
						float seg = 260. + seed * 520.;
						float y = (z + t * (1900. + seed * 900.)) / seg + seed * 17.;
						float run = smoothstep(.0, .8, fract(y)) * (1. - smoothstep(.8, .83, fract(y)));
						float line = 1. - smoothstep(.06, .2, abs(fract(x) - .5));
						col = mix(vec3(.7, .85, 1.), vec3(1.), seed) * line * run * step(.55, seed) * 1.6;
					} else if (uKind < 1.5) {
						// Middle: blue streaked light, turning slowly, with pulses rushing past.
						float uu = u + t * .015 + z * .00004;
						float a = mix(noise(vec2(uu * 40., z * .004 + t * 3.2)), noise(vec2((uu - 1.) * 40., z * .004 + t * 3.2)), u);
						float b = mix(noise(vec2(uu * 13., z * .0015 + t * 1.8)), noise(vec2((uu - 1.) * 13., z * .0015 + t * 1.8)), u);
						float streak = pow(a, 5.) * 1.5 + pow(b, 3.) * .5;
						float pulse = pow(.5 + .5 * sin((z + t * 2400.) * .0045), 22.) * .12;
						col = mix(vec3(.12, .3, .95), vec3(.6, .82, 1.), a) * streak + vec3(.55, .75, 1.) * pulse;
					} else {
						// Outer: slow nebula walls, deep blue and a little violet.
						float uu = u - t * .008;
						float c = mix(fbm(vec2(uu * 6., z * .0012 + t * .5)), fbm(vec2((uu - 1.) * 6., z * .0012 + t * .5)), u);
						col = mix(vec3(.02, .05, .22), vec3(.2, .35, .95), c) * pow(c, 1.6) * 1.2 + vec3(.4, .2, .75) * pow(c, 6.) * .6;
					}
					gl_FragColor = vec4(col * fade * uTravel * (1. - uExit), 1.);
				}`,
		});
		materials.push(material);
		const mesh = new Mesh(tube, material); mesh.frustumCulled = false; mesh.renderOrder = order;
		group.add(mesh);
	};
	layer(150, 2, 990);
	layer(70, 1, 991);
	layer(38, 0, 992);
	// The far end: a white point you never reach, with a soft bloom round it.
	const coreMaterial = new ShaderMaterial({
		transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, uniforms,
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() { vUv = uv - .5; vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.); mv.xy += position.xy * -mv.z * .55; gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `
			uniform float uTravel, uExit; varying vec2 vUv;
			void main() { float d = length(vUv); vec3 col = vec3(1., .98, .95) * exp(-d * d * 900.) * 2. + vec3(.5, .7, 1.) * exp(-d * d * 60.) * .35;
				gl_FragColor = vec4(col * uTravel * (1. - uExit), 1.); }`,
	});
	materials.push(coreMaterial);
	const core = new Mesh(new PlaneGeometry(1, 1), coreMaterial); core.position.z = 3500; core.frustumCulled = false; core.renderOrder = 993;
	group.add(core);
	return {
		group, uniforms,
		/** Centre it on the ship's line: where the ship is, pointing the way it flies. */
		follow(position: Vector3, quaternion: Quaternion, seconds: number) {
			uniforms.uTime.value = seconds;
			group.visible = uniforms.uTravel.value > .001 && uniforms.uExit.value < .999;
			group.position.copy(position); group.quaternion.copy(quaternion);
		},
		dispose() { group.removeFromParent(); tube.dispose(); core.geometry.dispose(); materials.forEach(m => m.dispose()); },
	};
}

export function createStreaks(reduced: boolean) {
	const uniforms = {
		uJump: { value: 0 }, uTravel: { value: 0 }, uExit: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 },
		uCenter: { value: new Vector2(0, 0) }, uAspect: { value: 16 / 9 }, uMotion: { value: reduced ? 0 : 1 },
	};
	const mesh = new Mesh(new PlaneGeometry(2, 2), new ShaderMaterial({
		uniforms, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending,
		vertexShader: "varying vec2 vNdc; void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0., 1.); }",
		fragmentShader: /* glsl */ `
			uniform float uJump, uTravel, uExit, uFlash, uTime, uAspect, uMotion; uniform vec2 uCenter; varying vec2 vNdc;
			${hash}
			void main() {
				vec2 q = (vNdc - uCenter) * vec2(uAspect, 1.);
				float r = length(q), a = atan(q.y, q.x);
				float stretch = uJump * (1. - uExit);
				vec3 col = vec3(0.);
				// Star lines: each angular lane a star; its head races out, its tail stays behind it, fading.
				float clearCentre = smoothstep(.2, .65, r);   // never over the ship we are riding behind
				for (int k = 0; k < 3; k++) {
					float layer = float(k), lanes = 180. + layer * 90.;
					float x = (a / 6.2831853 + .5) * lanes;
					float lane = floor(x);
					float seed = hash(vec2(lane, layer * 13.1));
					if (seed < .74) continue;
					float r0 = .05 + 1.4 * hash(vec2(lane, layer * 13.1 + 5.));
					float speed = (.35 + seed) * (uTravel * 1.6 + stretch * .4) * uMotion;
					float headR = mod(r0 + uTime * speed, 1.6) + .02;
					float len = (.004 + stretch * .45 + uTravel * .28) * headR;
					float t = clamp((r - (headR - len)) / max(len, 1e-4), 0., 1.);
					float along = t * t * (1. - smoothstep(headR, headR + .003, r)) * step(headR - len, r);
					float across = abs(fract(x) - .5) * r * 6.2831853 / lanes;
					float px = 1.5 / 720.;
					float width = .0004 + .0007 * stretch;
					float line = along * (1. - smoothstep(width, width + px, across));
					vec3 tint = mix(vec3(.7, .82, 1.), vec3(.95, .97, 1.), hash(vec2(lane, 9. + layer)));
					// In the tunnel (uTravel) the 3D tubes carry the ride; these stay a faint extra layer of speed.
					col += tint * line * (.4 + seed * .6) * (stretch * 1.3 + uTravel * .12) * mix(.15, 1., clearCentre);
				}
				col += vec3(1., .97, .92) * uFlash;
				gl_FragColor = vec4(col, 1.);
			}`,
	}));
	mesh.name = "doomsday_streaks"; mesh.frustumCulled = false; mesh.renderOrder = 998; mesh.visible = false;
	return {
		mesh, uniforms,
		update(seconds: number, aspect: number) {
			uniforms.uTime.value = seconds; uniforms.uAspect.value = aspect;
			mesh.visible = uniforms.uJump.value + uniforms.uTravel.value + uniforms.uFlash.value > .001;
		},
		dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); (mesh.material as ShaderMaterial).dispose(); },
	};
}
