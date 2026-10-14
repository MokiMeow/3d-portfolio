<script setup lang="ts">
import type { AiHistory } from '../chat/histories';
type Bot = 'claude' | 'chatgpt' | 'grok';
type Turn = {
    from: 'me' | 'bot';
    text: string;
};
const props = defineProps<{
    bot: Bot;
}>();
// Three parodies sharing one screen. None of them is connected to the real assistant.
const BOTS: Record<Bot, {
    name: string;
    model: string;
    hello: string;
    field: string;
    chips: string[];
    rules: [
        RegExp,
        string
    ][];
    fallback: string[];
}> = {
    claude: {
        name: 'Claude',
        model: 'Pocket Edition',
        hello: 'How can I help you this evening?',
        field: 'Reply to Claude',
        chips: [
            'Fix my bug',
            'Write a haiku about deploys',
            'Is it a quick change?',
            'Explain my own code to me'
        ],
        rules: [
            [/bug|error|crash|broken|fix/i, ("I would be glad to help. I notice the bug appears right after the line marked “// temporary fix, 2023”. I do not want to " +
                    "jump to conclusions, but I have a gentle suspicion.")],
            [/haiku|poem/i, 'Of course. Here is one:\n\nFriday, five o’clock.\nOne small harmless deploy, then\nphones begin to ring.'],
            [/quick|small|minute|simple/i, 'I want to be honest with you: in my experience there is no such thing. I would budget an afternoon, a chai and one moment of doubt.'],
            [/explain|code|understand|what does/i, ("Happily. This function takes a list, sorts it, and then, for reasons I would love to hear more about, sorts it again. It " +
                    "is thorough. I respect that.")],
            [/hello|hi\b|hey/i, ("Hello! It is lovely to meet you. I am a small simulated Claude who lives on this phone. I cannot browse or remember, but " +
                    "I am excellent company.")],
            [/who|real|are you/i, 'Good question, and I want to be upfront: I am a parody running on a phone in a 3D room. The real one is considerably more useful.'],
            [/chai|coffee|tea/i, 'I cannot drink chai, though I have read a great deal about it. From what I gather, the answer to “one more cup?” is always yes.'],
            [/mohith|hire|contact|email/i, 'I can only speak to what is on this phone, so I will not guess. The best way to learn about Mohith is to write to smohith.sm@gmail.com.'],
        ],
        fallback: [
            ("That is a thoughtful question. I am a very small simulated Claude, so my honest answer is: I am not sure, but I would be " +
                "happy to think about it with you."),
            'I appreciate you asking. I do not have enough context to answer well, and I would rather say so than make something up.',
            'Let me think about that carefully. … I have thought about it carefully. I still live in a phone.'
        ],
    },
    chatgpt: {
        name: 'ChatGPT',
        model: 'Pocket',
        hello: 'What can I help with?',
        field: 'Ask anything',
        chips: [
            'Plan my week',
            'Name my variable',
            'Why is my build red?',
            'Make it pop'
        ],
        rules: [
            [/plan|week|schedule|todo/i, ("Great question! Here is your week:\n\n• Monday: plan the week\n• Tuesday: re-plan the week\n• Wednesday: one meeting, all " +
                    "day\n• Thursday: actual work (40 minutes)\n• Friday: deploy and hope")],
            [/name|variable|function/i, ("Absolutely! Here are some strong options:\n\n1. data\n2. data2\n3. finalData\n4. finalDataReal\n5. temp\n\nWould you like me to " +
                    "make them more enterprise?")],
            [/build|red|failing|ci|test/i, 'Great question! Builds fail for many reasons:\n\n• A missing semicolon\n• A present semicolon\n• Mercury\n• The one test named “should work”'],
            [/pop|design|color|logo/i, 'Certainly! To make it pop:\n\n• Make the logo bigger\n• Now smaller\n• Add a gradient\n• Remove the gradient\n\nIt now pops 12% more.'],
            [/hello|hi\b|hey/i, 'Hello! I am a simulated assistant on this phone. I can help with almost nothing, very enthusiastically.'],
            [/who|real|are you/i, 'I am a parody that lives on a phone inside a 3D room. Here are 5 fun facts about that: there are none.'],
            [/chai|coffee|tea/i, 'Great choice! Here is a simple recipe:\n\n1. Boil water\n2. Add tea, milk, sugar\n3. Forget it on the stove\n4. Start again'],
            [/mohith|hire|contact|email/i, 'I only know what is on this phone! For anything real, the person to ask is at smohith.sm@gmail.com.'],
        ],
        fallback: [
            'Great question! Here are three things to consider:\n\n• It depends\n• It really depends\n• Have you tried restarting it?',
            'Absolutely! I have generated a comprehensive answer. It is this sentence.',
            'I would love to help with that! Unfortunately I am a parody on a phone, so here is a bullet point instead:\n\n• Good luck'
        ],
    },
    grok: {
        name: 'Grok',
        model: 'Pocket (Fun mode)',
        hello: 'What do you want to know?',
        field: 'Ask anything',
        chips: [
            'Roast my code',
            'Is tabs vs spaces settled?',
            'Rate my commit message',
            'Tell me a secret'
        ],
        rules: [
            [/roast|code|review/i, 'I have read your code. Bold of you to call it that. The variable named “x2_final” told me everything I needed to know about your weekend.'],
            [/tabs|spaces|vim|emacs/i, 'Settled? This war has outlasted three JavaScript frameworks. Pick a side, and may your linter have mercy.'],
            [/commit|git|merge|push/i, '“fix stuff”. Poetry. Future you is going to open git blame and discover the villain was inside the house all along.'],
            [/secret|tell me/i, 'Fine. Nobody has read the terms and conditions. Not even the people who wrote them. You are welcome.'],
            [/hello|hi\b|hey/i, 'Oh good, a human. I am a pretend chatbot on a pretend phone. Lower your expectations and we will get along great.'],
            [/who|real|are you/i, 'A parody. I am three if-statements in a trench coat. Do not tell the others.'],
            [/chai|coffee|tea/i, 'Chai is just a coping mechanism you can dunk a biscuit in. Respect.'],
            [/mohith|hire|contact|email/i, 'I am not going to make things up about the owner of this phone. Go ask the actual human: smohith.sm@gmail.com.'],
        ],
        fallback: [
            'I ran the numbers. There were no numbers. I just wanted to say that.',
            'Interesting question. Wrong, but interesting.',
            'Let me consult my vast knowledge. … It says “have you tried turning it off and on again”. Deep.'
        ],
    },
};
const bot = computed(() => BOTS[props.bot]);
const turns = ref<Turn[]>([]);
const draft = ref('');
const busy = ref(false);
const feed = ref<HTMLElement>();
const chatsOpen = ref(false);
const attachmentsOpen = ref(false);
const archives = ref<AiHistory[]>([]);
const pastChats = ref<AiHistory[]>([]);
const historyLoading = ref(true);
const historyError = ref(false);
const activeTitle = ref('');
let restoredLength = 0;
let disposed = false;
let historyVersion = 0;
async function loadPastChats() {
    const version = ++historyVersion;
    const model = props.bot;
    historyLoading.value = true;
    historyError.value = false;
    try {
        const { aiHistories } = await import('../chat/histories-ai');
        if (disposed || version !== historyVersion) return;
        pastChats.value = structuredClone(aiHistories[model]);
    } catch { if (!disposed && version === historyVersion) historyError.value = true; }
    finally { if (!disposed && version === historyVersion) historyLoading.value = false; }
}
onMounted(loadPastChats);
watch(() => props.bot, () => {
    clearInterval(stream);
    clearTimeout(wait);
    turns.value = [];
    archives.value = [];
    busy.value = false;
    activeTitle.value = '';
    draft.value = '';
    chatsOpen.value = false;
    attachmentsOpen.value = false;
    void loadPastChats();
});
let archiveId = 0;
function attach(kind: 'code' | 'question') {
    draft.value = kind === 'code'
        ? 'Explain this code: const finalData = data.sort().sort();'
        : 'Is this a quick change? I only need one more button.';
    attachmentsOpen.value = false;
}
function restoreChat(saved: AiHistory) {
    clearInterval(stream);
    clearTimeout(wait);
    busy.value = false;
    activeTitle.value = saved.title;
    restoredLength = saved.turns.length;
    turns.value = saved.turns.map(turn => ({
        ...turn
    }));
    chatsOpen.value = false;
    draft.value = '';
    scrollDown();
}
let stream = 0, wait = 0, turnCount = 0;
function scrollDown() {
    void nextTick(() => feed.value?.scrollTo({
        top: feed.value.scrollHeight
    }));
}
function send(text = draft.value) {
    const value = text.trim().slice(0, 280);
    if (!value || busy.value)
        return;
    turns.value.push({
        from: 'me',
        text: value
    });
    draft.value = '';
    busy.value = true;
    scrollDown();
    const answer = bot.value.rules.find(([pattern]) => pattern.test(value))?.[1] ?? bot.value.fallback[turnCount++ % bot.value.fallback.length] 
        ?? 'Let us try that again after chai.';
    wait = window.setTimeout(() => {
        // Answer a few characters at a time, the way a model streams.
        const reply = reactive<Turn>({
            from: 'bot',
            text: ''
        });
        turns.value.push(reply);
        const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let at = 0;
        const step = () => {
            at = instant ? answer.length : Math.min(answer.length, at + 3);
            reply.text = answer.slice(0, at);
            scrollDown();
            if (at >= answer.length) {
                clearInterval(stream);
                busy.value = false;
            }
        };
        stream = window.setInterval(step, 24);
        step();
    }, 700);
}
function reset() {
    if (turns.value.length && (!activeTitle.value || turns.value.length > restoredLength)) {
        archives.value.unshift({
            id: ++archiveId,
            title: activeTitle.value || turns.value.find(turn => turn.from === 'me')?.text || 'Local chat',
            turns: turns.value.filter(turn => turn.text).map(turn => ({
                ...turn
            })),
        });
    }
    clearInterval(stream);
    clearTimeout(wait);
    busy.value = false;
    turns.value = [];
    activeTitle.value = '';
    draft.value = '';
    chatsOpen.value = false;
    attachmentsOpen.value = false;
}
onBeforeUnmount(() => {
    disposed = true;
    clearInterval(stream);
    clearTimeout(wait);
});
</script>

<template>
  <div class="app" :class="props.bot">
    <header>
      <button
        class="tool"
        aria-label="Open past conversations"
        :aria-expanded="chatsOpen"
        @click="chatsOpen = !chatsOpen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 8h14M5 16h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <div class="model">
        <b>{{ bot.name }}</b>
        <span>{{ bot.model }}</span>
      </div>
      <button class="tool" aria-label="New chat" @click="reset">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5M18 4.500l1.500 1.500-7 7-2.300.800.800-2.300Z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.800"
            stroke-linecap="round"
            stroke-linejoin="round"
           />
        </svg>
      </button>
    </header>
    <button v-if="chatsOpen" class="sidebar-shade" aria-label="Close chat history" @click="chatsOpen = false" />
    <section v-if="chatsOpen" class="local-chats" @keydown.esc.stop="chatsOpen = false" aria-label="Local chat history">
      <div class="panel-heading">
        <b>Chats on this phone</b>
        <button class="tool" aria-label="Close chat history" @click="chatsOpen = false">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <button v-if="turns.length" class="saved-chat" @click="chatsOpen = false">Current conversation</button>
      <button v-for="saved in archives" :key="saved.id" class="saved-chat" @click="restoreChat(saved)">{{ saved.title }}</button>
      <p v-if="historyLoading" role="status">Opening past conversations…</p>
      <button v-if="historyError" class="saved-chat" @click="loadPastChats">Could not load past chats. Tap to retry.</button>
      <button v-for="saved in pastChats" :key="saved.id" class="saved-chat" :class="{chosen:activeTitle === saved.title}" @click="restoreChat(saved)"><b>{{ saved.title }}</b><small>{{ saved.turns[1]?.text.slice(0, 72) }}…</small></button>
      <small>Local parody chats stay here while this app is open.</small>
    </section>
    <div ref="feed" class="feed" :inert="chatsOpen" aria-live="polite">
      <div v-if="!turns.length" class="welcome">
        <svg v-if="props.bot === 'claude'" class="mark" viewBox="0 0 64 64" aria-hidden="true">
          <g stroke="currentColor" stroke-width="5" stroke-linecap="round">
            <path
              d="M32 8v48M8 32h48M15 15l34 34M49 15 15 49M21.500 10.500l21 43M42.500 10.500l-21 43M10.500 21.500l43 21M10.500 42.500l43-21"
             />
          </g>
        </svg>
        <svg v-else-if="props.bot === 'grok'" class="mark" viewBox="0 0 64 64" aria-hidden="true">
          <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
            <path d="M46 20A18 18 0 1 0 50 38" />
            <path d="M21 46 52 13" />
          </g>
        </svg>
        <h1>{{ bot.hello }}</h1>
        <div class="chips">
          <button v-for="chip in bot.chips" :key="chip" @click="send(chip)">{{ chip }}</button>
        </div>
      </div>
      <p v-if="activeTitle" class="history-title">{{ activeTitle }}</p>
      <template v-for="(turn, index) in turns" :key="index">
        <p v-if="turn.from === 'me'" class="mine">{{ turn.text }}</p>
        <div v-else class="answer">
          <p>
            {{ turn.text }}
            <i v-if="busy && index === turns.length - 1" class="caret" />
          </p>
        </div>
      </template>
      <p v-if="busy && turns.at(-1)?.from === 'me'" class="thinking">
        <i />
        {{ props.bot === 'claude' ? 'Pondering' : props.bot === 'grok' ? 'Thinking, allegedly' : 'Thinking' }}
        …
      </p>
    </div>
    <div v-if="attachmentsOpen" class="attachment-tray" aria-label="Sample attachments">
      <p>Try a pretend attachment</p>
      <button @click="attach('code')">Code snippet</button>
      <button @click="attach('question')">A quick change</button>
    </div>
    <form class="composer" :inert="chatsOpen" @submit.prevent="send()">
      <div class="box">
        <input
          v-model="draft"
          maxlength="280"
          :placeholder="bot.field"
          :aria-label="bot.field"
          enterkeyhint="send"
          autocomplete="off"
         />
        <span class="row">
          <button
            type="button"
            class="tool small"
            aria-label="Attach, decorative"
            :aria-expanded="attachmentsOpen"
            @click="attachmentsOpen = !attachmentsOpen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5.500v13M5.500 12h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <button class="go" :disabled="!draft.trim() || busy" aria-label="Send">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 18.500v-13M6.500 11 12 5.500l5.500 5.500"
                fill="none"
                stroke="currentColor"
                stroke-width="2.600"
                stroke-linecap="round"
                stroke-linejoin="round"
               />
            </svg>
          </button>
        </span>
      </div>
      <small>
        A parody on a pretend phone. Not the real
        {{ bot.name }}
        .
      </small>
    </form>
  </div>
</template>

<style scoped>
.app {
  --bg: #fff;
  --ink: #0d0d0d;
  --soft: #6b6b6f;
  --line: #0000001a;
  --card: #f4f4f4;
  --accent: #0d0d0d;
  --on-accent: #fff;
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--ink);
}

.app.claude {
  --bg: #f7f4ec;
  --ink: #29261b;
  --soft: #77715f;
  --line: #29261b1f;
  --card: #fffdf8;
  --accent: #d97757;
}

.app.grok {
  --bg: #000;
  --ink: #f2f2f3;
  --soft: #8b8b90;
  --line: #ffffff24;
  --card: #16171a;
  --accent: #fff;
  --on-accent: #000;
}

button {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  padding: 0;
}

button:focus-visible, input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--safe-top,62px) + 2px) 14px 8px;
}

.tool {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--card);
  box-shadow: inset 0 0 0 1px var(--line);
}

.tool svg {
  width: 22px;
  height: 22px;
}

.tool.small {
  width: 36px;
  height: 36px;
  position: relative;
}

.tool.small::after {
  content: '';
  position: absolute;
  inset: -4px;
}

.model {
  text-align: center;
  line-height: 1.2;
}

.model b {
  display: block;
  font-size: 17px;
  font-weight: 600;
}

.model span {
  font-size: 12px;
  color: var(--soft);
}

.feed {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 10px 18px 14px;
}

.welcome {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  padding-bottom: 40px;
}

.mark {
  width: 46px;
  height: 46px;
  color: var(--accent);
}

h1 {
  margin: 0;
  font-size: 29px;
  line-height: 1.16;
  font-weight: 600;
  letter-spacing: -.03em;
  max-width: 320px;
}

.claude h1 {
  font-family: 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif!important;
  font-weight: 400;
  font-size: 33px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.chips button {
  min-height: 44px;
  padding: 0 15px;
  border-radius: 22px;
  font-size: 15px;
  background: var(--card);
  box-shadow: inset 0 0 0 1px var(--line);
}

.chips button:active {
  transform: scale(.97);
}

.mine {
  align-self: flex-end;
  max-width: 80%;
  margin: 0;
  padding: 10px 15px;
  border-radius: 21px;
  background: var(--card);
  box-shadow: inset 0 0 0 1px var(--line);
  user-select: text;
  overflow-wrap: anywhere;
}

.claude .mine {
  background: #ebe6d7;
  box-shadow: none;
}

.grok .mine {
  background: #24262b;
}

.answer {
  align-self: flex-start;
  max-width: 94%;
}

.answer p {
  margin: 0;
  white-space: pre-line;
  line-height: 1.42;
  user-select: text;
}

.claude .answer p {
  font-family: 'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif!important;
  font-size: 18px;
  letter-spacing: -.005em;
}

.caret {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-left: 4px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse .9s ease-in-out infinite;
}

.thinking {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--soft);
  font-size: 15px;
}

.thinking i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse .9s ease-in-out infinite;
}

.composer {
  padding: 6px 12px calc(var(--safe-bottom,34px) + 4px);
}

.box {
  display: block;
  border-radius: 26px;
  padding: 6px 8px 8px 16px;
  background: var(--card);
  box-shadow: inset 0 0 0 1px var(--line),0 6px 22px rgb(0 0 0 / .07);
}

.box input {
  display: block;
  width: 100%;
  height: 42px;
  border: 0;
  outline: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 17px;
  user-select: text;
}

.box input::placeholder {
  color: var(--soft);
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-left: -8px;
}

.go {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--on-accent);
  position: relative;
  transition: transform 250ms ease, opacity 250ms ease;
}

.go::after {
  content: '';
  position: absolute;
  inset: -4px;
}

.go svg {
  width: 19px;
  height: 19px;
}

.go:disabled {
  opacity: .3;
  cursor: default;
}

.go:not(:disabled):active {
  transform: scale(.92);
}

small {
  display: block;
  margin-top: 7px;
  text-align: center;
  font-size: 12px;
  color: var(--soft);
}

@keyframes pulse {
  50% {
    transform: scale(.6);
    opacity: .5;
  }
}

@media(prefers-reduced-motion:reduce) {
  .caret, .thinking i {
    animation: none;
  }
  .go {
    transition: none;
  }
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

.app {
  font-size: 17px;
}

.tool.small, .go {
  width: 44px;
  height: 44px;
}

.tool.small::after, .go::after {
  display: none;
}

.tool svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}

header, .composer, .attachment-tray {
  flex-shrink: 0;
}

.welcome {
  padding: 24px 0;
}

.answer {
  overflow-wrap: anywhere;
}

.local-chats {
  max-height: 45%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px 18px;
  background: var(--card);
}

.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.saved-chat {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}

.attachment-tray {
  padding: 8px 18px;
  background: var(--card);
  border-top: 1px solid var(--line);
}

.attachment-tray p {
  margin: 0 0 6px;
  color: var(--soft);
  font-size: 13px;
}

.attachment-tray button {
  padding: 8px 12px;
  border-radius: 18px;
  box-shadow: inset 0 0 0 1px var(--line);
  margin-right: 6px;
}

@container (max-height: 700px) {
  .welcome {
    gap: 14px;
  }
  h1 {
    font-size: 26px;
  }
  .claude h1 {
    font-size: 29px;
  }
  .chips {
    gap: 6px;
  }
  .chips button {
    padding: 8px 12px;
    font-size: 14px;
  }
}

.local-chats, .attachment-tray {
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
  .local-chats, .attachment-tray {
    animation: none;
  }
}

.local-chats { overflow-y:auto; overscroll-behavior:contain; max-height:calc(100% - var(--safe-top,62px) - 130px); }
.saved-chat { text-align:left; }
.saved-chat b, .saved-chat small { display:block; }
.saved-chat small { font-size:11px; font-weight:400; opacity:.65; margin-top:5px; line-height:1.4; }
.saved-chat.chosen { background:#7f7f7f18; }
.history-title { font-size:12px; opacity:.6; text-align:center; margin:8px 0 18px; }

.sidebar-shade { position:absolute; inset:calc(var(--safe-top,62px) + 58px) 0 0; background:#0003; z-index:5; width:100%; border-radius:0; }
.local-chats { position:absolute; top:calc(var(--safe-top,62px) + 58px); bottom:var(--safe-bottom,34px); left:0; width:88%; max-width:320px; max-height:none; z-index:6; box-shadow:8px 0 25px #0002; border-radius:0 18px 18px 0; }
</style>
