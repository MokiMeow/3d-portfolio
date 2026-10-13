<script setup lang="ts">
import { loadYouTube, type YouTubePlayer } from "~/utils/music-providers";
import { HomeExperience } from "~/experiences/home";
const leftLens = ref<HTMLElement>(),
  rightLens = ref<HTMLElement>();
const started = ref(false),
  playing = ref(false),
  ready = ref(false),
  muted = ref(false);
const failed = ref(false);
const videoId = ref("dQw4w9WgXcQ");
const message = ref("Two lenses. One very familiar song.");
let players: YouTubePlayer[] = [],
  disposed = false,
  attempt = 0;
let syncTimer: ReturnType<typeof setInterval> | undefined;
let readyTimer: ReturnType<typeof setTimeout> | undefined;
const pause = () => {
  players.forEach((player) => player.pauseVideo?.());
  playing.value = false;
  clearInterval(syncTimer);
};
const releasePlayers = () => {
  ++attempt;
  clearTimeout(readyTimer);
  clearInterval(syncTimer);
  players.forEach((player) => player.destroy());
  players = [];
  ready.value = false;
  playing.value = false;
};
const sync = () => {
  const [left, right] = players;
  if (!ready.value || !left || !right) return;
  if (Math.abs(left.getCurrentTime() - right.getCurrentTime()) > 0.3)
    right.seekTo(left.getCurrentTime(), true);
};
const play = () => {
  if (!ready.value) return;
  new HomeExperience().sound?.pauseMusic();
  players[1].mute();
  players.forEach((player) => player.playVideo());
};
const toggleSound = () => {
  muted.value = !muted.value;
  if (muted.value) players[0]?.mute();
  else players[0]?.unMute();
};
async function start() {
  if (failed.value) {
    releasePlayers();
    started.value = false;
    ready.value = false;
    failed.value = false;
  }
  if (started.value) {
    play();
    return;
  }
  const currentAttempt = ++attempt;
  started.value = true;
  message.value = "Connecting both lenses…";
  new HomeExperience().sound?.pauseMusic();
  readyTimer = setTimeout(() => {
    if (!ready.value) {
      releasePlayers();
      failed.value = true;
      message.value =
        "YouTube is taking a moment. You can retry or open the original below.";
    }
  }, 18000);
  try {
    const api = await loadYouTube();
    if (disposed || currentAttempt !== attempt) return;
    let loaded = 0;
    for (const [index, mount] of [leftLens.value, rightLens.value].entries()) {
      if (!mount) continue;
      const element = document.createElement("div");
      mount.replaceChildren(element);
      players[index] = new api.Player(element, {
        width: "100%",
        height: "100%",
        videoId: videoId.value,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          playsinline: 1,
          controls: 0,
          fs: 0,
          disablekb: 1,
          rel: 0,
          origin: window.location.origin,
          mute: index === 1 ? 1 : 0,
        },
        events: {
          onReady: () => {
            if (disposed || currentAttempt !== attempt) return;
            if (index === 1 || muted.value) players[index].mute();
            if (++loaded === 2) {
              ready.value = true;
              clearTimeout(readyTimer);
              message.value = "Press play. Stay in the lenses.";
              play();
            }
          },
          onStateChange: (event: { data: number }) => {
            if (
              disposed ||
              currentAttempt !== attempt ||
              index !== 0 ||
              !ready.value
            )
              return;
            clearInterval(syncTimer);
            playing.value = event.data === 1;
            if (event.data === 1) {
              players[1].playVideo();
              sync();
              syncTimer = setInterval(sync, 1500);
              message.value = "Never giving you up.";
            } else if ([0, 2, 3].includes(event.data)) {
              players[1].pauseVideo();
              message.value =
                event.data === 3
                  ? "Buffering both lenses…"
                  : event.data === 0
                    ? "You knew what you were signing up for."
                    : "Paused. Take your time.";
            }
          },
          onAutoplayBlocked: () => {
            if (disposed || currentAttempt !== attempt) return;
            message.value = "Press play below to start both lenses.";
          },
          onError: (event: { data: number }) => {
            if (disposed || currentAttempt !== attempt) return;
            releasePlayers();
            failed.value = true;
            message.value = [101, 150].includes(event.data)
              ? "This video does not allow embedded playback here. Open the original on YouTube."
              : "YouTube cannot play this here. Retry or open the original below.";
          },
        },
      });
    }
  } catch {
    if (disposed || currentAttempt !== attempt) return;
    releasePlayers();
    message.value = "Could not connect to YouTube. Try again.";
    failed.value = true;
  }
}
const restart = () => {
  players.forEach((player) => player.seekTo(0, true));
  play();
};
const visibility = () => {
  if (document.hidden) pause();
};
onMounted(() => document.addEventListener("visibilitychange", visibility));
onBeforeUnmount(() => {
  disposed = true;
  releasePlayers();
  document.removeEventListener("visibilitychange", visibility);
});
</script>
<template>
  <section class="glasses-player" aria-label="Smart glasses cinema">
    <header>
      <span><i /> MOHITH / OPTICS 01</span><span>BINOCULAR VIEW</span>
    </header>
    <div class="optics" :class="{ active: started }">
      <div class="lens lens-left">
        <div ref="leftLens" class="lens-film" />
        <div v-if="!started" class="lens-id">
          <span>01 / LEFT</span><strong>A different</strong
          ><i>point of view.</i>
        </div>
      </div>
      <div class="bridge" aria-hidden="true" />
      <div class="lens lens-right">
        <div ref="rightLens" class="lens-film" />
        <div v-if="!started" class="lens-id">
          <span>02 / RIGHT</span><strong>A little</strong><i>less serious.</i>
        </div>
      </div>
    </div>
    <div class="cinema-controls">
      <button
        class="play-control"
        :disabled="started && !ready && !failed"
        :aria-label="playing ? 'Pause both lenses' : 'Play both lenses'"
        @click="playing ? pause() : start()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path v-if="playing" d="M7 5h3v14H7zm7 0h3v14h-3z" />
          <path v-else d="m8 4 12 8-12 8z" />
        </svg>
        <span>{{
          failed
            ? "Retry"
            : playing
              ? "Pause"
              : started
                ? "Play"
                : "Take a look"
        }}</span>
      </button>
      <template v-if="ready"
        ><button @click="restart" aria-label="Restart both lenses">↺</button
        ><button :aria-pressed="muted" @click="toggleSound">
          {{ muted ? "Sound off" : "Sound on" }}
        </button></template
      >
    </div>
    <p class="cinema-status" role="status">{{ message }}</p>
    <footer>
      <span>LEFT + RIGHT / ONE SOUNDTRACK</span
      ><a
        v-if="started"
        :href="`https://www.youtube.com/watch?v=${videoId}`"
        target="_blank"
        rel="noopener noreferrer"
        >Open on YouTube ↗</a
      ><span v-else>Best enjoyed with headphones.</span>
    </footer>
  </section>
</template>
<style scoped>
.glasses-player {
  width: min(1000px, calc(100vw - 48px));
  color: #e3e7e9;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  font: 9px/1.6 monospace;
  letter-spacing: 0.12em;
  color: #959fa6;
  padding: 18px 0;
}
header {
  border-bottom: 1px solid #ffffff1c;
}
header > span:first-child {
  display: flex;
  align-items: center;
  gap: 10px;
}
header i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #88cfe3;
}
.optics {
  display: flex;
  gap: 30px;
  position: relative;
  padding: 42px 8px 24px;
}
.lens {
  width: calc(50% - 15px);
  height: clamp(205px, 28vw, 330px);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid #8aa7b65e;
  background: radial-gradient(ellipse at 45% 30%, #26383f66, #070c1099 80%);
  box-shadow:
    inset 0 0 0 5px #050a0c99,
    0 10px 35px #0002;
}
.lens-left {
  border-radius: 39% 35% 43% 38% / 32% 33% 59% 54%;
  transform: rotate(2deg);
}
.lens-right {
  border-radius: 35% 39% 38% 43% / 33% 32% 54% 59%;
  transform: rotate(-2deg);
}
.active .lens {
  transform: none;
}
.bridge {
  position: absolute;
  top: 39%;
  left: calc(50% - 17px);
  width: 34px;
  height: 20px;
  border-top: 2px solid #879fa45e;
  border-radius: 50%;
}
.lens-film {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lens-film :deep(iframe) {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border: 0;
}
.lens-id {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  pointer-events: none;
}
.lens-id > span {
  font: 8px monospace;
  letter-spacing: 0.18em;
  color: #7f9ca9;
  margin-bottom: 24px;
}
.lens-id strong {
  font-size: clamp(20px, 3.1vw, 38px);
  line-height: 1.15;
  font-weight: 400;
  letter-spacing: -0.04em;
}
.lens-id i {
  color: #95c4d3;
  font:
    italic clamp(20px, 3.2vw, 40px) / 1.2 Georgia,
    serif;
}
.cinema-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 26px;
  margin-top: 12px;
}
.cinema-controls button {
  min-height: 44px;
  font-size: 12px;
  color: #c4d0d6;
}
.play-control {
  display: flex;
  align-items: center;
  gap: 12px;
}
.play-control svg {
  width: 42px;
  height: 42px;
  padding: 12px;
  border: 1px solid #83b4c570;
  border-radius: 50%;
  fill: #c8e2eb;
  transition: background 0.2s;
}
.play-control:hover svg {
  background: #74a7bb20;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid #88cfe3;
  outline-offset: 6px;
}
.cinema-status {
  min-height: 36px;
  text-align: center;
  font-size: 11px;
  line-height: 1.6;
  color: #a5afb5;
  margin: 12px auto 4px;
  max-width: 430px;
}
footer {
  border-top: 1px solid #ffffff1c;
  font-size: 8px;
  letter-spacing: 0.05em;
}
footer a {
  color: #9acddb;
}
@media (max-width: 550px) {
  .optics {
    gap: 14px;
    padding: 28px 0 12px;
  }
  .lens {
    width: calc(50% - 7px);
    height: auto;
    aspect-ratio: 1.25;
  }
  .lens-id > span {
    font-size: 7px;
    margin-bottom: 20px;
  }
  .bridge {
    width: 16px;
    left: calc(50% - 8px);
  }
  header {
    font-size: 7px;
  }
  footer > span:last-child {
    display: none;
  }
  .cinema-controls {
    gap: 20px;
  }
}
@media (max-height: 500px) {
  .optics {
    padding: 10px 0;
  }
  .lens {
    height: clamp(100px, 32dvh, 160px);
  }
  header,
  footer {
    padding: 8px 0;
  }
  .cinema-status {
    margin: 3px auto;
    min-height: 18px;
  }
  .cinema-controls {
    margin: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .play-control svg {
    transition: none;
  }
}

.glasses-player{max-width:100%;min-height:0;overflow:auto;overscroll-behavior:contain;}
@media(max-width:550px){.optics{padding-top:20px;}.lens-id>span{margin-bottom:12px;}.lens-id strong,.lens-id i{font-size:20px;}.cinema-controls{gap:18px;flex-wrap:wrap;}.cinema-status{padding:0 8px;}header{letter-spacing:.04em;}}
</style>
