/** Local fiction only. App history chunks are loaded after the app mounts. */
export interface Reaction { emoji: string; count: number; selected?: boolean }
export interface Quote { id: number; sender: string; text: string; color: string }
export interface RichMessage {
    id: number;
    text: string;
    mine: boolean;
    sender?: string;
    color?: string;
    date?: string;
    time: string;
    kind?: 'text' | 'photo' | 'sticker' | 'voice' | 'system' | 'deleted' | 'meme' | 'poll' | 'location' | 'flower' | 'gate';
    src?: string;
    fullSrc?: string;
    duration?: string;
    quote?: Quote;
    forwarded?: 'Forwarded' | 'Forwarded many times';
    edited?: boolean;
    reactions?: Reaction[];
    poll?: { question: string; options: Array<{ label: string; votes: number }>; voted?: number };
    location?: { title: string; address: string };
    link?: { title: string; domain: string; description: string };
    meme?: { top: string; bottom: string; emoji: string; background: string };
    pinned?: boolean;
}
export interface CastMember { name: string; color: string; exchanges: string[] }
export interface HistoryChat {
    name: string; glyph: string; color: string; group: boolean;
    persona: 'family' | 'amma' | 'flat' | 'rent' | 'delivery' | 'dev';
    members: CastMember[]; messages: RichMessage[];
    ambient: Array<{ sender: string; text: string; reaction?: string }>;
}
export interface MessageHistory { id: string; name: string; initials: string; tint: string; group?: boolean; sms?: boolean; messages: RichMessage[] }
export interface SlackHistory { name: string; messages: Array<RichMessage & { replies: RichMessage[] }> }
export interface AiHistory { id: number; title: string; turns: Array<{ from: 'me' | 'bot'; text: string }> }
export interface RecentCall { name: string; missed: boolean; label: string; detail?: string }
export interface Voicemail { id: string; name: string; date: string; duration: string; lines: string[] }
/** A tiny tokenizer, no HTML insertion and no per-message reactive effects. */
export function textParts(text: string) {
    return text.split(/(@[\p{L}\p{N}_-]+)/u).filter(Boolean).map(text => ({ text, mention: text.startsWith('@') }));
}
export function vote(message: Pick<RichMessage, 'poll'>, index: number) {
    const poll = message.poll;
    if (!poll || !poll.options[index]) return;
    if (poll.voted !== undefined && poll.options[poll.voted]) poll.options[poll.voted]!.votes--;
    if (poll.voted === index) { poll.voted = undefined; return; }
    poll.options[index]!.votes++;
    poll.voted = index;
}
export function percent(message: Pick<RichMessage, 'poll'>, votes: number) {
    const total = message.poll?.options.reduce((sum, option) => sum + option.votes, 0) ?? 0;
    return total ? Math.round(votes / total * 100) : 0;
}
