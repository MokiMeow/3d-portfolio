<script setup lang="ts">
import { CROSSWORD_ENTRIES as entries, CROSSWORD_SOLUTION as solution, CROSSWORD_SIZE as size,
  crosswordNeighbour, restoreCrossword, scoreCrossword, type CrosswordEntry, type CrosswordDirection } from '~/utils/newspaper-crossword';

const storageKey = 'mohith-newspaper-crossword-v1';
const letters = useState<string[]>('newspaperCrosswordLetters', () => restoreCrossword(null));
const active = ref(0);
const direction = ref<CrosswordDirection>('across');
const checked = ref(false);
const confirmingClear = ref(false);
const message = ref('No timer. Your chai can go cold at its own pace.');
const grid = ref<HTMLElement>();
const numbers = Object.fromEntries(entries.map(entry => [entry.cells[0], entry.number]));
const selected = computed(() => entries.find(entry => entry.direction === direction.value && entry.cells.includes(active.value))
  ?? entries.find(entry => entry.cells.includes(active.value))!);
const score = computed(() => scoreCrossword(letters.value));
const status = computed(() => score.value.solved ? 'All thirteen answers correct. Front-page material!' : message.value);

onMounted(() => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) letters.value = restoreCrossword(JSON.parse(saved));
  }
  catch { /* Storage may be disabled. The puzzle still works for this visit. */ }
});
watch(letters, value => {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Best-effort local progress. */ }
}, { deep: true, flush: 'sync' });

function select(index: number) {
  active.value = index;
  if (!entries.some(entry => entry.direction === direction.value && entry.cells.includes(index))) direction.value = selected.value.direction;
}
function focus(index: number) {
  select(index);
  void nextTick(() => {
    const input = grid.value?.querySelector<HTMLInputElement>(`[data-cell="${index}"]`);
    input?.focus({ preventScroll: true }); input?.select();
    input?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
}
function choose(entry: CrosswordEntry) {
  direction.value = entry.direction;
  focus(entry.cells.find(i => !letters.value[i]) ?? entry.cells[0]);
  // On small screens the clues sit below the grid. Bring the selected word back into view.
  grid.value?.scrollIntoView({ block: 'start', behavior: 'instant' });
}
function switchDirection() {
  direction.value = selected.value.direction === 'across' ? 'down' : 'across';
  select(active.value);
}
function advance(index: number, step: number) {
  const cells = selected.value.cells;
  focus(cells[Math.max(0, Math.min(cells.length - 1, cells.indexOf(index) + step))]);
}
function input(event: Event, index: number) {
  const target = event.target as HTMLInputElement;
  const value = target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
  letters.value[index] = value; target.value = value;
  confirmingClear.value = false;
  if (value) advance(index, 1);
}
function key(event: KeyboardEvent, index: number) {
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    direction.value = ['ArrowUp', 'ArrowDown'].includes(event.key) ? 'down' : 'across';
    focus(crosswordNeighbour(index, event.key));
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    if (letters.value[index]) letters.value[index] = '';
    else { advance(index, -1); letters.value[active.value] = ''; }
  } else if (event.key === ' ') {
    event.preventDefault(); switchDirection();
  } else if (event.key === 'Enter') {
    event.preventDefault(); choose(entries[(entries.indexOf(selected.value) + 1) % entries.length]);
  }
}
function paste(event: ClipboardEvent, index: number) {
  event.preventDefault();
  const text = event.clipboardData?.getData('text').toUpperCase().replace(/[^A-Z]/g, '') ?? '';
  const cells = selected.value.cells.slice(selected.value.cells.indexOf(index));
  cells.forEach((cell, i) => { if (text[i]) letters.value[cell] = text[i]; });
  if (text.length) focus(cells[Math.min(text.length, cells.length - 1)]);
}
function check() {
  checked.value = true;
  const { wrong, empty } = score.value;
  message.value = wrong
    ? `${wrong} ${wrong === 1 ? 'letter needs' : 'letters need'} another look (double underline). ${empty} still empty.`
    : empty ? `Every letter so far is right. ${empty} spaces to go.` : 'You solved it!';
}
function reveal() {
  const entry = selected.value;
  entry.cells.forEach(i => { letters.value[i] = solution[i]; });
  message.value = `${entry.number} ${entry.direction} revealed. A little help is part of the fun.`;
}
function clear() {
  if (!confirmingClear.value) { confirmingClear.value = true; return; }
  letters.value = restoreCrossword(null); checked.value = false; confirmingClear.value = false;
  message.value = 'A fresh grid. Put the kettle on.'; focus(0);
}
</script>

<template>
  <section class="crossword" aria-label="The chai-break crossword">
    <div class="puzzle-layout">
      <div class="grid-column">
        <p class="grid-instruction">Tap a square or a clue. Type your answer.</p>
        <div ref="grid" class="crossword-grid" role="group" aria-label="Nine by nine crossword grid" @keydown.stop>
          <div v-for="(answer, index) in solution" :key="index" class="square"
            :class="{ blocked: answer === '#', selected: selected.cells.includes(index), active: active === index,
              incorrect: checked && letters[index] && letters[index] !== answer }">
            <template v-if="answer !== '#'">
              <span v-if="numbers[index]" class="cell-number" aria-hidden="true">{{ numbers[index] }}</span>
              <input :data-cell="index" :value="letters[index]" type="text" inputmode="text" maxlength="1"
                autocomplete="off" autocapitalize="characters" autocorrect="off" :spellcheck="false"
                :tabindex="active === index ? 0 : -1" :aria-label="`Row ${Math.floor(index / size) + 1}, column ${index % size + 1}${numbers[index] ? ', clue ' + numbers[index] : ''}`"
                :aria-invalid="!!(checked && letters[index] && letters[index] !== answer)"
                @focus="select(index)" @click="($event.target as HTMLInputElement).select()"
                @input="input($event, index)" @keydown="key($event, index)" @paste="paste($event, index)" />
            </template>
          </div>
        </div>
        <button class="current-clue" :aria-label="`${selected.number} ${selected.direction}. Switch across or down`" @click="switchDirection">
          <b>{{ selected.number }} {{ selected.direction }} {{ selected.direction === 'across' ? '→' : '↓' }}</b>
          <span>{{ selected.clue }} ({{ selected.answer.length }})</span>
        </button>
        <div class="puzzle-tools">
          <button @click="check">Check letters</button>
          <button @click="reveal">Reveal word</button>
          <button @click="clear">{{ confirmingClear ? 'Clear now?' : 'Clear grid' }}</button>
          <button v-if="confirmingClear" @click="confirmingClear = false">Keep answers</button>
        </div>
        <p class="puzzle-status" role="status">{{ status }}</p>
        <p class="keyboard-note">Arrows move · Space switches direction · Enter selects next clue<br>Progress stays in this browser when storage is available.</p>
      </div>
      <div class="clue-columns">
        <section v-for="axis in (['across', 'down'] as const)" :key="axis" :aria-label="`${axis} clues`">
          <h3>{{ axis }} <span aria-hidden="true">{{ axis === 'across' ? '→' : '↓' }}</span></h3>
          <ol>
            <li v-for="entry in entries.filter(item => item.direction === axis)" :key="entry.id">
              <button :aria-current="selected.id === entry.id ? 'true' : undefined" @click="choose(entry)">
                <b>{{ entry.number }}</b><span>{{ entry.clue }} <em>({{ entry.answer.length }})</em></span>
              </button>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.crossword{color:var(--ink,#1c1b18);font-family:inherit}
.crossword :is(span,b,em){font-family:inherit}
.current-clue{font-family:'Roboto Serif',Georgia,serif}
input::selection{color:var(--paper,#e6e4dc);background:var(--ink,#1c1b18)}
.puzzle-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:28px;align-items:start}
.grid-instruction{font:12px/1.5 'Roboto Serif',Georgia,serif;margin:0 0 12px}
.crossword-grid{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:1px;background:var(--ink);border:2px solid var(--ink);scroll-margin-top:12px}
.square{aspect-ratio:1;position:relative;background:#efede6;min-width:0}
.square.blocked{background:var(--ink)}.square.selected{background:#d3d0c5}.square.active{box-shadow:inset 0 0 0 2px var(--ink)}
.cell-number{position:absolute;left:3px;top:1px;font:10px/1.1 'Roboto Serif',Georgia,serif;pointer-events:none;z-index:1}
input{display:block;border:0;outline:0!important;box-shadow:none!important;border-radius:0;appearance:none;width:100%;height:100%;min-width:0;background:transparent;padding:7px 0 0;color:var(--ink);font:700 clamp(16px,2.8vw,25px)/1 'Roboto Serif',Georgia,serif;text-align:center;caret-color:var(--ink);user-select:text}
input:focus-visible{outline:2px solid var(--ink)!important;outline-offset:-3px}.incorrect input{text-decoration:underline double;text-underline-offset:4px}
button{cursor:pointer;color:inherit;background:none;border:0;font:inherit;text-align:left;border-radius:0}
button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.current-clue{width:100%;display:flex;flex-direction:column;gap:5px;padding:12px 0;min-height:74px;border-bottom:1px solid #a8a79f;font-size:14px;line-height:1.4}
.current-clue b{font:700 10px/1.3 'Roboto Serif',Georgia,serif;text-transform:uppercase;letter-spacing:.08em}
.current-clue:hover b{text-decoration:underline}
.puzzle-tools{display:flex;flex-wrap:wrap;gap:2px 18px;border-bottom:1px solid #a8a79f}
.puzzle-tools button{font:11px/1.4 'Roboto Serif',Georgia,serif;min-height:44px;text-decoration:underline;text-underline-offset:4px}
.puzzle-status{font:600 13px/1.5 'Roboto Serif',Georgia,serif;min-height:42px;margin:13px 0 6px}
.keyboard-note{font:10px/1.6 'Roboto Serif',Georgia,serif;color:#66665d;margin:0}
.clue-columns{display:grid;grid-template-columns:1fr;gap:18px}
.clue-columns h3{margin:0 0 5px;border-block:1px solid var(--ink);padding:5px 0;font:700 18px/1.2 'Roboto Serif',Georgia,serif;text-transform:capitalize;display:flex;justify-content:space-between}
ol{list-style:none;margin:0;padding:0}.clue-columns button{display:flex;gap:8px;width:100%;padding:7px 4px;font:13px/1.35 'Roboto Serif',Georgia,serif;min-height:39px}.clue-columns button b{flex:0 0 15px}.clue-columns button em{font-style:normal;white-space:nowrap}.clue-columns button[aria-current=true]{background:rgb(28 27 24 / .13)}.clue-columns button:hover span{text-decoration:underline;text-underline-offset:3px}
@media(max-width:650px){.puzzle-layout{grid-template-columns:1fr;gap:24px}.grid-column{max-width:440px;width:100%;margin:auto}.clue-columns{grid-template-columns:1fr 1fr;gap:20px}.clue-columns button{font-size:14px;min-height:44px}.grid-instruction{font-size:13px}input{font-size:22px}.cell-number{font-size:9px}}
@media(max-width:360px){.clue-columns{grid-template-columns:1fr}.cell-number{font-size:8px}input{font-size:19px}}
</style>
