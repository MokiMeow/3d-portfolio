export type Point = { x: number; y: number };
export const shapes = ['rectangle', 'ellipse', 'triangle', 'arrow', 'line', 'star'] as const;
export type Shape = typeof shapes[number];
export type ItemKind = Shape | 'sticky' | 'text' | 'stroke' | 'marker' | 'connector';
export type Item = {
  id: string;
  kind: ItemKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  text: string;
  points: Point[];
  thickness: number;
  from?: string;
  to?: string;
};
export type Board = { id: string; name: string; items: Item[] };
export const palette = ['#eef9f4', '#f3ac9f', '#f5d887', '#a3dfc8', '#adcfff', '#d5b5ed'];
export function uid(): string {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
export function makeItem(kind: ItemKind, x: number, y: number, color: string): Item {
  return { id: uid(), kind, x, y, w: 180, h: 140, rotation: 0, color, text: '', points: [], thickness: 4 };
}
export function seed(): Board {
  const items = [
    { ...makeItem('sticky', 70, 65, '#f5d887'), text: 'Ship it?', rotation: -5 },
    { ...makeItem('sticky', 380, 50, '#a3dfc8'), text: 'Chai first', rotation: 3 },
    { ...makeItem('sticky', 690, 80, '#f3ac9f'), text: 'Who approved this?', rotation: -3 },
    { ...makeItem('rectangle', 370, 290, '#adcfff'), w: 210, h: 100, text: 'One tiny side project' },
    { ...makeItem('text', 55, 300, '#eef9f4'), w: 225, h: 120, text: 'Scope: small.\nTabs open: many.\nConfidence: cached.' },
    { ...makeItem('sticky', 690, 315, '#d5b5ed'), text: 'Test it. Then test it on a phone.', rotation: 4 },
  ];
  const center = items[3];
  if (center) {
    for (const other of items.filter(item => item.id !== center.id)) {
      items.unshift({ ...makeItem('connector', 0, 0, '#eef9f4'), from: center.id, to: other.id });
    }
  }
  return { id: uid(), name: 'The art of eventually shipping', items };
}
export function smooth(points: Point[]): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${first.x} ${first.y} l .1 .1`;
  let result = `M ${first.x} ${first.y}`;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const next = points[index];
    if (!previous || !next) continue;
    result += ` Q ${previous.x} ${previous.y} ${(previous.x + next.x) / 2} ${(previous.y + next.y) / 2}`;
  }
  const last = points[points.length - 1];
  if (last) result += ` L ${last.x} ${last.y}`;
  return result;
}
export function shapePath(item: Item): string {
  const { w, h, kind } = item;
  if (kind === 'triangle') return `M ${w / 2} 8 L ${w - 8} ${h - 8} L 8 ${h - 8} Z`;
  if (kind === 'line') return `M 8 ${h - 8} L ${w - 8} 8`;
  if (kind === 'arrow') return `M 8 ${h - 8} L ${w - 12} 12 M ${w - 45} 12 H ${w - 12} V 45`;
  if (kind === 'star') {
    return Array.from({ length: 10 }, (_, index) => {
      const angle = -Math.PI / 2 + index * Math.PI / 5;
      const radius = index % 2 ? .22 : .46;
      return `${index ? 'L' : 'M'} ${w / 2 + Math.cos(angle) * w * radius} ${h / 2 + Math.sin(angle) * h * radius}`;
    }).join(' ') + ' Z';
  }
  return '';
}
export function connector(item: Item, items: Item[]): { a: Point; b: Point; path: string } {
  const first = items.find(other => other.id === item.from);
  const last = items.find(other => other.id === item.to);
  const a = first ? { x: first.x + first.w / 2, y: first.y + first.h / 2 } : { x: item.x, y: item.y };
  const b = last ? { x: last.x + last.w / 2, y: last.y + last.h / 2 } : { x: item.x + item.w, y: item.y + item.h };
  return { a, b, path: `M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y}` };
}
export function textLines(text: string, width: number): string[] {
  const capacity = Math.max(5, Math.floor(width / 11));
  return text.split('\n').flatMap(line => {
    const words = line.split(/\s+/).flatMap(word => {
      if (word.length <= capacity) return [word];
      return Array.from({ length: Math.ceil(word.length / capacity) }, (_, index) => word.slice(index * capacity, (index + 1) * capacity));
    });
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (current && (current + ' ' + word).length > capacity) {
        lines.push(current);
        current = word;
      } else current += (current ? ' ' : '') + word;
    }
    return [...lines, current];
  });
}
export function bounds(items: Item[]): { x: number; y: number; w: number; h: number } {
  const visible = items.filter(item => item.kind !== 'connector');
  if (!visible.length) return { x: 0, y: 0, w: 600, h: 400 };
  // The circumscribed circle keeps rotated corners inside Fit and export.
  const boxes = visible.map(item => {
    const radius = Math.hypot(item.w, item.h) / 2;
    return { x: item.x + item.w / 2 - radius, y: item.y + item.h / 2 - radius, right: item.x + item.w / 2 + radius, bottom: item.y + item.h / 2 + radius };
  });
  const x = Math.min(...boxes.map(box => box.x)) - 30;
  const y = Math.min(...boxes.map(box => box.y)) - 30;
  return { x, y, w: Math.max(...boxes.map(box => box.right)) - x + 30, h: Math.max(...boxes.map(box => box.bottom)) - y + 30 };
}
function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char] ?? char));
}
export function boardSvg(items: Item[]): string {
  const box = bounds(items);
  const content = items.map(item => {
    const color = escapeXml(item.color);
    if (item.kind === 'connector') {
      return `<path d="${connector(item, items).path}" fill="none" stroke="${color}" stroke-width="3" opacity=".65"/>`;
    }
    let art = '';
    if (item.kind === 'stroke' || item.kind === 'marker') {
      art = `<path d="${smooth(item.points)}" fill="none" stroke="${color}" stroke-width="${item.thickness}"
        opacity="${item.kind === 'marker' ? .45 : 1}" stroke-linecap="round"/>`;
    } else if (item.kind === 'ellipse') {
      art = `<ellipse cx="${item.w / 2}" cy="${item.h / 2}" rx="${item.w / 2 - 5}" ry="${item.h / 2 - 5}" fill="${color}"/>`;
    } else if (['triangle', 'star', 'line', 'arrow'].includes(item.kind)) {
      art = `<path d="${shapePath(item)}" fill="${item.kind === 'line' || item.kind === 'arrow' ? 'none' : color}" stroke="${color}" stroke-width="4"/>`;
    } else if (item.kind !== 'text') {
      art = `<rect width="${item.w}" height="${item.h}" rx="${item.kind === 'sticky' ? 4 : 20}" fill="${color}"/>`;
    }
    const lines = textLines(item.text, item.w - 24);
    const ink = item.kind === 'text' ? color : '#26333b';
    art += `<text fill="${ink}" font-family="Arial,sans-serif" font-size="20" font-weight="600" text-anchor="middle">`;
    art += lines.map((line, index) => `<tspan x="${item.w / 2}" y="${item.h / 2 + (index - (lines.length - 1) / 2) * 25}">${escapeXml(line)}</tspan>`).join('');
    art += '</text>';
    return `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation} ${item.w / 2} ${item.h / 2})">${art}</g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(box.w)}" height="${Math.ceil(box.h)}"
    viewBox="${box.x} ${box.y} ${box.w} ${box.h}">
    <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#263039"/>
    ${content}</svg>`;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function readBoards(value: unknown): Board[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 50) return null;
  const result: Board[] = [];
  const kinds: string[] = [...shapes, 'sticky', 'text', 'stroke', 'marker', 'connector'];
  for (const board of value) {
    if (!record(board) || typeof board.id !== 'string' || typeof board.name !== 'string' || !Array.isArray(board.items)) return null;
    if (board.items.length > 3000 || board.name.length > 100) return null;
    const items: Item[] = [];
    for (const item of board.items) {
      if (!record(item) || typeof item.id !== 'string' || typeof item.kind !== 'string' || !kinds.includes(item.kind)) return null;
      if (!['x', 'y', 'w', 'h', 'rotation', 'thickness'].every(key => typeof item[key] === 'number' && Number.isFinite(item[key]))) return null;
      if (typeof item.w !== 'number' || typeof item.h !== 'number' || item.w <= 0 || item.h <= 0) return null;
      if (typeof item.text !== 'string' || typeof item.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(item.color)) return null;
      if (!Array.isArray(item.points) || item.points.length > 30000) return null;
      if (!item.points.every(point => record(point) && typeof point.x === 'number' && typeof point.y === 'number'
        && Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
      if ((item.from !== undefined && typeof item.from !== 'string') || (item.to !== undefined && typeof item.to !== 'string')) return null;
      items.push(clone(item) as Item);
    }
    if (new Set(items.map(item => item.id)).size !== items.length) return null;
    if (result.some(existing => existing.id === board.id)) return null;
    result.push({ id: board.id, name: board.name, items });
  }
  return result;
}
