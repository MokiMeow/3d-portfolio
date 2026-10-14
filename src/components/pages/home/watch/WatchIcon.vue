<script setup lang="ts">
import type { WatchAppId } from './watch';
const props = withDefaults(defineProps<{
    name: WatchAppId;
    size?: number;
}>(), {
    size: 100
});
const uid = useId().replace(/:/g, '');
const palette: Record<WatchAppId, string> = {
    activity: '#080808',
    workout: '#B6F31B',
    heartRate: '#FFFFFF',
    ecg: '#FFFFFF',
    bloodOxygen: '#FFFFFF',
    sleep: '#168FB8',
    vitals: '#14295A',
    mindfulness: '#063C3D',
    noise: '#FFD60A',
    compass: '#111113',
    depth: '#071C34',
    tides: '#064F79',
    siren: '#FF553A',
    maps: '#E9F0E5',
    weather: '#248EF1',
    timer: '#FF9500',
    stopwatch: '#FF9500',
    alarms: '#FF9500',
    worldClock: '#12335F',
    nowPlaying: '#FA475D',
    music: '#EF254D',
    phone: '#20C44A',
    messages: '#20C44A',
    mail: '#148AF5',
    calendar: '#FFFFFF',
    reminders: '#FFFFFF',
    wallet: '#151517',
    findDevices: '#FFFFFF',
    findPeople: '#FFFFFF',
    cameraRemote: '#3A3A3C',
    flashlight: '#28282B',
    calculator: '#222225',
    translate: '#161B29',
    voiceMemos: '#08080A',
    shortcuts: '#192443',
    remote: '#1B70E9',
    walkieTalkie: '#FFD60A',
    settings: '#737378',
    deploy: '#1E1733',
    crownPong: '#B6F31B',
    coffee: '#704B35',
    rubberDuck: '#22A8C2',
    dice: '#6556B0',
};
const glyphs: Record<WatchAppId, string> = {
    activity: `
      <g fill="none" stroke-width="7" stroke-linecap="round" transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r="34" stroke="#FA114F" stroke-dasharray="192 22" />
        <circle cx="50" cy="50" r="25" stroke="#A4FF00" stroke-dasharray="137 20" />
        <circle cx="50" cy="50" r="16" stroke="#00D7FF" stroke-dasharray="87 14" />
      </g>
    `,
    workout: `
      <circle cx="59" cy="24" r="7" fill="#080808" />
      <g fill="none" stroke="#080808" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="m35 40 14-8 12 17 14 3M49 35 41 54 58 63 52 80M43 52 31 64 21 62" />
      </g>
    `,
    heartRate: `
      <path fill="#FF2D55" d="M50 78C45 74 18 57 18 38c0-19 23-24 32-9 9-15 32-10 32 9 0 19-27 36-32 40Z" />
    `,
    ecg: `
      <path
        d="M13 51h17l7-14 9 35 11-52 10 31h20"
        fill="none"
        stroke="#FF375F"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    `,
    bloodOxygen: `
      <path
        d="M23 72C8 55 31 42 54 23c13-11 28-6 22 9S22 53 29 70c5 11 19 10 32 0"
        stroke="#FF453A"
        stroke-width="9"
        fill="none"
        stroke-linecap="round"
      />
      <path
        d="M24 28c8-15 29-4 45 15s13 35 0 34S38 53 30 46"
        stroke="#0A84FF"
        stroke-width="9"
        fill="none"
        stroke-linecap="round"
      />
    `,
    sleep: `
      <g fill="#fff">
        <circle cx="31" cy="43" r="8" />
        <path d="M21 29h6v42h-6zm8 24h50v9H29zm14-17h22c9 0 14 6 14 15H43zM74 53h6v18h-6z" />
      </g>
    `,
    vitals: `
      <g stroke-linecap="round" stroke-width="9">
        <path d="M22 46v12" stroke="#62D9FF" />
        <path d="M36 35v32" stroke="#30A5FF" />
        <path d="M50 29v43" stroke="#56CAFF" />
        <path d="M64 40v22" stroke="#40B8FE" />
        <path d="M78 23v17" stroke="#F46CAB" />
      </g>
    `,
    mindfulness: `
      <g fill="#75E7C2" fill-opacity=".19" stroke="#94EBD1" stroke-width="2">
        <ellipse cx="50" cy="50" rx="15" ry="32" />
        <ellipse cx="50" cy="50" rx="15" ry="32" transform="rotate(45 50 50)" />
        <ellipse cx="50" cy="50" rx="15" ry="32" transform="rotate(90 50 50)" />
        <ellipse cx="50" cy="50" rx="15" ry="32" transform="rotate(135 50 50)" />
      </g>
      <circle cx="50" cy="50" r="9" fill="#B9FFF0" opacity=".8" />
    `,
    noise: `
      <g fill="none" stroke="#101010" stroke-width="5" stroke-linecap="round">
        <path d="M32 66c-2 17 14 20 20 6l4-12c16-19 5-43-13-41-18 2-20 20-15 29m10-4c-4-16 14-19 17-7 3 12-9 12-9 23" />
        <path d="M71 34q11 16 0 32m9-40q17 24 0 48" />
      </g>
    `,
    compass: `
      <g stroke="#B6B6B9" stroke-width="2">
        <path d="M50 12v9" transform="rotate(0 50 50)" />
        <path d="M50 12v5" transform="rotate(15 50 50)" />
        <path d="M50 12v5" transform="rotate(30 50 50)" />
        <path d="M50 12v9" transform="rotate(45 50 50)" />
        <path d="M50 12v5" transform="rotate(60 50 50)" />
        <path d="M50 12v5" transform="rotate(75 50 50)" />
        <path d="M50 12v9" transform="rotate(90 50 50)" />
        <path d="M50 12v5" transform="rotate(105 50 50)" />
        <path d="M50 12v5" transform="rotate(120 50 50)" />
        <path d="M50 12v9" transform="rotate(135 50 50)" />
        <path d="M50 12v5" transform="rotate(150 50 50)" />
        <path d="M50 12v5" transform="rotate(165 50 50)" />
        <path d="M50 12v9" transform="rotate(180 50 50)" />
        <path d="M50 12v5" transform="rotate(195 50 50)" />
        <path d="M50 12v5" transform="rotate(210 50 50)" />
        <path d="M50 12v9" transform="rotate(225 50 50)" />
        <path d="M50 12v5" transform="rotate(240 50 50)" />
        <path d="M50 12v5" transform="rotate(255 50 50)" />
        <path d="M50 12v9" transform="rotate(270 50 50)" />
        <path d="M50 12v5" transform="rotate(285 50 50)" />
        <path d="M50 12v5" transform="rotate(300 50 50)" />
        <path d="M50 12v9" transform="rotate(315 50 50)" />
        <path d="M50 12v5" transform="rotate(330 50 50)" />
        <path d="M50 12v5" transform="rotate(345 50 50)" />
      </g>
      <path d="m50 18-9 32h18Z" fill="#FF3B30" />
      <path d="m50 82-9-32h18Z" fill="#FFFFFF" />
      <circle cx="50" cy="50" r="4" fill="#777" />
    `,
    depth: `
      <g fill="none" stroke="#3DD5FF" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17 29q8-8 16 0t16 0 16 0 16 0M50 42v34m-11-11 11 11 11-11" />
      </g>
      <path d="M22 46v29m56-29v29" stroke="#178AC4" stroke-width="3" />
    `,
    tides: `
      <g fill="none" stroke-linecap="round" stroke-width="5">
        <path d="M15 34q9-10 18 0t18 0 18 0 18 0" stroke="#FFFFFF" />
        <path d="M15 51q9-10 18 0t18 0 18 0 18 0" stroke="#49CFFF" />
        <path d="M15 68q9-10 18 0t18 0 18 0 18 0" stroke="#1A9EE4" />
      </g>
    `,
    siren: `
      <path d="M31 66V49a19 19 0 0 1 38 0v17zm-5 3h48v9H26z" fill="#fff" />
      <g stroke="#fff" stroke-width="5" stroke-linecap="round">
        <path d="M50 15v8M20 29l6 6m48 0 6-6M13 49h8m58 0h8" />
      </g>
    `,
    maps: `
      <path d="M0 12h100v26H0z" fill="#A4D884" />
      <path d="M72 0h28v100H72z" fill="#80C9EB" />
      <path d="m-8 82 95-65" stroke="#FFFFFF" stroke-width="21" />
      <path d="M31 0v100" stroke="#FFF" stroke-width="15" />
      <path d="M31 0v100" stroke="#EACB72" stroke-width="5" />
      <path d="m-8 82 95-65" stroke="#C9C9C9" stroke-width="2" />
      <circle cx="53" cy="51" r="22" fill="#0A84FF" stroke="#fff" stroke-width="3" />
      <path d="m53 35-11 29 11-6 11 6Z" fill="#fff" />
    `,
    weather: `
      <circle cx="64" cy="35" r="17" fill="#FFD541" />
      <path d="M23 67c-17-5-10-27 4-25 4-18 31-21 38-2 21-3 27 26 7 27Z" fill="#fff" />
    `,
    timer: `
      <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round">
        <path d="M38 21a31 31 0 1 0 25 0M50 19v30l-13 13" />
      </g>
      <path d="m31 18 12 1-5 12Z" fill="#fff" />
    `,
    stopwatch: `
      <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">
        <circle cx="50" cy="55" r="27" />
        <path d="M44 16h12M50 16v12m23 5 6-6M50 38v18l12 8" />
      </g>
    `,
    alarms: `
      <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round">
        <circle cx="50" cy="53" r="25" />
        <path d="M50 38v16l12 8M32 75l-5 8m41-8 5 8" />
      </g>
      <path d="M17 32q0-20 22-15L28 36Zm44-15q22-5 22 15L72 36Z" fill="#fff" />
    `,
    worldClock: `
      <g stroke="#fff" stroke-width="3.5" fill="none">
        <circle cx="50" cy="50" r="31" />
        <ellipse cx="50" cy="50" rx="14" ry="31" />
        <path d="M19 50h62M25 33h50M25 67h50" />
      </g>
    `,
    nowPlaying: `
      <g fill="#fff">
        <rect x="22" y="38" width="7" height="26" rx="3" />
        <rect x="34" y="27" width="7" height="47" rx="3" />
        <path d="m51 26 30 24-30 24Z" />
      </g>
    `,
    music: `
      <path
        d="M45 28v40c-2-3-7-4-11-2-12 5-8 19 3 17 6-1 11-5 11-12V41l23-5v24c-2-3-7-4-11-2-12 5-8 19 3 17 6-1 11-5 11-12V21Z"
        fill="#fff"
      />
    `,
    phone: `
      <path
        d="M28 19c-8 3-12 12-8 23 8 21 22 34 42 39 10 3 18-1 21-10 1-4-2-6-6-9l-9-5c-4-2-6-1-9 3l-3 4C44 60 35 51 31 41l5-4c4-3 4-5 2-9l-4-7c-2-3-3-3-6-2Z"
        fill="#fff"
      />
    `,
    messages: `
      <path d="M50 22c-21 0-35 13-35 29 0 10 7 19 17 24l-6 11 21-7c23 1 38-12 38-28S70 22 50 22Z" fill="#fff" />
    `,
    mail: `
      <rect x="18" y="28" width="64" height="46" rx="6" fill="#fff" />
      <path d="m20 31 30 23 30-23m-60 39 23-20m14 0 23 20" fill="none" stroke="#168AF5" stroke-width="3" />
    `,
    calendar: `
      <text x="50" y="34" text-anchor="middle" fill="#FF453A" font-size="17" font-weight="600">
        WED
      </text>
      <text x="50" y="78" text-anchor="middle" fill="#111" font-size="47" font-weight="300">
        14
      </text>
    `,
    reminders: `
      <g fill="none" stroke-width="3">
        <circle cx="26" cy="30" r="5" stroke="#168AF5" />
        <circle cx="26" cy="50" r="5" stroke="#FF9500" />
        <circle cx="26" cy="70" r="5" stroke="#FF453A" />
      </g>
      <path d="M40 30h35M40 50h35M40 70h35" stroke="#AAAAB0" stroke-width="4" stroke-linecap="round" />
    `,
    wallet: `
      <rect x="20" y="20" width="60" height="45" rx="6" fill="#FFD66C" />
      <rect x="20" y="30" width="60" height="40" rx="6" fill="#60CCD8" />
      <rect x="20" y="39" width="60" height="34" rx="6" fill="#86CC79" />
      <rect x="18" y="48" width="64" height="32" rx="7" fill="#454548" />
      <path d="M18 56h64" stroke="#808084" stroke-width="2" />
    `,
    findDevices: `
      <circle cx="50" cy="50" r="33" fill="#DBF6DF" />
      <circle cx="50" cy="50" r="25" fill="#74D78E" />
      <circle cx="50" cy="50" r="16" fill="#34BF62" />
      <path d="M50 50 78 28a34 34 0 0 0-28-12Z" fill="#fff" opacity=".6" />
      <circle cx="50" cy="50" r="9" fill="#138EFF" stroke="#fff" stroke-width="3" />
    `,
    findPeople: `
      <circle cx="50" cy="50" r="34" fill="#FFD2A6" />
      <circle cx="50" cy="38" r="12" fill="#F29346" />
      <path d="M29 73V64c0-23 42-23 42 0v9" fill="#F29346" />
    `,
    cameraRemote: `
      <path d="M20 33h15l5-9h20l5 9h15v40H20Z" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" />
      <circle cx="50" cy="53" r="14" fill="none" stroke="#fff" stroke-width="5" />
      <circle cx="71" cy="41" r="3" fill="#fff" />
    `,
    flashlight: `
      <path d="M36 22h28v13L57 47v32H43V47L36 35Z" fill="#fff" />
      <path d="M37 31h26" stroke="#555" stroke-width="3" />
      <rect x="47" y="52" width="6" height="13" rx="3" fill="#666" />
    `,
    calculator: `
      <rect x="21" y="15" width="58" height="72" rx="7" fill="#5B5B5D" />
      <rect x="27" y="22" width="45" height="13" rx="2" fill="#CFD4CA" />
      <path d="M61 41h11v38H61Z" fill="#FF9500" />
      <g fill="#E6E6E8">
        <rect x="28" y="42" width="11" height="9" rx="2" />
        <rect x="44" y="42" width="11" height="9" rx="2" />
        <rect x="28" y="56" width="11" height="9" rx="2" />
        <rect x="44" y="56" width="11" height="9" rx="2" />
        <rect x="28" y="70" width="27" height="9" rx="2" />
      </g>
      <path d="M64 47h5m-5 14h5m-5 10h5m-5 4h5" stroke="#fff" stroke-width="2" />
    `,
    translate: `
      <path d="M16 21h47v38H34l-10 8v-8h-8Z" fill="#fff" />
      <path d="M45 45h40v34H70l-9 8v-8H45Z" fill="#168AF5" />
      <text x="39" y="49" text-anchor="middle" font-size="26" fill="#182234">
        A
      </text>
      <text x="65" y="70" text-anchor="middle" font-size="22" fill="#fff">
        文
      </text>
    `,
    voiceMemos: `
      <g stroke="#FF453A" stroke-width="5" stroke-linecap="round">
        <path d="M18 44v12m10-23v34m11-41v48m11-60v72m11-52v32m11-39v46m10-33v20" />
      </g>
    `,
    shortcuts: `
      <path d="m50 14 32 19-32 19-32-19Z" fill="#DE64D9" />
      <path d="m50 35 32 19-32 19-32-19Z" fill="#7B67EB" />
      <path d="m50 56 32 19-32 19-32-19Z" fill="#4FCDF3" />
    `,
    remote: `
      <circle cx="50" cy="50" r="32" fill="none" stroke="#fff" stroke-width="4" />
      <path d="m41 30 28 20-28 20Z" fill="#fff" />
    `,
    walkieTalkie: `
      <path d="M38 26V14h6v12h20v55H32V26Z" fill="#111" />
      <rect x="39" y="33" width="18" height="16" rx="2" fill="#FFD60A" />
      <path d="M39 57h18m-18 7h18m-18 7h18" stroke="#FFD60A" stroke-width="3" />
    `,
    settings: `
      <g fill="none" stroke="#ECECF0">
        <circle cx="50" cy="50" r="25" stroke-width="9" />
        <circle cx="50" cy="50" r="12" stroke-width="5" />
      </g>
      <g fill="#ECECF0">
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(0 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(30 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(60 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(90 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(120 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(150 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(180 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(210 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(240 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(270 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(300 50 50)" />
        <rect x="45" y="14" width="10" height="15" rx="2" transform="rotate(330 50 50)" />
      </g>
    `,
    deploy: `
      <circle cx="50" cy="50" r="33" fill="none" stroke="#B18CFF" stroke-width="4" />
      <path
        d="m28 45 22-18 22 18M50 29v34m-12-4 12 12 12-12"
        fill="none"
        stroke="#F5F0FF"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="76" cy="76" r="9" fill="#A4FF00" />
    `,
    crownPong: `
      <rect x="22" y="27" width="7" height="41" rx="3" fill="#111" />
      <rect x="71" y="42" width="7" height="31" rx="3" fill="#111" />
      <circle cx="49" cy="47" r="6" fill="#111" />
      <path d="M50 16v12m0 43v13" stroke="#111" stroke-width="3" stroke-dasharray="3 3" />
    `,
    coffee: `
      <path d="M24 40h43v21c0 23-43 23-43 0Z" fill="#FAE5CA" />
      <path d="M67 44h6c19 0 18 23-5 23" fill="none" stroke="#FAE5CA" stroke-width="6" />
      <path
        d="M21 80h53M36 31c-9-9 9-10 0-19m17 19c-9-9 9-10 0-19"
        fill="none"
        stroke="#FAE5CA"
        stroke-width="3"
        stroke-linecap="round"
      />
    `,
    rubberDuck: `
      <path d="M22 53c-9 2-10 17 2 23 16 8 48 2 53-15l-5-11-14 7-11-8Z" fill="#FFD60A" />
      <circle cx="52" cy="37" r="19" fill="#FFD60A" />
      <path d="m69 37 17 5-17 6Z" fill="#FF861C" />
      <circle cx="59" cy="32" r="3" fill="#171715" />
      <path d="M32 59q6 10 20 3" fill="none" stroke="#ECAF00" stroke-width="3" />
    `,
    dice: `
      <rect x="22" y="22" width="56" height="56" rx="12" fill="#F5EEFF" transform="rotate(-9 50 50)" />
      <g fill="#6556B0">
        <circle cx="34" cy="36" r="5" />
        <circle cx="65" cy="32" r="5" />
        <circle cx="50" cy="50" r="5" />
        <circle cx="35" cy="68" r="5" />
        <circle cx="67" cy="64" r="5" />
      </g>
    `,
};
const markup = computed(() => glyphs[props.name]);
</script>

<template>
  <svg
    class="watch-icon"
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <clipPath :id="uid + '-clip'">
        <circle
          cx="50"
          cy="50"
          r="50"
        />
      </clipPath>
      <linearGradient
        :id="uid + '-shine'"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0"
          stop-color="#fff"
          stop-opacity=".15"
        />
        <stop
          offset="1"
          stop-color="#000"
          stop-opacity=".08"
        />
      </linearGradient>
    </defs>
    <g :clip-path="'url(#' + uid + '-clip)'">
      <circle
        cx="50"
        cy="50"
        r="50"
        :fill="palette[name]"
      />
      <circle
        cx="50"
        cy="50"
        r="50"
        :fill="'url(#' + uid + '-shine)'"
      />
      <g v-html="markup" />
    </g>
  </svg>
</template>

<style scoped>
.watch-icon {
  display: block;
  flex-shrink: 0;
  overflow: visible;
}

.watch-icon :deep(text) {
  font-family: ui-rounded,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,sans-serif;
}

.watch-icon {
  font-family: -apple-system, "SF Compact Rounded", "SF Pro Rounded", ui-rounded, "Inter", "Segoe UI", sans-serif;
}

.watch-icon :deep(*) {
  font-family: inherit;
}
</style>
