export type Condition = 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';
export interface Place { id: string; name: string; region: string; offset: number; seed: number; base: number; condition: Condition }
export const PLACES: Place[] = [
  { id: 'bengaluru', name: 'Bengaluru', region: 'India', offset: 330, seed: 17, base: 25, condition: 'rain' },
  { id: 'tokyo', name: 'Tokyo', region: 'Japan', offset: 540, seed: 29, base: 22, condition: 'storm' },
  { id: 'reykjavik', name: 'Reykjavík', region: 'Iceland', offset: 0, seed: 41, base: 2, condition: 'snow' },
  { id: 'cape', name: 'Cape Town', region: 'South Africa', offset: 120, seed: 53, base: 19, condition: 'cloudy' },
  { id: 'newyork', name: 'New York', region: 'United States', offset: -300, seed: 67, base: 15, condition: 'fog' },
  { id: 'lisbon', name: 'Lisbon', region: 'Portugal', offset: 0, seed: 79, base: 24, condition: 'clear' },
];
export const CONDITIONS: Record<Condition, string> = { clear: 'Clear skies', cloudy: 'Partly cloudy', rain: 'Gentle rain', snow: 'Light snow', storm: 'Thunderstorms', fog: 'Misty' };
export const localDate = (now: Date, offset: number): Date => new Date(now.getTime() + offset * 60000);
export function noise(seed: number, value: number): number { const n = Math.sin(seed * 127.1 + value * 311.7) * 43758.5453; return n - Math.floor(n); }
export interface ForecastDay { key: number; label: string; low: number; high: number; condition: Condition; precipitation: number }
export interface ForecastHour { key: number; label: string; hour: number; temp: number; condition: Condition; precipitation: number }
export function forecast(city: Place, now: Date): { days: ForecastDay[]; hours: ForecastHour[]; current: number; low: number; high: number; hour: number; humidity: number; wind: number; bearing: number; uv: number; pressure: number; visibility: number; aqi: number; feels: number; dew: number; sunrise: number; sunset: number } {
  const local = localDate(now, city.offset);
  const dayNumber = Math.floor(local.getTime() / 86400000);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  function day(index: number): ForecastDay {
    const n = dayNumber + index;
    const low = Math.round(city.base - 5 + noise(city.seed, n) * 4);
    const high = low + 6 + Math.round(noise(city.seed + 1, n) * 4);
    const condition = index === 0 || noise(city.seed + 3, n) > .45 ? city.condition : 'clear';
    return { key: n, label: index === 0 ? 'Today' : new Date(n * 86400000).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' }), low, high, condition, precipitation: ['rain', 'snow', 'storm'].includes(condition) ? 40 + Math.round(noise(city.seed, n + 12) * 55) : Math.round(noise(city.seed, n + 8) * 22) };
  }
  const days = Array.from({ length: 10 }, (_, index) => day(index));
  const firstHour = Math.floor(local.getTime() / 3600000);
  const hours = Array.from({ length: 24 }, (_, index): ForecastHour => {
    const key = firstHour + index;
    const h = new Date(key * 3600000).getUTCHours();
    const d = day(Math.floor(key / 24) - dayNumber);
    const temp = Math.round(d.low + (d.high - d.low) * (.5 + .5 * Math.cos((h - 14) / 24 * Math.PI * 2)));
    return { key, label: index === 0 ? 'Now' : String(h).padStart(2, '0'), hour: h, temp, condition: d.condition, precipitation: d.precipitation };
  });
  const current = hours[0]!.temp;
  const wet = ['rain', 'snow', 'storm', 'fog'].includes(city.condition);
  const humidity = (wet ? 73 : 42) + Math.round(noise(city.seed, dayNumber + 7) * 19);
  const wind = 6 + Math.round(noise(city.seed, dayNumber + 10) * 24);
  const uv = Math.round(Math.max(0, Math.sin((hour - 6) / 12 * Math.PI)) * (wet ? 4 : 9));
  return { days, hours, current, low: days[0]!.low, high: days[0]!.high, hour, humidity, wind, bearing: Math.round(noise(city.seed, dayNumber + 4) * 360), uv, pressure: 1000 + Math.round(noise(city.seed, dayNumber + 6) * 24), visibility: city.condition === 'fog' ? 2 : wet ? 6 : 18, aqi: 18 + Math.round(noise(city.seed, dayNumber + 5) * 70), feels: current + (humidity > 75 && current > 22 ? 2 : wind > 20 ? -2 : 0), dew: Math.round(current - (100 - humidity) / 5), sunrise: 6.25, sunset: 18.1 };
}
