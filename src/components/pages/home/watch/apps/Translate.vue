<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from "../watch";
type Language = 'English' | 'Spanish' | 'French' | 'Japanese';
interface Phrase {
  English: string;
  Spanish: string;
  French: string;
  Japanese: string;
}
const watch = useWatch();
const languages: Language[] = ['English', 'Spanish', 'French', 'Japanese'];
const phrases: readonly [Phrase, ...Phrase[]] = [{
  English: 'Hello',
  Spanish: 'Hola',
  French: 'Bonjour',
  Japanese: 'こんにちは'
}, {
  English: 'Thank you',
  Spanish: 'Gracias',
  French: 'Merci',
  Japanese: 'ありがとう'
}, {
  English: 'Where is the station?',
  Spanish: '¿Dónde está la estación?',
  French: 'Où est la gare ?',
  Japanese: '駅はどこですか？'
}, {
  English: 'A coffee, please',
  Spanish: 'Un café, por favor',
  French: 'Un café, s’il vous plaît',
  Japanese: 'コーヒーをください'
}, {
  English: 'Good morning',
  Spanish: 'Buenos días',
  French: 'Bonjour',
  Japanese: 'おはようございます'
}];
const source = ref<Language>('English');
const target = ref<Language>('Spanish');
const phrase = ref(0);
const favorites = ref<number[]>([]);
const speaking = ref(false);
const listening = ref(false);
const savedView = ref(false);
let timeout: ReturnType<typeof setTimeout> | undefined;
const current = computed(() => phrases[phrase.value] ?? phrases[0]);
function sourceChange() {
  if (source.value === target.value) target.value = languages.find(language => language !== source.value) ?? (source.value === 'English' ? 'Spanish' : 'English');
}
function targetChange() {
  if (source.value === target.value) source.value = languages.find(language => language !== target.value) ?? (target.value === 'English' ? 'Spanish' : 'English');
}
function swap() {
  const previous = source.value;
  source.value = target.value;
  target.value = previous;
}
function favorite() {
  favorites.value = favorites.value.includes(phrase.value) ? favorites.value.filter(item => item !== phrase.value) : [...favorites.value, phrase.value];
  watch.haptic();
}
function stop() {
  if (timeout) clearTimeout(timeout);
  timeout = undefined;
  speaking.value = false;
  listening.value = false;
}
function speak() {
  stop();
  speaking.value = true;
  timeout = setTimeout(() => {
    speaking.value = false;
    timeout = undefined;
  }, 1800);
}
function listen() {
  stop();
  listening.value = true;
  timeout = setTimeout(() => {
    phrase.value = (phrase.value + 1) % phrases.length;
    listening.value = false;
    timeout = undefined;
    watch.haptic('success');
  }, 1200);
}
onDeactivated(stop);
onBeforeUnmount(stop);
useWatchHardware('translate', {
  back: () => {
    if (!savedView.value) return false;
    savedView.value = false;
    return true;
  }
});
</script>

<template>
  <section class="watch-app translate-app">
    <h1>{{ savedView ? 'Favorites' : 'Translate' }}</h1>
    <template v-if="savedView">
      <h2>Favorites</h2>
      <p v-if="!favorites.length" class="caption muted">Save a translation using the star.</p>
      <button
        v-for="index in favorites"
        :key="index"
        class="watch-button saved"
        @click="phrase=index;savedView=false"
      >
        {{(phrases[index] ?? phrases[0])[source]}}
      </button>

    </template>
    <template v-else>
      <div class="languages">
        <label class="caption">
          <span>From</span>
          <select v-model="source" @change="sourceChange">
            <option v-for="language in languages" :key="language">
              {{language}}
            </option>
          </select>
        </label>
        <button aria-label="Swap languages" @click="swap">
          <WatchGlyph name="switch" />
        </button>
        <label class="caption">
          <span>To</span>
          <select v-model="target" @change="targetChange">
            <option v-for="language in languages" :key="language">
              {{language}}
            </option>
          </select>
        </label>
      </div>
      <label class="phrase-selector caption">
        Choose a phrase
        <select v-model.number="phrase">
          <option
            v-for="(item,index) in phrases"
            :key="index"
            :value="index"
          >
            {{item[source]}}
          </option>
        </select>
      </label>
      <div class="platter translation">
        <p class="original">
          {{current[source]}}
        </p>
        <p class="translated">
          {{current[target]}}
        </p>
        <div class="translation-controls">
          <button :aria-label="speaking?'Stop demo speaking animation':'Play demo speaking animation'" @click="speaking?stop():speak()">
            <WatchGlyph :name="speaking ? 'stop' : 'play'" />
          </button>
          <div
            class="speech-bars"
            :class="{speaking:speaking&&!watch.reducedMotion.value&&!watch.dimmed.value}"
            aria-hidden="true"
          >
            <i
              v-for="n in 8"
              :key="n"
              :style="{'--n':n}"
            />
          </div>
          <button
            :aria-label="favorites.includes(phrase)?'Remove favorite':'Save favorite'"
            :aria-pressed="favorites.includes(phrase)"
            @click="favorite"
          >
            <WatchGlyph name="star" />
          </button>
        </div>
      </div>
      <button
        class="watch-button microphone"
        :disabled="listening"
        @click="listen"
      >
        <WatchGlyph name="mic" />
        {{ listening ? 'Listening demo…' : 'Try Voice Demo' }}
      </button>
      <button class="watch-button full" @click="savedView=true">
        Favorites (
        {{favorites.length}}
        )
      </button>
      
    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.translate-app h1 {
  color: #0a84ff;
}

.languages {
  display: flex;
  gap: 8px;
  align-items: center;
}

.languages label {
  flex: 1;
  min-width: 0;
}

.languages label>span {
  display: block;
  color: #aaa;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  margin-bottom: 4px;
}

.languages select {
  width: 100%;
  background: #1c1c1e;
  color: #fff;
  border: 0;
  border-radius: 18px;
  min-height: 76px;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
  padding: 0 8px;
}

.languages>button {
  height: 76px;
  width: 72px;
  background: none;
  border: 0;
  color: #0a84ff;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  flex-shrink: 0;
}

.phrase-selector {
  display: block;
  margin: 20px 0;
  color: #aaa;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.phrase-selector select {
  display: block;
  width: 100%;
  min-height: 78px;
  background: #1c1c1e;
  color: white;
  border: 0;
  border-radius: 20px;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  padding: 12px;
  margin-top: 10px;
}

.original {
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  color: #aaa;
  margin: 0 0 18px;
}

.translated {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  margin: 0;
  overflow-wrap: anywhere;
}

.translation-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.translation-controls button {
  height: 76px;
  width: 76px;
  border: 0;
  background: none;
  color: #0a84ff;
  font-size: max(18px, calc(27px * var(--text-size, 1)));
}

.speech-bars {
  display: flex;
  align-items: center;
  height: 40px;
  gap: 5px;
}

.speech-bars i {
  height: calc(8px + var(--n)*3px);
  width: 5px;
  background: #0a84ff;
  border-radius: 4px;
}

.speech-bars.speaking i {
  animation: speak .65s ease-in-out infinite alternate;
  animation-delay: calc(var(--n)*-.13s);
}

.full,
.microphone,
.saved {
  width: 100%;
  margin-top: 14px;
}

.microphone {
  background: #0a84ff;
  color: #fff;
}

.disclaimer {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  line-height: 1.3;
}

@keyframes speak {
  to {
    transform: scaleY(.25);
  }
}

.languages {
  gap: 6px;
}

.languages select {
  font-size: 23px;
  padding-inline: 6px;
}

.phrase-selector {
  margin: 12px 0;
}

.original {
  margin-bottom: 8px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #0A84FF; }

.languages { display:grid; grid-template-columns:minmax(0,1fr) 44px minmax(0,1fr); gap:8px; }
.languages > button { width:44px; height:64px; min-height:64px; }
.languages select { min-height:64px; font-size:22px; border-radius:30px; }
.translation { overflow-wrap:anywhere; }
.translation-controls button { width:64px; height:64px; }
.translation-controls { gap:10px; }
.speech-bars { flex:1; justify-content:center; min-width:0; }
.saved { font-size:24px; line-height:1.25; text-align:left; justify-content:flex-start; }
</style>
