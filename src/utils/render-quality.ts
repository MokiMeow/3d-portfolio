/** Native resolution up to 2x, with a bounded fill-rate on large displays. */
export function roomPixelRatio(width: number, height: number, deviceRatio: number) {
  return Math.max(1, Math.min(deviceRatio, 2, Math.sqrt(3_200_000 / Math.max(1, width * height))));
}
