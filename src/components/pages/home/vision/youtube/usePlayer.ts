import type { Ref } from "vue";
import { loadYouTube, type YouTubePlayer } from "~/utils/music-providers";
import { HomeExperience } from "~/experiences/home";
import type { Video } from "./catalogue";

interface ShelfPlayer extends YouTubePlayer {
  getDuration(): number;
  getPlayerState(): number;
  setVolume(volume: number): void;
  getVolume(): number;
  setPlaybackRate(rate: number): void;
  loadVideoById(options: string | { videoId: string; startSeconds?: number }): void;
  cueVideoById(videoId: string): void;
  getVideoLoadedFraction(): number;
  stopVideo(): void;
}
export function usePlayer(
  host: Ref<HTMLElement | undefined>,
  remember: (video: Video, position: number, duration: number) => void,
  ended: () => void,
  failed: () => void,
) {
  const current = ref<Video>();
  const ready = ref(false);
  const playing = ref(false);
  const status = ref("Choose a video.");
  const error = ref("");
  const position = ref(0);
  const duration = ref(0);
  const muted = ref(false);
  let player: ShelfPlayer | undefined;
  let disposed = false;
  let generation = 0;
  let starting = false;
  let waitingForPlayback = false;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let requestedStart = 0;
  let lastRemembered = 0;

  function pauseRoom() {
    // The same optional sound hook as TV, guarded for standalone previews.
    try { new HomeExperience().sound?.pauseMusic(); } catch { /* The room may not be mounted. */ }
  }
  function safe(action: (instance: ShelfPlayer) => void) {
    if (!player || !ready.value) return;
    try { action(player); } catch { status.value = "The player is reconnecting. Try again."; }
  }
  function snapshot() {
    if (!current.value || !ready.value || !player) return;
    try {
      position.value = player.getCurrentTime() || 0;
      duration.value = player.getDuration() || 0;
      remember(current.value, position.value, duration.value);
    } catch { /* A frame can disappear during teardown. */ }
  }
  function release() {
    ++generation;
    clearTimeout(readyTimer);
    clearInterval(poll);
    poll = undefined;
    ready.value = false;
    playing.value = false;
    starting = false;
    const old = player;
    player = undefined;
    try { old?.destroy(); } catch { /* Already removed frames need no further cleanup. */ }
  }
  function loadCurrent() {
    if (!current.value || !player || !ready.value) return;
    waitingForPlayback = true;
    error.value = "";
    status.value = "Loading video…";
    const video = current.value;
    safe(instance => instance.loadVideoById({ videoId: video.id, startSeconds: requestedStart }));
  }
  async function start() {
    if (disposed || !current.value) return;
    if (ready.value) { loadCurrent(); return; }
    if (starting) return;
    starting = true;
    error.value = "";
    status.value = "Connecting to YouTube…";
    const attempt = ++generation;
    readyTimer = setTimeout(() => {
      if (disposed || generation !== attempt || ready.value) return;
      release();
      error.value = "YouTube took too long to respond. Retry, or watch on YouTube.";
    }, 18000);
    try {
      const api = await loadYouTube();
      if (disposed || generation !== attempt || !host.value || !current.value) return;
      const element = document.createElement("div");
      host.value.replaceChildren(element);
      player = new api.Player(element, {
        width: "100%", height: "100%", videoId: current.value.id,
        playerVars: {
          controls: 1, playsinline: 1, rel: 0, modestbranding: 1,
          origin: window.location.origin, start: Math.floor(requestedStart),
        },
        events: {
          onReady: () => {
            if (disposed || generation !== attempt) return;
            clearTimeout(readyTimer);
            ready.value = true;
            starting = false;
            if (muted.value) safe(instance => instance.mute());
            // Selection may have changed while the shared API loader was pending.
            loadCurrent();
            clearInterval(poll);
            poll = setInterval(() => {
              if (!ready.value || !current.value || !player) return;
              try {
                position.value = player.getCurrentTime() || 0;
                duration.value = player.getDuration() || 0;
                if (playing.value && Date.now() - lastRemembered > 5000) {
                  snapshot();
                  lastRemembered = Date.now();
                }
              } catch { /* Transient iframe navigation must not stop the app. */ }
            }, 1000);
          },
          onStateChange: (event: { data: number }) => {
            if (disposed || generation !== attempt || !ready.value || !current.value) return;
            playing.value = event.data === 1;
            if (event.data === 1) {
              waitingForPlayback = false;
              error.value = "";
              pauseRoom();
              status.value = "Playing";
              snapshot();
            } else if (event.data === 2) {
              status.value = "Paused";
              snapshot();
            } else if (event.data === 3) status.value = "Buffering…";
            else if (event.data === 5) status.value = "Ready to play";
            else if (event.data === 0 && !waitingForPlayback) {
              status.value = "Ended";
              snapshot();
              ended();
            }
          },
          onAutoplayBlocked: () => {
            if (disposed || generation !== attempt) return;
            playing.value = false;
            status.value = "Press play to start. Your browser needs a gesture.";
          },
          onError: (event: { data: number }) => {
            if (disposed || generation !== attempt || !current.value) return;
            clearTimeout(readyTimer);
            if (!ready.value) release();
            playing.value = false;
            const messages: Record<number, string> = {
              2: "This video link is invalid.",
              5: "Your browser could not play this video.",
              100: "This video has been removed or made private.",
              101: "The publisher does not allow this video to be embedded.",
              150: "The publisher does not allow this video to be embedded.",
              153: "YouTube could not verify this embedded player.",
            };
            error.value = messages[event.data] ?? "YouTube could not play this video here.";
            failed();
          },
        },
      }) as ShelfPlayer;
    } catch {
      if (disposed || generation !== attempt) return;
      release();
      error.value = "YouTube could not be reached. Retry, or watch on YouTube.";
    }
  }
  function select(video: Video, resume = 0) {
    snapshot();
    current.value = video;
    position.value = resume;
    duration.value = 0;
    requestedStart = resume;
    waitingForPlayback = true;
    error.value = "";
    void nextTick(start);
  }
  function togglePlayback() {
    if (!ready.value || error.value) { void start(); return; }
    safe(instance => {
      if (playing.value) instance.pauseVideo();
      else { pauseRoom(); instance.playVideo(); }
    });
  }
  function pause() { safe(instance => instance.pauseVideo()); playing.value = false; }
  function seek(seconds: number) {
    safe(instance => instance.seekTo(Math.max(0, Math.min(duration.value || Infinity, position.value + seconds)), true));
  }
  function toggleMute() {
    muted.value = !muted.value;
    safe(instance => muted.value ? instance.mute() : instance.unMute());
  }
  function close() {
    snapshot();
    release();
    current.value = undefined;
    error.value = "";
    status.value = "Choose a video.";
  }
  const onVisibility = () => { if (document.hidden) pause(); };
  onMounted(() => document.addEventListener("visibilitychange", onVisibility));
  onBeforeUnmount(() => {
    snapshot();
    disposed = true;
    release();
    document.removeEventListener("visibilitychange", onVisibility);
  });
  return { current, ready, playing, status, error, position, duration, muted, select, togglePlayback, pause, seek, toggleMute, close };
}
