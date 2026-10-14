export interface ClockCity { id: string; name: string; region: string; offset: number; zone: string; lat: number; lon: number }
export const CITIES: ClockCity[] = [
  { id: 'bengaluru', name: 'Bengaluru', region: 'India', offset: 330, zone: "Asia/Kolkata", lat: 12.97, lon: 77.59 },
  { id: 'london', name: 'London', region: 'United Kingdom', offset: 0, zone: "Europe/London", lat: 51.51, lon: -0.13 },
  { id: 'tokyo', name: 'Tokyo', region: 'Japan', offset: 540, zone: "Asia/Tokyo", lat: 35.68, lon: 139.69 },
  { id: 'newyork', name: 'New York', region: 'United States', offset: -300, zone: "America/New_York", lat: 40.71, lon: -74.01 },
  { id: 'sydney', name: 'Sydney', region: 'Australia', offset: 600, zone: "Australia/Sydney", lat: -33.87, lon: 151.21 },
  { id: 'reykjavik', name: 'Reykjavík', region: 'Iceland', offset: 0, zone: "Atlantic/Reykjavik", lat: 64.15, lon: -21.94 },
  { id: 'lisbon', name: 'Lisbon', region: 'Portugal', offset: 0, zone: "Europe/Lisbon", lat: 38.72, lon: -9.14 },
  { id: 'cape', name: 'Cape Town', region: 'South Africa', offset: 120, zone: "Africa/Johannesburg", lat: -33.92, lon: 18.42 },
  { id: 'paris', name: 'Paris', region: 'France', offset: 60, zone: "Europe/Paris", lat: 48.86, lon: 2.35 },
  { id: 'dubai', name: 'Dubai', region: 'United Arab Emirates', offset: 240, zone: "Asia/Dubai", lat: 25.2, lon: 55.27 },
  { id: 'singapore', name: 'Singapore', region: 'Singapore', offset: 480, zone: "Asia/Singapore", lat: 1.35, lon: 103.82 },
  { id: 'hongkong', name: 'Hong Kong', region: 'China', offset: 480, zone: "Asia/Hong_Kong", lat: 22.32, lon: 114.17 },
  { id: 'seoul', name: 'Seoul', region: 'South Korea', offset: 540, zone: "Asia/Seoul", lat: 37.57, lon: 126.98 },
  { id: 'losangeles', name: 'Los Angeles', region: 'United States', offset: -480, zone: "America/Los_Angeles", lat: 34.05, lon: -118.24 },
  { id: 'vancouver', name: 'Vancouver', region: 'Canada', offset: -480, zone: "America/Vancouver", lat: 49.28, lon: -123.12 },
  { id: 'chicago', name: 'Chicago', region: 'United States', offset: -360, zone: "America/Chicago", lat: 41.88, lon: -87.63 },
  { id: 'saopaulo', name: 'São Paulo', region: 'Brazil', offset: -180, zone: "America/Sao_Paulo", lat: -23.55, lon: -46.63 },
  { id: 'auckland', name: 'Auckland', region: 'New Zealand', offset: 720, zone: "Pacific/Auckland", lat: -36.85, lon: 174.76 },
  { id: 'kathmandu', name: 'Kathmandu', region: 'Nepal', offset: 345, zone: "Asia/Kathmandu", lat: 27.72, lon: 85.32 },
  { id: 'honolulu', name: 'Honolulu', region: 'United States', offset: -600, zone: "Pacific/Honolulu", lat: 21.31, lon: -157.86 },
];
export interface Alarm { id: string; hour: number; minute: number; label: string; days: number[]; enabled: boolean; lastFired?: number }
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function readAlarms(raw: string | null): Alarm[] {
  try {
    const data: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(data)) return [];
    const ids = new Set<string>();
    return data.filter((item): item is Alarm => {
      if (!item || typeof item !== 'object') return false;
      const a = item as Record<string, unknown>;
      const valid = typeof a.id === 'string' && !ids.has(a.id) && Number.isInteger(a.hour) && Number(a.hour) >= 0 && Number(a.hour) <= 23 && Number.isInteger(a.minute) && Number(a.minute) >= 0 && Number(a.minute) <= 59 && typeof a.label === 'string' && typeof a.enabled === 'boolean' && Array.isArray(a.days) && a.days.every((day: unknown) => Number.isInteger(day) && Number(day) >= 0 && Number(day) < 7) && (a.lastFired === undefined || (typeof a.lastFired === 'number' && Number.isFinite(a.lastFired)));
      if (valid) ids.add(String(a.id));
      return valid;
    }).slice(0, 50).map(alarm => ({ ...alarm, label: alarm.label.slice(0, 60), days: [...new Set(alarm.days)] }));
  } catch { return []; }
}
export function alarmDue(alarm: Alarm, date: Date): boolean {
  return alarm.enabled && alarm.hour === date.getHours() && alarm.minute === date.getMinutes() && (alarm.days.length === 0 || alarm.days.includes(date.getDay())) && alarm.lastFired !== Math.floor(date.getTime() / 60000);
}
export function pad(value: number): string { return String(value).padStart(2, '0'); }
export function stopwatchText(ms: number): string { const centis = Math.floor(Math.max(0, ms) / 10); return pad(Math.floor(centis / 6000)) + ':' + pad(Math.floor(centis / 100) % 60) + '.' + pad(centis % 100); }
export function timerText(ms: number): string { const seconds = Math.ceil(Math.max(0, ms) / 1000); return (seconds >= 3600 ? Math.floor(seconds / 3600) + ':' : '') + pad(Math.floor(seconds / 60) % 60) + ':' + pad(seconds % 60); }
