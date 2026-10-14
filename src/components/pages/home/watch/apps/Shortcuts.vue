<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch } from "../watch";
const watch = useWatch();
const result = ref('');
function coffee() {
  watch.fun.cups += 1;
  watch.fun.coffeeTimes.push(Date.now());
  result.value = 'Coffee logged · ' + watch.fun.cups + ' cups';
  watch.notify({
    app: 'coffee',
    title: 'Coffee logged',
    text: 'Demo coffee counter updated'
  });
  watch.haptic('success');
}
function focus() {
  watch.settings.focus = !watch.settings.focus;
  result.value = 'Focus ' + (watch.settings.focus ? 'on' : 'off');
  watch.haptic();
}
function breakTime() {
  watch.notify({
    app: 'mindfulness',
    title: 'Take a moment',
    text: 'Your demo breathing session is ready'
  });
  watch.open('mindfulness');
}
function music() {
  watch.playback.playing = !watch.playback.playing;
  result.value = watch.playback.playing ? 'Demo music playing' : 'Demo music paused';
  watch.haptic();
}
</script>

<template>
  <section class="watch-app shortcuts-app">
    <h1>Shortcuts</h1>
    <p class="caption muted">Tap to run</p>
    <p
      v-if="result"
      class="result"
      role="status"
    >
      {{result}}
    </p>
    <div class="shortcuts">
      <button class="shortcut deploy" @click="watch.open('deploy')">
        <span>
          <WatchGlyph name="up" />
        </span>
        <strong>Open Deploy</strong>
        <small>Deployment controls</small>
      </button>
      <button class="shortcut coffee" @click="coffee">
        <span>
          <WatchGlyph name="coffee" />
        </span>
        <strong>Log Coffee</strong>
        <small>Update demo count</small>
      </button>
      <button class="shortcut flashlight" @click="watch.open('flashlight')">
        <span>
          <WatchGlyph name="sun" />
        </span>
        <strong>Flashlight</strong>
        <small>Turn on the light</small>
      </button>
      <button class="shortcut focus" @click="focus">
        <span>
          <WatchGlyph name="moon" />
        </span>
        <strong>
          {{watch.settings.focus?'End Focus':'Start Focus'}}
        </strong>
        <small>Toggle Focus</small>
      </button>
      <button class="shortcut breathe" @click="breakTime">
        <span>
          <WatchGlyph name="mindfulness" />
        </span>
        <strong>Take a Break</strong>
        <small>Open Mindfulness</small>
      </button>
      <button class="shortcut music" @click="music">
        <span>
          <WatchGlyph name="music" />
        </span>
        <strong>
          {{watch.playback.playing?'Pause Music':'Play Music'}}
        </strong>
        <small>Demo player</small>
      </button>
    </div>
    <p class="polish-footnote">Demo data, for fun.</p>
  </section>
</template>

<style scoped>
.watch-app {
  font-family: -apple-system,BlinkMacSystemFont,"SF Pro Rounded","SF Pro Display",system-ui,sans-serif;
}

.watch-app :deep(*) {
  font-family: inherit;
}

.shortcuts-app h1 {
  color: #cd79ff;
}

.shortcuts {
  display: grid;
  grid-template-columns: repeat(2,1fr);
  gap: 14px;
}

.shortcut {
  border: 0;
  border-radius: 28px;
  min-height: 162px;
  text-align: left;
  color: white;
  padding: 20px 16px;
  overflow: hidden;
}

.shortcut>span {
  font-size: max(18px, calc(27px * var(--text-size, 1)));
  display: block;
  margin-bottom: 16px;
}

.shortcut strong {
  display: block;
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  line-height: 1.2;
}

.shortcut small {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  display: block;
  margin-top: 8px;
  opacity: .75;
}

.deploy {
  background: linear-gradient(130deg,#bc275e,#6f175d);
}

.coffee {
  background: linear-gradient(130deg, #8b5338, #5f382e);
}

.flashlight {
  background: linear-gradient(130deg,#557789,#364657);
}

.focus {
  background: linear-gradient(130deg,#8060bc,#514086);
}

.breathe {
  background: linear-gradient(130deg, #216c60, #154d48);
}

.music {
  background: linear-gradient(130deg, #b73760, #873052);
}

.result {
  padding: 16px 20px;
  border-radius: 22px;
  background: #251633;
  color: #e6bcff;
  font-size: max(18px, calc(22px * var(--text-size, 1)));
}

.shortcuts {
  gap: 10px;
}

.shortcut {
  min-height: 138px;
  padding: 14px;
  border: 1px solid #ffffff24;
}

.shortcut > span {
  margin-bottom: 10px;
}

.shortcut small {
  color: #fff;
  opacity: 0.95;
  font-size: 21px;
  line-height: 1.3;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #CD79FF; }

.shortcuts { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.shortcut { height:204px; min-height:204px; border-radius:30px; padding:18px; display:flex; flex-direction:column; gap:10px; }
.shortcut > span { align-self:flex-start; margin:0; }
.shortcut > span :deep(svg) { width:30px; height:30px; }
.shortcut strong { font-size:24px; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:60px; }
.shortcut small { font-size:20px; line-height:1.25; margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.result { line-height:1.25; }
</style>
