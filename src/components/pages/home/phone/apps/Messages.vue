<script setup lang="ts">
import { PHONE } from '../phone';
const phone = inject(PHONE);
type Bubble = {
    from: 'me' | 'them';
    text: string;
    who?: string;
};
type Rule = [
    RegExp,
    string
];
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
    rules: Rule[];
    fallback: string[];
};
// Every thread answers back. The jokes are about software, chai and traffic, never about real people.
const threads = ref<Thread[]>([
    {
        id: 'bot',
        name: 'Build Bot',
        initials: 'BB',
        tint: 'linear-gradient(180deg,#8e9aff,#5b5ce6)',
        when: 'now',
        unread: true,
        bubbles: [
            {
                from: 'them',
                text: 'Hello. I am the phone’s unpaid intern.'
            },
            {
                from: 'them',
                text: 'Mohith is probably fixing something he called a “quick change”.'
            },
        ],
        rules: [
            [/machine|works|bug/i, 'It works on your machine? Wonderful. Shall we ship your machine?'],
            [/quick|small|minute/i, 'A quick change. The five most expensive syllables in software.'],
            [/sleep|awake|coffee|chai/i, 'Sleep is currently on the roadmap. No release date has been announced.'],
            [/hire|work|contact|email/i, 'Excellent taste. The actual human is at smohith.sm@gmail.com. I negotiate exclusively in charging cables.'],
            [/hello|hi\b|hey/i, 'Hello, fellow tab hoarder. You found the only phone here without a subscription plan.'],
            [/deploy|ship|prod/i, 'Deploying on a Friday is a personality trait, not a strategy.'],
        ],
        fallback: [
            'I have escalated this to the rubber duck. It has been staring at the same line for 40 minutes.',
            'Noted. Filed under “will fix after chai”.',
            'I ran the tests. They passed. I am as surprised as you are.'
        ],
    },
    {
        id: 'amma',
        name: 'Amma',
        initials: 'A',
        tint: 'linear-gradient(180deg,#ffb37a,#ff7a59)',
        when: '9:41',
        unread: true,
        bubbles: [
            {
                from: 'them',
                text: 'Did you eat?'
            },
            {
                from: 'me',
                text: 'Yes ma'
            },
            {
                from: 'them',
                text: 'What did you eat?'
            },
            {
                from: 'me',
                text: '…food'
            },
            {
                from: 'them',
                text: 'Biscuits are not food. Call me.'
            },
        ],
        rules: [
            [/eat|ate|food|lunch|dinner|biscuit/i, 'Proper food. With vegetables. I can tell when you are lying over text.'],
            [/busy|work|meeting|deadline/i, 'Your laptop will be there tomorrow also. Sleep.'],
            [/call|later|tomorrow/i, 'You said later last week also. I am calling in 5 minutes.'],
            [/sleep|tired|late/i, 'Why are you awake at this time? Switch off that screen.'],
            [/love|miss|thank/i, 'Okay okay. Wear a sweater.'],
            [/hello|hi\b|hey/i, 'Finally. He remembers he has a mother.'],
        ],
        fallback: [
            'Hmm. Did you drink water today?',
            'I am sending this to your father also.',
            'Okay. But did you eat?'
        ],
    },
    {
        id: 'chai',
        name: 'Chai Gang ☕',
        initials: 'CG',
        tint: 'linear-gradient(180deg,#f5d36b,#c9892a)',
        when: '9:12',
        unread: true,
        group: true,
        bubbles: [
            {
                from: 'them',
                who: 'Auto Anna',
                text: 'Meter or no ride. Final offer.'
            },
            {
                from: 'them',
                who: 'Rubber Duck',
                text: 'Quack. (That means: have you tried reading the error?)'
            },
            {
                from: 'them',
                who: 'Stand-up Timer',
                text: 'Stand-up in 2 minutes. It will take 45.'
            },
            {
                from: 'me',
                text: 'On the way'
            },
            {
                from: 'them',
                who: 'Auto Anna',
                text: '“On the way” means you are choosing a shirt.'
            },
        ],
        rules: [
            [/way|coming|there|late/i, 'Auto Anna: Five minutes in Bengaluru time is a philosophical concept.'],
            [/chai|tea|coffee/i, 'Rubber Duck: One cutting chai. Two if the build is red.'],
            [/meeting|standup|stand-up|sync/i, 'Stand-up Timer: This could have been a message. This message could have been nothing.'],
            [/bug|error|crash|broken/i, 'Rubber Duck: Quack. Have you tried explaining it to me slowly?'],
            [/traffic|signal|silk board/i, 'Auto Anna: Silk Board is not traffic. It is a lifestyle.'],
            [/plan|trip|weekend/i, 'Stand-up Timer: The group trip is confirmed. Dates, place and people to be decided.'],
        ],
        fallback: [
            'Rubber Duck: Quack.',
            'Auto Anna: Double meter after 10 PM. I do not make the rules. I do, actually.',
            'Stand-up Timer: Let us take this offline. Forever.'
        ],
    },
    {
        id: 'landlord',
        name: 'Landlord (rent)',
        initials: 'L',
        tint: 'linear-gradient(180deg,#b0b6c2,#7d8494)',
        when: 'Yesterday',
        bubbles: [
            {
                from: 'them',
                text: 'Rent.'
            },
            {
                from: 'me',
                text: 'Sent it on the 1st, uncle'
            },
            {
                from: 'them',
                text: 'Next month rent.'
            },
        ],
        rules: [
            [/rent|paid|sent|transfer/i, 'Received. Also from next month it is slightly more. Small increase only. 18%.'],
            [/tap|leak|water|fix|repair|broken/i, 'That is not a leak. That is a water feature. Very premium.'],
            [/deposit|advance/i, 'Deposit is safe. Very safe. Do not ask where.'],
            [/friend|party|guest|music/i, 'No parties. No guests after 9. No happiness after 10.'],
            [/hello|hi\b|hey/i, 'Rent.'],
            [/thanks|thank/i, 'Welcome. Rent.'],
        ],
        fallback: [
            'I will send the plumber. Sometime this year.',
            'Please do not put nails in the wall. The wall is sensitive.',
            'Rent.'
        ],
    },
    {
        id: 'otp',
        name: 'VM-TOTLBNK',
        initials: '#',
        tint: 'linear-gradient(180deg,#a6adb8,#6f7682)',
        when: 'Monday',
        sms: true,
        bubbles: [
            {
                from: 'them',
                text: '483921 is your OTP. Do not share it with anyone. Not even us. We do not know why we are sending it.'
            },
            {
                from: 'them',
                text: 'Dear customer, your account has been credited with ₹0.00. Thank you for banking with imagination.'
            },
            {
                from: 'them',
                text: 'Congratulations! You are pre-approved for a loan you did not ask for.'
            },
        ],
        rules: [
            [/stop|unsubscribe|no/i, 'You have been subscribed to STOP alerts. Reply STOP to receive more.'],
            [/otp|code/i, '112233 is your OTP for requesting another OTP.'],
            [/loan|credit|money/i, 'Your loan of ₹0.00 has been approved at 0.00% interest. Terms and conditions are also imaginary.'],
            [/help|human|agent/i, 'All our agents are busy. Your message is important to our auto-reply.'],
            [/hello|hi\b|hey/i, 'This is an automated number. It is lonely here.'],
            [/who|what/i, 'We are your bank. Probably.'],
        ],
        fallback: ['Message not delivered to a human. There are no humans.', 'Thank you. Your feedback has been safely ignored.'],
    },
    {
        id: 'delivery',
        name: 'Delivery Partner',
        initials: 'DP',
        tint: 'linear-gradient(180deg,#7fe0a0,#2fae62)',
        when: 'Sunday',
        bubbles: [
            {
                from: 'them',
                text: 'Sir I am outside.'
            },
            {
                from: 'me',
                text: 'Outside where?'
            },
            {
                from: 'them',
                text: 'Outside only sir.'
            },
            {
                from: 'them',
                text: 'Sir which gate? There are 4 gates and a philosophical one.'
            },
        ],
        rules: [
            [/gate|where|location|pin|map/i, 'Sir map is showing your house inside a lake.'],
            [/coming|wait|minute|down/i, 'Okay sir. Two minutes. Actual minutes, not your minutes.'],
            [/otp|code/i, 'Sir OTP please. No not that one. Other one.'],
            [/thanks|thank|rating|star/i, 'Five stars please sir. I have seen things at Silk Board.'],
            [/cold|late|food/i, 'Sir food was hot when journey started. Journey was long.'],
            [/hello|hi\b|hey/i, 'Sir I am still outside.'],
        ],
        fallback: [
            'Sir please come down. Lift is also not coming.',
            'Okay sir.',
            'Sir security uncle is asking who I am. I am also asking.'
        ],
    },
]);
const openId = ref<string | null>(null);
const active = computed(() => threads.value.find(item => item.id === openId.value) ?? null);
const draft = ref('');
const typing = ref(false);
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
const shown = computed(() => {
    const needle = query.value.trim().toLowerCase();
    return threads.value.filter(item => !needle ||
        (item.name + ' ' + (item.bubbles.at(-1)?.text ?? '')).toLowerCase().includes(needle));
});
let replyTimer = 0, fallbackTurn = 0;
function scrollDown() {
    void nextTick(() => feed.value?.scrollTo({
        top: feed.value.scrollHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    }));
}
function enter(thread: Thread) {
    thread.unread = false;
    openId.value = thread.id;
    draft.value = '';
    choosingRecipient.value = false;
    editingList.value = false;
    attachmentsOpen.value = false;
    callOpen.value = false;
    scrollDown();
}
function back() {
    clearTimeout(replyTimer);
    typing.value = false;
    openId.value = null;
    callOpen.value = false;
    attachmentsOpen.value = false;
}
function send(text = draft.value) {
    const thread = active.value, value = text.trim().slice(0, 240);
    if (!thread || !value)
        return;
    thread.bubbles.push({
        from: 'me',
        text: value
    });
    thread.when = 'now';
    draft.value = '';
    scrollDown();
    clearTimeout(replyTimer);
    typing.value = true;
    replyTimer = window.setTimeout(() => {
        const answer = thread.rules.find(([pattern]) => pattern.test(value))?.[1] ?? thread.fallback[fallbackTurn++ % thread.fallback.length] ?? 'Noted. Chai first, reply next.';
        const [who, ...rest] = thread.group ? answer.split(': ') : ['', answer];
        thread.bubbles.push(thread.group ? {
            from: 'them',
            who,
            text: rest.join(': ')
        } : {
            from: 'them',
            text: answer
        });
        if (thread.bubbles.length > 40)
            thread.bubbles.splice(0, 2);
        typing.value = false;
        scrollDown();
    }, 900 + Math.min(1400, value.length * 30));
}
onBeforeUnmount(() => clearTimeout(replyTimer));
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
                  {{ thread.bubbles.at(-1)?.text }}
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
        <div ref="feed" class="feed" aria-live="polite">
          <p class="stamp">
            {{ active.sms ? 'Text Message · SMS' : 'iMessage' }}
            <br />
            Today
            {{ new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }}
          </p>
          <template v-for="(bubble, index) in active.bubbles" :key="index">
            <small v-if="bubble.who && active.bubbles[index - 1]?.who !== bubble.who" class="sender">{{ bubble.who }}</small>
            <p
              class="bubble"
              :class="[bubble.from, { sms: active.sms, tail: active.bubbles[index + 1]?.from !== bubble.from || active.bubbles[index + 1]?.who !== bubble.who }]"
            >
              {{ bubble.text }}
            </p>
          </template>
          <p v-if="typing" class="bubble them tail typing" aria-label="Typing">
            <i />
            <i />
            <i />
          </p>
          <small v-else-if="active.bubbles.at(-1)?.from === 'me'" class="receipt">Delivered</small>
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
</style>
