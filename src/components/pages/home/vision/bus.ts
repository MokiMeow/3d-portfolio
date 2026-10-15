import { reactive } from 'vue';
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

/**
 * A file carried out of a window, into the space: for now, 3D models from the Mac. The window starts
 * the carry on pointer down; the shell draws it under your hand and decides where it lands.
 */
export type Carried = { id: string; name: string; x: number; y: number };
export const carry = reactive({ id: '', name: '', x: 0, y: 0, active: false });
const landings = new Set<(item: Carried) => void>();
export function startCarry(id: string, name: string, event: PointerEvent) {
  const start = { x: event.clientX, y: event.clientY };
  Object.assign(carry, { id, name, x: start.x, y: start.y, active: false });
  const move = (moved: PointerEvent) => {
    carry.x = moved.clientX; carry.y = moved.clientY;
    if (!carry.active && Math.hypot(moved.clientX - start.x, moved.clientY - start.y) > 8) carry.active = true;
  };
  const up = () => {
    window.removeEventListener('pointermove', move, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true);
    if (carry.active) landings.forEach(land => land({ id: carry.id, name: carry.name, x: carry.x, y: carry.y }));
    carry.active = false;
  };
  // Capture phase: the space and the windows stop these events from bubbling.
  window.addEventListener('pointermove', move, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
}
/** Call from the shell; returns the function that stops listening. */
export function onCarryLand(land: (item: Carried) => void) { landings.add(land); return () => { landings.delete(land); }; }
