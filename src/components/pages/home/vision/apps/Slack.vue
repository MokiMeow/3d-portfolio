<script setup lang="ts">
import { computed, ref } from 'vue';
import { vHover } from '../kit/hover';
import { useSlack, type Post } from './slack/useSlack';
import { textParts } from '../../phone/chat/histories';

/**
 * Slack for Apple Vision Pro: the Pocket Lab workspace from the phone, laid out for a big window, with a
 * thread panel that slides in beside the channel and a huddle you can join from the sidebar.
 */
defineProps<{ compact?: boolean }>();
const slack = useSlack();
const { room, posts, current, thread, draft, threadDraft, typing, channels, dms, people, feed, loading, query } = slack;
const huddle = ref(false);
const huddleStart = ref(0);
const now = ref(Date.now());
const hovered = ref<number | null>(null);
const view = ref<'home' | 'dms' | 'activity'>('home');
const tab = ref<'messages' | 'canvas' | 'files' | 'pins'>('messages');
let tick = 0;
function toggleHuddle() {
  huddle.value = !huddle.value;
  huddleStart.value = Date.now();
  clearInterval(tick);
  if (huddle.value) tick = window.setInterval(() => { now.value = Date.now(); }, 1000);
}
const huddleTime = computed(() => { const s = Math.max(0, Math.floor((now.value - huddleStart.value) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; });
const QUICK = ['✅', '👀', '🙌', '😂', '🔥'];

const days = computed(() => {
  const out: { date: string; items: { post: Post; compact: boolean }[] }[] = [];
  posts.value.forEach((post, index) => {
    const date = post.date ?? 'Today';
    if (!out.length || out.at(-1)!.date !== date) out.push({ date, items: [] });
    const prev = posts.value[index - 1];
    out.at(-1)!.items.push({ post, compact: Boolean(prev && prev.author === post.author && (prev.date ?? 'Today') === date && !post.replies.length && !prev.replies.length) });
  });
  return out;
});
const pinned = computed(() => posts.value.filter(post => post.pinned));
const last = (post: Post) => post.replies.at(-1)?.time ?? post.time;
function openThread(post: Post) { thread.value = post; }
const roomLabel = computed(() => room.value.kind === 'channel' ? `# ${room.value.name}` : room.value.name);
const ACTIVITY = [
  { who: 'Devika', where: '#incidents', text: 'mentioned you: can you sanity-check the rollback note?', time: '10:42', color: '#a15828' },
  { who: 'Build Bot', where: '#deploys', text: 'SIM CI #212 passed in 3m 08s', time: '10:31', color: '#527e67' },
  { who: 'Kabir', where: '#chai-break', text: 'reacted ☕ to your message', time: '09:58', color: '#396887' },
  { who: 'Mira', where: '#general', text: 'replied to a thread you follow', time: '09:12', color: '#9a5073' },
];
</script>

<template>
  <div class="slack" :class="{ compact, 'thread-open': !!thread }">
    <!-- Workspace rail -->
    <nav class="rail" aria-label="Slack">
      <span class="team" title="Pocket Lab">PL</span>
      <button v-hover class="rail-btn" :aria-pressed="view === 'home'" @click="view = 'home'"><svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4Z" /></svg><small>Home</small></button>
      <button v-hover class="rail-btn" :aria-pressed="view === 'dms'" @click="view = 'dms'"><svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4Z" /></svg><small>DMs</small><em v-if="dms.some(d => d.unread)" class="dot" /></button>
      <button v-hover class="rail-btn" :aria-pressed="view === 'activity'" @click="view = 'activity'"><svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4ZM10 20a2 2 0 0 0 4 0" /></svg><small>Activity</small><em class="count">2</em></button>
      <button v-hover class="rail-btn"><svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="18" cy="12" r="1.4" /></svg><small>More</small></button>
      <span class="me" title="You · Active"><i>Y</i><em /></span>
    </nav>

    <!-- Sidebar -->
    <aside class="side">
      <header class="side-head">
        <button class="ws">Pocket Lab <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button>
        <button v-hover class="vk-icon small" aria-label="New message"><svg viewBox="0 0 24 24"><path d="M12 5H5v14h14v-7M10 14l1-4 8-8 3 3-8 8Z" /></svg></button>
      </header>
      <label class="search"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg><input v-model="query" type="search" placeholder="Search Pocket Lab" aria-label="Search channels" /></label>
      <div class="nav vk-scroll">
        <template v-if="view === 'activity'">
          <h3>Activity</h3>
          <button v-for="item in ACTIVITY" :key="item.time" v-hover class="activity" @click="slack.open(item.where.slice(1)); view = 'home'">
            <i :style="{ background: item.color }">{{ item.who.slice(0, 1) }}</i>
            <span><b>{{ item.who }}</b> {{ item.text }}<small>{{ item.where }} · {{ item.time }}</small></span>
          </button>
        </template>
        <template v-else>
          <div v-if="view === 'home'" class="quick-links">
            <button v-hover><svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4ZM9 9h6M9 12h4" /></svg>Threads</button>
            <button v-hover><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" /></svg>Huddles</button>
            <button v-hover><svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-4-5 4Z" /></svg>Later<em>2</em></button>
          </div>
          <h3 v-if="view === 'home'"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>Channels</h3>
          <template v-if="view === 'home'">
            <button v-for="item in channels" :key="item.name" class="item" :class="{ unread: item.unread }" :aria-current="current === item.name" @click="slack.open(item.name)">
              <span class="hash">#</span><span class="label">{{ item.name }}</span><em v-if="item.mentions" class="mention">{{ item.mentions }}</em>
            </button>
          </template>
          <h3><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>Direct messages</h3>
          <button v-for="item in dms" :key="item.name" class="item dm" :class="{ unread: item.unread }" :aria-current="current === item.name" @click="slack.open(item.name)">
            <span class="mini" :style="{ background: item.color }">{{ item.name.slice(0, 1) }}<i :class="item.status" /></span><span class="label">{{ item.name }}</span><em v-if="item.mentions" class="mention">{{ item.mentions }}</em>
          </button>
          <h3><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>Apps</h3>
          <button class="item dm"><span class="mini app">⚙︎</span><span class="label">Workflow Builder</span></button>
        </template>
      </div>
      <Transition name="rise">
        <div v-if="huddle" class="huddle-bar">
          <span class="wave"><i /><i /><i /><i /></span>
          <span><b>Huddle in {{ roomLabel }}</b><small>{{ huddleTime }} · 1 participant</small></span>
          <button v-hover class="leave" @click="toggleHuddle">Leave</button>
        </div>
      </Transition>
    </aside>

    <!-- Channel -->
    <section class="channel">
      <header class="chan-head">
        <div class="title">
          <h2>{{ roomLabel }} <svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></h2>
          <p>{{ typing ? 'Several people are typing…' : room.topic ?? room.description }}</p>
        </div>
        <span class="faces"><i v-for="person in people" :key="person.name" :style="{ background: person.color }" :title="person.name">{{ person.initials }}</i><small>{{ room.members }}</small></span>
        <button v-hover class="huddle-btn" :class="{ on: huddle }" :aria-pressed="huddle" @click="toggleHuddle"><svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1ZM20 14h-3v6h2a1 1 0 0 0 1-1Z" /></svg>{{ huddle ? 'In huddle' : 'Huddle' }}</button>
      </header>
      <nav class="tabs">
        <button v-for="item in (['messages', 'canvas', 'files', 'pins'] as const)" :key="item" :aria-pressed="tab === item" @click="tab = item">{{ item.charAt(0).toUpperCase() + item.slice(1) }}<em v-if="item === 'pins' && pinned.length">{{ pinned.length }}</em></button>
      </nav>

      <div v-if="tab === 'messages'" ref="feed" class="feed vk-scroll" @scroll="slack.trackTail">
        <div class="intro">
          <span class="intro-mark">{{ room.kind === 'channel' ? '#' : room.name.slice(0, 1) }}</span>
          <h3>{{ room.kind === 'channel' ? `Welcome to #${room.name}` : room.name }}</h3>
          <p>{{ room.description }}. {{ room.kind === 'channel' ? 'This is the very beginning of the channel.' : 'This conversation is just between the two of you.' }}</p>
        </div>
        <p v-if="loading" class="hint">Opening the workspace…</p>
        <template v-for="day in days" :key="day.date">
          <div class="divider"><span>{{ day.date }}</span></div>
          <article v-for="{ post, compact: joined } in day.items" :key="post.id" class="post" :class="{ joined, mine: post.author === 'You' }" @pointerenter="hovered = post.id" @pointerleave="hovered = null">
            <span v-if="!joined" class="avatar" :style="{ background: post.color }">{{ post.initials }}</span>
            <time v-else class="side-time">{{ post.time }}</time>
            <div class="body">
              <header v-if="!joined"><b>{{ post.author }}</b><span v-if="post.author === 'Build Bot'" class="app-tag">APP</span><time>{{ post.time }}</time><svg v-if="post.pinned" viewBox="0 0 24 24" class="pinmark"><path d="m14 3 7 7-3 1-4 4 1 4-2 1-4-4-5 5M9 10l5-5" /></svg></header>
              <blockquote v-if="post.quote" class="quote"><b>{{ post.quote.sender }}</b>{{ post.quote.text }}</blockquote>
              <p class="text"><template v-for="(part, index) in textParts(post.text)" :key="index"><b v-if="part.mention" class="at">{{ part.text }}</b><template v-else>{{ part.text }}</template></template></p>
              <div v-if="post.reactions.length" class="reactions">
                <button v-for="reaction in post.reactions" :key="reaction.label" :class="{ selected: reaction.selected }" @click="slack.react(reaction)">{{ reaction.label }} <small>{{ reaction.count }}</small></button>
                <button class="add" aria-label="Add reaction" @click="slack.addReaction(post, '👍')"><svg viewBox="0 0 24 24"><circle cx="11" cy="12" r="7" /><path d="M8.5 13.5a3.5 3.5 0 0 0 5 0M9 10v.1M13 10v.1M19 3v5M16.5 5.5h5" /></svg></button>
              </div>
              <button v-if="post.replies.length" class="thread-link" @click="openThread(post)">
                <span class="stack"><i v-for="reply in post.replies.slice(-3)" :key="reply.id" :style="{ background: reply.color }">{{ reply.initials }}</i></span>
                <b>{{ post.replies.length }} {{ post.replies.length === 1 ? 'reply' : 'replies' }}</b><small>Last reply today at {{ last(post) }}</small><span class="view">View thread</span>
              </button>
            </div>
            <Transition name="rise">
              <div v-if="hovered === post.id" class="hover-bar">
                <button v-for="emoji in QUICK" :key="emoji" :aria-label="`React ${emoji}`" @click="slack.addReaction(post, emoji)">{{ emoji }}</button>
                <i />
                <button aria-label="Reply in thread" @click="openThread(post)"><svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4Z" /></svg></button>
                <button aria-label="Save for later"><svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-4-5 4Z" /></svg></button>
              </div>
            </Transition>
          </article>
        </template>
        <p v-if="typing" class="typing"><span><i /><i /><i /></span>Several people are typing…</p>
      </div>

      <div v-else class="tab-pane vk-scroll">
        <div v-if="tab === 'canvas'" class="canvas-doc">
          <h3>{{ roomLabel }} · Channel canvas</h3>
          <p class="lede">What this channel is for, and how we use it.</p>
          <h4>Norms</h4>
          <ul><li>Post updates in two sentences. Threads for the rest.</li><li>Use 👀 when you are looking, ✅ when it is done.</li><li>No surprise meetings. Huddles are opt-in.</li></ul>
          <h4>Useful links</h4>
          <div class="link-row"><span>📘 Runbook</span><span>📊 Status board</span><span>🧪 Staging</span></div>
        </div>
        <div v-else-if="tab === 'files'" class="files-grid">
          <div v-for="file in [['release-notes.md', 'Markdown', '📝'], ['latency-week41.png', 'Image', '📈'], ['rollback-plan.pdf', 'PDF', '📄'], ['chai-rota.xlsx', 'Spreadsheet', '📊']]" :key="file[0]" class="file"><span>{{ file[2] }}</span><b>{{ file[0] }}</b><small>{{ file[1] }} · shared in {{ roomLabel }}</small></div>
        </div>
        <div v-else class="pins">
          <p v-if="!pinned.length" class="hint">Nothing pinned in {{ roomLabel }} yet.</p>
          <article v-for="post in pinned" :key="post.id" class="post"><span class="avatar" :style="{ background: post.color }">{{ post.initials }}</span><div class="body"><header><b>{{ post.author }}</b><time>{{ post.time }}</time></header><p class="text">{{ post.text }}</p></div></article>
        </div>
      </div>

      <form v-if="tab === 'messages'" class="composer" @submit.prevent="slack.send(false)">
        <div class="format"><button type="button" aria-label="Bold"><b>B</b></button><button type="button" aria-label="Italic"><i>I</i></button><button type="button" aria-label="Strikethrough"><s>S</s></button><i class="sep" /><button type="button" aria-label="Link"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1" /></svg></button><button type="button" aria-label="List"><svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6v.1M4.5 12v.1M4.5 18v.1" /></svg></button><button type="button" aria-label="Code"><svg viewBox="0 0 24 24"><path d="m9 8-4 4 4 4M15 8l4 4-4 4" /></svg></button></div>
        <input v-model="draft" type="text" :placeholder="`Message ${roomLabel}`" :aria-label="`Message ${roomLabel}`" autocomplete="off" @keydown.stop />
        <div class="actions">
          <button type="button" class="plus" aria-label="Attach"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>
          <button type="button" aria-label="Emoji"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M8.5 14a4.5 4.5 0 0 0 7 0M9.5 10v.1M14.5 10v.1" /></svg></button>
          <button type="button" aria-label="Mention"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5" /><path d="M15.5 12v1.5a2.5 2.5 0 0 0 5 0V12a8.5 8.5 0 1 0-3.4 6.8" /></svg></button>
          <button type="button" aria-label="Record clip"><svg viewBox="0 0 24 24"><path d="M3 7h12v10H3ZM15 10l6-3v10l-6-3" /></svg></button>
          <span class="grow" />
          <button type="submit" class="send" :class="{ ready: draft.trim() }" :disabled="!draft.trim()" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4-6Zm8 2 8-10" /></svg></button>
        </div>
      </form>
    </section>

    <!-- Thread -->
    <Transition name="slide">
      <aside v-if="thread" class="thread" aria-label="Thread">
        <header><div><b>Thread</b><small>{{ roomLabel }}</small></div><button v-hover class="vk-icon small" aria-label="Close thread" @click="thread = null"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button></header>
        <div class="thread-feed vk-scroll">
          <article class="post"><span class="avatar" :style="{ background: thread.color }">{{ thread.initials }}</span><div class="body"><header><b>{{ thread.author }}</b><time>{{ thread.time }}</time></header><p class="text">{{ thread.text }}</p></div></article>
          <div class="divider replies"><span>{{ thread.replies.length }} {{ thread.replies.length === 1 ? 'reply' : 'replies' }}</span></div>
          <article v-for="reply in thread.replies" :key="reply.id" class="post"><span class="avatar" :style="{ background: reply.color }">{{ reply.initials }}</span><div class="body"><header><b>{{ reply.author }}</b><time>{{ reply.time }}</time></header><p class="text">{{ reply.text }}</p></div></article>
          <p v-if="typing" class="typing"><span><i /><i /><i /></span>Someone is replying…</p>
        </div>
        <form class="composer small" @submit.prevent="slack.send(true)">
          <input v-model="threadDraft" type="text" placeholder="Reply…" aria-label="Reply in thread" autocomplete="off" @keydown.stop />
          <div class="actions"><label class="also"><input type="checkbox" /> Also send to {{ roomLabel }}</label><span class="grow" /><button type="submit" class="send" :class="{ ready: threadDraft.trim() }" :disabled="!threadDraft.trim()" aria-label="Reply"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4-6Zm8 2 8-10" /></svg></button></div>
        </form>
      </aside>
    </Transition>
  </div>
</template>

<style scoped src="./slack/slack.css"></style>
