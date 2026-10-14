<script setup lang="ts">
import { VISION, VISION_ENVIRONMENTS } from '../vision';
import { vHover } from '../kit/hover';
import YtIcon from '../youtube/YtIcon.vue';
import PhotoArt from './photos/PhotoArt.vue';
import SpatialPortal from './photos/SpatialPortal.vue';
import Panorama from './photos/Panorama.vue';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type Tab = 'Memories' | 'Library' | 'Spatial' | 'Panoramas' | 'Collections' | 'Search';
type Photo = {
  id: string; title: string; src?: string; kind?: string; ratio: number; date: string;
  place: string; tags: string; panorama: boolean; spatial: boolean;
};
type Album = { id: string; title: string; line: string; ids: string[] };
type Sheet = 'info' | 'share' | 'delete' | 'album' | null;
const tabs: { name: Tab; path: string }[] = [
  { name: 'Memories', path: 'm12 3 2.5 6 6.5 3-6.5 3-2.5 6-2.5-6L3 12l6.5-3z' },
  { name: 'Library', path: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { name: 'Spatial', path: 'm12 3 9 6v6l-9 6-9-6V9zM3 9l9 6 9-6m-9 6v6' },
  { name: 'Panoramas', path: 'M3 5q9 4 18 0v14q-9-4-18 0zM3 16l6-5 4 3 5-6 3 4' },
  { name: 'Collections', path: 'M3 7h18v14H3zM5 3h14M7 5h10M6 16l4-5 4 4 3-2 3 5' },
  { name: 'Search', path: 'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0' },
];
const landscapeTitles = ['Lake, before the notifications', 'One more sunset', 'Above the cloud, below the deadlines',
  'Offline by the water', 'Nothing for miles, on purpose', 'Fresh tracks, clean branch', 'A quiet little forest', 'The last light'];
const samplePhotos: Photo[] = [
  ['mountains-3', 'A higher perspective', 'mountains hiking outdoors'],
  ['beach-1', 'Where the day slows down', 'beach waves coast'],
  ['sunset-0', 'The golden hour', 'sunset sky light'],
  ['coffee-3', 'A moment for coffee', 'coffee cup morning'],
  ['cat-0', 'An expert at resting', 'cat pet sleeping'],
  ['cat-1', 'A quiet companion', 'cat pet sleeping'],
  ['cat-2', 'In a patch of sunlight', 'cat pet sleeping'],
  ['dog-7', 'Good company', 'dog pet outdoors'],
  ['workspace-1', 'Room for an idea', 'workspace desk design'],
  ['houseplant-3', 'A little green', 'plant home green'],
  ['books-1', 'One more chapter', 'books library reading'],
  ['city-1', 'After the blue hour', 'city night lights'],
  ['mountains-5', 'The long way home', 'mountains hiking outdoors'],
  ['beach-3', 'Salt in the air', 'beach waves coast'],
  ['sunset-4', 'Last light', 'sunset sky light'],
  ['masala-0', 'Something warm', 'tea chai cup morning'],
].map(([file, title, tags], index) => ({ id: file ?? '', title: title ?? '', tags: tags ?? '', src: '/phone/photos/' + file + '.webp',
  ratio: 1.5, date: index < 8 ? 'June 18, 2026' : 'June 16, 2026', place: 'CC0 sample collection', panorama: false, spatial: true }));
const photos = ref<Photo[]>([
  ...samplePhotos,
  ...VISION_ENVIRONMENTS.filter(place => place.kind === 'photo').map((place, index) => ({
    id: place.id, title: landscapeTitles[index] ?? place.name, src: '/vision/env/' + place.id + '-thumb.webp',
    ratio: index % 3 === 0 ? 1.6 : index % 3 === 1 ? 1.2 : 1.8, date: index < 4 ? 'June 14, 2026' : 'June 12, 2026',
    place: place.name, tags: place.line + ' nature landscape outdoors', panorama: true, spatial: true,
  })),
  { id: 'desk', title: 'A very productive desk', kind: 'desk', ratio: 1.6, date: 'June 10, 2026', place: 'The fictional workspace',
    tags: 'screenshot code laptop', panorama: false, spatial: true },
  { id: 'tea', title: 'Chai, in portrait mode', kind: 'tea', ratio: 1, date: 'June 10, 2026', place: 'The tea department',
    tags: 'chai cup coffee tea break', panorama: false, spatial: true },
  { id: 'cat', title: 'The unofficial code reviewer', kind: 'cat', ratio: 1.3, date: 'June 10, 2026', place: 'Quality assurance',
    tags: 'cat pet reviewer meme', panorama: false, spatial: true },
  { id: 'error', title: 'Unexpectedly expected error', kind: 'error', ratio: 1.6, date: 'June 10, 2026', place: 'Production, probably',
    tags: 'screenshot error meme dialog', panorama: false, spatial: false },
]);
const albums = ref<Album[]>([
  { id: 'places', title: 'Places without Wi-Fi', line: 'The signal is the scenery.', ids: ['lakeside', 'cape', 'mondello', 'goegap', 'night'] },
  { id: 'break', title: 'Tea & other dependencies', line: 'Required to run this application.', ids: ['coffee-3', 'masala-0', 'workspace-1', 'books-1'] },
  { id: 'people', title: 'People & Pets', line: 'A few very good companions', ids: ['cat-0', 'cat-1', 'cat-2', 'dog-7'] },
]);
const memories = [
  { title: 'A little less online', line: 'Four places. Zero notifications.', ids: ['mountains-3', 'beach-1', 'sunset-0', 'mountains-5'] },
  { title: 'Small moments, large display', line: 'Find the extraordinary in the everyday.', ids: ['coffee-3', 'workspace-1', 'houseplant-3', 'books-1'] },
  { title: 'In very good company', line: 'The art of doing absolutely nothing.', ids: ['cat-0', 'cat-1', 'dog-7', 'cat-2'] },
];
const tab = ref<Tab>('Memories');
const query = ref('');
const zoomLevel = ref(2);
const selecting = ref(false);
const selected = ref<string[]>([]);
const favourites = ref<string[]>(['lakeside']);
const openedId = ref<string | null>(null);
const opened = computed(() => photos.value.find(photo => photo.id === openedId.value) ?? null);
const activeAlbum = ref<string | null>(null);
const sheet = ref<Sheet>(null);
const sheetElement = ref<HTMLElement | null>(null);
const notice = ref('');
const deleted = ref<Photo[]>([]);
const spatial = ref(false);
const panoramic = ref(false);
const immersive = ref(false);
const imageZoom = ref(1);
const pan = ref({ x: 0, y: 0 });
const viewerSurface = ref<HTMLElement | null>(null);
const reduced = ref(false);
const pageHidden = ref(false);
function documentVisibility(): void { pageHidden.value = document.hidden; }
const slideshow = ref<string[] | null>(null);
const slideTitle = ref('');
const slidePaused = ref(false);
const missing = ref<string[]>([]);
const fullMissing = ref<string[]>([]);
function photoCount(count: number): string {
  return count + (count === 1 ? ' photo' : ' photos');
}
function fullSource(photo: Photo): string | undefined {
  if (!photo.src || !photo.src.startsWith('/vision/env/') || fullMissing.value.includes(photo.id)) return photo.src;
  return '/vision/env/' + photo.id + '-4k.webp';
}
function imageFailed(photo: Photo): void {
  if (!fullMissing.value.includes(photo.id)) fullMissing.value = [...fullMissing.value, photo.id];
  else missing.value = [...missing.value, photo.id];
}
const shown = computed(() => photos.value.filter(photo => {
  if (tab.value === 'Search') return (photo.title + ' ' + photo.tags + ' ' + photo.place).toLowerCase().includes(query.value.trim().toLowerCase());
  if (tab.value === 'Spatial') return photo.spatial;
  if (tab.value === 'Panoramas') return photo.panorama;
  if (activeAlbum.value === 'favourites') return favourites.value.includes(photo.id);
  if (activeAlbum.value) return albums.value.find(album => album.id === activeAlbum.value)?.ids.includes(photo.id);
  return true;
}));
const dates = computed(() => [...new Set(shown.value.map(photo => photo.date))]);
const selectedPhotos = computed(() => photos.value.filter(photo => selected.value.includes(photo.id)));
const actionPhotos = computed(() => opened.value ? [opened.value] : selectedPhotos.value);
const albumTitle = computed(() => activeAlbum.value === 'favourites' ? 'Favourites' : albums.value.find(album => album.id === activeAlbum.value)?.title);
let timer: ReturnType<typeof setInterval> | undefined;
let media: MediaQueryList | undefined;
let previousDim = 0;
let ownsDim = false;
let previousFocus: HTMLElement | null = null;
let drag: { id: number; x: number; y: number; panX: number; panY: number } | null = null;
const updateMotion = () => { reduced.value = media?.matches ?? false; if (reduced.value) slidePaused.value = true; };
watch(panoramic, value => { if (!value) { immersive.value = false; restoreDim(); } });
function navigate(next: Tab): void {
  tab.value = next; activeAlbum.value = null; selected.value = []; selecting.value = false;
}
function open(photo: Photo): void {
  if (selecting.value) {
    selected.value = selected.value.includes(photo.id) ? selected.value.filter(id => id !== photo.id) : [...selected.value, photo.id];
    return;
  }
  openedId.value = photo.id;
  spatial.value = tab.value === 'Spatial';
  panoramic.value = tab.value === 'Panoramas';
  imageZoom.value = 1;
  pan.value = { x: 0, y: 0 };
}
function closeViewer(): void {
  openedId.value = null; slideshow.value = null; sheet.value = null; immersive.value = false; drag = null;
  restoreDim();
}
function nextPhoto(direction: number): void {
  const ids = slideshow.value?.filter(id => photos.value.some(photo => photo.id === id)) ?? shown.value.map(photo => photo.id);
  if (!ids.length) { closeViewer(); return; }
  const index = ids.indexOf(openedId.value ?? '');
  openedId.value = ids[(index + direction + ids.length) % ids.length] ?? null;
  imageZoom.value = 1; pan.value = { x: 0, y: 0 };
}
function toggleFavourite(): void {
  for (const photo of actionPhotos.value) {
    favourites.value = favourites.value.includes(photo.id) ? favourites.value.filter(id => id !== photo.id) : [...favourites.value, photo.id];
  }
  notice.value = 'Favourites updated.';
}
function showSheet(value: Sheet): void {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  sheet.value = value;
  void nextTick(() => sheetElement.value?.querySelector<HTMLButtonElement>('button')?.focus());
}
function closeSheet(): void { sheet.value = null; void nextTick(() => previousFocus?.focus()); }
function deletePhotos(): void {
  deleted.value = [...actionPhotos.value];
  const ids = deleted.value.map(photo => photo.id);
  photos.value = photos.value.filter(photo => !ids.includes(photo.id));
  selected.value = []; sheet.value = null;
  if (openedId.value && ids.includes(openedId.value)) closeViewer();
  notice.value = ids.length + ' photo' + (ids.length === 1 ? '' : 's') + ' deleted from this session.';
}
function undo(): void {
  photos.value = [...photos.value, ...deleted.value].sort((a, b) => b.date.localeCompare(a.date));
  deleted.value = []; notice.value = 'Photos restored.';
}
function addToAlbum(id: string): void {
  albums.value = albums.value.map(album => album.id === id ? { ...album, ids: [...new Set([...album.ids, ...actionPhotos.value.map(photo => photo.id)])] } : album);
  notice.value = 'Added to album.'; closeSheet();
}
async function copyPhoto(): Promise<void> {
  const photo = actionPhotos.value[0];
  if (!photo) return;
  try {
    await navigator.clipboard.writeText(photo.src ? new URL(photo.src, window.location.origin).href : photo.title);
    notice.value = photo.src ? 'Photo link copied.' : 'Illustration title copied.';
  } catch { notice.value = 'Clipboard unavailable. Use the download link or select the photo title.'; }
}
function restoreDim(): void {
  if (ownsDim && vision) vision.dim.value = previousDim;
  ownsDim = false;
}
function toggleImmersive(): void {
  immersive.value = !immersive.value;
  if (immersive.value) {
    previousDim = vision?.dim.value ?? 0; ownsDim = true;
    if (vision) vision.dim.value = .78;
  } else restoreDim();
}
function playMemory(memory: typeof memories[number]): void {
  const first = photos.value.find(photo => memory.ids.includes(photo.id));
  if (!first) { notice.value = 'This memory has no remaining photos. Undo deletion to restore it.'; return; }
  selecting.value = false; open(first); slideshow.value = memory.ids; slideTitle.value = memory.title; slidePaused.value = reduced.value;
}
function gridWheel(event: WheelEvent): void {
  if (!event.ctrlKey) return;
  event.preventDefault();
  zoomLevel.value = Math.max(1, Math.min(4, zoomLevel.value + (event.deltaY < 0 ? .15 : -.15)));
}
function begin(event: PointerEvent): void {
  if (spatial.value || panoramic.value || event.button !== 0) return;
  const target = event.currentTarget as HTMLElement;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.value.x, panY: pan.value.y };
  target.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.id || imageZoom.value <= 1) return;
  const box = viewerSurface.value?.getBoundingClientRect();
  if (!box) return;
  const width = viewerSurface.value?.clientWidth ?? box.width;
  const height = viewerSurface.value?.clientHeight ?? box.height;
  const scaleX = width / Math.max(1, box.width);
  const scaleY = height / Math.max(1, box.height);
  const limitX = width * (imageZoom.value - 1) / 2;
  const limitY = height * (imageZoom.value - 1) / 2;
  pan.value = {
    x: Math.max(-limitX, Math.min(limitX, drag.panX + (event.clientX - drag.x) * scaleX)),
    y: Math.max(-limitY, Math.min(limitY, drag.panY + (event.clientY - drag.y) * scaleY)),
  };
}
function end(event: PointerEvent): void {
  if (drag && imageZoom.value === 1 && Math.abs(event.clientX - drag.x) > 60) nextPhoto(event.clientX < drag.x ? 1 : -1);
  drag = null;
}
function zoomPhoto(value: number): void {
  imageZoom.value = Math.max(1, Math.min(3, value)); pan.value = { x: 0, y: 0 };
}
function keys(event: KeyboardEvent): void {
  if (event.key === 'Escape' && (sheet.value || opened.value || selecting.value)) {
    event.preventDefault();
    event.stopPropagation();
    if (sheet.value) closeSheet();
    else if (opened.value) closeViewer();
    else { selecting.value = false; selected.value = []; }
    return;
  }
  if (!(event.target instanceof HTMLElement) || event.target.matches('input, select, textarea')) return;
  if (sheet.value) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(sheetElement.value?.querySelectorAll<HTMLElement>('button, a[href]') ?? []);
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    return;
  }
  if (opened.value) {
    if (panoramic.value || spatial.value) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); nextPhoto(event.key === 'ArrowRight' ? 1 : -1); }
    return;
  }
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  const group = event.target.closest('[data-collection]');
  if (!direction || !group) return;
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
  const index = buttons.indexOf(event.target.closest('button') as HTMLButtonElement);
  buttons[(index + direction + buttons.length) % buttons.length]?.focus(); event.preventDefault();
}
onMounted(() => {
  documentVisibility(); document.addEventListener('visibilitychange', documentVisibility);
  media = window.matchMedia('(prefers-reduced-motion: reduce)'); updateMotion(); media.addEventListener('change', updateMotion);
  timer = setInterval(() => {
    if (slideshow.value && !slidePaused.value && !document.hidden && !sheet.value) nextPhoto(1);
  }, 5500);
});
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', documentVisibility); clearInterval(timer); media?.removeEventListener('change', updateMotion); drag = null; restoreDim(); });
</script>

<template>
  <div class="photos-app" :class="{ compact, 'memories-home': tab === 'Memories' }" @keydown="keys">
    <template v-if="!opened">
      <nav class="vk-tabbar destinations vk-scroll" aria-label="Photo collections" data-collection>
        <button v-for="item in tabs" :key="item.name" v-hover class="vk-icon" :aria-label="item.name" :aria-pressed="tab === item.name" @click="navigate(item.name)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path
            :d="item.path" />
          </svg>
          <span class="tab-label">{{ item.name }}</span>
        </button>
      </nav>
      <main class="library">
        <header class="heading">
          <div><p class="eyebrow">PHOTOS · SAMPLE COLLECTION</p><h1 class="vk-large-title">{{ albumTitle ?? tab }}</h1>
            <p class="vk-secondary subtitle">Your favourite moments, a little closer.</p>
          </div>
          <button v-if="tab !== 'Memories' && (tab !== 'Collections' || activeAlbum)" v-hover class="vk-button" :aria-pressed="selecting"
            @click="selecting = !selecting; selected = []">{{ selecting ? 'Done' : 'Select' }}</button>
        </header>
        <div class="library-scroll vk-scroll" @wheel="gridWheel">
          <template v-if="tab === 'Memories'">
            <div class="memory-grid" data-collection>
            <button v-for="(memory, index) in memories" :key="memory.title" v-hover class="memory-card" @click="playMemory(memory)">
              <img :src="photos.find(photo => photo.id === memory.ids[0])?.src" alt="" :loading="index === 0 ? 'eager' : 'lazy'" />
              <span class="memory-copy"><small>A MEMORY MIX</small><b>{{ memory.title }}</b><span>{{ memory.line }}</span><i><YtIcon name="play" />Play memory</i></span>
            </button>
            </div>
            <div class="collection-heading"><h2 class="vk-title">Made for a closer look</h2><button v-hover class="vk-button" @click="navigate('Collections')">Collections <YtIcon name="forward" /></button></div>
            <div class="collection-shortcuts" data-collection>
              <button v-hover class="collection-shortcut vk-platter" @click="navigate('Spatial')"><img src="/phone/photos/mountains-3.webp" alt="" /><span><b>Spatial Scenes</b><small>Explore a new perspective</small></span><YtIcon name="spatial" /></button>
              <button v-hover class="collection-shortcut vk-platter" @click="navigate('Collections'); activeAlbum = 'people'"><img src="/phone/photos/cat-0.webp" alt="" /><span><b>People &amp; Pets</b><small>A few familiar faces</small></span><YtIcon name="heart" /></button>
            </div>
            <p class="vk-footnote vk-secondary sample-caption">Curated CC0 photographs · Sample dates and memories</p>
          </template>
          <template v-else-if="tab === 'Collections' && !activeAlbum">
            <h2 class="vk-title">My Albums</h2>
            <div class="album-grid" data-collection>
              <button v-hover class="album-card vk-platter" @click="activeAlbum = 'favourites'">
                <div class="album-cover favourite-cover"><YtIcon name="heart" class="filled" /></div>
                <b>Favourites</b>
                <small>{{ photoCount(favourites.filter(id => photos.some(photo => photo.id === id)).length) }} · The good bits.</small>
              </button>
              <button v-for="album in albums" :key="album.id" v-hover class="album-card vk-platter" @click="activeAlbum = album.id">
                <div class="album-cover">
                  <img v-if="photos.find(photo => album.ids.includes(photo.id))?.src" :src="photos.find(photo => album.ids.includes(photo.id))?.src" alt="" />
                  <PhotoArt v-else :kind="album.id === 'people' ? 'cat' : 'tea'" :title="album.title" />
                </div><b>{{ album.title }}</b><small>{{ album.line }}</small>
              </button>
            </div>
            <h2 class="vk-title">People &amp; Pets</h2>
            <button v-hover class="vk-row vk-platter" @click="activeAlbum = 'people'"><span class="pet-avatar"><img src="/phone/photos/cat-0.webp" alt="Sleeping cat" /></span>
              <span><b>Quiet companions</b><small class="vk-secondary">Cats &amp; a dog · 4 sample photos</small></span><YtIcon name="forward" />
            </button>
          </template>
          <template v-else>
            <button v-if="activeAlbum" v-hover class="vk-button back-albums" @click="activeAlbum = null"><YtIcon name="back" />All Albums</button>
            <input v-if="tab === 'Search'" v-model="query" v-hover class="vk-field search" type="search" aria-label="Search photos" placeholder="Try tea, nature, cat or a place" />
            <div v-if="tab === 'Search' && !query" class="suggestions">
              <button v-for="term in ['nature', 'tea', 'cat', 'screenshot']" :key="term" v-hover class="vk-button" @click="query = term">{{ term }}</button>
            </div>
            <div v-if="selecting" class="selection-tools vk-platter">
              <span>{{ selected.length }} selected</span>
              <button v-hover class="vk-button" @click="selected = selected.length === shown.length ? [] : shown.map(photo => photo.id)">
                {{ selected.length === shown.length ? 'Deselect all' : 'Select all' }}
              </button>
              <button v-hover class="vk-icon" aria-label="Favourite selected photos" :disabled="!selected.length" @click="toggleFavourite"><YtIcon name="heart" /></button>
              <button v-hover class="vk-icon" aria-label="Share selected photos" :disabled="!selected.length" @click="showSheet('share')"><YtIcon name="share" /></button>
              <button v-hover class="vk-icon" aria-label="Add selected photos to an album" :disabled="!selected.length" @click="showSheet('album')"><YtIcon name="album" /></button>
              <button v-hover class="vk-icon" aria-label="Delete selected photos" :disabled="!selected.length" @click="showSheet('delete')"><YtIcon name="trash" /></button>
            </div>
            <section v-for="date in dates" :key="date" class="date-section">
              <div class="date-heading">
                <h2 class="vk-title">{{ date }}</h2>
                <span class="vk-secondary">{{ photoCount(shown.filter(photo => photo.date === date).length) }}</span>
              </div>
              <div class="photo-grid" :style="{ '--photo-size': (80 + zoomLevel * 42) + 'px' }" data-collection>
                <button v-for="photo in shown.filter(item => item.date === date)" :key="photo.id" v-hover class="photo-card"
                  :style="{ '--ratio': photo.ratio }" :aria-label="(selecting ? 'Select ' : 'Open ') + photo.title"
                  :aria-pressed="selecting ? selected.includes(photo.id) : undefined" @click="open(photo)">
                  <img v-if="photo.src && !missing.includes(photo.id)" :src="photo.src" :alt="photo.title" loading="lazy" draggable="false"
                    @error="missing = [...missing, photo.id]" />
                  <PhotoArt v-else :kind="photo.kind ?? 'desk'" :title="photo.title" />
                  <span class="photo-caption">{{ photo.title }}</span>
                  <span v-if="selecting" class="selection-check"><YtIcon v-if="selected.includes(photo.id)" name="check" /></span>
                  <span v-else-if="favourites.includes(photo.id)" class="photo-heart"><YtIcon name="heart" class="filled" /></span>
                  <span v-if="tab === 'Spatial' || tab === 'Panoramas'" class="photo-format">
                    <YtIcon v-if="tab === 'Spatial'" name="spatial" />{{ tab === 'Spatial' ? 'Spatial' : 'Panorama' }}
                  </span>
                </button>
              </div>
            </section>
            <p
              v-if="!shown.length" class="empty vk-platter">
              {{ query ? 'No matches. Try a place, tea or nature.' : 'No photos here yet. Add some from Library, or undo a deletion.' }}
            </p>
            <p class="vk-footnote vk-secondary">{{ photoCount(shown.length) }} · CC0 photographs: StockSnap, Rawpixel &amp; Poly Haven · Sample collection</p>
          </template>
        </div>
        <footer v-if="tab !== 'Memories' && (tab !== 'Collections' || activeAlbum)" class="library-toolbar vk-ornament">
          <span class="vk-footnote">Grid</span><YtIcon name="grid" />
          <input v-model.number="zoomLevel" v-hover class="vk-slider" type="range" min="1" max="4" step=".1" aria-label="Photo grid zoom"
            :style="{ '--value': (zoomLevel - 1) / 3 }" /><YtIcon name="screen" />
        </footer>
      </main>
    </template>
    <main v-else class="viewer">
      <header class="viewer-heading">
        <button v-hover class="vk-icon" aria-label="Back to photos" @click="closeViewer"><YtIcon name="back" /></button>
        <div><h1>{{ slideshow ? slideTitle : opened.title }}</h1><p class="vk-secondary">{{ slideshow ? opened.title : opened.place }}</p></div>
        <button v-hover class="vk-icon" aria-label="Photo information" :aria-pressed="sheet === 'info'" @click="showSheet('info')"><YtIcon name="info" /></button>
      </header>
      <div ref="viewerSurface" v-hover class="viewer-picture" :class="{ zoomed: imageZoom > 1, memory: slideshow, paused: slidePaused || reduced || pageHidden }"
        tabindex="0" role="group" aria-label="Photo viewer. Arrow keys change photos. Swipe to navigate or drag when zoomed."
        @pointerdown="begin" @pointermove="move" @pointerup="end" @pointercancel="drag = null" @lostpointercapture="drag = null">
        <Panorama v-if="panoramic && opened.panorama" :src="'/vision/env/' + opened.id + '-4k.webp'" :title="opened.title" />
        <SpatialPortal v-else-if="spatial" :src="fullSource(opened)" :fallback-src="opened.src"
          :kind="opened.kind" :title="opened.title" :reduced="reduced" />
        <Transition v-else name="photo-fade" mode="out-in">
          <div :key="opened.id" class="flat-photo" :style="{ transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + imageZoom + ')' }">
            <img v-if="opened.src && !missing.includes(opened.id)" :src="fullSource(opened)" :alt="opened.title" draggable="false"
              @error="imageFailed(opened)" />
            <PhotoArt v-else :kind="opened.kind ?? 'desk'" :title="opened.title" />
          </div>
        </Transition>
      </div>
      <div class="viewer-tools vk-ornament">
        <button v-hover class="vk-icon" aria-label="Previous photo" @click="nextPhoto(-1)"><YtIcon name="back" /></button>
        <button v-hover class="vk-icon" :aria-label="favourites.includes(opened.id) ? 'Remove favourite' : 'Favourite photo'"
          :aria-pressed="favourites.includes(opened.id)" @click="toggleFavourite"><YtIcon name="heart" :class="{ filled: favourites.includes(opened.id) }" /></button>
        <button v-hover class="vk-icon" aria-label="Share photo" @click="showSheet('share')"><YtIcon name="share" /></button>
        <button v-hover class="vk-icon" aria-label="Add photo to album" @click="showSheet('album')"><YtIcon name="album" /></button>
        <button v-hover class="vk-icon" aria-label="Delete photo" @click="showSheet('delete')"><YtIcon name="trash" /></button>
        <button v-hover class="vk-icon" aria-label="Next photo" @click="nextPhoto(1)"><YtIcon name="forward" /></button>
      </div>
      <div class="view-options vk-scroll">
        <button v-if="slideshow" v-hover class="vk-button" :aria-pressed="slidePaused" @click="slidePaused = !slidePaused">
          <YtIcon :name="slidePaused ? 'play' : 'pause'" />
          {{ slidePaused ? 'Play slideshow' : 'Pause slideshow' }}
        </button>
        <button v-if="opened.spatial && !slideshow" v-hover class="vk-button" :aria-pressed="spatial" @click="spatial = !spatial; panoramic = false">
          <YtIcon name="spatial" />{{ spatial ? 'Spatial on' : 'Spatial' }}
        </button>
        <button v-if="opened.panorama && !slideshow" v-hover class="vk-button" :aria-pressed="panoramic" @click="panoramic = !panoramic; spatial = false">
          {{ panoramic ? 'Flat photo' : 'Panorama' }}
        </button>
        <button v-if="panoramic" v-hover class="vk-button" :aria-pressed="immersive" @click="toggleImmersive">{{ immersive ? 'Exit immersive' : 'Immersive' }}</button>
        <label v-if="!spatial && !panoramic && !slideshow" class="zoom-control">Zoom
          <input v-hover class="vk-slider" type="range" min="1" max="3" step=".1" :value="imageZoom" :style="{ '--value': (imageZoom - 1) / 2 }"
            aria-label="Photo zoom" @input="zoomPhoto(Number(($event.target as HTMLInputElement).value))" />
        </label>
      </div>
    </main>
    <div v-if="sheet" class="sheet-backdrop" @click.self="closeSheet">
      <section ref="sheetElement" class="photo-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true"
        :aria-label="sheet === 'info' ? 'Photo information' : sheet === 'delete' ? 'Delete photos' : sheet === 'album' ? 'Add to album' : 'Share photos'">
        <header><h2 class="vk-title">{{ sheet === 'info' ? 'Information' : sheet === 'delete' ? 'Delete photos?' : sheet === 'album' ? 'Add to Album' : 'Share' }}</h2>
          <button v-hover class="vk-icon" aria-label="Close sheet" @click="closeSheet"><YtIcon name="close" /></button>
        </header>
        <template v-if="sheet === 'info' && opened">
          <h3>{{ opened.title }}</h3><p>{{ opened.date }} · Sample collection</p><p class="vk-secondary">{{ opened.place }}</p>
          <div class="metadata vk-well"><span>Illustrative metadata</span><b>{{ opened.kind ? 'Pocket Lab Illustration' : 'Landscape photograph' }}</b>
            <span>{{ opened.kind ? 'SVG · Vector artwork' : 'ƒ/8 · 1/125 s · ISO 100 · 24 mm' }}</span>
            <span>{{ opened.panorama ? '4096 × 2048 panorama source' : '800 × 500 illustration' }}</span>
          </div>
          <svg class="map" viewBox="0 0 380 150" role="img" aria-label="Illustrative location map, not GPS data">
            <rect width="380" height="150" fill="#536b62" /><path d="m0 90 380-50M50 0l50 150M190 0l60 150M0 30l380 80" stroke="#9cafa0" stroke-width="12" />
            <path d="M300 0q-100 60-25 150" fill="none" stroke="#6399a9" stroke-width="36" />
            <circle cx="185" cy="75" r="15" fill="#eaa776" stroke="#fff" stroke-width="4" />
          </svg>
          <p class="vk-footnote vk-secondary">Map and camera data are illustrative. Landscape images are CC0 from Poly Haven. Spatial depth is simulated.</p>
        </template>
        <template v-else-if="sheet === 'share'">
          <p>{{ actionPhotos.length }} photo{{ actionPhotos.length === 1 ? '' : 's' }} · {{ actionPhotos[0]?.title }}</p>
          <button v-hover class="vk-row" @click="copyPhoto"><YtIcon name="share" />Copy {{ actionPhotos[0]?.src ? 'first photo link' : 'illustration title' }}</button>
          <a v-for="photo in actionPhotos.filter(item => item.src)" :key="photo.id" v-hover class="vk-row download"
            :href="photo.src" :download="photo.id + '.webp'"><YtIcon name="download" /><span>Download {{ photo.title }}</span></a>
          <p v-if="!actionPhotos.some(photo => photo.src)" class="vk-secondary">These illustrations are drawn inside the app. Their titles can travel anywhere.</p>
          <p v-if="notice" role="status" class="vk-footnote">{{ notice }}</p>
        </template>
        <template v-else-if="sheet === 'delete'">
          <p>Remove {{ actionPhotos.length }} photo{{ actionPhotos.length === 1 ? '' : 's' }} from this session? You can undo this below.</p>
          <button v-hover class="vk-button destructive" @click="deletePhotos">Delete {{ photoCount(actionPhotos.length) }}</button>
          <button v-hover class="vk-button" @click="closeSheet">Keep photos</button>
        </template>
        <template v-else>
          <button v-for="album in albums" :key="album.id" v-hover class="vk-row" @click="addToAlbum(album.id)"><YtIcon name="album" />{{ album.title }}</button>
        </template>
      </section>
    </div>
    <div v-if="notice && !sheet" class="notification vk-platter"><span role="status">{{ notice }}</span>
      <button v-if="deleted.length" v-hover class="vk-button" @click="undo">Undo</button>
      <button v-hover class="vk-icon" aria-label="Dismiss notification" @click="notice = ''"><YtIcon name="close" /></button>
    </div>
  </div>
</template>

<style scoped src="./photos/photos.css"></style>
