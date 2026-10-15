<script setup lang="ts">
import { VISION } from '../vision';
import { vHover } from '../kit/hover';
import Creature from './encounter/Creature.vue';
import BotanicalLayer from './encounter/BotanicalLayer.vue';
import AppGlyph from './files/AppGlyph.vue';

const props = defineProps<{ compact?: boolean }>();
const vision = inject(VISION, undefined);
type Scene = 'valley' | 'lagoon';
type Mood = 'idle' | 'sniff' | 'roar' | 'feed';
type Point = { x: number; y: number };
const uid = 'encounter-' + useId().replace(/[^a-zA-Z0-9]/g, '');
const stage = ref<HTMLElement | null>(null);
const butterflyElement = ref<HTMLElement | null>(null);
const scene = ref<Scene>('valley');
const active = ref(false);
const playing = ref(false);
const progress = ref(0);
const reduced = ref(false);
const visible = ref(true);
const documentHidden = ref(false);
const fieldSpecies = ref<Scene>('valley');
const landed = ref(false);
const mood = ref<Mood>('idle');
const headAngle = ref(0);
const sound = ref(false);
const dimmed = ref(false);
const help = ref(false);
const helpSheet = ref<HTMLElement | null>(null);
const helpButton = ref<HTMLButtonElement | null>(null);
const audioLoading = ref(false);
const caption = ref('No jump scares. The dinosaur has manners.');
const snacks = ref(0);
const creatureVisible = computed(() => active.value && progress.value >= 22);
const walking = computed(() => playing.value && progress.value >= 22 && progress.value < 45);
const sceneName = computed(() => scene.value === 'valley' ? 'Fern Valley' : 'The Blue Lagoon');
const creatureName = computed(() => scene.value === 'valley' ? 'A very curious rex' : 'A gentle triceratops');
const chapter = computed(() => {
  if (!active.value) return 'A little wonder';
  if (progress.value < 13) return '01 · The portal';
  if (progress.value < 22) return '02 · A small visitor';
  if (progress.value < 45) return '03 · Footsteps';
  return '04 · A new acquaintance';
});
const creatureStyle = computed(() => {
  const approach = Math.max(0, Math.min(1, (progress.value - 22) / 23));
  const eased = 1 - Math.pow(1 - approach, 3);
  return {
    '--approach-x': (1 - eased) * 40 + '%',
    '--approach-y': (1 - eased) * 16 + '%',
    '--approach-scale': .38 + eased * .62,
    opacity: approach > 0 ? 1 : 0,
  };
});
const ambientCaption = computed(() => {
  if (!active.value) return 'Hold still. Curiosity might land on you.';
  if (mood.value === 'sniff') return 'An ancient nose. A thoroughly modern pointer.';
  if (landed.value) return 'A small moment of trust.';
  if (creatureVisible.value) return 'Move slowly. Let it come to you.';
  return 'A pointer is a perch. A still hand is an invitation.';
});
const jokes = [
  'I was told there would be chai.',
  'I am not extinct. Just between projects.',
  'Tiny arms. Very large backlog.',
  'That butterfly has better work-life balance.',
];
let jokeIndex = 0;
let frame = 0;
let mounted = false;
let elapsed = 0;
let previousFrame = 0;
let previousUpdate = 0;
let previousPose = 0;
let visibilityObserver: IntersectionObserver | undefined;
let movedAt = 0;
let lastSniff = -10000;
let hasPointer = false;
let pointerPending: Point | null = null;
let target: Point = { x: .5, y: .4 };
let butterfly: Point = { x: .5, y: .4 };
let width = 600;
let height = 300;
let observer: ResizeObserver | undefined;
let motionQuery: MediaQueryList | undefined;
let reactionTimer: ReturnType<typeof setTimeout> | undefined;
let captionTimer: ReturnType<typeof setTimeout> | undefined;
let previousDim: number | undefined;
let audio: AudioContext | undefined;
let soundRequest = 0;
const audioSources = new Set<AudioBufferSourceNode>();
const audioNodes = new Set<AudioNode>();

function temporaryCaption(text: string): void {
  caption.value = text;
  if (captionTimer) clearTimeout(captionTimer);
  captionTimer = setTimeout(() => {
    caption.value = creatureVisible.value ? 'A surprisingly polite neighbour from another age.' : 'No jump scares. The dinosaur has manners.';
    captionTimer = undefined;
  }, 4300);
}
function react(nextMood: Mood, text?: string): void {
  if (reactionTimer) clearTimeout(reactionTimer);
  mood.value = nextMood;
  if (text) temporaryCaption(text);
  reactionTimer = setTimeout(() => {
    mood.value = 'idle';
    reactionTimer = undefined;
  }, nextMood === 'roar' ? 950 : 1000);
}
function restoreDim(): void {
  // Do not overwrite a room setting changed by another app while this window was open.
  if (vision && previousDim !== undefined && vision.dim.value === .64) vision.dim.value = previousDim;
  previousDim = undefined;
}
function toggleDim(): void {
  dimmed.value = !dimmed.value;
  if (dimmed.value) {
    if (vision) {
      previousDim = vision.dim.value;
      vision.dim.value = .64;
    } else temporaryCaption('The portal grows quieter. Room dimming needs the headset shell.');
  } else restoreDim();
}
function stopCreatureSound(): void {
  soundRequest++;
  sound.value = false;
  audioLoading.value = false;
  for (const source of audioSources) {
    try { source.stop(); } catch { /* A finished source is already silent. */ }
  }
}
async function toggleSound(): Promise<void> {
  if (sound.value) {
    stopCreatureSound();
    temporaryCaption('A quiet prehistoric afternoon.');
    return;
  }
  if (audioLoading.value) return;
  const request = ++soundRequest;
  audioLoading.value = true;
  try {
    if (!window.AudioContext) throw new Error('Audio unavailable');
    if (!audio || audio.state === 'closed') audio = new window.AudioContext();
    const context = audio;
    await context.resume();
    if (!mounted || request !== soundRequest) return;
    sound.value = true;
    temporaryCaption('Sound enabled. Tap the dinosaur for a small, friendly growl.');
  } catch {
    sound.value = false;
    if (mounted && request === soundRequest) temporaryCaption('Sound is unavailable here. The dinosaur is happy to mime.');
  } finally {
    if (request === soundRequest) audioLoading.value = false;
  }
}
function growl(): void {
  const context = audio;
  if (!sound.value || !context || context.state !== 'running') return;
  try {
    const duration = .85;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < samples.length; index++) {
      previous = (previous + Math.random() * 2 - 1) / 1.04;
      samples[index] = previous * .22 * (1 + Math.sin(index / context.sampleRate * 47) * .28);
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(scene.value === 'valley' ? 420 : 260, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, context.currentTime + duration);
    gain.gain.setValueAtTime(.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.19, context.currentTime + .09);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    audioSources.add(source);
    audioNodes.add(filter);
    audioNodes.add(gain);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      audioSources.delete(source);
      audioNodes.delete(filter);
      audioNodes.delete(gain);
    };
    source.start();
    source.stop(context.currentTime + duration);
  } catch {
    sound.value = false;
    temporaryCaption('A silent roar. Audio took the afternoon off.');
  }
}
function roar(): void {
  if (!creatureVisible.value || mood.value === 'roar') return;
  react('roar', scene.value === 'valley' ? (jokes[jokeIndex++ % jokes.length] ?? 'Oh. Hello there.') : 'Three horns. Zero interest in your sprint planning.');
  growl();
}
function feed(): void {
  if (!creatureVisible.value) return;
  snacks.value++;
  react('feed', scene.value === 'valley' ? 'A fictional fern snack. This rex has read the room.' : 'Fresh ferns. Finally, a backlog worth chewing through.');
}
function begin(): void {
  if (reactionTimer) clearTimeout(reactionTimer);
  if (captionTimer) clearTimeout(captionTimer);
  reactionTimer = undefined;
  captionTimer = undefined;
  active.value = true;
  playing.value = !reduced.value;
  progress.value = reduced.value ? 46 : 0;
  elapsed = progress.value * 280;
  previousFrame = 0;
  hasPointer = false;
  landed.value = false;
  mood.value = 'idle';
  butterfly = { x: .5, y: .4 };
  caption.value = 'Something small. Something quite prehistoric.';
  if (reduced.value) void nextTick(placeButterfly);
  else if (!frame && mounted && visible.value && !document.hidden) frame = requestAnimationFrame(animate);
}
function replay(): void {
  snacks.value = 0;
  begin();
}
function changeScene(nextScene: Scene): void {
  if (scene.value === nextScene) return;
  scene.value = nextScene;
  snacks.value = 0;
  if (active.value) begin();
}
function end(): void {
  stopCreatureSound();
  restoreDim();
  dimmed.value = false;
  leave();
  active.value = false;
  playing.value = false;
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  progress.value = 0;
  mood.value = 'idle';
  landed.value = false;
  caption.value = 'No jump scares. The dinosaur has manners.';
  if (reactionTimer) clearTimeout(reactionTimer);
  if (captionTimer) clearTimeout(captionTimer);
  reactionTimer = undefined;
  captionTimer = undefined;
}
function scrub(event: Event): void {
  const element = event.target;
  if (!(element instanceof HTMLInputElement)) return;
  active.value = true;
  playing.value = false;
  progress.value = Number(element.value);
  elapsed = progress.value * 280;
  mood.value = 'idle';
}
function placeButterfly(): void {
  const element = butterflyElement.value;
  if (!element) return;
  element.style.transform = 'translate(' + butterfly.x * width + 'px, ' + butterfly.y * height + 'px)';
}
function pointerMove(event: PointerEvent): void {
  if (!active.value) return;
  if (reduced.value && stage.value) {
    const box = stage.value.getBoundingClientRect();
    target = {
      x: Math.max(.06, Math.min(.94, (event.clientX - box.left) / (box.width || 1))),
      y: Math.max(.08, Math.min(.86, (event.clientY - box.top) / (box.height || 1))),
    };
    butterfly = { ...target };
    placeButterfly();
    return;
  }
  pointerPending = { x: event.clientX, y: event.clientY };
  movedAt = performance.now();
  hasPointer = true;
}
function leave(): void {
  hasPointer = false;
  pointerPending = null;
  landed.value = false;
}
function stageKeys(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
  const moves: Record<string, Point> = {
    ArrowLeft: { x: -.06, y: 0 }, ArrowRight: { x: .06, y: 0 },
    ArrowUp: { x: 0, y: -.08 }, ArrowDown: { x: 0, y: .08 },
  };
  const movement = moves[event.key];
  if (movement) {
    event.preventDefault();
    event.stopPropagation();
    if (!active.value) begin();
    target = { x: Math.max(.08, Math.min(.92, target.x + movement.x)), y: Math.max(.08, Math.min(.85, target.y + movement.y)) };
    hasPointer = true;
    movedAt = performance.now();
    if (reduced.value) { butterfly = { ...target }; placeButterfly(); }
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    if (!active.value) begin();
    else if (creatureVisible.value) roar();
    else playing.value = !playing.value;
  }
}
function motionChanged(event: MediaQueryListEvent): void {
  reduced.value = event.matches;
  if (event.matches) {
    playing.value = false;
    cancelAnimationFrame(frame);
    frame = 0;
    stage.value?.style.setProperty('--px', '0');
    stage.value?.style.setProperty('--py', '0');
    butterfly = { x: .38, y: .29 };
    placeButterfly();
  } else if (active.value && !frame && visible.value && !document.hidden) frame = requestAnimationFrame(animate);
  if (event.matches && active.value && progress.value < 46) {
    progress.value = 46;
    elapsed = 12880;
  }
}
function syncVisibility(): void {
  documentHidden.value = document.hidden;
  const canAnimate = visible.value && !document.hidden;
  if (!canAnimate) { cancelAnimationFrame(frame); frame = 0; previousFrame = 0; if (audio?.state === 'running') void audio.suspend().catch(() => undefined); }
  else { if (active.value && !reduced.value && !frame) frame = requestAnimationFrame(animate); if (sound.value && audio?.state === 'suspended') void audio.resume().catch(() => undefined); }
}
function animate(now: number): void {
  const delta = Math.min(50, now - previousFrame || 16);
  previousFrame = now;
  if (active.value) {
    if (playing.value) {
      elapsed = Math.min(28000, elapsed + delta);
      if (now - previousUpdate > 100) {
        progress.value = elapsed / 280;
        previousUpdate = now;
      }
      if (elapsed === 28000) {
        progress.value = 100;
        playing.value = false;
      }
    }
    const element = stage.value;
    if (pointerPending && element) {
      const box = element.getBoundingClientRect();
      target = {
        x: Math.max(.06, Math.min(.94, (pointerPending.x - box.left) / (box.width || 1))),
        y: Math.max(.08, Math.min(.86, (pointerPending.y - box.top) / (box.height || 1))),
      };
      pointerPending = null;
    }
    if (!hasPointer && playing.value) {
      target = reduced.value ? { x: .38, y: .29 } : { x: .38 + Math.sin(now / 1900) * .13, y: .29 + Math.cos(now / 2600) * .08 };
    }
    const smoothing = reduced.value ? 1 : 1 - Math.exp(-delta / 165);
    butterfly.x += (target.x - butterfly.x) * smoothing;
    butterfly.y += (target.y - butterfly.y) * smoothing;
    if (butterflyElement.value) {
      const emergence = reduced.value ? 1 : Math.min(1, elapsed / 3000);
      butterflyElement.value.style.transform = 'translate(' + butterfly.x * width + 'px, ' + butterfly.y * height + 'px) scale(' + (.18 + emergence * .82) + ')';
    }
    const still = hasPointer && now - movedAt > 650 && Math.hypot(target.x - butterfly.x, target.y - butterfly.y) < .006;
    if (landed.value !== still) landed.value = still;
    if (element) {
      element.style.setProperty('--px', String(reduced.value ? 0 : (target.x - .5) * 2));
      element.style.setProperty('--py', String(reduced.value ? 0 : (target.y - .5) * 2));
    }
    if (now - previousPose >= 100) {
      previousPose = now;
      const angle = Math.max(-9, Math.min(8, (target.y - .45) * 20 + (target.x - .7) * 5));
      if (Math.abs(angle - headAngle.value) > .35) headAngle.value = angle;
    }
    if (creatureVisible.value && progress.value >= 45 && hasPointer && mood.value === 'idle' && now - lastSniff > 5000
      && Math.hypot(target.x - .76, target.y - .4) < .18) {
      lastSniff = now;
      react('sniff');
    }
  }
  frame = mounted && visible.value && !document.hidden && active.value && !reduced.value ? requestAnimationFrame(animate) : 0;
}
function togglePlayback(): void {
  if (progress.value >= 100) { replay(); return; }
  if (reduced.value) {
    progress.value = 100;
    elapsed = 28000;
    temporaryCaption('Your neighbour is here. No rush, no motion.');
  } else playing.value = !playing.value;
}
function stepBack(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !help.value && !active.value) return;
  event.preventDefault();
  event.stopPropagation();
  if (help.value) help.value = false;
  else end();
}
function trapHelp(event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const buttons = Array.from(helpSheet.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  const first = buttons[0], last = buttons[buttons.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
watch(help, open => {
  void nextTick(() => {
    if (open) helpSheet.value?.querySelector<HTMLButtonElement>('button')?.focus();
    else helpButton.value?.focus();
  });
});
onMounted(() => {
  mounted = true;
  documentHidden.value = document.hidden;
  document.addEventListener('visibilitychange', syncVisibility);
  if (stage.value && typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver(entries => { visible.value = entries[0]?.isIntersecting ?? false; syncVisibility(); });
    visibilityObserver.observe(stage.value);
  }
  if (typeof window.matchMedia === 'function') {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.value = motionQuery.matches;
    motionQuery.addEventListener('change', motionChanged);
  } else reduced.value = true;
  if (stage.value) {
    width = stage.value.clientWidth;
    height = stage.value.clientHeight;
    if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) { width = entry.contentRect.width; height = entry.contentRect.height; }
    });
    observer?.observe(stage.value);
  }
});
onBeforeUnmount(() => {
  mounted = false;
  document.removeEventListener('visibilitychange', syncVisibility);
  visibilityObserver?.disconnect();
  cancelAnimationFrame(frame);
  observer?.disconnect();
  motionQuery?.removeEventListener('change', motionChanged);
  end();
  restoreDim();
  for (const source of audioSources) {
    source.onended = null;
    try { source.stop(); } catch { /* An ended source cannot be stopped twice. */ }
    source.disconnect();
  }
  for (const node of audioNodes) node.disconnect();
  audioSources.clear();
  audioNodes.clear();
  if (audio && audio.state !== 'closed') void audio.close().catch(() => undefined);
});
</script>

<template>
  <main class="encounter-app" :class="{ compact: props.compact, reduced, active, 'room-dark': dimmed, 'motion-paused': !visible || documentHidden }" @keydown="stepBack">
    <header class="encounter-header" :inert="help">
      <div>
        <p class="eyebrow vk-footnote">{{ chapter }}</p>
        <h1 class="vk-large-title">Encounter Dinosaurs</h1>
      </div>
      <button ref="helpButton" v-hover class="vk-icon" aria-label="How to meet your prehistoric neighbours" :aria-expanded="help" @click="help = !help">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M9.5 8a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4" /><path d="M12 16v.5" />
        </svg>
      </button>
    </header>

    <div class="experience" :inert="help">
      <nav class="scene-tabs vk-tabbar" aria-label="Encounter scenes">
        <button v-hover class="vk-icon" :aria-pressed="scene === 'valley'" aria-label="Fern Valley, curious rex" @click="changeScene('valley')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M12 21V4m0 11C4 15 4 9 4 7c4 0 8 3 8 8Zm0-5c6 0 8-4 8-7-5 0-8 2-8 7Z" />
          </svg>
          <span>Fern Valley</span>
        </button>
        <button v-hover class="vk-icon" :aria-pressed="scene === 'lagoon'" aria-label="Blue Lagoon, gentle triceratops" @click="changeScene('lagoon')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M3 15q3-4 6 0t6 0 6 0M3 20q3-4 6 0t6 0 6 0" /><circle cx="16" cy="6" r="3" />
          </svg>
          <span>Blue Lagoon</span>
        </button>
      </nav>
      <section ref="stage" class="stage" :class="[scene, mood]" tabindex="0"
        :aria-label="sceneName + '. Use arrow keys to move the butterfly. Hold still to let it land. Enter greets the dinosaur.'"
        @pointermove="pointerMove" @pointerdown="pointerMove" @pointerleave="leave" @keydown="stageKeys">
        <div :key="scene + (active ? '-open' : '-rest')" class="portal-aperture">
          <div class="sky"></div>
          <svg class="landscape far-layer" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient :id="uid + '-mountain'" x2="0" y2="1">
                <stop :stop-color="scene === 'valley' ? '#697d68' : '#749699'" /><stop offset="1" stop-color="#233e36" />
              </linearGradient>
              <linearGradient :id="uid + '-water'" x2="0" y2="1">
                <stop stop-color="#7eafa8" /><stop offset="1" stop-color="#1d514f" />
              </linearGradient>
              <radialGradient :id="uid + '-sun'">
                <stop stop-color="#fff0cc" stop-opacity=".8" /><stop offset="1" stop-color="#ffeac5" stop-opacity="0" />
              </radialGradient>
            </defs>
            <circle cx="680" cy="153" r="125" :fill="'url(#' + uid + '-sun)'" />
            <circle cx="680" cy="153" r="28" fill="#eddbab" opacity=".7" />
            <path d="M-70 331 58 219l44 23 132-136 76 96 75-44 115 150 156-83 170 91 155-128 134 170v280H-70Z"
              :fill="'url(#' + uid + '-mountain)'" opacity=".78" />
            <path d="m102 242 132-136-14 64-39 16-11 29-26 3Zm554-17 98 52-86-20-34 18-27-3Z" fill="#b1b599" opacity=".28" />
            <path d="M0 363c115-40 214-26 329 0s157-1 257-37 303-9 414 47v227H0Z" fill="#3b6350" />
            <path d="M0 414c226-42 288 22 492 4 215-19 318-46 508-12v194H0Z" fill="#214b3f" />
            <path v-if="scene === 'lagoon'" d="M0 445c200-7 285 33 480 7 221-29 366-13 520 6v142H0Z" :fill="'url(#' + uid + '-water)'" />
            <g v-if="scene === 'lagoon'" stroke="#c2dcd0" opacity=".35" stroke-linecap="round">
              <path d="M51 483h177m172 12h126m57-34h75M170 533h163m316-20h140M432 558h133m251-75h90" />
            </g>
            <path d="M-10 588c185-57 288-32 428-31s350-49 594-4v50H-10Z" fill="#203c30" />
            <g fill="#d5e3be" opacity=".35">
              <circle v-for="n in 15" :key="n" :cx="(n * 73) % 970" :cy="140 + (n * 41) % 280" :r="n % 3 === 0 ? 2 : 1" />
            </g>
          </svg>
          <svg class="landscape middle-layer" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <g fill="none" stroke-linecap="round">
              <path d="M118 595c-27-161-6-351 8-476m-10 264-58-94m65-101 61-84M874 600c-20-154-13-353 1-480m-4 216 65-85m-60-51-57-79"
                stroke="#253f31" stroke-width="27" />
              <path d="M116 362c-24-126-80-169-157-157m159 81c40-139 98-148 160-144M868 295c-45-126-91-170-163-157m171 88c35-63 69-89 128-93"
                stroke="#456a48" stroke-width="18" />
              <path d="M5 526q148-45 186 74m703 0q12-76 114-93" stroke="#41634a" stroke-width="30" />
            </g>
            <g fill="#355842">
              <path d="M130 192C97 62 27 51-8 74c98 13 83 52 138 118ZM122 222C221 62 298 91 328 135c-107-27-137 51-206 87Z" />
              <path d="M864 194C794 40 706 80 687 105c109 4 109 65 177 89Zm17 28c13-122 112-142 173-83-119-9-114 70-173 83Z" />
            </g>
            <g fill="#6f8651" opacity=".55">
              <path d="M123 191 66 97l68 78Zm26 7 98-68-69 77ZM863 191l-107-86 66 82Zm23-8 67-53-61 79Z" />
            </g>
          </svg>
          <BotanicalLayer :lagoon="scene === 'lagoon'" />
          <div class="mist mist-back"></div>
          <div class="mist mist-front"></div>
        </div>
        <div class="portal-rim" aria-hidden="true"></div>
        <div class="scene-caption vk-footnote"><span class="scene-dot"></span>{{ sceneName }}<span class="era"> · An imagined Cretaceous</span></div>

        <div v-if="!active" class="welcome-creature" aria-hidden="true"><Creature :id="uid + '-poster'" :scene="scene" mood="idle" :walking="false" :paused="true" :head-angle="-3" /></div>
        <Transition name="welcome">
          <section v-if="!active" class="welcome-panel">
            <p class="intro-label vk-footnote">AN ILLUSTRATED ENCOUNTER</p>
            <svg class="intro-butterfly" viewBox="0 0 100 80" aria-hidden="true">
              <path d="M47 43C5-17-9 31 23 51 8 85 49 83 47 43M53 43C95-17 109 31 77 51 92 85 51 83 53 43" fill="#e7cc92" />
              <path d="M50 23v42m0-42-8-10m8 10 8-10" fill="none" stroke="#f3e9c6" stroke-width="2" />
            </svg>
            <h2>
              <span class="full-welcome">Wonder, just <br />within reach.</span>
              <span class="short-welcome">Meet a little wonder.</span>
            </h2>
            <p class="vk-body">Step into a world of dappled light, quiet footsteps, and unexpected company.</p>
            <button v-hover class="vk-button primary begin-button" @click.stop="begin">Open the portal <AppGlyph name="open" /></button>
            <div class="experience-facts"><span><b>28 seconds</b>Take your time</span><span><b>2 habitats</b>A new neighbour in each</span></div><small class="vk-footnote">Original illustration · Browser simulation</small>
          </section>
        </Transition>

        <button v-if="creatureVisible" v-hover class="vk-button creature-button" :style="creatureStyle"
          :aria-label="creatureName + '. Tap for a friendly roar.'" @click.stop="roar">
          <Creature :id="uid" :scene="scene" :mood="mood" :walking="walking" :paused="(!playing && progress < 100) || reduced || !visible || documentHidden" :head-angle="headAngle" />
        </button>
        <div v-if="active" ref="butterflyElement" class="butterfly" :class="{ landed, still: !playing }" aria-hidden="true">
          <div class="landing-halo"></div>
          <svg viewBox="0 0 100 80">
            <g class="wing left-wing">
              <path d="M48 42C16-7-9 9 8 36c4 13 14 17 23 18-18 4-15 25 0 20 15-4 17-19 17-32" fill="#d7aa69" stroke="#80613e" stroke-width="1.4" />
              <path d="M43 41C23 8 9 16 18 33l19 14m3 11-12 11" fill="none" stroke="#f7deb1" stroke-width="4" />
              <circle cx="23" cy="29" r="4.5" fill="#514e35" /><circle cx="23" cy="29" r="2" fill="#f9dfab" />
            </g>
            <g class="wing right-wing">
              <path d="M52 42C84-7 109 9 92 36c-4 13-14 17-23 18 18 4 15 25 0 20-15-4-17-19-17-32" fill="#d7aa69" stroke="#80613e" stroke-width="1.4" />
              <path d="M57 41C77 8 91 16 82 33L63 47m-3 11 12 11" fill="none" stroke="#f7deb1" stroke-width="4" />
              <circle cx="77" cy="29" r="4.5" fill="#514e35" /><circle cx="77" cy="29" r="2" fill="#f9dfab" />
            </g>
            <path d="M50 27v36m0-36-9-10m9 10 9-10" fill="none" stroke="#eae3b8" stroke-width="2" stroke-linecap="round" />
            <ellipse cx="50" cy="45" rx="3" ry="18" fill="#564e36" />
          </svg>
        </div>
        <svg v-if="mood === 'feed'" class="fern-snack" viewBox="0 0 50 60" aria-hidden="true">
          <path d="M25 58V5M25 43Q3 42 5 23q18 1 20 20m0-13Q45 29 45 10q-18 0-20 20m0 23Q44 53 45 35q-18 2-20 18"
            fill="#93b766" stroke="#b9d98c" stroke-width="2" />
        </svg>
        <div v-if="active" class="ambient-caption vk-footnote">{{ ambientCaption }}</div>
      </section>
    </div>

    <footer class="controls" :inert="help">
      <div v-if="active" class="timeline vk-well">
        <button v-hover class="vk-icon plain" :aria-label="playing ? 'Pause encounter' : 'Continue encounter'"
          @click="togglePlayback">
          <svg v-if="playing" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="m8 5 12 7-12 7z" />
          </svg>
        </button>
        <input v-hover class="vk-slider" type="range" min="0" max="100" step=".1" :value="progress" :style="{ '--value': progress / 100 }"
          aria-label="Encounter timeline" :aria-valuetext="chapter" @input="scrub" />
        <span class="timeline-time vk-footnote">{{ String(Math.floor(progress * .28)).padStart(2, '0') }} / 28s</span>
      </div>
      <div class="toolbar vk-ornament vk-scroll">
        <template v-if="active">
          <button v-hover class="vk-button feed-button" :disabled="!creatureVisible" :aria-label="'Feed a fern. ' + snacks + ' snacks shared.'" @click="feed">
            <AppGlyph name="leaf" /> Feed<span v-if="snacks" class="snack-count">{{ snacks }}</span>
          </button>
          <button v-hover class="vk-icon" aria-label="Replay encounter" @click="replay">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 7a8 8 0 1 1-1 9M5 3v5h5" /></svg>
          </button>
        </template>
        <button v-hover class="vk-icon" :disabled="audioLoading" :aria-busy="audioLoading" :aria-pressed="sound"
          :aria-label="sound ? 'Turn creature sound off' : 'Enable creature sound'" @click="toggleSound">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4Z" /><path v-if="sound" d="M16 8q5 4 0 8m3-11q8 7 0 14" /><path v-else d="m17 9 5 6m0-6-5 6" />
          </svg>
        </button>
        <button v-hover class="vk-icon" :aria-pressed="dimmed" aria-label="Dim the room" @click="toggleDim">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z" /></svg>
        </button>
        <button v-if="active" v-hover class="vk-icon" aria-label="End encounter" @click="end">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
            <path d="m7 7 10 10M7 17 17 7" />
          </svg>
        </button>
        <span v-if="!active" class="toolbar-hint vk-footnote">Sound and room lighting</span>
      </div>
      <p class="footer-caption vk-footnote" aria-live="polite">{{ caption }}</p>
    </footer>

    <Transition name="sheet">
      <div v-if="help" class="help-backdrop" @click.self="help = false">
      <section ref="helpSheet" class="help-sheet vk-sheet vk-scroll" role="dialog" aria-modal="true"
        aria-label="A field guide to small wonders" @keydown="trapHelp">
        <header>
          <h2 class="vk-title">A field guide</h2>
          <button v-hover class="vk-icon" aria-label="Close field guide" @click="help = false"><AppGlyph name="close" /></button>
        </header>
        <p class="vk-body">Two habitats. Two very different personalities.</p>
        <div class="field-tabs vk-segmented" role="group" aria-label="Choose illustrated creature"><button v-hover :aria-pressed="fieldSpecies === 'valley'" @click="fieldSpecies = 'valley'">Curious rex</button><button v-hover :aria-pressed="fieldSpecies === 'lagoon'" @click="fieldSpecies = 'lagoon'">Triceratops</button></div>
        <div class="field-portrait vk-well"><Creature :id="uid + '-field'" :scene="fieldSpecies" mood="idle" :walking="false" :paused="true" :head-angle="0" /></div>
        <div class="field-description"><span class="vk-footnote vk-secondary">{{ fieldSpecies === 'valley' ? 'FERN VALLEY / CREATURE 01' : 'BLUE LAGOON / CREATURE 02' }}</span><h3>{{ fieldSpecies === 'valley' ? 'A curious neighbour' : 'A gentle giant' }}</h3><p>{{ fieldSpecies === 'valley' ? 'A soft-spoken rex with a watchful eye. Approach its nose slowly and it will lean in for a closer look.' : 'Three horns, a sweeping frill, and a calm presence. Share an imaginary fern and watch its expression change.' }}</p></div>
        <div class="guide-row vk-platter"><b>Hold still</b><p>The butterfly follows your pointer. Rest it for a moment and it will land.</p></div>
        <div class="guide-row vk-platter"><b>Say hello</b><p>Let the dinosaur approach. Move near its nose for a sniff, tap it for a friendly roar, or share a fern.</p></div>
        <div class="guide-row vk-platter"><b>Take your time</b><p>Pause, replay, or scrub through the encounter. The left ornament visits a different creature.</p></div>
        <p class="vk-footnote vk-secondary">
          Keyboard: focus the scene, use arrows to move the perch, and Enter or Space to greet.
          Sound is optional. Neither creature is scientifically hungry.
        </p>
      </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.encounter-app {
  --vk-secondary: rgb(255 255 255 / .82);
  --vk-tertiary: rgb(255 255 255 / .72);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  position: relative;
  container-type: size;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  overflow: hidden;
  color: var(--vk-text, #fff);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
  font-size: 17px;
  line-height: 1.4;
  --spring: cubic-bezier(.2, .9, .3, 1.15);
}

.encounter-app :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

.encounter-app button,
.encounter-app input {
  font: inherit;
  border: 0;
  cursor: pointer;
}

.encounter-app :focus-visible {
  outline: 2px solid #fff;
  outline-offset: 3px;
}

.encounter-app p,
.encounter-app h1,
.encounter-app h2 {
  margin: 0;
}

.encounter-app .encounter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex: none;
}

.encounter-app .eyebrow {
  margin-bottom: 4px;
  color: #e3ddc4;
  letter-spacing: .055em;
}

.encounter-app .experience {
  position: relative;
  flex: 1;
  min-height: 0;
  padding-left: 66px;
}

.encounter-app .scene-tabs {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 7;
}

.encounter-app .scene-tabs button {
  position: relative;
}

.encounter-app .scene-tabs span {
  position: absolute;
  left: 54px;
  top: 50%;
  transform: translateY(-50%) scale(.95);
  background: rgb(39 47 42 / .94);
  border-radius: 16px;
  padding: 10px 16px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms ease-out, transform 220ms var(--spring);
  color: #fff;
  font-size: 15px;
}

.encounter-app .scene-tabs button:hover span,
.encounter-app .scene-tabs button:focus-visible span {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

.encounter-app .stage {
  position: relative;
  width: 100%;
  height: 100%;
  isolation: isolate;
  border-radius: 32px;
  touch-action: manipulation;
}

.encounter-app .portal-aperture {
  position: absolute;
  inset: 0 0 14px;
  border-radius: 32px;
  overflow: hidden;
  background: #213c30;
  box-shadow: inset 0 0 50px rgb(1 17 12 / .4);
  transform: scale(1);
  transition: transform 300ms var(--spring), opacity 300ms ease-out;
}

.encounter-app .active .portal-aperture {
  animation: portal-open 300ms var(--spring) both;
}

.encounter-app .sky {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 68% 20%, #b4ac7c, #657663 40%, #1a3b32 85%);
}

.encounter-app .lagoon .sky {
  background: radial-gradient(ellipse at 68% 20%, #c3d0bc, #6eaaa5 40%, #204c52 85%);
}

.encounter-app .landscape {
  position: absolute;
  inset: -3%;
  width: 106%;
  height: 106%;
  pointer-events: none;
}

.encounter-app .far-layer {
  transform: translate(calc(var(--px, 0) * -4px), calc(var(--py, 0) * -3px));
}

.encounter-app .middle-layer {
  transform: translate(calc(var(--px, 0) * -12px), calc(var(--py, 0) * -6px));
}

.encounter-app .mist {
  position: absolute;
  inset: 32% -15% 0;
  pointer-events: none;
  background: radial-gradient(ellipse, rgb(200 220 183 / .13), transparent 63%);
}

.encounter-app .mist-back {
  transform: translate(calc(var(--px, 0) * -7px), calc(var(--py, 0) * 3px));
}

.encounter-app .mist-front {
  inset: 70% -10% -10%;
  background: radial-gradient(ellipse, rgb(206 225 191 / .15), transparent 70%);
}

.encounter-app .portal-rim {
  position: absolute;
  inset: -2px -2px 12px;
  border: 7px solid rgb(235 243 225 / .09);
  border-radius: 37px;
  box-shadow: inset 0 0 0 1px rgb(243 253 233 / .2), 0 8px 25px rgb(0 0 0 / .15);
  pointer-events: none;
  z-index: 2;
}

.encounter-app .scene-caption {
  width: max-content;
  max-width: calc(100% - 44px);
  padding: 6px 10px;
  border-radius: 999px;
  background: rgb(18 40 32 / .7);
  pointer-events: none;
  position: absolute;
  top: 20px;
  left: 22px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e3e6d7;
  z-index: 4;
  text-shadow: 0 2px 6px #18382c;
}

.encounter-app .scene-dot {
  height: 5px;
  width: 5px;
  border-radius: 50%;
  background: #dbe2b9;
  margin-right: 3px;
}

.encounter-app .welcome-panel {
  position: absolute;
  inset: 0 0 14px;
  z-index: 6;
  padding: 38px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 13px;
  border-radius: 32px;
  background: radial-gradient(ellipse, rgb(17 39 31 / .6), transparent 77%);
  text-shadow: 0 2px 10px rgb(0 0 0 / .28);
}

.encounter-app .short-welcome {
  display: none;
}

.encounter-app .intro-label {
  font-size: 12px;
  letter-spacing: .12em;
  color: #e0dfc2;
}

.encounter-app .intro-butterfly {
  width: 66px;
  height: 52px;
  filter: drop-shadow(0 8px 13px rgb(5 20 13 / .2));
}

.encounter-app .welcome-panel h2 {
  font-size: clamp(23px, 4.5cqw, 38px);
  line-height: 1.1;
  letter-spacing: -.04em;
  font-weight: 700;
}

.encounter-app .welcome-panel p:not(.intro-label) {
  color: #f1f0db;
}

.encounter-app .welcome-panel small {
  color: #e2e1cf;
}

.encounter-app .begin-button {
  min-height: 52px;
  min-width: 190px;
  margin-top: 7px;
  text-shadow: none;
}

.encounter-app .begin-button span {
  font-size: 23px;
  margin-left: 7px;
}

.encounter-app .creature-button {
  position: absolute;
  right: -1%;
  bottom: -5%;
  width: 92%;
  height: 93%;
  padding: 0;
  display: block;
  background: transparent;
  border-radius: 40%;
  box-shadow: none;
  transform-origin: 67% 91%;
  transform: translate(var(--approach-x), var(--approach-y)) scale(var(--approach-scale));
  transition: transform 250ms ease-out, opacity 250ms ease-out;
  z-index: 3;
  filter: drop-shadow(0 12px 10px rgb(0 0 0 / .2));
}

.encounter-app .creature-button :deep(.creature-art) {
  width: 100%;
  height: 100%;
}

.encounter-app .creature-button:hover {
  background: transparent;
}

.encounter-app .creature-button:active {
  transform: translate(var(--approach-x), var(--approach-y)) scale(calc(var(--approach-scale) * .97));
}

.encounter-app .creature-button::after {
  background: radial-gradient(ellipse at 70% 40%, rgb(255 244 192 / .06), transparent 45%);
}

.encounter-app .butterfly {
  position: absolute;
  left: 0;
  top: 0;
  width: 65px;
  height: 53px;
  margin: -26px 0 0 -32px;
  z-index: 5;
  pointer-events: none;
}

.encounter-app .butterfly svg {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 8px 6px rgb(0 0 0 / .25));
}

.encounter-app .wing {
  transform-box: fill-box;
  animation: flap 230ms ease-in-out infinite alternate;
}

.encounter-app .left-wing {
  transform-origin: right center;
}

.encounter-app .right-wing {
  transform-origin: left center;
  animation-delay: -110ms;
}

.encounter-app .landed .wing {
  animation-duration: 1600ms;
}

.encounter-app .still .wing {
  animation-play-state: paused;
}

.encounter-app .landing-halo {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  opacity: 0;
  background: radial-gradient(circle, rgb(253 237 179 / .24), transparent 65%);
  transition: opacity 250ms ease-out;
}

.encounter-app .landed .landing-halo {
  opacity: 1;
}

.encounter-app .fern-snack {
  position: absolute;
  right: 15%;
  top: 34%;
  width: 48px;
  z-index: 5;
  pointer-events: none;
  animation: feed 300ms var(--spring) both;
}

.encounter-app .ambient-caption {
  padding: 8px 12px;
  border-radius: 14px;
  background: rgb(18 40 32 / .72);
  position: absolute;
  left: 16px;
  bottom: 24px;
  right: 16px;
  z-index: 5;
  pointer-events: none;
  color: #edf1df;
  text-shadow: 0 1px 8px #173128;
}

.encounter-app .controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  flex: none;
}

.encounter-app .timeline {
  width: min(530px, 100%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px 0 4px;
}

.encounter-app .timeline input {
  min-width: 30px;
  flex: 1;
}

.encounter-app .timeline-time {
  flex: none;
  font-variant-numeric: tabular-nums;
  color: #e4e5df;
}

.encounter-app .toolbar {
  flex: none;
  max-width: 100%;
  touch-action: pan-x;
  overscroll-behavior: contain;
}

.encounter-app .toolbar .vk-button {
  flex: none;
  min-height: 44px;
}

.encounter-app .feed-button {
  gap: 7px;
  padding: 0 17px;
}

.encounter-app .feed-button > .app-glyph {
  color: #d3e8b3;
}

.encounter-app .snack-count {
  font-size: 13px;
  background: rgb(255 255 255 / .15);
  border-radius: 50%;
  padding: 2px 7px;
}

.encounter-app .toolbar-hint {
  padding: 0 10px 0 4px;
  white-space: nowrap;
  color: #e0e1df;
}

.encounter-app .footer-caption {
  min-height: 19px;
  text-align: center;
  color: #e2e4de;
  max-width: 95%;
}

.encounter-app .help-backdrop {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgb(0 0 0 / .24);
}

.encounter-app .help-sheet {
  position: absolute;
  top: 80px;
  right: 20px;
  bottom: 20px;
  width: min(370px, calc(100% - 40px));
  z-index: 10;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  touch-action: pan-y;
  overscroll-behavior: contain;
}

.encounter-app .help-sheet header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}

.encounter-app .guide-row {
  padding: 15px;
}

.encounter-app .guide-row p {
  font-size: 15px;
  margin-top: 5px;
  color: rgb(255 255 255 / .82);
}

.encounter-app .welcome-enter-active,
.encounter-app .welcome-leave-active,
.encounter-app .sheet-enter-active,
.encounter-app .sheet-leave-active {
  transition: opacity 250ms ease-out, transform 250ms var(--spring);
}

.encounter-app .welcome-enter-from,
.encounter-app .welcome-leave-to {
  opacity: 0;
  transform: scale(.97);
}

.encounter-app .sheet-enter-from,
.encounter-app .sheet-leave-to {
  opacity: 0;
  transform: scale(.94);
}

.encounter-app:not(.reduced) .stage.roar .portal-aperture,
.encounter-app:not(.reduced) .stage.roar .portal-rim {
  animation: shake 300ms ease-out;
}

.encounter-app .room-dark .portal-rim {
  box-shadow: inset 0 0 0 1px rgb(243 253 233 / .3), 0 0 34px rgb(172 197 148 / .13);
}

@keyframes portal-open {
  from {
    opacity: 0;
    transform: scaleX(.04) scaleY(.94);
  }
}

@keyframes flap {
  from {
    transform: scaleX(.34) rotate(2deg);
  }
  to {
    transform: scaleX(1) rotate(-2deg);
  }
}

@keyframes shake {
  20% {
    transform: translate(-3px, 1px);
  }
  45% {
    transform: translate(2px, -2px);
  }
  70% {
    transform: translate(-1px, 1px);
  }
}

@keyframes feed {
  from {
    opacity: 0;
    transform: translate(25px, 20px) scale(.8);
  }
  to {
    opacity: 1;
    transform: translate(0, 0) scale(1);
  }
}

@container (min-width: 1100px) {
  .encounter-app .encounter-header {
    padding: 0 12px;
  }
  .encounter-app .experience {
    padding-left: 86px;
  }
  .encounter-app .scene-tabs {
    left: 10px;
  }
  .encounter-app .stage {
    max-width: 1300px;
    margin: 0 auto;
  }
  .encounter-app .creature-button {
    width: 82%;
    right: 5%;
  }
  .encounter-app .ambient-caption {
    left: 28px;
    bottom: 32px;
  }
}

@container (max-width: 600px) {
  .encounter-app .encounter-header h1 {
    font-size: 29px;
  }
  .encounter-app .eyebrow {
    font-size: 12px;
  }
  .encounter-app .experience {
    padding-left: 0;
  }
  .encounter-app .scene-tabs {
    top: 8px;
    left: 8px;
    transform: none;
    flex-direction: row;
    padding: 5px;
    gap: 4px;
  }
  .encounter-app .scene-tabs button {
    width: 44px;
    height: 44px;
  }
  .encounter-app .scene-tabs span {
    display: none;
  }
  .encounter-app .scene-caption {
    top: 74px;
    left: 18px;
    right: 18px;
    font-size: 13px;
  }
  .encounter-app .era {
    display: none;
  }
  .encounter-app .welcome-panel {
    padding: 108px 18px 24px;
    gap: 14px;
  }
  .encounter-app .intro-label {
    display: none;
  }
  .encounter-app .welcome-panel h2 {
    font-size: 28px;
  }
  .encounter-app .welcome-panel p {
    font-size: 15px;
  }
  .encounter-app .creature-button {
    width: 125%;
    right: -9%;
    bottom: -2%;
    height: 74%;
  }
  .encounter-app .ambient-caption {
    font-size: 12px;
    left: 13px;
    bottom: 20px;
  }
  .encounter-app .toolbar-hint {
    display: none;
  }
  .encounter-app .timeline {
    gap: 7px;
  }
  .encounter-app .timeline-time {
    font-size: 12px;
  }
  .encounter-app .footer-caption {
    font-size: 13px;
  }
}

@container (max-height: 620px) {
  .encounter-app .welcome-panel .intro-butterfly,
  .encounter-app .welcome-panel small {
    display: none;
  }
  .encounter-app .welcome-panel h2 br {
    display: none;
  }
  .encounter-app .welcome-panel {
    gap: 10px;
  }
}

@container (max-height: 420px) {
  .encounter-app .encounter-header h1 {
    font-size: 23px;
  }
  .encounter-app .eyebrow,
  .encounter-app .footer-caption,
  .encounter-app .timeline-time,
  .encounter-app .intro-label,
  .encounter-app .intro-butterfly,
  .encounter-app .welcome-panel small,
  .encounter-app .ambient-caption {
    display: none;
  }
  .encounter-app .controls {
    flex-direction: row;
    gap: 8px;
  }
  .encounter-app .timeline {
    width: auto;
    min-width: 90px;
    flex: 1;
    padding-right: 8px;
  }
  .encounter-app .toolbar {
    margin-left: auto;
    gap: 3px;
    padding: 4px;
  }
  .encounter-app .toolbar .vk-icon {
    width: 44px;
    height: 44px;
  }
  .encounter-app .feed-button {
    padding: 0 10px;
  }
  .encounter-app .feed-button > .app-glyph {
    display: none;
  }
  .encounter-app .scene-caption {
    top: 15px;
    left: 20px;
  }
  .encounter-app .scene-tabs {
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    flex-direction: column;
  }
  .encounter-app .experience {
    padding-left: 60px;
  }
  .encounter-app .welcome-panel {
    padding: 8px;
    gap: 8px;
  }
  .encounter-app .welcome-panel h2 {
    font-size: 21px;
  }
  .encounter-app .full-welcome {
    display: none;
  }
  .encounter-app .short-welcome {
    display: inline;
  }
  .encounter-app .welcome-panel h2 br {
    display: none;
  }
  .encounter-app .welcome-panel p {
    display: none;
  }
  .encounter-app .begin-button {
    min-height: 44px;
    min-width: 160px;
    margin-top: 0;
  }
  .encounter-app .creature-button {
    width: 105%;
    height: 113%;
    right: -3%;
    bottom: -6%;
  }
  .encounter-app .help-sheet {
    top: 55px;
    bottom: 10px;
  }
}

@container (max-width: 600px) and (min-height: 421px) {
  .encounter-app .experience {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .encounter-app .scene-tabs {
    position: static;
    align-self: flex-start;
    transform: none;
  }
  .encounter-app .stage {
    flex: 1;
    min-height: 0;
  }
  .encounter-app .scene-caption {
    top: 18px;
  }
  .encounter-app .welcome-panel {
    padding: 52px 18px 24px;
  }
  .encounter-app .welcome-panel .intro-butterfly {
    display: none;
  }
  .encounter-app .welcome-panel h2 {
    font-size: clamp(23px, 7cqw, 28px);
  }
  .encounter-app .stage {
    overflow: hidden;
  }
  .encounter-app .creature-button {
    width: 118%;
    right: -7%;
    height: 78%;
  }
  .encounter-app .footer-caption {
    min-height: 36px;
  }
  .encounter-app .encounter-header {
    min-height: 48px;
  }
}

@container (max-width: 420px) and (max-height: 420px) {
  .encounter-app .controls {
    flex-wrap: wrap;
  }
  .encounter-app .toolbar {
    max-width: 100%;
  }
  .encounter-app .timeline {
    min-width: 58px;
    gap: 2px;
    padding-right: 5px;
  }
  .encounter-app .timeline .vk-icon {
    width: 40px;
  }
  .encounter-app .toolbar .feed-button {
    font-size: 14px;
    padding: 0 10px;
  }
  .encounter-app .snack-count {
    display: none;
  }
  .encounter-app .scene-caption {
    display: none;
  }
}

@container (max-width: 600px) and (min-height: 421px) and (max-height: 540px) {
  .encounter-app .welcome-panel p:not(.intro-label) {
    display: none;
  }
  .encounter-app .welcome-panel {
    gap: 12px;
    padding: 44px 16px 20px;
  }
  .encounter-app .welcome-panel h2 {
    font-size: 24px;
  }
  .encounter-app .footer-caption {
    min-height: 19px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .encounter-app *,
  .encounter-app :deep(*) {
    animation: none !important;
    transition: none !important;
  }
}
/* Art-led arrival; transport stays outside the scene's scrollable guide. */
.encounter-app { gap:12px; }
.encounter-app .encounter-header h1 { font-size:30px; letter-spacing:-.035em; }
.encounter-app .stage { overflow:hidden; }
.encounter-app .welcome-creature { position:absolute; right:-10%; bottom:-9%; width:84%; height:100%; z-index:3; opacity:.94; pointer-events:none; filter:drop-shadow(0 18px 16px #071d16aa); }
.encounter-app .welcome-creature :deep(svg) { width:100%; height:100%; }
.encounter-app .welcome-panel { align-items:flex-start; text-align:left; justify-content:center; padding:52px 32px 34px; background:linear-gradient(90deg,#0c261deb,#0c261d89 44%,transparent 74%); }
.encounter-app .welcome-panel h2 { font-size:clamp(28px,4.4cqw,42px); max-width:390px; }
.encounter-app .welcome-panel .vk-body { max-width:310px; font-size:16px; line-height:1.5; }
.encounter-app .intro-butterfly { display:none; }
.encounter-app .welcome-panel .begin-button { min-height:44px; margin-top:4px; }
.encounter-app .experience-facts { display:flex; gap:24px; margin-top:7px; font-size:12px; color:#e0e4cd; }
.encounter-app .experience-facts span { display:flex; flex-direction:column; gap:3px; }
.encounter-app .experience-facts b { color:#f5f5dc; font-size:14px; }
.encounter-app .field-tabs { min-height:44px; flex:none; }
.encounter-app .field-tabs button { min-height:44px; flex:1; }
.encounter-app .field-portrait { min-height:165px; height:165px; flex:none; background:radial-gradient(ellipse at 70% 20%,#7f987655,#193b3155); }
.encounter-app .field-portrait :deep(svg) { width:100%; height:100%; }
.encounter-app .field-description h3 { margin:7px 0; font-size:23px; letter-spacing:-.03em; }
.encounter-app .field-description p { font-size:15px; color:var(--vk-secondary); line-height:1.5; }
.encounter-app.motion-paused :deep(*) { animation-play-state:paused !important; }
@container(max-height:540px) and (min-width:601px) {
 .encounter-app { padding:20px 24px; gap:10px; }
 .encounter-app .encounter-header h1 { font-size:27px; }
 .encounter-app .welcome-panel { padding:44px 28px 24px; gap:9px; }
 .encounter-app .welcome-panel h2 { font-size:31px; }
 .encounter-app .welcome-panel .vk-body { max-width:285px; font-size:14px; }
 .encounter-app .experience-facts { margin:0; gap:22px; }
 .encounter-app .controls { gap:5px; }
 .encounter-app .creature-button { bottom:-5%; height:104%; }
}
@container(max-width:600px) {
 .encounter-app { padding:20px; }
 .encounter-app .encounter-header h1 { font-size:25px; }
 .encounter-app .welcome-creature { width:126%; height:85%; right:-16%; bottom:24%; opacity:.88; }
 .encounter-app .welcome-panel { justify-content:flex-end; align-items:flex-start; padding:46px 20px 25px; gap:9px; background:linear-gradient(0deg,#0c251df5,#0c251da3 48%,transparent 85%); }
 .encounter-app .welcome-panel h2 { font-size:27px; }
 .encounter-app .welcome-panel .full-welcome { display:inline; }
 .encounter-app .welcome-panel .short-welcome { display:none; }
 .encounter-app .welcome-panel h2 br { display:none; }
 .encounter-app .welcome-panel .vk-body { display:block; font-size:14px; max-width:280px; }
 .encounter-app .experience-facts { gap:18px; font-size:11.5px; margin:0; }
 .encounter-app .experience-facts b { font-size:12px; }
 .encounter-app .scene-tabs { max-height:56px; }
}
@container(max-width:600px) and (max-height:540px) {
 .encounter-app .welcome-panel .vk-body,.encounter-app .experience-facts { display:none; }
 .encounter-app .welcome-panel { padding:42px 18px 22px; }
 .encounter-app .welcome-panel h2 { font-size:25px; }
 .encounter-app .welcome-creature { bottom:13%; height:100%; }
}
@container(max-height:420px) {
 .encounter-app .welcome-panel { gap:8px; padding:30px 18px 20px; }
 .encounter-app .welcome-panel h2 { font-size:25px; }
 .encounter-app .experience-facts,.encounter-app .welcome-panel .vk-body { display:none; }
}
</style>
