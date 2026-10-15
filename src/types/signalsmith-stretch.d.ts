// Signalsmith Stretch (MIT) ships without types. Only what JARVIS's voice uses.
declare module 'signalsmith-stretch' {
  type StretchNode = AudioWorkletNode & {
    start(when?: number): void;
    stop(when?: number): void;
    schedule(change: Record<string, number | boolean>): void;
    latency(): number;
  };
  export default function SignalsmithStretch(context: BaseAudioContext, options?: AudioWorkletNodeOptions): Promise<StretchNode>;
}
