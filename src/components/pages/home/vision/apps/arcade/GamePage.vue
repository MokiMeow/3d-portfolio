<script setup lang="ts">
import type { PsGame } from '~/common/playstation/games';
import { PS_GAMES } from '~/common/playstation/games';
import { vHover } from '../../kit/hover';
import ArcadeIcon from './ArcadeIcon.vue';
const props = defineProps<{ game: PsGame; favorite: boolean; played: boolean; genres: number }>();
const emit = defineEmits<{ back: []; play: [game: PsGame]; favorite: [game: PsGame]; select: [game: PsGame] }>();
const artMode = ref<'cover' | 'wide' | 'detail'>('cover');
const backButton = ref<HTMLButtonElement>();
const keyboardHints = computed(() => {
  const controls = props.game.controls.toLowerCase();
  const hints: string[] = [];
  if (controls.includes('wasd')) hints.push('W','A','S','D');
  if (controls.includes('arrow')) hints.push('Arrows');
  if (controls.includes('space')) hints.push('Space');
  if (controls.includes('shift')) hints.push('Shift');
  if (controls.includes('esc')) hints.push('Esc');
  return hints;
});
watch(() => props.game.id, () => { artMode.value = 'cover'; });
onMounted(() => backButton.value?.focus());
const related = computed(() => PS_GAMES.filter(game => game.id !== props.game.id && game.shelf === props.game.shelf).slice(0, 3));
const milestones = computed(() => [
  { name: 'First adventure', note: 'Launch this game from your library.', icon: 'play', earned: props.played },
  { name: 'Worth keeping', note: 'Save this game to your favorites.', icon: 'featured', earned: props.favorite },
  { name: 'A curious player', note: 'Try games from three different shelves.', icon: 'build', earned: props.genres >= 3 },
]);
</script>
<template>
  <section class="game-page">
    <header class="detail-nav"><button ref="backButton" v-hover class="vk-button" @click="emit('back')"><ArcadeIcon name="back"/>Arcade</button><span class="vk-footnote vk-secondary">GAME DETAILS</span><button v-hover class="vk-icon" :aria-pressed="favorite" :aria-label="favorite ? 'Remove from favorites' : 'Add to favorites'" @click="emit('favorite', game)"><ArcadeIcon name="featured"/></button></header>
    <div :key="game.id" class="game-scroll vk-scroll">
      <section class="detail-opening">
        <div class="game-hero" :style="{ '--game-accent': game.color }">
          <img :src="game.cover" alt="" class="hero-background"/>
          <div class="hero-gradient"/>
          <div class="game-identity"><span class="vk-footnote">INDEPENDENT GAMES / {{ game.genre.toUpperCase() }}</span><h1>{{ game.title }}</h1><p>{{ game.pitch }}</p><span class="creator">Created by {{ game.credit }}</span><div class="identity-actions"><button v-hover class="vk-button primary" @click="emit('play',game)"><ArcadeIcon name="play"/>{{ played ? 'Play again' : 'Play game' }}</button><span class="vk-footnote">{{ game.phone ? 'Touch ready' : 'Keyboard & mouse' }}</span></div></div>
          <img :src="game.cover" :alt="game.title + ' cover artwork'" class="game-poster"/>
        </div>
        <div class="game-facts vk-platter"><div><ArcadeIcon :name="game.phone ? 'pocket' : 'classic'"/><b>{{ game.phone ? 'Touch ready' : 'Desktop controls' }}</b><small>{{ game.phone ? 'Play on a smaller screen' : 'Bring a keyboard and mouse' }}</small></div><div><ArcadeIcon name="build"/><b>{{ game.genre }}</b><small>An independent adventure</small></div><div><ArcadeIcon name="info"/><b>Browser game</b><small>{{ game.online ? 'Hosted online' : 'Runs in a game window' }}</small></div></div>
        <p class="opening-note vk-footnote vk-secondary">Scroll for artwork, controls, and your library milestones.</p>
      </section>
      <section class="detail-section"><div class="section-heading"><div><h2>Artwork gallery</h2><p>Cover art supplied by the game library.</p></div><span class="vk-footnote vk-secondary">{{ artMode === 'cover' ? '01' : artMode === 'wide' ? '02' : '03' }} / 03</span></div>
        <div class="art-gallery"><div class="gallery-image" :class="artMode"><img :src="game.cover" :alt="game.title + ' cover artwork, ' + artMode + ' composition'"/><span class="gallery-label">{{ artMode === 'cover' ? 'Original cover' : artMode === 'wide' ? 'Wide composition' : 'Artwork detail' }}</span></div><div class="gallery-picker"><button v-for="mode in (['cover','wide','detail'] as const)" :key="mode" v-hover :aria-pressed="artMode === mode" :aria-label="'View ' + mode + ' artwork'" @click="artMode = mode"><img :src="game.cover" alt="" :class="mode"/><span>{{ mode === 'cover' ? 'Cover' : mode === 'wide' ? 'Wide' : 'Detail' }}</span></button></div></div>
      </section>
      <section class="detail-section controls-section"><h2>Make yourself comfortable</h2><div class="control-grid"><article class="vk-platter"><ArcadeIcon :name="game.phone ? 'pocket' : 'classic'"/><h3>How to play</h3><p>{{ game.controls }}</p><div class="key-hints" aria-hidden="true"><template v-if="keyboardHints.length"><kbd v-for="key in keyboardHints" :key="key">{{ key }}</kbd></template><span v-else>{{ game.phone ? 'Tap · Drag · Explore' : 'Keyboard & mouse' }}</span></div></article><article class="vk-platter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 7h10c4 0 6 13 2 13l-4-4H9l-4 4C1 20 3 7 7 7ZM6 12h4m-2-2v4m7-2h.1m3 2h.1M9 7V4h6"/></svg><h3>Your controls, your space</h3><p>{{ game.phone ? 'Touch controls are available. A larger window can make small game menus easier to reach.' : 'Use the keyboard and mouse for this game. Controller support depends on the game itself.' }}</p><span class="vk-footnote vk-secondary">Full screen is available in the player.</span></article></div></section>
      <section class="detail-section"><div class="section-heading"><div><h2>Library milestones</h2><p>Local activity, saved on this device.</p></div><span class="vk-chip">{{ milestones.filter(item => item.earned).length }} / 3</span></div><div class="milestone-grid"><article v-for="item in milestones" :key="item.name" class="milestone vk-platter" :class="{ earned: item.earned }"><span class="milestone-mark"><ArcadeIcon :name="item.icon"/></span><div><span class="milestone-status">{{ item.earned ? 'UNLOCKED' : 'TO DISCOVER' }}</span><h3>{{ item.name }}</h3><p>{{ item.note }}</p></div></article></div></section>
      <section v-if="related.length" class="detail-section"><h2>Keep exploring</h2><div class="related-grid"><button v-for="item in related" :key="item.id" v-hover class="related-game vk-platter" @click="emit('select',item)"><img :src="item.cover" alt="" loading="lazy"/><span><b>{{ item.title }}</b><small>{{ item.genre }}</small></span><ArcadeIcon name="info"/></button></div></section>
      <footer class="detail-footer vk-footnote vk-secondary">Game content belongs to {{ game.credit }}. This browser library opens independently hosted games; availability, menus, and account requirements depend on their creators.</footer>
    </div>
  </section>
</template>
<style scoped>
.game-page { position:absolute; inset:0; display:flex; flex-direction:column; color:var(--vk-text); padding:20px 24px 0; container-type:size; }
.game-page *, .game-page *::before, .game-page *::after { box-sizing:border-box; } button { font:inherit; color:inherit; cursor:pointer; } h1,h2,h3,p { margin:0; } :focus-visible { outline:2px solid white; outline-offset:3px; }
.detail-nav { display:flex; align-items:center; justify-content:space-between; gap:12px; padding-bottom:14px; flex:none; }
.detail-nav svg { width:22px; height:22px; } .game-scroll { flex:1; min-height:0; padding-bottom:28px; container-type:size; }
.detail-opening { height:calc(100cqh - 8px); min-height:330px; display:grid; grid-template-rows:minmax(0,1fr) 92px 28px; gap:14px; padding-bottom:14px; }
.game-hero { position:relative; min-height:0; border-radius:28px; overflow:hidden; isolation:isolate; display:grid; grid-template-columns:1fr 28%; align-items:center; gap:28px; padding:28px; }
.hero-background,.hero-gradient { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:-1; } .hero-background { filter:brightness(.72); } .hero-gradient { background:linear-gradient(90deg,#0c1425ee,#0c1425bb 52%,#0c14252a),linear-gradient(0deg,#0c1425a8,transparent); }
.game-identity { display:flex; flex-direction:column; gap:12px; min-width:0; } .game-identity>.vk-footnote { letter-spacing:.08em; color:#ffffffb8; font-size:11px; } h1 { font-size:clamp(30px,4.5cqw,50px); line-height:1.02; letter-spacing:-.045em; } .game-identity p { font-size:17px; line-height:1.45; max-width:510px; color:#ffffffe0; } .creator { font-size:13px; color:#ffffffac; } .identity-actions { display:flex; align-items:center; flex-wrap:wrap; gap:14px; margin-top:7px; } .identity-actions svg { width:20px; height:20px; }
.game-poster { width:100%; max-height:100%; aspect-ratio:1; object-fit:cover; border-radius:22px; transform:rotate(3deg); box-shadow:0 20px 40px #0006,0 0 0 1px #ffffff30; }
.game-facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); padding:14px 12px; } .game-facts>div { display:grid; grid-template-columns:28px 1fr; gap:4px 10px; align-content:center; padding:0 12px; } .game-facts>div+div { border-left:1px solid #ffffff13; } .game-facts svg { grid-row:span 2; width:25px; height:25px; color:#ffffffbf; align-self:center; } .game-facts b { font-size:14px; font-weight:600; } .game-facts small { color:var(--vk-secondary); font-size:11px; } .opening-note { text-align:center; align-self:center; font-size:12px; }
.detail-section { margin:28px 0; } .detail-section h2 { font-size:24px; font-weight:650; letter-spacing:-.025em; } .section-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px; } .section-heading p { color:var(--vk-secondary); font-size:13px; margin-top:6px; }
.art-gallery { display:grid; grid-template-columns:minmax(0,1fr) 145px; gap:14px; } .gallery-image { position:relative; height:270px; overflow:hidden; border-radius:24px; background:#101827; } .gallery-image img { width:100%; height:100%; object-fit:contain; } .gallery-image.wide img { object-fit:cover; } .gallery-image.detail img { object-fit:cover; transform:scale(1.4); } .gallery-label { position:absolute; bottom:14px; left:14px; font-size:12px; background:#0b132dcc; padding:8px 12px; border-radius:20px; }
.gallery-picker { display:flex; flex-direction:column; gap:10px; } .gallery-picker button { flex:1; min-height:64px; display:flex; align-items:center; gap:10px; padding:8px; background:#ffffff09; border:1px solid #ffffff12; border-radius:18px; font-size:12px; } .gallery-picker button[aria-pressed=true] { background:#ffffff20; border-color:#ffffff80; } .gallery-picker img { width:53px; height:53px; object-fit:cover; border-radius:11px; } .gallery-picker .detail { object-position:75% 50%; }
.control-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:16px; } .control-grid article { padding:24px; } .control-grid svg { width:32px; height:32px; color:#d5bcff; margin-bottom:14px; } h3 { font-size:17px; font-weight:650; } .control-grid p { color:var(--vk-secondary); font-size:15px; line-height:1.6; margin:10px 0 16px; } .key-hints { display:flex; gap:7px; flex-wrap:wrap; } kbd { min-width:30px; padding:6px 8px; background:#ffffff12; border:1px solid #ffffff20; border-radius:8px; font:12px inherit; } .key-hints span { font-size:12px; color:#ddd1f9; }
.milestone-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; } .milestone { display:flex; flex-direction:column; gap:16px; padding:20px; } .milestone-mark { display:grid; place-items:center; width:50px; height:50px; border-radius:18px; background:#ffffff0d; color:#ffffff60; } .milestone-mark svg { width:26px; height:26px; } .earned .milestone-mark { color:#f8d191; background:linear-gradient(145deg,#e6b56b40,#e6b56b08); box-shadow:inset 0 0 0 1px #e6b56b33; } .milestone-status { font-size:9px; color:var(--vk-tertiary); letter-spacing:.12em; } .earned .milestone-status { color:#ecd09d; } .milestone h3 { margin:6px 0; } .milestone p { font-size:12px; color:var(--vk-secondary); line-height:1.5; }
.related-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:16px; } .related-game { display:flex; align-items:center; text-align:left; padding:12px; gap:12px; border:0; min-height:80px; } .related-game>img { width:56px; height:56px; border-radius:14px; object-fit:cover; } .related-game>span { min-width:0; display:flex; flex-direction:column; gap:5px; } .related-game b { font-size:13px; } .related-game small { font-size:11px; color:var(--vk-secondary); } .related-game>svg { width:20px; height:20px; flex:none; margin-left:auto; } .detail-footer { padding:0 8px 20px; line-height:1.6; max-width:720px; }
@container(max-height:540px) { .game-page { padding-top:16px; } .detail-nav { padding-bottom:10px; } .detail-opening { min-height:300px; grid-template-rows:minmax(0,1fr) 78px 22px; gap:10px; } .game-hero { padding:22px; gap:22px; } .game-identity { gap:8px; } h1 { font-size:34px; } .game-identity p { font-size:15px; } .identity-actions { margin-top:2px; } .game-facts { padding:10px; } }
@container(max-width:600px) { .game-page { padding:16px 18px 0; } .detail-nav>.vk-footnote { font-size:10px; } .detail-opening { min-height:355px; grid-template-rows:minmax(0,1fr) 70px 28px; gap:10px; } .game-hero { grid-template-columns:1fr; padding:22px; align-items:end; } .game-poster { display:none; } .hero-gradient { background:linear-gradient(0deg,#0c1425f8,#0c1425aa 70%,#0c142529); } .game-identity { gap:9px; } h1 { font-size:32px; } .game-identity p { font-size:15px; } .game-identity>.vk-footnote { font-size:10px; } .game-facts>div { grid-template-columns:1fr; gap:4px; padding:0 8px; text-align:center; } .game-facts svg,.game-facts small { display:none; } .game-facts b { font-size:11px; } .game-facts { padding:10px 4px; } .opening-note { font-size:10px; } .art-gallery { grid-template-columns:1fr; } .gallery-image { height:210px; } .gallery-picker { flex-direction:row; } .gallery-picker button { flex-direction:column; font-size:11px; min-width:0; } .gallery-picker img { width:100%; height:55px; } .control-grid,.milestone-grid,.related-grid { grid-template-columns:1fr; } .milestone { flex-direction:row; } .milestone-mark { flex:none; } .detail-section h2 { font-size:22px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none !important; transition:none !important; } }
</style>
