<script setup lang="ts">
import { APP_ICONS as icons } from './icons';
type Note = {
    id: number;
    folder: string;
    title: string;
    body: string;
    date: string;
    pinned: boolean;
};
const notes = ref<Note[]>([
    {
        id: 1,
        folder: 'Notes',
        title: 'Passwords (do not look)',
        body: 'Nice try.\n\n# Actual security advice\nUse a password manager.\n\n**No passwords live here.** Just a healthy suspicion of notes titled Passwords.',
        date: '10:42',
        pinned: true
    },
    {
        id: 2,
        folder: 'Ideas',
        title: 'App ideas at 3am',
        body: ("# A very reasonable business plan\n- [ ] An app that closes other apps\n- [ ] A kettle with a loading bar\n- [ ] A calendar " +
            "that declines meetings politely\n\nMarket research: the ceiling, at 3:07am."),
        date: 'Yesterday',
        pinned: false
    },
    {
        id: 3,
        folder: 'Notes',
        title: 'Groceries',
        body: '- [ ] Chai\n- [ ] Milk\n- [x] Biscuits\n- [ ] Vegetables that are not just garnish\n\nThe biscuit budget has its own roadmap.',
        date: 'Yesterday',
        pinned: false
    },
    {
        id: 4,
        folder: 'Work',
        title: 'Things to fix: everything',
        body: ("# Priority list\n- [ ] The bug\n- [ ] The bug introduced while fixing the bug\n- [ ] The estimate\n\n**Do one thing at a " +
            "time.** Preferably the right thing."),
        date: 'Monday',
        pinned: true
    },
    {
        id: 5,
        folder: 'Ideas',
        title: 'A better morning routine',
        body: 'Wake up.\nDo not check the build.\nMake chai.\nCheck the build.\n\nProgress is rarely linear.',
        date: 'Monday',
        pinned: false
    },
    {
        id: 6,
        folder: 'Notes',
        title: 'Flat viewing checklist',
        body: '- [ ] Window that opens\n- [ ] Internet that works\n- [ ] Rent that remains a number\n- [ ] Commute shorter than a feature film',
        date: 'Sunday',
        pinned: false
    }
]);
const folder = ref<string | null>(null);
const selected = ref<number | null>(null);
const query = ref<string>('');
const preview = ref<boolean>(false);
const editor = ref<HTMLTextAreaElement | null>(null);
const current = computed(() => notes.value.find(n => n.id === selected.value));
const filtered = computed(() => notes.value
    .filter(note => (folder.value === 'All Notes' || note.folder === folder.value) &&
        (note.title + ' ' + note.body).toLowerCase().includes(query.value.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned)));
const folders = [
    'All Notes',
    'Notes',
    'Work',
    'Ideas'
];
function count(name: string) {
    return notes.value.filter(n => name === 'All Notes' || n.folder === name).length;
}
let nextNoteId = 7;
function newNote() {
    const note: Note = {
        id: nextNoteId++,
        folder: folder.value && folder.value !== 'All Notes' ? folder.value : 'Notes',
        title: '',
        body: '',
        date: 'Now',
        pinned: false
    };
    notes.value.unshift(note);
    selected.value = note.id;
    preview.value = false;
    void nextTick(() => editor.value?.focus());
}
function open(note: Note) {
    selected.value = note.id;
    preview.value = false;
}
function format(kind: 'bold' | 'check' | 'title') {
    const note = current.value;
    const input = editor.value;
    if (!note || !input)
        return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (kind === 'bold') {
        const selection = note.body.slice(start, end) || 'bold text';
        note.body = note.body.slice(0, start) + '**' + selection + '**' + note.body.slice(end);
        void nextTick(() => {
            input.focus();
            input.setSelectionRange(start + 2, start + 2 + selection.length);
        });
    }
    else {
        const from = note.body.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        let to = note.body.indexOf('\n', end);
        if (to < 0)
            to = note.body.length;
        const prefix = kind === 'title' ? '# ' : '- [ ] ';
        const block = note.body.slice(from, to).split('\n').map(line => line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line).join('\n');
        note.body = note.body.slice(0, from) + block + note.body.slice(to);
        void nextTick(() => {
            input.focus();
            input.setSelectionRange(from, from + block.length);
        });
    }
}
const lines = computed(() => current.value?.body.split('\n').map((line, index) => ({
    index,
    checked: line.startsWith('- [x] '),
    kind: line.startsWith('# ') ? 'title' : line.startsWith('- [ ] ') || line.startsWith('- [x] ') ? 'check' : 'body',
    parts: (line.startsWith('# ') ? line.slice(2) : line.startsWith('- [ ] ') || line.startsWith('- [x] ') ? line.slice(6) : line).split('**').map((text, i) => ({
        text,
        bold: i % 2 === 1
    }))
})) ?? []);
function checkLine(index: number) {
    const note = current.value;
    if (!note)
        return;
    const rows = note.body.split('\n');
    const line = rows[index];
    if (!line)
        return;
    rows[index] = line.startsWith('- [x] ') ? line.replace('- [x] ', '- [ ] ') : line.replace('- [ ] ', '- [x] ');
    note.body = rows.join('\n');
}
function remove() {
    const id = selected.value;
    notes.value = notes.value.filter(n => n.id !== id);
    selected.value = null;
}
</script>

<template>
  <div class="app">
    <template v-if="current">
      <header class="editor-head glass">
        <button class="back" @click="selected=null">
          <svg viewBox="0 0 24 24">
            <path :d="icons.back" />
          </svg>
          {{ folder || 'Notes' }}
        </button>
        <div class="bar">
          <button
            class="icon"
            :aria-label="current.pinned?'Unpin note':'Pin note'"
            :aria-pressed="current.pinned"
            @click="current.pinned=!current.pinned"
          >
            <svg viewBox="0 0 24 24">
              <path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4ZM12 15v7" />
            </svg>
          </button>
          <button
            class="icon"
            :aria-label="preview?'Edit note':'Preview formatting'"
            :aria-pressed="preview"
            @click="preview=!preview"
          >
            <svg viewBox="0 0 24 24">
              <path :d="icons[preview?'edit':'check']" />
            </svg>
          </button>
        </div>
      </header>
      <main class="note-editor scroll">
        <p class="note-date">
          {{ current.date }}
          · In
          {{ current.folder }}
        </p>
        <input
          v-model="current.title"
          class="note-title"
          placeholder="Title"
          aria-label="Note title"
          maxlength="120"
         />
        <textarea
          v-if="!preview"
          ref="editor"
          v-model="current.body"
          class="body-editor"
          aria-label="Note content"
          placeholder="Start a small thought…"
         />
        <div v-else class="formatted">
          <div v-for="line in lines" :key="line.index" :class="['line',line.kind,{checked:line.checked}]">
            <button
              v-if="line.kind==='check'"
              class="check-box"
              :aria-label="'Toggle checklist item '+(line.index+1)"
              :aria-pressed="line.checked"
              @click="checkLine(line.index)"
            >
              <span>{{ line.checked?'✓':'' }}</span>
            </button>
            <p>
              <template v-for="(part,i) in line.parts" :key="i">
                <strong v-if="part.bold">{{ part.text }}</strong>
                <span v-else>{{ part.text }}</span>
              </template>
            </p>
          </div>
        </div>
      </main>
      <footer class="formatbar glass">
        <button aria-label="Format selection bold" :disabled="preview" @click="format('bold')">
          <b>B</b>
        </button>
        <button aria-label="Format line as title" :disabled="preview" @click="format('title')">Aa</button>
        <button aria-label="Format lines as checklist" :disabled="preview" @click="format('check')">
          <svg viewBox="0 0 24 24">
            <path d="m2 5 2 2 3-3M10 5h12m-20 8 2 2 3-3M10 13h12M2 21h5m3 0h12" />
          </svg>
        </button>
        <button class="icon" aria-label="Delete note" @click="remove">
          <svg viewBox="0 0 24 24">
            <path d="M3 5h18M9 5V2h6v3M5 5l1 17h12l1-17M10 9v8M14 9v8" />
          </svg>
        </button>
        <button class="icon" aria-label="New note" @click="newNote">
          <svg viewBox="0 0 24 24">
            <path :d="icons.edit" />
          </svg>
        </button>
      </footer>
    </template>
    <template v-else>
      <header class="top">
        <div class="bar">
          <button v-if="folder" class="back" @click="folder=null;query=''">
            <svg viewBox="0 0 24 24">
              <path :d="icons.back" />
            </svg>
            Folders
          </button>
          <span v-else class="muted">On My iPhone</span>
          <button class="pill accent" @click="newNote">New note</button>
        </div>
        <h1>{{ folder || 'Folders' }}</h1>
        <input v-if="folder" v-model="query" class="search" aria-label="Search notes" placeholder="Search" />
      </header>
      <main class="scroll main">
        <template v-if="!folder">
          <h3 class="section-label">On My iPhone</h3>
          <div class="folder-group">
            <button v-for="name in folders" :key="name" class="folder-row" @click="folder=name">
              <svg viewBox="0 0 24 24">
                <path d="M3 6h7l2 3h9v12H3Z" />
              </svg>
              <span>{{ name }}</span>
              <small>{{ count(name) }}</small>
              <b>›</b>
            </button>
          </div>
          <div class="folder-tip">
            <svg viewBox="0 0 24 24">
              <path :d="icons.edit" />
            </svg>
            <h2>Room for a thought.</h2>
            <p>
              Lists, late-night ideas and a password note containing absolutely no passwords.
            </p>
          </div>
        </template>
        <template v-else>
          <div class="notes-group">
            <button v-for="note in filtered" :key="note.id" class="note-row" @click="open(note)">
              <div class="bar">
                <h3>{{ note.title || 'New Note' }}</h3>
                <span v-if="note.pinned" class="pin">⌖</span>
              </div>
              <p>
                <time>{{ note.date }}</time>
                {{ note.body.replace(/[#*]/g,'').split('\n').find(line=>line.trim()) || 'No additional text' }}
              </p>
              <small>{{ note.folder }}</small>
            </button>
          </div>
          <p v-if="!filtered.length" class="empty">No notes found. A new thought is always welcome.</p>
        </template>
      </main>
      <footer class="list-footer glass">
        <span>
          {{ folder?filtered.length:notes.length }}
          notes
        </span>
        <button class="icon" aria-label="Create note" @click="newNote">
          <svg viewBox="0 0 24 24">
            <path :d="icons.edit" />
          </svg>
        </button>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  letter-spacing: -.02em;
  font-size: 17px;
  isolation: isolate;
}

.app * {
  box-sizing: border-box;
}

button, input, textarea {
  font: inherit;
  letter-spacing: inherit;
}

button {
  cursor: pointer;
  border: 0;
  background: none;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  touch-action: manipulation;
  transition: transform 250ms ease, opacity 250ms ease;
}

button:active {
  transform: scale(.96);
}

button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid #4d9fff;
  outline-offset: 2px;
}

button:disabled {
  opacity: .45;
  cursor: default;
}

input, textarea {
  font-size: 16px;
  min-height: 44px;
  color: inherit;
  border: 0;
  outline: none;
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -.035em;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

h3 {
  font-size: 17px;
  font-weight: 600;
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  min-height: 0;
}

.scroll::-webkit-scrollbar {
  display: none;
}

.glass {
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255,255,255,.35);
}

.top {
  padding: var(--safe-top,62px) 20px 12px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  padding: 10px;
}

.muted {
  color: #8e8e93;
  font-size: 13px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  gap: 2px;
  flex-shrink: 0;
  padding: 8px 10px var(--safe-bottom,34px);
  background: rgba(249,249,250,.85);
  backdrop-filter: blur(25px) saturate(180%);
  border-top: 1px solid rgba(0,0,0,.08);
}

.tabs button {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  min-height: 52px;
  border-radius: 22px;
  color: #8e8e93;
}

.tabs button.active {
  color: var(--accent,#007aff);
  background: rgba(127,127,127,.1);
}

.pill {
  border-radius: 24px;
  padding: 8px 16px;
}

.empty {
  padding: 44px 24px;
  text-align: center;
  color: #8e8e93;
  line-height: 1.5;
}

.search {
  width: 100%;
  background: rgba(127,127,127,.12);
  border-radius: 14px;
  padding: 10px 14px;
}

.section-label {
  font-size: 13px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: .03em;
  padding: 22px 16px 8px;
}

.hairline {
  border-bottom: 1px solid rgba(127,127,127,.18);
}

@media(prefers-reduced-motion:reduce) {
  .app *, .app *::before, .app *::after {
    animation: none!important;
    transition: none!important;
    scroll-behavior: auto!important;
  }
}

.app {
  background: #f2f2f7;
  color: #191919;
  --accent: #d99b00;
}

.accent, .back {
  color: #c79506;
}

.top h1 {
  margin: 14px 0 18px;
}

.back {
  display: flex;
  align-items: center;
  padding-left: 0;
  gap: 2px;
  font-size: 17px;
}

.main {
  flex: 1;
  padding: 0 20px;
}

.section-label {
  padding-left: 0;
}

.folder-group, .notes-group {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}

.folder-row {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 14px 16px;
  min-height: 57px;
  width: 100%;
  border-bottom: 1px solid #0000000c;
  text-align: left;
}

.folder-row:last-child {
  border: 0;
}

.folder-row svg {
  color: #e8b22d;
}

.folder-row>span {
  flex: 1;
}

.folder-row small, .folder-row b {
  font-size: 16px;
  color: #aaa;
  font-weight: 400;
}

.folder-tip {
  text-align: center;
  margin: 60px 30px;
  color: #8a8a90;
}

.folder-tip svg {
  width: 46px;
  height: 46px;
  color: #d7ae4a;
}

.folder-tip h2 {
  color: #4a4a50;
  margin-top: 22px;
}

.folder-tip p {
  font-size: 16px;
  line-height: 1.6;
  margin-top: 12px;
}

.note-row {
  display: block;
  text-align: left;
  padding: 17px 18px;
  min-height: 99px;
  width: 100%;
  border-bottom: 1px solid #0000000c;
}

.note-row h3 {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 300px;
}

.note-row p {
  font-size: 15px;
  color: #8e8e93;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin: 6px 0;
}

.note-row time {
  margin-right: 9px;
  color: #555;
}

.note-row small {
  color: #b4a985;
  font-size: 12px;
}

.pin {
  color: #d9a521;
}

.list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f9f9fadd;
  padding: 10px 20px var(--safe-bottom,34px);
  border-top-color: #00000009;
}

.list-footer>span {
  margin-left: auto;
  margin-right: auto;
  font-size: 12px;
  color: #555;
}

.list-footer .icon {
  color: #c79506;
}

.editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--safe-top,62px) 18px 10px;
  background: #fffdf8dd;
  color: #c79506;
}

.note-editor {
  flex: 1;
  background: #fffdf8;
  padding: 16px 25px 22px;
  display: flex;
  flex-direction: column;
}

.note-date {
  text-align: center;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 22px;
}

.note-title {
  font-size: 29px;
  font-weight: 700;
  background: transparent;
  padding: 0;
  margin-bottom: 14px;
  width: 100%;
}

.body-editor {
  resize: none;
  flex: 1;
  min-height: 450px;
  width: 100%;
  background: transparent;
  font-size: 17px;
  line-height: 1.65;
  padding: 0;
}

.formatted {
  font-size: 17px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.line {
  display: flex;
  align-items: flex-start;
  min-height: 29px;
}

.line p {
  padding-top: 3px;
}

.line.title {
  font-size: 24px;
  font-weight: 700;
  padding: 10px 0;
}

.line.checked p {
  color: #999;
  text-decoration: line-through;
}

.check-box {
  padding: 0;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-left: -8px;
}

.check-box span {
  width: 23px;
  height: 23px;
  border: 1.5px solid #d7a32a;
  border-radius: 50%;
  font-size: 16px;
  color: #d7a32a;
  line-height: 20px;
}

.checked .check-box span {
  background: #e5b943;
  color: #fff;
}

.formatbar {
  display: flex;
  justify-content: space-around;
  color: #c79506;
  background: #fffdf8ee;
  padding: 10px 10px var(--safe-bottom,34px);
  border-top-color: #d7a32a22;
}

.formatbar button {
  font-size: 23px;
  display: grid;
  place-items: center;
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  container-type: size;
  min-width: 0;
  min-height: 0;
}

.app :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

button, a[download] {
  min-width: 44px;
  min-height: 44px;
  touch-action: manipulation;
  transition: transform 220ms ease, opacity 220ms ease;
}

button:active:not(:disabled), a[download]:active {
  transform: scale(.96);
}

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid var(--accent, #007aff);
  outline-offset: 3px;
}

.icon, .tool, .glass-round, .round, .go, .send {
  flex-shrink: 0;
}

.scroll, .scroller, .feed, .page, .tiles {
  min-width: 0;
  min-height: 0;
  overscroll-behavior: contain;
}

.tabs button {
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
}

@media (hover: hover) {
  button:hover:not(:disabled), a[download]:hover {
    opacity: .82;
  }
}

@media (pointer: coarse) {
  button, a[download] {
    min-width: 58px;
    min-height: 58px;
  }
  .tabs button {
    min-width: 0;
    min-height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app :deep(*), .app :deep(*::before), .app :deep(*::after) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.top, .editor-head, .formatbar, .list-footer {
  flex-shrink: 0;
}

.folder-tip {
  margin: 34px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.folder-tip h2 {
  margin-top: 16px;
}

.folder-tip p {
  color: #64646b;
  font-size: 15px;
}

.note-editor {
  min-height: 0;
}

.body-editor {
  min-height: 240px;
}

.note-row h3, .note-row p {
  max-width: 100%;
}

.note-date, .note-row small, .muted {
  color: #64646b;
}

.check-box {
  min-width: 44px;
  min-height: 44px;
}

.check-box span {
  border-color: #8a6700;
}

@container (max-height: 700px) {
  .folder-tip {
    margin-block: 24px;
  }
  .folder-tip svg {
    width: 36px;
    height: 36px;
  }
  .note-editor {
    padding-inline: 20px;
  }
}

.editor-head, .back, .formatbar, .accent {
  color: #947000;
}

.formatted {
  animation: pocket-reveal 250ms ease both;
}

@keyframes pocket-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .formatted {
    animation: none;
  }
}
</style>
