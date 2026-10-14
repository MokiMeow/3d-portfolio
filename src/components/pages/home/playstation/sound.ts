// Original console sounds, synthesised so nothing is borrowed: a soft tick for moving, a brighter note for
// confirming, a lower one for going back, a slow swell for switching on and a short flourish for trophies.
type Cue = "move" | "select" | "back" | "boot" | "trophy" | "open";

let context: AudioContext | null = null;
let lastMove = 0;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    context = new Context();
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(ctx: AudioContext, frequency: number, start: number, length: number, gain: number, type: OscillatorType = "sine", glide = 0) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (glide) osc.frequency.exponentialRampToValueAtTime(frequency * glide, start + length);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + Math.min(.02, length / 4));
  amp.gain.exponentialRampToValueAtTime(.0001, start + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + .05);
}

export function psSound(cue: Cue, muted: boolean): void {
  if (muted) return;
  const ctx = audio();
  if (!ctx) return;
  const t = ctx.currentTime + .005;
  switch (cue) {
    case "move": {
      // Never machine-gun ticks while a pointer sweeps across the row.
      const now = performance.now();
      if (now - lastMove < 55) return;
      lastMove = now;
      tone(ctx, 1760, t, .05, .035, "sine");
      tone(ctx, 2640, t, .03, .012, "sine");
      break;
    }
    case "select":
      tone(ctx, 988, t, .12, .06, "sine");
      tone(ctx, 1480, t + .045, .14, .045, "sine");
      break;
    case "back":
      tone(ctx, 740, t, .1, .05, "sine", .8);
      break;
    case "open":
      tone(ctx, 660, t, .18, .04, "triangle");
      tone(ctx, 990, t + .06, .22, .035, "sine");
      break;
    case "trophy":
      [1047, 1319, 1568, 2093].forEach((f, i) => tone(ctx, f, t + i * .07, .5 - i * .06, .05, "sine"));
      tone(ctx, 523, t, .7, .025, "triangle");
      break;
    case "boot": {
      // A low swell that blooms into a clean, bright chord.
      [110, 165, 220].forEach((f, i) => tone(ctx, f, t + i * .05, 2.2, .045, "sine", 1.002));
      [880, 1320, 1760, 2640].forEach((f, i) => tone(ctx, f, t + .9 + i * .09, 1.6, .028, "sine"));
      break;
    }
  }
}
