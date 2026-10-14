<script setup lang="ts">
import { vHover } from '../../kit/hover';
import YtIcon from '../../youtube/YtIcon.vue';
const props = defineProps<{ kind: string; query: string; reader: boolean; find: string; matchIndex: number }>();
const emit = defineEmits<{ navigate: [url: string]; matches: [count: number] }>();
const page = ref<HTMLElement | null>(null);
const vote = ref(128);
const voted = ref(false);
const savedAnswer = ref(false);
const exhibit = ref(0);
const results = computed(() => [
  { title: props.query + ': the practical guide', url: 'lab://stack', line: 'A carefully simulated answer. It works on someone’s machine.' },
  { title: 'The Daily Commit: ' + props.query, url: 'lab://news', line: 'News from the fictional technology desk. All the updates, none of the urgency.' },
  { title: '404 Museum: lost in ' + props.query, url: 'lab://museum', line: 'A collection of things that were here a minute ago.' },
  { title: 'Mohith’s Portfolio', url: 'https://smohith.vercel.app', line: 'Open the real portfolio inside this window.' },
]);
const news = [
  { section: 'TECHNOLOGY', title: 'Developer closes 47 tabs, discovers an eighth browser window', line: 'Sources describe the remaining tabs as “essential”.' },
  { section: 'CULTURE', title: 'Local rubber duck promoted to senior listener', line: 'The interview consisted entirely of patient silence.' },
  { section: 'SCIENCE', title: 'Researchers confirm tea tastes better after the build passes', line: 'A controlled trial is waiting for CI.' },
];
const exhibits = ['The Missing Semicolon', 'The Disappearing Documentation', 'The Route That Was Promised'];
const exhibitText = computed(() => [
  'JavaScript, mixed feelings. Artist unknown.',
  'An empty frame. The README was last seen in a different branch.',
  'A destination with excellent intentions and no handler.',
][exhibit.value] ?? '');
let highlights: HTMLElement[] = [];
let replacements: { original: Text; nodes: ChildNode[] }[] = [];
function clearHighlights(): void {
  for (const replacement of replacements) {
    const first = replacement.nodes[0];
    if (first?.parentNode) first.parentNode.insertBefore(replacement.original, first);
    replacement.nodes.forEach(node => node.parentNode?.removeChild(node));
  }
  replacements = [];
  highlights = [];
}
function findText(): void {
  clearHighlights();
  if (!page.value || !props.find.trim()) { emit('matches', 0); return; }
  const term = props.find.toLowerCase();
  const walker = document.createTreeWalker(page.value, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest('button, input, svg, mark')) nodes.push(node);
  }
  for (const node of nodes) {
    const value = node.textContent ?? '';
    const lower = value.toLowerCase();
    let index = lower.indexOf(term);
    if (index < 0) continue;
    const fragment = document.createDocumentFragment();
    let start = 0;
    while (index >= 0) {
      fragment.append(document.createTextNode(value.slice(start, index)));
      const mark = document.createElement('mark');
      mark.textContent = value.slice(index, index + term.length);
      fragment.append(mark); highlights.push(mark);
      start = index + term.length;
      index = lower.indexOf(term, start);
    }
    fragment.append(document.createTextNode(value.slice(start)));
    replacements.push({ original: node, nodes: Array.from(fragment.childNodes) });
    node.replaceWith(fragment);
  }
  emit('matches', highlights.length);
  focusMatch();
}
function focusMatch(): void {
  highlights.forEach((mark, i) => mark.classList.toggle('current-match', i === props.matchIndex));
  highlights[props.matchIndex]?.scrollIntoView({ block: 'center', behavior: 'auto' });
}
watch(() => [props.find, props.kind, props.query, exhibit.value], () => void nextTick(findText));
watch(() => props.matchIndex, focusMatch);
onMounted(findText);
onBeforeUpdate(clearHighlights);
onUpdated(findText);
onBeforeUnmount(clearHighlights);
</script>
<template>
  <article ref="page" class="built-page" :class="[kind, { reader }]">
    <div class="simulated-label">POCKET LAB · SIMULATED WEB PAGE</div>
    <template v-if="kind === 'search'">
      <header class="search-header"><b>Search, without the side quest.</b><p>Results for <strong>{{ query }}</strong></p></header>
      <p class="result-count">{{ results.length }} built-in results · About as fast as a local function.</p>
      <div v-for="result in results" :key="result.url" class="search-result">
        <span>{{ result.url.startsWith('lab:') ? 'Pocket Lab / demo' : 'smohith.vercel.app' }}</span>
        <button v-hover class="result-link" @click="emit('navigate', result.url)">{{ result.title }}</button><p>{{ result.line }}</p>
      </div>
    </template>
    <template v-else-if="kind === 'stack'">
      <header class="stack-logo"><YtIcon name="comment" />Stack Underflow <small>A fictional Q&amp;A corner</small></header>
      <h1>Why does it work locally but not in production?</h1>
      <p class="byline">Asked just now · Viewed by at least one rubber duck</p>
      <div class="question"><span class="vote-count">{{ vote }}</span><div>
        <p>I changed nothing. Except the environment variables, runtime version, dependencies and deployment region. Any ideas?</p>
        <span class="tag">deployment</span><span class="tag">works-on-my-machine</span>
      </div></div>
      <h2>1 extremely patient answer</h2>
      <div class="answer"><span class="accepted"><YtIcon name="check" /></span><div>
        <h3>The environment is part of the program.</h3>
        <p>Start with the first failing request. Check the runtime version, required configuration and build output. Compare one difference at a time.</p>
        <pre><code>reproduce → isolate → change one thing → verify</code></pre>
        <p>Restarting the server is a diagnostic step. Restarting your career is probably unnecessary.</p>
        <div class="page-actions">
          <button v-hover class="page-button" :aria-pressed="voted" @click="voted = !voted; vote += voted ? 1 : -1"><YtIcon :name="voted ? 'check' : 'up'" />Helpful</button>
          <button v-hover class="page-button" :aria-pressed="savedAnswer" @click="savedAnswer = !savedAnswer">{{ savedAnswer ? 'Saved for this session' : 'Save answer' }}</button>
        </div>
      </div></div>
    </template>
    <template v-else-if="kind === 'news'">
      <header class="news-logo"><small>ALL THE NEWS THAT FITS IN A WINDOW</small><h1>The Daily Commit</h1><span>Fictional edition · No breaking changes</span></header>
      <section v-for="(story, i) in news" :key="story.title" class="news-story">
        <div v-if="i === 0" class="news-illustration" aria-hidden="true"><span v-for="n in 12" :key="n">{{ n % 3 === 0 ? '{ }' : '▱' }}</span></div>
        <small>{{ story.section }}</small><h2>{{ story.title }}</h2><p>{{ story.line }}</p>
        <button v-hover class="result-link" @click="emit('navigate', 'lab://stack')">Read the developer’s perspective →</button>
      </section>
    </template>
    <template v-else>
      <header class="museum-header"><small>PERMANENTLY TEMPORARY EXHIBITIONS</small><h1>The 404 Museum</h1><p>Everything here was somewhere else.</p></header>
      <div class="exhibit"><span class="exhibit-frame">{{ exhibit === 0 ? ';' : exhibit === 1 ? '?' : '404' }}</span>
        <h2>{{ exhibits[exhibit] }}</h2><p>{{ exhibitText }}</p>
      </div>
      <div class="page-actions">
        <button v-hover class="page-button" @click="exhibit = (exhibit + 2) % 3"><YtIcon name="back" />Previous exhibit</button>
        <button v-hover class="page-button" @click="exhibit = (exhibit + 1) % 3">Next exhibit<YtIcon name="forward" /></button>
      </div>
      <button v-hover class="result-link" @click="emit('navigate', 'lab://start')">Return to somewhere that exists →</button>
    </template>
  </article>
</template>
<style scoped>
.built-page {
  min-height: 100%;
  padding: 30px clamp(18px, 5cqw, 75px) 60px;
  background: #f3f2ed;
  color: #26313a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 17px;
  line-height: 1.55;
}
.built-page :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}
button {
  border: 0;
  font: inherit;
  cursor: pointer;
}
button:focus-visible {
  outline: 3px solid #165eb3;
  outline-offset: 3px;
}
.simulated-label {
  font-size: 12px;
  letter-spacing: .14em;
  color: #566069;
  margin-bottom: 26px;
}
h1 {
  font-size: clamp(28px, 4cqw, 48px);
  line-height: 1.15;
  letter-spacing: -.04em;
}
h2 {
  font-size: 25px;
  line-height: 1.2;
  letter-spacing: -.02em;
}
p {
  margin: 12px 0;
}
.search-header b {
  font-size: 29px;
  letter-spacing: -.03em;
}
.result-count, .byline {
  font-size: 14px;
  color: #52626c;
}
.search-result {
  max-width: 800px;
  margin: 25px 0;
}
.search-result > span {
  display: block;
  font-size: 13px;
  color: #536354;
}
.result-link {
  display: block;
  background: none;
  color: #145ba6;
  min-height: 44px;
  text-align: left;
  padding: 5px 0;
  font-size: 20px;
  font-weight: 600;
}
.search-result p {
  margin: 0;
}
.stack-logo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 26px;
  font-weight: 700;
  border-bottom: 1px solid #cbd0cc;
  padding-bottom: 20px;
}
.stack-logo > span {
  color: #a35514;
  font-size: 34px;
}
.stack-logo small {
  font-size: 13px;
  font-weight: 400;
}
.question, .answer {
  display: flex;
  gap: 20px;
  margin: 30px 0;
}
.vote-count {
  flex: none;
  width: 50px;
  font-size: 27px;
  padding-top: 12px;
}
.tag {
  display: inline-block;
  padding: 4px 9px;
  border-radius: 7px;
  background: #dce8ef;
  margin: 4px;
  font-size: 13px;
}
.accepted {
  color: #267353;
  font-size: 36px;
}
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #e3e7e5;
  padding: 18px;
  border-radius: 12px;
  font-size: 15px;
}
.page-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 22px 0;
}
.page-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 18px;
  border-radius: 23px;
  color: #26313a;
  background: #dee5e4;
  font-size: 15px;
}
.page-button[aria-pressed=true] {
  color: #fff;
  background: #315f55;
}
.news-logo {
  text-align: center;
  border-bottom: 3px double #26313a;
  padding-bottom: 22px;
}
.news-logo h1 {
  font-family: Georgia, serif;
  font-size: clamp(32px, 6cqw, 64px);
  margin: 10px 0;
}
.news-logo small, .news-story small, .museum-header small {
  font-size: 12px;
  letter-spacing: .12em;
}
.news-logo > span {
  font-size: 13px;
}
.news-story {
  margin: 28px auto;
  padding-bottom: 26px;
  max-width: 900px;
  border-bottom: 1px solid #c1c9c3;
}
.news-story h2 {
  font-family: Georgia, serif;
  font-size: 32px;
}
.news-illustration {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  padding: 35px;
  margin-bottom: 22px;
  background: #34575a;
  border-radius: 15px;
}
.news-illustration span {
  display: grid;
  place-items: center;
  height: 65px;
  background: #dfd9c5;
  color: #34575a;
  border-radius: 7px;
  font-size: 29px;
  transform: rotate(-5deg);
}
.museum {
  background: #e8dfd2;
  color: #3d3532;
  text-align: center;
}
.museum-header {
  padding: 15px 0 35px;
}
.exhibit-frame {
  display: grid;
  place-items: center;
  margin: 15px auto;
  width: min(300px, 100%);
  height: 190px;
  border: 16px ridge #9d7c53;
  color: #ddd0bc;
  background: #414139;
  box-shadow: 0 10px 25px rgb(70 55 40 / .18);
  font-family: Georgia, serif;
  font-size: 100px;
}
.museum .page-actions {
  justify-content: center;
}
.museum > .result-link {
  margin: auto;
}
.reader {
  max-width: 850px;
  margin: auto;
  padding-inline: clamp(18px, 6cqw, 70px);
  font-size: 20px;
  background: #fffaf0;
}
.reader .simulated-label, .reader .news-illustration, .reader .stack-logo {
  display: none;
}
.built-page :deep(mark) {
  background: #ffe58b;
  color: #1d2834;
  border-radius: 3px;
}
.built-page :deep(mark.current-match) {
  background: #ffa75c;
  outline: 2px solid #ba5c09;
}
@container (max-width: 560px) {
  .question, .answer {
    gap: 10px;
  }
  .question > div, .answer > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .news-illustration {
    grid-template-columns: repeat(4, 1fr);
    padding: 20px;
  }
  .news-story h2 {
    font-size: 27px;
  }
}
</style>
