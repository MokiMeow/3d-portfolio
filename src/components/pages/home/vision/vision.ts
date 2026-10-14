import type { InjectionKey, Ref } from 'vue';

/** Apps in the headset's Home View, in the order they sit in the 4 / 5 / 5 honeycomb. `size` is the opening window size. */
export const VISION_APPS = [
  { id: 'tv', name: 'TV', size: [1040, 640] },
  { id: 'youtube', name: 'YouTube', size: [1120, 680] },
  { id: 'photos', name: 'Photos', size: [1020, 650] },
  { id: 'safari', name: 'Safari', size: [1060, 660] },
  { id: 'music', name: 'Music', size: [780, 640] },
  { id: 'notes', name: 'Notes', size: [940, 620] },
  { id: 'mindfulness', name: 'Mindfulness', size: [720, 660] },
  { id: 'mac', name: 'Mac Virtual Display', size: [1180, 600] },
  { id: 'freeform', name: 'Freeform', size: [1040, 650] },
  { id: 'settings', name: 'Settings', size: [920, 630] },
  { id: 'messages', name: 'Messages', size: [920, 630] },
  { id: 'files', name: 'Files', size: [940, 610] },
  { id: 'encounter', name: 'Encounter', size: [920, 600] },
  { id: 'store', name: 'App Store', size: [1000, 660] },
  { id: 'arcade', name: 'Arcade', size: [1180, 700] },
  { id: 'facetime', name: 'FaceTime', size: [1000, 640] },
  { id: 'weather', name: 'Weather', size: [980, 640] },
  { id: 'maps', name: 'Maps', size: [1080, 660] },
  { id: 'clock', name: 'Clock', size: [900, 600] },
  { id: 'keynote', name: 'Keynote', size: [1120, 680] },
  { id: 'nightsky', name: 'Night Sky', size: [1120, 700] },
  { id: 'objects', name: 'Objects', size: [1040, 660] },
  { id: 'beatstudio', name: 'Beat Studio', size: [1100, 680] },
  { id: 'zengarden', name: 'Zen Garden', size: [1000, 640] },
] as const;
export type VisionAppId = (typeof VISION_APPS)[number]['id'];

/**
 * Places to be. `room` is passthrough: the real 3D room behind the glass.
 * `photo` places are 360-degree photographs from Poly Haven (CC0), named for where they were taken;
 * `moon` and `jupiter` are built in three.js from NASA's public-domain maps.
 * `life` adds something that moves; `sound` picks the ambience; `night` marks places that are already dark.
 */
export const VISION_ENVIRONMENTS = [
  { id: 'room', name: 'My Room', line: 'Passthrough', kind: 'room', life: 'none', sound: 'none', night: false },
  { id: 'lakeside', name: 'Lakeside Sunrise', line: 'First light over still water', kind: 'photo', life: 'motes', sound: 'water', night: false },
  { id: 'kiara', name: 'Kiara Dawn', line: 'A pink sky over red rock', kind: 'photo', life: 'none', sound: 'wind', night: false },
  { id: 'cape', name: 'Cape Hill', line: 'Above the cloud, facing the sun', kind: 'photo', life: 'none', sound: 'wind', night: false },
  { id: 'mondello', name: 'Mondello Beach', line: 'Warm sand, a calm sea', kind: 'photo', life: 'none', sound: 'waves', night: false },
  { id: 'goegap', name: 'Goegap Desert', line: 'Nothing for miles, on purpose', kind: 'photo', life: 'motes', sound: 'wind', night: false },
  { id: 'snow', name: 'Snowy Field', line: 'Fresh tracks and falling snow', kind: 'photo', life: 'snow', sound: 'wind', night: false },
  { id: 'pines', name: 'Misty Pines', line: 'A quiet forest in the fog', kind: 'photo', life: 'mist', sound: 'forest', night: false },
  { id: 'bund', name: 'The Bund', line: 'Shanghai\'s skyline, lit up after dark', kind: 'photo', life: 'none', sound: 'city', night: true },
  { id: 'venice', name: 'Venice Sunset', line: 'The lagoon at golden hour', kind: 'photo', life: 'motes', sound: 'water', night: false },
  { id: 'fire', name: 'Sky on Fire', line: 'A blazing sunset over a rocky coast', kind: 'photo', life: 'none', sound: 'waves', night: false },
  { id: 'sunflowers', name: 'Open Fields', line: 'Big sky, small road, no plans', kind: 'photo', life: 'motes', sound: 'wind', night: false },
  { id: 'fireside', name: 'Fireside', line: 'A warm room and a crackling stove', kind: 'photo', life: 'none', sound: 'fire', night: true },
  { id: 'night', name: 'Milky Way', line: 'A clear night, far from any city', kind: 'photo', life: 'meteors', sound: 'night', night: true },
  { id: 'moon', name: 'The Moon', line: 'Earthrise over the regolith', kind: 'moon', life: 'none', sound: 'space', night: true },
  { id: 'jupiter', name: 'Jupiter', line: 'The view from a small, cold moon', kind: 'jupiter', life: 'none', sound: 'space', night: true },
] as const;
export type VisionEnvironment = (typeof VISION_ENVIRONMENTS)[number];
export type VisionEnvironmentId = VisionEnvironment['id'];

/** What the headset hands to each app window. */
export type VisionContext = {
  now: Ref<Date>;
  environment: Ref<VisionEnvironmentId>;
  /** 0 = all passthrough, 1 = fully inside the environment. */
  immersion: Ref<number>;
  /** 0..1: how much an app wants its surroundings darkened (a film, a breathing session). */
  dim: Ref<number>;
  /** Appearance settings the Settings app can change. */
  reduceTransparency: Ref<boolean>;
  /** Environments in their darker, evening appearance. */
  dark: Ref<boolean>;
  /** Ambient sound for the current environment. */
  sound: Ref<boolean>;
  open: (id: VisionAppId) => void;
  close: (id: VisionAppId) => void;
  /** A short glass notification at the top of the view. */
  toast: (text: string) => void;
};
export const VISION: InjectionKey<VisionContext> = Symbol('lab-vision');
