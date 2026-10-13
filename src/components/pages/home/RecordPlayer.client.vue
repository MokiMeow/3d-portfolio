<script setup lang="ts">
import { HomeExperience } from "~/experiences/home";
import {
  initialMusicState,
  type MusicState,
} from "~/common/models/music.model";
import { parseMusicLink, type MusicLink } from "~/utils/music-link";
import {
  loadYouTube,
  loadSpotify,
  type YouTubePlayer,
  type SpotifyPlayer,
} from "~/utils/music-providers";
const music = useState<MusicState>("labMusic", initialMusicState);
const muted = useState<boolean>("isSoundMuted");
const route = useRoute();
const input = ref(""),
  error = ref(""),
  status = ref(""),
  title = ref("Room radio");
const current = ref<MusicLink | null>(null),
  compact = ref(false),
  busy = ref(false);
const mount = ref<HTMLElement>(),
  linkInput = ref<HTMLInputElement>(),
  audio = ref<HTMLAudioElement>();
let youtube: YouTubePlayer | undefined,
  spotify: SpotifyPlayer | undefined,
  request = 0;
let loadTimer: ReturnType<typeof setTimeout> | undefined;
const sound = () => new HomeExperience().sound;
const playing = (value: boolean) => {
  if (value && current.value && sound()?.isMuted) sound()?.useExternalMusic();
  music.value.playing = value;
  if (value) {
    busy.value = false;
    status.value = "Playing";
  } else if (!busy.value) status.value = "Paused";
};
const pause = () => {
  youtube?.pauseVideo();
  spotify?.pause();
  audio.value?.pause();
  sound()?.pauseMusic();
  playing(false);
};
const destroy = () => {
  ++request;
  clearTimeout(loadTimer);
  youtube?.destroy();
  spotify?.destroy();
  youtube = undefined;
  spotify = undefined;
  audio.value?.pause();
  busy.value = false;
};
const close = () => {
  pause();
  destroy();
  current.value = null;
  sound()?.useRoomMusic();
  music.value.open = false;
  title.value = "Room radio";
};
const play = () => {
  error.value = "";
  if (current.value) sound()?.useExternalMusic();
  if (current.value?.kind === "youtube") youtube?.playVideo();
  else if (current.value?.kind === "spotify") spotify?.play();
  else if (current.value?.kind === "audio")
    void audio.value?.play().catch(() => {
      status.value = "Tap play to start.";
    });
  else void sound()?.startFromGesture();
};
const roomRadio = () => {
  destroy();
  current.value = null;
  title.value = "Room radio";
  error.value = "";
  sound()?.useRoomMusic();
  void sound()?.startFromGesture();
};
async function submit() {
  const parsed = parseMusicLink(input.value);
  if (!parsed) {
    error.value =
      "Paste a YouTube video, Spotify song / podcast, or a direct HTTPS audio link.";
    return;
  }
  pause();
  destroy();
  const version = ++request;
  current.value = parsed;
  compact.value = false;
  error.value = "";
  status.value = "Loading player…";
  busy.value = true;
  loadTimer = setTimeout(() => {
    if (version === request && busy.value) {
      busy.value = false;
      status.value =
        "The service is taking longer. Tap its player, try another link, or open the original.";
    }
  }, 20000);
  title.value =
    parsed.kind === "spotify"
      ? "Your Spotify selection"
      : parsed.kind === "youtube"
        ? "Your YouTube selection"
        : "Your audio";
  sound()?.useExternalMusic();
  await nextTick();
  try {
    if (parsed.kind === "audio") {
      busy.value = false;
      await audio.value?.play();
      return;
    }
    const api =
      parsed.kind === "youtube" ? await loadYouTube() : await loadSpotify();
    if (version !== request || !mount.value) return;
    const target = document.createElement("div");
    mount.value.replaceChildren(target);
    if (parsed.kind === "youtube") {
      youtube = new (api as Awaited<ReturnType<typeof loadYouTube>>).Player(
        target,
        {
          width: "100%",
          height: "202",
          videoId: parsed.id,
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            origin: window.location.origin,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (version !== request) return;
              busy.value = false;
              status.value = "Tap play if playback does not start.";
              youtube?.playVideo();
            },
            onStateChange: (e: { data: number }) => {
              if (version !== request) return;
              playing(e.data === 1);
              if (e.data === 3) status.value = "Buffering…";
              if (e.data === 0) status.value = "Finished";
              const name = youtube?.getVideoData().title;
              if (name) title.value = name;
            },
            onAutoplayBlocked: () => {
              if (version === request) {
                busy.value = false;
                status.value = "Tap the player to start.";
              }
            },
            onError: () => {
              if (version === request) {
                busy.value = false;
                playing(false);
                error.value =
                  "This video cannot play here. Try another link or open it on YouTube.";
              }
            },
          },
        },
      );
    } else {
      (api as Awaited<ReturnType<typeof loadSpotify>>).createController(
        target,
        { uri: parsed.id, width: "100%", height: 152, theme: "dark" },
        (player) => {
          if (version !== request) {
            player.destroy();
            return;
          }
          spotify = player;
          player.addListener("ready", () => {
            if (version !== request) return;
            busy.value = false;
            status.value = "Tap play if playback does not start.";
            player.play();
          });
          player.addListener("playback_update", (event) => {
            if (version !== request) return;
            playing(!event.data.isPaused && !event.data.isBuffering);
            if (event.data.isBuffering) status.value = "Buffering…";
          });
        },
      );
    }
  } catch (e) {
    if (version !== request) return;
    busy.value = false;
    playing(false);
    error.value =
      e instanceof Error
        ? e.message
        : "Playback could not start. Use the player’s play button.";
  }
}
watch(
  () => music.value.open,
  async (open) => {
    if (open) {
      compact.value = false;
      await nextTick();
      linkInput.value?.focus();
    } else if (current.value) close();
  },
);
watch(muted, (value) => {
  if (value) pause();
});
watch(
  () => music.value.playing,
  (value) => {
    if (!current.value) status.value = value ? "Playing" : "Paused";
  },
);
watch(
  () => route.path,
  () => {
    if (music.value.open) close();
  },
);
onBeforeUnmount(() => {
  pause();
  destroy();
  music.value.open = false;
});
</script>
<template>
  <aside
    v-if="music.open"
    class="record-panel"
    aria-label="Record player"
    @pointerdown.stop
    @pointerup.stop
    @pointermove.stop
    @mousedown.stop
    @mouseup.stop
    @mousemove.stop
    @wheel.stop
    @touchstart.stop
    @touchmove.stop
    @keydown.esc="close"
  >
    <header>
      <div>
        <p>AFTER HOURS / 33⅓</p>
        <h2>{{ title }}</h2>
      </div>
      <button
        @click="compact = !compact"
        :aria-label="
          compact ? 'Show music link input' : 'Minimize music controls'
        "
      >
        {{ compact ? "+" : "−" }}</button
      ><button
        @click="close"
        aria-label="Close record player and stop playback"
      >
        ×
      </button>
    </header>
    <form v-show="!compact" @submit.prevent="submit">
      <label for="music-link">Put something good on.</label>
      <div class="link-row">
        <input
          ref="linkInput"
          id="music-link"
          v-model="input"
          type="url"
          placeholder="Paste a song or podcast link"
          autocomplete="off"
          spellcheck="false"
          required
          :aria-invalid="!!error"
          aria-describedby="music-message"
        /><button type="submit" :disabled="busy">
          {{ busy ? "…" : "Play ↗" }}
        </button>
      </div>
      <p class="services">YouTube · Spotify · Audio files</p>
    </form>
    <div
      v-if="current?.kind === 'youtube' || current?.kind === 'spotify'"
      ref="mount"
      class="provider-player"
      :class="current.kind"
      :key="current.url"
    ></div>
    <audio
      v-if="current?.kind === 'audio'"
      ref="audio"
      :src="current.url"
      controls
      preload="metadata"
      @playing="playing(true)"
      @pause="playing(false)"
      @ended="playing(false)"
      @error="
        error =
          'This audio link is unavailable or does not allow playback here.'
      "
    />
    <div v-if="!current" class="radio-art" aria-hidden="true">
      <div class="mini-record" :class="{ spinning: music.playing }">
        <i></i>
      </div>
      <span>A little room<br />for good music.</span>
    </div>
    <p id="music-message" class="message" :class="{ error }" role="status">
      {{
        error || status || (music.playing ? "Playing" : "Ready when you are.")
      }}
    </p>
    <footer>
      <button @click="music.playing ? pause() : play()" :disabled="busy">
        {{ music.playing ? "Ⅱ Pause" : "▷ Play" }}</button
      ><button v-if="current" @click="roomRadio">Room radio</button
      ><a
        v-if="current"
        :href="current.url"
        target="_blank"
        rel="noopener noreferrer"
        >Open original ↗</a
      >
    </footer>
    <p v-if="current?.kind === 'spotify' && !compact" class="service-note">
      Spotify controls full playback and previews. Some tracks need a sign-in.
    </p>
  </aside>
</template>
<style scoped>
.record-panel {
  position: fixed;
  z-index: 45;
  right: clamp(16px, 4vw, 64px);
  bottom: 90px;
  width: min(360px, calc(100vw - 32px));
  padding: 20px;
  color: #e9e3d6;
  background: #242522;
  border: 1px solid #aaa18b45;
  border-radius: 18px;
  box-shadow: 0 18px 70px #0006;
  font-family: inherit;
  pointer-events: auto;
}
header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
header > div {
  flex: 1;
  min-width: 0;
}
header p {
  font: 9px monospace;
  letter-spacing: 0.17em;
  color: #c2a878;
  margin-bottom: 7px;
}
h2 {
  font-size: 17px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}
button {
  border-radius: 7px;
  padding: 8px;
  transition:
    background 0.16s,
    transform 0.16s;
}
button:hover {
  background: #ffffff12;
}
button:active {
  transform: scale(0.97);
}
button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 2px solid #cdb282;
  outline-offset: 3px;
}
button:disabled {
  opacity: 0.5;
}
header > button {
  font-size: 21px;
  line-height: 1;
  padding: 5px 7px;
}
form {
  margin-top: 21px;
}
label {
  display: block;
  font-size: 13px;
  margin-bottom: 10px;
}
.link-row {
  display: flex;
  background: #151713;
  border: 1px solid #ffffff24;
  border-radius: 9px;
  padding: 4px;
}
.link-row input {
  width: 0;
  flex: 1;
  padding: 8px;
  font-size: 12px;
  background: transparent;
  outline: none;
}
.link-row button {
  background: #dbc8a5;
  color: #282820;
  font-size: 12px;
  white-space: nowrap;
}
.services,
.service-note {
  font-size: 10px;
  color: #b1afa4;
  line-height: 1.55;
  margin-top: 9px;
}
.provider-player {
  margin-top: 16px;
  overflow: hidden;
  border-radius: 9px;
  min-height: 152px;
}
.provider-player.youtube {
  min-height: 202px;
}
.provider-player :deep(iframe) {
  display: block;
  width: 100%;
  border: 0;
}
audio {
  width: 100%;
  margin-top: 18px;
}
.message {
  font-size: 11px;
  color: #aaa99c;
  margin-top: 13px;
  line-height: 1.5;
}
.message.error {
  color: #eeb493;
}
footer {
  display: flex;
  align-items: center;
  gap: 5px;
  border-top: 1px solid #ffffff16;
  margin-top: 13px;
  padding-top: 9px;
  font-size: 11px;
}
footer a {
  margin-left: auto;
  color: #c7c0af;
}
.radio-art {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 12px 8px;
}
.radio-art span {
  font:
    italic 19px/1.3 Georgia,
    serif;
  color: #c8b897;
}
.mini-record {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: repeating-radial-gradient(
    #161713 0 2px,
    #34362e 3px,
    #161713 4px
  );
  display: grid;
  place-items: center;
  border: 2px solid #393c34;
}
.mini-record i {
  display: block;
  width: 25px;
  height: 25px;
  border: 9px solid #b96f4d;
  border-radius: 50%;
  background: #ddd4b7;
}
.spinning {
  animation: record-spin 3s linear infinite;
}
@keyframes record-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinning {
    animation: none;
  }
}
@media (max-height: 620px) {
  .record-panel {
    bottom: 60px;
    max-height: calc(100dvh - 80px);
    overflow: auto;
  }
}
@media (max-width: 480px) {
  .record-panel {
    bottom: 100px;
  }
  .link-row input {
    font-size: 16px;
  }
}
</style>
