/**
 * How JARVIS reaches into apps. A command for an app that is not open yet waits here until the app
 * mounts and listens; an open app gets it straight away.
 */
export type AppCommand = { action: string; [key: string]: unknown };
type Listener = (command: AppCommand) => void;

const pending = new Map<string, AppCommand[]>();
const listeners = new Map<string, Set<Listener>>();

export function sendToApp(app: string, command: AppCommand) {
  const open = listeners.get(app);
  if (open?.size) open.forEach(listener => listener(command));
  else pending.set(app, [...(pending.get(app) ?? []), command].slice(-4));
}

/** Call from an app's setup; returns the function that stops listening. */
export function listenAsApp(app: string, listener: Listener) {
  const set = listeners.get(app) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(app, set);
  const queued = pending.get(app) ?? [];
  pending.delete(app);
  queued.forEach(command => listener(command));
  return () => { set.delete(listener); };
}
