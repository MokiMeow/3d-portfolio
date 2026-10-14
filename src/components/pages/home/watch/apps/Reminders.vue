<script setup lang="ts">
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
type Reminder = {
  id: number;
  title: string;
  done: boolean;
};
const items = ref<Reminder[]>([
  {
    id: 1,
    title: 'Drink some water',
    done: false
  }, {
    id: 2,
    title: 'Back up the tiny universe',
    done: false
  }, {
    id: 3,
    title: 'Thank the rubber duck',
    done: true
  }
]);
const editing = ref<number | 'new' | null>(null);
const draft = ref('');
const showCompleted = ref(true);
let nextId = 4;
const remaining = computed(() => items.value.filter(item => !item.done).length);
const visible = computed(() => items.value.filter(item => showCompleted.value || !item.done));
function edit(item?: Reminder) {
  editing.value = item?.id ?? 'new';
  draft.value = item?.title ?? '';
}
function save() {
  const title = draft.value.trim();
  if (!title)
    return;
  if (editing.value === 'new')
    items.value.push({
      id: nextId++,
      title,
      done: false
    });
  else {
    const item = items.value.find(row => row.id === editing.value);
    if (item)
      item.title = title;
  }
  editing.value = null;
  watch.haptic('success');
}
function remove() {
  items.value = items.value.filter(item => item.id !== editing.value);
  editing.value = null;
  watch.haptic();
}
useWatchHardware('reminders', {
  back: () => {
    if (editing.value !== null) {
      editing.value = null;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root">
    <h1>{{ editing === 'new' ? 'New Reminder' : editing !== null ? 'Edit Reminder' : 'Reminders' }}</h1>
    <template v-if="editing !== null">
      <h2>
        {{ editing === 'new' ? 'New reminder' : 'Edit reminder' }}
      </h2>
      <label class="caption muted" for="reminder-title">Reminder</label>
      <textarea
        id="reminder-title"
        v-model="draft"
        maxlength="120"
        placeholder="Something to remember"
      />
      <button
        class="watch-button orange"
        :disabled="!draft.trim()"
        @click="save"
      >Save</button>
      <button class="watch-button" @click="editing = null">Cancel</button>
      <button
        v-if="editing !== 'new'"
        class="watch-button danger"
        @click="remove"
      >Delete reminder</button>
    </template>
    <template v-else>
      <div class="summary">
        <strong>
          {{ remaining }}
        </strong>
        <span>to do</span>
      </div>
      <div
        v-for="item in visible"
        :key="item.id"
        class="reminder platter"
      >
        <button
          class="check"
          :class="{ done: item.done }"
          :aria-label="(item.done ? 'Mark incomplete: ' : 'Complete: ') + item.title"
          :aria-pressed="item.done"
          @click="item.done = !item.done; watch.haptic('success')"
        >
          {{ item.done ? '✓' : '' }}
        </button>
        <button
          class="text"
          :class="{ completed: item.done }"
          :aria-label="'Edit ' + item.title"
          @click="edit(item)"
        >
          {{ item.title }}
        </button>
      </div>
      <p v-if="!visible.length" class="caption muted">Nothing here. Enjoy the breathing room.</p>
      <button class="watch-button orange" @click="edit()">＋ New reminder</button>
      <button
        class="watch-button"
        :aria-pressed="showCompleted"
        @click="showCompleted = !showCompleted"
      >
        {{ showCompleted ? 'Hide completed' : 'Show completed' }}
      </button>
      
    </template>
    <p class="polish-footnote">Demo data, for fun.</p>
  </div>
</template>

<style scoped>
.root {
  font-family: 'SF Pro Rounded','SF Pro Display',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}

.root :deep(*) {
  font-family: inherit;
}

h1 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  margin: 0 0 20px;
}

h2 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  margin: 14px 0 24px;
}

.summary {
  display: flex;
  gap: 14px;
  align-items: baseline;
  color: #ff9f0a;
  margin: 10px 0 22px;
}

.summary strong {
  font-size: max(18px, calc(63px * var(--text-size, 1)));
  line-height: 1.2;
}

.summary span {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.reminder {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  padding: 8px 12px;
}

.check {
  width: 72px;
  height: 78px;
  flex-shrink: 0;
  border: 0;
  background: none;
  color: #ff9f0a;
  font-size: max(18px, calc(27px * var(--text-size, 1)));
  position: relative;
}

.check:before {
  content: '';
  position: absolute;
  width: 38px;
  height: 38px;
  border: 3px solid #ff9f0a;
  border-radius: 50%;
  inset: 17px 14px;
  pointer-events: none;
}

.check.done:before {
  background: #ff9f0a22;
}

.text {
  flex: 1;
  min-height: 80px;
  text-align: left;
  background: none;
  border: 0;
  color: white;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  line-height: 1.2;
  padding: 10px 4px;
}

.completed {
  color: #888;
  text-decoration: line-through;
}

.orange {
  color: #ffb640;
  background: #543007;
}

.watch-button {
  margin-bottom: 12px;
}

textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 150px;
  background: #222225;
  border: 1px solid #666;
  border-radius: 24px;
  color: white;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  padding: 18px;
  margin: 14px 0 22px;
  resize: vertical;
}

button:disabled {
  opacity: .4;
}

.summary {
  margin: 6px 0 12px;
}

.text {
  min-height: 68px;
}

.reminder {
  padding: 6px 10px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF9500; }

.reminder { align-items:center; }
.reminder .text { min-width:0; flex:1; font-size:24px; line-height:1.25; overflow-wrap:anywhere; }
.check { width:52px; height:64px; }
.check::before { inset:13px 7px; }
.summary strong { font-size:80px; font-weight:600; }
.summary span { font-size:26px; font-weight:600; }
textarea { border-radius:30px; line-height:1.3; }
</style>
