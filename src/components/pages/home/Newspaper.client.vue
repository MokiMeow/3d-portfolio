<script setup lang="ts">
import { NEWSPAPER_COVER, NEWSPAPER_PAGES } from '~/static/newspaper.static';

// A page is drawn at this size and scaled to the window: the proportions of the front-page image.
const PAGE_W = 720, PAGE_H = 1080, LAST = NEWSPAPER_PAGES.length - 1, LEAVES = 3, TURN_MS = 900;
const opened = useState<boolean>('isNewspaperOpen', () => false);
const dialog = ref<HTMLDialogElement>();
const stage = ref<HTMLElement>();
const page = ref(0);
const direction = ref(1);
const rendered = ref(false);
const ready = ref(false);
const closer = ref(false);
const unfolding = ref(false);
const leaving = ref(false);
const turning = ref<number[]>([]);
const layout = reactive({ compact: false, wide: true, fit: 1, near: 1 });

const spread = computed(() => layout.wide && !closer.value);
const scale = computed(() => (closer.value ? layout.near : layout.fit));
const canZoom = computed(() => (layout.compact ? page.value === 0 : layout.near > layout.fit * 1.12));
// Leaves already turned to the left. Leaf n carries page 2n+1 on its front and 2n+2 on its back.
const flipped = computed(() => Math.ceil(page.value / 2));
const atEnd = computed(() => (spread.value ? flipped.value === LEAVES : page.value === LAST));
const shift = computed(() => {
  const w = PAGE_W * scale.value;
  if (spread.value) return flipped.value === 0 ? -w / 2 : flipped.value === LEAVES ? w / 2 : 0;
  return page.value % 2 === 0 ? -w : 0;
});
const boxStyle = computed(() => ({ width: `${(spread.value ? 2 : 1) * PAGE_W * scale.value}px`, height: `${PAGE_H * scale.value}px` }));
const bookStyle = computed(() => ({ transform: `translateX(${shift.value}px) scale(${scale.value})` }));
const inView = (index: number) => (spread.value ? index === 2 * flipped.value - 1 || index === 2 * flipped.value : index === page.value);
const nextLabel = computed(() => (layout.compact ? (page.value === 0 ? 'Open' : 'Next') : page.value === 0 ? 'Open the paper' : page.value % 2 || spread.value ? 'Next sheet' : 'Turn over'));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let turnTimer = 0, openTimer = 0, closeTimer = 0;
function go(index: number) {
  index = Math.max(0, Math.min(LAST, index));
  if (index === page.value) return;
  const from = flipped.value, to = Math.ceil(index / 2);
  direction.value = index > page.value ? 1 : -1;
  turning.value = Array.from({ length: Math.abs(to - from) }, (_, n) => Math.min(from, to) + n);
  clearTimeout(turnTimer);
  turnTimer = window.setTimeout(() => { turning.value = []; }, TURN_MS + 250);
  page.value = index; unfolding.value = false;
  if (layout.compact) closer.value = false;
  void nextTick(() => stage.value?.scrollTo({ top: 0, left: 0 }));
}
function turn(step: number) {
  // Across a spread, one turn moves a whole leaf: front page, 2-3, 4-5, back page.
  if (spread.value) go([0, 1, 3, 5][Math.max(0, Math.min(LEAVES, flipped.value + step))]);
  else go(page.value + step);
}
function leafStyle(leaf: number) {
  const turned = leaf < flipped.value;
  const moving = turning.value.indexOf(leaf);
  return {
    zIndex: (turned ? leaf + 1 : LEAVES - leaf) + (moving >= 0 ? 10 : 0),
    transitionDelay: moving > 0 ? `${(direction.value > 0 ? moving : turning.value.length - 1 - moving) * 110}ms` : '0ms',
  };
}
function toggleCloser() {
  closer.value = !closer.value;
  void nextTick(() => stage.value?.scrollTo({ top: 0, left: 0 }));
}
function measure() {
  const el = stage.value;
  if (!el) return;
  const width = el.clientWidth - 32, height = el.clientHeight - 20;
  layout.compact = window.innerWidth < 700;
  const single = Math.min(height / PAGE_H, width / PAGE_W), double = Math.min(height / PAGE_H, width / (2 * PAGE_W));
  layout.wide = double >= single * 0.8;
  layout.fit = Math.max(0.2, layout.wide ? double : single);
  layout.near = Math.max(layout.fit, Math.min(1.25, width / PAGE_W));
}
function close() {
  if (leaving.value || !opened.value) return;
  if (reducedMotion()) { opened.value = false; return; }
  leaving.value = true;
  closeTimer = window.setTimeout(() => { opened.value = false; }, 240);
}
function key(event: KeyboardEvent) {
  // Letter/cursor keys belong to the crossword, never to reader pagination.
  if ((event.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); turn(event.key === 'ArrowLeft' ? -1 : 1);
  }
}
// A sideways flick turns the page on touch screens.
let swipe: { x: number; y: number } | null = null;
function swipeStart(event: PointerEvent) {
  swipe = event.pointerType === 'touch' && !(event.target as HTMLElement).closest('input, button, summary') && !closer.value
    ? { x: event.clientX, y: event.clientY } : null;
}
function swipeEnd(event: PointerEvent) {
  if (!swipe) return;
  const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.6) turn(dx < 0 ? 1 : -1);
}
watch(opened, async value => {
  clearTimeout(openTimer); clearTimeout(closeTimer);
  if (!value) { leaving.value = false; dialog.value?.close(); return; }
  rendered.value = true; page.value = 0; closer.value = false; leaving.value = false; turning.value = []; ready.value = false;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  measure();
  stage.value?.scrollTo({ top: 0, left: 0 });
  // Hold the paper back until its front page and typeface have arrived, so it never unfolds blank.
  const cover = new Image();
  cover.src = NEWSPAPER_COVER;
  await Promise.race([
    Promise.allSettled([cover.decode(), document.fonts?.load("800 20px 'Roboto Serif'")]),
    new Promise(resolve => setTimeout(resolve, 1600)),
  ]);
  if (!opened.value) return;
  unfolding.value = !reducedMotion();
  ready.value = true;
  openTimer = window.setTimeout(() => { unfolding.value = false; }, 1700);
});
let resizeFrame = 0;
function onResize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!opened.value) return;
    measure();
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && stage.value?.contains(active))
      active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  });
}
onMounted(() => { window.addEventListener('resize', onResize); window.visualViewport?.addEventListener('resize', onResize); });
onBeforeUnmount(() => {
  cancelAnimationFrame(resizeFrame); clearTimeout(turnTimer); clearTimeout(openTimer); clearTimeout(closeTimer);
  window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize);
  dialog.value?.close(); opened.value = false;
});
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="newspaper-reader" :class="{ leaving }" aria-label="The fictional fun edition newspaper"
      @cancel.prevent="close" @close="opened = false"
      @pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop @wheel.stop @touchstart.stop @touchmove.stop @touchend.stop
      @keydown.stop="key">
      <header class="reader-bar">
        <span class="reader-label">The Fun Edition <i>·</i> <span>three sheets, six sides</span></span>
        <div>
          <button v-if="canZoom" :aria-pressed="closer" @click="toggleCloser">{{ closer ? 'Whole paper −' : 'Read closer +' }}</button>
          <button class="close-paper" aria-label="Close newspaper" @click="close"><span class="close-label">Put it down</span><span aria-hidden="true">×</span></button>
        </div>
      </header>

      <div ref="stage" class="stage" :class="{ compact: layout.compact, closer, ready }" tabindex="0" autofocus aria-label="Newspaper, scroll to read"
        @click.self="close" @pointerdown="swipeStart" @pointerup="swipeEnd" @pointercancel="swipe = null">
        <template v-if="rendered">
          <div v-if="layout.compact" class="galley" :class="{ arriving: unfolding }">
            <Transition :name="direction > 0 ? 'leaf-next' : 'leaf-back'" mode="out-in">
              <HomeNewspaperPage :key="page" :index="page" compact corners="none" :unfolding="unfolding && page === 0" />
            </Transition>
          </div>
          <div v-else class="book-box" :class="{ arriving: unfolding }" :style="boxStyle">
            <div class="book" :style="bookStyle">
              <div v-for="leaf in LEAVES" :key="leaf" class="leaf" :class="{ turned: leaf - 1 < flipped, turning: turning.includes(leaf - 1) }" :style="leafStyle(leaf - 1)">
                <div class="face front" :class="{ unfolding: unfolding && leaf === 1 }" :inert="!inView(leaf * 2 - 2)">
                  <HomeNewspaperPage :index="leaf * 2 - 2" :corners="spread ? 'outer' : 'both'" :unfolding="unfolding && leaf === 1" @turn="turn" />
                </div>
                <div class="face back" :inert="!inView(leaf * 2 - 1)">
                  <HomeNewspaperPage :index="leaf * 2 - 1" :corners="spread ? 'outer' : 'both'" @turn="turn" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <footer class="reader-bar reader-turns">
        <button :disabled="page === 0" aria-label="Previous newspaper page" @click="turn(-1)"><span aria-hidden="true">←</span> Back</button>
        <nav class="edition-index" aria-label="Newspaper sections">
          <button v-for="(item, index) in NEWSPAPER_PAGES" :key="item.kind" :aria-current="inView(index) ? 'page' : undefined" @click="go(index)">
            <span>{{ index + 1 }}</span><b>{{ item.kind === 'cover' ? 'Front' : item.kind === 'back' ? 'Back' : item.short }}</b>
          </button>
        </nav>
        <button :disabled="atEnd" aria-label="Next newspaper page" @click="turn(1)">{{ nextLabel }} <span aria-hidden="true">→</span></button>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.newspaper-reader{position:fixed;inset:var(--visual-top,0px) 0 auto;width:100%;height:var(--visual-height,100dvh);max-width:none;max-height:none;margin:0;border:0;overflow:hidden;color:#e9e6dc;
  padding:max(0px,env(safe-area-inset-top)) max(0px,env(safe-area-inset-right)) max(0px,env(safe-area-inset-bottom)) max(0px,env(safe-area-inset-left));
  background:radial-gradient(ellipse at 50% 42%,rgb(58 52 42 / .5),transparent 68%)}
.newspaper-reader[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;animation:reader-in .3s ease-out}
.newspaper-reader::backdrop{background:rgb(9 10 10 / .93);animation:reader-in .3s ease-out}
.newspaper-reader.leaving,.newspaper-reader.leaving::backdrop{opacity:0;transition:opacity .22s ease-in}
.newspaper-reader.leaving .stage{transform:translateY(26px) scale(.97);transition:transform .22s ease-in}
.newspaper-reader :is(span,b,i){font-family:inherit}

.reader-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 22px;font:500 12px/1.4 'Roboto Serif',Georgia,serif;font-stretch:90%;letter-spacing:.03em}
.reader-bar>div{display:flex;align-items:center;gap:22px}
.reader-label{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#a9a69b}.reader-label i{font-style:normal;margin:0 5px}
button{min-height:44px;padding:5px 4px;cursor:pointer;background:none;border:0;color:inherit;font:inherit;letter-spacing:inherit}
button:hover:not(:disabled){text-decoration:underline;text-underline-offset:5px}button:focus-visible{outline:2px solid currentColor;outline-offset:2px}button:disabled{opacity:.28;cursor:default}
.close-paper{display:flex;align-items:center;gap:10px}.close-paper>span:last-child{font-size:27px;line-height:1}
.reader-turns>button{min-width:128px;font-size:13px;white-space:nowrap}.reader-turns>button:first-child{text-align:left}.reader-turns>button:last-child{text-align:right}
.edition-index{display:flex;gap:4px 20px;justify-content:center;flex-wrap:wrap}
.edition-index button{position:relative;font-size:12px;color:#a9a69b;white-space:nowrap}.edition-index button span{font-size:9px;margin-right:6px;opacity:.7}.edition-index button b{font-weight:500}
.edition-index button[aria-current=page]{color:#f3f0e6}.edition-index button[aria-current=page]::after{content:'';position:absolute;left:0;right:0;bottom:8px;height:1px;background:currentColor}

.stage{min-height:0;display:flex;overflow:hidden auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#6f6c63 transparent;outline:0;touch-action:pan-x pan-y pinch-zoom;padding:10px 16px}
.stage:focus-visible{outline:0}
.stage>*{margin:auto;visibility:hidden}.stage.ready>*{visibility:visible}
.book-box{position:relative;flex-shrink:0}
.book{position:absolute;left:0;top:0;width:1440px;height:1080px;transform-origin:0 0;perspective:3200px;transition:transform .9s cubic-bezier(.5,.05,.2,1)}
/* Every leaf hinges on the fold in the middle of the spread. */
.leaf{position:absolute;left:720px;top:0;width:720px;height:1080px;transform-origin:left center;transform-style:preserve-3d;transition:transform .9s cubic-bezier(.5,.05,.2,1)}
.leaf.turned{transform:rotateY(-180deg)}
.face{position:absolute;inset:0;backface-visibility:hidden;box-shadow:0 18px 50px rgb(0 0 0 / .55),0 2px 6px rgb(0 0 0 / .4)}
.face.back{transform:rotateY(180deg)}
.face.unfolding{box-shadow:none}
/* While the front page drops open, nothing underneath may show through the fold. */
.book-box.arriving .leaf+.leaf{visibility:hidden}
.leaf.turning .face{animation:leaf-shade .9s ease-in-out}
.book-box.arriving{animation:paper-arrive .8s cubic-bezier(.2,.75,.2,1) both}
.galley{width:100%;max-width:560px;perspective:1800px}
.galley.arriving{animation:paper-arrive .8s cubic-bezier(.2,.75,.2,1) both}
.galley>:deep(.np-page){box-shadow:0 12px 40px rgb(0 0 0 / .55)}
.stage.compact{padding:6px 8px 14px;align-items:flex-start}.stage.compact>*{margin:0 auto}
.stage.compact.closer{overflow:auto}.stage.compact.closer .galley{width:854px;max-width:none;flex-shrink:0;margin:0}
.leaf-next-leave-active,.leaf-back-leave-active{transition:transform .2s ease-in,opacity .2s ease-in}.leaf-next-enter-active,.leaf-back-enter-active{transition:transform .32s cubic-bezier(.2,.7,.2,1),opacity .25s ease-out}
.leaf-next-leave-to,.leaf-back-enter-from{transform-origin:left center;transform:rotateY(-58deg);opacity:0}
.leaf-next-enter-from,.leaf-back-leave-to{transform-origin:right center;transform:rotateY(58deg);opacity:0}
@keyframes reader-in{from{opacity:0}}
@keyframes paper-arrive{from{opacity:0;transform:translateY(90px) rotate(-5deg) scale(.82)}55%{opacity:1}to{opacity:1;transform:none}}
@keyframes leaf-shade{50%{filter:brightness(.72)}}
@media(max-width:699px){
  .reader-bar{padding:0 12px}.reader-label{font-size:9px;letter-spacing:.12em}.reader-label span,.close-label{display:none}.reader-bar>div{gap:8px}
  .reader-turns>button{min-width:74px}.edition-index{gap:0;flex-wrap:nowrap}.edition-index button{min-width:30px;font-size:12px}.edition-index button b{display:none}.edition-index button span{font-size:12px;margin:0;opacity:1}.edition-index button[aria-current=page]::after{left:8px;right:8px}
}
@media(max-height:520px){.reader-bar{padding-block:0}.reader-bar button{min-height:36px}}
@media(prefers-reduced-motion:reduce){.newspaper-reader[open],.newspaper-reader::backdrop,.book-box.arriving,.galley.arriving,.leaf.turning .face{animation:none}.book,.leaf,.leaf-next-leave-active,.leaf-back-leave-active,.leaf-next-enter-active,.leaf-back-enter-active{transition:none}}
</style>
