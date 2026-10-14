<script setup lang="ts">
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import ItemArt from './freeform/ItemArt.vue';
import ControlIcon from './freeform/ControlIcon.vue';
import { boardPhotos, boardSvg, bounds, clone, connector, makeItem, palette, readBoards, seed, shapes, textLines, uid } from './freeform/model';
import type { Board, Item, Point, Shape } from './freeform/model';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type Tool = 'select' | 'marquee' | 'hand' | 'pen' | 'marker' | 'eraser' | 'sticky' | 'shape' | 'text' | 'connector';
type Drag = {
  kind: 'pan' | 'move' | 'draw' | 'marquee' | 'resize' | 'rotate' | 'erase';
  pointer: number;
  start: Point;
  world: Point;
  pan: Point;
  before: Item[];
  id?: string;
};
const tools: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'hand', label: 'Pan' },
  { id: 'marquee', label: 'Marquee' },
  { id: 'pen', label: 'Pen' },
  { id: 'marker', label: 'Marker' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'sticky', label: 'Sticky note' },
  { id: 'shape', label: 'Shape' },
  { id: 'text', label: 'Text box' },
  { id: 'connector', label: 'Connector' },
];
const boards = ref<Board[]>([seed()]);
const activeId = ref(boards.value[0]?.id ?? '');
const current = computed(() => boards.value.find(board => board.id === activeId.value));
const items = computed(() => current.value?.items ?? []);
const selected = ref<string[]>([]);
const selection = computed(() => items.value.filter(item => selected.value.includes(item.id)));
const firstSelected = computed(() => selection.value[0]);
const visibleItems = computed(() => items.value.filter(item => item.kind !== 'connector'));
const links = computed(() => items.value.filter(item => item.kind === 'connector'));
const area = ref<HTMLElement | null>(null);
const rootElement = ref<HTMLElement | null>(null);
const editField = ref<HTMLTextAreaElement | null>(null);
const tool = ref<Tool>('select');
const shape = ref<Shape>('rectangle');
const color = ref('#f5d887');
const thickness = ref(4);
const zoom = ref(1);
const pan = ref<Point>({ x: 0, y: 0 });
const marquee = ref<{ x: number; y: number; w: number; h: number } | null>(null);
const linkStart = ref<string | null>(null);
const popup = ref<'boards' | 'inspector' | 'shape' | 'help' | 'rename' | 'edit' | 'photos' | null>(null);
const editText = ref('');
const boardName = ref('');
const status = ref('A board for beautifully unfinished thinking.');
const exporting = ref(false);
const photoAbort = new AbortController();
const canvasSize = ref({ w: 0, h: 0 });
const miniBounds = computed(() => bounds(items.value));
const miniViewport = computed(() => ({ x: -pan.value.x / zoom.value, y: -pan.value.y / zoom.value,
  w: canvasSize.value.w / zoom.value, h: canvasSize.value.h / zoom.value }));
function addPhoto(src: string, name: string): void {
  const point = worldPoint({ x: canvasSize.value.w / 2, y: canvasSize.value.h / 2 });
  const item = { ...makeItem('photo', point.x - 140, point.y - 109, '#eef9f4'), w: 280, h: 218, src, text: name };
  change(() => current.value?.items.push(item));
  selected.value = [item.id]; popup.value = null;
}
function miniNavigate(event: MouseEvent): void {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const world = miniBounds.value;
  const x = world.x + (event.clientX - box.left) / box.width * world.w;
  const y = world.y + (event.clientY - box.top) / box.height * world.h;
  pan.value = { x: canvasSize.value.w / 2 - x * zoom.value, y: canvasSize.value.h / 2 - y * zoom.value };
}
async function embeddedPhotos(snapshot: Item[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all([...new Set(snapshot.flatMap(item => item.src ? [item.src] : []))].map(async src => {
    const response = await fetch(src, { signal: photoAbort.signal });
    if (!response.ok) throw new Error('Photo unavailable');
    const blob = await response.blob();
    result[src] = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Photo unavailable'));
      reader.onerror = () => reject(new Error('Photo unavailable')); reader.readAsDataURL(blob);
    });
  }));
  return result;
}
const undoVersion = ref(0);
const history = new Map<string, { undo: Item[][]; redo: Item[][] }>();
const pointers = new Map<number, Point>();
let drag: Drag | null = null;
let pinch: { distance: number; zoom: number; world: Point } | null = null;
let observer: ResizeObserver | undefined;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
let exportImage: HTMLImageElement | undefined;
const urls = new Set<string>();
const exportTimers = new Set<ReturnType<typeof setTimeout>>();
let lastFocus: HTMLElement | null = null;
watch(popup, async (value, previous) => {
  if (value) {
    if (!previous) lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    await nextTick();
    if (!disposed) rootElement.value?.querySelector<HTMLElement>('.popover input, .popover textarea, .popover button')?.focus();
  } else if (!disposed) {
    if (lastFocus?.isConnected) lastFocus.focus();
    else area.value?.focus();
  }
});
function panelKeys(event: KeyboardEvent): void {
  const panel = event.currentTarget as HTMLElement;
  const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea'));
  const index = controls.indexOf(document.activeElement as HTMLElement);
  if (event.key === 'Tab' && controls.length) {
    if ((event.shiftKey && index <= 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
    }
  }
  if (event.target instanceof HTMLButtonElement && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const offset = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
    controls[(index + offset + controls.length) % controls.length]?.focus();
  }
}
const undoCount = computed(() => {
  void undoVersion.value;
  return history.get(activeId.value)?.undo.length ?? 0;
});
const redoCount = computed(() => {
  void undoVersion.value;
  return history.get(activeId.value)?.redo.length ?? 0;
});
const toolHint = computed(() => {
  if (tool.value === 'connector') return linkStart.value ? 'Choose the destination item.' : 'Choose two items to connect.';
  if (tool.value === 'sticky' || tool.value === 'text' || tool.value === 'shape') return 'Tap the canvas to place an item.';
  if (tool.value === 'marquee') return 'Drag around items to select them together.';
  if (tool.value === 'eraser') return 'Drag across ink or tap an item to erase it.';
  return 'Drag empty space to pan. Shift-drag to select. Ctrl + wheel to zoom.';
});
function announce(text: string): void {
  status.value = text;
  vision?.toast(text);
}
function checkpoint(before: Item[]): void {
  if (JSON.stringify(before) === JSON.stringify(items.value)) return;
  const stack = history.get(activeId.value) ?? { undo: [], redo: [] };
  stack.undo.push(before);
  if (stack.undo.length > 60) stack.undo.shift();
  stack.redo = [];
  history.set(activeId.value, stack);
  undoVersion.value++;
}
function change(action: () => void): void {
  if (drag || pinch) return;
  const before = clone(items.value);
  action();
  checkpoint(before);
}
function undo(redo = false): void {
  if (drag || pinch || !current.value) return;
  const stack = history.get(activeId.value);
  const next = (redo ? stack?.redo : stack?.undo)?.pop();
  if (!next || !stack) return;
  (redo ? stack.undo : stack.redo).push(clone(items.value));
  current.value.items = next;
  selected.value = selected.value.filter(id => next.some(item => item.id === id));
  undoVersion.value++;
}
function persist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    localStorage.setItem('lab-vision-freeform', JSON.stringify(boards.value));
  } catch {
    if (!disposed) announce('Board stays here for this session. Browser storage is unavailable.');
  }
}
watch(boards, () => {
  if (disposed) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 400);
}, { deep: true });
function localPoint(clientX: number, clientY: number): Point {
  const element = area.value;
  const rect = element?.getBoundingClientRect();
  if (!element || !rect) return { x: 0, y: 0 };
  return {
    x: (clientX - rect.left) * element.clientWidth / (rect.width || 1),
    y: (clientY - rect.top) * element.clientHeight / (rect.height || 1),
  };
}
function worldPoint(point: Point): Point {
  return { x: (point.x - pan.value.x) / zoom.value, y: (point.y - pan.value.y) / zoom.value };
}
function zoomAt(next: number, point?: Point): void {
  const anchor = point ?? { x: (area.value?.clientWidth ?? 0) / 2, y: (area.value?.clientHeight ?? 0) / 2 };
  const world = worldPoint(anchor);
  zoom.value = Math.max(.15, Math.min(4, next));
  pan.value = { x: anchor.x - world.x * zoom.value, y: anchor.y - world.y * zoom.value };
}
function fit(): void {
  if (disposed || !area.value) return;
  const box = bounds(items.value);
  zoom.value = Math.max(.15, Math.min(1.5, (area.value.clientWidth - 40) / box.w, (area.value.clientHeight - 40) / box.h));
  pan.value = {
    x: (area.value.clientWidth - box.w * zoom.value) / 2 - box.x * zoom.value,
    y: (area.value.clientHeight - box.h * zoom.value) / 2 - box.y * zoom.value,
  };
}
function wheel(event: WheelEvent): void {
  if (drag) return;
  if (event.ctrlKey || event.metaKey) {
    zoomAt(zoom.value * Math.exp(-event.deltaY * .006), localPoint(event.clientX, event.clientY));
  } else {
    const factor = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? (area.value?.clientHeight ?? 300) : 1;
    pan.value = { x: pan.value.x - event.deltaX * factor, y: pan.value.y - event.deltaY * factor };
  }
}
function pickTool(next: Tool): void {
  tool.value = next;
  linkStart.value = null;
  popup.value = next === 'shape' ? 'shape' : null;
}
function createAt(point: Point): void {
  if (!current.value) return;
  const kind = tool.value === 'shape' ? shape.value : tool.value === 'text' ? 'text' : 'sticky';
  const item = makeItem(kind, point.x - 90, point.y - 70, color.value);
  item.text = kind === 'sticky' ? 'A small, suspicious idea' : kind === 'text' ? 'New thought' : '';
  if (kind === 'line' || kind === 'arrow') item.h = 85;
  change(() => current.value?.items.push(item));
  selected.value = [item.id];
  tool.value = 'select';
  if (kind === 'sticky' || kind === 'text') openEditor();
}
function removeSelection(): void {
  const ids = new Set(selected.value);
  change(() => {
    if (current.value) {
      current.value.items = items.value.filter(item => !ids.has(item.id) && !ids.has(item.from ?? '') && !ids.has(item.to ?? ''));
    }
  });
  selected.value = [];
  popup.value = null;
}
function duplicate(): void {
  const originals = items.value.filter(item => selected.value.includes(item.id)
    || (item.kind === 'connector' && selected.value.includes(item.from ?? '') && selected.value.includes(item.to ?? '')));
  const copies = originals.map(item => ({ ...clone(item), id: uid(), x: item.x + 28, y: item.y + 28 }));
  const remap = new Map(originals.map((item, index) => [item.id, copies[index]?.id ?? item.id]));
  for (const item of copies) {
    if (item.from) item.from = remap.get(item.from) ?? item.from;
    if (item.to) item.to = remap.get(item.to) ?? item.to;
  }
  change(() => current.value?.items.push(...copies));
  selected.value = copies.map(item => item.id);
}
function layer(front: boolean): void {
  change(() => {
    if (!current.value) return;
    const chosen = selection.value;
    const rest = items.value.filter(item => !selected.value.includes(item.id));
    current.value.items = front ? [...rest, ...chosen] : [...chosen, ...rest];
  });
}
function recolor(value: string): void {
  color.value = value;
  change(() => { for (const item of selection.value) item.color = value; });
}
function openEditor(): void {
  const item = firstSelected.value;
  if (!item || ['stroke', 'marker', 'connector', 'line', 'arrow'].includes(item.kind)) return;
  editText.value = item.text;
  popup.value = 'edit';
  void nextTick(() => editField.value?.focus());
}
function commitText(): void {
  change(() => {
    const item = firstSelected.value;
    if (!item) return;
    item.text = editText.value.slice(0, 400);
    item.h = Math.max(item.h, textLines(item.text, item.w - 24).length * 25 + 50);
  });
  popup.value = null;
}
function capture(event: PointerEvent): void {
  try { area.value?.setPointerCapture(event.pointerId); } catch { /* A cancelled touch may already be gone. */ }
}
function begin(event: PointerEvent, id?: string, kind?: 'resize' | 'rotate'): void {
  if (event.button !== 0 || popup.value) return;
  const point = localPoint(event.clientX, event.clientY);
  pointers.set(event.pointerId, point);
  capture(event);
  if (pointers.size >= 2) {
    if (drag && current.value) current.value.items = drag.before;
    drag = null;
    marquee.value = null;
    const pair = [...pointers.values()];
    const a = pair[0], b = pair[1];
    if (a && b) {
      pinch = {
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom: zoom.value,
        world: worldPoint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }),
      };
    }
    return;
  }
  const world = worldPoint(point);
  if (tool.value === 'connector' && id) {
    if (!linkStart.value) {
      linkStart.value = id;
      selected.value = [id];
    } else if (linkStart.value !== id) {
      const link = { ...makeItem('connector', 0, 0, color.value), from: linkStart.value, to: id };
      change(() => current.value?.items.push(link));
      selected.value = [link.id];
      linkStart.value = null;
      announce('Connected. Moving either item keeps the thought attached.');
    }
    return;
  }
  if (['sticky', 'shape', 'text'].includes(tool.value)) {
    createAt(world);
    return;
  }
  const before = clone(items.value);
  let mode: Drag['kind'] = 'pan';
  if (kind) mode = kind;
  else if (tool.value === 'pen' || tool.value === 'marker') {
    const item = makeItem(tool.value === 'marker' ? 'marker' : 'stroke', world.x, world.y, color.value);
    item.w = 1; item.h = 1;
    item.thickness = tool.value === 'marker' ? thickness.value * 4 : thickness.value;
    item.points = [{ x: 0, y: 0 }];
    current.value?.items.push(item);
    id = item.id;
    mode = 'draw';
    selected.value = [];
  } else if (tool.value === 'eraser') {
    mode = 'erase';
    eraseAt(world, id);
  } else if (tool.value === 'marquee' || (event.shiftKey && !id)) {
    mode = 'marquee';
    if (!event.shiftKey) selected.value = [];
    marquee.value = { x: world.x, y: world.y, w: 0, h: 0 };
  } else if (id && tool.value !== 'hand') {
    if (event.shiftKey) {
      selected.value = selected.value.includes(id) ? selected.value.filter(value => value !== id) : [...selected.value, id];
    } else if (!selected.value.includes(id)) selected.value = [id];
    mode = 'move';
  } else if (!event.shiftKey) selected.value = [];
  drag = { kind: mode, pointer: event.pointerId, start: point, world, pan: { ...pan.value }, before, id };
  area.value?.focus({ preventScroll: true });
}
function eraseAt(point: Point, id?: string): void {
  if (!current.value) return;
  const erased = items.value.filter(item => item.id === id || (
    (item.kind === 'stroke' || item.kind === 'marker')
    && item.points.some(p => Math.hypot(item.x + p.x - point.x, item.y + p.y - point.y) < thickness.value * 3 + 10 / zoom.value)
  )).map(item => item.id);
  current.value.items = items.value.filter(item => !erased.includes(item.id)
    && !erased.includes(item.from ?? '') && !erased.includes(item.to ?? ''));
}
function move(event: PointerEvent): void {
  const point = localPoint(event.clientX, event.clientY);
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, point);
  if (pinch) {
    const [a, b] = [...pointers.values()];
    if (a && b) {
      zoom.value = Math.max(.15, Math.min(4, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance));
      pan.value = { x: (a.x + b.x) / 2 - pinch.world.x * zoom.value, y: (a.y + b.y) / 2 - pinch.world.y * zoom.value };
    }
    return;
  }
  if (!drag || event.pointerId !== drag.pointer) return;
  const world = worldPoint(point);
  const dx = world.x - drag.world.x, dy = world.y - drag.world.y;
  const item = items.value.find(value => value.id === drag?.id);
  const original = drag.before.find(value => value.id === drag?.id);
  if (drag.kind === 'pan') {
    pan.value = { x: drag.pan.x + point.x - drag.start.x, y: drag.pan.y + point.y - drag.start.y };
  } else if (drag.kind === 'move') {
    for (const selectedItem of selection.value) {
      const prior = drag.before.find(value => value.id === selectedItem.id);
      if (prior) { selectedItem.x = prior.x + dx; selectedItem.y = prior.y + dy; }
    }
  } else if (drag.kind === 'resize' && item && original) {
    const angle = -original.rotation * Math.PI / 180;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
    item.w = Math.max(60, original.w + rx);
    item.h = Math.max(50, original.h + ry);
    // Keep the opposite rotated corner stationary.
    const dw = item.w - original.w, dh = item.h - original.h;
    item.x = original.x + (dw * Math.cos(-angle) - dh * Math.sin(-angle) - dw) / 2;
    item.y = original.y + (dw * Math.sin(-angle) + dh * Math.cos(-angle) - dh) / 2;
    if (item.kind === 'stroke' || item.kind === 'marker') {
      item.points = original.points.map(p => ({ x: p.x * item.w / original.w, y: p.y * item.h / original.h }));
    }
  } else if (drag.kind === 'rotate' && item && original) {
    const center = { x: original.x + original.w / 2, y: original.y + original.h / 2 };
    const start = Math.atan2(drag.world.y - center.y, drag.world.x - center.x);
    const next = Math.atan2(world.y - center.y, world.x - center.x);
    item.rotation = original.rotation + (next - start) * 180 / Math.PI;
    if (event.shiftKey) item.rotation = Math.round(item.rotation / 15) * 15;
  } else if (drag.kind === 'draw' && item) {
    const previous = item.points[item.points.length - 1];
    const next = { x: world.x - item.x, y: world.y - item.y };
    if (!previous || Math.hypot(next.x - previous.x, next.y - previous.y) > 1 / zoom.value) item.points.push(next);
  } else if (drag.kind === 'erase') eraseAt(world);
  else if (drag.kind === 'marquee') {
    marquee.value = { x: Math.min(world.x, drag.world.x), y: Math.min(world.y, drag.world.y), w: Math.abs(dx), h: Math.abs(dy) };
  }
}
function end(event: PointerEvent): void {
  pointers.delete(event.pointerId);
  if (pinch) {
    pinch = null;
    drag = null;
    pointers.clear();
    return;
  }
  if (!drag || event.pointerId !== drag.pointer) return;
  if (event.type === 'pointercancel') {
    if (current.value) current.value.items = drag.before;
  } else {
    if (drag.kind === 'draw') {
      const item = items.value.find(value => value.id === drag?.id);
      if (item) {
        const xs = item.points.map(p => p.x), ys = item.points.map(p => p.y);
        const minX = Math.min(...xs) - item.thickness, minY = Math.min(...ys) - item.thickness;
        item.x += minX; item.y += minY;
        item.w = Math.max(1, Math.max(...xs) - minX + item.thickness);
        item.h = Math.max(1, Math.max(...ys) - minY + item.thickness);
        item.points = item.points.map(p => ({ x: p.x - minX, y: p.y - minY }));
      }
    }
    if (drag.kind === 'marquee' && marquee.value) {
      const box = marquee.value;
      selected.value = [...new Set([...selected.value, ...visibleItems.value.filter(item =>
        item.x < box.x + box.w && item.x + item.w > box.x && item.y < box.y + box.h && item.y + item.h > box.y
      ).map(item => item.id)])];
    }
    checkpoint(drag.before);
  }
  drag = null;
  marquee.value = null;
  try { if (area.value?.hasPointerCapture(event.pointerId)) area.value.releasePointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
}
function keyboard(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || popup.value) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && event.key.toLowerCase() === 'z') {
    event.preventDefault(); undo(event.shiftKey); return;
  }
  if (modifier && event.key.toLowerCase() === 'a') {
    event.preventDefault(); selected.value = items.value.map(item => item.id); return;
  }
  if (modifier && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicate(); return; }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelection(); return; }
  const directions: Record<string, Point> = {
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
  };
  const direction = directions[event.key];
  if (direction) {
    event.preventDefault();
    const amount = event.shiftKey ? 20 : 5;
    if (selected.value.length) {
      change(() => { for (const item of selection.value) { item.x += direction.x * amount; item.y += direction.y * amount; } });
    } else pan.value = { x: pan.value.x - direction.x * 30, y: pan.value.y - direction.y * 30 };
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target === area.value) {
    event.preventDefault();
    if (firstSelected.value) openEditor();
    else if (['sticky', 'shape', 'text'].includes(tool.value)) {
      createAt(worldPoint({ x: (area.value?.clientWidth ?? 0) / 2, y: (area.value?.clientHeight ?? 0) / 2 }));
    } else {
      const item = visibleItems.value[0];
      if (item) selected.value = [item.id];
    }
  }
}
function newBoard(): void {
  if (boards.value.length >= 50) { announce('Fifty boards is a respectable backlog. Rename an existing one.'); return; }
  const board: Board = { id: uid(), name: 'Untitled thought ' + (boards.value.length + 1), items: [] };
  boards.value.push(board);
  chooseBoard(board.id);
}
function chooseBoard(id: string): void {
  activeId.value = id;
  selected.value = [];
  linkStart.value = null;
  popup.value = null;
  void nextTick(fit);
}
function rename(): void {
  boardName.value = current.value?.name ?? '';
  popup.value = 'rename';
}
function commitRename(): void {
  if (current.value) current.value.name = boardName.value.trim().slice(0, 100) || 'Untitled thought';
  popup.value = null;
}
function thumbnail(board: Board): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(boardSvg(board.items));
}
async function exportPng(): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const snapshot = clone(items.value);
    const name = current.value?.name ?? 'Freeform';
    const photos = await embeddedPhotos(snapshot);
    if (disposed) return;
    const svg = boardSvg(snapshot, photos);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    urls.add(url);
    const image = new Image();
    exportImage = image;
    image.onload = () => {
      if (disposed) return;
      try {
        const box = bounds(snapshot);
        const scale = Math.min(2, 4096 / Math.max(box.w, box.h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(box.w * scale);
        canvas.height = Math.ceil(box.h * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (disposed) return;
          if (!blob) { finishExport('PNG could not be created. The board is still safe.'); return; }
          const download = URL.createObjectURL(blob);
          urls.add(download);
          const anchor = document.createElement('a');
          anchor.href = download;
          anchor.download = name + '.png';
          anchor.click();
          const timer = setTimeout(() => { URL.revokeObjectURL(download); urls.delete(download); exportTimers.delete(timer); }, 1000);
          exportTimers.add(timer);
          finishExport('Board exported as PNG.');
        }, 'image/png');
      } catch { finishExport('PNG export is unavailable in this browser. Your board is still safe.'); }
      URL.revokeObjectURL(url);
      urls.delete(url);
      image.onload = null;
      image.onerror = null;
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      urls.delete(url);
      finishExport('PNG export is unavailable. Your board is still safe.');
    };
    image.src = url;
  } catch { finishExport('PNG export is unavailable. Your board is still safe.'); }
}
function finishExport(message: string): void {
  if (disposed) return;
  exporting.value = false;
  announce(message);
}
function selectionStyle(item: Item): Record<string, string> {
  return {
    left: item.x + 'px', top: item.y + 'px', width: item.w + 'px', height: item.h + 'px',
    transform: 'rotate(' + item.rotation + 'deg)', '--inverse-zoom': String(1 / zoom.value),
  };
}
function itemKey(event: KeyboardEvent, item: Item): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    if (tool.value === 'connector') {
      if (linkStart.value && linkStart.value !== item.id) {
        const link = { ...makeItem('connector', 0, 0, color.value), from: linkStart.value, to: item.id };
        change(() => current.value?.items.push(link)); linkStart.value = null;
      } else linkStart.value = item.id;
    } else {
      selected.value = event.shiftKey ? [...new Set([...selected.value, item.id])] : [item.id];
      if (event.key === 'Enter') openEditor();
    }
  }
}
onMounted(() => {
  try {
    const stored = localStorage.getItem('lab-vision-freeform');
    const restored = stored ? readBoards(JSON.parse(stored) as unknown) : null;
    if (restored) { boards.value = restored; activeId.value = restored[0]?.id ?? activeId.value; }
  } catch { announce('Storage is unavailable. This canvas still works for the session.'); }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      canvasSize.value = { w: area.value?.clientWidth ?? 0, h: area.value?.clientHeight ?? 0 };
      if (!drag && !pinch) fit();
    });
    if (area.value) observer.observe(area.value);
  }
  fit();
});
onBeforeUnmount(() => {
  disposed = true;
  photoAbort.abort();
  if (saveTimer) clearTimeout(saveTimer);
  // Flush edits on close rather than losing the last debounce.
  persist();
  observer?.disconnect();
  if (exportImage) { exportImage.onload = null; exportImage.onerror = null; exportImage.src = ''; }
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
  for (const timer of exportTimers) clearTimeout(timer);
  exportTimers.clear();
  for (const id of pointers.keys()) {
    try { if (area.value?.hasPointerCapture(id)) area.value.releasePointerCapture(id); } catch { /* The node may already be detached. */ }
  }
  pointers.clear();
  drag = null;
  pinch = null;
});
</script>

<template>
  <section ref="rootElement" class="freeform-app" @keydown="keyboard">
    <div class="layout" :inert="popup ? true : undefined">
      <nav class="vk-tabbar rail" aria-label="Freeform views">
        <button v-hover class="vk-icon large" :aria-pressed="popup === 'boards'" aria-label="Boards"
          @click="popup = popup === 'boards' ? null : 'boards'"><ControlIcon name="grid" /><span class="rail-label">Boards</span></button>
        <button v-hover class="vk-icon large" aria-label="Canvas" :aria-pressed="popup !== 'boards'" @click="popup = null">
          <ControlIcon name="pen" /><span class="rail-label">Canvas</span>
        </button>
      </nav>
      <main class="workspace">
        <header class="heading">
          <div class="titles">
            <p class="eyebrow vk-footnote">FREEFORM <span class="board-local">Personal board · {{ visibleItems.length }} items</span></p>
            <button v-hover class="board-title" aria-label="Rename board" @click="rename">{{ current?.name }}</button>
          </div>
          <button v-hover class="vk-icon" aria-label="Help and keyboard shortcuts" @click="popup = 'help'"><ControlIcon name="help" /></button>
          <button v-hover class="vk-icon" aria-label="Export board as PNG" :disabled="exporting" @click="exportPng">
            <ControlIcon :name="exporting ? 'more' : 'export'" />
          </button>
        </header>
        <div ref="area" class="canvas vk-well" tabindex="0" aria-label="Infinite canvas. Arrow keys move selections or pan. Shift drag selects."
          :class="{ drawing: tool === 'pen' || tool === 'marker', panning: tool === 'hand' }"
          :style="{ backgroundPosition: pan.x + 'px ' + pan.y + 'px', backgroundSize: 24 * zoom + 'px ' + 24 * zoom + 'px' }"
          @pointerdown.self="begin($event)" @pointermove="move" @pointerup="end" @pointercancel="end" @lostpointercapture="end"
          @wheel.prevent.stop="wheel">
          <div class="world" :style="{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')' }">
            <svg class="connections" overflow="visible" aria-hidden="true">
              <path v-for="link in links" :key="link.id" :d="connector(link, items).path" :stroke="link.color" fill="none" stroke-width="3" opacity=".6" />
              <rect v-if="marquee" :x="marquee.x" :y="marquee.y" :width="marquee.w" :height="marquee.h"
                fill="#72b7ff33" stroke="#a7d3ff" :stroke-width="1 / zoom" />
            </svg>
            <button v-for="item in visibleItems" :key="item.id" v-hover class="board-item"
              :class="{ chosen: selected.includes(item.id), paper: item.kind === 'sticky' }"
              :style="selectionStyle(item)" :aria-label="item.kind + ': ' + (item.text || 'Untitled')"
              :aria-pressed="selected.includes(item.id)" @pointerdown.stop="begin($event, item.id)"
              @keydown="itemKey($event, item)" @dblclick="selected = [item.id]; openEditor()">
              <ItemArt :item="item" />
            </button>
            <div v-for="item in selection.filter(value => value.kind !== 'connector')" :key="'handles-' + item.id"
              class="selection-frame" :style="selectionStyle(item)">
              <button v-hover class="handle resize vk-icon" aria-label="Resize selected item"
                @pointerdown.stop="begin($event, item.id, 'resize')"
                @keydown.right.prevent.stop="change(() => { item.w += 10 })"
                @keydown.left.prevent.stop="change(() => { item.w = Math.max(60, item.w - 10) })"
                @keydown.up.prevent.stop="change(() => { item.h = Math.max(50, item.h - 10) })"
                @keydown.down.prevent.stop="change(() => { item.h += 10 })"><ControlIcon name="resize" /></button>
              <button v-hover class="handle rotate vk-icon" aria-label="Rotate selected item; arrows rotate by 15 degrees"
                @pointerdown.stop="begin($event, item.id, 'rotate')"
                @keydown.left.prevent.stop="change(() => { item.rotation -= 15 })"
                @keydown.right.prevent.stop="change(() => { item.rotation += 15 })"><ControlIcon name="redo" /></button>
            </div>
          </div>
          <button v-if="visibleItems.length" class="minimap vk-platter" aria-label="Canvas overview. Click to navigate; Enter fits the board." @pointerdown.stop @click.stop="miniNavigate" @keydown.enter.prevent="fit">
            <svg :viewBox="miniBounds.x + ' ' + miniBounds.y + ' ' + miniBounds.w + ' ' + miniBounds.h" preserveAspectRatio="none" aria-hidden="true">
              <rect v-for="item in visibleItems" :key="item.id" :x="item.x" :y="item.y" :width="item.w" :height="item.h" :fill="item.color" rx="8" opacity=".65" />
              <rect :x="miniViewport.x" :y="miniViewport.y" :width="miniViewport.w" :height="miniViewport.h" fill="#ffffff12" stroke="#91caff" stroke-width="8" />
            </svg><span>Overview</span>
          </button>
          <p v-if="!visibleItems.length" class="empty vk-secondary">An excellent place to overthink a small idea.<br />Choose a note, shape or pen below.</p>
        </div>
        <div class="contextbar">
          <span class="hint vk-footnote vk-secondary">{{ selected.length ? selected.length + ' selected' : toolHint }}</span>
          <button v-hover class="vk-icon" aria-label="Zoom out" @click="zoomAt(zoom / 1.2)"><ControlIcon name="minus" /></button>
          <button v-hover class="vk-button fit" aria-label="Fit board to window" @click="fit">{{ Math.round(zoom * 100) }}%</button>
          <button v-hover class="vk-icon" aria-label="Zoom in" @click="zoomAt(zoom * 1.2)"><ControlIcon name="plus" /></button>
          <button v-hover class="vk-icon" :disabled="!undoCount" aria-label="Undo" @click="undo()"><ControlIcon name="undo" /></button>
          <button v-hover class="vk-icon" :disabled="!redoCount" aria-label="Redo" @click="undo(true)"><ControlIcon name="redo" /></button>
          <button v-hover class="vk-icon" aria-label="Style and selection actions" :aria-pressed="popup === 'inspector'"
            @click="popup = popup === 'inspector' ? null : 'inspector'"><ControlIcon name="style" /></button>
        </div>
        <footer class="toolbar vk-ornament vk-scroll" aria-label="Canvas tools">
          <button v-for="entry in tools" :key="entry.id" v-hover class="vk-icon large"
            :aria-pressed="tool === entry.id" :aria-label="entry.label" :title="entry.label" @click="pickTool(entry.id)">
            <ControlIcon :name="entry.id === 'shape' ? 'rectangle' : entry.id" /><span class="tool-label">{{ entry.label }}</span>
          </button>
          <button v-hover class="vk-icon large" aria-label="Add a photo" title="Add a photo" @click="popup = 'photos'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="2" /><path d="m3 17 5-5 4 4 4-6 5 7" /></svg><span class="tool-label">Photo</span>
          </button>
        </footer>
      </main>
    </div>

    <div v-if="popup" class="overlay" @click.self="popup = null" @keydown.esc.stop.prevent="popup = null">
      <section class="popover vk-sheet vk-scroll" @keydown="panelKeys" role="dialog" aria-modal="true" :aria-label="popup === 'boards' ? 'Boards' : 'Canvas options'">
        <header class="sheet-heading">
          <h2 class="vk-title">{{ { boards: 'Your boards', inspector: 'Style & selection', shape: 'Choose a shape',
            help: 'A little room to think', rename: 'Rename board', edit: 'Edit thought', photos: 'Add a little inspiration' }[popup] }}</h2>
          <button v-hover class="vk-icon" aria-label="Close panel" @click="popup = null"><ControlIcon name="close" /></button>
        </header>
        <template v-if="popup === 'photos'">
          <p class="vk-footnote vk-secondary">A small collection of CC0 photographs. Added to this board only.</p>
          <div class="photo-picker"><button v-for="photo in boardPhotos" :key="photo.src" v-hover class="vk-platter" @click="addPhoto(photo.src, photo.name)"><img :src="photo.src" :alt="photo.name" loading="lazy" /><span>{{ photo.name }}</span></button></div>
        </template>
        <template v-else-if="popup === 'boards'">
          <p class="vk-secondary vk-footnote">Saved in this browser. No account, no committee.</p>
          <div class="board-browser">
            <button v-for="entry in boards" :key="entry.id" v-hover class="vk-platter board-card" :aria-pressed="entry.id === activeId"
              @click="chooseBoard(entry.id)">
              <img :src="thumbnail(entry)" alt="" /><strong>{{ entry.name }}</strong><span class="vk-footnote">{{ entry.items.length }} ideas and marks</span>
            </button>
          </div>
          <button v-hover class="vk-button primary primary-action" @click="newBoard"><ControlIcon name="plus" /> New board</button>
        </template>
        <template v-else-if="popup === 'shape'">
          <div class="shape-grid">
            <button v-for="entry in shapes" :key="entry" v-hover class="vk-row vk-platter" :aria-pressed="shape === entry"
              @click="shape = entry; popup = null"><ControlIcon :name="entry" /> {{ entry }}</button>
          </div>
          <p class="vk-secondary vk-footnote">Then tap anywhere on the board. Enter places it at the centre.</p>
        </template>
        <template v-else-if="popup === 'inspector'">
          <p class="vk-footnote vk-secondary">Applies to selected items and the next mark.</p>
          <div class="swatches">
            <button v-for="(swatch, index) in palette" :key="swatch" v-hover class="vk-icon"
              :aria-label="['Pearl', 'Coral', 'Gold', 'Mint', 'Blue', 'Lilac'][index]" :aria-pressed="color === swatch" @click="recolor(swatch)">
              <span :style="{ background: swatch }" />
            </button>
          </div>
          <label class="stroke-label">Stroke width <output>{{ thickness }} px</output>
            <input v-model.number="thickness" v-hover class="vk-slider" type="range" min="1" max="14" :style="{ '--value': (thickness - 1) / 13 }" />
          </label>
          <div v-if="selection.length" class="actions">
            <button v-hover class="vk-button" @click="openEditor"
              :disabled="!firstSelected || ['stroke', 'marker', 'connector', 'line', 'arrow'].includes(firstSelected.kind)">Edit text</button>
            <button v-hover class="vk-button" @click="duplicate">Duplicate</button>
            <button v-hover class="vk-button" @click="layer(true)">Bring forward</button>
            <button v-hover class="vk-button" @click="layer(false)">Send backward</button>
            <button v-hover class="vk-button" @click="change(() => { for (const item of selection) item.rotation += 15 })">Rotate 15°</button>
            <button v-hover class="vk-button destructive" @click="removeSelection">Delete selected</button>
          </div>
          <div v-if="links.length" class="link-list">
            <p class="vk-footnote vk-secondary">Connections</p>
            <button v-for="link in links" :key="link.id" v-hover class="vk-row" @click="selected = [link.id]"
              :aria-pressed="selected.includes(link.id)">
              <ControlIcon name="connector" /> {{ items.find(item => item.id === link.from)?.text || 'Item' }} → {{ items.find(item => item.id === link.to)?.text || 'Item' }}
            </button>
          </div>
        </template>
        <template v-else-if="popup === 'help'">
          <p>Drag empty space to pan. Use two fingers or the wheel to explore, and pinch or Ctrl + wheel to zoom at your pointer.</p>
          <p>Choose Select to move items. Shift-click adds to a selection. Shift-drag or Marquee selects several items.</p>
          <p>Selected items have resize and rotation handles. Double-click a note to edit it. Connect two items to keep their thoughts attached.</p>
          <p>Arrow keys move selections. Enter edits a selected note. Ctrl + A selects all, Ctrl + D duplicates, Delete removes.
            Ctrl + Z undoes and Ctrl + Shift + Z redoes.</p>
          <p class="vk-footnote vk-secondary">Use Tab to reach every item and tool. Your ideas never leave this browser.</p>
        </template>
        <form v-else-if="popup === 'rename'" @submit.prevent="commitRename">
          <label>Board name<input v-model="boardName" v-hover class="vk-field" maxlength="100" autofocus /></label>
          <button v-hover class="vk-button primary primary-action" type="submit">Save name</button>
        </form>
        <form v-else-if="popup === 'edit'" @submit.prevent="commitText">
          <label>Your thought<textarea ref="editField" v-model="editText" v-hover class="vk-field" maxlength="400" rows="4" /></label>
          <button v-hover class="vk-button primary primary-action" type="submit">Done thinking</button>
        </form>
      </section>
    </div>
    <span class="sr-only" role="status">{{ status }}</span>
  </section>
</template>

<style scoped src="./freeform/freeform.css"></style>
