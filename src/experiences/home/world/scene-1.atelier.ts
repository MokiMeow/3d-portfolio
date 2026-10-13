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
  Texture,
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

// Surveyed from the baked room, including its tile thickness.
const FLOOR = 0.341;

/** One continuous home: workbench and a small listening bay, present at startup. */
export function createAtelier(
  scene: Group,
  act: (action: AtelierAction) => void,
  finishes: { room?: Texture; wood?: Texture; night: { value: number } },
) {
  const root = new Group();
  root.name = "mohith_atelier";
  root.position.x = 3.02;
  scene.add(root);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<MeshBasicMaterial>();
  const textures = new Set<CanvasTexture>();
  const selectables: SelectableObject[] = [];
  const floor = new Group(),
    architecture = new Group(),
    furniture = new Group();
  root.add(floor, architecture, furniture);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    lastStudy = -1,
    lastPalette = -1,
    lastWire = false;
  let recordOn = false;
  let printAnimation: { pause: () => unknown } | undefined;
  let pulseAnimation: { pause: () => unknown } | undefined;
  const ink = "#292d2c",
    walnut = "#895d44",
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
  const lightMaterial = (material: MeshBasicMaterial) => {
    // Match the original room's day/night shader, with no extra realtime lights.
    material.onBeforeCompile = shader => {
      shader.uniforms.uRoomNight = finishes.night;
      shader.fragmentShader = 'uniform float uRoomNight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight *= mix(vec3(1.0), vec3(0.12, 0.16, 0.3), uRoomNight);\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = () => 'connected-home-night-v1';
    materials.add(material);
    return material;
  };
  const mat = (color: string, shaded = true) => {
    const key = color + shaded;
    if (materialCache.has(key)) return materialCache.get(key)!;
    // The existing room deliberately renders in linear output space.
    const material = new MeshBasicMaterial({
      color: new Color(color).convertLinearToSRGB(),
      vertexColors: shaded,
    });
    lightMaterial(material);
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
    lightMaterial(material);
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

  // Use clean regions of the room's existing baked atlases. All samples are
  // generated once, using the resources already downloaded by the loader.
  const sample = (source: Texture | undefined, crop: number[], fallback: string) =>
    canvasTexture(256, 256, ctx => {
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, 256, 256);
      if (source?.image) {
        const image = source.image as HTMLImageElement;
        ctx.drawImage(image, crop[0] * image.width, crop[1] * image.height,
          crop[2] * image.width, crop[3] * image.height, 0, 0, 256, 256);
      }
    });
  const woodMap = sample(finishes.wood, [.725, .105, .13, .11], "#825039");
  const woodMaterial = textured(woodMap);
  woodMaterial.vertexColors = true;
  for (const color of [walnut, "#8f7354", "#aa8460", "#9c6648"])
    materialCache.set(color + true, woodMaterial);
  const tileMaterial = textured(sample(finishes.room, [.133, .395, .096, .091], "#625b59"));
  // The join falls on an existing grout line. Both slabs start at y=.018,
  // both tile surfaces end at .341; there is no step or raised platform.
  box(floor, [6.24, .295, 6.48], [3.12, .1655, .125], "#363334");
  box(floor, [4.68, .295, 4.635], [3.9, .1655, 5.6825], "#363334");
  const matrix = new Matrix4();
  const tiles = new InstancedMesh(geo(new BoxGeometry(1.551, .027, 1.536), false), tileMaterial, 25);
  let tileIndex = 0;
  for (let row = 0; row < 7; row++) {
    for (let col = row < 4 ? 0 : 1; col < 4; col++) {
      matrix.makeTranslation(.78 + col * 1.56, FLOOR - .0135, -2.0425 + row * 1.545);
      tiles.setMatrixAt(tileIndex++, matrix);
    }
  }
  floor.add(tiles);
  // Broad, soft contact shadows anchor both wings to the same ground plane.
  shadow(floor, 3.1, .2, 8.2, 8.7, .019);
  shadow(floor, 3.9, 5.65, 6.8, 6.4, .02);

  const wallMap = canvasTexture(512, 512, ctx => {
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, "#4d4a49"); g.addColorStop(.55, "#5c5856"); g.addColorStop(1, "#47413f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    // Low contrast plaster grain, deterministic and baked once.
    for (let i = 0; i < 5000; i++) {
      const x = (i * 193) % 512, y = (i * 73 + Math.floor(i / 512) * 37) % 512;
      ctx.fillStyle = i % 2 ? "#ffffff03" : "#00000004";
      ctx.fillRect(x, y, 1, 1);
    }
    const base = ctx.createLinearGradient(0, 390, 0, 512);
    base.addColorStop(0, "#0000"); base.addColorStop(1, "#0007");
    ctx.fillStyle = base; ctx.fillRect(0, 390, 512, 122);
  });
  const wallMaterial = textured(wallMap);
  box(architecture, [6.24, 5.59, .3], [3.12, 3.1075, -2.965], "#484443");
  panel(architecture, 6.24, 5.56, [3.12, 3.1075, -2.808], wallMaterial);
  box(architecture, [6.24, .235, .055], [3.12, .45, -2.779], walnut);
  box(architecture, [6.24, .09, .37], [3.12, 5.856, -2.96], "#353334");
  // A short return wall gives the workbench a corner. The rest is cut away
  // at sill height, preserving a clear view into the connected listening bay.
  box(architecture, [.19, 5.56, 1.12], [6.145, 3.1075, -2.28], "#494645");
  box(architecture, [.17, 1.05, 9.62], [6.155, FLOOR + .525, 3.075], "#55504e");
  box(architecture, [.23, .065, 9.62], [6.145, FLOOR + 1.08, 3.075], walnut);
  box(architecture, [.055, .235, 10.68], [6.045, .45, 2.535], walnut);

  // The source was a two-wall cutaway, so its outer faces were never needed
  // by the old quarter-turn camera. Close those backs for a complete orbit,
  // keeping the original window opening and every interior surface intact.
  box(architecture, [.026, 5.88, 6.48], [-6.543, 2.958, .125], "#454242");
  box(architecture, [4.775, 5.88, .025], [-4.1625, 2.958, -3.099], "#454242");
  box(architecture, [1.775, 1.56, .025], [-.8875, .798, -3.099], "#454242");
  box(architecture, [1.775, .76, .025], [-.8875, 5.522, -3.099], "#454242");
  box(architecture, [.16, 3.564, .025], [-.08, 3.36, -3.099], "#454242");

  // Warm light falls from practical shelf strips, like the original desk.
  const wash = canvasTexture(128, 256, ctx => {
    const g = ctx.createRadialGradient(64, 0, 3, 64, 0, 240);
    g.addColorStop(0, "#ffa441b0"); g.addColorStop(.3, "#d9733638"); g.addColorStop(1, "#de702000");
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 256);
  });
  const wallWashMaterial = textured(wash, true);
  panel(architecture, 3.25, 2.8, [3.14, 3.34, -2.795], wallWashMaterial);
  panel(architecture, 1.5, 1.7, [5.03, 3.56, -2.795], wallWashMaterial);
  box(architecture, [1.2, .014, .14], [5.03, 4.417, -2.55], "#edb67b");

  // A built-in materials bench along the back wall: storage belongs here,
  // with the printer at its left end and a clear aisle around the drawing desk.
  box(furniture, [4.1, .91, .85], [3.82, FLOOR + .455, -2.32], "#272626", .025);
  box(furniture, [4.16, .065, .97], [3.82, FLOOR + .948, -2.3], walnut, .015);
  for (let i = 0; i < 4; i++) {
    const x = 2.28 + i * 1.02;
    box(furniture, [.955, .77, .035], [x, FLOOR + .48, -1.875], "#3e3936", .009);
    box(furniture, [.26, .024, .047], [x, FLOOR + .8, -1.838], "#a39586", .007);
  }
  // Paper stock lies beside the press; samples and tools have a home.
  for (let i = 0; i < 5; i++)
    box(furniture, [.72, .018, .5], [2.12, FLOOR + .996 + i * .019, -2.25], i % 2 ? "#bba994" : "#cabba5");
  box(furniture, [.53, .12, .4], [5.18, FLOOR + 1.04, -2.27], walnut, .012);
  for (let i = 0; i < 4; i++)
    box(furniture, [.05, .27 + i * .025, .045], [5.02 + i * .09, FLOOR + 1.24, -2.27], ["#a85c3d", "#34484e", "#d0b681", "#292a2b"][i]);
  shadow(furniture, 3.8, -2.15, 4.5, 1.65);

  // One original composition becomes three physical things: the wall print,
  // the paper on the drawing desk, and the postcard coming out of the press.
  const artCanvas = document.createElement("canvas");
  artCanvas.width = 1400;
  artCanvas.height = 980;
  const artTexture = new CanvasTexture(artCanvas);
  textures.add(artTexture);
  const artMat = textured(artTexture);
  artMat.color.setRGB(.84, .82, .8);
  const frame = new Group();
  frame.position.set(3.14, 3.66, -2.725);
  frame.scale.setScalar(.88);
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
    ctx.fillStyle = "#474645";
    ctx.fillRect(0, 0, 384, 384);
    for (let y = 0; y < 384; y += 3) {
      ctx.strokeStyle = y % 9 ? "#8b858130" : "#191b1b45";
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(384, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#9e8f7f";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 348, 348);
    ctx.strokeRect(24, 24, 336, 336);
  });
  const rug = panel(
    furniture,
    4.14,
    3.9,
    [3.86, FLOOR + 0.006, 5.64],
    textured(rugMap),
  );
  rug.rotation.x = -Math.PI / 2;
  shadow(furniture, 2.97, .65, 3.3, 2.55);

  // A drafting table, including joinery, leaning paper, rule, pencil and
  // clickable ceramic ink wells. The artwork responds in the room itself.
  const table = new Group();
  table.position.set(2.97, FLOOR, .65);
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
  stool.position.set(2.97, FLOOR, 2.18);
  furniture.add(stool);
  shadow(furniture, 2.97, 2.18, 1.25, 1.25);
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
  cylinder(stool, 0.36, 0.08, [0, 0.87, 0], "#4c4846");
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
  press.position.set(.96, FLOOR, -2.22);
  press.scale.set(1.12, 1.12, 1.12);
  furniture.add(press);
  shadow(furniture, .96, -2.16, 1.5, 1.6);
  box(press, [0.98, 0.78, 0.87], [0, 0.4, 0], "#373332", 0.03);
  for (let i = 0; i < 3; i++) {
    box(
      press,
      [0.89, 0.18, 0.017],
      [0, 0.2 + i * 0.2, 0.447],
      "#665045",
      0.012,
    );
    box(press, [0.25, 0.014, 0.038], [0, 0.23 + i * 0.2, 0.47], ink);
  }
  box(press, [1.09, 0.37, 0.92], [0, 0.96, 0], "#aaa39b", 0.06);
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
    "#bfb4a4",
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
  console.position.set(2.17, FLOOR, 5.95);
  console.rotation.y = Math.PI / 2;
  furniture.add(console);
  shadow(furniture, 2.17, 5.95, 1.3, 2.1);
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
  sofa.position.set(5.12, FLOOR, 5.3);
  sofa.scale.setScalar(1.2);
  furniture.add(sofa);
  shadow(furniture, 5.12, 5.3, 2.05, 3.65);
  for (const x of [-0.5, 0.5])
    for (const z of [-1.01, 1.01])
      cylinder(sofa, 0.035, 0.19, [x, 0.095, z], ink);
  box(sofa, [1.38, 0.21, 2.58], [0, 0.3, 0], walnut, 0.06);
  box(sofa, [0.2, 0.77, 2.54], [0.61, 0.7, 0], "#464748", 0.07);
  for (const z of [-1.16, 1.16])
    box(sofa, [1.35, 0.3, 0.23], [0, 0.65, z], "#464748", 0.07);
  for (const z of [-0.55, 0.55]) {
    box(sofa, [1.1, 0.24, 1.03], [-0.065, 0.52, z], "#686260", 0.09);
    const cushion = box(
      sofa,
      [0.28, 0.52, 0.79],
      [0.32, 0.89, z],
      z < 0 ? "#b6906c" : "#8c8986",
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
  sideTable.position.set(3.98, FLOOR, 6.85);
  furniture.add(sideTable);
  shadow(furniture, 3.98, 6.85, 1.1, 1.1);
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
  lamp.position.set(5.61, FLOOR, 7.05);
  furniture.add(lamp);
  shadow(furniture, 5.61, 7.05, 1.2, 1.2);
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
    [5.12, FLOOR + 0.025, 6.67],
    textured(lampPool, true),
  );
  pool.rotation.x = -Math.PI / 2;

  // Tall plant, books and material samples add scale without occupying the
  // walking space. Repeated leaves and book spines share their geometry.
  const plant = new Group();
  plant.position.set(5.55, FLOOR, -.88);
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
    [5.03, 4.46, -2.55],
    walnut,
    0.02,
  );
  for (let i = 0; i < 7; i++) {
    const book = box(
      architecture,
      [0.075 + 0.01 * (i % 2), 0.35 + 0.04 * (i % 3), 0.23],
      [4.53 + i * 0.093, 4.68, -2.54],
      ["#a39b82", "#b57451", "#596f67", "#c6b692"][i % 4],
      0.005,
    );
    book.rotation.z = i === 6 ? -0.18 : 0;
  }
  cylinder(architecture, 0.12, 0.23, [5.47, 4.63, -2.54], "#c1a57d");
  // A low bookcase defines the listening nook without closing the view.
  // Its open end is the passage from the design bench into the new bay.
  const bookcase = new Group();
  bookcase.position.set(1.71, FLOOR, 5.9);
  furniture.add(bookcase);
  for (const z of [-1.42, 1.42]) box(bookcase, [.39, 1.3, .065], [0, .65, z], walnut);
  for (const y of [.06, .65, 1.3]) box(bookcase, [.42, .055, 2.9], [0, y, 0], walnut);
  box(bookcase, [.038, 1.28, 2.86], [.17, .66, 0], "#2a2725");
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 12; i++) {
      const h = .29 + (i % 4) * .042;
      const book = box(bookcase, [.28, h, .09], [-.035, .097 + row * .59 + h / 2, -1.2 + i * .118],
        ["#81513c", "#b6a589", "#354c56", "#3a3939", "#887a65"][i % 5], .003);
      if (i === 11) book.rotation.x = -.13;
    }
  }
  shadow(furniture, 1.71, 5.9, .85, 3.3);

  // Small pinned process sketches over the printer, rather than wall signage.
  const sketches = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = "#bba994"; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "#51483f"; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = 40 + i % 2 * 240, y = 55 + Math.floor(i / 2) * 240;
      ctx.strokeRect(x, y, 175, 155);
      ctx.beginPath(); ctx.moveTo(x + 10, y + 30); ctx.lineTo(x + 150, y + 30); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 85, y + 90, 39 - i * 4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 25, y + 130); ctx.lineTo(x + 145, y + 60); ctx.stroke();
    }
  });
  const processSketch = panel(architecture, 1.12, 1.23, [.88, 3.55, -2.76], textured(sketches));
  processSketch.rotation.z = -.035;
  clickable(processSketch, "wireframe");
  cylinder(architecture, .026, .022, [.88, 4.1, -2.73], "#b78652").rotation.x = Math.PI / 2;

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
        frame.scale.setScalar(.88);
        tabletop.scale.setScalar(1);
        pulseAnimation = animate(target.scale, {
          x: [target === frame ? .867 : .985, target === frame ? .88 : 1],
          y: [target === frame ? .867 : .985, target === frame ? .88 : 1],
          z: [target === frame ? .867 : .985, target === frame ? .88 : 1],
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
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
