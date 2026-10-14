export type Genre = 'Lo-fi' | 'Ambient' | 'Synthwave' | 'Piano' | 'Drum & bass' | 'Drone';
export type ArtStyle = 'paper' | 'monsoon' | 'signal' | 'chai' | 'orbit' | 'bloom' | 'afterhours' | 'keys';
export interface Artwork { album: string; artist: string; art: ArtStyle; colors: [string, string, string]; photo?: string }
export interface LyricLine { at: number; text: string }
export interface Track extends Artwork {
  id: string; albumId: string; title: string; duration: number; genre: Genre; bpm: number;
  key: number; instrument: OscillatorType; variation: number; description: string; lyrics: string[]; timeline: LyricLine[];
}
export interface Album extends Artwork {
  id: string; genre: Genre; year: number; tagline: string; description: string; titles: string[];
}
export interface Playlist extends Artwork { id: string; name: string; subtitle: string; ids: string[] }
export const albums: Album[] = [
  { id: 'soft', album: 'Soft Landing', artist: 'The Uncommitted', art: 'paper', colors: ['#f4c7ae', '#d67a72', '#613939'], genre: 'Lo-fi', year: 2026, tagline: 'A little less noise. A little more you.', description: 'Dusty keys, soft-edged beats, and permission to leave a few things unfinished. Five warm little songs for finding your way back to the present.', titles: ['Merge With Me', 'Soft Landing', 'One More Tiny Fix', 'Tabs Left Open', 'See You After Stand-up'] },
  { id: 'monsoon', album: 'Monsoon Letters', artist: 'Pending Arrival', art: 'monsoon', colors: ['#a8cfcb', '#367b80', '#173e45'], photo: '/phone/photos/mountains-3.webp', genre: 'Ambient', year: 2026, tagline: 'Rain on the window. Space in your head.', description: 'A patient collection of drifting harmonies and little moments between downpours. Written for the long way home, wherever home happens to be.', titles: ['Silk Board, Slowly', 'Rain Check', 'Umbrella for Two', 'An Unhurried Thursday', 'Home Before the Clouds'] },
  { id: 'local', album: 'Localhost After Dark', artist: 'Localhost', art: 'signal', colors: ['#fc796a', '#ad365e', '#1d2040'], genre: 'Synthwave', year: 2026, tagline: 'The city sleeps. The synths don’t.', description: 'Bright arpeggios meet late-night basslines. A neon postcard from a fictional studio that is, reassuringly, always available on port 3000.', titles: ['It Works on My Machine', 'Port 3000', 'Green Lights Only', 'Deploy Friday', 'Last Metro, First Commit'] },
  { id: 'chai', album: 'Five Quiet Minutes', artist: 'Steep Mode', art: 'chai', colors: ['#ffe4ae', '#c96d39', '#4e2f22'], photo: '/phone/photos/masala-0.webp', genre: 'Lo-fi', year: 2025, tagline: 'A small cup. A whole new afternoon.', description: 'Cardamom-warm melodies with just enough swing. Put down the to-do list, let the kettle sing, and stay for one more cup.', titles: ['Chai Break Interlude', 'Extra Ginger, Please', 'Biscuit Protocol', 'The Kettle Knows', 'No Meetings in This Cup'] },
  { id: 'orbit', album: 'Eventually, Everything', artist: 'Infinite Promise', art: 'orbit', colors: ['#b1bced', '#5d65a4', '#222844'], genre: 'Drone', year: 2026, tagline: 'Some things arrive in their own time.', description: 'Slow-moving harmonics and a sky full of unanswered questions. A generous amount of nothing, beautifully arranged.', titles: ['Awaiting the Final Build', 'A Promise Kept', 'The Stars Are Buffering', 'Quiet Infinity', 'Eventually, Everything'] },
  { id: 'bloom', album: 'Sunday, Unscheduled', artist: 'Petal Theory', art: 'bloom', colors: ['#f4edcc', '#699476', '#204f44'], genre: 'Piano', year: 2025, tagline: 'Nothing on the calendar. Everything to feel.', description: 'Gentle piano sketches for an afternoon with no agenda. A little sunlight, a small plant, and the pleasure of doing nothing particularly useful.', titles: ['Sunday, Unscheduled', 'Balcony at Four', 'Water the Small Things', 'Do Not Disturb the Fern', 'Tomorrow Can Wait'] },
  { id: 'night', album: 'City in Blue', artist: 'Midnight Auto', art: 'afterhours', colors: ['#a3c9e9', '#3965a2', '#101e43'], photo: '/phone/photos/city-2.webp', genre: 'Drum & bass', year: 2026, tagline: 'A night ride with nowhere to rush.', description: 'Electric rhythms and blue-hour melodies, inspired by a fictional Bengaluru night shift. Every beat takes the scenic route.', titles: ['Meter Down', 'Indiranagar at 2 AM', 'Signal / Noise', 'The Long Way Around', 'First Light on the Flyover'] },
  { id: 'keys', album: 'Small Hours', artist: 'Window Seat', art: 'keys', colors: ['#e9dbcc', '#a78984', '#3e3441'], genre: 'Piano', year: 2026, tagline: 'For the moments between the moments.', description: 'Intimate piano miniatures with room to breathe. A handwritten note, a half-read book, and a lamp left on for someone coming home.', titles: ['A Lamp Left On', 'The Margin Notes', 'Half a Page', 'Quietly, Again', 'Goodnight, Good Enough'] },
];
const words: string[][] = [
 ['Keep a little room for wonder.', 'Let the unfinished things be.', 'All these branches bend together.', 'There is still a place for me.', 'Make some chai and watch the evening.', 'We can merge another day.'],
 ['The rain writes letters on the window.', 'The signal turns a softer green.', 'A thousand little roads to follow.', 'A quieter place between.', 'The clouds will carry what we cannot.', 'We will find our way back home.'],
 ['Neon humming in the distance.', 'A green light on a sleeping screen.', 'We take the long way through the city.', 'A little more than a machine.', 'Send a signal through the silence.', 'Meet me where the morning starts.'],
 ['Water warming, thoughts unwinding.', 'Leave the busy world outside.', 'Ginger, cardamom, a little patience.', 'Let the afternoon arrive.', 'No notifications in this cup.', 'Stay for just another sip.'],
 ['There is time beyond the waiting.', 'There are stars beyond the blue.', 'Every promise has a season.', 'Every orbit comes to you.', 'Let the quiet be an answer.', 'Let the night resolve itself.'],
 ['Sunlight settles on the table.', 'Nothing asking to be done.', 'Little leaves and open windows.', 'A slower rhythm in the sun.', 'Water all the small things softly.', 'Tomorrow knows where we will be.'],
 ['Meter down and windows open.', 'Blue reflections in the rain.', 'Every turn becomes a story.', 'Every street remembers names.', 'We will take the long way home.', 'The morning finds us just the same.'],
 ['Leave a lamp beside the window.', 'Leave a little on the page.', 'All the words we did not finish.', 'Find a quieter kind of place.', 'Goodnight to the endless questions.', 'Good enough for us today.'],
];
const tempos = [76, 54, 112, 82, 38, 88, 166, 72];
const instruments: OscillatorType[] = ['triangle', 'sine', 'sawtooth', 'triangle', 'sine', 'sine', 'square', 'triangle'];
export const tracks: Track[] = albums.flatMap((album, albumIndex) => album.titles.map((title, index) => {
  const duration = 162 + ((albumIndex * 29 + index * 17) % 90);
  const lyrics = words[albumIndex] ?? ['Take a little time.'];
  return { ...album, id: album.id + '-' + index, albumId: album.id, title, duration, bpm: (tempos[albumIndex] ?? 80) + index * 2,
    key: (albumIndex * 3 + index * 2) % 12 - 5, instrument: instruments[(albumIndex + index) % instruments.length] ?? 'sine', variation: albumIndex * 5 + index,
    lyrics, timeline: lyrics.map((text, line) => ({ at: line === 0 ? 0 : 12 + (duration - 24) * line / lyrics.length, text })),
  };
}));
export const firstTrack = tracks[0]!;
export const genres: Genre[] = ['Lo-fi', 'Ambient', 'Synthwave', 'Piano', 'Drum & bass', 'Drone'];
export function albumTracks(id: string): Track[] { return tracks.filter(track => track.albumId === id); }
export const playlists: Playlist[] = [
 { id: 'focus', name: 'Deep Focus', album: 'Deep Focus', artist: 'Curated playlist', art: 'orbit', colors: ['#94bdd1', '#3f718c', '#16384e'], subtitle: 'Find your flow. Stay a little longer.', ids: ['monsoon-1', 'orbit-0', 'keys-2', 'soft-3', 'bloom-1', 'orbit-3', 'monsoon-4', 'keys-4'] },
 { id: 'break', name: 'Chai Break', album: 'Chai Break', artist: 'Curated playlist', art: 'chai', colors: ['#ffdcb2', '#cd8159', '#60352e'], subtitle: 'Warm beats. Absolutely no agenda.', ids: ['chai-0', 'soft-0', 'chai-2', 'bloom-3', 'keys-0', 'chai-4'] },
 { id: 'deploy', name: 'Deploy Friday', album: 'Deploy Friday', artist: 'Curated playlist', art: 'signal', colors: ['#f89984', '#b24a64', '#3a274e'], subtitle: 'A green build and a good feeling.', ids: ['local-3', 'night-2', 'local-0', 'night-0', 'local-2', 'soft-1'] },
 { id: 'commits', name: 'Late Night Commits', album: 'Late Night Commits', artist: 'Curated playlist', art: 'afterhours', colors: ['#9dacdb', '#635988', '#202343'], photo: '/phone/photos/city-1.webp', subtitle: 'One more song. Then some sleep.', ids: ['keys-0', 'soft-2', 'local-4', 'orbit-2', 'monsoon-3', 'keys-4'] },
];
export const stations = [
 { id: 'localhost-fm', name: 'Localhost FM', subtitle: 'Neon nights. Fresh frequencies.', schedule: 'Night Shift · 60-minute mix', colors: ['#fb9b85', '#862f5e'], ids: playlists[2]!.ids },
 { id: 'chai-frequency', name: 'Chai Frequency', subtitle: 'A little warmth on your dial.', schedule: 'The Afternoon Pour · mellow mix', colors: ['#efca86', '#965932'], ids: playlists[1]!.ids },
 { id: 'slow-radio', name: 'Silk Board Slow Radio', subtitle: 'The only good kind of slow lane.', schedule: 'Scenic Route · ambient mix', colors: ['#a1d4d0', '#316b76'], ids: playlists[0]!.ids },
];
export function formatTime(seconds: number): string { const safe = Math.max(0, Math.floor(seconds)); return Math.floor(safe / 60) + ':' + String(safe % 60).padStart(2, '0'); }
export function songsFor(ids: string[]): Track[] { return ids.map(id => tracks.find(track => track.id === id)).filter((track): track is Track => !!track); }
