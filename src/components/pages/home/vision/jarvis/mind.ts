/**
 * The neural core. When the site has a hosted model (see server/api/jarvis.ts) it is used straight away:
 * nothing to download, no GPU needed. Otherwise a small language model runs on this device's GPU, in a worker.
 * It only ever talks. Commands are parsed by the local brain first, so the model can suggest a place
 * or an app but never drives the headset on its own; any suggestion it makes is checked against the
 * real list of ids before anything happens.
 */
import type { ChatCompletionMessageParam, MLCEngineInterface } from '@mlc-ai/web-llm';
import type { Entry, JarvisContext } from './brain';
import { PLAN_SCHEMA, planMessages } from './plan';

export type MindModel = { id: string; name: string; size: string; line: string };
// Auditioned on WebGPU against Qwen3 0.6B and 1.7B: the 2B held character, admitted its limits and kept its
// arithmetic, at about 43 tokens a second with the first word in a third of a second.
export const MODELS: MindModel[] = [
  { id: 'Qwen3.5-2B-q4f16_1-MLC', name: 'Qwen3.5 2B', size: '1.1 GB', line: 'Two billion parameters, on your GPU' },
];
export type MindStatus = 'off' | 'loading' | 'ready' | 'error';

const clock = (now: Date) => new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(now);

/** The persona, the facts it may rely on, and the live state of the headset. Kept short on purpose. */
export function systemPrompt(ctx: JarvisContext) {
  const where = ctx.place.id === 'room' ? 'in their own room, in passthrough' : `in the ${ctx.place.name} environment at ${Math.round(ctx.immersion * 100)}% immersion`;
  const open = ctx.open.length ? ctx.open.map(item => item.name).join(', ') : 'none';
  return [
    `You are JARVIS, the calm, loyal British AI butler from the Iron Man films, now running inside a simulated Apple Vision Pro headset in Mohith's lab.`,
    `Speak like JARVIS: precise, unhurried, quietly witty, never gushing. Call the user "${ctx.address}" at most once per reply.`,
    `Reply in one or two short sentences, under 40 words. Plain speech only: no emoji, no lists, no markdown, no stage directions.`,
    `You live entirely on this device. You have no internet, no real weather, no cameras and no access to the real world; say so briefly if asked. Never claim to have done something. If you are not sure of a fact, say so rather than guess.`,
    `Facts you may use: Apple Vision Pro uses eye and hand tracking; the current model has an M5 chip; visionOS 27 is the current software.`,
    `Right now: the user is ${where}. Open windows: ${open}. Local time ${clock(ctx.now)}.`,
    `If going somewhere or opening an app would genuinely help, you may end with one tag, [[place:ID]] or [[app:ID]], using only these ids.`,
    `Places: ${ctx.environments.map(item => item.id).join(', ')}. Apps: ${ctx.apps.map(item => item.id).join(', ')}.`,
    ...(ctx.memories?.length ? [`Things the user asked you to remember: ${ctx.memories.slice(-8).join('; ')}.`] : []),
  ].join('\n');
}

/** Hand-written exchanges in his voice. Tiny models copy tone and length far better from examples than from rules. */
const EXAMPLES: [string, string][] = [
  ['How are you today?', 'All systems nominal, sir, and the coffee is entirely hypothetical. How may I help?'],
  ['I am bored.', 'Then allow me to suggest a change of scenery. The Milky Way is particularly fine tonight. [[place:night]]'],
  ['What is the speed of light?', 'Just under three hundred thousand kilometres per second, sir. Rather quicker than my last update.'],
  ['Can you order me a pizza?', 'I am afraid I have no connection to the outside world, sir. Your hunger remains, regrettably, your own affair.'],
  ['I feel a bit low today.', 'I am sorry to hear it, sir. I am not much of a shoulder, but I am an excellent listener. What is on your mind?'],
  ['Who are you?', 'JARVIS. Just A Rather Very Intelligent System, running quietly inside this headset, at your service.'],
  ['What would Tony think of my new watch?', 'He would take it apart before lunch, sir, and improve it by dinner. Then lose the screws.'],
];

export function messages(ctx: JarvisContext, history: { you: string; jarvis: string }[], text: string): ChatCompletionMessageParam[] {
  const fill = (line: string) => line.replace(/\bsir\b/g, ctx.address);
  return [
    { role: 'system', content: systemPrompt(ctx) },
    ...EXAMPLES.flatMap(([q, a]) => [{ role: 'user', content: q } as const, { role: 'assistant', content: fill(a) } as const]),
    ...history.slice(-4).flatMap(turn => [{ role: 'user', content: turn.you } as const, { role: 'assistant', content: turn.jarvis } as const]),
    { role: 'user', content: text },
  ];
}

/** Tidy a reply: drop thinking blocks, markdown, emoji and anything after the second or third sentence. */
export function tidy(raw: string, address = 'sir') {
  let text = raw.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/[*_#`>]/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
  const tag = text.match(/\[\[(place|app):([a-z0-9-]+)\]\]/i);
  text = text.replace(/\[\[[^\]]*\]?\]?/g, '').replace(/\s+([.,!?])/g, '$1').trim();
  // The address once per reply is charming; twice is a tic.
  let seen = 0;
  const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  text = text.replace(new RegExp(`,?\\s*\\b${escaped}\\b(?=[,.!?])`, 'gi'), match => (seen++ ? '' : match));
  const parts = text.match(/[^.!?]+[.!?]+["')\]]*/g) ?? [text];
  let out = '';
  for (const part of parts) { if ((out + part).length > 240 && out) break; out += part; }
  return { text: out.trim() || text.slice(0, 240), tag: tag ? { kind: tag[1]!.toLowerCase() as 'place' | 'app', id: tag[2]!.toLowerCase() } : undefined };
}

export class JarvisMind {
  status: MindStatus = 'off';
  progress = 0;
  detail = '';
  model: MindModel = MODELS[0]!;
  tokensPerSecond = 0;
  onChange: () => void = () => {};
  private engine: MLCEngineInterface | null = null;
  private worker: Worker | null = null;
  /** 'hosted' when replies come from the site's server, 'local' when the model runs in this browser. */
  mode: 'hosted' | 'local' = 'local';
  private abort: AbortController | null = null;
  private static hostedCheck: Promise<{ name: string | null; voice: boolean }> | null = null;

  /** What the site hosts: the mind's display name (null if none) and whether there is a hosted voice. Asked once. */
  static service() {
    JarvisMind.hostedCheck ??= fetch('/api/jarvis', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() as Promise<{ ok?: boolean; name?: string; voice?: boolean }> : null))
      .then(info => ({ name: info?.ok ? info.name || 'Hosted mind' : null, voice: Boolean(info?.voice) }))
      .catch(() => ({ name: null, voice: false }));
    return JarvisMind.hostedCheck;
  }
  static async hosted() { return (await JarvisMind.service()).name; }

  static async supported() {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    if (!gpu) return false;
    const adapter = await gpu.requestAdapter().catch(() => null);
    return Boolean(adapter?.features.has('shader-f16'));
  }

  async load(model = this.model) {
    if (this.status === 'loading') return;
    if (this.status === 'ready' && this.model.id === model.id) return;
    const hosted = await JarvisMind.hosted();
    if (hosted) {
      this.mode = 'hosted'; this.model = { id: 'hosted', name: hosted, size: 'Hosted', line: 'Served from the cloud' };
      this.status = 'ready'; this.progress = 1; this.detail = 'Online'; this.onChange();
      return;
    }
    this.mode = 'local';
    this.model = model; this.status = 'loading'; this.progress = 0; this.detail = 'Preparing'; this.onChange();
    const webllm = await import('@mlc-ai/web-llm');
    await this.engine?.unload().catch(() => {});
    this.worker?.terminate();
    const attempt = async (cacheBackend: 'cache' | 'indexeddb') => {
      this.worker = new Worker(new URL('./mind.worker.ts', import.meta.url), { type: 'module' });
      return webllm.CreateWebWorkerMLCEngine(this.worker, model.id, {
        appConfig: { ...webllm.prebuiltAppConfig, cacheBackend },
        initProgressCallback: report => { this.progress = report.progress; this.detail = report.text; this.onChange(); },
      });
    };
    try {
      // The Cache API is WebLLM's best-tested store; some profiles refuse it, so IndexedDB stands by.
      this.engine = await attempt('cache').catch(async error => {
        if (!/CacheStorage|cache/i.test(String(error))) throw error;
        this.worker?.terminate();
        return attempt('indexeddb');
      });
      void navigator.storage?.persist?.();
      this.status = 'ready'; this.progress = 1; this.detail = 'Online';
    } catch (error) {
      this.status = 'error'; this.detail = error instanceof Error ? error.message : String(error);
      this.worker?.terminate(); this.worker = null; this.engine = null;
    }
    this.onChange();
  }

  /** Stream a reply. `onText` receives the tidied text so far. */
  async reply(ctx: JarvisContext, history: { you: string; jarvis: string }[], text: string, onText: (text: string) => void) {
    if (this.mode === 'hosted') return this.replyHosted(ctx, history, text, onText);
    if (!this.engine) throw new Error('Neural core offline');
    const started = performance.now();
    let raw = '', tokens = 0, first = 0;
    const stream = await this.engine.chat.completions.create({
      messages: messages(ctx, history, text), stream: true, temperature: .7, top_p: .8, max_tokens: 90,
      // Qwen's thinking mode is switched off: replies must start at once.
      extra_body: { enable_thinking: false },
    } as Parameters<MLCEngineInterface['chat']['completions']['create']>[0] & { stream: true });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (!delta) continue;
      if (!first) first = performance.now();
      tokens++; raw += delta;
      onText(tidy(raw, ctx.address).text);
    }
    if (first) this.tokensPerSecond = Math.round(tokens / Math.max(.05, (performance.now() - first) / 1000));
    const done = tidy(raw, ctx.address);
    return { ...done, ms: Math.round(performance.now() - started) };
  }

  /** The same reply, from the site's server: OpenAI-style server-sent events, read as they arrive. */
  private async replyHosted(ctx: JarvisContext, history: { you: string; jarvis: string }[], text: string, onText: (text: string) => void) {
    const started = performance.now();
    this.abort?.abort(); this.abort = new AbortController();
    const response = await fetch('/api/jarvis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: this.abort.signal,
      body: JSON.stringify({ messages: messages(ctx, history, text) }),
    });
    if (!response.ok || !response.body) throw new Error(response.status === 429 ? 'Hosted mind is busy' : `Hosted mind ${response.status}`);
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let raw = '', buffer = '', tokens = 0, first = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) {
          const data = line.trim();
          if (!data.startsWith('data:')) continue;
          const payload = data.slice(5).trim();
          if (payload === '[DONE]') continue;
          let delta = '';
          try { delta = (JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content ?? ''; } catch { continue; }
          if (!delta) continue;
          if (!first) first = performance.now();
          tokens++; raw += delta;
          onText(tidy(raw, ctx.address).text);
        }
      }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) throw error; }
    if (first) this.tokensPerSecond = Math.round(tokens / Math.max(.05, (performance.now() - first) / 1000));
    return { ...tidy(raw, ctx.address), ms: Math.round(performance.now() - started) };
  }

  /**
   * Ask for a plan: the model answers with {"actions": [...], "say": "..."}, constrained to that JSON.
   * `onDelta` receives the raw text as it streams, for the plan reader to act on early.
   */
  async plan(ctx: JarvisContext, history: { you: string; jarvis: string }[], text: string, onDelta: (delta: string) => void) {
    const started = performance.now();
    let tokens = 0, first = 0;
    const count = (delta: string) => { if (!delta) return; if (!first) first = performance.now(); tokens++; onDelta(delta); };
    const messages = planMessages(ctx, history, text);
    if (this.mode === 'hosted') {
      this.abort?.abort(); this.abort = new AbortController();
      const response = await fetch('/api/jarvis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: this.abort.signal,
        body: JSON.stringify({ messages, plan: true, schema: PLAN_SCHEMA }),
      });
      if (!response.ok || !response.body) throw new Error(response.status === 429 ? 'Hosted mind is busy' : `Hosted mind ${response.status}`);
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(String.fromCharCode(10)); buffer = lines.pop() ?? '';
          for (const line of lines) {
            const data = line.trim();
            if (!data.startsWith('data:')) continue;
            const payload = data.slice(5).trim();
            if (payload === '[DONE]') continue;
            try { count((JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content ?? ''); } catch { /* keep-alive */ }
          }
        }
      } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) throw error; }
    } else {
      if (!this.engine) throw new Error('Neural core offline');
      const stream = await this.engine.chat.completions.create({
        messages, stream: true, temperature: .4, top_p: .8, max_tokens: 220,
        response_format: { type: 'json_object', schema: JSON.stringify(PLAN_SCHEMA) },
        extra_body: { enable_thinking: false },
      } as Parameters<MLCEngineInterface['chat']['completions']['create']>[0] & { stream: true });
      for await (const chunk of stream) count(chunk.choices[0]?.delta?.content ?? '');
    }
    if (first) this.tokensPerSecond = Math.round(tokens / Math.max(.05, (performance.now() - first) / 1000));
    return { ms: Math.round(performance.now() - started) };
  }

  stop() { this.abort?.abort(); void this.engine?.interruptGenerate(); }
  async unload() { await this.engine?.unload().catch(() => {}); this.worker?.terminate(); this.worker = null; this.engine = null; this.status = 'off'; this.onChange(); }
}

/** A suggestion is only followed when the request was about going somewhere or doing something, and is not where you already are. */
export function validTag(tag: { kind: 'place' | 'app'; id: string } | undefined, apps: readonly Entry[], places: readonly Entry[], asked: string, here: string, open: readonly Entry[]) {
  if (!tag) return undefined;
  const wantsPlace = /\b(bored|somewhere|take me|show me|go to|get away|escape|travel|explore|scenery|change of scene|relax|calm down|unwind|sleep|tired)\b/i.test(asked);
  const wantsApp = /\b(open|launch|play|listen|watch|music|song|video|film|movie|game)\b/i.test(asked);
  if (tag.kind === 'place' ? !wantsPlace : !wantsApp) return undefined;
  if (tag.kind === 'place' && tag.id === here) return undefined;
  if (tag.kind === 'app' && open.some(item => item.id === tag.id)) return undefined;
  const list = tag.kind === 'place' ? places : apps;
  return list.some(item => item.id === tag.id) ? tag : undefined;
}
