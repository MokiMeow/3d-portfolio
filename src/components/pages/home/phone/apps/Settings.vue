<script setup lang="ts">
import AppGlyph from './AppGlyph.vue';
import { APP_ICONS as icons } from './icons';
const page = ref<string | null>(null);
const search = ref<string>('');
const airplane = ref<boolean>(false);
const wifi = ref<boolean>(true);
const bluetooth = ref<boolean>(true);
const cellular = ref<boolean>(true);
const lowPower = ref<boolean>(false);
const dark = ref<boolean>(false);
const brightness = ref<number>(70);
const notifications = ref<boolean>(true);
const previews = ref<boolean>(true);
const focus = ref<boolean>(false);
const network = ref<string>('Chai-Fi');
const autoBrightness = ref<boolean>(true);
const analytics = ref<boolean>(false);
const wallpaper = ref<number>(0);
const toggleValues = computed<Record<string, boolean>>(() => ({
    'Airplane Mode': airplane.value,
    'Low Power Mode': lowPower.value,
    'Allow Notifications': notifications.value,
    'Show Previews': previews.value,
    'Bluetooth': bluetooth.value,
    'Cellular Data': cellular.value,
    'Focus': focus.value,
    'Share Analytics': analytics.value
}));
const groups = [
    [
        {
            name: 'Airplane Mode',
            icon: 'airplane',
            color: '#ff9500',
            toggle: true
        },
        {
            name: 'Wi-Fi',
            icon: 'wifi',
            color: '#007aff',
            detail: 'network'
        },
        {
            name: 'Bluetooth',
            icon: 'bluetooth',
            color: '#007aff',
            detail: 'On'
        },
        {
            name: 'Cellular',
            icon: 'cellular',
            color: '#34c759',
            detail: 'On'
        },
        {
            name: 'Battery',
            icon: 'battery',
            color: '#34c759'
        }
    ],
    [
        {
            name: 'General',
            icon: 'gear',
            color: '#8e8e93'
        },
        {
            name: 'Display & Brightness',
            icon: 'sun',
            color: '#007aff'
        },
        {
            name: 'Wallpaper',
            icon: 'grid',
            color: '#55babc'
        }
    ],
    [
        {
            name: 'Notifications',
            icon: 'bell',
            color: '#ff3b30'
        },
        {
            name: 'Focus',
            icon: 'moon',
            color: '#5856d6'
        },
        {
            name: 'Screen Time',
            icon: 'clock',
            color: '#5856d6'
        }
    ],
    [{
            name: 'Privacy',
            icon: 'heart',
            color: '#007aff'
        }, {
            name: 'About',
            icon: 'gear',
            color: '#8e8e93'
        }]
];
const visibleGroups = computed(() => groups.map(group => group.filter(row => row.name.toLowerCase().includes(search.value.toLowerCase()))).filter(group => group.length));
const networks = [
    'Chai-Fi',
    'Pretty Fly for a Wi-Fi',
    '404 Network Not Found',
    'LAN Before Time',
    'The Router Next Door'
];
const hours = [
    65,
    55,
    48,
    40,
    38,
    35,
    24,
    18,
    29,
    42,
    54,
    68,
    73,
    66,
    61,
    55,
    51,
    45,
    36,
    30,
    27,
    23,
    20,
    18
];
const screenBars = [
    38,
    56,
    45,
    83,
    67,
    95,
    73
];
const infoRows = [
    ['Name', "Mohith’s iPhone"],
    ['Software Version', 'iOS-ish 26.0'],
    ['Model Name', 'Pocket Lab Pro (imaginary)'],
    ['Processor', 'One very optimistic hamster'],
    ['Capacity', 'Enough for another screenshot'],
    ['Serial Number', 'DEFINITELY-NOT-A-REAL-DEVICE'],
    ['Warranty', 'Until the next quick change']
];
function toggle(name: string) {
    if (name === 'Airplane Mode')
        airplane.value = !airplane.value;
    else if (name === 'Low Power Mode')
        lowPower.value = !lowPower.value;
    else if (name === 'Allow Notifications')
        notifications.value = !notifications.value;
    else if (name === 'Show Previews')
        previews.value = !previews.value;
    else if (name === 'Bluetooth')
        bluetooth.value = !bluetooth.value;
    else if (name === 'Cellular Data')
        cellular.value = !cellular.value;
    else if (name === 'Focus')
        focus.value = !focus.value;
    else if (name === 'Share Analytics')
        analytics.value = !analytics.value;
}
function detail(name: string) {
    if (name === 'Wi-Fi') return !wifi.value ? 'Off' : airplane.value ? 'Airplane Mode' : network.value;
    if (name === 'Bluetooth') return bluetooth.value ? 'On' : 'Off';
    if (name === 'Cellular') return cellular.value ? 'On' : 'Off';
    return '';
}
</script>

<template>
  <div class="app">
    <header class="top glass">
      <template v-if="page">
        <div class="bar detail-bar">
          <button class="back" @click="page=null">
            <svg viewBox="0 0 24 24">
              <path :d="icons.back" />
            </svg>
            Settings
          </button>
          <h3>{{ page }}</h3>
          <span class="balance" />
        </div>
      </template>
      <template v-else>
        <h1>Settings</h1>
        <input v-model="search" class="search" aria-label="Search settings" placeholder="Search" />
      </template>
    </header>
    <main class="scroll content">
      <template v-if="!page">
        <button v-if="!search" class="profile group" @click="page='Profile'">
          <span class="profile-avatar">M</span>
          <div>
            <h2>Mohith's iPhone</h2>
            <p>Pocket Lab Account, iCloud &amp; more</p>
          </div>
          <AppGlyph name="chevron" />
        </button>
        <div v-for="(group,i) in visibleGroups" :key="i" class="group">
          <template v-for="row in group" :key="row.name">
            <button
              v-if="row.toggle"
              class="row"
              role="switch"
              :aria-checked="airplane"
              @click="toggle(row.name)"
            >
              <span class="setting-icon" :style="{background:row.color}">
                <svg viewBox="0 0 24 24">
                  <path :d="icons[row.icon]" />
                </svg>
              </span>
              <span class="row-title">{{ row.name }}</span>
              <span class="switch" :class="{on:airplane}">
                <i />
              </span>
            </button>
            <button v-else class="row" @click="page=row.name">
              <span class="setting-icon" :style="{background:row.color}">
                <svg viewBox="0 0 24 24">
                  <path :d="icons[row.icon]" />
                </svg>
              </span>
              <span class="row-title">{{ row.name }}</span>
              <small>{{ detail(row.name) }}</small>
              <AppGlyph name="chevron" />
            </button>
          </template>
        </div>
        <p v-if="!visibleGroups.length" class="empty">No settings found.</p>
        <p class="footnote">A simulated iPhone. Realistically many settings.</p>
      </template>
      <template v-else-if="page==='Wi-Fi'">
        <div class="group">
          <button class="row" role="switch" :aria-checked="wifi" @click="wifi=!wifi">
            <span class="row-title">Wi-Fi</span>
            <span class="switch" :class="{on:wifi}">
              <i />
            </span>
          </button>
          <div v-if="wifi && !airplane" class="row current-network">
            <svg viewBox="0 0 24 24">
              <path :d="icons.check" />
            </svg>
            <span class="row-title">{{ network }}</span>
            <AppGlyph name="wifi" />
          </div>
        </div>
        <p class="footnote">
          {{ airplane
              ?'Airplane Mode is on. The routers can have a moment.'
              :wifi
              ?'Connected to a network with a promising name.'
              :'Wi-Fi is off. Enjoy a brief reduction in notifications.' }}
        </p>
        <template v-if="wifi && !airplane">
          <h3 class="section-label">Networks</h3>
          <div class="group">
            <button v-for="name in networks.filter(n=>n!==network)" :key="name" class="row" @click="network=name">
              <span class="row-title">{{ name }}</span>
              <small>⌁</small>
              <span class="info">i</span>
            </button>
          </div>
          <p class="footnote">Tap a network to pretend to connect. No passwords required.</p>
        </template>
      </template>
      <template v-else-if="page==='Battery'">
        <div class="group chart-card">
          <h2>Last 24 Hours</h2>
          <p class="muted">Last charged to 100% · this morning, in theory</p>
          <div class="battery-summary">
            <strong>
              78
              <span>%</span>
            </strong>
            <p>
              Still more energy than
              <br />
              the developer.
            </p>
          </div>
          <h3 class="section-label">Battery level</h3>
          <div class="battery-chart">
            <i
              v-for="(value,i) in hours"
              :key="i"
              :style="{height:value+'%',background:lowPower?'#ffd60a':'#34c759'}"
             />
          </div>
          <div class="axis">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
          </div>
        </div>
        <div class="group">
          <button class="row" role="switch" :aria-checked="lowPower" @click="toggle('Low Power Mode')">
            <span class="row-title">Low Power Mode</span>
            <span class="switch" :class="{on:lowPower}">
              <i />
            </span>
          </button>
        </div>
        <h3 class="section-label">Battery usage by app</h3>
        <div class="group">
          <div
            v-for="(row,i) in [['Overthinking','42%'],['Chai logistics','28%'],['Actual coding','20%'],['Finding the charger','10%']]"
            :key="i"
            class="row"
          >
            <span class="row-title">{{ row[0] }}</span>
            <small>{{ row[1] }}</small>
          </div>
        </div>
        <p class="footnote">All battery figures are invented for this simulation.</p>
      </template>
      <template v-else-if="page==='Screen Time'">
        <div class="group chart-card">
          <p class="muted">DAILY AVERAGE · SIMULATED</p>
          <h1 class="screen-total">8h 12m</h1>
          <p class="muted">A very productive relationship with a rectangle.</p>
          <div class="screen-chart">
            <div v-for="(value,i) in screenBars" :key="i">
              <i :style="{height:value+'%'}" />
              <span>{{ ['M','T','W','T','F','S','S'][i] }}</span>
            </div>
          </div>
        </div>
        <h3 class="section-label">Most used</h3>
        <div class="group">
          <div
            v-for="(row,i) in [['Checking the build','3h 10m'],['Looking for a bug','2h 42m'],['Comparing chai places','1h 20m'],['Ignoring Screen Time','1h']]"
            :key="i"
            class="row"
          >
            <span class="row-title">{{ row[0] }}</span>
            <small>{{ row[1] }}</small>
          </div>
        </div>
        <p class="footnote">No actual activity is tracked. The embarrassment is handcrafted.</p>
      </template>
      <template v-else-if="page==='About'">
        <div class="group">
          <div v-for="row in infoRows" :key="row[0]" class="spec-row">
            <span>{{ row[0] }}</span>
            <small>{{ row[1] }}</small>
          </div>
        </div>
        <p class="footnote">Made-up specifications for a made-up phone.</p>
      </template>
      <template v-else-if="page==='Display & Brightness'">
        <h3 class="section-label">Appearance</h3>
        <div class="group appearance">
          <button
            v-for="appearance in ['Light','Dark']"
            :key="appearance"
            :aria-pressed="dark===(appearance==='Dark')"
            @click="dark=appearance==='Dark'"
          >
            <div class="preview" :class="{dark:appearance==='Dark'}">
              <div class="preview-island" />
              <i />
              <i />
              <i />
              <div class="preview-controls" />
            </div>
            <span>{{ appearance }}</span>
            <b class="radio" :class="{checked:dark===(appearance==='Dark')}">{{ dark===(appearance==='Dark')?'✓':'' }}</b>
          </button>
        </div>
        <div
          class="live-preview"
          :class="{dark}"
          :style="{filter:'brightness('+(0.4+brightness/100*0.6)+')'}"
        >
          <span>9:41</span>
          <h3>{{ dark?'A quieter evening.':'A brighter outlook.' }}</h3>
          <p>Your appearance preview</p>
        </div>
        <h3 class="section-label">Brightness</h3>
        <div class="group brightness">
          <svg viewBox="0 0 24 24">
            <path :d="icons.sun" />
          </svg>
          <input v-model.number="brightness" type="range" min="0" max="100" aria-label="Display brightness" />
          <svg viewBox="0 0 24 24">
            <path :d="icons.sun" />
          </svg>
        </div>
        <div class="group">
          <button
            class="row"
            role="switch"
            :aria-checked="autoBrightness"
            @click="autoBrightness=!autoBrightness"
          >
            <span class="row-title">Automatic</span>
            <span class="switch" :class="{on:autoBrightness}">
              <i />
            </span>
          </button>
        </div>
        <p class="footnote">Appearance and brightness update the preview above.</p>
      </template>
      <template v-else-if="page==='Notifications'">
        <div class="notification-preview glass">
          <span class="setting-icon">⌘</span>
          <div>
            <h3>Pocket Lab</h3>
            <p>
              {{ notifications?'Your quick change has become an afternoon.':'A rare moment of silence.' }}
            </p>
          </div>
          <small>now</small>
        </div>
        <div class="group">
          <button
            v-for="name in ['Allow Notifications','Show Previews']"
            :key="name"
            class="row"
            role="switch"
            :aria-checked="toggleValues[name]"
            @click="toggle(name)"
          >
            <span class="row-title">{{ name }}</span>
            <span class="switch" :class="{on:toggleValues[name]}">
              <i />
            </span>
          </button>
        </div>
        <h3 class="section-label">Notification style</h3>
        <div class="group">
          <div v-for="name in ['Messages','WhatsApp','Slack','Clock']" :key="name" class="row">
            <span class="row-title">{{ name }}</span>
            <small>{{ notifications?'Banners, gently':'Off' }}</small>
          </div>
        </div>
        <p class="footnote">
          These controls change this preview. Shell timer banners stay independent.
        </p>
      </template>
      <template v-else-if="page==='Wallpaper'">
        <div class="wallpapers">
          <button
            v-for="(bg,i) in ['linear-gradient(135deg,#b8d4cb,#687b96)','linear-gradient(135deg,#e9c29d,#ad798f)','linear-gradient(135deg,#6f769e,#313746)']"
            :key="bg"
            :style="{background:bg}"
            :aria-label="'Select wallpaper '+(i+1)"
            :aria-pressed="wallpaper===i"
            @click="wallpaper=i"
          >
            <span>9:41</span>
            <b>{{ wallpaper===i?'✓':'' }}</b>
          </button>
        </div>
        <p class="footnote">Choose a little colour for this imaginary collection.</p>
      </template>
      <template v-else-if="page==='General'">
        <div class="group">
          <button
            v-for="name in ['About','Display & Brightness','Battery','Screen Time']"
            :key="name"
            class="row"
            @click="page=name"
          >
            <span class="row-title">{{ name }}</span>
            <AppGlyph name="chevron" />
          </button>
        </div>
        <div class="group">
          <div class="row">
            <span class="row-title">Software Update</span>
            <small>Optimism is up to date</small>
          </div>
          <div class="row">
            <span class="row-title">iPhone Storage</span>
            <small>Mostly screenshots</small>
          </div>
        </div>
      </template>
      <template v-else-if="page==='Profile'">
        <div class="profile-detail">
          <span class="profile-avatar">M</span>
          <h1>Mohith</h1>
          <p>Pocket Lab Account</p>
        </div>
        <div class="group">
          <div
            v-for="name in ['Personal Information','Sign-In & Security','iCloud: imagination tier','Subscriptions: chai, emotionally']"
            :key="name"
            class="row"
          >
            <span class="row-title">{{ name }}</span>
          </div>
        </div>
        <p class="footnote">No real account details. No personal data.</p>
      </template>
      <template v-else>
        <div class="group">
          <button
            class="row"
            role="switch"
            :aria-checked="toggleValues[page==='Cellular'?'Cellular Data':page==='Privacy'?'Share Analytics':page]"
            @click="toggle(page==='Cellular'?'Cellular Data':page==='Privacy'?'Share Analytics':page)"
          >
            <span class="row-title">
              {{ page==='Cellular'?'Cellular Data':page==='Privacy'?'Share Analytics':page }}
            </span>
            <span
              class="switch"
              :class="{on:toggleValues[page==='Cellular'?'Cellular Data':page==='Privacy'?'Share Analytics':page]}"
            >
              <i />
            </span>
          </button>
        </div>
        <p class="footnote">
          {{ page==='Focus'
              ?'Deep Work: fewer interruptions, same number of tabs.'
              :page==='Bluetooth'
              ?'Nearby device: The Other Earbud. Still looking for the first one.'
              :page==='Privacy'
              ?'Everything lives in memory. Even analytics is imaginary.'
              :'Carrier: Eventually Mobile. Excellent coverage of excuses.' }}
        </p>
      </template>
    </main>
  </div>
</template>

<style scoped>
.app {
  position: absolute;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  letter-spacing: -.02em;
  font-size: 17px;
  isolation: isolate;
}

.app * {
  box-sizing: border-box;
}

button, input, textarea {
  font: inherit;
  letter-spacing: inherit;
}

button {
  cursor: pointer;
  border: 0;
  background: none;
  color: inherit;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  touch-action: manipulation;
  transition: transform 250ms ease, opacity 250ms ease;
}

button:active {
  transform: scale(.96);
}

button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid #4d9fff;
  outline-offset: 2px;
}

button:disabled {
  opacity: .45;
  cursor: default;
}

input, textarea {
  font-size: 16px;
  min-height: 44px;
  color: inherit;
  border: 0;
  outline: none;
}

h1, h2, h3, p {
  margin: 0;
}

h1 {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -.035em;
}

h2 {
  font-size: 22px;
  font-weight: 700;
}

h3 {
  font-size: 17px;
  font-weight: 600;
}

svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.scroll {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  min-height: 0;
}

.scroll::-webkit-scrollbar {
  display: none;
}

.glass {
  backdrop-filter: blur(25px) saturate(180%);
  border: 1px solid rgba(255,255,255,.35);
}

.top {
  padding: var(--safe-top,62px) 20px 12px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.icon {
  display: grid;
  place-items: center;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  padding: 10px;
}

.muted {
  color: #8e8e93;
  font-size: 13px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  gap: 2px;
  flex-shrink: 0;
  padding: 8px 10px var(--safe-bottom,34px);
  background: rgba(249,249,250,.85);
  backdrop-filter: blur(25px) saturate(180%);
  border-top: 1px solid rgba(0,0,0,.08);
}

.tabs button {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  min-height: 52px;
  border-radius: 22px;
  color: #8e8e93;
}

.tabs button.active {
  color: var(--accent,#007aff);
  background: rgba(127,127,127,.1);
}

.pill {
  border-radius: 24px;
  padding: 8px 16px;
}

.empty {
  padding: 44px 24px;
  text-align: center;
  color: #8e8e93;
  line-height: 1.5;
}

.search {
  width: 100%;
  background: rgba(127,127,127,.12);
  border-radius: 14px;
  padding: 10px 14px;
}

.section-label {
  font-size: 13px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: .03em;
  padding: 22px 16px 8px;
}

.hairline {
  border-bottom: 1px solid rgba(127,127,127,.18);
}

@media(prefers-reduced-motion:reduce) {
  .app *, .app *::before, .app *::after {
    animation: none!important;
    transition: none!important;
    scroll-behavior: auto!important;
  }
}

.app {
  background: #f2f2f7;
  color: #19191b;
}

.top {
  background: #f2f2f7dc;
  border: 0;
  padding-bottom: 18px;
}

.top .search {
  margin-top: 20px;
}

.top .bar h3 {
  font-size: 17px;
  white-space: nowrap;
}

.back {
  display: flex;
  align-items: center;
  color: #007aff;
  font-size: 16px;
  gap: 1px;
  padding-left: 0;
}

.balance {
  width: 90px;
}

.content {
  flex: 1;
  padding: 0 20px var(--safe-bottom,34px);
}

.group {
  background: #fff;
  border-radius: 13px;
  overflow: hidden;
  margin: 20px 0;
}

.group:first-child {
  margin-top: 8px;
}

.profile {
  width: 100%;
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 18px 14px;
  text-align: left;
}

.profile>div {
  flex: 1;
}

.profile h2 {
  font-size: 21px;
}

.profile p {
  font-size: 12px;
  margin-top: 6px;
  color: #555;
}

.profile-avatar {
  display: grid;
  place-items: center;
  width: 65px;
  height: 65px;
  border-radius: 50%;
  font-size: 28px;
  color: #fff;
  background: linear-gradient(145deg,#b0b7c2,#8c96a5);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  width: 100%;
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid #0000000d;
}

.row:last-child {
  border-bottom: 0;
}

.row-title {
  flex: 1;
  font-size: 17px;
}

.row>small {
  color: #8e8e93;
  font-size: 15px;
}

.row>b, .profile>b {
  font-size: 23px;
  color: #c7c7cc;
  font-weight: 400;
}

.setting-icon {
  width: 29px;
  height: 29px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: #fff;
  background: #ff9f0a;
  flex-shrink: 0;
}

.setting-icon svg {
  width: 19px;
  height: 19px;
  stroke-width: 1.8;
}

.switch {
  position: relative;
  width: 51px;
  height: 31px;
  background: #e6e6e9;
  border-radius: 20px;
  flex-shrink: 0;
  transition: transform 250ms ease, opacity 250ms ease;
}

.switch i {
  width: 27px;
  height: 27px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  box-shadow: 0 2px 4px #0002;
  transition: transform 250ms ease, opacity 250ms ease;
}

.switch.on {
  background: #34c759;
}

.switch.on i {
  transform: translateX(20px);
}

.footnote {
  color: #8e8e93;
  font-size: 13px;
  line-height: 1.5;
  padding: 0 12px;
  margin: 12px 0 26px;
}

.section-label {
  padding: 12px 14px 0;
}

.current-network svg {
  color: #007aff;
  width: 20px;
  height: 20px;
}

.info {
  border: 1px solid #007aff;
  border-radius: 50%;
  color: #007aff;
  width: 22px;
  height: 22px;
  text-align: center;
  font-size: 15px;
}

.chart-card {
  padding: 20px 16px;
}

.chart-card h2 {
  font-size: 18px;
  margin-bottom: 8px;
}

.battery-summary {
  display: flex;
  gap: 22px;
  align-items: center;
  margin: 24px 0;
}

.battery-summary strong {
  font-size: 54px;
  color: #34c759;
  font-weight: 500;
}

.battery-summary strong span {
  font-size: 29px;
}

.battery-summary p {
  font-size: 13px;
  color: #aaa;
  line-height: 1.5;
}

.battery-chart {
  height: 130px;
  display: flex;
  gap: 4px;
  align-items: flex-end;
  border-bottom: 1px solid #0002;
  background: repeating-linear-gradient(to top,transparent 0,transparent 31px,#00000009 32px,#00000009 33px);
  margin-top: 15px;
}

.battery-chart i {
  flex: 1;
  border-radius: 3px 3px 0 0;
  min-height: 5px;
}

.axis {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

.screen-total {
  margin: 12px 0;
}

.screen-chart {
  height: 190px;
  display: flex;
  gap: 14px;
  margin-top: 25px;
  align-items: flex-end;
  padding-bottom: 25px;
  background: repeating-linear-gradient(to top,transparent 0,transparent 42px,#00000008 43px,#00000008 44px);
}

.screen-chart>div {
  height: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-direction: column;
  position: relative;
}

.screen-chart i {
  width: 100%;
  background: linear-gradient(to top,#588eea 0 50%,#42b9c9 50% 80%,#edab58 80%);
  border-radius: 5px 5px 0 0;
}

.screen-chart span {
  position: absolute;
  bottom: -22px;
  color: #888;
  font-size: 12px;
}

.spec-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 17px 16px;
  border-bottom: 1px solid #0000000c;
}

.spec-row>span {
  font-size: 16px;
}

.spec-row small {
  color: #8e8e93;
  font-size: 14px;
}

.appearance {
  display: flex;
  justify-content: center;
  gap: 45px;
  padding: 25px;
}

.appearance button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 16px;
}

.preview {
  width: 94px;
  height: 172px;
  border: 3px solid #a4a8b0;
  border-radius: 18px;
  background: #eeeff5;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  position: relative;
}

.preview-island {
  width: 32px;
  height: 9px;
  background: #222;
  border-radius: 8px;
  margin: 0 auto 9px;
}

.preview i {
  height: 16px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 0 1px #aaa;
}

.preview-controls {
  height: 40px;
  background: #fff8;
  border-radius: 8px;
  margin-top: auto;
}

.preview.dark {
  background: #171c2b;
  border-color: #555;
}

.preview.dark i {
  background: #373c4a;
}

.preview.dark .preview-controls {
  background: #373c4a;
}

.radio {
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid #ccc;
  width: 22px;
  height: 22px;
  font-size: 14px;
  font-weight: 400;
}

.radio.checked {
  background: #007aff;
  border-color: #007aff;
  color: #fff;
}

.live-preview {
  padding: 24px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: linear-gradient(135deg,#e7e9f7,#d4dfeb);
  color: #333;
  margin-bottom: 20px;
  transition: transform 250ms ease, opacity 250ms ease;
}

.live-preview>span {
  font-size: 25px;
  font-weight: 600;
}

.live-preview h3 {
  margin-top: 16px;
}

.live-preview p {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 6px;
}

.live-preview.dark {
  background: linear-gradient(135deg,#263451,#181c29);
  color: #fff;
}

.brightness {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  color: #8e8e93;
}

.brightness input {
  min-width: 0;
  flex: 1;
  accent-color: #007aff;
}

.brightness svg:first-child {
  width: 18px;
  height: 18px;
}

.notification-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 20px;
  background: #ffffffb3;
  padding: 16px;
  margin: 25px 0;
  box-shadow: 0 5px 22px #0000000b;
}

.notification-preview>div {
  flex: 1;
}

.notification-preview h3 {
  font-size: 14px;
}

.notification-preview p {
  font-size: 13px;
  line-height: 1.4;
  margin-top: 3px;
}

.notification-preview>small {
  font-size: 12px;
  color: #aaa;
}

.wallpapers {
  display: flex;
  gap: 12px;
  margin: 30px 0;
}

.wallpapers button {
  height: 270px;
  flex: 1;
  min-width: 0;
  border-radius: 22px;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 25px 10px;
}

.wallpapers span {
  font-size: 25px;
  font-weight: 600;
}

.wallpapers b {
  height: 24px;
  font-size: 20px;
}

.profile-detail {
  text-align: center;
  padding: 25px;
}

.profile-detail .profile-avatar {
  margin: 0 auto 18px;
  width: 88px;
  height: 88px;
  font-size: 40px;
}

.profile-detail p {
  font-size: 14px;
  color: #888;
  margin-top: 10px;
}

.app {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  container-type: size;
  min-width: 0;
  min-height: 0;
}

.app :deep(*) {
  font-family: inherit;
  box-sizing: border-box;
}

button, a[download] {
  min-width: 44px;
  min-height: 44px;
  touch-action: manipulation;
  transition: transform 220ms ease, opacity 220ms ease;
}

button:active:not(:disabled), a[download]:active {
  transform: scale(.96);
}

button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 3px solid var(--accent, #007aff);
  outline-offset: 3px;
}

.icon, .tool, .glass-round, .round, .go, .send {
  flex-shrink: 0;
}

.scroll, .scroller, .feed, .page, .tiles {
  min-width: 0;
  min-height: 0;
  overscroll-behavior: contain;
}

.tabs button {
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
}

@media (hover: hover) {
  button:hover:not(:disabled), a[download]:hover {
    opacity: .82;
  }
}

@media (pointer: coarse) {
  button, a[download] {
    min-width: 58px;
    min-height: 58px;
  }
  .tabs button {
    min-width: 0;
    min-height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app :deep(*), .app :deep(*::before), .app :deep(*::after) {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
}

.top {
  flex-shrink: 0;
}

.detail-bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.detail-bar .back {
  justify-self: start;
}

.detail-bar h3 {
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
}

.detail-bar .balance {
  width: auto;
}

.profile-avatar {
  flex-shrink: 0;
}

.profile > div, .row-title {
  min-width: 0;
}

.row-title {
  overflow-wrap: anywhere;
}

.row > small {
  flex-shrink: 0;
  max-width: 40%;
  text-align: right;
  overflow-wrap: anywhere;
}

.row > small, .footnote, .profile-detail p {
  color: #64646b;
}

.preview {
  width: min(94px, 25cqw);
}

.wallpapers button {
  height: clamp(190px, 32cqh, 270px);
}

@container (max-width: 380px) {
  .detail-bar {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .detail-bar h3 {
    text-align: right;
  }
  .detail-bar .balance {
    display: none;
  }
  .content {
    padding-inline: 16px;
  }
  .profile {
    gap: 10px;
  }
  .profile-avatar {
    width: 54px;
    height: 54px;
  }
  .profile h2 {
    font-size: 19px;
  }
}
</style>
