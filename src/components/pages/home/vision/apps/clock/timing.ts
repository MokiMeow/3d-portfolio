export interface Timer { id: string; label: string; duration: number; remaining: number; deadline: number; state: 'running' | 'paused' | 'finished' }
/** A monotonic deadline keeps a throttled or hidden tab from losing time. */
export function advanceTimers(timers: Timer[], now: number): Timer[] {
  const finished: Timer[] = [];
  for (const timer of timers) {
    if (timer.state !== 'running') continue;
    timer.remaining = Math.max(0, timer.deadline - now);
    if (timer.remaining === 0) { timer.state = 'finished'; finished.push(timer); }
  }
  return finished;
}
export function pauseTimer(timer: Timer, now: number): void {
  if (timer.state !== 'running') return;
  timer.remaining = Math.max(0, timer.deadline - now); timer.state = 'paused';
}
export function resumeTimer(timer: Timer, now: number): void {
  if (timer.state === 'running') return;
  if (timer.state === 'finished') timer.remaining = timer.duration;
  timer.deadline = now + timer.remaining; timer.state = 'running';
}
export function elapsedAt(base: number, started: number, running: boolean, now: number): number {
  return base + (running ? Math.max(0, now - started) : 0);
}
