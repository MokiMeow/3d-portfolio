<script setup lang="ts">
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import MacFinder from './mac/Finder.vue';
import UltrawideHero from './mac/UltrawideHero.vue';
import AppIcon from './music/AppIcon.vue';
import MacTerminal from './mac/Terminal.vue';
import MacEditor from './mac/Editor.vue';
import { MAC_APPS } from './mac/model';
import type { MacApp, DisplayMode } from './mac/model';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type DesktopWindow = {
  id: MacApp;
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
};
type Popover = 'system' | 'file' | 'edit' | 'view' | 'control' | 'spotlight' | null;
const root = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const desktop = ref<HTMLElement | null>(null);
const status = ref<'disconnected' | 'connecting' | 'connected'>('disconnected');
const mode = ref<DisplayMode>('Standard');
const modes: DisplayMode[] = ['Standard', 'Wide', 'Ultrawide'];
const focused = ref<MacApp>('finder');
const popover = ref<Popover>(null);
const mission = ref(false);
const query = ref('');
const spotlightField = ref<HTMLInputElement | null>(null);
const scratchpad = ref(
  'Things to fix: everything\n\nThe button that moves when you look at it.\n'
  + 'The bug that only appears during demos.\nThe chair. It knows what it did.\n\n'
  + 'Remember to drink the chai before it becomes iced chai.',
);
const now = ref(new Date());
const since = ref(Date.now());
const message = ref('');
const brightness = ref(1);
const wifi = ref(true);
const bluetooth = ref(true);
const quiet = ref(false);
const size = reactive({ width: 1080, height: 400 });
const narrow = computed(() => size.width < 620);
const dimensions = computed(() => {
  const height = Math.max(280, size.height);
  const width = mode.value === 'Standard' ? Math.max(280, size.width)
    : Math.max(size.width, height * (mode.value === 'Wide' ? 21 / 9 : 32 / 9));
  return { width, height };
});
const clock = computed(() => (vision?.now.value ?? now.value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
const date = computed(() => (vision?.now.value ?? now.value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
const seconds = computed(() => Math.max(0, Math.floor((now.value.getTime() - since.value) / 1000)));
const results = computed(() => MAC_APPS.filter(app => (app.name + ' ' + app.id).toLowerCase().includes(query.value.toLowerCase())));
const activeName = computed(() => MAC_APPS.find(app => app.id === focused.value)?.name ?? 'Finder');
const windows = reactive<DesktopWindow[]>(MAC_APPS.map((app, index) => ({
  id: app.id,
  open: app.id === 'finder' || app.id === 'editor',
  minimized: false,
  maximized: false,
  x: app.id === 'finder' ? 24 : 500 + index * 20,
  y: 58 + index * 8,
  width: app.id === 'notes' ? 440 : app.id === 'editor' ? 520 : 560,
  height: app.id === 'settings' ? 350 : 300,
  z: index + 1,
})));
let top = 10;
let connectionTimer: ReturnType<typeof setTimeout> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;
let messageTimer: ReturnType<typeof setTimeout> | undefined;
let observer: ResizeObserver | undefined;
let disposed = false;
let drag: {
  win: DesktopWindow; element: HTMLElement; pointer: number;
  x: number; y: number; left: number; upper: number; scaleX: number; scaleY: number;
} | null = null;

function notify(text: string): void {
  message.value = text;
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { message.value = ''; }, 3500);
}
function connect(): void {
  if (connectionTimer) clearTimeout(connectionTimer);
  status.value = 'connecting';
  connectionTimer = setTimeout(async () => {
    connectionTimer = undefined;
    if (disposed) return;
    status.value = 'connected';
    since.value = Date.now();
    await nextTick();
    if (!disposed) root.value?.focus();
  }, 1200);
}
function disconnect(): void {
  if (connectionTimer) clearTimeout(connectionTimer);
  connectionTimer = undefined;
  release();
  status.value = 'disconnected';
  popover.value = null;
  mission.value = false;
}
function clamp(win: DesktopWindow): void {
  win.x = Math.max(8, Math.min(dimensions.value.width - win.width - 8, win.x));
  win.y = Math.max(50, Math.min(dimensions.value.height - Math.min(win.height, dimensions.value.height - 64) - 12, win.y));
}
function reveal(id: MacApp): void {
  const win = windows.find(item => item.id === id);
  if (!win) return;
  win.open = true;
  win.minimized = false;
  win.z = ++top;
  focused.value = id;
  mission.value = false;
  popover.value = null;
  clamp(win);
  // Bring the selected window into view even on a narrow, scrollable desktop.
  if (frame.value) {
    frame.value.scrollLeft = Math.max(0, win.x - 20);
    frame.value.scrollTop = Math.max(0, win.y - 50);
  }
}
function focus(win: DesktopWindow): void {
  focused.value = win.id;
  if (win.z !== top) win.z = ++top;
}
function close(id: MacApp): void {
  const win = windows.find(item => item.id === id);
  if (win) win.open = false;
  const next = [...windows].filter(item => item.open && !item.minimized).sort((a, b) => b.z - a.z)[0];
  if (next) focused.value = next.id;
}
function maximize(win: DesktopWindow): void {
  win.maximized = !win.maximized;
  focus(win);
}
function windowStyle(win: DesktopWindow): Record<string, string | number> {
  if (narrow.value) {
    return {
      left: '8px', top: '50px', width: Math.max(264, size.width - 16) + 'px',
      height: Math.max(200, Math.min(dimensions.value.height - 62, size.height - 62)) + 'px', zIndex: win.z,
    };
  }
  return {
    left: win.maximized ? '12px' : win.x + 'px',
    top: win.maximized ? '50px' : win.y + 'px',
    width: win.maximized ? dimensions.value.width - 24 + 'px' : win.width + 'px',
    height: (win.maximized ? dimensions.value.height - 62 : Math.min(win.height, dimensions.value.height - 64)) + 'px',
    zIndex: win.z,
  };
}
function grab(event: PointerEvent, win: DesktopWindow): void {
  if (event.button !== 0 || narrow.value || win.maximized || !(event.currentTarget instanceof HTMLElement) || !desktop.value) return;
  if (event.target instanceof Element && event.target.closest('button')) return;
  release();
  focus(win);
  const rect = desktop.value.getBoundingClientRect();
  const element = event.currentTarget;
  drag = {
    win, element, pointer: event.pointerId, x: event.clientX, y: event.clientY, left: win.x, upper: win.y,
    scaleX: desktop.value.offsetWidth / (rect.width || 1), scaleY: desktop.value.offsetHeight / (rect.height || 1),
  };
  element.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointer) return;
  drag.win.x = drag.left + (event.clientX - drag.x) * drag.scaleX;
  drag.win.y = drag.upper + (event.clientY - drag.y) * drag.scaleY;
  clamp(drag.win);
}
function release(): void {
  const captured = drag;
  drag = null;
  if (captured?.element.hasPointerCapture(captured.pointer)) captured.element.releasePointerCapture(captured.pointer);
}
function titleKeys(event: KeyboardEvent, win: DesktopWindow): void {
  if (event.target !== event.currentTarget) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    maximize(win);
    return;
  }
  if (!event.key.startsWith('Arrow')) return;
  event.preventDefault();
  if (narrow.value) return;
  win.maximized = false;
  const step = event.shiftKey ? 30 : 10;
  win.x += event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
  win.y += event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
  clamp(win);
}
async function togglePopover(value: Popover): Promise<void> {
  popover.value = popover.value === value ? null : value;
  if (popover.value === 'spotlight') {
    mission.value = false;
    query.value = '';
    await nextTick();
    if (!disposed) spotlightField.value?.focus();
  }
}
function keyboard(event: KeyboardEvent): void {
  if (event.key === 'Escape' && (popover.value || mission.value)) {
    event.preventDefault();
    event.stopPropagation();
    popover.value = null;
    mission.value = false;
    root.value?.focus();
    return;
  }
  if (status.value === 'connected' && (event.metaKey || event.ctrlKey) && event.code === 'Space') {
    event.preventDefault();
    event.stopPropagation();
    void togglePopover('spotlight');
  }
}
function collectionKeys(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (!(event.currentTarget instanceof HTMLElement) || !(event.target instanceof HTMLButtonElement)) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const index = buttons.indexOf(event.target);
  if (index < 0 || !buttons.length) return;
  event.preventDefault();
  buttons[(index + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
}
function spotlightKeys(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement && event.key === 'ArrowDown') {
    event.preventDefault();
    root.value?.querySelector<HTMLButtonElement>('.spotlight-results button')?.focus();
  } else collectionKeys(event);
}
const menuItems = computed<{ label: string; action: () => void }[]>(() => {
  if (popover.value === 'system') return [
    { label: 'About this virtual Mac', action: () => notify('A small macOS simulation. Zero fan noise. Everything lives in this app.') },
    { label: 'System Settings…', action: () => reveal('settings') },
    { label: 'Disconnect', action: disconnect },
  ];
  if (popover.value === 'file') return [
    ...MAC_APPS.map(app => ({ label: 'Open ' + app.name, action: () => reveal(app.id) })),
    { label: 'Close Window', action: () => close(focused.value) },
  ];
  if (popover.value === 'edit') return [
    { label: 'Open scratchpad to edit', action: () => reveal('notes') },
    { label: 'Copy scratchpad', action: () => { void copyScratchpad(); } },
    { label: 'Reset scratchpad', action: () => { scratchpad.value = 'A fresh thought. The cursor is listening.'; reveal('notes'); } },
  ];
  return [
    ...modes.map(item => ({ label: item + ' Display', action: () => { mode.value = item; } })),
    { label: 'Mission Control', action: () => { mission.value = true; } },
    { label: 'Show all windows', action: () => { windows.forEach(win => { if (win.open) win.minimized = false; }); } },
  ];
});
function selectMenu(action: () => void): void { popover.value = null; action(); }
async function copyScratchpad(): Promise<void> {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(scratchpad.value);
    if (!disposed) notify('Scratchpad copied.');
  } catch { if (!disposed) notify('Clipboard unavailable. Select and copy the text in Scratchpad.'); }
}
watch(frame, element => {
  observer?.disconnect();
  if (!element || !observer) return;
  observer.observe(element);
  if (element.clientWidth > 0 && element.clientHeight > 0) {
    size.width = element.clientWidth;
    size.height = element.clientHeight;
  }
}, { flush: 'post' });
watch(dimensions, () => windows.forEach(clamp));
onMounted(() => {
  observer = new ResizeObserver(entries => {
    const rect = entries[0]?.contentRect;
    if (rect && rect.width > 0 && rect.height > 0) { size.width = rect.width; size.height = rect.height; }
  });
  if (frame.value) observer.observe(frame.value);
  clockTimer = setInterval(() => { if (!document.hidden && status.value === 'connected') now.value = new Date(); }, 1000);
});
onBeforeUnmount(() => {
  disposed = true;
  release();
  observer?.disconnect();
  if (connectionTimer) clearTimeout(connectionTimer);
  if (clockTimer) clearInterval(clockTimer);
  if (messageTimer) clearTimeout(messageTimer);
});
</script>

<template>
  <main ref="root" class="mac-root" :class="{ compact }" tabindex="0" aria-label="Mac Virtual Display simulation" @keydown="keyboard">
    <div class="mac-layout">
      <header class="app-header">
        <div>
          <h1 class="vk-title">Mac Virtual Display</h1>
          <p class="vk-footnote vk-secondary">A private workspace. Room for every idea.</p>
        </div>
        <span class="connection vk-footnote"><i :class="{ online: status === 'connected' }" />{{ status === 'connected' ? "Demo MacBook" : 'Nearby Mac' }}</span>
      </header>

      <section v-if="status !== 'connected'" class="connect-screen vk-scroll" :aria-busy="status === 'connecting'">
        <UltrawideHero :connecting="status === 'connecting'" />
        <div class="connection-info">
          <h2 class="vk-large-title">{{ status === 'connecting' ? 'Making room for you.' : 'Your Mac. A whole new perspective.' }}</h2>
          <p class="vk-body vk-secondary">One huge, curved display wrapped around you: your tools side by side, with room left over.</p>
          <div class="connect-row">
            <button v-hover class="vk-button primary connect-button" :disabled="status === 'connecting'" @click="connect"><AppIcon name="editor" />{{ status === 'connecting' ? 'Connecting…' : 'Connect Demo MacBook' }}</button>
            <button v-if="status === 'connecting'" v-hover class="vk-button" @click="disconnect">Cancel</button>
          </div>
          <div class="connection-features"><span><AppIcon name="browse" />32:9 Ultrawide</span><span><AppIcon name="lock" />Private by design: a simulated Mac whose files stay in this window</span></div>
        </div>
      </section>

      <div v-show="status === 'connected'" class="connected-desktop">
        <div ref="frame" class="desktop-frame vk-well vk-scroll" :class="{ curved: mode === 'Ultrawide' }">
          <div
            ref="desktop" class="desktop" :class="mode.toLowerCase()"
            :style="{ width: dimensions.width + 'px', height: dimensions.height + 'px', filter: 'brightness(' + brightness + ')', '--desktop-viewport': size.width + 'px' }"
          >
            <div class="wallpaper" aria-hidden="true"><i /><i /><i /></div>
            <nav class="menu-bar" aria-label="Mac menu bar" @keydown="collectionKeys">
              <button v-hover class="menu-symbol" aria-label="System menu" :aria-expanded="popover === 'system'" @click="togglePopover('system')"><AppIcon name="system" /></button>
              <strong>{{ activeName }}</strong>
              <button v-hover :aria-expanded="popover === 'file'" @click="togglePopover('file')">File</button>
              <button v-hover :aria-expanded="popover === 'edit'" @click="togglePopover('edit')">Edit</button>
              <button v-hover :aria-expanded="popover === 'view'" @click="togglePopover('view')">View</button>
              <span class="menu-spacer" />
              <button v-hover aria-label="Mission Control" :aria-pressed="mission" @click="mission = !mission; popover = null"><AppIcon name="browse" /></button>
              <button v-hover aria-label="Spotlight search" :aria-expanded="popover === 'spotlight'" @click="togglePopover('spotlight')"><AppIcon name="search" /></button>
              <button v-hover aria-label="Control Centre" :aria-expanded="popover === 'control'" @click="togglePopover('control')"><AppIcon name="tune" /></button>
              <time :datetime="now.toISOString()">{{ date }} {{ clock }}</time>
            </nav>
            <div class="desktop-lettering">
              <p>ROOM TO THINK.</p>
              <h2>One thought<br />at a time.</h2>
            </div>
            <button v-hover class="desktop-folder" aria-label="Open home folder in Finder" @click="reveal('finder')">
              <span><AppIcon name="folder" /></span><span>Home</span>
            </button>

            <section
              v-for="win in windows" v-show="win.open && !win.minimized" :key="win.id" class="mac-window"
              :class="{ focused: focused === win.id }" :style="windowStyle(win)"
              :aria-label="MAC_APPS.find(app => app.id === win.id)?.name + ' window'"
              @pointerdown="focus(win)" @focusin="focus(win)"
            >
              <header
                v-hover class="window-title" role="group" tabindex="0"
                :aria-label="'Move ' + win.id + ' with arrow keys. Enter to maximize or restore.'"
                @pointerdown.stop="grab($event, win)" @pointermove.stop="move" @pointerup.stop="release" @pointercancel.stop="release"
                @lostpointercapture="release" @keydown="titleKeys($event, win)" @dblclick="maximize(win)"
              >
                <div class="traffic-lights">
                  <button v-hover class="traffic close" :aria-label="'Close ' + win.id" @click.stop="close(win.id)"><i><AppIcon name="close" /></i></button>
                  <button v-hover class="traffic minimize" :aria-label="'Minimize ' + win.id" @click.stop="win.minimized = true"><i><AppIcon name="minus" /></i></button>
                  <button v-hover class="traffic zoom" :aria-label="'Maximize or restore ' + win.id" @click.stop="maximize(win)"><i><AppIcon name="plus" /></i></button>
                </div>
                <strong>{{ MAC_APPS.find(app => app.id === win.id)?.name }}</strong>
                <span class="window-hint">Drag to move</span>
              </header>
              <div class="window-body">
                <MacFinder v-if="win.id === 'finder'" />
                <MacTerminal v-else-if="win.id === 'terminal'" :seconds="seconds" @exit="close('terminal')" />
                <MacEditor v-else-if="win.id === 'editor'" />
                <section v-else-if="win.id === 'notes'" class="scratchpad">
                  <div class="scratch-header">
                    <span class="vk-footnote">{{ scratchpad.trim().split(/\s+/).filter(Boolean).length }} words · Saved in this session</span>
                    <button v-hover class="vk-icon" aria-label="Copy scratchpad" @click="copyScratchpad"><AppIcon name="copy" /></button>
                  </div>
                  <textarea v-model="scratchpad" v-hover class="vk-scroll" aria-label="Scratchpad note" spellcheck="true" />
                </section>
                <section v-else class="display-settings vk-scroll">
                  <h2 class="vk-title">Displays</h2>
                  <div class="display-preview" :class="mode.toLowerCase()" aria-hidden="true"><span>{{ mode }}</span></div>
                  <p class="vk-body">Choose your breathing room.</p>
                  <div class="display-options" @keydown="collectionKeys">
                    <button v-for="item in modes" :key="item" v-hover class="vk-button" :aria-pressed="mode === item" @click="mode = item">{{ item }}</button>
                  </div>
                  <p class="vk-footnote vk-secondary">Standard 16:9 · Wide 21:9 · Ultrawide 32:9<br />Scroll the desktop to explore its full width.</p>
                  <label class="brightness"><span>Brightness</span>
                    <input v-model.number="brightness" v-hover class="vk-slider" type="range" min=".55" max="1" step=".01" :style="{ '--value': (brightness - .55) / .45 }" />
                  </label>
                </section>
              </div>
            </section>
          </div>
        </div>

        <footer class="desktop-controls">
          <nav class="dock vk-ornament" aria-label="Mac Dock" @keydown="collectionKeys">
            <button
              v-for="app in MAC_APPS" :key="app.id" v-hover class="dock-item vk-icon" :style="{ '--app-color': app.color }"
              :aria-label="'Open ' + app.name" :aria-pressed="focused === app.id && windows.some(win => win.id === app.id && win.open && !win.minimized)"
              @click="reveal(app.id)"
            >
              <span class="dock-label">{{ app.name }}</span><span class="dock-glyph"><AppIcon :name="app.id" /></span>
              <i v-if="windows.some(win => win.id === app.id && win.open)" class="running" />
            </button>
          </nav>
          <div class="display-toolbar vk-ornament">
            <div class="display-modes vk-segmented" aria-label="Display width"><button v-for="choice in modes" :key="choice" v-hover :aria-pressed="mode === choice" @click="mode = choice">{{ choice }}</button></div>
            <button v-hover class="vk-icon" aria-label="Mission Control" :aria-pressed="mission" @click="mission = !mission; popover = null"><AppIcon name="browse" /></button>
            <button v-hover class="vk-button disconnect" @click="disconnect">Disconnect</button>
          </div>
        </footer>
      </div>

      <template v-if="popover || mission">
        <button v-hover class="overlay-dismiss" aria-label="Dismiss desktop menu" @click="popover = null; mission = false" />
        <section v-if="popover === 'spotlight'" class="popover spotlight vk-sheet" aria-label="Spotlight" @keydown="spotlightKeys">
          <form @submit.prevent="results[0] && reveal(results[0].id)">
            <input ref="spotlightField" v-model="query" v-hover class="vk-field" aria-label="Search apps" placeholder="Spotlight Search" />
          </form>
          <div class="spotlight-results vk-scroll">
            <button v-for="app in results" :key="app.id" v-hover class="vk-row" @click="reveal(app.id)">
              <span class="result-icon" :style="{ background: app.color }"><AppIcon :name="app.id" /></span>
              <span><strong>{{ app.name }}</strong><small class="vk-secondary">Application · Virtual Mac</small></span>
              <span class="result-enter"><AppIcon name="enter" /></span>
            </button>
            <p v-if="!results.length" class="vk-body">No matches. Try Finder or Terminal.</p>
          </div>
          <p class="vk-footnote vk-secondary">⌘ Space or Ctrl Space · Local app search</p>
        </section>
        <section v-else-if="popover === 'control'" class="popover control-centre vk-sheet vk-scroll" aria-label="Control Centre">
          <h2 class="vk-title">Control Centre</h2>
          <div class="control-grid">
            <button v-hover class="vk-button" :aria-pressed="wifi" @click="wifi = !wifi">Wi-Fi {{ wifi ? 'On' : 'Off' }}</button>
            <button v-hover class="vk-button" :aria-pressed="bluetooth" @click="bluetooth = !bluetooth">Bluetooth {{ bluetooth ? 'On' : 'Off' }}</button>
            <button v-hover class="vk-button" :aria-pressed="quiet" @click="quiet = !quiet">{{ quiet ? 'Focus on' : 'Focus off' }}</button>
            <button v-hover class="vk-button" @click="reveal('settings')">Displays</button>
          </div>
          <p class="vk-footnote vk-secondary">
            {{ quiet ? 'Virtual notifications silenced. Your thoughts can stay.' : 'Virtual device controls. Display link stays connected.' }}
          </p>
          <label class="brightness"><span>Display brightness</span>
            <input v-model.number="brightness" v-hover class="vk-slider" type="range" min=".55" max="1" step=".01" :style="{ '--value': (brightness - .55) / .45 }" />
          </label>
          <button v-hover class="vk-button" @click="notify('Battery: powered entirely by imagination.')">Battery · 100%</button>
        </section>
        <section v-else-if="mission" class="popover mission-control vk-sheet vk-scroll" aria-label="Mission Control">
          <header>
            <h2 class="vk-title">Mission Control</h2>
            <button v-hover class="vk-icon" aria-label="Leave Mission Control" @click="mission = false">
            <AppIcon name="close" />
            </button>
            </header>
          <p class="vk-footnote vk-secondary">Choose a window. Minimized windows are welcome too.</p>
          <div class="mission-grid" @keydown="collectionKeys">
            <button v-for="app in MAC_APPS.filter(item => windows.some(win => win.id === item.id && win.open))" :key="app.id"
              v-hover class="mission-card vk-platter" @click="reveal(app.id)">
              <span class="mission-symbol" :style="{ background: app.color }"><AppIcon :name="app.id" /></span>
              <strong>{{ app.name }}</strong>
            </button>
          </div>
          <p v-if="!windows.some(win => win.open)" class="vk-body">A clear desk. Open an app from the Dock.</p>
        </section>
        <nav v-else class="popover dropdown vk-sheet vk-scroll" aria-label="Desktop menu" @keydown="collectionKeys">
          <button v-for="item in menuItems" :key="item.label" v-hover class="vk-row" @click="selectMenu(item.action)">{{ item.label }}</button>
        </nav>
      </template>
      <p v-if="message" class="local-message vk-ornament vk-footnote" role="status">{{ message }}</p>
    </div>
  </main>
</template>

<style scoped>
.mac-root {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  container-type: size;
  overflow: hidden;
  color: var(--vk-text, #fff);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
  font-size: 17px;
  letter-spacing: -.015em;
}
.mac-root :deep(*) { font-family: inherit; box-sizing: border-box; }
.mac-root :deep(button) { cursor: pointer; border: 0; }
.mac-root :deep(:focus-visible) { outline: 2px solid white; outline-offset: -2px; }
.mac-layout { height: 100%; display: flex; flex-direction: column; position: relative; gap: 14px; padding: 22px; }
.app-header { display: flex; justify-content: space-between; align-items: center; gap: 18px; flex: none; }
h1, h2, p { margin: 0; }
.app-header p { margin-top: 5px; }
.connection { display: flex; gap: 8px; align-items: center; white-space: nowrap; color: #ffffffe0; }
.connection i { width: 7px; height: 7px; background: #e4cf97; border-radius: 50%; }
.connection i.online { background: #8ff1ba; }
.connect-screen {
  min-height: 0; flex: 1; display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 20px; padding: 28px 8px; justify-content: safe center;
}
.laptop { width: 140px; height: 140px; display: grid; place-items: center; border-radius: 50%; background: #ffffff0d; }
.laptop svg { width: 115px; height: 95px; }
.connecting { animation: connect-pulse 1.2s ease-out infinite; }
.connect-button { min-height: 60px; }
.desktop-frame { flex: 1; min-height: 0; position: relative; border: 1px solid #ffffff28; border-radius: 22px; }
.desktop { position: relative; overflow: hidden; background: #283259; color: #fff; }
.wallpaper { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(135deg, #192b68, #594f9c 55%, #da8e8c); }
.wallpaper i { position: absolute; display: block; border-radius: 50%; transform: rotate(-30deg); }
.wallpaper i:nth-child(1) {
  width: 100%; height: 190%; top: -70%; left: -30%;
  background: linear-gradient(150deg, #73c1eb 8%, #214d9d 42%, #131c54 60%);
  box-shadow: 35px 50px 120px #11163d80;
}
.wallpaper i:nth-child(2) {
  width: 105%; height: 190%; top: -45%; right: -60%;
  background: linear-gradient(110deg, #f5c1a9, #b58cc1 30%, #646bc2 70%);
  box-shadow: -30px 0 70px #2e376540;
}
.wallpaper i:nth-child(3) { width: 90%; height: 140%; bottom: -112%; left: -2%; background: linear-gradient(90deg, #597bc3, #cba6c3); }
.desktop.ultrawide { border-radius: 0 0 40px 40px / 0 0 22px 22px; transform: perspective(2500px) rotateX(1deg); transform-origin: center top; }
.desktop.ultrawide::after {
  content: ''; position: absolute; inset: 44px 0 0; pointer-events: none;
  background: linear-gradient(90deg, #0000001f, transparent 18%, transparent 82%, #0000001f);
}
.menu-bar {
  height: 44px; position: relative; z-index: 100; display: flex; align-items: center;
  background: #17213985; backdrop-filter: blur(20px); padding: 0 8px; gap: 2px; font-size: 14px;
}
.menu-bar button { height: 44px; min-width: 44px; padding: 0 10px; background: transparent; color: #fff; border-radius: 7px; }
.menu-bar strong { padding: 0 10px; }
.menu-symbol { font-size: 26px; }
.menu-spacer { flex: 1; }
.menu-bar time { padding: 0 12px; font-size: 13px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.desktop-lettering { position: absolute; right: 10%; top: 27%; opacity: .68; pointer-events: none; text-align: right; }
.desktop-lettering p { font-size: 13px; letter-spacing: .15em; }
.desktop-lettering h2 { font-size: 50px; letter-spacing: -.05em; line-height: 1; margin-top: 18px; }
.desktop-folder {
  position: absolute; right: 28px; top: 68px; background: transparent; color: #fff; display: flex;
  flex-direction: column; align-items: center; gap: 6px; padding: 10px; border-radius: 16px; font-size: 14px;
}
.desktop-folder > span:first-child { font-size: 54px; line-height: 1; color: #9adaff; text-shadow: 0 4px 8px #0004; }
.mac-window {
  position: absolute; display: flex; flex-direction: column; overflow: hidden; border-radius: 14px;
  background: #273043; border: 1px solid #ffffff2b; box-shadow: 0 18px 40px #0005;
}
.mac-window.focused { border-color: #ffffff6b; box-shadow: 0 22px 55px #0007; }
.window-title {
  display: flex; align-items: center; gap: 12px; flex: none; min-height: 46px; padding: 0 8px;
  background: linear-gradient(#ffffff18, #ffffff09); cursor: grab; touch-action: none; user-select: none;
}
.window-title:active { cursor: grabbing; }
.window-title strong { font-size: 14px; font-weight: 600; }
.window-hint { font-size: 12px; color: #ffffffb3; margin-left: auto; padding-right: 10px; }
.traffic-lights { display: flex; gap: 0; }
.traffic {
  width: 44px; height: 44px; display: grid; place-items: center;
  padding: 0; border-radius: 50%; background: transparent; color: #282b33;
}
.traffic i { font-size: 13px; font-style: normal; line-height: 16px; width: 16px; height: 16px; border-radius: 50%; font-weight: 700; }
.close i { background: #ff6b63; }
.minimize i { background: #ffd35d; }
.zoom i { background: #65d784; }
.window-body { container-type: inline-size; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
.scratchpad { width: 100%; height: 100%; display: flex; flex-direction: column; background: #2b2930; }
.scratch-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 16px; color: #eedba0; }
.scratchpad textarea {
  width: 100%; min-height: 0; flex: 1; resize: none; border: 0; background: transparent;
  color: #f5eee0; padding: 14px 24px; font-size: 17px; line-height: 1.8;
}
.display-settings { height: 100%; padding: 20px; text-align: center; background: #2a3141; display: flex; flex-direction: column; gap: 16px; }
.display-preview {
  margin: 0 auto; min-height: 70px; width: 120px; border: 3px solid #cad5ee; border-radius: 8px;
  display: grid; place-items: center; background: linear-gradient(125deg,#3676b6,#8c80bf,#e4ac9a); font-size: 14px;
}
.display-preview.wide { width: 180px; }
.display-preview.ultrawide { width: 230px; border-radius: 14px / 8px; }
.display-options { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.display-options .vk-button { font-size: 14px; padding: 0 16px; }
.brightness { display: flex; flex-direction: column; text-align: left; gap: 4px; font-size: 15px; }
.desktop-controls { flex: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; align-items: center; }
.dock { padding: 8px 12px 10px; gap: 8px; }
.dock-item { width: 48px; height: 48px; border-radius: 12px; background: var(--app-color); position: relative; }
.dock-item:hover { background: var(--app-color); transform: translateY(-8px) scale(1.16); z-index: 2; }
.dock:has(.dock-item:hover) .dock-item:not(:hover) { transform: translateY(-2px) scale(1.04); }
.dock-item[aria-pressed='true'] { color: #fff; background: var(--app-color); }
.dock-glyph { font-size: 26px; letter-spacing: -.08em; }
.running { position: absolute; bottom: -6px; width: 4px; height: 4px; background: #fff; border-radius: 50%; }
.dock-label {
  position: absolute; bottom: calc(100% + 14px); white-space: nowrap; padding: 6px 12px;
  border-radius: 10px; background: #222c43ed; color: #fff; font-size: 13px; opacity: 0; pointer-events: none;
  transform: translateY(5px); transition: transform .25s ease-out, opacity .25s ease-out;
}
.dock-item:hover .dock-label, .dock-item:focus-visible .dock-label { opacity: 1; transform: translateY(0); }
.display-toolbar { gap: 6px; }
.display-toolbar .vk-button { font-size: 14px; padding: 0 14px; }
.overlay-dismiss { position: absolute; inset: 0; background: #00000026; border-radius: inherit; z-index: 200; }
.popover { position: absolute; z-index: 201; top: 90px; left: 50%; transform: translateX(-50%); max-height: calc(100% - 116px); width: min(540px, calc(100% - 40px)); }
.spotlight { display: flex; flex-direction: column; gap: 12px; padding: 18px; }
.spotlight-results { min-height: 0; }
.result-icon { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; font-size: 24px; }
.spotlight-results small { display: block; font-size: 13px; padding-top: 4px; }
.result-enter { margin-left: auto; }
.control-centre { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
.control-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.control-grid .vk-button { font-size: 14px; min-height: 60px; padding: 0 12px; }
.mission-control { padding: 22px; }
.mission-control > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.mission-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 20px; }
.mission-card { min-height: 140px; display: flex; flex-direction: column; gap: 12px; align-items: center; justify-content: center; color: #fff; padding: 16px; }
.mission-symbol { font-size: 30px; border-radius: 15px; width: 56px; height: 56px; display: grid; place-items: center; }
.dropdown { width: min(320px, calc(100% - 40px)); }
.dropdown .vk-row { font-size: 15px; min-height: 48px; }
.local-message { position: relative; flex: none; z-index: 210; padding: 14px 20px; justify-content: center; text-align: center; pointer-events: none; }
@keyframes connect-pulse { 50% { transform: scale(1.05); opacity: .65; } }
@container (max-width: 700px) {
  .mac-layout { padding: 18px; gap: 12px; }
  .connection { display: none; }
  .desktop-controls { gap: 8px; }
  .display-toolbar { padding: 4px 8px; }
  .connect-screen { padding: 16px 0; }
}
@container (max-height: 400px) {
  .mac-layout { padding: 14px; gap: 8px; }
  .app-header p, .connection { display: none; }
  .app-header h1 { font-size: 22px; }
  .laptop { width: 80px; height: 80px; }
  .laptop svg { width: 70px; height: 65px; }
  .connect-screen { justify-content: flex-start; gap: 12px; padding: 10px; }
  .connect-screen h2 { font-size: 24px; }
  .desktop-controls { gap: 4px; }
  .dock { padding: 4px 10px 8px; }
  .dock-item { width: 44px; height: 44px; }
  .display-toolbar { padding: 4px; }
  .popover { top: 50px; max-height: calc(100% - 65px); }
  .mission-card { min-height: 100px; }
}

.connected-desktop { display: flex; flex-direction: column; gap: 14px; flex: 1; min-height: 0; }
.mac-root :deep(.vk-scroll) { scrollbar-width: thin; scrollbar-color: #ffffff40 transparent; }
.mac-root :deep(.vk-scroll::-webkit-scrollbar) { display: block; width: 5px; height: 5px; }
.mac-root :deep(.vk-scroll::-webkit-scrollbar-thumb) { background: #ffffff40; border-radius: 8px; }
.mac-root .desktop-frame { overflow: auto; }
.menu-bar .app-icon { width: 20px; height: 20px; }
.traffic i { display: grid; place-items: center; }
.traffic :deep(svg) { width: 11px; height: 11px; }
.desktop-folder :deep(svg) { width: 52px; height: 52px; }
.dock-glyph :deep(svg) { width: 28px; height: 28px; }
.display-toolbar .vk-button :deep(svg) { width: 16px; height: 16px; }
.mac-root .display-options .vk-button { white-space: normal; }
.connect-screen { animation: mac-page .24s ease-out; }
.local-message { animation: mac-page .24s ease-out; }
@keyframes mac-page { from { opacity: 0; transform: translateY(5px); } }
@container (max-width: 540px) {
  .mac-layout { padding: 16px; }
  .app-header h1 { font-size: 24px; }
  .app-header p { font-size: 13px; }
  .connect-screen { gap: 16px; justify-content: safe center; }
  .connect-screen h2 { font-size: 28px; text-wrap: balance; }
  .connect-screen > p { font-size: 15px; line-height: 1.5; }
  .laptop { width: 100px; height: 100px; }
  .laptop svg { width: 88px; height: 76px; }
  .connect-button { width: 100%; min-height: 48px; }
  .connected-desktop { gap: 10px; }
  .menu-bar { padding: 0 2px; gap: 0; width: var(--desktop-viewport); max-width: 100%; }
  .menu-bar > strong, .menu-bar > time, .menu-spacer { display: none; }
  .menu-bar > button { flex: 1; min-width: 44px; padding: 0 4px; font-size: 13px; }
  .window-hint { display: none; }
  .window-title { gap: 4px; }
  .window-title strong { font-size: 13px; }
  .dock { padding: 6px 8px 10px; gap: 6px; }
  .dock-item { width: 44px; height: 44px; }
  .display-toolbar { width: 100%; justify-content: center; }
  .display-toolbar .vk-button { font-size: 13px; padding: 0 12px; }
  .popover { top: 80px; width: calc(100% - 24px); max-height: calc(100% - 96px); }
  .control-centre, .mission-control { padding: 16px; }
  .control-grid { gap: 6px; }
  .control-grid .vk-button { font-size: 13px; padding: 0 8px; white-space: normal; }
  .display-settings { padding: 16px 12px; }
  .display-options { gap: 6px; }
  .display-options .vk-button { font-size: 13px; padding: 0 12px; }
  .scratch-header { padding: 8px 12px; }
  .scratch-header .vk-footnote { font-size: 12px; }
  .scratchpad textarea { padding: 12px 16px; }
  .local-message { padding: 10px 14px; font-size: 13px; border-radius: 18px; }
}
@media (hover: none) {
  .dock-item:hover, .dock:has(.dock-item:hover) .dock-item:not(:hover) { transform: none; }
  .dock-label { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mac-root :deep(*), .mac-root :deep(*::before), .mac-root :deep(*::after) { animation: none !important; transition: none !important; }
  .dock-item:hover, .dock:has(.dock-item:hover) .dock-item:not(:hover) { transform: none; }
}

.mac-root { background:radial-gradient(ellipse at 20% 50%,#7094d12b,transparent 65%); }
.mac-layout { padding:24px; gap:16px; }
.app-header h1 { font-size:22px; }.app-header p { font-size:12px; }
.connect-screen { display:flex; flex-direction:column; align-items:center; gap:clamp(10px,1.6cqw,18px); padding:2px 6px 14px; text-align:center; }
.connection-info { display:flex; flex-direction:column; align-items:center; gap:10px; max-width:640px; }
.connection-info h2 { font-size:clamp(26px,3cqw,38px); letter-spacing:-.045em; line-height:1.08; text-wrap:balance; }
.connection-info>.vk-body { font-size:15px; line-height:1.55; max-width:600px; text-wrap:balance; }
.connect-row { display:flex; gap:10px; margin-top:4px; }
.connect-button { min-height:46px; font-size:14.5px; padding:0 22px; gap:8px; }
.connect-button :deep(svg) { width:18px; height:18px; }
.connection-features { display:flex; flex-wrap:wrap; justify-content:center; gap:18px; color:#d5e2ee; font-size:12px; margin-top:2px; }
.connection-features>span { display:inline-flex; gap:6px; align-items:center; }
.connection-features :deep(svg) { width:16px; height:16px; }
.desktop-frame { border-radius:18px; }
.connected-desktop { gap:12px; }
.desktop-lettering { opacity:.5; right:6%; top:23%; }.desktop-lettering h2 { font-size:40px; }
.display-modes { padding:3px; }.display-modes>button { font-size:12px; padding:0 12px; min-height:44px; }
.display-toolbar { padding:4px 8px; }.display-toolbar .disconnect { font-size:12px; }
.dock { padding:8px 12px 10px; }.dock-item { width:44px; height:44px; border-radius:12px; box-shadow:inset 0 1px 0 #ffffff40,0 4px 8px #0003; }
@container(max-width:800px) { .connection-info h2 { font-size:28px; } }
@container(max-width:540px) { .mac-layout { padding:18px; gap:10px; } .app-header h1 { font-size:22px; } .app-header p { font-size:12px; } .connect-screen { padding:4px 0 20px; gap:16px; } .connection-info h2 { font-size:28px; } .connection-info>.vk-body { font-size:13px; } .connection-features { font-size:11.5px; gap:12px; } .display-toolbar { flex-wrap:wrap; width:100%; gap:4px; } .display-modes>button { font-size:12px; padding:0 10px; } .desktop-controls { gap:6px; } .dock { padding:6px 8px 9px; } .display-toolbar .disconnect { padding:0 8px; } }
@container(max-height:560px) and (min-width:801px) { .connect-screen { padding:0 24px 8px; gap:10px; } .connection-info { gap:8px; } .connection-info h2 { font-size:28px; } .connection-info>.vk-body { display:none; } .mac-layout { padding:18px; gap:10px; } }

</style>
