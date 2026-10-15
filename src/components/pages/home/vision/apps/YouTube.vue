<script setup lang="ts">
import type { CSSProperties } from "vue";
import { VISION } from "../vision";
import { vHover } from "../kit/hover";
import { catalogue, categories, rickId, videoFromInput, avatarColor } from "../youtube/catalogue";
import type { Video } from "../youtube/catalogue";
import { searchYouTube, trendingYouTube } from "../youtube/remote";
import { listenAsApp } from "../bus";
import { useLibrary, uniqueId } from "../youtube/useLibrary";
import { usePlayer } from "../youtube/usePlayer";
import YtIcon from "../youtube/YtIcon.vue";
import type { IconName } from "../youtube/YtIcon.vue";
import YtVideoCard from "../youtube/YtVideoCard.vue";
import YtThumbnail from "../youtube/YtThumbnail.vue";

const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type Page = "home" | "shorts" | "subscriptions" | "history" | "playlists" | "later" | "liked" | "search" | "channel" | "playlist";
const nav: { id: Page; title: string; icon: IconName }[] = [
  { id: "home", title: "Home", icon: "home" },
  { id: "shorts", title: "Shorts", icon: "shorts" },
  { id: "subscriptions", title: "Subscriptions", icon: "subscriptions" },
  { id: "history", title: "History", icon: "history" },
  { id: "playlists", title: "Playlists", icon: "playlist" },
  { id: "later", title: "Watch later", icon: "later" },
  { id: "liked", title: "Liked videos", icon: "like" },
];
const app = ref<HTMLElement>();
const content = ref<HTMLElement>();
const screen = ref<HTMLElement>();
const watchSlot = ref<HTMLElement>();
const shortsSlot = ref<HTMLElement>();
const searchInput = ref<HTMLInputElement>();
const shareInput = ref<HTMLInputElement>();
const dialog = ref<HTMLElement>();
let previousFocus: HTMLElement | undefined;
const { library, storageWarning, videos, resolve, toggle, rate, remember, progress, persist } = useLibrary();
const page = ref<Page>("home");
const watching = ref(false);
const cinema = ref(false);
const expanded = ref(true);
const query = ref("");
const category = ref("All");
const suggestionsOpen = ref(false);
const channel = ref("");
const playlistId = ref("");
const menu = ref<"account" | "notifications" | "create" | undefined>();
const modal = ref<"share" | "save" | "playlist" | "paste" | "comments" | "library" | undefined>();
const modalVideo = ref<Video>();
const playlistName = ref("");
const editingPlaylist = ref("");
const paste = ref("");
const comment = ref("");
const descriptionExpanded = ref(false);
const queueOpen = ref(false);
const notice = ref("");
const countdown = ref(0);
const countdownReason = ref<"ended" | "error">("ended");
const stageStyle = ref<CSSProperties>({});
const shorts = [...catalogue].filter(video => video.seconds > 0).sort((a, b) => a.seconds - b.seconds).slice(0, 10);
const shortIndex = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | undefined;
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let metadataTimer: ReturnType<typeof setTimeout> | undefined;
let fetchController: AbortController | undefined;
let disposed = false;
let previousDim = 0;
let ownsDim = false;
let observer: ResizeObserver | undefined;
let layoutFrame = 0;
let miniLocation: { x: number; y: number } | undefined;
let drag: { x: number; y: number; left: number; top: number; scaleX: number; scaleY: number; id: number } | undefined;
let shortDrag: { y: number; id: number } | undefined;
let lastWheel = 0;
let newPlaylistVideoId: string | undefined;
const player = usePlayer(screen, remember, () => {
  cinema.value = false;
  if (page.value === "shorts") stepShort(1);
  else if (library.value.autoplay) beginCountdown("ended");
}, () => { cinema.value = false; beginCountdown("error"); });
const { current, ready, playing, status, error, muted, togglePlayback, seek, toggleMute } = player;
const mini = computed(() => !!current.value && !watching.value && page.value !== "shorts");
const activePlaylist = computed(() => library.value.playlists.find(item => item.id === playlistId.value));
const nextVideos = computed(() => {
  const queued = library.value.queue.map(resolve).filter((video): video is Video => !!video && video.id !== current.value?.id);
  const related = catalogue.filter(video => video.id !== current.value?.id && !library.value.hidden.includes(video.id));
  related.sort((a, b) => Number(b.category === current.value?.category) - Number(a.category === current.value?.category));
  return [...queued, ...related.filter(video => !queued.some(item => item.id === video.id))];
});
const pendingLink = computed(() => videoFromInput(query.value));
const heading = computed(() => {
  if (page.value === "channel") return channel.value;
  if (page.value === "playlist") return activePlaylist.value?.name ?? "Playlist";
  if (page.value === "search") return query.value.trim() ? `Results for “${query.value.trim()}”` : "Search your shelf";
  return nav.find(item => item.id === page.value)?.title ?? "Home";
});
/* Real YouTube: what you search for, and what is trending in India, through the site's own server. */
const remote = ref<Video[]>([]);
const trending = ref<Video[]>([]);
const searching = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch([page, query], ([where, text]) => {
  clearTimeout(searchTimer);
  const term = text.trim();
  if (where !== "search" || !term || videoFromInput(term)) { remote.value = []; return; }
  searching.value = true;
  searchTimer = setTimeout(async () => {
    const found = await searchYouTube(term);
    if (query.value.trim() === term) { remote.value = found; searching.value = false; }
  }, 450);
});
watch(category, value => { if (value === "Trending" && !trending.value.length) void trendingYouTube().then(list => { trending.value = list; }); });
/** Remember a video from YouTube so history, playlists and Watch later can find it again. */
function keep(video: Video) { if (!resolve(video.id)) library.value.pasted.push({ ...video }); }
const filtered = computed(() => {
  let list = [...videos.value];
  if (page.value === "search") {
    const term = query.value.trim().toLowerCase();
    list = list.filter(video => [video.title, video.channel, video.category].some(text => text.toLowerCase().includes(term)));
    list = [...list, ...remote.value.filter(video => !list.some(item => item.id === video.id))];
    if (/never|give you up|rick|roll/.test(term)) {
      const rick = resolve(rickId);
      if (rick) list = [rick, ...list.filter(video => video.id !== rickId)];
    }
  } else if (page.value === "subscriptions") list = list.filter(video => library.value.subscriptions.includes(video.channel));
  else if (page.value === "channel") list = list.filter(video => video.channel === channel.value);
  else if (page.value === "history") {
    list = [...library.value.history].sort((a, b) => b.at - a.at).map(item => resolve(item.id)).filter((video): video is Video => !!video);
  } else if (page.value === "later") list = library.value.later.map(resolve).filter((video): video is Video => !!video);
  else if (page.value === "liked") list = list.filter(video => library.value.ratings[video.id] === 1);
  else if (page.value === "playlist") list = (activePlaylist.value?.videos ?? []).map(resolve).filter((video): video is Video => !!video);
  else list = catalogue.filter(video => !library.value.hidden.includes(video.id));
  if (page.value === "home") {
    if (category.value === "Watched") list = list.filter(video => library.value.history.some(item => item.id === video.id));
    else if (category.value === "Recently uploaded") list.sort((a, b) => b.year - a.year);
    else if (category.value === "Trending") list = trending.value;
    else if (category.value !== "All") list = list.filter(video => video.category === category.value);
  }
  return list;
});
const suggestions = computed(() => {
  const term = query.value.trim().toLowerCase();
  return [...new Set([
    ...library.value.recent.filter(item => !term || item.toLowerCase().includes(term)),
    ...catalogue.filter(video => !term || `${video.title} ${video.channel} ${video.category}`.toLowerCase().includes(term)).map(video => video.title),
  ])].slice(0, 6);
});
const currentComments = computed(() => {
  const list = current.value ? library.value.comments[current.value.id] : undefined;
  return Array.isArray(list) ? list : [];
});
const shareLink = computed(() => `https://youtu.be/${modalVideo.value?.id ?? current.value?.id ?? rickId}`);
const dialogTitle = computed(() => ({
  save: "Save video", paste: "Open a YouTube link", playlist: "Playlist",
  library: "You", comments: "Local comments", share: "Share video",
})[modal.value ?? "share"]);
const removable = computed(() => ["later", "liked", "history", "playlist"].includes(page.value));
function trapFocus(event: KeyboardEvent) {
  const nodes = dialog.value?.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, select, a[href]");
  if (!nodes?.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
function feelingLucky() {
  const video = resolve(rickId);
  if (video) playVideo(video);
}
function notify(text: string) {
  notice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ""; }, 4000);
}
function cancelCountdown() { clearInterval(countdownTimer); countdown.value = 0; }
function beginCountdown(reason: "ended" | "error") {
  cancelCountdown();
  if (!nextVideos.value.length) return;
  countdownReason.value = reason;
  countdown.value = 5;
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) { cancelCountdown(); playNext(); }
  }, 1000);
}
function playVideo(video: Video, resume = true) {
  keep(video);
  cancelCountdown();
  menu.value = undefined;
  modal.value = undefined;
  watching.value = true;
  cinema.value = false;
  descriptionExpanded.value = false;
  comment.value = "";
  if (page.value === "shorts") page.value = "home";
  const old = library.value.history.find(item => item.id === video.id);
  const start = resume && old && old.duration > 0 && old.position / old.duration < 0.98 ? old.position : 0;
  player.select(video, start);
  void nextTick(() => { if (content.value) content.value.scrollTop = 0; scheduleLayout(); });
}
function playNext() {
  cancelCountdown();
  if (page.value === "shorts") { stepShort(1); return; }
  const next = nextVideos.value[0];
  if (!next) { notify("You reached the end of this shelf."); return; }
  const queuedIndex = library.value.queue.indexOf(next.id);
  if (queuedIndex >= 0) library.value.queue.splice(queuedIndex, 1);
  const keepMini = mini.value;
  playVideo(next, false);
  if (keepMini) watching.value = false;
}
function navigate(destination: Page) {
  cancelCountdown();
  cinema.value = false;
  watching.value = false;
  page.value = destination;
  menu.value = undefined;
  modal.value = undefined;
  suggestionsOpen.value = false;
  if (destination === "shorts") {
    const video = shorts[shortIndex.value];
    if (video) player.select(video);
  }
  void nextTick(() => { if (content.value) content.value.scrollTop = 0; scheduleLayout(); });
}
function expandPlayer() {
  if (!current.value) return;
  if (page.value === "shorts") page.value = "home";
  watching.value = true;
  void nextTick(() => { if (content.value) content.value.scrollTop = 0; scheduleLayout(); });
}
function closePlayer() { cancelCountdown(); cinema.value = false; player.close(); scheduleLayout(); }
function openChannel(name: string) { channel.value = name; navigate("channel"); }
function addQueue(video: Video) {
  if (!library.value.queue.includes(video.id)) library.value.queue.push(video.id);
  notify("Added to queue.");
}
function saveLater(video: Video) {
  if (!library.value.later.includes(video.id)) library.value.later.push(video.id);
  notify("Saved to Watch later.");
}
function hideVideo(video: Video) {
  if (!library.value.hidden.includes(video.id)) library.value.hidden.push(video.id);
  notify("Removed from Home. You can restore hidden videos in your account menu.");
}
function removeVideo(video: Video) {
  if (page.value === "later") library.value.later = library.value.later.filter(id => id !== video.id);
  if (page.value === "liked") delete library.value.ratings[video.id];
  if (page.value === "history") library.value.history = library.value.history.filter(item => item.id !== video.id);
  if (page.value === "playlist" && activePlaylist.value) activePlaylist.value.videos = activePlaylist.value.videos.filter(id => id !== video.id);
}
/* JARVIS: "play lofi on YouTube" searches and plays the top result. */
const stopListening = listenAsApp("youtube", async command => {
  if (command.action !== "play") return;
  const term = String(command.query ?? "").trim();
  if (!term) return;
  search(term);
  const found = await searchYouTube(term);
  const reply = command.reply as ((line: string) => void) | undefined;
  if (found[0]) { playVideo(found[0]); reply?.(`Playing “${found[0].title.replace(/\s+[|·-].*$/, '').slice(0, 70)}”, from ${found[0].channel}.`); }
  else reply?.(`I could not find anything on YouTube for ${term}.`);
});
onBeforeUnmount(stopListening);
function search(value = query.value) {
  query.value = value;
  const term = value.trim();
  if (term) library.value.recent = [term, ...library.value.recent.filter(item => item !== term)].slice(0, 12);
  navigate("search");
}
function showModal(type: typeof modal.value, video = current.value) {
  modalVideo.value = video;
  menu.value = undefined;
  suggestionsOpen.value = false;
  modal.value = type;
  if (type === "share") void nextTick(() => shareInput.value?.focus());
}
async function copyLink() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(shareLink.value);
    if (!disposed) notify("Link copied. Send responsibly. Or send Rick.");
  } catch {
    if (disposed) return;
    shareInput.value?.focus();
    shareInput.value?.select();
    notify("Select and copy this link. Clipboard access is unavailable.");
  }
}
function newPlaylist(editId = "", name = "") {
  newPlaylistVideoId = modal.value === "save" ? modalVideo.value?.id : undefined;
  editingPlaylist.value = editId;
  playlistName.value = name;
  modal.value = "playlist";
}
function commitPlaylist() {
  const name = playlistName.value.trim().slice(0, 100);
  if (!name) return;
  const existing = library.value.playlists.find(item => item.id === editingPlaylist.value);
  if (existing) existing.name = name;
  else library.value.playlists.push({ id: uniqueId(), name, videos: newPlaylistVideoId ? [newPlaylistVideoId] : [] });
  modal.value = undefined;
  notify(existing ? "Playlist renamed." : "Playlist created. A very good empty beginning.");
}
function togglePlaylist(id: string) {
  const list = library.value.playlists.find(item => item.id === id);
  const video = modalVideo.value;
  if (!list || !video) return;
  if (list.videos.includes(video.id)) list.videos = list.videos.filter(item => item !== video.id);
  else list.videos.push(video.id);
}
function playAll(list: Video[]) {
  const first = list[0];
  if (!first) { notify("Add a video first."); return; }
  library.value.queue = list.slice(1).map(video => video.id);
  queueOpen.value = true;
  playVideo(first);
}
function moveQueue(index: number, direction: number) {
  const target = index + direction;
  const list = library.value.queue;
  if (target < 0 || target >= list.length) return;
  const item = list[index];
  const other = list[target];
  if (item && other) { list[index] = other; list[target] = item; }
}
async function playPasted(value: string) {
  const id = videoFromInput(value);
  if (!id) { notify("Paste a YouTube link or an 11-character video ID."); return; }
  const known = resolve(id);
  if (known) { playVideo(known); return; }
  const video: Video = { id, title: "YouTube video", channel: "Pasted link", category: "Pasted links", duration: "Duration unavailable", seconds: 0, year: 0 };
  library.value.pasted.push(video);
  playVideo(video, false);
  fetchController?.abort();
  clearTimeout(metadataTimer);
  const controller = new AbortController();
  fetchController = controller;
  const timeout = setTimeout(() => controller.abort(), 7000);
  metadataTimer = timeout;
  try {
    const url = "https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(`https://www.youtube.com/watch?v=${id}`);
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return;
    const data: unknown = await response.json();
    if (disposed || controller.signal.aborted || typeof data !== "object" || !data) return;
    const result = data as Record<string, unknown>;
    const stored = library.value.pasted.find(item => item.id === id);
    if (stored && typeof result.title === "string") {
      stored.title = result.title.slice(0, 500);
      if (typeof result.author_name === "string") stored.channel = result.author_name.slice(0, 300);
      if (current.value?.id === id) current.value = { ...stored };
    }
  } catch { /* Playback works even when oEmbed is blocked by CORS. */ }
  finally {
    clearTimeout(timeout);
    if (metadataTimer === timeout) metadataTimer = undefined;
  }
}
function postComment() {
  const text = comment.value.trim().slice(0, 1000);
  if (!text || !current.value) return;
  const id = current.value.id;
  const existing = library.value.comments[id];
  const list = Array.isArray(existing) ? existing : [];
  list.push({ id: uniqueId(), text });
  library.value.comments[id] = list;
  comment.value = "";
  notify("Comment saved on this headset.");
}
function stepShort(direction: number) {
  cancelCountdown();
  shortIndex.value = (shortIndex.value + direction + shorts.length) % shorts.length;
  const video = shorts[shortIndex.value];
  if (video) player.select(video);
}
function shortWheel(event: WheelEvent) {
  if (page.value !== "shorts" || modal.value || Math.abs(event.deltaY) < 12) return;
  event.preventDefault();
  if (Date.now() - lastWheel < 650) return;
  lastWheel = Date.now();
  stepShort(event.deltaY > 0 ? 1 : -1);
}
function shortStart(event: PointerEvent) {
  if ((event.target as HTMLElement).closest("button, a, input")) return;
  shortDrag = { y: event.clientY, id: event.pointerId };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function shortEnd(event: PointerEvent) {
  if (!shortDrag || shortDrag.id !== event.pointerId) return;
  const delta = event.clientY - shortDrag.y;
  shortDrag = undefined;
  if (Math.abs(delta) > 45) stepShort(delta < 0 ? 1 : -1);
}
function playResolved(id: string) {
  const video = resolve(id);
  if (video) {
    library.value.queue = library.value.queue.filter(item => item !== id);
    playVideo(video);
  }
}
function toggleCinema() {
  if (!current.value) { notify("Choose a video to enter cinema mode."); return; }
  expandPlayer();
  cinema.value = !cinema.value;
}
function keyboard(event: KeyboardEvent) {
  if (event.key === 'Escape' && (modal.value || menu.value || suggestionsOpen.value || cinema.value)) {
    event.preventDefault();
    event.stopPropagation();
    if (modal.value) modal.value = undefined;
    else if (menu.value) menu.value = undefined;
    else if (suggestionsOpen.value) suggestionsOpen.value = false;
    else cinema.value = false;
    return;
  }
  if (!(event.target instanceof HTMLElement)) return;
  const target = event.target;
  if (event.key === ' ' && target.closest('button, a')) return;
  if (target.closest("input, textarea, select, [contenteditable='true']") || modal.value) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const handled = ["k", " ", "j", "l", "m", "f", "t", "/", "i"].includes(key)
    || (event.shiftKey && key === "n") || (page.value === "shorts" && ["arrowup", "arrowdown"].includes(key));
  if (!handled) return;
  event.preventDefault();
  if (key === "/") { cinema.value = false; searchInput.value?.focus(); return; }
  if (!current.value) return;
  if (key === "k" || key === " ") { cancelCountdown(); togglePlayback(); }
  if (key === "j") seek(-10);
  if (key === "l") seek(10);
  if (key === "m") toggleMute();
  if (key === "f" || key === "t") toggleCinema();
  if (event.shiftKey && key === "n") playNext();
  if (key === "i") { cinema.value = false; navigate("home"); }
  if (key === "arrowup") stepShort(-1);
  if (key === "arrowdown") stepShort(1);
}
function scheduleLayout() {
  if (disposed || layoutFrame) return;
  layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; measurePlayer(); });
}
function measurePlayer() {
  const element = app.value;
  const bounds = element?.getBoundingClientRect();
  if (!element || !bounds || !current.value || !bounds.width || !bounds.height) return;
  const root = {
    left: bounds.left, top: bounds.top,
    width: element.clientWidth || bounds.width, height: element.clientHeight || bounds.height,
  };
  const scaleX = bounds.width / root.width;
  const scaleY = bounds.height / root.height;
  if (cinema.value) {
    stageStyle.value = { left: "0px", top: "0px", width: `${root.width}px`, height: `${root.height}px`, clipPath: "none" };
    return;
  }
  if (mini.value) {
    const width = Math.min(320, root.width - 24, Math.max(220, (root.height - 180) * 16 / 9));
    const height = width * 9 / 16 + 62;
    const x = Math.max(8, Math.min(miniLocation?.x ?? root.width - width - 16, root.width - width - 8));
    const maxY = Math.max(8, root.height - height - 8);
    const minY = Math.min(64, maxY);
    const y = Math.max(minY, Math.min(miniLocation?.y ?? root.height - height - 78, maxY));
    stageStyle.value = { left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`, clipPath: "none" };
    return;
  }
  const slot = page.value === "shorts" ? shortsSlot.value : watchSlot.value;
  const rect = slot?.getBoundingClientRect();
  const area = content.value?.getBoundingClientRect();
  if (!rect || !area) return;
  const topClip = Math.max(0, area.top - rect.top) / scaleY;
  const bottomClip = Math.max(0, rect.bottom - area.bottom) / scaleY;
  stageStyle.value = {
    left: `${(rect.left - root.left) / scaleX}px`, top: `${(rect.top - root.top) / scaleY}px`,
    width: `${rect.width / scaleX}px`, height: `${rect.height / scaleY}px`,
    clipPath: `inset(${topClip}px 0 ${bottomClip}px 0 round 16px)`,
  };
}
function startMiniDrag(event: PointerEvent) {
  if ((event.target as HTMLElement).closest("button, a") || !app.value) return;
  const stage = (event.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
  const root = app.value.getBoundingClientRect();
  if (!stage) return;
  const scaleX = root.width / (app.value.clientWidth || root.width);
  const scaleY = root.height / (app.value.clientHeight || root.height);
  if (!scaleX || !scaleY) return;
  drag = {
    x: event.clientX, y: event.clientY,
    left: (stage.left - root.left) / scaleX, top: (stage.top - root.top) / scaleY,
    scaleX, scaleY, id: event.pointerId,
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function moveMini(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return;
  miniLocation = {
    x: drag.left + (event.clientX - drag.x) / drag.scaleX,
    y: drag.top + (event.clientY - drag.y) / drag.scaleY,
  };
  scheduleLayout();
}
function endMini() { drag = undefined; }
function glow(event: PointerEvent) {
  const row = (event.target as HTMLElement).closest<HTMLElement>(".glow");
  if (!row) return;
  const rect = row.getBoundingClientRect();
  row.style.setProperty("--x", `${event.clientX - rect.left}px`);
  row.style.setProperty("--y", `${event.clientY - rect.top}px`);
}
watch(() => library.value.autoplay, value => { if (!value) cancelCountdown(); });
watch(modal, async (value, previous) => {
  if (value && !previous) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  await nextTick();
  if (disposed) return;
  if (value) dialog.value?.querySelector<HTMLElement>("input, button")?.focus();
  else previousFocus?.focus();
});
function restoreDim() {
  if (ownsDim && vision) vision.dim.value = previousDim;
  ownsDim = false;
}
watch([cinema, playing, status], () => {
  if (!vision) return;
  if (cinema.value && status.value !== "Ended") {
    if (!ownsDim) { previousDim = vision.dim.value; ownsDim = true; }
    vision.dim.value = playing.value ? 0.75 : 0.4;
  } else restoreDim();
});
watch([watching, page, cinema, expanded, current], () => {
  void nextTick(() => { observeSlots(); scheduleLayout(); });
});
function observeSlots() {
  observer?.disconnect();
  if (app.value) observer?.observe(app.value);
  if (watchSlot.value) observer?.observe(watchSlot.value);
  if (shortsSlot.value) observer?.observe(shortsSlot.value);
}
const onVisibility = () => { if (document.hidden) cancelCountdown(); };
onMounted(() => {
  if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(scheduleLayout); observeSlots(); }
  window.addEventListener("resize", scheduleLayout);
  document.addEventListener("visibilitychange", onVisibility);
  app.value?.addEventListener("scroll", scheduleLayout, true);
});
onBeforeUnmount(() => {
  disposed = true;
  cancelCountdown();
  clearTimeout(noticeTimer);
  clearTimeout(metadataTimer);
  fetchController?.abort();
  cancelAnimationFrame(layoutFrame);
  observer?.disconnect();
  window.removeEventListener("resize", scheduleLayout);
  document.removeEventListener("visibilitychange", onVisibility);
  app.value?.removeEventListener("scroll", scheduleLayout, true);
  restoreDim();
  persist();
});
</script>

<template>
  <section ref="app" class="vision-youtube" :class="{ compact: props.compact, collapsed: !expanded, 'cinema-active': cinema }"
    aria-label="YouTube video shelf" tabindex="0" @keydown="keyboard" @pointermove="glow"
    @pointerdown="event => { if (!(event.target as HTMLElement).closest('.search-area, .top-menu')) { suggestionsOpen = false; menu = undefined; } }">
    <header class="topbar">
      <div class="brand">
        <button v-hover class="icon-button rail-toggle" aria-label="Toggle navigation" :aria-expanded="expanded" @click="expanded = !expanded">
          <YtIcon name="menu" />
        </button>
        <button v-hover class="logo" aria-label="YouTube Home" @click="navigate('home')">
          <svg viewBox="0 0 122 30" aria-hidden="true">
            <rect x="1" y="3" width="32" height="24" rx="7" fill="#ff0033" />
            <path d="m14 9 10 6-10 6Z" fill="white" />
            <g fill="currentColor">
              <path d="M38 5h4l3 8 3-8h4l-5 13v7h-4v-7Z" />
              <path fill-rule="evenodd" d="M56 10c-4 0-5 3-5 8s1 7 5 7 5-2 5-7-1-8-5-8Zm0 3c1 0 1.5 1 1.5 5s-.5 4-1.5 4-1.5-1-1.5-4 .5-5 1.5-5Z" />
              <path d="M63 10h3.5v11c0 2 2 1 3 0V10H73v15h-3.5v-2c-3 3-6.5 3-6.5-2Z" />
              <path d="M74 5h13v3.5h-4.5V25H79V8.5h-5Z" />
              <path d="M87 10h3.5v11c0 2 2 1 3 0V10H97v15h-3.5v-2c-3 3-6.5 3-6.5-2Z" />
              <path fill-rule="evenodd" d="M99 5h3.5v6c5-3 7 0 7 7s-2 9-7 6v1H99Zm3.5 9v7c3 2 3.5 0 3.5-3s-.5-6-3.5-4Z" />
              <path fill-rule="evenodd" d="M116 20h-3c0 3-3 3-3-1h6v-3c0-8-9-8-9 2s9 9 9 2Zm-6-4c0-4 3-4 3 0Z" transform="translate(3 0)" />
            </g>
          </svg>
          <span class="vision-label">VISION</span>
        </button>
      </div>
      <div class="search-area">
        <form class="search-form" role="search" @submit.prevent="search()">
          <input ref="searchInput" v-model="query" aria-label="Search videos or paste a YouTube link"
            placeholder="Search or paste a YouTube link" autocomplete="off" maxlength="500"
            @focus="suggestionsOpen = true" @input="cancelCountdown(); page = 'search'; watching = false; cinema = false"
            @keydown.down.prevent="suggestionsOpen = true" />
          <button v-hover v-if="query" type="button" class="icon-button clear-search" aria-label="Clear search"
            @click="query = ''; searchInput?.focus()"><YtIcon name="close" /></button>
          <button v-hover class="search-submit" aria-label="Search"><YtIcon name="search" /></button>
        </form>
        <div v-if="suggestionsOpen && suggestions.length" class="suggestions">
          <button v-hover v-for="suggestion in suggestions" :key="suggestion" class="glow" @click="search(suggestion)">
            <YtIcon name="search" /><span>{{ suggestion }}</span>
          </button>
        </div>
      </div>
      <div class="top-actions top-menu">
        <button v-hover class="icon-button" aria-label="Create" :aria-expanded="menu === 'create'"
          @click="menu = menu === 'create' ? undefined : 'create'"><YtIcon name="create" /></button>
        <button v-hover class="icon-button notification-button" aria-label="Notifications" :aria-expanded="menu === 'notifications'"
          @click="menu = menu === 'notifications' ? undefined : 'notifications'"><YtIcon name="bell" />
          <span v-if="library.notificationChannels.length" class="notification-dot" />
        </button>
        <button v-hover class="guest-avatar" aria-label="Guest account menu" :aria-expanded="menu === 'account'"
          @click="menu = menu === 'account' ? undefined : 'account'">G</button>
        <div v-if="menu" class="popover">
          <template v-if="menu === 'create'">
            <h3>Create on this headset</h3>
            <button v-hover class="glow" @click="showModal('paste')"><YtIcon name="play" />Open a YouTube link</button>
            <button v-hover class="glow" @click="newPlaylist(); menu = undefined"><YtIcon name="playlist" />New playlist</button>
            <p>Uploads live on YouTube. This shelf plays and organises videos.</p>
          </template>
          <template v-else-if="menu === 'notifications'">
            <h3>Notifications</h3>
            <p>Local channel reminders. No live notifications or account connection.</p>
            <button v-hover v-for="name in library.notificationChannels" :key="name" class="glow" @click="openChannel(name)">
              <YtIcon name="bell" /><span>Visit {{ name }}</span>
            </button>
            <p v-if="!library.notificationChannels.length">Subscribe to a channel and turn on its bell to pin it here.</p>
          </template>
          <template v-else>
            <h3>Guest</h3>
            <p>Signed out. Your history stays on this headset.</p>
            <button v-hover class="glow" @click="feelingLucky()"><YtIcon name="play" />I'm feeling lucky</button>
            <button v-hover class="glow" @click="showModal('library')"><YtIcon name="history" />Your library</button>
            <button v-hover class="glow" @click="library.hidden = []; notify('Hidden videos restored.'); menu = undefined">
              <YtIcon name="home" />Restore hidden videos
            </button>
            <p>Independent portfolio client. Not the official YouTube app.</p>
          </template>
        </div>
      </div>
    </header>

    <div class="workspace">
      <nav class="sidebar vk-platter vk-scroll" aria-label="YouTube navigation">
        <template v-for="(item, index) in nav" :key="item.id">
          <span v-if="index === 3" class="you-label">You</span>
          <button v-hover :class="{ selected: page === item.id && !watching }" class="nav-item glow" :aria-label="item.title"
              :aria-current="page === item.id && !watching ? 'page' : undefined" @click="navigate(item.id)">
            <YtIcon :name="item.icon" /><span>{{ item.title }}</span>
          </button>
        </template>
        <p class="sidebar-note">Your shelf.<br />A little closer.</p>
      </nav>

      <main ref="content" class="content vk-scroll" :class="{ 'has-mini': mini }">
        <template v-if="watching && current">
          <div class="watch-grid">
            <div class="watch-main">
              <div ref="watchSlot" class="watch-slot" />
              <div class="player-tools">
                <button v-hover class="pill" @click="navigate('home')"><YtIcon name="back" />Browse</button>
                <span class="player-status" role="status">{{ status }}</span>
                <button v-hover class="icon-button" :aria-label="playing ? 'Pause video' : 'Play video'" @click="cancelCountdown(); togglePlayback()">
                  <YtIcon :name="playing ? 'pause' : 'play'" />
                </button>
                <button v-hover class="icon-button" :aria-label="muted ? 'Unmute' : 'Mute'" :aria-pressed="muted" @click="toggleMute()">
                  <YtIcon :name="muted ? 'close' : 'volume'" />
                </button>
                <button v-hover class="icon-button" aria-label="Cinema mode (T)" @click="toggleCinema"><YtIcon name="cinema" /></button>
                <button v-hover class="icon-button" aria-label="Mini player (I)" @click="navigate('home')"><YtIcon name="mini" /></button>
              </div>
              <h1 class="video-title">{{ current.title }}</h1>
              <div class="channel-actions">
                <button v-hover class="channel-avatar" :style="{ background: avatarColor(current.channel) }"
                  :aria-label="`Open ${current.channel} channel`" @click="openChannel(current.channel)">{{ current.channel[0] }}</button>
                <button v-hover class="channel-name" @click="openChannel(current.channel)">{{ current.channel }}<small>Channel</small></button>
                <button v-hover class="subscribe" :class="{ subscribed: library.subscriptions.includes(current.channel) }"
                  :aria-pressed="library.subscriptions.includes(current.channel)" @click="toggle('subscriptions', current.channel)">
                  {{ library.subscriptions.includes(current.channel) ? 'Subscribed' : 'Subscribe' }}
                </button>
                <button v-hover v-if="library.subscriptions.includes(current.channel)" class="icon-button"
                  :aria-label="library.notificationChannels.includes(current.channel) ? 'Turn off local channel reminders' : 'Turn on local channel reminders'"
                  :aria-pressed="library.notificationChannels.includes(current.channel)" @click="toggle('notificationChannels', current.channel)">
                  <YtIcon name="bell" />
                </button>
              </div>
              <div class="engagement">
                <div class="rating-pair">
                  <button v-hover class="pill" :aria-pressed="library.ratings[current.id] === 1" @click="rate(current.id, 1)">
                    <YtIcon name="like" />{{ library.ratings[current.id] === 1 ? 'Liked' : 'Like' }}
                  </button>
                  <button v-hover class="icon-button" aria-label="Dislike" :aria-pressed="library.ratings[current.id] === -1"
                    @click="rate(current.id, -1)"><YtIcon name="dislike" /></button>
                </div>
                <button v-hover class="pill" @click="showModal('share')"><YtIcon name="share" />Share</button>
                <button v-hover class="pill" @click="showModal('save')"><YtIcon name="save" />Save</button>
                <a class="pill" :href="`https://www.youtube.com/watch?v=${current.id}`" target="_blank" rel="noopener noreferrer">Watch on YouTube <YtIcon name="external" /></a>
              </div>
              <section class="description">
                <b>{{ current.year || 'Pasted link' }} · {{ current.duration }} · {{ current.category }}</b>
                <p>{{ current.title }}<br />By {{ current.channel }}.</p>
                <template v-if="descriptionExpanded">
                  <p>This is a locally curated video shelf inside your headset. Titles and channels come from YouTube.
                    Approximate runtimes are marked with ~. The player supplies live playback details.</p>
                  <p>Subscriptions, likes, playlists and comments here stay on this device and are not sent to YouTube.</p>
                  <p>Keyboard: K play/pause · J/L seek · M mute · T cinema · I mini player · Shift+N next · / search.</p>
                </template>
                <button v-hover @click="descriptionExpanded = !descriptionExpanded">{{ descriptionExpanded ? 'Show less' : 'Show more' }}</button>
              </section>
              <section class="comments">
                <h2>Comments <span class="local-badge">Local</span></h2>
                <p class="muted">Sample comments below are fictional. Yours stay on this headset.</p>
                <form class="comment-form" @submit.prevent="postComment">
                  <input v-model="comment" aria-label="Add a local comment" placeholder="Add a comment…" maxlength="1000" />
                  <button v-hover class="pill" :disabled="!comment.trim()">Comment</button>
                </form>
                <article v-for="entry in currentComments" :key="entry.id" class="comment-row">
                  <span class="comment-avatar">G</span>
                  <div><b>@headset-guest <small>Local</small></b><p>{{ entry.text }}</p></div>
                  <button v-hover class="icon-button" aria-label="Delete your comment"
                    @click="library.comments[current.id] = currentComments.filter(item => item.id !== entry.id)"><YtIcon name="close" /></button>
                </article>
                <article v-for="entry in [
                  { handle: '@cache-pigeon', text: 'Watched this in a headset. My tabs have never felt so seen.' },
                  { handle: '@semicolon-soup', text: 'One more video, then I will fix the bug. A documented lie.' },
                  { handle: '@pixel-turnip', text: 'The room is 3D. My attention span remains a single pixel.' },
                ]" :key="entry.handle" class="comment-row">
                  <span class="comment-avatar">{{ entry.handle[1]?.toUpperCase() }}</span>
                  <div><b>{{ entry.handle }} <small>Fictional</small></b><p>{{ entry.text }}</p></div>
                </article>
              </section>
            </div>
            <aside class="up-next">
              <div class="section-row"><h2>Up next</h2>
                <label class="autoplay">Autoplay
                  <input v-model="library.autoplay" type="checkbox" /><span />
                </label>
              </div>
              <button v-hover class="pill queue-toggle" :aria-expanded="queueOpen" @click="queueOpen = !queueOpen">
                <YtIcon name="playlist" />Queue · {{ library.queue.length }}
              </button>
              <section v-if="queueOpen" class="queue-panel">
                <div class="section-row"><b>Your queue</b><button v-hover class="pill" @click="library.queue = []">Clear</button></div>
                <p v-if="!library.queue.length" class="muted">Use a video's menu to add it here.</p>
                <div v-for="(id, index) in library.queue" :key="id" class="queue-row">
                  <button v-hover class="queue-title" @click="playResolved(id)">{{ resolve(id)?.title ?? 'Video unavailable' }}</button>
                  <button v-hover class="icon-button" aria-label="Move up in queue" :disabled="index === 0" @click="moveQueue(index, -1)"><YtIcon name="up" /></button>
                  <button v-hover class="icon-button" aria-label="Move down in queue" :disabled="index === library.queue.length - 1"
                    @click="moveQueue(index, 1)"><YtIcon name="down" /></button>
                  <button v-hover class="icon-button" aria-label="Remove from queue" @click="library.queue.splice(index, 1)"><YtIcon name="close" /></button>
                </div>
              </section>
              <YtVideoCard v-for="video in nextVideos.slice(0, 12)" :key="video.id" :video="video" small :progress="progress(video.id)"
                @play="playVideo" @channel="openChannel" @queue="addQueue" @save="saveLater" @hide="hideVideo" />
            </aside>
          </div>
        </template>

        <section v-else-if="page === 'shorts'" class="shorts-page" @wheel="shortWheel"
          @pointerdown="shortStart" @pointerup="shortEnd" @pointercancel="shortDrag = undefined">
          <div class="short-heading"><h1>Shorts</h1><span class="muted">Short videos from your shelf</span></div>
          <div class="short-layout">
            <div ref="shortsSlot" class="short-slot" />
            <div class="short-gesture" aria-hidden="true" />
            <div v-if="current" class="short-overlay">
              <button v-hover class="pill" @click="openChannel(current.channel)">{{ current.channel }}</button>
              <p>{{ current.title }}</p>
              <button v-hover class="pill" @click="expandPlayer">Open full video</button>
            </div>
            <div v-if="current" class="short-actions">
              <button v-hover :aria-pressed="library.ratings[current.id] === 1" @click="rate(current.id, 1)"><YtIcon name="like" /><span>Like</span></button>
              <button v-hover @click="showModal('comments')"><YtIcon name="comment" /><span>Comment</span></button>
              <button v-hover @click="showModal('share')"><YtIcon name="share" /><span>Share</span></button>
              <button v-hover :aria-label="playing ? 'Pause Short' : 'Play Short'" @click="togglePlayback"><YtIcon :name="playing ? 'pause' : 'play'" /></button>
              <button v-hover aria-label="Previous Short" @click="stepShort(-1)"><YtIcon name="up" /></button>
              <button v-hover aria-label="Next Short" @click="stepShort(1)"><YtIcon name="down" /></button>
            </div>
          </div>
          <p class="short-hint">Swipe the caption, scroll, or use ↑ / ↓
            · {{ shortIndex + 1 }} / {{ shorts.length }}</p>
        </section>

        <template v-else>
          <div v-if="page === 'home'" class="chips vk-scroll" aria-label="Video categories">
            <button v-hover v-for="chip in ['All', 'Trending', ...categories, 'Recently uploaded', 'Watched']" :key="chip"
              :class="{ active: category === chip }" :aria-pressed="category === chip" @click="category = chip">{{ chip }}</button>
          </div>
          <div class="browse-body">
            <section v-if="page === 'channel'" class="channel-header">
              <span class="large-avatar" :style="{ background: avatarColor(channel) }">{{ channel[0] }}</span>
              <div><h1>{{ channel }}</h1><p>{{ filtered.length }} videos on this shelf</p>
                <button v-hover class="subscribe" :aria-pressed="library.subscriptions.includes(channel)" @click="toggle('subscriptions', channel)">
                  {{ library.subscriptions.includes(channel) ? 'Subscribed' : 'Subscribe' }}
                </button>
              </div>
            </section>
            <div v-else-if="!(page === 'home' && category === 'All')" class="section-row page-heading">
              <div><h1>{{ heading }}</h1><p v-if="page === 'home'" class="muted">A window into things worth watching.</p></div>
              <button v-hover v-if="page === 'playlists'" class="pill" @click="newPlaylist()"><YtIcon name="create" />Create</button>
              <button v-hover v-if="['later', 'liked', 'playlist'].includes(page)" class="pill" :disabled="!filtered.length" @click="playAll(filtered)">
                <YtIcon name="play" />Play all
              </button>
              <button v-hover v-if="page === 'history'" class="pill" @click="library.history = []; notify('Watch history cleared.')">Clear history</button>
            </div>
            <template v-if="page === 'playlists'">
              <div class="playlist-grid">
                <article v-for="list in library.playlists" :key="list.id" class="playlist-card glow">
                  <button v-hover class="playlist-art" @click="playlistId = list.id; navigate('playlist')"><YtIcon name="playlist" /></button>
                  <button v-hover class="playlist-title" @click="playlistId = list.id; navigate('playlist')">{{ list.name }}</button>
                  <p class="muted">{{ list.videos.length }} videos · Local playlist</p>
                  <div class="playlist-tools">
                    <button v-hover class="pill" @click="playAll(list.videos.map(resolve).filter((video): video is Video => !!video))">Play all</button>
                    <button v-hover class="icon-button" :aria-label="`Rename ${list.name}`" @click="newPlaylist(list.id, list.name)"><YtIcon name="more" /></button>
                    <button v-hover class="icon-button" :aria-label="`Delete ${list.name}`"
                      @click="library.playlists = library.playlists.filter(item => item.id !== list.id); notify('Playlist deleted.')"><YtIcon name="close" /></button>
                  </div>
                </article>
              </div>
              <div v-if="!library.playlists.length" class="empty-state"><YtIcon name="playlist" /><h2>Make a shelf within a shelf.</h2>
                <p>Create a playlist, then use Save on a video to add it.</p><button v-hover class="pill" @click="newPlaylist()">Create playlist</button>
              </div>
            </template>
            <template v-else>
              <div v-if="page === 'search' && pendingLink" class="link-result glow">
                <YtIcon name="play" /><div><b>Play this video</b><p>{{ pendingLink }}</p></div>
                <button v-hover class="pill" @click="playPasted(query)">Play</button>
              </div>
              <section v-if="page === 'home' && category === 'All'" class="home-first-screen">
                <section class="screening-room vk-platter">
                  <button v-hover class="screening-art" aria-label="Watch Spring by Blender Studio" @click="catalogue[2] && playVideo(catalogue[2])"><YtThumbnail id="WhWc3b3KhnY" title="Spring — Blender Open Movie" /><span class="spotlight-play"><YtIcon name="play" /></span></button>
                  <div class="screening-copy"><p class="screening-eyebrow">THE SCREENING ROOM · BLENDER STUDIO</p><h1>Small films.<br />Extraordinary worlds.</h1><p class="muted">A little wonder looks even better here.</p><div><button v-hover class="pill spotlight-button" @click="catalogue[2] && playVideo(catalogue[2])"><YtIcon name="play" />Watch Spring</button><button v-hover class="pill" @click="category = 'Film'">Explore films <YtIcon name="forward" /></button></div></div>
                </section>
                <div class="home-section-heading"><h2>For your space</h2><span>Handpicked. Worth your time.</span></div>
                <div class="video-grid featured-grid"><YtVideoCard v-for="video in filtered.slice(0,3)" :key="video.id" :video="video" :progress="progress(video.id)" @play="playVideo" @channel="openChannel" @queue="addQueue" @save="saveLater" @hide="hideVideo" /></div>
              </section>
              <h2 v-if="page === 'home' && category === 'All'" class="more-discoveries">Keep exploring</h2>
              <div class="video-grid">
                <YtVideoCard v-for="video in (page === 'home' && category === 'All' ? filtered.slice(3) : filtered)" :key="video.id" :video="video" :progress="progress(video.id)"
                  :query="page === 'search' ? query : undefined" :removable="removable"
                  @play="playVideo" @channel="openChannel" @queue="addQueue" @save="saveLater" @hide="hideVideo" @remove="removeVideo" />
              </div>
              <div v-if="!filtered.length && !pendingLink" class="empty-state">
                <YtIcon :name="page === 'search' ? 'search' : 'playlist'" /><h2>{{ page === 'search' ? 'No videos on this shelf match.' : 'A little quiet in here.' }}</h2>
                <p>{{ page === 'subscriptions' ? 'Subscribe from a video or channel to fill this shelf.' : 'Find something on Home, or paste a YouTube link.' }}</p>
                <button v-hover class="pill" @click="navigate('home')">Browse Home</button>
              </div>
              <p v-if="page === 'search'" class="search-note">
                Searching all of YouTube needs YouTube's own API key. This client searches its own shelf and plays any link you paste.
              </p>
            </template>
            <p class="client-note">Independent YouTube client for this portfolio · Local library, real videos</p>
          </div>
        </template>
      </main>
    </div>

    <nav class="bottom-tabs" aria-label="Main destinations">
      <button v-hover v-for="item in nav.slice(0, 3)" :key="item.id" :class="{ active: page === item.id && !watching }"
        @click="navigate(item.id)"><YtIcon :name="item.icon" /><span>{{ item.title }}</span></button>
      <button v-hover :class="{ active: ['history', 'playlists', 'later', 'liked', 'playlist'].includes(page) && !watching }"
        @click="showModal('library')"><YtIcon name="playlist" /><span>You</span></button>
    </nav>

    <!-- Position the same surface over its slot; reparenting an iframe can reload playback. -->
    <div v-show="current" class="player-stage" :class="{ mini, cinema, 'short-player': page === 'shorts' && !watching }" :style="stageStyle">
      <div class="player-picture">
        <div ref="screen" class="iframe-host" />
        <div v-if="current && (!ready || error)" class="player-curtain" role="status">
          <YtIcon v-if="!error" name="play" />
          <p>{{ error || status }}</p>
          <template v-if="error">
            <button v-hover class="pill" @click="cancelCountdown(); togglePlayback()">Retry</button>
            <a :href="`https://www.youtube.com/watch?v=${current.id}`" target="_blank" rel="noopener noreferrer">Watch on YouTube <YtIcon name="external" /></a>
          </template>
        </div>
      </div>
      <div v-if="mini && current" class="mini-toolbar" aria-label="Drag the bottom grip to move the mini player" @pointerdown="startMiniDrag" @pointermove="moveMini"
        @pointerup="endMini" @pointercancel="endMini">
        <button v-hover class="mini-title" aria-label="Expand mini player" @click="expandPlayer">{{ current.title }}</button>
        <button v-hover class="icon-button" :aria-label="playing ? 'Pause video' : 'Play video'" @click="togglePlayback">
          <YtIcon :name="playing ? 'pause' : 'play'" />
        </button>
        <button v-hover class="icon-button" aria-label="Expand video" @click="expandPlayer"><YtIcon name="mini" /></button>
        <button v-hover class="icon-button" aria-label="Close mini player" @click="closePlayer"><YtIcon name="close" /></button>
        <span class="drag-grip" aria-hidden="true" />
      </div>
      <div v-if="cinema && current" class="cinema-toolbar">
        <button v-hover class="pill" @click="toggleCinema"><YtIcon name="back" />Exit cinema</button>
        <span>{{ current.title }}</span>
        <button v-hover class="icon-button" :aria-label="playing ? 'Pause video' : 'Play video'" @click="togglePlayback">
          <YtIcon :name="playing ? 'pause' : 'play'" />
        </button>
        <button v-hover class="icon-button" aria-label="Next video" @click="playNext"><YtIcon name="next" /></button>
      </div>
    </div>

    <div v-if="countdown" class="countdown" role="status">
      <div><b>{{ countdownReason === 'error' ? 'Skipping unavailable video' : 'Up next' }} in {{ countdown }}s</b>
        <span>{{ nextVideos[0]?.title }}</span></div>
      <button v-hover class="pill" @click="cancelCountdown">Cancel</button><button v-hover class="pill" @click="playNext">Play now</button>
    </div>
    <p v-if="notice || storageWarning" class="toast" role="status">{{ notice || storageWarning }}</p>

    <div v-if="modal" class="modal-backdrop" @click.self="modal = undefined">
      <section class="dialog" role="dialog" aria-modal="true" :aria-label="modal === 'library' ? 'Your library' : modal"
        @keydown.tab="trapFocus" ref="dialog">
        <div class="section-row"><h2>{{ dialogTitle }}</h2>
          <button v-hover class="icon-button" aria-label="Close dialog" @click="modal = undefined"><YtIcon name="close" /></button>
        </div>
        <template v-if="modal === 'share'">
          <p>Share the real YouTube video.</p>
          <input ref="shareInput" :value="shareLink" readonly aria-label="Share link" @focus="shareInput?.select()" />
          <button v-hover class="pill primary" @click="copyLink">Copy link</button>
        </template>
        <form v-else-if="modal === 'paste'" class="dialog-form" @submit.prevent="playPasted(paste)">
          <label>YouTube link or video ID<input v-model="paste" placeholder="https://youtu.be/…" maxlength="500" /></label>
          <button v-hover class="pill primary">Play video</button>
        </form>
        <form v-else-if="modal === 'playlist'" class="dialog-form" @submit.prevent="commitPlaylist">
          <label>Playlist name<input v-model="playlistName" maxlength="100" placeholder="One more video" /></label>
          <button v-hover class="pill primary" :disabled="!playlistName.trim()">{{ editingPlaylist ? 'Rename' : 'Create' }}</button>
        </form>
        <template v-else-if="modal === 'save' && modalVideo">
          <label class="save-option"><input type="checkbox" :checked="library.later.includes(modalVideo.id)"
            @change="toggle('later', modalVideo.id)" />Watch later</label>
          <label v-for="list in library.playlists" :key="list.id" class="save-option">
            <input type="checkbox" :checked="list.videos.includes(modalVideo.id)" @change="togglePlaylist(list.id)" />{{ list.name }}
          </label>
          <button v-hover class="pill" @click="newPlaylist()"><YtIcon name="create" />New playlist</button>
        </template>
        <template v-else-if="modal === 'library'">
          <button v-hover v-for="item in nav.slice(3)" :key="item.id" class="library-destination glow" @click="navigate(item.id)">
            <YtIcon :name="item.icon" />{{ item.title }}
          </button>
          <p>Signed out. Your history stays on this headset.</p>
        </template>
        <template v-else-if="modal === 'comments'">
          <p>These comments stay on this headset.</p>
          <p class="sample-short-comment"><b>@buffer-biscuit · Fictional</b><br />A short video. A suspiciously long watch session.</p>
          <article v-for="entry in currentComments" :key="entry.id"><b>@headset-guest · Local</b><p>{{ entry.text }}</p></article>
          <form class="dialog-form" @submit.prevent="postComment">
            <input v-model="comment" aria-label="Add a local comment" maxlength="1000" placeholder="Add a comment…" />
            <button v-hover class="pill primary" :disabled="!comment.trim()">Comment</button>
          </form>
        </template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.vision-youtube {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
  container-type: size;
  isolation: isolate;
  color: #f1f1f1;
  background: #0f0f0ff7;
  font-family: Roboto, -apple-system, "Segoe UI", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color-scheme: dark;
  --raised: #272727;
  --border: #303030;
}
.vision-youtube:focus-visible {
  outline: 2px solid #8ecbff;
  outline-offset: -3px;
}
.vision-youtube :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}
button, input, textarea, select, a {
  font: inherit;
}
button {
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
button:disabled {
  opacity: .45;
  cursor: default;
}
button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
  outline: 2px solid #8ecbff;
  outline-offset: 2px;
}
a {
  color: #9bcaff;
  text-decoration: none;
}
p {
  margin: 8px 0;
}
h1, h2, h3 {
  margin: 0;
  font-weight: 650;
}
h1 {
  font-size: 24px;
  line-height: 1.3;
  letter-spacing: -.4px;
}
h2 {
  font-size: 18px;
}
h3 {
  font-size: 16px;
}
.icon-button {
  width: 44px;
  height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}
.icon-button:hover, .icon-button[aria-pressed="true"] {
  background: #ffffff1a;
}
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 16px;
  border-radius: 24px;
  color: #f1f1f1;
  background: var(--raised);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.pill:hover {
  background: #3f3f3f;
}
.pill[aria-pressed="true"] {
  color: #fff;
  background: #4b4b4b;
}
.primary {
  color: #0f0f0f;
  background: #8ecbff;
}
.primary:hover {
  background: #b5dcff;
}
.glow:hover {
  background: radial-gradient(160px at var(--x, 50%) var(--y, 50%), #ffffff1c, #ffffff08);
}
.topbar {
  flex: 0 0 64px;
  display: grid;
  grid-template-columns: auto minmax(100px, 620px) auto;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 8px 20px 8px 12px;
  background: #0f0f0f;
  position: relative;
  z-index: 20;
  border-bottom: 1px solid #ffffff06;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
}
.logo svg {
  width: 116px;
  height: 30px;
  display: block;
}
.vision-label {
  align-self: flex-start;
  margin-top: 4px;
  font-size: 12px;
  color: #aaa;
  letter-spacing: .6px;
}
.search-area {
  position: relative;
  width: 100%;
}
.search-form {
  height: 44px;
  display: flex;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: #121212;
  overflow: hidden;
}
.search-form:focus-within {
  border-color: #3e8ed0;
}
.search-form input {
  flex: 1;
  width: 0;
  min-width: 0;
  background: none;
  color: inherit;
  padding: 0 16px;
  border: 0;
  outline: none;
  font-size: 15px;
}
.search-form input:focus-visible {
  outline: none;
}
.search-submit {
  display: grid;
  place-items: center;
  width: 60px;
  flex-shrink: 0;
  background: #222;
  border-left: 1px solid var(--border);
}
.search-submit:hover {
  background: #333;
}
.clear-search {
  width: 44px;
  height: 42px;
}
.suggestions {
  position: absolute;
  top: 52px;
  width: 100%;
  padding: 8px;
  background: #272727;
  border: 1px solid #414141;
  border-radius: 16px;
  box-shadow: 0 16px 36px #0009;
}
.suggestions button {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
  gap: 12px;
  border-radius: 10px;
  padding: 8px;
  text-align: left;
}
.suggestions span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.top-actions {
  position: relative;
  display: flex;
  gap: 4px;
  align-items: center;
}
.guest-avatar {
  margin-left: 8px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #68436c;
  color: #fff;
  font-weight: 600;
}
.notification-button {
  position: relative;
}
.notification-dot {
  position: absolute;
  right: 8px;
  top: 7px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f03;
}
.popover {
  position: absolute;
  top: 52px;
  right: 0;
  width: min(320px, 88cqw);
  max-height: 65cqh;
  padding: 16px;
  border: 1px solid #444;
  background: #282828;
  border-radius: 20px;
  box-shadow: 0 20px 40px #000b;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.popover p {
  color: #b7b7b7;
  font-size: 13px;
  line-height: 1.5;
}
.popover button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 48px;
  padding: 8px;
  border-radius: 10px;
  text-align: left;
}
.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  background: #0f0f0f;
}
.sidebar {
  flex: 0 0 208px;
  padding: 12px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #444 transparent;
  overscroll-behavior: contain;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 48px;
  padding: 10px 12px;
  width: 100%;
  border-radius: 12px;
  text-align: left;
}
.nav-item.selected {
  background: #272727;
  font-weight: 650;
}
.you-label {
  display: block;
  margin: 16px 0 8px;
  padding: 14px 12px 0;
  border-top: 1px solid var(--border);
  font-weight: 650;
}
.sidebar-note {
  padding: 20px 12px;
  color: #777;
  font-size: 12px;
  line-height: 1.6;
}
.content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: #555 #151515;
}
.content::-webkit-scrollbar {
  width: 6px;
}
.content::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}
.chips {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 22px;
  min-height: 60px;
  position: sticky;
  top: 0;
  z-index: 9;
  background: #0f0f0f;
  overflow-x: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.chips button {
  min-height: 44px;
  white-space: nowrap;
  border-radius: 10px;
  padding: 0 14px;
  background: #272727;
  font-size: 13px;
  font-weight: 600;
}
.chips button:hover {
  background: #3f3f3f;
}
.chips button.active {
  color: #0f0f0f;
  background: #f1f1f1;
}
.browse-body {
  padding: 10px 22px 24px;
}
.page-heading {
  margin: 10px 6px 20px;
  gap: 12px;
}
.section-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px 10px;
}
.muted {
  color: #aaa;
  font-size: 13px;
}
.client-note {
  color: #818181;
  font-size: 12px;
  padding: 28px 6px 4px;
}
.empty-state {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 30px 12px;
}
.empty-state :deep(svg) {
  width: 44px;
  height: 44px;
}
.empty-state p {
  color: #aaa;
  max-width: 320px;
  margin: 0;
}
.link-result {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 18px;
  margin-bottom: 20px;
  background: #202020;
}
.link-result div {
  flex: 1;
}
.link-result p {
  color: #aaa;
  margin: 3px 0 0;
}
.search-note {
  font-size: 13px;
  color: #b0b0b0;
  line-height: 1.6;
  margin: 24px 6px;
}
.watch-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
  padding: 20px;
}
.watch-main {
  min-width: 0;
}
.watch-slot {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 16px;
}
.video-title {
  margin: 10px 0 16px;
  font-size: 21px;
  line-height: 1.35;
}
.player-tools {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 6px 0;
}
.player-tools .pill {
  padding: 8px 12px;
}
.player-status {
  font-size: 12px;
  color: #aaa;
  flex: 1;
  padding-left: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.channel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.channel-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  font-size: 19px;
  flex-shrink: 0;
}
.channel-name {
  min-height: 44px;
  text-align: left;
  font-weight: 650;
  margin-right: auto;
  max-width: 45%;
}
.channel-name small {
  display: block;
  color: #aaa;
  font-size: 12px;
  font-weight: 400;
}
.subscribe {
  min-height: 44px;
  border-radius: 24px;
  color: #0f0f0f;
  background: #f1f1f1;
  font-weight: 650;
  padding: 10px 16px;
}
.subscribe:hover {
  background: #d9d9d9;
}
.subscribe.subscribed {
  color: #f1f1f1;
  background: #272727;
}
.engagement {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.rating-pair {
  display: flex;
  border-radius: 24px;
  background: #272727;
}
.rating-pair .pill {
  border-radius: 24px 0 0 24px;
  border-right: 1px solid #4a4a4a;
}
.description {
  margin: 18px 0 24px;
  padding: 16px;
  background: #272727;
  border-radius: 18px;
  font-size: 13px;
  line-height: 1.55;
}
.description button {
  min-height: 44px;
  font-weight: 650;
}
.local-badge {
  display: inline-block;
  color: #a4ceff;
  background: #24415a;
  border-radius: 4px;
  font-size: 12px;
  padding: 2px 6px;
  vertical-align: middle;
  margin-left: 5px;
}
.comments h2 {
  margin-bottom: 8px;
}
.comment-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0;
}
.comment-form input {
  min-width: 0;
  width: 0;
  flex: 1;
  background: transparent;
  color: #eee;
  border: 0;
  border-bottom: 1px solid #555;
  min-height: 44px;
  padding: 8px;
}
.comment-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
  font-size: 13px;
}
.comment-row > div {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.comment-avatar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #43434b;
  flex-shrink: 0;
}
.comment-row small {
  color: #aaa;
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
.comment-row p {
  margin: 4px 0;
}
.up-next {
  min-width: 0;
}
.up-next > .section-row {
  margin: 0 0 10px;
}
.autoplay {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  font-size: 12px;
  position: relative;
  cursor: pointer;
}
.autoplay input {
  position: absolute;
  right: 0;
  width: 40px;
  height: 44px;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.autoplay span {
  width: 34px;
  height: 18px;
  border-radius: 12px;
  background: #666;
  pointer-events: none;
}
.autoplay span::after {
  content: "";
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #eee;
}
.autoplay input:checked + span {
  background: #a4ceff;
}
.autoplay input:checked + span::after {
  transform: translateX(16px);
  background: #2469a0;
}
.autoplay input:focus-visible + span {
  outline: 2px solid #8ecbff;
  outline-offset: 4px;
}
.queue-toggle {
  width: 100%;
  justify-content: flex-start;
  margin-bottom: 12px;
}
.queue-panel {
  padding: 12px;
  background: #222;
  border: 1px solid #383838;
  border-radius: 16px;
  margin-bottom: 16px;
  max-height: 310px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
.queue-row {
  display: flex;
  align-items: center;
  border-top: 1px solid #383838;
  padding: 8px 0;
}
.queue-title {
  min-width: 0;
  flex: 1;
  text-align: left;
  font-size: 12px;
  min-height: 44px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.channel-header {
  display: flex;
  align-items: center;
  gap: 20px;
  background: linear-gradient(120deg, #252525, #161616);
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 24px;
}
.large-avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 34px;
  flex-shrink: 0;
}
.channel-header p {
  color: #aaa;
}
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 18px;
}
.playlist-card {
  padding: 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: #1c1c1c;
}
.playlist-art {
  height: 130px;
  width: 100%;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(135deg, #38516b, #1f2733);
}
.playlist-art :deep(svg) {
  width: 44px;
  height: 44px;
}
.playlist-title {
  min-height: 44px;
  font-size: 17px;
  font-weight: 650;
  text-align: left;
  width: 100%;
  overflow-wrap: anywhere;
  padding: 8px 0;
}
.playlist-tools {
  display: flex;
  gap: 4px;
  align-items: center;
}
.bottom-tabs {
  display: none;
  flex-shrink: 0;
  height: 64px;
  background: #161616;
  border-top: 1px solid #303030;
  z-index: 20;
}
.bottom-tabs button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3px;
  min-height: 56px;
  color: #b4b4b4;
  font-size: 12px;
}
.bottom-tabs .active {
  color: white;
  background: #ffffff0b;
}
.player-stage {
  position: absolute;
  z-index: 8;
  background: #000;
  border-radius: 16px;
}
.player-picture {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background: #000;
}
.iframe-host {
  position: absolute;
  inset: 0;
}
.iframe-host :deep(iframe) {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.player-curtain {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
  background: #080808;
}
.player-curtain p {
  max-width: 400px;
  font-size: 13px;
  margin: 0;
}
.player-curtain a {
  min-height: 44px;
  display: grid;
  place-items: center;
  font-size: 13px;
}
.player-stage.mini {
  z-index: 25;
  border: 1px solid #555;
  box-shadow: 0 8px 32px #000b;
  overflow: hidden;
}
.mini .player-picture {
  height: calc(100% - 62px);
  border-radius: 16px 16px 0 0;
}
.mini-toolbar {
  position: relative;
  height: 62px;
  display: flex;
  align-items: center;
  padding: 0 4px 10px 10px;
  background: #242424;
  cursor: grab;
  touch-action: none;
}
.mini-title {
  flex: 1;
  min-width: 0;
  text-align: left;
  min-height: 44px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drag-grip {
  position: absolute;
  bottom: 3px;
  height: 5px;
  width: 48px;
  border-radius: 4px;
  background: #666;
  left: calc(50% - 24px);
}
.player-stage.cinema {
  z-index: 40;
  border-radius: inherit;
}
.cinema .player-picture {
  height: calc(100% - 56px);
}
.cinema-toolbar {
  height: 56px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #181818;
}
.cinema-toolbar > span {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shorts-page {
  padding: 16px 20px;
  min-height: 100%;
}
.short-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}
.short-layout {
  position: relative;
  width: fit-content;
  margin: auto;
  padding-right: 66px;
}
.short-slot {
  aspect-ratio: 9 / 16;
  height: max(180px, min(640px, calc(100cqh - 170px)));
  border-radius: 20px;
  background: #000;
}
.short-gesture {
  position: absolute;
  inset: 0 66px 0 0;
  z-index: 9;
  touch-action: none;
}
.short-overlay {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 78px;
  padding: 16px 4px 0;
  z-index: 10;
  color: #fff;
  text-shadow: 0 1px 4px #000;
  background: linear-gradient(transparent, #000b);
  touch-action: none;
}
.short-overlay p {
  font-size: 14px;
  line-height: 1.35;
}
.short-overlay .pill {
  background: #272727e8;
  padding: 8px 12px;
}
.short-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 56px;
  z-index: 10;
}
.short-actions button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border-radius: 20px;
  background: #272727;
  gap: 2px;
}
.short-actions span {
  font-size: 12px;
}
.short-actions button:hover, .short-actions button[aria-pressed="true"] {
  background: #454545;
}
.short-player .iframe-host :deep(iframe) {
  position: absolute;
  width: 316.05%;
  left: 50%;
  transform: translateX(-50%);
}
.short-hint {
  text-align: center;
  color: #aaa;
  font-size: 12px;
  margin-top: 16px;
}
.countdown {
  position: absolute;
  z-index: 45;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(680px, calc(100% - 24px));
  border: 1px solid #666;
  border-radius: 20px;
  padding: 16px;
  background: #282828;
  box-shadow: 0 10px 40px #000c;
}
.countdown > div {
  flex: 1;
  min-width: 0;
}
.countdown span {
  display: block;
  font-size: 12px;
  color: #aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toast {
  position: absolute;
  z-index: 60;
  left: 50%;
  transform: translateX(-50%);
  bottom: 78px;
  width: max-content;
  max-width: calc(100% - 32px);
  padding: 12px 18px;
  border-radius: 14px;
  background: #333;
  border: 1px solid #555;
  box-shadow: 0 8px 30px #0009;
  font-size: 13px;
  pointer-events: none;
}
.modal-backdrop {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #0009;
}
.dialog {
  width: min(440px, 100%);
  max-height: 90cqh;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  padding: 20px;
  border-radius: 24px;
  background: #282828;
  border: 1px solid #555;
  box-shadow: 0 20px 70px #000b;
}
.dialog p {
  font-size: 13px;
  color: #bbb;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.dialog input:not([type="checkbox"]) {
  width: 100%;
  min-height: 44px;
  border: 1px solid #626262;
  border-radius: 10px;
  background: #161616;
  color: #f1f1f1;
  padding: 10px 12px;
  margin: 10px 0 16px;
}
.dialog-form {
  margin-top: 12px;
}
.dialog label {
  font-size: 14px;
}
.save-option {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 48px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.save-option input {
  accent-color: #8ecbff;
  width: 20px;
  height: 20px;
}
.library-destination {
  display: flex;
  width: 100%;
  gap: 12px;
  align-items: center;
  min-height: 48px;
  padding: 8px;
  border-radius: 12px;
}
.sample-short-comment {
  padding: 12px;
  background: #ffffff09;
  border-radius: 12px;
}
.collapsed .sidebar {
  flex-basis: 72px;
  padding: 8px;
}
.collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;
}
.collapsed .nav-item span, .collapsed .you-label, .collapsed .sidebar-note {
  display: none;
}
@container (min-width: 1180px) {
  .watch-grid {
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 24px;
  }
}
@container (min-width: 1500px) {
  .sidebar {
    flex-basis: 224px;
  }
  .video-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 24px 14px;
  }
  .watch-grid {
    grid-template-columns: minmax(0, 1fr) 380px;
  }
}
@container (max-width: 1000px) {
  .sidebar {
    flex-basis: 72px;
    padding: 8px;
  }
  .nav-item {
    justify-content: center;
    padding: 10px 0;
  }
  .nav-item span, .you-label, .sidebar-note {
    display: none;
  }
  .topbar {
    gap: 12px;
    padding-right: 12px;
  }
  .vision-label {
    display: none;
  }
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  }
}
@container (max-width: 640px) {
  .topbar {
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    flex-basis: 112px;
    padding: 6px 12px 10px;
  }
  .brand {
    grid-column: 1;
    grid-row: 1;
  }
  .rail-toggle {
    display: none;
  }
  .top-actions {
    grid-column: 2;
    grid-row: 1;
  }
  .search-area {
    grid-row: 2;
    grid-column: 1 / -1;
  }
  .search-submit {
    width: 48px;
  }
  .sidebar {
    display: none;
  }
  .bottom-tabs {
    display: flex;
  }
  .popover {
    top: 48px;
  }
  .browse-body {
    padding: 6px 12px 20px;
  }
  .chips {
    padding: 8px 12px;
    min-height: 60px;
  }
  .video-grid {
    grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
    gap: 12px;
  }
  .watch-grid {
    padding: 12px;
    gap: 16px;
  }
  .player-status {
    display: none;
  }
  .player-tools {
    justify-content: space-between;
    gap: 0;
  }
  .video-title {
    font-size: 18px;
  }
  .channel-actions {
    gap: 6px;
  }
  .channel-name {
    font-size: 13px;
  }
  .subscribe {
    padding: 8px 12px;
  }
  .engagement {
    gap: 6px;
  }
  .pill {
    padding: 8px 12px;
  }
  .page-heading h1 {
    font-size: 22px;
  }
  .page-heading {
    flex-wrap: wrap;
  }
  .channel-header {
    padding: 16px;
    gap: 14px;
  }
  .channel-header h1 {
    font-size: 21px;
  }
  .large-avatar {
    width: 64px;
    height: 64px;
  }
  .countdown {
    bottom: 72px;
    flex-wrap: wrap;
    padding: 12px;
    gap: 8px;
    font-size: 13px;
  }
  .countdown > div {
    flex-basis: 100%;
  }
  .shorts-page {
    padding: 12px;
  }
  .short-heading {
    margin-bottom: 10px;
  }
  .short-heading .muted {
    font-size: 12px;
  }
  .short-slot {
    height: max(140px, min(calc(100cqh - 250px), calc((100cqw - 92px) * 16 / 9)));
  }
  .short-overlay {
    right: 74px;
    bottom: 6px;
    left: 6px;
    padding: 8px 4px 0;
  }
  .short-overlay p {
    font-size: 12px;
    max-height: 48px;
    overflow: hidden;
  }
  .short-overlay .pill {
    font-size: 12px;
    padding: 6px 8px;
  }
  .short-actions {
    gap: 2px;
  }
  .short-actions button {
    min-height: 44px;
  }
  .cinema-toolbar > span {
    display: none;
  }
  .cinema-toolbar .pill {
    margin-right: auto;
  }
  .has-mini {
    padding-bottom: 220px;
  }
}
@container (max-height: 420px) {
  .short-actions {
    flex-direction: row;
    width: auto;
    left: 0;
    right: 0;
    bottom: -54px;
  }
  .short-actions button {
    flex: 1;
    min-width: 44px;
  }
  .short-gesture {
    right: 0;
  }
  .short-layout {
    padding-right: 0;
    margin-bottom: 60px;
  }
  .short-slot {
    height: max(120px, calc(100cqh - 250px));
  }
  .short-overlay {
    right: 6px;
  }
  .short-overlay p, .short-overlay .pill:last-child {
    display: none;
  }
  .popover {
    max-height: 60cqh;
  }
}
@media (prefers-reduced-motion: reduce) {
  .vision-youtube :deep(*) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

button, .pill, .icon-button {
  transition: transform .22s ease-out, opacity .22s ease-out;
}
button:not(:disabled):active, a.pill:active {
  transform: scale(.97);
}
.video-title, .channel-name, .page-heading h1 {
  overflow-wrap: anywhere;
}
.client-note, .sidebar-note {
  color: #aaa;
}
@container (max-width: 640px) {
  .page-heading {
    margin: 8px 6px 12px;
  }
  .page-heading p {
    margin-block: 5px;
  }
  .video-grid, .playlist-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .bottom-tabs {
    height: 60px;
  }
  .channel-name {
    max-width: calc(100% - 50px);
    flex: 1;
  }
  .player-tools .pill {
    padding-inline: 10px;
  }
  .search-form input {
    padding-left: 12px;
    font-size: 14px;
  }
  .channel-header {
    flex-wrap: wrap;
  }
}
@media (prefers-reduced-motion: reduce) {
  button:not(:disabled):active, a.pill:active {
    transform: none;
  }
}

.vision-youtube { position:relative; width:100%; height:100%; inset:auto; color:var(--vk-text,#fff); font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','SF Pro Text','Helvetica Neue',sans-serif; background:linear-gradient(145deg,#1b283ba6,#131a2355); --raised:#ffffff14; --border:#ffffff20; }
.topbar { background:#ffffff04; border-bottom:1px solid #ffffff0e; padding:12px 22px; gap:24px; min-height:72px; }
.workspace { background:transparent; }
.search-form { background:#00000024; border-color:#ffffff16; box-shadow:inset 0 1px 3px #0002; }
.search-submit { background:#ffffff0a; border-left-color:#ffffff12; }
.sidebar { flex-basis:180px; margin:14px 0 20px 14px; border-radius:26px; padding:10px; background:#ffffff08; align-self:flex-start; max-height:calc(100% - 34px); }
.nav-item { min-height:48px; border-radius:18px; font-size:13px; gap:13px; }
.nav-item.selected { background:#ffffffd9; color:#1c2431; }
.you-label { margin-top:12px; font-size:12px; color:#ffffff9c; border-color:#ffffff16; }
.sidebar-note { font-size:11.5px; color:#ffffff7a; padding:14px 12px; }
.content { background:transparent; }
.chips { background:#353c45d9; backdrop-filter:blur(24px); padding:8px 22px; min-height:60px; }
.chips button { border-radius:999px; background:#ffffff0b; font-size:12px; min-height:44px; }
.browse-body { padding:14px 22px 28px; }
.home-first-screen { min-height:calc(100cqh - 164px); }
.screening-room { display:grid; grid-template-columns:44% 1fr; gap:24px; align-items:center; padding:0; overflow:hidden; border-radius:24px; background:linear-gradient(115deg,#2a3a51,#34565566); height:190px; }
.screening-art { position:relative; height:100%; overflow:hidden; }
.screening-art :deep(.yt-thumbnail) { height:100%; border-radius:0; aspect-ratio:auto; }
.screening-art::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent,#253c4840); pointer-events:none; }
.spotlight-play { position:absolute; display:grid; place-items:center; width:48px; height:48px; border:1px solid #ffffff50; border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%); background:#ffffff22; backdrop-filter:blur(12px); }
.screening-copy { padding:16px 20px 16px 0; }
.screening-eyebrow { font-size:8px; letter-spacing:.15em; color:#dbf0e6; margin:0 0 8px; font-weight:650; }
.screening-copy h1 { font-size:30px; line-height:1.05; letter-spacing:-.035em; font-weight:700; }
.screening-copy .muted { font-size:12px; margin:8px 0 10px; color:#ffffffae; }
.screening-copy>div { display:flex; gap:8px; }
.screening-copy .pill { font-size:12px; padding:0 12px; }
.spotlight-button { background:#f4f7f6; color:#1b2733; }
.home-section-heading { display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin:20px 4px 10px; }
.home-section-heading h2 { font-size:21px; letter-spacing:-.025em; }
.home-section-heading>span { color:#ffffff9c; font-size:12px; }
.video-grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px 14px; }
.more-discoveries { margin:20px 6px 14px; font-size:23px; }
.popover,.dialog { background:linear-gradient(145deg,#ffffff16,#ffffff06),#343b46f2; border-color:#ffffff29; border-radius:26px; }
.bottom-tabs { flex:none; border-top:1px solid #ffffff20; border-radius:0; background:#3e444edb; backdrop-filter:blur(25px); }
@container(max-height:560px) and (min-width:641px) { .topbar { min-height:64px; padding-block:8px; } .screening-room { height:130px; grid-template-columns:37% 1fr; gap:18px; } .screening-copy h1 { font-size:25px; } .screening-copy h1 br { display:none; } .screening-copy .muted { display:none; } .screening-copy>div { margin-top:10px; } .screening-copy .pill { min-height:44px; } .home-section-heading { margin-top:14px; } .home-first-screen { min-height:calc(100cqh - 150px); } }
@container(max-width:1000px) and (min-width:641px) { .sidebar { flex-basis:64px; padding:6px; margin-left:10px; } .nav-item { justify-content:center; padding:8px 0; }.nav-item span,.you-label,.sidebar-note { display:none; } .screening-copy h1 { font-size:27px; } }
@container(max-width:640px) { .topbar { padding:8px 14px 10px; min-height:112px; gap:4px 10px; } .sidebar { display:none; } .chips { min-height:56px; padding:6px 14px; } .chips button { min-height:44px; } .browse-body { padding:12px 14px 24px; } .screening-room { height:165px; grid-template-columns:37% 1fr; gap:14px; border-radius:22px; } .screening-copy { padding:14px 12px 14px 0; } .screening-copy h1 { font-size:23px; } .screening-eyebrow { font-size:7px; line-height:1.5; } .screening-copy .muted { display:none; } .screening-copy>div { margin-top:12px; } .screening-copy .pill { font-size:12px; padding:0 10px; }.screening-copy .pill:last-child { display:none; } .home-section-heading { margin:16px 4px 8px; } .home-section-heading h2 { font-size:20px; } .home-section-heading>span { display:none; } .video-grid { grid-template-columns:minmax(0,1fr); } .featured-grid { display:flex; overflow-x:auto; scroll-snap-type:x mandatory; gap:12px; padding:0 0 10px; } .featured-grid :deep(.yt-card) { flex:0 0 100%; scroll-snap-align:start; } .home-first-screen { min-height:calc(100cqh - 228px); } .bottom-tabs { padding:4px 10px; gap:4px; height:60px; } }


@container(max-height:560px) and (min-width:641px) { .screening-room { height:110px; } .screening-eyebrow { display:none; } .screening-copy { padding:10px 16px 10px 0; }.screening-copy h1 { font-size:22px; }.screening-copy>div { margin-top:8px; }.featured-grid :deep(.yt-thumbnail) { height:90px; aspect-ratio:auto; }.home-section-heading { margin-top:12px; margin-bottom:8px; }.home-section-heading h2 { font-size:19px; } }
@container(max-width:640px) { .screening-room { height:145px; } .featured-grid :deep(.yt-card) { display:grid; grid-template-columns:112px minmax(0,1fr); padding:10px; min-height:110px; align-items:start; }.featured-grid :deep(.metadata) { padding:0 0 0 10px; gap:0; }.featured-grid :deep(.avatar) { display:none; }.featured-grid :deep(.title) { font-size:12px; }.featured-grid :deep(.copy>p) { display:none; }.featured-grid :deep(.more) { width:44px; min-width:44px; flex-basis:44px; }.home-section-heading { margin-top:12px; }.home-first-screen { min-height:calc(100cqh - 252px); } }

</style>
