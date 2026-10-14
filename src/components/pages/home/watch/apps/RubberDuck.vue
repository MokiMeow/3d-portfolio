<script setup lang="ts">
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const bug = ref('');
const asked = ref(false);
const questionIndex = ref(0);
const input = ref<HTMLTextAreaElement | null>(null);
const questions = computed(() => {
  const text = bug.value.toLowerCase();
  if (/async|promise|await|fetch|api|request|race/.test(text))
    return [
      'What happens if that request finishes second?',
      'Have you checked the actual response, including its status?',
      'Who catches the rejection? Be specific.',
      'Can you reproduce it with one request and no cache?'
    ];
  if (/css|style|layout|flex|grid|width|height|screen/.test(text))
    return [
      'What is the computed style, not the style you hoped for?',
      'Which ancestor is constraining the width?',
      'Does the smallest viewport reproduce it?',
      'What changes if you remove one layout rule at a time?'
    ];
  if (/null|undefined|type|typescript|object/.test(text))
    return [
      'Where did that value come from? Follow it backwards.',
      'What does the value contain immediately before the error?',
      'Is absence a valid state your code needs to handle?',
      'Can you make the smallest failing example?'
    ];
  if (/test|build|deploy|production|works/.test(text))
    return [
      'What differs between your wrist and production?',
      'Can you reproduce it from a clean start?',
      'Which environment variable are you assuming exists?',
      'What is the first failing line in the log?'
    ];
  return [
    'What did you expect, and what actually happened?',
    'Explain the failing line to me. Slowly.',
    'What changed just before the bug appeared?',
    'What is the smallest input that still breaks it?',
    'Have you checked your assumptions with a log?'
  ];
});
const question = computed(() => questions.value[questionIndex.value % questions.value.length]);
function ask() {
  if (!bug.value.trim()) {
    input.value?.focus();
    return;
  }
  asked.value = true;
  questionIndex.value = 0;
  watch.haptic();
}
function next() {
  questionIndex.value++;
  watch.haptic();
}
function startOver() {
  asked.value = false;
  questionIndex.value = 0;
  nextTick(() => input.value?.focus());
}
useWatchHardware('rubberDuck', {
  action: () => {
    if (asked.value)
      next();
    else
      ask();
    return true;
  }
});
</script>

<template>
  <section class="watch-app duck-app">
    <h1>Rubber Duck</h1>
    <div class="duck" aria-hidden="true">
      <svg viewBox="0 0 180 130">
        <path
          d="M28 74c-24-4-20-17-13-24 4 20 30 16 46 10-8-5-12-14-12-24a28 28 0 1 1 53 13c24 5 36 21 32 40-5 25-37 34-68 28-25-5-39-21-38-43Z"
          fill="#ffd60a"
        />
        <path d="M102 30h23l-6 13h-20Z" fill="#ff9500" />
        <circle
          cx="87"
          cy="26"
          r="4"
          fill="#18180d"
        />
        <path
          d="M58 77c13 15 31 12 40 5"
          stroke="#e8af00"
          stroke-width="5"
          fill="none"
          stroke-linecap="round"
        />
      </svg>
      <span>quack.</span>
    </div>
    <template v-if="!asked">
      <label class="caption" for="duck-bug">Tell me what's broken.</label>
      <textarea
        id="duck-bug"
        ref="input"
        v-model="bug"
        maxlength="400"
        rows="3"
        placeholder="It works until I…"
        @keydown.ctrl.enter.prevent="ask"
      />
      <button class="watch-button duck-button" @click="ask">Explain it to the duck</button>
    </template>
    <template v-else>
      <div
        class="platter question"
        role="status"
        aria-live="polite"
      >
        <span class="caption muted">
          QUESTION
          {{ questionIndex + 1 }}
        </span>
        <p>
          {{ question }}
        </p>
      </div>
      <button class="watch-button duck-button" @click="next">Another useful question</button>
      <button class="watch-button edit" @click="startOver">Edit the bug</button>
    </template>
    <p class="caption muted footnote">
      Local canned wisdom. No AI,
      <br />
      no uploads. Unlimited judgment.
    </p>
  </section>
</template>

<style scoped>
.duck-app {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,sans-serif;
}

.duck-app :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  margin: 0 0 10px;
}

.duck {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 10px 0 14px;
}

.duck svg {
  width: 155px;
  height: 112px;
}

.duck span {
  align-self: flex-start;
  color: #ffd60a;
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  transform: rotate(-9deg);
  padding-top: 18px;
}

label {
  display: block;
  margin: 10px 0;
}

textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 132px;
  padding: 18px 22px;
  border: 2px solid #48483b;
  border-radius: 26px;
  background: #1c1c1e;
  color: white;
  resize: vertical;
  font-size: max(calc(12px / var(--watch-scale)), calc(24px * var(--text-size, 1)));
  line-height: 1.3;
  margin-bottom: 15px;
}

textarea:focus-visible {
  outline: 4px solid #ffd60a;
  outline-offset: 2px;
}

textarea::placeholder {
  color: #919187;
}

.duck-button {
  background: #ffd60a;
  color: #242005;
  font-size: max(calc(12px / var(--watch-scale)), calc(24px * var(--text-size, 1)));
  font-weight: 700;
}

.question {
  border: 1px solid #ffd60a33;
  margin-bottom: 18px;
  padding: 25px;
}

.question .caption {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  letter-spacing: 2px;
  color: #d1b756;
}

.question p {
  font-size: max(calc(12px / var(--watch-scale)), calc(29px * var(--text-size, 1)));
  line-height: 1.25;
  margin: 13px 0 0;
}

.edit {
  margin-top: 12px;
  background: #29281c;
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
}

.footnote {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  line-height: 1.5;
  text-align: center;
  margin: 20px 0 0;
}

.duck {
  margin: 4px 0 8px;
}

.duck svg {
  width: 120px;
  height: 86px;
}

textarea {
  min-height: 98px;
  height: 98px;
  margin-bottom: 8px;
  padding: 12px 16px;
  resize: none;
}
</style>
