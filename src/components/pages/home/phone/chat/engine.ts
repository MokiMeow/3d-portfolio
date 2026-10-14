/** Fictional, local-only conversations. No network, Vue or timers in this module. */
export const INTENTS = [
    'greeting', 'bye', 'thanks', 'sorry', 'laugh', 'compliment', 'question',
    'food', 'chai', 'sleep', 'work', 'money', 'plans', 'weather', 'location',
    'help', 'angry', 'sad', 'agree', 'disagree', 'emoji', 'short', 'long',
    'shouting', 'gibberish', 'numbers', 'link', 'unknown'
] as const;
export type Intent = typeof INTENTS[number];
export type ReadState = 'sent' | 'delivered' | 'read';
export type Random = () => number;
export type ReplyPools = Readonly<Record<Intent, readonly string[]>>;
export interface ChatMember {
    name: string;
    color: string;
    replies: Partial<ReplyPools>;
    exchanges: readonly string[];
}
export interface ChatPhoto { src: string; caption: string }
export interface Persona {
    id: string;
    name: string;
    nickname: string;
    replies: ReplyPools;
    reactions: readonly string[];
    stickers: readonly string[];
    bursts: readonly string[];
    followups: readonly string[];
    flood: readonly string[];
    members?: readonly ChatMember[];
    photos?: readonly ChatPhoto[];
    voiceNotes?: readonly string[];
    bot?: boolean;
}
export interface ReplyBubble {
    kind: 'text' | 'sticker' | 'voice' | 'photo';
    text: string;
    delayMs: number;
    /** Relative to the respond call; includes earlier bubbles and queued plans. */
    atMs: number;
    sender?: string;
    color?: string;
    duration?: string;
    src?: string;
}
export interface ReplyPlan {
    intent: Intent;
    bubbles: ReplyBubble[];
    reaction?: { emoji: string; atMs: number };
    typing: Array<{ atMs: number; active: boolean }>;
    receipt: { deliveredAt: number; readAt: number; time: string };
    overwhelmed: boolean;
}
export interface ChatSession {
    respond(text: string, now?: Date | number): ReplyPlan;
    readonly memory: { lastIntent: Intent | null; keywords: readonly string[] };
}
export function normalizeText(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function detectIntent(text: string): Intent {
    const raw = text.normalize('NFKC').trim();
    const words = normalizeText(raw);
    if (/https?:\/\/|www\.|\b[\w-]+\.(com|org|in|net|dev)(?:\/|\b)/i.test(raw)) return 'link';
    if (/^\+?[\d\s.,:-]+$/.test(raw) || /\botp\b/.test(words)) return 'numbers';
    if (Array.from(raw).length > 160) return 'long';
    if (/[\p{Lu}]/u.test(raw) && raw === raw.toUpperCase() && (raw.match(/\p{L}/gu)?.length ?? 0) >= 5) return 'shouting';
    if (/asdf|qwert|zxcv|hjkl|^(.)\1{4,}$/.test(words) || (/^[a-z]{7,}$/.test(words) && !/[aeiouy]/.test(words))) return 'gibberish';
    const rules: ReadonlyArray<readonly [Intent, RegExp]> = [
        ['angry', /\b(ugh|wtf|annoyed|angry|frustrated|hate|furious)\b|😡|🤬/u],
        ['sad', /\b(sad|upset|lonely|cry|crying|bad day|down today)\b|😢|😭|💔/u],
        ['laugh', /\b(ha(?:ha)+|lol|lmao|rofl|hehe)\b|😂|🤣/u],
        ['compliment', /\b(love|miss|cute|lovely|amazing|awesome|beautiful|nice|cool)\b|❤|😍|🥰/u],
        ['sorry', /\b(sorry|apologies|apologize|my bad)\b/],
        ['thanks', /\b(thank|thanks|thankyou|thx|ty|grateful)\b|🙏/u],
        ['bye', /\b(bye|goodbye|cya|see you|good night|gn)\b/],
        ['location', /\b(where|location|gate|address|map|pin|outside|traffic|silk board)\b/],
        ['chai', /\b(chai|tea|coffee|filter coffee|kettle|cuppa)\b|☕|🫖/u],
        ['food', /\b(food|lunch|dinner|breakfast|eat|ate|eaten|hungry|pizza|dosa|idli|biscuit|snack|biryani|meal)\b/],
        ['sleep', /\b(sleep|sleepy|tired|exhausted|nap|awake|bed|rest)\b|😴/u],
        ['money', /\b(money|rent|paid|payment|deposit|cost|price|loan|credit|rupees|salary|budget|transfer)\b|₹/u],
        ['weather', /\b(weather|rain|raining|monsoon|umbrella|sunny|hot|cold|storm)\b|🌧|☔/u],
        ['work', /\b(work|code|coding|bug|bugs|error|deploy|deployment|meeting|test|tests|build|ci|prod|ship|commit|broken|fix|repair|leak|plumber|deadline|wifi|internet)\b/],
        ['plans', /\b(plan|plans|weekend|movie|party|trip|visit|coming|tomorrow|tonight|saturday|sunday|hangout)\b/],
        ['help', /\b(help|assist|support|stuck|advice|human|agent)\b/],
        ['agree', /^(ok|okay|yes|yep|yeah|sure|fine|noted|agreed|done|yup|alright)\b|👍/u],
        ['disagree', /^(no|nope|nah|never|stop|unsubscribe|disagree)\b|👎/u],
        ['greeting', /\b(hi|hello|hey|hiya|namaste|morning|afternoon|evening)\b/]
    ];
    for (const [intent, rule] of rules) if (rule.test(words + ' ' + raw)) return intent;
    const emojiRemainder = raw.replace(/[0-9#*]\uFE0F?\u20E3/gu, '')
        .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\s]/gu, '');
    if (!emojiRemainder && /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u.test(raw)) return 'emoji';
    if (raw.length <= 2) return 'short';
    if (/\?\s*$/.test(raw) || /^(who|what|when|why|how|where|can|should|is|are|do|does|could|would)\b/.test(words)) return 'question';
    return 'unknown';
}
const stopWords = new Set(['the','this','that','with','from','have','your','you','and','are','was','for','please','what','where','when','how','can','does','just','okay','yes','yep','yeah','sure','fine','noted','agreed','done','yup','alright','hello','hey','bye','nope','nah','thanks','thank','sorry']);
function keywords(text: string): string[] {
    // Only letters are echoed: no URLs, OTPs, HTML or punctuation are interpolated.
    return normalizeText(text).split(' ').filter(word => /^[\p{L}]{3,20}$/u.test(word) && !stopWords.has(word)).slice(0, 4);
}
export function createChatSession(persona: Persona, random: Random = Math.random): ChatSession {
    const bags = new Map<string, string[]>();
    const previous = new Map<string, string>();
    const memory: { lastIntent: Intent | null; keywords: string[] } = { lastIntent: null, keywords: [] };
    let readyAt = 0;
    let recent: number[] = [];
    let sequence = 100;
    const roll = (): number => Math.max(0, Math.min(0.999999, random()));
    function pick(key: string, pool: readonly string[]): string {
        if (!pool.length) return '';
        let bag = bags.get(key);
        if (!bag?.length) {
            bag = [...new Set(pool)];
            for (let i = bag.length - 1; i > 0; i--) {
                const j = Math.floor(roll() * (i + 1));
                [bag[i], bag[j]] = [bag[j]!, bag[i]!];
            }
            if (bag.length > 1 && bag.at(-1) === previous.get(key)) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1]!, bag[0]!];
            bags.set(key, bag);
        }
        const result = bag.pop()!;
        previous.set(key, result);
        return result;
    }
    function fill(line: string, echo: string, date: Date): string {
        return line.replace(/\{(echo|name|time|day|build|duration)\}/g, (_, key: string) => {
            const values: Record<string, string> = {
                echo: '“' + echo + '”', name: persona.nickname,
                time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                day: date.toLocaleDateString('en-GB', { weekday: 'long' }),
                build: String(sequence), duration: String(8 + sequence % 53) + 's'
            };
            return values[key] ?? '';
        });
    }
    return {
        get memory() { return { lastIntent: memory.lastIntent, keywords: [...memory.keywords] }; },
        respond(text, now = new Date()) {
            const date = new Date(now);
            const stamp = date.getTime();
            const intent = detectIntent(text);
            recent = recent.filter(at => stamp - at < 6500 && at <= stamp);
            recent.push(stamp);
            const overwhelmed = recent.length >= 3 && readyAt > stamp;
            const oldKeywords = [...memory.keywords];
            const incomingKeywords = keywords(text);
            const followup = !overwhelmed && oldKeywords.length > 0
                && (memory.lastIntent === intent || ['agree', 'question', 'short'].includes(intent)) && roll() < 0.16;
            const echo = (followup ? oldKeywords : incomingKeywords).join(' ') || oldKeywords.join(' ') || 'that';
            const member = persona.members?.[Math.floor(roll() * (persona.members?.length ?? 0))];
            // One bag per intent includes all member lines, preserving exhaustion across speakers.
            const memberLines = persona.members?.flatMap(m => (m.replies[intent] ?? persona.replies[intent]).map(line => ({ line, member: m }))) ?? [];
            const pool = memberLines.length ? memberLines.map(entry => entry.line) : persona.replies[intent];
            let line = overwhelmed ? pick('flood', persona.flood)
                : followup ? pick('followup', persona.followups)
                : pick(intent, pool);
            // Several members can share a line; any of them may say it, not always the first one listed.
            const voices = memberLines.filter(entry => entry.line === line);
            const speaker = voices[Math.floor(roll() * voices.length)]?.member ?? member;
            sequence++;
            const botSpeaking = persona.bot && (!speaker || speaker.name === 'Build Bot');
            if (botSpeaking) line = pick('status', ['✅ SIM CI #{build} · passed · {duration}', '❌ SIM CI #{build} · retry queued · {duration}', '🟡 SIM CI #{build} · checking · {duration}']) + '\n' + line;
            const bubbles: ReplyBubble[] = [];
            let cursor = Math.max(0, readyAt - stamp) + 850;
            const typing: ReplyPlan['typing'] = [{ atMs: cursor, active: true }];
            const readAt = cursor - 100;
            if (!persona.bot && roll() < 0.12) {
                typing.push({ atMs: cursor + 400, active: false }, { atMs: cursor + 1200, active: true });
                cursor += 1200;
            }
            function add(kind: ReplyBubble['kind'], content: string, author = speaker, extra: Partial<ReplyBubble> = {}) {
                const rendered = fill(content, echo, date);
                const delayMs = Math.max(700, Math.min(3200, rendered.length * 35 + Math.round(roll() * 380 - 100)));
                cursor += delayMs;
                bubbles.push({ kind, text: rendered, delayMs, atMs: cursor, sender: author?.name, color: author?.color, ...extra });
            }
            const burst = roll() < 0.25;
            if (burst && persona.bursts.length) add('text', pick('burst', persona.bursts), persona.bot ? persona.members?.find(m => m.name === 'Build Bot') : speaker);
            add('text', line);
            if (burst) {
                const other = persona.members?.filter(m => m !== speaker);
                const second = other?.[Math.floor(roll() * (other?.length ?? 0))];
                if (second && roll() < 0.65) add('text', pick('exchange:' + second.name, second.exchanges), second);
                else if (persona.voiceNotes?.length && roll() < 0.3) add('voice', pick('voice', persona.voiceNotes), speaker, { duration: '0:' + String(10 + Math.floor(roll() * 16)).padStart(2, '0') });
                else if (persona.photos?.length && roll() < 0.25) {
                    const photo = persona.photos[Math.floor(roll() * persona.photos.length)]!;
                    add('photo', photo.caption, speaker, { src: photo.src });
                } else if (persona.stickers.length && roll() < 0.45) add('sticker', pick('sticker', persona.stickers));
            }
            typing.push({ atMs: cursor, active: false });
            readyAt = stamp + cursor + 180;
            memory.lastIntent = intent;
            memory.keywords = incomingKeywords.length ? incomingKeywords.slice(0, 2) : oldKeywords;
            return {
                intent, bubbles, typing, overwhelmed,
                receipt: { deliveredAt: 350, readAt, time: new Date(stamp + readAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) },
                reaction: persona.reactions.length && roll() < 0.28 ? { emoji: pick('reaction', persona.reactions), atMs: readAt + 100 } : undefined
            };
        }
    };
}
