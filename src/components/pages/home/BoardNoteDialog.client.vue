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
					class="relative w-full max-w-md text-left note-paper"
					:style="{ '--paper': activeNote.accent }"
					role="dialog"
					aria-modal="true"
					aria-labelledby="board-note-title"
				>
					<span class="note-tape" aria-hidden="true" />
					<div class="px-7 pt-12 pb-9 sm:px-9">
						<p class="mb-3 text-[10px] font-semibold tracking-[0.24em] uppercase text-black/50">
							From the workroom board
						</p>
						<h2 id="board-note-title" class="pr-10 text-3xl leading-tight note-hand sm:text-4xl">
							{{ activeNote.title }}
						</h2>
						<p class="mt-5 text-base leading-7 text-black/75">
							{{ activeNote.description }}
						</p>
					</div>

					<button
						ref="closeButton"
						type="button"
						class="absolute flex items-center justify-center border rounded-full top-4 right-4 w-9 h-9 border-black/25 text-black/60 transition-colors hover:text-black hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
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
.note-paper {
	color: #1c1c1c;
	background:
		linear-gradient(135deg, rgb(255 255 255 / 0.22), transparent 55%, rgb(0 0 0 / 0.12)),
		var(--paper);
	border-radius: 3px 3px 26px 3px;
	box-shadow:
		0 28px 60px rgb(0 0 0 / 0.55),
		0 3px 8px rgb(0 0 0 / 0.3);
	rotate: -1.4deg;
}

.note-tape {
	position: absolute;
	top: -14px;
	left: 50%;
	width: 132px;
	height: 34px;
	background: rgb(255 255 255 / 0.5);
	box-shadow: 0 1px 2px rgb(0 0 0 / 0.15);
	translate: -50% 0;
	rotate: 2.5deg;
}

.note-hand {
	font-family: "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
	font-weight: 700;
}

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
	transform: translate3d(0, 1rem, 0) scale(0.92) rotate(4deg);
}
</style>
