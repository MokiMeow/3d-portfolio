<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, formatDuration } from "../watch";
interface Memo {
  id: number;
  title: string;
  duration: number;
  created: number;
}
const watch = useWatch();
const memos = ref<Memo[]>([{
  id: 1,
  title: 'Demo memo',
  duration: 12,
  created: Date.now()
}]);
const recording = ref(false);
const recordingAt = ref(0);
const playing = ref<number | null>(null);
const playbackAt = ref(0);
const playbackBank = ref(0);
let nextId = 2;
const recorded = computed(() => recording.value ? Math.max(0, (watch.now.value.getTime() - recordingAt.value) / 1000) : 0);
const playPosition = computed(() => playing.value === null ? 0 : playbackBank.value + Math.max(0, (watch.now.value.getTime() - playbackAt.value) / 1000));
function toggleRecord() {
  playing.value = null;
  if (recording.value) {
    const duration = Math.max(1, (Date.now() - recordingAt.value) / 1000);
    memos.value.unshift({
      id: nextId++,
      title: 'Demo recording ' + (nextId - 2),
      duration,
      created: Date.now()
    });
    recording.value = false;
    watch.haptic('success');
  } else {
    recordingAt.value = Date.now();
    recording.value = true;
    watch.haptic();
  }
}
function play(memo: Memo) {
  if (playing.value === memo.id) {
    playing.value = null;
    playbackBank.value = 0;
  } else {
    recording.value && toggleRecord();
    playing.value = memo.id;
    playbackAt.value = Date.now();
    playbackBank.value = 0;
  }
  watch.haptic();
}
watchEffect(() => {
  const id = playing.value;
  if (id === null) return;
  const memo = memos.value.find(item => item.id === id);
  if (!memo || playPosition.value >= memo.duration) {
    playing.value = null;
    playbackBank.value = 0;
  }
});
function stopPlayback() {
  playing.value = null;
  playbackBank.value = 0;
}
onDeactivated(stopPlayback);
onBeforeUnmount(stopPlayback);
</script>

<template>
  <section class="watch-app memos-app">
    <h1>Voice Memos</h1>
    <div class="recording-panel">
      <div
        class="waveform"
        :class="{active:recording&&!watch.reducedMotion.value&&!watch.dimmed.value}"
        aria-hidden="true"
      >
        <i
          v-for="n in 31"
          :key="n"
          :style="{height:(10+(n*17%53))+'px','--n':n}"
        />
      </div>
      <div class="duration">
        {{formatDuration(recorded)}}
      </div>
      <button
        class="record"
        :class="{recording}"
        :aria-label="recording?'Stop simulated recording':'Start simulated recording'"
        @click="toggleRecord"
      >
        <span />
      </button>
      <p class="caption muted">
        {{recording?'Recording…':'Tap to record'}}
      </p>
    </div>
    <h2>Recordings</h2>
    <article
      v-for="memo in memos"
      :key="memo.id"
      class="platter memo"
    >
      <button class="memo-play" @click="play(memo)">
        <span class="play-icon">
          <WatchGlyph :name="playing === memo.id ? 'pause' : 'play'" />
        </span>
        <span>
          <strong>
            {{memo.title}}
          </strong>
          <small>
            {{playing===memo.id?formatDuration(playPosition)+' / ':''}}
            {{formatDuration(memo.duration)}}
          </small>
        </span>
      </button>
      <button
        class="delete"
        :aria-label="'Delete '+memo.title"
        @click="memos=memos.filter(item=>item.id!==memo.id)"
      >
        <WatchGlyph name="close" />
      </button>
      <div v-if="playing===memo.id" class="play-progress">
        <i :style="{width:playPosition/memo.duration*100+'%'}" />
      </div>
    </article>
    <p v-if="!memos.length" class="caption muted">Tap record to create a demo memo.</p>
    
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

.memos-app h1 {
  color: #ff453a;
}

.recording-panel {
  text-align: center;
  margin-top: 24px;
}

.waveform {
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.waveform i {
  width: 4px;
  background: #ff453a;
  border-radius: 3px;
}

.waveform.active i {
  animation: wave .45s ease-in-out infinite alternate;
  animation-delay: calc(var(--n)*-.09s);
}

.duration {
  font-size: max(18px, calc(37px * var(--text-size, 1)));
  font-variant-numeric: tabular-nums;
  margin: 12px 0;
}

.record {
  height: 94px;
  width: 94px;
  border: 4px solid #fff;
  border-radius: 50%;
  background: #171717;
  display: inline-grid;
  place-items: center;
}

.record span {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #ff453a;
}

.record.recording span {
  width: 36px;
  height: 36px;
  border-radius: 6px;
}

.memo {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  margin: 12px 0;
}

.memo-play {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  text-align: left;
  color: #fff;
  background: none;
  border: 0;
  min-height: 88px;
}

.play-icon {
  font-size: max(18px, calc(27px * var(--text-size, 1)));
  color: #ff453a;
  width: 36px;
}

.memo strong {
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  display: block;
}

.memo small {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  color: #aaa;
  display: block;
  margin-top: 7px;
}

.delete {
  border: 0;
  background: none;
  color: #ff453a;
  min-width: 72px;
  min-height: 80px;
  font-size: max(18px, calc(28px * var(--text-size, 1)));
}

.play-progress {
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 3px;
  background: #555;
}

.play-progress i {
  display: block;
  height: 100%;
  background: #ff453a;
}

.disclaimer {
  font-size: max(18px, calc(21px * var(--text-size, 1)));
  line-height: 1.3;
}

@keyframes wave {
  to {
    transform: scaleY(.25);
  }
}

.recording-panel {
  margin-top: 12px;
}

.waveform {
  height: 54px;
}

.duration {
  margin: 8px 0;
}

.record {
  height: 82px;
  width: 82px;
}

.record span {
  width: 60px;
  height: 60px;
  transition: transform 240ms ease;
}

.record.recording span {
  width: 60px;
  height: 60px;
  transform: scale(0.55);
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF453A; }

.recording-panel { margin:8px 0 20px; }
.waveform { height:44px; }
.duration { font-size:40px; margin:8px 0; }
.record { width:112px; height:112px; display:grid; margin:12px auto; }
.record span { width:84px; height:84px; transition:transform 160ms ease; }
.record.recording span { width:84px; height:84px; }
.memo { align-items:center; }
.memo-play { min-width:0; }
.memo-play > span:last-child { min-width:0; overflow-wrap:anywhere; }
.memo .delete { min-width:44px; min-height:64px; }
.memo .play-icon { flex:0 0 30px; }

.record { min-height:112px !important; }
</style>
