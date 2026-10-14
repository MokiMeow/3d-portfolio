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
    ['Things to fix: everything', 'Notes', 'todo', true,
      '<p>The button that moves when you look at it.</p><p>The bug that only appears during demos.</p>'
      + '<p>The chair. It knows what it did.</p><p>Remember to drink the chai before it becomes iced chai.</p>'],
    ['Meeting notes: could have been an email', 'Notes', 'meetings', false,
      '<h2>Agenda</h2><p>Discuss the next discussion.</p><p>Action item: create an action item.</p>'
      + '<p>Decision: circle back, spatially.</p><p>Closing thought: the mute button is a gift.</p>'],
    ['Ideas at 3am', 'Ideas', 'ideas', true,
      '<ul><li>A loading spinner that makes chai.</li><li>A rubber duck with offline mode.</li>'
      + '<li>An app that closes your other apps.</li></ul><p>Probably read this again after sleeping.</p>'],
    ['A very ambitious checklist', 'Notes', 'todo', false,
      '<ul data-list="check"><li data-checked="true">Open Notes</li><li data-checked="false">Remember why</li>'
      + '<li data-checked="false">Close the seventeen other tabs</li></ul>'],
    ['Rubber duck office hours', 'Ideas', 'ideas', false,
      '<h2>Questions for the duck</h2><p>Why does it work when I add a console log?</p>'
      + '<p>The duck has declined to comment. Again.</p><pre><code>if (works) { doNotTouch(); }</code></pre>'],
    ['Quick thought', 'Quick Notes', 'quick', false,
      '<p>The best thing about spatial computing: finally, enough room for all the tabs.</p>'],
  ] as const;
  return seeds.map((item, index) => ({ id: 'seed-' + index, title: item[0], folder: item[1], tags: [item[2]],
    pinned: item[3], html: item[4], locked: false, edited: Date.now() - index * 86400000, strokes: [] }));
}
