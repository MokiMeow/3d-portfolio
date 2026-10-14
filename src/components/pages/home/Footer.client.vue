<script setup lang="ts">
import { initialMusicState, type MusicState } from '~/common/models/music.model';
const music = useState<MusicState>('labMusic', initialMusicState);

const isFreeCamera = useState<boolean>("isFreeCamera");
const isFocusMode = useState<boolean>("isFocusMode");
const closeOtherMenus = (event: MouseEvent) => {
 if ((event.target as HTMLElement)?.closest('details')) return;
 document.querySelectorAll<HTMLDetailsElement>('.lab-footer details[open]').forEach(menu => menu.open = false);
};
const currentYear = new Date().getFullYear();
</script>

<template>
	<footer
		:class="`lab-footer relative z-20 flex flex-row items-center justify-center p-4 text-light bg-opacity-20 sm:backdrop-blur-none sm:bg-transparent sm:p-0 text-[3.5vw] xs:text-[12px] xs:justify-between transition-opacity flex-wrap ${
			isFreeCamera ? '' : 'bg-black'
		}`"
	>
		<span
			:class="`lab-credit order-last w-full mt-3 text-center sm:order-first opacity-70 sm:w-auto sm:mt-0 sm:text-start transition-opacity ${
				isFocusMode ? '!opacity-40' : ''
			}`"
		>
			Sai Mohith S / {{ currentYear }}
		</span>

		<p class="lab-camera-copy hidden sm:block text-[10px] tracking-wide opacity-40">{{isFreeCamera ? 'Drag to explore · Scroll to zoom' : 'Scroll to explore'}}</p>

		<div
			type="button"
			@pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop @touchstart.stop @touchmove.stop @touchend.stop
			@click="closeOtherMenus" class="lab-toolbar z-20 flex flex-row items-center justify-center mt-3 space-x-2 sm:space-x-4 xs:mt-0 !pointer-events-auto"
		>
			<lazy-home-desk-objects />
			<lazy-home-drawing-tools />
			<lazy-home-polaroid-camera />
			<button class="w-6 h-6 opacity-70 hover:opacity-100" :aria-label="music.open ? 'Close record player' : 'Open record player'" :aria-expanded="music.open" title="Record player" @click="music.open = !music.open"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M6 12a6 6 0 0 1 6-6m6 6a6 6 0 0 1-6 6"/></svg></button>
			<lazy-home-sound-toggle-button
				class="transition-opacity w-7 h-7 opacity-70 hover:opacity-100"
			/>

			<lazy-home-markers-toggle-button
				:class="`w-6 h-6 transition-opacity opacity-70 hover:opacity-100 ${
					isFocusMode ? 'pointer-events-none !opacity-40' : ''
				}`"
			/>

			<lazy-home-free-camera-button
				class="w-[22px] transition-opacity h-6 opacity-70 hover:opacity-100"
			/>
			<lazy-home-camera-controls-hint />
		</div>
	</footer>
</template>

<style scoped>.lab-footer:has(details[open]){z-index:40;}</style>
