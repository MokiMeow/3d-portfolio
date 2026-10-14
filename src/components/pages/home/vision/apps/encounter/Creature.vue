<script setup lang="ts">
defineProps<{
  scene: 'valley' | 'lagoon';
  mood: 'idle' | 'sniff' | 'roar' | 'feed';
  walking: boolean;
  paused: boolean;
  headAngle: number;
  id: string;
}>();
</script>

<template>
  <svg class="creature-art" :class="[scene, mood, { walking, paused }]" viewBox="0 0 760 510" aria-hidden="true">
    <defs>
      <linearGradient :id="id + '-skin'" x1="0" y1="0" x2=".8" y2="1">
        <stop offset="0" stop-color="#bec59b" />
        <stop offset=".38" stop-color="#829371" />
        <stop offset="1" stop-color="#3c5a4e" />
      </linearGradient>
      <linearGradient :id="id + '-belly'" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#eee1ac" />
        <stop offset="1" stop-color="#a6a17d" />
      </linearGradient>
      <linearGradient :id="id + '-copper'" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#d0af8a" />
        <stop offset=".42" stop-color="#9d795d" />
        <stop offset="1" stop-color="#4e615e" />
      </linearGradient>
      <radialGradient :id="id + '-eye'">
        <stop stop-color="#fff6c5" />
        <stop offset=".7" stop-color="#e6bd66" />
        <stop offset="1" stop-color="#9b702f" />
      </radialGradient>
      <pattern :id="id + '-scales'" width="19" height="17" patternUnits="userSpaceOnUse">
        <path d="m1 7 4-4 5 3 2 5-5 3-5-3z" fill="none" stroke="#ebebc1" stroke-width=".65" opacity=".18" />
        <circle cx="16" cy="2" r="1.3" fill="#173e35" opacity=".2" />
      </pattern>
    </defs>
    <ellipse class="ground-shadow" cx="421" cy="468" rx="243" ry="24" fill="#061b17" opacity=".5" />
    <g v-if="scene === 'valley'" class="animal">
      <path class="tail" d="M338 293C233 318 135 316 85 274 47 242 46 186 12 180c18 16 19 47 27 69 30 90 181 140 321 124z"
        :fill="'url(#' + id + '-skin)'" stroke="#526e57" stroke-width="2" />
      <g class="back-leg">
        <path d="M465 299c38 33 29 75-4 116l32 43 44 8c17 2 27 11 23 20h-87c-15-24-43-52-57-67l-12-95z" fill="#4f6c59" />
        <path d="m533 468 11 17m-26-18 9 18" stroke="#ddd5af" stroke-width="9" stroke-linecap="round" />
      </g>
      <g class="breathing">
        <path d="M294 231c44-51 126-63 180-27 51 35 49 125-2 161-54 37-130 33-170-8-41-42-46-80-8-126z"
          :fill="'url(#' + id + '-skin)'" stroke="#526c56" stroke-width="2" />
        <path d="M420 218c44 11 60 48 42 98-14 40-46 54-76 52 24-47 23-89 34-150z" :fill="'url(#' + id + '-belly)'" opacity=".78" />
        <path d="M305 226c35-42 121-64 172-20l-7 16c-68-38-120-17-165 4z" fill="#bdc59a" opacity=".4" />
        <path d="M289 237c34-30 79-35 134-31l-3 80c-36 8-72 9-108 1z" :fill="'url(#' + id + '-scales)'" />
        <path d="m294 228 1-25 26 8 12-24 23 12 20-21 20 16 19-10 16 13" fill="#53735c" />
        <g class="little-arm">
          <path d="M459 257c27 4 31 30 13 44l-28 4" fill="none" stroke="#769574" stroke-width="19" stroke-linecap="round" />
          <path d="m445 301-4 9m15-9 2 9" stroke="#eee0b6" stroke-width="5" stroke-linecap="round" />
        </g>
      </g>
      <g class="front-leg">
        <path d="M365 293c52-5 72 36 34 83l-19 37 26 44 40 10c18 4 24 13 21 21h-87c-12-24-30-46-44-67-11-16-9-25 1-45l-21-42z"
          :fill="'url(#' + id + '-skin)'" stroke="#546e56" stroke-width="2" />
        <path d="m435 470 13 16m-30-18 10 18m-28-20 10 19" stroke="#ede3bd" stroke-width="9" stroke-linecap="round" />
        <path d="M341 388c9 5 19 7 29 5m-12-67c20 2 31 11 34 20" fill="none" stroke="#b6c097" stroke-width="3" opacity=".45" />
      </g>
      <g class="neck">
        <path d="M420 275c-7-71 10-133 74-163l88 8c18 28 9 63-12 94-33 44-64 85-80 119z"
          :fill="'url(#' + id + '-skin)'" stroke="#526c56" stroke-width="2" />
        <path d="M523 162c2 50-39 80-61 135l32 17c20-70 71-89 72-146z" :fill="'url(#' + id + '-belly)'" />
        <path d="M435 192c11-36 30-57 50-65l22 65-43 52z" :fill="'url(#' + id + '-scales)'" />
      </g>
      <g class="tracking-head" :style="{ transform: 'rotate(' + headAngle + 'deg)' }">
        <g class="head-motion">
          <g class="jaw">
            <path d="M512 147c36 19 92 13 142 6l43 32c-22 31-107 37-157 3z" fill="#b9bd95" stroke="#4e6651" stroke-width="2" />
            <path d="M542 176c46 14 103 10 135 1" fill="none" stroke="#dfddb2" stroke-width="3" />
            <path class="mouth-inside" d="M528 153c52 16 113 11 158-3l-12 27c-54 25-100 15-143-5z" fill="#493b35" />
            <path class="teeth" d="m552 167 7 12 7-9 9 12 8-10 8 11 8-13 8 12 8-12 9 10 6-12" fill="#efe8cd" />
          </g>
          <path d="M470 117c3-54 41-83 91-70 40 9 55 36 70 43 30 8 73 7 92 27 20 22 8 48-20 58-38 13-86 14-134 6l-50-15z"
            :fill="'url(#' + id + '-skin)'" stroke="#4e6651" stroke-width="2" />
          <path d="M490 92c24-38 57-36 81-19l-4 16c-27-11-44-8-77 3z" fill="#c4c59b" opacity=".65" />
          <path d="M582 102c35 17 76 9 113 25-11 18-53 25-99 15z" fill="#a8b08a" opacity=".4" />
          <path d="M588 88c17 15 43 21 74 23m-68 12c29 13 72 9 98 18" fill="none" stroke="#617c61" stroke-width="3" opacity=".65" />
          <path d="M491 116c6-24 24-37 41-32l48 36-29 34z" :fill="'url(#' + id + '-scales)'" />
          <g class="eye">
            <ellipse cx="549" cy="104" rx="18" ry="15" :fill="'url(#' + id + '-eye)'" stroke="#3f5947" stroke-width="5" />
            <ellipse cx="554" cy="105" rx="5" ry="12" fill="#172a24" />
            <circle cx="558" cy="100" r="3.5" fill="#fffdeb" />
          </g>
          <path d="M526 86q23-16 43 4" stroke="#526f55" stroke-width="9" stroke-linecap="round" fill="none" />
          <ellipse class="nostril" cx="699" cy="131" rx="7" ry="4" fill="#395440" transform="rotate(-14 699 131)" />
          <path d="M567 165c59 15 104 1 135-7" stroke="#3a5343" stroke-width="3" stroke-linecap="round" fill="none" />
          <path class="upper-teeth" d="m602 174 5 10 6-9 6 10 6-11 6 9 7-12 6 9 7-13" fill="#eee8ce" />
        </g>
      </g>
    </g>
    <g v-else class="animal">
      <path class="tail" d="M314 265c-110 51-175 24-228 1-27-13-51-10-71 6 30-4 56 15 83 36 65 48 153 62 241 24z"
        :fill="'url(#' + id + '-copper)'" />
      <g class="back-leg">
        <path d="M455 297c27 44 15 92 10 118l20 53h55c-2-17-15-28-29-34 15-56 29-111-12-146z" fill="#576460" />
        <path d="M281 302c-23 47-29 107-30 145l18 25h50c2-16-13-28-26-32l35-116z" fill="#68706a" />
      </g>
      <g class="breathing">
        <path d="M262 228c66-57 184-72 264 1 59 54 34 124-31 148-65 24-160 2-211-20-64-29-69-80-22-129z"
          :fill="'url(#' + id + '-copper)'" stroke="#655d4e" stroke-width="2" />
        <path d="M285 239c70-54 171-40 215 9-73-30-140-22-215-9z" fill="#dec19a" opacity=".35" />
        <path d="M251 272c-1 46 76 87 168 85l-5 20c-86-3-137-21-163-53z" fill="#d4ba8e" opacity=".6" />
        <path d="M270 253c66-30 155-40 235 11l-12 47c-81-44-158-21-220 10z" :fill="'url(#' + id + '-scales)'" />
      </g>
      <g class="front-leg">
        <path d="M377 295c30 27 13 81 9 122l23 50c24-1 40 9 40 22h-79c-14-14-19-39-22-59-8-44-17-98 0-123z"
          :fill="'url(#' + id + '-copper)'" stroke="#665f51" stroke-width="2" />
        <path d="m396 473 3 14m-22-15 3 15m40-11 4 11" stroke="#efe0bb" stroke-width="7" stroke-linecap="round" />
      </g>
      <g class="tracking-head" :style="{ transform: 'rotate(' + headAngle + 'deg)' }">
        <g class="head-motion">
          <path d="M464 271c-34-39-42-77-27-130l-12-39 40 1 12-34 30 26 27-26 24 37 34-3 5 39 35 12-12 30 18 38-38 13-16 43z"
            fill="#526e67" stroke="#a49c78" stroke-width="4" />
          <path d="M466 243c-28-36-22-88 11-125 47-5 89 32 100 72-21 30-58 47-111 53z" fill="#9c8c67" />
          <path d="M483 140c22 8 37 21 55 41m-80-2 54 18m-40 26 44-8" fill="none" stroke="#c2ad7e" stroke-width="5" opacity=".5" />
          <g class="jaw">
            <path d="M520 272c35 37 98 52 149 43l18-34-77-39z" fill="#b7a786" stroke="#655e4f" stroke-width="2" />
            <path class="mouth-inside" d="m580 280 99-7-11 28c-24 5-60 0-88-21z" fill="#51423a" />
          </g>
          <path d="M504 194c21-21 57-19 80 7l27 26c36 14 79 34 84 62-11 21-47 25-88 9-43-18-71-17-91-45z"
            :fill="'url(#' + id + '-copper)'" stroke="#655e4f" stroke-width="2" />
          <path d="M541 194c3-40-5-69 4-95 15 38 29 58 23 102z" fill="#e8debd" stroke="#b7aa87" stroke-width="2" />
          <path d="M577 211c15-28 34-53 61-67-17 30-26 57-34 79z" fill="#f4e8c5" stroke="#b7aa87" stroke-width="2" />
          <path d="M660 263c-1-20 7-42 20-53 0 23 3 38 7 56z" fill="#f1e4c1" />
          <g class="eye">
            <ellipse cx="555" cy="237" rx="14" ry="12" :fill="'url(#' + id + '-eye)'" stroke="#5c5a45" stroke-width="4" />
            <ellipse cx="559" cy="238" rx="5" ry="9" fill="#203a31" />
            <circle cx="562" cy="233" r="3" fill="#fffdeb" />
          </g>
          <path d="M540 218q17-9 29 4" fill="none" stroke="#86775b" stroke-width="7" stroke-linecap="round" />
          <ellipse class="nostril" cx="678" cy="284" rx="6" ry="3" fill="#5d5845" />
          <path d="M593 292q49 21 86 6" stroke="#675c49" stroke-width="3" fill="none" stroke-linecap="round" />
          <path d="M530 262c15 6 24 10 33 19" fill="none" stroke="#d3bd96" stroke-width="3" opacity=".5" />
        </g>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.creature-art {
  display: block; width: 100%; height: 100%; overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
}
.creature-art :deep(*) { font-family: inherit; }
.animal { transform-origin: 54% 80%; }
.tracking-head { transform-origin: 505px 201px; transition: transform 220ms ease-out; }
.lagoon .tracking-head { transform-origin: 487px 266px; }
.breathing { transform-origin: 53% 71%; animation: breathe 4.8s ease-in-out infinite; }
.tail { transform-origin: 330px 305px; animation: tail-sway 7s ease-in-out infinite; }
.eye { transform-box: fill-box; transform-origin: center; animation: blink 6.3s ease-in-out infinite; }
.little-arm { transform-origin: 459px 257px; animation: arm-idle 5s ease-in-out infinite; }
.jaw { transform-origin: 522px 162px; transition: transform 250ms cubic-bezier(.2, .9, .3, 1.15); }
.lagoon .jaw { transform-origin: 523px 269px; }
.mouth-inside, .teeth, .upper-teeth { opacity: 0; transition: opacity 220ms ease-out; }
.roar .jaw { transform: rotate(18deg); }
.roar .mouth-inside, .roar .teeth, .roar .upper-teeth { opacity: 1; }
.roar .head-motion { animation: roar 300ms cubic-bezier(.2, .9, .3, 1.15) both; transform-origin: 510px 170px; }
.sniff .head-motion { animation: sniff 300ms ease-out 2; }
.sniff .nostril { animation: nose 300ms ease-out 2; transform-box: fill-box; transform-origin: center; }
.feed .jaw { animation: chew 300ms ease-out 3; }
.walking .front-leg { transform-origin: 365px 302px; animation: step 650ms ease-in-out infinite alternate; }
.walking .back-leg { transform-origin: 453px 302px; animation: step 650ms ease-in-out -650ms infinite alternate; }
.walking .animal { animation: walk-bob 650ms ease-in-out infinite alternate; }
.paused .breathing, .paused .tail, .paused .eye, .paused .little-arm,
.paused .front-leg, .paused .back-leg, .paused .animal { animation-play-state: paused; }
@keyframes breathe { 50% { transform: scale(1.018, 1.025); } }
@keyframes tail-sway { 50% { transform: rotate(-3deg); } }
@keyframes arm-idle { 50% { transform: rotate(4deg); } }
@keyframes blink { 0%, 47%, 51%, 100% { transform: scaleY(1); } 49%, 50% { transform: scaleY(.07); } }
@keyframes step { from { transform: rotate(-6deg); } to { transform: rotate(7deg); } }
@keyframes walk-bob { to { transform: translateY(-5px); } }
@keyframes sniff { 50% { transform: translate(8px, -4px) rotate(-2deg); } }
@keyframes nose { 50% { transform: scale(1.15); } }
@keyframes chew { 50% { transform: rotate(7deg); } }
@keyframes roar { 45% { transform: translate(-7px, -7px) rotate(-4deg); } }
@media (prefers-reduced-motion: reduce) {
  .creature-art *, .animal { animation: none !important; transition: none !important; }
}
</style>
