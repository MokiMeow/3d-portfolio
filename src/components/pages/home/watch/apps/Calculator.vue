<script setup lang="ts">
import { useWatch, useWatchHardware, clamp } from "../watch";
type Operator = '+' | '−' | '×' | '÷';
const watch = useWatch();
const display = ref('0');
const accumulator = ref<number | null>(null);
const operator = ref<Operator | null>(null);
const fresh = ref(false);
const previousOperand = ref<number | null>(null);
const previousOperator = ref<Operator | null>(null);
const tip = ref(false);
const bill = ref(0);
const percent = ref(20);
const people = ref(1);
const tipField = ref<'percent' | 'people'>('percent');
const tipAmount = computed(() => bill.value * percent.value / 100);
const total = computed(() => bill.value + tipAmount.value);
const perPerson = computed(() => total.value / people.value);
const keys = ['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '⌫', '0', '.', '='];
function clean(value: number) {
  return Number.isFinite(value) ? String(Number(value.toPrecision(11))) : 'Error';
}
function calculate(a: number, b: number, op: Operator) {
  return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b;
}
function clear() {
  display.value = '0';
  accumulator.value = null;
  operator.value = null;
  previousOperand.value = null;
  previousOperator.value = null;
  fresh.value = false;
}
function key(value: string) {
  watch.haptic();
  if (value === 'AC') {
    clear();
    return;
  }
  if (/^[0-9.]$/.test(value)) {
    if (fresh.value || display.value === 'Error') {
      display.value = value === '.' ? '0.' : value;
      fresh.value = false;
      return;
    }
    if (value === '.' && display.value.includes('.')) return;
    if (display.value.length >= 12) return;
    display.value = display.value === '0' && value !== '.' ? value : display.value + value;
    return;
  }
  if (value === '⌫') {
    if (fresh.value || display.value === 'Error') {
      display.value = '0';
      fresh.value = false;
    } else display.value = display.value.length > 1 ? display.value.slice(0, -1) : '0';
    if (display.value === '−' || display.value === '-') display.value = '0';
    return;
  }
  if (display.value === 'Error') return;
  if (value === '±') {
    display.value = clean(-Number(display.value));
    return;
  }
  if (value === '%') {
    display.value = clean(Number(display.value) / 100);
    return;
  }
  if (value === '=') {
    const op = operator.value ?? previousOperator.value;
    const operand = operator.value ? Number(display.value) : previousOperand.value;
    if (op !== null && operand !== null) {
      const left = accumulator.value ?? Number(display.value);
      display.value = clean(calculate(left, operand, op));
      accumulator.value = Number(display.value);
      previousOperand.value = operand;
      previousOperator.value = op;
      operator.value = null;
      fresh.value = true;
    }
    return;
  }
  const op = value as Operator;
  if (operator.value && accumulator.value !== null && !fresh.value) display.value = clean(calculate(accumulator.value, Number(display.value), operator.value));
  if (display.value === 'Error') {
    accumulator.value = null;
    operator.value = null;
    return;
  }
  accumulator.value = Number(display.value);
  operator.value = op;
  fresh.value = true;
  previousOperator.value = null;
  previousOperand.value = null;
}
function openTip() {
  bill.value = Math.max(0, Number(display.value) || 0);
  tip.value = true;
}
function money(value: number) {
  return value.toFixed(2);
}
useWatchHardware('calculator', {
  crown: delta => {
    if (!tip.value) return false;
    if (tipField.value === 'percent') percent.value = clamp(percent.value + Math.sign(delta), 0, 100);else people.value = clamp(people.value + Math.sign(delta), 1, 20);
    return true;
  },
  back: () => {
    if (!tip.value) return false;
    tip.value = false;
    return true;
  }
});
</script>

<template>
  <section class="watch-app calculator-app">
    <h1>
      {{tip?'Tip & Split':'Calculator'}}
    </h1>
    <template v-if="tip">
      <p class="caption muted">
        Bill
        {{money(bill)}}
      </p>
      <div class="platter adjust">
        <button :class="{selected:tipField==='percent'}" @click="tipField='percent'">
          <span class="caption">Tip</span>
          <strong>
            {{percent}}
            %
          </strong>
        </button>
        <div class="adjust-buttons">
          <button aria-label="Decrease tip" @click="percent=clamp(percent-1,0,100)">−</button>
          <button aria-label="Increase tip" @click="percent=clamp(percent+1,0,100)">＋</button>
        </div>
      </div>
      <div class="platter adjust">
        <button :class="{selected:tipField==='people'}" @click="tipField='people'">
          <span class="caption">People</span>
          <strong>
            {{people}}
          </strong>
        </button>
        <div class="adjust-buttons">
          <button aria-label="Fewer people" @click="people=clamp(people-1,1,20)">−</button>
          <button aria-label="More people" @click="people=clamp(people+1,1,20)">＋</button>
        </div>
      </div>
      <div class="row">
        <span>Tip</span>
        <span>
          {{money(tipAmount)}}
        </span>
      </div>
      <div class="row">
        <span>Total</span>
        <span>
          {{money(total)}}
        </span>
      </div>
      <div class="per-person">
        <span class="caption muted">Per person</span>
        <strong>
          {{money(perPerson)}}
        </strong>
      </div>
      <button class="watch-button full" @click="tip=false">Done</button>
    </template>
    <template v-else>
      <div class="expression caption muted">
        {{operator&&accumulator!==null?accumulator+' '+operator:''}}
      </div>
      <output :class="{small:display.length>8}">
        {{display}}
      </output>
      <div class="keypad">
        <button
          v-for="value in keys"
          :key="value"
          :class="{operation:['÷','×','−','+','='].includes(value),utility:['AC','±','%','⌫'].includes(value),selected:operator===value}"
          :aria-label="value==='⌫'?'Delete last digit':value==='±'?'Change sign':value"
          @click="key(value)"
        >
          {{value}}
        </button>
      </div>
      <button class="watch-button full" @click="openTip">Tip & Split</button>
    </template>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.calculator-app h1 {
  color: #ff9f0a;
}

.expression {
  text-align: right;
  min-height: 24px;
  font-size: max(calc(12px / var(--watch-scale)), calc(22px * var(--text-size, 1)));
}

.calculator-app output {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(55px * var(--text-size, 1)));
  font-weight: 300;
  text-align: right;
  line-height: 1.15;
  margin: 8px 0 20px;
  overflow-wrap: anywhere;
  letter-spacing: -2px;
}

.calculator-app output.small {
  font-size: max(calc(12px / var(--watch-scale)), calc(34px * var(--text-size, 1)));
}

.keypad {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 10px;
}

.keypad button {
  min-height: 78px;
  aspect-ratio: 1;
  border: 0;
  border-radius: 50%;
  background: #333336;
  color: white;
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
}

.keypad .operation {
  background: #ff9f0a;
}

.keypad .utility {
  background: #a5a5a7;
  color: #000;
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.keypad .selected {
  background: #fff;
  color: #ff9f0a;
}

.full {
  width: 100%;
  margin-top: 20px;
}

.adjust {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 14px 0;
}

.adjust>button {
  flex: 1;
  min-height: 100px;
  text-align: left;
  border: 0;
  background: none;
  color: #fff;
}

.adjust strong {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(33px * var(--text-size, 1)));
}

.adjust .selected {
  color: #ff9f0a;
}

.adjust-buttons {
  display: flex;
  gap: 8px;
}

.adjust-buttons button {
  width: 72px;
  height: 76px;
  background: #303034;
  border: 0;
  color: #ff9f0a;
  border-radius: 50%;
  font-size: max(calc(12px / var(--watch-scale)), calc(28px * var(--text-size, 1)));
}

.per-person {
  padding: 24px 0;
}

.per-person strong {
  display: block;
  font-size: max(calc(12px / var(--watch-scale)), calc(53px * var(--text-size, 1)));
  font-weight: 400;
}

.row {
  font-size: max(calc(12px / var(--watch-scale)), calc(24px * var(--text-size, 1)));
}

.calculator-app > h1 {
  position: absolute;
  top: 18px;
  left: 108px;
  right: 96px;
  z-index: 4;
  font-size: 23px;
  text-align: center;
  margin: 0;
}

.expression:empty {
  display: none;
}

.calculator-app output {
  font-size: 48px;
  line-height: 1.05;
  margin: 0 0 8px;
}

.keypad {
  gap: 6px;
}

.keypad button {
  aspect-ratio: auto;
  min-height: max(68px, calc(40px / var(--watch-scale)));
  height: 68px;
  font-size: 29px;
}
</style>
