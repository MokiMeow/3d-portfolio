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
	screen.value?.scrollTo({ top: screen.value.scrollHeight });
};
</script>
<template>
	<div class="terminal-body">
		<div class="terminal-title">
			<span><i /><i /><i /></span>
			<p>pocket-terminal / zsh-ish</p>
			<small>LOCAL</small>
		</div>
		<div ref="screen" class="terminal-screen" role="log" aria-live="polite">
			<div
				v-for="(line, i) in output"
				:key="i"
				:class="{ prompt: line.startsWith('mohith@') }"
			>
				{{ line || "\u00a0" }}
			</div>
		</div>
		<form @submit.prevent="run()">
			<span aria-hidden="true">❯</span
			><label class="sr-only" for="lab-command">Terminal command</label
			><input
				id="lab-command"
				v-model="input"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				maxlength="120"
				placeholder="help"
			/><button aria-label="Run local command">↵</button>
		</form>
		<div class="terminal-quick">
			<button @click="run('help')">help</button
			><button @click="run('projects')">projects</button
			><button @click="run('coffee')">coffee</button
			><span>Nothing here executes on your machine.</span>
		</div>
	</div>
</template>
<style scoped>
.terminal-body {
	width: min(620px, calc(100vw - 36px));
	border: 1px solid #444b46;
	border-radius: 13px;
	background: #121815;
	box-shadow: 0 30px 90px #0009;
	color: #bbd3be;
	overflow: hidden;
	font-family: "Cascadia Code", Consolas, monospace;
}
.terminal-title {
	height: 44px;
	background: #222b25;
	border-bottom: 1px solid #ffffff10;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 18px;
	gap: 16px;
	font-size: 10px;
	color: #b8c0ba;
}
.terminal-title > span {
	display: flex;
	gap: 6px;
}
.terminal-title i {
	width: 7px;
	height: 7px;
	border-radius: 50%;
	background: #626e65;
}
.terminal-title i:first-child {
	background: #b67564;
}
.terminal-title small {
	font-size: 8px;
	color: #7f9a85;
	letter-spacing: 1px;
}
.terminal-screen {
	height: min(340px, 45dvh);
	padding: 23px 22px;
	overflow: auto;
	overscroll-behavior: contain;
	font-size: 12px;
	line-height: 1.9;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
.terminal-screen .prompt {
	color: #e5edce;
	margin-top: 16px;
}
.terminal-body form {
	display: flex;
	gap: 12px;
	padding: 12px 22px;
	border-top: 1px solid #ffffff12;
}
.terminal-body input {
	width: 100%;
	min-width: 0;
	background: none;
	outline: none;
	font-size: 13px;
	color: #edf6de;
}
.terminal-body form button {
	width: 30px;
}
.terminal-quick {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0 20px 15px;
	font-size: 9px;
}
.terminal-quick button {
	padding: 5px 9px;
	border: 1px solid #57665955;
	border-radius: 4px;
}
.terminal-quick span {
	margin-left: auto;
	color: #839289;
	font-size: 8px;
}
button:active {
	transform: scale(0.96);
}
button:focus-visible {
	outline: 2px solid #b6cba2;
	outline-offset: 3px;
}
.terminal-body * {
	font-family: inherit;
}
@media (max-width: 600px) {
	.terminal-body input {
		font-size: 16px;
	}
}

.terminal-body{max-width:100%;max-height:calc(var(--visual-height,100dvh) - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom));display:flex;flex-direction:column;min-height:0;}
.terminal-screen{min-height:0;flex:1 1 340px;}
.terminal-title,.terminal-body form,.terminal-quick{flex-shrink:0;}
.terminal-body form{padding:6px 16px;align-items:center;}
.terminal-body form button{width:44px;height:44px;flex-shrink:0;}
.terminal-quick button{min-height:44px;}
@media(max-width:360px){.terminal-title{gap:8px;padding:0 12px;font-size:9px;}.terminal-screen{padding:16px;}}
@media(max-height:500px){.terminal-quick{display:none;}.terminal-title{height:32px;}}
</style>
