/// <reference lib="webworker" />
// Kokoro text-to-speech, kept off the main thread so the hologram never stutters while JARVIS talks.
import { KokoroTTS } from 'kokoro-js';

type Request =
  | { type: 'load'; device: 'webgpu' | 'wasm' }
  | { type: 'speak'; id: number; text: string; voice: string; speed: number };

let tts: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;
const scope = self as unknown as DedicatedWorkerGlobalScope;

function load(device: 'webgpu' | 'wasm') {
  loading ??= KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: device === 'webgpu' ? 'fp32' : 'q8', device,
    progress_callback: (event: { status: string; loaded?: number; total?: number; file?: string }) => {
      if (event.status === 'progress' && event.total) scope.postMessage({ type: 'progress', file: event.file, loaded: event.loaded, total: event.total });
    },
  } as Parameters<typeof KokoroTTS.from_pretrained>[1]).then(async model => {
    // Warm the graph so the first real sentence is not the slow one.
    await model.generate('Ready.', { voice: 'bm_fable' });
    tts = model;
    return model;
  });
  return loading;
}

scope.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data;
  try {
    if (message.type === 'load') { await load(message.device); scope.postMessage({ type: 'ready' }); return; }
    const model = tts ?? await loading;
    if (!model) throw new Error('Voice not loaded');
    const audio = await model.generate(message.text, { voice: message.voice as 'bm_fable', speed: message.speed });
    const samples = audio.audio as Float32Array;
    scope.postMessage({ type: 'audio', id: message.id, samples, rate: audio.sampling_rate }, [samples.buffer]);
  } catch (error) {
    scope.postMessage({ type: 'error', id: 'id' in message ? message.id : -1, message: error instanceof Error ? error.message : String(error) });
  }
};
