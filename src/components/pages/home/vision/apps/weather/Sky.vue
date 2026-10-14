<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { noise, type Condition } from './model';
const props = defineProps<{ condition: Condition; hour: number; seed: number }>();
const canvas = ref<HTMLCanvasElement>();
const hidden = ref(false);
const night = computed(() => props.hour < 6 || props.hour >= 19);
const golden = computed(() => !night.value && (props.hour < 7.5 || props.hour >= 17));
const stars = Array.from({ length: 24 }, (_, index) => ({ left: noise(7, index) * 100 + '%', top: noise(8, index) * 60 + '%', animationDelay: -(index % 7) + 's' }));
let context: CanvasRenderingContext2D | null = null;
let observer: ResizeObserver | undefined;
let preference: MediaQueryList | undefined;
let frame = 0;
let width = 0, height = 0, last = 0;
let disposed = false;
function draw(time: number): void {
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const snowy = props.condition === 'snow';
  if (!['rain', 'storm', 'snow'].includes(props.condition)) return;
  context.strokeStyle = '#cce6ff66'; context.fillStyle = '#ffffffad'; context.lineWidth = 1;
  for (let i = 0; i < (snowy ? 42 : 60); i++) {
    const x = (noise(props.seed, i) * width + (snowy ? Math.sin(time / 2400 + i) * 22 : time / 90)) % (width + 30);
    const y = (noise(props.seed + 1, i) * height + time * (snowy ? .025 : .27) * (.6 + noise(props.seed + 2, i))) % (height + 30) - 15;
    context.beginPath();
    if (snowy) { context.arc(x, y, 1 + noise(props.seed + 3, i) * 2, 0, Math.PI * 2); context.fill(); }
    else { context.moveTo(x, y); context.lineTo(x - 4, y + 15); context.stroke(); }
  }
}
function animate(time: number): void {
  if (disposed || document.hidden || preference?.matches) return;
  if (time - last > 33) { draw(time); last = time; }
  frame = requestAnimationFrame(animate);
}
function start(): void {
  cancelAnimationFrame(frame); hidden.value = document.hidden;
  if (disposed || document.hidden) return;
  draw(0);
  if (!preference?.matches && ['rain', 'storm', 'snow'].includes(props.condition)) frame = requestAnimationFrame(animate);
}
function resize(): void {
  const element = canvas.value;
  if (!element || !context) return;
  width = element.clientWidth; height = element.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  element.width = Math.round(width * ratio); element.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0); draw(0);
}
watch(() => [props.condition, props.seed], start);
onMounted(() => { context = canvas.value?.getContext('2d') ?? null; observer = new ResizeObserver(resize); if (canvas.value) observer.observe(canvas.value); preference = matchMedia('(prefers-reduced-motion: reduce)'); preference.addEventListener('change', start); document.addEventListener('visibilitychange', start); resize(); start(); });
onBeforeUnmount(() => { disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); preference?.removeEventListener('change', start); document.removeEventListener('visibilitychange', start); });
</script>
<template><div class="sky" :class="[condition, { night, golden, paused: hidden }]" aria-hidden="true"><div v-if="night" class="stars"><i v-for="(star, index) in stars" :key="index" :style="star" /></div><span v-if="condition === 'clear'" class="orb" /><div v-if="condition !== 'clear'" class="cloud cloud-one" /><div v-if="condition !== 'clear'" class="cloud cloud-two" /><div v-if="condition === 'fog'" class="fog-layer" /><div v-if="condition === 'storm'" class="flash" /><canvas ref="canvas" /><div class="scrim" /></div></template>
<style scoped>
.sky { position: absolute; inset: 0; overflow: hidden; pointer-events: none; background: linear-gradient(155deg,#477eaa,#294668 65%,#20344c); transition: background 1s; }
.sky.clear { background: linear-gradient(155deg,#458fbd,#255b92 65%,#213f66); } .sky.golden { background: linear-gradient(155deg,#bd7d70,#715c80 48%,#2d4269); } .sky.night { background: linear-gradient(155deg,#16243e,#101d32 65%,#152b41); } .sky.storm { background: linear-gradient(150deg,#3c4a63,#202e48 60%,#172b44); } .sky.snow { background: linear-gradient(140deg,#67829c,#3e586f 70%,#304c66); } .sky.fog { background: linear-gradient(150deg,#6a8292,#4f667a 50%,#344c64); }
.sky.night.storm, .sky.night.snow, .sky.night.fog { background: linear-gradient(150deg,#202b40,#152339 60%,#101e31); }
canvas,.scrim,.stars,.flash { position: absolute; inset: 0; width: 100%; height: 100%; } .scrim { background: linear-gradient(0deg,#0c1c385c,transparent); }
.orb { position: absolute; width: 130px; height: 130px; right: 12%; top: 7%; border-radius: 50%; background: #fff1be; opacity: .24; box-shadow: 0 0 90px 45px #ffe6ad30; } .night .orb { width: 65px; height: 65px; background: #dceaff; box-shadow: 0 0 55px 20px #cce0ff14; }
.stars i { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; animation: twinkle 5s ease-in-out infinite alternate; }
.cloud { position: absolute; width: 65%; height: 120px; background: radial-gradient(ellipse,#dfe9f330,transparent 70%); filter: blur(18px); animation: drift 38s ease-in-out infinite alternate; } .cloud-one { top: 4%; left: -5%; } .cloud-two { top: 20%; left: 40%; animation-delay: -20s; opacity: .7; }
.fog-layer { position: absolute; inset: 25% -30% 0; background: repeating-linear-gradient(0deg,transparent,#d4e0e92b 20%,transparent 40%); filter: blur(20px); animation: drift 24s ease-in-out infinite alternate; }
.flash { background: #cce4ff; opacity: 0; animation: lightning 16s linear infinite; }
.paused *, .paused::before { animation-play-state: paused !important; }
@keyframes drift { to { transform: translateX(15%) translateY(20px); } } @keyframes twinkle { to { opacity: .2; } } @keyframes lightning { 0%,89%,90%,91%,100% { opacity: 0; } 89.3%,90.3% { opacity: .13; } }
@media (prefers-reduced-motion: reduce) { .sky, .sky * { animation: none !important; transition: none !important; } }
</style>
