/**
 * YouTube search and trending for the headset's YouTube and Music apps, and for JARVIS.
 *
 * The API key stays here on the server (NUXT_YOUTUBE_KEY) and never reaches the browser. Searches cost a
 * hundredth of the daily quota each, so answers are cached in memory and at the edge for hours.
 */
type Item = { id: string; title: string; channel: string; duration: string; seconds: number; year: number; category: string };
const cache = new Map<string, { at: number; items: Item[] }>();
const HOUR = 3600_000;

function iso(duration: string) {
  const m = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}
function clock(seconds: number) {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function decode(text: string) {
  return text.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Some channels stuff their display name with view counts and line breaks; keep the first line, short.
function name(text: string) {
  const line = decode(text).split('\n')[0]!.replace(/\s+/g, ' ').trim();
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

type Video = { id: string; snippet: { title: string; channelTitle: string; publishedAt: string; categoryId?: string }; contentDetails: { duration: string }; status?: { embeddable?: boolean } };

export default defineEventHandler(async event => {
  const key = useRuntimeConfig(event).youtubeKey as string;
  if (!key) throw createError({ statusCode: 503, statusMessage: 'YouTube is not configured' });
  const query = getQuery(event);
  const kind = query.kind === 'trending' ? 'trending' : 'search';
  const music = query.music === '1';
  const q = String(query.q ?? '').trim().slice(0, 80);
  if (kind === 'search' && !q) return { items: [] };
  const id = `${kind}:${music}:${q.toLowerCase()}`;
  const hit = cache.get(id);
  setHeader(event, 'Cache-Control', 'public, max-age=600, s-maxage=21600, stale-while-revalidate=86400');
  if (hit && Date.now() - hit.at < (kind === 'trending' ? 3 : 12) * HOUR) return { items: hit.items };

  const api = (path: string, params: Record<string, string>) => $fetch<{ items?: unknown[] }>(`https://www.googleapis.com/youtube/v3/${path}`, { query: { ...params, key } });
  let ids: string[];
  if (kind === 'trending') {
    const list = await api('videos', { part: 'id', chart: 'mostPopular', regionCode: 'IN', maxResults: '24', ...(music ? { videoCategoryId: '10' } : {}) });
    ids = (list.items as { id: string }[] ?? []).map(item => item.id);
  } else {
    const list = await api('search', { part: 'id', type: 'video', q, maxResults: '14', safeSearch: 'moderate', videoEmbeddable: 'true', ...(music ? { videoCategoryId: '10' } : {}) });
    ids = (list.items as { id: { videoId: string } }[] ?? []).map(item => item.id.videoId).filter(Boolean);
  }
  if (!ids.length) return { items: [] };
  // One cheap call for titles, channels, runtimes and whether the video may be embedded.
  const details = await api('videos', { part: 'snippet,contentDetails,status', id: ids.join(',') });
  const items: Item[] = (details.items as Video[] ?? [])
    .filter(video => video.status?.embeddable !== false)
    .map(video => {
      const seconds = iso(video.contentDetails.duration);
      return {
        id: video.id, title: decode(video.snippet.title), channel: name(video.snippet.channelTitle),
        duration: clock(seconds), seconds, year: new Date(video.snippet.publishedAt).getFullYear(),
        category: music || video.snippet.categoryId === '10' ? 'Music' : kind === 'trending' ? 'Trending' : 'Search',
      };
    })
    .filter(item => item.seconds > 0);
  cache.set(id, { at: Date.now(), items });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return { items };
});
