export type SynthSettings = { cutoff: number; resonance: number; space: number; tone: number; attack: number; scale: boolean };
export type Channel = { volume: number; pan: number; send: number; muted: boolean; solo: boolean };
export type Pattern = number[][];
export const pads = [
  { name: 'Kick', key: '1', color: '#f3b27d' }, { name: 'Snare', key: '2', color: '#ee8d96' },
  { name: 'Clap', key: '3', color: '#eaa7bd' }, { name: 'Closed hat', key: '4', color: '#e8cb86' },
  { name: 'Open hat', key: 'Q', color: '#d5ca8b' }, { name: 'Rim', key: 'W', color: '#b8d69b' },
  { name: 'Low tom', key: 'E', color: '#82cbb9' }, { name: 'High tom', key: 'R', color: '#85cbd4' },
  { name: 'Shaker', key: 'A', color: '#91bce5' }, { name: 'Cowbell', key: 'S', color: '#a9b0e6' },
  { name: 'Sub bass', key: 'D', color: '#b5a0df' }, { name: 'Chord', key: 'F', color: '#c5a4dc' },
  { name: 'Pluck', key: 'Z', color: '#d6abcb' }, { name: 'Formant', key: 'X', color: '#e2b6ac' },
  { name: 'Riser', key: 'C', color: '#97ced6' }, { name: 'Impact', key: 'V', color: '#ddc294' },
] as const;
export const trackPads = [0, 1, 2, 3, 4, 5, 6, 10] as const;
export const kits = [
  { name: 'Lo-fi Chai', tag: 'DUSTY / WARM', description: 'Soft transients, rounded bass, a little room.', pitch: .92, decay: .85, tone: 'triangle' as OscillatorType, color: '#edbd87' },
  { name: '808 Night', tag: 'DEEP / ELECTRIC', description: 'Long sine tails and crisp, bright percussion.', pitch: .83, decay: 1.5, tone: 'sine' as OscillatorType, color: '#afa2ed' },
  { name: 'Garage', tag: 'SKIPPY / TIGHT', description: 'Short drums, pitched rims, late-night swing.', pitch: 1.14, decay: .65, tone: 'triangle' as OscillatorType, color: '#91c4e7' },
  { name: 'Glass', tag: 'PRISMATIC / AIRY', description: 'Bell-like overtones with a crystalline edge.', pitch: 1.5, decay: 1.2, tone: 'sine' as OscillatorType, color: '#9cd9d2' },
  { name: 'Tabla and Bass', tag: 'RESONANT / LOW', description: 'Synthesised dayan, bending bayan, deep sub.', pitch: 1, decay: 1.1, tone: 'sine' as OscillatorType, color: '#e9b285' },
  { name: 'Velvet Circuit', tag: 'SOFT / ANALOG', description: 'Pillowy drums and a softly detuned pulse.', pitch: .96, decay: 1.05, tone: 'triangle' as OscillatorType, color: '#d1acd8' },
] as const;
export const piano = [
  { note: 'C', key: 'Y', black: false, position: 0 }, { note: 'C♯', key: '5', black: true, position: 1 },
  { note: 'D', key: 'U', black: false, position: 1 }, { note: 'E♭', key: '6', black: true, position: 2 },
  { note: 'E', key: 'I', black: false, position: 2 }, { note: 'F', key: 'O', black: false, position: 3 },
  { note: 'F♯', key: '7', black: true, position: 4 }, { note: 'G', key: 'P', black: false, position: 4 },
  { note: 'A♭', key: '8', black: true, position: 5 }, { note: 'A', key: '[', black: false, position: 5 },
  { note: 'B♭', key: '9', black: true, position: 6 }, { note: 'B', key: ']', black: false, position: 6 },
  { note: 'C', key: '\\', black: false, position: 7 },
] as const;
const pattern = (rows: readonly (readonly number[])[]): Pattern => rows.map((hits, row) => Array.from({ length: 16 }, (_, step) => hits.includes(step) ? (step % 4 === 0 ? .95 : .5 + ((step + row) % 4) * .12) : 0));
export const presets = [
  { name: 'Chai, not hi-fi', bpm: 78, swing: 28, kit: 0, mood: 'A slow afternoon, on repeat.', rows: [[0,7,10],[4,12],[12],[0,2,6,8,10,14],[15],[3,11],[9],[0,10]] },
  { name: '404: Sleep not found', bpm: 94, swing: 14, kit: 1, mood: 'For one more loop before bed.', rows: [[0,6,8,14],[4,12],[15],[0,3,6,8,11,14],[7],[2,10],[13,15],[0,6,8,14]] },
  { name: 'Mind the garage', bpm: 132, swing: 25, kit: 2, mood: 'A two-step with somewhere to be.', rows: [[0,5,8,11],[4,12],[6,14],[0,2,3,6,8,10,11,14],[7,15],[1,9,13],[3,10],[0,5,8]] },
  { name: 'Glass half groove', bpm: 112, swing: 8, kit: 3, mood: 'Small reflections. Big headphones.', rows: [[0,4,8,12],[4,12],[12],[0,2,4,6,8,10,12,14],[7,15],[6],[10],[0,8]] },
  { name: 'Dha after dark', bpm: 106, swing: 12, kit: 4, mood: 'Resonant hands meet subsonic plans.', rows: [[0,8],[4,12],[],[2,6,10,14],[15],[0,3,6,8,11,14],[0,5,8,13],[0,6,10]] },
  { name: 'Velvet, no rope', bpm: 88, swing: 24, kit: 5, mood: 'Everybody is on the guest list.', rows: [[0,7,8],[4,12],[14],[0,2,6,8,10,14],[7],[3,11],[15],[0,7,10]] },
  { name: 'Deploy on Friday', bpm: 148, swing: 0, kit: 1, mood: 'An extremely questionable decision.', rows: [[0,3,6,8,11,14],[4,12,15],[4,12],[0,2,4,6,8,10,12,14,15],[7,15],[2,10],[13],[0,6,8,14]] },
  { name: 'Out of office hours', bpm: 122, swing: 4, kit: 2, mood: 'Your calendar can wait four bars.', rows: [[0,4,8,12],[4,12],[4,12],[0,2,4,6,8,10,12,14],[2,6,10,14],[7,15],[14,15],[0,3,8,11]] },
].map(item => ({ ...item, pattern: pattern(item.rows) }));
export function makeScenes(base: Pattern): Pattern[] {
  return Array.from({ length: 4 }, (_, scene) => base.map((row, track) => row.map((value, step) => {
    if (!scene) return value;
    if (scene === 1 && track === 4) return step === 7 || step === 15 ? .72 : 0;
    if (scene === 2 && track < 3 && step >= 12) return step % 2 === 0 ? .8 : .4;
    if (scene === 3 && track > 2 && track < 7) return step % 4 === 2 ? .55 : 0;
    return value;
  })));
}
export function lockedNote(semitone: number, lock: boolean): number {
  return lock ? [0,3,5,7,10,12].reduce((best, n) => Math.abs(n-semitone) < Math.abs(best-semitone) ? n : best, 0) : semitone;
}
export const defaultChannels = (): Channel[] => Array.from({ length: 9 }, (_, i) => ({ volume: i === 3 ? .65 : .8, pan: i === 4 ? .18 : i === 5 ? -.14 : 0, send: i === 7 ? .08 : .2, muted: false, solo: false }));
