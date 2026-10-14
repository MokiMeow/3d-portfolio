import type { InjectionKey, Ref } from 'vue';
export const WATCH_APPS = [{
  id: 'activity',
  name: 'Activity',
  color: '#FA114F'
}, {
  id: 'workout',
  name: 'Workout',
  color: '#B6F31B'
}, {
  id: 'heartRate',
  name: 'Heart Rate',
  color: '#FF2D55'
}, {
  id: 'ecg',
  name: 'ECG',
  color: '#FF375F'
}, {
  id: 'bloodOxygen',
  name: 'Blood Oxygen',
  color: '#0A84FF'
}, {
  id: 'sleep',
  name: 'Sleep',
  color: '#37B7D6'
}, {
  id: 'vitals',
  name: 'Vitals',
  color: '#46BCFF'
}, {
  id: 'mindfulness',
  name: 'Mindfulness',
  color: '#75E7C2'
}, {
  id: 'noise',
  name: 'Noise',
  color: '#FFD60A'
}, {
  id: 'compass',
  name: 'Compass',
  color: '#FF6A13'
}, {
  id: 'depth',
  name: 'Depth',
  color: '#00C8FF'
}, {
  id: 'tides',
  name: 'Tides',
  color: '#39AFFF'
}, {
  id: 'siren',
  name: 'Siren',
  color: '#FF553A'
}, {
  id: 'maps',
  name: 'Maps',
  color: '#30D158'
}, {
  id: 'weather',
  name: 'Weather',
  color: '#51B9F6'
}, {
  id: 'timer',
  name: 'Timers',
  color: '#FF9500'
}, {
  id: 'stopwatch',
  name: 'Stopwatch',
  color: '#FF9500'
}, {
  id: 'alarms',
  name: 'Alarms',
  color: '#FF9500'
}, {
  id: 'worldClock',
  name: 'World Clock',
  color: '#7CAFFF'
}, {
  id: 'nowPlaying',
  name: 'Now Playing',
  color: '#FF526F'
}, {
  id: 'music',
  name: 'Music',
  color: '#FF526F'
}, {
  id: 'phone',
  name: 'Phone',
  color: '#34D35B'
}, {
  id: 'messages',
  name: 'Messages',
  color: '#34D35B'
}, {
  id: 'mail',
  name: 'Mail',
  color: '#0A84FF'
}, {
  id: 'calendar',
  name: 'Calendar',
  color: '#FF453A'
}, {
  id: 'reminders',
  name: 'Reminders',
  color: '#FF9500'
}, {
  id: 'wallet',
  name: 'Wallet',
  color: '#FFD66C'
}, {
  id: 'findDevices',
  name: 'Find Devices',
  color: '#30D158'
}, {
  id: 'findPeople',
  name: 'Find People',
  color: '#FFB46C'
}, {
  id: 'cameraRemote',
  name: 'Camera Remote',
  color: '#BDBDC2'
}, {
  id: 'flashlight',
  name: 'Flashlight',
  color: '#FFFFFF'
}, {
  id: 'calculator',
  name: 'Calculator',
  color: '#FF9500'
}, {
  id: 'translate',
  name: 'Translate',
  color: '#0A84FF'
}, {
  id: 'voiceMemos',
  name: 'Voice Memos',
  color: '#FF453A'
}, {
  id: 'shortcuts',
  name: 'Shortcuts',
  color: '#CD79FF'
}, {
  id: 'remote',
  name: 'Remote',
  color: '#3C88FE'
}, {
  id: 'walkieTalkie',
  name: 'Walkie-Talkie',
  color: '#FFD60A'
}, {
  id: 'settings',
  name: 'Settings',
  color: '#AEAEB2'
}, {
  id: 'deploy',
  name: 'Deploy',
  color: '#FA114F'
}, {
  id: 'crownPong',
  name: 'Crown Pong',
  color: '#B6F31B'
}, {
  id: 'coffee',
  name: 'Coffee',
  color: '#C7976A'
}, {
  id: 'rubberDuck',
  name: 'Rubber Duck',
  color: '#FFD60A'
}, {
  id: 'dice',
  name: 'Dice & Coin',
  color: '#AC8AFF'
}] as const;
export type WatchAppId = (typeof WATCH_APPS)[number]['id'];
export type FaceId = 'wayfinder' | 'modularUltra' | 'waypoint' | 'activityDigital' | 'utility' | 'deploy';
export type ActionId = 'workout' | 'stopwatch' | 'waypoint' | 'backtrack' | 'depth' | 'flashlight' | 'deploy';
export type OverlayId = 'control' | 'notifications' | 'stack' | 'power' | 'siri' | 'gallery' | 'waterLock' | null;
export interface WatchSettings {
  brightness: number;
  alwaysOn: boolean;
  haptics: boolean;
  sound: boolean;
  appView: 'grid' | 'list';
  action: ActionId;
  band: string;
  case: 'natural' | 'black';
  nightMode: boolean;
  accent: string;
  face: FaceId;
  hour24: boolean;
  seconds: boolean;
  bezel: 'seconds' | 'elevation' | 'depth';
  charging: boolean;
  airplane: boolean;
  wifi: boolean;
  focus: boolean;
  theatre: boolean;
  lowPower: boolean;
  textSize: number;
}
export interface HealthStore {
  heartRate: number;
  resting: number;
  walking: number;
  steps: number;
  stand: number;
  exercise: number;
  move: number;
  goals: {
    move: number;
    exercise: number;
    stand: number;
  };
  sleep: {
    score: number;
    hours: number;
    bedtime: string;
    wake: string;
  };
  oxygen: number;
  temperature: number;
  respiratory: number;
  workout: {
    active: boolean;
    paused: boolean;
    type: string;
    elapsed: number;
    calories: number;
    distance: number;
  };
}
export interface FunStore {
  cups: number;
  coffeeTimes: number[];
  deploys: number;
  incidentAt: number;
  lastBuild: 'idle' | 'running' | 'passed' | 'failed';
  pongBest: number;
}
export interface WatchNotification {
  id: number;
  app: WatchAppId;
  title: string;
  text: string;
  at: number;
}
export interface Waypoint {
  id: number;
  name: string;
  bearing: number;
  distance: number;
  color: string;
}
export interface NavigationStore {
  heading: number;
  waypoints: Waypoint[];
  backtracking: boolean;
  retracing: boolean;
  path: {
    x: number;
    y: number;
  }[];
  request: 'waypoint' | 'backtrack' | null;
}
export interface PlaybackStore {
  playing: boolean;
  track: number;
  position: number;
  volume: number;
}
export interface WatchContext {
  now: Ref<Date>;
  activeApp: Ref<WatchAppId | null>;
  dimmed: Ref<boolean>;
  reducedMotion: Ref<boolean>;
  settings: WatchSettings;
  health: HealthStore;
  fun: FunStore;
  navigation: NavigationStore;
  playback: PlaybackStore;
  notifications: Ref<WatchNotification[]>;
  sirenStart: Ref<number>;
  open: (id: WatchAppId) => void;
  back: () => boolean;
  home: () => void;
  notify: (note: Pick<WatchNotification, 'app' | 'title' | 'text'>) => void;
  haptic: (kind?: 'tick' | 'success' | 'warning') => void;
  onCrown: (id: WatchAppId, handler: (delta: number) => boolean | void) => () => void;
  onAction: (id: WatchAppId, handler: () => boolean | void) => () => void;
  onBack: (id: WatchAppId, handler: () => boolean) => () => void;
  overlay: (id: OverlayId) => void;
  powerOff: () => void;
  wake: () => void;
  reset: () => void;
}
export const WATCH: InjectionKey<WatchContext> = Symbol('lab-watch');
export const WATCH_SCREEN = {
  width: 422,
  height: 514
} as const;
export const WATCH_STORAGE = 'mohith-lab-watch-v1';
export function useWatch(): WatchContext {
  const context = inject(WATCH);
  if (!context) throw new Error('Watch apps require the watch shell.');
  return context;
}

// Cached apps keep their state, but only the visible app receives hardware input.
export function useWatchHardware(id: WatchAppId, handlers: {
  crown?: (delta: number) => boolean | void;
  action?: () => boolean | void;
  back?: () => boolean;
}): void {
  const watch = useWatch();
  const disposers: (() => void)[] = [];
  const stop = () => disposers.splice(0).forEach(dispose => dispose());
  const start = () => {
    stop();
    if (handlers.crown) disposers.push(watch.onCrown(id, handlers.crown));
    if (handlers.action) disposers.push(watch.onAction(id, handlers.action));
    if (handlers.back) disposers.push(watch.onBack(id, handlers.back));
  };
  onMounted(start);
  onActivated(start);
  onDeactivated(stop);
  onBeforeUnmount(stop);
}
export function formatDuration(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value / 60) % 60;
  return (hours ? String(hours).padStart(2, '0') + ':' : '') + String(minutes).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}
export function timeText(date: Date, hour24 = true): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !hour24
  });
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
