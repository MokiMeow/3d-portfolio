/// <reference lib="webworker" />
// Kokoro text-to-speech, kept off the main thread so the hologram never stutters while JARVIS talks.
// JARVIS speaks with original voices: weighted blends of Kokoro's British male style packs, stored as
// raw Float32 packs in /vision/voices. Kokoro's public API only takes its own voice names, so the one
// step that picks the style vector is replaced; British phonemisation stays exactly as Kokoro does it.
import { KokoroTTS } from 'kokoro-js';

type Request =
  | { type: 'load'; device: 'webgpu' | 'wasm'; voice: string }
  | { type: 'speak'; id: number; text: string; voice: string; speed: number };
type Engine = {
  generate_from_ids: (ids: TensorLike, options: { speed?: number }) => Promise<unknown>;
  model: (inputs: Record<string, unknown>) => Promise<{ waveform: { data: Float32Array } }>;
};
type TensorLike = { dims: number[]; constructor: new (type: string, data: Float32Array, dims: number[]) => unknown };

let tts: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;
let style: Float32Array | null = null;
const packs = new Map<string, Promise<Float32Array>>();
const scope = self as unknown as DedicatedWorkerGlobalScope;

function pack(name: string) {
  let job = packs.get(name);
  if (!job) {
    job = fetch(`/vision/voices/${name}.bin`).then(response => { if (!response.ok) throw new Error(`voice ${name}`); return response.arrayBuffer(); }).then(buffer => new Float32Array(buffer));
    packs.set(name, job);
  }
  return job;
}

function load(device: 'webgpu' | 'wasm', voice: string) {
  loading ??= KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: device === 'webgpu' ? 'fp32' : 'q8', device,
    progress_callback: (event: { status: string; loaded?: number; total?: number; file?: string }) => {
      if (event.status === 'progress' && event.total) scope.postMessage({ type: 'progress', file: event.file, loaded: event.loaded, total: event.total });
    },
  } as Parameters<typeof KokoroTTS.from_pretrained>[1]).then(async model => {
    const engine = model as unknown as Engine;
    // The style row Kokoro picks depends on the utterance length; keep that, but read it from our pack.
    engine.generate_from_ids = async (ids, options) => {
      const Tensor = ids.constructor, row = Math.min(Math.max(ids.dims.at(-1)! - 2, 0), 509);
      const { waveform } = await engine.model({ input_ids: ids, style: new Tensor('float32', style!.slice(row * 256, row * 256 + 256), [1, 256]), speed: new Tensor('float32', new Float32Array([options.speed ?? 1]), [1]) });
      return { audio: waveform.data, sampling_rate: 24000 };
    };
    style = await pack(voice);
    // Warm the graph so the first real sentence is not the slow one.
    await model.generate('Ready.', { voice: 'bm_george' });
    tts = model;
    return model;
  });
  return loading;
}

scope.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data;
  try {
    if (message.type === 'load') { await load(message.device, message.voice); scope.postMessage({ type: 'ready' }); return; }
    const model = tts ?? await loading;
    if (!model) throw new Error('Voice not loaded');
    style = await pack(message.voice);
    const audio = await model.generate(message.text, { voice: 'bm_george', speed: message.speed }) as unknown as { audio: Float32Array; sampling_rate: number };
    const samples = audio.audio;
    scope.postMessage({ type: 'audio', id: message.id, samples, rate: audio.sampling_rate }, [samples.buffer]);
  } catch (error) {
    scope.postMessage({ type: 'error', id: 'id' in message ? message.id : -1, message: error instanceof Error ? error.message : String(error) });
  }
};
