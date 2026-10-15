<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { listenAsApp } from '../bus';
import { VISION_APPS, VISION_ENVIRONMENTS } from '../vision';
import { vHover } from '../kit/hover';
import ToggleRow from './settings/ToggleRow.vue';
import SliderRow from './settings/SliderRow.vue';
import DeviceArt from './settings/DeviceArt.vue';
import PersonaArt from './settings/PersonaArt.vue';
import { useSettingsState } from './settings/useSettingsState';
import ControlIcon from './freeform/ControlIcon.vue';

defineProps<{ compact?: boolean }>();
const {
    vision,
    settingsRoot,
    confirmId,
    categories,
    generalPages,
    page,
    query,
    contentActive,
    selectedApp,
    notificationApp,
    category,
    searchable,
    environment,
    immersion,
    transparency,
    dark,
    sound,
    travel,
    guest,
    guestAccess,
    guestDuration,
    awareness,
    breakthrough,
    showEyes,
    previewPerson,
    pointerSize,
    contrast,
    reduceMotion,
    textSize,
    brightness,
    displaySize,
    volume,
    feedback,
    audioOutput,
    previewSound,
    focus,
    focusSchedule,
    allowedPeople,
    focusDuration,
    notifications,
    previewStyle,
    appNotifications,
    appBanners,
    appCaches,
    offloaded,
    backgroundRefresh,
    crown,
    palm,
    upwardGaze,
    showBattery,
    lowPower,
    optimiseCharging,
    autoUpdates,
    updateState,
    calibrationStep,
    calibrationDone,
    pinchCount,
    dominantHand,
    enrolled,
    enrolling,
    opticUnlock,
    passcode,
    personaStep,
    personaReady,
    personaCapturing,
    glasses,
    personaBackground,
    status,
    confirmation,
    cancelButton,
    pageHeading,
    app,
    notification,
    here,
    cacheTotal,
    storage,
    usedStorage,
    calibrationLines,
    personaLines,
    rootStyle,
    navigate,
    back,
    announce,
    collectionKeys,
    chooseEnvironment,
    thumbError,
    checkUpdate,
    calibrate,
    enroll,
    capturePersona,
    soundPreview,
    confirm,
    cancelConfirmation,
    acceptConfirmation,
    modalKeys,
    openApp,
    reset
} = useSettingsState();
const batteryPeriod = ref<'24 hours' | '10 days'>('24 hours');
const batteryHour = ref<number | null>(null);
const batteryLevels = computed(() => batteryPeriod.value === '24 hours'
  ? [96,94,91,89,86,82,78,75,73,100,87,71]
  : [92,78,84,62,90,73,85,68,82,71]);
const batteryActivity = computed(() => batteryPeriod.value === '24 hours'
  ? [12,5,0,0,4,13,28,36,22,8,31,24] : [38,52,46,65,32,54,43,61,45,49]);
const batteryApps = [
  { name: 'TV', value: 38, color: '#71b4f5', detail: '48 min · Immersive viewing' },
  { name: 'Safari', value: 26, color: '#9bd7ce', detail: '34 min · Browsing' },
  { name: 'Freeform', value: 21, color: '#f3d58c', detail: '27 min · On screen' },
  { name: 'Other apps', value: 15, color: '#c1b0e4', detail: '19 min · On screen' },
];
function jarvisMatch(value: string): string {
  return value.toLowerCase().replace(/\b(the|my)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}
// JARVIS can work in Settings: open, reduce_transparency_on/off, reduce_motion_on/off, dark_mode_on/off, sound_on/off, increase_contrast_on/off, low_power_on/off.
const stopJarvis = listenAsApp('settings', async command => {
    let line = "I can't do that in Settings yet.";
    try {
        await nextTick();
        if (command.verb === 'open') {
            const term = jarvisMatch(typeof command.arg === 'string' ? command.arg : '');
            const aliases: Record<string, string> = { appearance: 'Environments', display: 'Displays', sound: 'Sounds', audio: 'Sounds' };
            const destinations = [...categories.map(item => item.id), ...generalPages];
            const destination = term ? aliases[term] ?? destinations.find(item => jarvisMatch(item) === term)
                ?? destinations.find(item => jarvisMatch(item).includes(term)) : undefined;
            if (destination) {
                query.value = '';
                await navigate(destination);
                line = 'Opened ' + destination + ' settings.';
            } else line = "I couldn't find that section in Settings.";
        } else {
            const toggles = [
                { verb: 'reduce_transparency', value: transparency, label: 'Reduce Transparency' },
                { verb: 'reduce_motion', value: reduceMotion, label: 'Reduce Motion' },
                { verb: 'dark_mode', value: dark, label: 'Dark Appearance' },
                { verb: 'sound', value: sound, label: 'Environment Sound' },
                { verb: 'increase_contrast', value: contrast, label: 'Increase Contrast' },
                { verb: 'low_power', value: lowPower, label: 'Low Power Mode' },
            ];
            const toggle = toggles.find(item => command.verb === item.verb + '_on' || command.verb === item.verb + '_off');
            if (toggle) {
                toggle.value.value = command.verb === toggle.verb + '_on';
                line = 'Turned ' + (toggle.value.value ? 'on ' : 'off ') + toggle.label + '.';
            }
        }
    } catch { line = "I couldn't finish that in Settings."; }
    try { (command.reply as ((line: string) => void) | undefined)?.(line); } catch { /* A reply must not interrupt the app. */ }
});
onBeforeUnmount(() => stopJarvis());
</script>

<template>
<div
  ref="settingsRoot" class="settings-root"
  :class="{
    'content-active': contentActive,
    'high-contrast': contrast,
    'reduced-motion': reduceMotion,
    'reduced-transparency': transparency
  }"
  :style="rootStyle">
  <div class="workspace" :inert="confirmation ? true : undefined">
    <aside class="sidebar vk-platter">
      <header class="sidebar-title">
        <h1>Settings</h1>
        <span class="vk-chip">Demo</span>
      </header>
      <label class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5"/>
          <path d="m15 15 5 5"/>
        </svg>
        <input v-hover v-model="query" class="vk-field" type="search" placeholder="Search Settings" aria-label="Search Settings" />
      </label>
      <nav class="category-list vk-scroll" aria-label="Settings categories" @keydown="collectionKeys">
        <button
          v-for="item in searchable" :key="item.id" v-hover class="vk-row category" :aria-current="page === item.id ? 'page' : undefined"
          :class="{ selected: query ? page === item.id : category === item.id }" @click="navigate(item.id)">
          <span class="category-icon" :style="{ background: item.color }" aria-hidden="true"><ControlIcon :name="item.parent || item.id" /></span>
          <span>
            {{ item.id }}
            <small v-if="item.parent">{{ item.parent }}</small>
          </span>
          <ControlIcon class="nav-chevron" name="chevron" />
        </button>
        <p v-if="!searchable.length" class="empty">No settings match “{{ query }}”.</p>
      </nav>
      <p class="sidebar-foot">Personalize your spatial workspace.</p>
    </aside>
    <main class="detail">
      <header class="detail-header">
        <button v-hover class="vk-button back-button" :class="{ subpage: generalPages.includes(page) }" @click="back">
          <ControlIcon name="back" />
          {{ generalPages.includes(page) ? 'General' : 'Settings' }}
        </button>
        <h2 ref="pageHeading" tabindex="-1">{{ page }}</h2>
        <span v-if="page === 'General'" class="header-subtitle">Your spatial setup</span>
      </header>
      <div :key="page" class="detail-body vk-scroll">
        <div class="page-inner">
          <template v-if="page === 'General'">
            <div class="device-hero vk-platter">
              <DeviceArt /><div><span class="device-kicker">PERSONAL DEVICE · DEMO</span><h3>Apple Vision Pro</h3><p>visionOS 27 · Your spatial workspace</p><span class="device-ready"><i /> Ready to explore</span></div>
            </div>
            <div class="device-summary"><button v-hover class="vk-platter" @click="navigate('Battery')"><ControlIcon name="Battery" /><span><strong>71%</strong><small>Battery · simulated</small></span></button><button v-hover class="vk-platter" @click="navigate('Storage')"><ControlIcon name="Storage" /><span><strong>{{ usedStorage.toFixed(1) }} GB</strong><small>of 256 GB used</small></span></button></div>
            <div class="general-links">
              <button v-for="item in generalPages" :key="item" v-hover class="vk-row disclosure vk-platter" @click="navigate(item)">
                <span>{{ item }}</span>
                <span class="row-tail">
                  {{ item === 'Software Update'
                    ? '27.0.1'
                    : item === 'Storage'
                    ? usedStorage.toFixed(1)
                    + ' GB'
                    : item === 'Travel Mode'
                    ? travel
                    ? 'On'
                    : 'Off'
                    : item === 'Guest User'
                    ? guest
                    ? 'Active'
                    : 'Off'
                    : '' }}
                  <ControlIcon class="disclosure-chevron" name="chevron" />
                </span>
              </button>
            </div>
            <p class="footnote">Settings live in this headset session. Device data and account features are a playful simulation.</p>
          </template>
          <template v-else-if="page === 'About'">
            <div class="hero">
              <DeviceArt />
              <h3>Apple Vision Pro</h3>
              <p>Fan-made portfolio simulation</p>
            </div>
            <dl class="group vk-platter specs">
              <div>
                <dt>Model</dt>
                <dd>Apple Vision Pro with M5</dd>
              </div>
              <div>
                <dt>Chip</dt><dd>M5</dd>
              </div>
              <div>
                <dt>Headband</dt>
                <dd>Dual Knit Band</dd>
              </div>
              <div>
                <dt>visionOS reference</dt>
                <dd>27.0.1</dd>
              </div>
              <div>
                <dt>Demo capacity</dt>
                <dd>256 GB, simulated</dd>
              </div>
              <div>
                <dt>Demo serial</dt>
                <dd>CHAI-BEFORE-CODE</dd>
              </div>
            </dl>
            <button v-hover class="vk-row disclosure group vk-platter" @click="navigate('Credits')">
              <span>Credits & Ownership</span><b aria-hidden="true">›</b>
            </button>
          </template>
          <template v-else-if="page === 'Credits'">
            <h3 class="section-title">Credits & Ownership</h3>
            <div class="group vk-platter credit">
              <h4>Somewhere lovely, responsibly borrowed.</h4>
              <p>
                Earth environments use Poly Haven photographs licensed CC0. Earth and Jupiter textures use NASA public-domain imagery. The Moon scene is a
                procedural interpretation.
              </p>
              <p>
                App icons and interface illustrations are redrawn for this portfolio. Apple, Vision Pro, visionOS and other brands belong to their respective
                owners. This demo is independently made and is not affiliated with Apple.
              </p>
              <p>Account, biometric, storage and battery screens are simulations. No hardware readings or Apple services are connected.</p>
            </div>
          </template>
          <template v-else-if="page === 'Software Update'">
            <div class="hero">
              <span class="large-glyph" :class="{ spin: updateState === 'checking' }"><ControlIcon name="General" /></span>
              <h3>visionOS 27.0.1</h3>
              <p>Software reference for this portfolio demo</p>
            </div>
            <div class="update-result vk-platter" aria-live="polite">
              <span v-if="updateState === 'checking'" class="spinner" aria-hidden="true"/>
              <h3>{{ updateState === 'checking' ? 'Checking for updates…' : updateState === 'done' ? 'Your software reference is up to date.' : 'Ready when you are.' }}</h3>
              <p>
                {{ updateState === 'checking'
                  ? 'Checking the local demo reference.'
                  : updateState === 'done'
                  ? 'No update is available for this demonstration.'
                  : 'Run a simulated software check.' }}
              </p>
              <button v-hover class="vk-button primary" :disabled="updateState === 'checking'" @click="checkUpdate">
                {{ updateState === 'checking' ? 'Checking…' : updateState === 'done' ? 'Check Again' : 'Check for Updates' }}
              </button>
            </div>
            <div class="group vk-platter">
              <ToggleRow
                v-model="autoUpdates"
                label="Automatic Updates"
                :detail="autoUpdates ? 'The demo will remember your preference.' : 'You decide when to run the simulated check.'"
              />
            </div>
          </template>
          <template v-else-if="page === 'Travel Mode'">
            <div class="travel-art" :class="{ enabled: travel }" aria-hidden="true">
              <span class="cloud cloud-one"/>
              <span class="cloud cloud-two"/>
              <svg viewBox="0 0 160 100">
                <path d="m17 54 47-9 26-30 10 1-13 30 45 7 11-11 6 2-6 18-71 1-31 14-8-1 17-16-30-4Z" fill="currentColor"/>
              </svg>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="travel" label="Travel Mode" detail="Steady the demo while your imagination is in transit." />
            </div>
            <p class="notice">{{ travel ? 'Travel Mode is on. Your window is cleared for imaginary takeoff.' : 'Travel Mode is off. You are comfortably grounded.' }}</p>
            <p class="footnote">This changes the demo preference only. Your browser does not track vehicles or motion.</p>
          </template>
          <template v-else-if="page === 'Guest User'">
            <div class="hero">
              <span class="guest-art"><ControlIcon name="People Awareness" /></span>
              <h3>{{ guest ? 'Guest session active' : 'Share a little wonder.' }}</h3>
              <p>No sign-in. No borrowed identity.</p>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="guest" label="Guest User" :detail="guest ? 'A practice guest session is running.' : 'Allow a guest to explore this demo.'" />
              <div class="control-section">
                <h4>App Access</h4>
                <div class="vk-segmented" role="group" aria-label="Guest app access">
                  <button v-for="mode in ['Selected Apps', 'All Apps']" :key="mode" v-hover :aria-pressed="guestAccess === mode" @click="guestAccess = mode">{{ mode }}</button>
                </div>
                <p>
                  {{ guestAccess === 'All Apps'
                    ? 'Every demo app is available to your imaginary guest.'
                    : 'Photos, Mindfulness and Safari are selected for this practice session.' }}
                </p>
              </div>
              <div class="stepper-row">
                <span>
                  Session reminder
                  <small>A local preference, not an automatic lock.</small>
                </span>
                <div class="stepper">
                  <button v-hover class="vk-icon" :disabled="guestDuration <= 5" aria-label="Shorten guest reminder"
                    @click="guestDuration -= 5"><ControlIcon name="minus" /></button>
                  <output>{{ guestDuration }} min</output>
                  <button v-hover class="vk-icon" :disabled="guestDuration >= 60" aria-label="Extend guest reminder"
                    @click="guestDuration += 5"><ControlIcon name="plus" /></button>
                </div>
              </div>
            </div>
            <button
              v-hover class="vk-button primary wide-action"
              @click="guest = !guest; announce(guest ? 'Guest session started. Please leave the imaginary room tidy.' : 'Guest session ended. Welcome back.')">
              {{ guest ? 'End Guest Session' : 'Start Guest Session' }}
            </button>
          </template>
          <template v-else-if="page === 'Environments'">
            <p class="intro">Somewhere else, without the commute.</p>
            <div class="environment-grid" role="group" aria-label="Choose an environment" @keydown="collectionKeys">
              <button
                v-for="place in VISION_ENVIRONMENTS"
                :key="place.id"
                v-hover
                class="environment-card"
                :aria-pressed="environment === place.id"
                @click="chooseEnvironment(place.id)"
              >
                <span class="environment-thumbnail" :class="place.id">
                  <span v-if="place.id === 'room'" class="passthrough-art">
                    <span/>
                    <span/>
                    <span/>
                  </span>
                  <img v-else :src="'/vision/env/' + place.id + '-thumb.webp'" alt="" loading="lazy" draggable="false" @error="thumbError($event, place.id)"/>
                  <span v-if="environment === place.id" class="selection-check"><ControlIcon name="check" /></span>
                </span>
                <strong>{{ place.name }}</strong>
                <small>{{ place.line }}</small>
              </button>
            </div>
            <h3 class="section-title">{{ here.name }}</h3>
            <div class="group vk-platter">
              <SliderRow
                v-model="immersion" label="Immersion" :disabled="environment === 'room'"
                :detail="
                  environment === 'room'
                  ? 'Choose a scenic place to adjust immersion.'
                  : immersion === 0
                  ? 'Your room stays with you.'
                  : immersion < 75
                  ? 'Half here, half somewhere lovely.'
                  : 'Fully away. The commute cannot reach you.'
                "
/>
              <div class="control-section">
                <h4>Appearance</h4>
                <div class="vk-segmented" role="group" aria-label="Environment appearance">
                  <button v-hover :aria-pressed="!dark" @click="dark = false">Light</button>
                  <button v-hover :aria-pressed="dark" @click="dark = true">Dark</button>
                </div>
              </div>
              <ToggleRow
                v-model="sound"
                label="Environment Sound"
                :detail="environment === 'room' ? 'Choose a scenic place for ambient sound.' : 'Ambient sound follows the selected place.'"
              />
            </div>
            <p class="footnote">Scenic places use our own curated environment collection. Appearance and immersion affect the surrounding headset scene.</p>
          </template>
          <template v-else-if="page === 'Accessibility'">
            <div class="access-preview vk-well">
              <div class="sample-window" :class="{ solid: transparency }">
                <span class="preview-pointer" :style="{ width: pointerSize + 'px', height: pointerSize + 'px' }"/>
                <strong>Make yourself comfortable.</strong>
                <small>Every little adjustment counts.</small>
              </div>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="transparency" label="Reduce Transparency" detail="Use a steadier material throughout the headset." />
              <ToggleRow v-model="contrast" label="Increase Contrast" detail="Stronger edges and brighter secondary text in Settings." />
              <ToggleRow v-model="reduceMotion" label="Reduce Motion" detail="Pause decorative movement and shorten transitions in Settings." />
              <SliderRow v-model="pointerSize" label="Pointer Size" :min="16" :max="40" suffix=" px" detail="A circular pointer follows your mouse in Settings." />
              <SliderRow v-model="textSize" label="Text Size" :min="90" :max="125" suffix="%" detail="Preview a comfortable reading size in this app." />
            </div>
            <p class="footnote">
              Transparency applies to headset windows. Pointer, text, contrast and motion preferences apply locally to Settings. Your device's reduced-motion
              preference is also respected.
            </p>
          </template>
          <template v-else-if="page === 'Eyes & Hands'">
            <div class="calibration-stage vk-well" :class="{ running: calibrationStep >= 0 }">
              <span class="calibration-ring"/>
              <span v-for="dot in 5" :key="dot" class="gaze-dot" :class="['dot-' + dot, { active: calibrationStep === dot - 1 || (dot === 1 && calibrationStep < 0) }]"/>
            </div>
            <div class="centred-copy">
              <h3>{{ calibrationStep >= 0 ? calibrationLines[calibrationStep] : calibrationDone ? 'Perfectly calibrated. Allegedly.' : 'Let your eyes do the pointing.' }}</h3>
              <p aria-live="polite">
                {{ calibrationStep >= 0 ? 'Practice step ' + (calibrationStep + 1) + ' of 5' : 'An animated rehearsal, with no eye tracking or sensor access.' }}
              </p>
              <button v-hover class="vk-button primary" :disabled="calibrationStep >= 0" @click="calibrate">
                {{ calibrationStep >= 0 ? 'Calibrating…' : calibrationDone ? 'Recalibrate' : 'Begin Calibration' }}
              </button>
            </div>
            <h3 class="section-title">Pinch to select</h3>
            <div class="group vk-platter pinch-tutorial">
              <svg viewBox="0 0 130 80" aria-hidden="true">
                <path
                  d="M23 69V40q0-8 8-8t8 8v9-29q0-8 8-8t8 8v25-34q0-8 8-8t8 8v33-20q0-8 8-8t8 8v24l8-8q12-6 16 5L88 71" fill="none" stroke="currentColor"
                  stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="105" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
              </svg>
              <p>Look at a control. Bring your thumb and index finger together, then release. Here, a click or Enter practices the same action.</p>
              <button v-hover class="vk-button" @click="pinchCount++; announce('Practice pinch ' + pinchCount + '. A fine selection.')">
                Practice Pinch
                <span class="vk-chip">{{ pinchCount }}</span>
              </button>
            </div>
            <div class="group vk-platter control-section">
              <h4>Preferred Hand</h4>
              <div class="vk-segmented" role="group" aria-label="Preferred hand">
                <button v-for="hand in ['Left', 'Either', 'Right']" :key="hand" v-hover :aria-pressed="dominantHand === hand" @click="dominantHand = hand">{{ hand }}</button>
              </div>
            </div>
          </template>
          <template v-else-if="page === 'Optic ID & Passcode'">
            <div class="hero">
              <svg class="optic-art" :class="{ enrolling }" viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="46"/>
                <circle cx="60" cy="60" r="30"/>
                <path d="M22 60q38-49 76 0-38 49-76 0Z"/>
                <circle cx="60" cy="60" r="11"/>
              </svg>
              <h3>{{ enrolling ? 'Recognising your imaginary iris…' : enrolled ? 'Optic ID is ready.' : 'A familiar look.' }}</h3>
              <p>{{ enrolled ? 'Recognised: someone who said “one more small fix”.' : 'Practice enrollment. No camera. No biometric data.' }}</p>
              <button v-hover class="vk-button primary" :disabled="enrolling" @click="enroll">
                {{ enrolling ? 'Enrolling…' : enrolled ? 'Enroll Again' : 'Set Up Optic ID' }}
              </button>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="opticUnlock" label="Use Optic ID to Unlock" :disabled="!enrolled" detail="A local demo preference after practice enrollment." />
              <ToggleRow v-model="passcode" label="Demo Passcode" detail="Enable an imaginary passcode. No secret is requested or stored." />
            </div>
            <p class="notice">{{ passcode ? 'Passcode enabled: the answer is probably coffee.' : 'No passcode set. The only thing locked here is the scope.' }}</p>
          </template>
          <template v-else-if="page === 'People Awareness'">
            <div class="awareness-preview vk-well" :class="{ visible: awareness && previewPerson, eyes: showEyes, breakthrough: breakthrough }">
              <div class="person-silhouette">
                <span/>
                <i/>
              </div>
              <div class="awareness-window">
                <span/>
                <span/>
                <span/>
              </div>
              <span class="preview-caption">
                {{ !awareness
                  ? 'People Awareness is off'
                  : previewPerson
                  ? breakthrough
                  ? 'A visitor gently breaks through'
                  : 'Your visitor stays behind the window'
                  : 'Your quiet space' }}
              </span>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="awareness" label="People Awareness" detail="Preview a visitor appearing in your environment." />
              <ToggleRow v-model="breakthrough" label="Allow Breakthrough" :disabled="!awareness" detail="Soften the demo window around a nearby person." />
              <ToggleRow v-model="showEyes" label="Show Eye Contact" :disabled="!awareness" detail="Add a gentle eye-contact highlight to the preview." />
            </div>
            <button v-hover class="vk-button wide-action" :disabled="!awareness" @click="previewPerson = !previewPerson">
              {{ previewPerson ? 'Let Visitor Leave' : 'Preview a Visitor' }}
            </button>
            <p class="footnote">This is an illustration. No people detection or camera access is used.</p>
          </template>
          <template v-else-if="page === 'Persona'">
            <div class="hero persona-hero" :class="['background-' + personaBackground.toLowerCase()]">
              <PersonaArt :capturing="personaCapturing" :step="personaStep" :glasses="glasses"/>
              <h3 aria-live="polite">{{ personaCapturing ? personaLines[personaStep] : personaReady ? 'Hello, spatial you.' : 'A face for your space.' }}</h3>
              <p>{{ personaCapturing ? 'Practice capture ' + (personaStep + 1) + ' of 4' : 'An illustrated Persona. No camera or likeness capture.' }}</p>
              <button v-hover class="vk-button primary" :disabled="personaCapturing" @click="capturePersona">
                {{ personaCapturing ? 'Capturing…' : personaReady ? 'Recapture Persona' : 'Create Practice Persona' }}
              </button>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="glasses" label="Add Glasses" detail="A little character for the drawn preview." />
              <div class="control-section">
                <h4>Preview Lighting</h4>
                <div class="vk-segmented" role="group" aria-label="Persona lighting">
                  <button v-for="light in ['Soft', 'Warm', 'Cool']" :key="light" v-hover :aria-pressed="personaBackground === light" @click="personaBackground = light">
                    {{ light }}
                  </button>
                </div>
              </div>
            </div>
          </template>
          <template v-else-if="page === 'Displays'">
            <div class="display-preview vk-well" :style="{ '--brightness': brightness / 100 }">
              <div class="display-sample" :style="{ transform: 'scale(' + (displaySize === 'Small' ? .8 : displaySize === 'Large' ? 1.1 : .95) + ')' }">
                <span/>
                <h4>Your space, in focus.</h4><small>Choose a comfortable window scale</small>
                <div class="sample-apps">
                  <i><ControlIcon name="General" /></i><i><ControlIcon name="Environments" /></i><i><ControlIcon name="Persona" /></i>
                </div>
              </div>
            </div>
            <div class="group vk-platter">
              <SliderRow v-model="brightness" label="Preview Brightness" :min="20" :max="100" detail="Brightness changes the sample window above." />
              <div class="control-section">
                <h4>Window Scale</h4>
                <div class="vk-segmented" role="group" aria-label="Window preview scale">
                  <button v-for="size in ['Small', 'Medium', 'Large']" :key="size" v-hover :aria-pressed="displaySize === size" @click="displaySize = size">{{ size }}</button>
                </div>
              </div>
              <button v-hover class="vk-row disclosure" @click="vision ? vision.open('mac') : announce('Mac Virtual Display opens from the headset Home View.')">
                <span>
                  Mac Virtual Display
                  <small>A wider desk, without a wider desk.</small>
                </span>
                <b aria-hidden="true">›</b>
              </button>
            </div>
            <p class="footnote">Preview adjustments are local to Settings. Resize a real demo window with its corner handle.</p>
          </template>
          <template v-else-if="page === 'Sounds'">
            <div class="sound-preview vk-well" :class="{ playing: previewSound }" aria-hidden="true">
              <span v-for="bar in 16" :key="bar" :style="{ '--bar': bar, height: (10 + (bar * 13 % 55) * volume / 100) + 'px' }"/>
            </div>
            <div class="group vk-platter">
              <SliderRow v-model="volume" label="Demo Volume" detail="A local volume preference for the visual preview." />
              <ToggleRow v-model="feedback" label="Interaction Feedback" detail="Remember your preference for gentle selection feedback." />
              <ToggleRow v-model="sound" label="Environment Sound" detail="Ambient sound in the surrounding headset scene." />
              <div class="control-section">
                <h4>Audio Output</h4>
                <div class="vk-segmented" role="group" aria-label="Demo audio output">
                  <button v-for="output in ['Headset', 'AirPods']" :key="output" v-hover :aria-pressed="audioOutput === output" @click="audioOutput = output">{{ output }}</button>
                </div>
                <p>{{ audioOutput === 'AirPods' ? 'AirPods selected in the demo. No device connection is made.' : 'Imaginary built-in speakers selected.' }}</p>
              </div>
            </div>
            <button v-hover class="vk-button wide-action" :disabled="previewSound" @click="soundPreview">{{ previewSound ? 'Previewing…' : 'Preview Sound Visually' }}</button>
          </template>
          <template v-else-if="page === 'Focus'">
            <div class="hero focus-hero">
              <span class="large-glyph"><ControlIcon name="Focus" /></span>
              <h3>{{ focus === 'Off' ? 'Make a little quiet.' : focus + ' is on.' }}</h3>
              <p>
                {{ focus === 'Work'
                  ? 'Your imaginary inbox can wait.'
                  : focus === 'Do Not Disturb'
                  ? 'No imaginary interruptions, please.'
                  : 'A local preference for a calmer session.' }}
              </p>
            </div>
            <div class="group vk-platter">
              <div class="control-section">
                <h4>Current Focus</h4>
                <div class="focus-options" role="group" aria-label="Focus mode" @keydown="collectionKeys">
                  <button v-for="mode in ['Off', 'Do Not Disturb', 'Work']" :key="mode" v-hover class="vk-row" :aria-pressed="focus === mode" @click="focus = mode">
                    <span>{{ mode }}</span>
                    <ControlIcon v-if="focus === mode" name="check" />
                  </button>
                </div>
              </div>
              <ToggleRow v-model="allowedPeople" label="Allow Favourite People" detail="Your imaginary favourites may interrupt the quiet." />
              <ToggleRow v-model="focusSchedule" label="Use a Focus Reminder" detail="Save a reminder preference for your demo session." />
              <div class="stepper-row">
                <span>Reminder duration</span>
                <div class="stepper">
                  <button v-hover class="vk-icon" :disabled="focusDuration <= 15" aria-label="Shorten Focus reminder"
                    @click="focusDuration -= 15"><ControlIcon name="minus" /></button>
                  <output>{{ focusDuration }} min</output>
                  <button v-hover class="vk-icon" :disabled="focusDuration >= 120" aria-label="Extend Focus reminder"
                    @click="focusDuration += 15"><ControlIcon name="plus" /></button>
                </div>
              </div>
            </div>
            <p class="footnote">Focus preferences are simulated in Settings. No operating-system notifications are controlled.</p>
          </template>
          <template v-else-if="page === 'Notifications'">
            <div class="group vk-platter">
              <ToggleRow v-model="notifications" label="Allow Demo Notifications" detail="Set notification preferences for the simulated apps." />
              <div class="control-section">
                <h4>Show Previews</h4>
                <div class="preview-options vk-segmented" role="group" aria-label="Notification previews">
                  <button v-for="style in ['Always', 'When Unlocked', 'Never']" :key="style" v-hover :aria-pressed="previewStyle === style" @click="previewStyle = style">
                    {{ style }}
                  </button>
                </div>
              </div>
            </div>
            <h3 class="section-title">Notification Style</h3>
            <div class="app-picker vk-scroll" role="group" aria-label="Choose notification app" @keydown="collectionKeys">
              <button v-for="item in VISION_APPS" :key="item.id" v-hover class="vk-button" :aria-pressed="notificationApp === item.id" @click="notificationApp = item.id">
                {{ item.name }}
              </button>
            </div>
            <div class="group vk-platter">
              <h4 class="group-label">{{ notification.name }}</h4>
              <ToggleRow
                v-model="appNotifications[notificationApp]"
                :label="notification.name + ' Notifications'"
                :disabled="!notifications"
                detail="Local permission for this demo app."
              />
              <ToggleRow
                v-model="appBanners[notificationApp]" label="Show Banners" :disabled="!notifications || !appNotifications[notificationApp]"
                detail="Choose whether the practice banner is visible."/>
            </div>
            <div v-if="notifications && appNotifications[notificationApp] && appBanners[notificationApp]" class="notification-preview vk-platter">
              <span class="mini-app-icon"><ControlIcon :name="notification.name" /></span>
              <div>
                <strong>{{ notification.name }}</strong>
                <p>
                  {{ previewStyle === 'Never'
                    ? 'Notification'
                    : previewStyle === 'When Unlocked'
                    ? 'Preview appears when your pretend headset is unlocked.'
                    : 'You have a brand-new imaginary notification.' }}
                </p>
              </div>
              <small>now</small>
            </div>
            <p v-else class="notice">{{ notification.name }} is keeping things quiet.</p>
          </template>
          <template v-else-if="page === 'Apps'">
            <p class="intro">Every app gets its own little corner.</p>
            <div class="app-picker vk-scroll" role="group" aria-label="Choose an app" @keydown="collectionKeys">
              <button v-for="item in VISION_APPS" :key="item.id" v-hover class="vk-button" :aria-pressed="selectedApp === item.id" @click="selectedApp = item.id">
                {{ item.name }}
              </button>
            </div>
            <div class="app-detail vk-platter">
              <span class="app-large-icon" aria-hidden="true"><ControlIcon :name="app.name" /></span>
              <h3>{{ app.name }}</h3>
              <p>{{ offloaded.includes(selectedApp) ? 'Offloaded in this demo' : 'Ready in your spatial workspace' }}</p>
              <button v-hover class="vk-button primary" @click="openApp">{{ offloaded.includes(selectedApp) ? 'Restore & Open' : 'Open App' }}</button>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="backgroundRefresh[selectedApp]" label="Background App Refresh" detail="A simulated per-app preference." />
              <div class="spec-row">
                <span>App Size</span>
                <span>{{ offloaded.includes(selectedApp) ? '0' : '410' }} MB</span>
              </div>
              <div class="spec-row">
                <span>Documents & Cache</span>
                <span>{{ appCaches[selectedApp] }} MB</span>
              </div>
              <button
                v-hover class="vk-row disclosure" :disabled="appCaches[selectedApp] === 0"
                @click="
                  confirm('Clear '
                  + app.name
                  + ' Cache?',
                  'Only the simulated cache counter will be cleared. App content stays available.',
                  'Clear Cache',
                  () => { appCaches[selectedApp] = 0;
                  announce(app.name
                  + ' cache cleared. One less imaginary burden.');
                  })
                ">
                <span>Clear Cache</span>
                <b aria-hidden="true">›</b>
              </button>
              <button
                v-hover class="vk-row destructive disclosure" :disabled="offloaded.includes(selectedApp)"
                @click="
                  confirm('Offload '
                  + app.name
                  + '?',
                  'Simulate reclaiming app storage. Opening the app restores it immediately.',
                  'Offload App',
                  () => { offloaded.push(selectedApp);
                  announce(app.name
                  + ' offloaded in the demo.');
                  })
                ">
                <span>Offload App</span>
                <b aria-hidden="true">›</b>
              </button>
            </div>
            <p class="footnote">Storage values and permissions are simulated. Open App launches the actual portfolio app window.</p>
          </template>
          <template v-else-if="page === 'Control Centre'">
            <div class="control-preview vk-well">
              <div class="mini-control vk-platter">
                <span>{{ vision?.now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) ?? '09:41' }}</span>
                <strong v-if="showBattery">71%</strong>
                <div>
                  <i><ControlIcon name="Focus" /></i>
                  <i><ControlIcon name="Sounds" /></i>
                  <i><ControlIcon name="Environments" /></i>
                  <i><ControlIcon name="Eyes & Hands" /></i>
                </div>
                <small>{{ crown }} controls</small>
              </div>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="palm" label="Palm Gesture" detail="Remember the demo preference for palm access." />
              <ToggleRow v-model="upwardGaze" label="Look Up to Open" detail="A simulated accessibility shortcut." />
              <ToggleRow v-model="showBattery" label="Battery Percentage" detail="Show the simulated percentage in the preview." />
              <div class="control-section">
                <h4>Digital Crown Controls</h4>
                <div class="vk-segmented" role="group" aria-label="Digital Crown preference">
                  <button v-for="control in ['Immersion', 'Volume']" :key="control" v-hover :aria-pressed="crown === control" @click="crown = control">{{ control }}</button>
                </div>
              </div>
              <button v-hover class="vk-row disclosure" @click="navigate('Environments')">
                <span>Environment & Immersion</span>
                <b aria-hidden="true">›</b>
              </button>
            </div>
            <p class="footnote">Open the headset's Control Centre with its status strip. These shortcut preferences are local to this preview.</p>
          </template>
          <template v-else-if="page === 'Battery'">
            <div class="battery-summary">
              <span class="battery-icon" :class="{ amber: lowPower }" aria-hidden="true">
                <i/>
              </span>
              <strong>
                71
                <span>%</span>
              </strong>
              <p>{{ lowPower ? 'Taking things a little slower.' : 'Last charged to 100% at 9:00 AM.' }}</p>
            </div>
            <div class="group vk-platter">
              <ToggleRow v-model="lowPower" label="Low Power Mode" detail="A simulated power preference. The preview turns amber." />
              <ToggleRow v-model="optimiseCharging" label="Optimised Battery Charging" detail="Your imaginary battery appreciates the thought." />
            </div>
            <div class="battery-period vk-segmented" role="group" aria-label="Battery chart period"><button v-for="period in ['24 hours', '10 days'] as const" :key="period" v-hover :aria-pressed="batteryPeriod === period" @click="batteryPeriod = period; batteryHour = null">Last {{ period }}</button></div>
            <div class="battery-chart vk-platter" :class="{ amber: lowPower }">
              <h4>
                Battery Level
                <small>{{ batteryPeriod === '24 hours' ? 'Last 24 hours' : 'Last 10 days' }}, simulated</small>
              </h4>
              <div class="chart-bars" role="group" aria-label="Simulated battery history. Select a bar for details.">
                <button v-for="(level, index) in batteryLevels" :key="index" v-hover :class="{ chosen: batteryHour === index }" :aria-label="'Period ' + (index + 1) + ': ' + level + ' percent battery'" :aria-pressed="batteryHour === index" @click="batteryHour = index"><i :style="{ height: level + '%' }" /></button>
              </div>
              <div class="chart-labels">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>Now</span>
              </div>
            </div>
            <p class="chart-selection" role="status">{{ batteryHour === null ? 'Select a bar to explore battery usage.' : 'Period ' + (batteryHour + 1) + ' · Battery ' + batteryLevels[batteryHour] + '% · Active for ' + batteryActivity[batteryHour] + ' min' }}</p>
            <div class="activity-card vk-platter"><h4>Activity <small>Sample usage</small></h4><div class="activity-bars" aria-hidden="true"><i v-for="(minutes, index) in batteryActivity" :key="index" :style="{ height: minutes + '%' }" /></div><div class="usage-summary"><span><strong>2 h 08 min</strong><small>Screen active</small></span><span><strong>18 min</strong><small>Background activity</small></span></div></div>
            <h3 class="section-title">Battery usage by app</h3><div class="group vk-platter"><div v-for="item in batteryApps" :key="item.name" class="battery-app"><i :style="{ background: item.color }" /><span><strong>{{ item.name }}</strong><small>{{ item.detail }}</small></span><b>{{ item.value }}%</b></div></div>
            <p class="footnote">Sample battery history for this simulation. No device readings are collected.</p>
          </template>
          <template v-else-if="page === 'Storage'">
            <div class="storage-summary">
              <h3>
                {{ usedStorage.toFixed(1) }} GB
                <span>of 256 GB used</span>
              </h3>
              <p>Demo storage. Full of potential and screenshots.</p>
            </div>
            <div class="storage-bar" role="img" :aria-label="usedStorage.toFixed(1) + ' of 256 gigabytes used in simulated storage'">
              <span v-for="item in storage" :key="item.name" :style="{ width: item.size / 256 * 100 + '%', background: item.color }"/>
            </div>
            <div class="group vk-platter">
              <div v-for="item in storage" :key="item.name" class="storage-row">
                <i :style="{ background: item.color }"/>
                <span>
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.line }}</small>
                </span>
                <output>{{ item.size.toFixed(1) }} GB</output>
              </div>
            </div>
            <button
              v-hover class="vk-button wide-action" :disabled="cacheTotal === 0"
              @click="
                confirm('Clear All Demo Caches?',
                'Only the simulated app cache counters will be reset to zero.',
                'Clear Caches',
                () => { VISION_APPS.forEach(item => { appCaches[item.id] = 0;
                });
                announce('Caches cleared. Sadly, the unfinished ideas remain.');
                })
              ">
              Clear App Caches
            </button>
            <button v-hover class="vk-button wide-action" @click="navigate('Apps')">Manage Apps</button>
          </template>
          <template v-else-if="page === 'Reset'">
            <div class="hero">
              <span class="large-glyph"><ControlIcon name="redo" /></span>
              <h3>A fresh start, minus the drama.</h3>
              <p>Restore every Settings preference and practice profile.</p>
            </div>
            <div class="group vk-platter">
              <button
                v-hover class="vk-row destructive disclosure"
                @click="
                  confirm('Reset Demo Settings?',
                  'Restore all Settings preferences, practice profiles and simulated app storage. Your other app content is untouched.',
                  'Reset Settings',
                  reset)
                ">
                <span>Reset Demo Settings</span>
                <b aria-hidden="true">›</b>
              </button>
              <button
                v-hover class="vk-row disclosure" :disabled="personaCapturing || enrolling"
                @click="
                  confirm('Reset Practice Profiles?',
                  'Remove the simulated Persona and Optic ID enrollment. No real profile or biometric information is stored.',
                  'Reset Profiles',
                  () => { personaReady = false;
                  enrolled = false;
                  passcode = false;
                  announce('Practice profiles reset. Still unmistakably you.');
                  })
                ">
                <span>Reset Practice Profiles</span>
                <b aria-hidden="true">›</b>
              </button>
            </div>
            <p class="footnote">Nothing here can erase your device or your portfolio content. Each action resets only its stated demo settings.</p>
          </template>
          <p v-if="status" class="local-status vk-platter" role="status">{{ status }}</p>
        </div>
      </div>
    </main>
  </div>
  <div v-if="confirmation" class="sheet-scrim" @click.self="cancelConfirmation" @keydown.esc.stop.prevent="cancelConfirmation">
    <section class="confirmation vk-sheet" @keydown="modalKeys" role="dialog" aria-modal="true" :aria-labelledby="confirmId + '-title'" :aria-describedby="confirmId + '-detail'">
      <span class="confirmation-symbol"><ControlIcon name="redo" /></span>
      <h3 :id="confirmId + '-title'">{{ confirmation.title }}</h3>
      <p :id="confirmId + '-detail'">{{ confirmation.detail }}</p>
      <div class="confirmation-actions">
        <button ref="cancelButton" v-hover class="vk-button" @click="cancelConfirmation">Cancel</button>
        <button v-hover class="vk-button destructive" @click="acceptConfirmation">{{ confirmation.action }}</button>
      </div>
    </section>
  </div>
</div>
</template>

<style src="./settings/settings.css" scoped></style>

<style scoped>
.settings-root :deep(*) { font-family: inherit; }
</style>
