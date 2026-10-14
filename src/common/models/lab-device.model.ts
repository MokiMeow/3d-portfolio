export type LabDevice = "phone" | "glasses" | "watch" | "terminal" | null;

/**
 * Escape first belongs to the device in hand: it may close a window or step back a screen.
 * A device sets `handler` while it is open and returns true when it used the key; only
 * when it returns false does the dialog put the device down.
 */
export const labDeviceBack: { handler: (() => boolean) | null } = { handler: null };
