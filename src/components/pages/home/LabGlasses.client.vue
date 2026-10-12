<script setup lang="ts">
const playing = ref(false);
</script>
<template>
	<div class="glasses-player">
		<div class="glasses-topline">
			<span class="glasses-status"><i /> SMART GLASSES</span
			><span>01 / PRIVATE SCREENING</span>
		</div>
		<div class="glasses-view">
			<iframe
				v-if="playing"
				title="Rick Astley — Never Gonna Give You Up"
				src="https://www.youtube-nocookie.com/embed/dQw4w9WgXc?autoplay=1&playsinline=1&rel=0"
				allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
				referrerpolicy="strict-origin-when-cross-origin"
				allowfullscreen
			/>
			<div v-else class="glasses-ready">
				<div class="glasses-crosshair" aria-hidden="true" />
				<span class="glasses-caption">A VISION OF THE FUTURE.</span>
				<h3>You've been<br />looking for this.</h3>
				<button class="glasses-play" @click="playing = true">
					<span aria-hidden="true">▶</span> Play
				</button>
				<p>Sound on. Trust questionable.</p>
			</div>
		</div>
		<div class="glasses-bottom">
			<span>{{
				playing ? "You knew the risks." : "One carefully curated video."
			}}</span
			><a
				v-if="playing"
				href="https://www.youtube.com/watch?v=dQw4w9WgXc"
				target="_blank"
				rel="noopener noreferrer"
				>Open on YouTube ↗</a
			><span v-else>1080p / UNREASONABLE CONFIDENCE</span>
		</div>
	</div>
</template>
<style scoped>
.glasses-player {
	width: min(760px, calc(100vw - 32px), calc((100dvh - 160px) * 1.7778));
	background: #0b1518;
	border: 1px solid #47717b;
	border-radius: 20px;
	box-shadow:
		0 25px 100px #000b,
		inset 0 0 0 5px #122127;
	color: #d9eeed;
	overflow: hidden;
}
.glasses-topline,
.glasses-bottom {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 14px;
	padding: 19px 23px;
	font:
		9px/1.5 "Cascadia Code",
		Consolas,
		monospace;
	letter-spacing: 1px;
	color: #79969e;
}
.glasses-status {
	display: flex;
	align-items: center;
	gap: 8px;
	color: #a0c5ca;
}
.glasses-status i {
	width: 5px;
	height: 5px;
	background: #87c2b6;
	border-radius: 50%;
}
.glasses-view {
	aspect-ratio: 16/9;
	min-height: 230px;
	position: relative;
	margin: 0 9px;
	border: 1px solid #ffffff12;
	background: radial-gradient(ellipse at center, #1b3439, #0a1418 75%);
	border-radius: 11px;
	overflow: hidden;
}
.glasses-view iframe {
	width: 100%;
	height: 100%;
	position: absolute;
	border: 0;
}
.glasses-ready {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-direction: column;
	text-align: center;
}
.glasses-caption {
	font-size: 8px;
	letter-spacing: 2.8px;
	color: #85a6ac;
}
.glasses-ready h3 {
	font-size: clamp(28px, 5vw, 53px);
	font-weight: 400;
	letter-spacing: -2px;
	line-height: 1.05;
	margin: 19px 0 23px;
}
.glasses-play {
	display: flex;
	gap: 12px;
	align-items: center;
	font-size: 12px;
	border: 1px solid #85b6bb;
	border-radius: 30px;
	padding: 11px 25px;
	background: #48788033;
}
.glasses-play:hover {
	background: #48788066;
}
.glasses-play:active {
	transform: scale(0.97);
}
.glasses-play:focus-visible {
	outline: 2px solid #addeda;
	outline-offset: 4px;
}
.glasses-ready p {
	font-size: 9px;
	color: #6e8a92;
	margin-top: 16px;
}
.glasses-crosshair {
	position: absolute;
	inset: 18px;
	border: 1px solid #7fb8b125;
	border-radius: 5px;
	pointer-events: none;
}
.glasses-bottom a {
	color: #b5d5d1;
	letter-spacing: 0;
}
.glasses-bottom > span:last-child {
	font-size: 7px;
}
@media (max-width: 500px) {
	.glasses-topline,
	.glasses-bottom {
		padding: 15px;
		font-size: 7px;
		letter-spacing: 0.5px;
	}
	.glasses-ready h3 {
		margin: 15px 0;
	}
	.glasses-ready p {
		margin-top: 12px;
	}
}
</style>
