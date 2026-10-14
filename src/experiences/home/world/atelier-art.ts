/** Original printable compositions, shared by the wall, light table and press. */
export const ATELIER_PALETTES = [
  {
    name: "Clay & ink",
    paper: "#ede6d7",
    ink: "#292c28",
    accent: "#b96345",
    secondary: "#b6b696",
  },
  {
    name: "Moss & cream",
    paper: "#e7e8da",
    ink: "#253d39",
    accent: "#788e65",
    secondary: "#c9ab6f",
  },
  {
    name: "Blue hour",
    paper: "#dfe5e7",
    ink: "#293541",
    accent: "#677f9b",
    secondary: "#c09b7c",
  },
] as const;

export const ATELIER_STUDIES = [
  "Orbit", "Rhythm", "Field", "Tide", "Contour", "Bloom",
  "Transit", "Workroom", "Constellation", "Golden", "Horizon", "Loop",
] as const;

type Palette = (typeof ATELIER_PALETTES)[number];
type Point = readonly [number, number];
type Path = (ctx: CanvasRenderingContext2D) => void;
interface Drawing {
  ctx: CanvasRenderingContext2D;
  palette: Palette;
  construction: boolean;
}
type Study = (drawing: Drawing) => void;

const TAU = Math.PI * 2;
const MONO = "'Cascadia Code', Consolas, monospace";
const CAPTIONS = [
  "A LITTLE STRUCTURE. ROOM TO PLAY.",
  "REPETITION, WITH ROOM FOR A CHANGE.",
  "SMALL PARTS. A PLACE FOR EACH.",
  "EVERY RETURN IS A LITTLE DIFFERENT.",
  "THE LONG WAY UP IS STILL THE WAY UP.",
  "GROWTH DOES NOT FOLLOW A GRID.",
  "A GOOD IDEA TAKES A FEW CONNECTIONS.",
  "A ROOM TO MAKE ROOM FOR IDEAS.",
  "FOLLOW THE FOLD. FIND YOUR OWN SKY.",
  "PROPORTION IS A QUIET KIND OF ORDER.",
  "DISTANCE LEAVES ROOM TO BREATHE.",
  "SOME LOOPS ARE WORTH GETTING LOST IN.",
] as const;

// Tiles stay small and bounded: one tooth tile per palette and three dot densities per color.
const tiles = new Map<string, HTMLCanvasElement>();

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pattern(ctx: CanvasRenderingContext2D, color: string, density: number): CanvasPattern | null {
  const key = color + ":" + density;
  try {
    let tile = tiles.get(key);
    if (!tile) {
      const document = ctx.canvas.ownerDocument;
      if (!document) return null;
      tile = document.createElement("canvas");
      tile.width = density < 0 ? 96 : 24;
      tile.height = tile.width;
      const ink = tile.getContext("2d");
      if (!ink) return null;
      ink.fillStyle = color;
      if (density < 0) {
        const random = seededRandom(8107);
        for (let i = 0; i < 380; i++) {
          const size = 0.3 + random() * 0.65;
          ink.fillRect(random() * 96, random() * 96, size, size * 0.65);
        }
      } else {
        const radius = [0.7, 1.25, 1.85][density] ?? 1.25;
        ink.beginPath();
        for (let y = 3; y < 24; y += 6) {
          for (let x = 3; x < 24; x += 6) {
            ink.moveTo(x + radius, y);
            ink.arc(x, y, radius, 0, TAU);
          }
        }
        ink.fill();
      }
      tiles.set(key, tile);
    }
    return ctx.createPattern(tile, "repeat");
  } catch {
    return null;
  }
}

function line(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string, width = 1): void {
  const first = points[0];
  if (!first) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(first[0], first[1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.stroke();
}

function polygon(points: readonly Point[]): Path {
  return ctx => {
    const first = points[0];
    if (!first) return;
    ctx.moveTo(first[0], first[1]);
    for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
    ctx.closePath();
  };
}

function circle(x: number, y: number, radius: number): Path {
  return ctx => ctx.arc(x, y, radius, 0, TAU);
}

function rectangle(x: number, y: number, width: number, height: number): Path {
  return ctx => ctx.rect(x, y, width, height);
}

function form(d: Drawing, color: string, path: Path, tone = -1, offset: Point = [0, 0]): void {
  const { ctx, construction } = d;
  ctx.save();
  ctx.translate(offset[0], offset[1]);
  ctx.beginPath();
  path(ctx);
  ctx.strokeStyle = construction && color === d.palette.paper ? d.palette.ink : color;
  ctx.lineWidth = 1.25;
  if (construction) {
    ctx.globalAlpha = 0.68;
    ctx.stroke();
  } else {
    // Paper cutouts must erase a plate; all actual inks overprint each other.
    ctx.globalCompositeOperation = color === d.palette.paper ? "source-over" : "multiply";
    ctx.fillStyle = tone < 0 ? color : pattern(ctx, color, tone) ?? color;
    ctx.fill();
  }
  ctx.restore();
}

function outline(d: Drawing, path: Path, color: string = d.palette.ink, width = 1): void {
  d.ctx.save();
  d.ctx.globalCompositeOperation = color === d.palette.paper ? "source-over" : "multiply";
  d.ctx.beginPath();
  path(d.ctx);
  d.ctx.strokeStyle = color;
  d.ctx.lineWidth = width;
  d.ctx.stroke();
  d.ctx.restore();
}

function label(
  d: Drawing, text: string, x: number, y: number, size = 10,
  align: CanvasTextAlign = "left", color: string = d.palette.ink,
): void {
  const { ctx, palette } = d;
  ctx.save();
  ctx.font = size + "px " + MONO;
  ctx.textAlign = align;
  ctx.globalCompositeOperation = color === palette.paper ? "source-over" : "multiply";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function cross(d: Drawing, x: number, y: number, size = 5): void {
  const ink = d.palette.ink + "80";
  line(d.ctx, [[x - size, y], [x + size, y]], ink, 0.7);
  line(d.ctx, [[x, y - size], [x, y + size]], ink, 0.7);
}

function dimension(d: Drawing, from: Point, to: Point, text: string): void {
  const { ctx, palette } = d;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const nx = -dy / length * 4;
  const ny = dx / length * 4;
  const color = palette.ink + "90";
  line(ctx, [from, to], color, 0.65);
  for (const point of [from, to]) {
    line(ctx, [[point[0] - nx - 2, point[1] - ny - 2], [point[0] + nx + 2, point[1] + ny + 2]], color, 0.8);
  }
  label(d, text, (from[0] + to[0]) / 2 + 5, (from[1] + to[1]) / 2 - 7, 9, "center");
}

function angle(d: Drawing, x: number, y: number, radius: number, start: number, end: number, text: string): void {
  outline(d, ctx => ctx.arc(x, y, radius, start, end), d.palette.ink + "80", 0.7);
  for (const a of [start, end]) {
    line(d.ctx, [[x, y], [x + Math.cos(a) * (radius + 12), y + Math.sin(a) * (radius + 12)]], d.palette.ink + "60", 0.6);
  }
  const middle = (start + end) / 2;
  label(d, text, x + Math.cos(middle) * (radius + 18), y + Math.sin(middle) * (radius + 18), 9);
}

function grid(d: Drawing, x: number, y: number, width: number, height: number, step: number): void {
  const { ctx, palette } = d;
  ctx.save();
  ctx.setLineDash([2, 5]);
  for (let px = x; px <= x + width; px += step) line(ctx, [[px, y], [px, y + height]], palette.ink + "24", 0.6);
  for (let py = y; py <= y + height; py += step) line(ctx, [[x, py], [x + width, py]], palette.ink + "24", 0.6);
  ctx.restore();
}

function radialConstruction(d: Drawing, x: number, y: number, radius: number): void {
  cross(d, x, y, 9);
  d.ctx.save();
  d.ctx.setLineDash([5, 4]);
  line(d.ctx, [[x - radius - 16, y], [x + radius + 16, y]], d.palette.ink + "60", 0.65);
  line(d.ctx, [[x, y - radius - 16], [x, y + radius + 16]], d.palette.ink + "60", 0.65);
  d.ctx.restore();
  dimension(d, [x, y], [x + radius * 0.7071, y - radius * 0.7071], "R " + Math.round(radius));
  dimension(d, [x - radius, y + radius + 12], [x + radius, y + radius + 12], "Ø " + Math.round(radius * 2));
}

function orbit(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  form(d, p.accent, circle(600, 324, 216), -1, [1.4, -0.8]);
  form(d, p.ink, c => c.ellipse(469, 367, 291, 104, -0.42, 0, TAU));
  form(d, p.paper, circle(583, 312, 123));
  for (const radius of [235, 250, 266]) {
    outline(d, c => c.ellipse(523, 333, radius * 1.34, radius * 0.44, -0.42, 0, TAU), p.ink, 1.1);
  }
  form(d, p.secondary, circle(268, 466, 29));
  form(d, p.ink, circle(813, 170, 10));
  if (!construction) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(600, 324, 216, 0, TAU);
    ctx.clip();
    form(d, p.ink, rectangle(660, 160, 160, 370), 0);
    ctx.restore();
  } else {
    radialConstruction(d, 600, 324, 216);
    radialConstruction(d, 583, 312, 123);
    line(ctx, [[202, 476], [846, 189]], p.ink + "70", 0.8);
    angle(d, 469, 367, 55, -0.42, 0, "24°");
    label(d, "ELLIPSE / a 291 : b 104", 105, 143);
    cross(d, 268, 466);
  }
}

function rhythm(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  const colors = [p.accent, p.ink, p.secondary];
  if (construction) grid(d, 160, 120, 650, 430, 57);
  for (let i = 0; i < 11; i++) {
    ctx.save();
    ctx.translate(188 + i * 57, 302);
    ctx.rotate(-0.45 + i * 0.044);
    form(d, colors[i % 3] ?? p.ink, c => c.roundRect(-26, -148, 50, 335, 25), i % 3 === 2 ? 2 : -1);
    if (construction) {
      line(ctx, [[-1, -160], [-1, 202]], p.ink + "60", 0.65);
      dimension(d, [-26, 204], [24, 204], "50");
      cross(d, -1, -123);
      cross(d, -1, 162);
    }
    ctx.restore();
  }
  outline(d, c => {
    c.moveTo(90, 495);
    c.bezierCurveTo(360, 620, 560, 85, 910, 186);
  }, p.ink, 1.2);
  if (construction) {
    dimension(d, [188, 555], [758, 555], "10 × 57 / PITCH");
    angle(d, 188, 302, 70, -0.45, 0, "25.8°");
    label(d, "Δθ 2.52° / EACH MODULE", 635, 110);
  }
}

function field(d: Drawing): void {
  const { palette: p, construction } = d;
  const cells: readonly (readonly [number, number, number, number])[] = [
    [0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 2, 1], [2, 1, 2, 1], [4, 1, 1, 2],
    [0, 2, 1, 2], [1, 2, 2, 1], [3, 2, 1, 2], [1, 3, 2, 1],
  ];
  const colors = [p.ink, p.accent, p.secondary];
  cells.forEach(([x, y, width, height], index) => {
    form(d, colors[index % 3] ?? p.ink, rectangle(197 + x * 124, 91 + y * 124, width * 124 - 10, height * 124 - 10));
  });
  form(d, p.paper, circle(321, 215, 75));
  form(d, p.paper, circle(694, 401, 40));
  if (construction) {
    grid(d, 197, 91, 620, 496, 124);
    dimension(d, [197, 575], [817, 575], "5 × 124");
    dimension(d, [161, 91], [161, 587], "4 × 124");
    radialConstruction(d, 321, 215, 75);
    radialConstruction(d, 694, 401, 40);
    label(d, "GUTTER 10 / MODULE 124", 825, 270, 9);
  } else {
    form(d, p.secondary, rectangle(445, 91, 114, 114), 1, [1.5, 1]);
    label(d, "01 / 09", 209, 571, 9);
  }
}

function tide(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  form(d, p.secondary, circle(715, 214, 91));
  const colors = [p.secondary, p.accent, p.secondary, p.ink, p.accent];
  for (let i = 0; i < 5; i++) {
    const y = 256 + i * 49;
    const crest = i % 2 === 0 ? -92 : 65;
    form(d, colors[i] ?? p.ink, c => {
      c.moveTo(110, y);
      c.bezierCurveTo(290, y + crest, 390, y - crest, 540, y - 12);
      c.bezierCurveTo(700, y + crest, 820, y - crest, 900, y - 39);
      c.lineTo(900, y + 31);
      c.bezierCurveTo(800, y + 10 - crest, 700, y + crest + 65, 540, y + 42);
      c.bezierCurveTo(380, y + 65 - crest, 280, y + crest + 55, 110, y + 68);
      c.closePath();
    }, i === 2 ? 1 : -1, i === 1 ? [1.4, -0.7] : [0, 0]);
    outline(d, c => {
      c.moveTo(110, y + 10);
      c.bezierCurveTo(290, y + crest + 10, 390, y - crest + 10, 540, y - 2);
      c.bezierCurveTo(700, y + crest + 10, 820, y - crest + 10, 900, y - 29);
    }, construction ? p.ink + "60" : p.paper, 0.8);
    if (construction) {
      ctx.save();
      ctx.setLineDash([3, 5]);
      line(ctx, [[110, y], [290, y + crest], [390, y - crest], [540, y - 12]], p.ink + "60", 0.65);
      ctx.restore();
      for (const point of [[290, y + crest], [390, y - crest], [540, y - 12]] as const) cross(d, point[0], point[1]);
    }
  }
  if (construction) {
    radialConstruction(d, 715, 214, 91);
    dimension(d, [110, 562], [900, 562], "WAVELENGTH / 790");
    label(d, "CUBIC HANDLES / PHASE +49", 115, 134);
  } else {
    label(d, "HIGH WATER", 112, 550, 9);
    label(d, "↗ / ↘ / ↗", 897, 550, 9, "right");
  }
}

function contourPath(level: number): Path {
  return ctx => {
    const scale = 1 - level * 0.041;
    for (let step = 0; step <= 144; step++) {
      const a = step / 144 * TAU;
      const ripple = 1 + 0.11 * Math.sin(a * 3 + 0.4) + 0.06 * Math.cos(a * 5 - 0.7);
      const x = 523 + level * 1.6 + Math.cos(a) * 296 * scale * ripple;
      const y = 325 - level * 2.1 + Math.sin(a) * 207 * scale * ripple;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
}

function contour(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  if (!construction) form(d, p.secondary, contourPath(0), 0);
  for (let level = 0; level < 21; level++) {
    outline(d, contourPath(level), level % 5 === 0 ? p.ink : p.accent, level % 5 === 0 ? 1.7 : 0.8);
    if (level % 5 === 0) label(d, String(100 + level * 10), 530 + (1 - level * 0.041) * 294, 328 - level * 2.1, 9);
  }
  ctx.save();
  ctx.setLineDash([1, 7]);
  ctx.lineCap = "round";
  outline(d, c => {
    c.moveTo(262, 490);
    c.bezierCurveTo(288, 430, 461, 493, 491, 428);
    c.bezierCurveTo(541, 359, 351, 349, 420, 280);
    c.bezierCurveTo(500, 211, 669, 219, 616, 291);
    c.bezierCurveTo(594, 327, 550, 313, 557, 283);
  }, p.ink, 2.4);
  ctx.restore();
  form(d, p.accent, polygon([[558, 249], [580, 255], [558, 264]]));
  line(ctx, [[557, 248], [557, 283]], p.ink, 1.4);
  cross(d, 557, 283, 4);
  label(d, "+ 312", 580, 284);
  cross(d, 382, 421, 4);
  label(d, "+ 146", 396, 422, 9);
  label(d, "START", 224, 517, 9);
  form(d, p.paper, circle(262, 490, 4));
  outline(d, circle(262, 490, 4), p.ink, 1.3);
  line(ctx, [[864, 191], [864, 121]], p.ink, 1);
  form(d, p.ink, polygon([[864, 116], [855, 140], [864, 134], [873, 140]]));
  label(d, "N", 864, 105, 12, "center");
  for (let i = 0; i < 4; i++) {
    form(d, i % 2 === 0 ? p.ink : p.paper, rectangle(755 + i * 30, 533, 30, 7));
    outline(d, rectangle(755 + i * 30, 533, 30, 7), p.ink, 0.7);
  }
  label(d, "0", 754, 555, 9);
  label(d, "100 m", 875, 555, 9, "right");
  label(d, "IMAGINARY TERRAIN / Δh 10 m", 108, 116, 9);
  if (construction) {
    grid(d, 180, 112, 640, 448, 64);
    dimension(d, [225, 575], [821, 575], "EASTING / 596");
    cross(d, 523, 325, 10);
    line(ctx, [[523, 325], [557, 283]], p.ink + "60", 0.7);
    label(d, "NESTED ISOLINES / 21", 108, 142, 9);
  }
}

function leafPath(base: Point, tip: Point, breadth: number): Path {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length * breadth;
  const ny = dx / length * breadth;
  return ctx => {
    ctx.moveTo(base[0], base[1]);
    ctx.bezierCurveTo(base[0] + dx * 0.25 + nx, base[1] + dy * 0.25 + ny, tip[0] + nx * 0.7, tip[1] + ny * 0.7, tip[0], tip[1]);
    ctx.bezierCurveTo(tip[0] - nx * 0.55, tip[1] - ny * 0.55, base[0] + dx * 0.3 - nx, base[1] + dy * 0.3 - ny, base[0], base[1]);
    ctx.closePath();
  };
}


function leafConstruction(d: Drawing, base: Point, tip: Point, breadth: number): void {
  const dx = tip[0] - base[0];
  const dy = tip[1] - base[1];
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length * breadth;
  const ny = dx / length * breadth;
  const handles: readonly (readonly [Point, Point])[] = [
    [base, [base[0] + dx * 0.25 + nx, base[1] + dy * 0.25 + ny]],
    [tip, [tip[0] + nx * 0.7, tip[1] + ny * 0.7]],
    [tip, [tip[0] - nx * 0.55, tip[1] - ny * 0.55]],
    [base, [base[0] + dx * 0.3 - nx, base[1] + dy * 0.3 - ny]],
  ];
  d.ctx.save();
  d.ctx.setLineDash([2, 4]);
  for (const [anchor, handle] of handles) {
    line(d.ctx, [anchor, handle], d.palette.ink + "60", 0.6);
    outline(d, circle(handle[0], handle[1], 2), d.palette.ink + "80", 0.65);
  }
  d.ctx.restore();
}

function bloom(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  const leaves: readonly (readonly [Point, Point, number])[] = [
    [[442, 475], [276, 387], 38], [[443, 425], [595, 342], 40],
    [[446, 371], [310, 276], 33], [[454, 315], [578, 235], 31],
    [[467, 265], [367, 179], 26], [[480, 212], [555, 140], 22],
  ];
  outline(d, c => {
    c.moveTo(432, 550);
    c.bezierCurveTo(455, 451, 418, 330, 489, 178);
    c.bezierCurveTo(508, 135, 487, 120, 482, 113);
  }, p.ink, construction ? 1.2 : 3.1);
  leaves.forEach(([base, tip, breadth], index) => {
    form(d, index % 2 === 0 ? p.accent : p.secondary, leafPath(base, tip, breadth), -1, index === 3 ? [1.2, 0.8] : [0, 0]);
    line(ctx, [base, tip], p.ink, 0.9);
    const dx = tip[0] - base[0];
    const dy = tip[1] - base[1];
    for (let vein = 1; vein <= 5; vein++) {
      const t = vein / 7;
      const x = base[0] + dx * t;
      const y = base[1] + dy * t;
      const side = vein % 2 === 0 ? 1 : -1;
      line(ctx, [[x, y], [x + dx * 0.1 - dy / Math.hypot(dx, dy) * breadth * side * 0.55,
        y + dy * 0.1 + dx / Math.hypot(dx, dy) * breadth * side * 0.55]], p.ink + "90", 0.55);
    }
    if (construction) {
      leafConstruction(d, base, tip, breadth);
      cross(d, base[0], base[1]);
      cross(d, tip[0], tip[1]);
      dimension(d, base, tip, "L " + Math.round(Math.hypot(dx, dy)));
      outline(d, c => c.arc(base[0], base[1], 20, -Math.PI / 2, Math.atan2(dy, dx)), p.ink + "60", 0.6);
    }
  });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU - Math.PI / 2;
    form(d, p.secondary, leafPath([482, 128], [482 + Math.cos(a) * 24, 128 + Math.sin(a) * 24], 7));
  }
  form(d, p.accent, circle(482, 128, 7));
  line(ctx, [[432, 550], [416, 573]], p.ink, 1.4);
  line(ctx, [[432, 550], [448, 567]], p.ink, 1.4);
  label(d, "I. FORMA CRESCENS", 704, 198, 14);
  label(d, "An imaginary specimen", 704, 221, 10);
  label(d, "a. blade / b. vein / c. stem", 704, 242, 9);
  form(d, p.secondary, c => c.ellipse(776, 408, 57, 27, -0.2, 0, TAU), 1);
  outline(d, c => c.ellipse(776, 408, 57, 27, -0.2, 0, TAU), p.ink, 1.1);
  for (let i = -3; i <= 3; i++) {
    form(d, p.accent, circle(776 + i * 12, 408 - i * 2.5, 3));
  }
  line(ctx, [[720, 419], [832, 396]], p.ink, 0.7);
  label(d, "TRANSVERSE SECTION / ×4", 704, 461, 9);
  label(d, "PLATE VI / TWO LEAF INKS", 157, 555, 9);
  if (construction) {
    line(ctx, [[432, 104], [432, 576]], p.ink + "50", 0.7);
    dimension(d, [646, 113], [646, 550], "437 / GROWTH AXIS");
    dimension(d, [719, 489], [833, 489], "114");
    cross(d, 776, 408);
    radialConstruction(d, 482, 128, 24);
    label(d, "CURVE HANDLES / NOT A GRID", 148, 99, 9);
  }
}

function transit(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  const main: readonly Point[] = [[168, 452], [260, 360], [340, 360], [400, 300], [640, 300], [700, 360], [820, 360], [880, 300], [880, 169]];
  const branch: readonly Point[] = [[208, 170], [370, 170], [500, 300], [500, 480], [668, 480], [748, 400]];
  const loop: readonly Point[] = [[340, 360], [340, 240], [440, 140], [620, 140], [720, 240], [720, 360], [620, 460], [440, 460], [340, 360]];
  const routes: readonly (readonly [readonly Point[], string])[] = [[loop, p.secondary], [branch, p.ink], [main, p.accent]];
  for (const [points, color] of routes) {
    line(ctx, points, color, construction ? 1.4 : 9);
    if (construction) {
      for (const point of points) cross(d, point[0], point[1], 5);
    }
  }
  const stations: readonly (readonly [string, number, number, number, number, boolean])[] = [
    ["Idea", 168, 452, -12, 27, false], ["Sketch", 260, 360, -35, -19, false],
    ["Prototype", 340, 360, -40, 32, true], ["Coffee", 500, 300, 17, -17, true],
    ["Break", 640, 300, -10, -19, false], ["Fix", 700, 360, -21, 31, false],
    ["Polish", 820, 360, -10, 31, false], ["Ship", 880, 169, -48, 4, false],
    ["Read", 208, 170, -9, -20, false], ["Try again", 500, 480, -31, 30, false],
  ];
  for (const [name, x, y, dx, dy, interchange] of stations) {
    // Station knockout preserves readability at the line intersections.
    if (!construction) form(d, p.paper, circle(x, y, interchange ? 9 : 5));
    outline(d, circle(x, y, interchange ? 9 : 5), p.ink, interchange ? 2 : 1.2);
    if (interchange) outline(d, circle(x, y, 4), p.ink, 1);
    label(d, name, x + dx, y + dy, 12);
  }
  label(d, "REFACTOR ↻", 471, 121, 10);
  label(d, "MAKING SOMETHING / CONNECTION MAP", 111, 551, 9);
  for (const [index, text, color] of [[0, "Build", p.accent], [1, "Explore", p.ink], [2, "Refactor", p.secondary]] as const) {
    const x = 641 + index * 100;
    line(ctx, [[x, 543], [x + 22, 543]], color, 5);
    label(d, text, x + 29, 546, 9);
  }
  if (construction) {
    grid(d, 140, 100, 760, 440, 40);
    angle(d, 260, 360, 40, -Math.PI / 4, 0, "45°");
    dimension(d, [400, 267], [640, 267], "6 × 40");
    dimension(d, [916, 169], [916, 300], "131");
    label(d, "Ø 18 INTERCHANGE / Ø 10 STOP", 111, 574, 9);
  }
}

type SpacePoint = readonly [number, number, number];

// Equal-length axes at ±30° keep every piece of furniture in the same space.
function iso(x: number, depth: number, height: number): Point {
  return [466 + (x - depth) * 30 * Math.cos(Math.PI / 6), 315 + (x + depth) * 15 - height * 30];
}

function roomFace(d: Drawing, vertices: readonly SpacePoint[], color: string, tone = -1): void {
  const points = vertices.map(([x, depth, height]) => iso(x, depth, height));
  form(d, color, polygon(points), tone);
  outline(d, polygon(points), d.construction ? d.palette.ink + "80" : d.palette.ink, 0.85);
}

function roomBox(d: Drawing, x: number, depth: number, height: number, width: number, length: number, tall: number, color: string): void {
  roomFace(d, [[x, depth, height], [x, depth + length, height], [x, depth + length, height + tall], [x, depth, height + tall]], color, 1);
  roomFace(d, [[x, depth + length, height], [x + width, depth + length, height],
    [x + width, depth + length, height + tall], [x, depth + length, height + tall]], color, 2);
  roomFace(d, [[x, depth, height + tall], [x + width, depth, height + tall],
    [x + width, depth + length, height + tall], [x, depth + length, height + tall]], color);
}

function roomLine(d: Drawing, vertices: readonly SpacePoint[], width = 1): void {
  line(d.ctx, vertices.map(([x, depth, height]) => iso(x, depth, height)),
    d.construction ? d.palette.ink + "80" : d.palette.ink, width);
}

function workroom(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  roomFace(d, [[-4, -3, 0], [6.2, -3, 0], [6.2, 7.6, 0], [-4, 7.6, 0]], p.secondary, 0);
  roomFace(d, [[-4, -3, 0], [-4, 1.8, 0], [-4, 1.8, 3.5], [-4, -3, 3.5]], p.secondary, 0);
  roomFace(d, [[-4, -3, 0], [6.2, -3, 0], [6.2, -3, 3.5], [-4, -3, 3.5]], p.secondary, 0);
  for (let x = -3; x <= 6; x++) roomLine(d, [[x, -3, 0], [x, 7.6, 0]], 0.4);
  for (let z = -2; z <= 7; z++) roomLine(d, [[-4, z, 0], [6.2, z, 0]], 0.4);
  // The window sits between the original workstation and the newer atelier bay.
  roomFace(d, [[-1.8, -3, 1.5], [-0.15, -3, 1.5], [-0.15, -3, 3.35], [-1.8, -3, 3.35]], p.paper);
  for (let i = 1; i < 5; i++) roomLine(d, [[-1.8 + i * 0.33, -3, 1.5], [-1.8 + i * 0.33, -3, 3.35]], 0.7);
  roomLine(d, [[-1.8, -3, 2.9], [-0.15, -3, 2.9]], 0.7);
  // Back-to-front drawing preserves the cutaway's visible edges.
  roomBox(d, 1.9, -2.7, 0, 4.1, 0.85, 0.94, p.accent);
  for (let x = 2.1; x < 5.8; x += 0.9) roomLine(d, [[x, -1.85, 0.12], [x, -1.85, 0.82]], 0.7);
  const printCorners: readonly SpacePoint[] = [[2, -3, 1.7], [4.8, -3, 1.7], [4.8, -3, 3.3], [2, -3, 3.3]];
  roomFace(d, printCorners, p.paper);
  const printCenter = iso(3.4, -3, 2.5);
  form(d, p.accent, c => c.ellipse(printCenter[0], printCenter[1], 16, 23, -Math.PI / 6, 0, TAU));
  roomBox(d, -3.3, -2.6, 1.72, 3.9, 1.05, 0.13, p.accent);
  roomBox(d, -3.3, -1.55, 1.72, 0.9, 3, 0.13, p.accent);
  for (const [x, z] of [[-3.1, -2.4], [0.4, -2.4], [-3.1, 1.2]] as const) roomBox(d, x, z, 0, 0.12, 0.12, 1.72, p.ink);
  // One monitor faces along each arm of the L-shaped desk.
  roomBox(d, -1.55, -2.4, 2.1, 1.7, 0.12, 0.95, p.ink);
  roomFace(d, [[-1.46, -2.25, 2.19], [0.06, -2.25, 2.19], [0.06, -2.25, 2.95], [-1.46, -2.25, 2.95]], p.paper);
  roomLine(d, [[-0.7, -2.35, 1.85], [-0.7, -2.35, 2.1]], 2);
  roomBox(d, -3.1, -0.9, 2.1, 0.12, 1.7, 0.95, p.ink);
  roomFace(d, [[-2.94, -0.81, 2.19], [-2.94, 0.71, 2.19], [-2.94, 0.71, 2.95], [-2.94, -0.81, 2.95]], p.paper);
  roomLine(d, [[-3.0, -0.05, 1.85], [-3.0, -0.05, 2.1]], 2);
  roomBox(d, -2.2, -1.7, 1.85, 1.05, 0.72, 0.05, p.secondary);
  roomFace(d, [[-2.2, -1.7, 1.9], [-1.15, -1.7, 1.9], [-1.15, -1.86, 2.53], [-2.2, -1.86, 2.53]], p.ink);
  roomFace(d, [[-2.1, -1.72, 2.0], [-1.25, -1.72, 2.0], [-1.25, -1.84, 2.43], [-2.1, -1.84, 2.43]], p.paper);
  for (let row = 0; row < 3; row++) roomLine(d, [[-2.1, -1.5 + row * 0.13, 1.92], [-1.25, -1.5 + row * 0.13, 1.92]], 0.5);
  const chairBase = iso(-1.45, 0.45, 0.12);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const wheel = iso(-1.45 + Math.cos(a) * 0.55, 0.45 + Math.sin(a) * 0.55, 0.1);
    line(ctx, [chairBase, wheel], p.ink, 1.3);
    form(d, p.ink, circle(wheel[0], wheel[1], 2.5));
  }
  roomLine(d, [[-1.45, 0.45, 0.12], [-1.45, 0.45, 0.8]], 2.4);
  roomBox(d, -1.9, -0.05, 0.8, 0.95, 0.95, 0.15, p.ink);
  roomBox(d, -1.9, 0.83, 0.95, 0.95, 0.13, 0.95, p.ink);
  for (const x of [-1.97, -0.85]) roomLine(d, [[x, 0.2, 0.83], [x, 0.2, 1.25], [x, 0.6, 1.25]], 1.3);
  for (const [x, z] of [[2.05, 0.09], [3.89, 0.09], [2.05, 1.21], [3.89, 1.21]] as const) {
    roomLine(d, [[x, z, 0], [x, z, 1.72]], 1.9);
  }
  roomFace(d, [[1.8, -0.1, 1.95], [4.1, -0.1, 1.95], [4.1, 1.45, 1.58], [1.8, 1.45, 1.58]], p.accent);
  roomFace(d, [[2.18, 0.12, 1.91], [3.65, 0.12, 1.91], [3.65, 1.14, 1.66], [2.18, 1.14, 1.66]], p.paper);
  roomLine(d, [[2.18, 0.7, 1.78], [3.65, 0.7, 1.78]], 0.6);
  roomBox(d, 1.8, 5.2, 0.18, 0.85, 2.05, 0.8, p.accent);
  roomBox(d, 1.7, 5.28, 0.98, 1, 1.6, 0.11, p.ink);
  const platter = iso(2.18, 5.9, 1.1);
  for (const radius of [12, 9, 5]) outline(d, c => c.ellipse(platter[0], platter[1], radius, radius * 0.57735, 0, 0, TAU), p.paper, 0.6);
  roomLine(d, [[2.6, 5.43, 1.15], [2.57, 5.82, 1.15], [2.35, 6.04, 1.15]], 1.1);
  roomBox(d, 4.3, 3.8, 0.22, 1.55, 3, 0.27, p.accent);
  for (const z of [3.92, 5.32]) roomBox(d, 4.35, z, 0.49, 1.1, 1.28, 0.3, p.secondary);
  roomBox(d, 5.46, 3.92, 0.49, 0.28, 2.7, 0.87, p.secondary);
  for (const z of [3.78, 6.64]) roomBox(d, 4.3, z, 0.5, 1.55, 0.18, 0.53, p.secondary);
  const lamp = iso(5.61, 7.05, 0.06);
  form(d, p.ink, c => c.ellipse(lamp[0], lamp[1], 10, 5.8, 0, 0, TAU));
  roomLine(d, [[5.61, 7.05, 0.06], [5.61, 7.05, 2.6]], 1.8);
  const shade = iso(5.61, 7.05, 2.65);
  form(d, p.secondary, c => {
    c.moveTo(shade[0] - 8, shade[1] - 7);
    c.lineTo(shade[0] + 8, shade[1] - 7);
    c.lineTo(shade[0] + 16, shade[1] + 9);
    c.quadraticCurveTo(shade[0], shade[1] + 17, shade[0] - 16, shade[1] + 9);
    c.closePath();
  });
  outline(d, c => c.ellipse(shade[0], shade[1] - 7, 8, 4, 0, 0, TAU), p.ink, 0.8);
  roomBox(d, 0.3, 2.3, 0.18, 0.62, 0.55, 0.62, p.secondary);
  roomBox(d, 0.32, 2.33, 0.8, 0.58, 0.5, 0.39, p.accent);
  for (const x of [0.47, 0.75]) {
    const eye = iso(x, 2.85, 1.0);
    form(d, p.ink, circle(eye[0], eye[1], 1.6));
  }
  roomLine(d, [[0.6, 2.58, 1.19], [0.6, 2.58, 1.38]], 0.9);
  for (const x of [0.36, 0.8]) roomBox(d, x, 2.46, 0, 0.14, 0.23, 0.18, p.ink);
  label(d, "ROOM / CUTAWAY", 762, 202, 11);
  label(d, "01 WORKSTATION", 762, 232, 9);
  label(d, "02 DRAWING BENCH", 762, 251, 9);
  label(d, "03 LISTENING CORNER", 762, 270, 9);
  label(d, "04 SMALL ASSISTANT", 762, 289, 9);
  label(d, "LIGHT FROM UPPER LEFT", 762, 333, 9);
  if (construction) {
    const origin = iso(-4, 7.6, 0);
    line(ctx, [origin, [origin[0] + 82, origin[1] + 47.34]], p.accent, 1);
    line(ctx, [origin, [origin[0] - 82, origin[1] + 47.34]], p.secondary, 1);
    line(ctx, [origin, [origin[0], origin[1] - 87]], p.ink, 1);
    angle(d, origin[0], origin[1], 35, 0, Math.PI / 6, "30°");
    dimension(d, iso(-4, 8.4, 0), iso(6.2, 8.4, 0), "10.2 / X");
    dimension(d, iso(-4.6, -3, 0), iso(-4.6, 7.6, 0), "10.6 / Y");
    label(d, "TRUE ISOMETRIC / 1 : 1 : 1", 762, 373, 9);
  }
}

function constellation(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  const cx = 464;
  const cy = 331;
  const radius = 219;
  if (!construction) form(d, p.secondary, circle(cx, cy, radius), 0);
  for (const r of [55, 109, 164, 219]) outline(d, circle(cx, cy, r), p.ink + "55", 0.7);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU;
    line(ctx, [[cx + Math.cos(a) * radius, cy + Math.sin(a) * radius],
      [cx + Math.cos(a) * (radius + (i % 2 ? 5 : 10)), cy + Math.sin(a) * (radius + (i % 2 ? 5 : 10))]], p.ink, 0.75);
    if (i % 3 === 0) {
      line(ctx, [[cx, cy], [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]], p.ink + "35", 0.6);
      label(d, String(i).padStart(2, "0") + "h", cx + Math.cos(a) * 242, cy + Math.sin(a) * 242 + 3, 9, "center");
    }
  }
  const random = seededRandom(9031);
  for (let i = 0; i < 106; i++) {
    const a = random() * TAU;
    const r = Math.sqrt(random()) * 206;
    const magnitude = 0.65 + Math.pow(random(), 3) * 2;
    form(d, i % 7 === 0 ? p.accent : p.ink, circle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, magnitude));
  }
  const plane: readonly Point[] = [[309, 308], [601, 225], [501, 437], [459, 350], [309, 308], [473, 327], [601, 225], [459, 350]];
  if (!construction) {
    form(d, p.accent, polygon([[309, 308], [601, 225], [473, 327]]), 1, [1.3, -0.8]);
    form(d, p.secondary, polygon([[601, 225], [501, 437], [459, 350]]), 2);
  }
  line(ctx, plane, p.accent, 1.6);
  for (const [name, x, y, size] of [["Fold", 309, 308, 4], ["Voyage", 601, 225, 5], ["Return", 501, 437, 3.5], ["Crease", 459, 350, 3]] as const) {
    form(d, p.ink, circle(x, y, size));
    cross(d, x, y, size + 4);
    label(d, name, x + 11, y - 10, 9);
  }
  label(d, "THE PAPER PLANE", 755, 232, 14);
  label(d, "An imagined asterism", 755, 253, 10);
  label(d, "APPARENT MAGNITUDE", 755, 308, 9);
  for (const [i, size] of [[0, 4], [1, 2.5], [2, 1.2]] as const) {
    form(d, p.ink, circle(763 + i * 48, 333, size));
    label(d, String(i * 2 + 1), 763 + i * 48, 355, 9, "center");
  }
  line(ctx, [[755, 387], [786, 387]], p.accent, 1.6);
  label(d, "FOLD LINE", 798, 390, 9);
  label(d, "NORTH CELESTIAL POLE", 307, 577, 9);
  cross(d, cx, cy, 9);
  if (construction) {
    radialConstruction(d, cx, cy, radius);
    dimension(d, [309, 195], [601, 195], "292 / SPAN");
    ctx.save();
    ctx.setLineDash([3, 5]);
    line(ctx, [[309, 195], [309, 308]], p.ink + "60", 0.7);
    line(ctx, [[601, 195], [601, 225]], p.ink + "60", 0.7);
    ctx.restore();
    label(d, "POLAR GRID / ΔRA 1h", 755, 436, 9);
  }
}

interface GoldenSquare {
  x: number;
  y: number;
  side: number;
  cx: number;
  cy: number;
  start: number;
}

function goldenSquares(): GoldenSquare[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  let x = 153;
  let y = 124;
  let width = 680;
  let height = width / phi;
  const squares: GoldenSquare[] = [];
  for (let i = 0; i < 10; i++) {
    const side = Math.min(width, height);
    switch (i % 4) {
      case 0:
        squares.push({ x, y, side, cx: x + side, cy: y + side, start: Math.PI });
        x += side;
        width -= side;
        break;
      case 1:
        squares.push({ x, y, side, cx: x, cy: y + side, start: Math.PI * 1.5 });
        y += side;
        height -= side;
        break;
      case 2:
        squares.push({ x: x + width - side, y, side, cx: x + width - side, cy: y, start: 0 });
        width -= side;
        break;
      default:
        squares.push({ x, y: y + height - side, side, cx: x + side, cy: y + height - side, start: Math.PI / 2 });
        height -= side;
    }
  }
  return squares;
}

function golden(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  const squares = goldenSquares();
  const colors = [p.secondary, p.accent, p.secondary, p.ink];
  for (const [i, square] of squares.entries()) {
    const { x, y, side, cx, cy, start } = square;
    form(d, colors[i % 4] ?? p.ink, rectangle(x, y, side, side), i % 4 === 0 ? 1 : -1, i === 1 ? [1.4, 0.8] : [0, 0]);
    outline(d, rectangle(x, y, side, side), construction ? p.ink + "80" : p.ink, 0.7);
    outline(d, c => c.arc(cx, cy, side, start, start + Math.PI / 2), construction ? p.accent : p.paper, 2.4);
    if (side > 22) label(d, side.toFixed(1), x + 7, y + 16, side < 50 ? 7 : 9, "left", i % 4 === 3 ? p.paper : p.ink);
    if (construction && side > 16) {
      cross(d, cx, cy, 4);
      ctx.save();
      ctx.setLineDash([3, 4]);
      line(ctx, [[cx + Math.cos(start) * side, cy + Math.sin(start) * side], [cx, cy],
        [cx + Math.cos(start + Math.PI / 2) * side, cy + Math.sin(start + Math.PI / 2) * side]], p.ink + "70", 0.7);
      line(ctx, [[x, y], [x + side, y + side]], p.ink + "35", 0.6);
      ctx.restore();
    }
  }
  if (construction) {
    dimension(d, [153, 102], [833, 102], "680.000");
    dimension(d, [870, 124], [870, 124 + 680 / ((1 + Math.sqrt(5)) / 2)], "420.263");
    angle(d, 573.263, 544.263, 32, Math.PI, Math.PI * 1.5, "90°");
  }
  label(d, "φ = (1 + √5) / 2", 157, 580, 10);
  label(d, "1 : 1.618034 / TEN DIVISIONS", 833, 580, 9, "right");
}

function hillPath(level: number): Path {
  return ctx => {
    const y = 279 + level * 58;
    ctx.moveTo(108, y + 38);
    ctx.bezierCurveTo(215, y - 51 + level * 7, 300, y - 26, 405, y + 16);
    ctx.bezierCurveTo(516, y + 70, 590, y - 58, 712, y - 16);
    ctx.bezierCurveTo(814, y + 22, 851, y - 12, 902, y + 32);
    ctx.lineTo(902, 553);
    ctx.lineTo(108, 553);
    ctx.closePath();
  };
}

function horizon(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  form(d, p.secondary, circle(699, 213, 96));
  const hills: readonly (readonly [string, number])[] = [[p.secondary, 0], [p.secondary, 2], [p.accent, 1], [p.accent, -1], [p.ink, -1]];
  hills.forEach(([color, tone], i) => {
    // Each band gets a paper knockout so distance reads as a lighter ink density.
    if (!construction) form(d, p.paper, hillPath(i));
    form(d, color, hillPath(i), tone, i === 2 ? [1.2, -0.6] : [0, 0]);
  });
  if (!construction) {
    ctx.save();
    ctx.beginPath();
    hillPath(1)(ctx);
    ctx.clip();
    for (let i = 0; i < 3; i++) form(d, p.paper, rectangle(108, 393 + i * 11, 794, 11), 2 - i);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    hillPath(3)(ctx);
    ctx.clip();
    for (let i = 0; i < 3; i++) form(d, p.paper, rectangle(108, 506 + i * 8, 794, 8), 2 - i);
    ctx.restore();
  }
  for (const [x, y, scale] of [[349, 186, 1], [388, 170, 0.75], [416, 198, 0.6]] as const) {
    outline(d, c => {
      c.moveTo(x - 9 * scale, y + 3 * scale);
      c.quadraticCurveTo(x - 4 * scale, y - 5 * scale, x, y);
      c.quadraticCurveTo(x + 4 * scale, y - 5 * scale, x + 9 * scale, y + 3 * scale);
    }, p.ink, 1.7);
  }
  label(d, "NEAR / FAR", 109, 578, 9);
  label(d, "FIVE DISTANCES, ONE HORIZON", 903, 578, 9, "right");
  if (construction) {
    radialConstruction(d, 699, 213, 96);
    for (let i = 0; i < 5; i++) {
      const y = 279 + i * 58;
      ctx.save();
      ctx.setLineDash([4, 5]);
      line(ctx, [[108, y], [902, y]], p.ink + "45", 0.6);
      ctx.restore();
      label(d, "Z" + (5 - i), 80, y + 4, 9);
    }
    dimension(d, [930, 279], [930, 337], "58");
    label(d, "SCREEN TONES / 4 · 14 · 30%", 111, 120, 9);
  }
}

function loop(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  const right: readonly Point[] = [[500, 125], [730, 523.37], [638, 523.37], [454, 204.67]];
  const bottom: readonly Point[] = [[730, 523.37], [270, 523.37], [316, 443.7], [684, 443.7]];
  const left: readonly Point[] = [[270, 523.37], [500, 125], [546, 204.67], [362, 523.37]];
  if (!construction) form(d, p.ink, c => c.ellipse(521, 564, 179, 15, 0, 0, TAU), 0);
  for (const [points, color] of [[right, p.accent], [bottom, p.ink], [left, p.secondary]] as const) {
    if (!construction) form(d, p.paper, polygon(points));
    form(d, color, polygon(points));
  }
  // This local occlusion closes the cyclic ordering: A over C over B over A.
  ctx.save();
  ctx.beginPath();
  ctx.rect(400, 124, 200, 161);
  ctx.clip();
  if (!construction) form(d, p.paper, polygon(right));
  form(d, p.accent, polygon(right));
  ctx.restore();
  if (!construction) {
    outline(d, polygon([[500, 125], [730, 523.37], [270, 523.37]]), p.ink, 1);
    line(ctx, [[454, 204.67], [592, 443.7], [408, 443.7], [546, 204.67]], p.ink, 0.75);
    label(d, "A → B → C → A", 119, 175, 10);
    label(d, "LOCAL LOGIC", 119, 196, 9);
    label(d, "GLOBAL TROUBLE", 119, 212, 9);
  } else {
    grid(d, 224, 125, 552, 414, 46);
    line(ctx, [[500, 90], [500, 558]], p.ink + "70", 0.7);
    line(ctx, [[247, 523.37], [753, 523.37]], p.ink + "70", 0.7);
    dimension(d, [270, 548], [730, 548], "460 / OUTER EDGE");
    dimension(d, [770, 125], [770, 523.37], "398.37");
    dimension(d, [638, 498], [730, 498], "92");
    angle(d, 270, 523.37, 56, -Math.PI / 3, 0, "60°");
    for (const point of [[500, 125], [730, 523.37], [270, 523.37], [500, 284.34]] as const) cross(d, point[0], point[1], 6);
    label(d, "THREE FACES / CYCLIC OCCLUSION", 580, 106, 9);
  }
}

const DRAW_STUDIES: readonly Study[] = [
  orbit, rhythm, field, tide, contour, bloom, transit, workroom, constellation, golden, horizon, loop,
];

function paperTooth(d: Drawing): void {
  const { ctx, palette } = d;
  const grain = pattern(ctx, palette.ink, -1);
  if (!grain) return;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, 1000, 700);
  ctx.restore();
}

function printMarks(d: Drawing): void {
  const { ctx, palette: p, construction } = d;
  for (const [x, y, sx, sy] of [[32, 62, -1, -1], [968, 62, 1, -1], [32, 602, -1, 1], [968, 602, 1, 1]] as const) {
    line(ctx, [[x + sx * 5, y], [x + sx * 16, y]], p.ink + "90", 0.6);
    line(ctx, [[x, y + sy * 5], [x, y + sy * 16]], p.ink + "90", 0.6);
  }
  for (const x of [22, 978]) {
    for (const [i, color] of [p.ink, p.accent, p.secondary].entries()) {
      ctx.save();
      ctx.translate(i === 1 ? 1.25 : 0, i === 2 ? -1 : 0);
      outline(d, circle(x, 337, 5), color, 0.55);
      line(ctx, [[x - 9, 337], [x + 9, 337]], color, 0.55);
      line(ctx, [[x, 328], [x, 346]], color, 0.55);
      ctx.restore();
    }
  }
  for (const [i, color] of [p.ink, p.accent, p.secondary].entries()) {
    form({ ...d, construction: false }, color, rectangle(43 + i * 24, 670, 22, 5));
  }
  if (construction) {
    label(d, "PLATES / K A S", 128, 676, 8);
    label(d, "REGISTER ±1.5", 500, 59, 8, "center");
  }
}

function printLayout(d: Drawing, index: number): void {
  const { ctx, palette: p, construction } = d;
  ctx.globalCompositeOperation = "source-over";
  label(d, "MOHITH / FORM STUDIES", 42, 40, 13);
  // Preserve the original header separator; captions use ordinary punctuation.
  label(d, String(index + 1).padStart(2, "0") + " — " + (construction ? "CONSTRUCTION" : "COMPOSITION"), 958, 40, 13, "right");
  line(ctx, [[42, 613], [958, 613]], p.ink + "70", 0.85);
  ctx.save();
  ctx.fillStyle = p.ink;
  ctx.font = "42px Georgia, serif";
  ctx.textAlign = "left";
  ctx.fillText(ATELIER_STUDIES[index] ?? ATELIER_STUDIES[0], 42, 654);
  ctx.restore();
  label(d, CAPTIONS[index] ?? CAPTIONS[0], 958, 650, 11, "right");
  label(d, "RISO PRINT · 3 INKS · ED. 50", 958, 675, 9, "right");
  printMarks(d);
}

function wrappedIndex(value: number, length: number): number {
  return Number.isFinite(value) ? ((Math.trunc(value) % length) + length) % length : 0;
}

/** One deterministic, static print, scaled identically on all three room surfaces. */
export function drawAtelierArt(canvas: HTMLCanvasElement, study: number, palette: number, wireframe: boolean): void {
  if (canvas.width <= 0 || canvas.height <= 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const index = wrappedIndex(study, ATELIER_STUDIES.length);
  const colors = ATELIER_PALETTES[wrappedIndex(palette, ATELIER_PALETTES.length)] ?? ATELIER_PALETTES[0];
  const draw = DRAW_STUDIES[index] ?? orbit;
  const d: Drawing = { ctx, palette: colors, construction: wireframe };
  ctx.save();
  try {
    ctx.resetTransform();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setLineDash([]);
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.textBaseline = "alphabetic";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(canvas.width / 1000, canvas.height / 700);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, 1000, 700);
    ctx.save();
    try {
      ctx.beginPath();
      ctx.rect(38, 78, 924, 523);
      ctx.clip();
      ctx.globalCompositeOperation = "multiply";
      draw(d);
    } finally {
      ctx.restore();
    }
    paperTooth(d);
    printLayout(d, index);
  } finally {
    ctx.restore();
  }
}
