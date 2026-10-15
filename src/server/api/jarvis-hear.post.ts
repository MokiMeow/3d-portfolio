/**
 * JARVIS's hearing: a few seconds of speech (base64 16 kHz WAV) in, the words out, from Whisper behind the
 * JARVIS relay (NUXT_JARVIS_HEAR_URL, keyed like the mind). Far more accurate than the browser's own
 * recogniser, which the headset now only uses to notice the word "JARVIS".
 */
const WINDOW = 10 * 60_000, PER_WINDOW = 120, BURST = 10, BURST_WINDOW = 15_000;
const visits = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now(), list = (visits.get(ip) ?? []).filter(at => now - at < WINDOW);
  if (list.length >= PER_WINDOW || list.filter(at => now - at < BURST_WINDOW).length >= BURST) { visits.set(ip, list); return false; }
  list.push(now); visits.set(ip, list);
  if (visits.size > 5000) visits.delete(visits.keys().next().value!);
  return true;
}

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event);
  const url = String(config.jarvisHearUrl || ''), key = String(config.jarvisKey || '');
  if (!url) throw createError({ statusCode: 503, statusMessage: 'Hearing not configured' });
  if (!allowed(getRequestIP(event, { xForwardedFor: true }) ?? 'unknown')) throw createError({ statusCode: 429, statusMessage: 'Too many' });
  const body = await readBody<{ audio?: unknown; prompt?: unknown }>(event);
  // About 30 seconds of 16 kHz mono 16-bit audio, as base64.
  if (typeof body?.audio !== 'string' || !body.audio || body.audio.length > 1_400_000) throw createError({ statusCode: 400, statusMessage: 'Bad audio' });
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ audio: body.audio, prompt: typeof body.prompt === 'string' ? body.prompt.slice(0, 600) : undefined }),
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!upstream?.ok) throw createError({ statusCode: 502, statusMessage: 'Hearing unavailable' });
  const { text } = await upstream.json() as { text?: string };
  setHeader(event, 'Cache-Control', 'no-store');
  return { text: String(text ?? '').trim() };
});
