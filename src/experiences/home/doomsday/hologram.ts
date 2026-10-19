import gsap from "gsap";
import {
	AdditiveBlending, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, MeshBasicMaterial, Mesh, PlaneGeometry,
	RingGeometry, ShaderMaterial, SRGBColorSpace, Vector3, type Material, type Object3D, type Texture,
} from "three";
import { createContactShadow, createWatch } from "../world/scene-3.devices";

/** The lab desk's top, and the free spot on it beside the monitors where the watch lives. */
const DESK_Y = 1.855;
/** Beside the Rubik's cube, on clear wood. */
export const WATCH_SPOT = new Vector3(.02, DESK_Y, -1.97);
export const WATCH_TURN = .32;

/**
 * The Apple Watch Ultra (the same model as on the contact desk) on its charging stand, on the lab desk.
 * It belongs to the room: the film finds it by name and takes it over; it never floats.
 */
export function placeLabWatch(parent: Object3D, envMap: Texture) {
	const kit = { geometries: [] as BufferGeometry[], materials: [] as Material[], textures: [] as Texture[], envMap };
	const watch = createWatch(kit);
	const root = new Group(); root.name = "lab_watch";
	root.position.copy(WATCH_SPOT); root.rotation.y = WATCH_TURN;
	watch.group.scale.setScalar(MM);
	const shadow = createContactShadow(kit, .3, .3, .5); shadow.position.y = .002;
	root.add(watch.group, shadow);
	root.userData.watch = watch;
	parent.add(root);
	return root;
}

/**
 * Protocol 03: the watch takes the helm. The same Apple Watch Ultra that sits on the contact desk, on its
 * charging stand, here on the lab desk. When the protocol reaches it, its face wakes into JARVIS's amber
 * helm display, and the ship's interface rises out of the screen: a beam, three turning rings, a panel.
 */
/** The watch is modelled in millimetres; the lab is in its own units (a phone here is ~0.25 wide). */
const MM = .0036;

function helmFace() {
	const c = document.createElement("canvas"); c.width = 422; c.height = 514;
	const g = c.getContext("2d")!;
	g.save(); g.beginPath(); g.roundRect(0, 0, 422, 514, 96); g.clip();
	g.fillStyle = "#040302"; g.fillRect(0, 0, 422, 514);
	g.strokeStyle = "#f2b65a"; g.lineWidth = 6;
	for (const r of [150, 118, 86]) { g.beginPath(); g.arc(211, 236, r, 0, Math.PI * 2); g.stroke(); g.lineWidth -= 1.5; }
	g.fillStyle = "#ffcf86"; g.beginPath(); g.arc(211, 236, 40, 0, Math.PI * 2); g.fill();
	g.font = "700 30px ui-monospace, Consolas, monospace"; g.textAlign = "center"; g.fillStyle = "#f2b65a";
	g.fillText("HELM", 211, 440); g.font = "600 20px ui-monospace, Consolas, monospace"; g.fillStyle = "rgba(242,182,90,.7)"; g.fillText("LIFEBOAT · LINKED", 211, 472);
	g.restore();
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
function panelTexture() {
	const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
	const g = c.getContext("2d")!;
	g.strokeStyle = "#ffcf86"; g.lineWidth = 4;
	g.strokeRect(10, 10, 1004, 492);
	g.fillStyle = "#ffd590"; g.font = "700 50px ui-monospace, Consolas, monospace";
	g.fillText("LIFEBOAT · HELM LINKED", 48, 96);
	g.fillStyle = "#ffcf86"; g.fillRect(48, 122, 928, 3);
	g.font = "600 38px ui-monospace, Consolas, monospace"; g.fillStyle = "#ffc670";
	[["HULL", "SEALING"], ["CORE", "ONLINE"], ["ESCAPE VECTOR", "AWAY"], ["HORIZON", "2.1 KM"]].forEach(([k, v], i) => {
		g.textAlign = "left"; g.fillText(k!, 48, 196 + i * 72);
		g.textAlign = "right"; g.fillText(v!, 976, 196 + i * 72);
	});
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
	return t;
}

export function createHologram(parent: Object3D, envMap: Texture) {
	const kit = { geometries: [] as BufferGeometry[], materials: [] as Material[], textures: [] as Texture[], envMap };
	// The room's own watch, where it always sits; only if the room has none is one placed for the film.
	const ownWatch = !parent.getObjectByName("lab_watch");
	const root = parent.getObjectByName("lab_watch") ?? placeLabWatch(parent, envMap);
	const watch = root.userData.watch as ReturnType<typeof createWatch>;
	parent.updateMatrixWorld(true);

	// The projection rises from the watch's screen.
	const screen = watch.display.getWorldPosition(new Vector3());
	root.worldToLocal(screen);
	const gold = new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
	const beamMaterial = new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
	const beam = new Mesh(new CylinderGeometry(.42, .03, .8, 32, 1, true), beamMaterial);
	beam.position.set(screen.x, screen.y + .42, screen.z);
	const rings = [.18, .3, .44].map((r, i) => { const m = new Mesh(new RingGeometry(r, r + .012, 64), gold); m.rotation.x = -Math.PI / 2; m.position.set(screen.x, screen.y + .2 + i * .22, screen.z); m.userData.y = m.position.y; return m; });
	const tex = panelTexture();
	// Projected light, not a slate: the text glows, scanlines run through it, it flickers faintly and fades at its edges.
	const panelMat = new ShaderMaterial({
		uniforms: { map: { value: tex }, opacity: { value: 0 }, uTime: { value: 0 } },
		transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, toneMapped: false,
		vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
		fragmentShader: `
			uniform sampler2D map; uniform float opacity, uTime; varying vec2 vUv;
			void main() {
				vec4 t = texture2D(map, vUv + vec2(sin(vUv.y * 40. + uTime * 7.) * .0008, 0.));
				float scan = .78 + .22 * sin(vUv.y * 420. - uTime * 9.);
				float flicker = .92 + .08 * sin(uTime * 23.) * sin(uTime * 7.3);
				vec2 e = min(vUv, 1. - vUv); float edge = smoothstep(0., .06, min(e.x, e.y));
				vec3 col = t.rgb * t.a * 2.6 * scan * flicker + vec3(1., .62, .25) * .045 * edge;
				gl_FragColor = vec4(col * opacity * edge, 1.);
			}`,
	});
	const panel = new Mesh(new PlaneGeometry(1.25, .62), panelMat); panel.position.set(screen.x, screen.y + 1.2, screen.z);   // floating above the beam, not inside it
	// A dark glass backing, so the amber reads against whatever is behind it (the corkboard, the wall).
	const backingMat = new MeshBasicMaterial({ color: new Color("#020304"), transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
	const backing = new Mesh(new PlaneGeometry(1.32, .68), backingMat); backing.position.copy(panel.position).add(new Vector3(0, 0, -.01)); backing.renderOrder = -1;
	const projection = new Group(); projection.add(beam, ...rings, backing, panel);
	// Scale about the screen so it grows out of the watch.
	projection.position.copy(screen); projection.children.forEach(c => c.position.sub(screen));
	projection.scale.setScalar(.01); root.add(projection);

	// The face: the real watch face until the helm takes it, then JARVIS.
	const display = watch.display.material as MeshBasicMaterial;
	const ownFace = display.map;
	const helm = helmFace();

	return {
		root,
		open() {
			display.map = helm; display.needsUpdate = true;
			gsap.to(projection.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: "back.out(1.6)" });
			gsap.to(gold, { opacity: .9, duration: .8 }); gsap.to(beamMaterial, { opacity: .14, duration: .8 });
			gsap.to(panelMat.uniforms.opacity, { value: 1, duration: 1, delay: .5 }); gsap.to(backingMat, { opacity: .22, duration: 1, delay: .4 });
		},
		close() {
			gsap.to(projection.scale, { x: .01, y: .01, z: .01, duration: .6, ease: "power2.in" });
			gsap.to([gold, beamMaterial, backingMat], { opacity: 0, duration: .5 }); gsap.to(panelMat.uniforms.opacity, { value: 0, duration: .5 });
		},
		update(time: number) {
			panelMat.uniforms.uTime.value = time;
			rings.forEach((m, i) => { m.rotation.z = time * (i % 2 ? -.6 : .8); m.position.y = (m.userData.y as number) - screen.y + Math.sin(time * 1.4 + i) * .02; });
		},
		dispose() {
			gsap.killTweensOf([projection.scale, gold, panelMat.uniforms.opacity, beamMaterial, backingMat]);
			display.map = ownFace; display.needsUpdate = true;
			projection.removeFromParent();
			if (ownWatch) root.removeFromParent();
			kit.geometries.forEach(g => g.dispose()); kit.materials.forEach(m => m.dispose()); kit.textures.forEach(t => t.dispose());
			[beam, panel, backing, ...rings].forEach(m => m.geometry.dispose()); backingMat.dispose();
			gold.dispose(); beamMaterial.dispose(); panelMat.dispose(); tex.dispose(); helm.dispose();
		},
	};
}
