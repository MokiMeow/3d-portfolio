export type Point = { x: number; y: number };
export type Tool = 'rake' | 'fine' | 'finger' | 'smooth' | 'stone' | 'plant';
type Stone = { u: number; v: number; size: number; kind: number; rotation: number };
type Plant = { u: number; v: number; kind: number };
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
function catmull(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const t2 = t * t, t3 = t2 * t;
  const axis = (p0: number, p1: number, p2: number, p3: number): number =>
    .5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  return { x: axis(a.x, b.x, c.x, d.x), y: axis(a.y, b.y, c.y, d.y) };
}
function surface(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable');
  return { canvas, ctx };
}
/** Static grain and object layers are cached. Pointer strokes only update the sand layer. */
export class SandTray {
  private readonly base = surface();
  private readonly sand = surface();
  private readonly objects = surface();
  private readonly brush = surface();
  private readonly ctx: CanvasRenderingContext2D;
  private stones: Stone[] = [];
  private plants: Plant[] = [];
  private points: Point[] = [];
  private tool: Tool = 'rake';
  private width = 1;
  private height = 1;
  private dpr = 1;
  private direction = { x: 1, y: 0 };
  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    this.ctx = ctx;
    this.brush.canvas.width = 128; this.brush.canvas.height = 128;
    const gradient = this.brush.ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    gradient.addColorStop(0, '#fff'); gradient.addColorStop(.5, 'rgba(255,255,255,.8)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
    this.brush.ctx.fillStyle = gradient; this.brush.ctx.fillRect(0, 0, 128, 128);
  }
  resize(width: number, height: number): void {
    const old = surface();
    old.canvas.width = this.sand.canvas.width; old.canvas.height = this.sand.canvas.height;
    old.ctx.drawImage(this.sand.canvas, 0, 0);
    const hadSand = this.width > 1;
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const item of [this.base, this.sand, this.objects, { canvas: this.canvas, ctx: this.ctx }]) {
      item.canvas.width = Math.round(this.width * this.dpr); item.canvas.height = Math.round(this.height * this.dpr);
      item.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    this.makeSand();
    this.sand.ctx.drawImage(this.base.canvas, 0, 0, this.width, this.height);
    if (hadSand) this.sand.ctx.drawImage(old.canvas, 0, 0, this.width, this.height);
    this.drawObjects(); this.render();
    old.canvas.width = 0; old.canvas.height = 0;
    this.points = [];
  }
  private makeSand(): void {
    const ctx = this.base.ctx;
    const light = ctx.createLinearGradient(0, 0, this.width, this.height);
    light.addColorStop(0, '#e4d7b9'); light.addColorStop(.55, '#d3c4a3'); light.addColorStop(1, '#c3b18d');
    ctx.fillStyle = light; ctx.fillRect(0, 0, this.width, this.height);
    // A tiny repeated tile gives fine grain without millions of per-frame pixels.
    const tile = surface(); tile.canvas.width = 128; tile.canvas.height = 128;
    const pixels = tile.ctx.createImageData(128, 128);
    let seed = 1427;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const value = (seed >>> 24);
      pixels.data[i] = value > 128 ? 255 : 60;
      pixels.data[i + 1] = value > 128 ? 249 : 49;
      pixels.data[i + 2] = value > 128 ? 224 : 30;
      pixels.data[i + 3] = 8 + value % 20;
    }
    tile.ctx.putImageData(pixels, 0, 0);
    const pattern = ctx.createPattern(tile.canvas, 'repeat');
    if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, this.width, this.height); }
    tile.canvas.width = 0; tile.canvas.height = 0;
  }
  render(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(this.sand.canvas, 0, 0, this.width, this.height);
    this.ctx.drawImage(this.objects.canvas, 0, 0, this.width, this.height);
  }
  start(point: Point, tool: Tool): void {
    this.tool = tool; this.points = [{ ...point }, { ...point }];
    this.direction = { x: 1, y: 0 };
    if (tool === 'smooth') { this.smooth(point); this.render(); }
  }
  move(point: Point, render = true): void {
    const last = this.points[this.points.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) < 1.2) return;
    this.points.push(point);
    if (this.tool === 'smooth') {
      const distance = Math.hypot(point.x - last.x, point.y - last.y);
      const count = Math.min(60, Math.max(1, Math.ceil(distance / 8)));
      for (let i = 1; i <= count; i++) this.smooth({ x: last.x + (point.x - last.x) * i / count, y: last.y + (point.y - last.y) * i / count });
      if (this.points.length > 4) this.points.shift();
    } else if (this.points.length >= 4) {
      this.stroke(this.points[0]!, this.points[1]!, this.points[2]!, this.points[3]!);
      this.points.shift();
    }
    if (render) this.render();
  }
  finish(): void {
    if (this.tool !== 'smooth' && this.points.length >= 3) {
      const p = this.points;
      this.stroke(p[0]!, p[1]!, p[2]!, p[3] ?? p[2]!);
    }
    this.points = []; this.render();
  }
  private avoid(point: Point): Point {
    let x = point.x, y = point.y;
    for (const stone of this.stones) {
      const sx = stone.u * this.width, sy = stone.v * this.height;
      const radius = stone.size * Math.min(this.width, this.height) * 1.15 + 6;
      const dx = x - sx, dy = y - sy, distance = Math.hypot(dx, dy);
      if (distance < radius) {
        const angle = distance > .1 ? Math.atan2(dy, dx) : Math.atan2(this.direction.y, this.direction.x) + Math.PI / 2;
        x = sx + Math.cos(angle) * radius; y = sy + Math.sin(angle) * radius;
      }
    }
    return { x, y };
  }
  private stroke(a: Point, b: Point, c: Point, d: Point): void {
    const count = this.tool === 'fine' ? 9 : this.tool === 'finger' ? 1 : 5;
    const spacing = this.tool === 'fine' ? 4 : 7;
    const samples = clamp(Math.ceil(Math.hypot(c.x - b.x, c.y - b.y) / 2), 4, 100);
    const paths: Point[][] = Array.from({ length: count }, () => []);
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = catmull(a, b, c, d, t);
      const before = catmull(a, b, c, d, Math.max(0, t - .01));
      const after = catmull(a, b, c, d, Math.min(1, t + .01));
      const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
      if (length > .01) this.direction = { x: dx / length, y: dy / length };
      for (let tine = 0; tine < count; tine++) {
        const offset = (tine - (count - 1) / 2) * spacing;
        paths[tine]!.push(this.avoid({ x: point.x - this.direction.y * offset, y: point.y + this.direction.x * offset }));
      }
    }
    for (const line of paths) this.groove(line, this.tool === 'finger' ? 7 : this.tool === 'fine' ? 1.2 : 2);
  }
  private groove(points: Point[], width = 2): void {
    const ctx = this.sand.ctx;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const layer of [{ offset: .8, color: 'rgba(80,62,34,.28)', width }, { offset: -.8, color: 'rgba(255,248,214,.64)', width: Math.max(.8, width * .65) }]) {
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x + layer.offset, point.y + layer.offset);
        else ctx.lineTo(point.x + layer.offset, point.y + layer.offset);
      });
      ctx.strokeStyle = layer.color; ctx.lineWidth = layer.width;
      if (width > 4) { ctx.shadowColor = layer.color; ctx.shadowBlur = 3; }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }
  private smooth(point: Point): void {
    const ctx = this.sand.ctx;
    const size = 76;
    ctx.save();
    ctx.beginPath(); ctx.rect(point.x - size / 2, point.y - size / 2, size, size); ctx.clip();
    // Erase accumulated grooves through a feathered mask, then replace with the cached grain.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(this.brush.canvas, point.x - size / 2, point.y - size / 2, size, size);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(this.base.canvas, 0, 0, this.width, this.height);
    ctx.restore();
  }
  placeStone(point: Point, kind: number): boolean {
    if (this.stones.length >= 24) return false;
    this.stones.push({ u: clamp(point.x / this.width, .06, .94), v: clamp(point.y / this.height, .07, .93), size: .035 + (kind % 3) * .008, kind, rotation: Math.random() * Math.PI });
    this.drawObjects(); this.render(); return true;
  }
  placePlant(point: Point, kind: number): boolean {
    if (this.plants.length >= 18) return false;
    this.plants.push({ u: clamp(point.x / this.width, .08, .92), v: clamp(point.y / this.height, .1, .9), kind });
    this.drawObjects(); this.render(); return true;
  }
  ripple(): void {
    for (const stone of this.stones) {
      const x = stone.u * this.width, y = stone.v * this.height;
      const radius = stone.size * Math.min(this.width, this.height) * 1.18;
      for (let ring = 0; ring < 6; ring++) {
        const points: Point[] = [];
        const r = radius + 8 + ring * 7;
        for (let i = 0; i <= 120; i++) {
          const angle = i / 120 * Math.PI * 2;
          const point = { x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r };
          if (!this.stones.some(other => other !== stone && Math.hypot(point.x - other.u * this.width, point.y - other.v * this.height) < other.size * Math.min(this.width, this.height) * 1.2)) {
            points.push(point);
          } else if (points.length) { this.groove(points, 1.7); points.length = 0; }
        }
        if (points.length) this.groove(points, 1.7);
      }
    }
    this.render();
  }
  private drawObjects(): void {
    const ctx = this.objects.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const stone of this.stones) this.drawStone(stone);
    for (const plant of this.plants) this.drawPlant(plant);
  }
  private stonePath(kind: number, r: number): Path2D {
    const shapes = [
      [1, .85, .93, 1.05, .86, 1, .82, .96],
      [.92, 1.15, .84, .85, .92, 1.16, .96, .8],
      [1.12, .85, .72, .95, 1.1, .96, .9, .85],
      [.9, 1.02, 1.12, .9, .78, .88, 1.15, .85],
      [.82, 1.15, .98, .74, .84, 1.1, 1.02, .91],
      [1.05, .9, 1.08, .83, .96, .86, 1.12, .9],
    ];
    const shape = shapes[kind % 6]!;
    const vertices = shape.map((value, i) => ({ x: Math.cos(i * Math.PI / 4) * r * value, y: Math.sin(i * Math.PI / 4) * r * value * .8 }));
    const path = new Path2D();
    const first = vertices[0]!, last = vertices[7]!;
    path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    vertices.forEach((v, i) => { const next = vertices[(i + 1) % 8]!; path.quadraticCurveTo(v.x, v.y, (v.x + next.x) / 2, (v.y + next.y) / 2); });
    path.closePath(); return path;
  }
  private drawStone(stone: Stone): void {
    const ctx = this.objects.ctx, r = stone.size * Math.min(this.width, this.height);
    ctx.save(); ctx.translate(stone.u * this.width, stone.v * this.height); ctx.rotate(stone.rotation);
    const shape = this.stonePath(stone.kind, r);
    const palettes = [['#a9afaa', '#636966', '#353d3b'], ['#b9b2a6', '#81786d', '#4b4741'], ['#80958e', '#4d655f', '#293c38'], ['#b4b2bd', '#767382', '#423d4b'], ['#d1b7a0', '#957969', '#584b43'], ['#8a929a', '#58646f', '#303a45']];
    const colors = palettes[stone.kind % 6]!;
    const gradient = ctx.createLinearGradient(-r, -r, r, r);
    gradient.addColorStop(0, colors[0]!); gradient.addColorStop(.5, colors[1]!); gradient.addColorStop(1, colors[2]!);
    ctx.shadowColor = 'rgba(49,36,18,.35)'; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 7; ctx.shadowBlur = 10;
    ctx.fillStyle = gradient; ctx.fill(shape); ctx.shadowColor = 'transparent';
    ctx.clip(shape); ctx.lineWidth = .8;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath(); ctx.moveTo(-r, -r * .7 + i * r * .22);
      ctx.bezierCurveTo(-r * .2, -r * .4 + i * r * .18, r * .25, -r * .9 + i * r * .18, r, -r * .6 + i * r * .23);
      ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,.065)' : 'rgba(20,30,30,.08)'; ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(-r * .24, -r * .27, r * .4, r * .19, -.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fill(); ctx.restore();
  }
  private drawPlant(plant: Plant): void {
    const ctx = this.objects.ctx;
    const size = Math.min(this.width, this.height) * .05;
    ctx.save(); ctx.translate(plant.u * this.width, plant.v * this.height);
    ctx.shadowColor = 'rgba(46,50,22,.25)'; ctx.shadowBlur = 9; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 5;
    const moss = (x: number, y: number, radius: number): void => {
      const gradient = ctx.createRadialGradient(x - radius * .3, y - radius * .35, 1, x, y, radius);
      gradient.addColorStop(0, '#819b57'); gradient.addColorStop(.65, '#526c38'); gradient.addColorStop(1, '#31482b');
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * .7, .2, 0, Math.PI * 2); ctx.fillStyle = gradient; ctx.fill();
    };
    moss(0, size * .4, size * .9);
    if (plant.kind === 1) {
      ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#64513a'; ctx.lineCap = 'round'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, size * .5); ctx.bezierCurveTo(size * .3, 0, -size * .3, -size * .6, size * .2, -size); ctx.stroke();
      ctx.lineWidth = 2;
      for (const branch of [[-.7, -.6], [.7, -.9], [-.25, -1.4]]) {
        ctx.beginPath(); ctx.moveTo(0, -size * .35); ctx.lineTo(branch[0]! * size, branch[1]! * size); ctx.stroke();
        moss(branch[0]! * size, branch[1]! * size, size * .65);
      }
    } else {
      ctx.shadowColor = 'transparent';
      for (let i = 0; i < 20; i++) {
        const angle = i * 2.4, radius = Math.sqrt(i / 20) * size * .65;
        ctx.fillStyle = i % 2 ? '#94a960' : '#657f42';
        ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * .7 + size * .4, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  clearObjects(): void { this.stones = []; this.plants = []; this.drawObjects(); }
  settle(alpha: number): void {
    this.sand.ctx.globalAlpha = alpha;
    this.sand.ctx.drawImage(this.base.canvas, 0, 0, this.width, this.height);
    this.sand.ctx.globalAlpha = 1;
    this.render();
  }
  reset(): void { this.points = []; this.clearObjects(); this.settle(1); }
  random(): void {
    this.reset();
    // Parallel lines, then an asymmetric arrangement near the thirds.
    for (let y = 20; y < this.height; y += 9) {
      const line: Point[] = [];
      for (let x = 0; x <= this.width; x += 12) line.push({ x, y: y + Math.sin(x / 110) * 5 });
      this.groove(line, 1.5);
    }
    const offset = (): number => (Math.random() - .5) * .11;
    const spots = [[.32, .33], [.66, .63], [.73, .3], [.24, .68], [.53, .47]];
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const spot = spots[i]!;
      this.placeStone({ x: (spot[0]! + offset()) * this.width, y: (spot[1]! + offset()) * this.height }, Math.floor(Math.random() * 6));
    }
    // Calm halos replace parallel grooves before the concentric rings are cut.
    for (const stone of this.stones) {
      const ctx = this.sand.ctx, r = stone.size * Math.min(this.width, this.height) + 53;
      ctx.save(); ctx.beginPath(); ctx.arc(stone.u * this.width, stone.v * this.height, r, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(this.base.canvas, 0, 0, this.width, this.height); ctx.restore();
    }
    this.ripple();
    this.placePlant({ x: .42 * this.width, y: .75 * this.height }, Math.random() > .5 ? 1 : 0);
    this.render();
  }
  destroy(): void {
    for (const item of [this.base, this.sand, this.objects, this.brush]) { item.canvas.width = 0; item.canvas.height = 0; }
    this.points = []; this.stones = []; this.plants = [];
    this.canvas.width = 0; this.canvas.height = 0;
  }
}
