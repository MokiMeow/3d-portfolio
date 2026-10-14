import { ref } from 'vue';

/** A quiet two-tone pad. Created only by a user gesture, never on mount. */
export function useBreathAudio() {
  const audioNotice = ref('');
  let context: AudioContext | undefined;
  let voices: OscillatorNode[] = [];
  let gain: GainNode | undefined;
  let generation = 0;

  function dispose(): void {
    generation += 1;
    for (const voice of voices) {
      try { voice.stop(); } catch { /* Already stopped. */ }
      voice.disconnect();
    }
    voices = [];
    gain?.disconnect();
    gain = undefined;
    const previous = context;
    context = undefined;
    if (previous && previous.state !== 'closed') void previous.close().catch(() => undefined);
  }

  async function start(): Promise<void> {
    dispose();
    audioNotice.value = '';
    const ticket = generation;
    try {
      if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
        audioNotice.value = 'Gentle tones are unavailable in this browser.';
        return;
      }
      const current = new window.AudioContext();
      context = current;
      gain = current.createGain();
      gain.gain.value = 0;
      gain.connect(current.destination);
      for (const frequency of [174, 261]) {
        const voice = current.createOscillator();
        voice.type = 'sine';
        voice.frequency.value = frequency;
        voice.connect(gain);
        voice.start();
        voices.push(voice);
      }
      await current.resume();
      if (ticket !== generation) return;
      if (current.state !== 'running') {
        audioNotice.value = 'Sound is paused by your browser. Toggle tones to try again.';
        dispose();
      }
    } catch {
      if (ticket !== generation) return;
      audioNotice.value = 'Sound could not start. You can continue in silence.';
      dispose();
    }
  }

  function follow(amount: number): void {
    if (!context || !gain || context.state !== 'running') return;
    const now = context.currentTime;
    gain.gain.setTargetAtTime(.012 + amount * .022, now, .22);
    voices.forEach((voice, index) => {
      voice.frequency.setTargetAtTime((index ? 261 : 174) + amount * 12, now, .3);
    });
  }
  return { audioNotice, start, dispose, follow };
}
