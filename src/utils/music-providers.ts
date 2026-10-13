export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  getVideoData(): { title?: string };
}
export interface SpotifyPlayer {
  play(): void;
  pause(): void;
  destroy(): void;
  addListener(
    name: string,
    callback: (event: {
      data: { isPaused?: boolean; isBuffering?: boolean };
    }) => void,
  ): void;
}
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: Record<string, unknown>,
  ) => YouTubePlayer;
};
type SpotifyAPI = {
  createController: (
    element: HTMLElement,
    options: Record<string, unknown>,
    callback: (player: SpotifyPlayer) => void,
  ) => void;
};
const pending = new Map<string, Promise<unknown>>();

/** Load each official SDK only after a visitor asks to play a link. */
function loadSDK<T>(
  name: string,
  src: string,
  callback: string,
  read: () => T | undefined,
): Promise<T> {
  const ready = read();
  if (ready) return Promise.resolve(ready);
  if (pending.has(name)) return pending.get(name) as Promise<T>;
  const promise = new Promise<T>((resolve, reject) => {
    const globals = window as unknown as Record<string, unknown>;
    const previous = globals[callback];
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      pending.delete(name);
      globals[callback] = previous;
      reject(
        new Error(
          "The music service could not be reached. Try again or open the original link.",
        ),
      );
    };
    const timer = setTimeout(fail, 15000);
    globals[callback] = (api: T) => {
      clearTimeout(timer);
      globals[callback] = previous;
      if (typeof previous === "function") previous(api);
      const value = read() ?? api;
      if (value) resolve(value);
      else fail();
    };
    script.src = src;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  pending.set(name, promise);
  return promise;
}
export const loadYouTube = () =>
  loadSDK<YouTubeAPI>(
    "youtube",
    "https://www.youtube.com/iframe_api",
    "onYouTubeIframeAPIReady",
    () => {
      const api = (window as unknown as { YT?: YouTubeAPI }).YT;
      return api?.Player ? api : undefined;
    },
  );
export const loadSpotify = () =>
  loadSDK<SpotifyAPI>(
    "spotify",
    "https://open.spotify.com/embed/iframe-api/v1",
    "onSpotifyIframeApiReady",
    () => undefined,
  );
