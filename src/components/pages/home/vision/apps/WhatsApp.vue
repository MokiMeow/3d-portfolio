<script setup lang="ts">
import { computed, ref } from 'vue';
import { vHover } from '../kit/hover';
import { useWhatsApp, type Chat, type Message } from './whatsapp/useWhatsApp';
import { textParts, percent } from '../../phone/chat/histories';

/**
 * WhatsApp for Apple Vision Pro: the iPad layout in visionOS glass. Chats, Updates, Communities, Calls and
 * Settings down the side; the same twelve conversations as the phone, with photos, voice messages, polls,
 * places and replies that answer back.
 */
defineProps<{ compact?: boolean }>();
const wa = useWhatsApp();
const { chats, loading, current, visible, draft, search, filter, isTyping, timeline, flashId, totalUnread } = wa;
type Tab = 'chats' | 'updates' | 'communities' | 'calls' | 'settings';
const tab = ref<Tab>('chats');
const hovered = ref<number | null>(null);
const preview = ref<{ src: string; caption: string } | null>(null);
const composer = ref<HTMLInputElement>();

const QUICK = ['👍', '❤️', '😂', '😮', '🙏'];
const WAVE = [6, 11, 17, 9, 22, 14, 8, 19, 26, 12, 20, 9, 15, 24, 11, 18, 7, 14, 21, 10, 16, 8];
const TABS: { id: Tab; label: string; d: string }[] = [
  { id: 'chats', label: 'Chats', d: 'M4 19.5 5.4 15A7.5 7.5 0 1 1 9 18.6Z' },
  { id: 'updates', label: 'Updates', d: 'M12 4a8 8 0 1 0 8 8M12 4a8 8 0 0 1 8 8M15.5 5.3A8 8 0 0 1 18.7 8.5' },
  { id: 'communities', label: 'Communities', d: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19a5 5 0 0 1 10 0M11 19a5 5 0 0 1 10 0' },
  { id: 'calls', label: 'Calls', d: 'M7 4h3l1.5 4-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2Z' },
  { id: 'settings', label: 'Settings', d: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.1-1.2L14.5 3h-5l-.4 2.7A7.5 7.5 0 0 0 7 6.9l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 2.1 1.2l.4 2.7h5l.4-2.7a7.5 7.5 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z' },
];

/** Messages grouped by day, with runs from the same sender joined so only the first gets a tail. */
const days = computed(() => {
  const chat = current.value;
  if (!chat) return [];
  const out: { date: string; items: { message: Message; first: boolean; last: boolean }[] }[] = [];
  chat.messages.forEach((message, index) => {
    const date = message.date ?? 'Today';
    if (!out.length || out.at(-1)!.date !== date) out.push({ date, items: [] });
    const prev = chat.messages[index - 1], next = chat.messages[index + 1];
    const same = (a?: Message) => a && !a.kind?.match(/system/) && a.mine === message.mine && a.sender === message.sender && (a.date ?? 'Today') === date;
    out.at(-1)!.items.push({ message, first: !same(prev), last: !same(next) });
  });
  return out;
});
const subtitle = computed(() => {
  const chat = current.value;
  if (!chat) return '';
  if (isTyping(chat.id)) return chat.group ? 'someone is typing…' : 'typing…';
  return chat.group ? ['You', ...chat.members.map(m => m.name)].join(', ') : 'online';
});
function avatar(chat: Chat) { return /\p{Extended_Pictographic}/u.test(chat.glyph) ? chat.glyph : chat.glyph.slice(0, 2); }
function pick(chat: Chat) { wa.open(chat); tab.value = 'chats'; window.setTimeout(() => composer.value?.focus({ preventScroll: true }), 60); }
function sendNow() { wa.send(); }
const lastMine = (chat: Chat) => { const last = chat.messages.at(-1); return last?.mine ? last.state : undefined; };
const stamp = (chat: Chat) => chat.messages.at(-1)?.time ?? '';

const UPDATES = [
  { name: 'Amma', time: 'Today, 08:12', tint: '#a34270', seen: false, note: '🌼 Temple flowers' },
  { name: 'Riya', time: 'Today, 07:40', tint: '#8060a0', seen: false, note: 'Monsoon from the balcony' },
  { name: 'Uncle Ramesh', time: 'Yesterday, 21:05', tint: '#946327', seen: true, note: 'GOOD NIGHT' },
  { name: 'Landlord', time: 'Yesterday, 18:30', tint: '#5a6b7c', seen: true, note: 'Painting starts Monday' },
];
const CHANNELS = [
  { name: 'Bengaluru Traffic Live', followers: '1.2M followers', glyph: '🚦', line: 'ORR moving slowly near Bellandur. Allow 25 minutes.' },
  { name: 'Lab Notes', followers: '4,812 followers', glyph: '🧪', line: 'New in the room: a JARVIS that lives in the headset.' },
  { name: 'Monsoon Watch', followers: '86K followers', glyph: '🌧️', line: 'Light showers likely after 4 pm across the city.' },
];
const CALLS = [
  { name: 'Amma', when: 'Today, 09:14', kind: 'incoming', video: false, missed: false, tint: '#a34270' },
  { name: 'Delivery Rider', when: 'Today, 08:02', kind: 'missed', video: false, missed: true, tint: '#3f7d5c' },
  { name: 'Family HQ', when: 'Yesterday, 20:30', kind: 'outgoing', video: true, missed: false, tint: '#d4a66b' },
  { name: 'Landlord', when: 'Yesterday, 11:47', kind: 'incoming', video: false, missed: false, tint: '#5a6b7c' },
  { name: 'Riya', when: 'Monday, 22:10', kind: 'missed', video: true, missed: true, tint: '#8060a0' },
];
</script>

<template>
  <div class="wa" :class="{ compact, picked: !!current }">
    <!-- Tabs, as a visionOS tab bar at the window's edge -->
    <nav class="rail vk-tabbar" aria-label="WhatsApp">
      <button v-for="item in TABS" :key="item.id" v-hover class="vk-icon" :aria-label="item.label" :title="item.label" :aria-pressed="tab === item.id" @click="tab = item.id">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="item.d" /></svg>
        <em v-if="item.id === 'chats' && totalUnread" class="dot">{{ totalUnread }}</em>
      </button>
    </nav>

    <!-- Sidebar -->
    <aside class="side">
      <template v-if="tab === 'chats'">
        <header class="side-head">
          <h1>Chats</h1>
          <div>
            <button v-hover class="vk-icon" aria-label="Camera"><svg viewBox="0 0 24 24"><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.4" /></svg></button>
            <button v-hover class="vk-icon green" aria-label="New chat"><svg viewBox="0 0 24 24"><path d="M12 5H5v14h14v-7M10 14l1-4 8-8 3 3-8 8Z" /></svg></button>
          </div>
        </header>
        <label class="search"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg><input v-model="search" type="search" placeholder="Ask Meta AI or Search" aria-label="Search chats" /></label>
        <div class="filters" role="group" aria-label="Filter chats">
          <button v-for="item in (['All', 'Unread', 'Favourites', 'Groups'] as const)" :key="item" :aria-pressed="filter === item" @click="filter = item">{{ item }}<em v-if="item === 'Unread' && totalUnread">{{ totalUnread }}</em></button>
        </div>
        <button class="archived"><svg viewBox="0 0 24 24"><path d="M4 7h16v3H4ZM5 10v9h14v-9M10 14h4" /></svg><span>Archived</span><em>4</em></button>
        <div class="list vk-scroll">
          <p v-if="loading" class="hint">Loading chats…</p>
          <button v-for="chat in visible" :key="chat.id" v-hover class="row" :aria-current="current?.id === chat.id" @click="pick(chat)">
            <span class="face" :style="{ background: chat.color }">{{ avatar(chat) }}</span>
            <span class="row-main">
              <span class="row-top"><b>{{ chat.name }}</b><time :class="{ unread: chat.unread }">{{ stamp(chat) }}</time></span>
              <span class="row-bottom">
                <span v-if="isTyping(chat.id)" class="typing-line">typing…</span>
                <span v-else class="preview">
                  <i v-if="lastMine(chat)" class="ticks" :class="lastMine(chat)"><svg viewBox="0 0 18 12"><path d="m1 6.5 3 3L10.5 3" /><path v-if="lastMine(chat) !== 'sent'" d="m6.5 9.5 1 0L14 3" /></svg></i>{{ chat.preview }}
                </span>
                <span class="marks">
                  <svg v-if="chat.muted" viewBox="0 0 24 24" class="muted"><path d="M4 9h3l5-4v14l-5-4H4ZM16 9l5 6m0-6-5 6" /></svg>
                  <svg v-if="chat.pinned && !chat.unread" viewBox="0 0 24 24" class="pin"><path d="m14 3 7 7-3 1-4 4 1 4-2 1-4-4-5 5M9 10l5-5" /></svg>
                  <em v-if="chat.unread" class="badge" :class="{ quiet: chat.muted }">{{ chat.unread }}</em>
                </span>
              </span>
            </span>
          </button>
          <p class="e2e"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Your personal messages are end-to-end encrypted</p>
        </div>
      </template>

      <template v-else-if="tab === 'updates'">
        <header class="side-head"><h1>Updates</h1><div><button v-hover class="vk-icon" aria-label="Add status"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button></div></header>
        <div class="list vk-scroll">
          <h3 class="section">Status</h3>
          <div class="statuses">
            <button v-hover class="status mine"><span class="ring add"><span class="face" style="background:#2f7d6d">Me</span><em>+</em></span><b>My status</b><small>Tap to add</small></button>
            <button v-for="item in UPDATES" :key="item.name" v-hover class="status"><span class="ring" :class="{ seen: item.seen }"><span class="face" :style="{ background: item.tint }">{{ item.name.slice(0, 1) }}</span></span><b>{{ item.name }}</b><small>{{ item.time }}</small></button>
          </div>
          <h3 class="section">Channels <button class="link">Explore</button></h3>
          <button v-for="item in CHANNELS" :key="item.name" v-hover class="row channel"><span class="face glyph">{{ item.glyph }}</span><span class="row-main"><span class="row-top"><b>{{ item.name }}<svg viewBox="0 0 24 24" class="verified"><path d="m12 2 2.4 2.2 3.2-.4.9 3.1 2.9 1.5-1 3.1 1 3.1-2.9 1.5-.9 3.1-3.2-.4L12 22l-2.4-2.2-3.2.4-.9-3.1-2.9-1.5 1-3.1-1-3.1 2.9-1.5.9-3.1 3.2.4Z" /><path d="m8.5 12 2.4 2.4 4.6-4.8" class="check" /></svg></b></span><span class="row-bottom"><span class="preview">{{ item.line }}</span></span></span></button>
        </div>
      </template>

      <template v-else-if="tab === 'communities'">
        <header class="side-head"><h1>Communities</h1></header>
        <div class="list vk-scroll">
          <div class="community-hero">
            <span class="community-art"><i /><i /><i /></span>
            <h2>Stay connected with a community</h2>
            <p>Communities bring members together in topic-based groups, and make it easy to get admin announcements.</p>
            <button v-hover class="vk-button primary green-fill">Start your community</button>
          </div>
          <button v-hover class="row"><span class="face" style="background:#6a5a8e">🏠</span><span class="row-main"><span class="row-top"><b>Koramangala Residents</b><time>Tue</time></span><span class="row-bottom"><span class="preview">Announcements · Water supply off 10 to 2 tomorrow</span></span></span></button>
        </div>
      </template>

      <template v-else-if="tab === 'calls'">
        <header class="side-head"><h1>Calls</h1><div><button v-hover class="vk-icon green" aria-label="New call"><svg viewBox="0 0 24 24"><path d="M7 4h3l1.5 4-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2ZM16 3v6M13 6h6" /></svg></button></div></header>
        <div class="list vk-scroll">
          <h3 class="section">Favourites</h3>
          <div class="favs">
            <button v-for="name in ['Amma', 'Riya', 'Family HQ']" :key="name" v-hover class="fav"><span class="face" :style="{ background: name === 'Amma' ? '#a34270' : name === 'Riya' ? '#8060a0' : '#d4a66b' }">{{ name.slice(0, 1) }}</span><small>{{ name }}</small></button>
          </div>
          <h3 class="section">Recent</h3>
          <button v-for="call in CALLS" :key="call.name + call.when" v-hover class="row call"><span class="face" :style="{ background: call.tint }">{{ call.name.slice(0, 1) }}</span><span class="row-main"><span class="row-top"><b :class="{ missed: call.missed }">{{ call.name }}</b></span><span class="row-bottom"><span class="preview"><svg viewBox="0 0 24 24" class="dir" :class="call.kind"><path :d="call.kind === 'outgoing' ? 'M7 17 17 7m-7 0h7v7' : 'M17 7 7 17m0-7v7h7'" /></svg>{{ call.kind === 'missed' ? 'Missed' : call.kind === 'outgoing' ? 'Outgoing' : 'Incoming' }} · {{ call.when }}</span></span></span><svg viewBox="0 0 24 24" class="call-kind"><path v-if="call.video" d="M3 7h12v10H3ZM15 10l6-3v10l-6-3" /><path v-else d="M7 4h3l1.5 4-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2Z" /></svg></button>
        </div>
      </template>

      <template v-else>
        <header class="side-head"><h1>Settings</h1></header>
        <div class="list vk-scroll">
          <div class="profile"><span class="face big" style="background:#2f7d6d">Me</span><span><b>You</b><small>Hey there! I am using WhatsApp.</small></span><svg viewBox="0 0 24 24"><path d="M4 4h6v6H4ZM14 4h6v6h-6ZM4 14h6v6H4ZM14 14h2v2h-2ZM18 18h2v2h-2Z" /></svg></div>
          <div class="group">
            <button v-for="item in [['Account', 'Security notifications, change number', '#3478f6'], ['Privacy', 'Block contacts, disappearing messages', '#30a46c'], ['Avatar', 'Create, edit, profile photo', '#9b5cf6'], ['Lists', 'Manage people and groups', '#f59e0b']]" :key="item[0]" v-hover class="setting"><i :style="{ background: item[2] }" /><span><b>{{ item[0] }}</b><small>{{ item[1] }}</small></span></button>
          </div>
          <div class="group">
            <button v-for="item in [['Chats', 'Theme, wallpapers, chat history', '#25d366'], ['Notifications', 'Message, group and call tones', '#ef4444'], ['Storage and data', 'Network usage, auto-download', '#14b8a6'], ['Help', 'Help centre, contact us, privacy policy', '#64748b']]" :key="item[0]" v-hover class="setting"><i :style="{ background: item[2] }" /><span><b>{{ item[0] }}</b><small>{{ item[1] }}</small></span></button>
          </div>
          <p class="from">from <b>Meta</b></p>
        </div>
      </template>
    </aside>

    <!-- Conversation -->
    <section v-if="current" class="talk" aria-label="Conversation">
      <header class="talk-head">
        <button v-if="compact" class="vk-icon back" aria-label="Back to chats" @click="wa.selected.value = null"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" /></svg></button>
        <span class="face" :style="{ background: current.color }">{{ avatar(current) }}</span>
        <span class="who"><b>{{ current.name }}</b><small :class="{ live: isTyping(current.id) }">{{ subtitle }}</small></span>
        <button v-hover class="vk-icon" aria-label="Video call"><svg viewBox="0 0 24 24"><path d="M3 7h12v10H3ZM15 10l6-3v10l-6-3" /></svg></button>
        <button v-hover class="vk-icon" aria-label="Voice call"><svg viewBox="0 0 24 24"><path d="M7 4h3l1.5 4-2 1.2a10 10 0 0 0 5.3 5.3l1.2-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2Z" /></svg></button>
        <button v-hover class="vk-icon" aria-label="Search in chat"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></svg></button>
      </header>

      <div ref="timeline" class="timeline vk-scroll" @scroll="wa.trackTail">
        <p class="notice"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Messages and calls are end-to-end encrypted. Only people in this chat can read, listen to, or share them.</p>
        <template v-for="day in days" :key="day.date">
          <p class="day"><span>{{ day.date }}</span></p>
          <template v-for="{ message, first, last } in day.items" :key="message.id">
            <p v-if="message.kind === 'system'" class="system"><span>{{ message.text }}</span></p>
            <div v-else class="line" :class="{ mine: message.mine, first, last, flash: flashId === message.id, bare: message.kind === 'sticker' }" :data-message-id="message.id" @pointerenter="hovered = message.id" @pointerleave="hovered = null">
              <div class="bubble" :class="[`k-${message.kind ?? 'text'}`, { tail: first }]">
                <b v-if="current.group && !message.mine && first && message.sender" class="sender" :style="{ color: message.color }">{{ message.sender }}</b>
                <small v-if="message.forwarded" class="forwarded"><svg viewBox="0 0 24 24"><path d="M14 5l7 7-7 7M21 12H9a6 6 0 0 0-6 6" /></svg>{{ message.forwarded }}</small>
                <button v-if="message.quote" class="quote" :style="{ '--q': message.quote.color }" @click="wa.jumpTo(message.quote.id)"><b>{{ message.quote.sender }}</b><span>{{ message.quote.text }}</span></button>

                <button v-if="message.kind === 'photo' && message.src" class="photo" :aria-label="`Photo: ${message.text}`" @click="preview = { src: message.fullSrc ?? message.src.replace('-s.webp', '.webp'), caption: message.text }"><img :src="message.src" alt="" loading="lazy" draggable="false" /></button>
                <div v-else-if="message.kind === 'voice'" class="voice">
                  <span class="voice-face" :style="{ background: message.mine ? '#2f7d6d' : (message.color ?? current.color) }">{{ message.mine ? 'Me' : (message.sender ?? current.name).slice(0, 1) }}<i><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v3" /></svg></i></span>
                  <button class="play" :aria-label="message.playing ? 'Pause voice message' : 'Play voice message'" @click="wa.playVoice(message)"><svg viewBox="0 0 24 24"><path v-if="message.playing" d="M8 5h3v14H8ZM13 5h3v14h-3Z" class="fill" /><path v-else d="M8 5v14l11-7Z" class="fill" /></svg></button>
                  <span class="wave"><i v-for="(bar, index) in WAVE" :key="index" :style="{ height: `${bar}px` }" :class="{ on: index / WAVE.length < (message.progress ?? 0) }" /><em :style="{ left: `${(message.progress ?? 0) * 100}%` }" /></span>
                  <small class="dur">{{ message.duration ?? '0:14' }}</small>
                </div>
                <div v-else-if="message.kind === 'poll' && message.poll" class="poll">
                  <b class="poll-q"><svg viewBox="0 0 24 24"><path d="M5 19V9M12 19V5M19 19v-7" /></svg>{{ message.poll.question }}</b>
                  <small>Select one</small>
                  <button v-for="(option, index) in message.poll.options" :key="option.label" class="option" :class="{ chosen: message.poll.voted === index }" @click="wa.vote(message, index)">
                    <span class="radio" /><span class="label">{{ option.label }}</span><em>{{ option.votes }}</em>
                    <i class="bar"><i :style="{ width: `${percent(message, option.votes)}%` }" /></i>
                  </button>
                  <button class="view-votes">View votes</button>
                </div>
                <div v-else-if="message.kind === 'location' && message.location" class="place-card">
                  <svg viewBox="0 0 280 120" aria-hidden="true"><rect width="280" height="120" fill="#2c3b33" /><path d="M0 34h280M82 0v120M190 0v120M0 88h280M0 0l120 120" stroke="#3f5246" stroke-width="12" /><path d="M0 60h280" stroke="#57695c" stroke-width="5" /><path d="M140 26c-13 0-19 15-10 26l10 13 10-13c9-11 3-26-10-26" fill="#e5484d" /><circle cx="140" cy="41" r="4.5" fill="#fff" /></svg>
                  <b>{{ message.location.title }}</b><small>{{ message.location.address }}</small>
                </div>
                <div v-else-if="message.kind === 'meme' && message.meme" class="meme" :style="{ background: message.meme.background }"><b>{{ message.meme.top }}</b><span>{{ message.meme.emoji }}</span><b>{{ message.meme.bottom }}</b></div>
                <div v-else-if="message.kind === 'flower'" class="card flower"><span>🌻 🌷 🌼</span><b>GOOD MORNING</b><small>A little sunshine for your day</small></div>
                <div v-else-if="message.kind === 'gate'" class="card gate"><span>🔔</span><b>GATE B</b><small>Wrong gate · rider's sketch</small></div>
                <span v-else-if="message.kind === 'sticker'" class="sticker">{{ message.text }}</span>

                <p v-if="message.kind === 'deleted'" class="text deleted"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="m6.5 17.5 11-11" /></svg>This message was deleted</p>
                <p v-else-if="message.text && !['sticker', 'meme', 'flower', 'gate', 'voice', 'poll'].includes(message.kind ?? 'text') && !(message.kind === 'location')" class="text"><template v-for="(part, index) in textParts(message.text)" :key="index"><b v-if="part.mention" class="mention">{{ part.text }}</b><template v-else>{{ part.text }}</template></template></p>
                <a v-if="message.link" class="link-card"><b>{{ message.link.title }}</b><small>{{ message.link.description }}</small><em>{{ message.link.domain }}</em></a>

                <span class="meta"><small v-if="message.edited">Edited</small><time>{{ message.time }}</time><i v-if="message.mine" class="ticks" :class="message.state"><svg viewBox="0 0 18 12"><path d="m1 6.5 3 3L10.5 3" /><path v-if="message.state !== 'sent'" d="m6.5 9.5 1 0L14 3" /></svg></i></span>
                <span v-if="message.reactions?.length || message.reaction" class="reacts">
                  <template v-if="message.reactions?.length"><em v-for="item in message.reactions" :key="item.emoji" :class="{ selected: item.selected }">{{ item.emoji }}<small v-if="item.count > 1">{{ item.count }}</small></em></template>
                  <em v-else>{{ message.reaction }}</em>
                </span>
              </div>
              <Transition name="react">
                <span v-if="hovered === message.id && message.kind !== 'deleted'" class="react-bar">
                  <button v-for="emoji in QUICK" :key="emoji" :aria-label="`React ${emoji}`" @click="wa.react(message, emoji)">{{ emoji }}</button>
                </span>
              </Transition>
            </div>
          </template>
        </template>
        <div v-if="isTyping(current.id)" class="line"><div class="bubble typing tail"><i /><i /><i /></div></div>
      </div>

      <form class="compose" @submit.prevent="sendNow">
        <button v-hover type="button" class="vk-icon" aria-label="Attach"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>
        <label class="field">
          <button type="button" aria-label="Stickers" class="inline"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.1M15 9.5v.1" /></svg></button>
          <input ref="composer" v-model="draft" type="text" placeholder="Message" aria-label="Message" autocomplete="off" @keydown.stop />
          <button type="button" aria-label="Camera" class="inline"><svg viewBox="0 0 24 24"><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.4" /></svg></button>
        </label>
        <button v-hover type="submit" class="send" :aria-label="draft.trim() ? 'Send' : 'Record voice message'">
          <svg v-if="draft.trim()" viewBox="0 0 24 24"><path d="M4 12 20 4l-4 16-4-6Zm8 2 8-10" class="fill-soft" /></svg>
          <svg v-else viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v3" /></svg>
        </button>
      </form>
    </section>

    <section v-else class="welcome" aria-label="WhatsApp">
      <span class="logo"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6a18 18 0 0 0-15.6 27L6 42l9.3-2.4A18 18 0 1 0 24 6Z" class="ring" /><path d="M18 15.5c.6 0 1.2.1 1.6 1l1.6 3.8c.2.5.1 1-.2 1.4l-1.3 1.6c1.5 2.7 3.6 4.8 6.3 6.3l1.6-1.3c.4-.3 1-.4 1.4-.2l3.8 1.6c.9.4 1 1 1 1.6 0 2.1-2 3.9-4.4 3.9C21.6 35.2 12.8 26.4 12.8 18.6c0-2.3 1.6-3.1 2.8-3.1Z" class="handset" /></svg></span>
      <h2>WhatsApp for Apple Vision Pro</h2>
      <p>Send and receive messages, voice notes and photos, right here in your space. Pick a chat to start.</p>
      <small><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>Your personal messages are end-to-end encrypted</small>
    </section>

    <Transition name="react">
      <div v-if="preview" class="lightbox" role="dialog" aria-label="Photo" @click.self="preview = null">
        <figure><img :src="preview.src" alt="" /><figcaption>{{ preview.caption }}</figcaption></figure>
        <button v-hover class="vk-icon close" aria-label="Close photo" @click="preview = null"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
    </Transition>
  </div>
</template>

<style scoped src="./whatsapp/whatsapp.css"></style>
