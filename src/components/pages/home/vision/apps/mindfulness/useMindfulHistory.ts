import { computed, onMounted, ref } from 'vue';

type DayRecord = { date: string; seconds: number; sessions: number };
const STORAGE = 'vision-mindfulness-v1';

export function dayKey(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function validRecord(value: unknown): value is DayRecord {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return false;
  const date = new Date(row.date + 'T12:00:00');
  return Number.isFinite(date.getTime()) && dayKey(date) === row.date
    && row.date <= dayKey() && row.date >= '2020-01-01'
    && typeof row.seconds === 'number' && Number.isInteger(row.seconds) && row.seconds >= 1 && row.seconds <= 86400
    && typeof row.sessions === 'number' && Number.isInteger(row.sessions) && row.sessions >= 1 && row.sessions <= 86400;
}

export function useMindfulHistory() {
  const records = ref<DayRecord[]>([]);
  const storageNotice = ref('');
  const today = ref(dayKey());
  onMounted(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (!raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!Array.isArray(saved)) return;
      const unique = new Map<string, DayRecord>();
      for (const row of saved.slice(-365)) if (validRecord(row)) unique.set(row.date, { ...row });
      records.value = Array.from(unique.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch { storageNotice.value = 'History stays here for this visit. Browser storage is unavailable.'; }
  });

  function record(seconds: number): void {
    const amount = Math.min(600, Math.floor(seconds));
    if (!Number.isFinite(amount) || amount < 1) return;
    today.value = dayKey();
    const existing = records.value.find(row => row.date === today.value);
    if (existing) {
      existing.seconds = Math.min(86400, existing.seconds + amount);
      existing.sessions = Math.min(86400, existing.sessions + 1);
    } else records.value.push({ date: today.value, seconds: amount, sessions: 1 });
    records.value = records.value.sort((a, b) => a.date.localeCompare(b.date)).slice(-365);
    try { localStorage.setItem(STORAGE, JSON.stringify(records.value)); }
    catch { storageNotice.value = 'History stays here for this visit. Browser storage is unavailable.'; }
  }

  const week = computed(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.value + 'T12:00:00');
    date.setDate(date.getDate() - 6 + index);
    const key = dayKey(date);
    const seconds = records.value.find(row => row.date === key)?.seconds ?? 0;
    return {
      date: key, seconds, label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      full: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  }));
  const weekSeconds = computed(() => week.value.reduce((sum, day) => sum + day.seconds, 0));
  const totalSeconds = computed(() => records.value.reduce((sum, day) => sum + day.seconds, 0));
  const sessionCount = computed(() => records.value.reduce((sum, day) => sum + day.sessions, 0));
  const streak = computed(() => {
    const date = new Date(today.value + 'T12:00:00');
    const qualifies = (key: string) => (records.value.find(row => row.date === key)?.seconds ?? 0) >= 60;
    if (!qualifies(dayKey(date))) date.setDate(date.getDate() - 1);
    let count = 0;
    while (count < 365 && qualifies(dayKey(date))) {
      count += 1;
      date.setDate(date.getDate() - 1);
    }
    return count;
  });
  return { records, week, weekSeconds, totalSeconds, sessionCount, streak, storageNotice, record };
}

export function mindfulTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return minutes ? minutes + ' min' + (rest ? ' ' + rest + ' sec' : '') : rest + ' sec';
}
