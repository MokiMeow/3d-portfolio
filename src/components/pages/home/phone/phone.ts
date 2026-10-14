import type { InjectionKey, Ref } from 'vue';

/** Every app on the pocket lab's phone. `bar` is the status bar's ink over that app. */
export const PHONE_APPS = [
  { id: 'messages', name: 'Messages', bar: 'dark' },
  { id: 'safari', name: 'Safari', bar: 'dark' },
  { id: 'whatsapp', name: 'WhatsApp', bar: 'dark' },
  { id: 'slack', name: 'Slack', bar: 'light' },
  { id: 'claude', name: 'Claude', bar: 'dark' },
  { id: 'chatgpt', name: 'ChatGPT', bar: 'dark' },
  { id: 'grok', name: 'Grok', bar: 'light' },
  { id: 'youtube', name: 'YouTube', bar: 'light' },
  { id: 'phone', name: 'Phone', bar: 'dark' },
  { id: 'photos', name: 'Photos', bar: 'dark' },
  { id: 'camera', name: 'Camera', bar: 'light' },
  { id: 'music', name: 'Music', bar: 'light' },
  { id: 'notes', name: 'Notes', bar: 'dark' },
  { id: 'settings', name: 'Settings', bar: 'dark' },
  { id: 'maps', name: 'Maps', bar: 'dark' },
  { id: 'calculator', name: 'Calculator', bar: 'light' },
  { id: 'weather', name: 'Weather', bar: 'light' },
  { id: 'clock', name: 'Clock', bar: 'light' },
] as const;

export type PhoneAppId = (typeof PHONE_APPS)[number]['id'];

/** What the shell hands to each app. */
export type PhoneContext = {
  /** Ticks once a second. */
  now: Ref<Date>;
  open: (id: PhoneAppId) => void;
  home: () => void;
  /** Shows a banner at the top of the screen, as a notification would. */
  notify: (note: { app: PhoneAppId; title: string; text: string }) => void;
};
export const PHONE: InjectionKey<PhoneContext> = Symbol('lab-phone');

/** The screen is drawn at this size in CSS pixels and scaled to fit the window. */
export const PHONE_SCREEN = { width: 440, height: 956 } as const;
