export type ObjectKind = 'cube' | 'ball' | 'cylinder' | 'domino' | 'plank' | 'duck' | 'cup' | 'block' | 'pin' | 'bowling';
export type Surface = 'wood' | 'rubber' | 'metal' | 'glass' | 'plastic';
export type GravityMode = 'earth' | 'moon' | 'mars' | 'zero';
export type Preset = 'domino' | 'tower' | 'bowling';

export const objects: readonly { id: ObjectKind; name: string; detail: string; color: string }[] = [
  { id: 'cube', name: 'Cube', detail: 'A little building block', color: '#6c7cf2' },
  { id: 'ball', name: 'Ball', detail: 'Made for a good bounce', color: '#ec7590' },
  { id: 'cylinder', name: 'Cylinder', detail: 'Roll it. Stand it. Stack it.', color: '#45c3a8' },
  { id: 'domino', name: 'Domino', detail: 'One thing leads to another', color: '#e8dfca' },
  { id: 'plank', name: 'Plank', detail: 'A bridge between ideas', color: '#d8ac75' },
  { id: 'duck', name: 'Duck', detail: 'A very buoyant personality', color: '#ffc531' },
  { id: 'cup', name: 'Chai cup', detail: 'A tiny break from gravity', color: '#cc7650' },
  { id: 'block', name: 'ABC block', detail: 'Solid wood. Playful letters.', color: '#93b46f' },
  { id: 'pin', name: 'Pin', detail: 'Ready for the big roll', color: '#eae9f2' },
  { id: 'bowling', name: 'Bowling ball', detail: 'A satisfying heavyweight', color: '#5f52c9' },
];

export const surfaces: readonly { id: Surface; name: string; friction: number; bounce: number; density: number; roughness: number; metalness: number; color: string; description: string }[] = [
  { id: 'plastic', name: 'Plastic', friction: .38, bounce: .3, density: 1, roughness: .25, metalness: .05, color: '#929ff4', description: 'Smooth, light, a little bouncy.' },
  { id: 'wood', name: 'Wood', friction: .65, bounce: .12, density: .8, roughness: .72, metalness: 0, color: '#c99b67', description: 'Warm grain. Grippy and grounded.' },
  { id: 'rubber', name: 'Rubber', friction: .8, bounce: .78, density: 1.1, roughness: .6, metalness: 0, color: '#e9a2b5', description: 'Soft touch. Big, playful rebounds.' },
  { id: 'metal', name: 'Metal', friction: .24, bounce: .16, density: 3, roughness: .2, metalness: .82, color: '#bdccd5', description: 'Heavy, reflective, satisfying to stack.' },
  { id: 'glass', name: 'Glass', friction: .17, bounce: .24, density: 1.8, roughness: .08, metalness: .12, color: '#92d2dd', description: 'Frosted color. A slippery surface.' },
];

export const gravities: readonly { id: GravityMode; name: string; value: number; label: string }[] = [
  { id: 'earth', name: 'Earth', value: 9.81, label: '9.81 m/s²' },
  { id: 'moon', name: 'Moon', value: 1.62, label: '1.62 m/s²' },
  { id: 'mars', name: 'Mars', value: 3.71, label: '3.71 m/s²' },
  { id: 'zero', name: 'Zero-G', value: 0, label: 'Gentle drift' },
];

export const presets: readonly { id: Preset; name: string; description: string; count: number }[] = [
  { id: 'domino', name: 'Domino run', description: 'A little nudge. A lovely chain reaction.', count: 26 },
  { id: 'tower', name: 'Tower', description: 'Nine stories. Endless ways to topple.', count: 27 },
  { id: 'bowling', name: 'Bowling', description: 'Ten pins. One very satisfying roll.', count: 11 },
];

export type PlaygroundStats = { count: number; awake: number; state: 'playing' | 'resting' | 'paused' };

export type ObjectInspection = { id: number; kind: ObjectKind; surface: Surface };
