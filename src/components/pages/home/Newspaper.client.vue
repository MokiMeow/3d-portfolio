<script setup lang="ts">
import { NEWSPAPER_PAGES } from '~/static/newspaper.static';
import { drawNewspaperArt } from '~/utils/newspaper-art';
const opened = useState<boolean>('isNewspaperOpen', () => false);
const dialog = ref<HTMLDialogElement>();
const sheet = ref<HTMLElement>();
const illustration = ref<HTMLCanvasElement>();
const page = ref(0);
const current = computed(() => NEWSPAPER_PAGES[page.value]);
const direction = ref(1);
function paint() {
  const canvas = illustration.value;
  if (canvas) drawNewspaperArt(canvas.getContext('2d')!, canvas.width, canvas.height, current.value.art);
}
function close() { opened.value = false; }
function turn(step: number) {
  const next = page.value + step;
  if (next < 0 || next >= NEWSPAPER_PAGES.length) return;
  direction.value = step; page.value = next;
  void nextTick(() => { paint(); sheet.value?.scrollTo({ top: 0 }); });
}
watch(opened, async value => {
  if (value) {
    page.value = 0;
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
    paint();
  } else dialog.value?.close();
});
onBeforeUnmount(() => { dialog.value?.close(); opened.value = false; });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="newspaper-reader" aria-label="The Lab Post newspaper"
      @cancel.prevent="close" @close="close" @click.self="close"
      @pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop @wheel.stop
      @keydown.stop @keydown.left.prevent="turn(-1)" @keydown.right.prevent="turn(1)">
      <div class="reader-frame">
        <header class="reader-tools">
          <span>THE LAB POST <i> / </i> STUDIO EDITION</span>
          <button aria-label="Close newspaper" @click="close">Put it down <span aria-hidden="true">×</span></button>
        </header>
        <div ref="sheet" class="sheet-scroll">
          <article :key="page" class="news-sheet" :class="{ backwards: direction < 0 }" aria-live="polite">
            <div class="edition-line"><span>No. 01 · Mohith’s studio</span><span>{{ current.section }}</span></div>
            <h1>The Lab Post</h1>
            <div class="issue-line"><span>A small paper for a curious room</span><span>{{ String(page + 1).padStart(2, '0') }}</span></div>
            <h2>{{ current.title }}</h2>
            <p class="standfirst">{{ current.subtitle }}</p>
            <figure>
              <canvas ref="illustration" width="1200" height="600" role="img" :aria-label="current.caption" />
              <figcaption>{{ current.caption }}</figcaption>
            </figure>
            <div class="columns">
              <section v-for="article in current.articles" :key="article.title">
                <h3>{{ article.title }}</h3><p>{{ article.text }}</p>
              </section>
            </div>
            <p class="endnote">{{ current.note }}</p>
          </article>
        </div>
        <footer class="reader-navigation">
          <button :disabled="page === 0" aria-label="Previous newspaper page" @click="turn(-1)"><span aria-hidden="true">←</span> Back</button>
          <div aria-live="polite"><b>{{ page + 1 }} / 6</b><span>Sheet {{ Math.floor(page / 2) + 1 }} · {{ page % 2 ? 'reverse' : 'front' }}</span></div>
          <button :disabled="page === 5" aria-label="Next newspaper page" @click="turn(1)">{{ page % 2 ? 'Next sheet' : 'Turn over' }} <span aria-hidden="true">→</span></button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.newspaper-reader{margin:auto;padding:0;border:0;background:transparent;color:#292d29;width:min(780px,calc(100vw - 40px));max-width:none;max-height:none;overflow:visible}
.newspaper-reader::backdrop{background:rgb(11 14 14 / .82)}
.reader-frame{display:flex;flex-direction:column;height:min(1060px,calc(100dvh - 32px));box-shadow:0 24px 100px #0008}
.reader-tools,.reader-navigation{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:12px;background:#eee8db;padding:12px 24px;font:10px/1.5 monospace;letter-spacing:.07em}
.reader-tools{border-bottom:1px solid #b8b3a5}.reader-tools i{color:#9d513b;font-style:normal;margin:0 8px}
button{min-height:42px;padding:6px 3px;cursor:pointer;background:none;border:0;color:inherit;font:inherit;letter-spacing:inherit}
button:hover:not(:disabled){color:#a14d35}button:focus-visible{outline:2px solid #9d513b;outline-offset:3px}button:disabled{opacity:.25;cursor:default}
.reader-tools button{font:12px monospace;display:flex;align-items:center;gap:16px}.reader-tools button span{font:27px Georgia}
.sheet-scroll{overflow:auto;overscroll-behavior:contain;background:#eee8db;scrollbar-width:thin;scrollbar-color:#969383 #eee8db}
.news-sheet{padding:26px 42px 30px;font-family:Georgia,'Times New Roman',serif;animation:page-arrive .28s ease-out;transform-origin:left center}
.news-sheet.backwards{transform-origin:right center}
.edition-line,.issue-line{display:flex;justify-content:space-between;gap:15px;font:10px/1.4 monospace;text-transform:uppercase;letter-spacing:.05em}
.news-sheet h1,.news-sheet h2,.news-sheet h3,.standfirst,.columns p{font-family:Georgia,'Times New Roman',serif}
h1{font-size:clamp(45px,8vw,68px);line-height:1.15;letter-spacing:-.055em;text-align:center;font-weight:700;margin:8px 0 10px}
.issue-line{padding:9px 0;border-top:3px solid #292d29;border-bottom:1px solid #292d29}
h2{font-size:clamp(34px,6vw,48px);line-height:1.06;font-weight:700;letter-spacing:-.04em;text-align:center;margin:22px 0 10px}
.standfirst{text-align:center;font-style:italic;font-size:17px;line-height:1.5;margin:0 0 22px}
figure{margin:0 0 22px}canvas{display:block;width:100%;height:auto;max-height:260px;object-fit:contain;background:#ded8c9}figcaption{font:10px/1.5 monospace;margin-top:7px;color:#64685d}
.columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.columns section+section{border-left:1px solid #c0bcaf;padding-left:24px}.columns section:last-child:nth-child(3){grid-column:1/-1;border-left:0;border-top:1px solid #c0bcaf;padding:16px 0 0}
h3{font-size:21px;font-weight:700;letter-spacing:-.025em;line-height:1.15;margin:0 0 10px}.columns p{font-size:15px;line-height:1.65;margin:0;text-wrap:pretty}
.endnote{font:10px/1.8 monospace;letter-spacing:.035em;border-top:1px solid #292d29;margin:25px 0 0;padding-top:13px}
.reader-navigation{border-top:1px solid #b8b3a5}.reader-navigation>div{text-align:center}.reader-navigation b{display:block;font-size:12px}.reader-navigation>div>span{display:block;font-size:9px;letter-spacing:.03em}.reader-navigation>button{font-size:12px;min-width:102px}.reader-navigation>button:first-child{text-align:left}.reader-navigation>button:last-child{text-align:right}
@keyframes page-arrive{from{opacity:.4;transform:perspective(1300px) rotateY(-3deg) translateX(5px)}to{opacity:1;transform:none}}
@media(max-width:520px){.newspaper-reader{width:calc(100vw - 16px)}.reader-frame{height:calc(100dvh - 16px)}.reader-tools,.reader-navigation{padding:7px 16px}.reader-tools>span{font-size:8px}.reader-tools i{margin:0 3px}.reader-tools button{font-size:10px;gap:7px}.news-sheet{padding:20px 20px 24px}.edition-line,.issue-line{font-size:8px}.standfirst{font-size:15px}.columns{grid-template-columns:1fr;gap:20px}.columns section+section{border-left:0;padding-left:0}.columns p{font-size:15px}.reader-navigation>button{font-size:11px;min-width:80px}}
@media(prefers-reduced-motion:reduce){.news-sheet{animation:none}}
</style>
