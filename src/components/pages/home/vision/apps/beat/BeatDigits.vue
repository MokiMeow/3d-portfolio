<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ value: number }>();
const digits = computed(() => String(props.value).padStart(3, '0').split('').map(Number));
const lit = ['ab cdef'.replace(/ /g,''),'bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
const segments = [ ['a','5,2 25,2 28,5 24,8 6,8 2,5'], ['b','26,8 29,5 32,8 29,25 25,28 23,25'], ['c','25,31 29,28 31,31 28,49 24,52 22,49'], ['d','5,50 22,50 25,53 21,56 3,56 0,53'], ['e','3,31 7,28 10,31 7,48 3,51 1,48'], ['f','6,9 10,6 12,9 9,25 5,28 3,25'], ['g','8,26 24,26 27,29 23,32 7,32 4,29'] ];
</script>
<template><svg class="digits" viewBox="0 0 112 58" role="img" :aria-label="value + ' beats per minute'"><g v-for="(digit,index) in digits" :key="index" :transform="'translate(' + (index * 38 + 2) + ' 0)'"><polygon v-for="segment in segments" :key="segment[0]" :points="segment[1]" :opacity="lit[digit]?.includes(segment[0]!) ? 1 : .07" /></g></svg></template>
<style scoped>.digits{width:112px;height:58px;fill:currentColor;filter:drop-shadow(0 0 5px #e8b87935)}</style>
