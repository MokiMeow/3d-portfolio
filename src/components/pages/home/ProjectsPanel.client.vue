<script setup lang="ts">
import { useLabDialog } from "~/composables/useLabDialog";
import { PROJECTS } from "~/static/projects.static";

/**
 * The left monitor's projects, opened over the room. Nothing navigates away,
 * so closing it puts the visitor straight back at the desk with no reload.
 */
const isOpen = useState<boolean>("isProjectsOpen", () => false);
const closeButton = ref<HTMLButtonElement>();

const close = () => {
	isOpen.value = false;
};

const dialog = ref<HTMLDialogElement>();
useLabDialog(dialog, isOpen);
const route = useRoute();
watch(() => route.path, close);
</script>

<template>
	<Teleport to="body">
		<Transition name="projects-panel">
			<dialog ref="dialog" v-if="isOpen" class="lab-modal projects-modal" aria-labelledby="projects-panel-title" @click.self="close" @cancel.prevent="close" @close="close">
				<section
					class="relative flex flex-col w-full max-w-2xl max-h-full overflow-hidden text-left border shadow-2xl rounded-2xl border-white/15 bg-[#121315] text-light shadow-black/60"
					aria-labelledby="projects-panel-title"
				>
					<header class="flex items-center justify-between gap-4 px-6 pt-6 sm:px-8 sm:pt-7">
						<div>
							<p class="mb-2 text-[10px] font-medium tracking-[0.24em] uppercase text-light/45">On the left monitor</p>
							<h2 id="projects-panel-title" class="text-2xl font-semibold tracking-tight sm:text-3xl">Projects</h2>
						</div>
						<button
							ref="closeButton"
							type="button"
							class="flex items-center gap-2 px-4 text-xs font-medium tracking-[0.14em] uppercase transition-colors border rounded-full h-10 border-white/20 text-light/80 hover:text-light hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
							@click="close" aria-label="Back to the room"
						>
							<span aria-hidden="true">←</span>
							<span class="project-back-label">Back to the room</span>
						</button>
					</header>

					<p class="px-6 mt-3 text-sm text-light/55 sm:px-8">Selected systems, experiments, and shipped products.</p>

					<ul class="min-h-0 px-6 pb-6 mt-4 overflow-y-auto overscroll-contain sm:px-8 sm:pb-8">
						<li v-for="(project, index) in PROJECTS" :key="project.title" class="projects-panel-row" :style="{ '--i': index }">
							<a
								:href="project.url"
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-start justify-between gap-4 py-4 transition-colors border-t group border-white/10 hover:border-white/40"
							>
								<span>
									<strong class="text-lg font-semibold tracking-tight">{{ project.title }}</strong>
									<span class="block mt-1 text-sm leading-6 text-light/65">{{ project.description }}</span>
								</span>
								<span aria-hidden="true" class="mt-1 transition-transform text-light/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-light">↗</span>
							</a>
						</li>
					</ul>
				</section>
			</dialog>
		</Transition>
	</Teleport>
</template>

<style scoped>
.projects-panel-enter-active,
.projects-panel-leave-active {
	transition: opacity 200ms ease;
}

.projects-panel-enter-active section,
.projects-panel-leave-active section {
	transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.projects-panel-enter-from,
.projects-panel-leave-to {
	opacity: 0;
}

.projects-panel-enter-from section,
.projects-panel-leave-to section {
	transform: translate3d(0, 1rem, 0) scale(0.98);
}

/* Each project arrives a beat after the one above it. */
.projects-panel-row {
	animation: projects-panel-row 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
	animation-delay: calc(var(--i) * 60ms + 120ms);
}

@keyframes projects-panel-row {
	from {
		opacity: 0;
		transform: translate3d(0, 0.6rem, 0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.projects-panel-row {
		animation: none;
	}
}
@media(max-width:480px),(max-height:500px){
 header {padding:16px 18px 0;flex-shrink:0;}
 header button {flex-shrink:0;width:44px;height:44px;padding:0;justify-content:center;}
 header button::after {content:'×';font-size:22px;}
 header button>span {display:none;}
 header button {font-size:0;}
 section>p {padding-inline:18px;font-size:13px;}
 ul {padding-inline:18px;}
}
</style>
