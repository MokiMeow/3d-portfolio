/**
 * JARVIS's own server: his mind (a small open model behind llama.cpp) and his voice (Kokoro, with the
 * Sterling blend and the other original voices), so visitors download nothing.
 *
 *   GET  /health                 -> { ok, voice, voices }
 *   POST /v1/chat/completions    -> passed through to llama.cpp (OpenAI-compatible, streaming)
 *   POST /v1/audio/speech        -> { input, voice?, speed? } in, 24 kHz mono WAV out
 *   POST /v1/transcribe          -> { audio: base64 WAV, prompt? } in, { text } out (whisper.cpp at EAR_URL)
 *
 * Every route except /health needs `Authorization: Bearer $JARVIS_SERVER_KEY`. Only the website's
 * server (the Nuxt routes on Vercel) holds that key; browsers never talk to this server directly.
 */
import http from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { KokoroTTS } from 'kokoro-js';

const PORT = Number(process.env.PORT ?? 8787);
const KEY = process.env.JARVIS_SERVER_KEY ?? '';
const LLM = (process.env.LLM_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const DTYPE = process.env.KOKORO_DTYPE ?? 'fp32';
const EAR = (process.env.EAR_URL ?? 'http://127.0.0.1:8091').replace(/\/+$/, '');
const VOICE_DIR = new URL('./voices/', import.meta.url);
if (!KEY) { console.error('Set JARVIS_SERVER_KEY.'); process.exit(1); }

// Each voice is a Kokoro style pack (510 rows of 256 floats), blended offline from Kokoro's British voices.
const SPEED = { sterling: .93, whitcombe: .92, ravenhill: .86, ashford: .88, kensington: .9 };
const packs = new Map(readdirSync(VOICE_DIR).filter(name => name.endsWith('.bin')).map(name => {
  const bytes = readFileSync(new URL(name, VOICE_DIR));
  return [name.slice(0, -4), new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)];
}));

let style = packs.get('sterling');
let tts = null;
const loading = KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: DTYPE, device: 'cpu' }).then(async model => {
  // Kokoro only knows its own voice names; the one step that picks the style vector reads our pack instead.
  model.generate_from_ids = async (ids, options) => {
    const Tensor = ids.constructor, row = Math.min(Math.max(ids.dims.at(-1) - 2, 0), 509);
    const { waveform } = await model.model({ input_ids: ids, style: new Tensor('float32', style.slice(row * 256, row * 256 + 256), [1, 256]), speed: new Tensor('float32', new Float32Array([options.speed ?? 1]), [1]) });
    return { audio: waveform.data, sampling_rate: 24000 };
  };
  await model.generate('Ready.', { voice: 'bm_george' });
  tts = model;
  console.log(`voice ready (${DTYPE})`);
  return model;
});
loading.catch(error => console.error('voice failed to load', error));

// One synthesis at a time: a small CPU does them faster in a line than all at once.
let queue = Promise.resolve();
function speak(text, voice, speed) {
  const job = queue.then(async () => {
    const model = tts ?? await loading;
    style = packs.get(voice) ?? packs.get('sterling');
    const result = await model.generate(text, { voice: 'bm_george', speed: speed ?? SPEED[voice] ?? .93 });
    return result.audio;
  });
  queue = job.catch(() => {});
  return job;
}

function wav(samples, rate = 24000) {
  const out = Buffer.alloc(44 + samples.length * 2);
  out.write('RIFF', 0); out.writeUInt32LE(36 + samples.length * 2, 4); out.write('WAVE', 8); out.write('fmt ', 12);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return out;
}

function authorised(request) {
  const given = Buffer.from(String(request.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const wanted = Buffer.from(KEY);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

async function body(request, limit = 64_000) {
  let size = 0; const chunks = [];
  for await (const chunk of request) { size += chunk.length; if (size > limit) throw new Error('too large'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const send = (response, status, payload) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(payload)); };

http.createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', 'http://x').pathname;
    if (request.method === 'GET' && path === '/health') return send(response, 200, { ok: true, voice: Boolean(tts), voices: [...packs.keys()] });
    if (!authorised(request)) return send(response, 401, { error: 'unauthorised' });

    if (request.method === 'POST' && path === '/v1/audio/speech') {
      const { input, voice = 'sterling', speed } = await body(request);
      const text = String(input ?? '').trim();
      if (!text || text.length > 600) return send(response, 400, { error: 'input must be 1 to 600 characters' });
      const started = performance.now();
      const audio = await speak(text, String(voice), typeof speed === 'number' ? Math.min(1.3, Math.max(.7, speed)) : undefined);
      response.writeHead(200, { 'Content-Type': 'audio/wav', 'X-Synthesis-Ms': String(Math.round(performance.now() - started)) });
      return response.end(wav(audio));
    }

    // Hearing: Whisper (whisper.cpp) beside this server. Audio arrives as base64 WAV, text goes back.
    if (request.method === 'POST' && path === '/v1/transcribe') {
      const { audio, prompt } = await body(request, 6_000_000);
      if (typeof audio !== 'string' || !audio) return send(response, 400, { error: 'audio required' });
      const form = new FormData();
      form.append('file', new Blob([Buffer.from(audio, 'base64')], { type: 'audio/wav' }), 'speech.wav');
      form.append('response_format', 'json');
      form.append('temperature', '0');
      if (typeof prompt === 'string' && prompt) form.append('prompt', prompt.slice(0, 600));
      const heard = await fetch(`${EAR}/inference`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) });
      if (!heard.ok) return send(response, 502, { error: 'ear unavailable' });
      const { text } = await heard.json();
      return send(response, 200, { text: String(text ?? '').trim() });
    }

    if (request.method === 'POST' && path === '/v1/chat/completions') {
      const payload = await body(request);
      const upstream = await fetch(`${LLM}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60_000) });
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' });
      if (!upstream.body) return response.end();
      for await (const chunk of upstream.body) response.write(chunk);
      return response.end();
    }
    send(response, 404, { error: 'not found' });
  } catch (error) {
    if (!response.headersSent) send(response, 500, { error: String(error?.message ?? error) });
    else response.end();
  }
}).listen(PORT, () => console.log(`JARVIS server on :${PORT}, mind at ${LLM}`));
