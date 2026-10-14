<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { formatDuration, useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const page = ref<'favorites' | 'recents' | 'keypad'>('favorites');
const call = ref<'idle' | 'incoming' | 'active'>('idle');
const caller = ref('Amma');
const started = ref(0);
const muted = ref(false);
const digits = ref('');
const callKeypad = ref(false);
const recents = ref([
  {
    name: 'Amma',
    label: 'Incoming · demo'
  }, {
    name: 'Design Club',
    label: 'Outgoing · demo'
  }
]);
const elapsed = computed(() => formatDuration((watch.now.value.getTime() - started.value) / 1000));
function dial(name: string) {
  caller.value = name;
  call.value = 'active';
  started.value = watch.now.value.getTime();
  muted.value = false;
  callKeypad.value = false;
  watch.haptic('success');
}
function end() {
  recents.value.unshift({
    name: caller.value,
    label: call.value === 'incoming' ? 'Declined · demo' : 'Completed · demo'
  });
  call.value = 'idle';
  callKeypad.value = false;
  watch.haptic();
}
function key(value: string) {
  digits.value = (digits.value + value).slice(0, 18);
  watch.haptic();
}
useWatchHardware('phone', {
  back: () => {
    if (callKeypad.value) {
      callKeypad.value = false;
      return true;
    }
    if (call.value !== 'idle') {
      end();
      return true;
    }
    if (page.value !== 'favorites') {
      page.value = 'favorites';
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root">
    <h1>{{ call !== 'idle' ? caller : page === 'recents' ? 'Recents' : page === 'keypad' ? 'Keypad' : 'Phone' }}</h1>
    <template v-if="call !== 'idle'">
      <div class="caller">
        <div class="avatar">
          {{ caller.slice(0, 1) }}
        </div>
        <h2>
          {{ caller }}
        </h2>
        <p class="caption muted">
          {{ call === 'incoming' ? 'Incoming demo call' : 'Simulated call · ' + elapsed }}
        </p>
      </div>
      <template v-if="call === 'incoming'">
        <div class="button-row">
          <button class="watch-button danger" @click="end">Decline</button>
          <button class="watch-button positive" @click="dial(caller)">Answer</button>
        </div>
      </template>
      <template v-else>
        <div v-if="callKeypad" class="keypad">
          <button
            v-for="n in ['1','2','3','4','5','6','7','8','9','*','0','#']"
            :key="n"
            @click="key(n)"
          >
            {{ n }}
          </button>
        </div>
        <p v-if="callKeypad" class="digits">
          {{ digits || 'Enter tones' }}
        </p>
        <div class="button-row">
          <button
            class="watch-button"
            :aria-pressed="muted"
            @click="muted = !muted"
          >
            {{ muted ? 'Unmute' : 'Mute' }}
          </button>
          <button
            class="watch-button"
            :aria-pressed="callKeypad"
            @click="callKeypad = !callKeypad"
          >
            Keypad
          </button>
        </div>
        <button class="watch-button danger" @click="end">End call</button>
      </template>
    </template>
    <template v-else>
      <nav class="tabs">
        <button
          v-for="tab in (['favorites','recents','keypad'] as const)"
          :key="tab"
          :class="{ selected: page === tab }"
          @click="page = tab"
        >
          <WatchGlyph :name="tab === 'favorites' ? 'star' : tab === 'recents' ? 'clock' : 'grid'" />
          <span>
            {{ tab }}
          </span>
        </button>
      </nav>
      <template v-if="page === 'favorites'">
        <button
          v-for="name in ['Amma','Design Club','Rubber Duck']"
          :key="name"
          class="contact platter"
          @click="dial(name)"
        >
          <span class="small-avatar">
            {{ name.slice(0,1) }}
          </span>
          <span>
            {{ name }}
          </span>
          <span class="positive">
            <WatchGlyph name="phone" />
          </span>
        </button>
        <button class="watch-button" @click="caller = 'Amma'; call = 'incoming'">Simulate incoming</button>
      </template>
      <template v-else-if="page === 'recents'">
        <button
          v-for="(recent,i) in recents"
          :key="i"
          class="recent platter"
          @click="dial(recent.name)"
        >
          <strong>
            {{ recent.name }}
          </strong>
          <span class="caption muted">
            {{ recent.label }}
          </span>
        </button>
      </template>
      <template v-else>
        <p class="digits">
          {{ digits || 'Enter number' }}
        </p>
        <div class="keypad">
          <button
            v-for="n in ['1','2','3','4','5','6','7','8','9','*','0','#']"
            :key="n"
            @click="key(n)"
          >
            {{ n }}
          </button>
        </div>
        <div class="button-row">
          <button
            class="watch-button"
            @click="digits = digits.slice(0,-1)"
            aria-label="Delete last digit"
          >
            <WatchGlyph name="delete" />
          </button>
          <button
            class="watch-button positive"
            :disabled="!digits"
            @click="dial(digits)"
          >
            Call
          </button>
        </div>
      </template>
      
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
  margin: 14px 0;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}

.tabs button {
  flex: 1;
  min-height: 86px;
  border: 0;
  border-radius: 24px;
  background: #1c1c1e;
  color: #aaa;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.tabs span {
  display: block;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  text-transform: capitalize;
}

.tabs .selected {
  color: #30d158;
  background: #12361c;
}

.contact {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 88px;
  width: 100%;
  border: 0;
  color: white;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  margin-bottom: 10px;
  text-align: left;
}

.contact>span:last-child {
  margin-left: auto;
}

.small-avatar,
.avatar {
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #264430;
  color: #8ef9a7;
  font-weight: 600;
}

.small-avatar {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}

.avatar {
  width: 108px;
  height: 108px;
  margin: auto;
  font-size: max(18px, calc(44px * var(--text-size, 1)));
}

.caller {
  text-align: center;
  margin: 16px 0 26px;
}

.recent {
  width: 100%;
  min-height: 92px;
  border: 0;
  color: white;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
  font-size: max(18px, calc(26px * var(--text-size, 1)));
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.keypad button {
  height: 76px;
  border: 0;
  border-radius: 40px;
  background: #2c2c2e;
  color: white;
  font-size: max(18px, calc(30px * var(--text-size, 1)));
}

.digits {
  min-height: 42px;
  text-align: center;
  word-break: break-all;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.note {
  margin-top: 22px;
}

.watch-button {
  margin-bottom: 12px;
}

button:disabled {
  opacity: .4;
}

.contact {
  min-height: 78px;
  font-size: 25px;
  gap: 12px;
}

.tabs {
  gap: 6px;
  margin-bottom: 12px;
}

.tabs button {
  min-height: 76px;
}

.tabs button svg {
  width: 26px;
  height: 26px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #34D35B; }

.tabs button { min-width:0; min-height:76px; border-radius:30px; }
.tabs span { font-size:20px; line-height:1.25; }
.contact > span:nth-child(2) { flex:1; min-width:0; }
.contact > span:last-child { flex:0 0 24px; }
.contact strong, .recent strong { font-size:24px; }
.keypad { grid-template-columns:repeat(3,minmax(0,1fr)); }
.keypad button { min-height:76px; font-size:30px; }
.caller h2 { color:white; text-transform:none; font-size:28px; }
.digits { line-height:1.25; overflow-wrap:anywhere; }
</style>
