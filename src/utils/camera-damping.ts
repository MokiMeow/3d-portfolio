/** Stable interpolation weight, including a resumed background tab. */
export function cameraDamping(rate: number, elapsedMs: number) {
  const elapsed = Number.isFinite(elapsedMs)
    ? Math.max(0, Math.min(elapsedMs, 100))
    : 16.67;
  return 1 - Math.exp(-rate * elapsed);
}
