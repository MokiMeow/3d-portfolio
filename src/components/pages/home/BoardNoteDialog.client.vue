<script setup lang="ts">
import type { BoardNoteDetails } from "~/common/models/board-note.model";

const activeNote = useState<BoardNoteDetails | null>("activeBoardNote", () => null);
const closeButton = ref<HTMLButtonElement>();

const close = () => {
	activeNote.value = null;
};

const onKeyDown = (event: KeyboardEvent) => {
	if (activeNote.value && event.key === "Escape") close();
};

watch(activeNote, async (note) => {
	if (!note) return;
	await nextTick();
	closeButton.value?.focus();
});

onMounted(() => window.addEventListener("keydown", onKeyDown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeyDown));
</script>

<template>
	<Teleport to="body">
		<Transition name="board-note-dialog">
			<div
				v-if="activeNote"
				class="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/55 backdrop-blur-sm"
				@click.self="close"
			>
				<section
					class="relative w-full max-w-md overflow-hidden text-left border shadow-2xl rounded-2xl border-white/15 bg-[#151515] text-light shadow-black/60"
					role="dialog"
					aria-modal="true"
					aria-labelledby="board-note-title"
				>
					<div class="h-1.5" :style="{ backgroundColor: activeNote.accent }" />
					<div class="p-6 sm:p-7">
						<p class="mb-3 text-[10px] font-medium tracking-[0.24em] uppercase text-light/45">
							From the workroom board
						</p>
						<h2 id="board-note-title" class="pr-10 text-2xl font-semibold tracking-tight sm:text-3xl">
							{{ activeNote.title }}
						</h2>
						<p class="mt-4 text-sm leading-7 text-light/70 sm:text-base">
							{{ activeNote.description }}
						</p>
					</div>

					<button
						ref="closeButton"
						type="button"
						class="absolute flex items-center justify-center border rounded-full top-4 right-4 w-9 h-9 border-white/15 text-light/65 transition-colors hover:text-light hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
						aria-label="Close board note"
						@click="close"
					>
						<span aria-hidden="true" class="text-xl leading-none">×</span>
					</button>
				</section>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.board-note-dialog-enter-active,
.board-note-dialog-leave-active {
	transition: opacity 180ms ease;
}

.board-note-dialog-enter-active section,
.board-note-dialog-leave-active section {
	transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.board-note-dialog-enter-from,
.board-note-dialog-leave-to {
	opacity: 0;
}

.board-note-dialog-enter-from section,
.board-note-dialog-leave-to section {
	transform: translate3d(0, 0.75rem, 0) scale(0.98);
}
</style>
