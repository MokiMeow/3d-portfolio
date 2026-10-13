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
export const ATELIER_STUDIES = ["Orbit", "Rhythm", "Field"] as const;

export function drawAtelierArt(
  canvas: HTMLCanvasElement,
  study: number,
  palette: number,
  wireframe: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const p = ATELIER_PALETTES[palette % ATELIER_PALETTES.length];
  const w = canvas.width,
    h = canvas.height;
  ctx.resetTransform();
  ctx.clearRect(0, 0, w, h);
  ctx.scale(w / 1000, h / 700);
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, 1000, 700);
  ctx.strokeStyle = p.ink + "12";
  ctx.lineWidth = 0.6;
  for (let x = 40; x < 1000; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 700);
    ctx.stroke();
  }
  for (let y = 40; y < 700; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1000, y);
    ctx.stroke();
  }
  const finish = (color: string) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    wireframe ? ctx.stroke() : ctx.fill();
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(38, 78, 924, 523);
  ctx.clip();
  if (study === 0) {
    ctx.beginPath();
    ctx.arc(600, 324, 216, 0, Math.PI * 2);
    finish(p.accent);
    ctx.beginPath();
    ctx.ellipse(469, 367, 291, 104, -0.42, 0, Math.PI * 2);
    finish(p.ink);
    ctx.beginPath();
    ctx.arc(583, 312, 123, 0, Math.PI * 2);
    finish(p.paper);
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.5;
    for (const r of [235, 250, 266]) {
      ctx.beginPath();
      ctx.ellipse(523, 333, r * 1.34, r * 0.44, -0.42, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(268, 466, 29, 0, Math.PI * 2);
    finish(p.secondary);
    ctx.beginPath();
    ctx.arc(813, 170, 10, 0, Math.PI * 2);
    finish(p.ink);
  } else if (study === 1) {
    for (let i = 0; i < 11; i++) {
      ctx.save();
      ctx.translate(188 + i * 57, 302);
      ctx.rotate(-0.45 + i * 0.044);
      ctx.beginPath();
      ctx.roundRect(-26, -148, 50, 335, 25);
      finish(i % 3 === 0 ? p.accent : i % 3 === 1 ? p.ink : p.secondary);
      ctx.restore();
    }
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(90, 495);
    ctx.bezierCurveTo(360, 620, 560, 85, 910, 186);
    ctx.stroke();
  } else {
    const cells = [
      [0, 0, 2, 2],
      [2, 0, 1, 1],
      [3, 0, 2, 1],
      [2, 1, 2, 1],
      [4, 1, 1, 2],
      [0, 2, 1, 2],
      [1, 2, 2, 1],
      [3, 2, 1, 2],
      [1, 3, 2, 1],
    ];
    cells.forEach(([x, y, cw, ch], i) => {
      ctx.beginPath();
      ctx.rect(197 + x * 124, 91 + y * 124, cw * 124 - 10, ch * 124 - 10);
      finish([p.ink, p.accent, p.secondary][i % 3]);
    });
    ctx.beginPath();
    ctx.arc(321, 215, 75, 0, Math.PI * 2);
    finish(p.paper);
    ctx.beginPath();
    ctx.arc(694, 401, 40, 0, Math.PI * 2);
    finish(p.paper);
  }
  ctx.restore();
  ctx.fillStyle = p.ink;
  ctx.font = "500 13px 'Cascadia Code', Consolas, monospace";
  ctx.fillText("MOHITH / FORM STUDIES", 42, 40);
  ctx.textAlign = "right";
  ctx.fillText(
    `0${study + 1} — ${wireframe ? "CONSTRUCTION" : "COMPOSITION"}`,
    958,
    40,
  );
  ctx.textAlign = "left";
  ctx.font = "42px Georgia, serif";
  ctx.fillText(ATELIER_STUDIES[study % 3], 42, 654);
  ctx.font = "12px 'Cascadia Code', Consolas, monospace";
  ctx.textAlign = "right";
  ctx.fillText("A LITTLE STRUCTURE. ROOM TO PLAY.", 958, 650);
  ctx.textAlign = "left";
  ctx.strokeStyle = p.ink + "60";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(42, 613);
  ctx.lineTo(958, 613);
  ctx.stroke();
}
