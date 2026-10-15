/**
 * JARVIS's hosted mind. The headset sends the conversation here; this route forwards it to any
 * OpenAI-compatible chat endpoint (NUXT_JARVIS_URL, NUXT_JARVIS_KEY, NUXT_JARVIS_MODEL) and streams the
 * reply straight back. The key never leaves the server.
 *
 * GET  /api/jarvis  -> { ok, name, voice } so the headset knows whether a hosted mind and voice exist.
 * POST /api/jarvis  -> { messages } in, server-sent events out (the upstream stream, passed through).
 *
 * It is a public endpoint on someone else's account, so it is deliberately narrow: short replies only,
 * a capped conversation, and a few requests a minute per visitor.
 */
type Message = { role: 'system' | 'user' | 'assistant'; content: string };

const WINDOW = 10 * 60_000, PER_WINDOW = 40, BURST = 6, BURST_WINDOW = 15_000;
const visits = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now(), list = (visits.get(ip) ?? []).filter(at => now - at < WINDOW);
  if (list.length >= PER_WINDOW || list.filter(at => now - at < BURST_WINDOW).length >= BURST) { visits.set(ip, list); return false; }
  list.push(now); visits.set(ip, list);
  if (visits.size > 5000) visits.delete(visits.keys().next().value!);
  return true;
}

function clean(input: unknown): Message[] | null {
  if (!Array.isArray(input) || !input.length || input.length > 30) return null;
  const out: Message[] = [];
  for (const item of input) {
    const role = (item as Message)?.role, content = (item as Message)?.content;
    if (!['system', 'user', 'assistant'].includes(role) || typeof content !== 'string') return null;
    if (content.length > (role === 'system' ? 9000 : 1500)) return null;
    out.push({ role, content });
  }
  return out;
}

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event);
  const url = String(config.jarvisUrl || '').replace(/\/+$/, ''), key = String(config.jarvisKey || ''), model = String(config.jarvisModel || '');
  const name = String(config.jarvisName || model);
  if (event.method === 'GET') {
    setHeader(event, 'Cache-Control', 'no-store');
    return { ok: Boolean(url && model), name, voice: Boolean(config.jarvisVoiceUrl), hear: Boolean(config.jarvisHearUrl) };
  }
  assertMethod(event, 'POST');
  if (!url || !model) throw createError({ statusCode: 503, statusMessage: 'Hosted mind not configured' });
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown';
  if (!allowed(ip)) throw createError({ statusCode: 429, statusMessage: 'A little too quickly, sir' });
  const body = await readBody<{ messages?: unknown; plan?: unknown; schema?: unknown; warm?: unknown }>(event);
  const messages = clean(body?.messages);
  if (!messages) throw createError({ statusCode: 400, statusMessage: 'Bad conversation' });

  // A plan is held to its JSON schema by the model server's grammar, so a small model cannot ramble.
  const schema = body?.plan === true && body.schema && typeof body.schema === 'object' && JSON.stringify(body.schema).length < 6000 ? body.schema : null;
  const upstream = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model, messages, stream: true, temperature: schema ? .4 : .7, top_p: .8, max_tokens: body?.warm === true ? 1 : schema ? 230 : 110,
      ...(schema ? { response_format: { type: 'json_schema', json_schema: { name: 'plan', strict: true, schema } } } : {}),
      // Qwen-family hosts honour this; others ignore unknown fields.
      ...(config.jarvisNoThink ? { chat_template_kwargs: { enable_thinking: false } } : {}),
    }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    throw createError({ statusCode: 502, statusMessage: `Hosted mind unavailable (${upstream?.status ?? 'no answer'})` });
  }
  setHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
  setHeader(event, 'Cache-Control', 'no-store');
  return sendStream(event, upstream.body);
});
