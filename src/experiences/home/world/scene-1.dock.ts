import {
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  LinearSRGBColorSpace,
  Texture,
  TubeGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DOCK_SURFACE, dockSurfaceHeight } from "~/utils/room-mechanics";

/** A small outdoor service bay. Static hardware is batched by finish (not one draw per bolt). */
export function createCompanionDock(env: Texture, night: { value: number }) {
  const root = new Group();
  root.name = "exterior_service_bay";
  const geometries: BufferGeometry[] = [],
    materials: (MeshStandardMaterial | MeshBasicMaterial)[] = [],
    textures: Texture[] = [];
  const batches = new Map<MeshStandardMaterial, BufferGeometry[]>();
  const finish = (color: string, metalness: number, roughness: number) => {
    const m = new MeshStandardMaterial({
      color,
      metalness,
      roughness,
      envMap: env,
      envMapIntensity: 0.55,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uDockNight = night;
      shader.fragmentShader =
        "uniform float uDockNight;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight = sRGBTransferOETF(vec4(outgoingLight * mix(vec3(1.),vec3(.07,.1,.17),uDockNight),1.)).rgb;\n#include <opaque_fragment>",
      );
    };
    m.customProgramCacheKey = () => "dock-display-colour-v1";
    materials.push(m);
    batches.set(m, []);
    return m;
  };
  const graphite = finish("#353438", 0.65, 0.38),
    shell = finish("#68635f", 0.45, 0.47),
    rubber = finish("#1c1d1f", 0.05, 0.83),
    brass = finish("#8c7769", 0.8, 0.31),
    steel = finish("#818388", 0.85, 0.3),
    concrete = finish("#555257", 0, 0.95);
  const add = (
    g: BufferGeometry,
    p: number[],
    m: MeshStandardMaterial,
    rotation: number[] = [0, 0, 0],
  ) => {
    g.rotateX(rotation[0]);
    g.rotateY(rotation[1]);
    g.rotateZ(rotation[2]);
    g.translate(p[0], p[1], p[2]);
    batches.get(m)!.push(g);
  };
  const box = (
    s: number[],
    p: number[],
    m: MeshStandardMaterial,
    r = 0.012,
    rotation?: number[],
  ) => add(new RoundedBoxGeometry(s[0], s[1], s[2], 2, r), p, m, rotation);
  const cylinder = (
    radius: number,
    height: number,
    p: number[],
    m: MeshStandardMaterial,
    sides = 16,
    rotation?: number[],
  ) => add(new CylinderGeometry(radius, radius, height, sides), p, m, rotation);
  const bolt = (x: number, y: number, z: number) => {
    cylinder(0.022, 0.007, [x, y, z], steel, 6);
    box([0.021, 0.002, 0.003], [x, y + 0.004, z], rubber, 0.001);
  };
  // The paver reaches the ground. A separate front apron makes the ramp legible in every view.
  box([1.88, 0.035, 3.04], [0, 0.0175, 0.48], concrete, 0.035);
  box([1.62, 0.09, 1.58], [0, 0.08, 0], graphite, 0.035);
  box([1.65, 0.018, 1.62], [0, 0.128, 0], shell, 0.017);
  box([1.54, 0.034, 1.48], [0, 0.153, 0], rubber, 0.017);
  // Two independent tread cradles, with ribbed grip and metallic retention lips.
  for (const x of [-0.358, 0.358]) {
    box([0.42, 0.018, 1.16], [x, 0.178, 0.06], graphite, 0.014);
    for (let i = 0; i < 15; i++)
      box([0.36, 0.01, 0.013], [x, 0.192, -0.43 + i * 0.071], rubber, 0.003);
    for (const edge of [-0.205, 0.205])
      box([0.018, 0.035, 1.21], [x + edge, 0.19, 0.06], brass, 0.006);
    box([0.44, 0.105, 0.075], [x, 0.22, -0.54], rubber, 0.015);
    // The inclined shoe continues down to the apron instead of floating above it.
    const rise = DOCK_SURFACE.deck - DOCK_SURFACE.ground;
    const run = DOCK_SURFACE.end - DOCK_SURFACE.start;
    const incline = Math.atan2(rise, run);
    box([0.43, 0.018, Math.hypot(run, rise)],
      [x, (DOCK_SURFACE.deck + DOCK_SURFACE.ground) / 2 - .017, (DOCK_SURFACE.start + DOCK_SURFACE.end) / 2],
      graphite, 0.008, [incline, 0, 0]);
    for (let i = 0; i < 7; i++)
      box(
        [0.36, 0.009, 0.017],
        [x, dockSurfaceHeight(.64 + i * .09) - .004, .64 + i * .09],
        steel,
        0.003,
        [incline, 0, 0],
      );
  }
  for (const x of [-0.72, 0.72])
    for (const z of [-0.66, 0.66]) bolt(x, 0.174, z);
  // Low charging spine, gasket, replaceable service cover and recessed cooling slots.
  box([1.48, 0.54, 0.27], [0, 0.4, -0.63], graphite, 0.045);
  box([1.37, 0.42, 0.02], [0, 0.412, -0.776], rubber, 0.016);
  box([1.3, 0.365, 0.025], [0, 0.416, -0.793], shell, 0.015);
  for (let i = 0; i < 12; i++)
    box(
      [0.038, 0.19, 0.009],
      [-0.31 + i * 0.056, 0.435, -0.808],
      rubber,
      0.005,
    );
  for (const x of [-0.59, 0.59])
    for (const y of [0.29, 0.55])
      cylinder(0.016, 0.009, [x, y, -0.813], steel, 6, [Math.PI / 2, 0, 0]);
  // Spring-loaded contacts and flexible cable boots at the rear of each track.
  for (const x of [-0.41, 0.41]) {
    box([0.22, 0.23, 0.025], [x, 0.43, -0.483], rubber, 0.018);
    for (const offset of [-0.05, 0.05]) {
      cylinder(0.019, 0.09, [x + offset, 0.42, -0.434], brass, 16, [
        Math.PI / 2,
        0,
        0,
      ]);
      cylinder(0.029, 0.026, [x + offset, 0.42, -0.482], steel, 16, [
        Math.PI / 2,
        0,
        0,
      ]);
    }
  }
  // Side service pod, angled display, emergency isolation key and braided conduit.
  box([0.22, 0.49, 0.41], [0.69, 0.395, -0.47], shell, 0.035);
  box(
    [0.19, 0.065, 0.28],
    [0.69, 0.652, -0.45],
    graphite,
    0.017,
    [-0.28, 0, 0],
  );
  cylinder(0.039, 0.015, [0.69, 0.677, -0.35], brass, 24);
  cylinder(0.026, 0.019, [0.69, 0.69, -0.35], rubber, 24);
  for (let i = 0; i < 5; i++)
    box([0.008, 0.016, 0.16], [0.806, 0.36 + i * 0.032, -0.48], rubber, 0.002);
  const cable = new CatmullRomCurve3([
    new Vector3(0.75, 0.32, -0.72),
    new Vector3(0.85, 0.17, -0.82),
    new Vector3(0.78, 0.07, -0.94),
    new Vector3(-0.35, 0.07, -0.99),
    new Vector3(-0.69, 0.15, -0.73),
  ]);
  add(new TubeGeometry(cable, 32, 0.018, 8, false), [0, 0, 0], rubber);
  for (const x of [-0.48, 0.46])
    box([0.045, 0.038, 0.08], [x, 0.067, -0.968], steel, 0.005);
  // Inlaid numbered service tag and a narrow status light, never a billboard.
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#252c29";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.fillStyle = "#dfceb0";
  ctx.font = "bold 78px monospace";
  ctx.fillText("WALL·E", 45, 99);
  ctx.font = "30px monospace";
  ctx.fillStyle = "#a7b3a4";
  ctx.fillText("01 / CHARGING BAY", 48, 160);
  ctx.font = "21px monospace";
  ctx.fillText("MOHITH LAB   •   24V DC", 48, 208);
  for (let i = 0; i < 35; i++) ctx.fillRect(747 + i * 6, 54, (i % 3) + 1, 115);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = LinearSRGBColorSpace;
  textures.push(tex);
  const labelMat = new MeshBasicMaterial({ map: tex });
  materials.push(labelMat);
  const lg = new PlaneGeometry(0.64, 0.16);
  geometries.push(lg);
  const label = new Mesh(lg, labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.18, 0.43);
  root.add(label);
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 256;
  screenCanvas.height = 384;
  const sc = screenCanvas.getContext("2d")!;
  sc.fillStyle = "#18221d";
  sc.fillRect(0, 0, 256, 384);
  sc.fillStyle = "#adbb96";
  sc.font = "24px monospace";
  sc.fillText("DOCK / 01", 20, 44);
  sc.font = "bold 64px monospace";
  sc.fillText("24V", 20, 125);
  sc.strokeStyle = "#adbb96";
  sc.lineWidth = 4;
  sc.strokeRect(22, 156, 204, 59);
  for (let i = 0; i < 7; i++) sc.fillRect(29 + i * 27, 164, 21, 43);
  sc.font = "18px monospace";
  sc.fillText("DC · STANDBY", 20, 263);
  sc.fillText("TEMP  26°C", 20, 306);
  const screenTex = new CanvasTexture(screenCanvas);
  screenTex.colorSpace = LinearSRGBColorSpace;
  textures.push(screenTex);
  const screenMat = new MeshBasicMaterial({ map: screenTex });
  materials.push(screenMat);
  const screenGeo = new PlaneGeometry(0.14, 0.2);
  geometries.push(screenGeo);
  const screen = new Mesh(screenGeo, screenMat);
  screen.rotation.x = -Math.PI / 2 - 0.28;
  screen.position.set(0.69, 0.691, -0.465);
  root.add(screen);
  const led = new MeshBasicMaterial({ color: 0xa9c297 });
  materials.push(led);
  for (const x of [-0.735, 0.735]) {
    const g = new RoundedBoxGeometry(0.018, 0.016, 0.72, 2, 0.007);
    geometries.push(g);
    const light = new Mesh(g, led);
    light.position.set(x, 0.17, 0.01);
    root.add(light);
  }
  for (const [material, parts] of batches) {
    const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const geometry = mergeGeometries(flat);
    flat.forEach((g) => {
      if (!parts.includes(g)) g.dispose();
    });
    if (geometry) {
      geometries.push(geometry);
      root.add(new Mesh(geometry, material));
    }
    parts.forEach((g) => g.dispose());
  }
  return {
    root,
    led,
    dispose() {
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
