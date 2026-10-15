<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AppIcon from '../music/AppIcon.vue';
import { FILES, HOME, MODEL_FILES, listDirectory, resolvePath } from './model';
import { openVolume, startCarry } from '../../bus';

const path = ref(HOME);
const columnView = ref<HTMLElement>();
const selection = ref<string | null>(null);
const folders = ['Home', 'Desktop', 'Documents', 'Downloads', 'Projects', 'Models'];
function carryOut(path: string, event: PointerEvent): void { const model = MODEL_FILES[path]; if (model && event.button === 0) startCarry(model.id, model.name, event); }
const columns = computed(() => {
  const suffix = path.value.slice(HOME.length).split('/').filter(Boolean);
  const paths = [HOME];
  for (const part of suffix) paths.push((paths.at(-1) ?? HOME) + '/' + part);
  return paths.map(item => ({ path: item, items: listDirectory(item) }));
});
const preview = computed(() => selection.value ? FILES[selection.value] : undefined);
async function choose(item: { path: string; folder: boolean }): Promise<void> {
  if (item.folder) { path.value = item.path; selection.value = null; }
  else selection.value = item.path;
  await nextTick();
  if (columnView.value) columnView.value.scrollLeft = columnView.value.scrollWidth;
}
function keys(event: KeyboardEvent): void {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  const list = event.currentTarget;
  if (!(list instanceof HTMLElement)) return;
  const buttons = [...list.querySelectorAll<HTMLButtonElement>('button')];
  const at = buttons.indexOf(event.target as HTMLButtonElement);
  if (at < 0) return;
  event.preventDefault();
  buttons[(at + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
}
</script>

<template>
  <section class="finder-content">
    <aside class="favorites vk-scroll" aria-label="Finder locations" @keydown="keys">
      <p class="vk-footnote vk-secondary">Favorites</p>
      <button
        v-for="folder in folders" :key="folder" v-hover class="vk-row"
        :aria-pressed="path === (folder === 'Home' ? HOME : HOME + '/' + folder)"
        @click="path = folder === 'Home' ? HOME : HOME + '/' + folder; selection = null"
      >
        <AppIcon :name="folder === 'Home' ? 'finder' : 'folder'" />{{ folder }}
      </button>
    </aside>
    <main class="finder-main">
      <div class="finder-path">
        <button v-hover class="vk-icon" aria-label="Go to parent folder" :disabled="path === HOME" @click="path = resolvePath('..', path); selection = null">
          <AppIcon name="left" />
          </button>
        <span>{{ path.replace(HOME, 'Home') }}</span>
      </div>
      <div ref="columnView" class="columns vk-scroll">
        <section v-for="column in columns" :key="column.path" class="column vk-scroll" :aria-label="column.path" @keydown="keys">
          <button
            v-for="item in column.items" :key="item.path" v-hover class="vk-row"
            :aria-pressed="selection === item.path || (item.folder && path.startsWith(item.path))" :class="{ model: MODEL_FILES[item.path] }"
            :title="MODEL_FILES[item.path] ? 'Drag it out, or double-click, to bring it into your space' : undefined" @click="choose(item)" @dblclick="MODEL_FILES[item.path] && openVolume(MODEL_FILES[item.path]!.id)" @pointerdown="carryOut(item.path, $event)"
          >
            <span class="file-icon"><svg v-if="MODEL_FILES[item.path]" class="cube" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="m4 7.4 8 4.6 8-4.6M12 12v9.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg><AppIcon v-else :name="item.folder ? 'folder' : 'note'" /></span>
            <span>{{ item.name }}</span><span v-if="item.folder" class="chevron"><AppIcon name="right" /></span>
          </button>
        </section>
        <article v-if="preview !== undefined" class="preview vk-scroll">
          <span class="paper"><svg v-if="selection && MODEL_FILES[selection]" class="cube big" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><path d="m4 7.4 8 4.6 8-4.6M12 12v9.2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg><AppIcon v-else name="note" /></span>
          <h3>{{ selection?.split('/').at(-1) }}</h3>
          <pre>{{ preview }}</pre>
          <button v-if="selection && MODEL_FILES[selection]" class="bring" @click="openVolume(MODEL_FILES[selection]!.id)">Bring into your space</button>
        </article>
      </div>
      <footer>{{ listDirectory(path).length }} items · Invented home folder</footer>
    </main>
  </section>
</template>

<style scoped>
.finder-content { width: 100%; height: 100%; display: flex; min-height: 0; font-family: inherit; background: #283142; }
.finder-content :deep(*) { font-family: inherit; box-sizing: border-box; }
.vk-row.model { cursor: grab; touch-action: none; user-select: none; }
.cube { width: 18px; height: 18px; color: #9fd3ff; }
.cube.big { width: 54px; height: 54px; }
.favorites { width: 142px; flex: none; padding: 12px 6px; background: #ffffff0b; }
.favorites p { margin: 0 8px 10px; }
.favorites .vk-row { min-height: 44px; font-size: 14px; padding: 6px 10px; gap: 8px; border-radius: 10px; }
.finder-main { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.finder-path { display: flex; gap: 8px; align-items: center; padding: 6px 10px; font-size: 14px; }
.finder-path > span { overflow-wrap: anywhere; }
.columns { flex: 1; min-height: 0; display: flex; }
.column { width: 220px; flex: none; padding: 6px; border-right: 1px solid #ffffff16; }
.column .vk-row { min-height: 44px; border-radius: 8px; font-size: 14px; gap: 8px; padding: 8px; }
.file-icon { color: #7abffa; font-size: 22px; }
.chevron { margin-left: auto; }
.preview { width: 300px; flex: none; padding: 20px; }
.paper { color: #bfcde1; font-size: 50px; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.6; }
footer { flex: none; padding: 8px 12px; font-size: 13px; color: #ffffffb8; }
button { border: 0; cursor: pointer; }
:focus-visible { outline: 2px solid white; outline-offset: -2px; }
.paper :deep(svg) { width: 48px; height: 48px; }
.chevron :deep(svg) { width: 16px; height: 16px; }
@container (max-width: 480px) {
  .finder-content { flex-direction: column; }
  .favorites { width: 100%; padding: 6px; display: flex; gap: 4px; overflow-x: auto; }
  .favorites p { display: none; }
  .favorites .vk-row { flex: none; width: auto; min-height: 44px; white-space: nowrap; }
  .favorites :deep(svg) { width: 18px; height: 18px; }
  .finder-main { min-height: 0; }
  .column { width: 100%; }
  .column:not(:last-of-type) { display: none; }
  .preview { width: 100%; padding: 16px; }
  .finder-path { padding: 4px 8px; }
}
.bring{margin-top:14px;height:34px;padding:0 16px;border-radius:17px;border:0;font-family:inherit;font-size:13px;font-weight:600;color:#fff;background:#0a84ff;cursor:pointer;box-shadow:0 6px 18px rgb(10 132 255 / .35)}.bring:hover{background:#2a95ff}
</style>
