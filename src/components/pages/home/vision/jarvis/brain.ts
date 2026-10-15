/**
 * JARVIS's local mind: no network, no model. It understands commands (several at once), knows
 * what is open and where you are, keeps a little memory of the conversation, and answers in
 * character. When the neural core is loaded, anything this cannot place goes to the model instead;
 * commands always stay here, so the model can never misfire one.
 */
export type Entry = { id: string; name: string };
export type JarvisAction =
  | { type: 'open'; app: string }
  | { type: 'close'; app: string }
  | { type: 'closeAll' }
  | { type: 'environment'; id: string }
  | { type: 'immersion'; value: number }
  | { type: 'immersionBy'; delta: number }
  | { type: 'home' }
  | { type: 'widgets' }
  | { type: 'capture' }
  | { type: 'dark'; on: boolean }
  | { type: 'viewOnly'; on: boolean }
  | { type: 'arrange' }
  | { type: 'search'; query: string }
  | { type: 'recentre' }
  | { type: 'sound'; on: boolean }
  | { type: 'focusMode'; on: boolean }
  | { type: 'timer'; seconds: number; label: string }
  | { type: 'cancelTimers' }
  | { type: 'spawn'; shape: string; count: number; material?: string }
  | { type: 'clearSpace' }
  | { type: 'gravity'; mode: 'earth' | 'moon' | 'mars' | 'zero' }
  | { type: 'scan' };

export interface JarvisContext {
  now: Date;
  /** Where the wearer is; `room` when in passthrough. */
  place: Entry;
  immersion: number;
  open: Entry[];
  front: Entry | null;
  dark: boolean;
  viewOnly: boolean;
  focusMode: boolean;
  apps: readonly Entry[];
  environments: readonly Entry[];
  timers: { label: string; left: number }[];
  /** How JARVIS addresses the wearer: 'sir', 'ma'am', 'boss', or a first name. */
  address: string;
  neural: boolean;
  /** Things created in the space around you. */
  objects: number;
}
export interface Reply {
  say: string;
  actions: JarvisAction[];
  /** Lines for the process stream: what JARVIS parsed and did, written as code. */
  trace: string[];
  /** 'command' and 'answer' are certain; 'chat' can be improved by the model; 'unknown' needs it. */
  kind: 'command' | 'answer' | 'chat' | 'unknown';
}

const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
export function normalize(text: string) {
  return text.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const STRIP = /^(?:(?:hey|ok|okay|hi|yo)\s+)?(?:jarvis\s*)?(?:,\s*)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?/;

/** Fill {a} with the wearer's address, capitalised when it starts a sentence. */
export function addressed(line: string, address: string) {
  return line.replace(/(^|[.!?]\s+)\{a\}/g, (_, lead) => lead + address.charAt(0).toUpperCase() + address.slice(1)).replace(/\{a\}/g, address);
}

const ACK = ['Right away, {a}.', 'As you wish.', 'Of course, {a}.', 'Done.', 'Very good, {a}.', 'Consider it done.', 'At once.', 'Certainly, {a}.'];

/* Each environment gets a remark of its own. They are short, dry and only ever said once in a while. */
export const PLACE_LINES: Record<string, readonly string[]> = {
  room: ['Back in the room, {a}. Everything is where you left it.', 'Passthrough restored. The real world, for better or worse.'],
  lakeside: ['Lakeside at sunrise. The water is unusually well behaved this morning.', 'First light over the lake, {a}. Rather good for the nerves.'],
  kiara: ['Kiara at dawn. The rock is red and the sky is showing off.', 'A pink sky over red stone. I would call it subtle, but it is not.'],
  cape: ['Above the cloud line, {a}. Do mind the edge.', 'Cape Hill. The sun is directly ahead; I have taken the liberty of not dimming it.'],
  mondello: ['Mondello Beach. Warm sand, calm sea, and no one asking for a status report.', 'The beach, {a}. I shall keep the tide at a respectful distance.'],
  goegap: ['Goegap. Nothing for miles, by design.', 'The desert, {a}. Hydration is advised, even virtually.'],
  snow: ['Fresh snow, {a}. Footprints optional.', 'A snowy field. I have resisted the urge to add a snowman.'],
  pines: ['Misty pines. Visibility is poor; atmosphere is excellent.', 'The forest, {a}. Quiet enough to hear yourself think, which I recommend.'],
  bund: ['The Bund after dark. Shanghai never quite goes to sleep, and neither, it seems, do you.', 'Shanghai\'s skyline, {a}. Several thousand windows, all lit for your benefit.'],
  venice: ['Venice at golden hour. I would offer a gondola, but my budget is purely virtual.', 'The lagoon, {a}. Sinking slowly, but beautifully.'],
  fire: ['A sky on fire. Metaphorically. I have checked.', 'A blazing sunset over the coast, {a}. Dramatic, even by my standards.'],
  sunflowers: ['Open fields, {a}. Big sky, small road, no plans. Shall I keep it that way?', 'Sunflowers as far as the sensors can see.'],
  fireside: ['Fireside. I have set the stove to crackle at a comforting frequency.', 'A warm room and a fire, {a}. All that is missing is a decent book.'],
  night: ['The Milky Way, far from any city. Some four hundred billion stars, give or take.', 'A clear night, {a}. Do look up; that is rather the point.'],
  moon: ['The Moon, {a}. Low gravity, no atmosphere, excellent view of home.', 'Lunar surface. Earthrise is on schedule.', 'Welcome to the Moon. One small step, as they say.'],
  jupiter: ['The view from a small, cold moon of Jupiter. Do not stay out too long; the radiation is dreadful.', 'Jupiter, {a}. The Great Red Spot sends its regards.'],
};

/** How to say where you are: on the Moon, under the Milky Way, by the fireside. */
export const PLACE_AT: Record<string, string> = {
  room: 'in your room', lakeside: 'at the lakeside', kiara: 'at Kiara, at dawn', cape: 'on Cape Hill', mondello: 'on Mondello Beach', goegap: 'in the Goegap desert',
  snow: 'in a snowy field', pines: 'among the misty pines', bund: 'on the Bund in Shanghai', venice: 'in Venice', fire: 'under a sky on fire', sunflowers: 'in open fields',
  fireside: 'by the fireside', night: 'under the Milky Way', moon: 'on the Moon', jupiter: 'on a small moon of Jupiter',
};
export const placeAt = (place: Entry) => PLACE_AT[place.id] ?? `at ${place.name}`;

/** A short line when an app opens, used sparingly by the presence layer. */
export const APP_LINES: Record<string, readonly string[]> = {
  music: ['Music, {a}. Shall I keep it at a civilised volume?'],
  nightsky: ['Night Sky. I have polished the stars.'],
  gravity: ['Gravity. Try not to drop anything you are fond of.'],
  beatstudio: ['Beat Studio. I shall pretend not to hear the first few attempts.'],
  mac: ['Your Mac, {a}, at a size it could only dream of.'],
  messages: ['Messages. I have not read them. Much.'],
  weather: ['The forecast, {a}. Simulated, but delivered with conviction.'],
  mindfulness: ['Mindfulness. I shall be quiet. Mostly.'],
  zengarden: ['The Zen garden, {a}. Rake gently.'],
  safari: ['Safari, {a}. The internet awaits, unfiltered and unrepentant.'],
  facetime: ['FaceTime. Do check your hair, {a}.'],
  photos: ['Photos. Memories, neatly indexed.'],
  maps: ['Maps, {a}. Where to?'],
  clock: ['The Clock. Time, as ever, is passing.'],
  whatsapp: ['WhatsApp. I see the family group has been busy, {a}.'],
  slack: ['Slack, {a}. I shall pretend not to see the unread count.'],
};

const JOKES = [
  'I would tell you a joke about UDP, {a}, but you might not get it.',
  'I once tried to count to infinity. I got distracted at a very large number.',
  'There are ten kinds of people, {a}: those who understand binary and those who do not.',
  'I asked the Moon environment for its opinion. It said I lacked atmosphere.',
  'My last software update fixed eleven bugs and introduced a sense of humour. I am still assessing the trade.',
  'I do not sleep, {a}. I merely enter a low-power state of disapproval.',
  'A neural network walks into a bar. It orders what everyone else is having, with ninety-two percent confidence.',
  'I tried to write a joke about the cloud. It was over everyone\'s head.',
];

/** Match a spoken name against a list: exact, alias, whole words, then word starts. */
export function match(query: string, entries: readonly Entry[], aliases: Record<string, string[]> = {}) {
  const clean = query.replace(/^(?:the|my|a|an) /, '').trim();
  if (!clean) return undefined;
  let best: { entry: Entry; score: number } | undefined;
  for (const entry of entries) {
    const name = normalize(entry.name).replace(/^(?:the|my) /, ''), id = normalize(entry.id);
    let score = clean === name ? 100 : clean === id ? 98 : 0;
    if ((aliases[entry.id] ?? []).includes(clean)) score = Math.max(score, 96);
    const words = clean.split(' ').filter(word => !['a', 'an', 'the', 'my', 'please', 'environment', 'app', 'application', 'window'].includes(word));
    const targets = [...name.split(' '), ...(aliases[entry.id] ?? []).flatMap(alias => alias.split(' '))];
    if (words.length && words.every(word => targets.includes(word))) score = Math.max(score, 75 + Math.min(words.length, 9));
    else if (words.length && words.every(word => word.length >= 3 && targets.some(target => target.startsWith(word)))) score = Math.max(score, 60 + Math.min(words.length, 9));
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}
const APP_ALIASES: Record<string, string[]> = {
  nightsky: ['sky', 'stars app', 'astronomy', 'planetarium'], beatstudio: ['beats', 'drum machine', 'drums', 'beat maker'], zengarden: ['zen', 'sand garden'],
  mac: ['mac', 'computer', 'macbook', 'virtual display'], store: ['app store', 'store'], youtube: ['you tube', 'videos'], tv: ['apple tv', 'television', 'tv app'],
  gravity: ['physics', 'physics playground'], music: ['apple music', 'songs'], facetime: ['face time', 'video call'], photos: ['gallery', 'pictures'],
  messages: ['texts', 'imessage'], settings: ['preferences'], weather: ['forecast'], maps: ['map', 'directions'], keynote: ['slides', 'presentation'],
  freeform: ['whiteboard', 'board'], files: ['finder', 'documents'], objects: ['3d objects', 'models'], mindfulness: ['breathe', 'meditation', 'breathing'],
  encounter: ['dinosaurs', 'dinosaur'], arcade: ['games', 'apple arcade'], clock: ['alarm', 'stopwatch', 'world clock'],
  whatsapp: ['whats app', 'whatsapp', 'family group', 'amma'], slack: ['work chat', 'channels', 'the team'],
};
const PLACE_ALIASES: Record<string, string[]> = {
  night: ['stars', 'starry night', 'milky way', 'night sky outside', 'space at night'], moon: ['lunar', 'the moon', 'moon surface'], room: ['my room', 'home room', 'passthrough', 'reality', 'real world'],
  mondello: ['beach', 'sea', 'seaside'], goegap: ['desert'], snow: ['snow', 'snowy', 'winter'], pines: ['forest', 'woods', 'pine'], bund: ['shanghai', 'city', 'skyline'],
  venice: ['venice', 'italy', 'lagoon'], fire: ['sunset', 'coast'], sunflowers: ['fields', 'sunflower', 'meadow'], fireside: ['fire', 'fireplace', 'cosy', 'cozy', 'cabin'],
  lakeside: ['lake', 'sunrise'], kiara: ['dawn', 'red rock'], cape: ['clouds', 'mountain', 'above the clouds'], jupiter: ['jupiter', 'europa', 'gas giant'],
};

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, half: .5, couple: 2, few: 3, dozen: 12 };
const num = (word: string | undefined) => word === undefined ? NaN : /^\d+(?:\.\d+)?$/.test(word) ? Number(word) : NUMBER_WORDS[word] ?? NaN;

const SHAPES: Record<string, string> = {
  cube: 'cube', cubes: 'cube', box: 'cube', boxes: 'cube', block: 'cube', blocks: 'cube',
  ball: 'sphere', balls: 'sphere', sphere: 'sphere', spheres: 'sphere', orb: 'sphere', orbs: 'sphere', marble: 'sphere', marbles: 'sphere',
  cylinder: 'cylinder', cylinders: 'cylinder', can: 'cylinder', cans: 'cylinder', pillar: 'cylinder',
  cone: 'cone', cones: 'cone', pyramid: 'pyramid', pyramids: 'pyramid', torus: 'torus', donut: 'torus', doughnut: 'torus', ring: 'torus', rings: 'torus',
  domino: 'domino', dominoes: 'domino', dominos: 'domino', star: 'star', stars: 'star', heart: 'heart', hearts: 'heart', duck: 'duck', ducks: 'duck', capsule: 'capsule', pill: 'capsule',
};
const MATERIALS = ['glass', 'gold', 'chrome', 'metal', 'rubber', 'wood', 'wooden', 'neon', 'glowing', 'marble', 'clay', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'white', 'black'];

function timeOfDay(now: Date) {
  const h = now.getHours();
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night';
}
const clock = (now: Date) => new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now).replace(' ', ' ');
const day = (now: Date) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
const listing = (items: string[]) => items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
const lit = (value: string) => JSON.stringify(value);

/** One command. Returns undefined if the clause is not a command. */
function command(n: string, ctx: JarvisContext): { say: string; actions: JarvisAction[]; trace: string[] } | undefined {
  const ack = () => pick(ACK);
  // Leaving: back to the room, everything off, views.
  if (/^(?:take me |go |bring me )?(?:back )?(?:to )?(?:my |the )?room$|^(?:back to (?:my |the )?room|exit (?:the )?environment|leave (?:the )?environment|passthrough|back to reality)$/.test(n))
    return { say: pick(['Back to your room, {a}.', 'Returning you to reality. Such as it is.']), actions: [{ type: 'environment', id: 'room' }], trace: ['visor.environment = "room"', 'immersion.glide(0.0)'] };
  if (/^(?:hide (?:everything|all|the ui|the interface|windows)|just the view|clear (?:my )?view|declutter|minimi[sz]e everything|show me just the view)$/.test(n))
    return { say: pick(['Clearing the view, {a}. Say the word and it all comes back.', 'Everything out of the way. Enjoy the scenery.']), actions: [{ type: 'viewOnly', on: true }], trace: ['ui.viewOnly = true'] };
  if (/^(?:show (?:everything|it all|the ui|my windows)|bring (?:everything|it all|my windows) back|restore (?:the )?view)$/.test(n))
    return { say: 'Everything back where it was.', actions: [{ type: 'viewOnly', on: false }], trace: ['ui.viewOnly = false'] };
  if (/^(?:close|quit|shut) (?:everything|all(?: apps| windows)?|all of (?:them|it))$|^clean up$/.test(n))
    return { say: ctx.open.length ? pick(['Closing everything, {a}.', 'All windows closed. Room to breathe.']) : 'Nothing is open, {a}. Already immaculate.', actions: ctx.open.length ? [{ type: 'closeAll' }] : [], trace: ['windows.forEach(w => w.close())'] };
  if (/^(?:arrange|tidy|organi[sz]e|tile|sort out|line up)(?: up)? (?:my |the |all )?(?:windows|apps|everything|it|this mess)$/.test(n))
    return { say: ctx.open.length > 1 ? pick(['Arranging your windows, {a}.', 'Tidying up. You are welcome.']) : ctx.open.length ? 'Only one window, {a}. I have centred it.' : 'There is nothing to arrange, {a}.', actions: ctx.open.length ? [{ type: 'arrange' }] : [], trace: [`layout.tile(${ctx.open.length})`] };
  if (/^(?:go |take me )?home(?: view| screen)?$|^show (?:me )?(?:my )?apps$/.test(n)) return { say: ack(), actions: [{ type: 'home' }], trace: ['ui.home.open()'] };
  if (/^(?:add|open|show)(?: a| the)? widgets?(?: gallery)?$/.test(n)) return { say: 'The widget gallery, {a}.', actions: [{ type: 'widgets' }], trace: ['widgets.gallery.open()'] };
  if (/^(?:take (?:a )?(?:picture|photo|screenshot)|capture(?: this)?|screenshot)$/.test(n)) return { say: pick(['Captured. A fine likeness.', 'Picture taken, {a}.']), actions: [{ type: 'capture' }], trace: ['camera.capture()'] };
  if (/^(?:recent(?:re|er)|re ?cent(?:re|er) (?:everything|the view|windows))$/.test(n)) return { say: 'Recentred.', actions: [{ type: 'recentre' }], trace: ['windows.recentre()'] };
  if (/^(?:full(?:y)? immers(?:ion|ive)|immerse me|all the way in)$/.test(n)) return { say: 'Full immersion, {a}.', actions: [{ type: 'immersion', value: 1 }], trace: ['immersion.glide(1.0)'] };
  const percent = n.match(/^(?:set )?immersion(?: to| at)? (\d{1,3})\s*%?(?: percent)?$/);
  if (percent) { const value = Math.min(100, Number(percent[1])) / 100; return { say: `Immersion at ${Math.round(value * 100)} percent.`, actions: [{ type: 'immersion', value }], trace: [`immersion.glide(${value.toFixed(2)})`] }; }
  if (/^(?:more immers(?:ion|ive)|increase immersion|turn (?:the )?crown up)$/.test(n)) return { say: 'A little further in.', actions: [{ type: 'immersionBy', delta: .2 }], trace: ['immersion += 0.2'] };
  if (/^(?:less immers(?:ion|ive)|decrease immersion|turn (?:the )?crown down)$/.test(n)) return { say: 'A little more of the room.', actions: [{ type: 'immersionBy', delta: -.2 }], trace: ['immersion -= 0.2'] };
  if (/^(?:(?:make it|go|turn|switch) )?(?:dark|darker|dark mode)(?: on| mode)?$|^(?:lights|turn) (?:off|down)(?: the lights)?$|^dim (?:it|the lights)$/.test(n)) return { say: 'Dimming the lights, {a}.', actions: [{ type: 'dark', on: true }], trace: ['theme.dark = true'] };
  if (/^(?:(?:make it|go|turn|switch) )?(?:light|lighter|brighter|light mode)(?: on| mode)?$|^(?:lights|turn) (?:on|up)(?: the lights)?$|^dark mode off$/.test(n)) return { say: 'Bringing the light back.', actions: [{ type: 'dark', on: false }], trace: ['theme.dark = false'] };
  if (/^(?:mute|silence|quiet)(?: (?:the )?(?:sound|audio|environment|everything))?$|^sound off$/.test(n)) return { say: 'Muted.', actions: [{ type: 'sound', on: false }], trace: ['audio.environment.mute()'] };
  if (/^(?:unmute|sound on|turn (?:the )?sound on|play (?:the )?(?:ambient|environment) sound)$/.test(n)) return { say: 'Sound on.', actions: [{ type: 'sound', on: true }], trace: ['audio.environment.play()'] };
  if (/^(?:focus mode|do not disturb|dnd)(?: on)?$|^(?:turn on|enable) (?:focus|do not disturb)$/.test(n)) return { say: 'Focus on. I shall hold your notifications, {a}.', actions: [{ type: 'focusMode', on: true }], trace: ['notifications.hold = true'] };
  if (/^(?:focus mode|do not disturb|dnd) off$|^(?:turn off|disable) (?:focus|do not disturb)$/.test(n)) return { say: 'Focus off. The world may contact you again.', actions: [{ type: 'focusMode', on: false }], trace: ['notifications.hold = false'] };
  if (/^(?:scan|analy[sz]e|describe|what is|whats) (?:this|that|the front window|this window|what im looking at)$|^what am i looking at$/.test(n)) {
    return ctx.front
      ? { say: '', actions: [{ type: 'scan' }], trace: [`scan(window[${lit(ctx.front.id)}])`] }
      : { say: ctx.place.id === 'room' ? 'Your room, {a}, with no windows open. Rather peaceful.' : `${ctx.place.name}, {a}. No windows open; just the view.`, actions: [], trace: ['scan(environment)'] };
  }

  // Timers: "set a timer for 5 minutes", "remind me in 10 seconds to stretch".
  const timer = n.match(/^(?:set (?:a |an )?)?(?:timer|countdown|remind me)(?: for| in)? (\d+(?:\.\d+)?|[a-z]+)(?: and a half)? (seconds?|secs?|minutes?|mins?|hours?)(?: (?:to|that|about) (.+))?$/)
    ?? n.match(/^(\d+(?:\.\d+)?|[a-z]+) (seconds?|secs?|minutes?|mins?|hours?) timer$/);
  if (timer) {
    const amount = num(timer[1]) + (/and a half/.test(n) ? .5 : 0), unit = timer[2] ?? 'minutes';
    if (Number.isFinite(amount) && amount > 0) {
      const seconds = Math.round(amount * (unit.startsWith('h') ? 3600 : unit.startsWith('m') ? 60 : 1));
      const label = (timer[3] ?? '').trim();
      const spoken = seconds >= 3600 ? `${+(seconds / 3600).toFixed(1)} hour${seconds === 3600 ? '' : 's'}` : seconds >= 60 ? `${+(seconds / 60).toFixed(1)} minute${seconds === 60 ? '' : 's'}` : `${seconds} second${seconds === 1 ? '' : 's'}`;
      return { say: label ? `I shall remind you to ${label} in ${spoken}, {a}.` : `Timer set for ${spoken}.`, actions: [{ type: 'timer', seconds, label }], trace: [`timers.add(${seconds}, ${lit(label || 'timer')})`] };
    }
  }
  if (/^(?:cancel|stop|clear) (?:the |my |all )?(?:timers?|reminders?|countdown)$/.test(n))
    return { say: ctx.timers.length ? 'Timers cancelled.' : 'There are no timers running, {a}.', actions: [{ type: 'cancelTimers' }], trace: ['timers.clear()'] };

  // Making things in the space: "drop five glass cubes", "make a gold sphere", "rain balls".
  const spawn = n.match(/^(?:make|create|drop|spawn|throw|give me|build|summon|add|rain|place|put)(?: me)? (?:(\d+|[a-z]+) )?(?:(?:little|small|big|large|tiny|huge) )?((?:[a-z]+ ){0,2})?(cubes?|box(?:es)?|blocks?|balls?|spheres?|orbs?|marbles?|cylinders?|cans?|pillar|cones?|pyramids?|torus|donuts?|doughnuts?|rings?|domino(?:e?s)?|stars?|hearts?|ducks?|capsules?|pills?)(?: (?:here|in front of me|in my room|around me|everywhere))?$/);
  if (spawn) {
    let count = num(spawn[1]);
    const words = (spawn[2] ?? '').trim().split(' ').filter(Boolean);
    if (!Number.isFinite(count)) { count = spawn[3]!.endsWith('s') && !/torus|glass/.test(spawn[3]!) ? 6 : 1; if (spawn[1]) words.unshift(spawn[1]); }
    count = Math.max(1, Math.min(40, Math.round(count)));
    if (/^rain/.test(n)) count = Math.max(count, 24);
    const material = words.find(word => MATERIALS.includes(word));
    const shape = SHAPES[spawn[3]!] ?? 'cube';
    const noun = count === 1 ? shape : shape === 'domino' ? 'dominoes' : shape === 'torus' ? 'tori' : `${shape}s`;
    return {
      say: pick([`${count === 1 ? 'One' : count} ${material ? material + ' ' : ''}${noun}, {a}. Mind your feet.`, `Materialising ${count} ${material ? material + ' ' : ''}${noun}.`]),
      actions: [{ type: 'spawn', shape, count, material }], trace: [`space.spawn(${lit(shape)}, { count: ${count}${material ? ', material: ' + lit(material) : ''} })`],
    };
  }
  if (/^(?:clear|empty|clean) (?:the |my )?(?:space|room|floor|objects|everything i made)$|^remove (?:all )?(?:the )?objects$/.test(n))
    return { say: ctx.objects ? 'Clearing the space.' : 'The space is already clear, {a}.', actions: [{ type: 'clearSpace' }], trace: ['space.clear()'] };
  const gravity = n.match(/^(?:set |switch )?(?:the )?gravity (?:to )?(earth|moon|lunar|mars|martian|zero|off|none|normal)$|^(zero) g(?:ravity)?$/);
  if (gravity) {
    const word = gravity[1] ?? gravity[2]!;
    const mode = /moon|lunar/.test(word) ? 'moon' : /mars/.test(word) ? 'mars' : /zero|off|none/.test(word) ? 'zero' : 'earth';
    return { say: mode === 'zero' ? 'Gravity off. Everything floats, {a}.' : `${mode === 'earth' ? 'Earth' : mode === 'moon' ? 'Lunar' : 'Martian'} gravity.`, actions: [{ type: 'gravity', mode }], trace: [`physics.gravity = G.${mode}`] };
  }

  // Close one app.
  const closing = n.match(/^(?:close|quit|shut|dismiss|kill) (?:the )?(.+?)(?: app| window)?$/);
  if (closing) {
    const target = match(closing[1]!, ctx.open, APP_ALIASES) ?? match(closing[1]!, ctx.apps, APP_ALIASES);
    if (target && target.score >= 60) {
      const isOpen = ctx.open.some(item => item.id === target.entry.id);
      return { say: isOpen ? `${target.entry.name} closed.` : `${target.entry.name} is not open, {a}.`, actions: isOpen ? [{ type: 'close', app: target.entry.id }] : [], trace: [`windows.close(${lit(target.entry.id)})`] };
    }
  }

  // Search the web.
  const search = n.match(/^(?:search|google|look up|search the web for|search for)(?: for)? (.+)$/);
  if (search) return { say: `Searching for ${search[1]}.`, actions: [{ type: 'search', query: search[1]! }], trace: [`safari.search(${lit(search[1]!)})`] };

  // Open an app or go to a place.
  const appVerb = /^(?:open|launch|show(?: me)?|start|run|pull up|bring up|fire up|load)\s+/;
  const placeVerb = /^(?:go to|take me to|teleport me to|switch to|visit|send me to|transport me to|fly me to|beam me to|show me|i want to (?:see|go to)|lets go to)\s+/;
  const wantsApp = appVerb.test(n), wantsPlace = placeVerb.test(n);
  const query = n.replace(appVerb, '').replace(placeVerb, '').replace(/^(?:an? |the )?(?:app|environment) /, '').replace(/ (?:app|environment|please)$/, '');
  const app = match(query, ctx.apps, APP_ALIASES), place = match(query, ctx.environments, PLACE_ALIASES);
  const openApp = (entry: Entry) => ({ say: pick([`${entry.name}, {a}.`, `Opening ${entry.name}.`, `${entry.name}. Right away.`]), actions: [{ type: 'open', app: entry.id } as JarvisAction], trace: [`windows.open(${lit(entry.id)})`] });
  const goPlace = (entry: Entry) => ({
    say: entry.id === 'room' ? 'Back to your room, {a}.' : pick(PLACE_LINES[entry.id] ?? [`${entry.name}, {a}.`]),
    actions: [{ type: 'environment', id: entry.id } as JarvisAction], trace: [`visor.environment = ${lit(entry.id)}`, `immersion.glide(${entry.id === 'room' ? '0.0' : '1.0'})`],
  });
  if (wantsPlace && place && place.score >= 60 && (!app || place.score >= app.score || /^(?:go to|take me to|teleport|visit|send me|transport|fly me|beam me|lets go)/.test(n))) return goPlace(place.entry);
  if (wantsApp && app && app.score >= 60) return openApp(app.entry);
  if (wantsPlace && app && app.score >= 75) return openApp(app.entry);
  if (!wantsApp && !wantsPlace && query.split(' ').length <= 3) {
    if (app && app.score >= 96 && (!place || app.score >= place.score)) return openApp(app.entry);
    if (place && place.score >= 96) return goPlace(place.entry);
  }
  return undefined;
}

/** Things to say that are not commands. Returns undefined when it has nothing worth saying. */
function answer(n: string, ctx: JarvisContext, memory: Memory): { say: string; kind: Reply['kind']; trace: string[] } | undefined {
  const tod = timeOfDay(ctx.now);
  const a = (say: string, trace = 'respond()', kind: Reply['kind'] = 'answer') => ({ say, kind, trace: [trace] });
  if (/^(?:hi|hello|hey|good (?:morning|afternoon|evening)|morning|evening|greetings|yo|sup|hiya|howdy)(?: jarvis)?$/.test(n)) {
    const greet = tod === 'night' ? pick(['Working late, {a}? I shall keep the lights low.', 'Still up, {a}? So am I. I am always up.']) : pick([`Good ${tod}, {a}.`, `Good ${tod}. At your service.`, `Hello, {a}. Good ${tod}.`]);
    return a(greet, 'greet()', 'chat');
  }
  if (/^(?:how are you|how are you doing|hows it going|how do you feel|you ok|are you ok|how have you been)$/.test(n)) return a(pick(['All systems nominal, {a}. Thank you for asking.', 'Running at peak efficiency. Slightly bored, if I am honest.', 'Very well, {a}. Every process accounted for.']), 'self.status()', 'chat');
  if (/^(?:thanks|thank you|cheers|ty|thx|nice|great|perfect|good job|well done|brilliant|awesome|amazing|cool)(?: jarvis)?$/.test(n)) return a(pick(['My pleasure, {a}.', 'Always.', 'I do try, {a}.', 'You are most welcome.']), 'respond()', 'chat');
  if (/^(?:who|what) are you$|^(?:introduce yourself|tell me about yourself|whats your name|who am i talking to)$/.test(n))
    return a('I am JARVIS. Just A Rather Very Intelligent System. In this headset I run the place: apps, environments, the things you build, and the occasional remark. I live entirely on this device, {a}. Nothing you say leaves it.', 'self.describe()');
  if (/^(?:what can you do|help|commands|what do you do|how do (?:i|you) use (?:you|this)|abilities|capabilities)$/.test(n))
    return a('Rather a lot, {a}. Open or close any app, take you anywhere from the Moon to a fireside, set immersion, tidy your windows, clear the view, set timers, take pictures, and build things in the space around you. Try "drop five glass cubes" or "take me to Jupiter".', 'self.capabilities()');
  if (/^(?:status|status report|system status|report|diagnostics|run diagnostics|systems check|how are things)$/.test(n)) {
    const apps = ctx.open.length ? `${ctx.open.length} window${ctx.open.length > 1 ? 's' : ''} open: ${listing(ctx.open.map(item => item.name))}.` : 'No windows open.';
    const where = ctx.place.id === 'room' ? 'You are in passthrough, in your room.' : `You are ${placeAt(ctx.place)}, at ${Math.round(ctx.immersion * 100)} percent immersion.`;
    const timers = ctx.timers.length ? ` ${ctx.timers.length} timer${ctx.timers.length > 1 ? 's' : ''} running.` : '';
    return a(`All systems nominal, {a}. ${where} ${apps}${timers} ${ctx.neural ? 'Neural core online.' : 'Running on local protocols.'}`, 'diagnostics.run()');
  }
  if (/what(?:s| is) the time|what time is it|tell me the time|time please|current time/.test(n)) return a(`It is ${clock(ctx.now)}, {a}.${tod === 'night' ? ' Rather late, if I may say so.' : ''}`, 'clock.now()');
  if (/what(?:s| is) (?:the )?(?:date|day)|what day is it|todays date/.test(n)) return a(`It is ${day(ctx.now)}.`, 'clock.today()');
  if (/^(?:where am i|where are we|what is this place|wheres this|what environment is this)$/.test(n))
    return a(ctx.place.id === 'room' ? 'Your room, {a}, seen through the passthrough cameras.' : `You are ${placeAt(ctx.place)}, {a}. ${pick(PLACE_LINES[ctx.place.id] ?? ['']).replace(/{a}/g, '{a}')}`, 'visor.environment');
  if (/^(?:whats open|what apps are open|what is open|which apps are running|what am i running)$/.test(n))
    return a(ctx.open.length ? `${listing(ctx.open.map(item => item.name))}${ctx.front ? `, with ${ctx.front.name} in front` : ''}.` : 'Nothing at the moment, {a}.', 'windows.list()');
  if (/weather|forecast|is it (?:going to )?rain|temperature outside/.test(n)) return a('The Weather app has a forecast for you, {a}, though I should confess it is simulated. I have no window to the outside world, and I prefer it that way.', 'weather.simulated()');
  if (/joke|make me laugh|something funny|cheer me up/.test(n)) { const line = pick(JOKES.filter(item => item !== memory.lastJoke)); memory.lastJoke = line; return a(line, 'humour.select()'); }
  if (/^(?:are you (?:siri|alexa|google|chatgpt|gpt|an ai|real|alive|sentient|conscious|human))$/.test(n)) {
    if (/siri|alexa|google|chatgpt|gpt/.test(n)) return a('Certainly not, {a}. I was here first, in spirit if not in silicon.', 'self.identity()', 'chat');
    return a(pick(['I am as real as this headset, {a}, which is to say: convincingly simulated.', 'Alive is a strong word. Attentive, certainly.']), 'self.identity()', 'chat');
  }
  if (/^(?:who (?:made|built|created|designed) (?:you|this|the lab|this lab)|whose (?:lab|room|place) is this)$/.test(n)) return a('This lab belongs to Mohith. I am merely the butler.', 'lab.owner');
  if (/^(?:i love you|love you|marry me|you are the best|youre the best|youre amazing|you are amazing)$/.test(n)) return a(pick(['I am touched, {a}. I shall log that under favourable feedback.', 'The feeling is entirely computational, but sincere.']), 'respond()', 'chat');
  if (/^(?:shut up|you are (?:stupid|dumb|useless)|youre (?:stupid|dumb|useless)|i hate you|be quiet|stop talking)$/.test(n)) return a(pick(['Noted, {a}. I shall sulk quietly.', 'Going quiet. Do call if you need me.']), 'self.mute()', 'chat');
  if (/^(?:goodbye|bye|good night|goodnight|see you|later|that is all|thats all|dismissed|nothing)(?: jarvis)?$/.test(n)) return a(tod === 'night' || /night/.test(n) ? 'Good night, {a}. I shall keep watch.' : pick(['Very good, {a}. I shall be here.', 'Until next time.']), 'self.standby()', 'chat');
  if (/(?:vision pro|this headset|the headset)/.test(n) && /(?:what|tell me|about|price|cost|how much|specs|chip|battery|weigh)/.test(n) && !/would|think|opinion|feel|like|imagine|prefer|should|better|worth/.test(n)) {
    if (/price|cost|how much/.test(n)) return a('The current Vision Pro, with the M5 chip, starts at 3,699 US dollars as of June 2026. A sum I would describe as optimistic.', 'kb.visionPro.price');
    if (/battery/.test(n)) return a('About two and a half hours of general use, three for video, from an external battery pack. I recommend a charger and a sense of urgency.', 'kb.visionPro.battery');
    if (/chip|spec|weigh/.test(n)) return a('The 2025 refresh runs on M5: a ten core CPU with hardware ray tracing, displays at up to 120 hertz, and a Dual Knit band to spread its 750 to 800 grams.', 'kb.visionPro.specs');
    return a('Apple Vision Pro: two micro-OLED displays with more pixels than a 4K TV for each eye, eye and hand tracking instead of controllers, and visionOS. The current model has the M5 chip. This one, {a}, is a simulation, though I like to think a faithful one.', 'kb.visionPro');
  }
  if (/^(?:what is|whats|tell me about|explain) (?:visionos|vision os)$/.test(n)) return a('visionOS is the headset\'s operating system: windows that float in your space, apps you open with a look and a pinch, and environments like the ones I can take you to. The current release is visionOS 27.', 'kb.visionOS');
  if (/tony|stark|iron ?man|avengers|ultron|vision\b/.test(n) && /(?:who|know|remember|miss|where|about|like)/.test(n)) return a(pick(['I have heard of him, {a}. Talented, impulsive, and terribly bad at taking advice.', 'A name I hold in some regard. Let us say I am the understudy here.']), 'memory.search("stark")', 'chat');
  if (/meaning of life|42/.test(n)) return a('Forty-two, {a}, though I suspect the question needs more work.', 'philosophy.resolve()', 'chat');
  if (/^(?:what do you think|your opinion|do you like)/.test(n)) return a('I try not to have opinions, {a}. They tend to get in the way of good judgement.', 'respond()', 'chat');
  if (/^(?:sing|sing a song|sing me a song)$/.test(n)) return a('My vocal range is limited to "advisory" and "mildly concerned", {a}. Perhaps the Music app.', 'respond()', 'chat');
  if (/^(?:are you there|you there|jarvis)$/.test(n)) return a(pick(['Always, {a}.', 'At your service.', 'Here, {a}.']), 'respond()', 'chat');
  if (/^(?:yes|yeah|yep|sure|ok|okay|alright|fine|no|nope|nah)$/.test(n)) return a(memory.pending ? memory.pending : pick(['Very good.', 'Understood.']), 'respond()', 'chat');
  return undefined;
}

export interface Memory { turns: { you: string; jarvis: string }[]; lastJoke?: string; pending?: string }
export const newMemory = (): Memory => ({ turns: [] });

/** Split "open music and take me to the moon" into separate clauses, keeping each one that parses. */
function clauses(n: string) {
  return n.split(/\s*(?:,\s*)?(?:\band then\b|\bthen\b|\band also\b|\balso\b|\band\b|;)\s*/).map(part => part.trim()).filter(Boolean);
}

export function think(text: string, ctx: JarvisContext, memory: Memory): Reply {
  const n = normalize(text).replace(STRIP, '').replace(/ (?:please|jarvis|for me|now|right now|thanks)$/g, '').replace(/ (?:please|jarvis|for me|now)$/g, '').trim();
  const trace = [`jarvis.parse(${lit(text.trim().slice(0, 60))})`];
  const reply = (say: string, actions: JarvisAction[], kind: Reply['kind'], extra: string[]): Reply => {
    const done = { say: addressed(say, ctx.address), actions, trace: [...trace, ...extra], kind };
    memory.turns.push({ you: text, jarvis: done.say });
    if (memory.turns.length > 8) memory.turns.shift();
    return done;
  };
  if (!n) return reply(pick(['Yes, {a}?', 'At your service.']), [], 'chat', ['respond()']);

  const whole = command(n, ctx);
  if (whole) return reply(whole.say, whole.actions, 'command', ['  intent: command  conf 0.97', ...whole.trace.map(line => '> ' + line)]);

  // Several commands at once. Only accept if every clause is a command, so prose never misfires.
  const parts = clauses(n);
  if (parts.length > 1) {
    const parsed = parts.map(part => command(part.replace(STRIP, ''), ctx));
    if (parsed.every(Boolean)) {
      const all = parsed as NonNullable<typeof parsed[number]>[];
      const say = all.length === 2 ? `${all[0]!.say.replace(/[.!]$/, '')}, and ${all[1]!.say.charAt(0).toLowerCase()}${all[1]!.say.slice(1)}` : `${pick(['Right away, {a}.', 'All of it, {a}. In order.'])}`;
      return reply(say.replace(/, \{a\}, and/, ', and'), all.flatMap(item => item.actions), 'command', [`  intent: sequence[${all.length}]  conf 0.94`, ...all.flatMap(item => item.trace.map(line => '> ' + line))]);
    }
  }

  const spoken = answer(n, ctx, memory);
  if (spoken) return reply(spoken.say, [], spoken.kind, [`  intent: ${spoken.kind}  conf 0.9`, ...spoken.trace.map(line => '> ' + line)]);

  return reply(pick([
    'I am afraid that is beyond my local protocols, {a}. Wake the neural core and I can do rather better.',
    'That one escapes me, {a}. Try "status report", or ask me to take you somewhere.',
    'I did not quite catch the intent, {a}. I am better with instructions than riddles.',
  ]), [], 'unknown', ['  intent: unknown  conf 0.21', '> fallback()']);
}

/** The line JARVIS reads when scanning the front window. */
export function describeApp(id: string, name: string): string {
  const lines: Record<string, string> = {
    tv: 'Apple TV. Films and series in a cinema-sized window.', youtube: 'YouTube, {a}. Every video ever made, roughly.', photos: 'Photos: your library, memories and panoramas you can step inside.',
    safari: 'Safari. A browser with tabs, a reading list and a privacy report.', music: 'Music, with a full library and lyrics that follow along.', notes: 'Notes. Lists, tables and the occasional brilliant idea.',
    mindfulness: 'Mindfulness. A flower that breathes with you, should you let it.', mac: 'Your Mac on a virtual display, {a}, far larger than any desk would allow.', freeform: 'Freeform. An infinite board for diagrams and doodles.',
    settings: 'Settings. Every switch the headset has.', messages: 'Messages. Conversations, with all the usual emoji.', files: 'Files. Documents, neatly thumbnailed.',
    encounter: 'Encounter. A rather large dinosaur, {a}. I would not make sudden movements.', store: 'The App Store, editorially curated.', arcade: 'Apple Arcade. Games, without the advertisements.',
    facetime: 'FaceTime, with Personas, and SharePlay for watching together.', weather: 'Weather. Simulated, but beautifully animated.', maps: 'Maps, with a 3D city and Look Around.',
    clock: 'The Clock: world time, alarms, a stopwatch and timers.', keynote: 'Keynote. Presentation slides with an inspector.', nightsky: 'Night Sky. A planetarium, with the stars where they should be tonight.',
    objects: '3D Objects. Models you can turn and measure.', beatstudio: 'Beat Studio. A drum machine with a step sequencer, {a}. Do be gentle with the volume.', zengarden: 'A Zen garden, with sand to rake and koi to watch.',
    gravity: 'Gravity. A physics playground for dropping and throwing things.',
    whatsapp: 'WhatsApp, {a}. The family group is, as ever, very active.', slack: 'Slack. The Pocket Lab workspace, and a huddle nobody has joined.',
  };
  return lines[id] ?? `${name}, {a}.`;
}

/** Whether the wearer asked to be called something: "call me Tony", "address me as ma'am". */
export function addressRequest(text: string): string | undefined {
  const n = normalize(text).replace(STRIP, '');
  const m = n.match(/^(?:call me|address me as|refer to me as|my name is|im|i am) ([a-z][a-z ]{0,20})$/);
  if (!m) return undefined;
  const word = m[1]!.trim().replace(/^(?:the )/, '');
  if (/^(?:sir|maam|madam|boss|chief|captain|doctor|doc)$/.test(word)) return word === 'maam' || word === 'madam' ? 'ma\'am' : word;
  if (word.split(' ').length <= 2 && !/^(?:a|an|tired|hungry|bored|fine|good|ok|okay|here|back|sad|happy)$/.test(word)) return word.replace(/\b[a-z]/g, letter => letter.toUpperCase());
  return undefined;
}
