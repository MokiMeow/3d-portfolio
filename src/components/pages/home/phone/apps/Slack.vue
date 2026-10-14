<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
import { createChatSession } from '../chat/engine';
import { slackPersonas } from '../chat/personas';
type Reaction = {
    label: string;
    count: number;
    selected: boolean;
};
type Post = {
    id: number;
    author: string;
    initials: string;
    color: string;
    text: string;
    time: string;
    reactions: Reaction[];
    replies: Array<{
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
const toast = ref<string>('');
const channels = [
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
];
const seeds: Record<string, string[]> = {
    general: [
        'Welcome to the Pocket Lab. Be kind. Name your variables.',
        'Small reminder: “quick change” is not a unit of time.',
        'Today’s agenda: fewer meetings, more biscuits.'
    ],
    deploys: [
        'Build completed. Confidence is a separate pipeline.',
        'Deployed to production. The duck has been informed.',
        'Reminder: rollback is a feature, not a personality trait.'
    ],
    random: [
        'If a bug disappears during a demo, was it ever fixed?',
        'My standing desk is currently supporting a sitting problem.',
        'Poll: is chai a dependency or infrastructure?'
    ],
    'chai-break': [
        'Kettle is on. Availability: very high.',
        'Bring your own mug and one manageable problem.',
        'The biscuit tin has reached a critical threshold.'
    ],
    incidents: [
        'SEV-3: someone renamed final-final to final-final-new.',
        'Mitigation: deep breath, chai, inspect the logs.',
        'Resolved. Root cause: optimistic assumptions.'
    ],
    'Build Bot': [
        'Hello! I turn code into colourful progress bars.',
        'Latest build: green. Latest confidence: amber.',
        'Ask me about tests, deploys, bugs or chai.'
    ],
    'Rubber Duck': [
        'I am listening. Start with what you expected to happen.',
        'Try explaining the problem without saying “obviously”.',
        'No judgement. Just a very calm yellow presence.'
    ]
};
const timelines = ref<Record<string, Post[]>>(Object.fromEntries(Object.entries(seeds).map(([name, texts], index) => [name, texts.map((text, i) => ({
        id: index * 100 + i,
        author: i === 1 ? 'Mohith' : i === 2 ? 'Rubber Duck' : 'Build Bot',
        initials: i === 1 ? 'M' : i === 2 ? 'RD' : 'BB',
        color: i === 1 ? '#657daf' : i === 2 ? '#bd9755' : '#749e8c',
        text,
        time: [
            '09:41',
            '09:44',
            '10:02'
        ][i]!,
        reactions: [{
                label: i === 1 ? '☕' : '✓',
                count: i + 2,
                selected: false
            }, {
                label: '♡',
                count: 1,
                selected: false
            }],
        replies: i === 0 
        ? [
            {
                author: 'Rubber Duck',
                initials: 'RD',
                color: '#bd9755',
                text: 'Can confirm.',
                time: 'Now'
            },
            {
                author: 'Mohith',
                initials: 'M',
                color: '#657daf',
                text: 'Adding this to the next chai agenda.',
                time: 'Now'
            },
        ] 
        : []
    }))])));
const messages = computed(() => channel.value ? timelines.value[channel.value] ?? [] : []);
const visibleChannels = computed(() => channels.filter(c => c.name.includes(query.value.toLowerCase())));
const timeouts = new Set<ReturnType<typeof setTimeout>>();
const sessions = new Map(Object.entries(slackPersonas).map(([room, persona]) => [room, createChatSession({ ...persona, voiceNotes: [], photos: [], stickers: [] })]));
function later(action: () => void, delay: number) {
    const timer = setTimeout(() => { timeouts.delete(timer); action(); }, delay);
    timeouts.add(timer);
}
let nextPostId = 700;
async function scrollBottom() {
    await nextTick();
    feed.value?.scrollTo({
        top: feed.value.scrollHeight
    });
}
function open(name: string) {
    channel.value = name;
    thread.value = null;
    draft.value = '';
    void scrollBottom();
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
        target.replies.push({ author: 'You', initials: 'Y', color: '#657daf', text, time: 'Now' });
        post = target;
    } else {
        list.push({ id: nextPostId++, author: 'You', initials: 'Y', color: '#657daf', text, time: 'Now', reactions: [], replies: [] });
        post = list.at(-1)!;
    }
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
    }, bubble.atMs);
    void scrollBottom();
}
onBeforeUnmount(() => timeouts.forEach(clearTimeout));
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
            {{ channel ? 'A little work. A little perspective.' : 'Your workspace, minus the paperwork' }}
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
          {{ thread ? 'Replies stay with the original message' : seeds[channel]?.length + ' members · local conversation' }}
        </span>
        <button class="huddle pill glass" :class="{joined:huddle}" @click="huddle=!huddle">
          <AppGlyph name="headphones" />
          {{ huddle?'Leave huddle':'Huddle' }}
          <i />
        </button>
      </div>
      <main ref="feed" class="scroll timeline" aria-live="polite">
        <div v-if="huddle" class="huddle-banner">You joined the huddle. Everyone is on mute, naturally.</div>
        <div class="date-line">
          <span>Today</span>
        </div>
        <template v-if="thread">
          <article class="post">
            <span class="avatar" :style="{background:thread.color}">{{ thread.initials }}</span>
            <div>
              <h3>
                {{ thread.author }}
                <time>{{ thread.time }}</time>
              </h3>
              <p :class="{'bot-status':thread.author === 'Build Bot' || thread.text.startsWith('SIM ')}">{{ thread.text }}</p>
            </div>
          </article>
          <div class="thread-divider">
            {{ thread.replies.length }}
            replies
          </div>
          <article v-for="(reply,i) in thread.replies" :key="i" class="post">
            <span class="avatar" :style="{background:reply.color}">{{ reply.initials }}</span>
            <div>
              <h3>
                {{ reply.author }}
                <time>{{ reply.time }}</time>
              </h3>
              <p :class="{'bot-status':reply.author === 'Build Bot' || reply.text.startsWith('SIM ')}">{{ reply.text }}</p>
            </div>
          </article>
          <button class="pill back-thread" @click="thread=null">Back to channel</button>
        </template>
        <template v-else>
          <article v-for="post in messages" :key="post.id" class="post">
            <span class="avatar" :style="{background:post.color}">{{ post.initials }}</span>
            <div class="post-body">
              <h3>
                {{ post.author }}
                <span v-if="post.author==='Build Bot'" class="bot-tag">APP</span>
                <time>{{ post.time }}</time>
              </h3>
              <p :class="{'bot-status':post.author === 'Build Bot' || post.text.startsWith('SIM ')}">{{ post.text }}</p>
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
        <p v-if="busy" class="typing">{{ slackPersonas[channel ?? '']?.name ?? 'A member' }} is typing…</p>
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
            <button type="submit" class="icon send" aria-label="Send message" :disabled="!draft.trim()">
              <svg viewBox="0 0 24 24">
                <path :d="icons.send" />
              </svg>
            </button>
          </div>
        </div>
      </form>
    </template>
    <main v-else class="scroll home-content">
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
            <p class="muted">18 unread messages · 0 emergencies</p>
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
            <p>{{ room.description }}</p>
          </div>
          <b class="badge">{{ room.unread }}</b>
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
            <p class="muted">{{ seeds[name]?.[0] }}</p>
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
            <p>Build Bot: Mohith, the build is green. Enjoy this moment.</p>
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
</style>
