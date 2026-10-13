import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { animate, createTimeline } from "animejs";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import type {
  AtelierAction,
  AtelierState,
} from "~/common/models/atelier.model";
import { ATELIER_PALETTES, drawAtelierArt } from "./atelier-art";

const FLOOR = 0.445;

/** A connected, made-to-measure room. Constructed only when someone enters it. */
export function createAtelier(
  scene: Group,
  act: (action: AtelierAction) => void,
) {
  const root = new Group();
  root.name = "mohith_atelier";
  root.position.x = 3.02;
  scene.add(root);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshBasicMaterial>();
  const textures = new Set<CanvasTexture>();
  const motions = new Set<{ pause: () => unknown }>();
  const selectables: SelectableObject[] = [];
  const floor = new Group(),
    architecture = new Group(),
    furniture = new Group();
  root.add(floor, architecture, furniture);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    revealed = false,
    lastStudy = -1,
    lastPalette = -1,
    lastWire = false;
  let recordOn = false;
  let printAnimation: { pause: () => unknown } | undefined;
  let pulseAnimation: { pause: () => unknown } | undefined;
  const ink = "#292d2c",
    walnut = "#805741",
    brass = "#b19969";

  const geo = <T extends BufferGeometry>(geometry: T, shaded = true): T => {
    geometries.add(geometry);
    if (shaded) {
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      const normal = geometry.getAttribute("normal");
      const colors = new Float32Array(normal.count * 3);
      for (let i = 0; i < normal.count; i++) {
        const light = Math.min(
          1,
          0.52 +
            Math.max(0, normal.getY(i)) * 0.4 +
            Math.max(0, normal.getZ(i)) * 0.22 +
            Math.max(0, -normal.getX(i)) * 0.1,
        );
        colors.set([light, light * 0.985, light * 0.955], i * 3);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    }
    return geometry;
  };
  const materialCache = new Map<string, MeshBasicMaterial>();
  const mat = (color: string, shaded = true) => {
    const key = color + shaded;
    if (materialCache.has(key)) return materialCache.get(key)!;
    // The existing room deliberately renders in linear output space.
    const material = new MeshBasicMaterial({
      color: new Color(color).convertLinearToSRGB(),
      vertexColors: shaded,
    });
    materials.add(material);
    materialCache.set(key, material);
    return material;
  };
  const boxGeo = geo(new BoxGeometry(1, 1, 1));
  const planeGeo = geo(new PlaneGeometry(1, 1), false);
  const cylinderGeo = geo(new CylinderGeometry(1, 1, 1, 32));
  const sphereGeo = geo(new SphereGeometry(1, 16, 12));
  const box = (
    parent: Object3D,
    size: number[],
    position: number[],
    color: string,
    radius = 0,
  ) => {
    const geometry = radius
      ? geo(new RoundedBoxGeometry(size[0], size[1], size[2], 2, radius))
      : boxGeo;
    const mesh = new Mesh(geometry, mat(color));
    if (!radius) mesh.scale.fromArray(size);
    mesh.position.fromArray(position);
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (
    parent: Object3D,
    radius: number,
    height: number,
    position: number[],
    color: string,
  ) => {
    const mesh = new Mesh(cylinderGeo, mat(color));
    mesh.scale.set(radius, height, radius);
    mesh.position.fromArray(position);
    parent.add(mesh);
    return mesh;
  };
  const ball = (
    parent: Object3D,
    size: number[],
    position: number[],
    color: string,
  ) => {
    const mesh = new Mesh(sphereGeo, mat(color));
    mesh.scale.fromArray(size);
    mesh.position.fromArray(position);
    parent.add(mesh);
    return mesh;
  };
  const clickable = (mesh: Object3D, action: AtelierAction) => {
    mesh.name = `atelier_${action}`;
    selectables.push({ object: mesh, onSelect: () => act(action) });
  };
  const canvasTexture = (
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d")!);
    const texture = new CanvasTexture(canvas);
    textures.add(texture);
    return texture;
  };
  const textured = (texture: CanvasTexture, transparent = false) => {
    const material = new MeshBasicMaterial({
      map: texture,
      transparent,
      depthWrite: !transparent,
      side: DoubleSide,
    });
    materials.add(material);
    return material;
  };
  const panel = (
    parent: Object3D,
    width: number,
    height: number,
    position: number[],
    material: MeshBasicMaterial,
  ) => {
    const mesh = new Mesh(planeGeo, material);
    mesh.scale.set(width, height, 1);
    mesh.position.fromArray(position);
    parent.add(mesh);
    return mesh;
  };
  const label = (
    parent: Object3D,
    text: string,
    width: number,
    height: number,
    position: number[],
    color = "#d3c5aa",
    size = 30,
  ) => {
    const texture = canvasTexture(768, 160, (ctx) => {
      ctx.fillStyle = color;
      ctx.font = `500 ${size}px 'Cascadia Code', Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 384, 80);
    });
    return panel(parent, width, height, position, textured(texture, true));
  };
  const shadowMap = canvasTexture(96, 96, (ctx) => {
    const gradient = ctx.createRadialGradient(48, 48, 5, 48, 48, 47);
    gradient.addColorStop(0, "#000a");
    gradient.addColorStop(0.5, "#0006");
    gradient.addColorStop(1, "#0000");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 96, 96);
  });
  const shadowMat = textured(shadowMap, true);
  const shadow = (
    parent: Object3D,
    x: number,
    z: number,
    w: number,
    d: number,
    y = FLOOR + 0.022,
  ) => {
    const mesh = panel(parent, w, d, [x, y, z], shadowMat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  // Floor joins the existing cutaway exactly at x=3.02. Warm boards contrast
  // gently with the tiled workstation without changing any original geometry.
  box(floor, [5.82, 0.42, 6.48], [2.91, 0.225, 0.125], "#413b32", 0.035);
  const planks = new InstancedMesh(
    geo(new BoxGeometry(0.32, 0.035, 2.13)),
    mat("#b18c65"),
    54,
  );
  const matrix = new Matrix4(),
    tint = new Color();
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 18; col++) {
      const i = row * 18 + col;
      matrix.makeTranslation(
        0.175 + col * 0.322,
        FLOOR + 0.009,
        -2.02 + row * 2.145,
      );
      planks.setMatrixAt(i, matrix);
      tint.setRGB(
        0.85 + (i % 7) * 0.018,
        0.84 + (i % 5) * 0.018,
        0.81 + (i % 6) * 0.019,
      );
      planks.setColorAt(i, tint);
    }
  floor.add(planks);
  box(floor, [0.065, 0.034, 6.47], [0.028, FLOOR + 0.02, 0.125], brass);
  box(floor, [5.81, 0.035, 0.045], [2.91, FLOOR + 0.02, 3.342], "#685443");
  label(
    floor,
    "02 / THE ATELIER",
    2.1,
    0.21,
    [2.9, 0.255, 3.373],
    "#bba78a",
    33,
  );

  // Architecture: a cutaway continuation of the existing back wall, with a
  // warm picture light and a timber reveal. The open front stays easy to see.
  box(
    architecture,
    [5.83, 5.31, 0.16],
    [2.915, FLOOR + 2.655, -3.12],
    "#766f63",
  );
  box(
    architecture,
    [5.83, 0.14, 0.07],
    [2.915, FLOOR + 0.07, -3.015],
    "#a29179",
  );
  box(
    architecture,
    [0.065, 5.32, 0.17],
    [0.035, FLOOR + 2.66, -3.015],
    "#443e33",
  );
  box(architecture, [5.82, 0.1, 0.27], [2.91, 5.78, -3.04], "#4c4235");
  const wash = canvasTexture(128, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#ffd4926b");
    g.addColorStop(0.5, "#dfb78b08");
    g.addColorStop(1, "#0000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
  });
  panel(architecture, 5.5, 3.9, [2.9, 3.69, -3.028], textured(wash, true));
  box(architecture, [5.5, 0.028, 0.025], [2.89, 5.66, -2.895], "#e6b975");
  const slats = new InstancedMesh(
    geo(new BoxGeometry(0.07, 4.65, 0.1)),
    mat("#a28662"),
    7,
  );
  for (let i = 0; i < 7; i++) {
    matrix.makeTranslation(4.85 + i * 0.13, 2.93, -2.99);
    slats.setMatrixAt(i, matrix);
  }
  architecture.add(slats);
  label(
    architecture,
    "THE ATELIER",
    2.3,
    0.34,
    [2.56, 5.11, -3.018],
    "#d4c6ac",
    44,
  );
  label(
    architecture,
    "FORM  /  MATERIAL  /  PLAY",
    2.3,
    0.22,
    [2.56, 4.8, -3.018],
    "#c0b49e",
    25,
  );

  // One original composition becomes three physical things: the wall print,
  // the paper on the drawing desk, and the postcard coming out of the press.
  const artCanvas = document.createElement("canvas");
  artCanvas.width = 1400;
  artCanvas.height = 980;
  const artTexture = new CanvasTexture(artCanvas);
  textures.add(artTexture);
  const artMat = textured(artTexture);
  const frame = new Group();
  frame.position.set(2.55, 3.28, -2.985);
  architecture.add(frame);
  box(frame, [3.22, 2.33, 0.1], [0, 0, 0], "#302e27", 0.025);
  box(frame, [3.09, 2.2, 0.018], [0, 0, 0.056], "#c3b8a0");
  const wallPrint = panel(frame, 2.93, 2.05, [0, 0, 0.068], artMat);
  clickable(wallPrint, "study");
  for (const x of [-1.37, 1.37])
    cylinder(frame, 0.019, 0.12, [x, 1.3, 0.17], brass).rotation.x =
      Math.PI / 2;
  box(frame, [2.86, 0.065, 0.18], [0, 1.34, 0.21], "#ad997a", 0.023);
  box(frame, [2.62, 0.013, 0.125], [0, 1.302, 0.235], "#f0d3a4");

  // Woven rug: a single lightweight texture, not thousands of strands.
  const rugMap = canvasTexture(384, 384, (ctx) => {
    ctx.fillStyle = "#a4987c";
    ctx.fillRect(0, 0, 384, 384);
    for (let y = 0; y < 384; y += 3) {
      ctx.strokeStyle = y % 9 ? "#baa99060" : "#685c4845";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(384, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#534b3b";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 348, 348);
    ctx.strokeRect(24, 24, 336, 336);
  });
  const rug = panel(
    furniture,
    3.45,
    3.95,
    [2.4, FLOOR + 0.032, 0.63],
    textured(rugMap),
  );
  rug.rotation.x = -Math.PI / 2;
  shadow(furniture, 2.1, -0.1, 3.3, 2.55, FLOOR + 0.035);

  // A drafting table, including joinery, leaning paper, rule, pencil and
  // clickable ceramic ink wells. The artwork responds in the room itself.
  const table = new Group();
  table.position.set(2.1, FLOOR, -0.08);
  furniture.add(table);
  for (const x of [-0.92, 0.92]) {
    for (const z of [-0.56, 0.56]) {
      const leg = box(table, [0.075, 1.33, 0.075], [x, 0.665, z], walnut, 0.01);
      leg.rotation.z = x > 0 ? -0.06 : 0.06;
    }
    box(table, [0.085, 0.1, 1.25], [x, 0.21, 0], walnut);
  }
  box(table, [1.85, 0.09, 0.09], [0, 0.3, 0], walnut);
  const tabletop = new Group();
  tabletop.position.y = 1.36;
  tabletop.rotation.x = 0.13;
  table.add(tabletop);
  const tableRim = box(
    tabletop,
    [2.5, 0.095, 1.72],
    [0, 0, 0],
    "#8f7354",
    0.035,
  );
  clickable(tableRim, "study");
  box(tabletop, [2.37, 0.016, 1.58], [0, 0.054, 0], "#d3c6a9", 0.02);
  const paper = panel(tabletop, 1.97, 1.38, [-0.13, 0.066, -0.01], artMat);
  paper.rotation.x = -Math.PI / 2;
  clickable(paper, "study");
  box(tabletop, [2.35, 0.055, 0.045], [0, 0.07, 0.8], brass);
  const rule = box(
    tabletop,
    [0.055, 0.013, 1.31],
    [0.77, 0.083, 0.04],
    "#7b887f",
  );
  rule.rotation.y = -0.13;
  clickable(rule, "wireframe");
  for (let i = 0; i < 13; i++)
    box(
      tabletop,
      [0.031, 0.003, 0.009],
      [0.77 + i * 0.006, 0.093, -0.51 + i * 0.086],
      "#d0d3bd",
    );
  const pencil = cylinder(
    tabletop,
    0.012,
    0.64,
    [0.98, 0.085, 0.08],
    "#bf7846",
  );
  pencil.rotation.z = Math.PI / 2;
  pencil.rotation.y = -0.96;
  const inkWells: Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const well = cylinder(
      tabletop,
      0.067,
      0.045,
      [0.92, 0.105, -0.57 + i * 0.19],
      ["#ad614a", "#76906b", "#72889a"][i],
    );
    inkWells.push(well);
    clickable(well, "palette");
  }
  label(
    table,
    "LIGHT TABLE / TAP TO COMPOSE",
    1.5,
    0.11,
    [0, 1.27, 0.87],
    "#d8c3a0",
    26,
  );
  const stool = new Group();
  stool.position.set(1.92, FLOOR, 1.57);
  furniture.add(stool);
  shadow(furniture, 1.92, 1.57, 1.25, 1.25);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3,
      leg = cylinder(
        stool,
        0.035,
        0.7,
        [Math.cos(a) * 0.22, 0.38, Math.sin(a) * 0.22],
        walnut,
      );
    leg.rotation.z = Math.cos(a) * 0.12;
    leg.rotation.x = Math.sin(a) * 0.12;
  }
  cylinder(stool, 0.38, 0.1, [0, 0.78, 0], walnut);
  cylinder(stool, 0.36, 0.08, [0, 0.87, 0], "#777e69");
  const stoolRing = new Mesh(
    geo(new TorusGeometry(0.23, 0.013, 6, 32)),
    mat(brass),
  );
  stoolRing.rotation.x = Math.PI / 2;
  stoolRing.position.y = 0.29;
  stool.add(stoolRing);

  // A compact risograph-inspired press. A physical sheet emerges from its
  // slot; the visitor can also save the same original composition as a PNG.
  const press = new Group();
  press.position.set(0.57, FLOOR, 1.55);
  furniture.add(press);
  shadow(furniture, 0.59, 1.55, 1.4, 1.4);
  box(press, [0.98, 0.78, 0.87], [0, 0.4, 0], "#716c5d", 0.03);
  for (let i = 0; i < 3; i++) {
    box(
      press,
      [0.89, 0.18, 0.017],
      [0, 0.2 + i * 0.2, 0.447],
      "#8e8875",
      0.012,
    );
    box(press, [0.25, 0.014, 0.038], [0, 0.23 + i * 0.2, 0.47], ink);
  }
  box(press, [1.09, 0.37, 0.92], [0, 0.96, 0], "#c4c0a9", 0.06);
  box(press, [0.84, 0.035, 0.16], [0, 1.115, -0.12], "#444b44", 0.008);
  box(press, [0.86, 0.052, 0.035], [0, 0.905, 0.467], "#272b29");
  box(press, [0.88, 0.025, 0.52], [0, 0.865, 0.58], "#73786b", 0.018);
  const printButton = cylinder(
    press,
    0.06,
    0.016,
    [0.42, 1.158, 0.21],
    "#b96749",
  );
  clickable(printButton, "print");
  const pressBody = box(
    press,
    [0.97, 0.09, 0.46],
    [0, 1.172, -0.12],
    "#ddcfb5",
    0.02,
  );
  clickable(pressBody, "print");
  label(press, "FORM / PRESS", 0.74, 0.1, [0, 1.017, 0.471], "#43483e", 28);
  const printPaper = panel(press, 0.67, 0.47, [0, 0.892, 0.68], artMat);
  printPaper.rotation.x = -Math.PI / 2;
  printPaper.visible = false;
  clickable(printPaper, "print");

  // Low walnut console with an actual platter, concentric vinyl grooves,
  // lifted tonearm, record sleeve and woven speaker grilles.
  const console = new Group();
  console.position.set(4.63, FLOOR, -2.16);
  furniture.add(console);
  shadow(furniture, 4.63, -2.16, 2.1, 1.25);
  for (const x of [-0.74, 0.74])
    for (const z of [-0.34, 0.34])
      cylinder(console, 0.025, 0.25, [x, 0.125, z], ink);
  box(console, [1.78, 0.74, 0.91], [0, 0.62, 0], walnut, 0.024);
  box(console, [1.66, 0.56, 0.035], [0, 0.59, 0.467], "#2f332e");
  const grill = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#73715f";
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 2; y < 128; y += 6)
      for (let x = 2; x < 128; x += 5) {
        ctx.fillStyle = (x + y) % 3 ? "#252923" : "#494c3f";
        ctx.fillRect(x, y, 2, 3);
      }
  });
  const grilleMat = textured(grill);
  clickable(
    panel(console, 0.46, 0.44, [-0.54, 0.61, 0.491], grilleMat),
    "sound",
  );
  clickable(
    panel(console, 0.46, 0.44, [0.54, 0.61, 0.491], grilleMat),
    "sound",
  );
  box(console, [0.48, 0.47, 0.06], [0, 0.59, 0.49], "#a69170", 0.005);
  const recordDeck = box(
    console,
    [1.5, 0.115, 0.73],
    [0, 1.042, 0],
    "#bab7a0",
    0.028,
  );
  clickable(recordDeck, "sound");
  const platter = new Group();
  platter.position.set(-0.25, 1.12, 0);
  console.add(platter);
  clickable(cylinder(platter, 0.307, 0.016, [0, 0, 0], "#191d1b"), "sound");
  for (const r of [0.14, 0.18, 0.22, 0.26, 0.29]) {
    const groove = new Mesh(
      geo(new TorusGeometry(r, 0.0017, 3, 48)),
      mat("#3a3e38"),
    );
    groove.rotation.x = Math.PI / 2;
    groove.position.y = 0.009;
    platter.add(groove);
  }
  const vinylLabel = cylinder(platter, 0.097, 0.003, [0, 0.011, 0], "#b96545");
  clickable(vinylLabel, "sound");
  box(platter, [0.12, 0.004, 0.018], [0, 0.014, 0], "#dcc8a2");
  cylinder(platter, 0.011, 0.028, [0, 0.016, 0], brass);
  const armPivot = new Group();
  armPivot.position.set(0.53, 1.16, -0.23);
  console.add(armPivot);
  cylinder(armPivot, 0.065, 0.075, [0, -0.025, 0], ink);
  const tonearm = box(
    armPivot,
    [0.035, 0.034, 0.56],
    [0, 0, 0.25],
    brass,
    0.008,
  );
  tonearm.rotation.y = 0.25;
  box(armPivot, [0.08, 0.04, 0.11], [0.14, -0.009, 0.48], ink, 0.007);
  const recordSwitch = cylinder(
    console,
    0.028,
    0.02,
    [0.61, 1.117, 0.23],
    "#b26e45",
  );
  clickable(recordSwitch, "sound");
  label(
    console,
    "AFTER HOURS / SIDE A",
    1.2,
    0.09,
    [0, 1.0, 0.377],
    "#ded2b7",
    23,
  );
  const sleeve = box(
    console,
    [0.47, 0.5, 0.025],
    [0.77, 1.42, -0.35],
    "#c2b096",
    0.01,
  );
  sleeve.rotation.z = -0.07;
  const sleeveArt = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#c5b291";
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#38453a";
    ctx.beginPath();
    ctx.arc(128, 116, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b76947";
    ctx.beginPath();
    ctx.arc(128, 116, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "19px Georgia";
    ctx.fillStyle = "#343a32";
    ctx.fillText("after hours", 72, 224);
  });
  panel(
    console,
    0.43,
    0.45,
    [0.77, 1.42, -0.334],
    textured(sleeveArt),
  ).rotation.z = -0.07;

  // A low daybed, sewn cushions, a small table and a warm reading light.
  const sofa = new Group();
  sofa.position.set(4.91, FLOOR, 0.3);
  furniture.add(sofa);
  shadow(furniture, 4.89, 0.3, 2.1, 3.3);
  for (const x of [-0.5, 0.5])
    for (const z of [-1.01, 1.01])
      cylinder(sofa, 0.035, 0.19, [x, 0.095, z], ink);
  box(sofa, [1.38, 0.21, 2.58], [0, 0.3, 0], walnut, 0.06);
  box(sofa, [0.2, 0.77, 2.54], [0.61, 0.7, 0], "#67705c", 0.07);
  for (const z of [-1.16, 1.16])
    box(sofa, [1.35, 0.3, 0.23], [0, 0.65, z], "#67705c", 0.07);
  for (const z of [-0.55, 0.55]) {
    box(sofa, [1.1, 0.24, 1.03], [-0.065, 0.52, z], "#858c72", 0.09);
    const cushion = box(
      sofa,
      [0.28, 0.52, 0.79],
      [0.32, 0.89, z],
      z < 0 ? "#b6906c" : "#aaa78b",
      0.1,
    );
    cushion.rotation.z = 0.15;
  }
  const throwBlanket = box(
    sofa,
    [0.71, 0.033, 0.66],
    [-0.23, 0.66, 0.54],
    "#c0b6a0",
    0.016,
  );
  throwBlanket.rotation.y = 0.07;
  box(sofa, [0.035, 0.36, 0.66], [-0.72, 0.49, 0.59], "#b1a690", 0.01);
  for (let i = 0; i < 7; i++)
    box(sofa, [0.019, 0.1, 0.012], [-0.744, 0.28, 0.33 + i * 0.083], "#ad9f85");
  const sideTable = new Group();
  sideTable.position.set(3.88, FLOOR, 1.63);
  furniture.add(sideTable);
  shadow(furniture, 3.88, 1.63, 1.1, 1.1);
  cylinder(sideTable, 0.065, 0.53, [0, 0.3, 0], walnut);
  cylinder(sideTable, 0.31, 0.045, [0, 0.03, 0], walnut);
  cylinder(sideTable, 0.43, 0.07, [0, 0.64, 0], "#aa8460");
  box(sideTable, [0.34, 0.028, 0.25], [0, 0.69, 0], "#d6c5a4").rotation.y =
    0.15;
  const mug = cylinder(sideTable, 0.077, 0.12, [0.12, 0.76, 0.1], "#7a8a7a");
  cylinder(sideTable, 0.064, 0.004, [0.12, 0.823, 0.1], "#352e24");
  const handle = new Mesh(
    geo(new TorusGeometry(0.06, 0.012, 6, 18)),
    mat("#7a8a7a"),
  );
  handle.position.set(0.21, 0.77, 0.1);
  sideTable.add(handle);

  const lamp = new Group();
  lamp.position.set(5.4, FLOOR, 2.28);
  furniture.add(lamp);
  shadow(furniture, 5.4, 2.28, 1.2, 1.2);
  cylinder(lamp, 0.31, 0.075, [0, 0.042, 0], "#45463d");
  cylinder(lamp, 0.022, 2.6, [0, 1.34, 0], brass);
  const shadeGeo = geo(new CylinderGeometry(0.26, 0.49, 0.45, 40, 1, false));
  const shade = new Mesh(shadeGeo, mat("#cbb78f"));
  shade.position.set(-0.08, 2.65, 0);
  lamp.add(shade);
  clickable(shade, "lamp");
  const bulb = cylinder(lamp, 0.4, 0.018, [-0.08, 2.43, 0], "#f3dbaa");
  const lampPool = canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 64);
    g.addColorStop(0, "#f1c57c60");
    g.addColorStop(0.55, "#d7ac6530");
    g.addColorStop(1, "#efc27500");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  const pool = panel(
    furniture,
    3.1,
    3.1,
    [5.12, FLOOR + 0.036, 1.7],
    textured(lampPool, true),
  );
  pool.rotation.x = -Math.PI / 2;

  // Tall plant, books and material samples add scale without occupying the
  // walking space. Repeated leaves and book spines share their geometry.
  const plant = new Group();
  plant.position.set(5.27, FLOOR, -0.91);
  furniture.add(plant);
  cylinder(plant, 0.21, 0.42, [0, 0.22, 0], "#a57857");
  cylinder(plant, 0.19, 0.012, [0, 0.435, 0], "#3b352b");
  for (let i = 0; i < 8; i++) {
    const a = i * 2.399,
      h = 0.78 + (i % 3) * 0.18,
      x = Math.cos(a) * 0.19,
      z = Math.sin(a) * 0.19;
    const stem = cylinder(
      plant,
      0.009,
      h,
      [x / 2, 0.43 + h / 2, z / 2],
      "#59664d",
    );
    stem.rotation.z = -x * 0.5;
    stem.rotation.x = z * 0.5;
    const leaf = ball(
      plant,
      [0.12, 0.27, 0.035],
      [x, 0.43 + h, z],
      ["#708268", "#5d7056", "#849075"][i % 3],
    );
    leaf.rotation.set(0.4, a, -0.4 + Math.sin(a) * 0.4);
  }
  const shelf = box(
    architecture,
    [1.37, 0.07, 0.4],
    [4.94, 4.26, -2.8],
    walnut,
    0.02,
  );
  for (let i = 0; i < 7; i++) {
    const book = box(
      architecture,
      [0.075 + 0.01 * (i % 2), 0.35 + 0.04 * (i % 3), 0.23],
      [4.44 + i * 0.093, 4.48, -2.78],
      ["#a39b82", "#b57451", "#596f67", "#c6b692"][i % 4],
      0.005,
    );
    book.rotation.z = i === 6 ? -0.18 : 0;
  }
  cylinder(architecture, 0.12, 0.23, [5.38, 4.43, -2.77], "#c1a57d");
  label(
    architecture,
    "STAY CURIOUS.",
    1.35,
    0.16,
    [4.99, 3.95, -2.987],
    "#b9aa90",
    28,
  );

  // Fold stationary joinery into material batches. Keep only the things that
  // move or answer a click as separate objects; phones should not submit one
  // draw call for every pencil, book, plank and chair leg.
  const animatedRoots = new Set<Object3D>([
    floor,
    architecture,
    furniture,
    frame,
    tabletop,
    platter,
    armPivot,
  ]);
  const independent = new Set<Object3D>([
    ...selectables.map((s) => s.object),
    bulb,
    pool,
    printPaper,
  ]);
  const batchStatic = (parent: Object3D) => {
    parent.updateWorldMatrix(true, true);
    const inverse = parent.matrixWorld.clone().invert();
    const batches = new Map<MeshBasicMaterial, Mesh[]>();
    const collect = (object: Object3D) => {
      if (object !== parent && animatedRoots.has(object)) return;
      if (
        object instanceof Mesh &&
        !(object instanceof InstancedMesh) &&
        !independent.has(object) &&
        object.material instanceof MeshBasicMaterial &&
        !object.material.transparent
      ) {
        const bucket = batches.get(object.material) ?? [];
        bucket.push(object);
        batches.set(object.material, bucket);
      }
      object.children.forEach(collect);
    };
    collect(parent);
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => {
        const part = mesh.geometry.index
          ? mesh.geometry.toNonIndexed()
          : mesh.geometry.clone();
        return part.applyMatrix4(
          new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld),
        );
      });
      const merged = mergeGeometries(parts, false);
      parts.forEach((part) => part.dispose());
      if (!merged) continue;
      geometries.add(merged);
      const batch = new Mesh(merged, material);
      batch.name = "atelier_static_joinery";
      parent.add(batch);
      meshes.forEach((mesh) => mesh.removeFromParent());
    }
  };
  animatedRoots.forEach(batchStatic);

  const refresh = (state: AtelierState) => {
    if (
      lastStudy !== state.study ||
      lastPalette !== state.palette ||
      lastWire !== state.wireframe
    ) {
      drawAtelierArt(artCanvas, state.study, state.palette, state.wireframe);
      artTexture.needsUpdate = true;
      lastStudy = state.study;
      lastPalette = state.palette;
      lastWire = state.wireframe;
      const p = ATELIER_PALETTES[state.palette % 3];
      inkWells.forEach(
        (m, i) =>
          m.material instanceof MeshBasicMaterial &&
          m.material.color
            .set([p.accent, p.ink, p.secondary][i])
            .convertLinearToSRGB(),
      );
    }
    pool.visible = state.lamp;
    bulb.visible = state.lamp;
  };

  return {
    root,
    selectables,
    refresh,
    recordAnchor: console,
    reveal() {
      if (revealed) return;
      revealed = true;
      if (reduced.matches) return;
      floor.scale.x = 0.001;
      architecture.scale.y = 0.001;
      furniture.scale.y = 0.001;
      const timeline = createTimeline({ defaults: { ease: "out(3)" } })
        .add(floor.scale, { x: 1, duration: 850 }, 0)
        .add(architecture.scale, { y: 1, duration: 700 }, 260)
        .add(furniture.scale, { y: 1, duration: 550 }, 480);
      motions.add(timeline);
    },
    print(onComplete: () => void) {
      printAnimation?.pause();
      printPaper.visible = true;
      printPaper.position.z = 0.36;
      printPaper.scale.y = 0.01;
      if (reduced.matches) {
        printPaper.position.z = 0.77;
        printPaper.scale.y = 0.47;
        onComplete();
        return;
      }
      printAnimation = createTimeline({ defaults: { ease: "inOut(2)" } })
        .add(printPaper.scale, { y: 0.47, duration: 900 }, 0)
        .add(printPaper.position, { z: 0.77, duration: 900 }, 0)
        .call(() => {
          if (!disposed) onComplete();
        });
    },
    pulse(action: AtelierAction) {
      if (reduced.matches) return;
      const target =
        action === "study"
          ? frame
          : action === "palette"
            ? tabletop
            : undefined;
      if (target) {
        pulseAnimation?.pause();
        frame.scale.setScalar(1);
        tabletop.scale.setScalar(1);
        pulseAnimation = animate(target.scale, {
          x: [0.985, 1],
          y: [0.985, 1],
          z: [0.985, 1],
          duration: 260,
          ease: "out(3)",
        });
      }
    },
    setSound(on: boolean) {
      recordOn = on;
      armPivot.rotation.y = on ? 0.29 : 0;
    },
    update(delta: number) {
      if (recordOn && !reduced.matches && !document.hidden)
        platter.rotation.y += Math.min(delta, 50) * 0.00349;
    },
    save() {
      artCanvas.toBlob((blob) => {
        if (!blob || disposed) return;
        const url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = `mohith-form-study-${lastStudy + 1}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    },
    dispose() {
      disposed = true;
      printAnimation?.pause();
      pulseAnimation?.pause();
      motions.forEach((m) => m.pause());
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
