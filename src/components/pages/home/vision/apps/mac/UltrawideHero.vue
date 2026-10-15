<script setup lang="ts">
/**
 * The connect screen's hero: a 32:9 ultrawide, gently curved around the wearer. One desktop is drawn,
 * then shown through seven angled slices of a cylinder, so the curve is real 3D rather than a picture of one.
 */
defineProps<{ connecting?: boolean }>();
const slices = Array.from({ length: 7 }, (_, index) => index);
</script>

<template>
  <div class="ultrawide" :class="{ connecting }" aria-hidden="true">
    <div class="curve">
      <div v-for="index in slices" :key="index" class="slice" :style="{ '--i': index, '--a': `${(3 - index) * 8}deg`, '--d': Math.abs(index - 3) }">
        <div class="desk">
          <svg class="wall" viewBox="0 0 1600 450" preserveAspectRatio="none"><defs><linearGradient id="uw-a" x2="1" y2=".35"><stop stop-color="#1b2a6b" /><stop offset=".38" stop-color="#3f6fd0" /><stop offset=".62" stop-color="#9a7ad8" /><stop offset="1" stop-color="#f1a98f" /></linearGradient><radialGradient id="uw-b" cx=".5" cy="1.1" r=".8"><stop stop-color="#ffd8c2" stop-opacity=".75" /><stop offset="1" stop-color="#ffd8c2" stop-opacity="0" /></radialGradient></defs><rect width="1600" height="450" fill="url(#uw-a)" /><path d="M0 330C300 230 520 380 820 300S1300 200 1600 290V450H0Z" fill="#1d2160" opacity=".45" /><path d="M0 380C380 310 640 420 980 350S1420 300 1600 360V450H0Z" fill="#141641" opacity=".55" /><rect width="1600" height="450" fill="url(#uw-b)" /></svg>
          <div class="menubar"><b /><strong>Code</strong><span>File</span><span>Edit</span><span>Selection</span><span>View</span><i /><span>100%</span><span>Wed 9:41</span></div>
          <div class="win code"><div class="bar"><i /><i /><i /><em>workspace.ts — lab</em></div><pre><span>// One wide canvas, nothing in the way.</span>
<b>export const</b> studio = {
  displays: <u>1</u>,
  width: <u>'32:9'</u>,
  focus: <u>'deep'</u>,
};

<b>function</b> create(idea: Idea) {
  <b>return</b> idea.shape().ship();
}</pre></div>
          <div class="win finder"><div class="bar"><i /><i /><i /><em>Projects</em></div><div class="files"><aside><b>Favourites</b><span>Recents</span><span>Desktop</span><span>Projects</span></aside><main><div v-for="name in ['Lab', 'Sketches', 'Renders', 'Notes']" :key="name"><svg viewBox="0 0 48 40"><path d="M3 10h17l5 5h20v21H3Z" fill="#62b6ef" /><path d="M3 10V5h16l5 5" fill="#9fdaf7" /></svg>{{ name }}</div></main></div></div>
          <div class="win term"><div class="bar"><i /><i /><i /><em>zsh</em></div><pre><u>~/lab</u> % pnpm dev
  ready in 412 ms
  ➜ local: http://localhost:3000
<u>~/lab</u> % git commit -m "wider"
  1 file changed
<u>~/lab</u> % █</pre></div>
          <div class="dock"><i v-for="n in 7" :key="n" /></div>
        </div>
      </div>
    </div>
    <div class="beam" />
    <div class="macbook"><div class="lid"><div class="glow" /></div><div class="base" /></div>
  </div>
</template>

<style scoped>
/* The desktop is drawn at a fixed design size (--dw per slice) and scaled by --k, so it never reflows. */
.ultrawide { --k: .7; --dw: 12.4cqw; --w: calc(var(--dw) * var(--k)); --r: calc(var(--w) * 7.17); position: relative; width: 100%; padding-top: 4px; perspective: 160cqw; perspective-origin: 50% 40%; }
.curve { position: relative; height: calc(var(--w) * 7 * 9 / 32); transform-style: preserve-3d; }
.slice { position: absolute; top: 0; left: 50%; width: calc(var(--w) + 1px); height: 100%; margin-left: calc(var(--w) / -2); overflow: hidden; transform: translateZ(calc(var(--r) * .94)) rotateY(var(--a)) translateZ(calc(var(--r) * -1)); backface-visibility: hidden; filter: brightness(calc(1 - var(--d) * var(--d) * .012)); }
.slice:first-child { border-radius: 1.1cqw 0 0 1.1cqw; }
.slice:last-child { border-radius: 0 1.1cqw 1.1cqw 0; }
.slice::after { content: ""; position: absolute; inset: 0; box-shadow: inset 0 1px 0 rgb(255 255 255 / .25), inset 0 -1px 0 rgb(255 255 255 / .1); pointer-events: none; }
.desk { position: absolute; top: 0; left: calc(var(--w) * var(--i) * -1); width: calc(var(--dw) * 7); height: calc(var(--dw) * 7 * 9 / 32); transform: scale(var(--k)); transform-origin: 0 0; text-align: left; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; color: #fff; }
.wall { position: absolute; inset: 0; width: 100%; height: 100%; }
.menubar { position: relative; display: flex; gap: 1.2cqw; align-items: center; height: 1.9cqw; padding: 0 1.3cqw; font-size: .78cqw; background: rgb(13 19 54 / .38); }
.menubar b { width: .8cqw; height: .9cqw; border-radius: 40% 40% 45% 45%; background: #fff; }
.menubar i { flex: 1; }
.win { position: absolute; border-radius: .8cqw; overflow: hidden; box-shadow: 0 1.2cqw 2.6cqw rgb(0 0 0 / .45), 0 0 0 1px rgb(255 255 255 / .15); }
.bar { display: flex; gap: .35cqw; align-items: center; height: 1.7cqw; padding: 0 .7cqw; font-size: .66cqw; background: rgb(255 255 255 / .08); }
.bar i { width: .55cqw; height: .55cqw; border-radius: 50%; background: #ff6158; }
.bar i:nth-child(2) { background: #ffbd2e; }
.bar i:nth-child(3) { background: #28c840; }
.bar em { flex: 1; text-align: center; font-style: normal; opacity: .7; padding-right: 2cqw; }
pre { margin: 0; padding: .9cqw 1.2cqw; font: .86cqw/1.75 "SFMono-Regular", Consolas, monospace; color: #c9d8f0; white-space: pre; }
pre span { color: #6f8f80; }
pre b { color: #ff86c8; font-weight: 500; }
pre u { text-decoration: none; color: #8fd0ff; }
.code { left: 3.5%; top: 13%; width: 30%; height: 72%; background: rgb(20 25 40 / .92); }
.finder { left: 36%; top: 16%; width: 28%; height: 60%; background: rgb(240 243 248 / .95); color: #36404f; }
.finder .bar { background: #e2e6ec; color: #36404f; }
.files { display: flex; height: calc(100% - 1.7cqw); }
.files aside { width: 30%; padding: .9cqw .8cqw; display: flex; flex-direction: column; gap: .7cqw; font-size: .66cqw; color: #7d8795; background: #e3e8ee; }
.files aside b { font-weight: 600; color: #9aa3b0; font-size: .58cqw; }
.files main { flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 1cqw; padding: 1.3cqw; font-size: .66cqw; text-align: center; align-content: start; }
.files main svg { display: block; width: 3cqw; height: 2.5cqw; margin: 0 auto .3cqw; }
.term { left: 67%; top: 18%; width: 29%; height: 52%; background: rgb(12 14 20 / .9); }
.term pre { color: #d6e2d6; }
.term pre u { color: #7fe3a5; }
.dock { position: absolute; left: 50%; bottom: 3.5%; transform: translateX(-50%); display: flex; gap: .55cqw; padding: .55cqw .7cqw; border-radius: 1.2cqw; background: rgb(255 255 255 / .22); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .22); }
.dock i { width: 2.3cqw; height: 2.3cqw; border-radius: .6cqw; background: linear-gradient(140deg, #b8edff, #2a8fe6); box-shadow: inset 0 1px 0 rgb(255 255 255 / .45); }
.dock i:nth-child(2) { background: linear-gradient(140deg, #3c3f48, #15161b); }
.dock i:nth-child(3) { background: linear-gradient(140deg, #8fd6a0, #23794c); }
.dock i:nth-child(4) { background: linear-gradient(140deg, #ffe08a, #f08a3c); }
.dock i:nth-child(5) { background: linear-gradient(140deg, #c3b4ff, #6a4fd8); }
.dock i:nth-child(6) { background: linear-gradient(140deg, #ffb3c7, #e0466f); }
.dock i:nth-child(7) { background: linear-gradient(140deg, #dfe5ee, #7b8699); }
/* The Mac below, sending its picture up into the space. */
.beam { position: relative; margin: .2cqw auto 0; width: 24cqw; height: 2.3cqw; background: linear-gradient(to top, rgb(150 200 255 / .34), rgb(150 200 255 / 0)); clip-path: polygon(43% 100%, 57% 100%, 100% 0, 0 0); opacity: .8; animation: beam 4s ease-in-out infinite; }
.macbook { position: relative; width: 7cqw; margin: 0 auto; }
.lid { position: relative; height: 4.1cqw; border-radius: .55cqw .55cqw .15cqw .15cqw; background: linear-gradient(#2a2f3a, #171a21); box-shadow: inset 0 0 0 .22cqw #0b0d11, 0 0 0 1px rgb(255 255 255 / .16); overflow: hidden; }
.glow { position: absolute; inset: .35cqw; border-radius: .3cqw; background: linear-gradient(135deg, #3f6fd0, #9a7ad8 60%, #f1a98f); opacity: .85; }
.base { height: .4cqw; margin: 0 -.8cqw; border-radius: 0 0 .7cqw .7cqw; background: linear-gradient(#d9dee6, #8d95a3); box-shadow: 0 1cqw 1.6cqw rgb(0 0 0 / .4); }
@keyframes beam { 50% { opacity: .45; } }
/* Connecting: the slices light up from the middle out. */
.connecting .slice { animation: wake 1.6s ease-in-out infinite; animation-delay: calc(var(--d) * 120ms); }
.connecting .beam { animation-duration: 1.2s; opacity: 1; }
@keyframes wake { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .beam, .connecting .slice { animation: none; } }
</style>
