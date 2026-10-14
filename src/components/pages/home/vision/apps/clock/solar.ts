import type { ClockCity } from './model';
const RAD = Math.PI / 180;
/** Low precision solar coordinates; sufficient for a daylight illustration, not navigation. */
export function solarPosition(time: number): { dec: number; lon: number } {
  const d = time / 86400000 + 2440587.5 - 2451545;
  const g = (357.529 + .98560028 * d) * RAD;
  const l = (280.459 + .98564736 * d + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - .00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / RAD;
  const gmst = 280.46061837 + 360.98564736629 * d;
  return { dec: Math.asin(Math.sin(e) * Math.sin(l)) / RAD, lon: ((ra - gmst + 540) % 360 + 360) % 360 - 180 };
}
export function sunAltitude(time: number, lat: number, lon: number): number {
  const sun = solarPosition(time), p = lat * RAD, d = sun.dec * RAD;
  return Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos((lon - sun.lon) * RAD)) / RAD;
}
export function cityOffset(city: ClockCity, time: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: city.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(time);
  const get = (name: Intl.DateTimeFormatPartTypes): number => Number(parts.find(p => p.type === name)?.value ?? 0);
  return Math.round((Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(time / 1000) * 1000) / 60000);
}
export function daylight(city: ClockCity, time: number): { rise: string; set: string; fraction: number; hours: string } {
  const sun = solarPosition(time), p = city.lat * RAD, d = sun.dec * RAD;
  const cosine = (Math.sin(-.833 * RAD) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d));
  if (Math.abs(cosine) > 1) return { rise: '—', set: '—', fraction: cosine < -1 ? 1 : 0, hours: cosine < -1 ? 'Polar day' : 'Polar night' };
  const angle = Math.acos(cosine) / RAD, utcHour = new Date(time).getUTCHours() + new Date(time).getUTCMinutes() / 60;
  const noon = utcHour + ((sun.lon - city.lon + 540) % 360 - 180) / 15 + cityOffset(city, time) / 60;
  const text = (hour: number): string => { const minutes = ((Math.round(hour * 60) % 1440) + 1440) % 1440; return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'); };
  const localHour = utcHour + cityOffset(city, time) / 60;
  const progress = ((localHour - (noon - angle / 15) + 24) % 24) / (2 * angle / 15);
  return { rise: text(noon - angle / 15), set: text(noon + angle / 15), fraction: Math.min(1, progress), hours: Math.floor(2 * angle / 15) + 'h ' + Math.round((2 * angle / 15 % 1) * 60) + 'm daylight' };
}
