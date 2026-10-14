/// <reference lib="webworker" />
// The neural core runs here, so token generation never competes with the hologram's frames.
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message: MessageEvent) => handler.onmessage(message);
