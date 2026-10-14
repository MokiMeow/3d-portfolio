<script setup lang="ts">
import type { Video } from "./catalogue";
import { avatarColor, verifiedChannel } from "./catalogue";
import YtIcon from "./YtIcon.vue";
import YtThumbnail from "./YtThumbnail.vue";
import { vHover } from "../kit/hover";

const props = defineProps<{ video: Video; progress?: number; query?: string; small?: boolean; removable?: boolean }>();
const emit = defineEmits<{
  play: [video: Video];
  channel: [name: string];
  queue: [video: Video];
  save: [video: Video];
  hide: [video: Video];
  remove: [video: Video];
}>();
const menu = ref(false);
const card = ref<HTMLElement>();
function highlighted(title: string): [string, string, string] {
  const query = props.query?.trim() ?? "";
  const index = query ? title.toLowerCase().indexOf(query.toLowerCase()) : -1;
  return index < 0 ? [title, "", ""] : [title.slice(0, index), title.slice(index, index + query.length), title.slice(index + query.length)];
}
const parts = computed(() => highlighted(props.video.title));
const channelParts = computed(() => highlighted(props.video.channel));
const categoryParts = computed(() => highlighted(props.video.category));
function glow(event: PointerEvent) {
  const rect = card.value?.getBoundingClientRect();
  if (!rect || !card.value) return;
  card.value.style.setProperty("--x", `${event.clientX - rect.left}px`);
  card.value.style.setProperty("--y", `${event.clientY - rect.top}px`);
}
function action(name: "queue" | "save" | "hide" | "remove") {
  if (name === "queue") emit("queue", props.video);
  if (name === "save") emit("save", props.video);
  if (name === "hide") emit("hide", props.video);
  if (name === "remove") emit("remove", props.video);
  menu.value = false;
}
</script>

<template>
  <article ref="card" class="yt-card vk-platter" :class="{ small }" @contextmenu.prevent="menu = true" @keydown.esc.stop="menu = false" @pointermove="glow"
    @focusout="event => { if (!card?.contains(event.relatedTarget as Node | null)) menu = false; }">
    <button v-hover class="preview" :aria-label="`Play ${video.title}`" @click="emit('play', video)">
      <YtThumbnail :id="video.id" :title="video.title" :duration="video.duration" :progress="progress" />
    </button>
    <div class="metadata">
      <button v-hover class="avatar" :style="{ background: avatarColor(video.channel) }"
        :aria-label="`Open ${video.channel} channel`" @click="emit('channel', video.channel)">{{ video.channel[0] }}</button>
      <div class="copy">
        <button v-hover class="title" :title="video.title" @click="emit('play', video)">
          {{ parts[0] }}<mark v-if="parts[1]">{{ parts[1] }}</mark>{{ parts[2] }}
        </button>
        <button v-hover class="channel" @click="emit('channel', video.channel)">
          <span>{{ channelParts[0] }}<mark v-if="channelParts[1]">{{ channelParts[1] }}</mark>{{ channelParts[2] }}</span>
          <YtIcon v-if="verifiedChannel(video.channel)" name="check" />
        </button>
        <p>{{ video.year || 'Pasted link' }} · {{ video.duration }}</p>
        <p v-if="categoryParts[1]">{{ categoryParts[0] }}<mark>{{ categoryParts[1] }}</mark>{{ categoryParts[2] }}</p>
      </div>
      <button v-hover class="more" aria-label="Video options" :aria-expanded="menu" @click="menu = !menu"><YtIcon name="more" /></button>
    </div>
    <div v-if="menu" class="options vk-sheet">
      <button v-hover @click="action('queue')"><YtIcon name="playlist" />Add to queue</button>
      <button v-hover @click="action('save')"><YtIcon name="later" />Save to Watch later</button>
      <button v-hover @click="action('hide')"><YtIcon name="close" />Not interested</button>
      <button v-hover v-if="removable" @click="action('remove')"><YtIcon name="close" />Remove from this list</button>
    </div>
  </article>
</template>

<style scoped>
.yt-card {
  position: relative;
  min-width: 0;
  border-radius: 20px;
  padding: 6px;
  color: #f1f1f1;
  font-family: Roboto, -apple-system, "Segoe UI", Arial, sans-serif;
  transition: transform 220ms ease;
  background: #0f0f0f;
}
.yt-card :deep(*) {
  font-family: inherit;
}
.yt-card:hover {
  transform: translateY(-3px);
  background: radial-gradient(180px at var(--x, 50%) var(--y, 50%), #ffffff10, transparent);
}
button {
  color: inherit;
  border: 0;
  background: none;
  font: inherit;
  cursor: pointer;
  text-align: left;
  padding: 0;
}
button:focus-visible {
  outline: 2px solid #8ecbff;
  outline-offset: 2px;
  border-radius: 8px;
}
.preview {
  display: block;
  width: 100%;
  border-radius: 16px;
}
.metadata {
  display: flex;
  gap: 10px;
  padding: 10px 0;
}
.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 50%;
  font-size: 18px;
}
.copy {
  min-width: 0;
  flex: 1;
}
.title {
  font-size: 16px;
  line-height: 22px;
  font-weight: 600;
  display: block;
  overflow-wrap: anywhere;
  min-height: 44px;
}
.channel {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  font-size: 13px;
  color: #aaa;
}
.channel :deep(svg) {
  width: 13px;
  height: 13px;
  flex-basis: 13px;
}
p {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: #aaa;
}
.more {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 50%;
}
.more:hover {
  background: #ffffff18;
}
mark {
  background: #dbc571;
  color: #151515;
  border-radius: 2px;
}
.options {
  position: absolute;
  right: 6px;
  top: 45%;
  z-index: 5;
  min-width: 224px;
  background: #282828;
  border: 1px solid #444;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 12px 30px #0009;
}
.options button {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
  padding: 0 12px;
  width: 100%;
  border-radius: 10px;
  font-size: 14px;
}
.options button:hover {
  background: #ffffff15;
}
.small {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.small .preview {
  width: 42%;
  flex-shrink: 0;
}
.small .metadata {
  flex: 1;
  padding: 0;
  gap: 2px;
}
.small .avatar {
  display: none;
}
.small .title {
  font-size: 14px;
  line-height: 20px;
}
.small .more {
  width: 44px;
}
.small .channel {
  font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .yt-card {
    transition: none;
  }
  .yt-card:hover {
    transform: none;
  }
}

button {
  transition: transform .22s ease-out, opacity .22s ease-out;
}
button:active {
  transform: scale(.97);
}
.channel {
  overflow-wrap: anywhere;
  text-align: left;
}
.options {
  min-width: min(224px, calc(100% - 12px));
  max-width: calc(100% - 12px);
}
.options button {
  padding-block: 8px;
}
@media (prefers-reduced-motion: reduce) {
  button { transition: none; }
  button:active { transform: none; }
}

.yt-card { background:#ffffff05; font-family:inherit; padding:0 0 10px; border-radius:20px; box-shadow:inset 0 0 0 1px #ffffff0a; }
.yt-card:hover { background:#ffffff0c; transform:translateY(-3px); }
.preview { border-radius:18px; overflow:hidden; }
.metadata { padding:10px 10px 0; gap:8px; }
.avatar { width:44px; height:44px; min-width:44px; font-size:13px; margin-top:5px; }
.title { font-size:13px; line-height:1.4; min-height:44px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.channel { font-size:11px; min-height:44px; margin-top:0; }
.copy>p { font-size:10px; margin:0; }
.more { flex:0 0 44px; }
.options { background:linear-gradient(145deg,#ffffff14,#ffffff05),#303943f5; border-radius:22px; border:1px solid #ffffff20; z-index:15; }
@container(max-height:560px) and (min-width:641px) { .metadata { padding-top:6px; gap:6px; } .avatar { display:none; } .title { font-size:12px; } .copy>p { display:none; } }
@container(max-width:640px) { .metadata { padding:8px 12px 0; } .title { font-size:13px; -webkit-line-clamp:2; } .channel { font-size:11px; min-height:44px; } .avatar { width:44px; height:44px; min-width:44px; } }

</style>
