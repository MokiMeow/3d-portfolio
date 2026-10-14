<script setup lang="ts">
import { vHover } from '../../kit/hover';
import FileGlyph from './FileGlyph.vue';
import AppGlyph from './AppGlyph.vue';
import { KIND_NAMES, formatBytes, readSavedFiles } from './model';
import type { FileEntry } from './model';

const props = defineProps<{ entry: FileEntry }>();
const emit = defineEmits<{ close: []; extract: [entry: FileEntry] }>();
const playing = ref(false);
const progress = ref(0);
const sound = ref(false);
const rotation = ref(25);
const spin = ref(false);
const reducedMotion = ref(false);
let motionQuery: MediaQueryList | undefined;
const imageFailed = ref(false);
const zoom = ref(false);
const zipExpanded = ref(true);
const page = ref(1);
const status = ref('');
const totalSeconds = 8;
let clockTimer = 0;
let context: AudioContext | undefined;
let oscillator: OscillatorNode | undefined;
let gain: GainNode | undefined;
let audioUnavailable = false;
let disposed = false;
let previousTick = 0;
let audioRequest = 0;

const waveform = Array.from({ length: 56 }, (_, index) => 12 + Math.abs(Math.sin(index * 1.37) * Math.cos(index * .21)) * 72);
const markdown = computed(() => props.entry.content.split('\n').map(line => ({
  type: line.startsWith('# ') ? 'title' : line.startsWith('## ') ? 'heading' : line.startsWith('- ') ? 'item'
    : line.startsWith('> ') ? 'quote' : 'paragraph',
  text: line.replace(/^(#{1,2} |[->] )/, ''),
})));
const jsonTokens = computed(() => {
  const tokens = props.entry.content.match(/"(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[{}\[\],:\s]+|./g) ?? [];
  return tokens.map(text => ({ text, kind: text.trim().endsWith(':') ? 'key'
    : text.startsWith('"') ? 'string' : /^(true|false|null)$/.test(text) ? 'literal' : /^-?\d/.test(text) ? 'number' : 'punctuation' }));
});
const pdfTitle = computed(() => props.entry.name.includes('taxes') ? 'The Maybe Tax Summary'
  : props.entry.name.includes('chai') ? 'A Study in Steeping' : 'The Scope Keeps Growing');
const zipContents = computed(() => {
  try {
    const saved = props.entry.content ? readSavedFiles(props.entry.content) : undefined;
    if (saved?.length) return saved.map(item => item.name);
  } catch { /* The original archives have illustrative contents. */ }
  return props.entry.name === 'do_not_open.zip'
    ? ['definitely_do_not_open.zip', 'README_you_did_it_anyway.txt', 'confidence.json']
    : ['one_last_archive.zip', 'a_very_small_apology.txt'];
});
const date = computed(() => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(props.entry.modified));
function stopSound(): void {
  audioRequest++;
  if (oscillator) {
    try { oscillator.stop(); } catch { /* It may already have finished. */ }
    oscillator.disconnect();
    oscillator = undefined;
  }
  gain?.disconnect();
  gain = undefined;
}
async function startSound(): Promise<void> {
  if (!sound.value || !playing.value || audioUnavailable) return;
  const request = ++audioRequest;
  try {
    context ??= new AudioContext();
    await context.resume();
    if (disposed || request !== audioRequest || !playing.value || !sound.value || context.state === 'closed') return;
    stopSound();
    oscillator = context.createOscillator();
    gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 220;
    gain.gain.value = .025;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
  } catch {
    audioUnavailable = true;
    sound.value = false;
    status.value = 'Audio is unavailable here. The silent waveform still plays.';
    stopSound();
  }
}
function play(): void {
  playing.value = !playing.value;
  if (playing.value) {
    previousTick = performance.now();
    if (progress.value >= totalSeconds) progress.value = 0;
    void startSound();
  } else stopSound();
}
function toggleSound(): void {
  sound.value = !sound.value;
  if (sound.value) void startSound();
  else stopSound();
}
watch(() => props.entry.id, () => {
  playing.value = false;
  progress.value = 0;
  page.value = 1;
  zoom.value = false;
  imageFailed.value = false;
  stopSound();
});
function motionChanged(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches;
  if (event.matches) spin.value = false;
}
onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.value = motionQuery.matches;
    spin.value = !motionQuery.matches;
    motionQuery.addEventListener('change', motionChanged);
  }
  clockTimer = window.setInterval(() => {
    if (!playing.value) return;
    const now = performance.now();
    progress.value = Math.min(totalSeconds, progress.value + (now - previousTick) / 1000);
    previousTick = now;
    if (oscillator && context) {
      const notes = [220, 277.18, 329.63, 440, 329.63, 277.18, 246.94, 220];
      oscillator.frequency.setTargetAtTime(notes[Math.floor(progress.value) % notes.length] ?? 220, context.currentTime, .04);
    }
    if (progress.value >= totalSeconds) { playing.value = false; stopSound(); }
  }, 100);
});
onBeforeUnmount(() => {
  disposed = true;
  playing.value = false;
  sound.value = false;
  clearInterval(clockTimer);
  motionQuery?.removeEventListener('change', motionChanged);
  stopSound();
  if (context) void context.close().catch(() => undefined);
});
</script>

<template>
  <section class="quick-look" aria-label="Quick Look">
    <header>
      <button v-hover class="vk-icon" aria-label="Close Quick Look" @click="emit('close')"><AppGlyph name="back" /></button>
      <div class="heading">
        <span class="vk-footnote vk-secondary">QUICK LOOK</span>
        <h2 class="vk-title">{{ entry.name }}</h2>
      </div>
      <FileGlyph :kind="entry.kind" />
    </header>
    <div class="preview-scroll vk-scroll">
      <figure v-if="entry.kind === 'image'" class="photo vk-well" :class="{ zoom }">
        <img v-if="!imageFailed" :src="'/vision/env/' + entry.content + '-thumb.webp'" :alt="entry.detail" @error="imageFailed = true" />
        <div v-else class="image-fallback">The photograph took a quiet day off.<br />{{ entry.detail }}</div>
        <figcaption>{{ entry.detail }}</figcaption>
        <button v-hover class="vk-button" :aria-pressed="zoom" @click="zoom = !zoom">{{ zoom ? 'Fit photograph' : 'Look closer' }}</button>
      </figure>
      <article v-else-if="entry.kind === 'markdown'" class="text-document vk-well markdown">
        <template v-for="(line, index) in markdown" :key="index">
          <h1 v-if="line.type === 'title'">{{ line.text }}</h1>
          <h3 v-else-if="line.type === 'heading'">{{ line.text }}</h3>
          <p v-else-if="line.type === 'item'" class="bullet">• {{ line.text }}</p>
          <blockquote v-else-if="line.type === 'quote'">{{ line.text }}</blockquote>
          <p v-else>{{ line.text || ' ' }}</p>
        </template>
      </article>
      <pre v-else-if="entry.kind === 'json'" class="text-document vk-well json"><code><span
        v-for="(token, index) in jsonTokens" :key="index" :class="token.kind">{{ token.text }}</span></code></pre>
      <article v-else-if="entry.kind === 'pdf'" class="pdf">
        <div class="paper">
          <div class="document-top"><span>DEPARTMENT OF WELL-MEANING GUESSWORK</span><span>DOC {{ entry.id }} / {{ page }}</span></div>
          <h1>{{ pdfTitle }}</h1>
          <p class="paper-subtitle">A fictional document. Please do not file this with anyone.</p>
          <template v-if="page === 1">
            <h3>Executive summary</h3><p>{{ entry.detail }}</p>
            <table><tbody>
              <tr><th>Measure</th><th>Finding</th></tr>
              <tr><td>Confidence</td><td>Under review</td></tr>
              <tr><td>Outstanding questions</td><td>Several, politely phrased</td></tr>
              <tr><td>Recommended next step</td><td>{{ entry.name.includes('chai') ? 'Drink while warm' : 'Read page two' }}</td></tr>
            </tbody></table>
            <div class="stamp">DRAFT, NATURALLY</div>
          </template>
          <template v-else>
            <h3>Method and limitations</h3>
            <p>Prepared with care, a spreadsheet, and an unreasonable number of open tabs.</p>
            <p>All figures are fictional. All conclusions are subject to another cup of chai.</p>
            <h3>Peer review</h3><p>The rubber duck raised no objections. This should not be mistaken for approval.</p>
          </template>
          <footer>FOR DEMONSTRATION ONLY · {{ page }} / 2</footer>
        </div>
        <nav class="pages vk-ornament" aria-label="Document pages">
          <button v-hover class="vk-icon" :disabled="page === 1" aria-label="Previous page" @click="page = 1"><AppGlyph name="back" /></button>
          <span>Page {{ page }} of 2</span>
          <button v-hover class="vk-icon" :disabled="page === 2" aria-label="Next page" @click="page = 2"><AppGlyph name="forward" /></button>
        </nav>
      </article>
      <section v-else-if="entry.kind === 'audio'" class="audio-preview vk-well">
        <span class="vk-footnote vk-secondary">ORIGINAL SYNTH STUDY</span>
        <h2 class="vk-title">Keyboard at midnight</h2>
        <div class="waveform" aria-hidden="true">
          <i v-for="(height, index) in waveform" :key="index"
            :style="{ height: height + '%', background: index / waveform.length <= progress / totalSeconds ? '#b9d4ff' : 'rgba(255,255,255,.25)' }" />
        </div>
        <input v-model.number="progress" v-hover class="vk-slider" type="range" min="0" :max="totalSeconds" step=".1"
          :style="{ '--value': progress / totalSeconds }" aria-label="Audio position" />
        <div class="audio-time vk-footnote vk-secondary"><span>0:{{ String(Math.floor(progress)).padStart(2, '0') }}</span><span>0:08</span></div>
        <div class="audio-actions">
          <button v-hover class="vk-button primary" @click="play">{{ playing ? 'Pause' : 'Play' }}</button>
          <button v-hover class="vk-button" :aria-pressed="sound" @click="toggleSound">{{ sound ? 'Sound on' : 'Sound off' }}</button>
        </div>
        <p class="vk-footnote vk-secondary">Eight seconds of original synthesised notes. No actual keyboards were kept awake.</p>
      </section>
      <section v-else-if="entry.kind === 'model'" class="model-preview vk-well">
        <span class="vk-footnote vk-secondary">SPATIAL OBJECT · CERAMIC, IN SPIRIT</span>
        <div class="model-stage">
          <div class="model-turn" :class="{ spinning: spin }" :style="{ transform: 'rotateY(' + rotation + 'deg)' }">
            <div class="mug-handle" />
            <div class="mug-body"><div class="mug-rim" /><span>one<br />more<br />commit.</span></div>
          </div>
          <div class="model-shadow" />
        </div>
        <button v-hover class="vk-button" :aria-pressed="spin" :disabled="reducedMotion" @click="spin = !spin">
          {{ reducedMotion ? 'Motion reduced' : spin ? 'Stop rotation' : 'Auto rotate' }}
        </button>
        <label class="rotation-label">Rotate object
          <input v-model.number="rotation" v-hover class="vk-slider" type="range" min="0" max="360" :style="{ '--value': rotation / 360 }"
            aria-label="Rotate 3D mug" @input="spin = false" />
        </label>
        <p class="vk-footnote vk-secondary">{{ entry.detail }}</p>
      </section>
      <section v-else-if="entry.kind === 'zip'" class="zip-preview vk-well">
        <FileGlyph kind="zip" /><h2 class="vk-title">You were warned, very politely.</h2>
        <p class="vk-secondary">{{ entry.detail }}</p>
        <button v-hover class="vk-button" :aria-expanded="zipExpanded" @click="zipExpanded = !zipExpanded">
          {{ zipExpanded ? 'Hide contents' : 'Show contents' }}
        </button>
        <div v-if="zipExpanded" class="archive-contents vk-platter">
          <div v-for="(name, index) in zipContents" :key="index"><AppGlyph name="forward" />{{ name }}</div>
        </div>
        <button v-hover class="vk-button primary" @click="emit('extract', entry)">Extract {{ zipContents.length }} items</button>
        <p class="vk-footnote vk-secondary">Creates a folder beside the archive. Warnings included.</p>
      </section>
      <section v-else-if="entry.kind === 'design'" class="design-preview vk-well">
        <span class="vk-footnote vk-secondary">THE FINAL VERSION, PROBABLY</span>
        <div class="design-boards"><div v-for="index in 3" :key="index"><i /><i /><i /><i /></div></div>
        <h2 class="vk-title">Revision seven. Confidence four.</h2>
        <p class="vk-secondary">{{ entry.detail }}</p>
      </section>
      <pre v-else class="text-document vk-well"><code>{{ entry.content || entry.detail }}</code></pre>
      <dl class="metadata vk-platter">
        <div><dt>Kind</dt><dd>{{ KIND_NAMES[entry.kind] }}</dd></div>
        <div><dt>Size</dt><dd>{{ formatBytes(entry.bytes) }}</dd></div>
        <div><dt>Modified</dt><dd>{{ date }}</dd></div>
        <div><dt>Tag</dt><dd>{{ entry.tag || 'None' }}</dd></div>
      </dl>
      <p v-if="status" class="vk-footnote vk-secondary" role="status">{{ status }}</p>
    </div>
  </section>
</template>

<style scoped src="./QuickLook.css"></style>
