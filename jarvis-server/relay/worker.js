// JARVIS relay on Cloudflare.
//  - /v1/chat/completions: JARVIS's mind, on Workers AI (OpenAI-style streaming out).
//  - /v1/transcribe:       hearing, Whisper large-v3-turbo on Workers AI.
//  - everything else:      forwarded to the laptop's tunnel (the Sterling voice), whose URL changes on restart.
// Every route needs the shared key, except /health and the laptop's own /__tunnel update.
const MIND = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const EAR = '@cf/openai/whisper-large-v3-turbo';
const enc = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/__tunnel') {
      if (request.headers.get('authorization') !== `Bearer ${env.ADMIN_KEY}`) return new Response('no', { status: 401 });
      const { origin } = await request.json();
      if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)) return new Response('bad origin', { status: 400 });
      await env.STATE.put('origin', origin);
      return new Response('ok');
    }
    if (url.pathname === '/health') return Response.json({ ok: true, mind: MIND, ear: EAR, laptop: Boolean(await env.STATE.get('origin')) });
    if (request.headers.get('authorization') !== `Bearer ${env.SERVER_KEY}`) return new Response('unauthorised', { status: 401 });

    if (request.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const body = await request.json();
      const model = typeof body.model === 'string' && body.model.startsWith('@cf/') ? body.model : MIND;
      const input = { messages: body.messages, stream: true, max_tokens: Math.min(400, body.max_tokens ?? 300), temperature: body.temperature ?? .4 };
      if (body.response_format) input.response_format = body.response_format;
      let stream;
      try { stream = await env.AI.run(model, input); } catch (error) {
        // Out of free allowance, or the model is busy: the laptop's own model answers instead.
        const origin = await env.STATE.get('origin');
        if (!origin) return new Response(String(error), { status: 502 });
        return fetch(new URL('/v1/chat/completions', origin), { method: 'POST', headers: request.headers, body: JSON.stringify({ ...body, model: 'qwen3.5-2b' }) });
      }
      // Workers AI streams {"response": "..."}; the site expects OpenAI's {"choices":[{"delta":{"content":"..."}}]}.
      const { readable, writable } = new TransformStream();
      (async () => {
        const writer = writable.getWriter(), reader = stream.getReader(), dec = new TextDecoder();
        let buffer = '';
        const send = text => writer.write(enc.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`));
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
            for (const line of lines) {
              const data = line.trim();
              if (!data.startsWith('data:')) continue;
              const payload = data.slice(5).trim();
              if (payload === '[DONE]') continue;
              try {
                const json = JSON.parse(payload);
                const text = json.response ?? json.choices?.[0]?.delta?.content ?? '';
                if (text) await send(text);
              } catch { /* partial line */ }
            }
          }
          await writer.write(enc.encode('data: [DONE]\n\n'));
        } finally { await writer.close().catch(() => {}); }
      })();
      return new Response(readable, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } });
    }

    if (request.method === 'POST' && url.pathname === '/v1/transcribe') {
      const { audio, prompt } = await request.json();
      if (typeof audio !== 'string' || audio.length > 4_000_000) return new Response('bad audio', { status: 400 });
      // The laptop's GPU Whisper answers in about half a second; Cloudflare's Whisper stands in when it is off.
      const origin = await env.STATE.get('origin');
      if (origin) {
        const quick = await fetch(new URL('/v1/transcribe', origin), { method: 'POST', headers: { authorization: request.headers.get('authorization'), 'content-type': 'application/json' }, body: JSON.stringify({ audio, prompt }), signal: AbortSignal.timeout(6000) }).catch(() => null);
        if (quick?.ok) return quick;
      }
      try {
        const result = await env.AI.run(EAR, { audio, language: 'en', vad_filter: true, initial_prompt: typeof prompt === 'string' ? prompt.slice(0, 600) : undefined });
        return Response.json({ text: (result.text ?? '').trim() });
      } catch (error) { return new Response(String(error), { status: 502 }); }
    }

    const origin = await env.STATE.get('origin');
    if (!origin) return new Response('JARVIS voice is offline', { status: 503 });
    try {
      return await fetch(new URL(url.pathname + url.search, origin), { method: request.method, headers: request.headers, body: request.body });
    } catch { return new Response('JARVIS voice is offline', { status: 503 }); }
  },
};
