import { VISION } from '../../vision';
import { createConversations, photos, reactions, stickers, waveform } from './data';
import type { Conversation, Effect, Message } from './types';
export function useMessages() {
    const vision = inject(VISION, undefined);
    const seededChats = createConversations();
    const fallbackChat = seededChats[0];
    const conversations = ref<Conversation[]>(seededChats);
    const selectedId = ref(4);
    const current = computed(() => conversations.value.find(chat => chat.id === selectedId.value) ?? fallbackChat);
    const search = ref('');
    const filter = ref<'all' | 'unread'>('all');
    const visibleChats = computed(() => {
        const query = search.value.trim().toLowerCase();
        return conversations.value
            .filter(chat => {
                const text = chat.name + ' ' + chat.messages.map(message => message.text).join(' ');
                const matchesSearch = !query || text.toLowerCase().includes(query);
                return matchesSearch && (filter.value !== 'unread' || chat.unread > 0);
            })
            .sort((a, b) => Number(b.pinned) - Number(a.pinned));
    });
    const showThread = ref(false);
    const narrow = ref(false);
    const callModal = ref(true);
    const modalOpen = computed(() => !!(menuMessage.value || newChat.value || photoPreview.value || linkPreview.value));
    let sizeObserver: ResizeObserver | undefined;
    let dialogFocus: HTMLElement | undefined;
    const composer = ref('');
    const drafts = new Map<number, string>();
    const replying = ref<Message>();
    const editing = ref<Message>();
    const effect = ref<Effect>('none');
    const tool = ref<'attachments' | 'emoji' | 'effects'>();
    const details = ref(false);
    const newChat = ref(false);
    const recipients = ref<string[]>([]);
    const groupName = ref('');
    const menuMessage = ref<Message>();
    const photoPreview = ref<string>();
    const linkPreview = ref<string>();
    const notice = ref('');
    const bubbles = ref<HTMLElement>();
    const composerInput = ref<HTMLInputElement>();
    const root = ref<HTMLElement>();
    const pending = ref<Record<number, number>>({});
    const revision = ref(0);
    const typing = computed(() => (pending.value[selectedId.value] ?? 0) > 0);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const responseTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const replyCounts = new Map<number, number>();
    let nextId = 30;
    let nextChatId = 5;
    let alive = true;
    let pressedMessageId: number | undefined;
    let pressTimer: ReturnType<typeof setTimeout> | undefined;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    let effectTimer: ReturnType<typeof setTimeout> | undefined;
    const screenEffect = ref<'confetti' | 'lasers'>();
    const effects: {
        id: Effect;
        name: string;
        line: string;
    }[] = [
        { id: 'none', name: 'Standard', line: 'A perfectly reasonable bubble.' },
        { id: 'slam', name: 'Slam', line: 'Arrives with conviction.' },
        { id: 'loud', name: 'Loud', line: 'For the last tiny change.' },
        { id: 'ink', name: 'Invisible ink', line: 'Touch, hover or focus to reveal.' },
        { id: 'confetti', name: 'Confetti', line: 'A small celebration everywhere.' },
        { id: 'lasers', name: 'Lasers', line: 'The build has entered a disco.' },
    ];
    function later(callback: () => void, delay: number) {
        const timer = setTimeout(() => {
            timers.delete(timer);
            if (alive)
                callback();
        }, delay);
        timers.add(timer);
        return timer;
    }
    function cancel(timer?: ReturnType<typeof setTimeout>) {
        if (timer) {
            clearTimeout(timer);
            timers.delete(timer);
        }
    }
    function feedback(text: string) { notice.value = text; cancel(noticeTimer); noticeTimer = later(() => { notice.value = ''; }, 3500); }
    function timestamp() { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()); }
    function summary(message?: Message) {
        if (!message) return 'Start a conversation';
        if (message.unsent) return 'Message unsent';
        if (message.sticker) return message.sticker + ' Sticker';
        if (message.photo) return 'Photo · ' + message.text;
        if (message.audio) return 'Audio message';
        return message.text;
    }
    function choose(id: number) {
        if (!conversations.value.some(chat => chat.id === id)) return;
        if (editing.value) cancelEdit();
        drafts.set(selectedId.value, composer.value);
        selectedId.value = id;
        composer.value = drafts.get(id) ?? '';
        current.value.unread = 0;
        replying.value = undefined;
        editing.value = undefined;
        tool.value = undefined;
        menuMessage.value = undefined;
        details.value = false;
        showThread.value = true;
        stopAudio();
    }
    function back() {
        if (editing.value) cancelEdit();
        drafts.set(selectedId.value, composer.value);
        showThread.value = false;
        details.value = false;
        tool.value = undefined;
        menuMessage.value = undefined;
        stopAudio();
        void nextTick(() => {
            if (alive) root.value?.querySelector<HTMLButtonElement>('[data-chat][aria-pressed="true"]')?.focus();
        });
    }
    function collectionKeys(event: KeyboardEvent) {
        const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
        if (!keys.includes(event.key))
            return;
        const controls = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[data-chat]'));
        const index = controls.indexOf(event.target as HTMLButtonElement);
        if (index < 0 || !controls.length)
            return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length;
        controls[next]?.focus();
    }
    function replyFor(chat: Conversation, text: string) {
        const words = text.toLowerCase().split(/[^a-z]+/);
        const match = chat.rules.find(rule => rule.terms.some(term => words.includes(term)));
        const count = replyCounts.get(chat.id) ?? 0;
        replyCounts.set(chat.id, count + 1);
        return match?.reply ?? chat.fallback[count % chat.fallback.length] ?? 'A short break might help.';
    }
    function launchEffect(value: Effect) {
        if (value !== 'confetti' && value !== 'lasers')
            return;
        cancel(effectTimer);
        screenEffect.value = value;
        effectTimer = later(() => { screenEffect.value = undefined; }, 2600);
    }
    function send(attachment?: Partial<Message>) {
        const text = composer.value.trim();
        if (!text && !attachment)
            return;
        if (editing.value) {
            editing.value.text = text;
            editing.value.edited = true;
            editing.value = undefined;
            composer.value = drafts.get(selectedId.value) ?? '';
            revision.value++;
            void nextTick(() => { if (alive) composerInput.value?.focus(); });
            return;
        }
        const chat = current.value;
        followLatest.value = true;
        const message: Message = {
            id: nextId++,
            text,
            mine: true,
            time: timestamp(),
            status: 'delivered',
            effect: effect.value,
            ...attachment
        };
        if (replying.value)
            message.reply = {
                id: replying.value.id,
                text: summary(replying.value),
                sender: replying.value.mine ? 'You' : replying.value.sender ?? chat.name
            };
        chat.messages.push(message);
        composer.value = '';
        drafts.delete(chat.id);
        replying.value = undefined;
        tool.value = undefined;
        launchEffect(effect.value);
        effect.value = 'none';
        revision.value++;
        pending.value[chat.id] = (pending.value[chat.id] ?? 0) + 1;
        const response = replyFor(chat, text || attachment?.text || attachment?.sticker || 'hello');
        const namedResponder = response.match(/^(Build Bot|Rubber Duck|Amma): /)?.[1];
        const memberIndex = (replyCounts.get(chat.id) ?? 1) % chat.members.length;
        const responder = namedResponder ?? (chat.members.length > 1 ? chat.members[memberIndex] : undefined);
        const timer = later(() => {
            responseTimers.delete(message.id);
            pending.value[chat.id] = Math.max(0, (pending.value[chat.id] ?? 1) - 1);
            message.status = 'read';
            chat.messages.push({
                id: nextId++,
                text: response.replace(/^(Build Bot|Rubber Duck|Amma): /, ''),
                mine: false,
                time: timestamp(),
                sender: responder
            });
            if (selectedId.value !== chat.id || (narrow.value && !showThread.value)) {
                chat.unread++;
                if (!chat.muted) {
                    const excerpt = response.slice(0, 90) + (response.length > 90 ? '…' : '');
                    feedback(chat.name + ' replied: ' + excerpt);
                }
            }
            revision.value++;
        }, 1500 + Math.min(900, text.length * 10));
        responseTimers.set(message.id, timer);
    }
    function openMenu(message: Message) {
        cancelPress();
        if (!message.unsent) {
            menuMessage.value = message;
            tool.value = undefined;
        }
    }
    function startPress(message: Message, event: PointerEvent) {
        if (event.button !== 0)
            return;
        cancelPress();
        pressedMessageId = undefined;
        pressTimer = later(() => {
            pressedMessageId = message.id;
            openMenu(message);
        }, 520);
    }
    function activateMessage(message: Message) {
        if (pressedMessageId === message.id) {
            pressedMessageId = undefined;
            return;
        }
        if (message.photo) photoPreview.value = message.photo;
        else if (message.effect === 'ink') message.revealed = true;
        else openMenu(message);
    }
    function cancelPress() { cancel(pressTimer); pressTimer = undefined; }
    function react(emoji: string) {
        if (!menuMessage.value)
            return;
        menuMessage.value.reaction = menuMessage.value.reaction === emoji ? undefined : emoji;
        menuMessage.value = undefined;
    }
    function replyTo() { replying.value = menuMessage.value; menuMessage.value = undefined; nextTick(() => { if (alive) composerInput.value?.focus(); }); }
    function editMessage() {
        if (!menuMessage.value?.mine || menuMessage.value.audio || menuMessage.value.photo || menuMessage.value.sticker)
            return;
        drafts.set(selectedId.value, composer.value);
        editing.value = menuMessage.value;
        composer.value = menuMessage.value.text;
        replying.value = undefined;
        menuMessage.value = undefined;
        nextTick(() => composerInput.value?.focus());
    }
    function cancelEdit() { editing.value = undefined; composer.value = drafts.get(selectedId.value) ?? ''; }
    function unsend() {
        const message = menuMessage.value;
        if (!message?.mine)
            return;
        const timer = responseTimers.get(message.id);
        if (timer) {
            cancel(timer);
            responseTimers.delete(message.id);
            pending.value[selectedId.value] = Math.max(0, (pending.value[selectedId.value] ?? 1) - 1);
        }
        if (playingId.value === message.id)
            stopAudio();
        message.unsent = true;
        message.text = '';
        message.reaction = undefined;
        message.photo = undefined;
        message.audio = false;
        message.sticker = undefined;
        menuMessage.value = undefined;
        revision.value++;
    }
    function jumpToReply(id: number) {
        const element = root.value?.querySelector<HTMLElement>('[data-message="' + id + '"]');
        element?.scrollIntoView({ block: 'center', behavior: 'auto' });
        element?.querySelector<HTMLButtonElement>('.message-text')?.focus();
    }
    function urlIn(text: string) { return text.match(/https?:\/\/[^\s]+/)?.[0]; }
    function linkTitle(url?: string) {
        if (!url) return 'Shared link';
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        }
        catch {
            return 'Shared link';
        }
    }
    function toggleRecipient(name: string) { recipients.value = recipients.value.includes(name) ? recipients.value.filter(item => item !== name) : [...recipients.value, name]; }
    function createChat() {
        if (!recipients.value.length)
            return;
        if (recipients.value.length === 1) {
            const existing = conversations.value.find(chat => chat.members.length === 1 && chat.members[0] === recipients.value[0]);
            if (existing) {
                choose(existing.id);
                newChat.value = false;
                recipients.value = [];
                return;
            }
        }
        const chat: Conversation = {
            id: nextChatId++,
            name: groupName.value.trim() || recipients.value.join(', '),
            glyph: '☕',
            tint: '#a6d9ba',
            description: recipients.value.length + ' participants · fresh cups, fresh bugs',
            members: [...recipients.value],
            pinned: false,
            unread: 0,
            muted: false,
            rules: [],
            fallback: [
                'The group agrees: a short break and a fresh cup of chai would help.', 'Rubber Duck is listening. Build Bot is compiling a reassuring response.'
            ],
            messages: [
                {
                    id: nextId++,
                    mine: false,
                    time: timestamp(),
                    text: 'A fresh conversation. Please leave enough room for chai.',
                    sender: recipients.value[0]
                }
            ]
        };
        conversations.value.push(chat);
        choose(chat.id);
        newChat.value = false;
        recipients.value = [];
        groupName.value = '';
    }
    function closeSheets() { menuMessage.value = undefined; newChat.value = false; photoPreview.value = undefined; linkPreview.value = undefined; }
    function trapFocus(event: KeyboardEvent) {
        if (event.key !== 'Tab')
            return;
        const controls = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], [tabindex="0"]'));
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
        }
    }
    watch([menuMessage, newChat, photoPreview, linkPreview], async (values, previous) => {
        const opened = values.some(Boolean), wasOpen = previous.some(Boolean);
        if (opened && !wasOpen)
            dialogFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        await nextTick();
        if (!alive) return;
        if (opened)
            root.value?.querySelector<HTMLElement>('.modal [data-first]')?.focus();
        else if (wasOpen && dialogFocus?.isConnected)
            dialogFocus.focus();
    });
    const followLatest = ref(true);
    function trackScroll() {
        const element = bubbles.value;
        if (element) followLatest.value = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
    }
    async function scrollToLatest() {
        followLatest.value = true;
        await nextTick();
        if (alive && bubbles.value) bubbles.value.scrollTop = bubbles.value.scrollHeight;
    }
    watch([selectedId, showThread], () => { void scrollToLatest(); });
    watch([revision, pending], async () => {
        const shouldFollow = followLatest.value;
        await nextTick();
        if (alive && shouldFollow && bubbles.value) bubbles.value.scrollTop = bubbles.value.scrollHeight;
    }, { deep: true });
    let panelFocus: HTMLElement | undefined;
    watch([details, tool], async (values, previous) => {
        const opened = values.some(Boolean);
        if (opened && !previous.some(Boolean)) {
            panelFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        }
        await nextTick();
        if (!alive || modalOpen.value || call.value) return;
        if (opened) root.value?.querySelector<HTMLElement>(details.value ? '.details button' : '.composer-tools button')?.focus();
        else if (panelFocus?.isConnected) panelFocus.focus();
    });
    function panelKeys(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            event.stopPropagation();
            event.preventDefault();
            details.value = false;
            tool.value = undefined;
        } else trapFocus(event);
    }
    onMounted(() => {
        void scrollToLatest();
        if (root.value) {
            narrow.value = root.value.clientWidth <= 650;
            callModal.value = root.value.clientWidth < 900;
            if (typeof ResizeObserver !== 'undefined') {
                sizeObserver = new ResizeObserver(entries => {
                    const width = entries[0]?.contentRect.width ?? 900;
                    narrow.value = width <= 650;
                    callModal.value = width < 900;
                });
                sizeObserver.observe(root.value);
            }
        }
    });
    const playingId = ref<number>();
    const audioProgress = ref(0);
    let playbackGeneration = 0;
    let playbackTimer: ReturnType<typeof setInterval> | undefined;
    let audioContext: AudioContext | undefined;
    let oscillator: OscillatorNode | undefined;
    let gainNode: GainNode | undefined;
    function stopAudio() {
        playbackGeneration++;
        if (playbackTimer) clearInterval(playbackTimer);
        playbackTimer = undefined;
        try { oscillator?.stop(); } catch { /* The source may already have stopped. */ }
        try { oscillator?.disconnect(); } catch { /* Release the remaining nodes independently. */ }
        try { gainNode?.disconnect(); } catch { /* The context may already be closed. */ }
        oscillator = undefined;
        gainNode = undefined;
        playingId.value = undefined;
        audioProgress.value = 0;
    }
    async function playAudio(message: Message) {
        if (playingId.value === message.id) {
            stopAudio();
            return;
        }
        stopAudio();
        const generation = playbackGeneration;
        playingId.value = message.id;
        const start = Date.now();
        playbackTimer = setInterval(() => {
            audioProgress.value = Math.min(1, (Date.now() - start) / 6000);
            if (audioProgress.value >= 1)
                stopAudio();
        }, 80);
        try {
            const Context = window.AudioContext ?? (window as typeof window & {
                webkitAudioContext?: typeof AudioContext;
            }).webkitAudioContext;
            if (!Context) {
                feedback('Audio progress is playing. Sound is unavailable here.');
                return;
            }
            audioContext ??= new Context();
            await audioContext.resume();
            if (!alive || generation !== playbackGeneration || playingId.value !== message.id)
                return;
            oscillator = audioContext.createOscillator();
            gainNode = audioContext.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.value = 180;
            gainNode.gain.value = 0;
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            const now = audioContext.currentTime;
            for (let i = 0; i < 10; i++) {
                const t = now + i * .6;
                oscillator.frequency.setValueAtTime(220 + (i % 3) * 45, t);
                oscillator.frequency.exponentialRampToValueAtTime(110, t + .22);
                gainNode.gain.setValueAtTime(0, t);
                gainNode.gain.linearRampToValueAtTime(.055, t + .035);
                gainNode.gain.linearRampToValueAtTime(0, t + .25);
            }
            oscillator.start();
        }
        catch {
            if (alive && generation === playbackGeneration)
                feedback('Audio progress is playing. Sound is unavailable here.');
        }
    }
    const call = ref(false);
    const callName = ref('');
    const muted = ref(false);
    const callSeconds = ref(0);
    let callTimer: ReturnType<typeof setInterval> | undefined;
    let callTrigger: HTMLElement | undefined;
    function startCall() {
        if (call.value) {
            root.value?.querySelector<HTMLButtonElement>('.end-call')?.focus();
            return;
        }
        callTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        closeSheets();
        tool.value = undefined;
        stopAudio();
        call.value = true;
        callName.value = current.value.name;
        muted.value = false;
        callSeconds.value = 0;
        details.value = false;
        if (callTimer)
            clearInterval(callTimer);
        callTimer = setInterval(() => { callSeconds.value++; }, 1000);
        void nextTick(() => { if (alive) root.value?.querySelector<HTMLButtonElement>('.end-call')?.focus(); });
    }
    function endCall() {
        call.value = false;
        if (callTimer)
            clearInterval(callTimer);
        callTimer = undefined;
        void nextTick(() => { if (alive && callTrigger?.isConnected) callTrigger.focus(); });
    }
    function callTime() { return Math.floor(callSeconds.value / 60) + ':' + String(callSeconds.value % 60).padStart(2, '0'); }
    onBeforeUnmount(() => {
        alive = false;
        sizeObserver?.disconnect();
        for (const timer of timers)
            clearTimeout(timer);
        timers.clear();
        responseTimers.clear();
        stopAudio();
        endCall();
        if (audioContext)
            void audioContext.close().catch(() => { });
    });
    return {
        vision,
        modalOpen,
        callModal,
        followLatest,
        trackScroll,
        scrollToLatest,
        panelKeys,
        conversations,
        selectedId,
        current,
        search,
        filter,
        visibleChats,
        showThread,
        composer,
        replying,
        editing,
        effect,
        tool,
        details,
        newChat,
        recipients,
        groupName,
        menuMessage,
        photoPreview,
        linkPreview,
        notice,
        bubbles,
        composerInput,
        root,
        pending,
        typing,
        screenEffect,
        effects,
        summary,
        choose,
        back,
        collectionKeys,
        send,
        openMenu,
        startPress,
        cancelPress,
        activateMessage,
        react,
        replyTo,
        editMessage,
        cancelEdit,
        unsend,
        jumpToReply,
        urlIn,
        linkTitle,
        toggleRecipient,
        createChat,
        closeSheets,
        trapFocus,
        playingId,
        audioProgress,
        playAudio,
        call,
        callName,
        muted,
        startCall,
        endCall,
        callTime,
        launchEffect,
        feedback,
        photos,
        reactions,
        stickers,
        waveform
    };
}
