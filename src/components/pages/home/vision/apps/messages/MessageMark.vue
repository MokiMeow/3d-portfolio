<script setup lang="ts">
const props = defineProps<{ name: string; sticker?: boolean }>();
const legacy: Record<string,string> = { '♥️': 'heart', '👍': 'like', '😂': 'laugh', '‼️': 'emphasis', '🤔': 'question', '☕': 'tea', '🦆': 'duck', '🫶': 'heart', '🎉': 'confetti', '🧠': 'idea', '✨': 'sparkle', '🍛': 'bowl', '🚀': 'rocket' };
const kind = computed(() => legacy[props.name] ?? props.name);
const paths: Record<string,string> = {
 heart:'M12 20S2 14 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 6-10 12-10 12Z',
 like:'M9 21H4V10h5m0 11V10l5-7q3-1 2 3l-1 4h6l-2 11Z',
 laugh:'M5 9q2-3 4 0m6 0q2-3 4 0M6 13h12q-1 7-6 7t-6-7Z',
 emphasis:'M8 3v12m8-12v12M8 20v1m8-1v1',
 question:'M8 7a4 4 0 1 1 8 0c0 3-4 3-4 7m0 5v1',
 tea:'M3 7h14v9q0 5-7 5t-7-5ZM17 9h2a3 3 0 0 1 0 6h-2M7 2v2m6-2v2',
 duck:'M4 13q-2 9 7 9 9 0 10-9-4 3-9 0V9q0-6 5-6 5 0 5 5l-4 3m-3-5h.1',
 confetti:'m3 21 5-14 9 9Z M12 3l1 4m5-3-2 4m6 2-5 2m3 6 2 2M5 3 3 2',
 idea:'M9 20h6M9 17q0-3-3-5a7 7 0 1 1 12 0q-3 2-3 5ZM12 5v4m-3 0 3 3 3-3',
 sparkle:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
 bowl:'M3 12h18q-1 9-9 9t-9-9ZM7 9V6m5 3V3m5 6V6',
 rocket:'M9 15 5 11q5-8 15-8 0 10-8 15l-3-3Zm5-4h.1M5 14l-3 7 7-3M6 9 3 10v4m11 4v3l3-3',
 smile:'M8 8h.1m8 0h.1M6 13q6 8 12 0',
};
</script><template><svg class="message-mark" :class="{ sticker }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle v-if="kind==='laugh'||kind==='smile'" cx="12" cy="12" r="10"/><path :d="paths[kind] ?? paths.sparkle"/></svg></template><style scoped>.message-mark{display:inline-block;width:22px;height:22px;vertical-align:middle;color:inherit}.message-mark.sticker{width:76px;height:76px;padding:12px;border-radius:24px;color:#ffdb94;background:linear-gradient(145deg,#54736b,#263e41);filter:drop-shadow(0 6px 7px #0002);stroke-width:1.8}</style>