import type { Video } from './catalogue';

/**
 * Real YouTube, through the site's own server route (the key never reaches the browser). Results are
 * remembered for the session so the same search never costs quota twice.
 */
const memo = new Map<string, Promise<Video[]>>();
export const known = new Map<string, Video>();

function get(params: Record<string, string>) {
  const key = new URLSearchParams(params).toString();
  let job = memo.get(key);
  if (!job) {
    job = fetch(`/api/youtube?${key}`)
      .then(response => (response.ok ? response.json() as Promise<{ items: Video[] }> : { items: [] }))
      .then(data => { (data.items ?? []).forEach(video => known.set(video.id, video)); return data.items ?? []; })
      .catch(() => { memo.delete(key); return []; });
    memo.set(key, job);
  }
  return job;
}

export const searchYouTube = (q: string, music = false) => q.trim() ? get({ kind: 'search', q: q.trim(), ...(music ? { music: '1' } : {}) }) : Promise.resolve([]);
export const trendingYouTube = (music = false) => get({ kind: 'trending', ...(music ? { music: '1' } : {}) });
