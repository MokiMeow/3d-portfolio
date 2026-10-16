import { AdditiveBlending, CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from "three";

/**
 * The way in: a hairline crack of emerald light on the room's window. It is tiny (part of every visit),
 * appears a little while after you arrive, and breathes now and then. Clicking it loads the sequence.
 */
export function createDoomsdayCrack(modelScene: Object3D) {
	const canvas = document.createElement("canvas");
	canvas.width = 256; canvas.height = 512;
	const g = canvas.getContext("2d")!;
	let s = 11;
	const random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
	const branch = (x: number, y: number, angle: number, length: number, width: number, depth: number) => {
		g.beginPath(); g.moveTo(x, y);
		let cx = x, cy = y;
		const steps = 4 + Math.floor(random() * 4);
		for (let i = 0; i < steps; i++) {
			angle += (random() - .5) * .9;
			cx += Math.cos(angle) * length / steps; cy += Math.sin(angle) * length / steps;
			g.lineTo(cx, cy);
			if (depth > 0 && random() < .45) { g.stroke(); branch(cx, cy, angle + (random() < .5 ? .9 : -.9), length * .45, width * .6, depth - 1); g.beginPath(); g.moveTo(cx, cy); }
		}
		g.lineWidth = width; g.stroke();
	};
	g.lineCap = "round"; g.lineJoin = "round";
	for (const [blur, colour, scale] of [[14, "rgba(67,240,142,.55)", 2.4], [4, "rgba(170,255,205,.95)", 1]] as const) {
		s = 11; g.shadowBlur = blur; g.shadowColor = "#43f08e"; g.strokeStyle = colour;
		// From a point of impact high on the glass, splintering outward.
		for (let i = 0; i < 5; i++) branch(176, 132, i / 5 * Math.PI * 2 + .3, 120 + random() * 90, 1.6 * scale, 2);
	}
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
	// The window glass, in the model's frame: x 1.24..2.86, y 1.58..5.14, at z -3.113 (facing into the room).
	const mesh = new Mesh(new PlaneGeometry(1.6, 3.2), material);
	mesh.name = "doomsday_crack";
	mesh.position.set(2.05, 3.36, -3.09);
	mesh.renderOrder = 5;
	modelScene.add(mesh);
	let hovered = false;
	return {
		mesh,
		hover(on: boolean) { hovered = on; },
		/** `elapsed` in ms since the room loaded. It shows after 25 s, breathing, brighter under the pointer. */
		update(elapsed: number) {
			const t = elapsed / 1000;
			const shown = Math.min(1, Math.max(0, (t - 25) / 4));
			const breath = .28 + .22 * Math.pow(Math.max(0, Math.sin(t * .9)), 3);
			material.opacity = shown * (hovered ? 1 : breath);
		},
		dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); material.dispose(); texture.dispose(); },
	};
}
