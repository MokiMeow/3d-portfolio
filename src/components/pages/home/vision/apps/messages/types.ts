export type Effect = 'none' | 'slam' | 'loud' | 'ink' | 'confetti' | 'lasers';
export type Message = {
    id: number;
    text: string;
    mine: boolean;
    time: string;
    reaction?: string;
    status?: 'delivered' | 'read';
    sender?: string;
    photo?: string;
    audio?: boolean;
    sticker?: string;
    reply?: {
        id: number;
        text: string;
        sender: string;
    };
    effect?: Effect;
    revealed?: boolean;
    edited?: boolean;
    unsent?: boolean;
};
export type ReplyRule = {
    terms: string[];
    reply: string;
};
export type Conversation = {
    id: number;
    name: string;
    glyph: string;
    tint: string;
    description: string;
    members: string[];
    pinned: boolean;
    unread: number;
    muted: boolean;
    messages: Message[];
    rules: ReplyRule[];
    fallback: string[];
};
