<script setup lang="ts">
defineProps<{ front: boolean }>();
const uid = useId().replace(/:/g, '');
</script>

<template>
  <svg
    class="camera-scene"
    viewBox="0 0 370 260"
    preserveAspectRatio="xMidYMid slice"
    role="img"
    :aria-label="front ? 'Drawn selfie preview' : 'Drawn studio room preview'"
  >
    <defs>
      <linearGradient
        :id="uid + '-wall'"
        x2="0"
        y2="1"
      >
        <stop stop-color="#bfb7aa" />
        <stop offset="1" stop-color="#797c72" />
      </linearGradient>
      <linearGradient
        :id="uid + '-window'"
        x2="0"
        y2="1"
      >
        <stop stop-color="#6b9eb0" />
        <stop offset="1" stop-color="#d4d9c4" />
      </linearGradient>
    </defs>
    <rect
      width="370"
      height="260"
      :fill="'url(#' + uid + '-wall)'"
    />
    <path d="M0 211H370V260H0" fill="#66534a" />
    <path
      d="M0 210H370M0 243H370M64 212L30 260M148 212L140 260M270 212L310 260"
      stroke="#453e39"
      stroke-width="2"
    />
    <rect
      x="22"
      y="30"
      width="104"
      height="112"
      rx="3"
      fill="#e5dccb"
    />
    <rect
      x="30"
      y="38"
      width="88"
      height="96"
      :fill="'url(#' + uid + '-window)'"
    />
    <path
      d="M74 38V134M30 86H118"
      stroke="#e5dccb"
      stroke-width="6"
    />
    <path d="M29 127Q65 96 85 116T118 110V134H30" fill="#6d8270" />
    <rect
      x="197"
      y="41"
      width="82"
      height="61"
      fill="#343a35"
      stroke="#dad1bb"
      stroke-width="5"
    />
    <path
      d="M208 87L225 62L242 82L257 56L269 87"
      fill="none"
      stroke="#e1a665"
      stroke-width="4"
    />
    <template v-if="!front">
      <path d="M134 179H335V192H134Z" fill="#c59d70" />
      <path
        d="M151 190V239M316 190V239"
        stroke="#40392f"
        stroke-width="9"
      />
      <rect
        x="182"
        y="124"
        width="85"
        height="54"
        rx="5"
        fill="#343b3e"
      />
      <rect
        x="189"
        y="131"
        width="71"
        height="40"
        fill="#245260"
      />
      <path
        d="M201 143H236M201 153H246M201 161H221"
        stroke="#9fd7d1"
        stroke-width="3"
      />
      <path
        d="M169 178H278"
        stroke="#989c96"
        stroke-width="4"
      />
      <rect
        x="292"
        y="154"
        width="20"
        height="24"
        rx="4"
        fill="#e7ded0"
      />
      <path
        d="M312 159Q327 158 323 170H313"
        fill="none"
        stroke="#e7ded0"
        stroke-width="4"
      />
      <path d="M41 212H71L66 180H47Z" fill="#b68160" />
      <path
        d="M55 183V131M55 159Q20 130 26 112Q60 118 55 159M55 168Q88 134 89 121Q53 133 55 168"
        fill="#435b3e"
        stroke="#3d5236"
        stroke-width="3"
      />
    </template>
    <template v-else>
      <path d="M98 260Q110 180 185 180T272 260" fill="#294959" />
      <rect
        x="167"
        y="155"
        width="37"
        height="46"
        rx="18"
        fill="#c69770"
      />
      <ellipse
        cx="185"
        cy="115"
        rx="58"
        ry="69"
        fill="#d4ac85"
      />
      <path d="M127 116Q118 41 184 44Q248 40 244 120L222 78Q184 104 143 75Z" fill="#3b302c" />
      <circle
        cx="164"
        cy="120"
        r="5"
        fill="#342f2d"
      />
      <circle
        cx="207"
        cy="120"
        r="5"
        fill="#342f2d"
      />
      <path
        d="M166 145Q185 164 205 145"
        fill="none"
        stroke="#825348"
        stroke-width="5"
        stroke-linecap="round"
      />
    </template>
    <path
      d="M25 55V25H55M315 25H345V55M345 205V235H315M55 235H25V205"
      fill="none"
      stroke="#ffffffaa"
      stroke-width="2"
    />
    <rect
      x="147"
      y="89"
      width="77"
      height="80"
      rx="5"
      fill="none"
      stroke="#ffdb4b"
      stroke-width="2"
    />
  </svg>
</template>

<style scoped>
.camera-scene {
  display: block;
  width: 100%;
  font-family: -apple-system, "SF Pro Rounded", system-ui, sans-serif;
}

.camera-scene :deep(*) {
  font-family: inherit;
}
</style>
