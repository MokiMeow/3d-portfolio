<script setup lang="ts">
import { PHONE } from '../phone';
import { APP_ICONS as icons } from './icons';
const phone = inject(PHONE);
type Kind = 'family' | 'flat' | 'rent' | 'delivery' | 'amma' | 'dev';
type Message = {
    id: number;
    text: string;
    mine: boolean;
    time: string;
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
};
const seeds: Array<[
    string,
    string,
    string,
    Kind,
    string,
    number,
    boolean
]> = [
    [
        'Family HQ',
        'FH',
        '#d4a66b',
        'family',
        'Please stop replying with 👍 to everything.',
        3,
        true
    ],
    [
        'Amma',
        'A',
        '#c09bb7',
        'amma',
        'Had lunch? This is a recurring notification.',
        2,
        false
    ],
    [
        'Bengaluru Flat Hunt',
        'BF',
        '#8caa87',
        'flat',
        'Spacious 1BHK. The space is hypothetical.',
        18,
        true
    ],
    [
        'Landlord',
        'L',
        '#b9a580',
        'rent',
        'Just a gentle reminder. Again.',
        1,
        false
    ],
    [
        'Delivery Rider',
        'DR',
        '#83a8bd',
        'delivery',
        'At the gate. Which of the seven gates?',
        0,
        false
    ],
    [
        'The Bug Support Group',
        'BG',
        '#929ec7',
        'dev',
        'It only breaks when someone watches.',
        7,
        true
    ],
    [
        'Chai Committee',
        'CC',
        '#c58e70',
        'family',
        'Meeting at 4. Agenda: biscuits.',
        0,
        true
    ],
    [
        'Rubber Duck',
        'RD',
        '#d5b24e',
        'dev',
        'Have you tried explaining it out loud?',
        0,
        false
    ]
];
const chats = ref<Chat[]>(seeds.map((s, i) => ({
    id: i,
    name: s[0],
    glyph: s[1],
    color: s[2],
    kind: s[3],
    preview: s[4],
    unread: s[5],
    group: s[6],
    messages: [{
            id: i * 10,
            text: s[4],
            mine: false,
            time: '10:42'
        }, {
            id: i * 10 + 1,
            text: 'Noted. With a reasonable amount of concern.',
            mine: true,
            time: '10:43'
        }]
})));
const tab = ref<string>('Chats');
const search = ref<string>('');
const filter = ref<string>('All');
const selected = ref<number | null>(null);
const draft = ref<string>('');
const typing = ref<number[]>([]);
const timeline = ref<HTMLElement | null>(null);
const quiet = ref<boolean>(false);
const status = ref<string>('');
const current = computed(() => chats.value.find(c => c.id === selected.value));
const filtered = computed(() => chats.value.filter(chat =>
    chat.name.toLowerCase().includes(search.value.toLowerCase()) &&
    (filter.value !== 'Unread' || chat.unread > 0) 
        &&
    (filter.value !== 'Groups' || chat.group)));
const replyRules: Record<Kind, Array<[
    RegExp,
    string
]>> = {
    family: [
        [/lunch|food|eat/i, 'Food is ready. Your deployment can wait.'],
        [/chai|tea/i, 'Chai has quorum. You are the only pending member.'],
        [/bug|code/i, 'Have you tried switching the laptop off and coming downstairs?'],
        [/hello|hi\b/i, 'Hello! Now please acknowledge the 43 photos above.'],
        [/late|traffic/i, 'Leave early. Preferably yesterday.'],
        [/ok|yes|noted/i, 'Excellent. We have archived your acknowledgement.']
    ],
    flat: [
        [/rent|price|cost/i, 'Rent is negotiable if you negotiate with your expectations.'],
        [/visit|see/i, 'Viewing at 6. The traffic will view you until 8.'],
        [/wifi|internet/i, 'High-speed Wi-Fi. Speed measured emotionally.'],
        [/deposit/i, 'Only a small deposit. Small compared with a moon mission.'],
        [/room|space|bhk/i, 'Open-plan bedroom. The plan is still open.'],
        [/pet|cat/i, 'Pets allowed. Landlord approval loads indefinitely.']
    ],
    rent: [
        [/rent|paid|payment/i, 'Received in spirit. Please also send in currency.'],
        [/fix|leak|repair/i, 'The plumber is on his way. This is a timeless statement.'],
        [/deposit/i, 'Your deposit is safe. Very safe. Possibly unreachable.'],
        [/late|tomorrow/i, 'Tomorrow is my favourite recurring payment date.'],
        [/wifi|power/i, 'Try the switch labelled Do Not Touch.'],
        [/hello|hi\b/i, 'Hello Mohith. A greeting and a rent reminder, efficiently combined.']
    ],
    delivery: [
        [/gate|where|location/i, 'Standing beside the gate beside the other gate.'],
        [/otp|code/i, 'Please share the delivery code, not your entire repository.'],
        [/late|time/i, 'Two minutes away. Bengaluru minutes.'],
        [/food|pizza|chai/i, 'Your food is warm. My route is a suspense thriller.'],
        [/call|phone/i, 'Calling. The intercom has requested a coffee break.'],
        [/thanks|thank/i, 'Enjoy! Please rate the stairs separately.']
    ],
    amma: [
        [/lunch|food|eat/i, 'Good. Did you have vegetables or just green syntax highlighting?'],
        [/chai|tea/i, 'One cup is fine. A dependency on chai is still a dependency.'],
        [/bug|work|code/i, 'Take a break. Bugs also need time to think.'],
        [/sleep|late/i, 'Close the laptop. The moon is not your project manager.'],
        [/hello|hi\b/i, 'Hello. Had lunch? We keep the important APIs stable.'],
        [/yes|ok|noted/i, 'Good. Sending one more reminder just in case.']
    ],
    dev: [
        [/bug|error/i, 'Reproduced. Sadly, on all machines except the one that matters.'],
        [/deploy|ship/i, 'Deployment approved by the duck. Rollback also approved.'],
        [/test/i, 'All tests pass. The users keep inventing new tests.'],
        [/quick|change/i, 'A quick change. Famous first words.'],
        [/meeting|call/i, 'Could this meeting be a well-named variable?'],
        [/works|machine/i, 'Excellent. We will ship your machine.']
    ]
};
const timers = new Set<ReturnType<typeof setTimeout>>();
function openChat(chat: Chat) {
    selected.value = chat.id;
    chat.unread = 0;
    draft.value = '';
}
async function bottom() {
    await nextTick();
    timeline.value?.scrollTo({
        top: timeline.value.scrollHeight,
        behavior: 'auto'
    });
}
function send() {
    const chat = current.value;
    const text = draft.value.trim();
    if (!chat || !text || typing.value.includes(chat.id))
        return;
    const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(phone?.now.value ?? new Date());
    chat.messages.push({
        id: Date.now(),
        text,
        mine: true,
        time
    });
    chat.preview = text;
    draft.value = '';
    typing.value.push(chat.id);
    void bottom();
    const timer = setTimeout(() => {
        const reply = replyRules[chat.kind].find(([rule]) => rule.test(text))?.[1] 
        ?? (chat.group ? 'This has been forwarded to the committee. The committee is having chai.' : 'Message received. A thoughtful reply is compiling.');
        chat.messages.push({
            id: Date.now() + 1,
            text: reply,
            mine: false,
            time
        });
        chat.preview = reply;
        typing.value = typing.value.filter(id => id !== chat.id);
        if (selected.value !== chat.id)
            chat.unread++;
        void bottom();
        timers.delete(timer);
    }, 1400);
    timers.add(timer);
}
watch(selected, () => {
    void bottom();
});
onBeforeUnmount(() => timers.forEach(clearTimeout));
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
            {{ typing.includes(current.id) ? 'typing…' : current.group ? 'a very active group' : 'online' }}
          </span>
        </div>
        <button class="icon" aria-label="Call contact" @click="phone?.open('phone')">
          <svg viewBox="0 0 24 24">
            <path :d="icons.call" />
          </svg>
        </button>
      </header>
      <div ref="timeline" class="conversation scroll" aria-live="polite">
        <div class="day">Today</div>
        <div class="encryption">⌁ Messages stay in this pretend phone. Even the bugs.</div>
        <div
          v-for="message in current.messages"
          :key="message.id"
          class="bubble"
          :class="{mine:message.mine}"
        >
          {{ message.text }}
          <span class="stamp">
            {{ message.time }}
            <b v-if="message.mine">✓✓</b>
          </span>
        </div>
        <div v-if="typing.includes(current.id)" class="bubble typing" aria-label="Contact is typing">
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
          :disabled="!draft.trim() || typing.includes(current.id)"
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
              @click="openChat(chats[chats.length-1]!)"
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
                <p>{{ chat.preview }}</p>
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
          <button class="status-row" @click="openChat(chats[5]!)">
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
</style>
