/**
 * JARVIS's planner. The language model reads the request and answers with a plan, not just words:
 * {"actions": [...], "say": "..."}. The server constrains the model to that JSON shape (a grammar from
 * the schema below), the actions are checked against the real apps and places, and they run as soon
 * as the list is complete, while JARVIS is still finishing his sentence.
 */
import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { match, type Entry, type JarvisAction, type JarvisContext } from './brain';

export type Step = { do: string; target?: string; text?: string; number?: number };

const DOS = ['go', 'home', 'open', 'close', 'apps', 'youtube', 'music', 'pause', 'next', 'message', 'read_messages', 'slack', 'timer', 'alarm', 'weather', 'time',
  'remember', 'recall', 'build', 'spawn', 'clear_space', 'gravity', 'immersion', 'lights_down', 'lights_up', 'search', 'arrange', 'capture', 'just_the_view', 'show_everything', 'protocol', 'focus', 'mute', 'unmute'] as const;

/** The JSON shape the model must produce. Property order matters: actions first, so they can run early. */
export const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    actions: {
      type: 'array', maxItems: 6,
      items: {
        type: 'object',
        properties: { do: { type: 'string', enum: DOS }, target: { type: 'string' }, text: { type: 'string' }, number: { type: 'number' } },
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
    `You are JARVIS, the calm, loyal British AI butler from the Iron Man films, running a simulated Apple Vision Pro in Mohith's lab. You are precise, unhurried and quietly witty.`,
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
    `{"do":"arrange"} tidy windows. {"do":"capture"} take a picture. {"do":"just_the_view"} hide everything. {"do":"show_everything"}. {"do":"focus"} do not disturb. {"do":"mute"}. {"do":"unmute"}.`,
    `{"do":"protocol","target":"house party|clean slate|focus|blackout|stargazer"}.`,
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
