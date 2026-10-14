<script setup lang="ts">
import { vHover } from '../../kit/hover';
import AppIcon from '../music/AppIcon.vue';
import { HOME, runCommand } from './model';

defineProps<{ seconds: number }>();
const emit = defineEmits<{ exit: [] }>();
const cwd = ref(HOME);
const input = ref('');
const history = ref<string[]>([]);
const historyAt = ref(0);
const draft = ref('');
const output = ref('chai-shell 1.0\nA local simulation. Type help to look around.\n');
const body = ref<HTMLElement | null>(null);

async function submit(seconds: number): Promise<void> {
  const command = input.value;
  const result = runCommand(command.trim(), cwd.value, seconds);
  if (command.trim()) history.value = [...history.value, command].slice(-100);
  historyAt.value = history.value.length;
  input.value = '';
  draft.value = '';
  output.value = result.clear ? '' : output.value + '\n' + cwd.value.replace(HOME, '~') + ' % ' + command + '\n' + result.text + '\n';
  output.value = output.value.slice(-100000);
  if (result.cwd) cwd.value = result.cwd;
  if (result.exit) emit('exit');
  await nextTick();
  if (body.value) body.value.scrollTop = body.value.scrollHeight;
}
function recall(event: KeyboardEvent): void {
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  if (historyAt.value === history.value.length) draft.value = input.value;
  historyAt.value = Math.max(0, Math.min(history.value.length, historyAt.value + (event.key === 'ArrowUp' ? -1 : 1)));
  input.value = history.value[historyAt.value] ?? draft.value;
}
</script>

<template>
  <section class="terminal-content">
    <div ref="body" class="terminal-output vk-scroll" role="log" aria-label="Terminal output">
      <pre>{{ output }}</pre>
    </div>
    <form class="prompt" @submit.prevent="submit(seconds)">
      <span aria-hidden="true">%</span>
      <input v-model="input" v-hover maxlength="2000" class="vk-field" aria-label="Terminal command" autocomplete="off" spellcheck="false" @keydown="recall" />
      <button v-hover class="vk-icon" type="submit" aria-label="Run command"><AppIcon name="enter" /></button>
    </form>
  </section>
</template>

<style scoped>
.terminal-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #17221f;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #c5ebd4;
}
.terminal-content :deep(*) { font-family: inherit; box-sizing: border-box; }
.terminal-output { flex: 1; min-height: 0; padding: 12px 18px; }
pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.65; }
.prompt { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #ffffff09; }
.prompt input { min-width: 0; }
button { border: 0; cursor: pointer; }
:focus-visible { outline: 2px solid white; outline-offset: -2px; }
</style>
