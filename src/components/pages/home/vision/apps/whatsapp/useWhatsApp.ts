import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { createChatSession, type ReadState } from '../../../phone/chat/engine';
import { whatsappPersonas } from '../../../phone/chat/personas';
import { vote as castVote, type HistoryChat, type RichMessage } from '../../../phone/chat/histories';

/**
 * WhatsApp on the headset runs on the same conversations, people and reply engine as the phone's,
 * so a chat reads the same on both. This holds the state; WhatsApp.vue draws it for visionOS.
 */
export type Message = RichMessage & { state?: ReadState; reaction?: string; playing?: boolean; progress?: number };
export type Chat = {
  id: number; name: string; glyph: string; color: string; kind: HistoryChat['persona']; preview: string; unread: number; group: boolean;
  pinned: boolean; muted: boolean; messages: Message[]; members: HistoryChat['members']; ambient: HistoryChat['ambient'];
};

export function useWhatsApp() {
  const chats = ref<Chat[]>([]);
  const loading = ref(true);
  const selected = ref<number | null>(null);
  const draft = ref('');
  const search = ref('');
  const filter = ref<'All' | 'Unread' | 'Favourites' | 'Groups'>('All');
  const typing = ref<number[]>([]);
  const timeline = ref<HTMLElement | null>(null);
  const followTail = ref(true);
  const flashId = ref<number | null>(null);
  const sessions = new Map<number, ReturnType<typeof createChatSession>>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let nextId = 200000, disposed = false;
  const later = (action: () => void, delay: number) => { const timer = setTimeout(() => { timers.delete(timer); if (!disposed) action(); }, delay); timers.add(timer); };
  const clock = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  async function load() {
    const { whatsappHistories } = await import('../../../phone/chat/histories-whatsapp');
    if (disposed) return;
    const bases = { family: whatsappPersonas['Family HQ']!, amma: whatsappPersonas.Amma!, flat: whatsappPersonas['Bengaluru Flat Hunt']!, rent: whatsappPersonas.Landlord!, delivery: whatsappPersonas['Delivery Rider']!, dev: whatsappPersonas['The Bug Support Group']! };
    chats.value = structuredClone(whatsappHistories).map((history, id) => {
      const base = whatsappPersonas[history.name] ?? bases[history.persona];
      const persona = history.group ? { ...base, name: history.name, members: history.members.map(member => ({ ...member, replies: member.name === 'Grandma' ? Object.fromEntries(Object.keys(base.replies).map(intent => [intent, ['👍', '❤️', '🌻', '👏', '🙏']])) : base.members?.find(m => m.name.includes(member.name))?.replies ?? base.replies })) } : base;
      sessions.set(id, createChatSession(persona as Parameters<typeof createChatSession>[0]));
      const last = history.messages.at(-1);
      return {
        ...history, id, kind: history.persona, pinned: id < 2, muted: history.group && id % 3 === 2,
        preview: last ? (last.kind === 'voice' ? `Voice message · ${last.duration ?? '0:12'}` : last.kind === 'photo' ? `Photo${last.text ? ' · ' + last.text : ''}` : last.text) : '',
        unread: id % 4 === 0 ? 3 : id % 3 === 0 ? 1 : 0,
        messages: history.messages.map(message => ({ ...message, state: message.mine ? 'read' as const : undefined })),
      };
    });
    loading.value = false;
  }

  const current = computed(() => chats.value.find(chat => chat.id === selected.value));
  const visible = computed(() => {
    const q = search.value.trim().toLowerCase();
    return chats.value
      .filter(chat => !q || chat.name.toLowerCase().includes(q) || chat.messages.some(m => m.text?.toLowerCase().includes(q)))
      .filter(chat => filter.value === 'All' || (filter.value === 'Unread' ? chat.unread > 0 : filter.value === 'Groups' ? chat.group : chat.pinned))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  });
  const totalUnread = computed(() => chats.value.reduce((sum, chat) => sum + (chat.unread ? 1 : 0), 0));
  const isTyping = (id: number) => typing.value.includes(id) || ambientTyping.value === id;

  function open(chat: Chat) { selected.value = chat.id; chat.unread = 0; draft.value = ''; }
  async function bottom(force = false) {
    await nextTick();
    if (!force && !followTail.value) return;
    followTail.value = true;
    timeline.value?.scrollTo({ top: timeline.value.scrollHeight, behavior: force ? 'auto' : 'smooth' });
  }
  function trackTail(event: Event) { const el = event.currentTarget as HTMLElement; followTail.value = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }

  function send(text = draft.value.trim()) {
    const chat = current.value;
    if (!chat || !text) return;
    chat.messages.push({ id: nextId++, text, mine: true, time: clock(), date: 'Today', state: 'sent' });
    const own = chat.messages.at(-1)!;
    chat.preview = text;
    draft.value = '';
    const plan = sessions.get(chat.id)!.respond(text, new Date());
    later(() => { own.state = 'delivered'; }, plan.receipt.deliveredAt);
    later(() => { own.state = 'read'; }, plan.receipt.readAt);
    if (plan.reaction) later(() => { own.reaction = plan.reaction!.emoji; }, plan.reaction.atMs);
    for (const event of plan.typing) later(() => {
      typing.value = typing.value.filter(id => id !== chat.id);
      if (event.active) typing.value.push(chat.id);
      if (selected.value === chat.id) void bottom();
    }, event.atMs);
    for (const bubble of plan.bubbles) later(() => {
      chat.messages.push({ ...bubble, ...(bubble.sender === 'Grandma' ? { kind: 'text' as const, text: ['👍', '❤️', '🌻'][nextId % 3]! } : {}), id: nextId++, mine: false, date: 'Today',
        quote: bubble.kind === 'text' && chat.group ? { id: own.id, sender: 'You', text: own.text, color: '#25d366' } : undefined, time: clock() });
      const last = chat.messages.at(-1)!;
      chat.preview = last.kind === 'voice' ? `Voice message · ${bubble.duration}` : `${chat.group && last.sender ? last.sender + ': ' : ''}${last.text}`;
      if (selected.value !== chat.id) chat.unread++; else void bottom();
    }, bubble.atMs);
    void bottom(true);
  }

  /* Group chats carry on without you now and then. */
  const ambientTyping = ref<number | null>(null);
  let activity: ReturnType<typeof setTimeout> | undefined, autoCount = 0;
  const offsets = new Map<number, number>();
  function scheduleActivity(chat: Chat) {
    if (!chat.group || autoCount >= 6 || disposed) return;
    if (activity) clearTimeout(activity);
    activity = setTimeout(() => {
      activity = undefined;
      if (selected.value !== chat.id || disposed || document.hidden || isTyping(chat.id)) return;
      const offset = offsets.get(chat.id) ?? 0, next = chat.ambient[offset % chat.ambient.length];
      if (!next) return;
      offsets.set(chat.id, offset + 1); autoCount++;
      ambientTyping.value = chat.id;
      later(() => {
        if (ambientTyping.value === chat.id) ambientTyping.value = null;
        const member = chat.members.find(m => m.name === next.sender);
        chat.messages.push({ id: nextId++, text: next.text, sender: next.sender, color: member?.color, mine: false, date: 'Today', time: clock() });
        chat.preview = `${next.sender}: ${next.text}`;
        void bottom(); scheduleActivity(chat);
      }, 1700);
    }, 18000 + Math.random() * 18000);
  }
  watch(selected, () => { if (activity) clearTimeout(activity); if (current.value) scheduleActivity(current.value); followTail.value = true; void bottom(true); });

  const versions = new Map<number, number>();
  function playVoice(message: Message) {
    const version = (versions.get(message.id) ?? 0) + 1;
    versions.set(message.id, version);
    message.playing = !message.playing;
    if (!message.playing) return;
    if ((message.progress ?? 0) >= 1) message.progress = 0;
    const seconds = Number(message.duration?.split(':')[1] ?? 14) || 14;
    const advance = () => {
      if (!message.playing || versions.get(message.id) !== version) return;
      message.progress = Math.min(1, (message.progress ?? 0) + .1 / seconds);
      if (message.progress >= 1) message.playing = false; else later(advance, 100);
    };
    later(advance, 100);
  }
  function vote(message: Message, index: number) { castVote(message, index); }
  function react(message: Message, emoji: string) {
    const reactions = message.reactions ?? (message.reactions = []);
    const mine = reactions.find(item => item.selected);
    if (mine) { mine.count--; mine.selected = false; if (!mine.count) reactions.splice(reactions.indexOf(mine), 1); if (mine.emoji === emoji) return; }
    const existing = reactions.find(item => item.emoji === emoji);
    if (existing) { existing.count++; existing.selected = true; } else reactions.push({ emoji, count: 1, selected: true });
  }
  function jumpTo(id: number) {
    const target = timeline.value?.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    followTail.value = false;
    flashId.value = id;
    later(() => { if (flashId.value === id) flashId.value = null; }, 1500);
  }

  onMounted(() => { void load(); });
  onBeforeUnmount(() => { disposed = true; timers.forEach(clearTimeout); if (activity) clearTimeout(activity); });
  return { chats, loading, selected, current, visible, draft, search, filter, typing, isTyping, timeline, followTail, flashId, totalUnread, open, send, trackTail, playVoice, vote, react, jumpTo, bottom };
}
