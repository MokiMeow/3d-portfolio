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
      // Do not open the phone keyboard until the listener chooses the link field.
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
      <div class="wordmark">
        <span class="signal" :class="{ live: music.playing }"></span>OFF THE
        CLOCK<span class="edition">01</span>
      </div>
      <button
        @click="compact = !compact"
        :aria-label="
          compact ? 'Expand record player' : 'Minimize music controls'
        "
      >
        {{ compact ? "+" : "−" }}
      </button>
      <button @click="close" aria-label="Close record player and stop playback">
        ×
      </button>
    </header>
    <div
      v-if="!current"
      v-show="!compact"
      class="turntable"
      :class="{ running: music.playing }"
      aria-hidden="true"
    >
      <span class="deck-mark">STEREO / HIGH FIDELITY</span>
      <div class="platter">
        <div class="vinyl">
          <div class="record-label">
            <small>MOHITH LAB</small><strong>After<br />hours.</strong
            ><span>33⅓ &nbsp; / &nbsp; SIDE A</span><i></i>
          </div>
        </div>
      </div>
      <div class="tonearm"><i></i></div>
      <span class="deck-speed">33<span>●</span>45</span>
    </div>
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
    <div class="transport">
      <div class="track-copy">
        <p>
          {{
            current
              ? current.kind === "audio"
                ? "YOUR AUDIO"
                : current.kind.toUpperCase()
              : "THE ROOM SELECTOR"
          }}
        </p>
        <h2 :title="title">{{ title }}</h2>
        <span>{{
          current ? "Your soundtrack. Your pace." : "Warm beats. No hurry."
        }}</span>
      </div>
      <button
        class="play-button"
        @click="music.playing ? pause() : play()"
        :disabled="busy"
        :aria-label="music.playing ? 'Pause music' : 'Play music'"
      >
        <svg v-if="music.playing" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 5 11 7-11 7z" />
        </svg>
      </button>
    </div>
    <p id="music-message" class="message" :class="{ error }" role="status">
      <span class="level" :class="{ active: music.playing }" aria-hidden="true"
        ><i></i><i></i><i></i><i></i></span
      >{{
        error || status || (music.playing ? "Playing" : "Ready when you are.")
      }}
    </p>
    <form v-show="!compact" @submit.prevent="submit">
      <label for="music-link"
        >Make it your soundtrack.<span>PASTE A LINK</span></label
      >
      <div class="link-row">
        <input
          id="music-link"
          v-model="input"
          type="url"
          placeholder="Song, mix, or a good conversation…"
          autocomplete="off"
          spellcheck="false"
          required
          :aria-invalid="!!error"
          aria-describedby="music-message"
        /><button type="submit" :disabled="busy" aria-label="Play music link">
          {{ busy ? "…" : "↗" }}
        </button>
      </div>
      <p class="services">YouTube <i>·</i> Spotify <i>·</i> Audio files</p>
    </form>
    <footer v-if="current">
      <button @click="roomRadio">↶ Room radio</button
      ><a :href="current.url" target="_blank" rel="noopener noreferrer"
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
  width: min(370px, calc(100vw - 32px));
  max-height: calc(100dvh - 130px);
  overflow: auto;
  padding: 20px;
  color: #30352e;
  background: #eee9df;
  border: 1px solid #fff8;
  border-radius: 18px;
  box-shadow:
    0 24px 75px #0005,
    0 2px 5px #0002;
  font-family: inherit;
  pointer-events: auto;
  scrollbar-width: thin;
}
header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 17px;
}
.wordmark {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  font-size: 10px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: 0.12em;
}
.edition {
  font: 10px monospace;
  color: #8c8b7b;
  letter-spacing: 0;
  margin-left: 4px;
}
.signal {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #939589;
}
.signal.live {
  background: #70894d;
  box-shadow: 0 0 0 3px #70894d18;
}
button {
  border-radius: 50%;
  transition:
    background 0.18s,
    transform 0.18s;
  cursor: pointer;
}
button:hover {
  background: #343b3010;
}
button:active {
  transform: scale(0.96);
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
header > button {
  width: 32px;
  height: 32px;
  font-size: 22px;
  line-height: 1;
  background: #dfdbd2;
}
button:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 2px solid #56684b;
  outline-offset: 4px;
}
.turntable {
  height: 212px;
  position: relative;
  overflow: hidden;
  border: 1px solid #b4b6a5;
  border-radius: 10px;
  background: linear-gradient(135deg, #bac0ac, #d3d5c6 58%, #aab09e);
  box-shadow:
    inset 0 1px 0 #ffffff9c,
    inset 0 -2px 4px #69725c26;
}
.deck-mark {
  position: absolute;
  left: 14px;
  top: 12px;
  font: 7px monospace;
  letter-spacing: 0.14em;
  color: #5b654f;
}
.platter {
  position: absolute;
  width: 180px;
  height: 180px;
  left: 29px;
  top: 23px;
  background: #878e7f;
  border: 3px solid #454b42;
  border-radius: 50%;
  box-shadow:
    2px 5px 8px #3035265a,
    inset 0 0 0 2px #c8c9b5;
}
.vinyl {
  position: absolute;
  inset: 3px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: repeating-radial-gradient(
    circle,
    #1c211c 0 1px,
    #30372c 1.4px 2px,
    #1d231d 2.8px 3.3px
  );
  animation: spin 4s linear infinite;
  animation-play-state: paused;
}
.vinyl:before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 40deg,
    transparent 0 10%,
    #d2dac620 17%,
    transparent 27% 60%,
    #d2dac61c 67%,
    transparent 79%
  );
}
.running .vinyl {
  animation-play-state: running;
}
.record-label {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  width: 78px;
  height: 78px;
  border-radius: 50%;
  color: #363e31;
  background: #cbb68e;
  border: 1px solid #f2dbae;
  box-shadow: 0 0 0 5px #141b1680;
}
.record-label small {
  font: 5px monospace;
  letter-spacing: 0.12em;
  margin-bottom: 4px;
}
.record-label strong {
  font:
    italic 20px/0.87 Georgia,
    serif;
  letter-spacing: -1px;
  text-align: center;
}
.record-label span {
  font: 5px monospace;
  margin-top: 6px;
}
.record-label i {
  position: absolute;
  top: 37px;
  left: 37px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #b7bbb1;
  border: 1px solid #3a3e36;
}
.tonearm {
  position: absolute;
  left: 264px;
  top: 34px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: radial-gradient(#454c42 0 4px, #bdc2b6 5px 7px, #6b7565 8px);
  box-shadow: 1px 2px 3px #0004;
  transform: rotate(-9deg);
  transition: transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
}
.tonearm:before {
  content: "";
  position: absolute;
  left: 5px;
  top: 9px;
  width: 5px;
  height: 128px;
  border: 1px solid #8c9787;
  background: linear-gradient(90deg, #899681, #edf0df, #a9b3a0);
  box-shadow: 2px 3px 3px #35432b40;
}
.tonearm i {
  position: absolute;
  left: 0;
  top: 127px;
  width: 16px;
  height: 26px;
  background: linear-gradient(90deg, #313a2d, #505c47);
  border-radius: 2px;
  box-shadow: 1px 2px 2px #0004;
}
.running .tonearm {
  transform: rotate(36deg);
}
.deck-speed {
  position: absolute;
  right: 14px;
  bottom: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  font: 7px monospace;
  color: #535f49;
}
.deck-speed span {
  color: #6c814e;
  font-size: 5px;
}
.transport {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 0 10px;
}
.track-copy {
  flex: 1;
  min-width: 0;
}
.track-copy p {
  font: 8px monospace;
  letter-spacing: 0.14em;
  color: #787d6e;
  margin: 0 0 6px;
}
.track-copy h2 {
  font-size: 23px;
  line-height: 1.15;
  font-weight: 500;
  letter-spacing: -0.045em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-copy > span {
  display: block;
  font-size: 11px;
  color: #7e8175;
  margin-top: 6px;
}
.play-button {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  background: #344331;
  color: #edeedf;
  box-shadow: 0 2px 4px #25332426;
}
.play-button:hover {
  background: #536447;
}
.play-button svg {
  width: 24px;
  height: 24px;
  fill: currentColor;
}
.message {
  min-height: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  line-height: 1.5;
  color: #777e6c;
  margin: 3px 0 17px;
}
.message.error {
  color: #9d452f;
}
.level {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 12px;
}
.level i {
  width: 2px;
  height: 3px;
  background: #7d8c6a;
}
.level.active i {
  animation: meter 1s ease-in-out infinite alternate;
}
.level.active i:nth-child(2) {
  animation-delay: -0.3s;
}
.level.active i:nth-child(3) {
  animation-delay: -0.8s;
}
.level.active i:nth-child(4) {
  animation-delay: -0.5s;
}
form {
  border-top: 1px solid #d6d5c8;
  padding-top: 16px;
}
label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 10px;
}
label > span {
  font: 7px monospace;
  letter-spacing: 0.1em;
  color: #969888;
}
.link-row {
  display: flex;
  background: #f8f5ef;
  border: 1px solid #d6d6ca;
  border-radius: 9px;
  padding: 4px;
}
.link-row input {
  width: 0;
  min-width: 0;
  flex: 1;
  padding: 8px;
  font-size: 12px;
  background: transparent;
  color: #30392a;
  user-select: text;
}
.link-row input::placeholder {
  color: #79806f;
}
.link-row button {
  border-radius: 6px;
  width: 36px;
  height: 36px;
  background: #dbdfcf;
  font-size: 23px;
  line-height: 1;
  color: #48583c;
}
.services {
  font-size: 9px;
  color: #8b9080;
  margin-top: 9px;
  display: flex;
  gap: 8px;
}
.services i {
  font-style: normal;
  color: #b4b8aa;
}
.provider-player {
  overflow: hidden;
  border-radius: 10px;
  min-height: 152px;
  background: #1c221b;
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
}
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  font-size: 10px;
}
footer button {
  padding: 4px 0;
  border-radius: 4px;
}
.service-note {
  font-size: 9px;
  color: #858a7d;
  line-height: 1.6;
  margin-top: 10px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes meter {
  to {
    height: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vinyl,
  .level.active i {
    animation: none;
  }
  .tonearm,
  button {
    transition: none;
  }
}
@media (max-width: 480px) {
  .record-panel {
    bottom: 98px;
    max-height: calc(100dvh - 122px);
    padding: 17px;
  }
  header > button {
    width: 40px;
    height: 40px;
  }
  .link-row input {
    font-size: 16px;
  }
  .turntable {
    height: 205px;
  }
  .platter {
    left: 20px;
  }
  .tonearm {
    left: 250px;
  }
}
@media (max-height: 620px) {
  .record-panel {
    bottom: 62px;
    max-height: calc(100dvh - 80px);
  }
  .turntable {
    display: none;
  }
}
</style>
