import gsap from "gsap";
import {
	AdditiveBlending, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
	MeshStandardMaterial, PlaneGeometry, RingGeometry, SRGBColorSpace, type Object3D,
} from "three";

/**
 * The Watch, on the desk, becomes the bridge: gold rings rise from its face and bloom into the ship's
 * interface over the desk. The face, the rings and the panel are all drawn here; nothing is loaded.
 */
const AT = { x: -1.55, y: 1.93, z: .55 };

function panelTexture() {
	const c = document.createElement("canvas"); c.width = 512; c.height = 256;
	const g = c.getContext("2d")!;
	g.strokeStyle = "rgba(242,182,90,.9)"; g.fillStyle = "rgba(242,182,90,.95)"; g.lineWidth = 2;
	g.strokeRect(6, 6, 500, 244);
	g.font = "500 22px ui-monospace, Consolas, monospace";
	g.fillText("LIFEBOAT · AUTHORISED", 26, 48);
	g.font = "400 18px ui-monospace, Consolas, monospace";
	g.fillStyle = "rgba(242,182,90,.75)";
	["HULL CONTINUITY ........ 100%", "COMPANION UNIT ........ DOCKED", "ESCAPE VECTOR ......... AWAY", "HORIZON ............... 1.2 KM"].forEach((line, i) => g.fillText(line, 26, 100 + i * 34));
	const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
	return t;
}

export function createHologram(parent: Object3D) {
	const root = new Group(); root.name = "doomsday_watch"; root.position.set(AT.x, AT.y, AT.z); parent.add(root);
	// The watch itself: a small dark case with a lit face, lying on the desk.
	const caseMat = new MeshStandardMaterial({ color: new Color("#2b2b2e"), metalness: .8, roughness: .35 });
	const faceMat = new MeshBasicMaterial({ color: new Color("#1a1206") });
	const body = new Mesh(new BoxGeometry(.13, .035, .15), caseMat);
	const face = new Mesh(new PlaneGeometry(.11, .13), faceMat); face.rotation.x = -Math.PI / 2; face.position.y = .019;
	const strap = new Mesh(new BoxGeometry(.09, .012, .42), new MeshStandardMaterial({ color: new Color("#3a2a20"), roughness: .9 }));
	root.add(body, face, strap);
	// The projection: three rings and a panel, additive gold light.
	const gold = new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
	const beam = new Mesh(new CylinderGeometry(.42, .05, .8, 32, 1, true), new MeshBasicMaterial({ color: new Color("#f2b65a"), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
	beam.position.y = .42;
	const rings = [.18, .3, .44].map((r, i) => { const m = new Mesh(new RingGeometry(r, r + .012, 64), gold); m.rotation.x = -Math.PI / 2; m.position.y = .2 + i * .22; m.userData.y = m.position.y; return m; });
	const tex = panelTexture();
	const panelMat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
	const panel = new Mesh(new PlaneGeometry(1.1, .55), panelMat); panel.position.set(.15, 1.05, 0); panel.rotation.y = .5;
	const projection = new Group(); projection.add(beam, ...rings, panel); projection.scale.setScalar(.01); root.add(projection);

	return {
		root,
		open() {
			faceMat.color.set("#f2b65a");
			gsap.to(projection.scale, { x: 1, y: 1, z: 1, duration: 1.2, ease: "back.out(1.6)" });
			gsap.to(gold, { opacity: .9, duration: .8 }); gsap.to(beam.material as MeshBasicMaterial, { opacity: .12, duration: .8 });
			gsap.to(panelMat, { opacity: 1, duration: 1, delay: .5 });
		},
		close() {
			gsap.to(projection.scale, { x: .01, y: .01, z: .01, duration: .6, ease: "power2.in" });
			gsap.to([gold, panelMat, beam.material as MeshBasicMaterial], { opacity: 0, duration: .5 });
		},
		update(time: number) {
			rings.forEach((m, i) => { m.rotation.z = time * (i % 2 ? -.6 : .8); m.position.y = (m.userData.y as number) + Math.sin(time * 1.4 + i) * .02; });
		},
		dispose() {
			gsap.killTweensOf([projection.scale, gold, panelMat, beam.material]);
			root.removeFromParent();
			root.traverse(n => { if (n instanceof Mesh) { n.geometry.dispose(); (n.material as MeshBasicMaterial).dispose(); } });
			tex.dispose();
		},
	};
}
