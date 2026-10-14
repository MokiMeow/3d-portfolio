<script setup lang="ts">
import { computed, getCurrentInstance } from 'vue';
import type { ClockCity } from './model';
import { solarPosition } from './solar';
const shadeId = 'daylight-shade-' + getCurrentInstance()!.uid;
const props = defineProps<{ time: number; cities: ClockCity[] }>();
const continents = [
  [[-168,66],[-151,70],[-130,71],[-116,69],[-98,75],[-80,72],[-61,60],[-54,51],[-65,44],[-80,25],[-88,21],[-90,16],[-84,9],[-78,8],[-83,20],[-106,23],[-117,33],[-124,49],[-145,60]],
  [[-73,60],[-48,59],[-22,72],[-28,83],[-51,83],[-67,77]],
  [[-81,10],[-68,11],[-51,4],[-35,-6],[-41,-22],[-54,-35],[-67,-56],[-75,-46],[-80,-17]],
  [[-10,36],[-9,44],[-2,48],[-7,55],[-3,59],[7,54],[5,60],[20,71],[32,70],[29,59],[43,47],[37,36],[26,40],[16,38],[12,45]],
  [[-17,36],[10,37],[32,31],[43,12],[51,11],[42,-10],[34,-26],[18,-35],[12,-17],[6,5],[-8,6],[-17,15]],
  [[30,71],[62,75],[103,77],[140,71],[180,65],[163,58],[139,49],[130,35],[121,25],[107,10],[99,5],[90,22],[80,8],[68,24],[54,26],[42,12],[35,29],[44,42],[29,59]],
  [[114,-22],[130,-12],[142,-10],[154,-27],[145,-40],[130,-35],[114,-34]],
  [[47,-13],[51,-17],[49,-25],[44,-25]],[[130,32],[137,35],[142,44],[145,44],[140,34]],[[166,-35],[178,-38],[173,-46],[167,-47]],
];
const x = (lon: number): number => (lon + 180) * 2;
const y = (lat: number): number => 90 - lat;
const paths = continents.map(points => points.map((p,i) => (i?'L':'M')+x(p[0]!)+','+y(p[1]!)).join(' ')+'Z');
const minute = computed(() => Math.floor(props.time / 60000));
const shade = computed(() => {
  const sun = solarPosition(minute.value * 60000), rad = Math.PI / 180;
  let night = '', dusk = '';
  for (let lon=-180;lon<180;lon+=5) for(let lat=-90;lat<90;lat+=5) {
    const light = Math.sin((lat+2.5)*rad)*Math.sin(sun.dec*rad)+Math.cos((lat+2.5)*rad)*Math.cos(sun.dec*rad)*Math.cos((lon+2.5-sun.lon)*rad);
    const cell = 'M'+x(lon)+','+y(lat+5)+'h10v5h-10Z';
    if(light<-.08) night+=cell; else if(light<.08) dusk+=cell;
  }
  return { night, dusk, sun };
});
</script>
<template><section class="world-map vk-well" aria-label="World daylight map"><div class="map-caption"><span class="overline">THE WORLD, RIGHT NOW</span><strong>Chasing daylight</strong><small><i/> Day <i class="night-key"/> Night</small></div><svg viewBox="0 0 720 180" role="img" aria-label="Stylized world map with calculated daylight and city locations"><defs><filter :id="shadeId" x="-5%" y="-10%" width="110%" height="120%"><feGaussianBlur stdDeviation="2"/></filter></defs><path v-for="(path,index) in paths" :key="index" :d="path" fill="#a5bfd6" opacity=".3"/><g stroke="#ffffff" opacity=".07" fill="none"><path v-for="lat in [-60,-30,0,30,60]" :key="lat" :d="'M0 '+y(lat)+'H720'"/><path v-for="lon in [-120,-60,0,60,120]" :key="lon" :d="'M'+x(lon)+' 0V180'"/></g><path :filter="'url(#'+shadeId+')'" :d="shade.night" fill="#050d22" opacity=".56"/><path :filter="'url(#'+shadeId+')'" :d="shade.dusk" fill="#050d22" opacity=".22"/><circle :cx="x(shade.sun.lon)" :cy="y(shade.sun.dec)" r="12" fill="#ffca8220"/><circle :cx="x(shade.sun.lon)" :cy="y(shade.sun.dec)" r="3" fill="#ffd194"/><g v-for="city in cities" :key="city.id"><circle :cx="x(city.lon)" :cy="y(city.lat)" r="7" fill="#cce8ff18"/><circle :cx="x(city.lon)" :cy="y(city.lat)" r="2.8" fill="#dcf1ff"/><title>{{ city.name }}</title></g></svg></section></template>
<style scoped>
.world-map { display:flex;align-items:center;gap:20px;padding:10px 18px;height:88px;overflow:hidden; }.map-caption { flex:none;width:175px;display:flex;flex-direction:column;gap:5px; }.overline { font-size:8px;letter-spacing:1.4px;color:var(--vk-tertiary); }.map-caption strong { font-size:15px;font-weight:500; }.map-caption small { display:flex;align-items:center;gap:6px;color:var(--vk-secondary);font-size:10px; }.map-caption i { width:5px;height:5px;border-radius:50%;background:#a9c6db; }.map-caption i.night-key { background:#24334e;margin-left:8px;box-shadow:0 0 0 1px #ffffff30; }svg { width:100%;height:72px;display:block; }@container(max-width:550px){.world-map { height:110px;padding:12px;gap:10px; }.map-caption { width:105px; }.map-caption strong { font-size:13px; }.overline { font-size:7px; }.world-map svg { height:82px; }}
</style>
