import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  Texture,
  TorusGeometry,
} from "three";
import { Box3, Matrix4, Vector3, type Material } from "three";
import { PS_GAMES } from "~/common/playstation/games";
import { dualSenseFactory } from "./dualsense";
import { createHeadset } from "./scene-3.devices";

type SurfaceMaterial = MeshBasicMaterial | MeshStandardMaterial;

/** The atelier's own construction helpers, shared so the corner matches the rest of the room. */
export interface GameCornerKit {
  geo: <T extends BufferGeometry>(geometry: T, shaded?: boolean) => T;
  lightMaterial: <T extends SurfaceMaterial>(material: T) => T;
  own: (material: SurfaceMaterial) => void;
  box: (parent: Object3D, size: number[], position: number[], color: string, radius?: number) => Mesh;
  cylinder: (parent: Object3D, radius: number, height: number, position: number[], color: string) => Mesh;
  ball: (parent: Object3D, size: number[], position: number[], color: string) => Mesh;
  panel: (parent: Object3D, width: number, height: number, position: number[], material: SurfaceMaterial) => Mesh;
  canvasTexture: (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => CanvasTexture;
  textured: (texture: Texture, transparent?: boolean) => MeshBasicMaterial;
  clickable: (mesh: Object3D) => void;
  /** Clicking one of the Vision Pro headsets puts it on. */
  clickableHeadset: (mesh: Object3D) => void;
  envMap: Texture;
  walnut: string;
}

// Bookcase-local measurements: x runs from the books (-) towards the room (+), z along its length.
const TOP = 1.3275;
const CUBBY_FRONT = 0.4;
const BAYS = [
  { from: -1.3875, to: -0.87 },
  { from: 0.97, to: 1.3875 },
];

const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/**
 * A television and a console on the listening-bay bookcase, a crate of records beside them, and the
 * bookcase's open room-facing side turned into lit cubbies. Everything here opens the PlayStation.
 */
export function buildGameCorner(bookcase: Object3D, kit: GameCornerKit) {
  const { geo, lightMaterial, own, box, cylinder, ball, panel, canvasTexture, textured, clickable, clickableHeadset } = kit;
  const surface = (options: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) =>
    lightMaterial(new MeshPhysicalMaterial({ envMap: kit.envMap, envMapIntensity: .55, ...options }));
  const srgb = (hex: string) => new Color(hex).convertLinearToSRGB();
  const glow = (hex: string) => {
    const material = new MeshBasicMaterial({ color: srgb(hex), toneMapped: false });
    own(material);
    return material;
  };
  const piano = surface({ color: srgb("#060607"), roughness: .16, clearcoat: 1, clearcoatRoughness: .08 });
  const shell = surface({ color: srgb("#f1f1ee"), roughness: .36, clearcoat: .35, clearcoatRoughness: .4 });
  const graphite = surface({ color: srgb("#1a1b1e"), roughness: .45, metalness: .25 });
  const steel = surface({ color: srgb("#5d6066"), roughness: .3, metalness: .8 });
  const mesh = (geometry: BufferGeometry, material: SurfaceMaterial, parent: Object3D, position: number[] = [0, 0, 0]) => {
    const item = new Mesh(geometry, material);
    item.position.fromArray(position);
    parent.add(item);
    return item;
  };
  const touch = (...items: Object3D[]) => items.forEach(item => clickable(item));

  /* ---------- Television ---------- */
  const tv = new Group();
  tv.name = "game_corner_tv";
  tv.position.set(-.02, TOP, 0);
  tv.rotation.y = Math.PI / 2;
  bookcase.add(tv);
  const W = 1.14, H = .648, panelY = .09 + H / 2;
  const frame = box(tv, [W, H, .022], [0, panelY, 0], "#141518", .006);
  frame.material = graphite;
  const housing = box(tv, [W * .62, H * .6, .048], [0, panelY - .04, -.032], "#1c1d20", .02);
  housing.material = graphite;
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 1280;
  screenCanvas.height = 720;
  const screenTexture = new CanvasTexture(screenCanvas);
  const screenMaterial = new MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  own(screenMaterial);
  const screen = panel(tv, W - .014, H - .014, [0, panelY, .0115], screenMaterial);
  // A faint glass layer on top, so the room reflects in the panel when you look across it.
  const glass = lightMaterial(new MeshStandardMaterial({
    color: 0x000000, roughness: .05, metalness: 0, envMap: kit.envMap, envMapIntensity: 1.1,
    transparent: true, opacity: .22, depthWrite: false,
  }));
  panel(tv, W - .014, H - .014, [0, panelY, .0119], glass);
  box(tv, [W - .01, .016, .024], [0, panelY - H / 2 + .006, .001], "#1b1c1f").material = graphite;
  mesh(geo(new PlaneGeometry(.008, .0025)), glow("#ffffff"), tv, [0, panelY - H / 2 + .006, .0135]);
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - .1);
    box(tv, [.012, .1, .028], [x, .05, -.004], "#2c2d31", .004).material = steel;
    box(tv, [.016, .01, .25], [x, .005, .0], "#2c2d31", .004).material = steel;
  }
  touch(frame, screen);

  /* ---------- Console ---------- */
  const ps = new Group();
  ps.name = "game_corner_console";
  ps.position.set(-.01, TOP, -.83);
  bookcase.add(ps);
  cylinder(ps, .075, .012, [0, .006, 0], "#111214").material = piano;
  const core = box(ps, [.25, .36, .066], [-.004, .2, 0], "#0b0c0e", .012);
  core.material = piano;
  // The side panels' profile: a pinched waist on the front edge that flares out at the top.
  const profile = new Shape();
  profile.moveTo(-.124, .018);
  profile.lineTo(.112, .018);
  profile.quadraticCurveTo(.096, .2, .137, .404);
  profile.quadraticCurveTo(.01, .398, -.118, .392);
  profile.quadraticCurveTo(-.136, .2, -.124, .018);
  const panelGeometry = geo(new ExtrudeGeometry(profile, { depth: .009, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 3, curveSegments: 24 }));
  const strip = glow("#3f7bff");
  const parts: Object3D[] = [core];
  for (const side of [-1, 1]) {
    const wing = mesh(panelGeometry, shell, ps, [0, 0, side * .041 - (side < 0 ? .009 : 0)]);
    parts.push(wing);
    // Light leaks out of the seam between the white shell and the black core.
    mesh(geo(new PlaneGeometry(.0035, .33)), strip, ps, [.121, .2, side * .0355]).rotation.y = Math.PI / 2;
  }
  for (let i = 0; i < 9; i++) box(ps, [.2, .0025, .004], [-.01, .381, -.024 + i * .006], "#030304");
  box(ps, [.003, .007, .014], [.12, .27, 0], "#020203");
  box(ps, [.003, .004, .009], [.12, .25, 0], "#020203");
  box(ps, [.002, .11, .002], [.12, .12, 0], "#26272b");
  touch(...parts);

  /* ---------- Controllers ---------- */
  const makePad = dualSenseFactory({ geo, surface, glow, canvasTexture });
  const MM = 0.00118;
  // Lying on the bookcase: face up, the player side toward the room.
  const lying = makePad();
  lying.group.scale.setScalar(MM);
  lying.group.position.set(.08, TOP + .001, -1.18);
  lying.group.rotation.y = Math.PI / 2 + 0.38;
  bookcase.add(lying.group);
  touch(lying.body);
  // Standing in the charging dock: face to the room, triggers down into the cradle.
  const standing = (parent: Object3D, z: number) => {
    const pad = makePad();
    pad.group.scale.setScalar(MM);
    // Face to the room, grips down into the cradle, triggers up.
    pad.group.setRotationFromMatrix(new Matrix4().makeBasis(new Vector3(0, 0, -1), new Vector3(1, 0, 0), new Vector3(0, -1, 0)));
    pad.group.position.set(-0.015, 0.03 + 58 * MM, z);
    parent.add(pad.group);
    touch(pad.body);
  };

  /* ---------- Vision Pro headsets ---------- */
  const deviceKit = { geometries: [] as import("three").BufferGeometry[], materials: [] as Material[], textures: [] as import("three").Texture[], envMap: kit.envMap };
  // The model's origin is near the front glass and the band trails far behind it, so centre the
  // footprint on the spot and rest the lowest point on the surface instead of trusting the origin.
  const headset = (parent: Object3D, position: number[], turn: number, scale = 0.00122) => {
    const made = createHeadset(deviceKit);
    made.group.scale.setScalar(scale);
    made.group.rotation.y = turn;
    made.group.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(made.group), middle = bounds.getCenter(new Vector3());
    made.group.position.set(position[0]! - middle.x, position[1]! - bounds.min.y, position[2]! - middle.z);
    parent.add(made.group);
    made.group.traverse(item => { if ((item as Mesh).isMesh) clickableHeadset(item); });
    return made.group;
  };
  /* ---------- Record crate ---------- */
  const crate = new Group();
  crate.position.set(-.02, TOP, .98);
  bookcase.add(crate);
  const oak = "#a7825a";
  box(crate, [.36, .012, .36], [0, .006, 0], oak, .002);
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const y = .04 + i * .085;
    box(crate, [.36, .06, .012], [0, y, side * .174], oak, .003);
    box(crate, [.012, .06, .336], [side * .174, y, 0], oak, .003);
  }
  // Eight sleeves, drawn once into an atlas: bold shapes that read across the room.
  const designs = [
    ["#e7d9bd", "#d2502e", "#1f2a2b"], ["#1b2c3a", "#f2b84b", "#e9e2d0"], ["#d9a441", "#20323a", "#f3eadb"], ["#2f4a3a", "#e4d6b5", "#c2552f"],
    ["#efe7d6", "#2d4b8e", "#e0573a"], ["#2a1f2d", "#e7a5b8", "#f0e6d8"], ["#c74a33", "#f3e2c3", "#1d1d1f"], ["#7c8f7a", "#f6efe0", "#283028"],
  ];
  const sleeves = canvasTexture(1024, 512, ctx => {
    designs.forEach(([base, accent, ink], i) => {
      const x = (i % 4) * 256, y = Math.floor(i / 4) * 256;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, 256, 256); ctx.clip();
      ctx.fillStyle = base!; ctx.fillRect(x, y, 256, 256);
      ctx.fillStyle = accent!;
      ctx.strokeStyle = accent!;
      if (i % 4 === 0) { ctx.beginPath(); ctx.arc(x + 128, y + 116, 70, 0, Math.PI * 2); ctx.fill(); }
      if (i % 4 === 1) for (let k = 0; k < 6; k++) ctx.fillRect(x + 30 + k * 34, y + 40 + k * 14, 20, 150 - k * 14);
      if (i % 4 === 2) { ctx.lineWidth = 12; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + 128, y + 128, 30 + k * 26, Math.PI, Math.PI * 2); ctx.stroke(); } }
      if (i % 4 === 3) { ctx.beginPath(); ctx.moveTo(x + 30, y + 210); ctx.lineTo(x + 128, y + 40); ctx.lineTo(x + 226, y + 210); ctx.fill(); }
      ctx.fillStyle = ink!;
      ctx.font = "600 19px Georgia";
      ctx.fillText(["after hours", "night bus", "golden hour", "field notes", "blue period", "soft focus", "red room", "green line"][i]!, x + 22, y + 236);
      ctx.restore();
    });
  });
  const sleeveMaterial = textured(sleeves);
  const sleeveGeometry = (index: number) => {
    const geometry = geo(new PlaneGeometry(.305, .305), false);
    const uv = geometry.getAttribute("uv");
    for (let j = 0; j < uv.count; j++) uv.setXY(j, ((index % 4) + uv.getX(j)) / 4, (1 - Math.floor(index / 4) + uv.getY(j)) / 2);
    return geometry;
  };
  for (let i = 0; i < 11; i++) {
    const record = new Group();
    record.position.set(-.13 + i * .025, .012, 0);
    record.rotation.z = i === 10 ? -.32 : -.06 + Math.sin(i * 1.7) * .04;
    crate.add(record);
    box(record, [.004, .305, .305], [0, .1525, 0], designs[i % 8]![0]!);
    const art = mesh(sleeveGeometry(i % 8), sleeveMaterial, record, [.0025, .1525, 0]);
    art.rotation.y = Math.PI / 2;
  }

  /* ---------- Room-facing cubbies ---------- */
  const depth = CUBBY_FRONT - .21;
  for (const bay of BAYS) {
    const width = bay.to - bay.from, mid = (bay.from + bay.to) / 2;
    const outer = bay.from < 0 ? bay.from - .0325 : bay.to + .0325;
    const inner = bay.from < 0 ? bay.to - .015 : bay.from + .015;
    box(bookcase, [depth, 1.3, .065], [.21 + depth / 2, .65, outer], kit.walnut);
    box(bookcase, [CUBBY_FRONT - .125, 1.3, .03], [.125 + (CUBBY_FRONT - .125) / 2, .65, inner], kit.walnut);
    for (const y of [.06, .65, 1.3]) box(bookcase, [depth, .055, width], [.21 + depth / 2, y, mid], kit.walnut);
    for (const y of [.65 - .031, 1.3 - .031]) mesh(geo(new PlaneGeometry(.012, width - .05)), glow("#ffd9a0"), bookcase, [CUBBY_FRONT - .03, y, mid]).rotation.set(Math.PI / 2, 0, Math.PI / 2);
  }
  // Left bay, lower: a charging dock with both controllers standing on it.
  const dock = new Group();
  dock.position.set(.27, .0875, -1.13);
  bookcase.add(dock);
  box(dock, [.09, .03, .44], [0, .015, 0], "#efefec", .01).material = shell;
  box(dock, [.066, .006, .42], [0, .033, 0], "#111", .003).material = piano;
  for (const z of [-.108, .108]) standing(dock, z);
  // Left bay, upper: a shelf of game cases with titles from the console's library, and a little plant.
  const cases = PS_GAMES.slice(0, 9);
  const spines = canvasTexture(64 * 9, 512, ctx => {
    cases.forEach((game, i) => {
      const x = i * 64;
      ctx.fillStyle = "#1d4fc4"; ctx.fillRect(x, 0, 64, 512);
      ctx.fillStyle = "#f4f6fb"; ctx.fillRect(x, 0, 64, 70);
      ctx.fillStyle = "#1d4fc4"; ctx.font = "700 20px system-ui"; ctx.fillText("PS5", x + 13, 44);
      ctx.fillStyle = game.color; ctx.fillRect(x + 6, 80, 52, 6);
      ctx.save(); ctx.translate(x + 40, 492); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#ffffff"; ctx.font = "600 24px system-ui"; ctx.fillText(game.title.toUpperCase().slice(0, 22), 0, 0);
      ctx.restore();
      ctx.fillStyle = "#0004"; ctx.fillRect(x + 62, 0, 2, 512);
    });
  });
  const spineMaterial = textured(spines);
  cases.forEach((_, i) => {
    const z = -1.36 + i * .0185;
    const item = box(bookcase, [.135, .17, .016], [.3, .6775 + .085, z], "#1d4fc4", .002);
    const geometry = geo(new PlaneGeometry(.016, .17), false);
    const uv = geometry.getAttribute("uv");
    for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j)) / 9);
    const face = mesh(geometry, spineMaterial, bookcase, [.3 + .0681, .6775 + .085, z]);
    face.rotation.y = Math.PI / 2;
    touch(item, face);
  });
  const leaning = box(bookcase, [.135, .17, .016], [.3, .6775 + .083, -1.17], "#1d4fc4", .002);
  leaning.rotation.x = -.32;
  cylinder(bookcase, .045, .075, [.3, .6775 + .0375, -.97], "#d8cfc0");
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const leaf = ball(bookcase, [.016, .055, .03], [.3 + Math.cos(a) * .025, .6775 + .12 + (i % 3) * .015, -.97 + Math.sin(a) * .025], "#5e7a52");
    leaf.rotation.set(Math.sin(a) * .5, a, Math.cos(a) * .5);
  }
  // Right bay, lower: a run of LPs on their spines.
  const lpColors = ["#c2552f", "#e7d9bd", "#20323a", "#d9a441", "#2d4b8e", "#7c8f7a", "#1d1d1f", "#e7a5b8", "#efe7d6", "#2f4a3a"];
  for (let i = 0; i < 26; i++) {
    const lp = box(bookcase, [.25, .25, .009], [.27, .0875 + .125, 1.0 + i * .0128], lpColors[(i * 7) % lpColors.length]!);
    if (i > 23) { lp.rotation.x = .2; lp.position.z += .03; lp.position.y -= .01; }
  }
  // Right bay, upper: a Vision Pro on its display stand, and a small photograph.
  const plinth = cylinder(bookcase, .085, .016, [.27, .6775 + .008, 1.25], "#1b1c1f");
  plinth.material = graphite;
  cylinder(bookcase, .074, .004, [.27, .6775 + .018, 1.25], "#d8d6d0").material = shell;
  clickableHeadset(plinth);
  headset(bookcase, [.27, .6775 + .02, 1.25], Math.PI / 2 - 0.25);
  const photo = canvasTexture(256, 320, ctx => {
    ctx.fillStyle = "#f3efe6"; ctx.fillRect(0, 0, 256, 320);
    const sky = ctx.createLinearGradient(0, 20, 0, 250);
    sky.addColorStop(0, "#f2a65a"); sky.addColorStop(.6, "#c4566b"); sky.addColorStop(1, "#2a2440");
    ctx.fillStyle = sky; ctx.fillRect(18, 18, 220, 230);
    ctx.fillStyle = "#1c1a28";
    ctx.beginPath(); ctx.moveTo(18, 248); ctx.lineTo(80, 170); ctx.lineTo(130, 210); ctx.lineTo(190, 150); ctx.lineTo(238, 200); ctx.lineTo(238, 248); ctx.fill();
    ctx.fillStyle = "#3b3a44"; ctx.font = "22px 'Segoe Script', cursive"; ctx.fillText("first win, 2am", 34, 290);
  });
  const frameGroup = new Group();
  frameGroup.position.set(.33, .6775 + .1, 1.06);
  frameGroup.rotation.set(0, Math.PI / 2, 0);
  frameGroup.rotateX(-.16);
  bookcase.add(frameGroup);
  box(frameGroup, [.13, .16, .012], [0, 0, 0], "#2a2522", .003);
  panel(frameGroup, .112, .14, [0, 0, .0065], textured(photo));

  const room = bookcase.parent;
  if (room) {
    const floor = bookcase.position.y;
    const tray = box(room, [.46, .012, .36], [3.55, floor + .987, -2.12], "#3a3936", .006);
    tray.material = surface({ color: srgb("#3b3a38"), roughness: .95 });
    clickableHeadset(tray);
    headset(room, [3.55, floor + .993, -2.12], -0.42, 0.00158);
  }
  deviceKit.materials.forEach(material => lightMaterial(material as MeshStandardMaterial));
  deviceKit.geometries.forEach(geometry => geo(geometry));

  /* ---------- Television picture ---------- */
  // An idle PS5 home screen that slowly cycles through the library, drawn from the console's own cover art.
  const ctx = screenCanvas.getContext("2d")!;
  const covers = new Map<string, HTMLImageElement>();
  let focused = 0, elapsed = 0;
  const art = (id: string) => {
    const image = covers.get(id);
    return image?.complete && image.naturalWidth ? image : null;
  };
  const cover = (image: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    const k = Math.max(w / image.naturalWidth, h / image.naturalHeight);
    const sw = w / k, sh = h / k;
    ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  };
  const ROW = 8;
  const draw = () => {
    const index = focused % ROW;
    const game = PS_GAMES[index]!;
    ctx.fillStyle = "#05060c"; ctx.fillRect(0, 0, 1280, 720);
    const hero = art(game.id);
    if (hero) cover(hero, 0, 0, 1280, 720);
    const shade = ctx.createLinearGradient(0, 0, 0, 720);
    shade.addColorStop(0, "#000a"); shade.addColorStop(.32, "#0003"); shade.addColorStop(.62, "#0007"); shade.addColorStop(1, "#000e");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 1280, 720);
    const side = ctx.createLinearGradient(0, 0, 900, 0);
    side.addColorStop(0, "#000a"); side.addColorStop(1, "#0000");
    ctx.fillStyle = side; ctx.fillRect(0, 0, 1280, 720);
    ctx.font = "600 24px system-ui"; ctx.fillStyle = "#fff"; ctx.fillText("Games", 64, 56);
    ctx.fillStyle = "#ffffff80"; ctx.fillText("Media", 160, 56);
    ctx.textAlign = "right"; ctx.fillStyle = "#ffffffd8";
    ctx.fillText(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 1216, 56);
    ctx.textAlign = "left";
    PS_GAMES.slice(0, ROW).forEach((item, i) => {
      const active = i === index;
      const size = active ? 132 : 92;
      const x = 64 + i * 104 + (i > index ? 40 : 0), y = active ? 92 : 104;
      ctx.save();
      rounded(ctx, x, y, size, size, 12); ctx.clip();
      const image = art(item.id);
      if (image) cover(image, x, y, size, size);
      else { ctx.fillStyle = item.color; ctx.fillRect(x, y, size, size); }
      ctx.restore();
      if (active) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; rounded(ctx, x - 6, y - 6, size + 12, size + 12, 17); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "600 22px system-ui"; ctx.fillText(item.title, x + size + 22, y + size - 8);
      }
    });
    ctx.fillStyle = "#fff"; ctx.font = "700 60px system-ui";
    ctx.fillText(game.title, 64, 470);
    ctx.fillStyle = "#ffffffc0"; ctx.font = "400 26px system-ui";
    ctx.fillText(game.pitch.length > 70 ? game.pitch.slice(0, 68) + "…" : game.pitch, 64, 512);
    ctx.fillStyle = "#fff"; rounded(ctx, 64, 556, 196, 60, 30); ctx.fill();
    ctx.fillStyle = "#000"; ctx.font = "600 26px system-ui"; ctx.fillText("Play Game", 98, 595);
    ctx.fillStyle = "#ffffff26"; rounded(ctx, 276, 556, 60, 60, 30); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 26px system-ui"; ctx.fillText("···", 288, 592);
    screenTexture.needsUpdate = true;
  };
  for (const game of PS_GAMES.slice(0, ROW)) {
    const image = new Image();
    image.decoding = "async";
    image.onload = draw;
    image.src = game.cover;
    covers.set(game.id, image);
  }
  draw();

  return {
    update(delta: number) {
      if (document.hidden) return;
      elapsed += delta;
      if (elapsed < 6000) return;
      elapsed = 0;
      focused++;
      draw();
    },
    dispose() {
      screenTexture.dispose();
      deviceKit.textures.forEach(texture => texture.dispose());
    },
  };
}
