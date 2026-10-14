<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue';
import { vHover } from '../kit/hover';
import BreathingFlower from './mindfulness/BreathingFlower.vue';
import MindfulIcon from './mindfulness/MindfulIcon.vue';
import { mindfulTime, useMindfulHistory } from './mindfulness/useMindfulHistory';
import { useMindfulSession, type Practice } from './mindfulness/useMindfulSession';
import { collectionTarget, guidedStage } from './mindfulness/guidance';

defineProps<{ compact?: boolean }>();
const tab = ref<Practice | 'activity'>('breathe');
const tabs = ['breathe', 'reflect', 'activity'] as const;
const durationChoices = [1, 3, 5, 10];
const tabControls = ref<HTMLDivElement>();
const durationControls = ref<HTMLDivElement>();
const tuning = ref(false);
const inhaleControl = ref<HTMLInputElement>();
const particles = ref(true);
const promptIndex = ref(0);
const settings = reactive({ minutes: 1, inhale: 4, hold: 2, exhale: 6, tone: false, guided: false });
const prompts = [
  { title: 'Notice the ordinary.', text: 'Think of a small moment that made today a little softer. What did it feel like?',
    cue: 'Let the details return, without needing to hold on to them.' },
  { title: 'Make a little room.', text: 'What is one thing you can set down for the next few minutes?', cue: 'You can come back to it later. For now, there is space.' },
  { title: 'Come back to here.', text: 'Notice something you can feel, something you can hear, and something you can see.',
    cue: 'There is no need to change anything. Simply notice.' },
  { title: 'Offer yourself kindness.', text: 'What would you say to a friend who was feeling the way you feel today?', cue: 'Give yourself a moment to hear those same words.' },
  { title: 'A quiet appreciation.', text: 'Think of someone whose presence makes your life a little brighter.', cue: 'Let a simple feeling of gratitude be enough.' },
];
const prompt = computed(() => prompts[promptIndex.value] ?? prompts[0]);
const history = useMindfulHistory();
const { week, weekSeconds, totalSeconds, sessionCount, streak, storageNotice } = history;
const { status, elapsed, practice, completed, guided, progress, clock, breathing, bloom, audioNotice,
  start, finish, togglePause, toggleTone, reset } = useMindfulSession(settings, history.record);
const inSession = computed(() => status.value === 'running' || status.value === 'paused');
const reflect = computed(() => inSession.value ? practice.value === 'reflect' : tab.value === 'reflect');
const guidedCue = computed(() => guidedStage(progress.value));
const durationStop = computed(() => Math.max(0, durationChoices.indexOf(settings.minutes)));
const weeklyMax = computed(() => Math.max(60, ...week.value.map(day => day.seconds)));
const minutesLabel = (seconds: number) => Number((seconds / 60).toFixed(1)).toLocaleString();
function chooseTab(value: Practice | 'activity'): void {
  if (inSession.value) return;
  reset();
  tab.value = value;
}
function chooseGuidance(value: boolean): void {
  settings.guided = value;
  if (value) Object.assign(settings, { minutes: 3, inhale: 4, hold: 0, exhale: 6 });
}
function navigateTabs(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const index = collectionTarget(event.key, tabs.indexOf(tab.value), tabs.length);
  const destination = index === undefined ? undefined : tabs[index];
  if (!destination) return;
  event.preventDefault();
  event.stopPropagation();
  chooseTab(destination);
  void nextTick(() => tabControls.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]').item(index ?? 0)?.focus());
}
function navigateDuration(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const index = collectionTarget(event.key, durationStop.value, durationChoices.length);
  const destination = index === undefined ? undefined : durationChoices[index];
  if (destination === undefined) return;
  event.preventDefault();
  event.stopPropagation();
  settings.minutes = destination;
  durationControls.value?.querySelectorAll<HTMLButtonElement>('button').item(index ?? 0)?.focus();
}
function begin(): void { start(tab.value === 'reflect' ? 'reflect' : 'breathe'); }
function another(): void { tab.value = practice.value; reset(); }
function nextPrompt(): void { promptIndex.value = (promptIndex.value + 1) % prompts.length; }
async function toggleTuning(): Promise<void> {
  tuning.value = !tuning.value;
  if (tuning.value) { await nextTick(); inhaleControl.value?.focus(); }
}
</script>

<template>
  <div class="mindfulness" :class="{ compact, immersive: inSession, reflecting: reflect }">
    <div class="mindful-layout">
    <nav v-if="!inSession" class="tab-rail" aria-label="Mindfulness views">
      <div ref="tabControls" class="vk-tabbar" role="tablist" aria-label="Practice" aria-orientation="vertical" @keydown="navigateTabs">
        <button v-for="view in tabs" :id="'mindful-tab-' + view" :key="view" v-hover class="vk-icon" role="tab"
          :aria-selected="tab === view" :tabindex="tab === view ? 0 : -1" aria-controls="mindful-panel"
          :aria-label="view[0]?.toUpperCase() + view.slice(1)" :title="view[0]?.toUpperCase() + view.slice(1)" @click="chooseTab(view)">
          <MindfulIcon :name="view" /><span class="hover-label">{{ view[0]?.toUpperCase() + view.slice(1) }}</span>
        </button>
      </div>
    </nav>
    <div class="app-content">
      <main id="mindful-panel" class="content vk-scroll" :role="inSession ? 'main' : 'tabpanel'"
        :aria-labelledby="inSession ? 'mindful-title' : 'mindful-tab-' + tab">
        <header class="header">
          <div>
            <p class="eyebrow">{{ inSession ? 'YOUR MOMENT' : 'A LITTLE SPACE' }}</p>
            <h1 id="mindful-title">{{ inSession ? (guided ? 'A softer reset' : practice === 'breathe' ? 'Breathe' : 'Reflect') : 'Mindfulness' }}</h1>
          </div>
          <span v-if="inSession" class="session-time vk-chip" role="timer" :aria-label="clock + ' remaining'">{{ clock }}</span>
          <span v-else class="header-mark" aria-hidden="true"><MindfulIcon name="breathe" /></span>
        </header>

        <section v-if="status === 'finished'" class="summary" aria-label="Session summary">
          <BreathingFlower :bloom=".78" :progress="progress" :running="false" :paused="false" :particles="particles" :reflect="practice === 'reflect'" />
          <p class="eyebrow">{{ completed ? 'SESSION COMPLETE' : 'YOUR SESSION' }}</p>
          <h2>{{ completed ? 'Carry this calm with you.' : 'A moment, well spent.' }}</h2>
          <p class="secondary">{{ completed ? 'You made space for yourself.' : 'You can return whenever you like.' }}</p>
          <div class="summary-stats vk-platter">
            <div><strong>{{ mindfulTime(elapsed) }}</strong><span>mindful time</span></div>
            <div><strong>{{ practice === 'breathe' ? Math.floor(elapsed / (settings.inhale + settings.hold + settings.exhale)) : sessionCount }}</strong><span>{{ practice === 'breathe' ? 'breath cycles' : 'moments taken' }}</span></div>
            <div><strong>{{ minutesLabel(weekSeconds) }} min</strong><span>this week</span></div>
          </div>
          <p class="footnote secondary">{{ elapsed >= 1 ? 'Only time spent in your session is added to your history.' : 'This brief pause was not added to your history.' }}</p>
          <div class="summary-actions">
            <button v-hover class="vk-button primary start-button" @click="another">Take another moment</button>
            <button v-hover class="vk-button" @click="chooseTab('activity')">View activity</button>
          </div>
        </section>

        <section v-else-if="inSession" class="live-session" aria-label="Guided mindfulness session">
          <BreathingFlower :bloom="bloom" :progress="progress" :running="status === 'running'" :paused="status === 'paused'"
            :particles="particles" :reflect="practice === 'reflect'" />
          <div v-if="practice === 'breathe'" class="live-guidance">
            <p class="eyebrow">{{ status === 'paused' ? 'TAKE YOUR TIME' : 'FOLLOW THE FLOWER' }}</p>
            <h2 class="phase" aria-live="polite">{{ status === 'paused' ? 'Rest here.' : breathing.name }}</h2>
            <p class="secondary">{{ status === 'paused' ? 'Your session is paused.' : 'Let your breath be gentle and comfortable.' }}</p>
            <div v-if="guided" class="guided-cue" aria-live="polite" aria-atomic="true">
              <h3>{{ guidedCue.title }}</h3><p class="footnote secondary">{{ guidedCue.text }}</p>
            </div>
            <span class="phase-count" aria-hidden="true">{{ status === 'paused' ? '·' : breathing.seconds }}</span>
          </div>
          <div v-else class="live-guidance reflect-guidance">
            <p class="eyebrow">{{ status === 'paused' ? 'SESSION PAUSED' : 'LET YOUR MIND WANDER SOFTLY' }}</p>
            <h2>{{ prompt?.title }}</h2><p class="reflection-prompt">{{ prompt?.text }}</p>
            <p class="footnote secondary">{{ prompt?.cue }}</p>
          </div>
          <p v-if="audioNotice" class="footnote notice" role="status">{{ audioNotice }}</p>
        </section>

        <section v-else-if="tab === 'activity'" class="activity" aria-label="Mindful activity">
          <div class="activity-intro"><p class="eyebrow">TIME FOR YOURSELF</p><h2>Small moments add up.</h2>
            <p class="secondary">A gentle record of the space you make.</p>
          </div>
          <div class="activity-stats">
            <div class="vk-platter"><strong>{{ minutesLabel(totalSeconds) }}</strong><span>mindful minutes</span></div>
            <div class="vk-platter"><strong>{{ streak }}</strong><span>day streak</span></div>
            <div class="vk-platter"><strong>{{ sessionCount }}</strong><span>{{ sessionCount === 1 ? 'session' : 'sessions' }}</span></div>
          </div>
          <div class="week-card vk-platter" :class="{ 'no-activity': !weekSeconds }">
            <div class="week-heading"><h3>Last 7 days</h3><span class="footnote secondary">{{ minutesLabel(weekSeconds) }} min</span></div>
            <div class="week-chart" role="img" :aria-label="'Last seven days: ' + week.map(day => day.full + ', ' + mindfulTime(day.seconds)).join('; ')">
              <div v-if="!weekSeconds" class="chart-empty" aria-hidden="true"><MindfulIcon name="breathe" /><span>A quiet beginning</span></div>
              <div v-for="day in week" :key="day.date" class="chart-day" :title="day.full + ': ' + mindfulTime(day.seconds)">
                <span class="bar-space"><i :style="{ transform: 'scaleY(' + Math.max(.025, day.seconds / weeklyMax) + ')' }" :class="{ empty: !day.seconds }" /></span>
                <span class="chart-label">{{ day.label }}</span>
              </div>
            </div>
            <p v-if="!weekSeconds" class="footnote secondary">Your first moment will appear here.</p>
          </div>
          <p class="footnote secondary">A minute of mindful time in a day keeps your streak going. Paused time is excluded.</p>
          <button v-hover class="vk-button primary start-button" @click="chooseTab('breathe')">Make a little space</button>
        </section>

        <section v-else class="setup" aria-label="Choose your session">
          <div class="intro">
            <BreathingFlower :bloom=".62" :progress="0" :running="false" :paused="false" :particles="particles" :reflect="reflect" />
            <div class="intro-copy">
              <p class="eyebrow">{{ reflect ? 'REFLECT' : 'BREATHE' }}</p>
              <h2>{{ reflect ? 'A thought to spend time with.' : 'Come back to your breath.' }}</h2>
              <p class="secondary">{{ reflect ? 'No right answer. Just a little room to notice.' : 'Follow a gentle rhythm. Let everything else wait.' }}</p>
            <div v-if="!reflect" class="rhythm-preview"><span>{{ settings.inhale }}s in</span><i /><span>{{ settings.hold }}s hold</span><i /><span>{{ settings.exhale }}s out</span></div>
            </div>
          </div>
          <div v-if="reflect" class="prompt-card vk-platter">
            <p class="eyebrow">{{ prompt?.title }}</p><p>{{ prompt?.text }}</p>
            <button v-hover class="vk-button" @click="nextPrompt">Another thought <MindfulIcon name="next" /></button>
          </div>
          <div v-if="!reflect" class="practice-choices" aria-label="Breathing session choices">
            <button v-hover class="vk-row vk-platter" :aria-pressed="!settings.guided" @click="chooseGuidance(false)">
              <MindfulIcon name="breathe" /><span><strong>Just breathe</strong><small>Follow the flower at your own pace.</small></span>
            </button>
            <button v-hover class="vk-row vk-platter" :aria-pressed="settings.guided" @click="chooseGuidance(true)">
              <MindfulIcon name="sparkles" /><span><strong>A softer reset</strong><small>Guided · 3 min suggested · text cues</small></span>
            </button>
          </div>
          <div class="duration-setting">
            <label for="mindful-duration">Duration <strong>{{ settings.minutes }} {{ settings.minutes === 1 ? 'minute' : 'minutes' }}</strong></label>
            <input id="mindful-duration" v-model.number="settings.minutes" v-hover class="vk-slider" type="range" min="1" max="10" step="1"
              :style="{ '--value': (settings.minutes - 1) / 9 }" />
            <div ref="durationControls" class="duration-choices" role="radiogroup" aria-label="Quick duration choices" @keydown="navigateDuration">
              <button v-for="(minutes, index) in durationChoices" :key="minutes" v-hover class="vk-button" role="radio"
                :aria-checked="settings.minutes === minutes" :aria-pressed="settings.minutes === minutes" :tabindex="index === durationStop ? 0 : -1"
                @click="settings.minutes = minutes">{{ minutes }} min</button>
            </div>
          </div>

          <div v-if="tuning && !reflect" id="mindful-rhythm" class="rhythm vk-platter">
            <div class="rhythm-header"><h3>Your breathing rhythm</h3>
              <span class="footnote secondary">{{ settings.inhale + settings.hold + settings.exhale }} sec cycle</span></div>
            <label for="mindful-inhale">Inhale <span>{{ settings.inhale }} sec</span></label>
            <input id="mindful-inhale" ref="inhaleControl" v-model.number="settings.inhale" v-hover class="vk-slider" type="range" min="2" max="8"
              :style="{ '--value': (settings.inhale - 2) / 6 }" />
            <label for="mindful-hold">Hold <span>{{ settings.hold ? settings.hold + ' sec' : 'Skip' }}</span></label>
            <input id="mindful-hold" v-model.number="settings.hold" v-hover class="vk-slider" type="range" min="0" max="5"
              :style="{ '--value': settings.hold / 5 }" />
            <label for="mindful-exhale">Exhale <span>{{ settings.exhale }} sec</span></label>
            <input id="mindful-exhale" v-model.number="settings.exhale" v-hover class="vk-slider" type="range" min="2" max="10"
              :style="{ '--value': (settings.exhale - 2) / 8 }" />
            <p class="footnote secondary">Choose what feels comfortable. You can always breathe naturally.</p>
          </div>
          <p class="footnote secondary setup-note">{{ settings.tone ? 'Gentle tones begin with your session.' : 'A quiet moment, at your own pace.' }}</p>
        </section>
        <p v-if="storageNotice" class="footnote notice storage-notice" role="status">{{ storageNotice }}</p>
      </main>
      <footer v-if="inSession || (status === 'ready' && tab !== 'activity')" class="toolbar">
          <button v-if="!inSession" v-hover class="vk-button primary start-button" @click="begin">
            Begin {{ reflect ? 'reflection' : settings.guided ? 'guided reset' : 'breathing' }} <MindfulIcon name="play" />
          </button>
        <div class="vk-ornament" :aria-label="inSession ? 'Session controls' : 'Session options'">
          <button v-if="inSession" v-hover class="vk-icon large" :aria-label="status === 'paused' ? 'Resume session' : 'Pause session'"
            :title="status === 'paused' ? 'Resume' : 'Pause'" @click="togglePause"><MindfulIcon :name="status === 'paused' ? 'play' : 'pause'" /></button>
          <button v-hover class="vk-icon" :aria-pressed="settings.tone" :aria-label="settings.tone ? 'Turn gentle tones off' : 'Turn gentle tones on'"
            :title="settings.tone ? 'Gentle tones on' : 'Gentle tones off'" @click="toggleTone"><MindfulIcon :name="settings.tone ? 'sound' : 'silent'" /></button>
          <button v-hover class="vk-icon" :aria-pressed="particles" aria-label="Floating particles" title="Floating particles"
            @click="particles = !particles"><MindfulIcon name="sparkles" /></button>
          <button v-if="!inSession && !reflect" v-hover class="vk-icon" :aria-expanded="tuning" aria-controls="mindful-rhythm"
            aria-label="Adjust breathing rhythm" title="Breathing rhythm" @click="toggleTuning"><MindfulIcon name="tune" /></button>
          <button v-if="inSession" v-hover class="vk-button end-button" @click="finish">End</button>
        </div>
      </footer>
    </div>
    </div>
  </div>
</template>

<style scoped>
.mindfulness {
  box-sizing: border-box;
  position: relative; width: 100%; height: 100%; container-type: size; display: block; overflow: hidden;
  color: rgb(255 255 255 / .96); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', sans-serif;
  font-size: 17px; line-height: 1.4; border-radius: inherit; background: transparent;
}
.mindful-layout { display: flex; width: 100%; height: 100%; min-height: 0; }
.mindfulness :deep(*) { box-sizing: border-box; font-family: inherit; }
button, input { font: inherit; color: inherit; }
button { border: 0; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid #dcfff1; outline-offset: 3px; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: 32px; letter-spacing: -.035em; font-weight: 700; line-height: 1.15; }
h2 { font-size: 23px; letter-spacing: -.02em; font-weight: 600; line-height: 1.25; text-wrap: balance; }
h3 { font-size: 17px; font-weight: 600; }
.secondary { color: rgb(255 255 255 / .7); }
.footnote { font-size: 14px; line-height: 1.5; }
.eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .16em; color: #c4eedf; line-height: 1.5; }
.tab-rail { flex: none; width: 76px; display: flex; align-items: center; justify-content: center; padding: 10px 0 10px 8px; z-index: 4; }
.tab-rail .vk-icon { position: relative; }
.hover-label {
  position: absolute; left: calc(100% + 16px); pointer-events: none; background: rgb(52 64 61 / .96); border-radius: 12px;
  padding: 8px 14px; font-size: 14px; color: white; opacity: 0; transform: translateX(-5px);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .15), 0 8px 24px rgb(0 0 0 / .2); transition: transform 200ms, opacity 200ms;
}
.tab-rail button:hover .hover-label, .tab-rail button:focus-visible .hover-label { opacity: 1; transform: translateX(0); }
.app-content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.content { flex: 1; min-height: 0; padding: 26px 30px 18px 16px; overflow: auto; overscroll-behavior: contain; }
.header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.header .eyebrow { margin-bottom: 4px; }
.header-mark { width: 38px; height: 38px; color: #c0f0de; opacity: .65; }
.header-mark svg { width: 100%; height: 100%; }
.session-time { font-variant-numeric: tabular-nums; letter-spacing: .04em; font-size: 17px; }
.setup, .summary, .live-session { display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; max-width: 800px; margin: 0 auto; }
.intro { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2px; }
.intro :deep(.garden) { width: min(100%, 235px); }
.intro-copy { display: flex; flex-direction: column; gap: 9px; max-width: 420px; }
.intro-copy .eyebrow { margin-top: 0; }
.intro-copy p.secondary { max-width: 340px; margin: 0 auto; }
.practice-choices { width: min(100%, 450px); display: grid; gap: 8px; }
.practice-choices .vk-row { gap: 12px; padding: 14px 16px; }
.practice-choices svg { width: 24px; height: 24px; flex: none; color: #cdf7e6; }
.practice-choices span { display: flex; flex-direction: column; gap: 4px; }
.practice-choices strong { font-size: 17px; font-weight: 600; }
.practice-choices small { font-size: 14px; font-weight: 400; color: rgb(255 255 255 / .7); }
.guided-cue { max-width: 340px; display: flex; flex-direction: column; gap: 7px; margin-top: 8px; }
.guided-cue h3 { color: #cdf7e6; }
.duration-setting { width: min(100%, 390px); text-align: left; }
.duration-setting label, .rhythm label { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 14px; }
.duration-setting strong { color: #cdf7e6; font-weight: 500; }
.duration-choices { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.duration-choices .vk-button { min-width: 0; padding: 0 10px; font-size: 14px; min-height: 44px; }
.start-button { min-height: 60px; min-width: 240px; max-width: 100%; padding: 0 26px; }
.setup-note { margin-top: -5px; }
.toolbar { flex: none; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px 16px 16px; }
.toolbar .vk-ornament { max-width: 100%; }
.toolbar .vk-icon[aria-pressed="true"] { background: rgb(205 255 233 / .92); color: #18342a; }
.rhythm { width: min(100%, 420px); padding: 20px; text-align: left; }
.rhythm-header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-bottom: 18px; }
.rhythm label span { font-variant-numeric: tabular-nums; color: #cdf7e6; }
.rhythm .footnote { margin-top: 8px; }
.prompt-card { padding: 22px; max-width: 450px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.prompt-card .eyebrow { font-size: 14px; letter-spacing: .04em; }
.prompt-card .vk-button { font-size: 14px; }
.immersive .content { padding: 24px 30px 12px; }
.immersive .header { max-width: 900px; margin: 0 auto 10px; }
.immersive h1 { font-size: 23px; }
.live-session { gap: 18px; min-height: min(430px, 70cqh); justify-content: center; }
.live-session :deep(.garden) { width: min(65cqh, 340px, 72cqw); }
.live-guidance { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.phase { font-size: 32px; font-weight: 500; }
.phase-count { font-variant-numeric: tabular-nums; display: grid; place-items: center; min-width: 32px; min-height: 32px; color: #c0f0de; font-size: 14px; }
.reflect-guidance { max-width: 500px; }
.reflection-prompt { font-size: 17px; line-height: 1.65; max-width: 460px; text-wrap: balance; }
.end-button { padding: 0 18px; }
.notice { color: #dbecdf; text-align: center; max-width: 430px; }
.storage-notice { margin: 20px auto 0; }
.summary { gap: 14px; padding-bottom: 16px; }
.summary :deep(.garden) { width: min(100%, 245px); }
.summary-stats { padding: 20px 24px; display: flex; gap: 35px; max-width: 100%; }
.summary-stats div { display: flex; flex-direction: column; gap: 5px; }
.summary-stats strong { font-size: 23px; font-weight: 500; }
.summary-stats span { color: rgb(255 255 255 / .68); font-size: 14px; }
.summary-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.activity { max-width: 780px; margin: 26px auto 0; display: flex; flex-direction: column; gap: 24px; }
.activity-intro { display: flex; flex-direction: column; gap: 9px; }
.activity-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.activity-stats > div { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 20px 10px; }
.activity-stats strong { font-size: 32px; font-weight: 500; color: #c9f6e3; }
.activity-stats span { font-size: 14px; color: rgb(255 255 255 / .7); }
.week-card { padding: 22px; }
.week-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.week-chart { position: relative; display: flex; align-items: flex-end; gap: 12px; margin: 22px 0 8px; }
.chart-day { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.bar-space { height: 115px; width: min(100%, 36px); display: flex; align-items: flex-end; }
.bar-space i { width: 100%;
  height: 100%;
  transform-origin: bottom;
  transition: transform .24s ease-out;
  border-radius: 7px;
  background: linear-gradient(0deg, rgb(143 216 187 / .55), #cdfbe6); }
.bar-space i.empty { background: rgb(255 255 255 / .12); }
.chart-label { font-size: 12px; color: rgb(255 255 255 / .7); }
@container (min-width: 800px) {
  .content { padding: 32px 40px 24px 20px; }
  .setup { gap: 24px; }
  .intro { flex-direction: row; gap: 24px; justify-content: center; margin-top: 20px; }
  .intro :deep(.garden) { width: 300px; }
  .intro-copy { text-align: left; max-width: 320px; }
  .intro-copy p.secondary { margin: 0; }
  .duration-setting { width: 450px; }
  .live-session { flex-direction: row; gap: 65px; padding-top: 34px; min-height: 65cqh; }
  .live-session :deep(.garden) { width: min(48cqh, 390px); }
  .live-guidance { align-items: flex-start; text-align: left; max-width: 400px; }
  .summary { margin-top: 20px; }
}
@container (max-width: 460px) {
  .tab-rail { width: 66px; padding-left: 6px; }
  .tab-rail .vk-tabbar { padding: 6px; }
  .content { padding: 20px 16px 18px 8px; }
  h1 { font-size: 23px; }
  .header-mark { display: none; }
  .intro :deep(.garden) { width: 170px; }
  .setup { gap: 18px; }
  .start-button { width: 100%; min-width: 0; padding: 0 14px; }
  .duration-choices { gap: 4px; }
  .duration-choices .vk-button { padding: 0 5px; }
  .toolbar { padding: 8px 6px 12px; }
  .prompt-card { padding: 18px 14px; }
  .rhythm { padding: 18px 14px; }
  .immersive .content { padding: 20px 18px 12px; }
  .live-session :deep(.garden) { width: min(63cqw, 235px); }
  .live-session { min-height: 0; gap: 22px; padding-top: 16px; }
  .summary-stats { gap: 20px; padding: 18px; }
  .summary-stats strong { font-size: 17px; }
  .activity-stats { gap: 6px; }
  .activity-stats > div { padding: 16px 6px; border-radius: 20px; }
  .activity-stats strong { font-size: 23px; }
  .activity-stats span { font-size: 12px; }
  .week-card { padding: 16px 12px; }
  .week-chart { gap: 6px; }
}
@container (max-height: 400px) and (min-width: 550px) {
  .intro { flex-direction: row; gap: 20px; }
  .intro :deep(.garden) { width: 135px; }
  .intro-copy { text-align: left; }
  .live-session { flex-direction: row; min-height: 0; gap: 28px; padding-top: 4px; }
  .live-session :deep(.garden) { width: 140px; }
  .live-guidance { text-align: left; align-items: flex-start; }
}

.mindfulness .content { scrollbar-width: thin; scrollbar-color: #c4eedf55 transparent; }
.mindfulness .content::-webkit-scrollbar { display: block; width: 4px; }
.mindfulness .content::-webkit-scrollbar-thumb { background: #c4eedf55; border-radius: 8px; }
.chart-empty {
  position: absolute; inset: 8px 0 36px; display: flex; align-items: center; justify-content: center;
  gap: 10px; color: #d0efdf; font-size: 14px; pointer-events: none;
}
.chart-empty :deep(svg) { width: 24px; height: 24px; }
.no-activity .bar-space { height: 80px; }
.activity, .setup, .summary { animation: mindful-page .24s ease-out; }
@keyframes mindful-page { from { opacity: 0; transform: translateY(5px); } }
@container (max-width: 540px) {
  .mindful-layout { flex-direction: column-reverse; }
  .tab-rail { width: 100%; padding: 0 0 10px; }
  .mindfulness .tab-rail .vk-tabbar { flex-direction: row; padding: 6px; }
  .content { padding: 18px 20px; }
  .header h1 { font-size: 27px; }
  .hover-label { display: none; }
  .intro :deep(.garden) { width: 140px; }
  .intro-copy h2 { font-size: 23px; }
  .intro-copy p.secondary { font-size: 15px; }
  .setup { gap: 16px; }
  .practice-choices .vk-row { padding: 12px 14px; }
  .toolbar { flex-direction: column; gap: 8px; padding: 8px 16px 10px; }
  .toolbar .start-button { width: 100%; min-width: 0; min-height: 44px; }
  .toolbar .vk-ornament { padding: 4px; }
  .toolbar .vk-icon.large { width: 44px; height: 44px; }
  .activity { margin-top: 20px; gap: 20px; }
  .activity-stats strong { font-size: 28px; }
  .activity-stats > div { padding: 16px 6px; }
  .activity-stats span { font-size: 13px; }
  .week-card { padding: 18px 14px; }
  .chart-label { font-size: 12px; }
}
@media (hover: none) { .hover-label { display: none; } }

@media (prefers-reduced-motion: reduce) {
  .mindfulness :deep(*), .mindfulness :deep(*::before), .mindfulness :deep(*::after) { animation: none !important; transition: none !important; }
}

.mindfulness { background:radial-gradient(ellipse at 46% 32%,#83c5b31a,transparent 65%),linear-gradient(145deg,#11332f24,transparent); }
.content { padding:24px 28px 16px 16px; }
.header { margin-bottom:14px; }
.header .eyebrow { font-size:10px; letter-spacing:.17em; }
.header h1 { font-size:29px; }
.setup { gap:16px; }
.intro { display:grid; grid-template-columns:166px minmax(0,1fr); gap:20px; text-align:left; min-height:166px; }
.intro :deep(.garden) { width:166px; }
.intro-copy { gap:8px; }
.intro-copy h2 { font-size:26px; line-height:1.15; font-weight:600; }
.intro-copy p.secondary { font-size:14px; margin:0; line-height:1.5; }
.rhythm-preview { display:flex; align-items:center; gap:7px; color:#d6f6ea; font-size:10px; margin-top:5px; }
.rhythm-preview i { display:block; height:2px; width:12px; background:#c8ebdc40; }
.practice-choices { width:100%; grid-template-columns:1fr 1fr; gap:10px; }
.practice-choices .vk-row { min-height:85px; padding:14px; gap:10px; align-items:flex-start; border-radius:22px; }
.practice-choices .vk-row[aria-pressed=true] { box-shadow:inset 0 0 0 1px #c0ecd959; background:linear-gradient(135deg,#bee7d52b,#ffffff0a); }
.practice-choices strong { font-size:14px; }
.practice-choices small { font-size:12px; line-height:1.45; }
.practice-choices svg { margin-top:2px; width:20px; height:20px; }
.duration-setting { width:100%; border-top:1px solid #ffffff14; padding-top:16px; }
.duration-setting label { font-size:12px; }
.duration-choices { gap:8px; }
.duration-choices .vk-button { font-size:13px; }
.setup-note { font-size:11px; }
.toolbar { gap:10px; padding:10px 24px 18px 12px; }
.start-button { min-height:52px; min-width:220px; font-size:15px; }
.summary :deep(.garden) { width:min(30cqh,200px); }
.summary-stats { width:100%; justify-content:space-around; gap:14px; padding:20px; }
.summary-stats strong { font-size:25px; font-variant-numeric:tabular-nums; }
.summary-stats span { font-size:11px; }
.summary h2 { font-size:28px; }
.live-session { gap:12px; min-height:0; }
.live-session :deep(.garden) { width:min(43cqh,290px); }
@container(max-height:560px) and (min-width:541px) { .content { padding-top:18px; } .header { margin-bottom:8px; } .header h1 { font-size:25px; } .intro { grid-template-columns:130px 1fr; min-height:130px; gap:16px; } .intro :deep(.garden) { width:130px; } .intro-copy h2 { font-size:23px; } .setup { gap:12px; } .practice-choices .vk-row { min-height:76px; padding:12px; } .duration-setting { padding-top:12px; } .duration-setting>input { display:none; } .duration-choices { margin-top:10px; } .setup-note { display:none; } .toolbar { padding-bottom:14px; } .live-session { flex-direction:row; justify-content:center; gap:22px; } .live-session :deep(.garden) { width:220px; } .live-guidance { text-align:left; align-items:flex-start; max-width:250px; } }
@container(max-width:540px) { .mindful-layout { flex-direction:column; } .tab-rail { padding:10px 0 0; } .content { padding:14px 20px; } .header { margin-bottom:8px; } .header .eyebrow { display:none; } .header h1 { font-size:24px; } .intro { grid-template-columns:105px 1fr; min-height:115px; gap:12px; } .intro :deep(.garden) { width:105px; } .intro-copy h2 { font-size:21px; } .intro-copy p.secondary { font-size:12px; } .intro-copy .eyebrow { font-size:9px; } .rhythm-preview { font-size:9px; gap:4px; flex-wrap:wrap; } .rhythm-preview i { width:5px; } .setup { gap:12px; } .practice-choices { gap:8px; } .practice-choices .vk-row { padding:12px; gap:6px; flex-direction:column; min-height:101px; } .practice-choices strong { font-size:13px; } .practice-choices small { font-size:11px; } .practice-choices svg { width:18px; height:18px; } .duration-setting { padding-top:12px; } .duration-setting>input { display:none; } .duration-choices { gap:5px; margin-top:10px; } .duration-choices .vk-button { font-size:12px; } .setup-note { display:none; } .toolbar { flex-direction:row; padding:8px 16px 16px; gap:8px; flex-wrap:wrap; } .toolbar .start-button { flex:1 1 100%; } .toolbar .vk-ornament { padding:4px 10px; } .summary-stats { gap:8px; padding:16px 12px; } .summary-stats strong { font-size:20px; } .summary h2 { font-size:24px; } .summary :deep(.garden) { width:140px; } .live-session :deep(.garden) { width:min(40cqh,240px); } }

</style>
