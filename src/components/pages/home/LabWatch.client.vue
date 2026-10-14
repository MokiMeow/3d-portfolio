<script setup lang="ts">
import { labDeviceBack } from '~/common/models/lab-device.model';
import { WATCH_VIEWS } from './watch/registry';
import { useWatchSystem } from './watch/useWatchSystem';
import { useHardwareButton } from './watch/useHardwareButton';
import { clamp, timeText, type FaceId, type WatchAppId } from './watch/watch';
import WatchFace from './watch/faces/WatchFace.vue';
import WatchAppView from './watch/WatchAppView.vue';
import WatchOverlays from './watch/WatchOverlays.vue';
import WatchIcon from './watch/WatchIcon.vue';
import WatchGlyph from './watch/WatchGlyph.vue';
const system = useWatchSystem();
// Escape steps back through the watch (overlay, app, app view) before the dialog takes the watch off.
const deviceBack = (): boolean => system.back();
const {
  settings,
  activeApp,
  dimmed,
  reducedMotion,
  powered,
  booting,
  banner,
  now,
  view
} = system;
const overlay = system.overlayId;
const scale = ref(0.7);
const zoom = ref(1);
const crownAngle = ref(0);
const watchRoot = ref<HTMLElement | null>(null);
const screen = ref<HTMLElement | null>(null);
const scrollIndicator = ref(false);
const scrollPosition = ref(0);
const scrollRange = ref(0);
const scrollThumb = ref(64);
const origin = ref({
  x: 211,
  y: 257
});
const faces: FaceId[] = ['wayfinder', 'modularUltra', 'waypoint', 'activityDigital', 'utility', 'deploy'];
const statusTime = computed(() => timeText(now.value, settings.hour24));
const screenFilter = computed(() => {
  const brightness = activeApp.value === 'flashlight' ? 1 : settings.brightness;
  const dim = dimmed.value ? 0.36 : 1;
  const night = settings.nightMode && !activeApp.value && view.value === 'face' && !overlay.value;
  return 'brightness(' + brightness * dim + ')' + (night ? ' grayscale(1) sepia(1) saturate(8) hue-rotate(310deg)' : '');
});
const asleep = computed(() => dimmed.value && (!settings.alwaysOn || settings.theatre));
const shellStyle = computed(() => ({
  transform: 'scale(' + scale.value + ')',
  '--band': settings.band,
  '--watch-scale': String(scale.value),
  '--text-size': String(settings.textSize)
}));
let faceHold = 0;
let indicatorTimer = 0;
let gesture: {
  id: number;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
  moved: boolean;
} | null = null;
let suppressScreenClick = false;
let wheelRemainder = 0;
let inertiaFrame = 0;
let velocity = 0;
let scrollTarget: HTMLElement | null = null;
let previousFrame = 0;
let rubberBand: Animation | null = null;
let layoutObserver: MutationObserver | null = null;
let sizeObserver: ResizeObserver | null = null;
let measureFrame = 0;

function currentScroller(): HTMLElement | null {
  return screen.value?.querySelector<HTMLElement>(overlay.value ? ".watch-overlay" : "[data-watch-scroll], .watch-app") ?? null;
}
function measureScroll(): void {
  measureFrame = 0;
  const target = currentScroller();
  const range = target ? target.scrollHeight - target.clientHeight : 0;
  scrollRange.value = Math.max(0, range);
  scrollPosition.value = target && range > 0 ? target.scrollTop / range : 0;
  scrollThumb.value = target ? Math.max(28, 300 * target.clientHeight / Math.max(1, target.scrollHeight)) : 64;
}
function scheduleMeasure(): void {
  if (!measureFrame) measureFrame = requestAnimationFrame(measureScroll);
}
function escape(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.defaultPrevented || !system.back()) return;
  event.preventDefault();
  event.stopPropagation();
}
function fit(): void {
  const dialog = watchRoot.value?.closest('dialog');
  const stage = watchRoot.value?.closest('.device-stage');
  const container = dialog ?? watchRoot.value?.parentElement?.parentElement;
  if (!container) return;
  const style = getComputedStyle(container);
  const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  const verticalPadding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const close = stage?.querySelector<HTMLElement>('.device-close');
  const gap = stage ? Number.parseFloat(getComputedStyle(stage).gap) || 0 : 0;
  const width = container.clientWidth - horizontalPadding;
  const height = container.clientHeight - verticalPadding - (close?.offsetHeight ?? 0) - gap;
  // A short dialog can scroll instead of shrinking labels and controls beyond use.
  scale.value = clamp(Math.min(width / 582, height / 780), 0.55, 1);
}
function stopInertia(): void {
  rubberBand?.cancel();
  rubberBand = null;
  cancelAnimationFrame(inertiaFrame);
  inertiaFrame = 0;
  velocity = 0;
  scrollTarget = null;
}
function indicate(target: HTMLElement): void {
  scrollIndicator.value = true;
  const range = target.scrollHeight - target.clientHeight;
  scrollPosition.value = range > 0 ? target.scrollTop / range : 0;
  clearTimeout(indicatorTimer);
  indicatorTimer = window.setTimeout(() => {
    scrollIndicator.value = false;
  }, 900);
}
function inertialScroll(): void {
  if (!scrollTarget || dimmed.value || !powered.value) {
    stopInertia();
    return;
  }
  const time = performance.now();
  const elapsed = previousFrame ? Math.min(32, time - previousFrame) : 16;
  previousFrame = time;
  scrollTarget.scrollTop += velocity * elapsed / 16;
  indicate(scrollTarget);
  velocity *= Math.pow(0.82, elapsed / 16);
  if (Math.abs(velocity) < 0.6) {
    stopInertia();
    return;
  }
  inertiaFrame = requestAnimationFrame(inertialScroll);
}
function rotate(delta: number): void {
  const amount = clamp(delta, -5, 5);
  crownAngle.value += amount * 26;
  if (system.crownTurn(amount)) return;
  if (!activeApp.value && view.value === 'apps' && !overlay.value && settings.appView === 'grid') {
    const nextZoom = clamp(zoom.value + amount * 0.07, 0.76, 1.35);
    if (nextZoom !== zoom.value) {
      zoom.value = nextZoom;
      return;
    }
  }
  const target = currentScroller();
  if (!target) return;
  const atEdge = amount < 0 ? target.scrollTop <= 0 : target.scrollTop + target.clientHeight >= target.scrollHeight - 1;
  if (atEdge && !reducedMotion.value && typeof target.animate === 'function') {
    rubberBand?.cancel();
    rubberBand = target.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(' + (amount > 0 ? -12 : 12) + 'px)' },
      { transform: 'translateY(0)' },
    ], { duration: 240, easing: 'ease-out' });
    return;
  }
  if (reducedMotion.value) {
    target.scrollTop += amount * 56;
    indicate(target);
    return;
  }
  scrollTarget = target;
  velocity = clamp(velocity + amount * 18, -70, 70);
  if (!inertiaFrame) {
    previousFrame = 0;
    inertiaFrame = requestAnimationFrame(inertialScroll);
  }
}
function wheel(event: WheelEvent): void {
  if (Math.abs(event.deltaY) < 0.2) return;
  wheelRemainder += event.deltaY;
  if (Math.abs(wheelRemainder) < 12) return;
  rotate(clamp(wheelRemainder / 40, -3, 3));
  wheelRemainder = 0;
}
const crown = useHardwareButton({
  holdMs: 800,
  press: system.crownPress,
  double: system.crownDouble,
  drag: rotate,
  hold: () => {
    if (!powered.value) return;
    if (overlay.value === 'waterLock') {
      system.overlay(null);
      system.haptic('success');
    } else system.overlay('siri');
  }
});
const side = useHardwareButton({
  holdMs: 1200,
  press: system.sidePress,
  double: () => {
    if (!powered.value) system.sidePress();else system.open('wallet');
  },
  hold: () => {
    if (!powered.value) system.sidePress();else system.overlay('power');
  }
});
const action = useHardwareButton({
  holdMs: 2000,
  press: system.actionPress,
  hold: () => {
    if (!powered.value) return;
    system.open('siren');
    system.sirenStart.value++;
  }
});
function openFromIcon(id: WatchAppId, event: MouseEvent): void {
  const target = event.currentTarget;
  if (target instanceof HTMLElement && screen.value) {
    const rect = target.getBoundingClientRect();
    const bounds = screen.value.getBoundingClientRect();
    origin.value = {
      x: (rect.left + rect.width / 2 - bounds.left) / scale.value,
      y: (rect.top + rect.height / 2 - bounds.top) / scale.value
    };
  }
  stopInertia();
  system.open(id);
}
function screenDown(event: PointerEvent): void {
  system.wake();
  stopInertia();
  if (event.button !== 0 || !event.isPrimary || !powered.value || booting.value) return;
  const box = screen.value?.getBoundingClientRect();
  if (!box) return;
  gesture = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    screenX: (event.clientX - box.left) / scale.value,
    screenY: (event.clientY - box.top) / scale.value,
    moved: false
  };
  suppressScreenClick = false;
  if (!activeApp.value && view.value === 'face' && !overlay.value) {
    faceHold = window.setTimeout(() => {
      if (!gesture || gesture.moved) return;
      suppressScreenClick = true;
      gesture = null;
      system.overlay('gallery');
      system.haptic();
    }, 650);
  }
}
function screenMove(event: PointerEvent): void {
  if (!gesture || gesture.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 9) {
    gesture.moved = true;
    clearTimeout(faceHold);
  }
}
function screenUp(event: PointerEvent): void {
  clearTimeout(faceHold);
  if (!gesture || gesture.id !== event.pointerId) return;
  const drag = gesture;
  gesture = null;
  const dx = (event.clientX - drag.x) / scale.value;
  const dy = (event.clientY - drag.y) / scale.value;
  if (!drag.moved) return;
  suppressScreenClick = true;
  if (overlay.value || !powered.value) return;
  if (activeApp.value) {
    if (drag.screenX < 52 && dx > 70 && Math.abs(dy) < 100) system.back();
    return;
  }
  if (view.value !== 'face') return;
  if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
    const current = faces.indexOf(settings.face);
    const next = faces[(current + (dx < 0 ? 1 : -1) + faces.length) % faces.length];
    if (next) settings.face = next;
    system.haptic();
  } else if (dy < -65 && drag.screenY > 360) system.overlay('stack');else if (dy > 65 && drag.screenY < 132) system.overlay('notifications');
}
function cancelGesture(): void {
  clearTimeout(faceHold);
  gesture = null;
}
function captureClick(event: MouseEvent): void {
  if (!suppressScreenClick) return;
  event.preventDefault();
  event.stopPropagation();
  suppressScreenClick = false;
}
function key(event: KeyboardEvent): void {
  if (event.defaultPrevented) return;
  const target = event.target;
  if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    rotate(event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (activeApp.value || overlay.value || view.value !== 'face') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const face = faces[(faces.indexOf(settings.face) + offset + faces.length) % faces.length];
    if (face) settings.face = face;
    system.wake();
  } else if ((event.key === 'Enter' || event.key === ' ') && event.target === watchRoot.value) {
    event.preventDefault();
    system.crownPress();
  } else if (event.key.toLowerCase() === 'c') {
    system.sidePress();
  } else if (event.key.toLowerCase() === 'a') {
    system.actionPress();
  } else if (event.key.toLowerCase() === 's') {
    system.overlay('stack');
  } else if (event.key.toLowerCase() === 'n') {
    system.overlay('notifications');
  } else if (event.key.toLowerCase() === 'f') {
    system.overlay('gallery');
  }
}
function scroll(event: Event): void {
  if (event.target instanceof HTMLElement) {
    indicate(event.target);
    measureScroll();
  }
}
watch([activeApp, overlay, view, dimmed], () => {
  stopInertia();
  void nextTick(scheduleMeasure);
});
onMounted(() => {
  labDeviceBack.handler = deviceBack;
  fit();
  // Capture Escape before the surrounding dialog handles its native cancel event.
  window.addEventListener('keydown', escape, true);
  if (screen.value) {
    layoutObserver = new MutationObserver(scheduleMeasure);
    layoutObserver.observe(screen.value, { childList: true, subtree: true, characterData: true });
    sizeObserver = new ResizeObserver(scheduleMeasure);
    sizeObserver.observe(screen.value);
  }
  scheduleMeasure();
  window.addEventListener('resize', fit);
  window.addEventListener('pointerup', screenUp);
  window.addEventListener('pointermove', screenMove);
  window.addEventListener('pointercancel', cancelGesture);
  window.visualViewport?.addEventListener('resize', fit);
});
onBeforeUnmount(() => {
  if (labDeviceBack.handler === deviceBack) labDeviceBack.handler = null;
  stopInertia();
  layoutObserver?.disconnect();
  sizeObserver?.disconnect();
  cancelAnimationFrame(measureFrame);
  window.removeEventListener('keydown', escape, true);
  clearTimeout(faceHold);
  clearTimeout(indicatorTimer);
  window.removeEventListener('resize', fit);
  window.removeEventListener('pointerup', screenUp);
  window.removeEventListener('pointermove', screenMove);
  window.removeEventListener('pointercancel', cancelGesture);
  window.visualViewport?.removeEventListener('resize', fit);
});
</script>

<template>
  <div class="watch-fit" :style="{ width: 582 * scale + 'px', height: 780 * scale + 'px' }">
    <div
      ref="watchRoot"
      class="watch-root"
      :class="{ 'black-case': settings.case === 'black', 'wrist-tap': !!banner }"
      :style="shellStyle"
      tabindex="0"
      aria-label="Apple Watch Ultra simulation. Enter apps. Arrows turn crown. C controls. A action. F faces."
      @keydown="key"
      @keydown.capture="system.wake"
      @pointerdown.capture="system.wake"
    >
      <div class="band top-band" aria-hidden="true">
        <i
          v-for="loop in 4"
          :key="loop"
          class="raised-loop"
        />
      </div>
      <div class="band bottom-band" aria-hidden="true">
        <i
          v-for="loop in 4"
          :key="loop"
          class="raised-loop"
        />
        <span class="g-hook" />
      </div>
      <div class="lug top-lug" aria-hidden="true" />
      <div class="lug bottom-lug" aria-hidden="true" />
      <div class="crown-guard" aria-hidden="true" />
      <div class="watch-case">
        <div class="rim-highlight" aria-hidden="true" />
        <div class="glass-bezel">
          <div
            ref="screen"
            class="display"
            :class="{ 'on-face': !activeApp && view === 'face' && !overlay,
            'is-dimmed': dimmed, reduced: reducedMotion, night: settings.nightMode, 'has-overlay': !!overlay, 'light-display': activeApp === 'flashlight' }"
            :style="{ '--origin-x': origin.x + 'px', '--origin-y': origin.y + 'px' }"
            @wheel.prevent="wheel"
            @pointerdown="screenDown"
            @pointermove="screenMove"
            @pointerup="screenUp"
            @pointercancel="cancelGesture"
            @click.capture="captureClick"
            @scroll.capture="scroll"
          >
            <div
              v-show="powered && !booting"
              class="interface"
              :style="{ filter: screenFilter }"
              :inert="asleep"
            >
              <WatchFace v-if="!activeApp && view === 'face'" :inert="!!overlay" />
              <WatchAppView
                v-else-if="!activeApp"
                :zoom="zoom"
                :inert="!!overlay"
                @open="openFromIcon"
              />
              <Transition name="watch-app-zoom">
                <KeepAlive>
                  <component
                    :is="WATCH_VIEWS[activeApp]"
                    v-if="activeApp"
                    :key="activeApp"
                    :inert="!!overlay"
                  />
                </KeepAlive>
              </Transition>
              <div
                v-if="!overlay"
                class="status-bar"
                aria-hidden="true"
              >
                <template v-if="!activeApp && view === 'face'">
                  <i v-if="system.notifications.value.length" class="notification-dot" />
                  <span v-if="settings.charging" class="charging">
                    <WatchGlyph name="bolt" />
                  </span>
                  <span v-if="settings.focus" class="focus-status">
                    <WatchGlyph name="moon" />
                  </span>
                </template>
                <template v-else>
                  <button
                    class="app-back"
                    :aria-label="activeApp ? 'Back from ' + system.appName.value : 'Back to watch face'"
                    @click="system.back()"
                  >
                    <WatchGlyph name="back" />
                  </button>
                  <span class="app-time">
                    {{ statusTime }}
                  </span>
                </template>
              </div>
              <Transition name="overlay-rise">
                <WatchOverlays
                  v-if="overlay"
                  :key="overlay"
                  :kind="overlay"
                />
              </Transition>
              <Transition name="banner">
                <button
                  v-if="banner"
                  class="notification-banner"
                  @click="system.open(banner.app)"
                >
                  <WatchIcon :name="banner.app" :size="48" />
                  <span>
                    <b>
                      {{ banner.title }}
                    </b>
                    <small>
                      {{ banner.text }}
                    </small>
                  </span>
                </button>
              </Transition>
              <div
                v-if="scrollRange > 1 && activeApp !== 'flashlight'"
                class="scroll-rail"
                :class="{ scrolling: scrollIndicator }"
                aria-hidden="true"
              >
                <i :style="{ height: scrollThumb + 'px', transform: 'translateY(' + scrollPosition * (300 - scrollThumb) + 'px)' }" />
              </div>
              <div
                v-if="scrollRange > 1 && scrollPosition < 0.98 && activeApp !== 'flashlight'"
                class="scroll-shade"
                aria-hidden="true"
              />
            </div>
            <div
              v-if="booting"
              class="boot-logo"
              role="status"
              aria-label="Watch booting"
            >
              <svg viewBox="0 0 80 96" aria-hidden="true">
                <path
                  d="M48 20c8-1 16-9 16-19-9 0-18 8-17 19
                  M61 23c-9-5-16 0-22 0s-14-5-23-1C0 30 2 53 12 70c5 9 10 17 17 17s9-4 17-4 10 4 17 3c8-2 14-13 18-22-20-9-17-32 0-39-5-4-12-5-20-2Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <button
              v-if="powered && asleep && !booting"
              class="sleep-cover"
              aria-label="Wake watch display"
              @click="system.wake"
            />
            <div
              v-if="!powered"
              class="powered-off"
              aria-label="Watch powered off. Press side button to start."
            />
          </div>
        </div>
      </div>
      <div class="speaker" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div class="microphone" aria-hidden="true" />
      <button
        class="hardware crown-button"
        :class="{ pressed: crown.pressed.value }"
        aria-label="Digital Crown. Press apps, double press last app, hold Siri. Drag or scroll to turn."
        title="Digital Crown: press, double press, hold, drag or scroll"
        @pointerdown="crown.pointerDown"
        @pointermove="crown.pointerMove"
        @pointerup="crown.pointerUp"
        @pointercancel="crown.pointerCancel"
        @lostpointercapture="crown.pointerCancel"
        @click="crown.click"
        @keydown="crown.keyDown"
        @keyup="crown.keyUp"
        @blur="crown.blur"
        @wheel.prevent="wheel"
      >
        <span class="digital-crown" :style="{ '--turn': crownAngle + 'deg', '--knurl': crownAngle % 8 + 'px' }">
          <i class="orange-ring" />
        </span>
      </button>
      <button
        class="hardware side-button"
        :class="{ pressed: side.pressed.value }"
        aria-label="Side button. Press Control Centre, double press Wallet, hold power controls."
        title="Side: Control Centre. Hold: power controls."
        @pointerdown="side.pointerDown"
        @pointerup="side.pointerUp"
        @pointercancel="side.pointerCancel"
        @lostpointercapture="side.pointerCancel"
        @click="side.click"
        @keydown="side.keyDown"
        @keyup="side.keyUp"
        @blur="side.blur"
      >
        <span class="physical-side" />
      </button>
      <button
        class="hardware action-button"
        :class="{ pressed: action.pressed.value }"
        :aria-label="'Action button: ' + settings.action + '. Hold two seconds for Siren.'"
        title="Action button. Hold 2 seconds for Siren."
        @pointerdown="action.pointerDown"
        @pointerup="action.pointerUp"
        @pointercancel="action.pointerCancel"
        @lostpointercapture="action.pointerCancel"
        @click="action.click"
        @keydown="action.keyDown"
        @keyup="action.keyUp"
        @blur="action.blur"
      >
        <span class="physical-action" />
      </button>
      <p class="watch-hint">Turn the crown. Explore a little.</p>
    </div>
  </div>
</template>

<style scoped src="./watch/watch.css" />
<style scoped src="./watch/shell.css" />
