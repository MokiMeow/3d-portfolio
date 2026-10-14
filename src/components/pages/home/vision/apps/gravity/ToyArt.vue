<script setup lang="ts">
import { useId } from 'vue';
import type { ObjectKind } from './catalog';
const props = defineProps<{ kind: ObjectKind; color?: string }>();
const uid = useId().replace(/:/g, '');
</script>
<template>
  <svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient :id="uid" x1="0" y1="0" x2="1" y2="1"><stop :stop-color="props.color || '#9eaeff'"/><stop offset="1" :stop-color="props.color || '#9eaeff'" stop-opacity=".6"/></linearGradient></defs>
    <ellipse cx="32" cy="54" rx="21" ry="4" fill="#15243a" opacity=".15"/>
    <g :fill="'url(#'+uid+')'" stroke="rgba(255,255,255,.85)" stroke-width="1.8" stroke-linejoin="round">
      <g v-if="kind === 'cube' || kind === 'block'"><path d="m32 9 21 12-21 12-21-12Z" fill-opacity=".95"/><path d="m11 21 21 12v23L11 44Z" fill-opacity=".8"/><path d="m32 33 21-12v23L32 56Z" fill-opacity=".55"/><path v-if="kind === 'block'" d="m20 42 5-11 5 17m-8-8 6 3" fill="none" stroke-width="2.8"/></g>
      <g v-else-if="kind === 'ball' || kind === 'bowling'"><circle cx="32" cy="32" r="22"/><path d="M17 16c24 7 29 19 29 34M11 30c13-1 27 3 42 13" fill="none" stroke-opacity=".45"/><g v-if="kind === 'bowling'" fill="#464063" stroke="none"><circle cx="36" cy="19" r="3"/><circle cx="43" cy="23" r="3"/><circle cx="35" cy="29" r="3.3"/></g><ellipse cx="24" cy="20" rx="6" ry="4" fill="white" opacity=".3" stroke="none"/></g>
      <g v-else-if="kind === 'cylinder'"><path d="M14 18v28c0 10 36 10 36 0V18"/><ellipse cx="32" cy="18" rx="18" ry="8" fill-opacity=".7"/><path d="M18 45c5 5 23 5 28 0" fill="none" opacity=".5"/></g>
      <g v-else-if="kind === 'domino'"><path d="m19 8 25-3 4 47-25 6Z"/><path d="m44 5 6 5 4 43-6-1M22 31l24-3" fill="none"/><g fill="#474d66" stroke="none"><circle cx="27" cy="17" r="2.2"/><circle cx="37" cy="23" r="2.2"/><circle cx="31" cy="41" r="2.2"/><circle cx="38" cy="49" r="2.2"/></g></g>
      <g v-else-if="kind === 'plank'"><path d="m6 30 43-13 10 10-43 15Z"/><path d="m6 30 10 12v9L6 39Zm10 12 43-15v9L16 51Z" fill-opacity=".7"/><path d="m15 31 30-9m-22 11 28-9" fill="none" stroke-opacity=".4"/></g>
      <g v-else-if="kind === 'duck'"><path d="M9 38c-4-9 7-7 9-5 2-7 8-10 16-8-6-17 16-22 19-9 2 8-5 13-11 13 17 14 6 24-11 23-13 1-22-5-22-14Z"/><path d="m51 19 10 4-12 5" fill="#f7a14b" stroke="#ffc887"/><path d="M23 36c12-7 16 9 6 10" fill="none"/><circle cx="46" cy="16" r="2" fill="#45424e" stroke="none"/></g>
      <g v-else-if="kind === 'cup'"><path d="M13 20h31l-3 29c-1 7-24 7-25 0Z"/><ellipse cx="28.5" cy="20" rx="15.5" ry="6" fill="#86583e"/><path d="M44 24c20-7 17 22-3 15" fill="none" stroke-width="5"/><path d="M22 5c-5 5 4 4 0 9m11-10c-5 5 4 4 0 9" fill="none" stroke-opacity=".5"/></g>
      <g v-else-if="kind === 'pin'"><path d="M26 5c-8 5-2 13 0 17-3 9-10 12-9 24 0 13 30 13 30 0 1-12-6-15-9-24 2-4 8-12 0-17-4-3-8-3-12 0Z"/><path d="M26 22h12m-13 5h14" stroke="#ec7886" stroke-width="3"/></g>
    </g>
  </svg>
</template>
