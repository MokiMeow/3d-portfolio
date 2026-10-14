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
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Texture,
  TextureLoader,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
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
import { RECORD_ARM } from "~/utils/room-mechanics";
import { createRecordCue } from "~/utils/record-cue";
import { NEWSPAPER_COVER } from "~/static/newspaper.static";
import { buildGameCorner } from "./scene-1.game-corner";

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
  const textures = new Set<Texture>();
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
  let pillowAnimation: { pause: () => unknown } | undefined;
  let stoolAnimation: { pause: () => unknown } | undefined;
  let printedStudy = -1;
  const ink = "#292d2c",
    walnut = "#895d44",
    brass = "#b19969";
  const shelfCenterX = 5.45;

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
      ctx.fillStyle = i % 8 ? "#ece8dc30" : "#827c7220";
      ctx.fillRect(i, 0, 1, 512); ctx.fillRect(0, i, 512, 1);
      for (let j = 0; j < 512; j += 8) {
        ctx.fillStyle = (i + j) % 16 ? "#fffaed18" : "#625c5214";
        ctx.fillRect(i, j, 2, 2);
      }
    }
  });
  linen.wrapS = linen.wrapT = RepeatWrapping;
  linen.repeat.set(3, 3);
  for (const color of ["#464748", "#686260", "#b6906c", "#8c8986", "#c0b6a0", "#cbb78f", "#b6ad98", "#9b9d85", "#687562"]) {
    const material = lightMaterial(new MeshStandardMaterial({
      color: new Color(color).convertLinearToSRGB(), map: linen, bumpMap: linen,
      bumpScale: .0006, roughness: .96, envMap: probe.texture, envMapIntensity: .12,
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
  const pageEdges = canvasTexture(512, 256, ctx => {
    ctx.fillStyle = '#d2c9b4'; ctx.fillRect(0,0,512,256);
    for(let x=0;x<512;x+=2){
      ctx.fillStyle=x%14===0?'#9c917c':x%6?'#ded5bf':'#bcb39e';
      ctx.fillRect(x,0,1,256);
    }
    const shade=ctx.createLinearGradient(0,0,0,256);
    shade.addColorStop(0,'#5a493227');shade.addColorStop(.18,'#fff5df11');shade.addColorStop(.8,'#fff5df00');shade.addColorStop(1,'#5a493230');
    ctx.fillStyle=shade;ctx.fillRect(0,0,512,256);
  });
  const pageMat = lightMaterial(new MeshStandardMaterial({map:pageEdges,roughness:.94,bumpMap:pageEdges,bumpScale:.0006,envMap:probe.texture,envMapIntensity:.1,side:DoubleSide}));
  pageMat.color.setRGB(.59,.57,.53);
  const bookCovers = canvasTexture(1024,1024,ctx=>{
    const titles=[['WAYS OF','SEEING'],['FORM','& FIELD'],['GRID','SYSTEMS'],['DESIGN','NOTES'],['TYPE','/ SPACE'],['COLOUR','STUDIES'],['THE','CREATIVE ACT'],['OBJECTS','& IDEAS']];
    const colors=['#81513c','#b6a589','#354c56','#3a3939','#887a65'];
    for(let i=0;i<8;i++){
      ctx.save();ctx.translate((i%4)*256,Math.floor(i/4)*512);
      ctx.fillStyle=colors[i%5];ctx.fillRect(0,0,256,512);
      ctx.fillStyle='#ece0c4';ctx.font='11px monospace';ctx.fillText('MOHITH / STUDIO LIBRARY',22,35);
      ctx.font='bold 29px Georgia';titles[i].forEach((line,row)=>ctx.fillText(line,22,97+row*36));
      ctx.strokeStyle='#e2d4b27a';ctx.lineWidth=1;
      for(let k=0;k<7;k++){ctx.beginPath();ctx.arc(128,298,25+k*11,(i%3)*.4,Math.PI*1.75);ctx.stroke()}
      ctx.fillStyle='#c5b284';ctx.fillRect(21,438,214,1);
      ctx.font='11px monospace';ctx.fillText('NOTES ON THE WAY WE SEE',22,465);
      ctx.fillText('ED. '+String(i+1).padStart(2,'0'),22,490);
      const hinge=ctx.createLinearGradient(0,0,20,0);hinge.addColorStop(0,'#0005');hinge.addColorStop(.6,'#0000');hinge.addColorStop(1,'#fff1');
      ctx.fillStyle=hinge;ctx.fillRect(0,0,20,512);
      ctx.restore();
    }
  });
  const coverMat=lightMaterial(new MeshStandardMaterial({map:bookCovers,roughness:.83,envMap:probe.texture,envMapIntensity:.13,side:DoubleSide}));
  const book = (parent: Object3D, w: number, h: number, d: number, position: number[], index: number) => {
    const group = new Group(); group.position.fromArray(position); parent.add(group);
    const color = ["#81513c", "#b6a589", "#354c56", "#3a3939", "#887a65"][index % 5];
    for (const x of [-w / 2 + .003, w / 2 - .003])
      box(group, [.006, h, d], [x, 0, 0], color, .002);
    box(group, [w, h, .017], [0, 0, d / 2 - .008], color, .006);
    box(group, [w - .014, h - .017, d - .028], [0, 0, -.005], "#c4baa3", .002);
    const foreedge=panel(group,w-.015,h-.019,[0,0,-d/2+.009],pageMat);foreedge.rotation.y=Math.PI;
    for(const side of [-1,1]){
      const pages=panel(group,w-.015,d-.032,[0,side*(h/2-.008),-.006],pageMat);pages.rotation.x=side*-Math.PI/2;
      const coverGeo=geo(new PlaneGeometry(d,h));
      const coverUv=coverGeo.getAttribute('uv');
      for(let j=0;j<coverUv.count;j++)coverUv.setXY(j,(index%4+coverUv.getX(j))/4,(1-Math.floor(index%8/4)+coverUv.getY(j))/2);
      const cover=new Mesh(coverGeo,coverMat);cover.position.x=side*(w/2+.0005);cover.rotation.y=side*Math.PI/2;group.add(cover);
      // Cloth hinges and an inset headband make the book read as bound pages.
      tube(group,[[side*(w/2-.007),-h/2+.014,d/2-.022],[side*(w/2-.007),h/2-.014,d/2-.022]],.0015,'#514435');
      box(group,[w-.013,.003,.008],[0,side*(h/2-.007),d/2-.021],'#a49778',.001);
    }
    if(index%3===0){
      const ribbon=box(group,[.007,h*.15,.0015],[w*.2,-h*.49,-d/2+.021],'#a2553c');
      ribbon.rotation.z=.09;
    }
    const geometry = geo(new PlaneGeometry(w, h));
    const uv = geometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setX(i, (index % 8 + uv.getX(i)) / 8);
    const spine = new Mesh(geometry, bookSpineMat); spine.position.z = d / 2 + .001; group.add(spine);
    return group;
  };

  // Replace the three baked shelf books in exactly their original footprints.
  const originalBooks = new Group(); originalBooks.position.x = -root.position.x;
  originalBooks.name='original_shelf_books'; root.add(originalBooks);
  const oldShelfBookA=book(originalBooks,.052,.65,.725,[-2.876,4.295,2.739],0);
  oldShelfBookA.rotation.z=Math.PI/2;
  const oldShelfBookB=book(originalBooks,.052,.59,.55,[-2.895,3.956,-.139],3);
  oldShelfBookB.rotation.set(0,-.06,Math.PI/2);
  const oldShelfBookC=book(originalBooks,.13,.54,.52,[-2.858,4.047,.027],2);
  oldShelfBookC.rotation.set(0,.12,Math.PI/2);

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
  for (const color of ["#514d4a", "#484443", "#494645", "#55504e"]) {
    materialCache.set(color + true, lightMaterial(new MeshStandardMaterial({
      color: new Color(color).convertLinearToSRGB(),
      roughness: .96, envMap: probe.texture, envMapIntensity: .18,
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
  panel(architecture, 1.5, 1.7, [shelfCenterX, 3.56, -2.795], wallWashMaterial);
  box(architecture, [1.2, .014, .14], [shelfCenterX, 4.417, -2.55], "#edb67b");

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
  artCanvas.width = 1960;
  artCanvas.height = 1372;
  const artTexture = new CanvasTexture(artCanvas);
  artTexture.anisotropy = Math.min(8, finishes.renderer.capabilities.getMaxAnisotropy());
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
      ctx.strokeStyle = y % 9 ? "#8b858112" : "#191b1b18";
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
  // A fabricated desktop photo printer: the exit is a real opening between
  // two shells, with a recessed roller bank and an articulated output tray.
  const shell = '#c1c0bb', chassis = '#303335', trim = '#747a7b';
  for (const x of [-.43, .43]) for (const z of [-.34, .34])
    cylinder(press, .046, .026, [x, .8, z], '#202325');
  box(press, [1.095, .079, .94], [0, .84, 0], chassis, .027);
  box(press, [1.05, .026, .88], [0, .81, 0], '#15191b', .012);
  for (const x of [-.501, .501])
    box(press, [.09, .275, .92], [x, .975, 0], shell, .025);
  box(press, [.95, .255, .085], [0, .977, -.414], chassis, .02);
  box(press, [.925, .029, .80], [0, .889, -.03], '#171b1d', .008);
  box(press, [.955, .115, .102], [0, 1.023, .39], shell, .014);
  // Lip, dark cavity and separable paper cassette below the mouth.
  box(press, [.922, .016, .072], [0, .963, .405], trim, .006);
  box(press, [.907, .014, .07], [0, .88, .413], '#83898a', .006);
  for (const x of [-.34, -.17, 0, .17, .34]) {
    const roller = cylinder(press, .027, .095, [x, .922, .347], '#292c2d');
    roller.rotation.z = Math.PI / 2;
    for (const dx of [-.03, -.015, 0, .015, .03])
      cylinder(press, .028, .003, [x + dx, .922, .347], '#414648').rotation.z = Math.PI / 2;
  }
  const tray = box(press, [.887, .023, .49], [0, .86, .622], chassis, .014);
  clickable(tray, 'print');
  box(press, [.80, .012, .18], [0, .85, .88], '#484d4e', .009);
  box(press, [.80, .031, .018], [0, .869, .968], '#555b5c', .007);
  for (const x of [-.40, .40]) {
    box(press, [.015, .032, .44], [x, .884, .63], trim, .004);
    cylinder(press, .017, .015, [x, .87, .849], '#a2a6a4').rotation.z = Math.PI / 2;
  }
  for (let i = -3; i <= 3; i++)
    box(press, [.005, .002, .42], [i * .095, .873, .62], '#5c6263', .001);

  box(press, [1.037, .012, .875], [0, 1.103, -.008], '#272b2d', .009);
  const lid = box(press, [1.052, .064, .88], [0, 1.142, -.008], shell, .026);
  clickable(lid, 'print');
  // Recessed rear feeder, paper stock, guide rails and fine registration marks.
  box(press, [.79, .016, .27], [-.045, 1.177, -.196], chassis, .011);
  const feeder = new Group(); feeder.position.set(-.045, 1.185, -.32);
  feeder.rotation.x = -.23; press.add(feeder);
  box(feeder, [.735, .256, .026], [0, .115, 0], trim, .012);
  for (let i = 0; i < 5; i++)
    box(feeder, [.61, .232, .0015], [0, .116 + i * .001, .018 + i * .0018], i % 2 ? '#cfcdc5' : '#e2e0d8');
  for (const x of [-.325, .325]) box(feeder, [.024, .09, .04], [x, .021, .02], '#272c2e', .005);
  for (let i = 0; i < 23; i++)
    box(press, [.0018, .001, i % 5 ? .013 : .025], [-.355 + i * .027, 1.177, -.018], '#747a79');

  const controls = new Group(); controls.position.set(.15, 1.18, .225);
  controls.rotation.x = -.16; press.add(controls);
  box(controls, [.55, .018, .192], [0, 0, 0], '#343a3c', .016);
  const display = canvasTexture(640, 320, ctx => {
    ctx.fillStyle = '#18262e'; ctx.fillRect(0, 0, 640, 320);
    ctx.fillStyle = '#9abfce'; ctx.font = '500 28px monospace'; ctx.fillText('FORM PRESS  /  01', 28, 44);
    ctx.fillStyle = '#edf2ec'; ctx.font = '500 56px sans-serif'; ctx.fillText('Ready to print', 28, 130);
    ctx.fillStyle = '#8aabb8'; ctx.font = '25px monospace'; ctx.fillText('A6  ·  MATTE  ·  600 DPI', 28, 182);
    ctx.fillStyle = '#38545e'; ctx.fillRect(28, 215, 584, 2);
    for(let i=0;i<4;i++){ctx.fillStyle=['#65a9c1','#b16f83','#c5ad68','#7d8989'][i];ctx.fillRect(30+i*143,250,112,12)}
  });
  const printerStatus = (message: string) => {
    const ctx = (display.image as HTMLCanvasElement).getContext('2d')!;
    ctx.fillStyle='#18262e';ctx.fillRect(20,70,600,76);
    ctx.fillStyle='#edf2ec';ctx.font='500 56px sans-serif';ctx.fillText(message,28,130);
    display.needsUpdate=true;
  };
  panel(controls, .32, .16, [-.086, .0105, 0], textured(display)).rotation.x = -Math.PI/2;
  const printButton = cylinder(controls, .044, .009, [.204, .017, .027], '#a4b7b9');
  clickable(printButton, 'print');
  const powerIcon = label(controls, '↥', .04, .04, [.204, .023, .027], '#263237', 95);
  powerIcon.rotation.x = -Math.PI/2;
  clickable(powerIcon, 'print');
  cylinder(controls, .009, .005, [.204, .015, -.051], '#8abbc9');
  label(press, 'FORM  /  01', .29, .04, [-.276, 1.025, .442], '#434c4d', 36);
  label(press, 'PIGMENT INK  ·  A6', .32, .028, [.26, 1.025, .442], '#687071', 23);
  // Recessed side vents and screw heads on both sides, including the rear.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 17; i++)
      box(press, [.0025, .076, .007], [side * .548, .989, -.295 + i * .023], '#515759', .001);
    const service = panel(press, .20, .072, [side * .548, .883, -.02], textured(canvasTexture(256,96,ctx=>{
      ctx.fillStyle='#888b86';ctx.font='15px monospace';ctx.fillText('FP—01 / SERVICE',10,23);
      for(let i=0;i<55;i++){ctx.fillRect(10+i*4,38,i%3?1:2,35)}
    }),true)); service.rotation.y=side*Math.PI/2;
  }
  box(press, [.12, .053, .008], [.31, .951, -.462], '#111719', .006);
  tube(press, [[.31,.95,-.469],[.32,.9,-.48],[.34,.66,-.48],[.43,.35,-.47]], .009, '#252a2c');
  for(const x of [-.46,.46]) screw(press,[x,1.08,-.465],true);
  const printCanvas = document.createElement("canvas");
  printCanvas.width = artCanvas.width;
  printCanvas.height = artCanvas.height;
  const printTexture = new CanvasTexture(printCanvas);
  printTexture.anisotropy = artTexture.anisotropy;
  textures.add(printTexture);
  const printMat = textured(printTexture);
  printMat.color.copy(artMat.color);
  const printPaper = panel(press, 0.67, 0.47, [0, 0.892, 0.68], printMat);
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
  platter.name = 'record_platter';
  platter.position.set(-0.25, 1.12, 0);
  console.add(platter);
  clickable(cylinder(platter, 0.307, 0.016, [0, 0, 0], "#191d1b"), "sound");
  // Mipmapped grooves retain close-up detail without sub-pixel geometry shimmer.
  const grooveMap = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = "#191d1b";
    ctx.beginPath(); ctx.arc(256, 256, 255, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#343832"; ctx.lineWidth = 1;
    for (let r = 101; r < 249; r += 5) {
      ctx.beginPath(); ctx.arc(256, 256, r, 0, Math.PI * 2); ctx.stroke();
    }
  });
  const grooveMat = textured(grooveMap);
  grooveMat.transparent = true;
  grooveMat.depthWrite = false;
  const grooves = panel(platter, .614, .614, [0, .0085, 0], grooveMat);
  grooves.rotation.x = -Math.PI / 2;
  const vinylLabel = cylinder(platter, 0.097, 0.003, [0, 0.011, 0], "#b96545");
  clickable(vinylLabel, "sound");
  box(platter, [0.12, 0.004, 0.018], [0, 0.014, 0], "#dcc8a2");
  cylinder(platter, 0.011, 0.028, [0, 0.016, 0], brass);
  lathe(console, [[.28, 0], [.317, 0], [.32, .012], [.317, .032], [.28, .035]], [-.25, 1.075, 0], brass);
  for (const x of [-.68, .68]) for (const z of [-.29, .29]) screw(console, [x, 1.103, z]);
  const armPivot = new Group();
  armPivot.name = 'record_tonearm';
  armPivot.position.set(RECORD_ARM.x, RECORD_ARM.liftedY, RECORD_ARM.z);
  console.add(armPivot);
  const recordCue = createRecordCue(armPivot);
  cylinder(console, .065, .095, [RECORD_ARM.x, 1.145, RECORD_ARM.z], ink);
  cylinder(console, .022, .07, [RECORD_ARM.x, 1.21, RECORD_ARM.z], brass);
  tube(armPivot, [[0, 0, -.07], [0, .012, .1], [.05, .006, .3], [.14, 0, .48]], .013, brass);
  cylinder(armPivot, .05, .085, [0, 0, -.075], "#72746d").rotation.x = Math.PI / 2;
  box(armPivot, [0.08, 0.04, 0.11], [0.14, -0.009, 0.48], ink, 0.007);
  tube(armPivot, [[.14, -.018, .48], [.14, -.058, .5]], .0025, brass);
  tube(armPivot, [[.18, .01, .5], [.23, .02, .5], [.25, .038, .48]], .005, brass);
  // A fixed cueing rest supports the arm while the stylus hangs clear of the deck.
  cylinder(console, .022, .118, [RECORD_ARM.x + .087, 1.161, RECORD_ARM.z + .37], ink);
  tube(console, [[RECORD_ARM.x + .06, 1.242, RECORD_ARM.z + .37],
    [RECORD_ARM.x + .06, 1.224, RECORD_ARM.z + .37],
    [RECORD_ARM.x + .113, 1.224, RECORD_ARM.z + .37],
    [RECORD_ARM.x + .113, 1.242, RECORD_ARM.z + .37]], .004, brass);
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

  // Upholstery: a woven bump and a soft sheen, so the cushions read as cloth rather than painted blocks.
  const weave = canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 64; i += 4) {
      ctx.fillStyle = i % 8 ? "#9a9a9a" : "#646464";
      ctx.fillRect(i, 0, 2, 64);
      ctx.fillStyle = i % 8 ? "#6e6e6e" : "#929292";
      ctx.fillRect(0, i, 64, 1);
    }
  });
  weave.wrapS = weave.wrapT = RepeatWrapping;
  weave.repeat.set(14, 14);
  const fabrics = new Map<string, MeshPhysicalMaterial>();
  const fabric = (color: string, map?: Texture) => {
    const key = color + (map?.uuid ?? "");
    let cloth = fabrics.get(key);
    if (!cloth) {
      const base = new Color(color).convertLinearToSRGB();
      cloth = lightMaterial(new MeshPhysicalMaterial({
        color: map ? new Color(1, 1, 1) : base, ...(map ? { map } : {}),
        roughness: .96, metalness: 0,
        sheen: .85, sheenRoughness: .5, sheenColor: base.clone().lerp(new Color(1, 1, 1), .4),
        bumpMap: weave, bumpScale: .0032,
        envMap: probe.texture, envMapIntensity: .1,
      }));
      fabrics.set(key, cloth);
    }
    return cloth;
  };
  const upholster = (mesh: Mesh, color: string, map?: Texture) => { mesh.material = fabric(color, map); return mesh; };

  // Walnut sling frame, full back cushions, tufting buttons, a striped lumbar pillow and one slouched accent pillow.
  const sofa = new Group();
  sofa.position.set(5.12, FLOOR, 5.3);
  sofa.scale.setScalar(1.2);
  furniture.add(sofa);
  shadow(furniture, 5.12, 5.3, 2.05, 3.65);
  for (const x of [-0.5, 0.5])
    for (const z of [-1.01, 1.01]) {
      cylinder(sofa, 0.038, 0.24, [x, 0.12, z], walnut);
      // Brass ferrules where the legs meet the floor.
      cylinder(sofa, 0.041, 0.045, [x, 0.0225, z], brass);
    }
  box(sofa, [1.37, 0.12, 2.6], [0, 0.29, 0], walnut, 0.045);
  box(sofa, [1.22, 0.065, 2.4], [-.025, .368, 0], "#363832", .025);
  for(const y of [.55,.79,1.06])box(sofa,[.07,.105,2.46],[.615,y,0],walnut,.024);
  for (const z of [-1.19, 1.19]) {
    tube(sofa,[[-.59,.27,z],[-.61,.65,z],[-.49,.79,z],[.51,.79,z],[.61,.71,z],[.615,.3,z]],.043,walnut);
    upholster(box(sofa,[1.19,.19,.245],[-.035,.79,z],"#9b9d85",.085), "#9b9d85");
  }
  for (const z of [-0.55, 0.55]) {
    upholster(box(sofa, [1.12, 0.27, 1.035], [-0.065, 0.515, z], "#b6ad98", 0.11), "#b6ad98");
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
    upholster(cushion, "#b6ad98");
    // Two covered buttons pull each back cushion in, the way a real one is tufted.
    for (const along of [-.24, .24]) ball(sofa, [.012, .024, .024], [.222, .99, z + along], "#a39a86");
    // Welt follows the pillow's softened perimeter and tilts with it.
    const welt = seam(sofa, .82, .46, .09, "#c0b6a0");
    welt.geometry.rotateY(-Math.PI / 2).translate(-.146, 0, 0).rotateZ(-.12).translate(.365, .95, z);
  }
  const accentPillow=upholster(box(sofa,[.25,.44,.48],[.08,.89,-.77],"#687562",.105), "#687562");
  // A small striped lumbar pillow in the print's clay and ink, leaning in the other corner.
  const stripes = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#e6dcc8";
    ctx.fillRect(0, 0, 128, 128);
    for (const [y, h, colour] of [[14, 10, "#b96345"], [30, 3, "#292c28"], [60, 16, "#b96345"], [82, 3, "#292c28"], [104, 10, "#b96345"]] as const) {
      ctx.fillStyle = colour;
      ctx.fillRect(0, y, 128, h);
    }
  });
  const lumbar = upholster(box(sofa, [.17, .3, .56], [.17, .82, .66], "#e6dcc8", .075), "#e6dcc8", stripes);
  lumbar.rotation.set(-.06, .07, -.2);
  accentPillow.rotation.set(.17,-.1,.13);
  let pillowTurned = false, stoolTurned = false;
  selectables.push({ object: accentPillow, onSelect: () => {
    pillowTurned = !pillowTurned;
    pillowAnimation?.pause();
    pillowAnimation = createTimeline({ defaults: { duration: reduced.matches ? 0 : 650, ease: "out(3)" } })
      .add(accentPillow.position, { x: pillowTurned ? .23 : .08, y: pillowTurned ? .83 : .89, z: pillowTurned ? -.64 : -.77 }, 0)
      .add(accentPillow.rotation, { x: pillowTurned ? .36 : .17, z: pillowTurned ? -.16 : .13 }, 0);
  }});
  selectables.push({ object: stool, outline: false, onSelect: () => {
    stoolTurned = !stoolTurned;
    stoolAnimation?.pause();
    stoolAnimation = createTimeline({ defaults: { duration: reduced.matches ? 0 : 800, ease: "inOut(3)" } })
      .add(stool.position, { z: stoolTurned ? 2.55 : 2.18 }, 0)
      .add(stool.rotation, { y: stoolTurned ? .35 : 0 }, 0);
  }});
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
  sofa.add(new Mesh(blanketGeo, fabric("#c0b6a0")));
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
  // Three thin double-sided sheets; keep the cup beside the readable cover.
  const newspaper = new Group();
  newspaper.position.set(-.105, .679, -.065);
  newspaper.rotation.y = -.19;
  sideTable.add(newspaper);
  for (let i = 0; i < 3; i++) {
    const page = box(newspaper, [.305, .002, .457], [i * .0015, i * .0025, 0], i % 2 ? '#d4d1c9' : '#e7e5df');
    page.rotation.y = i * .005;
  }
  // Reuse the exact front page without stretching it. This small, optional image
  // never gates entry to the room; delayed loading also respects scene disposal.
  const newsMaterial = lightMaterial(new MeshBasicMaterial({ color: '#e7e5df', side: DoubleSide }));
  const newsTexture = new TextureLoader().load(NEWSPAPER_COVER, texture => {
    if (disposed) { texture.dispose(); return; }
    texture.anisotropy = Math.min(8, finishes.renderer.capabilities.getMaxAnisotropy());
    newsMaterial.map = texture;
    newsMaterial.color.set('#ffffff');
    newsMaterial.needsUpdate = true;
  });
  textures.add(newsTexture);
  const cover = panel(newspaper, .305, .457, [.003, .0078, 0], newsMaterial);
  cover.rotation.x = -Math.PI / 2;
  clickable(cover, 'newspaper');
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
  const earth = cylinder(plant, .207, .016, [0, .409, 0], '#30281f');
  const soilTexture = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#3a3026'; ctx.fillRect(0, 0, 256, 256);
    // Broad, low-contrast colour patches survive minification without glitter.
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = ['#40352a', '#332b22', '#45392c'][i % 3];
      ctx.beginPath(); ctx.ellipse((i * 73) % 256, (i * 113) % 256, 9 + i % 8, 5 + i % 6, i, 0, Math.PI * 2); ctx.fill();
    }
  });
  earth.material = lightMaterial(new MeshStandardMaterial({ map: soilTexture, roughness: 1 }));
  const crumbGeometry = geo(new IcosahedronGeometry(1, 1));
  const soilMaterials = ['#332b23', '#413429', '#514232', '#867a61'].map(color =>
    lightMaterial(new MeshStandardMaterial({ color: new Color(color).convertLinearToSRGB(), roughness: 1 })));
  for (let i = 0; i < 62; i++) {
    const angle = i * 2.39996, radius = .191 * Math.sqrt((i + .5) / 62);
    const crumb = new Mesh(crumbGeometry, soilMaterials[i % 17 === 0 ? 3 : i % 3]);
    const size = .008 + (i % 5) * .0016;
    crumb.position.set(Math.cos(angle) * radius, .419 + Math.sin(i * 3) * .002, Math.sin(angle) * radius);
    crumb.scale.set(size * 1.25, size * .52, size);
    crumb.rotation.set(i * .37, i, i * .71); plant.add(crumb);
  }
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
  box(
    architecture,
    [1.37, 0.07, 0.4],
    [shelfCenterX, 4.46, -2.55],
    walnut,
    0.02,
  );
  for (let i = 0; i < 7; i++) {
    const h = .35 + .04 * (i % 3);
    const volume = book(architecture, .075 + .01 * (i % 2), h, .23,
      [shelfCenterX - .5 + i * .093, 4.495 + h / 2, -2.54], i);
    volume.rotation.z = i === 6 ? -.12 : 0;
  }
  cylinder(architecture, 0.12, 0.23, [shelfCenterX + .44, 4.63, -2.54], "#c1a57d");
  // A low bookcase defines the listening nook without closing the view.
  // Its open end is the passage from the design bench into the new bay.
  const bookcase = new Group();
  bookcase.position.set(1.71, FLOOR, 5.9);
  furniture.add(bookcase);
  for (const z of [-1.42, 1.42]) box(bookcase, [.39, 1.3, .065], [0, .65, z], walnut);
  for (const y of [.06, .65, 1.3]) box(bookcase, [.42, .055, 2.9], [0, y, 0], walnut);
  // The room-facing side is a fluted walnut back; the game corner adds cubbies to it.
  const flutes = canvasTexture(512, 64, ctx => {
    for (let x = 0; x < 512; x += 16) {
      const slat = ctx.createLinearGradient(x, 0, x + 16, 0);
      slat.addColorStop(0, "#3e2a1f"); slat.addColorStop(.25, "#8a5f45"); slat.addColorStop(.6, "#7a5139"); slat.addColorStop(1, "#2c1d15");
      ctx.fillStyle = slat; ctx.fillRect(x, 0, 16, 64);
    }
  });
  flutes.wrapS = flutes.wrapT = RepeatWrapping;
  flutes.repeat.set(9, 1);
  const fluted = lightMaterial(new MeshStandardMaterial({ map: flutes, bumpMap: flutes, bumpScale: .004,
    roughness: .62, envMap: probe.texture, envMapIntensity: .2 }));
  box(bookcase, [.02, 1.24, 2.82], [.12, .66, 0], "#2a2725").material = fluted;
  const gameCorner = buildGameCorner(bookcase, {
    geo, lightMaterial, own: material => { materials.add(material); }, box, cylinder, ball, panel, canvasTexture, textured,
    clickable: mesh => clickable(mesh, "console"), envMap: probe.texture, walnut,
  });
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 12; i++) {
      const h = .29 + (i % 4) * .042;
      const volume = book(bookcase, .09, h, .28, [-.035, .09 + row * .59 + h / 2, -1.2 + i * .118], i + row);
      volume.rotation.y = -Math.PI / 2;
      if (i === 11) volume.rotation.x = -.10;
    }
  }
  shadow(furniture, 1.71, 5.9, .85, 3.3);

  // A quiet botanical field study beside the large composition.
  const sketches = canvasTexture(768, 896, ctx => {
    ctx.fillStyle = '#c9bc9f'; ctx.fillRect(0, 0, 768, 896);
    ctx.fillStyle = '#43483a'; ctx.font = '20px monospace'; ctx.fillText('FIELD STUDY / 01', 64, 81);
    ctx.font = 'italic 44px Georgia'; ctx.fillText('Ordinary, observed.', 64, 145);
    ctx.strokeStyle = '#596049'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(302, 753); ctx.bezierCurveTo(386, 602, 319, 406, 445, 237); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const x = 346 + Math.max(0, i - 2) * 17, y = 682 - i * 74, d = i % 2 ? 1 : -1;
      ctx.fillStyle = i % 2 ? '#727857' : '#596649'; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + d * 83, y + 20, x + d * 171, y - 53, x + d * 142, y - 111);
      ctx.bezierCurveTo(x + d * 40, y - 102, x + d * 22, y - 55, x, y); ctx.fill();
      ctx.strokeStyle = '#b5bb8b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + d * 52, y - 52, x + d * 134, y - 104); ctx.stroke();
    }
    ctx.strokeStyle = '#717360'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(440, 493); ctx.lineTo(646, 459); ctx.stroke();
    ctx.fillStyle = '#43483a'; ctx.font = '16px monospace'; ctx.fillText('light / leaf', 529, 440);
    ctx.fillRect(64, 808, 640, 1); ctx.font = '17px Georgia'; ctx.fillText('A little green, a little patience.', 64, 848);
  });
  const processSketch = panel(architecture, 1.12, 1.23, [.88, 3.55, -2.76], textured(sketches));
  processSketch.rotation.z = -.035;
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
    stool,
    originalBooks,
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
      const context = printCanvas.getContext("2d")!;
      context.clearRect(0, 0, printCanvas.width, printCanvas.height);
      context.drawImage(artCanvas, 0, 0);
      printTexture.needsUpdate = true;
      printedStudy = lastStudy;
      printerStatus('Printing…');
      printPaper.visible = true;
      printPaper.position.z = 0.36;
      printPaper.position.y = .905;
      printPaper.scale.y = 0.01;
      if (reduced.matches) {
        printPaper.position.z = 0.70;
        printPaper.position.y = .876;
        printPaper.scale.y = .47;
        printerStatus('Print ready');
        onComplete();
        return;
      }
      printAnimation = createTimeline({ defaults: { ease: "inOut(2)" } })
        .add(printPaper.scale, { y: .47, duration: 900 }, 0)
        .add(printPaper.position, { z: 0.70, duration: 900 }, 0)
        .add(printPaper.position, { y: .876, duration: 180 }, 880)
        .call(() => {
          if (!disposed) { printerStatus('Print ready'); onComplete(); }
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
    setSound(on: boolean, immediate = false) {
      recordOn = on;
      recordCue.setPlaying(on, reduced.matches || immediate);
    },
    update(delta: number) {
      recordCue.update(delta);
      gameCorner.update(delta);
      if (recordOn && !reduced.matches && !document.hidden)
        platter.rotation.y += Math.min(delta, 50) * 0.00349;
    },
    save() {
      (printedStudy >= 0 ? printCanvas : artCanvas).toBlob((blob) => {
        if (!blob || disposed) return;
        const url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = `mohith-form-study-${(printedStudy >= 0 ? printedStudy : lastStudy) + 1}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    },
    dispose() {
      disposed = true;
      printAnimation?.pause();
      pulseAnimation?.pause();
      pillowAnimation?.pause();
      stoolAnimation?.pause();
      root.removeFromParent();
      gameCorner.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      probe.dispose();
    },
  };
}
