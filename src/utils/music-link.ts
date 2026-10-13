export type MusicLink = {
  kind: "youtube" | "spotify" | "audio";
  id: string;
  url: string;
};

/** Parse supported share links, never treat pasted text as HTML or a script URL. */
export function parseMusicLink(input: string): MusicLink | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
      ].includes(host)
    ) {
      const parts = url.pathname.split("/").filter(Boolean);
      const id =
        host === "youtu.be"
          ? parts[0]
          : url.searchParams.get("v") ||
            (["shorts", "live", "embed"].includes(parts[0]) ? parts[1] : "");
      return id && /^[\w-]{11}$/.test(id)
        ? { kind: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` }
        : null;
    }
    if (host === "open.spotify.com") {
      const parts = url.pathname
        .split("/")
        .filter(Boolean)
        .filter((p) => !/^intl-[a-z]+$/.test(p));
      if (parts[0] === "embed") parts.shift();
      const [type, id] = parts;
      if (
        ["track", "album", "playlist", "episode", "show"].includes(type) &&
        /^[A-Za-z0-9]{22}$/.test(id ?? "")
      )
        return {
          kind: "spotify",
          id: `spotify:${type}:${id}`,
          url: `https://open.spotify.com/${type}/${id}`,
        };
      return null;
    }
    if (/\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(url.pathname))
      return { kind: "audio", id: url.href, url: url.href };
    return null;
  } catch {
    return null;
  }
}
