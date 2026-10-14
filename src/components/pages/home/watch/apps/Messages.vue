<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
type Thread = {
  id: number;
  name: string;
  initial: string;
  messages: {
    text: string;
    mine: boolean;
    drawing?: string;
  }[];
};
const threads = ref<Thread[]>([
  {
    id: 1,
    name: 'Amma',
    initial: 'A',
    messages: [
      {
        text: 'Have you eaten? The demo dinner is ready.',
        mine: false
      }
    ]
  }, {
    id: 2,
    name: 'Design Club',
    initial: 'D',
    messages: [
      {
        text: 'The prototype is looking sharp. Coffee?',
        mine: false
      }
    ]
  }, {
    id: 3,
    name: 'Rubber Duck',
    initial: 'R',
    messages: [
      {
        text: 'Have you tried explaining the bug out loud?',
        mine: false
      }
    ]
  }
]);
const selected = ref<number | null>(null);
const thread = computed(() => threads.value.find(item => item.id === selected.value));
const mode = ref<'reply' | 'emoji' | 'dictation' | 'scribble'>('reply');
const draft = ref('');
const listening = ref(false);
const dictationAt = ref(0);
const pending = ref(false);
const surface = ref<SVGSVGElement | null>(null);
const strokes = ref<string[]>([]);
const drawing = ref(false);
const active = ref(true);
const animated = computed(() => !watch.reducedMotion.value && !watch.dimmed.value);
function send(text: string, sketch?: string) {
  if (!thread.value || (!text.trim() && !sketch))
    return;
  thread.value.messages.push({
    text: text.trim(),
    mine: true,
    drawing: sketch
  });
  draft.value = '';
  strokes.value = [];
  listening.value = false;
  mode.value = 'reply';
  watch.haptic('success');
}
function dictate() {
  listening.value = !listening.value;
  dictationAt.value = watch.now.value.getTime();
  pending.value = listening.value;
}
watchEffect(() => {
  if (active.value && listening.value && pending.value && watch.now.value.getTime() - dictationAt.value >= 2500) {
    draft.value = 'On my way!';
    listening.value = false;
    pending.value = false;
  }
});
function point(event: PointerEvent) {
  const rect = surface.value?.getBoundingClientRect();
  return rect ? ((event.clientX - rect.left) / rect.width * 340).toFixed(1) + ',' + ((event.clientY - rect.top) / rect.height * 160).toFixed(1) : '';
}
function down(event: PointerEvent) {
  if (!surface.value)
    return;
  surface.value.setPointerCapture(event.pointerId);
  drawing.value = true;
  strokes.value.push(point(event));
}
function move(event: PointerEvent) {
  if (drawing.value && strokes.value.length)
    strokes.value[strokes.value.length - 1] += ' ' + point(event);
}
function stop() {
  listening.value = false;
  pending.value = false;
  drawing.value = false;
}
onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
  stop();
});
onBeforeUnmount(stop);
useWatchHardware('messages', {
  back: () => {
    if (mode.value !== 'reply') {
      mode.value = 'reply';
      stop();
      return true;
    }
    if (selected.value !== null) {
      selected.value = null;
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root" :class="{ still: !animated }">
    <h1>
      {{ thread?.name || 'Messages' }}
    </h1>
    <template v-if="!thread">
      
      <button
        v-for="item in threads"
        :key="item.id"
        class="thread platter"
        @click="selected = item.id"
      >
        <span class="avatar">
          {{ item.initial }}
        </span>
        <span class="preview">
          <strong>
            {{ item.name }}
          </strong>
          <small>
            {{ item.messages.at(-1)?.drawing ? 'Scribble' : item.messages.at(-1)?.text }}
          </small>
        </span>
        <span class="chevron">
          <WatchGlyph name="next" />
        </span>
      </button>
    </template>
    <template v-else>
      <div class="bubbles">
        <div
          v-for="(message,i) in thread.messages"
          :key="i"
          class="bubble"
          :class="{ mine: message.mine }"
        >
          <svg
            v-if="message.drawing"
            viewBox="0 0 340 160"
            aria-label="Sent scribble"
          >
            <polyline
              v-for="(path,j) in message.drawing.split('|')"
              :key="j"
              :points="path"
              fill="none"
              stroke="white"
              stroke-width="5"
              stroke-linecap="round"
            />
          </svg>
          <span v-else>
            {{ message.text }}
          </span>
        </div>
      </div>
      <div class="composer platter">
        <p class="caption muted">
          {{ mode === 'dictation' ? 'Dictation' : mode === 'scribble' ? 'Draw a reply' : 'Reply' }}
        </p>
        <template v-if="mode === 'reply'">
          <button
            v-for="reply in ['On my way!','Sounds good','Thank you!']"
            :key="reply"
            class="quick"
            @click="send(reply)"
          >
            {{ reply }}
          </button>
        </template>
        <div v-if="mode === 'emoji'" class="emoji">
          <button
            v-for="reaction in [{glyph:'heart',text:'Love it!'}, {glyph:'check',text:'Sounds good!'}, {glyph:'smile',text:'That made me smile'}, {glyph:'coffee',text:'Coffee?'}, {glyph:'reply',text:'Hello!'}, {glyph:'star',text:'Congratulations!'}]"
            :key="reaction.glyph"
            :aria-label="reaction.text" @click="send(reaction.text)"
          >
            <WatchGlyph :name="reaction.glyph" />
          </button>
        </div>
        <template v-if="mode === 'dictation'">
          <div
            v-if="listening"
            class="waves"
            aria-label="Simulated listening"
          >
            <i
              v-for="n in 9"
              :key="n"
              :style="{ animationDelay: n * .09 + 's' }"
            />
          </div>
          <button class="watch-button" @click="dictate">
            {{ listening ? 'Stop listening' : 'Start demo dictation' }}
          </button>
        </template>
        <template v-if="mode === 'scribble'">
          <svg
            ref="surface"
            class="scribble"
            viewBox="0 0 340 160"
            role="img"
            aria-label="Draw a reply with pointer or finger"
            @pointerdown="down"
            @pointermove="move"
            @pointerup="drawing = false"
            @pointercancel="drawing = false"
          >
            <polyline
              v-for="(path,i) in strokes"
              :key="i"
              :points="path"
              fill="none"
              stroke="#fff"
              stroke-width="5"
              stroke-linecap="round"
            />
          </svg>
          <div class="button-row">
            <button class="watch-button" @click="strokes = []">Clear</button>
            <button
              class="watch-button positive"
              :disabled="!strokes.length"
              @click="send('',strokes.join('|'))"
            >
              Send drawing
            </button>
          </div>
        </template>
        <label class="caption" for="message-draft">Type a reply</label>
        <input
          id="message-draft"
          v-model="draft"
          placeholder="Message"
          maxlength="160"
          @keydown.enter="send(draft)"
        />
        <button
          class="watch-button positive"
          :disabled="!draft.trim()"
          @click="send(draft)"
        >Send</button>
        <div class="tools">
          <button aria-label="Quick replies" @click="mode = 'reply'; stop()">
            <WatchGlyph name="reply" />
          </button>
          <button aria-label="Reaction replies" @click="mode = 'emoji'; stop()">
            <WatchGlyph name="smile" />
          </button>
          <button aria-label="Demo dictation" @click="mode = 'dictation'">
            <WatchGlyph name="mic" />
          </button>
          <button aria-label="Scribble reply" @click="mode = 'scribble'; stop()">
            <WatchGlyph name="edit" />
          </button>
        </div>
      </div>
      
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
  margin: 0 0 18px;
}

.thread {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: 110px;
  border: 0;
  color: white;
  text-align: left;
  margin-bottom: 12px;
}

.avatar {
  border-radius: 50%;
  background: #345744;
  color: #a9f2bc;
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
  flex-shrink: 0;
}

.preview {
  min-width: 0;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.preview small {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  color: #aaa;
  max-width: 235px;
  margin-top: 7px;
}

.chevron {
  color: #888;
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  margin-left: auto;
}

.back {
  min-height: 72px;
  background: none;
  border: 0;
  color: #30d158;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  text-align: left;
  padding: 0;
}

.bubbles {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 0 24px;
}

.bubble {
  max-width: 90%;
  align-self: flex-start;
  padding: 18px 22px;
  border-radius: 28px;
  background: #2c2c2e;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  line-height: 1.22;
}

.mine {
  align-self: flex-end;
  background: #178c38;
}

.bubble svg {
  width: 260px;
  display: block;
}

.composer {
  margin-bottom: 18px;
}

.quick {
  width: 100%;
  min-height: 74px;
  border: 0;
  background: #303035;
  color: white;
  border-radius: 24px;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  margin-bottom: 9px;
}

.tools {
  display: flex;
  gap: 8px;
}

.tools button {
  min-height: 76px;
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 24px;
  background: #363639;
  color: #30d158;
  font-size: max(18px, calc(30px * var(--text-size, 1)));
}

.emoji {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 8px;
}

.emoji button {
  height: 80px;
  background: #303035;
  border: 0;
  border-radius: 20px;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

input {
  box-sizing: border-box;
  width: 100%;
  min-height: 74px;
  border: 1px solid #666;
  background: #161618;
  color: white;
  border-radius: 20px;
  padding: 14px;
  font-size: max(18px, calc(24px * var(--text-size, 1)));
  margin: 10px 0;
}

.scribble {
  width: 100%;
  height: 160px;
  border: 1px dashed #666;
  border-radius: 20px;
  background: #101012;
  touch-action: none;
}

.waves {
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.waves i {
  width: 9px;
  height: 54px;
  background: #30d158;
  border-radius: 8px;
  animation: wave .65s infinite alternate;
}

.still .waves i {
  animation: none;
  height: 34px;
}

.watch-button {
  margin-bottom: 12px;
}

button:disabled {
  opacity: .4;
}

@keyframes wave {
  to {
    transform: scaleY(0.35);
  }
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #34D35B; }

.thread { gap:10px; }
.preview { flex:1; min-width:0; }
.preview small { max-width:none; white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; line-height:1.25; font-size:20px; }
.avatar { width:48px; height:48px; }
.bubble { border-radius:30px; font-size:24px; line-height:1.25; overflow-wrap:anywhere; }
.bubble svg { width:100%; max-width:260px; }
.quick { min-height:64px; border-radius:32px; font-size:24px; }
.tools button { min-height:64px; border-radius:32px; }
.emoji button { display:grid; place-items:center; color:#34d35b; min-width:0; }
.emoji :deep(svg) { width:32px; height:32px; }
</style>
