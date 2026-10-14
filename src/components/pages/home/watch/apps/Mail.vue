<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware } from '../watch';
const watch = useWatch();
const emails = ref([
  {
    id: 1,
    sender: 'Build Bot',
    subject: 'It works on my machine',
    preview: 'The machine has been promoted.',
    body: 'Good news: the build passed. Bad news: the test was a screenshot of a green checkmark. Please enjoy this entirely fictional status report.',
    time: '10:42',
    read: false,
    archived: false
  }, {
    id: 2,
    sender: 'Coffee Committee',
    subject: 'Your meeting could be a coffee',
    preview: 'Agenda: one sip, zero slides.',
    body: 'We have reviewed the agenda and replaced all twelve slides with a single biscuit. This is a demo email. No meetings or biscuits were harmed.',
    time: '09:15',
    read: false,
    archived: false
  }, {
    id: 3,
    sender: 'Rubber Duck',
    subject: 'Re: Re: Re: that bug',
    preview: 'Have you tried quacking?',
    body: 'After careful consideration, I recommend explaining the bug out loud. My consultancy fee is one imaginary pond. Replying is optional; this duck is a demo.',
    time: 'Yesterday',
    read: true,
    archived: false
  }
]);
const selected = ref<number | null>(null);
const folder = ref<'inbox' | 'archive'>('inbox');
const email = computed(() => emails.value.find(item => item.id === selected.value));
const visible = computed(() => emails.value.filter(item => item.archived === (folder.value === 'archive')));
const unread = computed(() => emails.value.filter(item => !item.read && !item.archived).length);
function open(id: number) {
  selected.value = id;
  const item = emails.value.find(item => item.id === id);
  if (item)
    item.read = true;
}
function archive() {
  if (!email.value)
    return;
  email.value.archived = !email.value.archived;
  selected.value = null;
  watch.haptic('success');
}
useWatchHardware('mail', {
  back: () => {
    if (selected.value !== null) {
      selected.value = null;
      return true;
    }
    if (folder.value === 'archive') {
      folder.value = 'inbox';
      return true;
    }
    return false;
  }
});
</script>

<template>
  <div class="watch-app root">
    <h1>
      Mail
      <span v-if="!email" class="count">
        {{ unread }}
      </span>
    </h1>
    <template v-if="email">
      <button class="back" @click="selected = null">
        <WatchGlyph name="back" />
        {{ folder === 'inbox' ? 'Inbox' : 'Archive' }}
      </button>
      <p class="caption muted">
        {{ email.sender }}
        ·
        {{ email.time }}
      </p>
      <h2>
        {{ email.subject }}
      </h2>
      <div class="letter platter">
        {{ email.body }}
      </div>
      <button class="watch-button" @click="email.read = !email.read">
        Mark
        {{ email.read ? 'unread' : 'read' }}
      </button>
      <button class="watch-button blue" @click="archive">
        {{ email.archived ? 'Move to inbox' : 'Archive' }}
      </button>
    </template>
    <template v-else>
      <div class="button-row">
        <button
          class="watch-button"
          :class="{ blue: folder === 'inbox' }"
          @click="folder = 'inbox'"
        >
          Inbox
        </button>
        <button
          class="watch-button"
          :class="{ blue: folder === 'archive' }"
          @click="folder = 'archive'"
        >
          Archive
        </button>
      </div>
      <button
        v-for="item in visible"
        :key="item.id"
        class="mail platter"
        @click="open(item.id)"
      >
        <span class="dot" :class="{ read: item.read }" />
        <span>
          <strong>
            {{ item.sender }}
          </strong>
          <b>
            {{ item.subject }}
          </b>
          <small>
            {{ item.preview }}
          </small>
        </span>
      </button>
      <p v-if="!visible.length" class="empty">All clear. Even the spam is imaginary.</p>
      <p class="caption muted">Fictional demo inbox.</p>
    </template>
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
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  margin: 0 0 20px;
}

h2 {
  font-size: max(calc(12px / var(--watch-scale)), calc(30px * var(--text-size, 1)));
  line-height: 1.12;
  margin: 14px 0 22px;
}

.count {
  color: #0a84ff;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
}

.back {
  min-height: 72px;
  border: 0;
  background: none;
  color: #0a84ff;
  font-size: max(calc(12px / var(--watch-scale)), calc(25px * var(--text-size, 1)));
  padding: 0;
}

.mail {
  display: flex;
  gap: 12px;
  width: 100%;
  min-height: 148px;
  margin-bottom: 12px;
  border: 0;
  color: white;
  text-align: left;
}

.mail strong,
.mail b,
.mail small {
  display: block;
}

.mail strong {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
}

.mail b {
  font-size: max(calc(12px / var(--watch-scale)), calc(23px * var(--text-size, 1)));
  margin-top: 6px;
  font-weight: 500;
}

.mail small {
  font-size: max(calc(12px / var(--watch-scale)), calc(21px * var(--text-size, 1)));
  color: #aaa;
  margin-top: 7px;
}

.dot {
  width: 12px;
  height: 12px;
  background: #0a84ff;
  border-radius: 50%;
  margin-top: 14px;
  flex-shrink: 0;
}

.read {
  background: transparent;
}

.letter {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  line-height: 1.42;
  margin-bottom: 22px;
}

.blue {
  background: #063d71;
  color: #67beff;
}

.watch-button {
  margin-bottom: 12px;
}

.empty {
  font-size: max(calc(12px / var(--watch-scale)), calc(26px * var(--text-size, 1)));
  line-height: 1.3;
  padding: 30px 10px;
}

.email {
  min-height: 110px;
}

.preview {
  line-height: 1.3;
}
</style>
