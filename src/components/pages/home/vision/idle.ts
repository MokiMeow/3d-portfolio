/**
 * Work for when the browser has a moment to spare: building and compiling things ahead of time, so the
 * moment you ask for them nothing stalls. Safari has no requestIdleCallback, so a short timer stands in.
 */
export function whenIdle(work: () => void, timeout = 3000) {
  const w = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(work, { timeout });
  else window.setTimeout(work, Math.min(timeout, 1500));
}
