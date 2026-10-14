<script setup lang="ts">
import { PROJECTS } from "~/static/projects.static";
const input = ref("");
const output = ref([
	"MOHITH LAB · LOCAL TERMINAL",
	"No server. No shell access. Just a few good commands.",
	"",
	"Type help to look around.",
]);
const screen = ref<HTMLElement>();
const run = async (command = input.value) => {
	const text = command.trim();
	if (!text) return;
	output.value.push(`mohith@lab ~ % ${text}`);
	const key = text.toLowerCase();
	if (key === "clear") output.value = [];
	else if (key === "help")
		output.value.push(
			"whoami     meet the person at this desk",
			"projects   what's shipping",
			"coffee     request additional RAM",
			"status     lab diagnostics",
			"fortune    advice of questionable value",
			"clear      clean the screen",
		);
	else if (key === "whoami")
		output.value.push(
			"Sai Mohith S",
			"Full-stack developer. Builder of systems. Collector of side quests.",
			"github.com/MokiMeow",
		);
	else if (key === "projects" || key === "ls")
		output.value.push(
			...PROJECTS.map((project) => `→ ${project.title}  /  ${project.url}`),
		);
	else if (key === "coffee")
		output.value.push(
			"[████████████████████] 100%",
			"Coffee installed. Sleep dependency unresolved.",
		);
	else if (key === "status")
		output.value.push(
			"curiosity      RUNNING",
			"ideas          OVERFLOW",
			"browser tabs   PREFER NOT TO SAY",
			"vibes          NOMINAL",
		);
	else if (key === "fortune")
		output.value.push(
			"The bug is always in the part you said was definitely fine.",
		);
	else if (key === "sudo make me a sandwich") output.value.push("Okay. 🥪");
	else if (key === "rm -rf /")
		output.value.push(
			"Nice try. This desk has trust issues and no filesystem.",
		);
	else output.value.push(`Command not found: ${text.slice(0, 80)}. Try help.`);
	input.value = "";
	if (output.value.length > 100)
		output.value.splice(0, output.value.length - 100);
	await nextTick();
	screen.value?.scrollTo({
		top: screen.value.scrollHeight,
		behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
			? "instant"
			: "smooth",
	});
};

// Format existing output without changing commands or stored history.
const promptPrefix = "mohith@lab ~ % ";
const lineParts = (line: string): { text: string; href?: string }[] => {
  const parts: { text: string; href?: string }[] = [];
  const links = /(?:https?:\/\/|github\.com\/)[^\s]+/g;
  let cursor = 0;
  for (const match of line.matchAll(links)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ text: line.slice(cursor, start) });
    const text = match[0];
    parts.push({ text, href: text.startsWith("github.com/") ? "https://" + text : text });
    cursor = start + text.length;
  }
  if (cursor < line.length) parts.push({ text: line.slice(cursor) });
  return parts.length ? parts : [{ text: "\u00a0" }];
};
</script>
<template>
  <div class="terminal-body">
    <div class="terminal-title">
      <span class="traffic-lights" aria-hidden="true"><i /><i /><i /></span>
      <p>mohith@pocket-lab: ~</p>
      <small>LOCAL</small>
    </div>
    <div class="terminal-tabs" aria-hidden="true"><span><svg viewBox="0 0 24 24"><path d="m5 7 5 5-5 5M13 17h6" /></svg>zsh-ish <i></i></span><small>01 / local session</small></div>
    <div ref="screen" class="terminal-screen" role="log" aria-live="polite" aria-label="Local terminal output" tabindex="0">
      <div v-for="(line, i) in output" :key="i" :class="{ prompt: line.startsWith(promptPrefix), 'terminal-error': line.startsWith('Command not found:'), 'terminal-hint': line === 'No server. No shell access. Just a few good commands.' || line === 'Type help to look around.' || /^(whoami|projects|coffee|status|fortune|clear)\s/.test(line), 'terminal-warn': line.includes('OVERFLOW') || line.includes('unresolved'), 'terminal-banner': line === 'MOHITH LAB · LOCAL TERMINAL' }">
        <template v-if="line.startsWith(promptPrefix)"><span class="prompt-user">mohith@lab</span> <span class="prompt-path">~</span> <span class="prompt-mark">❯</span> {{ line.slice(promptPrefix.length) }}</template>
        <template v-else><template v-for="(part, index) in lineParts(line)" :key="index"><a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a><template v-else>{{ part.text }}</template></template></template>
      </div>
    </div>
    <form @submit.prevent="run()">
      <span class="input-prompt" aria-hidden="true"><span class="prompt-user">mohith@lab</span> <span class="prompt-path">~</span> <span class="prompt-mark">❯</span></span>
      <label class="sr-only" for="lab-command">Terminal command</label>
      <div class="terminal-input">
        <input id="lab-command" v-model="input" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="120" placeholder="help" />
        <span v-if="!input" class="terminal-caret" aria-hidden="true"></span>
      </div>
      <button type="submit" aria-label="Run local command"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 5v9H5m0 0 5-5m-5 5 5 5" /></svg></button>
    </form>
    <div class="terminal-quick">
      <button type="button" @click="run('help')">help</button>
      <button type="button" @click="run('projects')">projects</button>
      <button type="button" @click="run('coffee')">coffee</button>
      <span>Nothing here executes on your machine.</span>
    </div>
  </div>
</template>
<style scoped>
.terminal-body {
  --terminal-bg: rgb(13 17 23 / .92);
  --terminal-fg: #e6edf3;
  --terminal-dim: #97a5b5;
  --terminal-prompt: #10b981;
  --terminal-path: #7dd3fc;
  --terminal-accent: #f5c97b;
  --terminal-error: #fb7185;
  --terminal-selection: rgb(125 211 252 / .24);
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-sizing: border-box;
  width: min(760px, calc(100vw - 32px));
  max-width: 100%;
  max-height: calc(var(--visual-height, 100dvh) - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / .08);
  border-radius: 16px;
  background: var(--terminal-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow: 0 32px 80px rgb(0 0 0 / .4), inset 0 1px 0 rgb(255 255 255 / .03);
  color: var(--terminal-fg);
  font-family: ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace;
  color-scheme: dark;
}
.terminal-body :deep(*) { font-family: inherit; }
.terminal-body :deep(::selection) { background: var(--terminal-selection); color: var(--terminal-fg); }
.terminal-title { display: grid; grid-template-columns: 60px minmax(0, 1fr) 60px; align-items: center; flex-shrink: 0; gap: 12px; height: 48px; padding: 0 20px; border-bottom: 1px solid rgb(255 255 255 / .06); background: rgb(255 255 255 / .025); }
.traffic-lights { display: flex; gap: 8px; }
.traffic-lights i { width: 10px; height: 10px; border-radius: 50%; background: #34c884; box-shadow: inset 0 0 0 1px rgb(0 0 0 / .16); }
.traffic-lights i:first-child { background: #fb7185; }
.traffic-lights i:nth-child(2) { background: #f5c97b; }
.terminal-title p { margin: 0; text-align: center; color: var(--terminal-dim); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.terminal-title small { text-align: right; font-size: 9px; letter-spacing: .12em; color: var(--terminal-prompt); }
.terminal-tabs { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; height: 40px; padding: 0 16px; border-bottom: 1px solid rgb(255 255 255 / .08); background: rgb(0 0 0 / .12); }
.terminal-tabs > span { display: flex; align-items: center; gap: 8px; align-self: stretch; padding: 0 12px; border-right: 1px solid rgb(255 255 255 / .06); border-left: 1px solid rgb(255 255 255 / .06); border-bottom: 2px solid var(--terminal-prompt); color: var(--terminal-fg); font-size: 11px; background: rgb(255 255 255 / .025); }
.terminal-tabs i { width: 4px; height: 4px; border-radius: 50%; background: var(--terminal-prompt); }
.terminal-tabs small { color: var(--terminal-dim); font-size: 10px; }
.terminal-body svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.terminal-screen { flex: 1 1 340px; min-height: 0; height: min(340px, 45dvh); overflow: auto; overscroll-behavior: contain; padding: 24px; font-size: 13px; line-height: 1.85; white-space: pre-wrap; overflow-wrap: anywhere; scrollbar-width: thin; scrollbar-color: #394756 transparent; scroll-behavior: smooth; }
.terminal-screen .prompt { margin-top: 16px; color: var(--terminal-fg); }
.prompt-user, .prompt-mark { color: var(--terminal-prompt); }
.prompt-path { color: var(--terminal-path); }
.terminal-screen .terminal-hint { color: var(--terminal-dim); }
.terminal-screen .terminal-error { color: var(--terminal-error); }
.terminal-screen .terminal-warn { color: var(--terminal-accent); }
.terminal-screen .terminal-banner { margin-bottom: 4px; color: var(--terminal-accent); letter-spacing: .04em; }
.terminal-screen a { color: var(--terminal-path); text-decoration: underline; text-underline-offset: 3px; }
.terminal-body form { display: flex; align-items: center; gap: 12px; flex-shrink: 0; padding: 8px 16px 8px 24px; border-top: 1px solid rgb(255 255 255 / .08); background: rgb(0 0 0 / .1); }
.input-prompt { flex-shrink: 0; font-size: 13px; white-space: pre; }
.terminal-input { position: relative; flex: 1; min-width: 0; }
.terminal-body input { display: block; width: 100%; min-width: 0; min-height: 44px; padding: 8px 0; border: 0; border-radius: 4px; outline: none; color: var(--terminal-fg); background: transparent; font-size: 16px; line-height: 1.5; caret-color: var(--terminal-prompt); }
.terminal-body input::placeholder { color: var(--terminal-dim); }
.terminal-caret { display: none; position: absolute; top: 12px; left: 0; width: 9px; height: 20px; background: var(--terminal-prompt); pointer-events: none; animation: caret-blink 1s step-end infinite; }
.terminal-input:focus-within .terminal-caret { display: block; }
.terminal-input:focus-within input:placeholder-shown { caret-color: transparent; }
.terminal-body button { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; flex-shrink: 0; cursor: pointer; color: var(--terminal-dim); background: transparent; border: 1px solid rgb(255 255 255 / .1); border-radius: 8px; transition: background 180ms ease-out, color 180ms ease-out, transform 180ms ease-out; }
.terminal-body form button { width: 44px; color: var(--terminal-prompt); }
.terminal-body button:hover { color: var(--terminal-fg); background: rgb(255 255 255 / .06); }
.terminal-body button:active { transform: scale(.96); }
.terminal-body button:focus-visible, .terminal-body input:focus-visible, .terminal-screen:focus-visible, .terminal-screen a:focus-visible { outline: 2px solid var(--terminal-prompt); outline-offset: 3px; }
.terminal-quick { display: flex; flex-wrap: wrap; align-items: center; flex-shrink: 0; gap: 8px; padding: 0 24px max(16px, env(safe-area-inset-bottom)); }
.terminal-quick button { padding: 0 12px; font-size: 11px; }
.terminal-quick > span { margin-left: auto; color: var(--terminal-dim); font-size: 10px; line-height: 1.6; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@keyframes caret-blink { 50% { opacity: 0; } }
@media (max-width: 600px) {
  .terminal-screen { padding: 20px; font-size: 12px; }
  .terminal-body form { padding-left: 20px; gap: 8px; }
  .input-prompt .prompt-user { display: none; }
  .terminal-quick { padding-left: 20px; padding-right: 20px; }
  .terminal-quick > span { width: 100%; margin-left: 0; }
}
@media (max-width: 360px) {
  .terminal-title { padding: 0 12px; gap: 8px; grid-template-columns: 48px minmax(0, 1fr) 36px; }
  .terminal-title p { font-size: 9px; }
  .traffic-lights { gap: 6px; }
  .terminal-screen { padding: 16px; }
  .terminal-tabs small { display: none; }
}
@media (max-height: 500px) {
  .terminal-quick { display: none; }
  .terminal-title { height: 32px; }
  .terminal-tabs { height: 32px; }
  .terminal-screen { padding-top: 12px; padding-bottom: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .terminal-caret { animation: none; }
  .terminal-screen { scroll-behavior: auto; }
  .terminal-body button { transition: none; }
  .terminal-body button:active { transform: none; }
}
</style>
