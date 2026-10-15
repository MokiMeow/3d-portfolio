<script setup lang="ts">
import { vHover } from '../../kit/hover';
import type { DownloadState, StoreApp } from './catalog';
import StoreIcon from './StoreIcon.vue';
import StoreGet from './StoreGet.vue';
import StoreArtwork from './StoreArtwork.vue';
import AppGlyph from '../files/AppGlyph.vue';
const props = defineProps<{ app: StoreApp; state: DownloadState }>();
defineEmits<{ activate: []; back: [] }>();
const screenshot = ref(0);
const historyOpen = ref(false);
const ratingHistogram = computed(() => props.app.rating === '4.7' ? [80, 13, 5, 1, 1]
  : props.app.rating === '4.9' ? [91, 7, 1, 1, 0] : [85, 12, 2, 1, 0]);
const helpful = ref<string[]>([]);
const reviews = computed(() => [
  { id: 'one', title: 'Exactly the right amount of unnecessary', author: 'An imaginary tab enthusiast', text: props.app.review },
  {
    id: 'two', title: 'A little room to think', author: 'An entirely fictional reviewer',
    text: props.app.arcade ? 'Played one tiny level. My backlog politely pretended not to notice.'
      : 'There is enough space here for the task and the thought I had while doing the task.',
  },
]);
function toggleHelpful(id: string): void {
  helpful.value = helpful.value.includes(id) ? helpful.value.filter(item => item !== id) : [...helpful.value, id];
}
function changeScreenshot(direction: number): void {
  screenshot.value = (screenshot.value + direction + 3) % 3;
}
</script>

<template>
  <article class="store-page vk-scroll">
    <header class="page-navigation">
      <button v-hover class="vk-button" @click="$emit('back')"><AppGlyph name="back" /> Back</button>
      <span class="vk-footnote vk-secondary">{{ app.category }}</span>
    </header>
    <div class="page-hero">
      <StoreIcon :app="app" large />
      <div class="hero-copy"><h1>{{ app.name }}</h1><p class="vk-secondary">{{ app.subtitle }}</p></div>
      <StoreGet :name="app.name" :state="state" large @activate="$emit('activate')" />
    </div>
    <p class="simulation-note vk-footnote vk-secondary">
      {{ app.headsetId ? 'A simulated headset app. Open launches it in this room.' : 'Original fictional app. Get simulates a download. Free, with no payment or account.' }}
    </p>
    <div class="metrics vk-platter">
      <div>
        <small>FICTIONAL RATING</small><strong>{{ app.rating }}</strong>
        <span class="stars" role="img" aria-label="Five stars"><AppGlyph v-for="n in 5" :key="n" name="star" /></span>
      </div>
      <div><small>AGE</small><strong>4+</strong><span>Age guidance · demo</span></div>
      <div><small>CATEGORY</small><strong>{{ app.arcade ? 'Play' : 'Create' }}</strong><span>{{ app.category }}</span></div>
      <div><small>SIZE</small><strong>{{ app.size }}</strong><span>{{ app.headsetId ? 'Already here' : 'Demo download' }}</span></div>
    </div>
    <section class="screenshots">
      <div class="section-header"><h2>Preview</h2>
        <div class="vk-ornament screenshot-controls">
          <button v-hover class="vk-icon" aria-label="Previous preview" @click="changeScreenshot(-1)"><AppGlyph name="back" /></button>
          <span class="vk-footnote">{{ screenshot + 1 }} / 3</span>
          <button v-hover class="vk-icon" aria-label="Next preview" @click="changeScreenshot(1)"><AppGlyph name="forward" /></button>
        </div>
      </div>
      <Transition name="screen" mode="out-in">
        <StoreArtwork :key="app.id + screenshot" :app="app" :scene="screenshot" />
      </Transition>
      <div class="screen-dots" role="group" aria-label="Preview screenshots">
        <button v-for="n in 3" :key="n" v-hover class="vk-icon" :aria-label="'Show preview ' + n"
          :aria-pressed="screenshot === n - 1" @click="screenshot = n - 1"><i /></button>
      </div>
    </section>
    <section class="feature-section"><h2>Built for a little more space</h2><div class="feature-grid"><div class="vk-platter"><AppGlyph name="grid"/><strong>{{ app.arcade ? 'Room to play' : 'A focused workspace' }}</strong><span>Spacious layouts and controls that stay close.</span></div><div class="vk-platter"><AppGlyph name="shield"/><strong>Your pace, your space</strong><span>Keyboard access and reduced motion support.</span></div></div></section>
    <section class="description-section"><h2>About this app</h2><p>{{ app.description }}</p>
      <p class="vk-secondary">{{ app.headsetId ? 'Built into this portfolio experience. This listing is a demonstration, independent of the real App Store.'
        : 'Designed for a spacious imaginary world, with no subscriptions, tracking, or imaginary upgrade fees.' }}</p>
    </section>
    <section>
      <div class="section-header"><h2>What is new</h2>
        <button v-hover class="vk-button" :aria-expanded="historyOpen" @click="historyOpen = !historyOpen">Version history</button>
      </div>
      <div class="version vk-platter"><div><strong>Version 1.1</strong><small class="vk-secondary">The slightly more polished edition</small></div>
        <p>{{ app.id === 'tabs' ? 'Added a stack for tabs you opened to remember why you opened the other tabs.'
          : app.arcade ? 'Gentler levels, roomier worlds, and a very patient pause button.' : 'More breathing room. Fewer things asking for your attention.' }}</p>
      </div>
      <div v-if="historyOpen" class="version vk-well"><div><strong>Version 1.0</strong><small class="vk-secondary">The first imaginary release</small></div>
        <p>{{ app.headsetId ? 'The app joined this simulated headset.' : 'Shipped the idea. Proudly resisted adding a dashboard.' }}</p>
      </div>
    </section>
    <section>
      <h2>Ratings and reviews</h2><p class="vk-footnote vk-secondary">All ratings and reviews below are invented for this demonstration.</p>
      <div class="rating-summary vk-platter">
        <div class="rating-number"><strong>{{ app.rating }}</strong><span>out of 5</span><small>Imaginary ratings</small></div>
        <div class="histogram" aria-label="Fictional ratings: mostly five stars">
          <div v-for="(amount, index) in ratingHistogram" :key="index"><span>{{ 5 - index }} <AppGlyph name="star" /></span>
            <div class="rating-track"><i :style="{ transform: 'scaleX(' + amount / 100 + ')' }" /></div><small>{{ amount }}%</small>
          </div>
        </div>
      </div>
      <div class="review-grid">
        <article v-for="review in reviews" :key="review.id" class="review vk-platter">
          <span class="stars" role="img" aria-label="Five stars"><AppGlyph v-for="n in 5" :key="n" name="star" /></span><h3>{{ review.title }}</h3>
          <p>{{ review.text }}</p><small class="vk-secondary">{{ review.author }}</small>
          <button v-hover class="vk-button" :aria-pressed="helpful.includes(review.id)" @click="toggleHelpful(review.id)">
            {{ helpful.includes(review.id) ? 'Marked helpful ✓' : 'Helpful' }}
          </button>
        </article>
      </div>
    </section>
    <section>
      <h2>App privacy</h2><p class="vk-footnote vk-secondary">Privacy information for this store demonstration.</p>
      <div class="privacy-grid">
        <div class="privacy-label vk-platter"><AppGlyph name="tag" /><h3>Stored on this device</h3>
          <p>Your simulated purchases and store preferences stay in this browser, using local storage.</p><small>Purchase history · Preferences</small>
        </div>
        <div class="privacy-label vk-platter"><AppGlyph name="shield" /><h3>No tracking by this store</h3>
          <p>No account, payment details, or cross-site advertising identifiers are requested.</p>
          <small>Opening a headset app may use that app’s media resources.</small>
        </div>
      </div>
    </section>
    <section class="information vk-well"><h2>Information</h2>
      <dl><div><dt>Provider</dt><dd>{{ app.headsetId ? 'This portfolio simulation' : 'The Imaginary App Workshop' }}</dd></div>
        <div><dt>Compatibility</dt><dd>This simulated Vision Pro</dd></div><div><dt>Language</dt><dd>English, with developer humour</dd></div>
        <div><dt>Price</dt><dd>Free, entirely simulated</dd></div></dl>
    </section>
  </article>
</template>

<style scoped>
.store-page {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 22px;
  color: var(--vk-text, #fff);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
  font-size: 17px;
  line-height: 1.4;
  touch-action: pan-y;
}

.store-page :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

.store-page h1,
.store-page h2,
.store-page h3,
.store-page p {
  margin: 0;
}

.store-page h1 {
  font-size: 30px;
  line-height: 1.13;
  letter-spacing: -.03em;
}

.store-page h2 {
  font-size: 23px;
  letter-spacing: -.02em;
  margin-bottom: 10px;
}

.store-page h3 {
  font-size: 17px;
  letter-spacing: -.01em;
}

.store-page button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.store-page :focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.store-page .page-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 26px;
}

.store-page .page-hero {
  display: flex;
  align-items: center;
  gap: 18px;
}

.store-page .hero-copy {
  flex: 1;
  min-width: 0;
}

.store-page .hero-copy p {
  margin-top: 6px;
}

.store-page .simulation-note {
  margin-top: 18px;
}

.store-page section {
  margin-top: 30px;
}

.store-page .metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 22px;
  padding: 18px 0;
}

.store-page .metrics > div {
  text-align: center;
  padding: 0 10px;
  border-right: 1px solid rgb(255 255 255 / .12);
}

.store-page .metrics > div:last-child {
  border: 0;
}

.store-page .metrics small {
  font-size: 12px;
  letter-spacing: .07em;
  color: var(--vk-secondary);
  display: block;
}

.store-page .metrics strong {
  font-size: 24px;
  display: block;
  margin: 4px 0;
}

.store-page .metrics span {
  font-size: 12px;
  color: var(--vk-secondary);
  display: block;
}

.store-page .section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.store-page .section-header h2 {
  margin: 0;
}

.store-page .screenshot-controls {
  padding: 4px;
  flex: none;
}

.store-page .screenshot-controls button {
  font-size: 27px;
}

.store-page .screen-dots {
  display: flex;
  justify-content: center;
  gap: 3px;
  margin-top: 5px;
}

.store-page .screen-dots button {
  background: transparent;
}

.store-page .screen-dots button i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.store-page .description-section p + p {
  margin-top: 12px;
}

.store-page .version {
  padding: 18px;
  margin-top: 10px;
}

.store-page .version > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
}

.store-page .version small {
  font-size: 14px;
}

.store-page .version p {
  margin-top: 12px;
}

.store-page .rating-summary {
  display: flex;
  gap: 30px;
  align-items: center;
  padding: 22px;
  margin: 16px 0;
}

.store-page .rating-number {
  display: flex;
  flex-direction: column;
  text-align: center;
  flex: none;
}

.store-page .rating-number strong {
  font-size: 52px;
  line-height: 1;
  letter-spacing: -.06em;
}

.store-page .rating-number span,
.store-page .rating-number small {
  color: var(--vk-secondary);
  font-size: 13px;
  margin-top: 5px;
}

.store-page .histogram {
  flex: 1;
  min-width: 0;
}

.store-page .histogram > div {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 4px 0;
  font-size: 12px;
}

.store-page .histogram span {
  flex: none;
  width: 26px;
  color: var(--vk-secondary);
}

.store-page .histogram small {
  width: 27px;
  text-align: right;
}

.store-page .rating-track {
  height: 5px;
  flex: 1;
  border-radius: 4px;
  background: rgb(255 255 255 / .12);
  overflow: hidden;
}

.store-page .rating-track i {
  display: block;
  width: 100%;
  height: 100%;
  background: #ccd6e1;
  transform-origin: left;
}

.store-page .review-grid,
.store-page .privacy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.store-page .review {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
}

.store-page .stars {
  display: flex;
  justify-content: center;
  gap: 2px;
  color: #ffe3a2;
}

.store-page .review .stars {
  justify-content: flex-start;
}

.store-page .stars .app-glyph {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.store-page .histogram span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.store-page .histogram .app-glyph {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.store-page .review small {
  font-size: 13px;
  margin-top: auto;
}

.store-page .review button {
  align-self: flex-start;
}

.store-page .privacy-grid {
  margin-top: 16px;
}

.store-page .privacy-label {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.store-page .privacy-label > .app-glyph {
  width: 32px;
  height: 32px;
  color: #bedbfb;
}

.store-page .privacy-label small {
  color: var(--vk-secondary);
  font-size: 13px;
}

.store-page .information {
  padding: 22px;
}

.store-page dl {
  margin: 0;
}

.store-page dl > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid rgb(255 255 255 / .1);
  padding: 12px 0;
}

.store-page dl > div:last-child {
  border-bottom: 0;
}

.store-page dt {
  color: var(--vk-secondary);
}

.store-page dd {
  margin: 0;
  text-align: right;
}

.store-page .screen-enter-active,
.store-page .screen-leave-active {
  transition: transform .22s ease-out, opacity .22s ease-out;
}

.store-page .screen-enter-from {
  transform: translateX(12px);
  opacity: 0;
}

.store-page .screen-leave-to {
  transform: translateX(-12px);
  opacity: 0;
}

@container (max-width: 620px) {
  .store-page {
    padding: 14px;
  }
  .store-page .page-hero {
    flex-wrap: wrap;
    gap: 12px;
  }
  .store-page .page-hero :deep(.store-icon.large) {
    width: 68px;
    height: 68px;
    border-radius: 20px;
  }
  .store-page .page-hero :deep(.store-icon.large svg) {
    width: 43px;
    height: 43px;
  }
  .store-page .hero-copy {
    flex-basis: calc(100% - 85px);
    overflow-wrap: anywhere;
  }
  .store-page h1 {
    font-size: 24px;
  }
  .store-page .page-hero :deep(.store-get) {
    margin-left: auto;
  }
  .store-page .metrics {
    grid-template-columns: 1fr 1fr;
    gap: 18px 0;
  }
  .store-page .metrics > div:nth-child(2) {
    border: 0;
  }
  .store-page .review-grid,
  .store-page .privacy-grid {
    grid-template-columns: 1fr;
  }
  .store-page .section-header {
    flex-wrap: wrap;
  }
  .store-page .rating-summary {
    gap: 18px;
    padding: 18px;
  }
  .store-page .rating-number strong {
    font-size: 42px;
  }
  .store-page dl > div {
    flex-wrap: wrap;
  }
  .store-page dd {
    text-align: left;
  }
}

.store-page {
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / .25) transparent;
}

.store-page::-webkit-scrollbar {
  display: block;
  width: 4px;
}

.store-page::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / .25);
  border-radius: 4px;
}

@container (max-width: 420px) {
  .store-page .rating-summary {
    flex-direction: column;
    gap: 16px;
  }
  .store-page .histogram {
    width: 100%;
  }
  .store-page .metrics {
    padding: 16px 0;
  }
  .store-page .page-navigation {
    flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .store-page .metrics small {
    letter-spacing: .02em;
  }
  .store-page .information {
    padding: 18px;
  }
  .store-page .information dl > div {
    display: grid;
    gap: 5px;
  }
  .store-page .review,
  .store-page .privacy-label {
    padding: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .store-page .screen-enter-active,
  .store-page .screen-leave-active {
    transition: none;
  }
}

.store-page { padding: 24px; }.store-page .page-navigation { margin-bottom: 16px; }.store-page .page-hero { gap: 16px; }.store-page .page-hero :deep(.store-icon.large) { width: 78px; height: 78px; }.store-page h1 { font-size: 27px; }.store-page .hero-copy p { font-size: 14px; }.store-page .simulation-note { font-size: 12px; margin-top: 12px; }
.store-page .metrics { margin-top: 16px; padding: 13px 0; }.store-page .metrics small { font-size: 10.5px; }.store-page .metrics strong { font-size: 21px; }.store-page .metrics span { font-size: 11.5px; }.store-page section { margin-top: 22px; }.store-page .screenshots :deep(.store-art) { height: clamp(140px,26cqh,180px); border-radius: 22px; }.store-page .section-header { margin-bottom: 10px; }.store-page .screen-dots { margin-top: 0; }
.feature-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }.feature-grid>div { padding: 22px; }.feature-grid .app-glyph { width: 26px; height: 26px; color: #b5d6ee; }.feature-grid strong,.feature-grid span { display: block; }.feature-grid strong { font-size: 16px; margin: 14px 0 6px; }.feature-grid span { color: var(--vk-secondary); font-size: 13px; line-height: 1.5; }
@container (max-height: 540px) and (min-width: 600px) { .store-page { padding: 18px 24px; }.store-page .page-navigation { margin-bottom: 12px; }.store-page .page-hero :deep(.store-icon.large) { width: 64px; height: 64px; }.store-page .metrics { padding: 10px 0; margin-top: 12px; }.store-page .screenshots { margin-top: 14px; }.store-page .screenshots :deep(.store-art) { height: 126px; } }
@container (max-width: 600px) { .store-page { padding: 18px; }.store-page .page-hero { flex-wrap: wrap; }.store-page .page-hero h1 { font-size: 23px; }.store-page .metrics { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px 0; }.store-page .metrics>div:nth-child(2) { border-right: 0; }.feature-grid { grid-template-columns: 1fr; }.store-page .section-header { flex-wrap: wrap; }.store-page .section-header h2 { font-size: 21px; } }
</style>
