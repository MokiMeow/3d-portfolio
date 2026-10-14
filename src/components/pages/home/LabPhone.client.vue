<script setup lang="ts">
import type { Component } from 'vue';
import { labDeviceBack } from '~/common/models/lab-device.model';
import { PHONE, PHONE_APPS, PHONE_SCREEN, type PhoneAppId } from './phone/phone';
import PhoneIcon from './phone/PhoneIcon.vue';
import AiChat from './phone/apps/AiChat.vue';
import Calculator from './phone/apps/Calculator.vue';
import Camera from './phone/apps/Camera.vue';
import Clock from './phone/apps/Clock.vue';
import Maps from './phone/apps/Maps.vue';
import Messages from './phone/apps/Messages.vue';
import Music from './phone/apps/Music.vue';
import Notes from './phone/apps/Notes.vue';
import Phone from './phone/apps/Phone.vue';
import Photos from './phone/apps/Photos.vue';
import Safari from './phone/apps/Safari.vue';
import Settings from './phone/apps/Settings.vue';
import Slack from './phone/apps/Slack.vue';
import Weather from './phone/apps/Weather.vue';
import WhatsApp from './phone/apps/WhatsApp.vue';
import YouTube from './phone/apps/YouTube.vue';

// The three assistants share one chat app with different manners.
const VIEWS: Record<PhoneAppId, { is: Component; props?: Record<string, string> }> = {
  messages: { is: Messages }, safari: { is: Safari }, whatsapp: { is: WhatsApp }, slack: { is: Slack },
  claude: { is: AiChat, props: { bot: 'claude' } }, chatgpt: { is: AiChat, props: { bot: 'chatgpt' } }, grok: { is: AiChat, props: { bot: 'grok' } },
  youtube: { is: YouTube }, phone: { is: Phone }, photos: { is: Photos }, camera: { is: Camera }, music: { is: Music }, notes: { is: Notes },
  settings: { is: Settings }, maps: { is: Maps }, calculator: { is: Calculator }, weather: { is: Weather }, clock: { is: Clock },
};
const DOCK: PhoneAppId[] = ['phone', 'safari', 'messages', 'music'];
const GRID = PHONE_APPS.filter(item => !DOCK.includes(item.id));
const NAMES = Object.fromEntries(PHONE_APPS.map(item => [item.id, item.name])) as Record<PhoneAppId, string>;
const BADGES: Partial<Record<PhoneAppId, number>> = { messages: 3, whatsapp: 12, slack: 1 };
// Notifications waiting on the lock screen. Tapping one opens its app.
const LOCK_NOTES: { app: PhoneAppId; title: string; text: string; when: string }[] = [
  { app: 'messages', title: 'Build Bot', text: 'One new message. Probably not a production incident.', when: 'now' },
  { app: 'slack', title: '#deploys', text: 'Friday, 4:58 PM: someone has pressed the button.', when: '2m ago' },
  { app: 'whatsapp', title: 'Amma', text: 'Did you eat? Reply or I am calling.', when: '9m ago' },
];

useHead({ link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap' }] });

const locked = ref(true);
const app = ref<PhoneAppId | null>(null);
const origin = ref({ x: 220, y: 478 });
const now = ref(new Date());
const banner = ref<{ app: PhoneAppId; title: string; text: string } | null>(null);
const island = ref(false);
const scale = ref(1);
// On a narrow screen the phone drops its frame and fills the view at real size, so every tap lands on a full-size control.
const full = ref(false);
const screenSize = reactive({ width: PHONE_SCREEN.width as number, height: PHONE_SCREEN.height as number });
const seen = ref<PhoneAppId[]>([]);
const bar = computed(() => (locked.value || !app.value ? 'light' : PHONE_APPS.find(item => item.id === app.value)?.bar ?? 'dark'));
const time = computed(() => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: false }).format(now.value));
const today = computed(() => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(now.value));
const badge = (id: PhoneAppId) => (seen.value.includes(id) ? 0 : BADGES[id] ?? 0);

let bannerTimer = 0, clockTimer = 0;
function open(id: PhoneAppId, event?: Event) {
  const target = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  const screen = target?.closest('.screen');
  if (target && screen) {
    // Grow the app out of the icon that was tapped.
    const from = target.getBoundingClientRect(), box = screen.getBoundingClientRect();
    origin.value = { x: (from.left + from.width / 2 - box.left) / scale.value, y: (from.top + from.height / 2 - box.top) / scale.value };
  } else origin.value = { x: 220, y: 478 };
  locked.value = false; banner.value = null; island.value = false;
  if (!seen.value.includes(id)) seen.value.push(id);
  app.value = id;
}
function home() { app.value = null; island.value = false; }
// Escape leaves the open app; on the Home Screen it is not used, so the phone is put down.
function back() { if (!app.value) return false; home(); return true; }
function lock() { app.value = null; island.value = false; banner.value = null; locked.value = true; }
function notify(note: { app: PhoneAppId; title: string; text: string }) {
  banner.value = note;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => { banner.value = null; }, 4200);
}
provide(PHONE, { now, open: id => open(id), home, notify });

// Swipe up from the lock screen or the home bar, as on the real thing.
let dragY: number | null = null;
function dragStart(event: PointerEvent) { dragY = event.clientY; }
function dragEnd(event: PointerEvent, action: () => void) {
  if (dragY !== null && dragY - event.clientY > 36) action();
  dragY = null;
}
function fit() {
  const width = window.visualViewport?.width ?? window.innerWidth, height = window.visualViewport?.height ?? window.innerHeight;
  full.value = width < 520;
  if (full.value) {
    scale.value = 1;
    screenSize.width = Math.round(Math.max(320, width - 12));
    // Room above for the dialog's own "Put it back" button.
    screenSize.height = Math.round(Math.max(480, height - 92));
    return;
  }
  screenSize.width = PHONE_SCREEN.width; screenSize.height = PHONE_SCREEN.height;
  scale.value = Math.max(0.3, Math.min(1, (height - 92) / (PHONE_SCREEN.height + 22), (width - 28) / (PHONE_SCREEN.width + 22)));
}
onMounted(() => {
  labDeviceBack.handler = back;
  fit();
  window.addEventListener('resize', fit); window.visualViewport?.addEventListener('resize', fit);
  clockTimer = window.setInterval(() => { now.value = new Date(); }, 1000);
});
onBeforeUnmount(() => {
  if (labDeviceBack.handler === back) labDeviceBack.handler = null;
  window.removeEventListener('resize', fit); window.visualViewport?.removeEventListener('resize', fit);
  clearInterval(clockTimer); clearTimeout(bannerTimer);
});
</script>

<template>
  <div class="phone-fit" :style="full ? { width: `${screenSize.width}px`, height: `${screenSize.height}px` } : { width: `${(PHONE_SCREEN.width + 22) * scale}px`, height: `${(PHONE_SCREEN.height + 22) * scale}px` }">
    <div class="phone" :class="{ full }" :style="{ transform: `scale(${scale})` }">
      <i class="side action" /><i class="side volume-up" /><i class="side volume-down" /><i class="side camera-control" />
      <button class="side power" aria-label="Lock phone" title="Lock phone" @click="lock" />
      <div class="screen" :class="[`bar-${bar}`, { locked }]" :style="{ '--ox': `${origin.x}px`, '--oy': `${origin.y}px`, width: `${screenSize.width}px`, height: `${screenSize.height}px` }">
        <div class="wallpaper" :class="{ dim: !locked }" />

        <!-- Home screen -->
        <div class="home" :class="{ away: !!app || locked }" :inert="!!app || locked">
          <div class="pages">
          <div class="widgets">
            <button class="widget weather-widget" aria-label="Weather" @click="open('weather', $event)">
              <span>Bengaluru</span><b>26°</b><em>Partly cloudy<br>H:29° L:21°</em>
            </button>
            <button class="widget clock-widget" aria-label="Clock" @click="open('clock', $event)">
              <span>{{ today.split(',')[0] }}</span><b>{{ now.getDate() }}</b><em>No more meetings.<br>Suspicious.</em>
            </button>
          </div>
          <div class="grid">
            <button v-for="item in GRID" :key="item.id" :aria-label="item.name" @click="open(item.id, $event)">
              <span class="icon"><PhoneIcon :name="item.id" /><i v-if="badge(item.id)" class="badge">{{ badge(item.id) }}</i></span>
              <span class="label">{{ item.name }}</span>
            </button>
          </div>
          </div>
          <div class="search-pill" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>Search</div>
          <div class="dock">
            <button v-for="id in DOCK" :key="id" :aria-label="NAMES[id]" @click="open(id, $event)">
              <span class="icon"><PhoneIcon :name="id" /><i v-if="badge(id)" class="badge">{{ badge(id) }}</i></span>
            </button>
          </div>
        </div>

        <!-- The open app -->
        <Transition name="app">
          <div v-if="app" :key="app" class="app-window">
            <component :is="VIEWS[app].is" v-bind="VIEWS[app].props" />
          </div>
        </Transition>

        <!-- Lock screen -->
        <Transition name="lock">
          <div v-if="locked" class="lock" @pointerdown="dragStart" @pointerup="dragEnd($event, () => (locked = false))">
            <svg class="padlock" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="10.5" width="12" height="9.5" rx="2.8" fill="currentColor" /><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.700" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
            <div class="lock-date">{{ today }}</div>
            <div class="lock-time">{{ time }}</div>
            <div class="lock-notes">
              <button v-for="note in LOCK_NOTES" :key="note.title" class="note" @click="open(note.app, $event)">
                <span class="note-icon"><PhoneIcon :name="note.app" /></span>
                <span class="note-text"><b>{{ note.title }}<small>{{ note.when }}</small></b>{{ note.text }}</span>
              </button>
            </div>
            <div class="lock-tools">
              <button aria-label="Torch: decorative"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v3.5l-2 3V20a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9.5l-2-3Z" fill="currentColor" /></svg></button>
              <button aria-label="Open camera" @click="open('camera', $event)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.500 1.500 0 0 1 5.5 7H8l1.300-2h5.400L16 7h2.500A1.500 1.500 0 0 1 20 8.5v9a1.500 1.500 0 0 1-1.500 1.500h-13A1.500 1.500 0 0 1 4 17.5Z" fill="currentColor" /><circle cx="12" cy="13" r="3.3" fill="#0008" /></svg></button>
            </div>
            <button class="unlock" @click="locked = false">Swipe up or tap to open</button>
          </div>
        </Transition>

        <!-- Status bar, Dynamic Island, banner and home bar sit above everything -->
        <div class="status" aria-hidden="true">
          <span class="status-time">{{ time }}</span>
          <span class="status-icons">
            <svg viewBox="0 0 18 12" width="18"><rect y="8" width="3" height="4" rx=".8" /><rect x="5" y="5.5" width="3" height="6.5" rx=".8" /><rect x="10" y="3" width="3" height="9" rx=".8" /><rect x="15" width="3" height="12" rx=".8" /></svg>
            <svg viewBox="0 0 17 12" width="17"><path d="M8.5 2.600c2.400 0 4.600.900 6.200 2.500l1.100-1.200A10.400 10.400 0 0 0 8.500 1 10.400 10.400 0 0 0 1.200 3.900l1.100 1.200a8.700 8.700 0 0 1 6.200-2.500Zm0 3.600c1.400 0 2.700.500 3.700 1.500l1.100-1.200a7 7 0 0 0-9.600 0l1.100 1.200c1-1 2.300-1.500 3.700-1.500Zm0 3.500c-.700 0-1.300.300-1.800.700l1.800 1.900 1.800-1.900c-.5-.400-1.100-.700-1.800-.700Z" /></svg>
            <svg viewBox="0 0 28 13" width="27"><rect x=".5" y=".5" width="23.5" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="16.5" height="9" rx="2.4" /><path d="M25.5 4.300v4.400c.900-.300 1.500-1.200 1.500-2.200s-.600-1.900-1.500-2.200Z" opacity=".45" /></svg>
          </span>
        </div>
        <button class="island" :class="{ open: island }" :aria-label="island ? 'Collapse Dynamic Island' : 'Dynamic Island'" :aria-expanded="island" @click="island = !island">
          <i class="lens" />
          <span v-if="island" class="island-live"><b>Now compiling</b><em>Estimated time: one chai</em><span class="bars"><i /><i /><i /><i /></span></span>
        </button>
        <Transition name="banner">
          <button v-if="banner" class="banner" @click="open(banner.app)">
            <span class="note-icon"><PhoneIcon :name="banner.app" /></span>
            <span class="note-text"><b>{{ banner.title }}<small>now</small></b>{{ banner.text }}</span>
          </button>
        </Transition>
        <button v-if="!locked" class="home-bar" :aria-label="app ? 'Go to the Home Screen' : 'Home Screen'" @click="home" @pointerdown="dragStart" @pointerup="dragEnd($event, home)"><i /></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone-fit{position:relative;flex-shrink:0}
/* Titanium band around a 440 x 956 display. */
.phone{position:absolute;left:0;top:0;width:462px;height:978px;transform-origin:0 0;padding:11px;border-radius:76px;
  background:linear-gradient(135deg,#8d8a84,#3d3b38 22%,#77746e 48%,#2e2c2a 76%,#86837d);
  box-shadow:inset 0 0 0 1.5px rgb(255 255 255 / .22),inset 0 0 0 5px #0a0a0b,0 30px 70px rgb(0 0 0 / .55),0 4px 14px rgb(0 0 0 / .4)}
.phone::after{content:'';position:absolute;inset:5px;border-radius:71px;box-shadow:inset 0 0 0 6px #050506;pointer-events:none}
/* Full-screen on phones: no titanium band, no side buttons, just the display with softly rounded corners. */
.phone.full{width:auto;height:auto;padding:0;border-radius:28px;background:none;box-shadow:0 18px 50px rgb(0 0 0 / .45)}
.phone.full::after,.phone.full .side{display:none}
.phone.full .screen{border-radius:28px}
.side{position:absolute;width:5px;border-radius:2px;background:linear-gradient(90deg,#5d5a55,#a29f98 45%,#4a4844);border:0;padding:0}
.side.action{left:-3px;top:150px;height:34px}.side.volume-up{left:-3px;top:212px;height:62px}.side.volume-down{left:-3px;top:288px;height:62px}
.side.power{right:-3px;top:250px;height:104px;cursor:pointer}.side.power::before{content:'';position:absolute;inset:-8px -14px}
.side.camera-control{right:-2px;top:540px;height:70px;width:4px;background:linear-gradient(90deg,#2b2a28,#55524d)}
.side.power:focus-visible{outline:2px solid #9cc7ff;outline-offset:3px}
.screen{--safe-top:62px;--safe-bottom:34px;position:relative;width:440px;height:956px;border-radius:65px;overflow:hidden;isolation:isolate;background:#000;color:#fff;
  font:400 17px/1.3 -apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:-.02em;-webkit-font-smoothing:antialiased;user-select:none}
/* The site sets its own typeface on every element; the phone keeps San Francisco. */
.screen :deep(*){font-family:inherit}
.screen :deep(button){-webkit-tap-highlight-color:transparent}
.wallpaper{position:absolute;inset:0;transition:filter .45s,transform .45s;
  background:radial-gradient(120% 60% at 18% 6%,#3ee0b0 0,transparent 55%),radial-gradient(90% 55% at 92% 22%,#2d7dff 0,transparent 60%),radial-gradient(110% 60% at 30% 78%,#7a3cff 0,transparent 62%),radial-gradient(90% 50% at 88% 96%,#ff5c8a 0,transparent 60%),linear-gradient(180deg,#07122b,#150a2e)}
.wallpaper::after{content:'';position:absolute;inset:0;background:radial-gradient(60% 34% at 50% 44%,rgb(255 255 255 / .16),transparent 70%),linear-gradient(180deg,rgb(0 0 0 / .18),transparent 30%,rgb(0 0 0 / .32))}
.wallpaper.dim{filter:saturate(1.1) brightness(.86)}

.home{position:absolute;inset:0;padding:0;transition:transform .42s cubic-bezier(.2,.8,.2,1),opacity .3s}
.home.away{transform:scale(.9);opacity:0}
.screen.locked .home.away{transform:scale(1.12)}
/* Widgets and icons scroll when the screen is short; the bottom padding keeps the last row clear of the dock. */
.pages{position:absolute;inset:0;padding:78px 27px 150px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;touch-action:pan-y}
.pages::-webkit-scrollbar{display:none}
.phone.full .search-pill{display:none}
/* Short screens: a smaller clock and tighter spacing keep the lock screen controls in view. */
.phone.full .lock{padding-top:58px}.phone.full .lock-time{font-size:clamp(64px,13vh,112px)}.phone.full .lock-notes{gap:6px}.phone.full .lock-tools{padding-top:16px;padding-bottom:6px}
.widgets{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-bottom:26px}
.widget{height:168px;border-radius:26px;padding:16px 17px;text-align:left;color:#fff;display:flex;flex-direction:column;border:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgb(255 255 255 / .16),0 8px 22px rgb(0 0 0 / .22)}
.widget span{font-size:15px;font-weight:600}.widget b{font-size:52px;line-height:1.05;font-weight:300;letter-spacing:-.04em}.widget em{margin-top:auto;font-style:normal;font-size:13px;line-height:1.3;font-weight:500;opacity:.92}
.weather-widget{background:linear-gradient(180deg,#2a6fd6,#5fb4f4)}
.clock-widget{background:rgb(255 255 255 / .92);color:#111}.clock-widget span{color:#ff3b30;text-transform:uppercase;font-size:13px;letter-spacing:.02em}.clock-widget b{font-weight:400}.clock-widget em{color:#6b6b70}
.grid{display:grid;grid-template-columns:repeat(4,64px);justify-content:space-between;row-gap:24px}
.grid button,.dock button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:0;border:0;background:none;color:#fff;cursor:pointer}
.icon{position:relative;display:block;width:64px;transition:transform .18s,filter .18s}
.grid button:active .icon,.dock button:active .icon{transform:scale(.9);filter:brightness(.8)}
.label{font-size:12px;line-height:1.2;font-weight:500;letter-spacing:-.01em;text-shadow:0 1px 3px rgb(0 0 0 / .45);white-space:nowrap}
.badge{position:absolute;top:-7px;right:-8px;min-width:24px;height:24px;padding:0 7px;border-radius:12px;background:#ff3b30;font-style:normal;font-size:14px;line-height:24px;font-weight:600;text-align:center;letter-spacing:0;box-shadow:0 1px 3px rgb(0 0 0 / .3)}
.grid button:focus-visible,.dock button:focus-visible,.widget:focus-visible,.note:focus-visible,.unlock:focus-visible,.lock-tools button:focus-visible,.banner:focus-visible,.home-bar:focus-visible,.island:focus-visible{outline:2px solid #fff;outline-offset:4px}
.search-pill{position:absolute;left:50%;bottom:144px;transform:translateX(-50%);display:flex;align-items:center;gap:5px;height:30px;padding:0 13px;border-radius:15px;font-size:13px;font-weight:500;
  background:rgb(255 255 255 / .18);backdrop-filter:blur(24px) saturate(180%);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .22)}
.search-pill svg{width:13px;height:13px}
/* Liquid Glass dock. */
.dock{position:absolute;left:14px;right:14px;bottom:26px;height:98px;display:flex;align-items:center;justify-content:space-between;padding:0 21px;border-radius:38px;
  background:linear-gradient(180deg,rgb(255 255 255 / .26),rgb(255 255 255 / .12));backdrop-filter:blur(28px) saturate(190%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .5),inset 0 0 0 1px rgb(255 255 255 / .18),0 10px 30px rgb(0 0 0 / .22)}

.app-window{position:absolute;inset:0;background:#000;overflow:hidden;transform-origin:var(--ox) var(--oy)}
.app-enter-active{transition:transform .42s cubic-bezier(.2,.85,.2,1),opacity .2s,border-radius .42s}
.app-leave-active{transition:transform .34s cubic-bezier(.4,0,.2,1),opacity .26s .08s,border-radius .34s}
.app-enter-from,.app-leave-to{transform:scale(.14);opacity:0;border-radius:120px}

.lock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;padding-top:70px;touch-action:none}
.padlock{width:22px;height:22px;opacity:.9}
.lock-date{margin-top:12px;font-size:21px;font-weight:600;opacity:.9}
.lock-time{font-size:112px;line-height:1;font-weight:700;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:rgb(255 255 255 / .9);text-shadow:0 2px 20px rgb(0 0 0 / .18)}
.lock-notes{margin-top:auto;width:100%;padding:0 14px;display:flex;flex-direction:column;gap:9px}
.note,.banner{display:flex;align-items:center;gap:12px;width:100%;padding:13px 15px;border:0;border-radius:26px;text-align:left;color:#fff;cursor:pointer;
  background:linear-gradient(180deg,rgb(255 255 255 / .24),rgb(255 255 255 / .13));backdrop-filter:blur(26px) saturate(180%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .4),inset 0 0 0 1px rgb(255 255 255 / .14)}
.note-icon{width:40px;flex-shrink:0}
.note-text{font-size:15px;line-height:1.28;min-width:0;flex:1}.note-text b{display:flex;justify-content:space-between;gap:10px;font-weight:600}.note-text small{font-size:13px;font-weight:400;opacity:.7}
.lock-tools{width:100%;display:flex;justify-content:space-between;padding:26px 46px 0}
.lock-tools button{width:54px;height:54px;border:0;border-radius:50%;color:#fff;cursor:pointer;background:rgb(255 255 255 / .2);backdrop-filter:blur(24px) saturate(180%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .4)}
.lock-tools svg{width:24px;height:24px;margin:auto;display:block}
.unlock{margin:10px 0 22px;min-height:44px;padding:0 20px;border:0;background:none;color:#fff;font-size:14px;font-weight:500;opacity:.8;cursor:pointer;animation:hint 2.6s ease-in-out infinite}
.lock-leave-active{transition:transform .42s cubic-bezier(.4,0,.2,1),opacity .34s}.lock-leave-to{transform:translateY(-34%);opacity:0}
.lock-enter-active{transition:opacity .3s}.lock-enter-from{opacity:0}

.status{position:absolute;top:0;left:0;right:0;height:62px;display:flex;justify-content:space-between;align-items:center;padding:8px 38px 0 52px;pointer-events:none;z-index:6;transition:color .3s}
.status-time{font-size:17px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.status-icons{display:flex;align-items:center;gap:6px}.status-icons svg{fill:currentColor;height:13px}
.bar-light .status{color:#fff}.bar-dark .status{color:#000}
.island{position:absolute;top:13px;left:50%;width:124px;height:36px;margin-left:-62px;padding:0;border:0;border-radius:20px;background:#000;color:#fff;cursor:pointer;z-index:7;overflow:hidden;
  transition:width .45s cubic-bezier(.2,1.15,.3,1),height .45s cubic-bezier(.2,1.15,.3,1),margin .45s cubic-bezier(.2,1.15,.3,1),border-radius .45s}
.island.open{width:404px;height:84px;margin-left:-202px;border-radius:42px}
.lens{position:absolute;right:14px;top:12px;width:12px;height:12px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#2b3a5c,#05070c 70%);box-shadow:inset 0 0 0 1px #10151f}
.island-live{position:absolute;left:24px;right:54px;top:19px;display:grid;grid-template-columns:1fr auto;text-align:left;animation:fade .3s .15s both}
.island-live b{font-size:16px;font-weight:600}.island-live em{grid-row:2;font-style:normal;font-size:13px;color:#98989f}
.bars{grid-row:1/3;grid-column:2;display:flex;align-items:center;gap:3px;height:42px}
.bars i{width:3.5px;border-radius:2px;background:#30d158;animation:bars 1s ease-in-out infinite}.bars i:nth-child(1){height:12px}.bars i:nth-child(2){height:26px;animation-delay:.15s}.bars i:nth-child(3){height:18px;animation-delay:.3s}.bars i:nth-child(4){height:30px;animation-delay:.45s}
.banner{position:absolute;left:10px;right:10px;width:auto;top:56px;z-index:8;background:linear-gradient(180deg,rgb(60 60 66 / .78),rgb(40 40 46 / .72));box-shadow:inset 0 1px 0 rgb(255 255 255 / .22),0 14px 34px rgb(0 0 0 / .35)}
.banner-enter-active,.banner-leave-active{transition:transform .4s cubic-bezier(.2,.9,.2,1),opacity .3s}.banner-enter-from,.banner-leave-to{transform:translateY(-130%);opacity:0}
.home-bar{position:absolute;left:0;right:0;bottom:0;height:34px;padding:0;border:0;background:none;cursor:pointer;z-index:6;touch-action:none}
.home-bar i{position:absolute;left:50%;bottom:9px;width:144px;height:5px;margin-left:-72px;border-radius:3px;background:currentColor;transition:transform .2s}
.home-bar:hover i{transform:scaleX(1.06) translateY(-1px)}
.bar-light .home-bar{color:#fff}.bar-dark .home-bar{color:#000}
@keyframes hint{50%{transform:translateY(-5px);opacity:1}}
@keyframes fade{from{opacity:0}}
@keyframes bars{50%{transform:scaleY(.45)}}
@media(prefers-reduced-motion:reduce){.home,.wallpaper,.icon,.island,.home-bar i{transition:none}.unlock,.bars i,.island-live{animation:none}
  .app-enter-active,.app-leave-active,.lock-leave-active,.lock-enter-active,.banner-enter-active,.banner-leave-active{transition:opacity .15s}.app-enter-from,.app-leave-to,.lock-leave-to,.banner-enter-from,.banner-leave-to{transform:none}}
</style>
