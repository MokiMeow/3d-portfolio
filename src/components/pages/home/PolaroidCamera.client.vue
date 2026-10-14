<script setup lang="ts">
import { HomeExperience } from "~/experiences/home";

// A little instant camera: snap whatever the room looks like right now and it slides out as a Polaroid.
const CAPTIONS = [
	"Mohith's lab, as found.",
	"Proof I visited.",
	"Wish you were here. (You were.)",
	"The robot insisted on this one.",
	"Room with a view of more room.",
	"Taken on a very real camera.",
	"Note to self: water the plant.",
];
const shot = ref("");
const caption = ref("");
const developing = ref(false);
const flash = ref(false);
let flashTimer = 0, developTimer = 0;

function snap() {
	const xp = new HomeExperience();
	const renderer = xp.app.renderer.instance, camera = xp.app.camera.instance;
	if (!renderer || !camera) return;
	// The canvas is not preserved between frames: draw one now and read it straight back.
	renderer.render(xp.app.scene, camera);
	const source = renderer.domElement;
	const w = source.width, h = source.height, side = Math.min(w, h * 1.05);
	const card = document.createElement("canvas");
	card.width = 900; card.height = 1080;
	const ctx = card.getContext("2d")!;
	ctx.fillStyle = "#f6f3ec"; ctx.fillRect(0, 0, 900, 1080);
	// The photo: a square crop from the middle of the view, warmed and slightly faded like instant film.
	ctx.filter = "sepia(.18) saturate(1.08) contrast(1.04) brightness(1.04)";
	ctx.drawImage(source, (w - side) / 2, (h - side / 1.05) / 2, side, side / 1.05, 60, 60, 780, 743);
	ctx.filter = "none";
	const vignette = ctx.createRadialGradient(450, 430, 200, 450, 430, 560);
	vignette.addColorStop(0, "#0000"); vignette.addColorStop(1, "#0003");
	ctx.fillStyle = vignette; ctx.fillRect(60, 60, 780, 743);
	ctx.strokeStyle = "#00000014"; ctx.lineWidth = 2; ctx.strokeRect(60, 60, 780, 743);
	caption.value = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)]!;
	ctx.fillStyle = "#2b2a28";
	ctx.font = "44px 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive";
	ctx.textAlign = "center";
	ctx.fillText(caption.value, 450, 900);
	ctx.font = "26px 'Segoe Print', 'Bradley Hand', cursive";
	ctx.fillStyle = "#6d6a63";
	ctx.fillText(new Date().toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }), 450, 968);
	shot.value = card.toDataURL("image/jpeg", 0.92);
	flash.value = true;
	developing.value = true;
	clearTimeout(flashTimer); clearTimeout(developTimer);
	flashTimer = window.setTimeout(() => { flash.value = false; }, 380);
	developTimer = window.setTimeout(() => { developing.value = false; }, 2600);
	xp.world?.scene1?.companion?.say("Say cheese! Mine's the robot-shaped smile.");
}
function save() {
	const link = document.createElement("a");
	link.href = shot.value;
	link.download = `mohith-lab-polaroid-${Date.now()}.jpg`;
	link.click();
}
function close() { shot.value = ""; }
onBeforeUnmount(() => { clearTimeout(flashTimer); clearTimeout(developTimer); });
</script>

<template>
	<button class="w-6 h-6 opacity-70 hover:opacity-100" aria-label="Take a Polaroid of the room" title="Instant camera" @click="snap">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">
			<rect x="3" y="5" width="18" height="15" rx="2.5" />
			<circle cx="12" cy="12.5" r="3.6" />
			<path d="M7 5V3.8h4V5M17 8.2h.01M3 16.5h4" stroke-linecap="round" />
		</svg>
	</button>
	<Teleport to="body">
		<div v-if="flash" class="polaroid-flash" aria-hidden="true" />
		<Transition name="polaroid">
			<div v-if="shot" class="polaroid-tray" role="dialog" aria-label="Your Polaroid" @pointerdown.stop @wheel.stop @keydown.esc="close">
				<figure class="polaroid" :class="{ developing }">
					<img :src="shot" :alt="'A Polaroid of the room. ' + caption">
				</figure>
				<div class="polaroid-actions">
					<button @click="save">Keep it</button>
					<button @click="snap">Another</button>
					<button aria-label="Close Polaroid" @click="close">×</button>
				</div>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.polaroid-flash { position: fixed; inset: 0; z-index: 90; background: #fff; pointer-events: none; animation: flash .38s ease-out forwards; }
@keyframes flash { from { opacity: .85; } to { opacity: 0; } }
.polaroid-tray { position: fixed; z-index: 85; right: max(24px, env(safe-area-inset-right)); bottom: 96px; display: grid; justify-items: center; gap: 12px; }
.polaroid { margin: 0; width: min(300px, 70vw); transform: rotate(-4deg); box-shadow: 0 30px 60px #000a, 0 2px 6px #0006; transition: transform .3s ease; }
.polaroid:hover { transform: rotate(-1deg) scale(1.03); }
.polaroid img { display: block; width: 100%; height: auto; }
/* Instant film develops from a milky grey into the picture. */
.polaroid.developing img { animation: develop 2.6s ease-out; }
@keyframes develop { from { filter: brightness(1.7) saturate(0) contrast(.4) blur(1px); } 40% { filter: brightness(1.25) saturate(.4) contrast(.7); } }
.polaroid-actions { display: flex; gap: 8px; }
.polaroid-actions button { min-height: 40px; padding: 0 16px; border-radius: 20px; background: #1d1d1fe6; color: #f2efe6; font-size: 13px; border: 1px solid #ffffff22; backdrop-filter: blur(10px); }
.polaroid-actions button:hover { background: #2c2c2f; }
.polaroid-actions button:last-child { width: 40px; padding: 0; font-size: 20px; }
.polaroid-enter-active { transition: transform .7s cubic-bezier(.2, .9, .3, 1.1), opacity .3s ease; }
.polaroid-leave-active { transition: transform .3s ease, opacity .25s ease; }
.polaroid-enter-from { transform: translateY(80px) rotate(8deg); opacity: 0; }
.polaroid-leave-to { transform: translateY(40px); opacity: 0; }
@media (prefers-reduced-motion: reduce) { .polaroid.developing img, .polaroid-flash { animation: none; } .polaroid-enter-active, .polaroid-leave-active { transition: none; } }
</style>
