import { CanvasTexture, LinearFilter, Mesh, ShaderMaterial, SRGBColorSpace, type Material, type Object3D } from "three";

/**
 * Protocol 01's screens. Nothing switches on by magic: first the pull reaches the monitors and their
 * picture tears and smears (gravity bending the signal), then each one cuts to black and powers up like a
 * tube, a single bright line opening into JARVIS's protocol screen, whose rows type in top to bottom.
 * Driven by three 0..1 levels the director tweens: interference, boot, rows.
 */
const W = 1024, H = 640;
const GOLD = "#f2b65a", AMBER = "#ff8a3c", DIM = "rgba(242,182,90,.45)", RED = "#ff5a3c";

function panel(draw: (g: CanvasRenderingContext2D) => void) {
	const c = document.createElement("canvas"); c.width = W; c.height = H;
	const g = c.getContext("2d")!;
	g.fillStyle = "#04070b"; g.fillRect(0, 0, W, H);
	g.strokeStyle = "rgba(242,182,90,.06)"; g.lineWidth = 1;
	for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
	for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
	g.strokeStyle = DIM; g.lineWidth = 2; g.strokeRect(14, 14, W - 28, H - 28);
	g.font = "600 30px ui-monospace, Consolas, monospace"; g.fillStyle = GOLD; g.fillText("J.A.R.V.I.S.", 44, 70);
	g.font = "500 22px ui-monospace, Consolas, monospace"; g.fillStyle = AMBER; g.textAlign = "right"; g.fillText("LIFEBOAT PROTOCOL", W - 44, 68); g.textAlign = "left";
	g.fillStyle = DIM; g.fillRect(44, 88, W - 88, 2);
	draw(g);
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.minFilter = LinearFilter; t.anisotropy = 4;
	return t;
}

/** The left screen: the checklist, the first protocol live, the rest waiting. */
const checklist = () => panel(g => {
	const rows = [["01", "BATTEN DOWN", "ACTIVE"], ["02", "CORE", "STANDBY"], ["03", "WATCH LINK", "STANDBY"], ["04", "SEAL THE POCKET", "STANDBY"], ["05", "HULL", "STANDBY"], ["06", "HEART", "STANDBY"], ["07", "IGNITION", "STANDBY"]];
	g.font = "500 30px ui-monospace, Consolas, monospace";
	rows.forEach(([n, name, status], i) => {
		const y = 150 + i * 56;
		g.fillStyle = i === 0 ? GOLD : DIM; g.fillText(`${n}  ${name}`, 60, y);
		g.fillStyle = "rgba(242,182,90,.25)"; for (let x = 470; x < 760; x += 18) g.fillRect(x, y - 8, 6, 3);
		g.fillStyle = i === 0 ? AMBER : DIM; g.textAlign = "right"; g.fillText(status!, W - 60, y); g.textAlign = "left";
	});
	g.fillStyle = RED; g.font = "500 24px ui-monospace, Consolas, monospace"; g.fillText("POCKET INTEGRITY", 60, 560);
	g.strokeStyle = RED; g.lineWidth = 2; g.strokeRect(330, 540, 600, 26); g.fillRect(334, 544, 600 * .31 - 8, 18);
	g.textAlign = "right"; g.fillText("31%", W - 60, 600); g.textAlign = "left";
});

/** The back screen: the lab's own floor plan turning into a hull, with the conversion bars. */
const schematic = () => panel(g => {
	g.strokeStyle = GOLD; g.lineWidth = 3;
	// The lab, from above (its L), and the hull it becomes, dashed around it.
	const ox = 140, oy = 170, s = 22;
	g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + 13 * s, oy); g.lineTo(ox + 13 * s, oy + 11.4 * s); g.lineTo(ox + 5.7 * s, oy + 11.4 * s); g.lineTo(ox + 5.7 * s, oy + 6.7 * s); g.lineTo(ox, oy + 6.7 * s); g.closePath(); g.stroke();
	g.setLineDash([10, 8]); g.strokeStyle = AMBER; g.lineWidth = 2;
	g.beginPath(); g.moveTo(ox - 40, oy - 30); g.lineTo(ox + 13 * s + 40, oy - 30); g.lineTo(ox + 13 * s + 70, oy + 8 * s); g.lineTo(ox + 6.5 * s, oy + 11.4 * s + 120); g.lineTo(ox - 70, oy + 8 * s); g.closePath(); g.stroke();
	g.setLineDash([]);
	g.font = "500 22px ui-monospace, Consolas, monospace"; g.fillStyle = DIM; g.fillText("HULL CONVERSION", 600, 160);
	[["SEAL", .0], ["HULL", .0], ["HEART", .0], ["ENGINES", .0], ["HEADING", 1]].forEach(([name, v], i) => {
		const y = 210 + i * 70;
		g.fillStyle = GOLD; g.fillText(name as string, 600, y);
		g.strokeStyle = DIM; g.lineWidth = 2; g.strokeRect(600, y + 14, 360, 18);
		if (v) { g.fillStyle = AMBER; g.fillRect(604, y + 18, 352 * (v as number), 10); g.fillStyle = AMBER; g.fillText("AWAY", 880, y); }
	});
});

const vertexShader = /* glsl */ `
	varying vec2 vUv;
	void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;
const fragmentShader = /* glsl */ `
	uniform sampler2D uOld, uNew;
	uniform float uTime, uInterference, uBoot, uRows, uHasOld;
	varying vec2 vUv;
	float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
	void main() {
		vec2 uv = vUv;
		// Interference: the picture tears in horizontal bands and smears sideways, worse in bursts.
		float band = floor(uv.y * 46.);
		float burst = step(.55, hash(vec2(band, floor(uTime * 14.))));
		uv.x += (hash(vec2(band, floor(uTime * 30.))) - .5) * .12 * uInterference * burst;
		uv.y += sin(uv.x * 9. + uTime * 7.) * .006 * uInterference;
		vec3 old = uHasOld > .5 ? vec3(texture2D(uOld, uv + vec2(.01 * uInterference, 0.)).r, texture2D(uOld, uv).g, texture2D(uOld, uv - vec2(.01 * uInterference, 0.)).b) : vec3(.02, .03, .05);
		float snow = hash(uv * 900. + uTime * 60.);
		old = mix(old, vec3(snow) * .6, uInterference * .45);
		// Boot: black, then a bright line that opens into the picture (0 .. .35 line, .35 .. .6 open).
		vec3 fresh = texture2D(uNew, uv).rgb;
		// Rows type in from the top; a cursor glows at the front.
		float row = 1. - uv.y;
		fresh *= step(row, uRows) + smoothstep(uRows + .02, uRows, row) * .0;
		fresh += vec3(1., .7, .35) * exp(-pow((row - uRows) * 80., 2.)) * .4 * step(uRows, .999);
		float line = smoothstep(.0, .02, uBoot) * (1. - smoothstep(.35, .6, uBoot));
		float open = smoothstep(.35, .6, uBoot);
		float lineMask = exp(-pow((uv.y - .5) / max(.002, .004 + open * .6), 2.));
		vec3 col = uBoot < .001 ? old : mix(vec3(0.), fresh, open) + vec3(1., .9, .75) * line * lineMask * 1.8;
		// Scanlines and a soft vignette on everything that is live.
		col *= .88 + .12 * sin(vUv.y * 900.);
		col *= 1. - .35 * pow(length(vUv - .5) * 1.25, 2.);
		gl_FragColor = vec4(col, 1.);
	}
`;

export function takeScreens(scene: Object3D) {
	const screens = (["monitor_a_screen", "monitor_b_screen"] as const).map((name, i) => {
		const mesh = scene.getObjectByName(name) ?? (name === "monitor_b_screen" ? scene.getObjectByName("monitor_b._screen") : undefined);
		if (!(mesh instanceof Mesh)) return null;
		const old = mesh.material as Material & { map?: CanvasTexture | null };
		const texture = i === 0 ? checklist() : schematic();
		const material = new ShaderMaterial({
			vertexShader, fragmentShader, toneMapped: false,
			uniforms: { uOld: { value: old.map ?? null }, uNew: { value: texture }, uTime: { value: 0 }, uInterference: { value: 0 }, uBoot: { value: 0 }, uRows: { value: 0 }, uHasOld: { value: old.map ? 1 : 0 } },
		});
		mesh.material = material;
		return { mesh, old, material, texture };
	}).filter((s): s is NonNullable<typeof s> => !!s);
	const levels = { interference: 0, boot: [0, 0], rows: [0, 0] };
	return {
		levels,
		update(time: number) {
			screens.forEach((s, i) => {
				const u = s.material.uniforms;
				u.uTime!.value = time; u.uInterference!.value = levels.interference; u.uBoot!.value = levels.boot[i]; u.uRows!.value = levels.rows[i];
			});
		},
		restore() {
			for (const s of screens) { s.mesh.material = s.old; s.material.dispose(); s.texture.dispose(); }
		},
	};
}
