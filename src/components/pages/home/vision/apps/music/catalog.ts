export type Genre = 'Lo-fi' | 'Ambient' | 'Synthwave' | 'Piano' | 'Drum & bass' | 'Drone';
export type Track = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre: Genre;
  bpm: number;
  colors: [string, string, string];
  art: 'vinyl' | 'landscape' | 'grid' | 'keys' | 'rings' | 'moon';
  description: string;
  lyrics: string[];
};

export const tracks: Track[] = [
  {
    id: 'merge', title: 'Merge Conflict (Acoustic)', artist: 'The Uncommitted', album: 'Changes Not Staged',
    duration: 184, genre: 'Lo-fi', bpm: 74, colors: ['#eab795', '#af566d', '#433960'], art: 'vinyl',
    description: 'Warm seventh chords, lazy drums. A soundtrack for resolving feelings.',
    lyrics: ['I kept your changes, you kept mine.', 'Two different branches, one long night.',
      'The markers say we disagree.', 'But there is room in HEAD for me.',
      'Resolve the lines and make some chai.', 'Commit this feeling. Let it fly.'],
  },
  {
    id: 'silk', title: 'Traffic at Silk Board', artist: 'Pending Arrival', album: 'The Long Way Home',
    duration: 213, genre: 'Ambient', bpm: 52, colors: ['#99dcd0', '#4f8f90', '#293653'], art: 'landscape',
    description: 'Slow, drifting pads. Faster than your commute, somehow.',
    lyrics: ['The signal changes. Nothing moves.', 'A thousand engines hum the blues.',
      'My ETA is just a dream.', 'I joined a meeting from this queue.',
      'The road is long, the chai is warm.', 'Arriving soon, in some new form.'],
  },
  {
    id: 'localhost', title: 'It Works on My Machine', artist: 'Localhost', album: 'Certified Locally',
    duration: 167, genre: 'Synthwave', bpm: 112, colors: ['#ec8ff7', '#7462df', '#272149'], art: 'grid',
    description: 'Neon arpeggios and a steady kick. Production has other plans.',
    lyrics: ['A little green tick on my screen.', 'The finest code you have not seen.',
      'Deploy it once, deploy it twice.', 'The logs have very good advice.',
      'A missing comma stole the scene.', 'It still works on my machine.'],
  },
  {
    id: 'fix', title: 'One More Tiny Fix', artist: 'The Uncommitted', album: 'Changes Not Staged',
    duration: 196, genre: 'Piano', bpm: 92, colors: ['#d5b4f2', '#866594', '#31354b'], art: 'keys',
    description: 'A delicate three-beat waltz. The scope grows in perfect time.',
    lyrics: ['Just one more fix before I go.', 'The scope begins to gently grow.',
      'A tiny patch becomes a sea.', 'The backlog waves politely at me.',
      'Close the laptop, dim the light.', 'Tomorrow gets the bugs tonight.'],
  },
  {
    id: 'chai', title: 'Chai Break Interlude', artist: 'Steep Mode', album: 'Five Quiet Minutes',
    duration: 120, genre: 'Drum & bass', bpm: 168, colors: ['#ffd986', '#e99152', '#55342b'], art: 'rings',
    description: 'Breakbeats at 168 BPM. Somebody put espresso in the chai.',
    lyrics: ['Water warming, thoughts unwind.', 'Leave the failing build behind.',
      'Ginger, cardamom, a little space.', 'A slower clock, a softer pace.',
      'No notifications in this cup.', 'Sip it slowly. Look back up.'],
  },
  {
    id: 'drone', title: 'Awaiting the Final Build', artist: 'Infinite Promise', album: 'Eventually Consistent',
    duration: 240, genre: 'Drone', bpm: 36, colors: ['#b3cbf8', '#607cb3', '#202841'], art: 'moon',
    description: 'Deep, evolving harmonics. Resolves eventually. Probably.',
    lyrics: ['A spinning circle in the night.', 'One hundred tabs, one little light.',
      'The promise waits. The stars agree.', 'No callback comes to rescue me.',
      'A distant hum, a patient sky.', 'The build turns green. I wonder why.'],
  },
];

export const firstTrack: Track = tracks[0] ?? {
  id: 'fallback', title: 'Quiet Mode', artist: 'Silence', album: 'A Moment', duration: 120,
  genre: 'Ambient', bpm: 52, colors: ['#99dcd0', '#4f8f90', '#293653'], art: 'landscape',
  description: 'A moment of calm.', lyrics: ['Take a breath.'],
};

export const genres: Genre[] = ['Lo-fi', 'Ambient', 'Synthwave', 'Piano', 'Drum & bass', 'Drone'];
export const playlists = [
  { name: 'Deep Work, Shallow Bugs', subtitle: 'A little focus. A little denial.', ids: ['merge', 'silk', 'drone'] },
  { name: 'Ship It After Midnight', subtitle: 'For the confidently under-tested.', ids: ['localhost', 'chai', 'merge'] },
  { name: 'The Chai Is Getting Cold', subtitle: 'Take the break you promised yourself.', ids: ['fix', 'silk', 'drone'] },
];
export const stations = [
  { name: 'Localhost FM', subtitle: 'All signal. Occasionally a stack trace.', ids: ['localhost', 'chai', 'merge'], mark: '◉' },
  { name: 'Silk Board Slow Radio', subtitle: 'Traffic updates: still there.', ids: ['silk', 'drone', 'fix'], mark: '≋' },
  { name: 'Chai Frequency', subtitle: 'Brewed fresh, buffered never.', ids: ['merge', 'fix', 'chai'], mark: '♨' },
];
export function formatTime(seconds: number): string {
  return Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
}
