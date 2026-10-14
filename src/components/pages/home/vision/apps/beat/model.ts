export type SynthSettings = { cutoff: number; resonance: number; delay: number; scale: boolean };
export const pads = [
  { name: 'Kick', key: '1', color: '#ffb17a' }, { name: 'Snare', key: '2', color: '#ff8d9e' },
  { name: 'Clap', key: '3', color: '#fda0d0' }, { name: 'Closed hat', key: '4', color: '#ffe49b' },
  { name: 'Open hat', key: 'Q', color: '#e7da8b' }, { name: 'Rim', key: 'W', color: '#b8e7a1' },
  { name: 'Low tom', key: 'E', color: '#85d9c2' }, { name: 'High tom', key: 'R', color: '#79dbdf' },
  { name: 'Shaker', key: 'A', color: '#95c4ff' }, { name: 'Cowbell', key: 'S', color: '#b2b2ff' },
  { name: '808 bass', key: 'D', color: '#b99bff' }, { name: 'Chord stab', key: 'F', color: '#dda4fc' },
  { name: 'Pluck', key: 'Z', color: '#f0b8e6' }, { name: 'Vocal ah', key: 'X', color: '#ecaead' },
  { name: 'Riser', key: 'C', color: '#a0e0e7' }, { name: 'Impact', key: 'V', color: '#f2cd92' },
] as const;
export const trackPads = [0, 1, 2, 3, 4, 5, 6, 10] as const;
export const piano = [
  { note: 'C', key: 'Y', black: false }, { note: 'C♯', key: '5', black: true },
  { note: 'D', key: 'U', black: false }, { note: 'E♭', key: '6', black: true },
  { note: 'E', key: 'I', black: false }, { note: 'F', key: 'O', black: false },
  { note: 'F♯', key: '7', black: true }, { note: 'G', key: 'P', black: false },
  { note: 'A♭', key: '8', black: true }, { note: 'A', key: '[', black: false },
  { note: 'B♭', key: '9', black: true }, { note: 'B', key: ']', black: false },
  { note: 'C', key: '\\', black: false },
] as const;
type Preset = { name: string; bpm: number; swing: number; synth: SynthSettings; pattern: boolean[][] };
const pattern = (rows: readonly (readonly number[])[]): boolean[][] =>
  rows.map(hits => Array.from({ length: 16 }, (_, step) => hits.includes(step)));
export const presets: Preset[] = [
  { name: 'Monday Standup', bpm: 112, swing: 8, synth: { cutoff: 1600, resonance: 1.2, delay: .2, scale: true },
    pattern: pattern([[0, 4, 8, 12], [4, 12], [12], [0, 2, 4, 6, 8, 10, 12, 14], [7, 15], [6], [10], [0, 8]]) },
  { name: 'Deploy on Friday', bpm: 148, swing: 0, synth: { cutoff: 3600, resonance: 2.8, delay: .28, scale: true },
    pattern: pattern([[0, 3, 6, 8, 11, 14], [4, 12, 15], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14, 15], [7, 15], [2, 10], [13], [0, 6, 8, 14]]) },
  { name: 'Chai Break Lo-fi', bpm: 78, swing: 32, synth: { cutoff: 650, resonance: .8, delay: .35, scale: true },
    pattern: pattern([[0, 7, 10], [4, 12], [], [0, 2, 6, 8, 10, 14], [15], [3, 11], [9], [0, 10]]) },
  { name: 'Bengaluru Traffic Jam', bpm: 126, swing: 20, synth: { cutoff: 2200, resonance: 4, delay: .18, scale: true },
    pattern: pattern([[0, 5, 8, 11], [4, 12], [6, 14], [0, 2, 3, 6, 8, 10, 11, 14], [7, 15], [1, 9, 13], [3, 10], [0, 5, 8]]) },
  { name: 'Bug Found at 2am', bpm: 94, swing: 14, synth: { cutoff: 800, resonance: 3.2, delay: .42, scale: true },
    pattern: pattern([[0, 6, 8, 14], [4, 12], [15], [0, 3, 6, 8, 11, 14], [7], [2, 10], [13, 15], [0, 6, 8, 14]]) },
  { name: 'Ship It', bpm: 132, swing: 4, synth: { cutoff: 2800, resonance: 1.5, delay: .24, scale: true },
    pattern: pattern([[0, 4, 8, 12], [4, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [2, 6, 10, 14], [7, 15], [14, 15], [0, 3, 8, 11]]) },
];
export function lockedNote(semitone: number, lock: boolean): number {
  if (!lock) return semitone;
  const scale = [0, 3, 5, 7, 10, 12];
  return scale.reduce((closest, note) => Math.abs(note - semitone) < Math.abs(closest - semitone) ? note : closest, 0);
}
