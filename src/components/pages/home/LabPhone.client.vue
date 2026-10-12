<script setup lang="ts">
type App = "home" | "camera" | "browser" | "messages";
const app = ref<App>("home");
const clock = ref("");
const today = ref("");
const video = ref<HTMLVideoElement>();
const cameraStatus = ref("Camera stays off until you enable it.");
const cameraActive = ref(false);
const cameraBusy = ref(false);
const photo = ref<string>();
const address = ref("");
const browserError = ref("");
const message = ref("");
const conversation = ref([
	{
		from: "bot",
		text: "Hello. I'm the phone's unpaid intern. Mohith is probably fixing something he called a 'quick change'.",
	},
]);
const chat = ref<HTMLElement>();
let stream: MediaStream | undefined;
let cameraRequest = 0;
let clockTimer: ReturnType<typeof setInterval> | undefined;
const setClock = () => {
	clock.value = new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(new Date());
	today.value = new Intl.DateTimeFormat(undefined, {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
};
const stopCamera = () => {
	cameraRequest++;
	stream?.getTracks().forEach((track) => track.stop());
	stream = undefined;
	if (video.value) video.value.srcObject = null;
	cameraActive.value = false;
	cameraBusy.value = false;
	cameraStatus.value = "Camera is off. Enable it when you’re ready.";
};
const enableCamera = async () => {
	if (cameraBusy.value) return;
	const request = ++cameraRequest;
	cameraBusy.value = true;
	try {
		if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
		const result = await navigator.mediaDevices.getUserMedia({
			video: {
				facingMode: "user",
				width: { ideal: 640 },
				height: { ideal: 800 },
			},
			audio: false,
		});
		if (request !== cameraRequest || app.value !== "camera") {
			result.getTracks().forEach((track) => track.stop());
			return;
		}
		stream = result;
		cameraActive.value = true;
		await nextTick();
		if (request !== cameraRequest || app.value !== "camera" || !video.value) {
			result.getTracks().forEach((track) => track.stop());
			return;
		}
		video.value.srcObject = stream;
		await video.value.play();
		if (request === cameraRequest)
			cameraStatus.value = "Live · nothing is uploaded";
	} catch (error) {
		if (request !== cameraRequest) return;
		stopCamera();
		cameraStatus.value =
			error instanceof DOMException && error.name === "NotAllowedError"
				? "Camera access was declined. You can allow it in your browser's site settings and try again."
				: "No camera is available here. Try a phone or a browser with camera access.";
	} finally {
		if (request === cameraRequest) cameraBusy.value = false;
	}
};
const takePhoto = () => {
	if (!video.value?.videoWidth) return;
	const request = cameraRequest;
	const canvas = document.createElement("canvas");
	canvas.width = video.value.videoWidth;
	canvas.height = video.value.videoHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.translate(canvas.width, 0);
	ctx.scale(-1, 1);
	ctx.drawImage(video.value, 0, 0);
	canvas.toBlob(
		(blob) => {
			if (!blob || app.value !== "camera" || request !== cameraRequest) return;
			if (photo.value) URL.revokeObjectURL(photo.value);
			photo.value = URL.createObjectURL(blob);
		},
		"image/jpeg",
		0.9,
	);
};
const retake = () => {
	if (photo.value) URL.revokeObjectURL(photo.value);
	photo.value = undefined;
};
const openWeb = (value: string) => {
	browserError.value = "";
	const text = value.trim();
	if (!text) return;
	try {
		if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text))
			throw new Error("protocol");
		const url = /^https?:\/\//i.test(text)
			? new URL(text)
			: /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)
				? new URL(`https://${text}`)
				: new URL(
						`https://www.google.com/search?q=${encodeURIComponent(text)}`,
					);
		window.open(url.href, "_blank", "noopener,noreferrer");
	} catch {
		browserError.value = "Use a web address beginning with https://.";
	}
};
const replyFor = (value: string) => {
	if (/machine|works|bug/i.test(value))
		return "It works on your machine? Wonderful. Shall we ship your machine?";
	if (/quick|small|minute/i.test(value))
		return "A quick change. The five most expensive syllables in software.";
	if (/sleep|awake|coffee/i.test(value))
		return "Sleep is currently on the roadmap. No release date has been announced.";
	if (/hire|work|contact|email/i.test(value))
		return "Excellent taste. The actual human is at smohith.sm@gmail.com. I negotiate exclusively in charging cables.";
	if (/hello|hi|hey/i.test(value))
		return "Hello, fellow tab hoarder. You found the only phone here without a subscription plan.";
	return "I've escalated this to the rubber duck. It has been staring at the same line of code for 40 minutes.";
};
const send = async (value = message.value) => {
	const text = value.trim().slice(0, 280);
	if (!text) return;
	conversation.value.push(
		{ from: "you", text },
		{ from: "bot", text: replyFor(text) },
	);
	message.value = "";
	if (conversation.value.length > 31) conversation.value.splice(1, 2);
	await nextTick();
	chat.value?.scrollTo({
		top: chat.value.scrollHeight,
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? "instant"
			: "smooth",
	});
};
watch(app, (next, previous) => {
	if (previous === "camera") {
		stopCamera();
		if (photo.value) URL.revokeObjectURL(photo.value);
		photo.value = undefined;
		cameraStatus.value = "Camera stays off until you enable it.";
	}
});
const onVisibility = () => {
	if (document.hidden) stopCamera();
};
onMounted(() => {
	setClock();
	clockTimer = setInterval(setClock, 30000);
	document.addEventListener("visibilitychange", onVisibility);
});
onBeforeUnmount(() => {
	stopCamera();
	clearInterval(clockTimer);
	if (photo.value) URL.revokeObjectURL(photo.value);
	document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<template>
	<div class="phone-shell">
		<div class="phone-display" :class="`phone-display--${app}`">
			<div class="phone-status">
				<span>{{ clock }}</span
				><span class="phone-island" aria-hidden="true" /><span
					aria-label="Full battery"
					>▂▄▆ ▰</span
				>
			</div>
			<div v-if="app === 'home'" class="phone-home">
				<div class="phone-date">{{ today }}</div>
				<div class="phone-clock">{{ clock }}</div>
				<div class="phone-greeting">
					<span>MOHITH'S POCKET LAB</span>
					<p>A little off-duty.</p>
				</div>
				<div class="phone-apps">
					<button @click="app = 'camera'">
						<span class="app-icon icon-camera"
							><svg viewBox="0 0 32 32" aria-hidden="true">
								<path d="M5 9h5l2-3h8l2 3h5v17H5Z" fill="currentColor" />
								<circle cx="16" cy="17" r="6" fill="#bec5cd" />
								<circle cx="16" cy="17" r="4" fill="#242931" /></svg></span
						>Camera
					</button>
					<button @click="app = 'browser'">
						<span class="app-icon icon-chrome"
							><svg viewBox="0 0 32 32" aria-hidden="true">
								<circle cx="16" cy="16" r="14" fill="#f9ce47" />
								<path d="M3.8 9A14 14 0 0 1 28.2 9H16l-6 10Z" fill="#ec5545" />
								<path d="M3.8 9A14 14 0 0 0 16 30l6-11H10Z" fill="#3aa66a" />
								<circle cx="16" cy="16" r="6.5" fill="#fff" />
								<circle cx="16" cy="16" r="5" fill="#4c8fe7" /></svg></span
						>Chrome
					</button>
					<button @click="app = 'messages'">
						<span class="app-icon icon-messages"
							><svg viewBox="0 0 32 32" aria-hidden="true">
								<path
									d="M27 15c0 7-8 12-17 8l-6 3 2-7C0 7 15 2 23 7c3 2 4 4 4 8Z"
									fill="white"
								/></svg
							><i>1</i></span
						>Messages
					</button>
				</div>
				<p class="phone-owner">No notifications worth stressing about.</p>
			</div>
			<template v-else>
				<header class="phone-app-header">
					<button aria-label="Back to phone home" @click="app = 'home'">
						‹</button
					><strong>{{
						app === "browser"
							? "Chrome"
							: app === "camera"
								? "Camera"
								: "Messages"
					}}</strong
					><span class="app-kicker">{{
						app === "messages" ? "LOCAL CHAT" : "POCKET LAB"
					}}</span>
				</header>
				<div v-if="app === 'camera'" class="camera-app">
					<div class="camera-view">
						<video
							v-show="cameraActive && !photo"
							ref="video"
							autoplay
							muted
							playsinline
						/><img
							v-if="photo"
							:src="photo"
							alt="Your photo, saved only in this browser session"
						/>
						<div v-if="!cameraActive" class="camera-empty">
							<svg viewBox="0 0 32 32" aria-hidden="true">
								<path d="M5 9h5l2-3h8l2 3h5v17H5Z" />
								<circle cx="16" cy="17" r="6" />
							</svg>
							<p>{{ cameraStatus }}</p>
							<button :disabled="cameraBusy" @click="enableCamera">
								{{ cameraBusy ? "Waiting for permission…" : "Enable camera" }}
							</button>
						</div>
						<span v-if="cameraActive && !photo" class="camera-live">● LIVE</span
						><span class="viewfinder-corner" aria-hidden="true" />
					</div>
					<p class="camera-caption">
						{{
							photo
								? "A souvenir from the lab."
								: cameraActive
									? cameraStatus
									: "Your camera. Your device. No upload."
						}}
					</p>
					<div class="camera-actions">
						<button v-if="photo" @click="retake">Retake</button
						><button
							v-else
							class="shutter"
							aria-label="Take photo"
							:disabled="!cameraActive"
							@click="takePhoto"
						/><a v-if="photo" :href="photo" download="pocket-lab.jpg"
							>Save photo ↓</a
						><button
							v-if="cameraActive && !photo"
							class="camera-off"
							@click="stopCamera"
						>
							Turn off
						</button>
					</div>
				</div>
				<div v-else-if="app === 'browser'" class="browser-app">
					<div class="browser-symbol" aria-hidden="true">✳</div>
					<h3>A small window.<br />A very big internet.</h3>
					<form @submit.prevent="openWeb(address)">
						<label class="sr-only" for="pocket-address"
							>Search or enter web address</label
						><input
							id="pocket-address"
							v-model="address"
							placeholder="Search or enter address"
							autocomplete="off"
							maxlength="2048"
						/><button aria-label="Open address">↗</button>
					</form>
					<p v-if="browserError" role="alert">{{ browserError }}</p>
					<p class="browser-note">Links open in your browser, in a new tab.</p>
					<div class="browser-bookmarks">
						<button @click="openWeb('https://github.com/MokiMeow')">
							<span>⌘</span>GitHub</button
						><button @click="openWeb('https://smohith.vercel.app')">
							<span>M</span>Portfolio</button
						><button @click="openWeb('https://zkauth.dev')">
							<span>Z</span>ZKAuth
						</button>
					</div>
				</div>
				<div v-else class="messages-app">
					<div class="chat-person">
						<span>↯</span>
						<div>
							<strong>Build Bot</strong><small>Online · unfortunately</small>
						</div>
					</div>
					<div ref="chat" class="chat-transcript" role="log" aria-live="polite">
						<p class="chat-date">TODAY · ON THIS PHONE ONLY</p>
						<div
							v-for="(entry, index) in conversation"
							:key="index"
							class="chat-bubble"
							:class="entry.from"
						>
							{{ entry.text }}
						</div>
					</div>
					<div class="chat-prompts">
						<button @click="send('It works on my machine')">
							Works on my machine</button
						><button @click="send('Just a quick change')">
							A quick change
						</button>
					</div>
					<form class="chat-compose" @submit.prevent="send()">
						<label class="sr-only" for="pocket-message">Message Build Bot</label
						><input
							id="pocket-message"
							v-model="message"
							maxlength="280"
							placeholder="Say something…"
							autocomplete="off"
						/><button
							aria-label="Send local message"
							:disabled="!message.trim()"
						>
							↑
						</button>
					</form>
				</div>
			</template>
			<button
				class="phone-home-bar"
				aria-label="Phone home"
				@click="app = 'home'"
			>
				<span />
			</button>
		</div>
	</div>
</template>

<style scoped>
.phone-shell {
	width: min(342px, calc(100vw - 34px));
	height: min(682px, calc(100dvh - 100px));
	min-height: 440px;
	border: 2px solid #696c70;
	border-radius: 46px;
	padding: 9px;
	background: linear-gradient(
		130deg,
		#5a5d62,
		#1b1b1d 30%,
		#44474c 70%,
		#101113
	);
	box-shadow:
		0 30px 100px #0009,
		inset 0 0 0 2px #111;
	position: relative;
	color: white;
	font-family: Arial, sans-serif;
}
.phone-shell:before {
	content: "";
	position: absolute;
	left: -5px;
	top: 130px;
	width: 3px;
	height: 52px;
	background: #64676c;
	border-radius: 3px;
}
.phone-display {
	height: 100%;
	border-radius: 35px;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	position: relative;
	background: #f1f3f5;
	color: #151b24;
}
.phone-display--home {
	background:
		radial-gradient(ellipse at 100% 50%, #8bc4cd 0%, transparent 50%),
		radial-gradient(ellipse at 0 100%, #17395c 0%, transparent 65%),
		linear-gradient(150deg, #d1dada, #68a0af 38%, #152a48);
	color: #fff;
}
.phone-status {
	height: 43px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20px;
	flex-shrink: 0;
	font-size: 11px;
	font-weight: 700;
	position: relative;
}
.phone-island {
	position: absolute;
	width: 88px;
	height: 24px;
	background: #080a0c;
	border-radius: 20px;
	left: 50%;
	top: 6px;
	transform: translateX(-50%);
}
.phone-home {
	display: flex;
	flex: 1;
	flex-direction: column;
	align-items: center;
	padding: 28px 20px 0;
}
.phone-date {
	font-size: 13px;
	text-shadow: 0 1px 8px #29455688;
}
.phone-clock {
	font-size: 68px;
	font-weight: 300;
	letter-spacing: -4px;
	line-height: 1.18;
}
.phone-greeting {
	margin-top: auto;
	align-self: flex-start;
	margin-bottom: 30px;
	text-shadow: 0 1px 20px #17395c;
}
.phone-greeting span {
	font-size: 8px;
	letter-spacing: 2px;
}
.phone-greeting p {
	font-size: 27px;
	letter-spacing: -1px;
	margin-top: 8px;
}
.phone-apps {
	display: flex;
	gap: 25px;
}
.phone-apps button {
	display: flex;
	align-items: center;
	flex-direction: column;
	gap: 8px;
	font-size: 10px;
}
.app-icon {
	display: grid;
	place-items: center;
	width: 57px;
	height: 57px;
	border-radius: 16px;
	box-shadow: 0 5px 16px #0003;
	position: relative;
}
.app-icon svg {
	width: 36px;
	height: 36px;
}
.icon-camera {
	background: linear-gradient(#eef0f2, #aeb7bf);
	color: #252a31;
}
.icon-chrome {
	background: #fff;
}
.icon-messages {
	background: linear-gradient(#6eed83, #16aa48);
}
.icon-messages i {
	font-style: normal;
	position: absolute;
	right: -5px;
	top: -6px;
	background: #e85246;
	border-radius: 50%;
	height: 19px;
	min-width: 19px;
	display: grid;
	place-items: center;
	color: white;
	font-size: 10px;
}
.phone-owner {
	margin-top: 24px;
	font-size: 9px;
	opacity: 0.62;
}
.phone-home-bar {
	height: 28px;
	flex-shrink: 0;
	display: grid;
	place-items: center;
	width: 100%;
	margin-top: auto;
}
.phone-home-bar span {
	width: 100px;
	height: 4px;
	background: currentColor;
	border-radius: 4px;
	opacity: 0.7;
}
.phone-app-header {
	display: flex;
	align-items: center;
	height: 42px;
	padding: 0 15px;
	border-bottom: 1px solid #0001;
	gap: 9px;
	flex-shrink: 0;
}
.phone-app-header button {
	font-size: 31px;
	line-height: 1;
	min-width: 25px;
}
.phone-app-header strong {
	font-size: 14px;
}
.app-kicker {
	font-size: 7px;
	letter-spacing: 1.1px;
	opacity: 0.5;
	margin-left: auto;
}
.camera-app {
	background: #15171b;
	color: #fff;
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
}
.camera-view {
	position: relative;
	flex: 1;
	min-height: 160px;
	background: #20242b;
	overflow: hidden;
	margin: 8px;
}
.camera-view video,
.camera-view img {
	width: 100%;
	height: 100%;
	position: absolute;
	object-fit: cover;
}
.camera-view video {
	transform: scaleX(-1);
}
.camera-empty {
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	padding: 22px;
	text-align: center;
	gap: 20px;
	font-size: 12px;
	line-height: 1.6;
}
.camera-empty svg {
	width: 45px;
	height: 45px;
	stroke: #a7b3c6;
	fill: none;
	stroke-width: 1.2;
}
.camera-empty button {
	border: 1px solid #ffffff3d;
	padding: 10px 14px;
	border-radius: 20px;
}
.camera-live {
	position: absolute;
	top: 12px;
	left: 12px;
	letter-spacing: 1.5px;
	font-size: 8px;
	color: #ffb5a0;
}
.camera-caption {
	text-align: center;
	font-size: 9px;
	opacity: 0.55;
	margin: 8px;
}
.camera-actions {
	height: 65px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 25px;
	font-size: 11px;
}
.shutter {
	width: 48px;
	height: 48px;
	border: 3px solid white;
	border-radius: 50%;
	padding: 3px;
	background: white;
	background-clip: content-box;
}
.shutter:disabled {
	opacity: 0.25;
}
.camera-off {
	opacity: 0.7;
}
.browser-app {
	padding: 25px 20px;
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	overscroll-behavior: contain;
}
.browser-symbol {
	font-size: 48px;
	color: #447bb9;
}
.browser-app h3 {
	font-size: 26px;
	line-height: 1.18;
	letter-spacing: -1.2px;
	margin: 15px 0 28px;
}
.browser-app form {
	display: flex;
	background: #fff;
	border: 1px solid #e0e3e8;
	border-radius: 22px;
	padding: 3px 5px 3px 14px;
}
.browser-app input {
	background: transparent;
	width: 100%;
	font-size: 11px;
	padding: 9px 0;
	min-width: 0;
	outline: none;
}
.browser-app form button {
	padding: 0 10px;
}
.browser-note {
	font-size: 9px;
	line-height: 1.5;
	color: #68707d;
	margin-top: 10px;
}
.browser-bookmarks {
	display: flex;
	justify-content: space-between;
	margin-top: 30px;
	gap: 8px;
}
.browser-bookmarks button {
	display: flex;
	flex-direction: column;
	align-items: center;
	font-size: 10px;
	gap: 8px;
}
.browser-bookmarks span {
	width: 46px;
	height: 46px;
	background: #e2e6eb;
	display: grid;
	place-items: center;
	border-radius: 50%;
	font-size: 19px;
}
.messages-app {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	background: #f8f9fb;
}
.chat-person {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 14px 18px;
}
.chat-person > span {
	background: #203c4d;
	color: #a2e2c8;
	width: 34px;
	height: 34px;
	display: grid;
	place-items: center;
	border-radius: 50%;
	font-size: 20px;
}
.chat-person strong {
	font-size: 12px;
	display: block;
}
.chat-person small {
	font-size: 9px;
	color: #708070;
}
.chat-transcript {
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding: 4px 16px 12px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	overscroll-behavior: contain;
}
.chat-date {
	text-align: center;
	font-size: 7px;
	letter-spacing: 0.7px;
	opacity: 0.4;
	margin: 6px 0;
}
.chat-bubble {
	padding: 11px 13px;
	font-size: 12px;
	line-height: 1.55;
	max-width: 91%;
	border-radius: 15px;
	background: #e9ecf0;
	align-self: flex-start;
	border-bottom-left-radius: 4px;
}
.chat-bubble.you {
	align-self: flex-end;
	background: #215f7f;
	color: #fff;
	border-radius: 15px 15px 4px 15px;
}
.chat-prompts {
	display: flex;
	gap: 6px;
	overflow: auto;
	padding: 8px 13px;
	flex-shrink: 0;
}
.chat-prompts button {
	white-space: nowrap;
	border: 1px solid #ccd3da;
	font-size: 8px;
	padding: 7px 9px;
	border-radius: 20px;
}
.chat-compose {
	display: flex;
	gap: 8px;
	padding: 5px 14px 8px;
}
.chat-compose input {
	width: 100%;
	min-width: 0;
	border: 1px solid #d9dee5;
	border-radius: 20px;
	padding: 9px 12px;
	font-size: 11px;
	background: white;
	outline: none;
}
.chat-compose button {
	width: 33px;
	height: 33px;
	flex-shrink: 0;
	border-radius: 50%;
	background: #215f7f;
	color: white;
}
.chat-compose button:disabled {
	opacity: 0.35;
}
button,
a {
	transition: transform 150ms ease;
}
button:active,
a:active {
	transform: scale(0.96);
}
button:focus-visible,
a:focus-visible {
	outline: 2px solid #69abbc;
	outline-offset: 4px;
}
input:focus-visible {
	outline: 2px solid #69abbc;
	outline-offset: 2px;
}
@media (max-height: 600px) {
	.phone-shell {
		height: calc(100dvh - 60px);
		min-height: 340px;
		border-radius: 30px;
	}
	.phone-display {
		border-radius: 22px;
	}
	.phone-home {
		padding-top: 10px;
	}
	.phone-clock {
		font-size: 46px;
	}
	.phone-greeting {
		margin-bottom: 13px;
	}
	.phone-owner {
		margin-top: 12px;
	}
	.phone-greeting p {
		font-size: 22px;
	}
	.app-icon {
		width: 46px;
		height: 46px;
	}
	.camera-actions {
		height: 50px;
	}
	.camera-view {
		min-height: 80px;
	}
}
@media (prefers-reduced-motion: reduce) {
	button,
	a {
		transition: none;
	}
	.chat-transcript {
		scroll-behavior: auto;
	}
}
.chat-bubble {
	overflow-wrap: anywhere;
}
@media (max-width: 600px) {
	.phone-shell input {
		font-size: 16px;
	}
}
</style>
