import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { VISION } from '../../vision';
import { useBreathAudio } from './useBreathAudio';

export type Practice = 'breathe' | 'reflect';
export type SessionSettings = {
  minutes: number; inhale: number; hold: number; exhale: number; tone: boolean; guided?: boolean;
};

export function useMindfulSession(settings: SessionSettings, save: (seconds: number) => void) {
  const vision = inject(VISION, undefined);
  const status = ref<'ready' | 'running' | 'paused' | 'finished'>('ready');
  const elapsed = ref(0);
  const practice = ref<Practice>('breathe');
  const completed = ref(false);
  const guided = ref(false);
  const config = ref({ minutes: 1, inhale: 4, hold: 2, exhale: 6 });
  const audio = useBreathAudio();
  let interval: ReturnType<typeof setInterval> | undefined;
  let segmentStart = 0;
  let previousElapsed = 0;
  let previousDim: number | undefined;
  let saved = false;
  const total = computed(() => config.value.minutes * 60);
  const progress = computed(() => Math.min(1, elapsed.value / total.value));
  const remaining = computed(() => Math.max(0, Math.ceil(total.value - elapsed.value)));
  const clock = computed(() => Math.floor(remaining.value / 60) + ':' + String(remaining.value % 60).padStart(2, '0'));
  const breathing = computed(() => {
    const { inhale, hold, exhale } = config.value;
    const position = elapsed.value % (inhale + hold + exhale);
    if (position < inhale) return { name: 'Breathe in', fraction: position / inhale, seconds: Math.ceil(inhale - position) };
    if (position < inhale + hold) return { name: 'Hold gently', fraction: 1, seconds: Math.ceil(inhale + hold - position) };
    return { name: 'Breathe out', fraction: 1 - (position - inhale - hold) / exhale, seconds: Math.ceil(inhale + hold + exhale - position) };
  });
  const bloom = computed(() => {
    if (status.value === 'ready' || status.value === 'finished') return .62;
    if (practice.value === 'reflect') return .58;
    const amount = breathing.value.fraction;
    return amount * amount * (3 - 2 * amount);
  });
  function stopClock(): void {
    if (interval !== undefined) clearInterval(interval);
    interval = undefined;
  }
  function restoreRoom(): void {
    if (vision && previousDim !== undefined) vision.dim.value = previousDim;
    previousDim = undefined;
  }
  function saveOnce(): void {
    if (saved) return;
    saved = true;
    save(elapsed.value);
  }
  function measure(): void {
    elapsed.value = Math.min(total.value, previousElapsed + (performance.now() - segmentStart) / 1000);
  }
  function finish(): void {
    if (status.value !== 'running' && status.value !== 'paused') return;
    if (status.value === 'running') measure();
    stopClock();
    completed.value = elapsed.value >= total.value;
    status.value = 'finished';
    audio.dispose();
    restoreRoom();
    saveOnce();
  }
  function tick(): void {
    measure();
    audio.follow(bloom.value);
    if (elapsed.value >= total.value) finish();
  }
  function runClock(): void {
    previousElapsed = elapsed.value;
    segmentStart = performance.now();
    status.value = 'running';
    interval = setInterval(tick, 250);
    if (settings.tone) void audio.start();
  }
  function start(mode: Practice): void {
    if (status.value === 'running' || status.value === 'paused') return;
    stopClock();
    audio.dispose();
    config.value = {
      minutes: Math.min(10, Math.max(1, Math.round(settings.minutes))),
      inhale: Math.min(8, Math.max(2, Math.round(settings.inhale))),
      hold: Math.min(5, Math.max(0, Math.round(settings.hold))),
      exhale: Math.min(10, Math.max(2, Math.round(settings.exhale))),
    };
    practice.value = mode;
    guided.value = mode === 'breathe' && settings.guided === true;
    elapsed.value = 0;
    completed.value = false;
    saved = false;
    audio.audioNotice.value = '';
    if (vision) { previousDim = vision.dim.value; vision.dim.value = Math.max(previousDim, .72); }
    runClock();
  }
  function togglePause(): void {
    if (status.value === 'running') {
      tick();
      if (elapsed.value >= total.value) return;
      stopClock();
      status.value = 'paused';
      audio.dispose();
    } else if (status.value === 'paused') runClock();
  }
  function toggleTone(): void {
    settings.tone = !settings.tone;
    if (settings.tone && status.value === 'running') void audio.start();
    else { audio.dispose(); audio.audioNotice.value = ''; }
  }
  function reset(): void { status.value = 'ready'; elapsed.value = 0; audio.audioNotice.value = ''; }
  function visibility(): void { if (document.hidden && status.value === 'running') togglePause(); }
  onMounted(() => document.addEventListener('visibilitychange', visibility));
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', visibility);
    if (status.value === 'running') measure();
    if (status.value === 'running' || status.value === 'paused') saveOnce();
    stopClock();
    audio.dispose();
    restoreRoom();
  });
  return { status, elapsed, practice, completed, guided, progress, clock, breathing, bloom, start, finish, togglePause, toggleTone, reset,
    audioNotice: audio.audioNotice };
}
