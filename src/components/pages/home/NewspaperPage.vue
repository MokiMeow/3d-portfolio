<script setup lang="ts">
import { NEWSPAPER_COVER, NEWSPAPER_PAGES, NEWSPAPER_CLASSIFIEDS } from '~/static/newspaper.static';

/** One side of a sheet. `compact` reflows it into a single column for narrow screens. */
const props = defineProps<{ index: number; compact?: boolean; unfolding?: boolean; corners?: 'outer' | 'both' | 'none' }>();
const emit = defineEmits<{ turn: [step: number] }>();
const current = computed(() => NEWSPAPER_PAGES[props.index]);
const number = computed(() => props.index + 1);
// Odd page numbers sit on the right of a spread, even ones on the left.
const side = computed(() => (props.index % 2 === 0 ? 'right' : 'left'));
const coverFailed = ref(false);
// "CITY FORECAST  /  Cloudy…" becomes a bold label and its line.
const ribbon = computed(() => {
  const parts = ('ribbon' in current.value ? current.value.ribbon : '').split('/').map(part => part.trim());
  return { label: parts[0], text: parts.slice(1).join('  ·  ') };
});
const showPrev = computed(() => props.index > 0 && (props.corners === 'both' || (props.corners === 'outer' && side.value === 'left')));
const showNext = computed(() => props.index < NEWSPAPER_PAGES.length - 1 && (props.corners === 'both' || (props.corners === 'outer' && side.value === 'right')));
</script>

<template>
  <article class="np-page" :class="[current.kind, side, { compact, cover: current.kind === 'cover' }]">
    <template v-if="current.kind === 'cover'">
      <figure class="cover-image" :class="{ unfolding }" @click="!compact && emit('turn', 1)">
        <img v-if="!coverFailed" :src="NEWSPAPER_COVER" width="853" height="1280" decoding="async"
          alt="Fictional Times of India front page: Two founders. Zero knowledge. $80 million. A black-and-white portrait of Mohith and his friend accompanies their imaginary ZKAuth funding story. The page is labelled parody and created for fun."
          @error="coverFailed = true" />
        <div v-else class="cover-fallback"><h1>Two founders.<br>Zero knowledge.<br>$80 million.</h1><p>A fictional ZKAuth startup story, starring Mohith and his friend.</p><p>The cover image could not load. The five other pages are ready to read.</p></div>
        <!-- The paper arrives folded in half, the way it lies on the desk, and drops open. -->
        <div v-if="unfolding && !coverFailed" class="fold" aria-hidden="true">
          <div class="half upper" :style="{ backgroundImage: `url(${NEWSPAPER_COVER})` }" />
          <div class="half lower" :style="{ backgroundImage: `url(${NEWSPAPER_COVER})` }" />
        </div>
      </figure>
      <details class="cover-transcript">
        <summary>Read the front-page story as text</summary>
        <div><p class="kicker">STARTUP DREAMS SPECIAL · FICTIONAL FUN EDITION</p><h2>Two founders. Zero knowledge. $80 million.</h2><p>ZKAuth creators land $80 million in their first seed round with a new zero-knowledge proof framework.</p><p><b>BENGALURU:</b> Two young founders have turned a bold idea into a headline-making startup dream. Their zero-knowledge proof framework lets users prove who they are without handing over their secrets.</p><p>In this fictional future, an $80 million first seed round puts ZKAuth on a global stage. Built by a small team out of Bengaluru, ZKAuth aims to reimagine digital identity for a more private and open internet.</p><h3>From late-night commits to a multimillion-dollar future</h3><p>The founders believe people should be able to prove information about themselves — such as age, eligibility or account access — without revealing sensitive personal data. Their framework uses zero-knowledge proofs to make this possible.</p><blockquote>“Zero knowledge. Maximum ambition.”</blockquote><h3>Founders promise funding will not fix their sleep schedule</h3><p>Despite the $80 million boost, the founders admit their sleep schedule is unlikely to change anytime soon. “More funding, more work, same late nights,” they say.</p><p class="kicker">PARODY · FICTIONAL STARTUP NEWS · CREATED FOR FUN</p></div>
      </details>
    </template>

    <template v-else>
      <header class="folio">
        <b>{{ number }}</b>
        <span>FICTIONAL FUN EDITION <i>•</i> STARTUP DREAMS SPECIAL</span>
        <span class="dateline">BENGALURU <i>|</i> TUESDAY, OCTOBER 13, 2026</span>
      </header>
      <div class="section-band"><strong>{{ current.kind === 'back' ? 'Classifieds' : current.short }}</strong><span>{{ current.section }}</span></div>

      <template v-if="current.kind === 'tech'">
        <div class="lead-heading">
          <p class="kicker"><span>{{ current.review.kicker }}</span></p>
          <h1>{{ current.review.title }}</h1>
          <p class="deck">{{ current.review.subtitle }}</p>
        </div>
        <figure class="picture short">
          <div class="plate"><HomeNewspaperIllustration kind="tech" /></div>
          <figcaption>{{ current.review.caption }}</figcaption>
        </figure>
        <div class="review">
          <div class="review-copy">
            <p class="byline">By {{ current.review.byline }}</p>
            <p v-for="paragraph in current.review.paragraphs" :key="paragraph">{{ paragraph }}</p>
            <div class="pros-cons">
              <section><p class="box-label">Good</p><ul><li v-for="item in current.review.pros" :key="item">{{ item }}</li></ul></section>
              <section><p class="box-label">Less good</p><ul><li v-for="item in current.review.cons" :key="item">{{ item }}</li></ul></section>
            </div>
          </div>
          <aside class="verdict">
            <p class="box-label">Verdict</p>
            <p class="score"><b>{{ current.review.score }}</b><span>/ 5</span></p>
            <p class="stars" aria-label="Four and a half stars">★★★★<span>★</span></p>
            <p class="verdict-line">{{ current.review.verdict }}</p>
            <table class="specs"><tbody><tr v-for="[label, value] in current.review.specs" :key="label"><th>{{ label }}</th><td>{{ value }}</td></tr></tbody></table>
            <p class="badge">EDITOR’S PICK<br><small>for later</small></p>
          </aside>
        </div>
        <section class="patch-notes">
          <h2>{{ current.patch.title }}</h2>
          <div><section v-for="column in current.patch.columns" :key="column.label"><p class="box-label">{{ column.label }}</p><ul><li v-for="item in column.items" :key="item">{{ item }}</li></ul></section></div>
        </section>
        <p class="ribbon"><b>{{ ribbon.label }}</b>{{ ribbon.text }}</p>
      </template>

      <template v-else-if="current.kind === 'sport'">
        <div class="lead-heading">
          <p class="kicker"><span>{{ current.kicker }}</span></p>
          <h1>{{ current.title }}</h1>
          <p class="deck">{{ current.subtitle }}</p>
        </div>
        <figure class="picture short">
          <div class="plate"><HomeNewspaperIllustration kind="sport" /></div>
          <figcaption>{{ current.caption }}</figcaption>
        </figure>
        <div class="match">
          <div class="story single">
            <p class="byline">By {{ current.byline }}</p>
            <p>{{ current.paragraphs[0] }}</p>
            <h3>{{ current.subhead }}</h3>
            <p>{{ current.paragraphs[2] }}</p>
          </div>
          <section class="scorecard">
            <header><b>{{ current.scorecard.title }}</b><span>{{ current.scorecard.match }}</span></header>
            <table><tbody>
              <tr v-for="[name, runs, how] in current.scorecard.batting" :key="name"><th>{{ name }}<small>{{ how }}</small></th><td>{{ runs }}</td></tr>
              <tr class="extras"><th>{{ current.scorecard.extras[0] }}</th><td>{{ current.scorecard.extras[1] }}</td></tr>
              <tr class="total"><th>{{ current.scorecard.total[0] }}<small>{{ current.scorecard.total[2] }}</small></th><td>{{ current.scorecard.total[1] }}</td></tr>
            </tbody></table>
            <p class="bowling">{{ current.scorecard.bowling }}</p>
          </section>
        </div>
        <section class="commentary">
          <h2>Ball by ball</h2>
          <ol><li v-for="ball in current.commentary" :key="ball.over"><b>{{ ball.over }}</b><span>{{ ball.text }}</span></li></ol>
        </section>
        <p class="ribbon"><b>{{ ribbon.label }}</b>{{ ribbon.text }}</p>
      </template>

      <template v-else-if="'title' in current">
        <div class="lead-heading">
          <p class="kicker"><span>{{ current.kicker }}</span></p>
          <h1>{{ current.title }}</h1>
          <p class="deck">{{ current.subtitle }}</p>
        </div>
        <figure class="picture">
          <div class="plate"><HomeNewspaperIllustration :kind="current.kind" /></div>
          <figcaption>{{ current.caption }}</figcaption>
        </figure>
        <div class="article-body">
          <div class="story">
            <p class="byline">By {{ current.byline }}</p>
            <p v-for="paragraph in current.paragraphs.slice(0, 2)" :key="paragraph">{{ paragraph }}</p>
            <h3>{{ current.subhead }}</h3>
            <p>{{ current.paragraphs[2] }}</p>
          </div>
          <aside class="rail">
            <div class="stat"><b>{{ current.stat.figure }}</b><span>{{ current.stat.label }}</span></div>
            <blockquote><span aria-hidden="true">“</span><p>{{ current.quote }}</p></blockquote>
          </aside>
        </div>
        <div class="article-bottom index-row">
          <section class="commute">
            <h2>{{ current.commute.title }}</h2>
            <p class="commute-note">{{ current.commute.note }}</p>
            <div v-for="row in current.commute.rows" :key="row.phrase" class="commute-row">
              <span class="phrase">{{ row.phrase }}</span>
              <span class="bars">
                <i class="promised" :style="{ width: Math.max(1.5, row.promised / 60 * 100) + '%' }"><em>{{ row.promised }}</em></i>
                <i class="actual" :style="{ width: row.actual / 60 * 100 + '%' }"><em>{{ row.actual }} <small>· {{ row.truth }}</small></em></i>
              </span>
            </div>
            <p class="commute-key"><i class="promised" /> promised <i class="actual" /> actual</p>
          </section>
          <section class="brief"><h2>{{ current.briefs[2].title }}</h2><p>{{ current.briefs[2].text }}</p></section>
        </div>

        <p class="ribbon"><b>{{ ribbon.label }}</b>{{ ribbon.text }}</p>
      </template>

      <template v-else-if="current.kind === 'puzzles'">
        <div class="lead-heading puzzle-heading">
          <p class="kicker"><span>THE CHAI-BREAK CROSSWORD · NO. 001</span></p>
          <h1>A little square of peace &amp; quiet.</h1>
          <p class="deck">Thirteen clues. A few familiar things. Absolutely no rush.</p>
        </div>
        <div class="puzzle-board"><LazyHomeNewspaperCrossword /></div>
        <div class="puzzle-extras">
          <section>
            <p class="box-label">THE DAILY UNSCRAMBLE</p><h2>A six-letter essential.</h2>
            <p class="letter-jumble" aria-label="Letters F O C F E E"><span v-for="(letter, n) in 'FOCFEE'" :key="n" aria-hidden="true">{{ letter }}</span></p>
            <p>Clue: some of us cannot be interviewed before it.</p>
            <details><summary>Turn for the answer</summary><p>COFFEE. The newspaper accepts chai as a lifestyle, but not as a six-letter answer.</p></details>
          </section>
          <section>
            <p class="box-label">SPOT THE BUG</p><h2>One line. One problem.</h2>
            <pre class="bug"><code>for (let i = 0; i &lt;= cups.length; i++)
  drink(cups[i]);</code></pre>
            <details><summary>Show the fix</summary><p>It drinks one cup too many: <code>&lt;=</code> should be <code>&lt;</code>. The last cup is undefined, much like the afternoon.</p></details>
          </section>
          <section>
            <p class="box-label">ONE FOR THE ROAD</p><h2>Keys, but no locks.</h2>
            <p>Space, but no room. You can enter, but never go inside. What am I?</p>
            <details><summary>Reveal the answer</summary><p>A keyboard. Please stop dropping biscuit crumbs into mine.</p></details>
          </section>
        </div>
        <p class="ribbon"><b>PUZZLE DESK</b> Original clues for this edition. No account, no clock, no competition.</p>
      </template>

      <template v-else>
        <div class="lead-heading back-heading">
          <p class="kicker"><span>SMALL NOTICES. UNREASONABLY BIG FEELINGS.</span></p>
          <h1>Classified information.</h1>
          <p class="deck">Everything you never knew you didn’t need.</p>
        </div>
        <div class="classifieds">
          <section v-for="notice in NEWSPAPER_CLASSIFIEDS" :key="notice.label">
            <span class="box-label">{{ notice.label }}</span><h2>{{ notice.title }}</h2><p>{{ notice.text }}</p>
          </section>
        </div>
        <div class="comic">
          <div class="comic-heading"><h2>Overengineered.</h2><span>A SMALL COMIC ABOUT A VERY SIMPLE PROBLEM</span></div>
          <HomeNewspaperIllustration kind="comic" />
        </div>
        <div class="letters-desk">
          <section><p class="box-label">LETTERS TO THE EDITOR</p><h2>“Is the $80 million real?”</h2><p>Dear reader, the funding is fictional. The ambition, friendship and questionable sleep schedule are entirely believable. This is a paper for a laugh, not a financial announcement.</p><p class="signed">— The very imaginary editorial board</p></section>
          <section class="last-word"><p class="box-label">THE LAST WORD</p><p class="closing-line">Good news. You can put your phone down.</p><p>Or this paper. There’s a whole room waiting.</p></section>
        </div>
        <p class="ribbon"><b>END OF EDITION</b> All inner-page stories, illustrations and clues are original fiction. Thanks for reading.</p>
      </template>
    </template>

    <button v-if="showPrev" class="corner prev" aria-label="Turn back a page" @click="emit('turn', -1)" />
    <button v-if="showNext" class="corner next" aria-label="Turn the page" @click="emit('turn', 1)" />
  </article>
</template>

<style scoped>
@font-face{font-family:'Roboto Serif';font-style:normal;font-weight:400 900;font-stretch:50% 100%;font-display:swap;src:url('/newspaper/fonts/roboto-serif.woff2') format('woff2')}

/* A page is drawn at a fixed 720 x 1080 and scaled by the reader, so it keeps the front page's proportions. */
.np-page{--paper:#e9e8e2;--ink:#1c1b18;--rule:#8f8c82;--tint:#d9d6cc;position:relative;width:720px;height:1080px;padding:26px 32px 24px;display:flex;flex-direction:column;overflow:hidden;color:var(--ink);
  font:400 13.5px/1.42 'Roboto Serif','Times New Roman',Times,serif;font-stretch:86%;font-optical-sizing:auto;text-rendering:optimizeLegibility;
  background-color:var(--paper);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .13 0 0 0 0 .12 0 0 0 0 .1 0 0 0 .42 -.13'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.011' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .2 0 0 0 0 .18 0 0 0 0 .14 0 0 0 .22 -.08'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23b)'/%3E%3C/svg%3E")}
/* The site sets its own typeface on every element; the paper keeps its own. */
.np-page :deep(*){font-family:inherit}
.np-page :deep(::selection){color:var(--paper);background:var(--ink)}
/* Creases where the paper was folded, and a little shade toward the edges. */
.np-page:not(.cover):not(.compact)::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:3;
  background:linear-gradient(180deg,transparent calc(50% - 2px),rgb(0 0 0 / .07) calc(50% - .5px),rgb(255 255 255 / .28) calc(50% + 1px),transparent calc(50% + 4px)),radial-gradient(ellipse at 50% 45%,transparent 58%,rgb(52 44 28 / .13) 100%)}
.np-page.left:not(.compact)::before,.np-page.right:not(.compact)::before{content:'';position:absolute;top:0;bottom:0;width:46px;pointer-events:none;z-index:3}
.np-page.left:not(.compact)::before{right:0;background:linear-gradient(90deg,transparent,rgb(0 0 0 / .13))}
.np-page.right:not(.compact)::before{left:0;background:linear-gradient(270deg,transparent,rgb(0 0 0 / .13))}
.np-page.cover.right::before{width:22px;opacity:.6}
p,h1,h2,h3,figure,blockquote{margin:0}

.folio{display:flex;align-items:baseline;gap:14px;padding-bottom:6px;border-bottom:1px solid var(--ink);font-size:8.5px;line-height:1.3;letter-spacing:.09em;font-stretch:100%}
.folio b{font-size:15px;line-height:1;font-weight:800;letter-spacing:0}.folio i{font-style:normal;margin:0 4px}.folio .dateline{margin-left:auto}
.right .folio{flex-direction:row-reverse}.right .folio .dateline{margin-left:0;margin-right:auto}
.section-band{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-top:3px;padding:7px 0 6px;border-top:3px solid var(--ink);border-bottom:1px solid var(--ink)}
.section-band strong{font-size:30px;line-height:.9;font-weight:900;font-stretch:58%;letter-spacing:.015em;text-transform:uppercase}
.section-band span{font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-stretch:100%}
.right .section-band{flex-direction:row-reverse}

.lead-heading{padding:14px 0 12px}
.kicker{font-size:10.5px;line-height:1.3;font-weight:700;letter-spacing:.07em;text-transform:uppercase;font-stretch:92%;margin-bottom:7px}
.kicker span{border-bottom:1.5px solid var(--ink);padding-bottom:2px}
h1{font-size:58px;line-height:.96;font-weight:800;font-stretch:56%;letter-spacing:-.012em;white-space:pre-line;text-wrap:balance}
.deck{font-size:19px;line-height:1.2;font-weight:500;font-stretch:72%;margin-top:9px;text-wrap:pretty}

.picture{flex:1;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--ink);padding-top:10px}
.plate{position:relative;flex:1;min-height:170px;border:1px solid var(--ink);overflow:hidden}.plate :deep(svg){position:absolute;inset:0;width:100%;height:100%}
figcaption{font-size:10.5px;line-height:1.35;padding:6px 0 0;font-stretch:82%}
.article-body{display:grid;grid-template-columns:minmax(0,1fr) 158px;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--rule)}
.story{columns:2;column-gap:16px;column-rule:1px solid var(--rule)}
.story p{font-size:13px;text-align:justify;hyphens:auto;margin-bottom:6px;orphans:2;widows:2}
.story .byline{font-size:9px;line-height:1.3;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:left;padding-bottom:5px;margin-bottom:7px;border-bottom:1px solid var(--rule);font-stretch:92%;hyphens:manual}
.story .byline+p::first-letter{float:left;font-size:44px;line-height:.82;font-weight:800;font-stretch:62%;padding:3px 5px 0 0}
.story h3{font-size:20px;line-height:1.02;font-weight:800;font-stretch:58%;margin:9px 0 6px;padding-top:7px;border-top:1px solid var(--ink);break-after:avoid;text-wrap:balance}
.rail{display:flex;flex-direction:column;gap:10px;border-left:1px solid var(--rule);padding-left:15px;min-height:0}
.stat{border-top:3px solid var(--ink);border-bottom:1px solid var(--ink);padding:7px 0 8px}
.stat b{display:block;font-size:50px;line-height:.86;font-weight:900;font-stretch:50%;letter-spacing:-.01em;white-space:nowrap}
.stat span{display:block;margin-top:6px;font-size:10px;line-height:1.25;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-stretch:88%}
blockquote span{display:block;height:34px;font-size:78px;line-height:1;font-weight:900;font-stretch:70%}
blockquote p{font-size:23px;line-height:1.04;font-weight:800;font-stretch:58%;text-wrap:balance}
.article-bottom{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:12px;padding-top:11px;border-top:3px double var(--ink)}
.article-bottom .brief+.brief{border-left:1px solid var(--rule);padding-left:15px;margin-left:-1px}
.brief h2{font-size:21px;line-height:1.02;font-weight:800;font-stretch:58%;margin-bottom:5px;text-wrap:balance}
.brief p{font-size:12.5px;line-height:1.4}
/* City: the commute index, a small bar chart set like a newspaper graphic. */
.index-row{grid-template-columns:minmax(0,1.9fr) minmax(0,1fr)}
.index-row .brief{border-left:1px solid var(--rule);padding-left:15px}
.index-row .brief .second{margin-top:10px;padding-top:9px;border-top:1px solid var(--rule)}
.commute h2{font-size:22px;line-height:1;font-weight:900;font-stretch:56%;text-transform:uppercase;letter-spacing:.02em}
.commute-note{font-size:10.5px;line-height:1.3;margin:3px 0 7px;font-style:italic}
.commute-row{display:grid;grid-template-columns:112px minmax(0,1fr);align-items:center;gap:8px;padding:2px 0;border-top:1px dotted var(--rule)}
.phrase{font-size:11.5px;line-height:1.1;font-weight:700;white-space:nowrap}
.bars em small{font-size:9px;font-weight:400;font-style:italic;white-space:nowrap}
.bars{display:grid;gap:2px}
.bars i,.commute-key i{display:block;height:7px;position:relative}
.bars .promised,.commute-key .promised{border:1px solid var(--ink);background:repeating-linear-gradient(135deg,transparent 0 2px,rgb(28 27 24 / .35) 2px 3px)}
.bars .actual,.commute-key .actual{background:var(--ink)}
.bars em{position:absolute;left:calc(100% + 4px);top:50%;transform:translateY(-50%);font-style:normal;font-size:9.5px;font-weight:700;line-height:1;white-space:nowrap}
.commute-key{display:flex;align-items:center;gap:5px;margin-top:6px;font-size:9px;letter-spacing:.06em;text-transform:uppercase}.commute-key i{width:18px;margin-left:6px}

/* Tech: a hands-on review. */
.picture.short{flex:0 0 172px}.picture.short .plate{min-height:0}
.review{display:grid;grid-template-columns:minmax(0,1fr) 214px;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--rule);flex:1;min-height:0}
.review-copy p{font-size:13px;text-align:justify;hyphens:auto;margin-bottom:6px}
.review-copy .byline,.match .byline{font-size:9px;line-height:1.3;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:left;padding-bottom:5px;margin-bottom:7px;border-bottom:1px solid var(--rule);font-stretch:92%}
.review-copy .byline+p::first-letter,.match .byline+p::first-letter{float:left;font-size:44px;line-height:.82;font-weight:800;font-stretch:62%;padding:3px 5px 0 0}
.pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;padding-top:8px;border-top:3px double var(--ink)}
.pros-cons ul,.patch-notes ul{margin:0;padding:0;list-style:none}
.pros-cons li,.patch-notes li{position:relative;padding-left:14px;font-size:12px;line-height:1.3;margin-bottom:4px}
.pros-cons section:first-child li::before{content:'+';position:absolute;left:0;font-weight:900}
.pros-cons section:last-child li::before{content:'–';position:absolute;left:0;font-weight:900}
.verdict{position:relative;border-left:1px solid var(--rule);padding-left:15px;display:flex;flex-direction:column}
.score{display:flex;align-items:baseline;gap:5px;border-top:3px solid var(--ink);padding-top:4px}.score b{font-size:64px;line-height:.86;font-weight:900;font-stretch:50%}.score span{font-size:16px;font-weight:700}
.stars{font-size:21px;letter-spacing:2px;margin:2px 0 6px}.stars span{opacity:.3}
.verdict-line{font-size:17px;line-height:1.05;font-weight:800;font-stretch:60%;padding-bottom:8px;border-bottom:1px solid var(--ink);text-wrap:balance}
.specs{width:100%;border-collapse:collapse;margin-top:6px}
.specs th,.specs td{font-size:11px;line-height:1.25;padding:4px 0;border-bottom:1px dotted var(--rule);text-align:left;vertical-align:top}
.specs th{font-weight:400;font-style:italic;padding-right:6px;white-space:nowrap}.specs td{font-weight:800;text-align:right}
.badge{position:absolute;right:0;top:20px;width:66px;height:66px;font-size:9px!important;border-radius:50%;border:2px solid var(--ink);display:grid;place-content:center;text-align:center;font-size:11px;line-height:1.05;font-weight:900;letter-spacing:.06em;transform:rotate(-9deg);box-shadow:inset 0 0 0 3px var(--paper),inset 0 0 0 4px var(--ink)}
.badge small{font-size:9px;font-weight:600;font-style:italic;letter-spacing:0}
.patch-notes{margin-top:10px;padding-top:9px;border-top:3px double var(--ink)}
.patch-notes h2{font-size:22px;line-height:1;font-weight:900;font-stretch:56%;text-transform:uppercase;margin-bottom:6px}
.patch-notes>div{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.patch-notes>div>section+section{border-left:1px solid var(--rule);padding-left:13px}
.patch-notes li::before{content:'·';position:absolute;left:3px;font-weight:900}

/* Weekend: a match report with a scorecard. */
.match{display:grid;grid-template-columns:minmax(0,1fr) 262px;gap:16px;margin-top:10px;padding-top:10px;border-top:1px solid var(--rule);flex:1;min-height:0}
.story.single{columns:1}
.scorecard{border:1px solid var(--ink);padding:8px 10px;align-self:start}
.scorecard header{display:flex;flex-direction:column;border-bottom:3px solid var(--ink);padding-bottom:5px;margin-bottom:3px}
.scorecard header b{font-size:21px;line-height:1;font-weight:900;font-stretch:56%;text-transform:uppercase}
.scorecard header span{font-size:9px;letter-spacing:.08em;text-transform:uppercase;margin-top:2px}
.scorecard table{width:100%;border-collapse:collapse}
.sport .picture.short{flex-basis:205px}
.scorecard th,.scorecard td{text-align:left;padding:2px 0;border-bottom:1px dotted var(--rule);vertical-align:top}
.scorecard th{font-size:12px;font-weight:700;line-height:1.1}.scorecard th small{display:block;font-size:9.5px;font-weight:400;font-style:italic}
.scorecard td{font-size:17px;font-weight:900;font-stretch:60%;text-align:right;padding-left:6px}
.scorecard .extras th{font-weight:400}
.scorecard .total th,.scorecard .total td{border-top:2px solid var(--ink);border-bottom:0;padding-top:5px}.scorecard .total td{font-size:24px}
.bowling{font-size:10.5px;line-height:1.3;margin-top:6px;padding-top:5px;border-top:1px solid var(--rule)}
.commentary{margin-top:10px;padding-top:8px;border-top:3px double var(--ink)}
.commentary h2{font-size:22px;line-height:1;font-weight:900;font-stretch:56%;text-transform:uppercase;margin-bottom:5px}
.commentary ol{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.commentary li{display:flex;flex-direction:column;gap:3px;font-size:11.5px;line-height:1.3}
.commentary li+li{border-left:1px solid var(--rule);padding-left:9px}
.commentary b{font-size:18px;line-height:1;font-weight:900;font-stretch:56%}

.bug,.puzzle-extras code{font-variant-ligatures:none;font-feature-settings:"calt" 0,"liga" 0}
.bug{margin:4px 0 2px;padding:7px 8px;border:1px dashed var(--ink);font:600 11px/1.35 'Cascadia Code',Consolas,monospace;white-space:pre;overflow:hidden}
.puzzle-extras code{font-family:'Cascadia Code',Consolas,monospace;font-size:.95em}

.ribbon{margin-top:12px;padding-top:7px;border-top:1px solid var(--ink);font-size:9px;line-height:1.4;letter-spacing:.07em;text-transform:uppercase;font-stretch:96%;text-align:center}
.ribbon b{margin-right:8px}

.puzzle-heading{padding:10px 0 8px}.puzzle-heading h1{font-size:42px;white-space:normal}.back-heading h1{font-size:58px;white-space:normal}
.puzzle-board{flex:1;min-height:0;border-top:1px solid var(--ink);padding-top:10px}
/* On the printed sheet the crossword is set tighter than its phone layout. */
.np-page:not(.compact) .puzzle-board :deep(.puzzle-layout){grid-template-columns:388px minmax(0,1fr);gap:18px}
.np-page:not(.compact) .puzzle-board :deep(.grid-instruction){font-size:11px;margin-bottom:7px}
.np-page:not(.compact) .puzzle-board :deep(.current-clue){min-height:56px;padding:8px 0;font-size:13px;gap:3px}
.np-page:not(.compact) .puzzle-board :deep(.puzzle-tools button){min-height:34px}
.np-page:not(.compact) .puzzle-board :deep(.puzzle-status){min-height:0;margin:8px 0 4px;font-size:12px;line-height:1.35}
.np-page:not(.compact) .puzzle-board :deep(.keyboard-note){font-size:9px;line-height:1.45}
.np-page:not(.compact) .puzzle-board :deep(.clue-columns){gap:9px}
.np-page:not(.compact) .puzzle-board :deep(.clue-columns h3){font-size:16px;padding:3px 0;margin-bottom:3px}
.np-page:not(.compact) .puzzle-board :deep(.clue-columns button){font-size:12.5px;line-height:1.25;min-height:0;padding:5px 4px}
.puzzle-extras{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:16px;margin-top:10px;padding-top:12px;border-top:3px double var(--ink)}
.puzzle-extras section{border:1px solid var(--ink);padding:7px 10px 0}
.box-label{display:block;font-size:9px;line-height:1.3;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-stretch:96%;margin-bottom:5px}
.puzzle-extras h2{font-size:18px!important}
.puzzle-extras h2,.classifieds h2,.letters-desk h2{font-size:22px;line-height:1.02;font-weight:800;font-stretch:58%;margin-bottom:5px}
.puzzle-extras p{font-size:11.5px;line-height:1.3}
.puzzle-extras details summary{min-height:26px;padding:5px 0}
.letter-jumble{display:flex;gap:3px;margin:4px 0 5px}.letter-jumble span{width:22px;height:22px;border:1px solid var(--ink);display:grid;place-items:center;font-size:15px;font-weight:800;font-stretch:80%}
details summary{font-size:11.5px;min-height:32px;padding:8px 0;cursor:pointer;font-weight:600;text-decoration:underline;text-underline-offset:3px}
details summary:focus-visible,.corner:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.puzzle-extras details p{padding-bottom:8px}

.classifieds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:3px solid var(--ink);border-bottom:1px solid var(--ink)}
.classifieds section{padding:11px 13px 12px}.classifieds section:nth-child(3n+1){padding-left:0}.classifieds section:nth-child(3n){padding-right:0}
.classifieds section:not(:nth-child(3n+1)){border-left:1px solid var(--rule)}.classifieds section:nth-child(n+4){border-top:1px solid var(--rule)}
.classifieds .box-label{display:inline-block;background:var(--ink);color:var(--paper);padding:2px 6px;margin-bottom:7px}
.classifieds p,.letters-desk p{font-size:12.5px;line-height:1.38}
.comic{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:12px 0}
.comic-heading{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding-bottom:9px}
.comic-heading h2{font-size:30px;line-height:1;font-weight:900;font-stretch:56%}.comic-heading span{font-size:8.5px;letter-spacing:.12em;font-stretch:100%}
.letters-desk{display:grid;grid-template-columns:1.25fr 1fr;gap:16px;padding-top:12px;border-top:3px double var(--ink)}
.letters-desk>section+section{border-left:1px solid var(--rule);padding-left:16px}
.letters-desk .signed{font-size:11px;margin-top:6px;font-weight:600}
.last-word .closing-line{font-size:33px;line-height:.98;font-weight:900;font-stretch:54%;margin:2px 0 7px;text-wrap:balance}

/* Front page: the supplied image, edge to edge. */
.np-page.cover{padding:0;background:none}
.cover-image{position:relative;width:100%;height:100%;cursor:pointer}.compact .cover-image{cursor:auto}
.cover-image img{display:block;width:100%;height:100%;object-fit:fill}
.cover-image.unfolding img{visibility:hidden}
.cover-fallback{height:100%;padding:90px 60px;background:var(--paper)}.cover-fallback p{font-size:18px;margin-top:22px}
.fold{position:absolute;inset:0;perspective:1700px}
.half{position:absolute;left:0;right:0;height:50%;background-size:100% 200%;background-repeat:no-repeat}
.half.upper{top:0;background-position:top;z-index:1;box-shadow:0 14px 40px rgb(0 0 0 / .5)}
.half.lower{top:50%;background-position:bottom;transform-origin:top;backface-visibility:hidden;animation:unfold .95s .42s cubic-bezier(.3,.72,.2,1) both;box-shadow:0 14px 40px rgb(0 0 0 / .5)}
.half.lower::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgb(0 0 0 / .55),rgb(0 0 0 / .2));animation:unshade .95s .42s ease-out both}
@keyframes unfold{from{transform:rotateX(-176deg)}72%{transform:rotateX(7deg)}to{transform:none}}
@keyframes unshade{from{opacity:1}to{opacity:0}}
/* The transcript is for screen readers on the printed sheet, and a normal disclosure on a phone. */
.cover-transcript{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}

/* Corners lift a little when the pointer is near, and turn the page. */
.corner{position:absolute;bottom:0;width:58px;height:58px;padding:0;border:0;background:none;cursor:pointer;z-index:4}
.corner::before{content:'';position:absolute;bottom:0;width:0;height:0;transition:width .22s ease,height .22s ease;filter:drop-shadow(-2px -2px 3px rgb(0 0 0 / .28))}
.corner.next{right:0}.corner.next::before{right:0;background:linear-gradient(315deg,#0c0d0d 0 50%,#c9c6bc 50%,#f1efe8 62%,#dedbd1 100%)}
.corner.prev{left:0}.corner.prev::before{left:0;background:linear-gradient(45deg,#0c0d0d 0 50%,#c9c6bc 50%,#f1efe8 62%,#dedbd1 100%);filter:drop-shadow(2px -2px 3px rgb(0 0 0 / .28))}
.corner::before{width:13px;height:13px}.corner:hover::before,.corner:focus-visible::before{width:44px;height:44px}

/* Narrow screens: the same paper as one long column, sized to read without zooming. */
.np-page.compact{width:100%;height:auto;min-height:100%;padding:16px 16px 26px;overflow:visible;font-size:15.5px;line-height:1.5;font-stretch:90%}
.compact.cover{padding:0;min-height:0}
.compact .cover-image{height:auto}.compact .cover-image img{height:auto}
.compact .cover-transcript{position:static;width:auto;height:auto;overflow:visible;clip-path:none;background:var(--paper);padding:0 16px;border-top:1px solid var(--rule)}
.compact .cover-transcript summary{min-height:48px;padding:14px 0;font-size:15px}.compact .cover-transcript div{padding:0 0 22px}
.compact .cover-transcript p{margin:12px 0;font-size:16px;line-height:1.55}.compact .cover-transcript :is(h2,h3){font-weight:800;font-stretch:60%;line-height:1.05;margin-top:18px}.compact .cover-transcript h2{font-size:32px}.compact .cover-transcript h3{font-size:23px}
.compact .cover-transcript blockquote{display:block;padding:12px 14px;font-weight:800;font-size:20px;font-stretch:64%;margin:16px 4px}
.compact .folio{flex-wrap:wrap;gap:2px 10px;font-size:8px;letter-spacing:.06em;flex-direction:row}.compact .folio .dateline{margin:0 0 0 auto}
.compact .section-band{flex-direction:row}.compact .section-band strong{font-size:27px}.compact .section-band span{font-size:8px;letter-spacing:.1em;text-align:right}
.compact h1{font-size:clamp(40px,12.5vw,58px);white-space:normal}.compact .deck{font-size:18px}
.compact .picture{display:block}.compact .plate{min-height:0;aspect-ratio:760/300}.compact figcaption{font-size:12px}
.compact .article-body{display:block}.compact .story{columns:1}.compact .story p{font-size:15.5px;text-align:left;hyphens:manual;margin-bottom:10px}.compact .story h3{font-size:25px;margin:14px 0 8px;padding-top:10px}.compact .story .byline{font-size:9.5px}
.compact .rail{border-left:0;padding:0;margin-top:14px;gap:14px}.compact .stat{display:flex;align-items:center;gap:14px}.compact .stat b{font-size:58px}.compact .stat span{margin:0;font-size:11px}
.compact blockquote{border-bottom:1px solid var(--ink);padding-bottom:14px}.compact blockquote p{font-size:30px}
.compact .article-bottom{display:block;margin-top:16px}.compact .article-bottom .brief{margin:0;padding:14px 0}.compact .article-bottom .brief+.brief{border-left:0;border-top:1px solid var(--rule);margin:0;padding-left:0}
.compact .brief h2{font-size:26px}.compact .brief p{font-size:15.5px;line-height:1.5}
.compact .ribbon{font-size:9px;margin-top:18px;text-align:left}
.compact .puzzle-extras,.compact .letters-desk{grid-template-columns:1fr}.compact .puzzle-extras p,.compact .classifieds p,.compact .letters-desk p{font-size:15.5px;line-height:1.5}
.compact details summary{font-size:14px;min-height:44px;padding:13px 0}
.compact :is(.puzzle-extras,.classifieds,.letters-desk) h2{font-size:26px}
.compact .classifieds{grid-template-columns:1fr}.compact .classifieds section{padding:14px 0!important;border-left:0!important}.compact .classifieds section+section{border-top:1px solid var(--rule)}
.compact .comic{padding:16px 0}.compact .comic-heading{display:block}.compact .comic-heading span{display:block;margin-top:5px;font-size:8px}
.compact .letters-desk>section+section{border-left:0;border-top:1px solid var(--rule);padding:14px 0 0}.compact .last-word .closing-line{font-size:38px}
.compact .index-row,.compact .review,.compact .match,.compact .pros-cons,.compact .patch-notes>div{display:block}
.compact .index-row .brief,.compact .verdict{border-left:0;padding:14px 0 0;margin-top:12px;border-top:1px solid var(--rule)}
.compact .commute-row{grid-template-columns:120px minmax(0,1fr)}.compact .phrase{font-size:14px}.compact .commute-note{font-size:13px}
.compact .picture.short{flex:none}
.compact .review-copy p{font-size:15.5px;text-align:left;hyphens:manual}
.compact .pros-cons li,.compact .patch-notes li{font-size:15px}.compact .pros-cons section+section,.compact .patch-notes>div>section+section{border-left:0;padding:10px 0 0}
.compact .specs th,.compact .specs td{font-size:14px}.compact .badge{margin-top:14px}
.compact .scorecard{margin-top:14px}.compact .scorecard th{font-size:15px}.compact .scorecard th small{font-size:12px}
.compact .commentary ol{grid-template-columns:1fr}.compact .commentary li{font-size:15px}.compact .commentary li+li{border-left:0;padding:8px 0 0;border-top:1px solid var(--rule)}
.compact .bug{font-size:13px;white-space:pre-wrap}
.compact .corner{display:none}
@media(prefers-reduced-motion:reduce){.half.lower,.half.lower::after{animation:none}.corner::before{transition:none}}
</style>
