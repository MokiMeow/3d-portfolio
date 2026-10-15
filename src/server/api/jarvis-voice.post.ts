/**
 * JARVIS's hosted voice: one sentence in, a WAV out, from the JARVIS server's Kokoro
 * (NUXT_JARVIS_VOICE_URL, keyed by NUXT_JARVIS_VOICE_KEY or NUXT_JARVIS_KEY). Visitors download no voice model.
 */
const WINDOW = 10 * 60_000, PER_WINDOW = 240, BURST = 30, BURST_WINDOW = 15_000;
const visits = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now(), list = (visits.get(ip) ?? []).filter(at => now - at < WINDOW);
  if (list.length >= PER_WINDOW || list.filter(at => now - at < BURST_WINDOW).length >= BURST) { visits.set(ip, list); return false; }
  list.push(now); visits.set(ip, list);
  if (visits.size > 5000) visits.delete(visits.keys().next().value!);
  return true;
}

const VOICES = new Set(['sterling', 'whitcombe', 'ravenhill', 'ashford', 'kensington']);

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event);
  const url = String(config.jarvisVoiceUrl || ''), key = String(config.jarvisVoiceKey || config.jarvisKey || '');
  if (!url) throw createError({ statusCode: 503, statusMessage: 'Hosted voice not configured' });
  if (!allowed(getRequestIP(event, { xForwardedFor: true }) ?? 'unknown')) throw createError({ statusCode: 429, statusMessage: 'Too many sentences' });
  const body = await readBody<{ text?: unknown; voice?: unknown; speed?: unknown }>(event);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 600) throw createError({ statusCode: 400, statusMessage: 'Text must be 1 to 600 characters' });
  const voice = typeof body?.voice === 'string' && VOICES.has(body.voice) ? body.voice : 'sterling';
  const speed = typeof body?.speed === 'number' ? Math.min(1.3, Math.max(.7, body.speed)) : undefined;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ input: text, voice, speed }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!upstream?.ok) throw createError({ statusCode: 502, statusMessage: `Hosted voice unavailable (${upstream?.status ?? 'no answer'})` });
  setHeader(event, 'Content-Type', 'audio/wav');
  setHeader(event, 'Cache-Control', 'no-store');
  return Buffer.from(await upstream.arrayBuffer());
});
