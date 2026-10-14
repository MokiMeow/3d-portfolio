<script setup lang="ts">
import { PHONE } from '../phone';
import { createChatSession, type ReadState } from '../chat/engine';
import { messagesPersonas } from '../chat/personas';
import { textParts, vote, percent, type RichMessage } from '../chat/histories';
const phone = inject(PHONE);
type Bubble = RichMessage & {
    from: 'me' | 'them'; who?: string;
    reaction?: string; state?: ReadState; readTime?: string;
    playing?: boolean; progress?: number;
};
type Thread = {
    id: string;
    name: string;
    initials: string;
    tint: string;
    when: string;
    unread?: boolean;
    group?: boolean;
    sms?: boolean;
    bubbles: Bubble[];
};
const threads = ref<Thread[]>([]);
const loading = ref(true);
const loadError = ref(false);
let disposed = false;
let nextBubbleId = 200000;
async function loadHistories() {
    loading.value = true;
    loadError.value = false;
    try {
        const { messageHistories } = await import('../chat/histories-messages');
        if (disposed) return;
        threads.value = structuredClone(messageHistories).map(history => ({ ...history, when: 'Today', unread: ['bot', 'amma', 'chai', 'unknown'].includes(history.id), bubbles: history.messages.map(message => ({ ...message, from: message.mine ? 'me' as const : 'them' as const, who: history.group ? message.sender : undefined, state: message.mine ? 'read' as const : undefined, readTime: message.time })) }));
        for (const thread of threads.value) {
            const base = messagesPersonas[thread.id] ?? messagesPersonas[thread.id === 'cousin' ? 'landlord' : 'chai']!;
            const persona = thread.id === 'cousin' ? { ...base, name: thread.name, members: undefined, replies: { ...base.replies, help: ['Try one page first. The printer is easily overwhelmed.', 'Is the paper free to move? Even paper needs personal space.', 'Check the print preview before asking the printer to perform.'], work: ['The printer says offline. I say cautiously hopeful.', 'Eight blank pages later, we have found the blank document.', 'Same Wi-Fi first. Inspirational troubleshooting later.'], unknown: ['One small printer question. Famous last words.', 'The blinking light has developed another opinion.', 'I will read the preview before clicking print again.'] } } : thread.id === 'unknown' ? { ...base, name: 'Dev', members: undefined } : base;
            sessions.set(thread.id, createChatSession({ ...persona, voiceNotes: [], photos: [], stickers: [] }));
        }
    } catch { if (!disposed) loadError.value = true; }
    finally { if (!disposed) loading.value = false; }
}
onMounted(loadHistories);
const openId = ref<string | null>(null);
const active = computed(() => threads.value.find(item => item.id === openId.value) ?? null);
const draft = ref('');
const typingRooms = ref<string[]>([]);
const typing = computed(() => !!openId.value && (typingRooms.value.includes(openId.value) || ambientTyping.value === openId.value));
const lastSent = computed(() => [...(active.value?.bubbles ?? [])].reverse().find(bubble => bubble.from === 'me'));
const sessions = new Map<string, ReturnType<typeof createChatSession>>();
const query = ref('');
const editingList = ref(false);
const choosingRecipient = ref(false);
const attachmentsOpen = ref(false);
const callOpen = ref(false);
function toggleRead(thread: Thread) {
    thread.unread = !thread.unread;
}
function chooseAttachment(text: string) {
    attachmentsOpen.value = false;
    draft.value = text;
}
const feed = ref<HTMLElement>();
const followTail = ref(true);
function trackTail(event: Event) {
    const element = event.currentTarget as HTMLElement;
    followTail.value = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
}
const shown = computed(() => {
    const needle = query.value.trim().toLowerCase();
    return threads.value.filter(item => !needle ||
        (item.name + ' ' + (item.bubbles.at(-1)?.text ?? '')).toLowerCase().includes(needle));
});
const timers = new Set<ReturnType<typeof setTimeout>>();
function later(action: () => void, delay: number) {
    const timer = setTimeout(() => { timers.delete(timer); action(); }, delay);
    timers.add(timer);
}
function scrollDown(force = false) {
    void nextTick(() => {
        if (!force && !followTail.value) return;
        followTail.value = true;
        feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: 'auto' });
    });
}
function enter(thread: Thread) {
    thread.unread = false;
    openId.value = thread.id;
    draft.value = '';
    choosingRecipient.value = false;
    editingList.value = false;
    attachmentsOpen.value = false;
    callOpen.value = false;
    scrollDown(true);
}
function back() {
    openId.value = null;
    callOpen.value = false;
    attachmentsOpen.value = false;
}
function send(text = draft.value) {
    const thread = active.value, value = text.trim().slice(0, 240);
    if (!thread || !value) return;
    thread.bubbles.push({ id: nextBubbleId++, mine: true, from: 'me', text: value, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), date: 'Today', state: 'sent' });
    const own = thread.bubbles.at(-1)!;
    thread.when = 'now';
    draft.value = '';
    const plan = sessions.get(thread.id)!.respond(value, new Date());
    later(() => { own.state = 'delivered'; }, plan.receipt.deliveredAt);
    later(() => { own.state = 'read'; own.readTime = plan.receipt.time; }, plan.receipt.readAt);
    if (plan.reaction) later(() => { own.reaction = plan.reaction!.emoji; }, plan.reaction.atMs);
    for (const event of plan.typing) later(() => {
        typingRooms.value = typingRooms.value.filter(id => id !== thread.id);
        if (event.active) typingRooms.value.push(thread.id);
        if (openId.value === thread.id) scrollDown();
    }, event.atMs);
    for (const bubble of plan.bubbles) later(() => {
        thread.bubbles.push({ id: nextBubbleId++, mine: false, from: 'them', text: bubble.text, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), date: 'Today', who: thread.group ? bubble.sender : undefined, color: bubble.color, quote: { id: own.id, sender: 'You', text: own.text, color: '#007aff' } });
        if (openId.value !== thread.id) thread.unread = true;
        else scrollDown();
    }, bubble.atMs);
    scrollDown(true);
}

const ambientTyping = ref<string | null>(null);
let activityTimer: ReturnType<typeof setTimeout> | undefined;
let autoCount = 0;
const gangActivity = [
    { who: 'Meera', color: '#b04e29', text: 'Saved a corner bajji. No calendar invite required.' },
    { who: 'Auto Anna', color: '#996028', text: 'The shortcut has requested an extension. Tea has not.' },
    { who: 'Rubber Duck', color: '#846721', text: 'Quack. Short walk, warm chai, small plan.' },
    { who: 'Stand-up Timer', color: '#795394', text: 'Meeting ended early. This is what success tastes like.' },
    { who: 'Meera', color: '#b04e29', text: 'The fancy mug has stopped rolling. Morale stable.' },
    { who: 'Auto Anna', color: '#996028', text: 'On the way, with actual motion this time.' }
];
function scheduleActivity(thread: Thread) {
    if (!thread.group || autoCount >= 6 || disposed) return;
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        activityTimer = undefined;
        if (autoCount >= 6) return;
        if (openId.value !== thread.id || disposed) return;
        if (document.hidden || typingRooms.value.includes(thread.id)) { scheduleActivity(thread); return; }
        const activity = gangActivity[autoCount++]!;
        ambientTyping.value = thread.id;
        later(() => {
            if (ambientTyping.value === thread.id) ambientTyping.value = null;
            const last = thread.bubbles.at(-1);
            thread.bubbles.push({ ...activity, sender: activity.who, id: nextBubbleId++, mine: false, from: 'them', time: 'now', date: 'Today', quote: last ? { id: last.id, sender: last.who ?? (last.mine ? 'You' : thread.name), text: last.text, color: last.color ?? '#007aff' } : undefined });
            thread.when = 'now';
            if (openId.value !== thread.id) thread.unread = true;
            else { scrollDown(); scheduleActivity(thread); }
        }, 1500);
    }, 20000 + Math.random() * 20000);
}
watch(openId, () => { if (activityTimer) clearTimeout(activityTimer); if (active.value) scheduleActivity(active.value); });
const flashId = ref<number | null>(null);
function jumpTo(id: number) {
    feed.value?.querySelector<HTMLElement>('[data-message-id="' + id + '"]')?.scrollIntoView({ block: 'center', behavior: 'auto' });
    followTail.value = false;
    flashId.value = id;
    later(() => { if (flashId.value === id) flashId.value = null; }, 1500);
}
const lightbox = ref<{ src: string; caption: string } | null>(null);
const photoClose = ref<HTMLButtonElement>();
let photoTrigger: HTMLElement | null = null;
function showPhoto(message: Bubble, event: MouseEvent) {
    if (!message.src) return;
    photoTrigger = event.currentTarget as HTMLElement;
    lightbox.value = { src: message.fullSrc ?? message.src.replace('-s.webp', '.webp'), caption: message.text };
    void nextTick(() => photoClose.value?.focus());
}
function closePhoto() { lightbox.value = null; photoTrigger?.focus(); }
function reactTo(reaction: NonNullable<RichMessage['reactions']>[number]) {
    reaction.selected = !reaction.selected;
    reaction.count += reaction.selected ? 1 : -1;
}
const waveform = [8, 15, 22, 12, 28, 18, 10, 24, 32, 16, 25, 12, 20, 30];
const playbackVersions = new Map<number, number>();
function playVoice(message: Bubble) {
    const version = (playbackVersions.get(message.id) ?? 0) + 1;
    playbackVersions.set(message.id, version);
    message.playing = !message.playing;
    if (!message.playing) return;
    if ((message.progress ?? 0) >= 1) message.progress = 0;
    const seconds = Number(message.duration?.split(':')[1] ?? 14);
    function advance() {
        if (!message.playing || playbackVersions.get(message.id) !== version) return;
        message.progress = Math.min(1, (message.progress ?? 0) + 0.1 / seconds);
        if (message.progress >= 1) message.playing = false;
        else later(advance, 100);
    }
    later(advance, 100);
}
onBeforeUnmount(() => { disposed = true; timers.forEach(clearTimeout); if (activityTimer) clearTimeout(activityTimer); });
</script>

<template>
  <div class="app">
    <!--Conversation list-->
    <section class="pane list" :class="{ behind: !!active }" :inert="!!active">
      <header class="list-head">
        <button
          class="glass-pill"
          aria-label="Edit, decorative"
          :aria-pressed="editingList"
          @click="editingList = !editingList"
        >
          {{ editingList ? 'Done' : 'Edit' }}
        </button>
        <button
          class="glass-round"
          aria-label="New message, decorative"
          :aria-expanded="choosingRecipient"
          @click="choosingRecipient = !choosingRecipient"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 19h3.500L19 8.500 15.500 5 5 15.500Z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.800"
              stroke-linejoin="round"
             />
          </svg>
        </button>
      </header>
      <div class="scroller">
        <h1>{{ choosingRecipient ? 'New Message' : 'Messages' }}</h1>
        <p v-if="choosingRecipient || editingList" class="list-instruction">
          {{ choosingRecipient ? 'Choose a local conversation.' : 'Tap a conversation to mark it read or unread.' }}
        </p>
        <label class="search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.500" fill="none" stroke="currentColor" stroke-width="1.600" />
            <path
              d="m10.500 10.500 3.500 3.500"
              stroke="currentColor"
              stroke-width="1.600"
              stroke-linecap="round"
             />
          </svg>
          <input v-model="query" type="search" placeholder="Search" aria-label="Search messages" />
        </label>
        <p v-if="loading" class="history-loading" role="status">Opening the messages…</p>
        <button v-if="loadError" class="history-loading" @click="loadHistories">Could not load messages. Tap to retry.</button>
        <ul>
          <li v-for="thread in shown" :key="thread.id">
            <button class="row" @click="editingList ? toggleRead(thread) : enter(thread)">
              <i class="dot" :class="{ on: thread.unread }" />
              <span class="avatar" :style="{ background: thread.tint }">{{ thread.initials }}</span>
              <span class="row-text">
                <b>
                  <span class="thread-name">{{ thread.name }}</span>
                  <small>
                    {{ thread.when }}
                    <em>›</em>
                  </small>
                </b>
                <span>
                  {{ thread.bubbles.at(-1)?.who ? `${thread.bubbles.at(-1)?.who}: ` : '' }}
                  {{ typingRooms.includes(thread.id) || ambientTyping === thread.id ? 'typing…' : thread.bubbles.at(-1)?.text }}
                </span>
              </span>
            </button>
          </li>
        </ul>
        <p v-if="!shown.length" class="empty">No results. Even the spam is hiding.</p>
      </div>
    </section>
    <!--One conversation-->
    <Transition name="push">
      <section v-if="active" class="pane talk">
        <header class="talk-head">
          <button class="glass-round" aria-label="Back to all messages" @click="back">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14.500 5 8 12l6.500 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2.200"
                stroke-linecap="round"
                stroke-linejoin="round"
               />
            </svg>
          </button>
          <div class="who">
            <span class="avatar big" :style="{ background: active.tint }">{{ active.initials }}</span>
            <b>{{ active.name }}</b>
          </div>
          <button
            class="glass-round"
            aria-label="Video call, decorative"
            :aria-expanded="callOpen"
            @click="callOpen = !callOpen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect
                x="3.500"
                y="7"
                width="12"
                height="10"
                rx="2.500"
                fill="none"
                stroke="currentColor"
                stroke-width="1.800"
               />
              <path
                d="m15.500 11 5-3v8l-5-3Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.800"
                stroke-linejoin="round"
               />
            </svg>
          </button>
        </header>
        <section v-if="callOpen" class="call-card" aria-label="Simulated video call">
          <b>
            Video call with
            {{ active.name }}
          </b>
          <p>Local simulation. Your camera stays off until you open it.</p>
          <button v-if="phone" @click="phone.open('camera')">Open camera</button>
          <button @click="callOpen = false">End preview</button>
        </section>
        <div ref="feed" class="feed" aria-live="polite" @scroll.passive="trackTail">

          <p class="stamp">{{ active.sms ? 'Text Message · SMS' : 'iMessage' }} · Fictional conversation</p>
          <template v-for="(bubble, index) in active.bubbles" :key="bubble.id">
            <p v-if="index === 0 || bubble.date !== active.bubbles[index - 1]?.date" class="stamp day-chip">{{ bubble.date ?? 'Today' }}</p>
            <p v-if="bubble.kind === 'system'" class="stamp">☎ {{ bubble.text }} · {{ bubble.time }}</p>
            <template v-else>
              <small v-if="bubble.who && active.bubbles[index - 1]?.who !== bubble.who" class="sender" :style="{color:bubble.color}">{{ bubble.who }}</small>
              <div class="bubble" :data-message-id="bubble.id" :class="[bubble.from, { sms: active.sms, sticker:bubble.kind === 'sticker', 'quote-flash':flashId === bubble.id, tail: active.bubbles[index + 1]?.from !== bubble.from || active.bubbles[index + 1]?.who !== bubble.who }]">

          <small v-if="bubble.forwarded" class="forwarded">↪ {{ bubble.forwarded }}</small>
          <button v-if="bubble.quote" class="quote-card" :style="{borderColor: bubble.quote.color}" @click="jumpTo(bubble.quote.id)">
            <b :style="{color: bubble.quote.color}">{{ bubble.quote.sender }}</b><span>{{ bubble.quote.text }}</span>
          </button>
          <button v-if="bubble.kind === 'photo' && bubble.src" class="photo-button" :aria-label="'Open photo: ' + bubble.text" @click="showPhoto(bubble, $event)">
            <img class="chat-photo" :src="bubble.src" :alt="bubble.text" width="240" height="160" loading="lazy" decoding="async" />
          </button>
          <div v-if="bubble.kind === 'meme' && bubble.meme" class="meme-card" :style="{background: bubble.meme.background}" role="img" :aria-label="bubble.meme.top + '. ' + bubble.meme.bottom">
            <b>{{ bubble.meme.top }}</b><span aria-hidden="true">{{ bubble.meme.emoji }}</span><b>{{ bubble.meme.bottom }}</b>
          </div>
          <div v-if="bubble.kind === 'flower'" class="flower-card" role="img" aria-label="Illustrated good morning flower card"><span>🌻 🌷 🌼</span><b>GOOD MORNING</b><small>A little sunshine for your day</small></div>
          <div v-if="bubble.kind === 'gate'" class="gate-card" role="img" aria-label="Illustrated wrong school gate with a large bell"><span>🔔</span><b>GATE B</b><div class="gate-bars">┃ ┃ ┃ ┃ ┃</div><small>Wrong gate · rider's sketch</small></div>
          <div v-if="bubble.location" class="location-card">
            <svg viewBox="0 0 240 100" role="img" :aria-label="'Illustrated map for ' + bubble.location.title"><rect width="240" height="100" fill="#dce9d7"/><path d="M0 30h240M70 0v100M160 0v100M0 78h240" stroke="#fff" stroke-width="12"/><path d="M120 23c-12 0-17 14-9 24l9 12 9-12c8-10 3-24-9-24" fill="#d9534f" stroke="none"/><circle cx="120" cy="37" r="4" fill="white" stroke="none"/></svg>
            <b>{{ bubble.location.title }}</b><small>{{ bubble.location.address }}</small>
          </div>
          <div v-if="bubble.poll" class="poll-card"><b>▥ {{ bubble.poll.question }}</b><small>Choose one · tap again to undo</small>
            <button v-for="(option, optionIndex) in bubble.poll.options" :key="option.label" :aria-pressed="bubble.poll.voted === optionIndex" @click="vote(bubble, optionIndex)"><span>{{ bubble.poll.voted === optionIndex ? '◉' : '○' }} {{ option.label }} <small>{{ option.votes }}</small></span><i><em :style="{width: percent(bubble, option.votes) + '%'}" /></i></button>
          </div>
          <div v-if="bubble.link" class="link-preview"><b>{{ bubble.link.title }}</b><small>{{ bubble.link.domain }}</small><span>{{ bubble.link.description }}</span></div>

                <div v-if="bubble.kind === 'voice'" class="voice-note"><button :aria-label="bubble.playing ? 'Pause simulated voice note' : 'Play simulated voice note, no audio'" :aria-pressed="!!bubble.playing" @click="playVoice(bubble)">{{ bubble.playing ? 'Ⅱ' : '▶' }}</button><span class="waveform" role="progressbar" aria-label="Simulated playback" :aria-valuenow="Math.round((bubble.progress ?? 0) * 100)" :aria-valuemin="0" :aria-valuemax="100"><i v-for="(height, index) in waveform" :key="index" :style="{height:height + 'px'}" :class="{played:index / waveform.length < (bubble.progress ?? 0)}" /></span><small>{{ bubble.duration }}</small></div>
                <span class="message-text" :class="{'deleted-text':bubble.kind === 'deleted'}"><template v-for="(part, partIndex) in textParts(bubble.text)" :key="partIndex"><span :class="{'mention-text':part.mention}">{{ part.text }}</span></template></span>
                <small v-if="bubble.edited" class="edited-label">Edited</small>
                <div v-if="bubble.reactions?.length" class="rich-reactions"><button v-for="reaction in bubble.reactions" :key="reaction.emoji" :aria-label="reaction.emoji + ' tapback, ' + reaction.count" :aria-pressed="!!reaction.selected" @click="reactTo(reaction)">{{ reaction.emoji }} {{ reaction.count }}</button></div>
                <span v-if="bubble.reaction" class="tapback" :aria-label="bubble.reaction + ' reaction'">{{ bubble.reaction }}</span>
              </div>
              <small v-if="bubble === lastSent && bubble.state && bubble.state !== 'sent'" class="receipt">{{ bubble.state === 'read' ? 'Read ' + bubble.readTime : 'Delivered' }}</small>
            </template>
          </template>
          <p v-if="typing" class="bubble them tail typing" aria-label="Typing">
            <i />
            <i />
            <i />
          </p>
        </div>
        <div v-if="attachmentsOpen" class="attachment-tray" aria-label="Local message attachments">
          <button @click="chooseAttachment('☕ Chai break?')">Send a chai invitation</button>
          <button @click="chooseAttachment('✓ Build passed. Time for biscuits.')">Share a build update</button>
          <button aria-label="Close attachments" @click="attachmentsOpen = false">Cancel</button>
        </div>
        <form class="composer" @submit.prevent="send()">
          <button
            type="button"
            class="glass-round plus"
            aria-label="Attachments, decorative"
            :aria-expanded="attachmentsOpen"
            @click="attachmentsOpen = !attachmentsOpen"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5.500v13M5.500 12h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
          <div class="field">
            <input
              v-model="draft"
              maxlength="240"
              :placeholder="active.sms ? 'Text Message' : 'iMessage'"
              aria-label="Message"
              enterkeyhint="send"
              autocomplete="off"
             />
            <button v-if="draft.trim()" class="send" :class="{ sms: active.sms }" aria-label="Send">
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
          </div>
        </form>
      </section>
    </Transition>

    <div v-if="lightbox" class="photo-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" @click.self="closePhoto" @keydown.esc.stop="closePhoto" @keydown.tab.prevent="photoClose?.focus()">
      <button ref="photoClose" aria-label="Close photo" @click="closePhoto">✕</button>
      <img :src="lightbox.src" :alt="lightbox.caption" loading="lazy" decoding="async" />
      <p>{{ lightbox.caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #fff;
  color: #000;
}

.pane {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  transition: transform 250ms ease, opacity 250ms ease;
}

.list.behind {
  transform: translateX(-28%);
}

.push-enter-active, .push-leave-active {
  transition: transform 250ms ease, opacity 250ms ease;
}

.push-enter-from, .push-leave-to {
  transform: translateX(100%);
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
  outline: 2px solid #007aff;
  outline-offset: 2px;
}

.glass-pill, .glass-round {
  height: 44px;
  border-radius: 22px;
  color: #111;
  background: rgb(255 255 255 / .72);
  backdrop-filter: blur(24px) saturate(180%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .6),0 2px 12px rgb(0 0 0 / .1);
}

.glass-pill {
  padding: 0 18px;
  font-weight: 500;
}

.glass-round {
  width: 44px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.glass-round svg {
  width: 22px;
  height: 22px;
}

.list-head {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  padding: calc(var(--safe-top,62px) + 2px) 16px 8px;
}

.scroller {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding: calc(var(--safe-top,62px) + 56px) 0 var(--safe-bottom,34px);
}

h1 {
  margin: 0 20px 8px;
  font-size: 34px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -.03em;
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 16px 8px;
  height: 38px;
  padding: 0 10px;
  border-radius: 19px;
  background: #7676801f;
  color: #8e8e93;
}

.search svg {
  width: 16px;
  height: 16px;
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: 17px;
  color: #000;
  outline: 0;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 76px;
  padding: 0 0 0 6px;
  text-align: left;
}

.row:active {
  background: #e5e5ea;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin: 0 5px;
  flex-shrink: 0;
}

.dot.on {
  background: #007aff;
}

.avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #fff;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
}

.avatar.big {
  width: 50px;
  height: 50px;
  font-size: 20px;
}

.row-text {
  flex: 1;
  min-width: 0;
  margin-left: 11px;
  padding: 9px 16px 9px 0;
  border-bottom: 1px solid #3c3c4321;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.row-text b {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.row-text small {
  font-size: 15px;
  font-weight: 400;
  color: #8e8e93;
}

.row-text em {
  font-style: normal;
  color: #c4c4c7;
  margin-left: 3px;
}

.row-text>span {
  font-size: 15px;
  line-height: 1.3;
  color: #8e8e93;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty {
  padding: 40px;
  text-align: center;
  color: #8e8e93;
}

.talk-head {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: calc(var(--safe-top,62px) + 2px) 16px 26px;
  background: linear-gradient(180deg,#fff 46%,rgb(255 255 255 / 0));
}

.who {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-top: -4px;
}

.who b {
  padding: 4px 12px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 600;
  background: rgb(255 255 255 / .8);
  backdrop-filter: blur(20px);
  box-shadow: 0 1px 8px rgb(0 0 0 / .1);
}

.feed {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  padding: calc(var(--safe-top,62px) + 98px) 14px 12px;
}

.stamp {
  margin: 0 0 10px;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: #8e8e93;
  font-weight: 500;
}

.sender {
  margin: 8px 0 2px 14px;
  font-size: 12px;
  color: #8e8e93;
}

.bubble {
  position: relative;
  max-width: 76%;
  margin: 1px 0;
  padding: 8px 14px;
  border-radius: 19px;
  font-size: 17px;
  line-height: 1.3;
  user-select: text;
  overflow-wrap: anywhere;
  animation: pop .28s cubic-bezier(.2,.9,.3,1.200) both;
}

.bubble.them {
  align-self: flex-start;
  background: #e9e9eb;
  color: #000;
  transform-origin: left bottom;
}

.bubble.me {
  align-self: flex-end;
  background: #0a84ff;
  color: #fff;
  transform-origin: right bottom;
}

.bubble.me.sms {
  background: #34c759;
}

.bubble.tail {
  margin-bottom: 8px;
}

.bubble.me.tail {
  border-bottom-right-radius: 6px;
}

.bubble.them.tail {
  border-bottom-left-radius: 6px;
}

.typing {
  display: flex;
  gap: 5px;
  padding: 14px 15px;
}

.typing i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #8e8e93;
  animation: blink 1.200s infinite;
}

.typing i:nth-child(2) {
  animation-delay: .2s;
}

.typing i:nth-child(3) {
  animation-delay: .4s;
}

.receipt {
  align-self: flex-end;
  margin: -4px 4px 0;
  font-size: 12px;
  color: #8e8e93;
  font-weight: 500;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 9px;
  padding: 8px 14px calc(var(--safe-bottom,34px) + 6px);
}

.plus {
  background: #e9e9eb;
  box-shadow: none;
  width: 40px;
  height: 40px;
}

.field {
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 40px;
  border-radius: 20px;
  border: 1px solid #c6c6c8;
  padding: 0 4px 0 15px;
  background: #fff;
}

.field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  font-size: 17px;
  color: #000;
  height: 38px;
  user-select: text;
}

.send {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #0a84ff;
  color: #fff;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.send.sms {
  background: #34c759;
}

.send svg {
  width: 18px;
  height: 18px;
}

.send::after {
  content: '';
  position: absolute;
  width: 44px;
  height: 44px;
}

@keyframes pop {
  from {
    transform: scale(.6);
    opacity: 0;
  }
}

@keyframes blink {
  0%, 60%, 100% {
    opacity: .35;
  }
  30% {
    opacity: 1;
  }
}

@media(prefers-reduced-motion:reduce) {
  .pane, .push-enter-active, .push-leave-active {
    transition: none;
  }
  .bubble, .typing i {
    animation: none;
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

.glass-pill, .glass-round, .plus, .send {
  min-width: 44px;
  min-height: 44px;
}

.send::after {
  display: none;
}

.row-text b {
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.thread-name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.row-text small {
  flex-shrink: 0;
  margin-left: auto;
}

.field {
  min-height: 48px;
}

.list-instruction {
  margin: 0 16px 12px;
  font-size: 14px;
  color: #64646b;
}

.attachment-tray {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px;
  background: #f2f2f7;
}

.attachment-tray button, .call-card button {
  padding: 10px 14px;
  border-radius: 18px;
  background: #e5eefc;
  color: #005ac1;
}

.call-card {
  position: absolute;
  top: calc(var(--safe-top,62px) + 102px);
  left: 14px;
  right: 14px;
  z-index: 3;
  padding: 18px;
  border-radius: 22px;
  background: #f2f2f7;
  box-shadow: 0 8px 25px #0002;
}

.call-card p {
  font-size: 14px;
  line-height: 1.5;
  color: #64646b;
}

@media (pointer: coarse) {
  .scroller {
    padding-top: calc(var(--safe-top,62px) + 72px);
  }
}

.call-card, .attachment-tray {
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
  .call-card, .attachment-tray {
    animation: none;
  }
}

.bubble { position: relative; white-space: pre-line; }
.bubble:has(.tapback) { margin-top: 12px; }
.tapback { position: absolute; right: -4px; top: -16px; padding: 2px 7px; border-radius: 14px; background: #eeeef2; border: 2px solid #fff; font-size: 15px; line-height: 1.2; color: #222; }

/* Rich cards inherit the host app's original type, bubble width and palette. */
.quote-card { display:flex; flex-direction:column; width:100%; text-align:left; border-left:3px solid; border-radius:5px; background:#7b8b7b12; padding:7px 9px; margin:0 0 7px; min-height:44px; font-size:12px; gap:3px; }
.quote-card span { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.35; }
.forwarded { display:block; font-style:italic; font-size:11px; opacity:.72; margin-bottom:5px; }
.photo-button { display:block; width:100%; padding:0; border-radius:8px; overflow:hidden; aspect-ratio:3 / 2; }
.photo-button .chat-photo { width:100%; height:100%; max-height:none; object-fit:cover; margin:0; display:block; }
.meme-card { aspect-ratio:1 / 1; display:flex; flex-direction:column; justify-content:space-between; align-items:center; text-align:center; padding:12px; border-radius:8px; color:white; margin-bottom:6px; }
.meme-card b { font-family:Impact,'Arial Black',sans-serif; font-size:20px; letter-spacing:.01em; line-height:1.2; text-shadow:1px 1px 0 #222,-1px -1px 0 #222; }
.meme-card > span { font-size:50px; }
.flower-card { aspect-ratio:3 / 2; background:linear-gradient(140deg,#faf0b2,#d7efbc); color:#66552d; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; border:4px double #d2b373; border-radius:8px; margin-bottom:7px; }
.flower-card > span { font-size:38px; }
.flower-card b { letter-spacing:.08em; font-size:15px; }
.flower-card small { font-size:11px; }
.gate-card { background:#bdd3d5; border-radius:8px; aspect-ratio:3 / 2; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; color:#30464b; gap:3px; margin-bottom:7px; }
.gate-bars { background:#68848a; border:4px solid #435e65; color:#d9e9e9; width:85%; text-align:center; font-size:28px; letter-spacing:4px; }
.gate-card small { font-size:11px; }
.location-card { border:1px solid #8a9b8a30; border-radius:8px; overflow:hidden; margin-bottom:7px; }
.location-card svg { width:100%; height:auto; display:block; aspect-ratio:12 / 5; }
.location-card b, .location-card small { display:block; padding:4px 8px; font-size:12px; }
.poll-card { min-width:175px; max-width:100%; margin-bottom:7px; }
.poll-card > b, .poll-card > small { display:block; margin-bottom:5px; }
.poll-card > small { font-size:11px; opacity:.7; }
.poll-card button { width:100%; text-align:left; padding:7px 0; font-size:13px; }
.poll-card button > span { display:flex; gap:4px; align-items:baseline; }
.poll-card button small { margin-left:auto; }
.poll-card i { display:block; height:5px; border-radius:5px; background:#7f8f7f25; margin:5px 0 0 18px; overflow:hidden; }
.poll-card em { display:block; height:100%; background:var(--accent,#008069); border-radius:5px; }
.link-preview { border:1px solid #8a9b8a30; border-radius:8px; padding:9px; display:flex; flex-direction:column; gap:4px; margin-bottom:7px; font-size:12px; background:#7f8f7f0c; }
.link-preview small { opacity:.65; }
.mention-text { color:var(--accent,#008069); background:#7ab9dc20; border-radius:3px; font-weight:600; }
.message-text { white-space:pre-wrap; }
.deleted-text { font-style:italic; opacity:.65; }
.rich-reactions { display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; }
.rich-reactions button { background:#7f8f7f10; border:1px solid #7f8f7f30; border-radius:14px; font-size:12px; padding:2px 6px; min-width:44px; min-height:28px; }
.rich-reactions button[aria-pressed=true] { border-color:var(--accent,#008069); }
.quote-flash { outline:3px solid #e9bb5d; outline-offset:2px; }
.photo-lightbox { position:absolute; inset:0; z-index:30; background:#101918ef; color:#fff; display:flex; flex-direction:column; justify-content:center; padding:20px; gap:16px; backdrop-filter:blur(12px); }
.photo-lightbox > img { width:100%; height:55%; object-fit:contain; }
.photo-lightbox > p { font-size:14px; line-height:1.4; }
.photo-lightbox > button { position:absolute; top:var(--safe-top,62px); right:16px; border-radius:50%; background:#ffffff25; color:#fff; width:44px; height:44px; }
.history-loading { padding:20px; text-align:center; font-size:13px; opacity:.7; }

.me .mention-text { color:#fff; background:#ffffff25; }
.me .quote-card, .me .rich-reactions button { color:inherit; background:#ffffff20; }
.day-chip { margin:14px 0; }
.edited-label { display:block; font-size:10px; opacity:.7; margin-top:4px; }
.bubble.sticker { background:transparent; font-size:42px; }
.voice-note { display:flex; align-items:center; gap:6px; margin-bottom:5px; }
.voice-note button { min-width:44px; min-height:44px; }
.waveform { display:flex; gap:3px; align-items:center; height:34px; }
.waveform i { display:block; width:3px; background:#8999ab70; border-radius:3px; }
.waveform i.played { background:#007aff; }
.voice-note small { font-size:11px; }

.bubble { white-space:normal; }

.app { --accent:#007aff; }

.bubble:has(.rich-reactions) { margin-top:24px; }
.bubble .rich-reactions { position:absolute; right:-3px; top:-25px; gap:2px; margin:0; }
.bubble .rich-reactions button { background:#eeeef2; color:#222; border:2px solid #fff; min-height:28px; line-height:1.2; }
.bubble .rich-reactions button[aria-pressed=true] { border-color:#007aff; }
</style>
