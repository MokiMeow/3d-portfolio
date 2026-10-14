<script setup lang="ts">
defineProps<{ reaction: number; applause?: boolean }>();
const colors = ['#b0a3a0','#91a8b4','#b5a88b','#9e9cb5','#9eafa2','#b09896'];
</script>
<template>
<svg viewBox="0 0 530 90" role="img" aria-label="A fictional audience of six softly animated silhouettes">
  <g v-for="(color,i) in colors" :key="i" :transform="'translate('+(25+i*86)+' 3)'" :class="{clapping:applause || reaction===0 && i===1,coughing:reaction===1 && i===3,phone:reaction===2 && i===4,notes:reaction===3 && i===2}">
    <rect x="-5" y="58" width="58" height="26" rx="9" fill="#ffffff0c"/>
    <g class="person"><path d="M2 79V62c0-24 41-24 41 0v17" :fill="color" opacity=".43"/><ellipse class="head" cx="22" cy="27" rx="13" ry="16" :fill="color" opacity=".75"/>
    <path class="left-arm" d="M5 61 13 46" :stroke="color" stroke-width="7" stroke-linecap="round"/><path class="right-arm" d="m39 61-8-15" :stroke="color" stroke-width="7" stroke-linecap="round"/>
    <rect class="screen" x="23" y="46" width="12" height="20" rx="3" fill="#99d5ed" opacity=".85"/><path class="notebook" d="M14 57h22v13H14Z" fill="#ddd3b8" opacity=".7"/>
    </g>
  </g>
</svg>
</template>
<style scoped>
svg {
  width: 100%;
  max-width: 530px;
  height: 70px;
  display: block;
  margin: auto;
}
.left-arm,.right-arm {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.screen,.notebook {
  opacity: 0;
}
.clapping .left-arm,.clapping .right-arm {
  opacity: .7;
  animation: audience-clap .4s ease-in-out infinite alternate;
}
.clapping .right-arm {
  animation-direction: alternate-reverse;
}
.coughing .head {
  transform-box: fill-box;
  transform-origin: center;
  animation: audience-cough .65s ease-in-out 3;
}
.coughing .right-arm {
  opacity: .7;
  transform: translate(-8px,-17px);
}
.phone .screen {
  opacity: .8;
}
.phone .head {
  transform: rotate(10deg);
  transform-box: fill-box;
  transform-origin: center;
}
.notes .notebook {
  opacity: .7;
}
.notes .right-arm {
  opacity: .6;
  transform: translate(-7px,9px);
  animation: audience-notes .8s ease-in-out infinite alternate;
}
@keyframes audience-clap {
  to {
    transform: rotate(18deg);
  }
}
@keyframes audience-cough {
  50% {
    transform: translateY(3px) rotate(6deg);
  }
}
@keyframes audience-notes {
  to {
    transform: translate(-12px,9px);
  }
}
@media(prefers-reduced-motion:reduce) {
  svg * {
    animation: none!important;
  }
}
</style>
