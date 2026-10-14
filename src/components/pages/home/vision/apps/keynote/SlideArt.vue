<script setup lang="ts">
import { computed, useId } from 'vue';
import { deck, palettes, type Theme } from './deck';
const props = defineProps<{ index: number; theme: Theme; animate?: boolean }>();
const p = computed(() => palettes[props.theme]);
const slide = computed(() => deck[props.index] ?? deck[0]!);
const uid = 'calm-slide-' + useId().replace(/:/g, '');
const chart = [{label:'Less searching',value:28},{label:'Clearer choices',value:46},{label:'Larger targets',value:64},{label:'Room to breathe',value:88}];
</script>
<template>
<svg class="slide-art" :class="{animated:animate}" viewBox="0 0 960 540" role="img" :aria-label="slide.title + ' ' + slide.subtitle" :style="{'--ink':p.ink,'--accent':p.accent,'--muted':p.muted}">
  <defs>
    <linearGradient :id="uid+'-scene'" x1="0" y1="0" x2="1" y2="1"><stop :stop-color="p.second"/><stop offset=".6" :stop-color="p.accent"/><stop offset="1" :stop-color="p.card"/></linearGradient>
    <radialGradient :id="uid+'-orb'" cx=".28" cy=".24"><stop :stop-color="p.ink" stop-opacity=".5"/><stop offset=".6" :stop-color="p.accent" stop-opacity=".6"/><stop offset="1" :stop-color="p.card" stop-opacity=".1"/></radialGradient>
    <linearGradient :id="uid+'-bar'" x1="0" y1="1" x2="0" y2="0"><stop :stop-color="p.accent" stop-opacity=".55"/><stop offset="1" :stop-color="p.accent"/></linearGradient>
    <clipPath :id="uid+'-image'"><rect x="482" y="54" width="420" height="432" rx="32"/></clipPath>
  </defs>
  <rect width="960" height="540" :fill="p.bg"/>
  <g :fill="p.muted" font-size="10" font-weight="600" letter-spacing="2"><text x="56" y="35">THE CRAFT OF CALM</text><text x="904" y="35" text-anchor="end">A DEMO DECK</text></g>
  <template v-if="index===0">
    <circle cx="794" cy="232" r="163" :fill="'url(#'+uid+'-orb)'"/>
    <ellipse cx="778" cy="264" rx="159" ry="63" :stroke="p.accent" fill="none" stroke-width="1" opacity=".45" transform="rotate(-30 778 264)"/>
    <circle cx="883" cy="173" r="15" :fill="p.second"/>
    <text x="56" y="132" :fill="p.accent" font-size="15" letter-spacing="4">LESS NOISE. MORE INTENTION.</text>
    <g :fill="p.ink" font-size="84" font-weight="700" letter-spacing="-5"><text x="53" y="246">Make room</text><text x="53" y="335">for calm.</text></g>
    <path d="M59 361q163 13 361-3" :stroke="p.accent" stroke-width="4" fill="none" stroke-linecap="round"/>
    <text x="58" y="420" :fill="p.muted" font-size="20">A few thoughtful decisions.</text><text x="58" y="451" :fill="p.muted" font-size="20">A little less noise.</text>
  </template>
  <template v-else-if="index===1">
    <path d="M665 55h239v430H730l-135-213Z" :fill="p.card"/>
    <text x="61" y="191" :fill="p.accent" font-size="155" font-family="Georgia,serif" opacity=".75">“</text>
    <g :fill="p.ink" font-family="Georgia,serif" font-size="47" letter-spacing="-1"><text x="78" y="249">Calm is what happens</text><text x="78" y="311">when every detail</text><text x="78" y="373">knows why it is here.</text></g>
    <path d="M80 418h53" :stroke="p.accent" stroke-width="3"/><text x="148" y="425" :fill="p.muted" font-size="15">An original thought for this fictional deck.</text>
  </template>
  <template v-else-if="index===2">
    <text x="56" y="112" :fill="p.ink" font-size="43" font-weight="650" letter-spacing="-2">From noise to clarity.</text><text x="58" y="151" :fill="p.muted" font-size="18">Three ways to spend the same attention.</text>
    <g v-for="(item,i) in ['Noise','Clarity','Calm']" :key="item" :transform="'translate('+(56+i*286)+' 192)'">
      <rect width="268" height="270" rx="24" :fill="p.card"/><text x="25" y="39" :fill="p.muted" font-size="12" letter-spacing="2">0{{ i+1 }}</text>
      <g :stroke="p.accent" fill="none" stroke-width="2.5" stroke-linecap="round"><path v-if="i===0" d="M26 98h17l9-26 11 48 12-42 10 20h18"/><path v-else-if="i===1" d="M26 87h77m-77 14h48m-48 14h62"/><path v-else d="M28 94q40-41 73 0-33 41-73 0Z"/><circle v-if="i===2" cx="64" cy="94" r="10"/></g>
      <text x="25" y="166" :fill="p.ink" font-size="31" font-weight="600">{{ item }}</text>
      <g :fill="p.muted" font-size="17"><template v-if="i===0"><text x="25" y="207">Everything competes.</text><text x="25" y="235">Nothing feels first.</text></template><template v-else-if="i===1"><text x="25" y="207">One clear next step.</text><text x="25" y="235">Room for the rest.</text></template><template v-else><text x="25" y="207">Confidence, quietly.</text><text x="25" y="235">Effort, thoughtfully.</text></template></g>
    </g>
  </template>
  <template v-else-if="index===3">
    <text x="56" y="104" :fill="p.ink" font-size="40" font-weight="650" letter-spacing="-1.5">Give attention a place to land.</text><text x="58" y="143" :fill="p.muted" font-size="15">Illustrative attention scores · invented numbers, not research</text>
    <g :stroke="p.muted" opacity=".13" stroke-dasharray="3 6"><path v-for="y in [202,269,336,403]" :key="y" :d="'M75 '+y+'H885'"/></g>
    <g v-for="(bar,i) in chart" :key="bar.label" :transform="'translate('+(98+i*202)+' 0)'">
      <rect class="chart-bar" x="0" :y="423-bar.value*2.6" width="134" :height="bar.value*2.6" rx="13" :fill="'url(#'+uid+'-bar)'" :style="{'--delay':i*.1+'s'}"/>
      <text x="67" :y="410-bar.value*2.6" text-anchor="middle" :fill="p.ink" font-size="25" font-weight="600">{{ bar.value }}</text><text x="67" y="459" text-anchor="middle" :fill="p.muted" font-size="15">{{ bar.label }}</text>
    </g>
  </template>
  <template v-else-if="index===4">
    <circle cx="279" cy="280" r="201" :fill="p.card"/><text x="80" y="376" :fill="p.accent" font-size="270" font-weight="650" letter-spacing="-20">44</text>
    <g :fill="p.ink" font-size="37" font-weight="600" letter-spacing="-1"><text x="521" y="210">A small space.</text><text x="521" y="256">A generous target.</text></g>
    <g :fill="p.muted" font-size="20"><text x="523" y="316">Pixels of consideration.</text><text x="523" y="349">A tap that feels easy.</text><text x="523" y="382">A quiet act of kindness.</text></g><rect x="523" y="420" width="44" height="44" rx="22" :fill="p.accent"/><path d="M538 442h14m-7-7v14" :stroke="p.bg" stroke-width="2" stroke-linecap="round"/><text x="584" y="447" :fill="p.muted" font-size="14">Our demo’s minimum touch target.</text>
  </template>
  <template v-else-if="index===5">
    <g :fill="p.ink" font-size="63" font-weight="650" letter-spacing="-3"><text x="55" y="219">A room</text><text x="55" y="288">to breathe.</text></g><text x="58" y="343" :fill="p.muted" font-size="19">Depth. Light. Space.</text><text x="58" y="377" :fill="p.muted" font-size="19">Let the quiet details speak.</text>
    <g :clip-path="'url(#'+uid+'-image)'">
      <rect x="482" y="54" width="420" height="432" :fill="'url(#'+uid+'-scene)'"/><circle cx="824" cy="113" r="77" :fill="p.ink" opacity=".27"/>
      <path d="M445 465q167-181 292-67t204 56v100H445Z" :fill="p.bg" opacity=".2"/><path d="M445 519q132-191 267-101t209 11v150H445Z" :fill="p.bg" opacity=".35"/>
      <ellipse cx="695" cy="400" rx="137" ry="24" :fill="p.bg" opacity=".2"/>
      <rect x="590" y="176" width="217" height="217" rx="28" :fill="p.bg" opacity=".15"/><rect x="578" y="161" width="217" height="217" rx="28" :fill="p.ink" opacity=".82"/>
      <text x="603" y="200" :fill="p.bg" font-size="11" letter-spacing="2">A LITTLE SPACE</text><text x="603" y="244" :fill="p.bg" font-size="23" font-weight="600">Focus, softly.</text>
      <path d="M604 273h158m-158 15h116" :stroke="p.bg" opacity=".22" stroke-width="5" stroke-linecap="round"/><rect x="601" y="321" width="102" height="32" rx="16" :fill="p.accent"/><text x="652" y="342" text-anchor="middle" :fill="p.bg" font-size="12" font-weight="600">Take a moment</text><circle cx="839" cy="336" r="24" :fill="'url(#'+uid+'-orb)'"/><circle cx="539" cy="109" r="16" :fill="p.second"/>
    </g>
  </template>
  <template v-else-if="index===6">
    <g :fill="p.ink" font-size="39" font-weight="650" letter-spacing="-1.5"><text x="56" y="109">Calm arrives</text><text x="56" y="157">one decision at a time.</text></g><path d="M84 272H870" :stroke="p.accent" stroke-width="2" opacity=".45"/>
    <g v-for="(item,i) in ['Notice','Remove','Refine','Repeat']" :key="item" :transform="'translate('+(80+i*220)+' 0)'">
      <circle cx="0" cy="272" r="9" :fill="p.accent"/><circle cx="0" cy="272" r="19" :stroke="p.accent" fill="none" opacity=".2"/><text x="0" y="237" :fill="p.muted" font-size="12" letter-spacing="2">0{{ i+1 }}</text><text x="0" y="329" :fill="p.ink" font-size="27" font-weight="600">{{ item }}</text>
      <g :fill="p.muted" font-size="16"><template v-if="i===0"><text x="0" y="368">Find the friction.</text><text x="0" y="394">Listen closely.</text></template><template v-else-if="i===1"><text x="0" y="368">Keep what matters.</text><text x="0" y="394">Let the rest go.</text></template><template v-else-if="i===2"><text x="0" y="368">Tune the details.</text><text x="0" y="394">Make room.</text></template><template v-else><text x="0" y="368">Try it with people.</text><text x="0" y="394">Keep learning.</text></template></g>
    </g>
  </template>
  <template v-else>
    <circle cx="750" cy="297" r="227" :fill="'url(#'+uid+'-orb)'"/><path d="M506 347q146-123 388-46" :stroke="p.accent" fill="none" stroke-width="1" opacity=".4"/>
    <text x="54" y="258" :fill="p.ink" font-size="94" font-weight="650" letter-spacing="-5">Thank you.</text><text x="59" y="330" :fill="p.accent" font-size="53" font-family="Georgia,serif" font-style="italic">Questions?</text>
    <text x="59" y="430" :fill="p.muted" font-size="20">Let’s make the next thing feel a little lighter.</text><circle cx="851" cy="166" r="13" :fill="p.second"/>
  </template>
  <g :fill="p.muted" font-size="10"><text x="56" y="515">Thoughtful by design. Fictional by nature.</text><text x="904" y="515" text-anchor="end">{{ String(index+1).padStart(2,'0') }} / 08</text></g>
</svg>
</template>
<style scoped>
.slide-art {
  display: block;
  width: 100%;
  height: 100%;
  font-family: -apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue',sans-serif;
}
.animated .chart-bar {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: bar-arrive .9s var(--delay) var(--vk-spring) both;
}
@keyframes bar-arrive {
  from {
    transform: scaleY(.01);
    opacity: .35;
  }
}
@media(prefers-reduced-motion:reduce) {
  .chart-bar {
    animation: none!important;
  }
}
</style>
