import { VISION_APPS } from '../../vision';
import type { VisionAppId } from '../../vision';

export type StoreTab = 'Today' | 'Apps' | 'Games' | 'Arcade' | 'Search' | 'Updates' | 'Account';
type OriginalApp = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  review: string;
  description: string;
  color: string;
  path: string;
  arcade: boolean;
};
export type StoreApp = OriginalApp & {
  headsetId?: VisionAppId;
  rating: string;
  size: string;
  version: number;
};
export type DownloadState = {
  progress: number;
  started: number | null;
  version: number;
};
export type StoreStory = {
  id: string;
  appId: string;
  kicker: string;
  title: string;
  line: string;
  paragraphs: string[];
};

const originals: OriginalApp[] = [
  {
    "id": "tabs",
    "name": "Tab Hoarder Pro",
    "subtitle": "Close nothing. Feel everything.",
    "category": "Productivity, loosely",
    "review": "“Finally, a place for my 38 unfinished thoughts.”",
    "description": "A spatial home for every tab you will definitely come back to. Sort by anxiety, urgency, or how confidently you opened it.",
    "color": "#91b7c9",
    "path": "M6 9h20v19H6zM10 5h20v19M14 2h20v18M11 15h10m-10 5h7",
    "arcade": false
  },
  {
    "id": "standup",
    "name": "Standup Skipper",
    "subtitle": "Yesterday. Today. Blocked by chai.",
    "category": "Work-life improv",
    "review": "“My status update now has a status update.”",
    "description": "Rehearse a perfectly concise standup in a room with excellent acoustics and absolutely no follow-up questions.",
    "color": "#b7a3c9",
    "path": "M7 7h24v17H18l-7 7v-7H7zM12 12h14m-14 6h9",
    "arcade": false
  },
  {
    "id": "duck",
    "name": "Rubber Duck AR",
    "subtitle": "A second opinion. A first quack.",
    "category": "Developer companions",
    "review": "“Five stars. Said nothing. Solved everything.”",
    "description": "An extremely patient rubber duck for explaining the line of code you have already read fourteen times. Listening is the entire feature set.",
    "color": "#d9c181",
    "path": "M10 24q-7-5 0-9l7 4q-4-13 6-13 8 0 8 8l5 2-7 3q-2 12-17 9zM25 11h.1",
    "arcade": false
  },
  {
    "id": "chai",
    "name": "Chai Timer Spatial",
    "subtitle": "Steep in another dimension.",
    "category": "Essential utilities",
    "review": "“The only timer I have ever respected.”",
    "description": "A beautifully unnecessary reminder that chai is best enjoyed while it is still chai. Comes with an imaginary biscuit and ample breathing room.",
    "color": "#bb9c85",
    "path": "M8 11h21l-3 18H11zM29 14q10-2 7 7l-9 3M12 6q-3-3 0-5m9 5q-3-3 0-5M7 32h24",
    "arcade": false
  },
  {
    "id": "bug",
    "name": "Bug Safari",
    "subtitle": "Catch the one that only lives in prod.",
    "category": "Arcade",
    "review": "“The boss fight was a missing semicolon.”",
    "description": "Explore a tiny world of elusive bugs. They are friendly, colourful, and much easier to find when nobody is watching your demo.",
    "color": "#95bfa2",
    "path": "M12 11h14v14q-7 9-14 0zM16 11V7h6v4M6 15h6m14 0h6M6 24h6m14 0h6M19 13v15",
    "arcade": true
  },
  {
    "id": "commute",
    "name": "Commute Simulator",
    "subtitle": "Go absolutely nowhere, spatially.",
    "category": "Arcade",
    "review": "“A stunningly accurate loading screen.”",
    "description": "The serene thrill of waiting for traffic to move. Includes changing signals, hopeful estimates, and a very comfortable imaginary seat.",
    "color": "#bf9b94",
    "path": "M9 12h21l4 8v9H5v-9zM12 12l3-6h10l3 6M9 22h4m13 0h4M9 29v4m21-4v4",
    "arcade": true
  },
  {
    "id": "scope",
    "name": "Scope Creep Garden",
    "subtitle": "Watch a tiny feature become a forest.",
    "category": "Arcade",
    "review": "“I planted a button. It grew a dashboard.”",
    "description": "Nurture a humble idea into a magnificent collection of additional requirements. Water with enthusiasm. Prune with realistic deadlines.",
    "color": "#91b9b0",
    "path": "M19 32V14M19 24Q3 24 6 10q14 0 13 14M19 18Q35 18 33 5q-14 0-14 13",
    "arcade": true
  },
  {
    "id": "focus",
    "name": "Focus, Eventually",
    "subtitle": "Distractions, arranged beautifully.",
    "category": "Almost productivity",
    "review": "“Opened it to focus. Stayed to admire the glass.”",
    "description": "A clean, quiet place to consider starting the thing you have been considering starting. Now with an even quieter empty state.",
    "color": "#a6b4cd",
    "path": "M19 4a15 15 0 1 0 0 30 15 15 0 0 0 0-30M19 10v10l7 5",
    "arcade": false
  }
];

const headsetDescriptions: Record<string, string> = {
  tv: 'Settle into the simulated cinema. Choose a film and make room for a bigger picture.',
  youtube: 'A curated video collection inside this portfolio. Playback availability depends on the video publisher.',
  photos: 'Browse landscapes, collect favourites, and spend a moment looking at something that is not a terminal.',
  safari: 'Explore the simulated browser in the headset. A comfortable home for a few carefully chosen pages.',
  music: 'Browse the headset music experience. Your imaginary desk deserves an imaginary soundtrack.',
  notes: 'Write a thought down before it turns into another open tab.',
  mindfulness: 'Take a quiet breathing break. The backlog will keep.',
  mac: 'A simulated Mac desktop with considerably more room for windows.',
  freeform: 'Sketch, arrange, and connect ideas on the headset canvas.',
  settings: 'Tune the environment, immersion, appearance, and sound of the simulated headset.',
  messages: 'Visit the simulated conversations. Amma still has one very reasonable question.',
  files: 'Organise imaginary files with very real naming habits. Quick Look included.',
  encounter: 'Meet a visitor from a quieter world. The dinosaur has manners.',
};

export const storeApps: StoreApp[] = [
  ...originals.map((app, index) => ({
    ...app,
    rating: index % 3 === 0 ? '4.9' : index % 3 === 1 ? '4.7' : '4.8',
    size: ([38, 22, 14, 9, 64, 46, 52, 12][index] ?? 12) + ' MB',
    version: 2,
  })),
  ...VISION_APPS.filter(app => app.id !== 'store').map(app => ({
    id: 'headset-' + app.id,
    headsetId: app.id,
    name: app.name,
    subtitle: 'Included in this simulated headset',
    category: app.id === 'encounter' ? 'Experiences' : 'Headset essentials',
    review: '“Already here. Extremely convenient.”',
    description: headsetDescriptions[app.id] ?? 'An app in this simulated headset.',
    color: app.id === 'encounter' ? '#a9cf9c' : '#a5c4e7',
    path: app.id === 'files' ? 'M4 11h12l4 4h14v17H4zM4 11V7h11l5 4' : 'M10 5h18q6 0 6 6v16q0 6-6 6H10q-6 0-6-6V11q0-6 6-6zM12 14h14M12 20h14M12 26h8',
    arcade: false,
    rating: '4.9',
    size: 'Included',
    version: 2,
  })),
];

export const stories: StoreStory[] = [
  {
    id: 'tabs-story', appId: 'tabs', kicker: 'APP OF THE MOMENT',
    title: 'All your tabs.\nAll around you.', line: 'Organise the chaos. Keep the chaos.',
    paragraphs: [
      'There is a particular kind of optimism involved in opening tab number thirty-eight. Tab Hoarder Pro celebrates that optimism with a little more room.',
      'Arrange your imaginary research into floating stacks. One for things you need now, one for things you might need later, and one called “I was definitely reading that”.',
      'The trick is not to finish everything at once. Give each unfinished thought a home, take a breath, and close one tab. Just one. We believe in you.',
    ],
  },
  {
    id: 'chai-story', appId: 'chai', kicker: 'A LITTLE DAILY RITUAL',
    title: 'Make room\nfor chai.', line: 'The one notification worth waiting for.',
    paragraphs: [
      'A cup of chai asks very little of you. Warm water, a little patience, and the radical decision to stop answering messages for a minute.',
      'Chai Timer Spatial turns the waiting into a quiet ritual. An oversized cup, a soft countdown, and enough empty space to notice the steam.',
      'No streaks. No badges. The imaginary biscuit is included, and the deadline can wait until the cup is empty.',
    ],
  },
  {
    id: 'garden-story', appId: 'scope', kicker: 'PLAY A LITTLE',
    title: 'A tiny feature.\nA whole forest.', line: 'Your backlog can wait one level.',
    paragraphs: [
      'It began with a button. Then someone suggested a dashboard. Scope Creep Garden is a gentle game about keeping an idea small enough to love.',
      'Plant a requirement, water it with enthusiasm, and watch the branches multiply. When the garden gets crowded, the pruning shears are your most powerful tool.',
      'There are no leaderboards. A healthy patch of empty space is a perfectly respectable high score.',
    ],
  },
];
