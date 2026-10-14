<script setup lang="ts">
import { useWatch } from '../watch';
withDefaults(defineProps<{
    explorer?: boolean;
    compass?: boolean;
    radius?: number;
}>(), {
    explorer: false, compass: false, radius: 151
});
const watch = useWatch();
const hands = computed(() => {
    const d = watch.now.value;
    const s = (!watch.dimmed.value && !watch.reducedMotion.value) ? d.getSeconds() : 0;
    return {
        hour: (d.getHours() % 12) * 30 + d.getMinutes() / 2, minute: d.getMinutes() * 6 + s / 10, second: s * 6
    };
});
const showSeconds = computed(() => watch.settings.seconds && !watch.dimmed.value && !watch.reducedMotion.value);
const marks = computed(() => Array.from({
    length: 60
}, (_, i) => ({
    i, angle: i * 6, major: i % 5 === 0
})));
</script>

<template>
  <svg
    class="dial"
    viewBox="0 0 422 514"
    aria-hidden="true"
  >
    <circle
      cx="211"
      cy="278"
      :r="radius"
      :fill="explorer ? 'var(--ink)' : '#000'"
    />
    <circle
      cx="211"
      cy="278"
      :r="radius - (explorer ? 46 : 0)"
      fill="#080809"
    />
    <g
      v-for="m in marks"
      :key="m.i"
      :transform="'rotate('+m.angle+' 211 278)'"
    >
      <line
        x1="211"
        :y1="278-radius+7"
        x2="211"
        :y2="278-radius+(m.major?23:14)"
        :stroke="explorer?'#090909':(m.major?'var(--ink)':'#626267')"
        :stroke-width="m.major?4:2"
      />
    </g>
    <template v-if="!compass">
      <text
        v-for="n in 12"
        :key="n"
        :x="211+Math.sin(n*Math.PI/6)*(radius-(explorer?31:43))"
        :y="287-Math.cos(n*Math.PI/6)*(radius-(explorer?31:43))"
        text-anchor="middle"
        :fill="explorer?'#0a0a0a':'var(--ink)'"
        :font-size="explorer ? 21 : 28"
        font-weight="600"
      >
        {{ n }}
      </text>
    </template>
    <g v-else :transform="'rotate('+(-watch.navigation.heading)+' 211 278)'">
      <text
        v-for="(c,i) in ['N','E','S','W']"
        :key="c"
        :x="211+Math.sin(i*Math.PI/2)*(radius-(explorer?31:44))"
        :y="286-Math.cos(i*Math.PI/2)*(radius-44)"
        :fill="i===0?'var(--accent)':(explorer?'#080809':'var(--ink)')"
        text-anchor="middle"
        font-size="23"
        font-weight="700"
      >
        {{c}}
      </text>
      <path :d="'M211 '+(278-radius+25)+'l-7 13h14Z'" fill="var(--accent)" />
    </g>
    <slot />
    <g :transform="'rotate('+hands.hour+' 211 278)'">
      <line
        x1="211"
        y1="293"
        x2="211"
        y2="210"
        stroke="#000"
        stroke-width="15"
        stroke-linecap="round"
      />
      <line
        x1="211"
        y1="289"
        x2="211"
        y2="212"
        stroke="var(--ink)"
        stroke-width="9"
        stroke-linecap="round"
      />
    </g>
    <g :transform="'rotate('+hands.minute+' 211 278)'">
      <line
        x1="211"
        y1="298"
        x2="211"
        y2="180"
        stroke="#000"
        stroke-width="12"
        stroke-linecap="round"
      />
      <line
        x1="211"
        y1="294"
        x2="211"
        y2="181"
        stroke="var(--ink)"
        stroke-width="6"
        stroke-linecap="round"
      />
    </g>
    <line
      v-if="showSeconds"
      x1="211"
      y1="301"
      x2="211"
      y2="150"
      stroke="var(--accent)"
      stroke-width="2.5"
      :transform="'rotate('+hands.second+' 211 278)'"
    />
    <circle
      cx="211"
      cy="278"
      r="8"
      fill="var(--ink)"
    />
    <circle
      cx="211"
      cy="278"
      r="4"
      fill="var(--accent)"
    />
  </svg>
</template>

<style scoped>
.dial {
  position: absolute;
  inset: 0;
  width: 422px;
  height: 514px;
  pointer-events: none;
}

.dial text {
  font-family: inherit;
}

.dial {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.dial :deep(*) {
  font-family: inherit;
}
</style>
