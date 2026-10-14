<script setup lang="ts">
import { PHONE } from '../phone';
import { APP_ICONS as icons } from './icons';
import { createChatSession, type ReadState } from '../chat/engine';
import { whatsappPersonas } from '../chat/personas';
import { textParts, vote, percent, type RichMessage, type HistoryChat } from '../chat/histories';
const phone = inject(PHONE);
type Kind = 'family' | 'flat' | 'rent' | 'delivery' | 'amma' | 'dev';
type Message = RichMessage & {
    state?: ReadState; reaction?: string;
    playing?: boolean; progress?: number;
};
type Chat = {
    id: number;
    name: string;
    glyph: string;
    color: string;
    kind: Kind;
    preview: string;
    unread: number;
    group: boolean;
    messages: Message[];
    members: HistoryChat['members'];
    ambient: HistoryChat['ambient'];
};
const chats = ref<Chat[]>([]);
const loading = ref(true);
const loadError = ref(false);
let disposed = false;
async function loadHistories() {
    loading.value = true;
    loadError.value = false;
    try {
        const { whatsappHistories } = await import('../chat/histories-whatsapp');
        if (disposed) return;
        const bases = { family: whatsappPersonas['Family HQ']!, amma: whatsappPersonas.Amma!, flat: whatsappPersonas['Bengaluru Flat Hunt']!, rent: whatsappPersonas.Landlord!, delivery: whatsappPersonas['Delivery Rider']!, dev: whatsappPersonas['The Bug Support Group']! };
        const histories = structuredClone(whatsappHistories);
        chats.value = histories.map((history, id) => {
            const base = whatsappPersonas[history.name] ?? bases[history.persona];
            const persona = history.group ? { ...base, name: history.name, members: history.members.map(member => ({ ...member, replies: member.name === 'Grandma' ? Object.fromEntries(Object.keys(base.replies).map(intent => [intent, ['👍', '❤️', '🌻', '👏', '🙏']])) : base.members?.find(m => m.name.includes(member.name))?.replies ?? base.replies })) } : base;
            sessions.set(id, createChatSession(persona));
            return { ...history, id, kind: history.persona, preview: history.messages.at(-1)?.text ?? '', unread: id % 4 === 0 ? 3 : id % 3 === 0 ? 1 : 0, messages: history.messages.map(message => ({ ...message, state: message.mine ? 'read' as const : undefined })) };
        });
    } catch { if (!disposed) loadError.value = true; }
    finally { if (!disposed) loading.value = false; }
}
onMounted(loadHistories);
const tab = ref<string>('Chats');
const search = ref<string>('');
const filter = ref<string>('All');
const selected = ref<number | null>(null);
const draft = ref<string>('');
const typing = ref<number[]>([]);
const timeline = ref<HTMLElement | null>(null);
const followTail = ref(true);
function trackTail(event: Event) {
    const element = event.currentTarget as HTMLElement;
    followTail.value = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
}
const quiet = ref<boolean>(false);
const status = ref<string>('');
const current = computed(() => chats.value.find(c => c.id === selected.value));
const filtered = computed(() => chats.value.filter(chat =>
    chat.name.toLowerCase().includes(search.value.toLowerCase()) &&
    (filter.value !== 'Unread' || chat.unread > 0) 
        &&
    (filter.value !== 'Groups' || chat.group)));
const sessions = new Map<number, ReturnType<typeof createChatSession>>();
const timers = new Set<ReturnType<typeof setTimeout>>();
let nextMessageId = 100000;
function later(action: () => void, delay: number) {
    const timer = setTimeout(() => { timers.delete(timer); action(); }, delay);
    timers.add(timer);
}
const waveform = [8, 15, 22, 12, 28, 18, 10, 24, 32, 16, 25, 12, 20, 30, 14, 23, 9, 18];
const playbackVersions = new Map<number, number>();
function playVoice(message: Message) {
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
function openChat(chat: Chat) {
    selected.value = chat.id;
    chat.unread = 0;
    draft.value = '';
}
async function bottom(force = false) {
    await nextTick();
    if (!force && !followTail.value) return;
    followTail.value = true;
    timeline.value?.scrollTo({
        top: timeline.value.scrollHeight,
        behavior: 'auto'
    });
}
function send() {
    const chat = current.value;
    const text = draft.value.trim();
    if (!chat || !text) return;
    const now = phone?.now.value ?? new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const message: Message = { id: nextMessageId++, text, mine: true, time, date: 'Today', state: 'sent' };
    chat.messages.push(message);
    // Use the reactive array entry for timer updates, rather than the raw inserted object.
    const own = chat.messages.at(-1)!;
    chat.preview = text;
    draft.value = '';
    const plan = sessions.get(chat.id)!.respond(text, new Date());
    later(() => { own.state = 'delivered'; }, plan.receipt.deliveredAt);
    later(() => { own.state = 'read'; }, plan.receipt.readAt);
    if (plan.reaction) later(() => { own.reaction = plan.reaction!.emoji; }, plan.reaction.atMs);
    for (const event of plan.typing) later(() => {
        typing.value = typing.value.filter(id => id !== chat.id);
        if (event.active) typing.value.push(chat.id);
        if (selected.value === chat.id) void bottom();
    }, event.atMs);
    for (const bubble of plan.bubbles) later(() => {
        chat.messages.push({ ...bubble, ...(bubble.sender === 'Grandma' ? { kind: 'text' as const, text: ['👍', '❤️', '🌻'][nextMessageId % 3]! } : {}), id: nextMessageId++, mine: false,
            date: 'Today', quote: bubble.kind === 'text' ? { id: own.id, sender: 'You', text: own.text, color: '#008069' } : undefined,
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) });
        chat.preview = chat.messages.at(-1)!.kind === 'voice' ? 'Voice note · ' + bubble.duration : chat.messages.at(-1)!.text;
        if (selected.value !== chat.id) chat.unread++;
        else void bottom();
    }, bubble.atMs);
    void bottom(true);
}
const ambientTyping = ref<number | null>(null);
function isTyping(id: number) { return typing.value.includes(id) || ambientTyping.value === id; }
let activityTimer: ReturnType<typeof setTimeout> | undefined;
let autoCount = 0;
const activityOffsets = new Map<number, number>();
function scheduleActivity(chat: Chat) {
    if (!chat.group || autoCount >= 6 || quiet.value || disposed) return;
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        activityTimer = undefined;
        if (autoCount >= 6) return;
        if (selected.value !== chat.id || disposed || quiet.value) return;
        if (document.hidden || isTyping(chat.id)) { scheduleActivity(chat); return; }
        const offset = activityOffsets.get(chat.id) ?? 0;
        const activity = chat.ambient[offset % chat.ambient.length];
        if (!activity) return;
        activityOffsets.set(chat.id, offset + 1);
        autoCount++;
        ambientTyping.value = chat.id;
        const last = chat.messages.at(-1);
        later(() => {
            if (ambientTyping.value === chat.id) ambientTyping.value = null;
            const member = chat.members.find(member => member.name === activity.sender);
            if (offset % 3 === 2 && last) {
                const reactions = last.reactions ?? (last.reactions = []);
                const existing = reactions.find(reaction => reaction.emoji === '😂');
                if (existing) existing.count++;
                else reactions.push({ emoji: '😂', count: 1 });
                chat.preview = activity.sender + ' reacted 😂';
            } else {
                chat.messages.push({ id: nextMessageId++, text: activity.text, sender: activity.sender, color: member?.color, mine: false, date: 'Today', time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), quote: last ? { id: last.id, sender: last.sender ?? 'You', text: last.text, color: last.color ?? '#008069' } : undefined });
                chat.preview = activity.sender + ': ' + activity.text;
            }
            if (selected.value !== chat.id) chat.unread++;
            else { void bottom(); scheduleActivity(chat); }
        }, 1600);
    }, 20000 + Math.random() * 20000);
}
watch(selected, () => {
    if (activityTimer) clearTimeout(activityTimer);
    const chat = current.value;
    if (chat) scheduleActivity(chat);
    void bottom(true);
});
const flashId = ref<number | null>(null);
function jumpTo(id: number) {
    const target = timeline.value?.querySelector<HTMLElement>('[data-message-id="' + id + '"]');
    target?.scrollIntoView({ block: 'center', behavior: 'auto' });
    followTail.value = false;
    flashId.value = id;
    later(() => { if (flashId.value === id) flashId.value = null; }, 1500);
}
const lightbox = ref<{ src: string; caption: string } | null>(null);
const photoClose = ref<HTMLButtonElement>();
let photoTrigger: HTMLElement | null = null;
function showPhoto(message: Message, event: MouseEvent) {
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
onBeforeUnmount(() => {
    disposed = true;
    timers.forEach(clearTimeout);
    if (activityTimer) clearTimeout(activityTimer);
});
</script>

<template>
  <div class="app">
    <template v-if="current">
      <header class="conversation-head glass">
        <button class="icon" aria-label="Back to chats" @click="selected = null">
          <svg viewBox="0 0 24 24">
            <path :d="icons.back" />
          </svg>
        </button>
        <span class="avatar small" :style="{background: current.color}">{{ current.glyph }}</span>
        <div class="contact-name">
          <h3>{{ current.name }}</h3>
          <span class="muted">
            {{ isTyping(current.id) ? 'typing…' : current.group ? current.members.map(member => member.name).join(', ') : 'online' }}
          </span>
        </div>
        <button class="icon" aria-label="Call contact" @click="phone?.open('phone')">
          <svg viewBox="0 0 24 24">
            <path :d="icons.call" />
          </svg>
        </button>
      </header>
      <div ref="timeline" class="conversation scroll" aria-live="polite" @scroll.passive="trackTail">

        <div class="encryption">⌁ Fictional people. Messages stay in this pretend phone.</div>
        <template v-for="(message, index) in current.messages" :key="message.id">
          <div v-if="index === 0 || message.date !== current.messages[index - 1]?.date" class="day">{{ message.date ?? 'Today' }}</div>
          <div v-if="message.kind === 'system'" class="day system-row">☎ {{ message.text }} · {{ message.time }}</div>
          <div v-else class="bubble" :data-message-id="message.id" :class="{mine:message.mine, sticker:message.kind === 'sticker', 'quote-flash':flashId === message.id}">
            <strong v-if="!message.mine && current.group && message.sender" class="sender-name" :style="{color: message.color}">{{ message.sender }}</strong>

          <small v-if="message.forwarded" class="forwarded">↪ {{ message.forwarded }}</small>
          <button v-if="message.quote" class="quote-card" :style="{borderColor: message.quote.color}" @click="jumpTo(message.quote.id)">
            <b :style="{color: message.quote.color}">{{ message.quote.sender }}</b><span>{{ message.quote.text }}</span>
          </button>
          <button v-if="message.kind === 'photo' && message.src" class="photo-button" :aria-label="'Open photo: ' + message.text" @click="showPhoto(message, $event)">
            <img class="chat-photo" :src="message.src" :alt="message.text" width="240" height="160" loading="lazy" decoding="async" />
          </button>
          <div v-if="message.kind === 'meme' && message.meme" class="meme-card" :style="{background: message.meme.background}" role="img" :aria-label="message.meme.top + '. ' + message.meme.bottom">
            <b>{{ message.meme.top }}</b><span aria-hidden="true">{{ message.meme.emoji }}</span><b>{{ message.meme.bottom }}</b>
          </div>
          <div v-if="message.kind === 'flower'" class="flower-card" role="img" aria-label="Illustrated good morning flower card"><span>🌻 🌷 🌼</span><b>GOOD MORNING</b><small>A little sunshine for your day</small></div>
          <div v-if="message.kind === 'gate'" class="gate-card" role="img" aria-label="Illustrated wrong school gate with a large bell"><span>🔔</span><b>GATE B</b><div class="gate-bars">┃ ┃ ┃ ┃ ┃</div><small>Wrong gate · rider's sketch</small></div>
          <div v-if="message.location" class="location-card">
            <svg viewBox="0 0 240 100" role="img" :aria-label="'Illustrated map for ' + message.location.title"><rect width="240" height="100" fill="#dce9d7"/><path d="M0 30h240M70 0v100M160 0v100M0 78h240" stroke="#fff" stroke-width="12"/><path d="M120 23c-12 0-17 14-9 24l9 12 9-12c8-10 3-24-9-24" fill="#d9534f" stroke="none"/><circle cx="120" cy="37" r="4" fill="white" stroke="none"/></svg>
            <b>{{ message.location.title }}</b><small>{{ message.location.address }}</small>
          </div>
          <div v-if="message.poll" class="poll-card"><b>▥ {{ message.poll.question }}</b><small>Choose one · tap again to undo</small>
            <button v-for="(option, optionIndex) in message.poll.options" :key="option.label" :aria-pressed="message.poll.voted === optionIndex" @click="vote(message, optionIndex)"><span>{{ message.poll.voted === optionIndex ? '◉' : '○' }} {{ option.label }} <small>{{ option.votes }}</small></span><i><em :style="{width: percent(message, option.votes) + '%'}" /></i></button>
          </div>
          <div v-if="message.link" class="link-preview"><b>{{ message.link.title }}</b><small>{{ message.link.domain }}</small><span>{{ message.link.description }}</span></div>

            <div v-if="message.kind === 'voice'" class="voice-note">
              <button type="button" :aria-label="message.playing ? 'Pause pretend voice note' : 'Play pretend voice note, no audio'" :aria-pressed="!!message.playing" @click="playVoice(message)">{{ message.playing ? 'Ⅱ' : '▶' }}</button>
              <span class="waveform" role="progressbar" aria-label="Pretend voice note playback" :aria-valuenow="Math.round((message.progress ?? 0) * 100)" :aria-valuemin="0" :aria-valuemax="100"><i v-for="(height, index) in waveform" :key="index" :style="{height: height + 'px'}" :class="{played: index / waveform.length < (message.progress ?? 0)}" /></span><small>{{ message.duration }}</small>
            </div>
            <details v-if="message.kind === 'voice'" class="voice-transcript"><summary>Transcript · simulated audio</summary>{{ message.text }}</details>
            <span v-else class="message-text" :class="{'deleted-text':message.kind === 'deleted'}"><template v-for="(part, partIndex) in textParts(message.text)" :key="partIndex"><span :class="{'mention-text':part.mention}">{{ part.text }}</span></template></span>
            <div v-if="message.reactions?.length" class="rich-reactions"><button v-for="reaction in message.reactions" :key="reaction.emoji" :aria-label="reaction.emoji + ' reaction, ' + reaction.count" :aria-pressed="!!reaction.selected" @click="reactTo(reaction)">{{ reaction.emoji }} {{ reaction.count }}</button></div>
            <span v-if="message.reaction" class="reaction-chip">{{ message.reaction }}</span>
            <span class="stamp"><small v-if="message.edited">edited · </small>{{ message.time }} <b v-if="message.mine" :class="{read:message.state === 'read'}" :aria-label="message.state ?? 'read'">{{ message.state === 'sent' ? '✓' : '✓✓' }}</b></span>
          </div>
        </template>
        <div v-if="isTyping(current.id)" class="bubble typing" aria-label="Contact is typing">
          <i />
          <i />
          <i />
        </div>
      </div>
      <form class="composer glass" @submit.prevent="send">
        <button class="icon" type="button" aria-label="Insert a chai invitation" @click="draft='Chai break?'">
          <svg viewBox="0 0 24 24">
            <path :d="icons.plus" />
          </svg>
        </button>
        <input v-model="draft" aria-label="Message" placeholder="Message" maxlength="1000" />
        <button
          type="submit"
          class="send icon"
          aria-label="Send message"
          :disabled="!draft.trim()"
        >
          <svg viewBox="0 0 24 24">
            <path :d="icons.send" />
          </svg>
        </button>
      </form>
    </template>
    <template v-else>
      <header class="top">
        <div class="bar">
          <button
            class="icon soft"
            aria-label="More chat options"
            @click="status = status ? '' : 'Chats are backed up to your imagination.'"
          >
            <svg viewBox="0 0 24 24">
              <path :d="icons.more" />
            </svg>
          </button>
          <div class="bar">
            <button class="icon soft" aria-label="Open camera" @click="phone?.open('camera')">
              <svg viewBox="0 0 24 24">
                <path d="M3 7h5l2-3h4l2 3h5v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0" />
              </svg>
            </button>
            <button
              class="icon green"
              aria-label="Start a chat with Rubber Duck"
              @click="chats[7] && openChat(chats[7])"
            >
              <svg viewBox="0 0 24 24">
                <path :d="icons.plus" />
              </svg>
            </button>
          </div>
        </div>
        <h1>{{ tab }}</h1>
        <input
          v-if="tab === 'Chats'"
          v-model="search"
          class="search"
          aria-label="Search chats"
          placeholder="Ask, search or find a chat"
         />
        <p v-if="status" class="notice">{{ status }}</p>
      </header>
      <main class="scroll main">
        <p v-if="loading" class="history-loading" role="status">Opening the conversations…</p>
        <button v-if="loadError" class="history-loading" @click="loadHistories">Could not load chats. Tap to retry.</button>
        <template v-if="tab === 'Chats'">
          <div class="filters">
            <button
              v-for="chip in ['All','Unread','Groups']"
              :key="chip"
              class="pill"
              :class="{chosen:filter===chip}"
              @click="filter=chip"
            >
              {{ chip }}
            </button>
          </div>
          <button class="archived" @click="status='Nothing archived. The group chats follow you everywhere.'">
            <svg viewBox="0 0 24 24">
              <path d="M3 4h18v4H3ZM5 8v12h14V8M9 12h6" />
            </svg>
            Archived
            <span>0</span>
          </button>
          <button v-for="chat in filtered" :key="chat.id" class="chat-row" @click="openChat(chat)">
            <span class="avatar" :style="{background:chat.color}">{{ chat.glyph }}</span>
            <div class="chat-copy">
              <div class="bar">
                <h3>{{ chat.name }}</h3>
                <span :class="['muted',{unread:chat.unread}]">{{ chat.unread ? '10:42' : 'Yesterday' }}</span>
              </div>
              <div class="bar">
                <p :class="{'unread':isTyping(chat.id)}">{{ isTyping(chat.id) ? 'typing…' : chat.preview }}</p>
                <b v-if="chat.unread" class="badge">{{ chat.unread }}</b>
              </div>
            </div>
          </button>
          <p v-if="!filtered.length" class="empty">No chats found. A rare quiet moment.</p>
          <p class="footer-note">⌁ Your personal messages are end-to-end imaginary.</p>
        </template>
        <template v-else-if="tab === 'Updates'">
          <h2 class="section-heading">Status</h2>
          <button
            class="status-row"
            @click="status='Status updated: Available for chai. Unavailable for scope creep.'"
          >
            <span class="avatar green">+</span>
            <div>
              <h3>My status</h3>
              <p class="muted">Tap to add a status update</p>
            </div>
          </button>
          <h2 class="section-heading">Recent updates</h2>
          <button
            v-for="name in ['Chai Committee','Family HQ','Rubber Duck']"
            :key="name"
            class="status-row"
            @click="status=name + ': Living, laughing, clearing the cache.'"
          >
            <span class="status-ring">{{ name.slice(0,1) }}</span>
            <div>
              <h3>{{ name }}</h3>
              <p class="muted">12 minutes ago</p>
            </div>
          </button>
          <div class="channel-card">
            <h2>Channels</h2>
            <p>A quiet corner of the internet. Allegedly.</p>
            <button class="pill green" @click="status='Following: Daily Chai Forecast'">Follow Daily Chai Forecast</button>
          </div>
        </template>
        <template v-else-if="tab === 'Calls'">
          <button class="status-row" @click="phone?.open('phone')">
            <span class="avatar green">♡</span>
            <div>
              <h3>Add favourites</h3>
              <p class="muted">Find your favourite people faster</p>
            </div>
          </button>
          <h2 class="section-heading">Recent</h2>
          <button
            v-for="name in ['Amma','Delivery Rider','Landlord']"
            :key="name"
            class="status-row"
            @click="phone?.open('phone')"
          >
            <span class="avatar">{{ name[0] }}</span>
            <div>
              <h3>{{ name }}</h3>
              <p class="muted">↙ Incoming · Today</p>
            </div>
            <svg viewBox="0 0 24 24">
              <path :d="icons.call" />
            </svg>
          </button>
        </template>
        <template v-else-if="tab === 'Communities'">
          <div class="community-art">
            <svg viewBox="0 0 24 24">
              <path :d="icons.people" />
            </svg>
          </div>
          <h2 class="center">Your people, together</h2>
          <p class="community-copy">
            Organise discussions, announcements and the occasional very important biscuit poll.
          </p>
          <button
            class="community-button green pill"
            @click="status='Community created: One More Quick Change'"
          >
            Start your community
          </button>
          <button class="status-row" @click="chats[5] && openChat(chats[5])">
            <span class="avatar">BG</span>
            <div>
              <h3>The Bug Support Group</h3>
              <p class="muted">3 groups · 1 shared concern</p>
            </div>
          </button>
        </template>
        <template v-else>
          <button class="profile" @click="status='Profile: Mohith · Compiling a better status' ">
            <span class="avatar">M</span>
            <div>
              <h2>Mohith</h2>
              <p class="muted">Compiling a better status</p>
            </div>
          </button>
          <button
            v-for="row in ['Account','Privacy','Chats','Storage and data','Help']"
            :key="row"
            class="settings-row"
            @click="status=row + ': All settings are simulated for this pocket lab.'"
          >
            {{ row }}
            <span>›</span>
          </button>
          <button class="settings-row" role="switch" :aria-checked="quiet" @click="quiet=!quiet">
            Quiet mode
            <span class="switch" :class="{on:quiet}">
              <i />
            </span>
          </button>
        </template>
      </main>
      <nav class="tabs">
        <button
          v-for="(item,i) in ['Updates','Calls','Communities','Chats','Settings']"
          :key="item"
          :class="{active:tab===item}"
          @click="tab=item; status=''"
        >
          <svg viewBox="0 0 24 24">
            <path :d="icons[['clock','call','people','chat','gear'][i]!]" />
          </svg>
          {{ item }}
        </button>
      </nav>
    </template>

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
  background: #fff;
  color: #111b21;
  --accent: #008069;
}

.top h1 {
  margin: 12px 0 16px;
}

.soft {
  background: #f1f2f3;
}

.green {
  background: #25d366;
  color: #063d23;
}

.filters {
  display: flex;
  gap: 8px;
  padding: 6px 20px 15px;
}

.filters button {
  background: #f1f2f3;
  color: #647068;
  font-size: 16px;
}

.filters .chosen {
  background: #d9fdd3;
  color: #006d47;
}

.main {
  flex: 1;
}

.archived {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 25px;
  padding: 8px 28px;
  color: #647068;
  font-size: 16px;
}

.archived span {
  margin-left: auto;
}

.chat-row {
  display: flex;
  text-align: left;
  align-items: center;
  width: 100%;
  gap: 14px;
  padding: 0 0 0 20px;
  min-height: 86px;
}

.avatar {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #d3ddd8;
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.chat-copy {
  padding: 20px 20px 20px 0;
  flex: 1;
  min-width: 0;
  border-bottom: 1px solid #ebedef;
}

.chat-copy h3 {
  font-size: 17px;
}

.chat-copy .muted {
  font-size: 12px;
}

.chat-copy p {
  font-size: 15px;
  color: #768078;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 265px;
  margin-top: 5px;
}

.unread {
  color: #008069;
}

.badge {
  font-size: 12px;
  border-radius: 50%;
  min-width: 22px;
  height: 22px;
  background: #25d366;
  color: #fff;
  display: grid;
  place-items: center;
}

.footer-note {
  text-align: center;
  font-size: 12px;
  color: #86928a;
  margin: 26px;
}

.notice {
  padding: 12px;
  border-radius: 12px;
  background: #e8f7ec;
  font-size: 13px;
  margin-top: 10px;
}

.conversation-head {
  padding: var(--safe-top,62px) 12px 12px;
  display: flex;
  align-items: center;
  background: rgba(255,255,255,.9);
  gap: 6px;
}

.small {
  width: 42px;
  height: 42px;
  font-size: 14px;
}

.contact-name {
  flex: 1;
  min-width: 0;
}

.contact-name h3 {
  font-size: 16px;
}

.conversation {
  flex: 1;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  background-color: #eee8df;
  background-image: radial-gradient(circle at 10px 10px,transparent 8px,#d8d4ca 9px,transparent 10px),linear-gradient(45deg,transparent 47%,#e4ddd3 49%,transparent 51%);
  background-size: 70px 70px,90px 90px;
}

.day {
  align-self: center;
  background: #ffffffc9;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  box-shadow: 0 1px 2px #0001;
}

.encryption {
  background: #fff2c7;
  color: #777055;
  font-size: 12px;
  text-align: center;
  padding: 12px;
  border-radius: 9px;
  margin: 8px 22px 20px;
}

.bubble {
  align-self: flex-start;
  max-width: 84%;
  padding: 10px 12px 7px;
  background: #fff;
  border-radius: 3px 14px 14px 14px;
  box-shadow: 0 1px 1px #0002;
  line-height: 1.4;
  font-size: 16px;
  overflow-wrap: anywhere;
}

.bubble.mine {
  align-self: flex-end;
  background: #d9fdd3;
  border-radius: 14px 3px 14px 14px;
}

.stamp {
  display: block;
  text-align: right;
  font-size: 12px;
  color: #7b867d;
  margin-top: 3px;
}

.stamp b {
  color: #43a5d0;
  font-size: 14px;
}

.composer {
  display: flex;
  gap: 8px;
  align-items: center;
  background: #f6f6f6;
  padding: 10px 10px var(--safe-bottom,34px);
}

.composer input {
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 24px;
  width: 0;
  flex: 1;
  padding: 8px 14px;
}

.send {
  background: #008069;
  color: #fff;
}

.typing {
  display: flex;
  gap: 5px;
  padding: 18px;
}

.typing i {
  height: 6px;
  width: 6px;
  background: #85968a;
  border-radius: 50%;
  animation: pulse .9s ease-in-out infinite alternate;
}

.typing i:nth-child(2) {
  animation-delay: .2s;
}

.typing i:nth-child(3) {
  animation-delay: .4s;
}

@keyframes pulse {
  to {
    opacity: .25;
    transform: translateY(-3px);
  }
}

.section-heading {
  padding: 22px 20px 12px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  text-align: left;
  padding: 14px 20px;
}

.status-row>div {
  flex: 1;
}

.status-ring {
  width: 58px;
  height: 58px;
  border: 3px dashed #25d366;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #e9f4ed;
}

.channel-card {
  margin: 24px 20px;
  padding: 22px;
  background: #f3f5f4;
  border-radius: 20px;
}

.channel-card p {
  font-size: 16px;
  margin: 12px 0;
}

.community-art {
  margin: 40px auto 24px;
  width: 130px;
  height: 130px;
  display: grid;
  place-items: center;
  background: #d9fdd3;
  border-radius: 40px;
}

.community-art svg {
  width: 70px;
  height: 70px;
  color: #008069;
}

.center {
  text-align: center;
}

.community-copy {
  text-align: center;
  line-height: 1.5;
  color: #758178;
  padding: 16px 35px;
}

.community-button {
  display: block;
  margin: 10px auto 36px;
}

.profile {
  display: flex;
  gap: 16px;
  align-items: center;
  text-align: left;
  width: 100%;
  padding: 20px;
}

.settings-row {
  width: calc(100% - 40px);
  margin: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  min-height: 58px;
}

.switch {
  width: 51px;
  height: 31px;
  border-radius: 20px;
  background: #ddd;
  padding: 2px;
}

.switch i {
  display: block;
  background: #fff;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  box-shadow: 0 2px 4px #0002;
  transition: transform 250ms ease, opacity 250ms ease;
}

.switch.on {
  background: #25d366;
}

.switch.on i {
  transform: translateX(20px);
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

.top, .filters, .conversation-head, .composer, .tabs {
  flex-shrink: 0;
}

.chat-copy p {
  max-width: none;
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  line-height: 1.4;
  color: #5d6b62;
}

.chat-copy {
  padding-block: 16px;
}

.chat-copy .bar {
  align-items: baseline;
}

.chat-copy .bar h3 {
  min-width: 0;
  overflow-wrap: anywhere;
}

.chat-copy .bar .muted {
  flex-shrink: 0;
}

.small {
  flex-shrink: 0;
}

.footer-note, .stamp, .community-copy {
  color: #5f6d64;
}

.tabs button {
  padding-inline: 2px;
  color: #646a66;
}

.filters {
  overflow-x: auto;
  overscroll-behavior: contain;
}

.filters button {
  flex-shrink: 0;
}

.status-row > div {
  min-width: 0;
}

.status-ring {
  flex-shrink: 0;
}

.badge {
  color: #063d23;
  font-weight: 700;
}

.notice {
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
  .notice {
    animation: none;
  }
}

.sender-name { display: block; font-size: 12px; margin-bottom: 4px; }
.bubble { position: relative; }
.bubble:has(.reaction-chip) { margin-bottom: 12px; }
.reaction-chip { position: absolute; bottom: -14px; right: 8px; padding: 1px 6px; border-radius: 12px; background: #fff; border: 1px solid #e2e6e2; font-size: 15px; box-shadow: 0 1px 2px #0001; }
.stamp b { color: #748277; }
.stamp b.read { color: #43a5d0; }
.bubble.sticker { font-size: 52px; background: transparent; box-shadow: none; padding: 5px 8px; }
.bubble.sticker .stamp { font-size: 12px; }
.bubble.sticker .sender-name { font-size: 12px; }
.voice-note { display: flex; align-items: center; gap: 8px; }
.voice-note button { color: #008069; border-radius: 50%; padding: 4px; flex-shrink: 0; }
.voice-note small { font-size: 12px; }
.waveform { display: flex; align-items: center; gap: 3px; min-width: 0; height: 34px; }
.waveform i { display: block; width: 3px; border-radius: 3px; background: #b8c8be; transition: background-color 100ms linear; }
.waveform i.played { background: #008069; }
.chat-photo { display: block; width: 100%; max-height: 150px; object-fit: cover; border-radius: 8px; margin-bottom: 5px; }
@media (prefers-reduced-motion: reduce) { .waveform i { transition: none; } }

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

.contact-name .muted { display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
.voice-transcript { font-size:11px; margin-top:6px; }
.system-row { color:#66756d; }
.bubble.sticker .message-text { font-size:44px; }
.bubble.sticker .rich-reactions { font-size:12px; }
</style>
