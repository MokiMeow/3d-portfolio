import { VISION, VISION_APPS, VISION_ENVIRONMENTS } from '../../vision';
import type { VisionAppId, VisionEnvironmentId } from '../../vision';
export function useSettingsState() {
  const vision = inject(VISION, undefined);
  const settingsRoot = ref<HTMLElement>();
  const confirmId = useId();
  const categories = [{
    id: 'General',
    icon: '⚙',
    color: '#86919c'
  }, {
    id: 'Environments',
    icon: '◒',
    color: '#50a99e'
  }, {
    id: 'People Awareness',
    icon: '◉',
    color: '#5c9dd9'
  }, {
    id: 'Persona',
    icon: '☺',
    color: '#b491d1'
  }, {
    id: 'Eyes & Hands',
    icon: '◎',
    color: '#57adab'
  }, {
    id: 'Optic ID & Passcode',
    icon: '⌾',
    color: '#ec837d'
  }, {
    id: 'Displays',
    icon: '▣',
    color: '#7ba2ce'
  }, {
    id: 'Sounds',
    icon: '♫',
    color: '#d68091'
  }, {
    id: 'Focus',
    icon: '☾',
    color: '#958ce1'
  }, {
    id: 'Notifications',
    icon: '●',
    color: '#dc847c'
  }, {
    id: 'Apps',
    icon: '▦',
    color: '#79add3'
  }, {
    id: 'Control Centre',
    icon: '☷',
    color: '#8999ac'
  }, {
    id: 'Battery',
    icon: '▰',
    color: '#7cb386'
  }, {
    id: 'Accessibility',
    icon: '⊕',
    color: '#70a9d9'
  }] as const;
  const generalPages = ['About', 'Credits', 'Software Update', 'Travel Mode', 'Guest User', 'Storage', 'Reset'];
  const page = ref('General');
  const query = ref('');
  const contentActive = ref(false);
  const selectedApp = ref<VisionAppId>('safari');
  const notificationApp = ref<VisionAppId>('messages');
  const category = computed(() => generalPages.includes(page.value) ? 'General' : page.value);
  const searchable = computed(() => {
    const destinations: Array<{
      id: string;
      parent: string;
      icon: string;
      color: string;
    }> = categories.map(x => ({
      id: x.id as string,
      parent: '',
      icon: x.icon,
      color: x.color
    }));
    if (query.value.trim()) {
      destinations.push(...generalPages.map(id => ({
        id,
        parent: 'General',
        icon: '⚙',
        color: '#86919c'
      })));
    }
    const term = query.value.trim().toLowerCase();
    return destinations.filter(x => (x.id + ' ' + x.parent).toLowerCase().includes(term));
  });
  const fallbackEnvironment = ref<VisionEnvironmentId>('room');
  const fallbackImmersion = ref(0);
  const fallbackTransparency = ref(false);
  const fallbackDark = ref(false);
  const fallbackSound = ref(false);
  const environment = computed({
    get: () => vision?.environment.value ?? fallbackEnvironment.value,
    set: (value: VisionEnvironmentId) => {
      fallbackEnvironment.value = value;
      if (vision) vision.environment.value = value;
    }
  });
  const immersion = computed({
    get: () => Math.round((vision?.immersion.value ?? fallbackImmersion.value) * 100),
    set: (value: number) => {
      fallbackImmersion.value = value / 100;
      if (vision) vision.immersion.value = value / 100;
    }
  });
  const transparency = computed({
    get: () => vision?.reduceTransparency.value ?? fallbackTransparency.value,
    set: (value: boolean) => {
      fallbackTransparency.value = value;
      if (vision) vision.reduceTransparency.value = value;
    }
  });
  const dark = computed({
    get: () => vision?.dark.value ?? fallbackDark.value,
    set: (value: boolean) => {
      fallbackDark.value = value;
      if (vision) vision.dark.value = value;
    }
  });
  const sound = computed({
    get: () => vision?.sound.value ?? fallbackSound.value,
    set: (value: boolean) => {
      fallbackSound.value = value;
      if (vision) vision.sound.value = value;
    }
  });
  const travel = ref(false),
    guest = ref(false),
    guestAccess = ref('Selected Apps'),
    guestDuration = ref(15);
  const awareness = ref(true),
    breakthrough = ref(true),
    showEyes = ref(true),
    previewPerson = ref(false);
  const pointerSize = ref(24),
    contrast = ref(false),
    reduceMotion = ref(false),
    textSize = ref(100);
  const brightness = ref(75),
    displaySize = ref('Medium'),
    volume = ref(45),
    feedback = ref(true),
    audioOutput = ref('Headset'),
    previewSound = ref(false);
  const focus = ref('Off'),
    focusSchedule = ref(false),
    allowedPeople = ref(true),
    focusDuration = ref(30);
  const notifications = ref(true),
    previewStyle = ref('When Unlocked');
  const appNotifications = ref(Object.fromEntries(VISION_APPS.map(app => [app.id, app.id !== 'encounter'])) as Record<VisionAppId, boolean>);
  const appBanners = ref(Object.fromEntries(VISION_APPS.map(app => [app.id, true])) as Record<VisionAppId, boolean>);
  const appCaches = ref(Object.fromEntries(VISION_APPS.map((app, index) => [app.id, (index + 2) * 17])) as Record<VisionAppId, number>);
  const offloaded = ref<VisionAppId[]>([]);
  const backgroundRefresh = ref(Object.fromEntries(VISION_APPS.map(app => [app.id, true])) as Record<VisionAppId, boolean>);
  const crown = ref('Immersion'),
    palm = ref(true),
    upwardGaze = ref(false),
    showBattery = ref(true);
  const lowPower = ref(false),
    optimiseCharging = ref(true),
    autoUpdates = ref(true);
  const updateState = ref<'idle' | 'checking' | 'done'>('idle');
  const calibrationStep = ref(-1),
    calibrationDone = ref(false),
    pinchCount = ref(0),
    dominantHand = ref('Either');
  const enrolled = ref(false),
    enrolling = ref(false),
    opticUnlock = ref(true),
    passcode = ref(false);
  const personaStep = ref(-1),
    personaReady = ref(false),
    personaCapturing = ref(false),
    glasses = ref(false),
    personaBackground = ref('Soft');
  const status = ref('');
  const confirmation = ref<{
    title: string;
    detail: string;
    action: string;
    run: () => void;
  }>();
  const cancelButton = ref<HTMLButtonElement>();
  const pageHeading = ref<HTMLElement>();
  let confirmationTrigger: HTMLElement | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;
  const app = computed(() => VISION_APPS.find(x => x.id === selectedApp.value) ?? VISION_APPS[0]);
  const notification = computed(() => VISION_APPS.find(x => x.id === notificationApp.value) ?? VISION_APPS[0]);
  const here = computed(() => VISION_ENVIRONMENTS.find(x => x.id === environment.value) ?? VISION_ENVIRONMENTS[0]);
  const cacheTotal = computed(() => Object.values(appCaches.value).reduce((a, b) => a + b, 0) / 1024);
  const storage = computed(() => [{
    name: 'Apps',
    size: 23.4 - offloaded.value.length * .4,
    color: '#9b9bea',
    line: 'Small worlds, surprisingly large folders.'
  }, {
    name: 'Screenshots of bugs',
    size: 38.2,
    color: '#ebad80',
    line: 'Evidence that it worked yesterday.'
  }, {
    name: 'Unfinished ideas',
    size: 15.7,
    color: '#6db9bc',
    line: 'Every one of them was a weekend project.'
  }, {
    name: 'System Data',
    size: 12.8,
    color: '#a2acb5',
    line: 'Mostly confidence and rounded corners.'
  }, {
    name: 'App caches',
    size: cacheTotal.value,
    color: '#a9c78c',
    line: 'Simulated cache. Safe to clear in this demo.'
  }]);
  const usedStorage = computed(() => storage.value.reduce((total, item) => total + item.size, 0));
  const calibrationLines = ['Look at the centre dot.',
    'Follow the dot to the left.',
    'Now look to the right.',
    'Look up. Your browser believes in you.',
    'Look down, then relax your eyes.'];
    
  const personaLines = ['Look straight ahead.', 'Turn gently to the left.', 'Close your eyes for a moment.', 'Give us your best debugging smile.'];
  const pointerCursor = computed(() => 'url("data:image/svg+xml,'
    + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'
    + pointerSize.value
    + '" height="'
    + pointerSize.value
    + '" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="white" fill-opacity=".65" stroke="'
    + (contrast.value
    ? '#000'
    : '#667')
    + '" stroke-width="2"/></svg>')
    + '") '
    + pointerSize.value / 2
    + ' '
    + pointerSize.value / 2
    + ', auto');
    
  const rootStyle = computed(() => ({
    '--settings-pointer': pointerCursor.value,
    '--settings-type': textSize.value / 100
  }));
  function later(fn: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) fn();
    }, delay);
    timers.add(timer);
  }
  async function navigate(next: string) {
    page.value = next;
    contentActive.value = true;
    status.value = '';
    await nextTick();
    if (!disposed) pageHeading.value?.focus();
  }
  async function back() {
    if (generalPages.includes(page.value)) {
      page.value = 'General';
      await nextTick();
      if (!disposed) pageHeading.value?.focus();
    } else {
      contentActive.value = false;
      await nextTick();
      const selected = settingsRoot.value?.querySelector<HTMLButtonElement>('.category.selected');
      if (!disposed) selected?.focus();
    }
    status.value = '';
  }
  function announce(message: string) {
    status.value = message;
  }
  function collectionKeys(event: KeyboardEvent) {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (target.tagName !== 'BUTTON') return;
    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const index = buttons.indexOf(target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
      ? buttons.length - 1
      : (index
      + (['ArrowDown',
      'ArrowRight'].includes(event.key)
      ? 1
      : -1)
      + buttons.length) % buttons.length;
      
    buttons[next]?.focus();
  }
  function chooseEnvironment(id: VisionEnvironmentId) {
    environment.value = id;
    immersion.value = id === 'room' ? 0 : Math.max(immersion.value, 70);
  }
  function thumbError(event: Event, id: VisionEnvironmentId) {
    const img = event.target as HTMLImageElement;
    if (img.dataset.fallback) {
      img.style.display = 'none';
      return;
    }
    img.dataset.fallback = 'true';
    img.src = '/vision/env/' + (id === 'moon' ? 'earth-map.webp' : id === 'jupiter' ? 'jupiter-map.webp' : id + '-4k.webp');
  }
  function checkUpdate() {
    if (updateState.value === 'checking') return;
    updateState.value = 'checking';
    later(() => {
      updateState.value = 'done';
    }, 1400);
  }
  function calibrate() {
    if (calibrationStep.value >= 0) return;
    calibrationDone.value = false;
    calibrationStep.value = 0;
    function advance() {
      if (calibrationStep.value < 4) {
        calibrationStep.value++;
        later(advance, 1000);
      } else {
        calibrationStep.value = -1;
        calibrationDone.value = true;
        announce('Calibration complete. Your gaze has excellent taste.');
      }
    }
    later(advance, 1000);
  }
  function enroll() {
    if (enrolling.value) return;
    enrolling.value = true;
    later(() => {
      enrolling.value = false;
      enrolled.value = true;
      announce('Optic ID enrolled. We recognised the look of someone with 47 tabs open.');
    }, 1600);
  }
  function capturePersona() {
    if (personaCapturing.value) return;
    personaReady.value = false;
    personaCapturing.value = true;
    personaStep.value = 0;
    function advance() {
      if (personaStep.value < 3) {
        personaStep.value++;
        later(advance, 1200);
      } else {
        personaStep.value = -1;
        personaCapturing.value = false;
        personaReady.value = true;
        announce('Persona ready. Entirely drawn. No camera was invited.');
      }
    }
    later(advance, 1200);
  }
  function soundPreview() {
    if (previewSound.value) return;
    previewSound.value = true;
    announce('Visual sound preview at ' + volume.value + '%.');
    later(() => {
      previewSound.value = false;
    }, 1800);
  }
  async function confirm(title: string, detail: string, action: string, run: () => void) {
    confirmationTrigger = typeof document === 'undefined' ? undefined : document.activeElement as HTMLElement;
    confirmation.value = {
      title,
      detail,
      action,
      run
    };
    await nextTick();
    if (!disposed) cancelButton.value?.focus();
  }
  function cancelConfirmation() {
    confirmation.value = undefined;
    nextTick(() => {
      if (!disposed && confirmationTrigger?.isConnected) confirmationTrigger.focus();
    });
  }
  function acceptConfirmation() {
    const operation = confirmation.value?.run;
    cancelConfirmation();
    operation?.();
  }
  function modalKeys(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button'));
    if (!buttons.length) return;
    if (event.shiftKey && event.target === buttons[0]) {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    } else if (!event.shiftKey && event.target === buttons[buttons.length - 1]) {
      event.preventDefault();
      buttons[0]?.focus();
    }
  }
  function openApp() {
    offloaded.value = offloaded.value.filter(id => id !== selectedApp.value);
    if (vision) vision.open(selectedApp.value);else announce(app.value.name + ' can be opened from the headset Home View.');
  }
  function reset() {
    timers.forEach(clearTimeout);
    timers.clear();
    travel.value = false;
    guest.value = false;
    guestAccess.value = 'Selected Apps';
    guestDuration.value = 15;
    awareness.value = true;
    breakthrough.value = true;
    showEyes.value = true;
    previewPerson.value = false;
    pointerSize.value = 24;
    contrast.value = false;
    reduceMotion.value = false;
    textSize.value = 100;
    brightness.value = 75;
    displaySize.value = 'Medium';
    volume.value = 45;
    feedback.value = true;
    audioOutput.value = 'Headset';
    previewSound.value = false;
    focus.value = 'Off';
    focusSchedule.value = false;
    allowedPeople.value = true;
    focusDuration.value = 30;
    notifications.value = true;
    previewStyle.value = 'When Unlocked';
    VISION_APPS.forEach((item, index) => {
      appNotifications.value[item.id] = item.id !== 'encounter';
      appBanners.value[item.id] = true;
      appCaches.value[item.id] = (index + 2) * 17;
      backgroundRefresh.value[item.id] = true;
    });
    offloaded.value = [];
    selectedApp.value = 'safari';
    notificationApp.value = 'messages';
    crown.value = 'Immersion';
    palm.value = true;
    upwardGaze.value = false;
    showBattery.value = true;
    lowPower.value = false;
    optimiseCharging.value = true;
    autoUpdates.value = true;
    updateState.value = 'idle';
    calibrationStep.value = -1;
    calibrationDone.value = false;
    pinchCount.value = 0;
    dominantHand.value = 'Either';
    enrolled.value = false;
    enrolling.value = false;
    opticUnlock.value = true;
    passcode.value = false;
    personaStep.value = -1;
    personaReady.value = false;
    personaCapturing.value = false;
    glasses.value = false;
    personaBackground.value = 'Soft';
    environment.value = 'room';
    immersion.value = 0;
    transparency.value = false;
    dark.value = false;
    sound.value = false;
    announce('Settings reset. The imaginary headset is feeling fresh.');
  }
  onBeforeUnmount(() => {
    disposed = true;
    timers.forEach(clearTimeout);
    timers.clear();
  });
  return {
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
    pointerCursor,
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
  };
}
