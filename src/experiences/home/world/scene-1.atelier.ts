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
  MeshStandardMaterial,
  HemisphereLight,
  DirectionalLight,
  PMREMGenerator,
  WebGLRenderer,
  LatheGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Vector3,
  RepeatWrapping,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { animate, createTimeline } from "animejs";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import type {
  AtelierAction,
  AtelierState,
} from "~/common/models/atelier.model";
import { ATELIER_PALETTES, drawAtelierArt } from "./atelier-art";
import roomTile from "./room-tile.json";

// Surveyed from the baked room, including its tile thickness.
const FLOOR = 0.339813;
type SurfaceMaterial = MeshBasicMaterial | MeshStandardMaterial;

/** One continuous home: workbench and a small listening bay, present at startup. */
export function createAtelier(
  scene: Group,
  act: (action: AtelierAction) => void,
  finishes: { room?: Texture; wood?: Texture; night: { value: number }; renderer: WebGLRenderer },
) {
  const root = new Group();
  root.name = "mohith_atelier";
  root.position.x = 3.02;
  scene.add(root);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<SurfaceMaterial>();
  const textures = new Set<CanvasTexture>();
  const selectables: SelectableObject[] = [];
  const floor = new Group(),
    architecture = new Group(),
    furniture = new Group();
  root.add(floor, architecture, furniture);
  // Small local reflection probe; the original baked room is untouched.
  const environment = new RoomEnvironment();
  const pmrem = new PMREMGenerator(finishes.renderer);
  const probe = pmrem.fromScene(environment, .04);
  environment.dispose();
  pmrem.dispose();
  root.add(new HemisphereLight(0xffeee0, 0x595b61, 1.15));
  const key = new DirectionalLight(0xffeedb, 1.65);
  key.position.set(-3, 8, 5);
  const fill = new DirectionalLight(0xdce8ff, .55);
  fill.position.set(4, 5, -4);
  root.add(key, key.target, fill, fill.target);
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
    if (shaded && !geometry.getAttribute("normal")) geometry.computeVertexNormals();
    return geometry;
  };
  const materialCache = new Map<string, SurfaceMaterial>();
  const lightMaterial = <T extends SurfaceMaterial>(material: T): T => {
    // Share the original switch's day/night tint across baked and PBR surfaces.
    material.onBeforeCompile = shader => {
      shader.uniforms.uRoomNight = finishes.night;
      shader.fragmentShader = 'uniform float uRoomNight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
        'outgoingLight *= mix(vec3(1.0), vec3(0.12, 0.16, 0.3), uRoomNight);\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey = () => 'connected-home-night-v2';
    materials.add(material);
    return material;
  };
  const mat = (color: string, shaded = true) => {
    const key = color + shaded;
    if (materialCache.has(key)) return materialCache.get(key)!;
    // The existing room deliberately renders in linear output space.
    const metal = [brass, "#ad997a", "#a39586", "#7b887f"].includes(color);
    const material = new MeshStandardMaterial({
      color: new Color(color).convertLinearToSRGB(),
      roughness: metal ? .32 : .72,
      metalness: metal ? .65 : 0,
      envMap: probe.texture,
      envMapIntensity: .22,
    });
    lightMaterial(material);
    materialCache.set(key, material);
    return material;
  };
  const boxGeo = geo(new BoxGeometry(1, 1, 1));
  const planeGeo = geo(new PlaneGeometry(1, 1), false);
  const cylinderGeo = geo(new CylinderGeometry(1, 1, 1, 32));
  const sphereGeo = geo(new SphereGeometry(1, 24, 16));
  const box = (
    parent: Object3D,
    size: number[],
    position: number[],
    color: string,
    radius = 0,
  ) => {
    const geometry = radius
      // Spend segments on visible curves, not millimetre-sized book edges.
      ? geo(new RoundedBoxGeometry(size[0], size[1], size[2], radius >= .04 ? 3 : 1, radius))
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
    texture.anisotropy = Math.min(8, finishes.renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    return texture;
  };
  const textured = (texture: Texture, transparent = false) => {
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
    material: SurfaceMaterial,
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

  const lathe = (parent: Object3D, profile: number[][], position: number[], color: string) => {
    const geometry = geo(new LatheGeometry(profile.map(p => new Vector2(p[0], p[1])), 48));
    if (color === walnut) {
      const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
      const diameter = Math.max(...profile.map(p => p[0])) * 2;
      for (let i = 0; i < p.count; i++) if (Math.abs(n.getY(i)) > .82)
        uv.setXY(i, .5 + p.getX(i) / diameter, .5 + p.getZ(i) / diameter);
    }
    const mesh = new Mesh(geometry, mat(color));
    mesh.position.fromArray(position); parent.add(mesh); return mesh;
  };
  const tube = (parent: Object3D, points: number[][], radius: number, color: string, closed = false) => {
    const path = new CatmullRomCurve3(points.map(p => new Vector3().fromArray(p)), closed, "centripetal");
    const mesh = new Mesh(geo(new TubeGeometry(path, Math.max(16, points.length * 5), radius, 6, closed)), mat(color));
    parent.add(mesh); return mesh;
  };
  const seam = (parent: Object3D, width: number, height: number, radius: number, color: string) => {
    const points: number[][] = [];
    for (let corner = 0; corner < 4; corner++) {
      const sx = corner === 0 || corner === 3 ? 1 : -1, sy = corner < 2 ? 1 : -1;
      for (let j = 0; j < 8; j++) {
        const a = corner * Math.PI / 2 + j / 8 * Math.PI / 2;
        points.push([sx * (width / 2 - radius) + Math.cos(a) * radius,
          sy * (height / 2 - radius) + Math.sin(a) * radius, 0]);
      }
    }
    return tube(parent, points, .0025, color, true);
  };
  const screw = (parent: Object3D, position: number[], front = false) => {
    const group = new Group(); group.position.fromArray(position);
    if (front) group.rotation.x = Math.PI / 2;
    parent.add(group);
    cylinder(group, .015, .005, [0, 0, 0], brass);
    box(group, [.018, .002, .003], [0, .003, 0], "#46413b");
  };
  // Shared woven material: visible thread at close range, mipmapped at distance.
  const linen = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = "#c6c2b9"; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 512; i += 4) {
      ctx.fillStyle = i % 8 ? "#ece8dc88" : "#827c7255";
      ctx.fillRect(i, 0, 1, 512); ctx.fillRect(0, i, 512, 1);
      for (let j = 0; j < 512; j += 8) {
        ctx.fillStyle = (i + j) % 16 ? "#fffaed55" : "#625c5240";
        ctx.fillRect(i, j, 2, 2);
      }
    }
  });
  linen.wrapS = linen.wrapT = RepeatWrapping;
  linen.repeat.set(3, 3);
  for (const color of ["#464748", "#686260", "#b6906c", "#8c8986", "#c0b6a0", "#cbb78f", "#b6ad98", "#9b9d85", "#687562"]) {
    const material = lightMaterial(new MeshStandardMaterial({
      color: new Color(color).convertLinearToSRGB(), map: linen, bumpMap: linen,
      bumpScale: .004, roughness: .96, envMap: probe.texture, envMapIntensity: .12,
      side: DoubleSide,
    }));
    materialCache.set(color + true, material);
  }
  const bookSpines = canvasTexture(1024, 512, ctx => {
    const titles = ["WAYS OF SEEING", "FORM & FIELD", "GRID SYSTEMS", "DESIGN NOTES", "TYPE / SPACE", "COLOUR STUDIES", "THE CREATIVE ACT", "OBJECTS"];
    const colors = ["#81513c", "#b6a589", "#354c56", "#3a3939", "#887a65"];
    for (let i = 0; i < 8; i++) {
      const x = i * 128;
      ctx.fillStyle = colors[i % 5]; ctx.fillRect(x, 0, 128, 512);
      const edge = ctx.createLinearGradient(x, 0, x + 128, 0);
      edge.addColorStop(0, "#0004"); edge.addColorStop(.15, "#fff1"); edge.addColorStop(.82, "#0000"); edge.addColorStop(1, "#0005");
      ctx.fillStyle = edge; ctx.fillRect(x, 0, 128, 512);
      ctx.fillStyle = "#d7c6a1"; ctx.fillRect(x + 12, 34, 104, 3); ctx.fillRect(x + 12, 470, 104, 3);
      ctx.save(); ctx.translate(x + 74, 430); ctx.rotate(-Math.PI / 2);
      ctx.font = "22px Georgia"; ctx.fillText(titles[i], 0, 0); ctx.restore();
      ctx.font = "18px Georgia"; ctx.fillText(String(i + 1).padStart(2, "0"), x + 52, 500);
    }
  });
  const bookSpineMat = textured(bookSpines);
  const book = (parent: Object3D, w: number, h: number, d: number, position: number[], index: number) => {
    const group = new Group(); group.position.fromArray(position); parent.add(group);
    const color = ["#81513c", "#b6a589", "#354c56", "#3a3939", "#887a65"][index % 5];
    for (const x of [-w / 2 + .003, w / 2 - .003])
      box(group, [.006, h, d], [x, 0, 0], color, .002);
    box(group, [w, h, .012], [0, 0, d / 2 - .006], color, .003);
    box(group, [w - .012, h - .018, d - .025], [0, 0, -.008], "#ad9f85", .001);
    for (let i = 0; i < 6; i++)
      box(group, [w - .013, .001, d - .028], [0, h * .47 - i * .003, -.009], "#81765f");
    const geometry = geo(new PlaneGeometry(w, h));
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setX(i, (index % 8 + uv.getX(i)) / 8);
    const spine = new Mesh(geometry, bookSpineMat); spine.position.z = d / 2 + .001; group.add(spine);
    return group;
  };

  // Keep the atlas at its native texel density; never enlarge a tiny crop.
  const sample = (source: Texture | undefined, crop: number[], fallback: string) =>
    canvasTexture(512, 512, ctx => {
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, 512, 512);
      if (source?.image) {
        const image = source.image as HTMLImageElement;
        ctx.drawImage(image, crop[0] * image.width, crop[1] * image.height,
          crop[2] * image.width, crop[3] * image.height, 0, 0, 512, 512);
      }
    });
  // Clear desktop grain: exclude baked headphones, cables and object shadows.
  const woodMap = sample(finishes.wood, [.12, .80, .25, .065], "#825039");
  const woodMaterial = lightMaterial(new MeshStandardMaterial({ map: woodMap,
    roughness: .52, envMap: probe.texture, envMapIntensity: .18 }));
  for (const color of [walnut, "#8f7354", "#aa8460", "#9c6648"])
    materialCache.set(color + true, woodMaterial);
  const plaster = canvasTexture(512, 512, ctx => {
    const pixels = ctx.createImageData(512, 512);
    let seed = 29;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = 226 + (seed >>> 28);
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = grain;
      pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  });
  plaster.wrapS = plaster.wrapT = RepeatWrapping; plaster.repeat.set(8, 8);
  for (const color of ["#514d4a", "#484443", "#494645", "#55504e"]) {
    materialCache.set(color + true, lightMaterial(new MeshStandardMaterial({
      color: new Color(color).convertLinearToSRGB(), map: plaster, bumpMap: plaster,
      bumpScale: .008, roughness: .96, envMap: probe.texture, envMapIntensity: .18,
    })));
  }
  const tileMaterial = finishes.room ? textured(finishes.room) : mat("#625b59");
  if (finishes.room) finishes.room.anisotropy = Math.min(8, finishes.renderer.capabilities.getMaxAnisotropy());
  // The join falls on an existing grout line. Both slabs start at y=.018,
  // both tile surfaces end at .341; there is no step or raised platform.
  box(floor, [6.24, .295, 6.48], [3.12, .1655, .125], "#363334");
  box(floor, [4.68, .295, 4.635], [3.9, .1655, 5.6825], "#363334");
  const matrix = new Matrix4();
  // Measured from the source GLB: 1.5345 x 1.521 spacing, .0289 grout.
  // UVs and face positions are copied from a clean original tile, not guessed.
  const tileTop = geo(new BufferGeometry());
  tileTop.setAttribute("position", new Float32BufferAttribute(roomTile.position, 3));
  tileTop.setAttribute("uv", new Float32BufferAttribute(roomTile.uv, 2));
  tileTop.computeVertexNormals();
  const tiles = new InstancedMesh(tileTop, tileMaterial, 25);
  const tileEdges = new InstancedMesh(geo(new RoundedBoxGeometry(1.527, .027, 1.513, 1, .01)), mat("#4d4845"), 25);
  let tileIndex = 0;
  for (let row = 0; row < 7; row++) {
    for (let col = row < 4 ? 0 : 1; col < 4; col++) {
      matrix.makeTranslation(.768 + col * 1.5345, FLOOR, -1.9577 + row * 1.521);
      tiles.setMatrixAt(tileIndex, matrix);
      matrix.elements[13] = FLOOR - .015;
      tileEdges.setMatrixAt(tileIndex++, matrix);
    }
  }
  floor.add(tiles, tileEdges);
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
  box(architecture, [.065, 5.885, 6.52], [-6.581, 2.96, .125], "#514d4a");
  box(architecture, [4.835, 5.885, .065], [-4.1925, 2.96, -3.149], "#514d4a");
  box(architecture, [1.795, 1.56, .065], [-.8775, .798, -3.149], "#514d4a");
  box(architecture, [1.795, .76, .065], [-.8775, 5.522, -3.149], "#514d4a");
  box(architecture, [.18, 3.564, .065], [-.07, 3.36, -3.149], "#514d4a");
  box(architecture, [6.24, 5.885, .065], [3.12, 2.96, -3.149], "#514d4a");
  // Continuous plinth, coping and window reveals also finish the reverse view.
  box(architecture, [12.85, .15, .38], [-.185, .095, -2.995], "#393735", .009);
  box(architecture, [12.85, .075, .39], [-.185, 5.904, -2.995], "#484543", .008);
  box(architecture, [.4, .075, 6.52], [-6.42, 5.904, .125], "#484543", .008);
  box(architecture, [.09, .15, 6.52], [-6.59, .095, .125], "#393735", .006);
  for (const x of [-1.785, -.157])
    box(architecture, [.063, 3.61, .31], [x, 3.36, -2.995], "#53504c", .004);
  for (const y of [1.569, 5.148])
    box(architecture, [1.69, .065, .32], [-.97, y, -3.0], "#53504c", .004);
  box(architecture, [1.84, .09, .43], [-.97, 1.533, -3.06], "#656059", .01);
  // The source window has interior-only frame faces. Give its exterior the
  // same five-bay sash, including the upper transom, rather than bare glass.
  for (const x of [-1.785, -.157])
    box(architecture, [.064, 3.61, .055], [x, 3.36, -3.205], "#676058", .004);
  for (const y of [1.569, 5.148])
    box(architecture, [1.69, .064, .055], [-.971, y, -3.205], "#676058", .004);
  box(architecture, [.043, 3.039, .055], [-.967, 3.0975, -3.205], "#676058", .003);
  for (const y of [2.186, 2.794, 3.402, 4.010, 4.618])
    box(architecture, [1.615, .047, .055], [-.967, y, -3.205], "#676058", .003);
  box(architecture, [.075, 5.84, .075], [6.22, 2.95, -3.1], "#514d4a", .006);

  // Warm light falls from practical shelf strips, like the original desk.
  const wash = canvasTexture(128, 256, ctx => {
    ctx.translate(64, 0); ctx.scale(1, 4);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 64);
    g.addColorStop(0, "#ffa441b0"); g.addColorStop(.3, "#d9733638"); g.addColorStop(1, "#de702000");
    ctx.fillStyle = g; ctx.fillRect(-64, 0, 128, 64);
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
  lathe(furniture, [[0, 0], [.115, 0], [.13, .02], [.13, .24], [.116, .247], [.112, .235], [.112, .025], [0, .025]],
    [5.18, FLOOR + .981, -2.27], "#7a8a7a");
  for (let i = 0; i < 5; i++) {
    const x = 5.13 + (i % 3) * .043, z = -2.31 + Math.floor(i / 3) * .07, h = .34 + i * .019;
    const pencil = new Mesh(geo(new CylinderGeometry(.016, .016, h, 6)),
      mat(["#a85c3d", "#34484e", "#d0b681", "#292a2b", "#7c846b"][i]));
    pencil.position.set(x, FLOOR + .995 + h / 2, z); furniture.add(pencil);
    lathe(furniture, [[.016, 0], [.004, .042], [0, .05]], [x, FLOOR + .995 + h, z], "#c2a27a");
    ball(furniture, [.003, .009, .003], [x, FLOOR + 1.045 + h, z], "#292a2b");
  }
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
    for (const z of [-.56, .56]) {
      cylinder(table, .053, .035, [x, .024, z], "#292d2c");
      const pivot = cylinder(table, .054, .026, [x, 1.24, z], brass);
      pivot.rotation.z = Math.PI / 2;
    }
    tube(table, [[x, .27, -.56], [x, .7, -.28], [x, 1.21, .44]], .024, walnut);
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
  for (const x of [-1.19, 1.19]) for (const z of [-.8, .8]) screw(tabletop, [x, .049, z]);
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
  pencil.rotation.x = Math.PI / 2;
  lathe(tabletop, [[0, 0], [.011, .045], [.011, .052]], [.98, .085, -.285], "#c2a27a").rotation.x = Math.PI / 2;
  ball(tabletop, [.003, .003, .006], [.98, .085, -.29], "#262826");
  cylinder(tabletop, .013, .035, [.98, .085, .385], brass).rotation.x = Math.PI / 2;
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
    lathe(tabletop, [[.05, 0], [.066, 0], [.071, .005], [.071, .018], [.065, .022], [.06, .018]],
      [.92, .117, -.57 + i * .19], "#c6b692");
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
        0.76,
        [Math.cos(a) * 0.22, 0.38, Math.sin(a) * 0.22],
        walnut,
      );
    leg.rotation.z = Math.cos(a) * 0.12;
    leg.rotation.x = Math.sin(a) * 0.12;
  }
  cylinder(stool, 0.38, 0.1, [0, 0.78, 0], walnut);
  cylinder(stool, 0.36, 0.08, [0, 0.87, 0], "#4c4846");
  lathe(stool, [[.31, 0], [.355, .012], [.363, .025], [.355, .034], [.31, .045]], [0, .86, 0], "#4c4846");
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
  // Split case, scanner glass, paper guides, rollers and service fasteners.
  box(press, [1.035, .012, .872], [0, 1.052, 0], "#4a4741", .018);
  box(press, [.77, .014, .37], [-.07, 1.223, -.12], "#4b5552", .012);
  box(press, [.71, .002, .31], [-.07, 1.232, -.12], "#717d79", .009);
  box(press, [.20, .012, .14], [.15, 1.15, .28], "#333d39", .008);
  const display = canvasTexture(256, 160, ctx => {
    ctx.fillStyle = "#697b70"; ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = "#d7dfb9"; ctx.font = "22px monospace";
    ctx.fillText("FORM PRESS", 18, 34); ctx.fillText("READY  /  A6", 18, 76);
    ctx.fillRect(18, 113, 164, 3); ctx.font = "16px monospace"; ctx.fillText("600 DPI", 18, 145);
  });
  panel(press, .175, .11, [.15, 1.157, .28], textured(display)).rotation.x = -Math.PI / 2;
  for (const x of [-.34, .34]) {
    box(press, [.02, .05, .45], [x, .889, .6], "#949486", .005);
    cylinder(press, .022, .058, [x, .909, .44], "#282c29").rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 12; i++) {
    box(press, [.004, .10, .013], [.546, .95, -.30 + i * .031], "#494b45", .002);
    box(press, [.004, .10, .013], [-.546, .95, -.30 + i * .031], "#494b45", .002);
  }
  for (const x of [-.48, .48]) screw(press, [x, .979, .463], true);
  for (const x of [-.29, .29]) box(press, [.12, .037, .036], [x, 1.17, -.37], "#727367", .008);
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
  const grill = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = "#77715f"; ctx.fillRect(0, 0, 512, 512);
    for (const [y, radius] of [[186, 144], [382, 64]]) {
      const cone = ctx.createRadialGradient(256, y, 8, 256, y, radius);
      cone.addColorStop(0, "#22231bcc"); cone.addColorStop(.8, "#25251a90"); cone.addColorStop(1, "#25251a00");
      ctx.fillStyle = cone; ctx.fillRect(0, 0, 512, 512);
    }
    for (let i = 0; i < 512; i += 4) {
      ctx.fillStyle = i % 8 ? "#eee0be65" : "#18191275";
      ctx.fillRect(i, 0, 1, 512); ctx.fillRect(0, i, 512, 1);
    }
  });
  const grilleMat = lightMaterial(new MeshStandardMaterial({ map: grill,
    roughness: .95, bumpMap: grill, bumpScale: .002, envMap: probe.texture, envMapIntensity: .12 }));
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
  for (let i = 0; i < 24; i++) {
    const r = .119 + i * .0075;
    const groove = new Mesh(
      geo(new TorusGeometry(r, 0.00085, 3, 64)),
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
  lathe(console, [[.28, 0], [.317, 0], [.32, .012], [.317, .032], [.28, .035]], [-.25, 1.075, 0], brass);
  for (const x of [-.68, .68]) for (const z of [-.29, .29]) screw(console, [x, 1.103, z]);
  const armPivot = new Group();
  armPivot.position.set(0.53, 1.16, -0.23);
  console.add(armPivot);
  cylinder(armPivot, 0.065, 0.075, [0, -0.025, 0], ink);
  tube(armPivot, [[0, 0, -.07], [0, .012, .1], [.05, .006, .3], [.14, 0, .48]], .013, brass);
  cylinder(armPivot, .05, .085, [0, 0, -.075], "#72746d").rotation.x = Math.PI / 2;
  box(armPivot, [0.08, 0.04, 0.11], [0.14, -0.009, 0.48], ink, 0.007);
  tube(armPivot, [[.14, -.018, .48], [.14, -.058, .5]], .0025, brass);
  tube(armPivot, [[.18, .01, .5], [.23, .02, .5], [.25, .038, .48]], .005, brass);
  for (const x of [-.17, 0, .17]) {
    const dial = cylinder(console, .027, .016, [x, .69, .532], brass);
    dial.rotation.x = Math.PI / 2;
    box(console, [.003, .02, .003], [x, .697, .542], ink);
  }
  for (let i = 0; i < 8; i++)
    box(console, [.27, .006, .01], [0, .49 + i * .015, .529], "#5a5344");
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
    0.06,
    [0, 1.05, 0.377],
    "#ded2b7",
    23,
  );
  const sleeve = box(
    console,
    [0.47, 0.5, 0.025],
    [.45, 1.584, -.46],
    "#c2b096",
    0.01,
  );
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
    [.45, 1.584, -.444],
    textured(sleeveArt),
  );

  // Walnut sling frame, full back cushions and one gently slouched accent pillow.
  const sofa = new Group();
  sofa.position.set(5.12, FLOOR, 5.3);
  sofa.scale.setScalar(1.2);
  furniture.add(sofa);
  shadow(furniture, 5.12, 5.3, 2.05, 3.65);
  for (const x of [-0.5, 0.5])
    for (const z of [-1.01, 1.01])
      cylinder(sofa, 0.038, 0.24, [x, 0.12, z], walnut);
  box(sofa, [1.37, 0.12, 2.6], [0, 0.29, 0], walnut, 0.045);
  box(sofa, [1.22, 0.065, 2.4], [-.025, .368, 0], "#363832", .025);
  for(const y of [.55,.79,1.06])box(sofa,[.07,.105,2.46],[.615,y,0],walnut,.024);
  for (const z of [-1.19, 1.19]) {
    tube(sofa,[[-.59,.27,z],[-.61,.65,z],[-.49,.79,z],[.51,.79,z],[.61,.71,z],[.615,.3,z]],.043,walnut);
    box(sofa,[1.19,.19,.245],[-.035,.79,z],"#9b9d85",.085);
  }
  for (const z of [-0.55, 0.55]) {
    box(sofa, [1.12, 0.27, 1.035], [-0.065, 0.515, z], "#b6ad98", 0.11);
    const seatSeam = seam(sofa, .94, .85, .09, "#c0b6a0");
    seatSeam.rotation.x = -Math.PI / 2; seatSeam.position.set(-.065, .651, z);
    const cushion = box(
      sofa,
      [0.29, 0.64, 1.005],
      [0.365, 0.95, z],
      "#b6ad98",
      0.12,
    );
    cushion.rotation.z = -0.12;
    // Welt follows the pillow's softened perimeter and tilts with it.
    const welt = seam(sofa, .82, .46, .09, "#c0b6a0");
    welt.geometry.rotateY(-Math.PI / 2).translate(-.146, 0, 0).rotateZ(-.12).translate(.365, .95, z);
  }
  const accentPillow=box(sofa,[.25,.44,.48],[.08,.89,-.77],"#687562",.105);
  accentPillow.rotation.set(.17,-.1,.13);
  // A continuous draped surface, with soft folds over the seat edge.
  const blanketGeo = geo(new PlaneGeometry(1, 1, 28, 20));
  const blanketPos = blanketGeo.getAttribute("position");
  for (let i = 0; i < blanketPos.count; i++) {
    const u = blanketPos.getX(i) + .5, v = blanketPos.getY(i) + .5;
    const fold = Math.sin(v * Math.PI * 8 + u * 1.7) * .017;
    const overhang = Math.max(0, u - .72) / .28;
    const x = .24 - Math.min(u, .72) * 1.32 - Math.sin(overhang * Math.PI / 2) * .048;
    const y = .662 + fold - overhang * .40;
    blanketPos.setXYZ(i, x, y, .2 + v * .68 + u * .045);
  }
  blanketGeo.computeVertexNormals();
  sofa.add(new Mesh(blanketGeo, mat("#c0b6a0")));
  for (let i = 0; i < 16; i++) {
    const z = .245 + i * .043;
    tube(sofa, [[-.756, .263 + Math.sin(i) * .012, z], [-.77, .205, z + .004], [-.757, .187, z + .006]], .003, "#ad9f85");
  }
  const sideTable = new Group();
  sideTable.position.set(3.98, FLOOR, 6.85);
  furniture.add(sideTable);
  shadow(furniture, 3.98, 6.85, 1.1, 1.1);
  lathe(sideTable, [[0, .006], [.27, .006], [.31, .027], [.28, .055], [.105, .09], [.058, .18],
    [.055, .43], [.09, .57], [.36, .602], [.426, .614], [.438, .638], [.426, .667], [0, .674]], [0, 0, 0], walnut);
  const journal = book(sideTable, .028, .34, .25, [0, .692, 0], 1);
  journal.rotation.z = Math.PI / 2; journal.rotation.y = .15;
  const journalCover = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = "#b6a589"; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = "#42423a"; ctx.font = "22px Georgia";
    ctx.fillText("Small things,", 24, 48); ctx.fillText("observed.", 24, 76);
    ctx.strokeStyle = "#716851"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(127, 160, 53, 31, -.5, 0, Math.PI * 2); ctx.stroke();
    ctx.font = "11px monospace"; ctx.fillText("FIELD NOTES / 01", 24, 230);
  });
  const cover = panel(sideTable, .32, .23, [0, .708, 0], textured(journalCover));
  cover.rotation.set(-Math.PI / 2, 0, .15);
  lathe(sideTable, [[0, 0], [.06, 0], [.075, .012], [.079, .112], [.075, .124], [.067, .124],
    [.064, .115], [.06, .023], [0, .023]], [.12, .701, .1], "#7a8a7a");
  cylinder(sideTable, .064, .002, [.12, .798, .1], "#352e24");
  const handle = new Mesh(
    geo(new TorusGeometry(0.049, 0.01, 10, 32)),
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
  const shadeGeo = geo(new CylinderGeometry(0.26, 0.49, 0.45, 64, 1, true));
  const shade = new Mesh(shadeGeo, mat("#cbb78f"));
  shade.position.set(-0.08, 2.65, 0);
  lamp.add(shade);
  clickable(shade, "lamp");
  for (const [radius, y] of [[.26, 2.875], [.49, 2.425]]) {
    const rim = new Mesh(geo(new TorusGeometry(radius, .008, 6, 64)), mat("#b1a690"));
    rim.rotation.x = Math.PI / 2; rim.position.set(-.08, y, 0); lamp.add(rim);
  }
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    tube(lamp, [[-.08, 2.67, 0], [-.08 + Math.cos(a) * .25, 2.87, Math.sin(a) * .25]], .005, brass);
  }
  const bulb = ball(lamp, [.073, .096, .073], [-.08, 2.62, 0], "#f3dbaa");
  bulb.material = lightMaterial(new MeshBasicMaterial({ color: 0xf3dbaa }));
  cylinder(lamp, .041, .095, [-.08, 2.51, 0], brass);
  tube(lamp, [[0, .065, 0], [-.2, .02, -.03], [-.34, .018, -.14], [-.4, .017, -.44]], .008, "#292d2c");
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
  lathe(plant, [[0, .01], [.158, .01], [.177, .025], [.224, .407], [.236, .412], [.236, .443],
    [.214, .45], [.208, .438], [.207, .41], [.163, .065], [0, .065]], [0, 0, 0], "#a57857");
  lathe(plant, [[0, .01], [.215, .01], [.235, .02], [.237, .035], [.218, .048], [0, .048]], [0, 0, 0], "#906245");
  cylinder(plant, 0.207, 0.012, [0, 0.411, 0], "#3b352b");
  const leafTexture = canvasTexture(256, 512, ctx => {
    ctx.fillStyle = "#81957b"; ctx.fillRect(0, 0, 256, 512);
    ctx.strokeStyle = "#bac6a455"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(128, 0); ctx.lineTo(128, 512); ctx.stroke();
    for (let y = 30; y < 510; y += 26) {
      ctx.beginPath(); ctx.moveTo(128, y); ctx.quadraticCurveTo(190, y + 5, 256, y + 47); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(128, y); ctx.quadraticCurveTo(65, y + 5, 0, y + 47); ctx.stroke();
    }
  });
  const leafMaterial = lightMaterial(new MeshStandardMaterial({ map: leafTexture,
    color: new Color("#b3c697").convertLinearToSRGB(), roughness: .58, side: DoubleSide,
    envMap: probe.texture, envMapIntensity: .15 }));
  for (let i = 0; i < 11; i++) {
    const a = i * 2.399,
      h = .64 + (i % 5) * .13,
      x = Math.cos(a) * .26,
      z = Math.sin(a) * .26;
    tube(plant, [[0, .41, 0], [x * .4, .43 + h * .55, z * .4], [x, .43 + h, z]], .006, "#59664d");
    const leafGeo = geo(new PlaneGeometry(1, 1, 8, 16));
    const p = leafGeo.getAttribute("position");
    for (let j = 0; j < p.count; j++) {
      const t = p.getY(j) + .5, side = p.getX(j) * 2;
      p.setXYZ(j, side * .145 * Math.pow(Math.sin(t * Math.PI), .8), t * .51,
        Math.sin(t * Math.PI) * .068 - side * side * .03);
    }
    leafGeo.computeVertexNormals();
    const leaf = new Mesh(leafGeo, leafMaterial);
    leaf.position.set(x, .43 + h, z); leaf.rotation.set(1.1, a, 0);
    plant.add(leaf);
  }
  const shelf = box(
    architecture,
    [1.37, 0.07, 0.4],
    [5.03, 4.46, -2.55],
    walnut,
    0.02,
  );
  for (let i = 0; i < 7; i++) {
    const h = .35 + .04 * (i % 3);
    const volume = book(architecture, .075 + .01 * (i % 2), h, .23,
      [4.53 + i * .093, 4.495 + h / 2, -2.54], i);
    volume.rotation.z = i === 6 ? -.12 : 0;
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
      const volume = book(bookcase, .09, h, .28, [-.035, .09 + row * .59 + h / 2, -1.2 + i * .118], i + row);
      volume.rotation.y = -Math.PI / 2;
      if (i === 11) volume.rotation.x = -.10;
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
    const batches = new Map<SurfaceMaterial, Mesh[]>();
    const collect = (object: Object3D) => {
      if (object !== parent && animatedRoots.has(object)) return;
      if (
        object instanceof Mesh &&
        !(object instanceof InstancedMesh) &&
        !independent.has(object) &&
        (object.material instanceof MeshBasicMaterial || object.material instanceof MeshStandardMaterial) &&
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
          (m.material instanceof MeshBasicMaterial || m.material instanceof MeshStandardMaterial) &&
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
    reflectionTexture: probe.texture,
    print(onComplete: () => void) {
      printAnimation?.pause();
      printPaper.visible = true;
      printPaper.position.z = 0.36;
      printPaper.scale.y = 0.01;
      if (reduced.matches) {
        printPaper.position.z = 0.77;
        printPaper.scale.y = 1;
        onComplete();
        return;
      }
      printAnimation = createTimeline({ defaults: { ease: "inOut(2)" } })
        .add(printPaper.scale, { y: 1, duration: 900 }, 0)
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
      probe.dispose();
    },
  };
}
