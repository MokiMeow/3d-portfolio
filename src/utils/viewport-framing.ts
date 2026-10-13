/** Preserve horizontal room coverage in portrait without widening the lens. */
export function portraitFramingScale(width: number, height: number, coverage = .87) {
  return Math.max(1, coverage * Math.max(1, height) / Math.max(1, width));
}
