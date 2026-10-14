<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { safeHtml } from './model';
import { vHover } from '../../kit/hover';
const props = defineProps<{ html: string; noteId: string }>();
const emit = defineEmits<{ change: [html: string]; selection: [marks: string[]] }>();
const surface = ref<HTMLDivElement>();
let selection: Range | undefined;
function decorate(): void {
  surface.value?.querySelectorAll<HTMLElement>('li[data-checked]').forEach(item => {
    item.setAttribute('role', 'checkbox');
    item.setAttribute('aria-checked', item.dataset.checked ?? 'false');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', (item.textContent ?? 'Checklist item') + '. Alt Enter to toggle.');
  });
}
function render(): void {
  const element = surface.value;
  if (!element) return;
  element.innerHTML = safeHtml(props.html);
  selection = undefined;
  decorate();
}
function update(): void {
  const element = surface.value;
  if (!element) return;
  emit('change', safeHtml(element.innerHTML));
  decorate();
}
function capture(): void {
  const selected = window.getSelection();
  const element = surface.value;
  if (!selected?.rangeCount || !element || !element.contains(selected.anchorNode)) return;
  selection = selected.getRangeAt(0).cloneRange();
  emit('selection', ['bold', 'italic', 'underline', 'strikeThrough'].filter(mark => document.queryCommandState(mark)));
}
function restore(): HTMLDivElement | undefined {
  const element = surface.value;
  if (!element) return;
  element.focus();
  const selected = window.getSelection();
  if (selection && selected && element.contains(selection.startContainer) && element.contains(selection.endContainer)) {
    selected.removeAllRanges();
    selected.addRange(selection);
  } else if (selected) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selected.removeAllRanges();
    selected.addRange(range);
  }
  return element;
}
function format(command: string): void {
  if (!restore()) return;
  document.execCommand('styleWithCSS', false, 'false');
  const snippets: Record<string, string> = {
    checklist: '<ul data-list="check"><li data-checked="false">New task</li></ul><p><br></p>',
    table: '<table><tbody><tr><th>Topic</th><th>Thought</th></tr><tr><td>Chai</td><td>Still warm?</td></tr>'
      + '<tr><td>Tabs</td><td>Too many</td></tr></tbody></table><p><br></p>',
    code: '<pre><code>// A little room for code</code></pre><p><br></p>',
  };
  if (snippets[command]) document.execCommand('insertHTML', false, snippets[command]);
  else if (['h2', 'h3', 'p'].includes(command)) document.execCommand('formatBlock', false, command);
  else document.execCommand(command, false);
  update();
  capture();
}
function toggle(item: HTMLElement): void {
  item.dataset.checked = item.dataset.checked === 'true' ? 'false' : 'true';
  update();
}
function click(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return;
  const item = event.target.closest<HTMLElement>('li[data-checked]');
  if (!item || !surface.value?.contains(item)) return;
  const rect = item.getBoundingClientRect();
  const scale = rect.width / (item.offsetWidth || 1);
  if (event.clientX - rect.left < 44 * scale) { event.preventDefault(); toggle(item); }
}
function key(event: KeyboardEvent): void {
  if (event.key === 'Enter' && event.altKey && event.target instanceof Element) {
    const item = event.target.closest<HTMLElement>('li[data-checked]');
    if (item) { event.preventDefault(); toggle(item); }
  }
}
function paste(event: ClipboardEvent): void {
  event.preventDefault();
  restore();
  document.execCommand('insertText', false, event.clipboardData?.getData('text/plain').slice(0, 20000) ?? '');
  update();
}
watch(() => props.noteId, render, { flush: 'post' });
onMounted(() => { render(); document.addEventListener('selectionchange', capture); });
onBeforeUnmount(() => { document.removeEventListener('selectionchange', capture); selection = undefined; });
defineExpose({ format, focus: () => surface.value?.focus() });
</script>

<template>
  <div ref="surface" v-hover class="rich-body" contenteditable="true" role="textbox" aria-multiline="true"
    aria-label="Note text. Checklist: click a circle or press Alt Enter on an item."
    spellcheck="true" @input="update" @click="click" @keydown="key" @paste="paste" @mouseup="capture" @keyup="capture" />
</template>

<style scoped>
.rich-body { font-family: inherit; min-height: 170px; outline: none; font-size: 17px; line-height: 1.6; overflow-wrap: anywhere; padding: 8px 0 40px; }
.rich-body :deep(*) { font-family: inherit; }
.rich-body:focus-visible { outline: 2px solid #b99212; outline-offset: 8px; border-radius: 4px; }
.rich-body:empty::before { content: 'A thought worth keeping…'; color: #74716a; pointer-events: none; }
.rich-body :deep(p), .rich-body :deep(div) { margin: 0 0 10px; }
.rich-body :deep(h1), .rich-body :deep(h2) { font-size: 23px; line-height: 1.3; font-weight: 700; margin: 20px 0 12px; }
.rich-body :deep(h3) { font-size: 17px; font-weight: 700; margin: 16px 0 8px; }
.rich-body :deep(ul), .rich-body :deep(ol) { margin: 10px 0; padding-left: 28px; }
.rich-body :deep(ul) { list-style: disc; }
.rich-body :deep(ol) { list-style: decimal; }
.rich-body :deep(li) { padding: 3px 0; }
.rich-body :deep(ul[data-list='check']) { list-style: none; padding-left: 0; }
.rich-body :deep(li[data-checked]) { position: relative; padding-left: 44px; min-height: 44px; }
.rich-body :deep(li[data-checked])::before {
  content: ''; position: absolute; left: 0; top: 10px; width: 24px; height: 24px; border: 2px solid #ad8613; border-radius: 50%; cursor: pointer;
}
.rich-body :deep(li[data-checked='true']) { color: #77746c; text-decoration: line-through; }
.rich-body :deep(li[data-checked='true'])::before { background: #a17b0b; }
.rich-body :deep(li[data-checked='true'])::after {
  content: ''; position: absolute; left: 8px; top: 15px; width: 7px; height: 11px;
  border: solid white; border-width: 0 2px 2px 0; transform: rotate(45deg); pointer-events: none;
}
.rich-body :deep(li[data-checked]:hover)::before { box-shadow: 0 0 0 5px #ffd60a33; }
.rich-body :deep(pre) { white-space: pre-wrap; background: #e8e4d9; padding: 16px; border-radius: 12px; margin: 14px 0; }
.rich-body :deep(pre), .rich-body :deep(code) { font-family: 'SFMono-Regular', Consolas, monospace !important; font-size: 14px; }
.rich-body :deep(table) { border-collapse: collapse; width: 100%; margin: 16px 0; }
.rich-body :deep(td), .rich-body :deep(th) { border: 1px solid #c7bfae; text-align: left; padding: 10px; min-width: 60px; }
.rich-body :deep(th) { background: #ece7db; font-weight: 700; }
.rich-body :deep(blockquote) { border-left: 3px solid #c2a654; padding-left: 16px; margin: 16px 0; }
</style>
