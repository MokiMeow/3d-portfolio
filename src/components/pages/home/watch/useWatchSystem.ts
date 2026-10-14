import { labDeviceBack } from '~/common/models/lab-device.model';
import {
  WATCH,
  WATCH_APPS,
  WATCH_STORAGE,
  clamp,
  type WatchAppId,
  type WatchContext,
  type WatchSettings,
  type HealthStore,
  type FunStore,
  type NavigationStore,
  type OverlayId,
} from './watch';
export const defaultSettings = (): WatchSettings => ({
  brightness: 0.9,
  alwaysOn: true,
  haptics: true,
  sound: true,
  appView: 'grid',
  action: 'workout',
  band: '#DE6A2B',
  case: 'natural',
  nightMode: false,
  accent: '#FF6A13',
  face: 'wayfinder',
  hour24: true,
  seconds: true,
  bezel: 'seconds',
  charging: true,
  airplane: false,
  wifi: true,
  focus: false,
  theatre: false,
  lowPower: false,
  textSize: 1
});
export const defaultHealth = (): HealthStore => ({
  heartRate: 72,
  resting: 61,
  walking: 88,
  steps: 4380,
  stand: 8,
  exercise: 22,
  move: 312,
  goals: {
    move: 500,
    exercise: 30,
    stand: 12
  },
  sleep: {
    score: 88,
    hours: 7.6,
    bedtime: '23:00',
    wake: '07:00'
  },
  oxygen: 98,
  temperature: 36.5,
  respiratory: 14.2,
  workout: {
    active: false,
    paused: false,
    type: '',
    elapsed: 0,
    calories: 0,
    distance: 0
  }
});
const defaultFun = (): FunStore => ({
  cups: 0,
  coffeeTimes: [],
  deploys: 0,
  incidentAt: Date.now() - 3 * 86400000,
  lastBuild: 'idle',
  pongBest: 0
});
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function restoreSettings(value: unknown, target: WatchSettings): void {
  if (!isRecord(value)) return;
  const choices: Partial<Record<keyof WatchSettings, readonly string[]>> = {
    face: ['wayfinder', 'modularUltra', 'waypoint', 'activityDigital', 'utility', 'deploy'],
    appView: ['grid', 'list'],
    case: ['natural', 'black'],
    action: ['workout', 'stopwatch', 'waypoint', 'backtrack', 'depth', 'flashlight', 'deploy'],
    bezel: ['seconds', 'elevation', 'depth']
  };
  for (const key of Object.keys(target) as (keyof WatchSettings)[]) {
    const saved = value[key];
    if (typeof target[key] === 'boolean' && typeof saved === 'boolean') {
      Object.assign(target, {
        [key]: saved
      });
    } else if (choices[key] && typeof saved === 'string' && choices[key]?.includes(saved)) {
      Object.assign(target, {
        [key]: saved
      });
    } else if ((key === 'band' || key === 'accent') && typeof saved === 'string' && /^#[0-9a-f]{6}$/i.test(saved)) {
      Object.assign(target, {
        [key]: saved
      });
    }
  }
  if (typeof value.brightness === 'number' && Number.isFinite(value.brightness)) target.brightness = clamp(value.brightness, 0.2, 1);
  if (typeof value.textSize === 'number' && Number.isFinite(value.textSize)) target.textSize = clamp(value.textSize, 0.85, 1.15);
}
export function useWatchSystem() {
  const now = ref(new Date());
  const activeApp = ref<WatchAppId | null>(null);
  const lastApp = ref<WatchAppId | null>(null);
  const view = ref<'face' | 'apps'>('face');
  const overlay = ref<OverlayId>(null);
  const dimmed = ref(false);
  const powered = ref(true);
  const booting = ref(false);
  const reducedMotion = ref(false);
  const settings = reactive(defaultSettings());
  const health = reactive(defaultHealth());
  const fun = reactive(defaultFun());
  const navigation = reactive<NavigationStore>({
    heading: 42,
    waypoints: [],
    backtracking: false,
    retracing: false,
    path: [],
    request: null
  });
  const playback = reactive({
    playing: false,
    track: 0,
    position: 0,
    volume: 0.55
  });
  const notifications: WatchContext['notifications'] = ref([]);
  const sirenStart = ref(0);
  const banner = ref<WatchContext['notifications']['value'][number] | null>(null);
  const crowns = new Map<WatchAppId, (delta: number) => boolean | void>();
  const actions = new Map<WatchAppId, () => boolean | void>();
  const backs = new Map<WatchAppId, () => boolean>();
  let clockTimer = 0;
  let bannerTimer = 0;
  let persistTimer = 0;
  let bootTimer = 0;
  let lastInput = Date.now();
  let notificationId = 0;
  let ticks = 0;
  let mounted = false;
  let media: MediaQueryList | null = null;
  let faceTurns = 0;
  const ringClosed = [false, false, false];
  function save(): void {
    if (!mounted) return;
    try {
      localStorage.setItem(WATCH_STORAGE, JSON.stringify({
        settings,
        rings: {
          move: health.move,
          exercise: health.exercise,
          stand: health.stand,
          steps: health.steps
        },
        goals: health.goals,
        sleep: health.sleep,
        fun
      }));
    } catch {/* Private browsing can disallow storage. */}
  }
  function load(): void {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(WATCH_STORAGE) || 'null');
      if (!isRecord(value)) return;
      restoreSettings(value.settings, settings);
      if (isRecord(value.rings)) {
        for (const key of ['move', 'exercise', 'stand', 'steps'] as const) {
          const number = value.rings[key];
          if (typeof number === 'number' && Number.isFinite(number)) health[key] = clamp(number, 0, key === 'stand' ? 24 : 100000);
        }
      }
      if (isRecord(value.goals)) {
        for (const key of ['move', 'exercise', 'stand'] as const) {
          const number = value.goals[key];
          if (typeof number === 'number' && Number.isFinite(number)) health.goals[key] = clamp(number, 1, key === 'stand' ? 24 : 5000);
        }
      }
      if (isRecord(value.sleep)) {
        for (const key of ['bedtime', 'wake'] as const) {
          const time = value.sleep[key];
          if (typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) health.sleep[key] = time;
        }
      }
      if (isRecord(value.fun)) {
        for (const key of ['cups', 'deploys', 'incidentAt', 'pongBest'] as const) {
          const number = value.fun[key];
          if (typeof number === 'number' && Number.isFinite(number)) fun[key] = Math.max(0, number);
        }
        const times = value.fun.coffeeTimes;
        if (Array.isArray(times)) {
          fun.coffeeTimes = times.filter((time): time is number => typeof time === 'number' && Number.isFinite(time)).slice(-30);
        }
        if (value.fun.lastBuild === 'passed' || value.fun.lastBuild === 'failed') fun.lastBuild = value.fun.lastBuild;
      }
    } catch {/* A corrupt snapshot should still open a working watch. */}
  }
  function wake(): void {
    if (!powered.value) return;
    lastInput = Date.now();
    dimmed.value = false;
  }
  function haptic(kind: 'tick' | 'success' | 'warning' = 'tick'): void {
    if (!settings.haptics) return;
    try {
      navigator.vibrate?.(kind === 'tick' ? 5 : kind === 'success' ? [10, 30, 10] : [20, 30, 20]);
    } catch {}
  }
  function notify(note: Parameters<WatchContext['notify']>[0]): void {
    const item = {
      ...note,
      id: ++notificationId,
      at: Date.now()
    };
    notifications.value.unshift(item);
    notifications.value = notifications.value.slice(0, 30);
    if (!settings.focus && powered.value && !settings.theatre) {
      // A real watch lights up for a notification instead of showing it on a dimmed screen.
      wake();
      banner.value = item;
      haptic('success');
      clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => {
        banner.value = null;
      }, 6500);
    }
  }
  function setOverlay(id: OverlayId): void {
    faceTurns = 0;
    wake();
    banner.value = null;
    overlay.value = id;
  }
  function open(id: WatchAppId): void {
    if (!powered.value) return;
    faceTurns = 0;
    wake();
    overlay.value = null;
    banner.value = null;
    activeApp.value = id;
    lastApp.value = id;
    view.value = 'apps';
    haptic();
  }
  function home(): void {
    faceTurns = 0;
    wake();
    overlay.value = null;
    activeApp.value = null;
    view.value = 'face';
    banner.value = null;
  }
  function back(): boolean {
    if (!powered.value) return false;
    if (banner.value) {
      banner.value = null;
      return true;
    }
    if (overlay.value) {
      overlay.value = null;
      return true;
    }
    if (activeApp.value) {
      if (backs.get(activeApp.value)?.()) return true;
      activeApp.value = null;
      view.value = 'apps';
      wake();
      return true;
    }
    if (view.value === 'apps') {
      home();
      return true;
    }
    return false;
  }
  function crownPress(): void {
    if (!powered.value) return;
    faceTurns = 0;
    wake();
    if (overlay.value === 'waterLock') return;
    overlay.value = null;
    banner.value = null;
    if (activeApp.value) {
      activeApp.value = null;
      view.value = 'apps';
    } else view.value = view.value === 'face' ? 'apps' : 'face';
  }
  function crownDouble(): void {
    if (lastApp.value) open(lastApp.value);else crownPress();
  }
  function crownTurn(delta: number): boolean {
    if (!powered.value) return true;
    const wasDimmed = dimmed.value;
    wake();
    if (wasDimmed) return true;
    haptic();
    if (overlay.value === 'waterLock') return true;
    if (!overlay.value && activeApp.value && crowns.get(activeApp.value)?.(delta) !== false && crowns.has(activeApp.value)) return true;
    if (!overlay.value && !activeApp.value && view.value === 'face') {
      faceTurns += delta;
      if (settings.face === 'wayfinder' && faceTurns < -5) {
        settings.nightMode = !settings.nightMode;
        faceTurns = 0;
      } else if (delta > 0) overlay.value = 'stack';else if (settings.face !== 'wayfinder' && faceTurns < -2) overlay.value = 'notifications';
      return true;
    }
    return false;
  }
  function actionPress(): void {
    if (!powered.value) return;
    wake();
    if (overlay.value === 'waterLock') return;
    if (activeApp.value && actions.get(activeApp.value)?.() !== false && actions.has(activeApp.value)) return;
    switch (settings.action) {
      case 'waypoint':
        navigation.request = 'waypoint';
        open('compass');
        break;
      case 'backtrack':
        navigation.request = 'backtrack';
        open('compass');
        break;
      default: {
        const assigned = settings.action;
        open(assigned);
        if (assigned === 'stopwatch') {
          void nextTick(() => {
            if (activeApp.value === assigned && !overlay.value) actions.get(assigned)?.();
          });
        }
      }
    }
  }
  function powerOff(): void {
    save();
    powered.value = false;
    activeApp.value = null;
    overlay.value = null;
    banner.value = null;
    dimmed.value = true;
    playback.playing = false;
    health.workout.paused = true;
  }
  function sidePress(): void {
    if (!powered.value) {
      powered.value = true;
      booting.value = true;
      clearTimeout(bootTimer);
      bootTimer = window.setTimeout(() => {
        booting.value = false;
        home();
      }, reducedMotion.value ? 400 : 1500);
      return;
    }
    setOverlay(overlay.value === 'control' ? null : 'control');
  }
  function reset(): void {
    Object.assign(settings, defaultSettings());
    const freshHealth = defaultHealth();
    Object.assign(health.workout, freshHealth.workout);
    Object.assign(health.goals, freshHealth.goals);
    Object.assign(health.sleep, freshHealth.sleep);
    Object.assign(health, {
      ...freshHealth,
      workout: health.workout,
      goals: health.goals,
      sleep: health.sleep
    });
    Object.assign(fun, defaultFun());
    navigation.waypoints = [];
    navigation.path = [];
    navigation.backtracking = false;
    navigation.retracing = false;
    playback.playing = false;
    notifications.value = [];
    sirenStart.value = 0;
    home();
    save();
  }
  function subscribe<T>(map: Map<WatchAppId, T>, id: WatchAppId, handler: T): () => void {
    map.set(id, handler);
    return () => {
      if (map.get(id) === handler) map.delete(id);
    };
  }
  const visibleApp = computed(() => !overlay.value && powered.value && !booting.value ? activeApp.value : null);
  const context: WatchContext = {
    now,
    activeApp: visibleApp,
    dimmed,
    reducedMotion,
    settings,
    health,
    fun,
    navigation,
    playback,
    notifications,
    sirenStart,
    open,
    back,
    home,
    notify,
    haptic,
    overlay: setOverlay,
    powerOff,
    wake,
    reset,
    onCrown: (id, handler) => subscribe(crowns, id, handler),
    onAction: (id, handler) => subscribe(actions, id, handler),
    onBack: (id, handler) => subscribe(backs, id, handler)
  };
  provide(WATCH, context);
  const persistWatch = watch(() => [settings, health.move, health.exercise, health.stand, health.steps, health.goals, health.sleep, fun], () => {
    if (!mounted) return;
    clearTimeout(persistTimer);
    persistTimer = window.setTimeout(save, 300);
  }, {
    deep: true
  });
  const motionChange = (event: MediaQueryListEvent) => {
    reducedMotion.value = event.matches;
  };
  function tick(): void {
    const current = Date.now();
    now.value = new Date(current);
    ticks++;
    if (powered.value && current - lastInput >= 25000) dimmed.value = true;
    const coffee = fun.coffeeTimes.reduce((sum, at) => sum + 8 * 2 ** (-Math.max(0, current - at) / 18000000), 0);
    const exercising = health.workout.active && !health.workout.paused;
    const target = exercising ? 112 + Math.sin(ticks / 14) * 12 : clamp(70 + Math.sin(ticks / 17) * 9 + coffee, 58, 96);
    health.heartRate = Math.round(health.heartRate + clamp(target - health.heartRate, -2, 2));
    if (exercising) {
      health.workout.elapsed++;
      health.workout.calories += 0.12;
      health.workout.distance += 0.0022;
    }
    if (playback.playing) {
      playback.position++;
      const duration = [214, 188, 246][playback.track % 3] ?? 214;
      if (playback.position >= duration) {
        playback.position = 0;
        playback.track = (playback.track + 1) % 3;
      }
    }
    const progress = [health.move / health.goals.move, health.exercise / health.goals.exercise, health.stand / health.goals.stand];
    progress.forEach((ratio, index) => {
      if (ratio >= 1 && !ringClosed[index]) {
        ringClosed[index] = true;
        notify({
          app: 'activity',
          title: ['Move ring closed', 'Exercise ring closed', 'Stand ring closed'][index] ?? 'Ring closed',
          text: 'Your wrist has completed its circular obligations.'
        });
        haptic('success');
      }
    });
    if (ticks === 7 || ticks % 83 === 0) {
      const notes: Parameters<WatchContext['notify']>[0][] = [{
        app: 'messages',
        title: 'Amma',
        text: 'Did you eat? Your watch is not a meal.'
      }, {
        app: 'activity',
        title: 'Time to stand',
        text: 'The chair can manage without you for a minute.'
      }, {
        app: 'calendar',
        title: 'Stretch break',
        text: 'A meeting your shoulders requested.'
      }, {
        app: 'activity',
        title: 'A little goes a long way',
        text: 'Try a workout. Your rings are taking notes.'
      }, {
        app: 'noise',
        title: 'Demo noise alert',
        text: 'The keyboard is auditioning for percussion.'
      }];
      const note = notes[Math.floor(ticks / 83) % notes.length];
      if (note) notify(note);
    }
  }
  onMounted(() => {
    load();
    settings.charging = true;
    ringClosed[0] = health.move >= health.goals.move;
    ringClosed[1] = health.exercise >= health.goals.exercise;
    ringClosed[2] = health.stand >= health.goals.stand;
    mounted = true;
    media = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.value = media.matches;
    media.addEventListener('change', motionChange);
    clockTimer = window.setInterval(tick, 1000);
    labDeviceBack.handler = back;
  });
  onBeforeUnmount(() => {
    save();
    mounted = false;
    persistWatch();
    clearInterval(clockTimer);
    clearTimeout(bannerTimer);
    clearTimeout(persistTimer);
    clearTimeout(bootTimer);
    media?.removeEventListener('change', motionChange);
    crowns.clear();
    actions.clear();
    backs.clear();
    try {
      navigator.vibrate?.(0);
    } catch {}
    if (labDeviceBack.handler === back) labDeviceBack.handler = null;
  });
  return {
    ...context,
    activeApp,
    view,
    lastApp,
    overlayId: overlay,
    powered,
    booting,
    banner,
    crownPress,
    crownDouble,
    crownTurn,
    actionPress,
    sidePress,
    appName: computed(() => WATCH_APPS.find(app => app.id === activeApp.value)?.name ?? '')
  };
}
