<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import FileGlyph from './files/FileGlyph.vue';
import AppGlyph from './files/AppGlyph.vue';
import QuickLook from './files/QuickLook.vue';
import { FILE_TAGS, KIND_NAMES, MAX_FILE_CONTENT, MAX_FILE_ENTRIES, MAX_FILE_NAME, formatBytes, readSavedFiles, seedFiles } from './files/model';
import type { FileEntry, FileStorage, FileTag } from './files/model';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type Location = 'Recents' | 'Shared' | 'iCloud Drive' | 'On My Vision Pro' | 'Downloads' | 'Tags' | 'Recently Deleted';
type Panel = 'actions' | 'organise' | 'move' | 'tags' | null;
const locations: { name: Location; path: string }[] = [
  { name: 'Recents', path: 'M12 3a9 9 0 1 0 9 9M12 6v6l4 3M16 3h5v5' },
  { name: 'Shared', path: 'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m9 0a3 3 0 1 0 0-6m-2 15q0-7-7-7t-7 7m15-6q6-1 7 6' },
  { name: 'iCloud Drive', path: 'M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 6 6 0 0 1 0 11z' },
  { name: 'On My Vision Pro', path: 'M3 7h18v13H3zM7 4h10' },
  { name: 'Downloads', path: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4' },
  { name: 'Tags', path: 'M3 3h9l9 9-9 9-9-9zM8 8h.1' },
  { name: 'Recently Deleted', path: 'M5 7h14l-1 14H6zm-2 0h18M9 3h6v4m-6 4v6m6-6v6' },
];
const location = ref<Location>('Recents');
const entries = ref<FileEntry[]>(seedFiles());
const folder = ref<number | null>(null);
const query = ref('');
const view = ref<'grid' | 'list' | 'columns'>('grid');
const sort = ref<'name' | 'date' | 'size' | 'kind'>('date');
const descending = ref(true);
const group = ref<'none' | 'kind' | 'tag' | 'storage'>('none');
const activeTag = ref<FileTag | 'All'>('All');
const selected = ref<number[]>([]);
const multi = ref(false);
const previewId = ref<number | null>(null);
const panel = ref<Panel>(null);
const renameId = ref<number | null>(null);
const renameValue = ref('');
const moveId = ref<number | null>(null);
const moveStorage = ref<FileStorage>('device');
const message = ref('');
const root = ref<HTMLElement>();
const collection = ref<HTMLElement>();
const popover = ref<HTMLElement>();
const renameInput = ref<HTMLInputElement>();
const railLabel = ref<{ name: string; x: number; y: number } | null>(null);
const marquee = ref<{ x: number; y: number; width: number; height: number } | null>(null);
let marqueeStart: { x: number; y: number; before: number[] } | undefined;
let draggedIds: number[] = [];
let messageTimer = 0;
let mounted = false;
let returnFocus: HTMLElement | undefined;

const storageForLocation = (place: Location): FileStorage => place === 'iCloud Drive' ? 'cloud'
  : place === 'Shared' ? 'shared' : place === 'Downloads' ? 'downloads' : 'device';
const storageLabel: Record<FileStorage, string> = {
  device: 'On My Vision Pro', cloud: 'iCloud Drive', shared: 'Shared', downloads: 'Downloads',
};
const preview = computed(() => entries.value.find(item => item.id === previewId.value));
const selectedEntries = computed(() => entries.value.filter(item => selected.value.includes(item.id)));
const title = computed(() => entries.value.find(item => item.id === folder.value)?.name ?? location.value);
const breadcrumbs = computed(() => {
  const path: FileEntry[] = [];
  let id = folder.value;
  const seen = new Set<number>();
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const entry = entries.value.find(item => item.id === id);
    if (!entry) break;
    path.unshift(entry);
    id = entry.parent;
  }
  return path;
});
function inLocation(item: FileEntry, parent: number | null): boolean {
  if (location.value === 'Recently Deleted') return item.deleted && parent === null;
  if (item.deleted) return false;
  if (parent !== null) return item.parent === parent;
  if (location.value === 'Recents') return item.kind !== 'folder';
  if (location.value === 'Tags') return activeTag.value === 'All' || item.tag === activeTag.value;
  return item.parent === null && item.storage === storageForLocation(location.value);
}
function order(items: FileEntry[]): FileEntry[] {
  return [...items].sort((a, b) => {
    const delta = sort.value === 'name' ? a.name.localeCompare(b.name, undefined, { numeric: true })
      : sort.value === 'size' ? a.bytes - b.bytes : sort.value === 'kind'
        ? KIND_NAMES[a.kind].localeCompare(KIND_NAMES[b.kind]) : a.modified - b.modified;
    return (descending.value ? -1 : 1) * delta;
  });
}
const shown = computed(() => order(entries.value.filter(item => {
  if (!query.value.trim()) return inLocation(item, folder.value);
  const matches = item.name.toLowerCase().includes(query.value.toLowerCase().trim())
    || item.tag.toLowerCase().includes(query.value.toLowerCase().trim());
  if (!matches) return false;
  if (location.value === 'Recently Deleted') return item.deleted;
  if (item.deleted) return false;
  if (folder.value !== null) return descendants(folder.value).includes(item.id);
  if (location.value === 'Tags') return activeTag.value === 'All' || item.tag === activeTag.value;
  return location.value === 'Recents' || item.storage === storageForLocation(location.value);
})));
const groups = computed(() => {
  const result = new Map<string, FileEntry[]>();
  for (const item of shown.value) {
    const key = group.value === 'kind' ? KIND_NAMES[item.kind] : group.value === 'tag'
      ? item.tag || 'Untagged' : group.value === 'storage' ? storageLabel[item.storage] : '';
    const list = result.get(key) ?? [];
    list.push(item);
    result.set(key, list);
  }
  return [...result].map(([name, items]) => ({ name, items }));
});
const columns = computed(() => {
  if (query.value || location.value === 'Recently Deleted' || location.value === 'Tags') return [{ name: title.value, items: shown.value }];
  const parents: (number | null)[] = [null, ...breadcrumbs.value.map(item => item.id)];
  return parents.map(parent => ({
    name: parent === null ? location.value : entries.value.find(item => item.id === parent)?.name ?? 'Folder',
    items: order(entries.value.filter(item => inLocation(item, parent))),
  }));
});
const folderTree = computed(() => entries.value.filter(item => item.kind === 'folder' && !item.deleted));
const moveFolders = computed(() => folderTree.value.filter(item => item.storage === moveStorage.value && !selected.value.some(id =>
  id === item.id || descendants(id).includes(item.id),
)));
const used = computed(() => entries.value.filter(item => !item.deleted).reduce((total, item) => total + item.bytes, 0));
const deletedCount = computed(() => entries.value.filter(item => item.deleted).length);
const storagePercentage = computed(() => Math.max(1, Math.min(100, used.value / 256000000000 * 100)));

function showRailLabel(event: Event, name: string): void {
  const button = event.currentTarget;
  const host = root.value;
  if (!(button instanceof HTMLElement) || !host) return;
  const rect = button.getBoundingClientRect();
  const bounds = host.getBoundingClientRect();
  const scaleX = host.offsetWidth / (bounds.width || 1);
  const scaleY = host.offsetHeight / (bounds.height || 1);
  railLabel.value = {
    name, x: (rect.right - bounds.left) * scaleX + 10,
    y: (rect.top - bounds.top + rect.height / 2) * scaleY,
  };
}
function notify(text: string): void {
  if (vision) vision.toast(text);
  else message.value = text;
  clearTimeout(messageTimer);
  messageTimer = window.setTimeout(() => { message.value = ''; }, 4000);
}
function descendants(id: number): number[] {
  const result: number[] = [];
  const pending = [id];
  while (pending.length) {
    const current = pending.pop();
    for (const child of entries.value.filter(item => item.parent === current)) {
      if (result.includes(child.id)) continue;
      result.push(child.id);
      pending.push(child.id);
    }
  }
  return result;
}
function navigate(place: Location): void {
  location.value = place;
  folder.value = null;
  query.value = '';
  selected.value = [];
  previewId.value = null;
  panel.value = null;
  renameId.value = null;
}
function navigateFolder(id: number | null): void {
  folder.value = id;
  query.value = '';
  selected.value = [];
  renameId.value = null;
}
function open(item: FileEntry): void {
  panel.value = null;
  if (item.deleted) { notify('Restore this item before opening it.'); return; }
  if (item.kind === 'folder') {
    if (location.value === 'Recents' || location.value === 'Tags') location.value = storageLabel[item.storage] as Location;
    navigateFolder(item.id);
  } else previewId.value = item.id;
}
function choose(event: MouseEvent, item: FileEntry): void {
  // Touch has no reliable double click, so a selected file opens on the next tap.
  if (!multi.value && !event.metaKey && !event.ctrlKey && !event.shiftKey
    && selected.value.length === 1 && selected.value[0] === item.id && event.detail === 1) {
    open(item);
    return;
  }
  if (multi.value || event.metaKey || event.ctrlKey) {
    selected.value = selected.value.includes(item.id) ? selected.value.filter(id => id !== item.id) : [...selected.value, item.id];
  } else if (event.shiftKey && selected.value.length) {
    const anchor = shown.value.findIndex(entry => entry.id === selected.value[0]);
    const index = shown.value.findIndex(entry => entry.id === item.id);
    selected.value = shown.value.slice(Math.min(Math.max(anchor, 0), index), Math.max(anchor, index) + 1).map(entry => entry.id);
  } else selected.value = [item.id];
}
function keyItem(event: KeyboardEvent, item: FileEntry): void {
  if (event.key === 'Enter') { event.preventDefault(); open(item); }
  if (event.key === ' ') {
    event.preventDefault();
    selected.value = selected.value.includes(item.id) ? selected.value.filter(id => id !== item.id) : [...selected.value, item.id];
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const parent = (event.currentTarget as HTMLElement).closest('.item-collection');
    if (!parent) return;
    const buttons = Array.from(parent.querySelectorAll<HTMLButtonElement>('.item-main'));
    const index = buttons.indexOf(event.currentTarget as HTMLButtonElement);
    const current = buttons[index];
    let step = 1;
    if (view.value === 'grid' && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && current) {
      const y = current.getBoundingClientRect().top;
      const firstOtherRow = buttons.findIndex(button => button.getBoundingClientRect().top > y + 10);
      const firstCurrentRow = buttons.findIndex(button => Math.abs(button.getBoundingClientRect().top - y) < 10);
      step = firstOtherRow > firstCurrentRow ? firstOtherRow - firstCurrentRow
        : Math.max(1, Math.round(parent.clientWidth / current.getBoundingClientRect().width));
    }
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -step : step;
    buttons[Math.max(0, Math.min(buttons.length - 1, index + delta))]?.focus();
  }
  if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) {
    event.preventDefault(); showActions(item);
  }
}
function showActions(item?: FileEntry): void {
  if (item && !selected.value.includes(item.id)) selected.value = [item.id];
  if (!selected.value.length) return;
  showPanel('actions');
}
function showPanel(value: Panel): void {
  if (panel.value === null) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  panel.value = value;
  void nextTick(() => popover.value?.querySelector<HTMLElement>('button, input, select')?.focus());
}
function closePanel(): void {
  panel.value = null;
  returnFocus?.focus();
}
function trapFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const elements = Array.from(popover.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select') ?? []);
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function setRenameInput(element: Element | ComponentPublicInstance | null): void {
  renameInput.value = element instanceof HTMLInputElement ? element : undefined;
}
function beginRename(): void {
  const item = selectedEntries.value[0];
  if (!item || item.deleted) return;
  closePanel();
  if (view.value === 'columns') view.value = 'list';
  renameId.value = item.id;
  renameValue.value = item.name;
  void nextTick(() => { renameInput.value?.focus(); renameInput.value?.select(); });
}
function commitRename(): void {
  const item = entries.value.find(entry => entry.id === renameId.value);
  if (!item) { renameId.value = null; return; }
  const name = renameValue.value.trim().replace(/[\\/]/g, '-').slice(0, MAX_FILE_NAME);
  if (!name) { notify('A file needs a name, even a provisional one.'); return; }
  if (entries.value.some(entry => entry.id !== item.id && !entry.deleted && entry.parent === item.parent
    && entry.storage === item.storage && entry.name.toLowerCase() === name.toLowerCase())) {
    notify('That name is already taken in this folder.'); return;
  }
  item.name = name;
  item.modified = Date.now();
  renameId.value = null;
}
function nextId(): number {
  return Math.max(0, ...entries.value.map(item => item.id)) + 1;
}
function uniqueName(name: string, parent: number | null, storage: FileStorage): string {
  const safeName = name.slice(0, MAX_FILE_NAME);
  let result = safeName;
  let count = 2;
  while (entries.value.some(item => item.name === result && item.parent === parent && item.storage === storage && !item.deleted)) {
    const dot = safeName.lastIndexOf('.');
    const extension = dot > 0 ? safeName.slice(dot) : '';
    const base = dot > 0 ? safeName.slice(0, dot) : safeName;
    const suffix = ' ' + count;
    result = extension.length + suffix.length >= MAX_FILE_NAME
      ? safeName.slice(0, MAX_FILE_NAME - suffix.length) + suffix
      : base.slice(0, MAX_FILE_NAME - suffix.length - extension.length) + suffix + extension;
    count++;
  }
  return result;
}
function canAdd(count: number): boolean {
  if (entries.value.length + count > MAX_FILE_ENTRIES) {
    notify('This workspace holds up to 1,000 items. Your existing files are safe.');
    return false;
  }
  if (!Number.isSafeInteger(nextId() + count - 1)) {
    notify('This workspace has run out of file identifiers. Your existing files are safe.');
    return false;
  }
  return true;
}
function liveTree(id: number): number[] {
  return [id, ...descendants(id)].filter(childId => entries.value.some(item => item.id === childId && !item.deleted));
}
function topSelected(): FileEntry[] {
  return selectedEntries.value.filter(item => !selected.value.some(id => descendants(id).includes(item.id)));
}
function duplicate(): void {
  const roots = topSelected().filter(item => !item.deleted);
  const copies: number[] = [];
  const total = roots.reduce((count, item) => count + liveTree(item.id).length, 0);
  if (!canAdd(total)) return;
  let id = nextId();
  for (const original of roots) {
    const map = new Map<number, number>();
    const all = liveTree(original.id);
    for (const oldId of all) map.set(oldId, id++);
    for (const oldId of all) {
      const item = entries.value.find(entry => entry.id === oldId);
      const newId = map.get(oldId);
      if (!item || newId === undefined) continue;
      const parent = oldId === original.id ? original.parent : map.get(item.parent ?? 0) ?? original.parent;
      entries.value.push({
        ...item, id: newId, parent, modified: Date.now(), deleted: false,
        name: oldId === original.id ? uniqueName(item.name, parent, item.storage) : item.name,
      });
      if (oldId === original.id) copies.push(newId);
    }
  }
  selected.value = copies;
  closePanel();
  notify(roots.length + ' item' + (roots.length === 1 ? '' : 's') + ' duplicated. Another final version.');
}
function setTag(tag: FileTag | ''): void {
  for (const item of selectedEntries.value) { item.tag = tag; item.modified = Date.now(); }
  closePanel();
  notify(tag ? 'Tagged ' + tag + '.' : 'Tags removed.');
}
function deleteSelected(): void {
  const ids = new Set(selected.value.flatMap(id => [id, ...descendants(id)]));
  for (const item of entries.value) if (ids.has(item.id)) { item.deleted = true; item.modified = Date.now(); }
  selected.value = [];
  closePanel();
  notify('Moved to Recently Deleted. Regret is reversible.');
}
function restoreSelected(): void {
  const ids = new Set(selected.value.flatMap(id => [id, ...descendants(id)]));
  for (const id of [...ids]) {
    let item = entries.value.find(entry => entry.id === id);
    while (item?.parent !== null && item?.parent !== undefined) {
      ids.add(item.parent);
      item = entries.value.find(entry => entry.id === item?.parent);
    }
  }
  for (const item of entries.value) if (ids.has(item.id) && item.deleted) {
    item.name = uniqueName(item.name, item.parent, item.storage);
    item.deleted = false;
    item.modified = Date.now();
  }
  selected.value = [];
  closePanel();
  notify('Restored, with its folder path intact.');
}
function moveItems(ids: number[], destination: number | null, storage: FileStorage): void {
  const target = destination === null ? undefined : entries.value.find(item => item.id === destination && item.kind === 'folder' && !item.deleted);
  if (destination !== null && !target) return;
  if (ids.some(id => id === destination || destination !== null && descendants(id).includes(destination))) {
    notify('A folder cannot move into itself. Even recursively.'); return;
  }
  const moving = entries.value.filter(item => ids.includes(item.id)
    && !item.deleted && !ids.some(id => descendants(id).includes(item.id)));
  for (const item of moving) {
    if (item.parent === destination && item.storage === storage) continue;
    item.name = uniqueName(item.name, destination, target?.storage ?? storage);
    item.parent = destination;
    item.storage = target?.storage ?? storage;
    item.modified = Date.now();
    for (const id of descendants(item.id)) {
      const child = entries.value.find(entry => entry.id === id);
      if (child) child.storage = item.storage;
    }
  }
  selected.value = [];
  closePanel();
  notify('Moved ' + moving.length + ' item' + (moving.length === 1 ? '' : 's') + '. A fresh place to forget them.');
}
function beginMove(): void {
  moveStorage.value = selectedEntries.value[0]?.storage ?? 'device';
  moveId.value = null;
  showPanel('move');
}
function dragStart(event: DragEvent, item: FileEntry): void {
  if (item.deleted || renameId.value === item.id) { event.preventDefault(); return; }
  draggedIds = selected.value.includes(item.id) ? [...selected.value] : [item.id];
  if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'lab-vision-files'); }
}
function dropLocation(event: DragEvent, place: Location): void {
  if (!draggedIds.length) return;
  event.preventDefault();
  event.stopPropagation();
  if (place === 'Recently Deleted') { selected.value = [...draggedIds]; deleteSelected(); }
  else if (place === 'Tags') { selected.value = [...draggedIds]; showPanel('tags'); }
  else if (place === 'Recents') notify('Drop into a folder or a storage location.');
  else dropInto(event, null, storageForLocation(place));
  draggedIds = [];
}
function dropInto(event: DragEvent, id: number | null, storage: FileStorage): void {
  if (!draggedIds.length) return;
  event.preventDefault();
  event.stopPropagation();
  moveItems(draggedIds, id, storage);
  draggedIds = [];
}
function compress(): void {
  const roots = topSelected().filter(item => !item.deleted);
  const first = roots[0];
  if (!first) return;
  if (!canAdd(1)) return;
  const all = new Set(roots.flatMap(item => liveTree(item.id)));
  const contents = JSON.stringify(entries.value.filter(item => all.has(item.id)).map(item => ({
    ...item, parent: item.parent !== null && all.has(item.parent) ? item.parent : null,
  })));
  if (contents.length > MAX_FILE_CONTENT) {
    notify('That archive is too large for this tiny simulated filesystem. Try a smaller selection.');
    return;
  }
  const bytes = entries.value.filter(item => all.has(item.id)).reduce((sum, item) => sum + item.bytes, 0);
  const archive: FileEntry = {
    id: nextId(), name: uniqueName(roots.length === 1 ? first.name.replace(/\.[^.]+$/, '') + '.zip' : 'Archive of good intentions.zip',
      first.parent, first.storage),
    parent: first.parent, storage: first.storage, kind: 'zip', bytes: Math.max(200, Math.round(bytes * .72)),
    tag: '', modified: Date.now(), deleted: false,
    detail: 'A simulated archive containing ' + all.size + ' items. At least one is probably final.',
    content: contents,
  };
  entries.value.push(archive);
  selected.value = [archive.id];
  closePanel();
  notify('Archive created. No actual disk files were harmed.');
}
function extract(entry: FileEntry): void {
  let saved: FileEntry[] | undefined;
  try { if (entry.content) saved = readSavedFiles(entry.content); } catch { /* Seed archives use drawn contents. */ }
  if (saved) saved = saved.filter(item => !item.deleted);
  const names = entry.name === 'do_not_open.zip'
    ? ['definitely_do_not_open.zip', 'README_you_did_it_anyway.txt', 'confidence.json']
    : ['one_last_archive.zip', 'a_very_small_apology.txt'];
  if (!canAdd(1 + (saved?.length ?? names.length))) return;
  const id = nextId();
  const destination: FileEntry = {
    id, name: uniqueName(entry.name.replace(/\.zip$/i, ''), entry.parent, entry.storage),
    parent: entry.parent, storage: entry.storage, kind: 'folder', bytes: 0, tag: entry.tag, modified: Date.now(),
    deleted: false, content: '', detail: 'An extracted collection of perfectly valid warnings.',
  };
  entries.value.push(destination);
  if (saved) {
    const map = new Map(saved.map((item, index) => [item.id, id + index + 1]));
    for (const item of saved) {
      const newId = map.get(item.id);
      if (newId === undefined) continue;
      entries.value.push({
        ...item, id: newId, parent: map.get(item.parent ?? 0) ?? id, storage: entry.storage, deleted: false, modified: Date.now(),
      });
    }
  } else {
    names.forEach((name, index) => {
      entries.value.push({
        id: id + index + 1, parent: id, storage: entry.storage, name, kind: name.endsWith('.zip') ? 'zip'
          : name.endsWith('.json') ? 'json' : 'text',
        bytes: 450 + index * 170, modified: Date.now(), tag: '', deleted: false,
        detail: 'Extracted from ' + entry.name + '. You were warned, very politely.',
        content: name.endsWith('.json') ? '{\n  "confidence": 0.4,\n  "warningsIgnored": true\n}' : 'You opened the archive.\n\nWe respect your curiosity.',
      });
    });
  }
  previewId.value = null;
  location.value = storageLabel[entry.storage] as Location;
  navigateFolder(id);
  notify('Extracted into ' + destination.name + '.');
}
function startMarquee(event: PointerEvent): void {
  if (event.pointerType === 'touch' || event.button !== 0 || view.value === 'columns') return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.closest('.item, button, input')) return;
  const area = collection.value;
  if (!area) return;
  const rect = area.getBoundingClientRect();
  marqueeStart = { x: event.clientX - rect.left + area.scrollLeft, y: event.clientY - rect.top + area.scrollTop,
    before: event.shiftKey || event.ctrlKey || event.metaKey ? [...selected.value] : [] };
  marquee.value = { x: marqueeStart.x, y: marqueeStart.y, width: 0, height: 0 };
  area.setPointerCapture(event.pointerId);
  selected.value = [...marqueeStart.before];
  event.preventDefault();
}
function moveMarquee(event: PointerEvent): void {
  const area = collection.value;
  if (!area || !marqueeStart) return;
  const rect = area.getBoundingClientRect();
  const x = event.clientX - rect.left + area.scrollLeft;
  const y = event.clientY - rect.top + area.scrollTop;
  marquee.value = { x: Math.min(x, marqueeStart.x), y: Math.min(y, marqueeStart.y),
    width: Math.abs(x - marqueeStart.x), height: Math.abs(y - marqueeStart.y) };
  const selection = new Set(marqueeStart.before);
  for (const item of area.querySelectorAll<HTMLElement>('[data-entry]')) {
    const box = item.getBoundingClientRect();
    const left = box.left - rect.left + area.scrollLeft;
    const top = box.top - rect.top + area.scrollTop;
    if (left < marquee.value.x + marquee.value.width && left + box.width > marquee.value.x
      && top < marquee.value.y + marquee.value.height && top + box.height > marquee.value.y) {
      selection.add(Number(item.dataset.entry));
    }
  }
  selected.value = [...selection];
}
function endMarquee(): void { marqueeStart = undefined; marquee.value = null; }
function stepBack(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return;
  if (panel.value) closePanel();
  else if (previewId.value !== null) previewId.value = null;
  else if (renameId.value !== null) renameId.value = null;
  else return;
  event.preventDefault();
  event.stopPropagation();
}
function treeDepth(item: FileEntry): number {
  let depth = 0;
  let parent = item.parent;
  while (parent !== null && depth < 12) {
    depth++;
    parent = entries.value.find(entry => entry.id === parent)?.parent ?? null;
  }
  return depth;
}
watch(previewId, (id, previousId) => {
  void nextTick(() => {
    if (id !== null) root.value?.querySelector<HTMLButtonElement>('.quick-look button')?.focus();
    else if (previousId !== null) root.value?.querySelector<HTMLButtonElement>('[data-entry="' + previousId + '"] .item-main')?.focus();
  });
});
watch(entries, () => {
  if (!mounted) return;
  try { localStorage.setItem('lab-vision-files', JSON.stringify(entries.value)); }
  catch { notify('Changes stay here for this visit. Storage is unavailable.'); }
}, { deep: true });
onMounted(() => {
  try {
    const raw = localStorage.getItem('lab-vision-files');
    if (raw) {
      const saved = readSavedFiles(raw);
      if (saved) entries.value = saved;
    }
  } catch { /* Private browsing keeps the same experience in memory. */ }
  mounted = true;
});
onBeforeUnmount(() => { clearTimeout(messageTimer); endMarquee(); draggedIds = []; });
</script>

<template>
  <div ref="root" class="files-app" :class="{ compact }" @keydown="stepBack">
    <QuickLook v-if="preview" :entry="preview" @close="previewId = null" @extract="extract" />
    <template v-else>
      <nav class="location-rail vk-tabbar vk-scroll" :inert="!!panel" @scroll="railLabel = null" aria-label="File locations">
        <button v-for="place in locations" :key="place.name" v-hover class="vk-icon" :aria-label="place.name"
          :aria-pressed="location === place.name" :title="place.name" @click="navigate(place.name)"
          @pointerenter="showRailLabel($event, place.name)" @pointerleave="railLabel = null"
          @focus="showRailLabel($event, place.name)" @blur="railLabel = null"
          @dragover.prevent @drop="dropLocation($event, place.name)">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path :d="place.path" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </nav>
      <Transition name="rail-hint">
        <span v-if="railLabel" class="rail-label vk-sheet" :style="{ left: railLabel.x + 'px', top: railLabel.y + 'px' }">{{ railLabel.name }}</span>
      </Transition>
      <aside :inert="!!panel" class="tree vk-platter vk-scroll" aria-label="Folder browser">
        <div class="tree-heading"><h1 class="vk-large-title">Files</h1><p class="vk-footnote vk-secondary">Everything has a place.<br />Allegedly.</p></div>
        <h2 class="vk-footnote vk-secondary">FOLDERS</h2>
        <button v-for="item in folderTree" :key="item.id" v-hover class="vk-row tree-row"
          :aria-pressed="folder === item.id" :style="{ paddingLeft: 12 + treeDepth(item) * 12 + 'px' }"
          @click="location = storageLabel[item.storage] as Location; navigateFolder(item.id)"
          @dragover.prevent @drop="dropInto($event, item.id, item.storage)">
          <FileGlyph kind="folder" /><span>{{ item.name }}<small>{{ storageLabel[item.storage] }}</small></span>
        </button>
      </aside>
      <main class="browser" :inert="!!panel">
        <header class="browser-heading">
          <button v-if="folder !== null" v-hover class="vk-icon folder-back" aria-label="Go to parent folder"
            @click="navigateFolder(entries.find(item => item.id === folder)?.parent ?? null)"><AppGlyph name="back" /></button>
          <div><span class="eyebrow vk-footnote vk-secondary">YOUR FILES, IN SPACE</span><h1 class="vk-large-title">{{ title }}</h1></div>
          <button v-hover class="vk-icon" aria-label="Sort, group and change file view" title="View options" @click="showPanel('organise')"><AppGlyph name="sort" /></button>
        </header>
        <div class="search-row">
          <input v-model="query" v-hover class="vk-field" type="search" aria-label="Search files in this location"
            placeholder="Find the actual final version" />
          <button v-hover class="vk-icon" aria-label="Select multiple files" :aria-pressed="multi" title="Select multiple" @click="multi = !multi">
            <AppGlyph name="check" />
          </button>
        </div>
        <nav class="breadcrumb vk-scroll" aria-label="Folder path">
          <button v-hover class="vk-button" :aria-current="folder === null ? 'page' : undefined" @click="navigateFolder(null)"
            @dragover.prevent @drop="dropInto($event, null, storageForLocation(location))">{{ location }}</button>
          <template v-for="crumb in breadcrumbs" :key="crumb.id">
            <AppGlyph name="forward" class="breadcrumb-arrow" />
            <button v-hover class="vk-button" :aria-current="folder === crumb.id ? 'page' : undefined" @click="navigateFolder(crumb.id)"
              @dragover.prevent @drop="dropInto($event, crumb.id, crumb.storage)">{{ crumb.name }}</button>
          </template>
        </nav>
        <div v-if="location === 'Tags'" class="tag-filters vk-scroll" aria-label="Filter by tag">
          <button v-for="tag in ['All', ...FILE_TAGS] as const" :key="tag" v-hover class="vk-chip" :aria-pressed="activeTag === tag"
            @click="activeTag = tag"><i :class="tag.toLowerCase()" />{{ tag }}</button>
        </div>
        <div v-if="view === 'columns'" class="column-browser vk-scroll">
          <section v-for="(column, index) in columns" :key="index + '-' + column.name" class="file-column vk-well vk-scroll"
            :class="{ 'empty-column': columns.length === 1 && !column.items.length }">
            <h2 class="vk-footnote vk-secondary">{{ column.name }}</h2>
            <div class="item-collection" role="group" :aria-label="column.name">
              <div v-for="item in column.items" :key="item.id" class="item column-item" :data-entry="item.id"
                :draggable="!item.deleted" @dragstart="dragStart($event, item)" @dragend="draggedIds = []"
                @dragover="item.kind === 'folder' && $event.preventDefault()"
                @drop="item.kind === 'folder' && dropInto($event, item.id, item.storage)">
                <button v-hover class="item-main vk-row" :class="{ selected: selected.includes(item.id) || breadcrumbs.some(crumb => crumb.id === item.id) }"
                  :aria-label="item.name + ', ' + KIND_NAMES[item.kind]" :aria-pressed="selected.includes(item.id)"
                  @click="choose($event, item); item.kind === 'folder' && !multi && open(item)"
                  @dblclick="open(item)" @keydown="keyItem($event, item)" @contextmenu.prevent="showActions(item)">
                  <FileGlyph :kind="item.kind" /><span>{{ item.name }}</span><AppGlyph v-if="item.kind === 'folder'" name="forward" class="disclosure" />
                </button>
                <button v-hover class="item-more vk-icon" :aria-label="'Actions for ' + item.name" @click="showActions(item)"><AppGlyph name="more" /></button>
              </div>
              <div v-if="!column.items.length" class="empty">
                <AppGlyph :name="location === 'Recently Deleted' ? 'restore' : 'archive'" />
                <h3>{{ query ? 'No matching files' : location === 'Recently Deleted' ? 'Everything is back in place' : 'A little room to breathe' }}</h3>
                <p>{{ query ? 'Try a shorter name or a tag.' : 'An unexpectedly tidy corner.' }}</p>
              </div>
            </div>
          </section>
        </div>
        <div v-else ref="collection" class="entries vk-scroll" @pointerdown="startMarquee" @pointermove="moveMarquee"
          @pointerup="endMarquee" @pointercancel="endMarquee">
          <section v-for="section in groups" :key="section.name" class="file-group">
            <h2 v-if="section.name" class="group-title vk-footnote vk-secondary">{{ section.name }} <span>{{ section.items.length }}</span></h2>
            <div class="item-collection" :class="view" role="group" :aria-label="section.name || title">
              <div v-for="item in section.items" :key="item.id" class="item" :class="{ selected: selected.includes(item.id) }"
                :data-entry="item.id" :draggable="!item.deleted && renameId !== item.id"
                @dragstart="dragStart($event, item)" @dragend="draggedIds = []"
                @dragover="item.kind === 'folder' && $event.preventDefault()"
                @drop="item.kind === 'folder' && dropInto($event, item.id, item.storage)">
                <template v-if="renameId === item.id">
                  <div class="rename-area vk-platter"><FileGlyph :kind="item.kind" />
                    <input :ref="setRenameInput" v-model="renameValue" v-hover class="vk-field" aria-label="New file name" maxlength="180"
                      @keydown.enter.prevent="commitRename" />
                    <button v-hover class="vk-button" @click="commitRename">Save</button>
                    <button v-hover class="vk-button" @click="renameId = null">Cancel</button>
                  </div>
                </template>
                <template v-else>
                  <button v-hover class="item-main vk-row" :class="{ selected: selected.includes(item.id) }"
                    :aria-label="item.name + ', ' + KIND_NAMES[item.kind] + (item.deleted ? ', deleted' : '')"
                    :aria-pressed="selected.includes(item.id)" @click="choose($event, item)"
                    @dblclick="open(item)" @keydown="keyItem($event, item)" @contextmenu.prevent="showActions(item)">
                    <FileGlyph :kind="item.kind" />
                    <span class="entry-name"><strong><template v-for="(part, index) in item.name.split(/(?<=[_ -])/)" :key="index">{{ part }}<wbr /></template></strong>
                      <small class="vk-secondary">{{ item.kind === 'folder' ? entries.filter(child => child.parent === item.id && !child.deleted).length + ' items'
                        : formatBytes(item.bytes) }}</small>
                    </span>
                    <span class="file-tag" :class="item.tag.toLowerCase()" :title="item.tag" />
                    <span v-if="view === 'list'" class="entry-kind vk-footnote vk-secondary">{{ KIND_NAMES[item.kind] }}</span>
                  </button>
                  <button v-hover class="item-more vk-icon" :aria-label="'Actions for ' + item.name" @click="showActions(item)"><AppGlyph name="more" /></button>
                </template>
              </div>
            </div>
          </section>
          <div v-if="marquee" class="marquee" :style="{ left: marquee.x + 'px', top: marquee.y + 'px', width: marquee.width + 'px', height: marquee.height + 'px' }" />
          <div v-if="!shown.length" class="empty">
            <AppGlyph :name="location === 'Recently Deleted' ? 'restore' : 'archive'" />
            <h3>{{ query ? 'No matching files' : location === 'Recently Deleted' ? 'Everything is back in place' : 'A little room to breathe' }}</h3>
            <p>{{ query ? 'Try a shorter name or a tag.' : 'An unexpectedly tidy corner.' }}</p>
          </div>
        </div>
        <footer class="browser-footer">
          <div class="storage-line">
            <span class="vk-footnote vk-secondary">{{ selected.length ? selected.length + ' selected' : shown.length + ' items' }}</span>
            <span class="storage-summary vk-footnote vk-secondary">{{ formatBytes(used) }} of 256 GB</span>
          </div>
          <div class="storage-track" aria-label="Simulated storage used" role="meter" :aria-valuenow="storagePercentage" aria-valuemin="0" aria-valuemax="100">
            <span :style="{ width: storagePercentage + '%' }" />
          </div>
          <div class="bottom-tools vk-ornament">
            <button v-hover class="vk-icon" aria-label="Icon view" :aria-pressed="view === 'grid'" @click="view = 'grid'"><AppGlyph name="grid" /></button>
            <button v-hover class="vk-icon" aria-label="List view" :aria-pressed="view === 'list'" @click="view = 'list'"><AppGlyph name="list" /></button>
            <button v-hover class="vk-icon" aria-label="Column view" :aria-pressed="view === 'columns'" @click="view = 'columns'"><AppGlyph name="columns" /></button>
            <span class="toolbar-divider" />
            <button v-hover class="vk-button" :disabled="!selected.length" @click="showActions()">Actions<span v-if="selected.length">({{ selected.length }})</span></button>
            <button v-hover class="vk-icon" :disabled="selected.length !== 1" :aria-label="location === 'Recently Deleted' ? 'Restore selected file' : 'Open selected file'"
              @click="location === 'Recently Deleted' ? restoreSelected() : selectedEntries[0] && open(selectedEntries[0])">
              <AppGlyph :name="location === 'Recently Deleted' ? 'restore' : 'open'" />
            </button>
          </div>
        </footer>
      </main>
    </template>

    <div v-if="panel" class="popover-scrim" @click.self="closePanel">
      <section ref="popover" class="popover vk-sheet vk-scroll" role="dialog" aria-modal="true"
        :aria-label="panel === 'organise' ? 'View options' : panel === 'move' ? 'Move selected files' : panel === 'tags' ? 'Tag selected files' : 'File actions'"
        @keydown="trapFocus">
        <header>
          <h2 class="vk-title">{{ panel === 'organise' ? 'View options' : panel === 'move' ? 'Move to' : panel === 'tags' ? 'Tags' : 'File actions' }}</h2>
          <button v-hover class="vk-icon" aria-label="Close menu" @click="closePanel"><AppGlyph name="close" /></button>
        </header>
        <template v-if="panel === 'organise'">
          <label class="option-label">View</label>
          <div class="vk-segmented">
            <button v-for="mode in ['grid', 'list', 'columns'] as const" :key="mode" v-hover :aria-pressed="view === mode" @click="view = mode">
              {{ mode === 'grid' ? 'Icons' : mode === 'list' ? 'List' : 'Columns' }}
            </button>
          </div>
          <label class="option-label">Sort by</label>
          <div class="option-grid">
            <button v-for="field in ['name', 'date', 'size', 'kind'] as const" :key="field" v-hover class="vk-button"
              :aria-pressed="sort === field" @click="sort = field">{{ field === 'date' ? 'Modified' : field.charAt(0).toUpperCase() + field.slice(1) }}</button>
          </div>
          <button v-hover class="vk-row" :aria-pressed="descending" @click="descending = !descending">Order <span>{{ descending ? 'Descending' : 'Ascending' }}</span></button>
          <label class="option-label">Group by</label>
          <div class="option-grid">
            <button v-for="field in ['none', 'kind', 'tag', 'storage'] as const" :key="field" v-hover class="vk-button" :aria-pressed="group === field"
              @click="group = field; view === 'columns' && field !== 'none' && (view = 'list')">
              {{ field === 'storage' ? 'Location' : field.charAt(0).toUpperCase() + field.slice(1) }}
            </button>
          </div>
        </template>
        <template v-else-if="panel === 'actions'">
          <p class="selection-description vk-footnote vk-secondary">{{ selected.length === 1 ? selectedEntries[0]?.name : selected.length + ' selected items' }}</p>
          <template v-if="location === 'Recently Deleted'">
            <button v-hover class="vk-row" @click="restoreSelected"><AppGlyph name="restore" /> Restore selected</button>
            <p class="vk-footnote vk-secondary">Deleted files stay here until restored. No automatic expiry.</p>
          </template>
          <template v-else>
            <button v-hover class="vk-row" :disabled="selected.length !== 1" @click="selectedEntries[0] && open(selectedEntries[0])">
              <AppGlyph name="open" /> Open / Quick Look
            </button>
            <button v-hover class="vk-row" :disabled="selected.length !== 1" @click="beginRename"><AppGlyph name="rename" /> Rename</button>
            <button v-hover class="vk-row" @click="duplicate"><AppGlyph name="duplicate" /> Duplicate</button>
            <button v-hover class="vk-row" @click="showPanel('tags')"><AppGlyph name="tag" /> Tags</button>
            <button v-hover class="vk-row" @click="beginMove"><AppGlyph name="move" /> Move to folder</button>
            <button v-hover class="vk-row" @click="compress"><AppGlyph name="archive" /> Compress</button>
            <button v-hover class="vk-row delete-action" @click="deleteSelected"><AppGlyph name="trash" /> Move to Recently Deleted</button>
          </template>
          <button v-hover class="vk-row" @click="selected = shown.map(item => item.id); closePanel()"><AppGlyph name="check" /> Select all in this view</button>
          <button v-hover class="vk-row" @click="selected = []; closePanel()"><AppGlyph name="circle" /> Clear selection</button>
        </template>
        <template v-else-if="panel === 'tags'">
          <button v-for="tag in FILE_TAGS" :key="tag" v-hover class="vk-row" @click="setTag(tag)"><i class="tag-dot" :class="tag.toLowerCase()" />{{ tag }}</button>
          <button v-hover class="vk-row" @click="setTag('')">Remove tags</button>
        </template>
        <template v-else-if="panel === 'move'">
          <p class="vk-footnote vk-secondary">{{ selected.length }} item{{ selected.length === 1 ? '' : 's' }}. Pick a location and destination.</p>
          <div class="move-storages">
            <button v-for="storage in ['device', 'cloud', 'shared', 'downloads'] as const" :key="storage" v-hover class="vk-button"
              :aria-pressed="moveStorage === storage" @click="moveStorage = storage; moveId = null">{{ storageLabel[storage] }}</button>
          </div>
          <button v-hover class="vk-row" :aria-pressed="moveId === null" @click="moveId = null"><AppGlyph name="home" /> {{ storageLabel[moveStorage] }}</button>
          <button v-for="item in moveFolders" :key="item.id" v-hover class="vk-row move-folder" :aria-pressed="moveId === item.id"
            :style="{ paddingLeft: 16 + treeDepth(item) * 12 + 'px' }" @click="moveId = item.id">
            <FileGlyph kind="folder" />{{ item.name }}
          </button>
          <button v-hover class="vk-button primary move-confirm" @click="moveItems(selected, moveId, moveStorage)">Move here</button>
        </template>
      </section>
    </div>
    <div v-if="message" class="file-notice vk-sheet" role="status">{{ message }}</div>
    <span class="sr-only" aria-live="polite">{{ location === 'Recently Deleted' ? deletedCount + ' deleted files' : shown.length + ' files shown' }}</span>
  </div>
</template>

<style scoped src="./files/Files.css"></style>
