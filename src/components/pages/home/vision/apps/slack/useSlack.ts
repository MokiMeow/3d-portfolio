import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { createChatSession } from '../../../phone/chat/engine';
import { slackPersonas } from '../../../phone/chat/personas';
import type { RichMessage } from '../../../phone/chat/histories';

/**
 * Slack on the headset, sharing the phone's workspace: the same channels, people, threads and the same
 * reply engine, so a thread started on one carries the same voices on the other.
 */
export type Reaction = { label: string; count: number; selected: boolean };
export type Reply = Omit<Partial<RichMessage>, 'reactions'> & { id: number; author: string; initials: string; color: string; text: string; time: string };
export type Post = Reply & { reactions: Reaction[]; replies: Reply[] };
export type Room = { name: string; kind: 'channel' | 'dm'; description: string; unread: number; mentions: number; topic?: string; members: number; status?: string; color?: string };

const initials = (name: string) => name.split(' · ')[0]!.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function createStore() {
  const rooms = reactive<Room[]>([
    { name: 'general', kind: 'channel', description: 'The place for absolutely general things', unread: 3, mentions: 0, members: 42, topic: 'Kind questions, clear updates, no surprise meetings' },
    { name: 'deploys', kind: 'channel', description: 'Green ticks. Deep breaths.', unread: 8, mentions: 1, members: 18, topic: 'Ship small, ship often' },
    { name: 'random', kind: 'channel', description: 'Professionally off topic', unread: 2, mentions: 0, members: 39 },
    { name: 'chai-break', kind: 'channel', description: 'Our most reliable daily standup', unread: 4, mentions: 0, members: 24, topic: '4 pm, every day, no agenda' },
    { name: 'incidents', kind: 'channel', description: 'Everything is fine until it is not', unread: 1, mentions: 1, members: 15, topic: 'Calm voices, short sentences' },
    { name: 'Build Bot', kind: 'dm', description: 'Your friendly CI', unread: 0, mentions: 0, members: 2, status: 'bot', color: '#527e67' },
    { name: 'Rubber Duck', kind: 'dm', description: 'Explains your bug back to you', unread: 1, mentions: 1, members: 2, status: 'active', color: '#bd9755' },
  ]);
  const timelines = ref<Record<string, Post[]>>({});
  const loading = ref(true);
  const current = ref<string>('general');
  const thread = ref<Post | null>(null);
  const draft = ref('');
  const threadDraft = ref('');
  const typingRooms = ref<string[]>([]);
  const feed = ref<HTMLElement | null>(null);
  const followTail = ref(true);
  const query = ref('');
  const sessions = new Map(Object.entries(slackPersonas).map(([room, persona]) => [room, createChatSession({ ...persona, voiceNotes: [], photos: [], stickers: [] })]));
  let nextId = 400000;
  const later = (action: () => void, delay: number) => { window.setTimeout(action, delay); };
  const incoming = new Set<(room: string, reply: Reply) => void>();

  let loaded = false;
  async function load() {
    if (loaded) return;
    loaded = true;
    const { slackHistories } = await import('../../../phone/chat/histories-slack');
    timelines.value = Object.fromEntries(structuredClone(slackHistories).map(room => [room.name, room.messages.map(message => ({
      ...message, author: message.sender ?? 'You', initials: initials(message.sender ?? 'You'), color: message.color ?? '#657daf',
      reactions: (message.reactions ?? []).map(reaction => ({ label: reaction.emoji, count: reaction.count, selected: false })),
      replies: message.replies.map(reply => ({ ...reply, author: reply.sender ?? 'You', initials: initials(reply.sender ?? 'You'), color: reply.color ?? '#657daf' })),
    }))]));
    loading.value = false;
    void bottom(true);
  }

  const room = computed(() => rooms.find(item => item.name === current.value)!);
  const posts = computed(() => timelines.value[current.value] ?? []);
  const typing = computed(() => typingRooms.value.includes(current.value));
  const channels = computed(() => rooms.filter(item => item.kind === 'channel' && item.name.includes(query.value.toLowerCase())));
  const dms = computed(() => rooms.filter(item => item.kind === 'dm' && item.name.toLowerCase().includes(query.value.toLowerCase())));
  const people = computed(() => {
    const seen = new Map<string, string>();
    for (const post of posts.value) { if (post.author !== 'You' && !seen.has(post.author)) seen.set(post.author, post.color); for (const reply of post.replies) if (reply.author !== 'You' && !seen.has(reply.author)) seen.set(reply.author, reply.color); }
    return [...seen.entries()].slice(0, 4).map(([name, color]) => ({ name, color, initials: initials(name) }));
  });

  async function bottom(force = false) {
    await nextTick();
    if (!force && !followTail.value) return;
    followTail.value = true;
    feed.value?.scrollTo({ top: feed.value.scrollHeight, behavior: force ? 'auto' : 'smooth' });
  }
  function trackTail(event: Event) { const el = event.currentTarget as HTMLElement; followTail.value = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }
  function open(name: string) { current.value = name; thread.value = null; draft.value = ''; const entry = rooms.find(item => item.name === name); if (entry) { entry.unread = 0; entry.mentions = 0; } void bottom(true); }
  function react(reaction: Reaction) { reaction.selected = !reaction.selected; reaction.count += reaction.selected ? 1 : -1; }
  function addReaction(post: Post, label: string) {
    const existing = post.reactions.find(item => item.label === label);
    if (existing) react(existing); else post.reactions.push({ label, count: 1, selected: true });
  }

  function send(inThread = false) {
    const text = (inThread ? threadDraft.value : draft.value).trim();
    postIn(current.value, text, inThread);
  }
  /** Post into any channel or DM, open or not. */
  function postIn(name: string, text: string, inThread = false) {
    const list = timelines.value[name];
    if (!text || !list) return;
    const target = inThread ? thread.value : null;
    let post: Post;
    if (target) { target.replies.push({ id: nextId++, mine: true, author: 'You', initials: 'Y', color: '#657daf', text, time: clock(), date: 'Today' }); post = target; threadDraft.value = ''; }
    else { list.push({ id: nextId++, author: 'You', initials: 'Y', color: '#657daf', text, time: clock(), date: 'Today', reactions: [], replies: [] }); post = list.at(-1)!; draft.value = ''; }
    const session = sessions.get(name);
    if (!session) return;
    const plan = session.respond(text, new Date());
    for (const event of plan.typing) later(() => { typingRooms.value = typingRooms.value.filter(item => item !== name); if (event.active) typingRooms.value.push(name); }, event.atMs);
    const isChannel = rooms.find(item => item.name === name)?.kind === 'channel';
    const replies = isChannel || target ? plan.bubbles.slice(-2) : plan.bubbles;
    if (plan.reaction && !target) later(() => { post.reactions.push({ label: plan.reaction!.emoji, count: 1, selected: false }); }, plan.reaction.atMs);
    let botPost: Post | undefined;
    for (const bubble of replies) later(() => {
      const author = bubble.sender ?? slackPersonas[name]!.name;
      const reply: Reply = { id: nextId++, mine: false, date: 'Today', author, initials: initials(author), color: bubble.color ?? (name === 'Rubber Duck' ? '#bd9755' : '#749e8c'), text: bubble.text, time: clock() };
      if (target || isChannel) post.replies.push(reply);
      else if (botPost) botPost.replies.push(reply);
      else { list.push({ ...reply, reactions: [], replies: [] }); botPost = list.at(-1)!; }
      if (current.value === name) void bottom(); else { const entry = rooms.find(item => item.name === name); if (entry) entry.unread++; }
      incoming.forEach(listener => listener(name, reply));
    }, bubble.atMs);
    void bottom(true);
  }

  watch(current, () => { thread.value = null; });
  /** "general", "#deploys", "the duck": the closest channel or DM. */
  function findRoom(name: string) {
    const q = name.toLowerCase().replace(/^#/, '').replace(/^(?:the |my )/, '').replace(/ channel$/, '').trim();
    return rooms.find(item => item.name.toLowerCase() === q) ?? rooms.find(item => item.name.toLowerCase().includes(q) || q.includes(item.name.toLowerCase().split(' ')[0]!));
  }
  function latest(name: string, count = 3) { return (timelines.value[name] ?? []).slice(-count); }
  function onIncoming(listener: (room: string, reply: Reply) => void) { incoming.add(listener); return () => incoming.delete(listener); }
  return { load, postIn, findRoom, latest, onIncoming, rooms, room, posts, current, thread, draft, threadDraft, typing, channels, dms, people, feed, loading, query, open, send, react, addReaction, trackTail };
}

let store: ReturnType<typeof createStore> | null = null;
/** The one Slack workspace, shared by the window and by JARVIS. */
export function slack() { store ??= createStore(); return store; }
export function useSlack() { const s = slack(); onMounted(() => { void s.load(); }); return s; }
