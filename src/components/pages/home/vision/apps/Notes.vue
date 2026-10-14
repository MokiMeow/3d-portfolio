<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { vHover } from '../kit/hover';
import RichEditor from './notes/RichEditor.vue';
import AppIcon from './music/AppIcon.vue';
import Sketch from './notes/Sketch.vue';
import { FOLDERS, STORAGE_KEY, plainText, readNotes, seedNotes, type Note, type InkStroke } from './notes/model';
defineProps<{ compact?: boolean }>();
const notes = ref<Note[]>([]);
const ready = ref(false);
const selectedId = ref('');
const query = ref('');
const scope = ref('all');
const mobileView = ref<'list' | 'editor'>('list');
const showFolders = ref(false);
const desktopFolders = ref(true);
const wideWindow = ref(false);
const noteWindow = ref<HTMLElement>();
let windowObserver: ResizeObserver | undefined;
const sheet = ref<'format' | 'more' | 'share' | null>(null);
const showSketch = ref(false);
const marks = ref<string[]>([]);
const notice = ref('');
const storageWarning = ref('');
const deleted = ref<{ note: Note; index: number }>();
const unlocked = ref<string[]>([]);
const passcode = ref('');
const lockError = ref('');
const shareText = ref('');
const shareField = ref<HTMLTextAreaElement>();
const editor = ref<InstanceType<typeof RichEditor>>();
const titleField = ref<HTMLTextAreaElement>();
let disposed = false;
const sheetElement = ref<HTMLElement>();
let previousFocus: HTMLElement | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let messageTimer: ReturnType<typeof setTimeout> | undefined;
const current = computed(() => notes.value.find(note => note.id === selectedId.value));
const isLocked = computed(() => !!current.value?.locked && !unlocked.value.includes(selectedId.value));
const allTags = computed(() => [...new Set(notes.value.flatMap(note => note.tags))].sort());
const scopeTitle = computed(() => scope.value === 'all' ? 'All Notes' : scope.value === 'pinned' ? 'Pinned Notes' : scope.value);
const filtered = computed(() => notes.value.filter(note => {
  const matchingScope = scope.value === 'all' || (scope.value === 'pinned' ? note.pinned
    : scope.value.startsWith('#') ? note.tags.includes(scope.value.slice(1)) : note.folder === scope.value);
  const text = note.locked ? note.title : note.title + ' ' + plainText(note.html) + ' ' + note.tags.join(' ');
  return matchingScope && text.toLowerCase().includes(query.value.trim().toLowerCase());
}).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.edited - a.edited));
const pinned = computed(() => filtered.value.filter(note => note.pinned));
const others = computed(() => filtered.value.filter(note => !note.pinned));
const groups = computed(() => [{ title: 'Pinned', notes: pinned.value }, { title: 'Notes', notes: others.value }].filter(group => group.notes.length));
const wordCount = computed(() => {
  const note = current.value;
  return note ? (note.title + ' ' + plainText(note.html)).trim().split(/\s+/).filter(Boolean).length : 0;
});
const folderCounts = computed(() => FOLDERS.map(name => ({ name, count: notes.value.filter(note => note.folder === name).length })));
const formats = [
  { label: 'Title', value: 'h2', glyph: 'T' }, { label: 'Heading', value: 'h3', glyph: 'H' },
  { label: 'Body', value: 'p', glyph: 'Aa' }, { label: 'Bold', value: 'bold', glyph: 'B' },
  { label: 'Italic', value: 'italic', glyph: 'I' }, { label: 'Underline', value: 'underline', glyph: 'U' },
  { label: 'Strikethrough', value: 'strikeThrough', glyph: 'S' },
  { label: 'Bulleted list', value: 'insertUnorderedList', glyph: '• ≡' },
  { label: 'Numbered list', value: 'insertOrderedList', glyph: '1. ≡' },
  { label: 'Monospaced block', value: 'code', glyph: '</>' },
];
function toast(text: string): void {
  if (disposed) return;
  notice.value = text;
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { notice.value = ''; }, 5000);
}
function save(): void {
  if (!ready.value) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value)); storageWarning.value = ''; }
  catch { storageWarning.value = 'Storage unavailable. Keep this window open to keep your notes.'; }
}
function scheduleSave(): void {
  if (!ready.value) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 350);
}
watch(notes, scheduleSave, { deep: true });
function touch(): void { if (current.value) current.value.edited = Date.now(); }
function resizeTitle(): void {
  const field = titleField.value;
  if (!field || disposed) return;
  field.style.height = 'auto';
  field.style.height = field.scrollHeight + 'px';
}
watch([selectedId, mobileView], async () => {
  await nextTick();
  resizeTitle();
});
function editHtml(html: string): void { if (current.value) { current.value.html = html; touch(); } }
function editStrokes(strokes: InkStroke[]): void { if (current.value) { current.value.strokes = strokes; touch(); } }
function date(time: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(time));
}
function fullDate(time: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(time));
}
function preview(note: Note): string { return note.locked ? 'Locked note · a little privacy curtain' : plainText(note.html).trim().slice(0, 85) || 'No additional text'; }
function toggleFolders(): void {
  if (wideWindow.value) desktopFolders.value = !desktopFolders.value;
  else showFolders.value = !showFolders.value;
  sheet.value = null;
}
function setScope(value: string): void {
  scope.value = value;
  mobileView.value = 'list';
  showFolders.value = false;
  sheet.value = null;
  if (!filtered.value.some(note => note.id === selectedId.value)) selectedId.value = filtered.value[0]?.id ?? '';
}
function select(note: Note): void {
  selectedId.value = note.id;
  mobileView.value = 'editor';
  showSketch.value = note.strokes.length > 0;
  showFolders.value = false;
  sheet.value = null;
  passcode.value = '';
  lockError.value = '';
  marks.value = [];
}
async function create(quick = false): Promise<void> {
  if (notes.value.length >= 200) { toast('Two hundred thoughts is plenty. Delete one to make room.'); return; }
  const folder = quick ? 'Quick Notes' : FOLDERS.includes(scope.value) ? scope.value : 'Notes';
  const note: Note = { id: 'note-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    title: '', html: '', folder, tags: quick ? ['quick'] : [], pinned: false, locked: false, edited: Date.now(), strokes: [] };
  notes.value.unshift(note);
  query.value = '';
  scope.value = quick ? 'Quick Notes' : folder;
  select(note);
  await nextTick();
  if (disposed) return;
  resizeTitle();
  titleField.value?.focus();
  if (quick) toast('Quick note ready. Catch that thought.');
}
function remove(): void {
  const note = current.value;
  if (!note) return;
  deleted.value = { note, index: notes.value.findIndex(item => item.id === note.id) };
  notes.value = notes.value.filter(item => item.id !== note.id);
  selectedId.value = filtered.value[0]?.id ?? '';
  sheet.value = null;
  mobileView.value = 'list';
  toast('Note deleted. Undo is right here.');
}
function undoDelete(): void {
  const item = deleted.value;
  if (!item) return;
  notes.value.splice(item.index, 0, item.note);
  scope.value = 'all';
  query.value = '';
  select(item.note);
  deleted.value = undefined;
  toast('Thought restored.');
}
function pin(): void { if (current.value) { current.value.pinned = !current.value.pinned; touch(); } }
function toggleLock(): void {
  const note = current.value;
  if (!note) return;
  note.locked = !note.locked;
  unlocked.value = unlocked.value.filter(id => id !== note.id);
  passcode.value = '';
  lockError.value = '';
  sheet.value = null;
  touch();
  toast(note.locked ? 'Locked. The extremely secret demo passcode is 0000.' : 'Privacy curtain lifted.');
}
function unlock(): void {
  if (passcode.value !== '0000') { lockError.value = 'Try 0000. Our security duck is on a tea break.'; return; }
  unlocked.value.push(selectedId.value);
  passcode.value = '';
  lockError.value = '';
  toast('Unlocked. The duck saw nothing.');
}
function setTags(event: Event): void {
  if (!current.value || !(event.target instanceof HTMLInputElement)) return;
  current.value.tags = [...new Set(event.target.value.split(/[ ,#]+/).map(tag => tag.replace(/[^\w-]/g, '').slice(0, 24)).filter(Boolean))].slice(0, 12);
  touch();
}
async function format(command: string): Promise<void> {
  sheet.value = null;
  await nextTick();
  editor.value?.format(command);
}
async function share(): Promise<void> {
  const note = current.value;
  if (!note || isLocked.value) return;
  shareText.value = (note.title || 'Untitled note') + '\n\n' + plainText(note.html);
  sheet.value = 'share';
  await nextTick();
  shareField.value?.focus();
  shareField.value?.select();
}
async function copyShare(): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(shareText.value);
    toast('Note copied. Share the thought.');
  } catch {
    shareField.value?.focus();
    shareField.value?.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    toast(copied ? 'Note copied.' : 'Text selected. Press Ctrl+C or Command+C to copy.');
  }
}
watch(sheet, async (value, oldValue) => {
  if (value && !oldValue && document.activeElement instanceof HTMLElement) previousFocus = document.activeElement;
  await nextTick();
  if (disposed) return;
  if (value) sheetElement.value?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
  else previousFocus?.focus();
});
function collectionKeys(event: KeyboardEvent): void {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  if (!(event.target instanceof HTMLElement)) return;
  const button = event.target.closest<HTMLButtonElement>('button');
  const collection = button?.closest<HTMLElement>('.note-groups, .folders');
  if (!button || !collection) return;
  const buttons = Array.from(collection.querySelectorAll<HTMLButtonElement>('button.vk-row, button.vk-chip'));
  const index = buttons.indexOf(button);
  if (index < 0) return;
  event.preventDefault();
  event.stopPropagation();
  const direction = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + direction + buttons.length) % buttons.length;
  buttons[next]?.focus();
}
function shortcut(event: KeyboardEvent): void {
  collectionKeys(event);
  if (sheet.value && event.key === 'Tab') {
    const controls = Array.from(sheetElement.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select') ?? []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); void create(event.shiftKey); }
  if (event.key === 'Escape' && (sheet.value || showFolders.value)) { event.stopPropagation(); sheet.value = null; showFolders.value = false; }
}
onMounted(() => {
  windowObserver = new ResizeObserver(entries => {
    wideWindow.value = (entries[0]?.contentRect.width ?? 0) > 880;
    void nextTick(resizeTitle);
  });
  if (noteWindow.value) windowObserver.observe(noteWindow.value);
  let restored: Note[] | null = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) { restored = readNotes(stored); if (!restored) storageWarning.value = 'Saved notes could not be read. A fresh notebook is ready.'; }
  } catch { storageWarning.value = 'Storage unavailable. Notes stay here while this window is open.'; }
  notes.value = restored ?? seedNotes();
  selectedId.value = notes.value[0]?.id ?? '';
  ready.value = true;
});
onBeforeUnmount(() => {
  disposed = true;
  windowObserver?.disconnect();
  previousFocus = undefined;
  if (saveTimer) clearTimeout(saveTimer);
  if (messageTimer) clearTimeout(messageTimer);
  save();
});
</script>

<template>
  <div ref="noteWindow" class="notes-app" :class="['view-' + mobileView, { compact, 'folders-collapsed': !desktopFolders }]" @keydown="shortcut">
    <div class="notes-layout">
    <nav class="app-tabs vk-tabbar" aria-label="Notes navigation">
      <button v-hover class="vk-icon" :aria-pressed="wideWindow ? desktopFolders : showFolders" aria-label="Toggle folders and tags" title="Folders and tags"
        @click="toggleFolders">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3V7Zm0 0V5h7l2 2h8" /></svg><span class="hover-label">Folders</span>
      </button>
      <button v-hover class="vk-icon" :aria-pressed="scope === 'all' && !showFolders" aria-label="All notes" title="All notes" @click="setScope('all')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8m-8 4h8m-8 4h5" /></svg>
        <span class="hover-label">All Notes</span>
      </button>
      <button v-hover class="vk-icon" :aria-pressed="scope === 'pinned'" aria-label="Pinned notes" title="Pinned notes" @click="setScope('pinned')">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 3 8 0-1 7 3 3v2H6v-2l3-3-1-7Zm4 12v6" /></svg><span class="hover-label">Pinned</span>
      </button>
      <button v-hover class="vk-icon" aria-label="Create quick note" title="Quick note" @click="create(true)">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m13 3-8 11h6l-1 7 9-12h-7l1-6Z" /></svg><span class="hover-label">Quick Note</span>
      </button>
    </nav>
    <div class="notes-workspace">
      <aside class="folders vk-platter vk-scroll" :class="{ revealed: showFolders }" aria-label="Folders and tags">
        <header>
          <h2 class="vk-title">Folders</h2>
          <button v-hover class="vk-icon folder-close" aria-label="Close folders" @click="showFolders = false">
          <AppIcon name="close" />
          </button>
          </header>
        <p class="section-label">On this headset</p>
        <button v-hover class="vk-row" :aria-pressed="scope === 'all'" @click="setScope('all')"><AppIcon name="notes" />All Notes<b>{{ notes.length }}</b></button>
        <button v-for="folder in folderCounts" :key="folder.name" v-hover class="vk-row" :aria-pressed="scope === folder.name" @click="setScope(folder.name)">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h7l2 2h9v10H3V7Zm0 0V5h7l2 2h8" /></svg>{{ folder.name }}<b>{{ folder.count }}</b>
        </button>
        <p class="section-label tags-heading">Tags</p>
        <div class="tags">
          <button v-for="tag in allTags" :key="tag" v-hover class="vk-chip" :aria-pressed="scope === '#' + tag" @click="setScope('#' + tag)">#{{ tag }}</button>
        </div>
        <p class="folder-footer"><span class="local-saved-dot" />Stored on this browser<br><small>Your own little corner.</small></p>
      </aside>
      <section class="notes-list vk-platter" aria-label="Note list">
        <header class="list-heading"><div><p class="eyebrow">Notes</p><h1>{{ scopeTitle }}</h1></div>
          <button v-hover class="vk-icon large compose" aria-label="New note" title="New note (Ctrl or Command N)" @click="create()">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M13 5H4v15h15v-9M9 15l1-5L19 1l4 4-9 9-5 1Zm8-12 4 4" /></svg>
          </button>
        </header>
        <div class="search-wrap"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg>
          <input v-model="query" v-hover class="vk-field search" type="search" aria-label="Search notes" placeholder="Search notes" />
        </div>
        <div class="note-groups vk-scroll">
          <section v-for="group in groups" :key="group.title">
            <h2 class="section-label">{{ group.title }}</h2>
            <button v-for="note in group.notes" :key="note.id" v-hover class="vk-row note-row" :aria-pressed="selectedId === note.id" @click="select(note)">
              <span class="note-summary"><strong>{{ note.title || 'Untitled note' }}</strong>
                <span class="note-preview"><time>{{ date(note.edited) }}</time> {{ preview(note) }}</span>
                <span class="note-folder">
                  <AppIcon v-if="note.locked" name="lock" />
                  {{ note.locked ? 'Locked · ' : '' }}{{ note.folder }}<span v-for="tag in note.tags.slice(0, 2)" :key="tag"> · #{{ tag }}</span>
                  </span>
              <span v-if="note.strokes.length" class="sketch-preview" aria-label="Contains a sketch"><svg viewBox="0 0 160 70" fill="none" aria-hidden="true"><polyline v-for="(stroke,i) in note.strokes" :key="i" :points="stroke.points.map(point => (point.x * 160) + ',' + (point.y * 70)).join(' ')" :stroke="stroke.color" stroke-width="1.8" /></svg></span>
                <span v-else-if="note.html.includes('data-list=') || note.html.includes('<table>')" class="note-attachment"><AppIcon :name="note.html.includes('<table>') ? 'browse' : 'check'" />{{ note.html.includes('<table>') ? 'Table' : 'Checklist' }}</span>
              </span><span v-if="note.pinned" class="pin-indicator" aria-label="Pinned"><AppIcon name="pin" /></span>
            </button>
          </section>
          <div v-if="!filtered.length" class="list-empty"><h2>{{ query ? 'No thoughts found.' : 'A little room to think.' }}</h2>
            <p>{{ query ? 'Try a different word or folder.' : 'Your next brilliant 3am idea can start here.' }}</p>
            <button v-hover class="vk-button primary" @click="query ? query = '' : create()">{{ query ? 'Clear search' : 'New note' }}</button>
          </div>
        </div>
        <footer class="list-footer">{{ filtered.length }} {{ filtered.length === 1 ? 'note' : 'notes' }} · Saved here</footer>
      </section>
      <main class="editor-panel" :class="{ 'paper-panel': current && !isLocked }" aria-label="Note editor">
        <header class="editor-top">
          <button v-hover class="vk-icon back-notes" aria-label="Back to note list" @click="mobileView = 'list'"><AppIcon name="left" /></button>
          <span class="editor-date">{{ current ? fullDate(current.edited) : 'A space for your thoughts' }}</span>
          <div class="top-actions">
            <button v-hover class="vk-icon" :disabled="!current || isLocked" aria-label="Share note" title="Share note" @click="share">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 15V2m-4 4 4-4 4 4M6 10H4v11h16V10h-2" /></svg>
            </button>
            <button v-hover class="vk-icon" :disabled="!current || isLocked" aria-label="Note options" title="Note options"
              :aria-expanded="sheet === 'more'" @click="sheet = sheet === 'more' ? null : 'more'"><AppIcon name="more" /></button>
          </div>
        </header>
        <div v-if="current && !isLocked" class="writing-scroll vk-scroll">
          <textarea ref="titleField" v-model="current.title" v-hover class="note-title" rows="1" maxlength="200"
            aria-label="Note title" placeholder="Untitled note" @input="touch(); resizeTitle()" />
          <div class="writing-tags"><span v-if="current.pinned"><AppIcon name="pin" /> Pinned</span><span v-for="tag in current.tags" :key="tag">#{{ tag }}</span></div>
          <RichEditor :key="current.id" ref="editor" :html="current.html" :note-id="current.id" @change="editHtml" @selection="marks = $event" />
          <Sketch v-if="showSketch" :key="'sketch-' + current.id" :strokes="current.strokes" @change="editStrokes" />
        </div>
        <div v-else-if="current && isLocked" class="locked-state vk-scroll">
          <span class="lock-emblem"><AppIcon name="lock" /></span><h2>This thought is locked.</h2>
          <p>A privacy curtain for the demo.<br>The very secret passcode is <strong>0000</strong>.</p>
          <form @submit.prevent="unlock"><input v-model="passcode" v-hover class="vk-field" inputmode="numeric" type="password" maxlength="4"
            aria-label="Demo passcode" autocomplete="off" placeholder="Four secret digits" />
            <button v-hover class="vk-button primary" type="submit">Unlock Note</button></form>
          <p v-if="lockError" role="alert">{{ lockError }}</p><p class="lock-disclaimer">The duck provides comedy, not encryption.</p>
        </div>
        <div v-else class="editor-empty vk-scroll"><span class="empty-emblem"><AppIcon name="notes" /></span><h2>A little room to think.</h2>
          <p>Select a note or start something new.</p><button v-hover class="vk-button primary" @click="create()">New Note</button>
        </div>
        <footer v-if="current && !isLocked" class="editor-footer">
          <span class="word-count"><span class="saved-check"><AppIcon name="check" /></span> {{ wordCount }} words · Saved on this browser</span>
          <div class="format-ornament vk-ornament vk-scroll" aria-label="Note tools">
            <button v-hover class="vk-icon large" aria-label="Text formatting" title="Text formatting" :aria-pressed="sheet === 'format'"
              @click="sheet = sheet === 'format' ? null : 'format'">Aa</button>
            <button v-hover class="vk-icon large" aria-label="Insert checklist" title="Checklist" @mousedown.prevent @click="format('checklist')">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="7" r="3" /><path d="m4 7 2 2 3-4m3 2h9M3 17h6m3 0h9" /></svg>
            </button>
            <button v-hover class="vk-icon large" aria-label="Insert table" title="Table" @mousedown.prevent @click="format('table')">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M11 4v16" /></svg>
            </button>
            <button v-hover class="vk-icon large" aria-label="Show sketch tools" title="Sketch" :aria-pressed="showSketch" @click="showSketch = !showSketch">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 20 1-6L17 2l5 5-12 12-6 1Zm11-16 5 5M5 14l5 5" /></svg>
            </button>
          </div>
        </footer>
      </main>
    </div>
    </div>
    <div v-if="showFolders" class="folder-dismiss" @click="showFolders = false" />
    <div v-if="sheet" class="sheet-shade" @click.self="sheet = null">
      <section ref="sheetElement" class="notes-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true"
        :aria-label="sheet === 'format' ? 'Text formatting' : sheet === 'more' ? 'Note options' : 'Share note'">
        <header><h2 class="vk-title">{{ sheet === 'format' ? 'Text Style' : sheet === 'more' ? 'Note Options' : 'Share a thought' }}</h2>
          <button v-hover class="vk-icon" aria-label="Close panel" @click="sheet = null"><AppIcon name="close" /></button></header>
        <div v-if="sheet === 'format'" class="format-grid">
          <button v-for="item in formats" :key="item.value" v-hover class="vk-button format-choice" :aria-pressed="marks.includes(item.value)"
            @mousedown.prevent @click="format(item.value)"><span :class="item.value">{{ item.glyph }}</span>{{ item.label }}</button>
          <button v-hover class="vk-button" @mousedown.prevent @click="format('removeFormat')">Clear formatting</button>
        </div>
        <div v-else-if="sheet === 'more' && current" class="note-options">
          <button v-hover class="vk-button" :aria-pressed="current.pinned" @click="pin">{{ current.pinned ? 'Unpin Note' : 'Pin Note' }}</button>
          <label>Folder
            <select v-model="current.folder" v-hover class="vk-field" aria-label="Move note to folder" @change="touch">
              <option v-for="folder in FOLDERS" :key="folder">{{ folder }}</option>
            </select>
          </label>
          <label>Tags
            <input v-hover class="vk-field" :value="current.tags.join(' ')" aria-label="Note tags, separated by spaces" placeholder="ideas todo" @change="setTags" />
          </label>
          <button v-hover class="vk-button" @click="toggleLock">{{ current.locked ? 'Remove Lock' : 'Lock Note' }}</button>
          <button v-hover class="vk-button destructive" @click="remove">Delete Note</button>
        </div>
        <div v-else-if="sheet === 'share'" class="share-panel"><p>Copy this note as text, then share it wherever the thought belongs.</p>
          <textarea ref="shareField" v-model="shareText" v-hover class="vk-field share-text" readonly aria-label="Note text to copy" />
          <button v-hover class="vk-button primary" @click="copyShare">Copy Note</button><p class="vk-footnote">Sketches stay in this notebook.</p>
        </div>
      </section>
    </div>
    <div v-if="notice || deleted || storageWarning" class="local-status vk-sheet" role="status" aria-live="polite">
      <span>{{ storageWarning || notice || 'Deleted note can still be restored.' }}</span>
      <button v-if="deleted" v-hover class="vk-button" @click="undoDelete">Undo Delete</button>
      <button v-if="notice" v-hover class="vk-icon" aria-label="Dismiss message" @click="notice = ''"><AppIcon name="close" /></button>
    </div>
  </div>
</template>

<style scoped>
.notes-app {
  box-sizing: border-box;
  width: 100%; height: 100%; position: relative; display: flex; flex-direction: column; gap: 12px; padding: 18px 18px 18px 12px; overflow: hidden;
  container-type: size; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
  font-size: 17px; line-height: 1.4; border-radius: inherit; --vk-accent: #ffd60a;
}
.notes-app :deep(*) { font-family: inherit; box-sizing: border-box; }
.notes-app :deep(button), .notes-app :deep(input), .notes-app :deep(select), .notes-app :deep(textarea) { font: inherit; }
.notes-app :deep(button) { cursor: pointer; border: 0; }
.notes-app :deep(button:disabled) { cursor: default; }
.notes-app :deep(:focus-visible) { outline: 2px solid #ffd60a; outline-offset: 3px; }
.notes-app svg { width: 22px; height: 22px; flex: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
h1, h2, p { margin: 0; }
h1 { font-size: 32px; font-weight: 700; line-height: 1.1; letter-spacing: -.8px; }
h2 { font-size: 23px; font-weight: 700; }
.app-tabs { align-self: center; flex: 0 0 60px; z-index: 4; }
.app-tabs button { position: relative; }
.hover-label {
  position: absolute; left: 54px; z-index: 20; padding: 8px 14px; border-radius: 12px; background: #383a3fed; color: white;
  font-size: 14px; white-space: nowrap; opacity: 0; pointer-events: none; transform: translateX(-5px); transition: opacity 220ms, transform 220ms;
}
.app-tabs button:hover .hover-label, .app-tabs button:focus-visible .hover-label { opacity: 1; transform: translateX(0); }
.notes-layout { display: flex; gap: 12px; min-height: 0; flex: 1; }
.notes-workspace { min-width: 0; min-height: 0; flex: 1; display: flex; gap: 14px; }
.folders { flex: 0 0 228px; padding: 16px 12px; display: flex; flex-direction: column; z-index: 6; }
.folders header, .notes-sheet header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.folder-close { display: none; }
.folders .vk-row { padding: 10px 12px; gap: 10px; font-size: 17px; }
.folders .vk-row b { margin-left: auto; font-size: 14px; font-weight: 500; color: #ffffffe0; }
.folder-symbol { color: #ffd60a; font-size: 23px; }
.folders svg { color: #ffd60a; }
.section-label { padding: 12px 12px 6px; color: #ffffffe0; font-size: 14px; font-weight: 600; }
.tags-heading { margin-top: 22px; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 8px; }
.tags button { min-height: 44px; }
.folder-footer { margin-top: auto; padding: 28px 12px 4px; font-size: 14px; color: #ffffffc7; }
.notes-list { flex: 0 0 285px; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.list-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 20px 16px 14px; }
.list-heading h1 { font-size: 23px; letter-spacing: -.4px; }
.eyebrow { font-size: 14px; color: #ffffffc7; margin-bottom: 4px; }
.compose { color: #ffd60a; }
.search-wrap { position: relative; margin: 0 14px 10px; }
.search-wrap svg { position: absolute; z-index: 2; left: 14px; top: 11px; color: #ffffffe0; pointer-events: none; }
.search-wrap .search { padding-left: 43px; font-size: 17px; }
.note-groups { flex: 1; min-height: 0; padding: 0 8px 12px; }
.note-row { position: relative; margin: 3px 0; align-items: flex-start; min-height: 102px; padding: 14px; }
.note-summary { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.note-summary strong { font-size: 17px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
.note-preview { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: #ffffffdb; font-size: 14px; }
.note-preview time { font-weight: 600; margin-right: 5px; }
.note-folder { font-size: 13px; color: #ffffffd0; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.note-folder :deep(svg) { width: 14px; height: 14px; }
.pin-indicator { color: #ffd60a; margin-left: auto; font-size: 18px; }
.list-footer { font-size: 14px; padding: 12px 18px; text-align: center; color: #ffffffd9; }
.list-empty { padding: 30px 14px; display: grid; gap: 16px; }
.list-empty h2 { font-size: 23px; }
.list-empty p { font-size: 17px; color: #ffffffe0; }
.editor-panel { min-width: 0; min-height: 0; flex: 1; display: flex; flex-direction: column; border-radius: 26px; overflow: hidden; }
.paper-panel { color: #292720; background: #fffdf2ed; box-shadow: inset 0 0 0 1px #ffffffa0; }
.editor-top { display: flex; align-items: center; gap: 10px; padding: 14px 18px 8px; min-height: 66px; flex: none; }
.editor-date { font-size: 14px; color: currentColor; opacity: .72; flex: 1; }
.top-actions { display: flex; gap: 6px; }
.paper-panel .editor-top .vk-icon { color: #8a6a0b; background: #9b873c14; }
.back-notes { display: none; font-size: 28px !important; }
.writing-scroll { flex: 1; min-height: 0; padding: 10px 32px 24px; }
.note-title { display: block; width: 100%; border: 0; background: transparent; color: #25231c; font-size: 32px !important;
  font-weight: 700 !important; outline: none; padding: 4px 0 10px; resize: none; overflow: hidden; min-height: 48px; line-height: 1.2;
}
.note-title::placeholder { color: #8f8978; }
.writing-tags { display: flex; flex-wrap: wrap; gap: 8px; color: #957008; font-size: 14px; }
.editor-footer { flex: none; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0 12px 12px; }
.word-count { color: #807868; font-size: 14px; }
.format-ornament { max-width: 100%; color: white; overflow-x: auto; flex-shrink: 0; }
.format-ornament button { flex: 0 0 60px; }
.format-ornament button:first-child { font-size: 23px; }
.locked-state, .editor-empty { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 16px; padding: 26px; }
.lock-emblem, .empty-emblem { font-size: 60px; color: #ffd60a; }
.locked-state form { width: min(100%, 280px); display: grid; gap: 12px; }
.locked-state p, .editor-empty p { color: #ffffffde; }
.lock-disclaimer { font-size: 14px; }
.sheet-shade { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 14px; background: #00000035; }
.notes-sheet { width: min(440px, 100%); max-height: 100%; padding: 20px; color: #fff; }
.notes-sheet header { margin-bottom: 16px; }
.format-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.format-choice { display: flex; flex-direction: column; min-height: 68px; gap: 4px; padding: 8px !important; font-size: 14px !important; }
.format-choice span { font-size: 23px; }
.format-choice .bold { font-weight: 800; }.format-choice .italic { font-style: italic; }
.format-choice .underline { text-decoration: underline; }.format-choice .strikeThrough { text-decoration: line-through; }
.note-options, .share-panel { display: flex; flex-direction: column; gap: 14px; }
.note-options label { display: grid; gap: 8px; font-size: 14px; }
.note-options select { color: #fff; border: 0; }
.note-options option { background: #383b42; color: white; }
.share-panel p { color: #ffffffe0; }
.share-text { height: 170px; min-height: 90px; }
.local-status { position: relative; flex: none; z-index: 30; margin-left: 72px; display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 14px; }
.local-status span { flex: 1; }.local-status .vk-button { font-size: 14px; padding: 0 14px; }
.folder-dismiss { display: none; }
@container (min-width: 881px) {
  .folders-collapsed .folders { display: none; }
}
@container (max-width: 880px) {
  .folders { display: none; position: absolute; left: 80px; top: 14px; bottom: 14px; width: 260px; background: #404249ed; }
  .folders.revealed { display: flex; }
  .folder-close { display: inline-grid; }
  .folder-dismiss { display: block; position: absolute; inset: 0; z-index: 5; background: #00000020; }
  .notes-list { flex-basis: 255px; }
  .writing-scroll { padding: 10px 24px 24px; }
}
@container (max-width: 850px) {
  .notes-workspace { gap: 10px; }.notes-list { flex-basis: 235px; }
  .editor-top { padding: 10px 12px 6px; }.editor-date { font-size: 14px; }
  .writing-scroll { padding: 10px 18px 20px; }
}
@container (max-width: 700px) {
  .notes-list { flex: 1; }.editor-panel { display: none; }
  .view-editor .notes-list { display: none; }.view-editor .editor-panel { display: flex; }
  .back-notes { display: inline-grid; }
  .editor-date { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .list-heading h1 { font-size: 32px; }
  .note-row { min-height: 92px; }
  .folders { left: 72px; width: calc(100% - 88px); max-width: 300px; }
  .format-ornament button { width: 52px; height: 52px; flex-basis: 52px; }
  .local-status { margin-left: 0; flex-wrap: wrap; }
  .local-status span { min-width: 100%; }
}
@container (max-width: 420px) {
  .app-tabs { flex-basis: 52px; padding: 4px; }.notes-workspace { gap: 0; }
  .list-heading { padding: 14px 12px 10px; }.list-heading h1 { font-size: 23px; }
  .list-heading .large { width: 60px; height: 60px; }
  .writing-scroll { padding: 8px 16px 18px; }
  .editor-top { gap: 4px; padding: 8px; }.editor-date { display: none; }.top-actions { margin-left: auto; }
  .note-title { font-size: 23px !important; }
  .locked-state, .editor-empty { padding: 16px; }
  .notes-sheet { padding: 14px; }
  .format-choice { font-size: 14px !important; }
}
@container (max-height: 380px) {
  .list-heading { padding-top: 10px; padding-bottom: 6px; }
  .editor-top { min-height: 50px; padding-top: 4px; padding-bottom: 2px; }
  .format-ornament { padding: 4px; }.format-ornament button { width: 44px; height: 44px; flex-basis: 44px; }
  .editor-footer { padding-bottom: 6px; }.word-count { display: none; }
  .locked-state, .editor-empty { gap: 10px; padding-top: 10px; }.lock-emblem, .empty-emblem { font-size: 32px; }
}

.notes-app :deep(.vk-scroll) { scrollbar-width: thin; scrollbar-color: #ffffff38 transparent; }
.notes-app :deep(.vk-scroll::-webkit-scrollbar) { display: block; width: 4px; height: 4px; }
.notes-app :deep(.vk-scroll::-webkit-scrollbar-thumb) { background: #ffffff38; border-radius: 8px; }
.writing-scroll { scrollbar-color: #8e805d66 transparent; }
.note-summary { flex: 1; }
.pin-indicator { flex: none; margin-top: 2px; }
.writing-tags > span { display: inline-flex; align-items: center; gap: 4px; }
.writing-tags :deep(svg) { width: 14px; height: 14px; }
.lock-emblem, .empty-emblem { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 22px; background: #ffd60a12; }
.lock-emblem :deep(svg), .empty-emblem :deep(svg) { width: 36px; height: 36px; }
.locked-state, .editor-empty { justify-content: safe center; }
.notes-app .locked-state .vk-field::placeholder { color: #ffffffb8; }
.locked-state > p[role='alert'] { color: #ffe8a3; }
.local-status { border-radius: 20px; animation: notes-notice .24s ease-out; }
.local-status span { overflow-wrap: anywhere; }
.editor-panel { animation: notes-page .24s ease-out; }
@keyframes notes-notice { from { opacity: 0; transform: translateY(6px); } }
@keyframes notes-page { from { opacity: 0; } }
@container (max-width: 700px) {
  .notes-layout { flex-direction: column-reverse; gap: 12px; }
  .notes-app .app-tabs { flex-direction: row; align-self: center; flex-basis: auto; padding: 6px; }
  .hover-label { display: none; }
  .notes-app .folders { left: 12px; right: 12px; top: 12px; bottom: 84px; width: auto; max-width: none; }
  .notes-list, .editor-panel { width: 100%; }
  .local-status span { min-width: 0; flex-basis: 180px; }
  .locked-state h2 { font-size: 24px; }
  .locked-state form { width: min(100%, 320px); }
}
@container (max-width: 420px) {
  .list-heading .compose { width: 48px; height: 48px; }
  .note-title { font-size: 27px !important; }
  .note-row { padding: 14px 12px; }
  .notes-app .format-ornament button { width: 44px; height: 44px; flex-basis: 44px; }
  .locked-state { gap: 16px; }
  .local-status { padding: 8px 10px; gap: 6px; font-size: 13px; }
}
@media (hover: none) { .hover-label { display: none; } }

@media (prefers-reduced-motion: reduce) {
  .notes-app :deep(*), .notes-app :deep(*::before), .notes-app :deep(*::after) {
    animation: none !important; transition: none !important;
  }
}

.notes-app { background:linear-gradient(120deg,#4b403b18,transparent); }
.notes-workspace { gap:12px; }
.folders { flex-basis:174px; padding:18px 10px; background:linear-gradient(155deg,#ffffff13,#ffffff05); border-radius:24px; }
.folders h2 { font-size:22px; }
.folders .vk-row { font-size:14px; gap:8px; padding:10px; min-height:52px; border-radius:16px; }
.folders .vk-row[aria-pressed=true] { background:#dfc17521; }
.folders .section-label { font-size:10px; letter-spacing:.1em; text-transform:uppercase; padding-left:10px; }
.tags-heading { margin-top:14px; }
.tags { gap:5px; padding:4px; }
.tags button { min-height:44px; font-size:11px; padding:0 10px; }
.folder-footer { font-size:11px; line-height:1.8; padding:20px 8px 4px; }
.folder-footer small { color:var(--vk-secondary); }
.local-saved-dot { display:inline-block; width:5px; height:5px; background:#b9d8a4; border-radius:50%; margin-right:5px; }
.notes-list { flex-basis:220px; border-radius:24px; background:#ffffff0a; }
.list-heading { padding:18px 14px 12px; }
.list-heading .compose { width:44px; height:44px; }
.list-heading .eyebrow { font-size:11px; }
.list-heading h1 { font-size:22px; }
.search-wrap { margin:0 12px 6px; }
.search-wrap .search { font-size:14px; }
.note-row { padding:12px; min-height:94px; border-radius:18px; }
.note-summary strong { font-size:14px; line-height:1.35; }
.note-preview { font-size:12px; line-height:1.5; }
.note-folder { font-size:10px; }
.note-groups .section-label { font-size:11px; letter-spacing:.03em; }
.note-attachment { display:flex; align-items:center; gap:5px; font-size:10px; color:#f5d891; margin-top:2px; }
.note-attachment :deep(svg) { width:13px; height:13px; }
.sketch-preview { width:100%; height:54px; border-radius:9px; background:#faf6e8; margin-top:5px; }
.sketch-preview svg { width:100%; height:100%; }
.paper-panel { background:linear-gradient(130deg,#fffdf7,#f4f0e5); box-shadow:inset 0 1px 0 #fff; }
.editor-top { padding:12px 18px 8px; }
.editor-date { font-size:11px; }
.writing-scroll { padding:8px 28px 24px; }
.note-title { font-size:28px !important; letter-spacing:-.035em; }
.writing-tags { font-size:11px; margin-bottom:8px; }
.editor-footer { padding-bottom:14px; gap:8px; }
.word-count { font-size:10px; }
.saved-check { color:#6a864b; }
.format-ornament { padding:6px; }
.format-ornament button { width:44px; height:44px; flex-basis:44px; }
.list-footer { font-size:11px; padding:12px; }
@container(max-width:880px) and (min-width:701px) { .notes-list { flex-basis:240px; } }
@container(max-width:700px) { .notes-workspace { gap:0; } .notes-list { flex:1; } .list-heading { padding:20px 18px 14px; } .list-heading h1 { font-size:28px; } .note-row { min-height:98px; padding:14px; } .note-summary strong { font-size:16px; } .note-preview { font-size:13px; } .note-folder { font-size:11px; } .note-groups { padding:0 10px 12px; } .folders .vk-row { min-height:52px; font-size:16px; } .writing-scroll { padding:10px 20px 24px; } .format-ornament button { width:44px; height:44px; flex-basis:44px; } }

.saved-check { display:inline-flex; vertical-align:middle; margin-right:3px; }.saved-check :deep(svg) { width:11px; height:11px; }
</style>
