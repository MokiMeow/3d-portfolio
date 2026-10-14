import {
	BufferGeometry,
	CanvasTexture,
	CatmullRomCurve3,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Float32BufferAttribute,
	Group,
	LinearFilter,
	Mesh,
	MeshBasicMaterial,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	RepeatWrapping,
	Shape,
	SphereGeometry,
	TubeGeometry,
	Vector3,
	type Material,
	type Texture,
} from "three";

/**
 * The two hero devices on the contact desk, modelled in millimetres and scaled
 * by the caller. Everything is procedural: no downloads, and each device is a
 * few draw calls. Dimensions follow Apple's published figures where they exist.
 */
type Kit = { geometries: BufferGeometry[]; materials: Material[]; textures: Texture[]; envMap: Texture };

// The room renders in linear output space, so authored sRGB colours are converted once.
const tone = (hex: string) => new Color(hex).convertLinearToSRGB();

function roundedRect(width: number, height: number, radius: number) {
	const w = width / 2, h = height / 2, r = Math.min(radius, w, h);
	const shape = new Shape();
	shape.moveTo(-w + r, -h);
	shape.lineTo(w - r, -h);
	shape.absarc(w - r, -h + r, r, -Math.PI / 2, 0, false);
	shape.lineTo(w, h - r);
	shape.absarc(w - r, h - r, r, 0, Math.PI / 2, false);
	shape.lineTo(-w + r, h);
	shape.absarc(-w + r, h - r, r, Math.PI / 2, Math.PI, false);
	shape.lineTo(-w, -h + r);
	shape.absarc(-w + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
	return shape;
}

function makers(kit: Kit) {
	const keep = <T extends BufferGeometry>(geometry: T) => (kit.geometries.push(geometry), geometry);
	const metal = (hex: string, roughness = 0.36) => {
		const material = new MeshStandardMaterial({ color: tone(hex), metalness: 1, roughness, envMap: kit.envMap, envMapIntensity: 1.1 });
		kit.materials.push(material);
		return material;
	};
	const glass = (hex: string, roughness = 0.07) => {
		const material = new MeshPhysicalMaterial({ color: tone(hex), metalness: 0, roughness, clearcoat: 1, clearcoatRoughness: 0.04, reflectivity: 0.6, envMap: kit.envMap, envMapIntensity: 1.5 });
		kit.materials.push(material);
		return material;
	};
	const matte = (hex: string, roughness = 0.9) => {
		const material = new MeshStandardMaterial({ color: tone(hex), metalness: 0, roughness, envMap: kit.envMap, envMapIntensity: 0.25 });
		kit.materials.push(material);
		return material;
	};
	const slab = (width: number, height: number, radius: number, depth: number, bevel = 0) =>
		keep(new ExtrudeGeometry(roundedRect(width, height, radius), {
			depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 14,
		}));
	return { keep, metal, glass, matte, slab };
}

/** What the phone shows while it rests on its stand: a small lock screen with the real time. */
function lockScreen(kit: Kit) {
	const canvas = document.createElement("canvas");
	canvas.width = 440; canvas.height = 956;
	const texture = new CanvasTexture(canvas);
	texture.minFilter = LinearFilter;
	texture.anisotropy = 8;
	kit.textures.push(texture);
	const context = canvas.getContext("2d");
	const blob = (x: number, y: number, radius: number, colour: string) => {
		if (!context) return;
		const fill = context.createRadialGradient(x, y, 0, x, y, radius);
		fill.addColorStop(0, colour); fill.addColorStop(1, "rgba(0,0,0,0)");
		context.fillStyle = fill; context.fillRect(0, 0, 440, 956);
	};
	const draw = () => {
		if (!context) return;
		const now = new Date();
		context.clearRect(0, 0, 440, 956);
		context.save();
		context.beginPath(); context.roundRect(0, 0, 440, 956, 62); context.clip();
		const sky = context.createLinearGradient(0, 0, 0, 956);
		sky.addColorStop(0, "#07122b"); sky.addColorStop(1, "#150a2e");
		context.fillStyle = sky; context.fillRect(0, 0, 440, 956);
		blob(80, 60, 420, "#3ee0b0"); blob(410, 210, 380, "#2d7dff"); blob(130, 740, 430, "#7a3cff"); blob(390, 920, 340, "#ff5c8a");
		context.fillStyle = "#000";
		context.beginPath(); context.roundRect(172, 13, 96, 34, 17); context.fill();
		context.fillStyle = "rgba(255,255,255,.92)"; context.textAlign = "center";
		context.font = "600 21px -apple-system, 'Segoe UI', sans-serif";
		context.fillText(now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), 220, 128);
		context.font = "700 112px -apple-system, 'Segoe UI', sans-serif";
		context.fillText(now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: false }), 220, 232);
		for (const [index, line] of ["Build Bot · One new message", "#deploys · Someone pressed the button", "Amma · Did you eat?"].entries()) {
			context.fillStyle = "rgba(255,255,255,.2)";
			context.beginPath(); context.roundRect(14, 610 + index * 80, 412, 70, 24); context.fill();
			context.fillStyle = "rgba(255,255,255,.95)"; context.textAlign = "left";
			context.font = "500 17px -apple-system, 'Segoe UI', sans-serif";
			context.fillText(line, 34, 652 + index * 80);
		}
		context.fillStyle = "rgba(255,255,255,.9)";
		context.beginPath(); context.roundRect(148, 938, 144, 5, 3); context.fill();
		context.restore();
		texture.needsUpdate = true;
	};
	draw();
	return { texture, draw };
}

/** iPhone 18 Pro Max: 163.4 x 78.0 x 8.75 mm, on a small charging stand. Origin: centre of the stand's foot. */
export function createPhone(kit: Kit) {
	const { keep, metal, glass, matte, slab } = makers(kit);
	const W = 78, H = 163.4, D = 8.75;
	const body = new Group();
	const band = metal("#5c2430", 0.34), back = glass("#4b1a25", 0.32), black = glass("#050506", 0.05), lens = glass("#0a0d14", 0.02);

	// Aluminium unibody with softened edges, the glass back set into it.
	const shell = new Mesh(slab(W, H, 13, D, 0.9), band);
	shell.position.z = -D / 2 + 0.9;
	const rear = new Mesh(slab(W - 5, H - 5, 11, 0.5), back);
	rear.position.z = -D / 2 - 0.12;
	// Front: black border, then the lit display 2.5 mm in from every edge.
	const front = new Mesh(slab(W - 2.2, H - 2.2, 12, 0.4), black);
	front.position.z = D / 2 - 0.3;
	const screen = lockScreen(kit);
	const displayMaterial = new MeshBasicMaterial({ map: screen.texture, transparent: true, toneMapped: false });
	kit.materials.push(displayMaterial);
	const display = new Mesh(keep(new ExtrudeGeometry(roundedRect(72.9, 158.4, 10.5), { depth: 0.02, bevelEnabled: false, curveSegments: 14 })), displayMaterial);
	// Extruded shapes carry UVs in millimetres; bring them into 0..1 across the display.
	const uv = display.geometry.getAttribute("uv");
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 72.9 + 0.5, uv.getY(i) / 158.4 + 0.5);
	display.position.z = D / 2 + 0.12;
	display.name = "phone_display";
	body.add(shell, rear, front, display);

	// Camera plateau across the top of the back, three ringed lenses, flash and LiDAR.
	const plateau = new Mesh(slab(70, 43, 9, 2, 0.5), metal("#52202b", 0.3));
	plateau.position.set(0, H / 2 - 4 - 21.5, -D / 2 - 2);
	body.add(plateau);
	const ring = keep(new CylinderGeometry(8.6, 8.6, 1.7, 40)), barrel = keep(new CylinderGeometry(6.4, 6.4, 1.9, 40)), dome = keep(new SphereGeometry(5.4, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2));
	const ringMetal = metal("#6b2a37", 0.22);
	// Seen from behind, the lens cluster sits on the left: mirrored here because the back faces -Z.
	for (const [x, y] of [[17, 4.5], [17, -13.5], [-2, -4.5]]) {
		const lip = new Mesh(ring, ringMetal), tube = new Mesh(barrel, black), eye = new Mesh(dome, lens);
		for (const part of [lip, tube, eye]) { part.rotation.x = -Math.PI / 2; part.position.set(x, H / 2 - 25.5 + y, -D / 2 - 2.6); }
		eye.scale.z = 0.22; eye.position.z -= 0.4;
		body.add(lip, tube, eye);
	}
	const small = keep(new CylinderGeometry(2.8, 2.8, 0.5, 24));
	const flash = new Mesh(small, matte("#f4ead0", 0.5)), lidar = new Mesh(small, black);
	flash.rotation.x = lidar.rotation.x = -Math.PI / 2;
	flash.position.set(-27, H / 2 - 15, -D / 2 - 2.2); lidar.position.set(-27, H / 2 - 36, -D / 2 - 2.2);
	body.add(flash, lidar);

	// Action, volume, side button and Camera Control (sides as seen from the screen).
	const button = (length: number, x: number, fromTop: number, proud = 0.55) => {
		const mesh = new Mesh(slab(2.6, length, 1.2, 1.2), band);
		mesh.rotation.y = Math.PI / 2;
		mesh.position.set(x + (x > 0 ? proud - 0.6 : -proud - 0.6), H / 2 - fromTop, 0);
		body.add(mesh);
	};
	button(7, -W / 2, 31); button(11, -W / 2, 48); button(11, -W / 2, 63); button(17, W / 2, 53); button(13, W / 2, 96, 0.15);

	// Stand: a weighted disc, a short arm and a charging puck holding the phone in landscape tilt.
	const stand = new Group();
	const steel = metal("#9fa2a8", 0.52);
	const foot = new Mesh(keep(new CylinderGeometry(42, 44, 5, 56)), steel);
	foot.position.y = 2.5;
	const arm = new Mesh(slab(16, 78, 6, 6, 1), steel);
	arm.position.set(0, 42, -14); arm.rotation.x = -0.32;
	const puck = new Mesh(keep(new CylinderGeometry(28, 28, 5, 48)), matte("#f2f2f0", 0.6));
	puck.rotation.x = Math.PI / 2 - 0.32; puck.position.set(0, 86, -22);
	stand.add(foot, arm, puck);
	body.rotation.x = -0.32;
	body.position.set(0, 86 + Math.cos(0.32) * 4, -22 + 9.5);
	// Lift so the phone's lower edge clears the foot.
	body.position.y += 6;

	const phone = new Group();
	phone.name = "iphone_18_pro_max";
	phone.add(stand, body);
	return { group: phone, display, refresh: screen.draw };
}

/** A soft dark pool under an object, standing in for the shadow the bake cannot know about. Lies flat; size in the caller's units. */
export function createContactShadow(kit: Kit, width: number, depth: number, strength = 0.5) {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 128;
	const context = canvas.getContext("2d");
	if (context) {
		const pool = context.createRadialGradient(64, 64, 6, 64, 64, 64);
		pool.addColorStop(0, `rgba(0,0,0,${strength})`); pool.addColorStop(0.45, `rgba(0,0,0,${strength * 0.5})`); pool.addColorStop(1, "rgba(0,0,0,0)");
		context.fillStyle = pool; context.fillRect(0, 0, 128, 128);
	}
	const texture = new CanvasTexture(canvas);
	kit.textures.push(texture);
	const material = new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
	kit.materials.push(material);
	const geometry = new PlaneGeometry(width, depth);
	kit.geometries.push(geometry);
	const shadow = new Mesh(geometry, material);
	shadow.rotation.x = -Math.PI / 2;
	shadow.renderOrder = 2;
	shadow.name = "contact_shadow";
	return shadow;
}

/** The face the watch shows while it charges: Modular Ultra, with the real time. */
function watchFace(kit: Kit) {
	const canvas = document.createElement("canvas");
	canvas.width = 422; canvas.height = 514;
	const texture = new CanvasTexture(canvas);
	texture.minFilter = LinearFilter;
	texture.anisotropy = 8;
	kit.textures.push(texture);
	const context = canvas.getContext("2d");
	const ring = (x: number, y: number, radius: number, colour: string, part: number) => {
		if (!context) return;
		context.lineWidth = 9; context.lineCap = "round";
		context.strokeStyle = colour; context.globalAlpha = 0.25;
		context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.stroke();
		context.globalAlpha = 1;
		context.beginPath(); context.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * part); context.stroke();
	};
	const draw = () => {
		if (!context) return;
		const now = new Date(), font = "-apple-system, 'SF Pro Rounded', 'Segoe UI', sans-serif";
		context.clearRect(0, 0, 422, 514);
		context.save();
		context.beginPath(); context.roundRect(0, 0, 422, 514, 96); context.clip();
		context.fillStyle = "#000"; context.fillRect(0, 0, 422, 514);
		// bezel: seconds scale and a line of live data, as on Modular Ultra
		context.fillStyle = "#ff9a3c"; context.font = `600 17px ${font}`; context.textAlign = "center";
		context.fillText("ELEVATION 920 M  ·  12.97° N 77.59° E", 211, 34);
		// top row
		context.textAlign = "left"; context.fillStyle = "#ff9a3c"; context.font = `700 22px ${font}`;
		context.fillText(now.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() + " " + now.getDate(), 34, 92);
		context.textAlign = "right"; context.fillStyle = "#fff";
		context.fillText("26°", 388, 92);
		// time
		context.textAlign = "center"; context.fillStyle = "#fff"; context.font = `600 132px ${font}`;
		context.fillText(now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }), 211, 226);
		// middle platter: a small elevation trace
		context.fillStyle = "rgba(255,255,255,.1)"; context.beginPath(); context.roundRect(30, 258, 362, 96, 26); context.fill();
		context.strokeStyle = "#ff9a3c"; context.lineWidth = 4; context.lineJoin = "round"; context.beginPath();
		[[48, 330], [84, 318], [118, 326], [150, 300], [186, 308], [218, 282], [254, 296], [290, 276], [324, 290], [372, 272]].forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
		context.stroke();
		context.fillStyle = "rgba(255,255,255,.75)"; context.font = `600 17px ${font}`; context.textAlign = "left"; context.fillText("TRAIL  ·  8.4 KM", 48, 286);
		// bottom row: rings, heart rate, battery
		ring(86, 428, 34, "#fa114f", 0.82); ring(86, 428, 23, "#a6ff00", 0.64); ring(86, 428, 12, "#00e0d6", 0.9);
		context.fillStyle = "#ff375f"; context.font = `700 40px ${font}`; context.textAlign = "center"; context.fillText("72", 211, 438);
		context.fillStyle = "rgba(255,255,255,.7)"; context.font = `600 16px ${font}`; context.fillText("BPM", 211, 462);
		context.strokeStyle = "#30d158"; context.lineWidth = 9; context.lineCap = "round";
		context.globalAlpha = 0.25; context.beginPath(); context.arc(336, 428, 30, 0, Math.PI * 2); context.stroke();
		context.globalAlpha = 1; context.beginPath(); context.arc(336, 428, 30, -Math.PI / 2, Math.PI * 1.1); context.stroke();
		context.fillStyle = "#fff"; context.font = `700 22px ${font}`; context.fillText("84", 336, 436);
		context.restore();
		texture.needsUpdate = true;
	};
	draw();
	return { texture, draw };
}

/**
 * Apple Watch Ultra: a 49 x 44 x 12 mm titanium case with its flat sapphire front, orange Action button,
 * guarded Digital Crown and an Alpine Loop, held on a small charging stand. Origin: centre of the stand's foot.
 */
export function createWatch(kit: Kit) {
	const { keep, metal, glass, matte, slab } = makers(kit);
	const W = 44, H = 49, D = 10.4;
	const body = new Group();
	const titanium = metal("#bdb7ab", 0.44), black = glass("#050506", 0.05), orange = matte("#ff5a14", 0.5);
	// Case, then the raised titanium rim that protects the flat crystal.
	const shell = new Mesh(slab(W, H, 11.5, D, 1.4), titanium);
	shell.position.z = -D / 2 + 1.4;
	const rim = new Mesh(slab(W - 0.6, H - 0.6, 11.2, 1.5, 0.35), titanium);
	rim.position.z = D / 2 + 0.2;
	const crystal = new Mesh(slab(W - 3.4, H - 3.4, 10, 1.3, 0.25), black);
	crystal.position.z = D / 2 + 0.65;
	const face = watchFace(kit);
	const displayMaterial = new MeshBasicMaterial({ map: face.texture, transparent: true, toneMapped: false });
	kit.materials.push(displayMaterial);
	const DW = 37.2, DH = DW * 514 / 422;
	const display = new Mesh(keep(new ExtrudeGeometry(roundedRect(DW, DH, 8.4), { depth: 0.02, bevelEnabled: false, curveSegments: 14 })), displayMaterial);
	const uv = display.geometry.getAttribute("uv");
	for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / DW + 0.5, uv.getY(i) / DH + 0.5);
	display.position.z = D / 2 + 1.72;
	display.name = "watch_display";
	// Back crystal: a shallow black ceramic dome with the sensor window.
	const dome = new Mesh(keep(new SphereGeometry(16.5, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2)), glass("#16171a", 0.12));
	dome.rotation.x = -Math.PI / 2; dome.scale.z = 0.14; dome.position.z = -D / 2;
	body.add(shell, rim, crystal, display, dome);

	// Right side: the crown guard, the Digital Crown with its orange ring, and the side button.
	const guard = new Mesh(slab(8.6, 27, 3.6, 3.4, 1.1), titanium);
	guard.rotation.y = Math.PI / 2; guard.position.set(W / 2 - 1.1, 1.5, 0);
	const crown = new Mesh(keep(new CylinderGeometry(4.3, 4.3, 3.2, 40)), metal("#c9c3b7", 0.3));
	crown.rotation.z = Math.PI / 2; crown.position.set(W / 2 + 3.2, 7.2, 0);
	const crownRing = new Mesh(keep(new CylinderGeometry(4.45, 4.45, 0.7, 40)), orange);
	crownRing.rotation.z = Math.PI / 2; crownRing.position.set(W / 2 + 4.5, 7.2, 0);
	const crownCap = new Mesh(keep(new CylinderGeometry(3.5, 3.5, 0.5, 32)), titanium);
	crownCap.rotation.z = Math.PI / 2; crownCap.position.set(W / 2 + 4.95, 7.2, 0);
	const sideButton = new Mesh(slab(3.4, 10.5, 1.6, 1.6, 0.5), titanium);
	sideButton.rotation.y = Math.PI / 2; sideButton.position.set(W / 2 + 1.7, -6.6, 0);
	// Left side: the Action button in International Orange, and the speaker slots below it.
	const action = new Mesh(slab(4.2, 13.5, 2.1, 1.7, 0.5), orange);
	action.rotation.y = -Math.PI / 2; action.position.set(-W / 2 + 0.2, 4.5, 0);
	const slotMaterial = matte("#1d1d1f", 0.9);
	const slots = [-8.2, -13].map((y) => { const slot = new Mesh(slab(1.4, 6.5, 0.7, 0.6, 0.15), slotMaterial); slot.rotation.y = -Math.PI / 2; slot.position.set(-W / 2 + 0.05, y, 0); return slot; });
	body.add(guard, crown, crownRing, crownCap, sideButton, action, ...slots);

	// Alpine Loop: a ribbed textile strap closed into a loop behind the case, with its titanium G-hook.
	const ribCanvas = document.createElement("canvas");
	ribCanvas.width = 8; ribCanvas.height = 32;
	const ribContext = ribCanvas.getContext("2d");
	if (ribContext) {
		const ribs = ribContext.createLinearGradient(0, 0, 0, 32);
		ribs.addColorStop(0, "#606060"); ribs.addColorStop(0.5, "#ffffff"); ribs.addColorStop(1, "#606060");
		ribContext.fillStyle = ribs; ribContext.fillRect(0, 0, 8, 32);
	}
	const ribTexture = new CanvasTexture(ribCanvas);
	ribTexture.wrapS = ribTexture.wrapT = RepeatWrapping;
	ribTexture.repeat.set(54, 1);
	kit.textures.push(ribTexture);
	const textile = new MeshStandardMaterial({ color: tone("#f0641e"), roughness: 0.92, metalness: 0, bumpMap: ribTexture, bumpScale: 1.1, envMap: kit.envMap, envMapIntensity: 0.12 });
	kit.materials.push(textile);
	const loop = new CatmullRomCurve3([
		new Vector3(0, H / 2 - 1.5, -1), new Vector3(0, H / 2 + 5, -9), new Vector3(0, H / 2 + 3, -24), new Vector3(0, 15, -40), new Vector3(0, 0, -45),
		new Vector3(0, -15, -40), new Vector3(0, -(H / 2 + 3), -24), new Vector3(0, -(H / 2 + 5), -9), new Vector3(0, -(H / 2 - 1.5), -1),
	]);
	const strap = new Mesh(keep(new TubeGeometry(loop, 80, 1.25, 10, false)), textile);
	// The tube lies in the plane of the wrist, so widening it across that plane makes a 25 mm strap.
	strap.scale.x = 25 / 2.5;
	const hook = new Mesh(slab(22, 7, 1.6, 1.6, 0.5), titanium);
	hook.rotation.x = 0.5; hook.position.set(0, -15, -41.4);
	body.add(strap, hook);

	// Stand: a weighted foot, a short arm and the white charging puck the back crystal sits on.
	const stand = new Group();
	const steel = metal("#9fa2a8", 0.52), tilt = 0.42;
	const foot = new Mesh(keep(new CylinderGeometry(27, 29, 4, 48)), steel);
	foot.position.y = 2;
	const arm = new Mesh(slab(11, 52, 4.5, 5, 1), steel);
	arm.position.set(0, 27, -11); arm.rotation.x = -tilt;
	const puck = new Mesh(keep(new CylinderGeometry(14, 14, 5, 40)), matte("#f2f2f0", 0.6));
	puck.rotation.x = Math.PI / 2 - tilt; puck.position.set(0, 55, -21);
	stand.add(foot, arm, puck);
	body.rotation.x = -tilt;
	// The back of the case rests on the puck.
	body.position.set(0, 55 + Math.cos(tilt) * (D / 2 + 3.2), -21 + Math.sin(tilt) * (D / 2 + 3.2) + 6.5);

	const watch = new Group();
	watch.name = "apple_watch_ultra";
	watch.add(stand, body);
	return { group: watch, display, refresh: face.draw };
}

/** A goggle outline: wide, softly squared, with a dip for the nose along the lower edge. */
function visorOutline(angle: number, width: number, height: number) {
	const c = Math.cos(angle), s = Math.sin(angle), power = 2.6;
	const x = Math.sign(c) * Math.abs(c) ** (2 / power) * width / 2;
	let y = Math.sign(s) * Math.abs(s) ** (2 / power) * height / 2;
	if (s < 0) y += Math.exp(-((x / (width * 0.13)) ** 2)) * height * 0.17;
	return [x, y];
}

/** Apple Vision Pro (M5) with the Dual Knit Band and its battery. Origin: on the desk, under the centre of the visor. */
export function createHeadset(kit: Kit) {
	const { keep, metal, glass, matte, slab } = makers(kit);
	const W = 166, H = 84, SEGMENTS = 72, RINGS = 10;
	const headset = new Group();
	// Compound curve of the front glass: tighter side to side than top to bottom.
	const bow = (x: number, y: number) => -(x * x) / 390 - (y * y) / 640;

	// Front glass: rings from the centre out to the goggle outline.
	const positions: number[] = [], indices: number[] = [];
	positions.push(0, 0, bow(0, 0));
	for (let ring = 1; ring <= RINGS; ring++)
		for (let i = 0; i < SEGMENTS; i++) {
			const [x, y] = visorOutline((i / SEGMENTS) * Math.PI * 2, W, H), t = ring / RINGS;
			positions.push(x * t, y * t, bow(x * t, y * t));
		}
	for (let i = 0; i < SEGMENTS; i++) indices.push(0, 1 + i, 1 + ((i + 1) % SEGMENTS));
	for (let ring = 1; ring < RINGS; ring++)
		for (let i = 0; i < SEGMENTS; i++) {
			const a = 1 + (ring - 1) * SEGMENTS + i, b = 1 + (ring - 1) * SEGMENTS + ((i + 1) % SEGMENTS), c = a + SEGMENTS, d = b + SEGMENTS;
			indices.push(a, c, b, b, c, d);
		}
	const visorGeometry = keep(new BufferGeometry());
	visorGeometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	visorGeometry.setIndex(indices);
	visorGeometry.computeVertexNormals();
	const visor = new Mesh(visorGeometry, glass("#0c0d12", 0.05));
	visor.name = "vision_pro_glass";

	// A band between two scaled copies of the outline: used for the frame and the Light Seal.
	const collar = (scaleA: number, zA: (x: number, y: number) => number, scaleB: number, zB: (x: number, y: number) => number) => {
		const points: number[] = [], faces: number[] = [];
		for (let i = 0; i < SEGMENTS; i++) {
			const [x, y] = visorOutline((i / SEGMENTS) * Math.PI * 2, W, H);
			points.push(x * scaleA, y * scaleA, zA(x * scaleA, y * scaleA), x * scaleB, y * scaleB, zB(x * scaleB, y * scaleB));
		}
		for (let i = 0; i < SEGMENTS; i++) {
			const a = i * 2, b = ((i + 1) % SEGMENTS) * 2;
			faces.push(a, a + 1, b, b, a + 1, b + 1);
		}
		const geometry = keep(new BufferGeometry());
		geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
		geometry.setIndex(faces);
		geometry.computeVertexNormals();
		return geometry;
	};
	const aluminium = metal("#c3c6c9", 0.48);
	aluminium.side = DoubleSide;
	// Polished lip around the glass, then the aluminium body sweeping back.
	const lip = new Mesh(collar(1, bow, 1.035, (x, y) => bow(x, y) - 3), aluminium);
	const frame = new Mesh(collar(1.035, (x, y) => bow(x, y) - 3, 1.02, (x, y) => bow(x, y) * 0.75 - 30), aluminium);
	// Light Seal: charcoal textile that widens toward the face and follows its curve.
	const textile = matte("#47474b", 0.95);
	textile.side = DoubleSide;
	const seal = new Mesh(collar(1.0, (x, y) => bow(x, y) * 0.75 - 30, 1.07, (x) => -62 - (x * x) / 210), textile);
	const cushion = new Mesh(collar(1.07, (x) => -62 - (x * x) / 210, 0.9, (x) => -70 - (x * x) / 190), matte("#333336", 1));
	(cushion.material as MeshStandardMaterial).side = DoubleSide;
	// Inside, the optics module closes the cavity: a dark fabric face with the two lenses set into it.
	const face: number[] = [0, 0, -40], faceIndex: number[] = [];
	for (let i = 0; i < SEGMENTS; i++) {
		const [x, y] = visorOutline((i / SEGMENTS) * Math.PI * 2, W, H);
		face.push(x * 1.01, y * 1.01, -40 - (x * x) / 520);
		faceIndex.push(0, 1 + ((i + 1) % SEGMENTS), 1 + i);
	}
	const faceGeometry = keep(new BufferGeometry());
	faceGeometry.setAttribute("position", new Float32BufferAttribute(face, 3));
	faceGeometry.setIndex(faceIndex);
	faceGeometry.computeVertexNormals();
	const lining = matte("#1c1c1f", 0.98);
	lining.side = DoubleSide;
	const optics = new Group();
	optics.add(new Mesh(faceGeometry, lining));
	const lensRing = keep(new CylinderGeometry(21.5, 21.5, 3, 44)), lensGlass = keep(new CylinderGeometry(18.6, 18.6, 3.4, 44));
	const ringMetal = metal("#3a3b40", 0.4), eyeGlass = glass("#10131d", 0.04);
	for (const side of [-1, 1]) {
		const ring = new Mesh(lensRing, ringMetal), lens = new Mesh(lensGlass, eyeGlass);
		for (const part of [ring, lens]) { part.rotation.x = Math.PI / 2; part.position.set(side * 33, 3, -42.5); }
		optics.add(ring, lens);
	}

	// EyeSight: a soft coloured veil glowing behind the front glass.
	const veilCanvas = document.createElement("canvas");
	veilCanvas.width = 256; veilCanvas.height = 128;
	const veilContext = veilCanvas.getContext("2d");
	if (veilContext) {
		for (const [x, colour] of [[78, "rgba(110,150,255,.9)"], [178, "rgba(190,110,255,.9)"]] as const) {
			const glow = veilContext.createRadialGradient(x, 64, 0, x, 64, 78);
			glow.addColorStop(0, colour); glow.addColorStop(1, "rgba(0,0,0,0)");
			veilContext.fillStyle = glow; veilContext.fillRect(0, 0, 256, 128);
		}
	}
	const veilTexture = new CanvasTexture(veilCanvas);
	kit.textures.push(veilTexture);
	const veilMaterial = new MeshBasicMaterial({ map: veilTexture, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false });
	kit.materials.push(veilMaterial);
	const veil = new Mesh(keep(new CircleGeometry(1, 40)), veilMaterial);
	veil.scale.set(W * 0.36, H * 0.3, 1);
	veil.position.z = 1.2;
	veil.name = "vision_pro_eyesight";

	// Digital Crown (wearer's right) and top button (wearer's left), on the upper edge.
	const crown = new Mesh(keep(new CylinderGeometry(5.6, 5.6, 4, 28)), metal("#d5d7da", 0.42));
	crown.position.set(-56, H / 2 - 1, -17);
	const topButton = new Mesh(slab(15, 6, 3, 2.4, 0.6), aluminium);
	topButton.rotation.x = -Math.PI / 2;
	topButton.position.set(56, H / 2 + 1.5, -19);

	// Audio straps run back from each side, with a speaker pod near the ear.
	const strapMaterial = matte("#e3e3e0", 0.6);
	const straps = new Group();
	for (const side of [-1, 1]) {
		const strap = new Mesh(slab(92, 15, 7, 7, 1.5), strapMaterial);
		strap.rotation.y = side * (Math.PI / 2 - 0.2);
		strap.position.set(side * (W / 2 + 12), 4, -72);
		const pod = new Mesh(slab(34, 9, 4.5, 5, 1.2), strapMaterial);
		pod.rotation.copy(strap.rotation);
		pod.position.set(side * (W / 2 + 10), -8, -64);
		straps.add(strap, pod);
	}

	// Dual Knit Band: an upper and a lower ribbed strap around the back of the head.
	const ribCanvas = document.createElement("canvas");
	ribCanvas.width = 64; ribCanvas.height = 8;
	const ribContext = ribCanvas.getContext("2d");
	if (ribContext) {
		const ribs = ribContext.createLinearGradient(0, 0, 64, 0);
		ribs.addColorStop(0, "#5a5a5a"); ribs.addColorStop(0.5, "#ffffff"); ribs.addColorStop(1, "#5a5a5a");
		ribContext.fillStyle = ribs; ribContext.fillRect(0, 0, 64, 8);
	}
	const ribTexture = new CanvasTexture(ribCanvas);
	ribTexture.wrapS = ribTexture.wrapT = RepeatWrapping;
	ribTexture.repeat.set(46, 1);
	kit.textures.push(ribTexture);
	const knit = new MeshStandardMaterial({ color: tone("#cfd0d2"), roughness: 0.95, metalness: 0, bumpMap: ribTexture, bumpScale: 1.4, envMap: kit.envMap, envMapIntensity: 0.15 });
	kit.materials.push(knit);
	const band = new Group();
	for (const [lift, reach, wide] of [[26, 176, 24], [-6, 190, 28]]) {
		const path = new CatmullRomCurve3([
			new Vector3(-(W / 2 + 26), 6, -112), new Vector3(-(W / 2 + 14), 6 + lift * 0.5, -150), new Vector3(-50, 6 + lift, -reach + 10), new Vector3(0, 6 + lift, -reach),
			new Vector3(50, 6 + lift, -reach + 10), new Vector3(W / 2 + 14, 6 + lift * 0.5, -150), new Vector3(W / 2 + 26, 6, -112),
		]);
		const strap = new Mesh(keep(new TubeGeometry(path, 70, 4, 10, false)), knit);
		// A tube flattened vertically reads as a wide knitted strap.
		strap.scale.y = wide / 8;
		strap.position.y = (6 + lift * 0.6) * (1 - wide / 8);
		band.add(strap);
	}
	const dial = new Mesh(keep(new CylinderGeometry(7, 7, 6, 28)), metal("#c9cbce", 0.4));
	dial.rotation.z = Math.PI / 2;
	dial.position.set(W / 2 + 30, 6, -120);

	// Battery: a 143.9 x 68.7 x 19.1 mm aluminium slab, with its braided cable to the left strap.
	const battery = new Mesh(slab(143.86, 68.65, 17, 19.09, 4), metal("#b9bcc0", 0.62));
	// It lies inside the loop of the band, so the whole set fits a small plinth.
	battery.rotation.x = -Math.PI / 2;
	battery.position.set(4, -H / 2 - 2, -128);
	battery.rotation.z = 0.12;
	const cable = new Mesh(keep(new TubeGeometry(new CatmullRomCurve3([
		new Vector3(-(W / 2 + 22), 2, -96), new Vector3(-(W / 2 + 30), -20, -118), new Vector3(-88, -H / 2 + 6, -150), new Vector3(-70, -H / 2 + 8, -136),
	]), 40, 2.1, 8, false)), matte("#d7d6d1", 0.8));

	headset.add(visor, veil, lip, frame, seal, cushion, optics, crown, topButton, straps, band, dial, battery, cable);
	headset.name = "apple_vision_pro";
	// Rest it on the desk: lowest point is the bottom of the Light Seal.
	headset.position.y = H / 2 * 1.07 + 2;
	const group = new Group();
	group.add(headset);
	return { group, visor, veil: veilMaterial };
}
