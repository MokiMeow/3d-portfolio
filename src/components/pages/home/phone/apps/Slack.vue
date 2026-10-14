<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
import { createChatSession } from '../chat/engine';
import { slackPersonas } from '../chat/personas';
import { textParts, vote, percent, type RichMessage } from '../chat/histories';
type Reaction = {
    label: string;
    count: number;
    selected: boolean;
};
type Post = Omit<Partial<RichMessage>, 'reactions'> & {
    id: number;
    author: string;
    initials: string;
    color: string;
    text: string;
    time: string;
    reactions: Reaction[];
    replies: Array<Partial<RichMessage> & {
        author: string;
        initials: string;
        color: string;
        text: string;
        time: string;
    }>;
};
const tab = ref<string>('Home');
const channel = ref<string | null>(null);
const query = ref<string>('');
const draft = ref<string>('');
const huddle = ref<boolean>(false);
const thread = ref<Post | null>(null);
const typingRooms = ref<string[]>([]);
const busy = computed(() => !!channel.value && typingRooms.value.includes(channel.value));
const feed = ref<HTMLElement | null>(null);
const followTail = ref(true);
function trackTail(event: Event) {
    const element = event.currentTarget as HTMLElement;
    followTail.value = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
}
const toast = ref<string>('');
const channels = reactive([
    {
        name: 'general',
        description: 'The place for absolutely general things',
        unread: 3
    },
    {
        name: 'deploys',
        description: 'Green ticks. Deep breaths.',
        unread: 8
    },
    {
        name: 'random',
        description: 'Professionally off topic',
        unread: 2
    },
    {
        name: 'chai-break',
        description: 'Our most reliable daily standup',
        unread: 4
    },
    {
        name: 'incidents',
        description: 'Everything is fine until it is not',
        unread: 1
    }
]);
const timelines = ref<Record<string, Post[]>>({});
const loading = ref(true);
const loadError = ref(false);
let disposed = false;
function initials(name: string) { return name.split(' ').map(part => part[0]).join('').slice(0, 2); }
async function loadHistories() {
    loading.value = true;
    loadError.value = false;
    try {
        const { slackHistories } = await import('../chat/histories-slack');
        if (disposed) return;
        timelines.value = Object.fromEntries(structuredClone(slackHistories).map(room => [room.name, room.messages.map(message => ({ ...message, author: message.sender ?? 'You', initials: initials(message.sender ?? 'You'), color: message.color ?? '#657daf', reactions: (message.reactions ?? []).map(reaction => ({ label: reaction.emoji, count: reaction.count, selected: false })), replies: message.replies.map(reply => ({ ...reply, author: reply.sender ?? 'You', initials: initials(reply.sender ?? 'You'), color: reply.color ?? '#657daf' })) }))]));
        if (channel.value) void scrollBottom();
    } catch { if (!disposed) loadError.value = true; }
    finally { if (!disposed) loading.value = false; }
}
onMounted(loadHistories);
const messages = computed(() => channel.value ? timelines.value[channel.value] ?? [] : []);
const visibleChannels = computed(() => channels.filter(c => c.name.includes(query.value.toLowerCase())));
const timeouts = new Set<ReturnType<typeof setTimeout>>();
const sessions = new Map(Object.entries(slackPersonas).map(([room, persona]) => [room, createChatSession({ ...persona, voiceNotes: [], photos: [], stickers: [] })]));
function later(action: () => void, delay: number) {
    const timer = setTimeout(() => { timeouts.delete(timer); action(); }, delay);
    timeouts.add(timer);
}
let nextPostId = 300000;
async function scrollBottom(force = false) {
    await nextTick();
    if (!force && !followTail.value) return;
    followTail.value = true;
    feed.value?.scrollTo({
        top: feed.value.scrollHeight
    });
}
function open(name: string) {
    channel.value = name;
    thread.value = null;
    draft.value = '';
    huddle.value = false;
    const room = channels.find(room => room.name === name);
    if (room) room.unread = 0;
    void scrollBottom(true);
}
function react(reaction: Reaction) {
    reaction.selected = !reaction.selected;
    reaction.count += reaction.selected ? 1 : -1;
}
function addHeart(post: Post) {
    const existing = post.reactions.find(reaction => reaction.label === '♡');
    if (existing)
        react(existing);
    else
        post.reactions.push({
            label: '♡',
            count: 1,
            selected: true
        });
}
function send() {
    const text = draft.value.trim();
    const room = channel.value;
    if (!room || !text) return;
    const list = timelines.value[room];
    if (!list) return;
    const target = thread.value;
    let post: Post;
    if (target) {
        target.replies.push({ id: nextPostId++, mine: true, author: 'You', initials: 'Y', color: '#657daf', text, time: 'Now', date: 'Today' });
        post = target;
    } else {
        list.push({ id: nextPostId++, author: 'You', initials: 'Y', color: '#657daf', text, time: 'Now', date: 'Today', reactions: [], replies: [] });
        post = list.at(-1)!;
    }
    const visitorId = target ? target.replies.at(-1)!.id! : post.id;
    draft.value = '';
    const plan = sessions.get(room)!.respond(text, new Date());
    for (const event of plan.typing) later(() => {
        typingRooms.value = typingRooms.value.filter(name => name !== room);
        if (event.active) typingRooms.value.push(room);
    }, event.atMs);
    const isChannel = channels.some(c => c.name === room);
    const replies = isChannel || target ? plan.bubbles.slice(-2) : plan.bubbles;
    if (plan.reaction && !target) later(() => {
        post.reactions.push({ label: plan.reaction!.emoji, count: 1, selected: false });
    }, plan.reaction.atMs);
    let botPost: Post | undefined;
    for (const bubble of replies) later(() => {
        const author = bubble.sender ?? slackPersonas[room]!.name;
        const reply = {
            id: nextPostId++, mine: false, date: 'Today', quote: { id: visitorId, sender: 'You', text, color: '#657daf' },
            author, initials: author.split(' · ')[0]!.split(' ').map(word => word[0]).join('').slice(0, 2),
            color: bubble.color ?? (room === 'Rubber Duck' ? '#bd9755' : '#749e8c'),
            text: bubble.text, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        };
        if (target || isChannel) post.replies.push(reply);
        else if (botPost) botPost.replies.push(reply);
        else {
            list.push({ ...reply, id: nextPostId++, reactions: [], replies: [] });
            botPost = list.at(-1)!;
        }
        if (channel.value === room) void scrollBottom();
        else { const entry = channels.find(channel => channel.name === room); if (entry) entry.unread++; }
    }, bubble.atMs);
    void scrollBottom(true);
}

const ambientTyping = ref<string | null>(null);
const ambientAuthor = ref('A member');
const officeActivity: Record<string, Array<{ author: string; text: string; color: string }>> = {
    general: [{ author: 'Mira', text: 'The two-sentence update worked. No slide deck was harmed.', color: '#9a5073' }, { author: 'Kabir', text: 'The mug is still in a meeting. We are going to lunch.', color: '#396887' }],
    deploys: [{ author: 'Aditi', text: 'The dot is stable. Let Monday keep its very small victory.', color: '#8053a0' }, { author: 'Build Bot', text: 'SIM · quiet celebration. One tiny tick. ✓', color: '#527e67' }],
    random: [{ author: 'Nisha', text: 'The cat has declined the ticket and returned to nap.', color: '#805a9e' }, { author: 'Neil', text: 'The mysterious note now says lunch. Much better requirements.', color: '#35688e' }],
    'chai-break': [{ author: 'Kabir', text: 'Tea cooling. Break still available. No agenda attached.', color: '#396887' }, { author: 'Mira', text: 'Saved another cup. Late arrivals welcome.', color: '#9a5073' }],
    incidents: [{ author: 'Devika', text: 'SIM · stable link verified. The folder may rest now.', color: '#a15828' }, { author: 'Neil', text: 'SIM · no new errors. Plenty of reasons to pause.', color: '#35688e' }]
};
let activityTimer: ReturnType<typeof setTimeout> | undefined;
let autoCount = 0;
const activityOffsets = new Map<string, number>();
function scheduleActivity(room: string) {
    const activities = officeActivity[room];
    if (!activities || autoCount >= 6 || disposed) return;
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = setTimeout(() => {
        activityTimer = undefined;
        if (autoCount >= 6) return;
        if (channel.value !== room || disposed) return;
        if (document.hidden || typingRooms.value.includes(room) || !timelines.value[room]?.length) { scheduleActivity(room); return; }
        const offset = activityOffsets.get(room) ?? 0;
        const activity = activities[offset % activities.length]!;
        activityOffsets.set(room, offset + 1);
        autoCount++;
        ambientTyping.value = room;
        ambientAuthor.value = activity.author;
        later(() => {
            if (ambientTyping.value === room) ambientTyping.value = null;
            const list = timelines.value[room]!;
            const last = list.at(-1);
            if (offset % 3 === 2 && last) {
                const existing = last.reactions.find(reaction => reaction.label === '☕');
                if (existing) existing.count++;
                else last.reactions.push({ label: '☕', count: 1, selected: false });
            } else list.push({ ...activity, id: nextPostId++, initials: initials(activity.author), time: 'Now', date: 'Today', reactions: [], replies: [], quote: last ? { id: last.id, sender: last.author, text: last.text, color: last.color } : undefined });
            if (channel.value !== room) { const entry = channels.find(channel => channel.name === room); if (entry) entry.unread++; }
            else { if (!thread.value) void scrollBottom(); scheduleActivity(room); }
        }, 1700);
    }, 20000 + Math.random() * 20000);
}
watch(channel, () => { if (activityTimer) clearTimeout(activityTimer); if (channel.value) scheduleActivity(channel.value); });
const flashId = ref<number | null>(null);
async function jumpTo(id: number) {
    const list = messages.value;
    const parent = list.find(post => post.replies.some(reply => reply.id === id));
    thread.value = parent ?? null;
    await nextTick();
    feed.value?.querySelector<HTMLElement>('[data-message-id="' + id + '"]')?.scrollIntoView({ block: 'center', behavior: 'auto' });
    followTail.value = false;
    flashId.value = id;
    later(() => { if (flashId.value === id) flashId.value = null; }, 1500);
}
const lightbox = ref<{ src: string; caption: string } | null>(null);
const photoClose = ref<HTMLButtonElement>();
let photoTrigger: HTMLElement | null = null;
function showPhoto(message: Post, event: MouseEvent) {
    if (!message.src) return;
    photoTrigger = event.currentTarget as HTMLElement;
    lightbox.value = { src: message.fullSrc ?? message.src.replace('-s.webp', '.webp'), caption: message.text };
    void nextTick(() => photoClose.value?.focus());
}
function closePhoto() { lightbox.value = null; photoTrigger?.focus(); }
const pinned = computed(() => messages.value.find(message => message.pinned));
onBeforeUnmount(() => { disposed = true; timeouts.forEach(clearTimeout); if (activityTimer) clearTimeout(activityTimer); });
</script>

<template>
  <div class="app">
    <header class="top glass">
      <div class="bar">
        <button v-if="channel" class="icon" aria-label="Back to workspace" @click="channel=null;thread=null">
          <svg viewBox="0 0 24 24">
            <path :d="icons.back" />
          </svg>
        </button>
        <span v-else class="workspace-icon">PL</span>
        <div class="heading">
          <h2>
            {{ thread ? 'Thread' : channel ? (channels.some(c=>c.name===channel) ? '# ' : '') + channel : 'Pocket Lab' }}
          </h2>
          <p class="muted">
            {{ channel ? (typingRooms.includes(channel) || ambientTyping === channel ? 'typing…' : 'A little work. A little perspective.') : 'Your workspace, minus the paperwork' }}
          </p>
        </div>
        <button
          class="icon"
          aria-label="Workspace options"
          @click="toast='You are all caught up with your imaginary workspace.'"
        >
          <svg viewBox="0 0 24 24">
            <path :d="icons.more" />
          </svg>
        </button>
      </div>
    </header>
    <p v-if="channel && toast" class="toast channel-toast" role="status">{{ toast }}</p>
    <template v-if="channel">
      <div class="channel-info">
        <span>
          {{ thread ? 'Replies stay with the original message' : '8 fictional members · local conversation' }}
        </span>
        <button class="huddle pill glass" :class="{joined:huddle}" @click="huddle=!huddle">
          <AppGlyph name="headphones" />
          {{ huddle?'Leave huddle':'Huddle' }}
          <i />
        </button>
      </div>
      <main ref="feed" class="scroll timeline" aria-live="polite" @scroll.passive="trackTail">
        <div v-if="huddle" class="huddle-banner">You joined the huddle. Nobody else joined. Participants: 1 (you).</div>
<p v-if="loading" class="history-loading" role="status">Opening the channel…</p>
        <button v-if="loadError" class="history-loading" @click="loadHistories">Could not load channels. Tap to retry.</button>
        <button v-if="pinned && !thread" class="pinned-banner" @click="jumpTo(pinned.id)">📌 {{ pinned.text }}</button>
        <template v-if="thread">
          <article class="post" :data-message-id="thread.id" :class="{'quote-flash':flashId === thread.id}">
            <span class="avatar" :style="{background:thread.color}">{{ thread.initials }}</span>
            <div>
              <h3>
                {{ thread.author }}
                <time>{{ thread.time }}</time>
              </h3>

          <small v-if="thread.forwarded" class="forwarded">↪ {{ thread.forwarded }}</small>
          <button v-if="thread.quote" class="quote-card" :style="{borderColor: thread.quote.color}" @click="jumpTo(thread.quote.id)">
            <b :style="{color: thread.quote.color}">{{ thread.quote.sender }}</b><span>{{ thread.quote.text }}</span>
          </button>
          <button v-if="thread.kind === 'photo' && thread.src" class="photo-button" :aria-label="'Open photo: ' + thread.text" @click="showPhoto(thread, $event)">
            <img class="chat-photo" :src="thread.src" :alt="thread.text" width="240" height="160" loading="lazy" decoding="async" />
          </button>
          <div v-if="thread.kind === 'meme' && thread.meme" class="meme-card" :style="{background: thread.meme.background}" role="img" :aria-label="thread.meme.top + '. ' + thread.meme.bottom">
            <b>{{ thread.meme.top }}</b><span aria-hidden="true">{{ thread.meme.emoji }}</span><b>{{ thread.meme.bottom }}</b>
          </div>
          <div v-if="thread.kind === 'flower'" class="flower-card" role="img" aria-label="Illustrated good morning flower card"><span>🌻 🌷 🌼</span><b>GOOD MORNING</b><small>A little sunshine for your day</small></div>
          <div v-if="thread.kind === 'gate'" class="gate-card" role="img" aria-label="Illustrated wrong school gate with a large bell"><span>🔔</span><b>GATE B</b><div class="gate-bars">┃ ┃ ┃ ┃ ┃</div><small>Wrong gate · rider's sketch</small></div>
          <div v-if="thread.location" class="location-card">
            <svg viewBox="0 0 240 100" role="img" :aria-label="'Illustrated map for ' + thread.location.title"><rect width="240" height="100" fill="#dce9d7"/><path d="M0 30h240M70 0v100M160 0v100M0 78h240" stroke="#fff" stroke-width="12"/><path d="M120 23c-12 0-17 14-9 24l9 12 9-12c8-10 3-24-9-24" fill="#d9534f" stroke="none"/><circle cx="120" cy="37" r="4" fill="white" stroke="none"/></svg>
            <b>{{ thread.location.title }}</b><small>{{ thread.location.address }}</small>
          </div>
          <div v-if="thread.poll" class="poll-card"><b>▥ {{ thread.poll.question }}</b><small>Choose one · tap again to undo</small>
            <button v-for="(option, optionIndex) in thread.poll.options" :key="option.label" :aria-pressed="thread.poll.voted === optionIndex" @click="vote(thread, optionIndex)"><span>{{ thread.poll.voted === optionIndex ? '◉' : '○' }} {{ option.label }} <small>{{ option.votes }}</small></span><i><em :style="{width: percent(thread, option.votes) + '%'}" /></i></button>
          </div>
          <div v-if="thread.link" class="link-preview"><b>{{ thread.link.title }}</b><small>{{ thread.link.domain }}</small><span>{{ thread.link.description }}</span></div>
              <p class="message-text" :class="{'bot-status':thread.author === 'Build Bot' || thread.text.startsWith('SIM ')}"><template v-for="(part, index) in textParts(thread.text)" :key="index"><span :class="{'mention-text':part.mention}">{{ part.text }}</span></template></p>
            </div>
          </article>
          <div class="thread-divider">
            {{ thread.replies.length }}
            replies
          </div>
          <article v-for="(reply,i) in thread.replies" :key="reply.id ?? i" class="post" :data-message-id="reply.id" :class="{'quote-flash':flashId === reply.id}">
            <span class="avatar" :style="{background:reply.color}">{{ reply.initials }}</span>
            <div>
              <h3>
                {{ reply.author }}
                <time>{{ reply.time }}</time>
              </h3>
              <button v-if="reply.quote" class="quote-card" :style="{borderColor:reply.quote.color}" @click="jumpTo(reply.quote.id)"><b>{{ reply.quote.sender }}</b><span>{{ reply.quote.text }}</span></button>
              <p class="message-text" :class="{'bot-status':reply.author === 'Build Bot' || reply.text.startsWith('SIM ')}"><template v-for="(part, index) in textParts(reply.text)" :key="index"><span :class="{'mention-text':part.mention}">{{ part.text }}</span></template></p>
            </div>
          </article>
          <button class="pill back-thread" @click="thread=null">Back to channel</button>
        </template>
        <template v-else>
          <template v-for="(post, index) in messages" :key="post.id">
          <div v-if="index === 0 || post.date !== messages[index - 1]?.date" class="date-line"><span>{{ post.date ?? 'Today' }}</span></div>
          <article class="post" :data-message-id="post.id" :class="{'quote-flash':flashId === post.id}">
            <span class="avatar" :style="{background:post.color}">{{ post.initials }}</span>
            <div class="post-body">
              <h3>
                {{ post.author }}
                <span v-if="post.author==='Build Bot'" class="bot-tag">APP</span>
                <time>{{ post.time }}</time>
              </h3>

          <small v-if="post.forwarded" class="forwarded">↪ {{ post.forwarded }}</small>
          <button v-if="post.quote" class="quote-card" :style="{borderColor: post.quote.color}" @click="jumpTo(post.quote.id)">
            <b :style="{color: post.quote.color}">{{ post.quote.sender }}</b><span>{{ post.quote.text }}</span>
          </button>
          <button v-if="post.kind === 'photo' && post.src" class="photo-button" :aria-label="'Open photo: ' + post.text" @click="showPhoto(post, $event)">
            <img class="chat-photo" :src="post.src" :alt="post.text" width="240" height="160" loading="lazy" decoding="async" />
          </button>
          <div v-if="post.kind === 'meme' && post.meme" class="meme-card" :style="{background: post.meme.background}" role="img" :aria-label="post.meme.top + '. ' + post.meme.bottom">
            <b>{{ post.meme.top }}</b><span aria-hidden="true">{{ post.meme.emoji }}</span><b>{{ post.meme.bottom }}</b>
          </div>
          <div v-if="post.kind === 'flower'" class="flower-card" role="img" aria-label="Illustrated good morning flower card"><span>🌻 🌷 🌼</span><b>GOOD MORNING</b><small>A little sunshine for your day</small></div>
          <div v-if="post.kind === 'gate'" class="gate-card" role="img" aria-label="Illustrated wrong school gate with a large bell"><span>🔔</span><b>GATE B</b><div class="gate-bars">┃ ┃ ┃ ┃ ┃</div><small>Wrong gate · rider's sketch</small></div>
          <div v-if="post.location" class="location-card">
            <svg viewBox="0 0 240 100" role="img" :aria-label="'Illustrated map for ' + post.location.title"><rect width="240" height="100" fill="#dce9d7"/><path d="M0 30h240M70 0v100M160 0v100M0 78h240" stroke="#fff" stroke-width="12"/><path d="M120 23c-12 0-17 14-9 24l9 12 9-12c8-10 3-24-9-24" fill="#d9534f" stroke="none"/><circle cx="120" cy="37" r="4" fill="white" stroke="none"/></svg>
            <b>{{ post.location.title }}</b><small>{{ post.location.address }}</small>
          </div>
          <div v-if="post.poll" class="poll-card"><b>▥ {{ post.poll.question }}</b><small>Choose one · tap again to undo</small>
            <button v-for="(option, optionIndex) in post.poll.options" :key="option.label" :aria-pressed="post.poll.voted === optionIndex" @click="vote(post, optionIndex)"><span>{{ post.poll.voted === optionIndex ? '◉' : '○' }} {{ option.label }} <small>{{ option.votes }}</small></span><i><em :style="{width: percent(post, option.votes) + '%'}" /></i></button>
          </div>
          <div v-if="post.link" class="link-preview"><b>{{ post.link.title }}</b><small>{{ post.link.domain }}</small><span>{{ post.link.description }}</span></div>
              <p class="message-text" :class="{'bot-status':post.author === 'Build Bot' || post.text.startsWith('SIM ')}"><template v-for="(part, index) in textParts(post.text)" :key="index"><span :class="{'mention-text':part.mention}">{{ part.text }}</span></template></p>
              <small v-if="post.edited" class="edited-label">(edited)</small>
              <div class="reactions">
                <button
                  v-for="reaction in post.reactions"
                  :key="reaction.label"
                  :class="{selected:reaction.selected}"
                  :aria-label="reaction.label+' reaction, '+reaction.count"
                  :aria-pressed="reaction.selected"
                  @click="react(reaction)"
                >
                  <AppGlyph v-if="['♡', '☕', '✓'].includes(reaction.label)" :name="reaction.label === '♡' ? 'heart' : reaction.label === '☕' ? 'cup' : 'check'" />
                  <span v-else aria-hidden="true">{{ reaction.label }}</span>
                  <b>{{ reaction.count }}</b>
                </button>
                <button aria-label="Add a heart reaction" @click="addHeart(post)">
                  <AppGlyph name="plus" />
                </button>
              </div>
              <button class="thread-link" @click="thread=post;draft=''">
                {{ post.replies.length ? post.replies.length+' replies' : 'Reply in thread' }}
                <AppGlyph name="chevron" />
              </button>
            </div>
          </article>
          </template>
        </template>
        <p v-if="busy || ambientTyping === channel" class="typing">{{ ambientTyping === channel ? ambientAuthor : slackPersonas[channel ?? '']?.name ?? 'A member' }} is typing…</p>
      </main>
      <form class="compose-wrap" @submit.prevent="send">
        <div class="compose">
          <textarea
            v-model="draft"
            rows="2"
            :aria-label="thread?'Reply in thread':'Message channel'"
            :placeholder="thread?'Reply…':'Message '+channel"
            maxlength="1500"
            @keydown.enter.exact.prevent="send"
           />
          <div class="bar">
            <button
              type="button"
              class="icon"
              aria-label="Insert chai break message"
              @click="draft='Chai break?'"
            >
              <svg viewBox="0 0 24 24">
                <path :d="icons.plus" />
              </svg>
            </button>
            <span class="muted">
              {{ thread?'Also visible in this thread':'Shift + Enter for a new line' }}
            </span>
            <button type="submit" class="icon send" aria-label="Send message" :disabled="!draft.trim() || loading || loadError">
              <svg viewBox="0 0 24 24">
                <path :d="icons.send" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </template>
    <main v-else class="scroll home-content">
      <p v-if="loading" class="history-loading" role="status">Opening the workspace…</p>
      <button v-if="loadError" class="history-loading" @click="loadHistories">Could not load history. Tap to retry.</button>
      <p v-if="toast" class="toast">{{ toast }}</p>
      <template v-if="tab==='Home'">
        <input
          v-model="query"
          class="search"
          aria-label="Find a channel"
          placeholder="Jump to a conversation"
         />
        <button class="catch-up glass" @click="toast='Caught up. Take a victory sip of chai.'">
          <svg viewBox="0 0 24 24">
            <path :d="icons.check" />
          </svg>
          <div>
            <h3>Catch up</h3>
            <p class="muted">{{ channels.reduce((sum, room) => sum + room.unread, 0) }} unread messages · 0 emergencies</p>
          </div>
          <AppGlyph name="chevron" />
        </button>
        <h3 class="list-heading">
          <AppGlyph name="down" />
          Channels
          <AppGlyph name="plus" />
        </h3>
        <button v-for="room in visibleChannels" :key="room.name" class="channel-row" @click="open(room.name)">
          <span class="hash">#</span>
          <div>
            <h3>{{ room.name }}</h3>
            <p>{{ typingRooms.includes(room.name) || ambientTyping === room.name ? 'typing…' : room.description }}</p>
          </div>
          <b v-if="room.unread" class="badge">{{ room.unread }}</b>
        </button>
        <h3 class="list-heading">
          <AppGlyph name="down" />
          Direct messages
        </h3>
        <button
          v-for="(name,i) in ['Build Bot','Rubber Duck']"
          :key="name"
          class="dm-row"
          @click="open(name)"
        >
          <span class="avatar" :style="{background:i?'#bd9755':'#749e8c'}">{{ i?'RD':'BB' }}</span>
          <div>
            <h3>{{ name }}</h3>
            <p class="muted">{{ i?'Here to listen':'Always compiling' }}</p>
          </div>
          <i class="online" />
        </button>
        <div class="workspace-footer">
          A workspace for small ideas
          <br />
          and disproportionately large threads.
        </div>
      </template>
      <template v-else-if="tab==='DMs'">
        <h1>Direct messages</h1>
        <button v-for="name in ['Build Bot','Rubber Duck']" :key="name" class="dm-row" @click="open(name)">
          <span class="avatar">{{ name.slice(0,1) }}</span>
          <div>
            <h3>{{ name }}</h3>
            <p class="muted">{{ timelines[name]?.at(-1)?.text ?? 'Opening local history…' }}</p>
          </div>
          <AppGlyph name="chevron" />
        </button>
        <p class="empty">Your inbox is surprisingly manageable.</p>
      </template>
      <template v-else-if="tab==='Activity'">
        <h1>Activity</h1>
        <div class="activity-card">
          <span class="mention">@</span>
          <div>
            <h3>You were mentioned in #deploys</h3>
            <p>Build Bot: @you, the fictional status is green. Enjoy this moment.</p>
            <button class="thread-link" @click="open('deploys')">Open conversation →</button>
          </div>
        </div>
        <div class="activity-card">
          <span class="mention">♡</span>
          <div>
            <h3>A little appreciation</h3>
            <p>Rubber Duck reacted to your message.</p>
            <button class="thread-link" @click="open('Rubber Duck')">View message →</button>
          </div>
        </div>
      </template>
      <template v-else>
        <h1>More</h1>
        <button
          v-for="item in ['Saved for later','Drafts','Your status','Preferences','About Pocket Lab']"
          :key="item"
          class="more-row"
          @click="toast=item==='Your status'?'Status set: Deep in a shallow bug.':item+': All clear. Even the drafts are taking a break.'"
        >
          {{ item }}
          <AppGlyph name="chevron" />
        </button>
        <div class="profile-card">
          <span class="avatar">M</span>
          <h2>Mohith</h2>
          <p class="muted">● Active · emotionally away</p>
        </div>
      </template>
    </main>
    <nav v-if="!channel" class="tabs">
      <button
        v-for="(item,i) in ['Home','DMs','Activity','More']"
        :key="item"
        :class="{active:tab===item}"
        @click="tab=item;toast=''"
      >
        <svg viewBox="0 0 24 24">
          <path :d="icons[['home','chat','bell','more'][i]!]" />
        </svg>
        {{ item }}
      </button>
    </nav>

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
  background: #1a1d21;
  color: #e8e8eb;
  --accent: #fff;
}

.top {
  background: rgba(30,24,33,.94);
  border-bottom: 1px solid #ffffff12;
  padding-bottom: 18px;
}

.workspace-icon {
  width: 46px;
  height: 46px;
  background: linear-gradient(145deg,#611f69,#4a154b);
  border: 1px solid #b982bd66;
  display: grid;
  place-items: center;
  border-radius: 13px;
  font-weight: 800;
}

.heading {
  flex: 1;
}

.heading .muted {
  font-size: 12px;
  margin-top: 3px;
  color: #b1a8b3;
}

.home-content {
  padding: 20px;
  flex: 1;
}

.search {
  background: #ffffff0d;
  color: #dedbe0;
  border: 1px solid #ffffff15;
}

.catch-up {
  display: flex;
  align-items: center;
  text-align: left;
  width: 100%;
  gap: 14px;
  border-radius: 16px;
  background: #29242f;
  margin-top: 18px;
  padding: 16px 12px;
}

.catch-up>div {
  flex: 1;
}

.catch-up svg {
  color: #bc9bc9;
}

.catch-up p {
  margin-top: 4px;
}

.list-heading {
  margin: 30px 0 12px;
  color: #c9c3cf;
  display: flex;
  justify-content: space-between;
}

.channel-row {
  display: flex;
  width: 100%;
  gap: 14px;
  align-items: center;
  text-align: left;
  padding: 14px 5px;
  border-bottom: 1px solid #ffffff0a;
}

.channel-row>div {
  flex: 1;
}

.channel-row p {
  font-size: 12px;
  color: #9d9aa4;
  margin-top: 3px;
}

.hash {
  color: #aba1b4;
  font-size: 27px;
  width: 30px;
  text-align: center;
}

.badge {
  background: #6f3776;
  color: #fff;
  border-radius: 8px;
  font-size: 12px;
  padding: 3px 7px;
}

.dm-row {
  display: flex;
  gap: 14px;
  align-items: center;
  text-align: left;
  width: 100%;
  padding: 15px 0;
}

.dm-row>div {
  flex: 1;
}

.avatar {
  width: 42px;
  height: 42px;
  background: #657daf;
  border-radius: 9px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
}

.online {
  width: 10px;
  height: 10px;
  background: #42b78e;
  border-radius: 50%;
}

.workspace-footer {
  font-size: 13px;
  color: #75717d;
  line-height: 1.6;
  text-align: center;
  margin: 35px 0;
}

.tabs {
  background: #241b29;
  border-top-color: #ffffff16;
}

.tabs button.active {
  background: #611f6980;
}

.channel-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  background: #212027;
  border-bottom: 1px solid #ffffff10;
}

.channel-info>span {
  font-size: 12px;
  color: #aaa0b0;
}

.huddle {
  display: flex;
  gap: 7px;
  align-items: center;
  font-size: 13px;
  background: #2d2534;
  white-space: nowrap;
}

.huddle i {
  width: 6px;
  height: 6px;
  background: #5bcdab;
  border-radius: 50%;
}

.huddle.joined {
  background: #245846;
}

.headphones {
  font-size: 22px;
}

.timeline {
  flex: 1;
  padding: 14px 16px;
}

.date-line {
  border-top: 1px solid #ffffff22;
  margin: 20px 0 25px;
  text-align: center;
  height: 8px;
}

.date-line span {
  position: relative;
  top: -13px;
  background: #1a1d21;
  border: 1px solid #ffffff22;
  padding: 5px 16px;
  border-radius: 20px;
  font-size: 12px;
}

.post {
  display: flex;
  gap: 10px;
  margin: 20px 0 24px;
}

.post-body {
  min-width: 0;
  flex: 1;
}

.post h3 {
  font-size: 16px;
  margin-bottom: 6px;
}

.post time {
  font-size: 12px;
  color: #9d96a7;
  font-weight: 400;
  margin-left: 8px;
}

.bot-tag {
  margin-left: 7px;
  font-size: 12px;
  background: #ffffff15;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 400;
}

.post p {
  font-size: 16px;
  line-height: 1.5;
  color: #d8d4dd;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.reactions {
  display: flex;
  gap: 5px;
  margin-top: 8px;
}

.reactions button {
  min-width: 44px;
  min-height: 44px;
  border: 1px solid #ffffff14;
  border-radius: 22px;
  background: #25272d;
  font-size: 14px;
}

.reactions .selected {
  border-color: #9b72bd;
  background: #4a315e;
  color: #e4c7ff;
}

.thread-link {
  color: #91b8ed;
  font-size: 13px;
  padding: 0;
  min-height: 44px;
  text-align: left;
}

.thread-link span {
  margin-left: 10px;
}

.thread-divider {
  border-bottom: 1px solid #ffffff20;
  font-size: 13px;
  color: #9d96a7;
  padding: 10px 0;
}

.back-thread {
  background: #3c2b45;
  font-size: 14px;
}

.compose-wrap {
  padding: 10px 14px var(--safe-bottom,34px);
}

.compose {
  border: 1px solid #ffffff30;
  border-radius: 18px;
  background: #22252b;
  overflow: hidden;
  padding: 10px;
}

.compose textarea {
  resize: none;
  width: 100%;
  background: transparent;
  padding: 6px;
  line-height: 1.4;
}

.compose .muted {
  font-size: 12px;
}

.send {
  background: #24634b;
  color: #fff;
  border-radius: 12px;
}

.typing {
  font-size: 12px;
  color: #a9a0b2;
  padding: 10px 52px;
}

.huddle-banner, .toast {
  background: #35303d;
  border: 1px solid #9b72bd44;
  padding: 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 14px;
}

.activity-card {
  display: flex;
  gap: 14px;
  margin-top: 24px;
  background: #24242c;
  border: 1px solid #ffffff10;
  border-radius: 18px;
  padding: 18px;
}

.activity-card p {
  font-size: 15px;
  line-height: 1.5;
  margin-top: 8px;
  color: #b9b1c3;
}

.mention {
  font-size: 28px;
  color: #cba0df;
}

.more-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  border-bottom: 1px solid #ffffff15;
  padding: 20px 4px;
}

.profile-card {
  padding: 30px;
  text-align: center;
  margin-top: 24px;
  background: #26212c;
  border-radius: 22px;
}

.profile-card .avatar {
  margin: 0 auto 15px;
  width: 60px;
  height: 60px;
}

.profile-card p {
  margin-top: 8px;
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

.top, .channel-info, .compose-wrap, .tabs, .channel-toast {
  flex-shrink: 0;
}

.heading {
  min-width: 0;
  flex: 1;
}

.heading h2 {
  overflow-wrap: anywhere;
}

.channel-info {
  gap: 10px;
  align-items: center;
}

.channel-info > span {
  min-width: 0;
  flex: 1;
}

.huddle {
  flex-shrink: 0;
  gap: 6px;
}

.huddle svg {
  width: 20px;
  height: 20px;
}

.post > div, .catch-up > div, .channel-row > div, .dm-row > div {
  min-width: 0;
}

.channel-row > div, .dm-row > div {
  flex: 1;
}

.post h3 {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}

.post time {
  margin-left: 0;
  color: #b9b1c1;
}

.reactions {
  flex-wrap: wrap;
}

.reactions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.reactions svg {
  width: 18px;
  height: 18px;
}

.list-heading {
  display: flex;
  align-items: center;
  gap: 6px;
}

.list-heading svg {
  width: 18px;
  height: 18px;
}

.list-heading svg:last-child {
  margin-left: auto;
}

.channel-toast {
  margin: 0;
  border-radius: 0;
}

.compose .bar {
  gap: 6px;
}

.compose .muted {
  text-align: center;
  line-height: 1.35;
}

.muted, .channel-row p, .workspace-footer {
  color: #bcb5c4;
}

@container (max-width: 380px) {
  .channel-info {
    flex-wrap: wrap;
  }
  .channel-info > span {
    flex-basis: 45%;
  }
  .top {
    padding-inline: 16px;
  }
}

.channel-toast, .huddle-banner {
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
  .channel-toast, .huddle-banner {
    animation: none;
  }
}

.bot-status { white-space: pre-line; font-variant-numeric: tabular-nums; }

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

.post-body, .post > div { min-width:0; flex:1; }
.post .photo-button, .post .meme-card, .post .flower-card, .post .gate-card, .post .location-card { width:min(100%,240px); }
.pinned-banner { display:block; width:100%; text-align:left; border:1px solid #d8c49e; background:#fff5de; color:#6a502f; font-size:12px; border-radius:8px; padding:10px; margin:4px 0 16px; line-height:1.4; }
.edited-label { font-size:11px; color:#777; }
</style>
