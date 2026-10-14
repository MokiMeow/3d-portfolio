<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  family: 'clock' | 'weather' | 'photos' | 'music' | 'calendar' | 'notes';
  finish: 'Paper' | 'Glass';
  frame: 'Natural' | 'White' | 'Black' | 'Walnut';
  now: Date;
  photoIndex: number;
  playing?: boolean;
}>();
const photographs = [
  { src: '/phone/photos/sunset-0.webp', alt: 'Sunset' },
  { src: '/phone/photos/mountains-3.webp', alt: 'Mountains' },
  { src: '/phone/photos/beach-2.webp', alt: 'Beach' },
  { src: '/phone/photos/cat-1.webp', alt: 'Cat' },
  { src: '/phone/photos/city-1.webp', alt: 'City' },
  { src: '/phone/photos/masala-0.webp', alt: 'Masala' },
  { src: '/phone/photos/houseplant-6.webp', alt: 'Houseplant' },
] as const;
const secondPhase = ref(0);
onMounted(() => { secondPhase.value = -(props.now.getSeconds() + props.now.getMilliseconds() / 1000); });
const clockStyle = computed(() => ({
  '--hour': ((props.now.getHours() % 12) * 30 + props.now.getMinutes() / 2) + 'deg',
  '--minute': (props.now.getMinutes() * 6 + props.now.getSeconds() / 10) + 'deg',
  '--second': props.now.getSeconds() * 6 + 'deg',
  '--phase': secondPhase.value + 's',
}));
const sky = computed(() => {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(props.now));
  return hour < 6 || hour >= 19 ? 'night' : hour < 8 || hour >= 17 ? 'golden' : 'day';
});
const weekday = computed(() => new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(props.now));
const month = computed(() => new Intl.DateTimeFormat(undefined, { month: 'long' }).format(props.now));
</script>

<template>
  <div class="face" :class="[family, finish.toLowerCase(), 'frame-' + frame.toLowerCase()]">
    <div v-if="family === 'clock'" class="dial" :style="clockStyle">
      <span v-for="number in 12" :key="number" class="numeral" :style="{ '--n': number }"><span>{{ number }}</span></span>
      <span class="hand hour" /><span class="hand minute" /><span class="second-pivot"><span class="hand second" /></span><span class="pin" />
      <small class="dial-label">LOCAL TIME</small>
    </div>
    <div v-else-if="family === 'weather'" class="sky" :class="sky">
      <div class="celestial" aria-hidden="true" /><div class="cloud cloud-one" aria-hidden="true" /><div class="cloud cloud-two" aria-hidden="true" /><div class="stars" aria-hidden="true" />
      <div class="weather-copy"><b>Bengaluru</b><small>Demo forecast</small><strong>{{ sky === 'night' ? '22°' : '27°' }}</strong><span>{{ sky === 'night' ? 'Clear skies' : 'Partly cloudy' }}</span><small>H: 29° &nbsp; L: 20°</small></div>
    </div>
    <div v-else-if="family === 'photos'" class="photo-mat">
      <img v-for="(photo, index) in photographs" :key="photo.src" :src="photo.src" :alt="photo.alt" :class="{ visible: index === photoIndex }" draggable="false" />
    </div>
    <div v-else-if="family === 'music'" class="poster" :class="{ playing }">
      <div class="album-art" aria-hidden="true"><div class="art-sun" /><div class="art-horizon" /><div class="art-orbit" /></div>
      <div class="album-copy"><small>FICTIONAL ALBUM</small><b>After Hours</b><span>The Lab Band</span><div class="play-line"><span class="equalizer" aria-hidden="true"><i v-for="bar in 5" :key="bar" :style="{ '--i': bar }" /></span><small>{{ playing ? 'Playing · visual only' : 'Tap to play · visual only' }}</small></div></div>
    </div>
    <div v-else-if="family === 'calendar'" class="agenda"><b>{{ weekday }}</b><strong>{{ now.getDate() }}</strong><span>{{ month }}</span><small>Demo events</small><p><i />Chai with the team <time>4:00</time></p><p><i />Ship the thing <time>6:30</time></p></div>
    <div v-else class="note"><small>A LITTLE ROOM TO THINK</small><h3>Ideas</h3><p>Give the moon a dark mode.</p><p>Teach the rubber duck to code.</p><p>Less tabs. More chai.</p><p>Ship before the plants notice.</p><span class="note-rule" /></div>
  </div>
</template>

<style scoped>
.face{position:relative;width:100%;height:100%;box-sizing:border-box;overflow:hidden;border:6px solid var(--frame);border-radius:25px;color:#fff;box-shadow:inset 0 1px 0 rgb(255 255 255 / .3),0 10px 24px rgb(0 0 0 / .2);font:400 15px/1.35 -apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;letter-spacing:-.015em}
.face *{box-sizing:border-box;font-family:inherit}.frame-natural{--frame:#c6b39a}.frame-white{--frame:#eeeae4}.frame-black{--frame:#25262b}.frame-walnut{--frame:#76523c}
.glass{background:linear-gradient(135deg,rgb(255 255 255 / .16),rgb(255 255 255 / .035)),rgb(45 48 54 / .5);backdrop-filter:blur(36px) saturate(125%);-webkit-backdrop-filter:blur(36px) saturate(125%);box-shadow:inset 0 1px 0 rgb(255 255 255 / .4),0 14px 34px rgb(0 0 0 / .26)}
.paper{color:#292722;background:#f6f0e3;box-shadow:inset 0 1px 0 #fff8,0 3px 5px #0003,0 12px 22px #0002}
.paper::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.08;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23000' filter='url(%23n)' opacity='.7' d='M0 0h120v120H0z'/%3E%3C/svg%3E")}
.clock{border-radius:50%}.dial{position:absolute;inset:7px;border-radius:50%;background:radial-gradient(circle at 30% 15%,#ffffff12,transparent 65%);box-shadow:inset 0 0 0 1px currentColor}.paper .dial{background:#f8f3e8}.numeral{position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px;font-size:20px;font-weight:500;transform:rotate(calc(var(--n) * 30deg)) translateY(-80px)}.numeral>span{display:block;text-align:center;transform:rotate(calc(var(--n) * -30deg))}
.hand{position:absolute;left:50%;bottom:50%;width:4px;margin-left:-2px;border-radius:4px;transform-origin:50% 100%;background:currentColor}.hour{height:49px;width:6px;margin-left:-3px;transform:rotate(var(--hour))}.minute{height:70px;transform:rotate(var(--minute))}.second-pivot{position:absolute;inset:0;animation:seconds 60s linear infinite;animation-delay:var(--phase)}.second{height:79px;width:2px;margin-left:-1px;background:#ff705d}.second::after{content:'';position:absolute;top:100%;width:2px;height:18px;background:inherit}.pin{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;background:#ff705d}.dial-label{position:absolute;left:0;right:0;bottom:48px;text-align:center;font-size:8px;letter-spacing:.14em;opacity:.55}
.sky{position:absolute;inset:0;overflow:hidden;color:#fff;background:linear-gradient(160deg,#398fc3,#8fc2dc 60%,#c7dfe5);animation:sky-light 14s ease-in-out infinite alternate}.sky.golden{background:linear-gradient(160deg,#94779e,#e3ac95 60%,#f6d5a8)}.sky.night{background:linear-gradient(150deg,#121831,#334268 70%,#5b5373)}.weather-copy{position:relative;padding:20px;display:flex;flex-direction:column;text-shadow:0 2px 12px #0005}.weather-copy b{font-size:20px}.weather-copy small{font-size:11px;opacity:.8}.weather-copy strong{font-size:64px;font-weight:300;line-height:1.15;margin:13px 0 4px}.weather-copy>span{font-size:16px;margin-bottom:6px}.celestial{position:absolute;right:30px;top:43px;width:46px;height:46px;border-radius:50%;background:#fff4c6;box-shadow:0 0 40px #fff6c77a}.night .celestial{width:30px;height:30px;background:#f3f1ff;box-shadow:0 0 35px #b5c4ff55}.cloud{position:absolute;right:-20px;top:90px;width:130px;height:30px;border-radius:50%;background:#ffffffe0;filter:blur(7px);animation:drift 23s ease-in-out infinite alternate}.cloud::before{content:'';position:absolute;left:25px;bottom:10px;width:67px;height:37px;border-radius:50%;background:inherit}.cloud-two{top:160px;right:-55px;opacity:.4;animation-delay:-12s}.night .cloud{display:none}.stars{display:none;position:absolute;inset:0;background:radial-gradient(circle at 73% 12%,#fff 1px,transparent 2px),radial-gradient(circle at 82% 70%,#fff 1px,transparent 2px),radial-gradient(circle at 53% 35%,#fff 1px,transparent 2px),radial-gradient(circle at 93% 44%,#fff 1px,transparent 2px);animation:twinkle 5s ease-in-out infinite alternate}.night .stars{display:block}
.photo-mat{position:absolute;inset:0;overflow:hidden}.paper .photo-mat{inset:14px;background:#fff}.photos.paper{background:#fffdfa}.photo-mat img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.4s ease;pointer-events:none}.photo-mat img.visible{opacity:1}
.poster{height:100%;background:#111521;color:#fff;display:flex;flex-direction:column}.album-art{position:relative;flex:1;overflow:hidden;min-height:145px;background:radial-gradient(ellipse at 20% 20%,#4b7eac,transparent 55%),linear-gradient(150deg,#182840,#ba5462)}.art-sun{position:absolute;width:130px;height:130px;left:50%;top:35%;margin:-65px;border-radius:50%;background:linear-gradient(#ffdda3,#e87573);box-shadow:0 0 40px #ffc19b44}.art-horizon{position:absolute;inset:58% -20% -20%;background:repeating-linear-gradient(0deg,#282742 0 3px,#63516c 3px 4px);transform:rotate(-17deg)}.art-orbit{position:absolute;width:200px;height:70px;left:50%;top:39%;margin-left:-100px;border:1px solid #ffffff85;border-radius:50%;transform:rotate(-35deg)}.album-copy{padding:17px;display:flex;flex-direction:column;gap:4px}.album-copy>small{font-size:8px;letter-spacing:.16em;opacity:.6}.album-copy b{font-size:27px;font-weight:600;letter-spacing:-.035em}.album-copy>span{font-size:13px;opacity:.7}.play-line{display:flex;align-items:center;gap:8px;margin-top:12px}.play-line small{font-size:9px;opacity:.65}.equalizer{height:19px;display:flex;align-items:center;gap:3px}.equalizer i{height:5px;width:3px;background:#ffa2a5;border-radius:2px}.playing .equalizer i{height:18px;animation:equalize .8s ease-in-out infinite alternate;animation-delay:calc(var(--i) * -.17s)}
.agenda{padding:19px;display:flex;flex-direction:column}.agenda>b{font-size:15px;color:#ff8577}.paper .agenda>b{color:#bf4d43}.agenda strong{font-size:66px;font-weight:300;line-height:1.1}.agenda>span{font-size:15px}.agenda>small{margin-top:13px;font-size:9px;opacity:.55;text-transform:uppercase;letter-spacing:.12em}.agenda p{display:flex;align-items:center;gap:7px;margin:9px 0 0;font-size:11px}.agenda p i{width:3px;height:24px;border-radius:2px;background:#9aaaff;flex:none}.agenda p:last-child i{background:#ffb565}.agenda time{margin-left:auto;opacity:.7;font-variant-numeric:tabular-nums}
.note{padding:23px 20px}.note>small{font-size:8px;letter-spacing:.13em;opacity:.5}.note h3{margin:13px 0 18px;font-size:31px;font-weight:500}.note p{font-size:14px;margin:0 0 12px;line-height:1.4}.paper .note h3,.paper .note p{font-family:'Segoe Print','Bradley Hand','Comic Sans MS',cursive!important}.note-rule{display:block;height:1px;margin-top:21px;background:currentColor;opacity:.12}
@keyframes seconds{to{transform:rotate(360deg)}}@keyframes drift{to{transform:translateX(-45px)}}@keyframes sky-light{to{filter:brightness(1.07)}}@keyframes twinkle{to{opacity:.45}}@keyframes equalize{from{transform:scaleY(.25)}to{transform:scaleY(1)}}
@media(prefers-reduced-motion:reduce){.face *{animation:none!important;transition:none!important}.second-pivot{transform:rotate(var(--second))}}
</style>
