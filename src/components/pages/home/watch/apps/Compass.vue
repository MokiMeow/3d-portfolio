<script setup lang="ts">
import WatchGlyph from "../WatchGlyph.vue";
import { useWatch, useWatchHardware, clamp } from '../watch';
const ctx = useWatch();
const page = ref<'dial' | 'waypoints' | 'backtrack'>('dial');
const zoom = ref(1);
const waypointName = ref('');
const sensor = ref(false);
const sensorNote = ref('Demo bearing • no location requested');
const retraceIndex = ref(0);
const retraceDone = ref(false);
let listening = false;
let orientationGeneration = 0;
let componentVisible = true;
const orientationEnabled = ref(false);
type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};
type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};
function isOrientationVisible() {
  return componentVisible && ctx.activeApp.value === 'compass' && !ctx.dimmed.value;
}
function orientation(event: DeviceOrientationEvent) {
  if (!isOrientationVisible()) return;
  const compassEvent = event as CompassEvent;
  const value = compassEvent.webkitCompassHeading ?? (event.alpha === null ? null : 360 - event.alpha);
  if (value !== null && Number.isFinite(value)) {
    ctx.navigation.heading = (value + 360) % 360;
    sensor.value = true;
  }
}
function detach() {
  orientationGeneration += 1;
  if (typeof window !== 'undefined') window.removeEventListener('deviceorientation', orientation);
  listening = false;
}
function attachOrientation() {
  if (!isOrientationVisible() || !orientationEnabled.value || listening || typeof window === 'undefined') return;
  window.addEventListener('deviceorientation', orientation);
  listening = true;
}
function updateOrientationVisibility() {
  if (!isOrientationVisible()) detach();
  else attachOrientation();
}
async function enableOrientation() {
  if (!isOrientationVisible()) return;
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') {
    sensorNote.value = 'Orientation unavailable. Demo bearing is active.';
    return;
  }
  detach();
  const generation = orientationGeneration;
  try {
    const constructor = DeviceOrientationEvent as OrientationConstructor;
    const permission = constructor.requestPermission ? await constructor.requestPermission() : 'granted';
    if (generation !== orientationGeneration || !isOrientationVisible()) return;
    if (permission !== 'granted') {
      orientationEnabled.value = false;
      sensor.value = false;
      sensorNote.value = 'Permission declined. Using demo bearing.';
      return;
    }
    orientationEnabled.value = true;
    attachOrientation();
    sensorNote.value = 'Orientation enabled when your browser provides readings. Not calibrated.';
  } catch {
    if (generation !== orientationGeneration || !isOrientationVisible()) return;
    orientationEnabled.value = false;
    sensor.value = false;
    sensorNote.value = 'Orientation unavailable. Using demo bearing.';
  }
}
watch(() => [ctx.activeApp.value, ctx.dimmed.value], updateOrientationVisibility, { flush: 'sync' });
onDeactivated(() => {
  componentVisible = false;
  detach();
});
onBeforeUnmount(() => {
  componentVisible = false;
  detach();
});
onActivated(() => {
  componentVisible = true;
  updateOrientationVisibility();
});
const heading = computed(() => Math.round(ctx.navigation.heading) % 360);
const cardinal = computed(() => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading.value / 45) % 8] ?? 'N');
const ticks = Array.from({
  length: 72
}, (_, i) => i * 5);
function point(degrees: number, radius: number) {
  const angle = degrees * Math.PI / 180;
  return {
    x: 170 + Math.sin(angle) * radius,
    y: 170 - Math.cos(angle) * radius
  };
}
function dropWaypoint() {
  const id = Date.now();
  ctx.navigation.waypoints.push({
    id,
    name: waypointName.value.trim().slice(0, 32) || 'Waypoint ' + (ctx.navigation.waypoints.length + 1),
    bearing: heading.value,
    distance: Math.round(70 + ctx.navigation.path.length * 11),
    color: ['#FF9F0A', '#30D158', '#0A84FF', '#BF5AF2'][ctx.navigation.waypoints.length % 4] ?? '#FF9F0A'
  });
  waypointName.value = '';
  page.value = 'waypoints';
  ctx.haptic('success');
}
function startBacktrack() {
  retraceDone.value = false;
  ctx.navigation.path = [{
    x: 170,
    y: 245
  }];
  ctx.navigation.backtracking = true;
  ctx.navigation.retracing = false;
  page.value = 'backtrack';
}
function retrace() {
  retraceDone.value = false;
  ctx.navigation.backtracking = false;
  ctx.navigation.retracing = true;
  retraceIndex.value = ctx.navigation.path.length - 1;
}
function stopBacktrack() {
  ctx.navigation.backtracking = false;
  ctx.navigation.retracing = false;
}
function consumeRequest() {
  if (ctx.navigation.request === 'waypoint') {
    ctx.navigation.request = null;
    dropWaypoint();
  } else if (ctx.navigation.request === 'backtrack') {
    ctx.navigation.request = null;
    if (!ctx.navigation.backtracking) startBacktrack();else page.value = 'backtrack';
  }
}
watch(() => ctx.navigation.request, consumeRequest, {
  immediate: true
});
watch(ctx.now, () => {
  if (!ctx.dimmed.value && !ctx.reducedMotion.value && ctx.activeApp.value === 'compass' && !sensor.value) ctx.navigation.heading = (ctx.navigation.heading + 0.8) % 360;
  if (ctx.dimmed.value) return;
  if (ctx.navigation.backtracking && ctx.navigation.path.length < 180) {
    const n = ctx.navigation.path.length;
    ctx.navigation.path.push({
      x: 170 + Math.sin(n / 11) * 65 + Math.sin(n / 4) * 10,
      y: 245 - Math.min(n * 1.3, 190)
    });
  }
  if (ctx.navigation.retracing) {
    retraceIndex.value = Math.max(0, retraceIndex.value - 1);
    if (!retraceIndex.value) {
      retraceDone.value = true;
      ctx.navigation.retracing = false;
      ctx.notify({
        app: 'compass',
        title: 'Back at the start',
        text: 'Your simulated breadcrumb route is complete.'
      });
    }
  }
});
const trailStatus = computed(() => {
  if (ctx.navigation.retracing) return 'Retracing the demo trail…';
  if (ctx.navigation.backtracking) return 'Recording demo breadcrumbs…';
  if (ctx.navigation.path.length) return 'Trail saved. Turn the Crown to zoom.';
  return 'Record a simulated walk, then retrace it.';
});
const pathPoints = computed(() => ctx.navigation.path.map(p => p.x + ',' + p.y).join(' '));
const currentPoint = computed(() => ctx.navigation.path[ctx.navigation.retracing || retraceDone.value ? retraceIndex.value : ctx.navigation.path.length - 1] ?? {
  x: 170,
  y: 245
});
useWatchHardware('compass', {
  crown: delta => {
    if (page.value === 'waypoints') return false;
    zoom.value = clamp(zoom.value + delta * 0.08, 0.7, 2.5);
    return true;
  },
  action: () => {
    dropWaypoint();
    return true;
  },
  back: () => {
    if (page.value !== 'dial') {
      page.value = 'dial';
      return true;
    }
    return false;
  }
});
</script>

<template>
  <section class="watch-app compass-app">
    <h1>{{ page === 'dial' ? 'Compass' : page === 'waypoints' ? 'Waypoints' : 'Backtrack' }}</h1>
    <template v-if="page === 'dial'">
      <div class="bearing">
        <strong>
          {{ heading }}
          °
        </strong>
        <span>
          {{ cardinal }}
        </span>
      </div>
      <svg
        class="compass-dial"
        viewBox="0 0 340 340"
        role="img"
        :aria-label="'Compass bearing ' + heading + ' degrees'"
      >
        <circle
          cx="170"
          cy="170"
          r="153"
          fill="#141416"
          stroke="#343438"
          stroke-width="2"
        />
        <g :transform="'rotate(' + -heading + ' 170 170)'">
          <line
            v-for="degree in ticks"
            :key="degree"
            :x1="point(degree, degree % 30 === 0 ? 128 : 139).x"
            :y1="point(degree, degree % 30 === 0 ? 128 : 139).y"
            :x2="point(degree, 150).x"
            :y2="point(degree,150).y"
            :stroke="degree === 0 ? '#FF453A' : degree % 30 === 0 ? '#F5F5F7' : '#78787D'"
            :stroke-width="degree % 30 === 0 ? 3 : 2"
          />
          <text
            x="170"
            y="63"
            fill="#FF453A"
            text-anchor="middle"
          >N</text>
          <text
            x="277"
            y="181"
            fill="white"
            text-anchor="middle"
          >E</text>
          <text
            x="170"
            y="298"
            fill="white"
            text-anchor="middle"
          >S</text>
          <text
            x="62"
            y="181"
            fill="white"
            text-anchor="middle"
          >W</text>
          <circle
            v-for="waypoint in ctx.navigation.waypoints"
            :key="waypoint.id"
            :cx="point(waypoint.bearing, clamp(waypoint.distance / zoom / 2, 40, 112)).x"
            :cy="point(waypoint.bearing, clamp(waypoint.distance / zoom / 2, 40, 112)).y"
            r="9"
            :fill="waypoint.color"
            stroke="#000"
            stroke-width="3"
          />
        </g>
        <path d="M170 79 L158 176 L170 162 L182 176 Z" fill="#FF453A" />
        <path d="M170 262 L158 176 L170 188 L182 176 Z" fill="#F5F5F7" />
        <circle
          cx="170"
          cy="176"
          r="10"
          fill="#000"
          stroke="#888"
          stroke-width="3"
        />
      </svg>
      <div class="platter facts">
        <div>
          <span class="caption muted">Elevation</span>
          <strong>147 m</strong>
        </div>
        <div>
          <span class="caption muted">Incline</span>
          <strong>2°</strong>
        </div>
      </div>
      <p class="caption muted">
        12°58′ N · 77°35′ E
        <br />
        {{ sensorNote }}
        <br />
        Crown to zoom waypoints ·
        {{ zoom.toFixed(1) }}
        ×
      </p>
      <button class="watch-button" @click="enableOrientation">Use device orientation</button>
      <div class="button-row">
        <button class="watch-button" @click="page='waypoints'">Waypoints</button>
        <button class="watch-button" @click="page='backtrack'">Backtrack</button>
      </div>
    </template>
    <template v-else-if="page === 'waypoints'">
      <h2>Waypoints</h2>
      <input
        v-model="waypointName"
        aria-label="Waypoint name"
        maxlength="32"
        placeholder="Name this spot"
        @keydown.enter="dropWaypoint"
      />
      <button class="watch-button orange" @click="dropWaypoint">＋ Drop waypoint</button>
      <div
        v-for="waypoint in ctx.navigation.waypoints"
        :key="waypoint.id"
        class="platter waypoint"
      >
        <svg class="waypoint-dot" viewBox="0 0 24 24" aria-hidden="true" :style="{color:waypoint.color}"><circle cx="12" cy="12" r="7" fill="currentColor" /></svg>
        <div>
          <strong>
            {{ waypoint.name }}
          </strong>
          <p class="caption muted">
            {{ waypoint.bearing }}
            ° ·
            {{ waypoint.distance }}
            m · demo
          </p>
        </div>
        <button
          class="delete"
          :aria-label="'Remove ' + waypoint.name"
          @click="ctx.navigation.waypoints=ctx.navigation.waypoints.filter(p => p.id !== waypoint.id)"
        >
          <WatchGlyph name="close" />
        </button>
      </div>
      <p v-if="!ctx.navigation.waypoints.length" class="caption muted">Mark the places you want to find again.</p>
    </template>
    <template v-else>
      <h2>Backtrack</h2>
      <svg
        class="trail"
        viewBox="0 0 340 290"
        role="img"
        aria-label="Simulated breadcrumb route"
      >
        <g :transform="'translate(170 145) scale(' + zoom + ') translate(-170 -145)'">
          <polyline
            :points="pathPoints"
            fill="none"
            stroke="#FF9F0A"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle
            v-if="ctx.navigation.path.length"
            :cx="ctx.navigation.path[0]?.x"
            :cy="ctx.navigation.path[0]?.y"
            r="10"
            fill="#30D158"
          />
          <circle
            :cx="currentPoint.x"
            :cy="currentPoint.y"
            r="12"
            fill="#0A84FF"
            stroke="white"
            stroke-width="4"
          />
        </g>
      </svg>
      <p class="caption muted">
        {{ trailStatus }}
      </p>
      <button
        v-if="!ctx.navigation.backtracking && !ctx.navigation.retracing"
        class="watch-button orange"
        @click="startBacktrack"
      >
        Start recording
      </button>
      <button
        v-if="ctx.navigation.backtracking || (!ctx.navigation.retracing && ctx.navigation.path.length>1)"
        class="watch-button orange"
        @click="retrace"
      >
        Retrace steps
      </button>
      <button
        v-if="ctx.navigation.backtracking || ctx.navigation.retracing"
        class="watch-button"
        @click="stopBacktrack"
      >
        Stop
      </button>
      
    </template>
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

h1 {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
  line-height: 1.2;
  margin: 0 0 22px;
  font-weight: 700;
}

h2 {
  font-size: max(18px, calc(26px * var(--text-size, 1)));
  margin: 0 0 12px;
}

.watch-app button:focus-visible,
.watch-app input:focus-visible {
  outline: 4px solid #fff;
  outline-offset: 3px;
}

.watch-app button {
  touch-action: manipulation;
}

.watch-app p {
  line-height: 1.3;
}

.watch-app input {
  box-sizing: border-box;
  width: 100%;
  height: 80px;
  border: 0;
  border-radius: 24px;
  background: #252527;
  color: white;
  padding: 0 20px;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
}

.bearing {
  text-align: center;
  font-size: max(18px, calc(31px * var(--text-size, 1)));
  color: #FF9F0A;
}

.bearing strong {
  font-size: max(18px, calc(58px * var(--text-size, 1)));
  letter-spacing: -3px;
  color: white;
}

.compass-dial {
  display: block;
  width: 100%;
  margin: 0 auto 12px;
}

.compass-dial text {
  font-size: max(18px, calc(23px * var(--text-size, 1)));
  font-weight: 700;
}

.facts {
  display: flex;
  justify-content: space-between;
}

.facts div {
  display: flex;
  flex-direction: column;
}

.facts strong {
  font-size: max(18px, calc(30px * var(--text-size, 1)));
}

.orange {
  background: #FF9F0A !important;
  color: #000 !important;
}

.waypoint {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: max(18px, calc(25px * var(--text-size, 1)));
  margin-top: 14px;
}

.waypoint p {
  margin: 4px 0;
}

.delete {
  border: 0;
  background: transparent;
  color: #FF453A;
  min-height: 76px;
  min-width: 72px;
  font-size: max(18px, calc(31px * var(--text-size, 1)));
}

.trail {
  width: 100%;
  height: 290px;
  background: radial-gradient(circle,#252528 1px,transparent 1px) 0 0/20px 20px;
  border-radius: 30px;
  overflow: hidden;
}

.button-row {
  margin-top: 12px;
}

.bearing {
  margin: 6px 0 12px;
}

.compass-dial {
  width: 236px;
  height: 236px;
}

.facts {
  gap: 12px;
  margin-bottom: 12px;
}
</style>

<style scoped src="./app-polish.css"></style>

<style scoped>
.watch-app { --app-accent: #FF6A13; }

.waypoint-dot { width:24px; height:24px; flex:0 0 24px; }
.waypoint > div { min-width:0; flex:1; }
.waypoint strong { font-size:24px; line-height:1.25; }
.waypoint .delete { flex:0 0 52px; min-width:0; }
.bearing strong { font-size:80px; font-weight:600; line-height:1.2; }
.facts { gap:18px; }
.facts strong { font-size:26px; }
.compass-dial { display:block; width:100%; max-width:340px; margin:14px auto; }
</style>
