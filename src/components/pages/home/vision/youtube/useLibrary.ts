import type { Video } from "./catalogue";
import { catalogue } from "./catalogue";

export interface Playlist { id: string; name: string; videos: string[] }
export interface HistoryEntry { id: string; position: number; duration: number; at: number }
export interface LocalComment { id: string; text: string }
export interface Library {
  subscriptions: string[];
  notificationChannels: string[];
  later: string[];
  ratings: Record<string, number>;
  history: HistoryEntry[];
  playlists: Playlist[];
  queue: string[];
  hidden: string[];
  recent: string[];
  comments: Record<string, LocalComment[]>;
  pasted: Video[];
  autoplay: boolean;
}
const storageKey = "lab-vision-youtube";
const validId = (id: unknown): id is string => typeof id === "string" && /^[\w-]{11}$/.test(id);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown, ids = false): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string =>
    typeof item === "string" && item.length <= 300 && (!ids || validId(item))))].slice(0, 500) : [];
const finite = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;

export function freshLibrary(): Library {
  return {
    subscriptions: [], notificationChannels: [], later: [], ratings: {}, history: [],
    playlists: [], queue: [], hidden: [], recent: [], comments: {}, pasted: [], autoplay: true,
  };
}
export function readLibrary(value: unknown): Library {
  const state = freshLibrary();
  if (!record(value)) return state;
  for (const key of ["subscriptions", "notificationChannels", "recent"] as const) state[key] = strings(value[key]);
  for (const key of ["later", "queue", "hidden"] as const) state[key] = strings(value[key], true);
  state.autoplay = value.autoplay !== false;
  if (record(value.ratings)) {
    for (const [id, rating] of Object.entries(value.ratings)) {
      if (validId(id) && (rating === 1 || rating === -1)) state.ratings[id] = rating;
    }
  }
  if (Array.isArray(value.history)) {
    state.history = value.history.filter(record).filter(item => validId(item.id)).slice(0, 500).map(item => ({
      id: String(item.id), position: finite(item.position), duration: finite(item.duration), at: finite(item.at),
    }));
  }
  if (Array.isArray(value.playlists)) {
    state.playlists = value.playlists.filter(record).filter(item =>
      typeof item.id === "string" && typeof item.name === "string").slice(0, 100).map(item => ({
      id: String(item.id).slice(0, 100), name: String(item.name).slice(0, 100), videos: strings(item.videos, true),
    }));
  }
  if (record(value.comments)) {
    for (const [id, comments] of Object.entries(value.comments)) {
      if (!validId(id) || !Array.isArray(comments)) continue;
      state.comments[id] = comments.filter(record).filter(item => typeof item.text === "string").slice(0, 100).map(item => ({
        id: typeof item.id === "string" ? item.id.slice(0, 100) : uniqueId(),
        text: String(item.text).slice(0, 1000),
      }));
    }
  }
  if (Array.isArray(value.pasted)) {
    state.pasted = value.pasted.filter(record).filter(item =>
      validId(item.id) && typeof item.title === "string" && typeof item.channel === "string").slice(0, 100).map(item => ({
        id: String(item.id), title: String(item.title).slice(0, 500), channel: String(item.channel).slice(0, 300),
        duration: "Duration unavailable", seconds: 0, year: 0, category: "Pasted links",
      }));
  }
  return state;
}
export function uniqueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export function useLibrary() {
  const library = ref<Library>(freshLibrary());
  const storageWarning = ref("");
  let loaded = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function persist() {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(library.value)); }
    catch { storageWarning.value = "Storage is unavailable. Your library still works for this visit."; }
  }
  onMounted(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) library.value = readLibrary(JSON.parse(saved) as unknown);
    } catch { storageWarning.value = "Saved data could not be read. Your library works for this visit."; }
    loaded = true;
  });
  watch(library, () => {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(persist, 500);
  }, { deep: true });
  onBeforeUnmount(() => { disposed = true; clearTimeout(timer); persist(); });
  const videos = computed(() => [...catalogue, ...library.value.pasted.filter(item => !catalogue.some(video => video.id === item.id))]);
  function resolve(id: string) { return videos.value.find(video => video.id === id); }
  function toggle(list: "later" | "subscriptions" | "notificationChannels", value: string) {
    const items = library.value[list];
    const index = items.indexOf(value);
    if (index < 0) items.push(value);
    else {
      items.splice(index, 1);
      if (list === "subscriptions") {
        library.value.notificationChannels = library.value.notificationChannels.filter(name => name !== value);
      }
    }
  }
  function rate(id: string, value: 1 | -1) {
    if (library.value.ratings[id] === value) delete library.value.ratings[id];
    else library.value.ratings[id] = value;
  }
  function remember(video: Video, position: number, duration: number) {
    const old = library.value.history.find(item => item.id === video.id);
    if (old) { old.position = finite(position); old.duration = finite(duration); old.at = Date.now(); }
    else library.value.history.unshift({ id: video.id, position: finite(position), duration: finite(duration), at: Date.now() });
    library.value.history = library.value.history.slice(0, 500);
  }
  function progress(id: string) {
    const item = library.value.history.find(entry => entry.id === id);
    return item?.duration ? Math.min(1, item.position / item.duration) : 0;
  }
  return { library, storageWarning, videos, resolve, toggle, rate, remember, progress, persist };
}
