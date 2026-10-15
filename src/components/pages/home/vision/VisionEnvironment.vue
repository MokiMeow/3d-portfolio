<script setup lang="ts">
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, LinearFilter, LinearMipmapLinearFilter,
  Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, SRGBColorSpace, Scene,
  SphereGeometry, TextureLoader, WebGLRenderer, type Texture,
} from 'three';
import { decoded } from './textures';
import { VISION_ENVIRONMENTS, type VisionEnvironmentId } from './vision';

/**
 * The place around the wearer: a 360-degree picture on the inside of a sphere. The wearer can look around by dragging, the view
 * leans gently toward the pointer, and each place has something that moves. `room` draws nothing:
 * the real room shows through. Immersion opens the place from the centre of view outward.
 */
const props = defineProps<{ id: VisionEnvironmentId; immersion: number; dark?: boolean }>();
const emit = defineEmits<{ ready: [id: VisionEnvironmentId] }>();

const host = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const loaded = ref(false);
const place = computed(() => VISION_ENVIRONMENTS.find((item) => item.id === props.id)!);
const BASE = '/vision/env/';

let renderer: WebGLRenderer | undefined;
let camera: PerspectiveCamera | undefined;
let scene: Scene | undefined;
let frame = 0, last = 0, request = 0;
let watcher: ResizeObserver | undefined;
// What the current place owns, so it can be released when the wearer moves on.
let owned: { dispose(): void }[] = [];
let tick: ((seconds: number, delta: number) => void) | undefined;
let tint: MeshBasicMaterial | undefined;
// Where the wearer is looking: a resting direction they set by dragging, plus a small lean toward the pointer.
const look = { yaw: 0, pitch: 0, leanX: 0, leanY: 0, spinX: 0, spinY: 0, nowYaw: 0, nowPitch: 0 };
const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function keep<T extends { dispose(): void }>(thing: T) { owned.push(thing); return thing; }
function clear() {
  tick = undefined; tint = undefined;
  if (scene) for (const child of [...scene.children]) scene.remove(child);
  owned.forEach((thing) => thing.dispose());
  owned = [];
}
function soft(size: number, stops: [number, string][]) {
  const surface = document.createElement('canvas');
  surface.width = surface.height = size;
  const context = surface.getContext('2d')!;
  const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, colour]) => glow.addColorStop(at, colour));
  context.fillStyle = glow; context.fillRect(0, 0, size, size);
  return keep(new CanvasTexture(surface));
}
function picture(file: string) {
  return new Promise<Texture>((resolve, reject) => new TextureLoader().load(BASE + file, async (texture) => {
    await decoded(texture.image);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearMipmapLinearFilter; texture.magFilter = LinearFilter;
    texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1;
    resolve(keep(texture));
  }, undefined, reject));
}
/** Points scattered through a box around the wearer; `wrap` keeps them inside it as they drift. */
function drift(count: number, box: [number, number, number], size: number, colour: string, opacity: number, sprite: Texture, velocity: (i: number) => [number, number, number], additive = true) {
  const positions = new Float32Array(count * 3), speeds: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    let x = (Math.random() - 0.5) * box[0], z = (Math.random() - 0.5) * box[2];
    // Nothing drifts right in front of the eyes: a mote that close would be a white blob.
    if (Math.hypot(x, z) < 5) { const push = 5 / Math.max(0.2, Math.hypot(x, z)); x *= push; z *= push; }
    positions.set([x, (Math.random() - 0.5) * box[1], z], i * 3);
    speeds.push(velocity(i));
  }
  const geometry = keep(new BufferGeometry());
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = keep(new PointsMaterial({ size, map: sprite, color: new Color(colour), transparent: true, opacity, depthWrite: false, blending: additive ? AdditiveBlending : undefined, sizeAttenuation: true }));
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  scene!.add(points);
  return (seconds: number, delta: number) => {
    const attribute = geometry.getAttribute('position');
    for (let i = 0; i < count; i++) {
      const [vx, vy, vz] = speeds[i];
      let x = attribute.getX(i) + (vx + Math.sin(seconds * 0.6 + i) * 0.12) * delta, y = attribute.getY(i) + vy * delta, z = attribute.getZ(i) + vz * delta;
      if (y < -box[1] / 2) y += box[1]; else if (y > box[1] / 2) y -= box[1];
      if (x < -box[0] / 2) x += box[0]; else if (x > box[0] / 2) x -= box[0];
      if (z < -box[2] / 2) z += box[2]; else if (z > box[2] / 2) z -= box[2];
      attribute.setXYZ(i, x, y, z);
    }
    attribute.needsUpdate = true;
  };
}
async function enter(id: VisionEnvironmentId, turn: number) {
  if (!scene || !renderer) return;
  const now = VISION_ENVIRONMENTS.find((item) => item.id === id)!;
  clear();
  loaded.value = false;
  look.yaw = look.pitch = look.spinX = look.spinY = 0;
  const ticks: ((seconds: number, delta: number) => void)[] = [];
  const big = renderer.capabilities.maxTextureSize >= 8192 && (host.value?.clientWidth ?? 0) > 900;
  const texture = await picture(`${id}-${big ? '6k' : '4k'}.webp`);
  if (turn !== request) return;
  const geometry = keep(new SphereGeometry(100, 72, 48));
  // Seen from inside, so the picture is mirrored back the right way round.
  geometry.scale(-1, 1, 1);
  tint = keep(new MeshBasicMaterial({ map: texture }));
  const dome = new Mesh(geometry, tint);
  // The middle of each photograph is its best view; turn it to face the wearer.
  dome.rotation.y = -Math.PI / 2;
  scene.add(dome);
  if (now.life === 'snow') {
    const flake = soft(32, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]);
    ticks.push(drift(1400, [46, 30, 46], 0.2, '#ffffff', 0.9, flake, () => [0.5 + Math.random() * 0.5, -(1.1 + Math.random() * 1.1), 0.2], false));
  } else if (now.life === 'motes') {
    const mote = soft(32, [[0, 'rgba(255,240,210,1)'], [1, 'rgba(255,240,210,0)']]);
    ticks.push(drift(180, [34, 9, 34], 0.045, '#fff1d6', 0.5, mote, () => [(Math.random() - 0.5) * 0.2, 0.03 + Math.random() * 0.06, (Math.random() - 0.5) * 0.2]));
  } else if (now.life === 'mist') {
    const cloud = soft(128, [[0, 'rgba(235,240,238,.5)'], [1, 'rgba(235,240,238,0)']]);
    ticks.push(drift(46, [70, 5, 70], 26, '#eef2f0', 0.2, cloud, () => [0.35 + Math.random() * 0.3, 0, 0.08], false));
  } else if (now.life === 'meteors') {
    // Now and then a meteor: a short bright streak that fades as it falls.
    const streak = soft(64, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(200,220,255,.5)'], [1, 'rgba(200,220,255,0)']]);
    const material = keep(new MeshBasicMaterial({ map: streak, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
    const meteor = new Mesh(keep(new PlaneGeometry(9, 0.22)), material);
    scene.add(meteor);
    let next = 4, life = 0;
    ticks.push((seconds, delta) => {
      if (life <= 0 && seconds > next) {
        const angle = Math.random() * Math.PI * 2;
        meteor.position.set(Math.cos(angle) * 60, 34 + Math.random() * 22, Math.sin(angle) * 60);
        meteor.lookAt(0, 0, 0); meteor.rotateZ(-0.5 - Math.random() * 0.5);
        life = 1; next = seconds + 5 + Math.random() * 9;
      }
      if (life > 0) { life -= delta * 1.5; meteor.translateX(-delta * 34); material.opacity = Math.max(0, Math.sin(life * Math.PI)) * 0.95; }
    });
  }
  tick = (seconds, delta) => ticks.forEach((step) => step(seconds, delta));
  applyTone();
  loaded.value = true;
  emit('ready', id);
  draw(performance.now());
}
function applyTone() {
  // The darker appearance: the same place an hour later.
  if (tint) tint.color.set(props.dark && !place.value.night ? 0x5a6890 : 0xffffff);
}
function resize() {
  const box = host.value;
  if (!box || !renderer || !camera || !box.clientWidth || !box.clientHeight) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(box.clientWidth, box.clientHeight, false);
  camera.aspect = box.clientWidth / box.clientHeight;
  // Keep a comfortable horizontal sweep on tall phone screens.
  camera.fov = camera.aspect < 1 ? 92 : 72;
  camera.updateProjectionMatrix();
}
function draw(time: number) {
  frame = 0;
  if (!renderer || !scene || !camera) return;
  const seconds = time / 1000, delta = Math.min(0.05, last ? seconds - last : 0.016);
  last = seconds;
  // Momentum after a drag, easing to rest.
  look.yaw += look.spinX * delta; look.pitch = Math.max(-0.75, Math.min(0.75, look.pitch + look.spinY * delta));
  look.spinX *= 1 - Math.min(1, delta * 3.2); look.spinY *= 1 - Math.min(1, delta * 3.2);
  const ease = Math.min(1, delta * 5);
  look.nowYaw += (look.yaw + look.leanX * 0.16 - look.nowYaw) * ease;
  look.nowPitch += (look.pitch + look.leanY * 0.09 - look.nowPitch) * ease;
  camera.rotation.set(look.nowPitch, look.nowYaw, 0, 'YXZ');
  if (!still()) tick?.(seconds, delta);
  renderer.render(scene, camera);
  if (props.immersion > 0.01 && props.id !== 'room') frame = requestAnimationFrame(draw);
}
function wake() { if (!frame && renderer && props.id !== 'room' && props.immersion > 0.01) { last = 0; frame = requestAnimationFrame(draw); } }

/** The shell calls these: `lean` follows the pointer (-1..1 on each axis), `turn` is a drag in pixels, `fling` is its final speed. */
function lean(x: number, y: number) { look.leanX = -x; look.leanY = -y; }
function turn(dx: number, dy: number) {
  look.yaw += dx * 0.0042; look.pitch = Math.max(-0.75, Math.min(0.75, look.pitch + dy * 0.0042));
  look.spinX = look.spinY = 0;
}
function fling(vx: number, vy: number) { if (!still()) { look.spinX = vx * 0.0042; look.spinY = vy * 0.0042; } }
function recentre() { look.yaw = look.pitch = look.spinX = look.spinY = 0; }
/** Where the wearer is looking, so things placed in the space can stay put in the world. */
function view() { return props.id === 'room' ? { yaw: 0, pitch: 0, fov: camera?.fov ?? 72 } : { yaw: look.nowYaw, pitch: look.nowPitch, fov: camera?.fov ?? 72 }; }
defineExpose({ lean, turn, fling, recentre, view });

watch(() => props.id, (id) => { if (id !== 'room') void enter(id, ++request).catch(() => { loaded.value = false; }); else { ++request; clear(); loaded.value = false; } });
watch(() => props.immersion, wake);
watch(() => props.dark, () => { applyTone(); wake(); });
onMounted(() => {
  if (!canvas.value) return;
  try {
    renderer = new WebGLRenderer({ canvas: canvas.value, antialias: true, powerPreference: 'high-performance' });
  } catch { return; }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.debug.checkShaderErrors = Boolean(import.meta.dev);
  renderer.setClearColor(0x000000, 1);
  scene = new Scene();
  camera = new PerspectiveCamera(72, 1, 0.1, 1200);
  watcher = new ResizeObserver(() => { resize(); wake(); });
  if (host.value) watcher.observe(host.value);
  resize();
  if (props.id !== 'room') void enter(props.id, ++request).catch(() => { loaded.value = false; });
});
onBeforeUnmount(() => {
  ++request;
  cancelAnimationFrame(frame);
  watcher?.disconnect();
  clear();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = undefined; scene = undefined; camera = undefined;
});
</script>

<template>
  <div ref="host" class="env" :class="{ off: id === 'room', loaded }" :style="{ '--imm': immersion, '--thumb': place.kind === 'photo' ? `url(${BASE}${id}-thumb.webp)` : 'none' }" aria-hidden="true">
    <i class="veil" />
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
/* Immersion opens from the centre of view outward, the way turning the Digital Crown does. */
.env{position:absolute;inset:0;overflow:hidden;background:#04060c;pointer-events:none;
  mask-image:radial-gradient(ellipse 75% 75% at 50% 52%,#000 calc(var(--imm) * 150% - 38%),transparent calc(var(--imm) * 150%));
  -webkit-mask-image:radial-gradient(ellipse 75% 75% at 50% 52%,#000 calc(var(--imm) * 150% - 38%),transparent calc(var(--imm) * 150%))}
.env.off{display:none}
/* While the full picture loads, a soft copy of its thumbnail holds the place. */
.veil{position:absolute;inset:-6%;background:var(--thumb) center/cover no-repeat,#04060c;filter:blur(26px) saturate(1.1);transform:scale(1.08)}
canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .9s ease}
.loaded canvas{opacity:1}
@media(prefers-reduced-motion:reduce){canvas{transition:none}}
</style>
