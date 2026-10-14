export type InkPoint = { x: number; y: number };
export type InkStroke = { tool: 'pen' | 'marker' | 'eraser'; color: string; points: InkPoint[] };
export type Note = {
  id: string; title: string; html: string; folder: string; tags: string[]; pinned: boolean;
  locked: boolean; edited: number; strokes: InkStroke[];
};
export const STORAGE_KEY = 'lab-vision-notes';
export const FOLDERS = ['Notes', 'Ideas', 'Quick Notes'];
export const INK_COLORS = ['#17191e', '#ffd60a', '#ff453a', '#0a84ff', '#30d158', '#bf5af2'];
const allowedTags = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
  'UL', 'OL', 'LI', 'PRE', 'CODE', 'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'BLOCKQUOTE']);
export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** Rebuild a small rich-text vocabulary. No styles, URLs or executable attributes survive. */
export function safeHtml(source: string): string {
  if (typeof document === 'undefined') return escapeText(source.slice(0, 80000));
  const template = document.createElement('template');
  template.innerHTML = source.slice(0, 80000);
  const clean = (node: Node, depth = 0): string => {
    if (depth > 35) return '';
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return '';
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH'].includes(node.tagName)) return '';
    const children = Array.from(node.childNodes).map(child => clean(child, depth + 1)).join('');
    if (node.tagName === 'SPAN') {
      let text = children;
      const style = node.style;
      if (style.fontWeight === 'bold' || Number.parseInt(style.fontWeight, 10) >= 600) text = '<strong>' + text + '</strong>';
      if (['italic', 'oblique'].includes(style.fontStyle)) text = '<em>' + text + '</em>';
      const decoration = style.textDecorationLine || style.textDecoration;
      if (decoration.includes('underline')) text = '<u>' + text + '</u>';
      if (decoration.includes('line-through')) text = '<s>' + text + '</s>';
      if (style.fontFamily.toLowerCase().includes('monospace')) text = '<code>' + text + '</code>';
      return text;
    }
    if (!allowedTags.has(node.tagName)) return children;
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<br>';
    let attr = '';
    if (tag === 'ul' && node.dataset.list === 'check') attr = ' data-list="check"';
    if (tag === 'li' && ['true', 'false'].includes(node.dataset.checked ?? '')) {
      attr = ' data-checked="' + node.dataset.checked + '"';
    }
    return '<' + tag + attr + '>' + children + '</' + tag + '>';
  };
  return Array.from(template.content.childNodes).map(node => clean(node)).join('');
}
export function plainText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const holder = document.createElement('div');
  holder.innerHTML = safeHtml(html).replace(/<\/(p|div|li|h[123]|tr|pre)>/g, ' </$1>');
  return holder.textContent ?? '';
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validStrokes(value: unknown): InkStroke[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 160).flatMap((item: unknown) => {
    if (!record(item) || !['pen', 'marker', 'eraser'].includes(String(item.tool)) || !Array.isArray(item.points)) return [];
    const tool = item.tool as InkStroke['tool'];
    const color = typeof item.color === 'string' && INK_COLORS.includes(item.color) ? item.color : INK_COLORS[0] ?? '#17191e';
    const points = item.points.slice(0, 1200).flatMap((point: unknown) => {
      if (!record(point) || typeof point.x !== 'number' || typeof point.y !== 'number') return [];
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
      return [{ x: Math.max(0, Math.min(1, point.x)), y: Math.max(0, Math.min(1, point.y)) }];
    });
    return points.length ? [{ tool, color, points }] : [];
  });
}
export function readNotes(raw: string): Note[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return null;
    const ids = new Set<string>();
    return value.slice(0, 200).flatMap((item: unknown) => {
      if (!record(item) || typeof item.id !== 'string' || !item.id) return [];
      const id = item.id.slice(0, 80);
      if (ids.has(id)) return [];
      if (typeof item.title !== 'string' || typeof item.html !== 'string') return [];
      ids.add(id);
      const tags = Array.isArray(item.tags) ? item.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [];
      return [{ id, title: item.title.slice(0, 200), html: safeHtml(item.html),
        folder: typeof item.folder === 'string' && FOLDERS.includes(item.folder) ? item.folder : 'Notes',
        tags: [...new Set(tags.map(tag => tag.replace(/[^\w-]/g, '').slice(0, 24)).filter(Boolean))].slice(0, 12),
        pinned: item.pinned === true, locked: item.locked === true,
        edited: typeof item.edited === 'number' && Number.isFinite(item.edited) ? Math.max(0, Math.min(Date.now() + 86400000, item.edited)) : Date.now(),
        strokes: validStrokes(item.strokes) }];
    });
  } catch { return null; }
}
export function seedNotes(): Note[] {
  const seeds = [
    ['A good day, by design', 'Notes', 'everyday', true,
      '<p>A sample notebook for small plans and things worth keeping.</p><h3>Make a little space</h3>'
      + '<ul data-list="check"><li data-checked="true">Find a quiet corner</li><li data-checked="false">Read a chapter, without a screen</li><li data-checked="false">Take the long way home</li></ul>'
      + '<blockquote>Leave room for something unplanned.</blockquote>'],
    ['The weekend edit', 'Notes', 'weekend', false,
      '<h2>Slow mornings. Open afternoons.</h2><p>A fictional little itinerary. No reservations required.</p>'
      + '<table><tbody><tr><th>When</th><th>The plan</th></tr><tr><td>Saturday</td><td>Coffee, a bookshop, a walk</td></tr><tr><td>Sunday</td><td>Cook something new</td></tr></tbody></table><p>Bring a camera. Leave the schedule loose.</p>'],
    ['An idea taking shape', 'Ideas', 'design', true,
      '<p>What if a workspace felt more like a clearing?</p><h3>Three things to explore</h3><ul><li>Light that follows the time of day</li><li>Tools that stay out of the way</li><li>A little breathing room between ideas</li></ul><p>A first sketch, below.</p>'],
    ['For the next adventure', 'Notes', 'packing', false,
      '<h3>Travel light</h3><ul data-list="check"><li data-checked="true">Camera &amp; spare battery</li><li data-checked="false">Notebook and a favourite pen</li><li data-checked="false">A warm layer</li><li data-checked="false">Something good to read</li></ul>'],
    ['Collected thoughts', 'Ideas', 'inspiration', false,
      '<h2>Less, with intention.</h2><p>A good detail makes the whole thing feel considered.</p><blockquote>Give the important things enough space to be noticed.</blockquote><h3>Look more closely</h3><p>The curve of a handle. The rhythm of a bookshelf. Afternoon light across a wall.</p>'],
    ['A thought to come back to', 'Quick Notes', 'quick', false,
      '<p>Make something small, and make it feel wonderful to use.</p>'],
  ] as const;
  return seeds.map((item, index): Note => ({ id: 'seed-' + index, title: item[0], folder: item[1], tags: [item[2]],
    pinned: item[3], html: item[4], locked: false, edited: Date.now() - index * 86400000,
    strokes: index === 2 ? [
      { tool: 'pen', color: '#0a84ff', points: [{x:.12,y:.7},{x:.12,y:.3},{x:.64,y:.3},{x:.64,y:.7},{x:.12,y:.7}] },
      { tool: 'pen', color: '#0a84ff', points: [{x:.2,y:.42},{x:.38,y:.42},{x:.38,y:.6},{x:.2,y:.6},{x:.2,y:.42}] },
      { tool: 'marker', color: '#ffd60a', points: [{x:.45,y:.45},{x:.57,y:.45},{x:.45,y:.57},{x:.57,y:.57}] },
      { tool: 'pen', color: '#30d158', points: [{x:.74,y:.7},{x:.74,y:.3},{x:.7,y:.36},{x:.74,y:.44},{x:.8,y:.37},{x:.74,y:.3}] },
    ] : [] }));
}
