<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
type Operator = '+' | '−' | '×' | '÷';
const display = ref<string>('0');
const accumulator = ref<number | null>(null);
const operation = ref<Operator | null>(null);
const fresh = ref<boolean>(true);
const lastOperation = ref<Operator | null>(null);
const lastOperand = ref<number | null>(null);
const history = ref<Array<{
    expression: string;
    answer: string;
}>>([]);
const showHistory = ref<boolean>(false);
const keys = [
    'clear',
    '±',
    '%',
    '÷',
    '7',
    '8',
    '9',
    '×',
    '4',
    '5',
    '6',
    '−',
    '1',
    '2',
    '3',
    '+',
    '0',
    '.',
    '='
];
const fontSize = computed(() => 'clamp(24px, ' + 140 / Math.max(1, display.value.length) + 'cqw, 86px)');
const clearLabel = computed(() => display.value === '0' && accumulator.value === null ? 'AC' : 'C');
function format(value: number): string {
    if (!Number.isFinite(value))
        return 'Error';
    if (Object.is(value, -0))
        return '0';
    return String(Number(value.toPrecision(12)));
}
function calculate(a: number, b: number, op: Operator): number {
    if (op === '+')
        return a + b;
    if (op === '−')
        return a - b;
    if (op === '×')
        return a * b;
    return b === 0 ? NaN : a / b;
}
function reset() {
    display.value = '0';
    accumulator.value = null;
    operation.value = null;
    fresh.value = true;
    lastOperand.value = null;
    lastOperation.value = null;
}
function input(key: string) {
    if (key === 'clear') {
        if (clearLabel.value === 'AC' || display.value === 'Error')
            reset();
        else {
            display.value = '0';
            fresh.value = true;
            if (!operation.value) {
                accumulator.value = null;
                lastOperation.value = null;
                lastOperand.value = null;
            }
        }
        return;
    }
    if (display.value === 'Error')
        reset();
    if (key === '±') {
        display.value = display.value.startsWith('-') ? display.value.slice(1) : display.value === '0' ? '0' : '-' + display.value;
        return;
    }
    if (key === '%') {
        display.value = format(Number(display.value) / 100);
        return;
    }
    if (key === '.') {
        if (fresh.value) {
            display.value = '0.';
            fresh.value = false;
        }
        else if (!display.value.includes('.') && !display.value.includes('e'))
            display.value += '.';
        return;
    }
    if ([
        '+',
        '−',
        '×',
        '÷'
    ].includes(key)) {
        const op = key as Operator;
        const value = Number(display.value);
        if (operation.value && accumulator.value !== null && !fresh.value) {
            display.value = format(calculate(accumulator.value, value, operation.value));
        }
        if (display.value === 'Error') {
            operation.value = null;
            accumulator.value = null;
            return;
        }
        accumulator.value = Number(display.value);
        operation.value = op;
        fresh.value = true;
        lastOperation.value = null;
        lastOperand.value = null;
        return;
    }
    if (key === '=') {
        const op = operation.value ?? lastOperation.value;
        const a = operation.value ? accumulator.value : Number(display.value);
        const b = operation.value ? Number(display.value) : lastOperand.value;
        if (op && a !== null && b !== null) {
            const answer = format(calculate(a, b, op));
            history.value.unshift({
                expression: format(a) + ' ' + op + ' ' + format(b),
                answer
            });
            history.value = history.value.slice(0, 20);
            display.value = answer;
            lastOperation.value = answer === 'Error' ? null : op;
            lastOperand.value = answer === 'Error' ? null : b;
            operation.value = null;
            accumulator.value = null;
            fresh.value = true;
        }
        return;
    }
    if (fresh.value) {
        display.value = key;
        fresh.value = false;
    }
    else if (display.value.replace(/[-.]/g, '').length < 12) {
        display.value = display.value === '0' ? key : display.value + key;
    }
}
function backspace() {
    const shortened = display.value.slice(0, -1);
    display.value = display.value === 'Error' || display.value.includes('e') || !shortened || shortened === '-'
        ? '0'
        : shortened;
    fresh.value = false;
    lastOperation.value = null;
    lastOperand.value = null;
}
function label(key: string) {
    return ({
        clear: clearLabel.value,
        '±': 'Change sign',
        '%': 'Percent',
        '÷': 'Divide',
        '×': 'Multiply',
        '−': 'Subtract',
        '+': 'Add',
        '.': 'Decimal point',
        '=': 'Equals'
    } as Record<string, string>)[key] ?? key;
}
function restore(answer: string) {
    reset();
    display.value = answer;
    showHistory.value = false;
}
</script>

<template>
  <div class="app">
    <header class="toolbar">
      <button
        class="glass icon"
        aria-label="Show calculation history"
        :aria-pressed="showHistory"
        @click="showHistory=!showHistory"
      >
        <svg viewBox="0 0 24 24">
          <path d="M3 11a9 9 0 1 1 2 7M3 5v6h6M12 7v5l4 2" />
        </svg>
      </button>
      <span>Calculator</span>
      <button class="glass icon" aria-label="Delete last digit" @click="backspace">
        <svg viewBox="0 0 24 24">
          <path d="m8 5-6 7 6 7h14V5ZM12 9l6 6M18 9l-6 6" />
        </svg>
      </button>
    </header>
    <div class="display-zone">
      <p class="pending">{{ accumulator!==null ? accumulator+' '+operation : ' ' }}</p>
      <output :style="{fontSize}" aria-live="polite">{{ display }}</output>
    </div>
    <div class="keypad">
      <button
        v-for="key in keys"
        :key="key"
        :class="{utility:['clear','±','%'].includes(key),operator:['÷','×','−','+','='].includes(key),selected:operation===key,zero:key==='0'}"
        :aria-label="label(key)"
        :aria-pressed="operation===key"
        @click="input(key)"
      >
        {{ key==='clear'?clearLabel:key }}
      </button>
    </div>
    <div v-if="showHistory" class="history glass">
      <div class="bar">
        <h2>History</h2>
        <button class="icon" aria-label="Close history" @click="showHistory=false">
          <AppGlyph name="close" />
        </button>
      </div>
      <div class="history-scroll scroll">
        <p v-if="!history.length" class="empty">Your next calculation starts here.</p>
        <button v-for="(item,i) in history" :key="i" @click="restore(item.answer)">
          <small>{{ item.expression }}</small>
          <strong>
            =
            {{ item.answer }}
          </strong>
        </button>
      </div>
      <button class="clear-history pill" @click="history=[]">Clear history</button>
    </div>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  letter-spacing: -.02em;
  font-size: 17px;
  isolation: isolate;
}

.app * {
  box-sizing: border-box;
}

button, input, textarea {
  font: inherit;
  letter-spacing: inherit;
}

button {
  cursor: pointer;
  border: 0;
  background: none;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  touch-action: manipulation;
  transition: transform 250ms ease, opacity 250ms ease;
}

button:active {
  transform: scale(.96);
}

button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid #4d9fff;
  outline-offset: 2px;
}

button:disabled {
  opacity: .45;
  cursor: default;
}

input, textarea {
  font-size: 16px;
  min-height: 44px;
  color: inherit;
  border: 0;
  outline: none;
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -.035em;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

h3 {
  font-size: 17px;
  font-weight: 600;
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  min-height: 0;
}

.scroll::-webkit-scrollbar {
  display: none;
}

.glass {
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255,255,255,.35);
}

.top {
  padding: var(--safe-top,62px) 20px 12px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  padding: 10px;
}

.muted {
  color: #8e8e93;
  font-size: 13px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  gap: 2px;
  flex-shrink: 0;
  padding: 8px 10px var(--safe-bottom,34px);
  background: rgba(249,249,250,.85);
  backdrop-filter: blur(25px) saturate(180%);
  border-top: 1px solid rgba(0,0,0,.08);
}

.tabs button {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  min-height: 52px;
  border-radius: 22px;
  color: #8e8e93;
}

.tabs button.active {
  color: var(--accent,#007aff);
  background: rgba(127,127,127,.1);
}

.pill {
  border-radius: 24px;
  padding: 8px 16px;
}

.empty {
  padding: 44px 24px;
  text-align: center;
  color: #8e8e93;
  line-height: 1.5;
}

.search {
  width: 100%;
  background: rgba(127,127,127,.12);
  border-radius: 14px;
  padding: 10px 14px;
}

.section-label {
  font-size: 13px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: .03em;
  padding: 22px 16px 8px;
}

.hairline {
  border-bottom: 1px solid rgba(127,127,127,.18);
}

@media(prefers-reduced-motion:reduce) {
  .app *, .app *::before, .app *::after {
    animation: none!important;
    transition: none!important;
    scroll-behavior: auto!important;
  }
}

.app {
  background: #000;
  color: #fff;
  padding: var(--safe-top,62px) 18px var(--safe-bottom,34px);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 6px 0;
  color: #a5a5a5;
}

.toolbar>span {
  font-size: 13px;
}

.toolbar .icon {
  background: #232323;
  border-color: #ffffff25;
  color: #eee;
  width: 46px;
  height: 46px;
}

.display-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  padding: 16px 13px 22px;
  min-height: 120px;
  overflow: hidden;
}

.pending {
  font-size: 22px;
  color: #797979;
  min-height: 30px;
  margin-bottom: 14px;
}

.display-zone output {
  font-weight: 300;
  letter-spacing: -.045em;
  line-height: 1.1;
  white-space: nowrap;
  max-width: 100%;
  font-variant-numeric: tabular-nums;
  transition: transform 250ms ease, opacity 250ms ease;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 12px;
  padding: 0 0 12px;
}

.keypad button {
  height: 88px;
  min-width: 0;
  border-radius: 50%;
  font-size: 36px;
  font-weight: 400;
  background: #333;
  border: 1px solid #ffffff05;
}

.keypad button:active {
  background: #777;
}

.keypad .utility {
  background: #a5a5a5;
  color: #000;
  font-size: 30px;
}

.keypad .operator {
  background: #ff9f0a;
  color: #fff;
  font-size: 44px;
}

.keypad .operator.selected {
  background: #fff;
  color: #ff9f0a;
}

.keypad .zero {
  grid-column: span 2;
  text-align: left;
  padding-left: 34px;
  border-radius: 48px;
}

.history {
  position: absolute;
  top: calc(var(--safe-top,62px) + 18px);
  left: 18px;
  right: 18px;
  bottom: calc(var(--safe-bottom,34px) + 15px);
  background: #202020eb;
  border-radius: 30px;
  display: flex;
  flex-direction: column;
  padding: 22px;
  box-shadow: 0 20px 70px #0009;
}

.history .bar {
  border-bottom: 1px solid #ffffff18;
  padding-bottom: 12px;
}

.history-scroll {
  flex: 1;
}

.history-scroll button {
  display: flex;
  width: 100%;
  flex-direction: column;
  text-align: right;
  border-bottom: 1px solid #ffffff18;
  padding: 20px 4px;
  gap: 8px;
}

.history-scroll small {
  color: #999;
  font-size: 16px;
}

.history-scroll strong {
  font-size: 26px;
  font-weight: 400;
}

.clear-history {
  background: #333;
  color: #ff9f0a;
  margin-top: 15px;
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  container-type: size;
  min-width: 0;
  min-height: 0;
}

.app :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

button, a[download] {
  min-width: 44px;
  min-height: 44px;
  touch-action: manipulation;
  transition: transform 220ms ease, opacity 220ms ease;
}

button:active:not(:disabled), a[download]:active {
  transform: scale(.96);
}

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid var(--accent, #007aff);
  outline-offset: 3px;
}

.icon, .tool, .glass-round, .round, .go, .send {
  flex-shrink: 0;
}

.scroll, .scroller, .feed, .page, .tiles {
  min-width: 0;
  min-height: 0;
  overscroll-behavior: contain;
}

.tabs button {
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
}

@media (hover: hover) {
  button:hover:not(:disabled), a[download]:hover {
    opacity: .82;
  }
}

@media (pointer: coarse) {
  button, a[download] {
    min-width: 58px;
    min-height: 58px;
  }
  .tabs button {
    min-width: 0;
    min-height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app :deep(*), .app :deep(*::before), .app :deep(*::after) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.toolbar {
  flex-shrink: 0;
}

.display-zone {
  min-height: 92px;
  padding-block: 12px;
}

.keypad {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  flex-shrink: 0;
}

.keypad button {
  height: clamp(58px, 9.2cqh, 88px);
  min-width: 0;
}

.history {
  overflow-y: auto;
  overscroll-behavior: contain;
}

@container (max-height: 700px) {
  .pending {
    font-size: 18px;
    min-height: 24px;
  }
  .keypad {
    gap: 8px;
    padding-bottom: 8px;
  }
  .keypad button {
    font-size: 32px;
  }
  .keypad .utility {
    font-size: 26px;
  }
  .keypad .operator {
    font-size: 38px;
  }
}

.history {
  animation: pocket-reveal 250ms ease both;
}

@keyframes pocket-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .history {
    animation: none;
  }
}
</style>
