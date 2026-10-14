<script setup lang="ts">
import { computed, ref } from 'vue';
import { vHover } from '../../kit/hover';
import { PLACES, CONDITIONS, forecast, localDate } from './model';
import WeatherIcon from './WeatherIcon.vue';
const props = defineProps<{ selected: string; now: Date; fahrenheit: boolean }>();
defineEmits<{ select: [id: string] }>();
const query = ref('');
const places = computed(() => PLACES.filter(place => (place.name + ' ' + place.region).toLowerCase().includes(query.value.trim().toLowerCase())).map(place => ({ ...place, forecast: forecast(place, props.now) })));
function temp(value: number): string { return Math.round(props.fahrenheit ? value * 9 / 5 + 32 : value) + '°'; }
function time(offset: number): string { return localDate(props.now, offset).toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }); }
</script>
<template><div class="city-list"><input v-model="query" v-hover class="vk-field" type="search" placeholder="Search six places" aria-label="Search demo places" /><div class="places vk-scroll"><button v-for="place in places" :key="place.id" v-hover class="place vk-row" :class="{ selected: selected === place.id }" :aria-pressed="selected === place.id" @click="$emit('select', place.id)"><span class="place-copy"><strong>{{ place.name }}</strong><small>{{ time(place.offset) }} · {{ CONDITIONS[place.condition] }}</small><small>H:{{ temp(place.forecast.high) }} L:{{ temp(place.forecast.low) }}</small></span><span class="place-weather"><WeatherIcon :condition="place.condition" :night="place.forecast.hour < 6 || place.forecast.hour >= 19" /><b>{{ temp(place.forecast.current) }}</b></span></button><p v-if="!places.length" class="vk-footnote vk-secondary">No demo city matches. Try another name.</p></div><p class="vk-footnote vk-secondary">Demo forecast · Fixed UTC offsets<br />A little weather, imaginatively measured.</p></div></template>
<style scoped>
.city-list { display: flex; flex-direction: column; min-height: 0; height: 100%; gap: 16px; } input { flex: none; font: inherit; } .places { flex: 1; min-height: 0; } .place { gap: 10px; border: 0; background: none; font: inherit; cursor: pointer; margin-bottom: 7px; padding: 15px 12px; } .place-copy { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 0; } strong { font-size: 17px; } small { font-size: 11px; line-height: 1.4; color: var(--vk-secondary); } .place-weather { display: flex; flex-direction: column; align-items: center; gap: 4px; } .place-weather svg { width: 30px; height: 30px; } b { font-size: 28px; font-weight: 300; } p { margin: 0; line-height: 1.5; } :focus-visible { outline: 2px solid white; outline-offset: -2px; }
</style>
