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
    } else close();
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

// Presentation only: reveal link controls without touching playback state.
const expanded = ref(false);
watch(() => music.value.open, () => { expanded.value = false; });
</script>
<template>
  <aside
    v-if="music.open"
    class="record-panel"
    :class="{ 'is-expanded': expanded && !compact }"
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
      <div v-show="!compact" class="turntable" :class="{ running: music.playing }" aria-hidden="true">
        <div class="platter"><div class="vinyl"><span class="record-label"></span></div></div>
      </div>
      <div class="track-copy">
        <div class="wordmark"><span class="signal" :class="{ live: music.playing }" aria-hidden="true"></span>OFF THE CLOCK<span class="edition">01</span></div>
        <h2 :title="title">{{ title }}</h2>
        <p>{{ current ? current.kind === "audio" ? "YOUR AUDIO" : current.kind.toUpperCase() : "THE ROOM SELECTOR" }}</p>
      </div>
      <button type="button" @click="close" aria-label="Close record player and stop playback">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </header>
    <div class="transport">
      <button type="button" @click="compact = !compact" :aria-label="compact ? 'Expand record player' : 'Minimize music controls'" :aria-expanded="!compact" aria-controls="music-secondary">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="compact ? 'm8 10 4 4 4-4M6 4h12' : 'm8 14 4-4 4 4M6 20h12'" /></svg>
      </button>
      <button class="play-button" type="button" @click="music.playing ? pause() : play()" :disabled="busy" :aria-label="music.playing ? 'Pause music' : 'Play music'">
        <svg v-if="music.playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z" /></svg>
      </button>
      <button type="button" class="source-button" @click="expanded = compact || !expanded; compact = false" :aria-expanded="expanded && !compact" aria-controls="music-secondary" aria-label="Show or hide music link controls" :class="{ selected: expanded && !compact }">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" /></svg>
      </button>
    </div>
    <p id="music-message" class="message" :class="{ error }" role="status">
      <span class="level" :class="{ active: music.playing }" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span>{{ error || status || (music.playing ? "Playing" : "Ready when you are.") }}</span>
    </p>
    <div id="music-secondary" v-show="!compact && expanded" class="player-secondary">
      <form @submit.prevent="submit">
        <label for="music-link">Make it your soundtrack.<span>PASTE A LINK</span></label>
        <div class="link-row">
          <input id="music-link" v-model="input" type="url" placeholder="Song, mix, or a good conversation…" autocomplete="off" spellcheck="false" required :aria-invalid="!!error" aria-describedby="music-message" />
          <button type="submit" :disabled="busy" aria-label="Play music link" :aria-busy="busy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 11 7-11 7z" /></svg></button>
        </div>
        <p class="services">YouTube <i>·</i> Spotify <i>·</i> Audio files</p>
      </form>
      <footer v-if="current">
        <button type="button" @click="roomRadio"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h11a6 6 0 0 1 0 12M3 10l5-5M3 10l5 5" /></svg>Room radio</button>
        <a :href="current.url" target="_blank" rel="noopener noreferrer">Open original<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg></a>
      </footer>
      <p v-if="current?.kind === 'spotify' && !compact" class="service-note">Spotify controls full playback and previews. Some tracks need a sign-in.</p>
    </div>
    <div v-if="current?.kind === 'youtube' || current?.kind === 'spotify'" ref="mount" class="provider-player" :class="current.kind" :key="current.url"></div>
    <audio v-if="current?.kind === 'audio'" ref="audio" :src="current.url" controls preload="metadata" @playing="playing(true)" @pause="playing(false)" @ended="playing(false)" @error="error = 'This audio link is unavailable or does not allow playback here.'" />
  </aside>
</template>
<style scoped>
.record-panel {
  --ink: #14110e;
  --paper: #f1e9dc;
  --brass: #d2bd94;
  --dim: #b8aa96;
  --keyboard-inset: max(0px, calc(100dvh - var(--visual-height, 100dvh) - var(--visual-top, 0px)));
  --player-bottom: calc(90px + env(safe-area-inset-bottom) + var(--keyboard-inset));
  position: fixed;
  z-index: 70;
  right: max(clamp(16px, 4vw, 64px), env(safe-area-inset-right));
  bottom: var(--player-bottom);
  width: min(388px, calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right)));
  max-height: calc(var(--visual-height, 100dvh) - 130px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  box-sizing: border-box;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 20px;
  color: var(--paper);
  background: rgb(20 17 14 / .86);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgb(255 255 255 / .12);
  border-radius: 24px;
  box-shadow: 0 24px 64px rgb(0 0 0 / .32), inset 0 1px 0 rgb(255 255 255 / .04);
  pointer-events: auto;
  scrollbar-width: thin;
  scrollbar-color: #75654d transparent;
  color-scheme: dark;
}
header { position: sticky; top: 0; z-index: 2; background: rgb(20 17 14 / .96); border-radius: 12px; display: flex; align-items: center; gap: 12px; }
.track-copy { flex: 1; min-width: 0; }
.wordmark { display: flex; align-items: center; gap: 8px; color: var(--dim); font-size: 8px; line-height: 1.5; letter-spacing: .12em; }
.edition { color: var(--brass); font-variant-numeric: tabular-nums; }
.signal { width: 4px; height: 4px; flex-shrink: 0; border-radius: 50%; background: var(--dim); }
.signal.live { background: #ff5a4f; box-shadow: 0 0 0 3px rgb(255 90 79 / .12); }
.track-copy h2 { margin: 4px 0; font-size: 20px; line-height: 1.2; font-weight: 500; letter-spacing: -.03em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.track-copy p { margin: 0; color: var(--dim); font-size: 9px; line-height: 1.5; letter-spacing: .1em; }
.turntable { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
.platter { position: absolute; inset: 0; border: 1px solid rgb(210 189 148 / .4); border-radius: 50%; padding: 3px; }
.vinyl { display: grid; place-items: center; height: 100%; border-radius: 50%; background: repeating-radial-gradient(circle, #14110e 0 2px, #393129 2px 3px); animation: spin 5s linear infinite; animation-play-state: paused; }
.vinyl::before { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: conic-gradient(transparent 20%, rgb(241 233 220 / .12) 27%, transparent 35% 70%, rgb(241 233 220 / .12) 77%, transparent 85%); }
.record-label { width: 16px; height: 16px; border: 6px solid var(--brass); border-radius: 50%; background: var(--ink); }
.running .vinyl { animation-play-state: running; }
button, footer a { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 44px; min-height: 44px; flex-shrink: 0; border: 0; border-radius: 50%; color: var(--brass); background: transparent; cursor: pointer; transition: background 200ms ease-out, color 200ms ease-out, transform 200ms ease-out; }
button svg, a svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
button:hover, footer a:hover, .source-button.selected { background: rgb(210 189 148 / .1); color: var(--paper); }
button:active, footer a:active { transform: scale(.96); }
button:disabled { opacity: .5; cursor: wait; }
button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid var(--brass); outline-offset: 3px; }
.transport { display: flex; align-items: center; justify-content: center; gap: 28px; margin: 16px 0 12px; }
.play-button { width: 60px; height: 60px; color: var(--ink); background: var(--brass); box-shadow: 0 4px 20px rgb(210 189 148 / .14), inset 0 1px 0 rgb(255 255 255 / .35); }
.play-button:hover { background: #e4cfa6; color: var(--ink); }
.play-button svg { width: 24px; height: 24px; }
.message { display: flex; align-items: center; gap: 8px; min-height: 20px; margin: 0; font-size: 11px; line-height: 1.5; color: var(--dim); }
.message.error { color: var(--brass); }
.level { display: flex; align-items: center; justify-content: center; gap: 2px; height: 16px; width: 20px; flex-shrink: 0; }
.level i { width: 3px; height: 12px; border-radius: 2px; background: var(--brass); transform: scaleY(.25); }
.level.active i { animation: meter 800ms ease-in-out infinite alternate; }
.level.active i:nth-child(2) { animation-delay: -300ms; }
.level.active i:nth-child(3) { animation-delay: -600ms; }
.level.active i:nth-child(4) { animation-delay: -150ms; }
.player-secondary { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgb(255 255 255 / .08); }
label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; font-size: 12px; line-height: 1.5; }
label > span { font-size: 8px; letter-spacing: .08em; color: var(--dim); }
.link-row { display: flex; align-items: center; padding: 4px; border: 1px solid rgb(210 189 148 / .2); border-radius: 12px; background: rgb(0 0 0 / .16); }
.link-row input { width: 0; min-width: 0; flex: 1; min-height: 44px; padding: 8px; font-size: 16px; color: var(--paper); background: transparent; border: 0; border-radius: 8px; user-select: text; }
.link-row input::placeholder { color: var(--dim); }
.services { display: flex; gap: 8px; margin: 8px 0 0; color: var(--dim); font-size: 10px; line-height: 1.6; }
.services i { color: var(--brass); font-style: normal; }
footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 11px; }
footer button, footer a { border-radius: 8px; padding: 0 8px; }
footer a { text-decoration: underline; text-underline-offset: 4px; }
footer svg { width: 16px; height: 16px; }
.service-note { margin: 8px 0 0; color: var(--dim); font-size: 11px; line-height: 1.6; }
.provider-player { overflow: hidden; border: 1px solid rgb(255 255 255 / .08); border-radius: 12px; min-height: 152px; margin-top: 16px; background: var(--ink); }
.provider-player.youtube { min-height: 202px; }
.provider-player :deep(iframe) { display: block; width: 100%; border: 0; }
audio { display: block; width: 100%; margin-top: 16px; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes meter { to { transform: scaleY(1); } }
/* Leave room for the mobile navigation, safe areas, and software keyboard. */
@media (max-width: 639px) {
  .record-panel { --player-bottom: calc(82px + env(safe-area-inset-bottom) + var(--keyboard-inset)); left: max(12px, env(safe-area-inset-left)); right: auto; width: calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)); padding: 16px; max-height: calc(var(--visual-height, 100dvh) - 170px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
}
@media (max-width: 519px) {
  .record-panel { max-height: min(calc(var(--visual-height, 100dvh) * .34), calc(var(--visual-height, 100dvh) - 170px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); }
  .record-panel.is-expanded { max-height: calc(var(--visual-height, 100dvh) - 170px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
  .transport { margin: 12px 0 8px; }
  .player-secondary, .provider-player, audio { display: none; }
  .is-expanded .player-secondary, .is-expanded .provider-player, .is-expanded audio { display: block; }
  label { flex-wrap: wrap; }
}
@media (max-width: 480px) { .wordmark { letter-spacing: .08em; } }
/* Short viewports preserve usable controls by removing decorative artwork. */
@media (max-height: 620px) {
  .record-panel { --player-bottom: calc(62px + env(safe-area-inset-bottom) + var(--keyboard-inset)); max-height: calc(var(--visual-height, 100dvh) - 150px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
  .turntable { display: none; }
}
@media (max-height: 620px) and (max-width: 639px) { .record-panel { --player-bottom: calc(82px + env(safe-area-inset-bottom) + var(--keyboard-inset)); max-height: calc(var(--visual-height, 100dvh) - 170px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); } }
@media (max-height: 620px) and (max-width: 519px) { .record-panel:not(.is-expanded) { max-height: min(calc(var(--visual-height, 100dvh) * .34), calc(var(--visual-height, 100dvh) - 170px - env(safe-area-inset-top) - env(safe-area-inset-bottom))); } }
@media (max-height: 500px) and (min-width: 640px) { .record-panel { --player-bottom: calc(64px + env(safe-area-inset-bottom) + var(--keyboard-inset)); max-height: calc(var(--visual-height, 100dvh) - 152px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); } }
@media (prefers-reduced-motion: reduce) {
  .vinyl, .level.active i { animation: none; }
  .level.active i { transform: scaleY(.7); }
  button, footer a { transition: none; }
  button:active, footer a:active { transform: none; }
}
</style>
