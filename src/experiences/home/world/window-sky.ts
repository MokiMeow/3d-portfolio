import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, RepeatWrapping, SRGBColorSpace, type Object3D } from "three";
import { HOME_WINDOW, clipSceneryToWindow } from "./window-portal";

/**
 * The sky outside the home window, following the visitor's own clock: dawn pinks, a blue day with drifting
 * clouds, golden hour, then a night with stars and a moon. One clipped plane far behind the window; the
 * picture is repainted once a minute and the clouds drift by moving a second texture, so it costs nothing.
 */
export function createWindowSky(parent: Object3D) {
	const sky = document.createElement("canvas");
	sky.width = 512; sky.height = 512;
	const clouds = document.createElement("canvas");
	clouds.width = 1024; clouds.height = 256;
	const skyTexture = new CanvasTexture(sky);
	const cloudTexture = new CanvasTexture(clouds);
	skyTexture.colorSpace = cloudTexture.colorSpace = SRGBColorSpace;
	cloudTexture.wrapS = RepeatWrapping;

	// Deterministic stars, so the night sky does not reshuffle every minute.
	let seed = 7;
	const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
	const stars = Array.from({ length: 160 }, () => [random() * 512, random() * 330, random() * 1.3 + 0.3, random()] as const);

	const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * t));
	const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
	// Top and horizon colours across the day, keyed by hour.
	const KEYS: [number, number[], number[]][] = [
		[0, [6, 10, 28], [22, 30, 62]],
		[5, [14, 20, 48], [70, 56, 92]],
		[6.2, [70, 94, 160], [250, 170, 140]],
		[7.5, [96, 158, 226], [214, 232, 250]],
		[12, [72, 148, 232], [190, 224, 252]],
		[16.5, [88, 150, 220], [222, 232, 240]],
		[18, [70, 92, 170], [255, 170, 102]],
		[19, [32, 38, 92], [190, 104, 112]],
		[20.2, [10, 16, 40], [36, 42, 82]],
		[24, [6, 10, 28], [22, 30, 62]],
	];
	const at = (hour: number) => {
		const i = KEYS.findIndex(k => k[0] > hour);
		const a = KEYS[i - 1]!, b = KEYS[i]!;
		const t = (hour - a[0]) / (b[0] - a[0]);
		return { top: mix(a[1], b[1], t), low: mix(a[2], b[2], t) };
	};
	const paint = () => {
		const now = new Date();
		const hour = now.getHours() + now.getMinutes() / 60;
		const { top, low } = at(hour);
		const ctx = sky.getContext("2d")!;
		const ramp = ctx.createLinearGradient(0, 0, 0, 512);
		ramp.addColorStop(0, rgb(top)); ramp.addColorStop(0.75, rgb(low)); ramp.addColorStop(1, rgb(mix(low, [255, 255, 255], 0.1)));
		ctx.fillStyle = ramp; ctx.fillRect(0, 0, 512, 512);
		const night = hour < 5.5 || hour > 19.6 ? 1 : hour < 6.4 ? (6.4 - hour) / 0.9 : hour > 18.8 ? (hour - 18.8) / 0.8 : 0;
		if (night > 0) {
			for (const [x, y, r, twinkle] of stars) {
				ctx.globalAlpha = night * (0.45 + twinkle * 0.55);
				ctx.fillStyle = "#fff";
				ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
			}
			ctx.globalAlpha = night;
			// A crescent moon.
			const glow = ctx.createRadialGradient(380, 110, 4, 380, 110, 70);
			glow.addColorStop(0, "#fff8e0aa"); glow.addColorStop(1, "#fff8e000");
			ctx.fillStyle = glow; ctx.fillRect(300, 30, 160, 160);
			ctx.fillStyle = "#f6f0dc"; ctx.beginPath(); ctx.arc(380, 110, 18, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = rgb(top); ctx.beginPath(); ctx.arc(388, 104, 16, 0, Math.PI * 2); ctx.fill();
			ctx.globalAlpha = 1;
		} else {
			// The sun, low and big near the edges of the day, small and pale at noon.
			const arc = Math.max(0, Math.min(1, (hour - 6.2) / 12.4));
			const sx = 60 + arc * 390, sy = 380 - Math.sin(arc * Math.PI) * 300;
			const warm = 1 - Math.sin(arc * Math.PI);
			const sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110 + warm * 60);
			sun.addColorStop(0, warm > 0.5 ? "#fff1c8" : "#fffdf4"); sun.addColorStop(0.15, warm > 0.5 ? "#ffd58acc" : "#fffbe8aa"); sun.addColorStop(1, "#fff4d000");
			ctx.fillStyle = sun; ctx.fillRect(0, 0, 512, 512);
		}
		skyTexture.needsUpdate = true;

		// Clouds: soft puffs, white by day, pink at the edges of the day, faint blue-grey at night.
		const c = clouds.getContext("2d")!;
		c.clearRect(0, 0, 1024, 256);
		const tint = night > 0.6 ? [70, 80, 110] : hour < 8 || hour > 17 ? [255, 214, 196] : [255, 255, 255];
		seed = 11;
		for (let i = 0; i < 26; i++) {
			const x = random() * 1024, y = 40 + random() * 150, w = 60 + random() * 140;
			for (let k = 0; k < 6; k++) {
				const px = x + (k - 3) * w * 0.18, py = y + Math.sin(k * 1.7) * 8, r = w * (0.22 + random() * 0.14);
				const puff = c.createRadialGradient(px, py, 0, px, py, r);
				puff.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${night > 0.6 ? 0.18 : 0.55})`);
				puff.addColorStop(1, `rgba(${tint[0]},${tint[1]},${tint[2]},0)`);
				c.fillStyle = puff; c.fillRect(px - r, py - r, r * 2, r * 2);
				// Seamless wrap.
				if (px + r > 1024) { c.save(); c.translate(-1024, 0); c.fillRect(px - r, py - r, r * 2, r * 2); c.restore(); }
			}
		}
		seed = 7;
		cloudTexture.needsUpdate = true;
	};
	paint();

	const w = HOME_WINDOW;
	const centreX = (w.left + w.right) / 2, centreY = (w.top + w.bottom) / 2;
	const geometry = new PlaneGeometry(30, 24);
	const skyMaterial = new MeshBasicMaterial({ map: skyTexture, side: DoubleSide, toneMapped: false });
	const cloudMaterial = new MeshBasicMaterial({ map: cloudTexture, transparent: true, side: DoubleSide, toneMapped: false });
	clipSceneryToWindow(skyMaterial);
	clipSceneryToWindow(cloudMaterial);
	// The clip turns depth writing off; the sky needs it back, or the dark backdrop drawn after it would cover
	// it. With depth, the window bars stay in front, and the sky sits behind the trees.
	skyMaterial.depthWrite = true;
	skyMaterial.customProgramCacheKey = () => "home-window-sky-v1";
	cloudMaterial.customProgramCacheKey = () => "home-window-clouds-v1";
	const skyMesh = new Mesh(geometry, skyMaterial);
	const cloudMesh = new Mesh(geometry, cloudMaterial);
	skyMesh.name = "window_sky";
	skyMesh.position.set(centreX, centreY + 2, w.z - 14);
	cloudMesh.position.set(centreX, centreY + 3.5, w.z - 13.6);
	cloudMesh.scale.set(1, 0.55, 1);
	// Drawn first: the baked trees and the glass go over the sky.
	skyMesh.renderOrder = -3;
	cloudMesh.renderOrder = -2;
	parent.add(skyMesh, cloudMesh);
	// The baked scenery came with a flat night-blue backdrop; the live sky replaces it.
	const backdrop = parent.getObjectByName("tree_cube_back");
	if (backdrop) backdrop.visible = false;

	let since = 0;
	return {
		update(delta: number) {
			cloudTexture.offset.x = (cloudTexture.offset.x + delta * 0.0000045) % 1;
			since += delta;
			if (since > 60000) { since = 0; paint(); }
		},
		dispose() {
			skyMesh.removeFromParent(); cloudMesh.removeFromParent();
			if (backdrop) backdrop.visible = true;
			geometry.dispose(); skyMaterial.dispose(); cloudMaterial.dispose();
			skyTexture.dispose(); cloudTexture.dispose();
		},
	};
}
