<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AppIcon from '../music/AppIcon.vue';
import { FILES, HOME } from './model';

const paths = Object.keys(FILES).filter(path => path.startsWith(HOME + '/Projects/'));
const selected = ref(paths[0] ?? '');
const drafts = reactive<Record<string, string>>({ ...FILES });
const edit = ref(false);
const savedDrafts = reactive<Record<string, string>>({ ...FILES });
const saved = computed(() => drafts[selected.value] === savedDrafts[selected.value]);
const content = computed({
  get: () => drafts[selected.value] ?? '',
  set: (value: string) => { drafts[selected.value] = value; },
});
function escaped(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const lines = computed(() => content.value.split('\n').map(line =>
  line.split(/(\/\/.*$|'[^']*'|"[^"]*"|\b(?:const|async|function|await|return|describe|it|expect)\b)/g)
    .map(token => {
      const cls = token.startsWith('//') ? 'comment' : /^['"]/.test(token) ? 'string'
        : /^(const|async|function|await|return|describe|it|expect)$/.test(token) ? 'keyword' : '';
      return cls ? '<span class="' + cls + '">' + escaped(token) + '</span>' : escaped(token);
    }).join(''),
));
function keys(event: KeyboardEvent): void {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  const delta = event.key === 'ArrowUp' ? -1 : 1;
  const index = (paths.indexOf(selected.value) + delta + paths.length) % paths.length;
  selected.value = paths[index] ?? selected.value;
  const parent = event.currentTarget;
  if (parent instanceof HTMLElement) parent.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();
}
</script>

<template>
  <section class="code-content">
    <aside class="tree vk-scroll" aria-label="Code files" @keydown="keys">
      <p>EXPLORER</p><strong><AppIcon name="folder" /> fix-it-later</strong>
      <button v-for="path in paths" :key="path" v-hover class="vk-row" :aria-pressed="selected === path" @click="selected = path">
        <span class="file-type">{{ path.endsWith('.ts') ? 'TS' : '{}' }}</span>{{ path.split('/').at(-1) }}
      </button>
    </aside>
    <main class="editor">
      <header>
        <span>{{ selected.split('/').at(-1) }}{{ saved ? '' : ' ●' }}</span>
        <button v-hover class="vk-button" :aria-pressed="edit" @click="edit = !edit">{{ edit ? 'Preview' : 'Edit' }}</button>
        <button v-hover class="vk-button" :disabled="saved" @click="savedDrafts[selected] = content">Save</button>
      </header>
      <textarea v-if="edit" v-model="content" v-hover class="source vk-scroll" aria-label="Edit sample code" spellcheck="false" />
      <div v-else class="highlight vk-scroll" aria-label="Sample code">
        <div v-for="(line, index) in lines" :key="index" class="code-line">
          <span class="number">{{ String(index + 1).padStart(2, '0') }}</span>
          <code v-html="line || ' '" />
        </div>
      </div>
      <footer>main* <span>{{ saved ? 'Saved in this session' : 'Unsaved changes' }} · TypeScript</span></footer>
    </main>
  </section>
</template>

<style scoped>
.code-content { width: 100%; height: 100%; display: flex; min-height: 0; background: #202630; font-family: inherit; }
.code-content :deep(*) { font-family: inherit; box-sizing: border-box; }
.tree { width: 175px; flex: none; background: #ffffff06; padding: 12px 6px; font-size: 13px; }
.tree p, .tree > strong { display: block; margin: 0 8px 12px; }
.tree .vk-row { min-height: 44px; border-radius: 8px; gap: 6px; padding: 8px; font-size: 13px; overflow-wrap: anywhere; }
.file-type { color: #98cbf7; font-size: 12px; }
.editor { min-width: 0; flex: 1; display: flex; flex-direction: column; }
header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #ffffff08; font-size: 13px; }
header > span { flex: 1; overflow-wrap: anywhere; }
header .vk-button { min-height: 44px; font-size: 13px; padding: 0 12px; }
.highlight, .source { flex: 1; min-height: 0; padding: 16px; }
.source { width: 100%; border: 0; resize: none; background: transparent; color: #e3e8f5; line-height: 1.8; font-size: 14px; }
.code-line { display: flex; gap: 18px; min-height: 25px; font-size: 14px; line-height: 1.8; white-space: pre; }
.code-content .source, .code-content .code-line :deep(*) { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.number { color: #a2acbe; width: 20px; flex: none; user-select: none; }
code { color: #e3e8f5; }
code :deep(.keyword) { color: #d4b2ff; }
code :deep(.string) { color: #c6e5a9; }
code :deep(.comment) { color: #a3b8b0; }
footer { display: flex; justify-content: space-between; gap: 10px; padding: 6px 12px; font-size: 12px; background: #37619380; }
button { border: 0; cursor: pointer; }
:focus-visible { outline: 2px solid white; outline-offset: -2px; }
.tree > strong { display: flex; align-items: center; gap: 6px; }
.tree :deep(svg) { width: 16px; height: 16px; }
@container (max-width: 480px) {
  .code-content { flex-direction: column; }
  .tree { display: flex; gap: 4px; width: 100%; padding: 6px; overflow: auto; }
  .tree p, .tree > strong { display: none; }
  .tree .vk-row { flex: none; width: auto; white-space: nowrap; }
  .editor { min-height: 0; }
  header { flex-wrap: wrap; gap: 6px; padding: 6px 8px; }
  header > span { flex-basis: 100%; }
  .highlight, .source { padding: 12px; }
  footer { font-size: 12px; flex-wrap: wrap; }
}
</style>
