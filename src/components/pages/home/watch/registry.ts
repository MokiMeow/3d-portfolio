import type { Component } from 'vue';
import type { WatchAppId } from './watch';
import Activity from './apps/Activity.vue';
import Workout from './apps/Workout.vue';
import HeartRate from './apps/HeartRate.vue';
import ECG from './apps/ECG.vue';
import BloodOxygen from './apps/BloodOxygen.vue';
import Sleep from './apps/Sleep.vue';
import Vitals from './apps/Vitals.vue';
import Mindfulness from './apps/Mindfulness.vue';
import Noise from './apps/Noise.vue';
import Compass from './apps/Compass.vue';
import Depth from './apps/Depth.vue';
import Tides from './apps/Tides.vue';
import Siren from './apps/Siren.vue';
import Maps from './apps/Maps.vue';
import Weather from './apps/Weather.vue';
import Timer from './apps/Timer.vue';
import Stopwatch from './apps/Stopwatch.vue';
import Alarms from './apps/Alarms.vue';
import WorldClock from './apps/WorldClock.vue';
import NowPlaying from './apps/NowPlaying.vue';
import Music from './apps/Music.vue';
import Phone from './apps/Phone.vue';
import Messages from './apps/Messages.vue';
import Mail from './apps/Mail.vue';
import Calendar from './apps/Calendar.vue';
import Reminders from './apps/Reminders.vue';
import Wallet from './apps/Wallet.vue';
import FindDevices from './apps/FindDevices.vue';
import FindPeople from './apps/FindPeople.vue';
import CameraRemote from './apps/CameraRemote.vue';
import Flashlight from './apps/Flashlight.vue';
import Calculator from './apps/Calculator.vue';
import Translate from './apps/Translate.vue';
import VoiceMemos from './apps/VoiceMemos.vue';
import Shortcuts from './apps/Shortcuts.vue';
import Remote from './apps/Remote.vue';
import WalkieTalkie from './apps/WalkieTalkie.vue';
import Settings from './apps/Settings.vue';
import Deploy from './apps/Deploy.vue';
import CrownPong from './apps/CrownPong.vue';
import Coffee from './apps/Coffee.vue';
import RubberDuck from './apps/RubberDuck.vue';
import Dice from './apps/Dice.vue';

export const WATCH_VIEWS: Record<WatchAppId, Component> = {
  activity: Activity,
  workout: Workout,
  heartRate: HeartRate,
  ecg: ECG,
  bloodOxygen: BloodOxygen,
  sleep: Sleep,
  vitals: Vitals,
  mindfulness: Mindfulness,
  noise: Noise,
  compass: Compass,
  depth: Depth,
  tides: Tides,
  siren: Siren,
  maps: Maps,
  weather: Weather,
  timer: Timer,
  stopwatch: Stopwatch,
  alarms: Alarms,
  worldClock: WorldClock,
  nowPlaying: NowPlaying,
  music: Music,
  phone: Phone,
  messages: Messages,
  mail: Mail,
  calendar: Calendar,
  reminders: Reminders,
  wallet: Wallet,
  findDevices: FindDevices,
  findPeople: FindPeople,
  cameraRemote: CameraRemote,
  flashlight: Flashlight,
  calculator: Calculator,
  translate: Translate,
  voiceMemos: VoiceMemos,
  shortcuts: Shortcuts,
  remote: Remote,
  walkieTalkie: WalkieTalkie,
  settings: Settings,
  deploy: Deploy,
  crownPong: CrownPong,
  coffee: Coffee,
  rubberDuck: RubberDuck,
  dice: Dice,
};
