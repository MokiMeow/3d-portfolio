export interface Video {
  id: string;
  title: string;
  channel: string;
  duration: string;
  seconds: number;
  year: number;
  category: string;
}

// Titles and channels come from the verified oEmbed catalogue. Approximate runtimes stay labelled.
export const catalogue: Video[] = [
  {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
    "channel": "Rick Astley",
    "duration": "~3:33",
    "seconds": 213,
    "year": 2009,
    "category": "Music"
  },
  {
    "id": "aqz-KE-bpKQ",
    "title": "Big Buck Bunny 60fps 4K - Official Blender Foundation Short Film",
    "channel": "Blender",
    "duration": "~10:35",
    "seconds": 635,
    "year": 2014,
    "category": "Film"
  },
  {
    "id": "WhWc3b3KhnY",
    "title": "Spring - Blender Open Movie",
    "channel": "Blender Studio",
    "duration": "7:44",
    "seconds": 464,
    "year": 2019,
    "category": "Film"
  },
  {
    "id": "UXqq0ZvbOnk",
    "title": "CHARGE - Blender Open Movie",
    "channel": "Blender Studio",
    "duration": "~4 min",
    "seconds": 240,
    "year": 2022,
    "category": "Film"
  },
  {
    "id": "PVGeM40dABA",
    "title": "Coffee Run - Blender Open Movie",
    "channel": "Blender Studio",
    "duration": "~3 min",
    "seconds": 180,
    "year": 2020,
    "category": "Film"
  },
  {
    "id": "R6MlUcmOul8",
    "title": "Tears of Steel - Blender VFX Open Movie",
    "channel": "Blender",
    "duration": "12 min",
    "seconds": 720,
    "year": 2012,
    "category": "Film"
  },
  {
    "id": "ePVe9FzuFfQ",
    "title": "Elephants Dream [2006]",
    "channel": "Blender Studio",
    "duration": "~11 min",
    "seconds": 660,
    "year": 2013,
    "category": "Film"
  },
  {
    "id": "L6mLFxGRFI4",
    "title": "Caminandes 3 - Llamigos",
    "channel": "Blender Studio",
    "duration": "~3 min",
    "seconds": 180,
    "year": 2016,
    "category": "Film"
  },
  {
    "id": "nr5Pj6GQL2o",
    "title": "Tour of the Moon in 4K",
    "channel": "NASA Goddard",
    "duration": "~5 min",
    "seconds": 300,
    "year": 2018,
    "category": "Space"
  },
  {
    "id": "6tmbeLTHC_0",
    "title": "NASA | Thermonuclear Art – The Sun In Ultra-HD (4K)",
    "channel": "NASA Goddard",
    "duration": "~30 min",
    "seconds": 1800,
    "year": 2015,
    "category": "Space"
  },
  {
    "id": "oFDeNcu3mnc",
    "title": "Ultra High Definition (4K) View of Planet Earth",
    "channel": "NASA Johnson",
    "duration": "~5 min",
    "seconds": 300,
    "year": 2016,
    "category": "Nature"
  },
  {
    "id": "yQNEKTOL_oA",
    "title": "Earth from Space in 4K – Expedition 65 Edition",
    "channel": "NASA Johnson",
    "duration": "~1 h",
    "seconds": 3600,
    "year": 2022,
    "category": "Nature"
  },
  {
    "id": "4czjS9h4Fpg",
    "title": "Perseverance Rover’s Descent and Touchdown on Mars (Official NASA Video)",
    "channel": "NASA",
    "duration": "~3:26",
    "seconds": 206,
    "year": 2021,
    "category": "Space"
  },
  {
    "id": "h6fcK_fRYaI",
    "title": "The Egg - A Short Story",
    "channel": "Kurzgesagt – In a Nutshell",
    "duration": "~8 min",
    "seconds": 480,
    "year": 2019,
    "category": "Film"
  },
  {
    "id": "0FH9cgRhQ-k",
    "title": "The Largest Black Hole in the Universe - Size Comparison",
    "channel": "Kurzgesagt – In a Nutshell",
    "duration": "~12 min",
    "seconds": 720,
    "year": 2021,
    "category": "Space"
  },
  {
    "id": "e-P5IFTqB98",
    "title": "Black Holes Explained – From Birth to Death",
    "channel": "Kurzgesagt – In a Nutshell",
    "duration": "~6 min",
    "seconds": 360,
    "year": 2015,
    "category": "Space"
  },
  {
    "id": "MBRqu0YOH14",
    "title": "Optimistic Nihilism",
    "channel": "Kurzgesagt – In a Nutshell",
    "duration": "~6 min",
    "seconds": 360,
    "year": 2017,
    "category": "Film"
  },
  {
    "id": "094y1Z2wpJg",
    "title": "The Simplest Math Problem No One Can Solve - Collatz Conjecture",
    "channel": "Veritasium",
    "duration": "~22 min",
    "seconds": 1320,
    "year": 2021,
    "category": "Tech"
  },
  {
    "id": "SIm3nKfJnFE",
    "title": "Two Hours of 4K Nature Scenes | 4K UHD | BBC Earth",
    "channel": "BBC Earth",
    "duration": "~2 h",
    "seconds": 7200,
    "year": 2023,
    "category": "Nature"
  },
  {
    "id": "aircAruvnKk",
    "title": "But what is a neural network? | Deep learning chapter 1",
    "channel": "3Blue1Brown",
    "duration": "~19 min",
    "seconds": 1140,
    "year": 2017,
    "category": "Tech"
  },
  {
    "id": "WUvTyaaNkzM",
    "title": "The essence of calculus",
    "channel": "3Blue1Brown",
    "duration": "~17 min",
    "seconds": 1020,
    "year": 2017,
    "category": "Tech"
  },
  {
    "id": "spUNpyF58BY",
    "title": "But what is the Fourier Transform?  A visual introduction.",
    "channel": "3Blue1Brown",
    "duration": "~20 min",
    "seconds": 1200,
    "year": 2018,
    "category": "Tech"
  },
  {
    "id": "S0_qX4VJhMQ",
    "title": "Derivative formulas through geometry | Chapter 3, Essence of calculus",
    "channel": "3Blue1Brown",
    "duration": "~18 min",
    "seconds": 1080,
    "year": 2017,
    "category": "Tech"
  },
  {
    "id": "nhBVL41-_Cw",
    "title": "Vue.js Explained in 100 Seconds",
    "channel": "Fireship",
    "duration": "~2 min",
    "seconds": 120,
    "year": 2020,
    "category": "Coding"
  },
  {
    "id": "DHjqpvDnNGE",
    "title": "JavaScript in 100 Seconds",
    "channel": "Fireship",
    "duration": "~2:30",
    "seconds": 150,
    "year": 2022,
    "category": "Coding"
  },
  {
    "id": "f-9LEoYYvE4",
    "title": "WebGL 3D Graphics Explained in 100 Seconds",
    "channel": "Fireship",
    "duration": "~2 min",
    "seconds": 120,
    "year": 2021,
    "category": "Coding"
  },
  {
    "id": "Q7AOvWpIVHU",
    "title": "Build a Mindblowing 3D Portfolio Website // Three.js Beginner’s Tutorial",
    "channel": "Fireship",
    "duration": "~20 min",
    "seconds": 1200,
    "year": 2021,
    "category": "Coding"
  },
  {
    "id": "Tn6-PIqc4UM",
    "title": "React in 100 Seconds",
    "channel": "Fireship",
    "duration": "~2 min",
    "seconds": 120,
    "year": 2020,
    "category": "Coding"
  },
  {
    "id": "OEV8gMkCHXQ",
    "title": "CSS in 100 Seconds",
    "channel": "Fireship",
    "duration": "~2:30",
    "seconds": 150,
    "year": 2021,
    "category": "Coding"
  },
  {
    "id": "HZHHBwzmJLk",
    "title": "CSS Animation in 100 Seconds",
    "channel": "Fireship",
    "duration": "~2 min",
    "seconds": 120,
    "year": 2020,
    "category": "Design"
  },
  {
    "id": "19g66ezsKAg",
    "title": "Next.js Conf 2024 Opening Keynote",
    "channel": "Vercel",
    "duration": "~40 min",
    "seconds": 2400,
    "year": 2024,
    "category": "Coding"
  },
  {
    "id": "61JHONRXhjs",
    "title": "2024 — Year in Search",
    "channel": "Google",
    "duration": "~4 min",
    "seconds": 240,
    "year": 2024,
    "category": "Design"
  },
  {
    "id": "dtp6b76pMak",
    "title": "Using Apple Vision Pro: What It’s Actually Like!",
    "channel": "Marques Brownlee",
    "duration": "~38 min",
    "seconds": 2280,
    "year": 2024,
    "category": "Apple"
  },
  {
    "id": "86Gy035z_KA",
    "title": "Apple Vision Pro Review: Tomorrow's Ideas... Today's Tech!",
    "channel": "Marques Brownlee",
    "duration": "~26 min",
    "seconds": 1560,
    "year": 2024,
    "category": "Apple"
  },
  {
    "id": "Pe2ugye7Ya4",
    "title": "New Apple Watch Series 12 and Ultra 4: Everything announced about the ultimate wearable",
    "channel": "Apple",
    "duration": "Duration unavailable",
    "seconds": 0,
    "year": 2026,
    "category": "Apple"
  },
  {
    "id": "MVPTGNGiI-4",
    "title": "synthwave radio 🌌 - beats to chill/game to",
    "channel": "Lofi Girl",
    "duration": "Duration unavailable",
    "seconds": 0,
    "year": 2023,
    "category": "Music"
  }
];

export const categories = [...new Set(catalogue.map(video => video.category))];
export const rickId = 'dQw4w9WgXcQ';

export function videoFromInput(input: string): string | undefined {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id: string | null | undefined;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.searchParams.get('v');
      if (!id && /^\/(shorts|embed|live)\//.test(url.pathname)) id = url.pathname.split('/')[2];
    }
    return id && /^[\w-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

export function avatarColor(name: string): string {
  const palette = ['#7b3e35', '#40587e', '#42644a', '#765285', '#80572f', '#325e68'];
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return palette[hash % palette.length] ?? '#40587e';
}

export function verifiedChannel(name: string): boolean {
  return ['Rick Astley', 'NASA', 'NASA Goddard', 'NASA Johnson', 'Fireship', 'Marques Brownlee',
    'Google', 'Apple', 'BBC Earth', 'Veritasium', '3Blue1Brown', 'Kurzgesagt – In a Nutshell', 'Lofi Girl'].includes(name);
}
