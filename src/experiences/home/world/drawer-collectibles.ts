import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Small keepsakes fitted below the drawer fronts, with no floating labels. */
export function addDrawerCollectibles(bottom: Group, middle: Group) {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<MeshStandardMaterial>(),
    textures: CanvasTexture[] = [];
  const material = (color: string, roughness = 0.6) => {
    const m = new MeshStandardMaterial({ color, roughness });
    materials.add(m);
    return m;
  };
  const add = (
    parent: Group,
    geometry: BufferGeometry,
    m: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ) => {
    geometries.add(geometry);
    const mesh = new Mesh(geometry, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const felt = material("#24332e"),
    straw = material("#c5a064"),
    red = material("#9b382b"),
    paper = material("#d1c5aa");
  // A fitted felt tray protects the seven little glass Dragon Balls.
  add(
    bottom,
    new RoundedBoxGeometry(0.59, 0.025, 0.83, 2, 0.018),
    felt,
    -2.26,
    0.565,
    0.83,
  );
  const positions = [
    [0, 0],
    [-0.16, -0.19],
    [0.16, -0.19],
    [-0.16, 0.19],
    [0.16, 0.19],
    [0, -0.36],
    [0, 0.36],
  ];
  const star = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
  ) => {
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const angle = -Math.PI / 2 + (j * Math.PI) / 5,
        r = j % 2 ? radius * 0.43 : radius;
      const px = x + Math.cos(angle) * r,
        py = y + Math.sin(angle) * r;
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  positions.forEach(([x, z], i) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#ffdb7d");
    gradient.addColorStop(0.55, "#e89b2e");
    gradient.addColorStop(1, "#a24d15");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#aa351d";
    for (let j = 0; j <= i; j++) {
      const angle = (j / (i + 1)) * Math.PI * 2;
      star(
        ctx,
        256 + (i ? Math.cos(angle) * 26 : 0),
        128 + (i ? Math.sin(angle) * 26 : 0),
        i < 3 ? 11 : 8,
      );
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    textures.push(texture);
    const m = material("#ffffff", 0.18);
    m.map = texture;
    m.metalness = 0.08;
    const ball = add(
      bottom,
      new SphereGeometry(0.078, 28, 18),
      m,
      -2.26 + x,
      0.653,
      0.83 + z,
    );
    ball.rotation.set(0, 0, Math.PI / 2);
  });
  // Straw hat: woven brim, domed crown, red band and tightly spaced braid rings.
  const hat = new Group();
  hat.position.set(-2.14, 1.083, 0.78);
  middle.add(hat);
  add(hat, new CylinderGeometry(0.205, 0.205, 0.014, 48), straw, 0, 0, 0);
  add(
    hat,
    new LatheGeometry(
      [
        [0.118, 0],
        [0.122, 0.025],
        [0.119, 0.07],
        [0.105, 0.105],
        [0.075, 0.129],
        [0.025, 0.139],
        [0, 0.14],
      ].map((p) => new Vector2(...(p as [number, number]))),
      40,
    ),
    straw,
    0,
    0.008,
    0,
  );
  add(
    hat,
    new CylinderGeometry(0.123, 0.124, 0.033, 48, 1, true),
    red,
    0,
    0.035,
    0,
  );
  const braid = material("#aa844d");
  for (let i = 0; i < 7; i++) {
    const ring = add(
      hat,
      new TorusGeometry(0.137 + i * 0.009, 0.0018, 5, 48),
      braid,
      0,
      0.008,
      0,
    );
    ring.rotation.x = Math.PI / 2;
  }
  const crownSeam = add(
    hat,
    new TorusGeometry(0.105, 0.0018, 5, 48),
    braid,
    0,
    0.112,
    0,
  );
  crownSeam.rotation.x = Math.PI / 2;
  // A pocket manga underneath it, with an illustrated nautical cover and visible page edges.
  const book = new Group();
  book.position.set(-2.43, 1.072, 1.16);
  book.rotation.y = -0.12;
  middle.add(book);
  add(book, new BoxGeometry(0.23, 0.027, 0.3), paper, 0, 0, 0);
  const cover = document.createElement("canvas");
  cover.width = 384;
  cover.height = 512;
  const c = cover.getContext("2d")!;
  c.fillStyle = "#e3cd9e";
  c.fillRect(0, 0, 384, 512);
  c.fillStyle = "#273b47";
  c.fillRect(0, 0, 32, 512);
  c.fillStyle = "#ae3629";
  c.font = "bold 43px Georgia";
  c.fillText("ONE PIECE", 45, 71);
  c.font = "17px monospace";
  c.fillStyle = "#273b47";
  c.fillText("ROMANCE DAWN", 48, 103);
  c.strokeStyle = "#355765";
  c.lineWidth = 3;
  for (let y = 285; y < 450; y += 23) {
    c.beginPath();
    for (let x = 40; x < 370; x += 3) {
      const py = y + Math.sin(x * 0.033 + y) * 8;
      x === 40 ? c.moveTo(x, py) : c.lineTo(x, py);
    }
    c.stroke();
  }
  c.fillStyle = "#efdeb5";
  c.beginPath();
  c.arc(209, 222, 60, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#25313a";
  for (const x of [188, 230]) {
    c.beginPath();
    c.arc(x, 220, 13, 0, Math.PI * 2);
    c.fill();
  }
  c.fillRect(186, 257, 49, 5);
  c.fillStyle = "#c19a56";
  c.fillRect(130, 180, 159, 14);
  c.beginPath();
  c.ellipse(209, 174, 51, 27, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = "#aa392a";
  c.fillRect(159, 170, 101, 10);
  c.fillStyle = "#273b47";
  c.font = "bold 40px Georgia";
  c.fillText("01", 305, 484);
  const tex = new CanvasTexture(cover);
  tex.colorSpace = SRGBColorSpace;
  textures.push(tex);
  const cm = material("#ffffff");
  cm.map = tex;
  const face = add(book, new PlaneGeometry(0.23, 0.3), cm, 0, 0.014, 0);
  face.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++)
    add(
      book,
      new BoxGeometry(0.231, 0.001, 0.278),
      material(i % 2 ? "#b7ad98" : "#e0d5bf"),
      0,
      -0.008 + i * 0.004,
      0,
    );
  return {
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
