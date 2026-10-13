<script setup lang="ts">
import { NEWSPAPER_COVER, NEWSPAPER_PAGES, NEWSPAPER_CLASSIFIEDS } from '~/static/newspaper.static';
const opened = useState<boolean>('isNewspaperOpen', () => false);
const dialog = ref<HTMLDialogElement>();
const sheet = ref<HTMLElement>();
const page = ref(0);
const current = computed(() => NEWSPAPER_PAGES[page.value]);
const direction = ref(1);
const enlarged = ref(false);
const coverFailed = ref(false);

function close() { opened.value = false; }
function go(index: number) {
  if (index < 0 || index >= NEWSPAPER_PAGES.length || index === page.value) return;
  direction.value = index > page.value ? 1 : -1;
  page.value = index; enlarged.value = false;
  void nextTick(() => { sheet.value?.scrollTo({ top: 0, left: 0 }); });
}
function key(event: KeyboardEvent) {
  // Letter/cursor keys belong to the crossword, never to reader pagination.
  if ((event.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); go(page.value + (event.key === 'ArrowLeft' ? -1 : 1));
  }
}
function zoomCover() {
  enlarged.value = !enlarged.value;
  void nextTick(() => sheet.value?.scrollTo({ top: 0, left: 0 }));
}
watch(opened, async value => {
  if (value) {
    page.value = 0; enlarged.value = false; coverFailed.value = false;
    await nextTick();
    if (!dialog.value?.open) dialog.value?.showModal();
    sheet.value?.scrollTo({ top: 0, left: 0 });
  } else dialog.value?.close();
});
onBeforeUnmount(() => { dialog.value?.close(); opened.value = false; });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="newspaper-reader" aria-label="The fictional fun edition newspaper"
      @cancel.prevent="close" @close="close" @click.self="close"
      @pointerdown.stop @pointerup.stop @mousedown.stop @mouseup.stop @wheel.stop
      @keydown.stop="key">
      <div class="reader-frame">
        <header class="reader-tools">
          <span class="reader-label">THE FUN EDITION <i>•</i> THREE SHEETS. SIX SIDES.</span>
          <div>
            <button v-if="page === 0" :aria-pressed="enlarged" @click="zoomCover">{{ enlarged ? 'Fit page −' : 'Read closer +' }}</button>
            <button class="close-paper" aria-label="Close newspaper" @click="close"><span class="close-label">Put it down</span><span aria-hidden="true">×</span></button>
          </div>
        </header>
        <nav class="edition-index" aria-label="Newspaper sections">
          <button v-for="(item, index) in NEWSPAPER_PAGES" :key="item.kind" :aria-current="page === index ? 'page' : undefined"
            @click="go(index)"><span>{{ String(index + 1).padStart(2, '0') }}</span> {{ item.short }}</button>
        </nav>
        <div ref="sheet" class="sheet-scroll" tabindex="0" aria-label="Newspaper page, scroll to read">
          <article :key="page" class="news-sheet" :class="[{ backwards: direction < 0, 'cover-sheet': page === 0 }, current.kind]">
            <template v-if="current.kind === 'cover'">
              <figure class="cover-image" :class="{ enlarged }">
                <img v-if="!coverFailed" :src="NEWSPAPER_COVER" width="853" height="1280" fetchpriority="low" decoding="async"
                  alt="Fictional Times of India front page: Two founders. Zero knowledge. $80 million. A black-and-white portrait of Mohith and his friend accompanies their imaginary ZKAuth funding story. The page is labelled parody and created for fun."
                  @error="coverFailed = true" />
                <div v-else class="cover-fallback"><h1>Two founders.<br>Zero knowledge.<br>$80 million.</h1><p>A fictional ZKAuth startup story, starring Mohith and his friend.</p><p>The cover image could not load. The five other pages are ready to read.</p></div>
                <figcaption>Startup dreams special · Bengaluru <span>Parody · Created for fun</span></figcaption>
              </figure>
            </template>
            <template v-else>
              <header class="paper-masthead">
                <div class="edition-line"><span>BENGALURU · EST. THIS MORNING</span><span>{{ current.section }}</span></div>
                <div class="masthead-name">The Studio Times</div>
                <div class="issue-line"><span>FICTIONAL FUN EDITION</span><span>TUESDAY, 13 OCTOBER 2026</span><b>{{ String(page + 1).padStart(2, '0') }}</b></div>
              </header>

              <template v-if="'title' in current">
                <div class="lead-heading">
                  <p class="kicker">{{ current.kicker }}</p>
                  <h1>{{ current.title }}</h1>
                  <p class="standfirst">{{ current.subtitle }}</p>
                </div>
                <figure class="editorial-figure">
                  <HomeNewspaperIllustration :kind="current.kind" />
                  <figcaption>{{ current.caption }} <span>Illustration: The Studio Times</span></figcaption>
                </figure>
                <p class="byline">{{ current.byline }}</p>
                <div class="story-columns"><p v-for="paragraph in current.paragraphs" :key="paragraph">{{ paragraph }}</p></div>
                <blockquote>{{ current.quote }}</blockquote>
                <div class="briefs">
                  <section v-for="(brief, index) in current.briefs" :key="brief.title">
                    <span class="brief-number">IN BRIEF / {{ String(index + 1).padStart(2, '0') }}</span>
                    <h2>{{ brief.title }}</h2><p>{{ brief.text }}</p>
                  </section>
                </div>
                <p class="news-ribbon">{{ current.ribbon }}</p>
              </template>

              <template v-else-if="current.kind === 'puzzles'">
                <div class="puzzle-heading">
                  <span class="puzzle-number" aria-hidden="true">05</span>
                  <div><p class="kicker">THE CHAI-BREAK CROSSWORD · NO. 001</p><h1>A little square<br>of peace & quiet.</h1><p class="standfirst">Thirteen clues. A few familiar things. Absolutely no rush.</p></div>
                </div>
                <LazyHomeNewspaperCrossword />
                <div class="puzzle-extras">
                  <section>
                    <p class="kicker">THE DAILY UNSCRAMBLE</p><h2>A six-letter essential.</h2>
                    <p class="letter-jumble" aria-label="Letters F O C F E E">F O C F E E</p><p>Clue: some of us cannot be interviewed before it.</p>
                    <details><summary>Turn for the answer</summary><p>COFFEE. The newspaper accepts chai as a lifestyle, but not as a six-letter answer.</p></details>
                  </section>
                  <section>
                    <p class="kicker">ONE FOR THE ROAD</p><h2>I have keys, but no locks.</h2>
                    <p>A space, but no room. You can enter, but you can’t go inside. What am I?</p>
                    <details><summary>Reveal the answer</summary><p>A keyboard. Please stop dropping biscuit crumbs into mine.</p></details>
                  </section>
                </div>
                <p class="news-ribbon">PUZZLE DESK / Original clues for this edition. No account, no clock, no competition.</p>
              </template>

              <template v-else>
                <div class="back-heading"><p class="kicker">SMALL NOTICES. UNREASONABLY BIG FEELINGS.</p><h1>Classified information.</h1><p class="standfirst">Everything you never knew you didn’t need.</p></div>
                <div class="classifieds">
                  <section v-for="notice in NEWSPAPER_CLASSIFIEDS" :key="notice.label">
                    <span class="notice-label">{{ notice.label }}</span><h2>{{ notice.title }}</h2><p>{{ notice.text }}</p>
                  </section>
                </div>
                <div class="comic-heading"><h2>Overengineered.</h2><span>A SMALL COMIC ABOUT A VERY SIMPLE PROBLEM</span></div>
                <HomeNewspaperIllustration kind="comic" />
                <div class="letters-desk">
                  <section><p class="kicker">LETTERS TO THE EDITOR</p><h2>“Is the $80 million real?”</h2><p>Dear reader, the funding is fictional. The ambition, friendship and questionable sleep schedule are entirely believable. This is a paper for a laugh, not a financial announcement.</p><p class="signed">— The very imaginary editorial board</p></section>
                  <section class="last-word"><p class="kicker">THE LAST WORD</p><p class="closing-line">Good news.<br>You can put<br>your phone down.</p><p>Or this paper. There’s a whole room waiting.</p></section>
                </div>
                <p class="news-ribbon">END OF EDITION / All inner-page stories, illustrations and clues are original fiction. Thanks for reading.</p>
              </template>
            </template>
          </article>
        </div>
        <footer class="reader-navigation">
          <button :disabled="page === 0" aria-label="Previous newspaper page" @click="go(page - 1)"><span aria-hidden="true">←</span> Back</button>
          <div aria-live="polite"><b>{{ current.short }} <i>·</i> {{ page + 1 }} / 6</b><span>Sheet {{ Math.floor(page / 2) + 1 }} · {{ page % 2 ? 'reverse' : 'front' }}</span></div>
          <button :disabled="page === 5" aria-label="Next newspaper page" @click="go(page + 1)">{{ page % 2 ? 'Next sheet' : 'Turn over' }} <span aria-hidden="true">→</span></button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.newspaper-reader{--paper:#f5f3ed;--ink:#232321;--rule:#b5b3a9;margin:auto;padding:0;border:0;background:transparent;color:var(--ink);width:min(960px,calc(100vw - 40px));max-width:none;max-height:none;overflow:visible}
.newspaper-reader::backdrop{background:rgb(11 13 13 / .86)}
.newspaper-reader :is(span,b,i){font-family:inherit}
.newspaper-reader :deep(::selection){color:#f5f3ed;background:#232321}
.news-sheet .puzzle-number{font-family:Georgia,'Times New Roman',serif}
.sheet-scroll{scroll-behavior:auto;overflow-x:hidden!important}.sheet-scroll:has(.enlarged){overflow-x:auto!important}
.reader-frame{display:flex;flex-direction:column;height:min(1250px,calc(100dvh - 32px));box-shadow:0 20px 100px #0009;background:var(--paper)}
.reader-tools,.reader-navigation{display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:12px;padding:6px 24px;font:10px/1.5 monospace;letter-spacing:.055em}
.reader-tools{background:#242522;color:var(--paper)}.reader-label{font-size:9px}.reader-label i{font-style:normal;margin:0 7px;color:#aaa99f}.reader-tools>div{display:flex;align-items:center;gap:24px}
button{min-height:40px;padding:5px 3px;cursor:pointer;background:none;border:0;color:inherit;font:inherit;letter-spacing:inherit}
button:hover:not(:disabled){text-decoration:underline;text-underline-offset:4px}button:focus-visible,summary:focus-visible{outline:2px solid currentColor;outline-offset:2px}button:disabled{opacity:.25;cursor:default}
.reader-tools button{font-size:11px}.close-paper{display:flex;align-items:center;gap:12px}.close-paper>span:last-child{font:27px Georgia,serif}
.edition-index{display:flex;flex-shrink:0;padding:0 24px;justify-content:space-between;border-bottom:1px solid var(--ink);gap:5px}
.edition-index button{font:11px/1.3 Georgia,serif;position:relative;min-height:42px;white-space:nowrap}.edition-index button span{font:9px monospace;color:#79796d;margin-right:5px}.edition-index button[aria-current=page]{font-weight:700}.edition-index button[aria-current=page]::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--ink)}
.sheet-scroll{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#98988e var(--paper);outline-offset:-3px}
.news-sheet{padding:24px 42px 26px;animation:page-arrive .24s ease-out;transform-origin:left center}.news-sheet.backwards{transform-origin:right center}
.news-sheet :is(h1,h2,h3,p,blockquote,summary,figcaption){font-family:Georgia,'Times New Roman',serif}
.edition-line,.issue-line{display:flex;justify-content:space-between;align-items:center;gap:15px;font:9px/1.4 Georgia,serif;letter-spacing:.04em;text-transform:uppercase}
.edition-line{padding-bottom:6px;border-bottom:1px solid var(--ink)}.edition-line>span:last-child{font-weight:700}
.masthead-name{font:700 clamp(36px,6.8vw,57px)/1.16 Georgia,'Times New Roman',serif;letter-spacing:-.055em;text-align:center;padding:5px 0 9px}
.issue-line{padding:6px 0;border-top:3px double var(--ink);border-bottom:1px solid var(--ink)}.issue-line b{font-size:11px}
.news-sheet .kicker{font:700 9px/1.5 Georgia,serif;letter-spacing:.065em;margin:0 0 9px;text-transform:uppercase}
.lead-heading{text-align:center;padding:20px 0 18px}
h1{font-size:clamp(32px,4.5vw,52px);line-height:1.02;font-weight:700;letter-spacing:-.055em;white-space:pre-line;margin:0 0 13px;text-wrap:balance}
.standfirst{font-size:17px;line-height:1.4;margin:0;font-style:italic;text-wrap:pretty}
.editorial-figure{margin:0 0 16px;border-block:1px solid var(--ink);padding:8px 0}
figcaption{font-size:10px;line-height:1.4;margin:7px 0 0;display:flex;justify-content:space-between;gap:16px}figcaption>span{font-style:italic;flex-shrink:0}
.news-sheet .byline{font-size:10px;font-weight:700;font-variant:small-caps;letter-spacing:.025em;border-bottom:1px solid var(--rule);padding-bottom:6px;margin:0 0 9px}
.story-columns{columns:2;column-gap:26px;column-rule:1px solid var(--rule)}
.story-columns p{font-size:14px;line-height:1.53;margin:0 0 9px;text-align:justify;hyphens:auto}.story-columns p:first-child::first-letter{float:left;font-size:42px;line-height:.84;padding:5px 5px 0 0;font-weight:700}
blockquote{font-size:clamp(22px,3vw,29px);font-weight:700;font-style:italic;line-height:1.18;text-align:center;letter-spacing:-.025em;border-block:3px double var(--ink);padding:13px 18px;margin:20px 0}
.briefs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.briefs section+section{border-left:1px solid var(--rule);padding-left:20px}
.brief-number,.notice-label{font:9px/1.4 monospace;letter-spacing:.075em;display:block;margin:0 0 7px}
h2{font-size:23px;line-height:1.08;font-weight:700;letter-spacing:-.03em;margin:0 0 9px}.briefs p,.classifieds p,.letters-desk p,.puzzle-extras p{font-size:14px;line-height:1.5;margin:0}
.news-sheet .news-ribbon{font:9px/1.65 monospace;letter-spacing:.025em;border-top:1px solid var(--ink);padding-top:11px;margin:22px 0 0}
.puzzle-heading{display:flex;gap:22px;align-items:center;padding:23px 0 26px}.puzzle-number{font:italic 100px/.9 Georgia,serif;letter-spacing:-.1em;border-right:1px solid var(--ink);padding-right:24px}.puzzle-heading h1{font-size:clamp(32px,4.3vw,47px);margin-bottom:9px}.puzzle-heading .standfirst{font-size:14px}
.puzzle-extras{margin-top:26px;padding-top:20px;border-top:3px double var(--ink);display:grid;grid-template-columns:1fr 1fr;gap:28px}.puzzle-extras>section+section{border-left:1px solid var(--rule);padding-left:28px}.puzzle-extras .letter-jumble{font:700 27px/1.4 Georgia,serif;letter-spacing:.2em;margin:8px 0}.puzzle-extras details{margin-top:8px}.puzzle-extras summary{font-size:12px;min-height:38px;padding:9px 0;cursor:pointer;font-style:italic}.puzzle-extras details p{font-size:13px;font-style:italic;padding-bottom:10px}
.back-heading{text-align:center;padding:25px 0 20px}.back-heading h1{font-size:clamp(34px,5vw,52px)}
.classifieds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:3px double var(--ink);border-bottom:1px solid var(--ink)}
.classifieds section{padding:16px 18px 18px 0}.classifieds section:nth-child(3n+2),.classifieds section:nth-child(3n+3){border-left:1px solid var(--rule);padding-left:18px}.classifieds section:nth-child(n+4){border-top:1px solid var(--rule)}.classifieds section:nth-child(3n){padding-right:0}.classifieds h2{font-size:22px}.notice-label{font-size:8px}
.comic-heading{display:flex;align-items:baseline;justify-content:space-between;gap:15px;padding:20px 0 10px}.comic-heading h2{font-style:italic;font-size:27px;margin:0}.comic-heading>span{font:8px/1.4 monospace;letter-spacing:.04em}
.letters-desk{display:grid;grid-template-columns:1.1fr 1fr;gap:30px;padding-top:25px}.letters-desk>section+section{border-left:1px solid var(--rule);padding-left:30px}.letters-desk .signed{font-size:12px;font-style:italic;margin-top:10px}.last-word .closing-line{font-size:36px;line-height:1;font-weight:700;letter-spacing:-.04em;margin:4px 0 10px}
.cover-sheet{padding:16px 20px 10px;min-height:100%;display:flex;justify-content:center;align-items:flex-start}
.cover-image{margin:0;max-width:100%}.cover-image img{display:block;width:auto;height:auto;max-height:calc(100dvh - 237px);max-width:100%;margin:0 auto;box-shadow:0 2px 9px #0002}.cover-image.enlarged{width:854px;max-width:none;flex-shrink:0}.cover-image.enlarged img{width:854px;max-width:none;max-height:none}.cover-image figcaption{font:9px/1.5 monospace;margin-top:9px;flex-wrap:wrap;gap:2px 16px}.cover-fallback{max-width:560px;padding:45px 25px}.cover-fallback p{font-size:17px;line-height:1.5;margin-top:25px}
.reader-navigation{border-top:1px solid var(--rule);padding-block:8px}.reader-navigation>div{text-align:center}.reader-navigation b{display:block;font-size:11px;font-weight:400}.reader-navigation i{font-style:normal;margin:0 4px}.reader-navigation>div>span{display:block;font-size:9px;color:#737367;letter-spacing:.025em}.reader-navigation>button{font-size:12px;min-width:105px}.reader-navigation>button:first-child{text-align:left}.reader-navigation>button:last-child{text-align:right}
@keyframes page-arrive{from{opacity:.5;transform:translateX(5px)}to{opacity:1;transform:none}}
@media(min-height:1282px){.cover-image img{max-height:1013px}}
@media(max-width:650px){
  .newspaper-reader{width:calc(100vw - 16px)}.reader-frame{height:calc(100dvh - 16px)}.reader-tools,.reader-navigation{padding:5px 13px}.reader-label{font-size:8px}.reader-label i,.reader-label{letter-spacing:0}.reader-tools>div{gap:14px}.reader-tools button{font-size:10px}.close-label{display:none}.reader-label{max-width:135px;line-height:1.5}.reader-label i{margin:0 2px}
  .edition-index{padding:0 12px;gap:7px;overflow:auto}.edition-index button{font-size:10px;min-height:42px}.edition-index button span{display:none}
  .news-sheet{padding:18px 20px 22px}.edition-line,.issue-line{font-size:7px;gap:8px}.edition-line>span:last-child{text-align:right}.masthead-name{font-size:37px}.lead-heading{padding:17px 0}.news-sheet .kicker{font-size:8px}h1{font-size:34px}.standfirst{font-size:15px}.story-columns{columns:1}.story-columns p{font-size:15px;line-height:1.6;text-align:left}
  figcaption{font-size:9px;display:block}figcaption>span{display:block;margin-top:3px}.briefs{grid-template-columns:1fr;gap:16px}.briefs section+section{border-left:0;border-top:1px solid var(--rule);padding:16px 0 0}.briefs p,.classifieds p,.letters-desk p,.puzzle-extras p{font-size:15px}.brief-number{font-size:8px}.briefs h2{font-size:25px}
  .puzzle-heading{gap:15px;padding:23px 0}.puzzle-number{font-size:57px;padding-right:16px;letter-spacing:-.08em}.puzzle-heading h1{font-size:28px}.puzzle-heading .standfirst{font-size:13px}
  .puzzle-extras{grid-template-columns:1fr;gap:19px}.puzzle-extras>section+section{border-left:0;border-top:1px solid var(--rule);padding:18px 0 0}
  .classifieds{grid-template-columns:1fr 1fr}.classifieds section{padding:14px 14px 16px 0!important;border:0!important}.classifieds section:nth-child(2n){border-left:1px solid var(--rule)!important;padding:14px 0 16px 14px!important}.classifieds section:nth-child(n+3){border-top:1px solid var(--rule)!important}.classifieds h2{font-size:22px}.classifieds p{font-size:14px}
  .comic-heading{display:block}.comic-heading>span{display:block;margin-top:7px;font-size:7px}.letters-desk{grid-template-columns:1fr;gap:20px}.letters-desk>section+section{border-left:0;border-top:1px solid var(--rule);padding:18px 0 0}.last-word .closing-line{font-size:33px}
  .cover-sheet{padding:10px 8px}.cover-image img{max-height:calc(100dvh - 191px)}.cover-image.enlarged{margin-right:0;margin-left:0}.cover-sheet:has(.enlarged){justify-content:flex-start}.cover-image figcaption{font-size:8px}.reader-navigation>button{font-size:11px;min-width:80px}.reader-navigation b{font-size:10px}.reader-navigation>div>span{font-size:8px}
}
@media(prefers-reduced-motion:reduce){.news-sheet{animation:none}}
</style>
