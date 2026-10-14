// Real photographs for the pretend phone's library. All are CC0 / public domain (via Openverse);
// sources are listed in /phone/photos/credits.json. Captions are the phone's, not the photographers'.
export type PhotoKind = 'sunset' | 'chai' | 'desk' | 'cat' | 'travel' | 'city' | 'green' | 'error';

export interface LibraryPhoto {
  id: number;
  kind: PhotoKind;
  src?: string;
  thumb?: string;
  bg: string;
  caption: string;
  place: string;
  month: string;
  year: number;
}

const shots: [string, PhotoKind, string, string][] = [
  ['sunset-0', 'sunset', 'Above the clouds. Below the to-do list.', 'Somewhere above everything'],
  ['masala-0', 'chai', 'Chai, the only dependency that never breaks.', 'Kitchen'],
  ['cat-1', 'cat', 'Senior nap consultant, billing by the hour.', 'The good blanket'],
  ['workspace-1', 'desk', 'Two monitors, one bug, zero chill.', 'Desk'],
  ['street-0', 'chai', 'Street food. Ordered before reading the menu.', 'Market road'],
  ['mountains-3', 'travel', 'The view was worth the knees.', 'Halfway up'],
  ['sunset-1', 'sunset', 'Window seat. Worth the extra hundred.', 'Seat 23A'],
  ['city-1', 'city', 'The city at night, still compiling.', 'Overpass'],
  ['coffee-1', 'chai', 'Filter coffee, unfiltered opinions.', 'Corner café'],
  ['cat-2', 'cat', 'Russian blue, Russian silence.', 'Bed, apparently theirs now'],
  ['beach-2', 'travel', 'Waves doing the same thing forever and still somehow interesting.', 'Coast'],
  ['houseplant-6', 'green', 'Spider plant. Thriving despite me.', 'Window ledge'],
  ['auto-4', 'city', 'Rush hour, auto edition.', 'Main road'],
  ['sunset-2', 'sunset', 'The sky shipped a gradient. No review required.', 'Terrace'],
  ['workspace-4', 'desk', 'A clean desk, if you crop with confidence.', 'Desk'],
  ['masala-1', 'chai', 'Cup two. Do not ask about cup three.', 'Kitchen'],
  ['cat-3', 'cat', 'Do not disturb mode, but furry.', 'Sofa'],
  ['mountains-5', 'travel', 'The trail said easy. The trail lied.', 'Trailhead'],
  ['city-2', 'city', 'Night lights, long exposure, short attention.', 'Riverside'],
  ['street-3', 'chai', 'Guava with chilli salt. A perfect API.', 'Fruit cart'],
  ['books-3', 'green', 'Books I will definitely read. Eventually.', 'Library'],
  ['sunset-4', 'sunset', 'Golden hour, captured at the third attempt.', 'Lake road'],
  ['beach-3', 'travel', 'Turquoise. The colour of a passing test.', 'Somewhere warm'],
  ['dog-7', 'cat', 'Not a cat. Allowed in the album anyway.', 'Neighbour\'s porch'],
  ['workspace-6', 'desk', 'Home studio, pre-coffee.', 'Spare room'],
  ['houseplant-3', 'green', 'Three plants, three names, one watering schedule.', 'Shelf'],
  ['coffee-3', 'chai', 'Sunday morning, no notifications.', 'Balcony'],
  ['mountains-6', 'travel', 'Snow. Briefly regretted shorts.', 'Ridge'],
  ['cat-5', 'cat', 'A cat in deep focus mode.', 'Sunny spot'],
  ['auto-2', 'city', 'An auto with stories.', 'Side street'],
  ['sunset-5', 'sunset', 'Palm tree, pink sky, phone at 4%.', 'Beach road'],
  ['street-6', 'chai', 'Aloo bajji. Rain-day mandatory.', 'Tea stall'],
  ['city-4', 'city', 'Petunias and city lights.', 'Balcony'],
  ['books-4', 'green', 'Old books smell like good decisions.', 'Second-hand shop'],
  ['mountains-1', 'travel', 'Hiking: walking, but with more opinions.', 'The long way'],
  ['workspace-0', 'desk', 'Typing very important things. Probably.', 'Café'],
  ['coffee-4', 'chai', 'Top view, because the side view had crumbs.', 'Desk'],
  ['cat-7', 'cat', 'Asleep since the last deploy.', 'Laundry basket'],
  ['beach-6', 'travel', 'Shoreline, deadline, both receding.', 'Coast'],
  ['houseplant-7', 'green', 'Indoor jungle, phase one.', 'Living room'],
  ['sunset-7', 'sunset', 'The sky was showing off. Rightly.', 'Rooftop'],
  ['masala-2', 'chai', 'A chai that waited for me. Rare.', 'Kitchen'],
  ['workspace-7', 'desk', 'Laptop, notebook, pretend productivity.', 'Desk'],
  ['mountains-4', 'travel', 'Green hills, zero signal, total peace.', 'Valley'],
  ['beach-1', 'travel', 'The sea did not reply. Very calm of it.', 'Shore'],
  ['houseplant-0', 'green', 'One plant, styled like a product launch.', 'Desk corner'],
  ['coffee-7', 'chai', 'Café table, laptop closed. Growth.', 'Café'],
  ['books-1', 'green', 'A shelf that judges silently.', 'Study'],
  ['cat-0', 'cat', 'Stretched to the full length of the sunbeam.', 'Window'],
  ['houseplant-4', 'green', 'Prayer plant. It folds its leaves at night. Relatable.', 'Bedroom'],
  ['street-2', 'chai', 'Plate number one of the evening.', 'Food street'],
];

const bugScreens = [
  'A screenshot worth at least one thousand sighs.',
  'It worked five minutes ago. Evidence attached.',
  'Error message, framed for the family album.',
  'The build is red. The cheeks are also red.',
  'Unexpected expectation, captured live.',
  'Proof for the standup. Nobody asked.',
];

const months = ['October', 'September', 'August', 'July'];

export const PHOTOS: LibraryPhoto[] = [
  ...shots.map(([file, kind, caption, place]) => ({ kind, caption, place, src: `/phone/photos/${file}.webp`, thumb: `/phone/photos/${file}-s.webp`, bg: 'transparent' })),
  ...bugScreens.map(caption => ({ kind: 'error' as const, caption, place: 'Screenshots', bg: 'linear-gradient(130deg,#2c3049,#666c8c)' })),
].map((photo, i, all) => {
  // Spread through the months, newest first, with screenshots sprinkled in like real life.
  const order = photo.kind === 'error' ? (i - shots.length) * 9 + 4 : i;
  const month = months[Math.min(months.length - 1, Math.floor(order / Math.ceil(all.length / months.length)))]!;
  return { ...photo, id: i, month, year: month === 'July' ? 2025 : 2026 };
});
