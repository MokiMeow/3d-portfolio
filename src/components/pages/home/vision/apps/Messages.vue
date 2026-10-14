<script setup lang="ts">
import { vHover } from "../kit/hover";
import { useMessages } from "./messages/useMessages";
import ControlIcon from "./freeform/ControlIcon.vue";

defineProps<{ compact?: boolean }>();

const personaId = useId();
const fadeId = personaId + "-fade";
const maskId = personaId + "-mask";

const {
  vision,
  modalOpen,
  callModal,
  followLatest,
  trackScroll,
  scrollToLatest,
  panelKeys,
  conversations,
  selectedId,
  current,
  search,
  filter,
  visibleChats,
  showThread,
  composer,
  replying,
  editing,
  effect,
  tool,
  details,
  newChat,
  recipients,
  groupName,
  menuMessage,
  photoPreview,
  linkPreview,
  notice,
  bubbles,
  composerInput,
  root,
  pending,
  typing,
  screenEffect,
  effects,
  summary,
  choose,
  back,
  collectionKeys,
  send,
  openMenu,
  startPress,
  cancelPress,
  activateMessage,
  react,
  replyTo,
  editMessage,
  cancelEdit,
  unsend,
  jumpToReply,
  urlIn,
  linkTitle,
  toggleRecipient,
  createChat,
  closeSheets,
  trapFocus,
  playingId,
  audioProgress,
  playAudio,
  call,
  callName,
  muted,
  startCall,
  endCall,
  callTime,
  launchEffect,
  feedback,
  photos,
  reactions,
  stickers,
  waveform,
} = useMessages();
</script>

<template>
  <div ref="root" class="messages-root" :class="{ 'thread-open': showThread, 'call-active': call }">
    <div class="workspace" :inert="modalOpen || details || (call && callModal) ? true : undefined">
      <aside class="conversation-list vk-platter" aria-label="Conversations">
        <header class="list-heading">
          <h1>
            Messages
          </h1>
          <button v-hover class="vk-icon large" aria-label="New conversation" @click="newChat = true">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 5H5v14h14v-9M12 12l8-8m-5 0h5v5" />
            </svg>
          </button>
        </header>
        <input
          v-hover
          v-model="search"
          class="vk-field"
          aria-label="Search conversations and messages"
          placeholder="Search"
          type="search"
        />
        <div class="filters vk-segmented" role="group" aria-label="Conversation filter">
          <button v-hover :aria-pressed="filter === 'all'" @click="filter = 'all'">
            All
          </button>
          <button v-hover :aria-pressed="filter === 'unread'" @click="filter = 'unread'">
            Unread
          </button>
        </div>
        <div class="chat-collection vk-scroll" @keydown="collectionKeys">
          <div v-if="!visibleChats.length" class="empty">
            <ControlIcon :name="search.trim() ? 'help' : 'check'" />
            <strong>{{ search.trim() ? 'No conversations found' : 'All caught up' }}</strong>
            <p>{{ search.trim() ? 'Try a contact name or a word from a message.' : 'No unread conversations. A rare quiet moment.' }}</p>
            <button v-hover class="vk-button" @click="search.trim() ? search = '' : filter = 'all'">
              {{ search.trim() ? 'Clear search' : 'Show all conversations' }}
            </button>
          </div>
          <button
            v-for="chat in visibleChats"
            :key="chat.id"
            v-hover
            data-chat
            class="chat-row vk-row"
            :class="{ selected: selectedId === chat.id }"
            :aria-label="
              chat.name +
              (chat.unread ? ', ' + chat.unread + ' unread messages' : '') +
              (chat.pinned ? ', pinned' : '') +
              (chat.muted ? ', alerts hidden' : '')
            "
            :aria-pressed="selectedId === chat.id"
            @click="choose(chat.id)"
          >
            <span class="avatar" :style="{ '--tint': chat.tint }">
              <ControlIcon :name="chat.id <= 3 ? chat.name : 'Chai & Debug'" />
            </span>
            <span class="chat-copy">
              <span class="row-title">
                <strong>
                  {{ chat.name }}
                </strong>
                <svg v-if="chat.muted" class="muted-indicator" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 4a6 6 0 0 1 9 5v4l2 3H9M4 16l2-3V9m4 11h4M3 3l18 18"/>
                </svg>
                <span v-if="chat.pinned" class="pin" aria-hidden="true">
                  <ControlIcon name="pin" />
                </span>
              </span>
              <small>
                {{ pending[chat.id] ? 'Typing…' : summary(chat.messages.at(-1)) }}
              </small>
            </span>
            <span v-if="chat.unread" class="unread">
              {{ chat.unread }}
            </span>
          </button>
        </div>
        <p class="list-foot">
          The concern about chai is universal.
        </p>
      </aside>
      <main class="thread">
        <header class="thread-header">
          <button v-hover class="vk-icon back" aria-label="Back to conversations" @click="back">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14 5-7 7 7 7"/>
            </svg>
          </button>
          <span class="avatar" :style="{ '--tint': current.tint }">
            <ControlIcon :name="current.id <= 3 ? current.name : 'Chai & Debug'" />
          </span>
          <div class="heading-copy">
            <h2>
              {{ current.name }}
            </h2>
            <p>
              {{ current.description }}
            </p>
          </div>
          <button v-hover class="vk-icon" aria-label="Start pretend FaceTime call" @click="startCall">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3" y="6" width="12" height="12" rx="3"/>
              <path d="m15 10 6-3v10l-6-3"/>
            </svg>
          </button>
          <button
            v-hover
            class="vk-icon"
            aria-label="Conversation details"
            :aria-expanded="details"
            @click="details = !details"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 11v6m0-10v1"/>
            </svg>
          </button>
        </header>
        <p class="privacy">
          Fictional conversations. Nothing is sent.
        </p>
        <div
          ref="bubbles"
          @scroll="trackScroll"
          class="bubbles vk-scroll"
          role="log"
          aria-label="Conversation messages"
          aria-live="polite"
          aria-relevant="additions text"
        >
          <p class="date-line">
            Today · somewhere between builds
          </p>
          <article
            v-for="message in current.messages"
            :key="message.id"
            :data-message="message.id"
            class="message-row"
            :class="{ mine: message.mine }"
            @contextmenu.prevent="openMenu(message)"
          >
            <div class="message-stack">
              <p v-if="message.sender" class="sender">
                {{ message.sender }}
              </p>
              <div v-if="message.unsent" class="unsent">
                You unsent a message.
              </div>
              <div
                v-else
                class="bubble"
                :class="['effect-' + (message.effect ?? 'none'), { revealed: message.revealed, sticker: message.sticker }]"
              >
                <button
                  v-if="message.reply"
                  v-hover
                  class="reply-quote"
                  :aria-label="'View replied message from ' + message.reply.sender"
                  @click="jumpToReply(message.reply.id)"
                >
                  <strong>
                    {{ message.reply.sender }}
                  </strong>
                  <span>
                    {{ message.reply.text }}
                  </span>
                </button>
                <button
                  v-if="!message.audio && !message.photo"
                  v-hover
                  class="message-text"
                  :class="{ ink: message.effect === 'ink' && !message.revealed }"
                  :aria-label="message.effect === 'ink' && !message.revealed ? 'Reveal invisible ink message' : summary(message) + '. Open message actions'"
                  @pointerdown="startPress(message, $event)"
                  @pointerup="cancelPress"
                  @pointerleave="cancelPress"
                  @pointercancel="cancelPress"
                  @focus="message.effect === 'ink' && (message.revealed = true)"
                  @mouseenter="message.effect === 'ink' && (message.revealed = true)"
                  @click="activateMessage(message)"
                >
                  <span v-if="message.sticker" class="sticker-art">
                    {{ message.sticker }}
                  </span>
                  <span v-else>
                    {{ message.text }}
                  </span>
                  <span v-if="message.effect === 'ink' && !message.revealed" class="ink-hint" aria-hidden="true">
                    Touch to reveal
                  </span>
                </button>
                <button
                  v-if="message.photo"
                  v-hover
                  class="photo-card"
                  :aria-label="'View photo: ' + message.text"
                  @pointerdown="startPress(message, $event)"
                  @pointerup="cancelPress"
                  @pointerleave="cancelPress"
                  @pointercancel="cancelPress"
                  @click="activateMessage(message)"
                >
                  <img :src="'/vision/env/' + message.photo + '-thumb.webp'" :alt="message.text" />
                  <span>
                    {{ message.text }}
                  </span>
                </button>
                <div v-if="message.audio" class="audio-card">
                  <button
                    v-hover
                    class="vk-icon"
                    :aria-label="(playingId === message.id ? 'Stop' : 'Play') + ' six-second synthetic duck audio'"
                    @click="playAudio(message)"
                  >
                    <ControlIcon :name="playingId === message.id ? 'stop' : 'play'" />
                  </button>
                  <svg class="waveform" viewBox="0 0 136 44" aria-hidden="true">
                    <line
                      v-for="(height, i) in waveform"
                      :key="i"
                      :x1="i * 4 + 2"
                      :x2="i * 4 + 2"
                      :y1="22 - height / 2"
                      :y2="22 + height / 2"
                      :class="{ played: playingId === message.id && i / waveform.length < audioProgress }"
                    />
                  </svg>
                  <span>
                    0:{{ playingId === message.id ? String(6 - Math.floor(audioProgress * 6)).padStart(2, '0') : '06' }}
                  </span>
                </div>
                <button
                  v-if="urlIn(message.text)"
                  v-hover
                  class="link-card"
                  :aria-label="'Preview shared link from ' + linkTitle(urlIn(message.text))"
                  @click="linkPreview = urlIn(message.text)"
                >
                  <span class="link-symbol">
                    <ControlIcon name="link" />
                  </span>
                  <span>
                    <strong>
                      {{ linkTitle(urlIn(message.text)) }}
                    </strong>
                    <small>
                      Shared link · tap to preview
                    </small>
                  </span>
                </button>
                <span v-if="message.reaction" class="reaction" :aria-label="'Tapback: ' + message.reaction">
                  {{ message.reaction }}
                </span>
              </div>
              <p class="message-meta">
                {{ message.time }}
                <span v-if="message.edited">
                  · Edited
                </span>
                <span v-if="message.mine && !message.unsent">
                  · {{ message.status === 'read' ? 'Read' : 'Delivered' }}
                </span>
              </p>
            </div>
            <button
              v-if="!message.unsent"
              v-hover
              class="message-actions vk-icon plain"
              :aria-label="'Actions for ' + summary(message)"
              @click="openMenu(message)"
            >
              <ControlIcon name="more" />
            </button>
          </article>
          <div v-if="typing" class="typing" aria-label="Contact is typing">
            <span/>
            <span/>
            <span/>
          </div>
        </div>
        <button v-if="!followLatest" v-hover class="latest vk-button" @click="scrollToLatest">
          Latest messages <ControlIcon name="arrow" />
        </button>
        <div v-if="replying || editing" class="compose-context">
          <span>
            <strong>
              {{ editing ? 'Editing message' : 'Replying to ' + (replying?.sender ?? (replying?.mine ? 'You' : current.name)) }}
            </strong>
            <small>
              {{ summary(editing ?? replying) }}
            </small>
          </span>
          <button
            v-hover
            class="vk-icon"
            :aria-label="editing ? 'Cancel editing' : 'Cancel reply'"
            @click="editing ? cancelEdit() : replying = undefined"
          >
            <ControlIcon name="close" />
          </button>
        </div>
        <div v-if="tool" class="composer-tools vk-sheet vk-scroll" @keydown="panelKeys">
          <div class="tool-heading">
            <strong>
              {{ tool === 'attachments' ? 'Add to your message' : tool === 'emoji' ? 'Stickers & emoji' : 'Send with an effect' }}
            </strong>
            <button v-hover class="vk-icon" aria-label="Close composer tools" @click="tool = undefined">
              <ControlIcon name="close" />
            </button>
          </div>
          <div v-if="tool === 'attachments'" class="attachment-grid">
            <button
              v-for="photo in photos"
              :key="photo.id"
              v-hover
              class="attachment-photo"
              :aria-label="'Send ' + photo.name + ' photo'"
              @click="send({ photo: photo.id, text: photo.name })"
            >
              <img :src="'/vision/env/' + photo.id + '-thumb.webp'" :alt="photo.name"/>
              <span>
                {{ photo.name }}
              </span>
            </button>
            <button
              v-hover
              class="vk-button audio-attach"
              aria-label="Send synthetic duck audio message"
              @click="send({ audio: true, text: 'A supportive quack, synthesised.' })"
            >
              <ControlIcon name="Sounds" /> Send a quack
            </button>
          </div>
          <div v-else-if="tool === 'emoji'" class="emoji-grid">
            <button
              v-for="sticker in stickers"
              :key="sticker"
              v-hover
              :aria-label="'Send ' + sticker + ' sticker'"
              class="emoji-button"
              @click="send({ sticker, text: sticker })"
            >
              {{ sticker }}
            </button>
            <button
              v-hover
              class="vk-button"
              aria-label="Insert smiling emoji in draft"
              @click="composer += ' 😊'; tool = undefined; composerInput?.focus()"
            >
              😊 Add to text
            </button>
          </div>
          <div v-else class="effect-grid">
            <button
              v-for="item in effects"
              :key="item.id"
              v-hover
              class="effect-choice vk-row"
              :aria-pressed="effect === item.id"
              @click="effect = item.id; tool = undefined"
            >
              <strong>
                {{ item.name }}
              </strong>
              <small>
                {{ item.line }}
              </small>
            </button>
          </div>
        </div>
        <form class="composer vk-ornament" @submit.prevent="send()">
          <button
            v-hover
            type="button"
            class="vk-icon attach"
            aria-label="Add photo or audio attachment"
            :aria-expanded="tool === 'attachments'"
            :disabled="!!editing"
            @click="tool = tool === 'attachments' ? undefined : 'attachments'"
          >
            <ControlIcon name="plus" />
          </button>
          <input
            ref="composerInput"
            v-hover
            v-model="composer"
            class="vk-field"
            maxlength="1000"
            :aria-label="'Message ' + current.name"
            :placeholder="editing ? 'Edit your message' : 'Message, or a small existential crisis'"
            autocomplete="off"
          />
          <button
            v-hover
            type="button"
            class="vk-icon emoji-toggle"
            aria-label="Choose sticker or emoji"
            :aria-expanded="tool === 'emoji'"
            :disabled="!!editing"
            @click="tool = tool === 'emoji' ? undefined : 'emoji'"
          >
            <ControlIcon name="emoji" />
          </button>
          <button
            v-hover
            type="button"
            class="vk-icon effect-toggle"
            :aria-label="'Send effects. Current effect: ' + effect"
            :aria-expanded="tool === 'effects'"
            :disabled="!!editing"
            @click="tool = tool === 'effects' ? undefined : 'effects'"
          >
            <ControlIcon name="sparkle" />
          </button>
          <button
            v-hover
            type="submit"
            class="vk-icon large tinted send"
            :disabled="!composer.trim()"
            :aria-label="editing ? 'Save edited message' : 'Send message'"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20V4m-7 7 7-7 7 7"/>
            </svg>
          </button>
        </form>
        <div class="composer-secondary">
          <button
            v-hover
            class="vk-button"
            type="button"
            aria-label="Insert pretend dictation into draft"
            :disabled="!!editing"
            @click="composer += (composer ? ' ' : '') + 'One more tiny change, then chai.'; composerInput?.focus()"
          >
            <ControlIcon name="mic" /> Pretend dictation
          </button>
          <button
            v-hover
            class="vk-button secondary-effects"
            aria-label="Choose send effect"
            :disabled="!!editing"
            @click="tool = 'effects'"
          >
            <ControlIcon name="sparkle" /> {{ effect === 'none' ? 'Effects' : effects.find(item => item.id === effect)?.name }}
          </button>
          <button
            v-hover
            class="vk-icon secondary-emoji"
            aria-label="Choose sticker or emoji"
            :disabled="!!editing"
            @click="tool = 'emoji'"
          >
            <ControlIcon name="emoji" />
          </button>
        </div>
      </main>
    </div>
    <aside v-if="details" class="details vk-sheet vk-scroll" role="dialog" aria-modal="true"
      :inert="modalOpen ? true : undefined" aria-label="Conversation details" @keydown="panelKeys">
      <div class="tool-heading">
        <h2>
          Details
        </h2>
        <button v-hover class="vk-icon" aria-label="Close conversation details" @click="details = false">
          <ControlIcon name="close" />
        </button>
      </div>
      <span class="avatar big" :style="{ '--tint': current.tint }">
        {{ current.glyph }}
      </span>
      <h3>
        {{ current.name }}
      </h3>
      <p class="muted">
        {{ current.description }}
      </p>
      <button
        v-hover
        class="vk-button"
        :aria-pressed="current.pinned"
        @click="current.pinned = !current.pinned"
      >
        {{ current.pinned ? 'Unpin conversation' : 'Pin conversation' }}
      </button>
      <button
        v-hover
        class="vk-button"
        :aria-pressed="current.muted"
        @click="current.muted = !current.muted"
      >
        {{ current.muted ? 'Show alerts' : 'Hide alerts' }}
      </button>
      <button
        v-hover
        class="vk-button"
        @click="current.unread = current.unread ? 0 : 1; feedback(current.unread ? 'Marked unread.' : 'Marked read.')"
      >
        {{ current.unread ? 'Mark as read' : 'Mark as unread' }}
      </button>
      <h4>
        Participants
      </h4>
      <p v-for="member in current.members" :key="member" class="member">
        {{ member }}
      </p>
      <h4>
        Shared photos
      </h4>
      <div class="shared-photos">
        <button
          v-for="message in current.messages.filter(item => item.photo && !item.unsent)"
          :key="message.id"
          v-hover
          :aria-label="'View shared photo ' + message.text"
          @click="photoPreview = message.photo"
        >
          <img :src="'/vision/env/' + message.photo + '-thumb.webp'" :alt="message.text"/>
        </button>
        <p v-if="!current.messages.some(item => item.photo && !item.unsent)" class="muted">
          A quack is worth a thousand pictures.
        </p>
      </div>
      <button v-hover class="vk-button call-start" @click="startCall">
        Pretend FaceTime
      </button>
    </aside>
    <div v-if="notice" class="notice vk-sheet" role="status">
      {{ notice }}
    </div>
    <div
      v-if="menuMessage || newChat || photoPreview || linkPreview"
      class="modal-backdrop"
      @click.self="closeSheets"
      @keydown.esc.stop.prevent="closeSheets"
    >
      <section
        class="modal vk-sheet vk-scroll"
        role="dialog"
        aria-modal="true"
        :aria-label="menuMessage ? 'Message actions' : newChat ? 'New conversation' : photoPreview ? 'Photo preview' : 'Shared link preview'"
        @keydown="trapFocus"
      >
        <div class="tool-heading">
          <h2>
            {{ menuMessage ? 'Message' : newChat ? 'New conversation' : photoPreview ? 'Shared photo' : 'Shared link' }}
          </h2>
          <button v-hover data-first class="vk-icon" aria-label="Close dialog" @click="closeSheets">
            <ControlIcon name="close" />
          </button>
        </div>
        <template v-if="menuMessage">
          <p class="menu-excerpt">
            {{ summary(menuMessage) }}
          </p>
          <div class="tapbacks" aria-label="Tapback reactions">
            <button
              v-for="emoji in reactions"
              :key="emoji"
              v-hover
              class="vk-icon"
              :aria-label="'React ' + emoji"
              :aria-pressed="menuMessage.reaction === emoji"
              @click="react(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
          <button v-hover class="vk-row" @click="replyTo">
            <ControlIcon name="reply" /> Reply
          </button>
          <button
            v-if="menuMessage.mine && !menuMessage.audio && !menuMessage.photo && !menuMessage.sticker"
            v-hover
            class="vk-row"
            @click="editMessage"
          >
            <ControlIcon name="pen" /> Edit message
          </button>
          <button v-if="menuMessage.mine" v-hover class="vk-row destructive" @click="unsend">
            Unsend message
          </button>
          <button
            v-if="menuMessage.effect === 'confetti' || menuMessage.effect === 'lasers'"
            v-hover
            class="vk-row"
            @click="launchEffect(menuMessage.effect ?? 'none'); menuMessage = undefined"
          >
            Replay effect
          </button>
        </template>
        <template v-else-if="newChat">
          <p class="muted">
            Who needs a small existential crisis?
          </p>
          <button
            v-for="person in conversations.slice(0, 3)"
            :key="person.id"
            v-hover
            class="vk-row"
            :aria-pressed="recipients.includes(person.name)"
            @click="toggleRecipient(person.name)"
          >
            <span class="avatar" :style="{ '--tint': person.tint }">
              <ControlIcon :name="person.name" />
            </span>
            <strong>
              {{ person.name }}
            </strong>
            <span class="check">
              <ControlIcon :name="recipients.includes(person.name) ? 'check' : 'plus'" />
            </span>
          </button>
          <input
            v-if="recipients.length > 1"
            v-hover
            v-model="groupName"
            class="vk-field"
            maxlength="50"
            aria-label="Group conversation name"
            placeholder="Group name, optional"
          />
          <button
            v-hover
            class="vk-button primary create-chat"
            :disabled="!recipients.length"
            @click="createChat"
          >
            Start conversation
          </button>
        </template>
        <template v-else-if="photoPreview">
          <img
            class="preview-photo"
            :src="'/vision/env/' + photoPreview + '-thumb.webp'"
            :alt="photos.find(photo => photo.id === photoPreview)?.name ?? 'Shared environment photo'"
          />
          <p>
            {{ photos.find(photo => photo.id === photoPreview)?.name ?? 'A peaceful place' }}
          </p>
          <button
            v-hover
            class="vk-button"
            @click="vision?.open('photos'); feedback(vision ? 'Opened Photos.' : 'Photo preview is available here.'); photoPreview = undefined"
          >
            Open Photos
          </button>
        </template>
        <template v-else-if="linkPreview">
          <div class="link-large">
            <ControlIcon name="link" />
          </div>
          <h3>
            {{ linkTitle(linkPreview) }}
          </h3>
          <p class="link-url">
            {{ linkPreview }}
          </p>
          <a
            v-hover
            class="vk-button primary"
            :href="linkPreview"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open shared link in a new tab"
          >
            Open in browser <ControlIcon name="arrow" />
          </a>
        </template>
      </section>
    </div>
    <div v-if="screenEffect" class="screen-effect" :class="screenEffect" aria-hidden="true">
      <i
        v-for="i in (screenEffect === 'confetti' ? 42 : 12)"
        :key="i"
        :style="{ '--i': i, '--left': ((i * 23) % 100) + '%', '--hue': (i * 47) % 360 }"
      />
    </div>
    <div v-if="call && callModal" class="call-backdrop" aria-hidden="true" />
    <section v-if="call" class="persona-call vk-sheet" role="dialog" :aria-modal="callModal ? true : undefined"
      :inert="modalOpen || details ? true : undefined" aria-label="Pretend FaceTime call"
      @keydown.esc.stop.prevent="endCall" @keydown="callModal && trapFocus($event)">
      <div class="call-heading">
        <strong>
          {{ callName }}
        </strong>
        <small>
          Drawn Persona · {{ callTime() }}
        </small>
      </div>
      <svg
        class="persona"
        viewBox="0 0 240 240"
        role="img"
        aria-label="Friendly drawn Persona with a feathered silhouette"
      >
        <defs>
          <linearGradient :id="fadeId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="white"/>
            <stop offset=".75" stop-color="white" stop-opacity=".8"/>
            <stop offset="1" stop-color="white" stop-opacity="0"/>
          </linearGradient>
          <mask :id="maskId">
            <rect width="240" height="240" :fill="'url(#' + fadeId + ')'"/>
          </mask>
        </defs>
        <g :mask="'url(#' + maskId + ')'">
          <path d="M37 245q4-88 83-92 79 4 83 92" fill="#728ad1" fill-opacity=".5"/>
          <path d="M104 137v30q16 15 32 0v-30" fill="#d6b5a7"/>
          <ellipse cx="120" cy="98" rx="49" ry="58" fill="#e3c5b3"/>
          <path d="M72 96q-10-68 50-69 54 4 51 65l-13-25q-35 10-65-8l-17 43" fill="#544b55"/>
          <path
            d="M89 97q9-5 17 0m28 0q9-5 17 0"
            stroke="#534952"
            stroke-width="4"
            stroke-linecap="round"
            fill="none"
          />
          <path d="M106 125q14 13 28 0" stroke="#a87572" stroke-width="3" stroke-linecap="round" fill="none"/>
          <path d="M91 183q29 22 58 0" stroke="#c3d3ff" stroke-opacity=".6" stroke-width="2" fill="none"/>
        </g>
      </svg>
      <p>
        {{ muted ? 'Microphone muted, virtually.' : 'The duck is listening with its entire rubber head.' }}
      </p>
      <div class="call-controls">
        <button
          v-hover
          class="vk-icon large"
          :aria-label="muted ? 'Unmute pretend microphone' : 'Mute pretend microphone'"
          :aria-pressed="muted"
          @click="muted = !muted"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3"/>
            <path d="M6 11v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6"/>
            <path v-if="muted" d="m3 3 18 18"/>
          </svg>
        </button>
        <button
          v-hover
          class="vk-icon large end-call"
          aria-label="End pretend FaceTime call"
          @click="endCall"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 14q9-10 18 0l-3 3-4-3v-3h-4v3l-4 3z"/>
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped src="./messages/messages.css"></style>
