<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { HomeExperience } from '~/experiences/home';
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import AlbumArt from './music/AlbumArt.vue';
import AlbumShelf from './music/AlbumShelf.vue';
import AppIcon from './music/AppIcon.vue';
import TrackRows from './music/TrackRows.vue';
import Playback from './music/Playback.vue';
import { MusicEngine, type SoundProfile } from './music/audio';
import { focusCollection } from './music/keyboard';
import { albums, albumTracks, firstTrack, formatTime, genres, playlists, songsFor, stations, tracks, type Album, type Artwork, type Genre, type Track } from './music/catalog';

defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type Tab = 'Home' | 'Browse' | 'Radio' | 'Library' | 'Search';
type Detail = { kind:'album'|'playlist'|'artist'; id:string };
type Pane = 'artwork'|'lyrics'|'queue';
const tabs: { name:Tab; icon:string }[] = [{name:'Home',icon:'home'},{name:'Browse',icon:'browse'},{name:'Radio',icon:'radio'},{name:'Library',icon:'music'},{name:'Search',icon:'search'}];
const tab = ref<Tab>('Home');
const detail = ref<Detail|null>(null);
const page = ref<HTMLElement>();
const rootElement = ref<HTMLElement>();
const dialogElement = ref<HTMLElement>();
let dialogOpener:HTMLElement|null=null;
const searchInput = ref<HTMLInputElement>();
const query = ref('');
const genre = ref<Genre|'All'>('All');
const library = ref<'Albums'|'Artists'|'Songs'|'Playlists'|'Favorites'>('Albums');
const pane = ref<Pane|null>(null);
const sheet = ref<'output'|'about'|null>(null);
const trackMenu = ref<Track|null>(null);
const collectionMenu = ref<{art:Artwork; ids:string[]}|null>(null);
const status = ref('');
const currentId = ref(firstTrack.id);
const track = computed(() => tracks.find(item=>item.id===currentId.value) ?? firstTrack);
const playing = ref(false);
const busy = ref(false);
const elapsed = ref(0);
const volume = ref(65);
const profile = ref<SoundProfile>('Studio');
const profiles: SoundProfile[] = ['Studio','Chai cup','Silk Board cancellation'];
const shuffle = ref(false);
const repeat = ref<'Off'|'All'|'One'>('All');
const favorites = ref<string[]>([]);
const queue = ref<string[]>(albumTracks(firstTrack.albumId).map(item=>item.id));
const history = ref<string[]>([]);
const queueIndex = computed(()=>queue.value.indexOf(currentId.value));
const upcoming = computed(()=>songsFor(queue.value.slice(queueIndex.value+1)));
const recent = computed(()=>songsFor(history.value));
const foundTracks = computed(()=>tracks.filter(item=>[item.title,item.artist,item.album,item.genre].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())));
const foundAlbums = computed(()=>albums.filter(item=>[item.album,item.artist,item.genre].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())));
const browseAlbums = computed(()=>albums.filter(item=>genre.value==='All'||item.genre===genre.value));
const artists = albums.map(album=>({id:album.artist,album:album.artist,artist:album.genre,art:album.art,colors:album.colors,photo:album.photo}));
const detailArt = computed<Artwork>(()=> {
 if(detail.value?.kind==='playlist') return playlists.find(item=>item.id===detail.value?.id) ?? albums[0]!;
 return albums.find(item=>detail.value?.kind==='artist' ? item.artist===detail.value.id : item.id===detail.value?.id) ?? albums[0]!;
});
const detailTracks = computed(()=>detail.value?.kind==='playlist' ? songsFor(playlists.find(item=>item.id===detail.value?.id)?.ids ?? []) : tracks.filter(item=>detail.value?.kind==='artist' ? item.artist===detail.value.id : item.albumId===detail.value?.id));
const detailTitle = computed(()=>detail.value?.kind==='artist' ? detail.value.id : detailArt.value.album);
const detailSubtitle = computed(()=>detail.value?.kind==='playlist' ? playlists.find(item=>item.id===detail.value?.id)?.subtitle : (detailArt.value as Album).description);
const totalMinutes = computed(()=>Math.round(detailTracks.value.reduce((sum,item)=>sum+item.duration,0)/60));
const lyricIndex = computed(()=> { let index=0; track.value.timeline.forEach((line,i)=>{if(elapsed.value>=line.at)index=i;}); return index; });
const lyricElements = ref<HTMLElement[]>([]);
const reduceMotion = ref(false);
let engine:MusicEngine|undefined;
let operation=0;
let disposed=false;
let clockTimer:ReturnType<typeof setInterval>|undefined;
let noticeTimer:ReturnType<typeof setTimeout>|undefined;
let observer:IntersectionObserver|undefined;
let preference:MediaQueryList|undefined;
let resumeWhenVisible=false;
let previousDim=0;
function announce(message:string):void { status.value=message; clearTimeout(noticeTimer); noticeTimer=setTimeout(()=>status.value='',3500); }
function sound():MusicEngine { return engine ??= new MusicEngine(()=>void next(false)); }
function stopClock():void { clearInterval(clockTimer); clockTimer=undefined; }
function startClock():void { stopClock(); clockTimer=setInterval(()=>{if(!document.hidden && playing.value)elapsed.value=engine?.position ?? elapsed.value;},250); }
async function start(song=track.value,position=elapsed.value):Promise<void> {
 const request=++operation; busy.value=true; playing.value=false; stopClock();
 try {
  if(vision) { try { new HomeExperience().sound?.pauseMusic(); } catch { /* Also usable independently of the room. */ } }
  const audio=sound(); audio.setVolume(volume.value/100); audio.setProfile(profile.value);
  const result=await audio.play(song,position>=song.duration?0:position);
  if(!result||disposed||request!==operation)return;
  currentId.value=song.id; elapsed.value=audio.position; playing.value=true;
  history.value=[song.id,...history.value.filter(id=>id!==song.id)].slice(0,12); startClock();
 } catch { if(!disposed && request===operation) {engine?.pause();playing.value=false;announce('Audio could not start. Press Play to try again.');} }
 finally {if(request===operation)busy.value=false;}
}
function pause():void {++operation;elapsed.value=engine?.position ?? elapsed.value;engine?.pause();playing.value=false;busy.value=false;stopClock();}
function toggle():void {resumeWhenVisible=false;if(playing.value||busy.value)pause();else void start();}
function select(song:Track):void {resumeWhenVisible=false;if(!queue.value.includes(song.id))queue.value.push(song.id);currentId.value=song.id;elapsed.value=0;void start(song,0);}
function playCollection(ids:string[],random=false):void {
 if(!ids.length)return; shuffle.value=random; queue.value=[...ids];
 if(random) {for(let i=queue.value.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const a=queue.value[i]!;queue.value[i]=queue.value[j]!;queue.value[j]=a;}}
 const song=tracks.find(item=>item.id===queue.value[0]);if(song)select(song);
}
async function next(manual=true):Promise<void> {
 if(!manual && repeat.value==='One'){await start(track.value,0);return;}
 const index=queue.value.indexOf(currentId.value);
 if(!manual && index>=queue.value.length-1 && repeat.value==='Off'){pause();elapsed.value=track.value.duration;return;}
 const pool=queue.value.filter(id=>id!==currentId.value);
 const id=shuffle.value && pool.length ? pool[Math.floor(Math.random()*pool.length)] : queue.value[(index+1)%queue.value.length];
 const song=tracks.find(item=>item.id===id);if(song)select(song);
}
function previous():void { if(elapsed.value>3){seek(0);return;} const index=queue.value.indexOf(currentId.value);const song=tracks.find(item=>item.id===queue.value[(index-1+queue.value.length)%queue.value.length]);if(song)select(song); }
function seek(value:number):void {elapsed.value=Math.max(0,Math.min(track.value.duration,value));engine?.seek(elapsed.value);}
function cycleRepeat():void {repeat.value=repeat.value==='Off'?'All':repeat.value==='All'?'One':'Off';}
function favorite(id:string):void { favorites.value=favorites.value.includes(id)?favorites.value.filter(item=>item!==id):[...favorites.value,id];announce(favorites.value.includes(id)?'Added to Favorites':'Removed from Favorites'); }
function enqueue(id:string,nextUp=false):void {
 const updated=queue.value.filter(item=>item!==id);if(id===currentId.value){announce('This song is already playing');closeSheets();return;}
 if(nextUp)updated.splice(Math.max(0,updated.indexOf(currentId.value))+1,0,id);else updated.push(id);
 queue.value=updated;announce(nextUp?'Playing next':'Added to the end of your queue');closeSheets();
}
function moveQueue(id:string,direction:number):void { const list=[...queue.value];const index=list.indexOf(id);const target=index+direction;if(index<=queueIndex.value||target<=queueIndex.value||target>=list.length)return;list[index]=list[target]!;list[target]=id;queue.value=list; }
function removeQueue(id:string):void {if(id!==currentId.value)queue.value=queue.value.filter(item=>item!==id);}
function closeSheets():void {sheet.value=null;trackMenu.value=null;collectionMenu.value=null;}
function navigate(value:Tab):void {tab.value=value;detail.value=null;pane.value=null;closeSheets();void nextTick(()=>{if(page.value)page.value.scrollTop=0;if(value==='Search')searchInput.value?.focus();});}
function openDetail(kind:Detail['kind'],id:string):void {detail.value={kind,id};pane.value=null;closeSheets();void nextTick(()=>{if(page.value)page.value.scrollTop=0;});}
function showPane(value:Pane):void {closeSheets();pane.value=pane.value===value?null:value;}
function albumMenu(id:string):void {const album=albums.find(item=>item.id===id);if(album)collectionMenu.value={art:album,ids:albumTracks(id).map(item=>item.id)};}
function playlistMenu(id:string):void {const list=playlists.find(item=>item.id===id);if(list)collectionMenu.value={art:list,ids:list.ids};}
function changeVolume(event:Event):void {if(event.target instanceof HTMLInputElement){volume.value=Number(event.target.value);engine?.setVolume(volume.value/100);}}
function changeProfile(value:SoundProfile):void {profile.value=value;engine?.setProfile(value);}
watch(()=>!!(sheet.value||trackMenu.value||collectionMenu.value),open=>{
 if(open){dialogOpener=document.activeElement instanceof HTMLElement?document.activeElement:null;void nextTick(()=>dialogElement.value?.focus());}
 else {void nextTick(()=>{if(dialogOpener?.isConnected)dialogOpener.focus({preventScroll:true});else rootElement.value?.focus({preventScroll:true});});}
});
function trapDialog(event:KeyboardEvent):void {
 event.stopPropagation();
 if(event.key==='Escape'){event.preventDefault();closeSheets();return;}
 if(event.key!=='Tab'||!dialogElement.value)return;
 const controls=Array.from(dialogElement.value.querySelectorAll<HTMLElement>('button:not(:disabled),input,[tabindex="0"]')).filter(item=>item.getClientRects().length>0);
 const first=controls[0],last=controls[controls.length-1];
 if(!first||!last){event.preventDefault();return;}
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogElement.value)){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===dialogElement.value)){event.preventDefault();first.focus();}
}
function keys(event:KeyboardEvent):void {
 const input=event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement;
 if(event.key==='Escape' && (sheet.value||trackMenu.value||collectionMenu.value||pane.value||detail.value)){event.preventDefault();event.stopPropagation();if(sheet.value||trackMenu.value||collectionMenu.value)closeSheets();else if(pane.value)pane.value=null;else detail.value=null;return;}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopPropagation();navigate('Search');return;}
 if(input)return;
 if(event.code==='Space' && !(event.target instanceof HTMLButtonElement)){event.preventDefault();event.stopPropagation();toggle();}
 if(event.altKey && event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();void next();}
 if(event.altKey && event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();previous();}
 focusCollection(event);
}
function visibility():void {
 if(document.hidden){resumeWhenVisible=playing.value||busy.value;if(resumeWhenVisible)pause();}
 else if(resumeWhenVisible){resumeWhenVisible=false;void start();}
}
function motion():void {reduceMotion.value=preference?.matches ?? false;}
watch(favorites,value=>{try{localStorage.setItem('vision-music-favorites-v2',JSON.stringify(value));}catch{/* Storage may be unavailable. */}});
watch(volume,value=>{try{localStorage.setItem('vision-music-volume',String(value));}catch{/* Storage may be unavailable. */}});
watch(lyricIndex,()=>{if(pane.value!=='lyrics')return;void nextTick(()=>{const row=lyricElements.value[lyricIndex.value];const parent=row?.parentElement;if(row&&parent)parent.scrollTo({top:Math.max(0,row.offsetTop-parent.offsetTop-parent.clientHeight*.35),behavior:reduceMotion.value?'auto':'smooth'});});});
watch(pane,(value,old)=>{if(!vision)return;if(value && !old){previousDim=vision.dim.value;vision.dim.value=Math.max(previousDim,.28);}else if(!value && old)vision.dim.value=previousDim;});
onMounted(()=>{
 try{const saved:unknown=JSON.parse(localStorage.getItem('vision-music-favorites-v2')??'[]');if(Array.isArray(saved))favorites.value=saved.filter((id:unknown):id is string=>typeof id==='string' && tracks.some(item=>item.id===id));const savedVolume=localStorage.getItem('vision-music-volume');if(savedVolume!==null && Number.isFinite(Number(savedVolume)))volume.value=Math.max(0,Math.min(100,Number(savedVolume)));}catch{/* Start with local defaults. */}
 preference=matchMedia('(prefers-reduced-motion: reduce)');motion();preference.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);
 if(rootElement.value){observer=new IntersectionObserver(entries=>{if(!entries[0]?.isIntersecting && (playing.value||busy.value)){pause();announce('Playback paused while Music is out of view.');}},{threshold:0});observer.observe(rootElement.value);}
});
onBeforeUnmount(()=>{disposed=true;++operation;stopClock();clearTimeout(noticeTimer);observer?.disconnect();document.removeEventListener('visibilitychange',visibility);preference?.removeEventListener('change',motion);engine?.dispose();if(vision && pane.value)vision.dim.value=previousDim;});
</script>

<template>
 <div ref="rootElement" class="music" :class="{ compact, immersive:!!pane, solid:vision?.reduceTransparency.value }" tabindex="0" aria-label="Music" @keydown="keys">
  <nav class="navigation vk-tabbar tabs" aria-label="Music navigation">
   <button v-for="item in tabs" :key="item.name" v-hover class="nav-button" :aria-label="item.name" :aria-current="tab===item.name && !pane && !detail ? 'page' : undefined" :title="item.name" @click="navigate(item.name)"><AppIcon :name="item.icon" /><span>{{ item.name }}</span></button>
  </nav>
  <div class="workspace">
   <header class="page-header">
    <div class="heading"><button v-if="detail || pane" v-hover class="vk-icon plain back" aria-label="Back to browsing" @click="pane ? pane=null : detail=null"><AppIcon name="left" /></button><div><span class="brand"><AppIcon name="music" />Music</span><h1>{{ pane ? (pane==='queue' ? 'Playing Next' : 'Now Playing') : detail ? (detail.kind==='artist' ? 'Artist' : detail.kind==='playlist' ? 'Playlist' : 'Album') : tab }}</h1></div></div>
    <div class="header-actions"><button v-if="pane" v-hover class="vk-icon plain" :aria-label="favorites.includes(track.id)?'Remove from favorites':'Favorite current song'" :aria-pressed="favorites.includes(track.id)" @click="favorite(track.id)"><AppIcon name="star" :filled="favorites.includes(track.id)" /></button><button v-hover class="vk-icon account" aria-label="About this music collection" @click="sheet='about'"><AppIcon name="music" /></button></div>
   </header>
   <main ref="page" class="page-scroll vk-scroll" :class="{'now-page':!!pane}">
    <template v-if="pane">
     <div class="color-wash" :style="{'--wash-a':track.colors[0],'--wash-b':track.colors[1],'--wash-c':track.colors[2]}" aria-hidden="true"></div>
     <div class="now-layout" :class="{'with-pane':pane!=='artwork'}">
      <section class="now-artwork"><button v-hover class="big-art" aria-label="Show current album" @click="openDetail('album',track.albumId)"><AlbumArt :track="track" /></button><div class="now-title"><h2>{{ track.title }}</h2><button class="artist-link" @click="openDetail('artist',track.artist)">{{ track.artist }}<AppIcon name="right" /></button></div><p class="original">Original instrumental · {{ track.bpm }} BPM</p><div class="now-modes vk-segmented"><button v-hover :aria-pressed="pane==='artwork'" @click="pane='artwork'">Artwork</button><button v-hover :aria-pressed="pane==='lyrics'" @click="pane='lyrics'">Lyrics</button><button v-hover :aria-pressed="pane==='queue'" @click="pane='queue'">Queue</button></div></section>
      <section v-if="pane==='lyrics'" class="lyrics-panel"><p class="eyebrow">LYRIC COMPANION</p><p class="lyrics-note">Original words, timed to instrumental music.</p><div class="lyrics vk-scroll" aria-label="Time-synced lyrics"><button v-for="(line,index) in track.timeline" :key="track.id+index" ref="lyricElements" :class="{active:index===lyricIndex,past:index<lyricIndex}" :aria-current="index===lyricIndex?'true':undefined" @click="seek(line.at)">{{ line.text }}</button></div></section>
      <section v-if="pane==='queue'" class="queue-panel"><div class="queue-heading"><h2>Up Next</h2><button v-hover class="text-action" @click="queue=[currentId]">Clear</button></div><div class="queue-actions"><button v-hover class="vk-button" :aria-pressed="shuffle" @click="shuffle=!shuffle"><AppIcon name="shuffle" />Shuffle</button><button v-hover class="vk-button" :aria-label="'Repeat: '+repeat" :aria-pressed="repeat!=='Off'" @click="cycleRepeat"><AppIcon name="repeat" />{{ repeat==='One'?'Repeat 1':repeat==='All'?'Repeat All':'Repeat Off' }}</button></div><p class="queue-source">{{ upcoming.length }} songs waiting for their moment</p><div class="queue-tracks vk-scroll"><div v-for="(song,index) in upcoming" :key="song.id" class="queue-item"><button v-hover class="queue-song" @click="select(song)"><span class="tiny-art"><AlbumArt :track="song" small /></span><span><strong>{{ song.title }}</strong><small>{{ song.artist }}</small></span></button><button v-hover class="vk-icon plain" :disabled="index===0" :aria-label="'Move '+song.title+' earlier'" @click="moveQueue(song.id,-1)"><AppIcon name="up" /></button><button v-hover class="vk-icon plain" :disabled="index===upcoming.length-1" :aria-label="'Move '+song.title+' later'" @click="moveQueue(song.id,1)"><AppIcon name="down" /></button><button v-hover class="vk-icon plain" :aria-label="'Remove '+song.title" @click="removeQueue(song.id)"><AppIcon name="minus" /></button></div><div v-if="!upcoming.length" class="empty vk-well"><AppIcon name="queue" /><h3>A little room for more.</h3><p>Add an album or use Play Next on any song.</p><button class="vk-button" @click="navigate('Browse')">Find a new favorite</button></div><h3 v-if="recent.length" class="history-title">Recently Played</h3><TrackRows v-if="recent.length" :tracks="recent" :current-id="currentId" :playing="playing" :favorites="favorites" @play="select" @favorite="favorite" @more="trackMenu=$event" /></div></section>
     </div>
    </template>
    <template v-else-if="detail">
     <section class="detail-layout" :class="{artist:detail.kind==='artist'}"><div class="detail-cover"><AlbumArt :track="detailArt" /><div class="detail-cover-actions"><button v-hover class="vk-icon" aria-label="Collection options" @click="collectionMenu={art:detailArt,ids:detailTracks.map(item=>item.id)}"><AppIcon name="more" /></button><span>{{ detailTracks.length }} songs · {{ totalMinutes }} minutes</span></div></div><div class="detail-body"><p class="eyebrow">{{ detail.kind==='artist'?'MEET THE ARTIST':detail.kind==='playlist'?'MADE FOR THE MOMENT':'FEATURED ALBUM' }}</p><h2>{{ detailTitle }}</h2><button v-if="detail.kind!=='artist'" class="artist-link accent" @click="openDetail('artist',detailArt.artist)">{{ detailArt.artist }}<AppIcon name="right" /></button><p class="detail-description">{{ detailSubtitle }}</p><div class="collection-actions"><button v-hover class="vk-button primary" @click="playCollection(detailTracks.map(item=>item.id))"><AppIcon name="play" filled />Play</button><button v-hover class="vk-button" @click="playCollection(detailTracks.map(item=>item.id),true)"><AppIcon name="shuffle" />Shuffle</button></div><TrackRows :tracks="detailTracks" :current-id="currentId" :playing="playing" :favorites="favorites" numbered @play="select" @favorite="favorite" @more="trackMenu=$event" /><p class="catalog-footnote">{{ detail.kind==='playlist'?'Curated in the Music collection':'Fictional artist · Original compositions' }}<br>Generated locally. No subscription needed.</p></div></section>
     <AlbumShelf v-if="detail.kind!=='playlist'" title="More to fall in love with" :items="albums.filter(item=>item.id!==detail?.id).slice(0,5)" @open="openDetail('album',$event)" @more="albumMenu" />
    </template>
    <template v-else-if="tab==='Home'">
     <div class="home-lead"><section class="top-picks"><div class="section-heading"><h2>Top Picks</h2><span>A soundtrack for right now</span></div><div class="picks vk-scroll" aria-label="Top Picks, scroll horizontally"><button v-for="album in [albums[0]!,albums[1]!]" :key="album.id" v-hover class="pick" :style="{'--pick-color':album.colors[1]}" @click="openDetail('album',album.id)" @contextmenu.prevent="albumMenu(album.id)"><div class="pick-copy"><span class="eyebrow">{{ album.id==='soft'?'ON REPEAT':'FIND YOUR QUIET' }}</span><h3>{{ album.album }}</h3><p>{{ album.artist }}</p><span class="pick-note">{{ album.tagline }}</span></div><span class="pick-art"><AlbumArt :track="album" /></span></button></div></section><div class="daily-note vk-well"><AppIcon name="clock" /><div><strong>A small pause, just for you.</strong><span>Five Quiet Minutes · Steep Mode</span></div><button v-hover class="vk-icon plain" aria-label="Play Five Quiet Minutes" @click="playCollection(albumTracks('chai').map(item=>item.id))"><AppIcon name="play" filled /></button></div><AlbumShelf class="first-shelf" title="Made for your day" :items="playlists" @open="openDetail('playlist',$event)" @more="playlistMenu" /></div>
     <div class="more-home"><AlbumShelf class="short-shelf" title="Made for your day" :items="playlists" @open="openDetail('playlist',$event)" @more="playlistMenu" /><AlbumShelf title="New in the neighborhood" subtitle="Small stories. Beautiful sounds." :items="albums.slice(2)" @open="openDetail('album',$event)" @more="albumMenu" /><section class="editorial vk-platter"><span class="editorial-icon"><AppIcon name="radio" /></span><div><p class="eyebrow">TUNE IN, SLOW DOWN</p><h2>A frequency for every feeling.</h2><p>Three stations. A thousand reasons to stay a little longer.</p></div><button v-hover class="vk-button" @click="navigate('Radio')">Explore Radio<AppIcon name="right" /></button></section><AlbumShelf v-if="recent.length" title="Recently played" :items="albums.filter(item=>recent.some(song=>song.albumId===item.id))" @open="openDetail('album',$event)" @more="albumMenu" /><p class="catalog-footnote">An original, fictional catalogue. Every song plays right here.</p></div>
    </template>
    <template v-else-if="tab==='Browse'">
     <section class="browse-banner vk-platter"><span class="eyebrow">THE LITTLE THINGS, TURNED UP</span><h2>Good music.<br>Better moments.</h2><p>Discover eight small worlds worth getting lost in.</p><span class="banner-orbit" aria-hidden="true"></span></section><div class="filters vk-scroll" aria-label="Browse genres"><button v-for="item in ['All',...genres]" :key="item" v-hover class="vk-button" :aria-pressed="genre===item" @click="genre=item as Genre|'All'">{{ item }}</button></div><div class="section-heading"><h2>{{ genre==='All'?'Explore the collection':genre }}</h2><span>{{ browseAlbums.length }} albums</span></div><div class="album-grid"><article v-for="album in browseAlbums" :key="album.id"><button v-hover class="art-button" @click="openDetail('album',album.id)" @contextmenu.prevent="albumMenu(album.id)"><AlbumArt :track="album" /></button><button class="album-name" @click="openDetail('album',album.id)">{{ album.album }}</button><button class="subtle-link" @click="openDetail('artist',album.artist)">{{ album.artist }}</button></article></div><AlbumShelf title="Pick a mood" :items="playlists" @open="openDetail('playlist',$event)" @more="playlistMenu" />
    </template>
    <template v-else-if="tab==='Radio'">
     <section class="radio-banner vk-platter"><AppIcon name="radio" /><span class="eyebrow">RADIO, WITH A LITTLE HEART</span><h2>Always a good<br>time to tune in.</h2><p>Curated station mixes from our fictional neighborhood.</p></section><div class="section-heading"><h2>On the dial</h2><span>Original station mixes</span></div><div class="radio-stations vk-scroll" tabindex="0" aria-label="Radio stations, scroll horizontally"><article v-for="station in stations" :key="station.id" class="station vk-platter" :style="{'--station-a':station.colors[0],'--station-b':station.colors[1]}"><div class="station-art"><span class="station-word">{{ station.name.split(' ').slice(0,-1).join(' ') }}</span><AppIcon name="radio" /><span class="station-mix">ORIGINAL MIX / STEREO</span></div><div class="station-copy"><h3>{{ station.name }}</h3><p>{{ station.subtitle }}</p><small>{{ station.schedule }}</small><button v-hover class="vk-button primary" @click="playCollection(station.ids)"><AppIcon name="play" filled />Tune In</button></div></article></div><AlbumShelf title="When the city slows down" :items="albums.filter(item=>['monsoon','keys','orbit'].includes(item.id))" @open="openDetail('album',$event)" @more="albumMenu" />
    </template>
    <template v-else-if="tab==='Library'">
     <div class="library-tabs filters vk-scroll"><button v-for="item in (['Albums','Artists','Songs','Playlists','Favorites'] as const)" :key="item" v-hover class="vk-button" :aria-pressed="library===item" @click="library=item">{{ item }}</button></div><div class="section-heading"><h2>{{ library==='Favorites'?'Your favorites':library==='Albums'?'Recently Added':library }}</h2><span>{{ library==='Songs'?'40 songs':library==='Albums'?'8 albums':'' }}</span></div><div v-if="library==='Albums'||library==='Artists'||library==='Playlists'" class="album-grid"><article v-for="item in library==='Artists'?artists:library==='Playlists'?playlists:albums" :key="item.id"><button v-hover class="art-button" :class="{'artist-circle':library==='Artists'}" @click="openDetail(library==='Artists'?'artist':library==='Playlists'?'playlist':'album',item.id)"><AlbumArt :track="item" /></button><button class="album-name" @click="openDetail(library==='Artists'?'artist':library==='Playlists'?'playlist':'album',item.id)">{{ item.album }}</button><span class="subtle-link">{{ item.artist }}</span></article></div><TrackRows v-else-if="library==='Songs'||favorites.length" :tracks="library==='Favorites'?tracks.filter(item=>favorites.includes(item.id)):tracks" :current-id="currentId" :playing="playing" :favorites="favorites" @play="select" @favorite="favorite" @more="trackMenu=$event" /><div v-else class="empty vk-well"><AppIcon name="star" /><h2>Keep the ones you love.</h2><p>Favorite a song from its options menu. Your favorites stay here for your next visit.</p><button v-hover class="vk-button" @click="navigate('Browse')">Explore Music</button></div>
    </template>
    <template v-else-if="tab==='Search'">
     <label class="search-field vk-well"><AppIcon name="search" /><input ref="searchInput" v-model="query" type="search" placeholder="Artists, songs, albums, and more" aria-label="Search Music" /><kbd>⌘ K</kbd></label><template v-if="!query.trim()"><div class="section-heading"><h2>Find your next favorite</h2></div><div class="search-genres"><button v-for="(item,index) in genres" :key="item" v-hover :style="{'--genre-a':albums[index]!.colors[1],'--genre-b':albums[index]!.colors[2]}" @click="genre=item;navigate('Browse')"><span>{{ item }}</span><AppIcon name="music" /></button></div><AlbumShelf title="Start somewhere lovely" :items="playlists" @open="openDetail('playlist',$event)" @more="playlistMenu" /></template><template v-else><p class="search-count">{{ foundTracks.length }} songs · {{ foundAlbums.length }} albums</p><AlbumShelf v-if="foundAlbums.length" title="Albums & Artists" :items="foundAlbums" @open="openDetail('album',$event)" @more="albumMenu" /><div v-if="foundTracks.length" class="section-heading"><h2>Songs</h2></div><TrackRows :tracks="foundTracks" :current-id="currentId" :playing="playing" :favorites="favorites" @play="select" @favorite="favorite" @more="trackMenu=$event" /><div v-if="!foundTracks.length&&!foundAlbums.length" class="empty vk-well"><AppIcon name="search" /><h2>No matches for “{{ query }}”</h2><p>Try an artist, a mood, or a little chai.</p><button class="vk-button" @click="query=''">Clear Search</button></div></template>
    </template>
   </main>
  </div>
  <Playback :track="track" :playing="playing" :busy="busy" :elapsed="elapsed" :shuffle="shuffle" :repeat="repeat" :mode="pane" @toggle="toggle" @shuffle="shuffle=!shuffle" @repeat="cycleRepeat" @next="next()" @previous="previous" @seek="seek" @now="showPane('artwork')" @mode="showPane" @output="sheet=sheet==='output'?null:'output'" />
  <Transition name="notice"><div v-if="status" class="status vk-ornament" role="status">{{ status }}</div></Transition>
  <div v-if="sheet||trackMenu||collectionMenu" class="sheet-backdrop" @click.self="closeSheets" @keydown.esc.stop="closeSheets">
   <section ref="dialogElement" class="music-sheet vk-sheet vk-scroll" @keydown="trapDialog" role="dialog" aria-modal="true" :aria-label="sheet==='output'?'Sound settings':sheet==='about'?'About Music':'Music options'" tabindex="-1">
    <header><h2>{{ sheet==='output'?'Sound':sheet==='about'?'A little music, a lot of heart.':trackMenu?.title ?? collectionMenu?.art.album }}</h2><button v-hover class="vk-icon plain" aria-label="Close sheet" @click="closeSheets"><AppIcon name="close" /></button></header>
    <template v-if="sheet==='output'"><p class="sheet-subtitle">Playing through this browser</p><label class="volume-label"><AppIcon name="sound" /><span>Volume</span><b>{{ volume }}%</b></label><input class="vk-slider" type="range" min="0" max="100" :value="volume" :style="{'--value':volume/100}" aria-label="Volume" @input="changeVolume" /><p class="eyebrow">SOUND CHARACTER</p><button v-for="item in profiles" :key="item" v-hover class="vk-row" :aria-pressed="profile===item" @click="changeProfile(item)"><span>{{ item }}</span><AppIcon v-if="profile===item" name="check" /></button><p class="sheet-subtitle">{{ profile==='Studio'?'Clear, full-frequency sound.':profile==='Chai cup'?'A warm, softly filtered mix.':'Gentler treble for a quieter feeling.' }}</p></template>
    <template v-else-if="sheet==='about'"><p class="about-intro">Eight albums. Forty songs.<br>A small neighborhood of sound.</p><p class="sheet-subtitle">All artists, albums, and radio stations are fictional. The original music is synthesized on your device. Lyrics are timed companions to instrumental tracks.</p><div class="vk-well about-shortcuts"><p><kbd>Space</kbd> Play / pause</p><p><kbd>⌘ / Ctrl K</kbd> Search</p><p><kbd>Alt ← / →</kbd> Previous / next</p><p><kbd>Esc</kbd> Back / dismiss</p></div><p class="sheet-subtitle">Photo-based covers use local CC0 photography. Favorites and volume are saved only in this browser.</p><button v-hover class="vk-button primary" @click="closeSheets">Keep listening</button></template>
    <template v-else-if="trackMenu"><p class="sheet-subtitle">{{ trackMenu.artist }} · {{ formatTime(trackMenu.duration) }}</p><button v-hover class="vk-row" @click="select(trackMenu);closeSheets()"><AppIcon name="play" filled />Play</button><button v-hover class="vk-row" @click="enqueue(trackMenu.id,true)"><AppIcon name="queue" />Play Next</button><button v-hover class="vk-row" @click="enqueue(trackMenu.id)"><AppIcon name="plus" />Play Last</button><button v-hover class="vk-row" @click="favorite(trackMenu.id);closeSheets()"><AppIcon name="star" />{{ favorites.includes(trackMenu.id)?'Remove from Favorites':'Add to Favorites' }}</button><button v-hover class="vk-row" @click="openDetail('album',trackMenu.albumId)"><AppIcon name="music" />Go to Album</button><button v-hover class="vk-row" @click="openDetail('artist',trackMenu.artist)"><AppIcon name="home" />Go to Artist</button></template>
    <template v-else-if="collectionMenu"><p class="sheet-subtitle">{{ collectionMenu.art.artist }}</p><button v-hover class="vk-row" @click="playCollection(collectionMenu.ids);closeSheets()"><AppIcon name="play" filled />Play</button><button v-hover class="vk-row" @click="playCollection(collectionMenu.ids,true);closeSheets()"><AppIcon name="shuffle" />Shuffle</button><button v-hover class="vk-row" @click="queue=[...queue,...collectionMenu.ids.filter(id=>!queue.includes(id))];announce('Collection added to your queue');closeSheets()"><AppIcon name="plus" />Add to Queue</button></template>
   </section>
  </div>
 </div>
</template>

<style scoped>
.music {width:100%;height:100%;display:grid;grid-template-columns:78px minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;position:relative;container:music / size;color:var(--vk-text,rgb(255 255 255 / .96));font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;font-size:15px;isolation:isolate;--vk-accent:#fa5a72;background:linear-gradient(135deg,#221e281a,transparent 65%);outline:none;touch-action:pan-x pan-y;}
.music :deep(*) {box-sizing:border-box;font-family:inherit; }
button,input {font:inherit; }button {border:0;color:inherit;background:transparent;cursor:pointer; }button:disabled{opacity:.3;cursor:default;}
button:focus-visible,input:focus-visible,[tabindex='0']:focus-visible {outline:2px solid white;outline-offset:3px; }
h1,h2,h3,p {margin:0; }h2{font-size:20px;letter-spacing:-.025em;line-height:1.25;font-weight:700; }
.navigation {grid-column:1;grid-row:1;align-self:center;justify-self:center;margin-left:10px;padding:7px!important;gap:7px!important;z-index:5; }
.nav-button {width:46px;height:46px;border-radius:50%;display:grid;place-items:center;position:relative; }
.nav-button[aria-current='page'] {background:#fffffff0;color:#26262b; }
.nav-button span {position:absolute;left:54px;background:#45454eee;padding:8px 15px;border-radius:16px;opacity:0;pointer-events:none;white-space:nowrap;font-size:13px;transform:translateX(-5px);transition:opacity .15s,transform .2s;box-shadow:0 5px 20px #0003; }
.nav-button:hover span,.nav-button:focus-visible span {opacity:1;transform:none; }
.workspace {grid-column:2;grid-row:1;min-width:0;min-height:0;display:flex;flex-direction:column;padding:0 26px 0 14px; }
.page-header {display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 0 15px;flex:none;min-height:82px; }
.heading {display:flex;align-items:center;gap:7px;min-width:0; }.brand{display:flex;align-items:center;gap:3px;color:var(--vk-secondary);font-size:12px;font-weight:600;margin-bottom:3px;}.brand svg{width:13px;height:13px;}
h1{font-size:30px;letter-spacing:-.045em;line-height:1.1;font-weight:750; }
.header-actions {display:flex;align-items:center;gap:5px; }.account{background:linear-gradient(150deg,#fc788d,#d3425e);box-shadow:inset 0 1px 0 #ffffff42;width:40px;height:40px;min-width:44px;min-height:44px; }.account svg{width:20px;height:20px; }
.page-scroll {flex:1;min-width:0;min-height:0;padding:0 2px 22px;position:relative;-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(to bottom,#000 calc(100% - 28px),transparent); }.page-scroll>section+section,.page-scroll>.shelf-section {margin-top:24px; }
.music>:deep(.playback) {grid-column:1/-1;grid-row:2;margin:12px 24px 16px 92px;z-index:6; }
.section-heading {display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px; }.section-heading>span{font-size:12px;color:var(--vk-secondary); }
.home-lead {display:grid;gap:16px;min-height:392px;align-content:start; }.picks{display:flex;gap:14px;padding:3px 2px 5px;scroll-snap-type:x mandatory; }
.pick{flex:0 0 calc((100% - 14px)/2);display:flex;min-width:0;height:150px;border-radius:22px;text-align:left;background:linear-gradient(110deg,color-mix(in srgb,var(--pick-color) 24%,transparent),#ffffff0a);box-shadow:inset 0 0 0 1px #ffffff13;scroll-snap-align:start;overflow:hidden; }
.pick-copy {flex:1;min-width:0;padding:16px 8px 16px 16px;display:flex;flex-direction:column;justify-content:center; }.eyebrow{font-size:10.5px;letter-spacing:.11em;line-height:1.4;font-weight:700;color:var(--vk-secondary); }
.pick h3 {font-size:21px;line-height:1.1;letter-spacing:-.035em;margin-top:8px; }.pick p{font-size:12px;margin-top:6px;color:var(--vk-secondary); }.pick-note{font-size:11.5px;line-height:1.4;color:var(--vk-secondary);margin-top:12px; }.pick-art{flex:0 0 43%;align-self:center;padding:12px 12px 12px 0; }.pick-art :deep(.album-art){border-radius:9px; }
.first-shelf :deep(.shelf-card){flex-basis:116px; }.first-shelf :deep(header){margin-bottom:7px; }.first-shelf :deep(.title-button){font-size:13px; }.first-shelf :deep(.card-copy span){font-size:11.5px; }.first-shelf :deep(.shelf){gap:17px;padding-bottom:6px; }
.daily-note{display:none;align-items:center;gap:13px;padding:8px 13px;margin-top:16px;min-height:62px;}.daily-note>svg{width:24px;height:24px;opacity:.6;flex:none;}.daily-note>div{display:grid;gap:4px;flex:1;min-width:0;}.daily-note strong{font-size:12px;font-weight:600;}.daily-note span{font-size:11.5px;color:var(--vk-secondary);}
.more-home{display:grid;gap:25px;padding-top:18px; }.short-shelf{display:none; }
.editorial{display:flex;align-items:center;gap:16px;padding:22px; }.editorial-icon{width:48px;flex:none;height:48px;border-radius:50%;display:grid;place-items:center;background:#ffffff15; }.editorial h2{font-size:21px;margin:5px 0 7px; }.editorial p:not(.eyebrow){font-size:12px;color:var(--vk-secondary); }.editorial>div{flex:1; }.editorial .vk-button{font-size:13px; }
.catalog-footnote {font-size:12px;line-height:1.65;color:var(--vk-tertiary);margin:22px 0; }
.album-grid {display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:24px 18px;margin-bottom:28px; }.album-grid article{display:flex;flex-direction:column;align-items:stretch;min-width:0; }.art-button{padding:0;border-radius:13px;width:100%;display:block; }.album-name{padding:10px 0 4px;text-align:left;font-size:14px;line-height:1.35;font-weight:600;min-height:44px; }.subtle-link{font-size:12px;line-height:1.4;text-align:left;padding:0;color:var(--vk-secondary);min-height:44px; }
.artist-circle :deep(.album-art){border-radius:50%; }
.filters{display:flex;gap:7px;padding:5px 2px 10px;margin:16px 0;scroll-snap-type:x proximity; }.filters .vk-button{font-size:13px;padding:0 16px;min-height:44px;scroll-snap-align:start; }
.browse-banner {position:relative;overflow:hidden;min-height:176px;padding:25px;margin-bottom:20px;background:linear-gradient(110deg,#aa587548,#25384a22); }.browse-banner h2{font-size:34px;letter-spacing:-.045em;line-height:1.02;margin:10px 0; }.browse-banner p{font-size:12px;color:var(--vk-secondary);position:relative;z-index:1; }.banner-orbit{position:absolute;width:210px;height:210px;right:18px;top:-15px;border-radius:50%;border:28px solid #f5b4b130;box-shadow:0 0 0 12px #f5b4b11c,0 0 0 23px #f5b4b112;transform:rotate(-24deg) scaleY(.72); }
.detail-layout{display:grid;grid-template-columns:minmax(165px,.85fr) minmax(0,1.3fr);gap:25px;align-items:start; }.detail-cover{position:sticky;top:0;padding-top:4px; }.detail-cover-actions{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:11.5px;color:var(--vk-secondary); }.detail-cover-actions .vk-icon{width:44px;height:44px; }
.detail-body{min-width:0;padding-top:4px; }.detail-body h2{font-size:29px;line-height:1.08;letter-spacing:-.035em;margin:8px 0; }.artist-link{display:inline-flex;align-items:center;gap:4px;font-size:15px;padding:5px 0;min-height:44px; }.artist-link svg{width:13px;height:13px; }.accent{color:#ff96a6; }.detail-description{font-size:12px;line-height:1.6;color:var(--vk-secondary);margin:11px 0 17px; }.collection-actions{display:flex;gap:10px;margin:16px 0; }.collection-actions .vk-button{font-size:14px;flex:1;padding:0 15px; }
.detail-body :deep(.favorite){display:none; }.detail-body :deep(.play-row){padding-left:3px;gap:8px; }.detail-body :deep(strong){font-size:13px; }
.artist .detail-cover :deep(.album-art){border-radius:50%; }
.radio-banner{padding:24px;margin-bottom:22px;background:linear-gradient(120deg,#e4797144,#27263812);position:relative; }.radio-banner>svg{position:absolute;right:26px;top:38px;width:110px;height:110px;opacity:.28; }.radio-banner h2{font-size:32px;letter-spacing:-.045em;line-height:1.08;margin:9px 0; }.radio-banner>p{font-size:12px;color:var(--vk-secondary);max-width:75%; }
.radio-stations{display:flex;gap:14px;margin-bottom:24px;scroll-snap-type:x mandatory;padding:2px 2px 8px; }.station{display:flex;overflow:hidden;min-height:154px;flex:0 0 100%;scroll-snap-align:start; }.station-art{flex:0 0 38%;padding:19px;display:flex;flex-direction:column;justify-content:space-between;position:relative;background:linear-gradient(145deg,var(--station-a),var(--station-b));color:white; }.station-word{font-size:24px;font-weight:800;letter-spacing:-.035em;line-height:1.05;max-width:76%;z-index:1; }.station-art>svg{position:absolute;right:15px;top:26px;width:80px;height:80px;opacity:.32; }.station-mix{font-size:8px;letter-spacing:.12em; }.station-copy{padding:17px 20px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:7px; }.station-copy h3{font-size:18px;letter-spacing:-.025em; }.station-copy p{font-size:12px;color:var(--vk-secondary); }.station-copy small{font-size:11.5px;color:var(--vk-tertiary); }.station-copy .vk-button{font-size:12px;margin-top:5px; }
.search-field{display:flex;align-items:center;gap:10px;padding:0 14px;min-height:48px;margin:5px 0 22px; }.search-field svg{width:19px;height:19px;color:var(--vk-secondary); }.search-field input{min-width:0;flex:1;background:none;border:0;color:white;height:48px;font-size:14px;outline:none; }.search-field:focus-within{outline:2px solid #ffffffa0; }.search-field input::placeholder{color:var(--vk-tertiary); }.search-field kbd{font-size:11.5px;color:var(--vk-tertiary); }.search-genres{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-bottom:26px; }.search-genres button{min-height:110px;border-radius:18px;background:linear-gradient(135deg,var(--genre-a),var(--genre-b));position:relative;overflow:hidden;text-align:left;padding:19px; }.search-genres span{font-size:23px;font-weight:750;letter-spacing:-.03em;position:relative;z-index:1; }.search-genres svg{position:absolute;right:12px;bottom:-3px;width:74px;height:74px;transform:rotate(-20deg);opacity:.25; }.search-count{font-size:12px;color:var(--vk-secondary);margin-bottom:20px; }
.empty {padding:32px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px; }.empty>svg{width:40px;height:40px;color:var(--vk-secondary); }.empty p{font-size:13px;line-height:1.55;max-width:300px;color:var(--vk-secondary); }.empty .vk-button{font-size:13px; }
.now-page{padding-bottom:14px; }.color-wash{position:absolute;inset:-20px;pointer-events:none;background:radial-gradient(ellipse at 20% 25%,var(--wash-a),transparent 67%),radial-gradient(ellipse at 85% 90%,var(--wash-b),var(--wash-c));opacity:.15;filter:blur(35px);z-index:-1; }.now-layout{min-height:100%;display:flex;align-items:center;justify-content:center;gap:30px;padding:10px 5px; }.now-artwork{width:min(100%,330px);flex:none;text-align:center; }.big-art{width:min(100%,300px);padding:0;border-radius:16px;box-shadow:0 22px 40px #0003; }.big-art :deep(.album-art){border-radius:16px; }.now-title{margin-top:18px; }.now-title h2{font-size:22px;line-height:1.2; }.now-title .artist-link{font-size:14px;color:var(--vk-secondary); }.original{font-size:11.5px;color:var(--vk-tertiary);margin:5px 0 14px; }.now-modes button{font-size:12px;min-height:44px;padding:0 14px; }.with-pane .now-artwork{width:43%; }.with-pane .big-art{width:100%; }.lyrics-panel,.queue-panel{min-width:0;flex:1;align-self:stretch;display:flex;flex-direction:column;padding:12px 0; }.lyrics-note{font-size:11.5px;color:var(--vk-tertiary);margin:5px 0 14px; }.lyrics{position:relative;max-height:340px;display:grid;align-content:start;gap:20px;padding:18px 0 100px; }.lyrics button{text-align:left;font-size:27px;line-height:1.22;letter-spacing:-.035em;font-weight:750;color:#ffffff38;padding:0;min-height:44px;transition:color .35s,transform .35s; }.lyrics button.active{color:white;transform:scale(1.02);transform-origin:left; }.lyrics button.past{color:#ffffff6b; }.queue-heading{display:flex;align-items:center;justify-content:space-between;gap:10px; }.text-action{font-size:12px;min-height:44px;color:#ffa5b2; }.queue-actions{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px; }.queue-actions .vk-button{font-size:12px;padding:0 12px; }.queue-actions svg{width:16px;height:16px; }.queue-source{font-size:11.5px;color:var(--vk-tertiary);margin-bottom:13px; }.queue-tracks{max-height:310px; }.queue-item{display:flex;align-items:center;gap:2px;border-bottom:1px solid #ffffff10; }.queue-song{display:flex;gap:9px;align-items:center;flex:1;min-width:0;min-height:56px;padding:6px 2px;text-align:left;border-radius:10px; }.tiny-art{width:34px;flex:none; }.queue-song>span:last-child{min-width:0;display:grid;gap:3px; }.queue-song strong{font-size:12px;font-weight:500;line-height:1.3; }.queue-song small{font-size:11.5px;color:var(--vk-secondary); }.queue-item>.vk-icon{width:44px;height:44px; }.queue-item>.vk-icon svg{width:15px;height:15px; }.history-title{font-size:15px;margin:22px 0 10px; }
.sheet-backdrop{position:absolute;inset:0;z-index:20;background:#10101570;display:flex;align-items:center;justify-content:center;padding:22px;backdrop-filter:blur(7px); }.music-sheet{width:min(100%,390px);max-height:100%;padding:19px!important;border-radius:27px; }.music-sheet>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px; }.music-sheet h2{font-size:20px;overflow-wrap:anywhere; }.sheet-subtitle{font-size:12px;line-height:1.6;color:var(--vk-secondary);margin-bottom:16px; }.music-sheet .vk-row{min-height:50px;font-size:14px;padding:8px 12px; }.music-sheet .vk-row>span{flex:1; }.music-sheet .vk-row>svg{width:20px;height:20px; }.music-sheet .eyebrow{margin:12px 0 6px; }.volume-label{display:flex;align-items:center;gap:8px;font-size:13px; }.volume-label span{flex:1; }.volume-label b{font-weight:500;color:var(--vk-secondary); }.volume-label svg{width:18px;height:18px; }.about-intro{font-size:25px;font-weight:650;letter-spacing:-.03em;line-height:1.2;margin-bottom:18px; }.about-shortcuts{padding:12px 16px;margin:15px 0; }.about-shortcuts p{display:flex;align-items:center;gap:15px;font-size:12px;min-height:30px;color:var(--vk-secondary); }.about-shortcuts kbd{min-width:112px;font-size:11.5px; }.status{position:absolute;bottom:142px;left:50%;transform:translateX(-50%);z-index:30;font-size:12px;max-width:85%;padding:13px 20px!important;text-align:center;pointer-events:none; }
.notice-enter-active,.notice-leave-active{transition:opacity .2s; }.notice-enter-from,.notice-leave-to{opacity:0; }
.solid .color-wash{filter:none;opacity:.09; }.solid .sheet-backdrop{backdrop-filter:none; }.solid{background:#37363d; }
@container music (max-height:590px) {
 .home-lead{min-height:180px;height:100%;display:block; }.daily-note{display:flex;}.first-shelf{display:none; }.short-shelf{display:block; }.more-home{padding-top:23px; }.pick{height:156px; }.page-header{padding-top:15px;min-height:74px; }.now-layout{align-items:flex-start; }.big-art{width:230px; }.with-pane .big-art{width:min(100%,220px); }.lyrics{max-height:245px; }.queue-tracks{max-height:210px; }.now-title h2{font-size:18px; }.now-title{margin-top:12px; }
}
@container music (min-width:1000px) { .station{flex-basis:calc((100% - 28px)/3);} .workspace{padding-right:32px;padding-left:20px;}.album-grid{grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:26px;}.detail-layout{grid-template-columns:minmax(250px,.7fr) minmax(0,1.4fr);gap:38px;}.detail-body h2{font-size:38px;}.detail-description{font-size:14px;}.pick-art{flex-basis:150px;}.pick-copy{padding:20px 26px;}.pick h3{font-size:27px;}.pick-note{font-size:12px;}.pick p{font-size:13px;}.first-shelf :deep(.shelf-card){flex-basis:116px;}.now-layout{gap:48px;}.with-pane .now-artwork{width:38%;max-width:360px;}.lyrics button{font-size:35px;}.lyrics{max-height:370px;}}
@container music (max-width:620px) {
 .workspace{grid-column:1/-1;padding:0 20px; }.page-header{padding:20px 0 16px;min-height:79px; }h1{font-size:28px;}.navigation{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);margin:0;flex-direction:row!important;gap:7px!important;padding:6px!important;align-self:auto; }.nav-button{width:44px;height:44px; }.nav-button span{display:none; }.music>:deep(.playback){margin:8px 14px 78px; }.page-scroll{padding-bottom:18px; }.home-lead{display:block;min-height:180px;height:100%; }.daily-note{display:flex;}.first-shelf{display:none; }.short-shelf{display:block; }.section-heading>span{display:none; }.picks{gap:12px; }.pick{flex-basis:100%;height:156px; }.pick h3{font-size:23px; }.pick-art{flex-basis:43%; }.pick-copy{padding-left:17px; }.pick-note{font-size:12px; }.more-home{padding-top:22px; }.album-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 16px; }.editorial{flex-wrap:wrap;padding:19px; }.editorial>div{flex-basis:70%; }.editorial .vk-button{width:100%;margin-top:7px; }.detail-layout{display:flex;flex-direction:column;gap:17px; }.detail-cover{position:static;width:min(75%,245px);margin:0 auto; }.detail-body{width:100%; }.detail-cover-actions{justify-content:center; }.detail-body h2{font-size:28px; }.detail-description{font-size:13px; }.detail-body :deep(strong){font-size:14px; }.station-art{flex-basis:37%;padding:16px 12px; }.station-word{font-size:20px;max-width:100%; }.station-copy{padding:16px 13px; }.station-copy h3{font-size:17px; }.station-copy p{font-size:12px; }.station-copy small{font-size:10.5px; }.radio-banner h2{font-size:29px; }.radio-banner>svg{width:75px;right:15px; }.browse-banner h2{font-size:30px; }.banner-orbit{right:-70px;opacity:.7; }.search-field{padding:0 11px; }.search-field input{font-size:12px; }.search-field kbd{display:none; }.search-genres button{min-height:98px;padding:15px; }.search-genres span{font-size:20px; }.now-layout{flex-direction:column;gap:24px;align-items:center;min-height:auto; }.now-artwork,.with-pane .now-artwork{width:100%; }.big-art,.with-pane .big-art{width:min(72%,225px); }.lyrics-panel,.queue-panel{width:100%;align-self:auto; }.lyrics button{font-size:28px; }.lyrics{max-height:300px; }.queue-tracks{max-height:340px; }.lyrics-panel,.queue-panel{padding-top:0; }.color-wash{position:fixed;inset:0; }.status{bottom:252px; }.brand{font-size:12px; }.music-sheet{padding:16px!important; }.sheet-backdrop{padding:16px; }
}
@container music (max-width:620px) and (max-height:560px){.daily-note{display:none;}}
.compact .navigation{flex-direction:row; }
@media(prefers-reduced-motion:reduce){.music :deep(*){animation:none!important;transition:none!important;scroll-behavior:auto!important;}}
</style>
