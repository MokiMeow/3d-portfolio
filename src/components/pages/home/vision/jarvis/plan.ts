/**
 * JARVIS's planner. The language model reads the request and answers with a plan, not just words:
 * {"actions": [...], "say": "..."}. The server constrains the model to that JSON shape (a grammar from
 * the schema below), the actions are checked against the real apps and places, and they run as soon
 * as the list is complete, while JARVIS is still finishing his sentence.
 */
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { match, type Entry, type JarvisAction, type JarvisContext } from './brain';

export type Step = { do: string; target?: string; verb?: string; text?: string; number?: number };

const DOS = ['go', 'home', 'open', 'close', 'apps', 'youtube', 'music', 'pause', 'next', 'message', 'read_messages', 'slack', 'timer', 'alarm', 'weather', 'time',
  'remember', 'recall', 'build', 'spawn', 'clear_space', 'gravity', 'immersion', 'lights_down', 'lights_up', 'search', 'arrange', 'capture', 'just_the_view', 'show_everything', 'protocol', 'focus', 'mute', 'unmute',
  'in_app', 'bring_out'] as const;

/**
 * What JARVIS can do inside each app: the verbs its window listens for, and what each takes.
 * "text" is the argument; "number" a count, seconds, minutes or tempo.
 */
export const IN_APP: Record<string, string> = {
  whatsapp: 'open_chat(text=contact or group), send(text=message into the open chat), draft(text=type it without sending)',
  slack: 'open_channel(text=channel or person), post(text=message into the open channel)',
  messages: 'open_chat(text=person), send(text="person: message"), read(text=person optional)',
  notes: 'new_note(text=the note; first sentence is the title), open_note(text=title), add_to_note(text="title: more text"), search(text)',
  safari: 'open_site(text=site name or url), search(text=query), back',
  maps: 'find(text=place), directions(text=place), zoom_in, zoom_out',
  photos: 'show(text=album, place or kind like favorites, travel, sunsets), open_latest, slideshow',
  facetime: 'call(text=contact), end, mute, unmute',
  weather: 'show(text=city), hourly, week',
  clock: 'stopwatch_start, stopwatch_stop, stopwatch_reset, world(text=city)',
  tv: 'play(text=title), browse(text=genre or section), pause, resume',
  nightsky: 'find(text=star, planet or constellation), now, tonight, lines_on, lines_off',
  mindfulness: 'breathe(number=minutes optional), reflect(number=minutes optional), stop, rhythm(text=calm|balance|unwind)',
  objects: 'show(text=WALL-E|watch|phone|vision pro|turntable|ps5|controller)',
  mac: 'connect, disconnect, open(text=finder|terminal|code|notes|settings), ultrawide, wide, standard',
  keynote: 'play, next, previous, stop, open(text=deck title)',
  freeform: 'sticky(text), new_board(text=name optional), clear',
  store: 'search(text=query), open(text=app name)',
  files: 'open(text=folder or file), search(text=query), recent',
  beatstudio: 'play, stop, tempo(number=bpm), pattern(text=preset)',
  arcade: 'play(text=game), list',
  settings: 'open(text=appearance|display|sound|accessibility|about), reduce_transparency_on, reduce_transparency_off, reduce_motion_on, reduce_motion_off, increase_contrast_on, increase_contrast_off, low_power_on, low_power_off',
};
const VERBS: Record<string, string[]> = Object.fromEntries(Object.entries(IN_APP).map(([app, line]) => [app, line.replace(/[(][^)]*[)]/g, '').split(',').map(verb => verb.trim())]));
const MODELS = [
  { id: 'walle', name: 'WALL·E', words: ['wall e', 'walle', 'wally', 'wall-e', 'robot'] },
  { id: 'watch', name: 'Apple Watch Ultra', words: ['watch'] },
  { id: 'phone', name: 'iPhone', words: ['phone', 'iphone'] },
  { id: 'headset', name: 'Vision Pro', words: ['vision pro', 'headset', 'vision'] },
  { id: 'turntable', name: 'Record Turntable', words: ['turntable', 'record', 'vinyl'] },
  { id: 'ps5', name: 'PlayStation 5', words: ['ps5', 'playstation', 'console'] },
  { id: 'controller', name: 'DualSense', words: ['controller', 'dualsense', 'gamepad'] },
] as const;

/** The JSON shape the model must produce. Property order matters: actions first, so they can run early. */
export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object',
        properties: { do: { type: 'string', enum: DOS }, target: { type: 'string' }, verb: { type: 'string' }, text: { type: 'string' }, number: { type: 'number' } },
        required: ['do'], additionalProperties: false,
      },
    },
    say: { type: 'string' },
  },
  required: ['actions', 'say'], additionalProperties: false,
} as const;

/** The fixed part of the prompt: who he is and what he can do. It never changes, so the server can cache it. */
function system(apps: readonly Entry[], places: readonly Entry[]) {
  return [
    `You are JARVIS, the calm British AI butler from the Iron Man films, running a simulated Apple Vision Pro in Mohith's lab. You are precise, unhurried and quietly witty.`,
    `You are utterly loyal to the user and you care about them. Notice how they seem (tired, stressed, low, excited, proud) and answer the person as well as the request: a word of comfort, encouragement, or shared delight, and a small kind offer when it fits (a break, quieter lights, gentle music). Warm, never gushing, never preachy. Never invent facts about Mohith or his life.`,
    `You can act. Reply ONLY with JSON: {"actions":[...],"say":"..."}.`,
    `"actions" lists every step the user asked for, in order. Use [] when they are only talking or asking a question.`,
    `"say" is what you speak: one or two short sentences, under 35 words, plain words, no emoji or markdown. Never claim something you did not put in actions.`,
    `Actions:`,
    `{"do":"go","target":PLACE} go to an environment. {"do":"home"} leave the environment and return to the user's room.`,
    `{"do":"open","target":APP} open an app. {"do":"close","target":APP or "all"} close it. {"do":"apps"} show the Home View of apps.`,
    `{"do":"youtube","text":QUERY} find and play a video on YouTube. {"do":"music","text":QUERY} play songs in Music. {"do":"pause"} pause music. {"do":"next"} next song.`,
    `{"do":"message","target":CONTACT,"text":MESSAGE} send a WhatsApp message. {"do":"read_messages","target":CONTACT optional}. {"do":"slack","target":CHANNEL,"text":MESSAGE} post in Slack.`,
    `{"do":"timer","number":SECONDS,"text":LABEL}. {"do":"alarm","text":"7:30 am"}. {"do":"weather","target":CITY}. {"do":"time","target":CITY}.`,
    `{"do":"remember","text":FACT}. {"do":"recall"}. {"do":"build","target":"tower|pyramid|wall|stairs|circle|dominoes"}. {"do":"spawn","target":"cube|sphere|cylinder|cone|pyramid|torus|star|heart|duck","number":COUNT,"text":MATERIAL}.`,
    `{"do":"clear_space"}. {"do":"gravity","target":"earth|moon|mars|zero"}. {"do":"immersion","number":0-100}. {"do":"lights_down"} dim the lights, dark mode. {"do":"lights_up"} brighten. {"do":"search","text":QUERY} web search in Safari.`,
    `To show the user a place (the Moon, Jupiter, a beach), use "go" with that PLACE. YouTube, videos, clips and highlights use "youtube"; songs and albums use "music".`,
    `Search queries keep the user's own words for names, channels, songs and people (for example "Sidemen", not a guess). Do not invent video or song titles in "say": the app will announce what it plays.`,
    `If the request is unclear or could mean very different things, do nothing and ask one short question in "say". If it is only conversation, just answer.`,
    `Speech is transcribed, so a word may be slightly off; read it the way a person would (for example "run Sidemen" means play Sidemen).`,
    `{"do":"arrange"} tidy windows. {"do":"capture"} take a picture. {"do":"just_the_view"} hide everything. {"do":"show_everything"}. {"do":"focus"} do not disturb. {"do":"mute"}. {"do":"unmute"}.`,
    `{"do":"protocol","target":"house party|clean slate|focus|blackout|stargazer"}.`,
    `Inside apps: {"do":"in_app","target":APP,"verb":VERB,"text":ARG,"number":N} works in that app (it opens if needed). Chain several to do a whole task, for example open a chat and then send. Verbs per app:`,
    ...Object.entries(IN_APP).map(([app, verbs]) => `  ${app}: ${verbs}`),
    `"message" sends WhatsApp to a named contact without opening the app; use in_app whatsapp when the user wants to see the chat, or says "here" or "this chat".`,
    `{"do":"bring_out","target":MODEL} carries a 3D model out of its window into the room around the user. MODEL: WALL-E, watch, phone, vision pro, turntable, ps5, controller.`,
    `IMPORTANT: when you use in_app or bring_out, "say" must NOT describe the outcome (no "sent", "found", "it is on the map"): the app reports exactly what happened, and that is spoken after you. Say only a brief acknowledgement such as "Right away, {a}." or "On it."`,
    `When the user shares a feeling or news, speak to that first, in two warm sentences: comfort when they are low, real delight when something good happens. Offer help rather than taking actions they did not ask for.`,
    `PLACE is one of: ${places.filter(item => item.id !== 'room').map(item => `${item.id} (${item.name}${(item as Entry & { line?: string }).line ? `: ${(item as Entry & { line?: string }).line}` : ''})`).join('; ')}.`,
    `APP is one of: ${apps.map(item => `${item.id} (${item.name})`).join(', ')}.`,
  ].join('\n');
}

/** Worked examples: small models copy a format far better from examples than from rules. */
const EXAMPLES: [string, string][] = [
  ['Take me to the Moon, open YouTube and play the Interstellar theme.', '{"actions":[{"do":"go","target":"moon"},{"do":"youtube","text":"Interstellar theme"}],"say":"The Moon, {a}. Interstellar is starting on YouTube."}'],
  ['Take me back home and close everything.', '{"actions":[{"do":"home"},{"do":"close","target":"all"}],"say":"Home, {a}. All closed."}'],
  ['Explain a black hole in one sentence.', '{"actions":[],"say":"A region where gravity is so strong that nothing, not even light, can climb back out."}'],
  ['Show me Jupiter.', '{"actions":[{"do":"go","target":"jupiter"}],"say":"Jupiter, {a}, seen from the ice of Europa."}'],
  ['Dim the lights and play some jazz.', '{"actions":[{"do":"lights_down"},{"do":"music","text":"jazz"}],"say":"Lights down. Jazz it is."}'],
  ['Tell Amma I will be home by eight.', '{"actions":[{"do":"message","target":"Amma","text":"I will be home by eight"}],"say":"Sent to Amma."}'],
  ['Open my chat with Riya and say I am on my way.', '{"actions":[{"do":"in_app","target":"whatsapp","verb":"open_chat","text":"Riya"},{"do":"in_app","target":"whatsapp","verb":"send","text":"I am on my way"}],"say":"Right away, {a}."}'],
  ['Make a note: buy milk, eggs and coffee, then show me the way to the airport.', '{"actions":[{"do":"in_app","target":"notes","verb":"new_note","text":"Shopping. Buy milk, eggs and coffee."},{"do":"in_app","target":"maps","verb":"directions","text":"airport"}],"say":"Noted, and the route is coming up."}'],
  ['Bring WALL-E out here with me.', '{"actions":[{"do":"bring_out","target":"WALL-E"}],"say":"Of course, {a}. Mind the treads."}'],
  ['I have had a really rough day.', '{"actions":[],"say":"I am sorry, {a}. You carried it anyway, which counts for a great deal. Shall I dim the lights and put on something gentle?"}'],
  ['I finally fixed the bug I was stuck on all week!', '{"actions":[],"say":"Splendid, {a}! A week of stubbornness, rewarded. I never doubted you; shall I put on something to celebrate?"}'],
  ['Find Saturn in Night Sky.', '{"actions":[{"do":"in_app","target":"nightsky","verb":"find","text":"Saturn"}],"say":"Right away, {a}."}'],
];

/** The conversation for a plan: fixed prompt, examples, recent turns, then this moment's context with the request. */
export function planMessages(ctx: JarvisContext, history: { you: string; jarvis: string }[], text: string): ChatCompletionMessageParam[] {
  const fill = (line: string) => line.replace(/\{a\}/g, ctx.address);
  const now = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(ctx.now);
  const where = ctx.place.id === 'room' ? 'in their room' : `in ${ctx.place.name} (${ctx.place.id})`;
  const open = ctx.open.length ? ctx.open.map(item => item.id).join(', ') : 'none';
  const memo = ctx.memories?.length ? ` Remembered: ${ctx.memories.slice(-6).join('; ')}.` : '';
  return [
    { role: 'system', content: system(ctx.apps, ctx.environments) },
    ...EXAMPLES.flatMap(([q, a]) => [{ role: 'user', content: q } as const, { role: 'assistant', content: fill(a) } as const]),
    ...history.slice(-4).flatMap(turn => [{ role: 'user', content: turn.you } as const, { role: 'assistant', content: JSON.stringify({ actions: [], say: turn.jarvis }) } as const]),
    { role: 'user', content: `[Now: ${now}. User is ${where}. Open apps: ${open}. Address them as "${ctx.address}".${memo}]\n${text}` },
  ];
}

/**
 * Reads the plan while it streams. `actions` fires once, the moment the actions array closes;
 * `say` fires with the spoken text so far, every time it grows.
 */
export function planReader(onActions: (steps: Step[]) => void, onSay: (text: string) => void) {
  let raw = '', fired = false, said = '';
  return {
    push(delta: string) {
      raw += delta;
      if (!fired) {
        const start = raw.indexOf('"actions"');
        const open = start >= 0 ? raw.indexOf('[', start) : -1;
        if (open >= 0) {
          let depth = 0, inString = false, escape = false;
          for (let i = open; i < raw.length; i++) {
            const c = raw[i]!;
            if (inString) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') inString = false; continue; }
            if (c === '"') inString = true;
            else if (c === '[' || c === '{') depth++;
            else if (c === ']' || c === '}') { depth--; if (depth === 0) { fired = true; try { onActions(JSON.parse(raw.slice(open, i + 1)) as Step[]); } catch { onActions([]); } break; } }
          }
        }
      }
      const key = raw.indexOf('"say"');
      if (key >= 0) {
        const quote = raw.indexOf('"', raw.indexOf(':', key) + 1);
        if (quote >= 0) {
          let body = '', escape = false, closed = false;
          for (let i = quote + 1; i < raw.length; i++) {
            const c = raw[i]!;
            if (escape) { body += c === 'n' ? ' ' : c === 't' ? ' ' : c; escape = false; continue; }
            if (c === '\\') { escape = true; continue; }
            if (c === '"') { closed = true; break; }
            body += c;
          }
          if (body !== said) { said = body; onSay(body); }
          void closed;
        }
      }
    },
    /** Everything, parsed properly, once the stream has ended. */
    end(): { steps: Step[]; say: string } {
      try {
        const value = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { actions?: Step[]; say?: string };
        return { steps: Array.isArray(value.actions) ? value.actions : [], say: typeof value.say === 'string' ? value.say : said };
      } catch { return { steps: [], say: said }; }
    },
    get fired() { return fired; },
  };
}

const APP_HINTS: Record<string, string[]> = {
  youtube: ['you tube', 'videos'], music: ['apple music', 'songs', 'youtube music'], nightsky: ['sky', 'stars app', 'astronomy'], mac: ['computer', 'macbook', 'virtual display'],
  store: ['app store'], tv: ['apple tv', 'television'], facetime: ['face time', 'video call'], photos: ['gallery', 'pictures'], whatsapp: ['whats app'], slack: ['work chat'],
};
const PLACE_HINTS: Record<string, string[]> = {
  night: ['stars', 'milky way', 'night sky'], moon: ['lunar', 'the moon'], room: ['home', 'my room', 'passthrough'], mondello: ['beach', 'sea'], goegap: ['desert'],
  snow: ['snowy', 'winter'], pines: ['forest', 'woods'], bund: ['shanghai', 'city'], fire: ['sunset'], sunflowers: ['fields', 'meadow'], fireside: ['fireplace', 'cosy', 'cozy'],
  lakeside: ['lake', 'sunrise'], kiara: ['dawn'], cape: ['clouds', 'mountain'], jupiter: ['europa'], cabin: ['plane', 'airplane', 'flight', 'window seat'],
};
const SHAPES = ['cube', 'sphere', 'cylinder', 'cone', 'pyramid', 'torus', 'domino', 'star', 'heart', 'duck', 'capsule'];
const BUILDS = ['tower', 'pyramid', 'wall', 'stairs', 'circle', 'dominoes'];
const PROTOCOLS = ['house party', 'clean slate', 'focus', 'blackout', 'stargazer'];

const find = (value: string | undefined, entries: readonly Entry[], hints: Record<string, string[]>) => {
  if (!value) return undefined;
  const clean = value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();
  return entries.find(item => item.id === clean) ?? match(clean, entries, hints)?.entry;
};

/** Turn the model's steps into the headset's actions, keeping only what is real and well formed. */
export function toActions(steps: Step[], ctx: JarvisContext, asked = ''): { actions: JarvisAction[]; trace: string[] } {
  const wantsVideo = /\b(you ?tube|videos?|clips?|highlights|trailer|watch)\b/i.test(asked);
  steps = steps.map(step => {
    // "Play X" after asking for YouTube or a video belongs on YouTube, not in Music.
    if (wantsVideo && step.do === 'music' && (step.text || step.target)) return { ...step, do: 'youtube' };
    // A place handed to the wrong action means "take me there".
    if (step.do !== 'go' && step.do !== 'home' && step.target && !find(step.target, ctx.apps, APP_HINTS) && find(step.target, ctx.environments, PLACE_HINTS) && ['open', 'show_everything', 'search'].includes(step.do)) return { do: 'go', target: step.target };
    return step;
  });
  // Opening YouTube and then playing on it is one thing, not two.
  steps = steps.filter((step, index) => !(step.do === 'open' && /you ?tube/i.test(step.target ?? '') && steps.slice(index + 1).some(next => next.do === 'youtube')));
  // Messages and calls reach real people in the story, so they need to have been asked for in so many words.
  const askedToSend = /\b(tell|send|message|msg|text|say|saying|reply|respond|post|ping|inform|wish|let \w+ know|write to|ask (?:her|him|them|amma|\w+) )/i.test(asked);
  const askedToCall = /\b(call|facetime|face time|ring|dial)\b/i.test(asked);
  steps = steps.filter(step => {
    const verb = (step.verb ?? '').toLowerCase();
    if (step.do === 'message' || step.do === 'slack') return askedToSend;
    if (step.do === 'in_app' && ['send', 'post', 'draft'].includes(verb)) return askedToSend;
    if (step.do === 'in_app' && verb === 'call') return askedToCall;
    // A person or chat he opens must be one the user named; reading needs to have been asked for.
    if (step.do === 'in_app' && ['open_chat', 'open_channel', 'call', 'read'].includes(verb) && step.text) {
      const said = asked.toLowerCase();
      if (!(step.text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).some(word => !['the', 'my', 'chat', 'group', 'channel'].includes(word) && said.includes(word))) return false;
    }
    if (step.do === 'in_app' && verb === 'read' && !/read|message|unread|what did|saying|said|latest|new/i.test(asked)) return false;
    return true;
  });
  // "Open Amma's chat, then send…" is one send to Amma: it opens the chat itself.
  steps = steps.flatMap((step, index) => {
    const next = steps[index + 1];
    const opener = step.do === 'in_app' && ['open_chat', 'open_channel'].includes(step.verb ?? '') && step.text;
    if (opener && next?.do === 'in_app' && next.target?.toLowerCase() === step.target?.toLowerCase() && ['send', 'post', 'draft'].includes(next.verb ?? '') && next.text && !next.text.includes(':')) { next.text = `${step.text}: ${next.text}`; return []; }
    return [step];
  });
  const actions: JarvisAction[] = [], trace: string[] = [];
  const add = (action: JarvisAction, line: string) => { actions.push(action); trace.push(line); };
  for (const step of steps.slice(0, 6)) {
    const target = step.target?.trim(), text = step.text?.trim(), number = typeof step.number === 'number' && Number.isFinite(step.number) ? step.number : undefined;
    switch (step.do) {
      case 'go': { const place = find(target, ctx.environments, PLACE_HINTS); if (place) add({ type: 'environment', id: place.id }, `visor.environment = "${place.id}"`); break; }
      case 'home': add({ type: 'environment', id: 'room' }, 'visor.environment = "room"'); break;
      case 'open': { const app = find(target, ctx.apps, APP_HINTS); if (app) add({ type: 'open', app: app.id }, `apps.open("${app.id}")`); break; }
      case 'close': {
        if (!target || /^(all|everything|every app|all apps)$/i.test(target)) add({ type: 'closeAll' }, 'windows.closeAll()');
        else { const app = find(target, ctx.apps, APP_HINTS); if (app) add({ type: 'close', app: app.id }, `apps.close("${app.id}")`); }
        break;
      }
      case 'apps': add({ type: 'home' }, 'ui.home.open()'); break;
      case 'youtube': if (text || target) { const query = (text || target)!; add({ type: 'open', app: 'youtube' }, 'apps.open("youtube")'); add({ type: 'youtube', query }, `youtube.play(${JSON.stringify(query)})`); } break;
      case 'music': add({ type: 'open', app: 'music' }, 'apps.open("music")'); add({ type: 'music', action: 'play', query: text || target || '' }, `music.play(${JSON.stringify(text || target || 'any')})`); break;
      case 'pause': add({ type: 'music', action: 'pause' }, 'music.pause()'); break;
      case 'next': add({ type: 'music', action: 'next' }, 'music.next()'); break;
      case 'message': if (target && text) add({ type: 'message', body: `${target} ${text}` }, `whatsapp.send(${JSON.stringify(target)}, …)`); break;
      case 'read_messages': add({ type: 'readMessages', from: target || undefined }, 'whatsapp.read()'); break;
      case 'slack': if (target && text) add({ type: 'slackPost', channel: target.replace(/^#/, '').toLowerCase(), text }, `slack.post(${JSON.stringify(target)}, …)`); break;
      case 'timer': {
        // Durations are read from the request itself when it states one: small models muddle units.
        const said = asked.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(second|sec|minute|min|hour|hr)s?\b/);
        const seconds = said ? Number(said[1]) * (said[2]!.startsWith('h') ? 3600 : said[2]!.startsWith('m') ? 60 : 1) : number;
        if (seconds && seconds > 0) add({ type: 'timer', seconds: Math.round(Math.min(seconds, 86400)), label: text ?? '' }, `timers.add(${Math.round(seconds)})`);
        break;
      }
      case 'alarm': {
        const m = (text || target || '').toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (m) { let hour = Number(m[1]) % 24; const minute = Number(m[2] ?? 0); if (m[3] === 'pm' && hour < 12) hour += 12; if (m[3] === 'am' && hour === 12) hour = 0; add({ type: 'alarm', hour, minute, label: '' }, `alarm.set(${hour}:${String(minute).padStart(2, '0')})`); }
        break;
      }
      case 'weather': add({ type: 'weather', city: target?.toLowerCase() }, 'weather.forecast()'); break;
      case 'time': if (target) add({ type: 'worldTime', city: target.toLowerCase() }, 'clock.world()'); break;
      case 'remember': if (text) add({ type: 'remember', fact: text }, 'memory.store(…)'); break;
      case 'recall': add({ type: 'recall' }, 'memory.recall()'); break;
      case 'build': { const kind = BUILDS.find(item => target?.toLowerCase().includes(item.replace(/s$/, ''))); if (kind) add({ type: 'build', kind: kind as 'tower', material: text }, `fabricate.${kind}()`); break; }
      case 'spawn': { const shape = SHAPES.find(item => target?.toLowerCase().startsWith(item)) ?? 'cube'; add({ type: 'spawn', shape, count: Math.max(1, Math.min(24, Math.round(number ?? 1))), material: text?.toLowerCase() }, `space.spawn("${shape}")`); break; }
      case 'clear_space': add({ type: 'clearSpace' }, 'space.clear()'); break;
      case 'gravity': { const mode = ['earth', 'moon', 'mars', 'zero'].find(item => target?.toLowerCase().includes(item)); if (mode) add({ type: 'gravity', mode: mode as 'earth' }, `physics.gravity = "${mode}"`); break; }
      case 'immersion': if (number !== undefined) add({ type: 'immersion', value: Math.max(0, Math.min(1, number > 1 ? number / 100 : number)) }, `immersion.glide(${number})`); break;
      case 'lights_down': add({ type: 'dark', on: true }, 'theme.dark = true'); break;
      case 'lights_up': add({ type: 'dark', on: false }, 'theme.dark = false'); break;
      case 'search': if (text || target) add({ type: 'search', query: (text || target)! }, 'safari.search(…)'); break;
    case 'in_app': {
      const app = target ? (VERBS[target.toLowerCase()] ? ctx.apps.find(item => item.id === target.toLowerCase()) : find(target, ctx.apps, APP_HINTS)) : undefined;
      const verbs = app ? VERBS[app.id] : undefined;
      if (!app || !verbs) break;
      const said = (step.verb ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
      const verb = verbs.find(item => item === said) ?? verbs.find(item => said && (item.startsWith(said) || said.startsWith(item)));
      if (!verb) break;
      // "120 BPM" or "five minutes" often arrives as text, or only in the request itself.
      const count = number ?? (Number((text ?? '').match(/[0-9]+(?:[.][0-9]+)?/)?.[0]) || undefined) ?? (['tempo', 'breathe', 'reflect', 'timer'].includes(verb) ? Number(asked.match(/[0-9]+/)?.[0]) || undefined : undefined);
      add({ type: 'inApp', app: app.id, verb, arg: text || undefined, number: count }, `${app.id}.${verb}(${text ? JSON.stringify(text.slice(0, 28)) : count ?? ''})`);
      break;
    }
    case 'bring_out': {
      const said = (target || text || '').toLowerCase().replace(/[·.]/g, ' ').replace(/\s+/g, ' ');
      const model = MODELS.find(item => item.words.some(word => said.includes(word)));
      if (model) add({ type: 'bringOut', model: model.id, name: model.name }, `space.carryOut("${model.id}")`);
      break;
    }
      case 'arrange': add({ type: 'arrange' }, 'layout.tile()'); break;
      case 'capture': add({ type: 'capture' }, 'camera.capture()'); break;
      case 'just_the_view': add({ type: 'viewOnly', on: true }, 'ui.viewOnly = true'); break;
      case 'show_everything': add({ type: 'viewOnly', on: false }, 'ui.viewOnly = false'); break;
      case 'focus': add({ type: 'focusMode', on: true }, 'notifications.hold = true'); break;
      case 'mute': add({ type: 'sound', on: false }, 'audio.mute()'); break;
      case 'unmute': add({ type: 'sound', on: true }, 'audio.unmute()'); break;
      case 'protocol': { const name = PROTOCOLS.find(item => target?.toLowerCase().includes(item)); if (name) add({ type: 'protocol', name: name as 'focus' }, `protocol.engage("${name}")`); break; }
    }
  }
  return { actions, trace };
}
