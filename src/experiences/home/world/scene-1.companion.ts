import {
  Box3,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
  Vector3,
  LinearSRGBColorSpace,
  type Camera,
  type BufferGeometry,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import gsap from "gsap";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import type { CompanionState } from "~/common/models/companion.model";

const FLOOR = 0.339813,
  DOCK = new Vector3(4.75, FLOOR + 0.088, 2.03),
  VISIT = new Vector3(5.2, FLOOR + 0.002, 3.13);
/** One articulated visitor, on a short clear route, never chasing the camera. */
export function createCompanion(
  scene: Group,
  env: Texture,
  night: { value: number },
  state: CompanionState,
  audible: () => boolean,
  ready: () => void,
) {
  const root = new Group(),
    carriage = new Group();
  root.name = "wall_e_companion";
  scene.add(root);
  root.add(carriage);
  carriage.position.copy(DOCK);
  const selectables: SelectableObject[] = [],
    geometries = new Set<BufferGeometry>(),
    materials = new Set<MeshStandardMaterial | MeshBasicMaterial>(),
    textures = new Set<Texture>();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    pendingWelcome = false,
    welcomed = false,
    sleeping = false,
    elapsed = 0,
    captionTimer: ReturnType<typeof setTimeout> | undefined;
  let motion: gsap.core.Timeline | undefined,
    robot: Group | undefined,
    utterance: SpeechSynthesisUtterance | undefined;
  let head: Object3D | undefined,
    neck: Object3D | undefined,
    leftEye: Object3D | undefined,
    rightEye: Object3D | undefined,
    leftArm: Object3D | undefined,
    rightArm: Object3D | undefined;
  const neutral = new Map<Object3D, { x: number; y: number; z: number }>();
  const tint = (m: MeshStandardMaterial | MeshBasicMaterial) => {
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCompanionNight = night;
      shader.fragmentShader =
        "uniform float uCompanionNight;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "outgoingLight *= mix(vec3(1.), vec3(.21,.26,.38), uCompanionNight);\n#include <opaque_fragment>",
      );
    };
    m.customProgramCacheKey = () => "wall-e-room-night";
    materials.add(m);
    return m;
  };
  const surface = (color: string, metalness = 0) =>
    tint(
      new MeshStandardMaterial({
        color: new Color(color).convertLinearToSRGB(),
        roughness: 0.55,
        metalness,
        envMap: env,
        envMapIntensity: 0.3,
      }),
    );
  const dock = new Group();
  dock.position.set(DOCK.x, FLOOR, DOCK.z);
  root.add(dock);
  const shape = (
    parent: Object3D,
    size: number[],
    position: number[],
    mat: MeshStandardMaterial | MeshBasicMaterial,
    r = 0.025,
  ) => {
    const g = new RoundedBoxGeometry(size[0], size[1], size[2], 2, r);
    geometries.add(g);
    const m = new Mesh(g, mat);
    m.position.fromArray(position);
    parent.add(m);
    return m;
  };
  const graphite = surface("#363c37"),
    walnut = surface("#79533b"),
    brass = surface("#ae966c", 0.6);
  const base = shape(dock, [1.24, 0.075, 1.12], [0, 0.038, 0], graphite);
  shape(dock, [1.29, 0.025, 1.17], [0, 0.015, 0], walnut, 0.012);
  for (const x of [-0.38, 0.38]) {
    shape(dock, [0.12, 0.013, 0.77], [x, 0.083, 0.03], brass, 0.006);
    shape(dock, [0.13, 0.17, 0.07], [x, 0.125, -0.47], graphite, 0.018);
  }
  const ledMat = new MeshBasicMaterial({ color: 0xd9b66f });
  materials.add(ledMat);
  shape(dock, [0.26, 0.018, 0.012], [0, 0.052, 0.568], ledMat, 0.005);
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512;
  labelCanvas.height = 96;
  const ctx = labelCanvas.getContext("2d")!;
  ctx.fillStyle = "#282e29";
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#c4b38c";
  ctx.font = "28px monospace";
  ctx.textAlign = "center";
  ctx.fillText("WALL·E / HOME", 256, 58);
  const labelTexture = new CanvasTexture(labelCanvas);
  textures.add(labelTexture);
  const labelGeo = new PlaneGeometry(0.58, 0.108);
  geometries.add(labelGeo);
  const labelMat = new MeshBasicMaterial({ map: labelTexture });
  materials.add(labelMat);
  const label = new Mesh(labelGeo, labelMat);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.085, 0.42);
  dock.add(label);
  // Soft contact shade, shared floor level, no realtime shadow pass.
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const cx = c.getContext("2d")!;
  const grad = cx.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, "#00000080");
  grad.addColorStop(1, "#00000000");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 64, 64);
  const shadowTex = new CanvasTexture(c);
  textures.add(shadowTex);
  const shadowMat = new MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  });
  materials.add(shadowMat);
  const shadowGeo = new PlaneGeometry(1.5, 1.5);
  geometries.add(shadowGeo);
  const shade = new Mesh(shadowGeo, shadowMat);
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = -0.064;
  carriage.add(shade);
  const say = (text: string, spoken = true) => {
    state.caption = text;
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => {
      if (!disposed) state.caption = "";
    }, 5500);
    if (spoken && audible() && "speechSynthesis" in window) {
      if (utterance) window.speechSynthesis.cancel();
      utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.12;
      utterance.volume = 0.65;
      const voices = window.speechSynthesis.getVoices();
      utterance.voice =
        voices.find((v) => v.localService && v.lang.startsWith("en")) ?? null;
      window.speechSynthesis.speak(utterance);
    }
  };
  const resetPose = () => {
    for (const [node, v] of neutral) node.rotation.set(v.x, v.y, v.z);
  };
  function dockRobot(silent = false) {
    if (!state.ready) return;
    motion?.kill();
    state.phase = "returning";
    if (!silent) say("Back to my little corner.", false);
    motion = gsap
      .timeline({
        onComplete: () => {
          if (disposed) return;
          resetPose();
          state.phase = sleeping ? "sleeping" : "docked";
        },
      })
      .to(
        carriage.position,
        {
          x: DOCK.x,
          y: DOCK.y,
          z: DOCK.z,
          duration: reduced.matches ? 0 : 1.6,
          ease: "power2.inOut",
        },
        0,
      )
      .to(
        carriage.rotation,
        { y: 0, duration: reduced.matches ? 0 : 0.7, ease: "power2.out" },
        0,
      );
    if (robot) motion.to(robot.rotation, { z: 0, duration: 0.25 }, 0);
  }
  function greet(first = false) {
    if (!state.ready) {
      pendingWelcome = first;
      return;
    }
    sleeping = false;
    motion?.kill();
    resetPose();
    state.phase = "greeting";
    say(
      first
        ? "Hello! Welcome to Mohith’s lab."
        : "Hello again. Take your time.",
    );
    motion = gsap
      .timeline({
        onComplete: () => {
          if (disposed) return;
          state.phase = "visiting";
        },
      })
      .to(
        carriage.position,
        {
          x: VISIT.x,
          y: VISIT.y,
          z: VISIT.z,
          duration: reduced.matches ? 0 : 1.5,
          ease: "power2.inOut",
        },
        0,
      )
      .to(
        carriage.rotation,
        { y: -0.15, duration: reduced.matches ? 0 : 0.9, ease: "power2.out" },
        0,
      );
    if (!reduced.matches && leftArm) {
      const r = neutral.get(leftArm)!;
      motion
        .to(
          leftArm.rotation,
          { x: r.x - 1.1, z: r.z - 0.25, duration: 0.55, ease: "power2.out" },
          0.8,
        )
        .to(
          leftArm.rotation,
          {
            z: r.z + 0.08,
            duration: 0.25,
            repeat: 3,
            yoyo: true,
            ease: "sine.inOut",
          },
          1.35,
        )
        .to(leftArm.rotation, { x: r.x, z: r.z, duration: 0.5 }, 2.5);
    }
    if (!reduced.matches && leftEye && rightEye) {
      motion
        .to(leftEye.rotation, { z: 0.14, duration: 0.5 }, 0.5)
        .to(rightEye.rotation, { z: -0.14, duration: 0.5 }, 0.5);
    }
    if (first)
      motion.call(() => dockRobot(true), [], reduced.matches ? 2 : 4.5);
  }
  function welcome() {
    if (welcomed) return;
    welcomed = true;
    pendingWelcome = true;
    if (state.ready) {
      pendingWelcome = false;
      greet(true);
    }
  }
  function farewell() {
    sleeping = true;
    if (state.ready) {
      say("Thanks for visiting. See you soon!");
      dockRobot(true);
    }
  }
  const interact = () => {
    state.panel = true;
    if (state.phase === "docked" || state.phase === "sleeping") greet();
    else say("Just looking around with you.", false);
  };
  dock.traverse((object) => {
    if (object instanceof Mesh)
      selectables.push({ object, onSelect: () => dockRobot() });
  });
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
    "/models/wall-e-companion.glb",
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose();
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              for (const value of Object.values(m))
                if (value instanceof Texture) value.dispose();
              m.dispose();
            }
          }
        });
        return;
      }
      robot = gltf.scene;
      robot.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(robot),
        size = bounds.getSize(new Vector3()),
        center = bounds.getCenter(new Vector3());
      const scale = 1.17 / size.y;
      robot.scale.multiplyScalar(scale);
      robot.position.set(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      );
      carriage.add(robot);
      robot.traverse((object) => {
        const key = object.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (key === "controlheadpan") head = object;
        if (key === "controlneckpitch") neck = object;
        if (key === "controllefteyeroll") leftEye = object;
        if (key === "controlrighteyeroll") rightEye = object;
        if (key === "controlleftarmlift") leftArm = object;
        if (key === "controlrightarmlift") rightArm = object;
        if (key.startsWith("control"))
          neutral.set(object, {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
          });
        if (object instanceof Mesh) {
          geometries.add(object.geometry);
          selectables.push({ object, onSelect: interact });
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            if (
              !(material instanceof MeshStandardMaterial) ||
              materials.has(material)
            )
              continue;
            material.envMap = env;
            material.envMapIntensity = 0.38;
            material.color.convertLinearToSRGB();
            if (material.map) material.map.colorSpace = LinearSRGBColorSpace;
            if (material.emissiveMap)
              material.emissiveMap.colorSpace = LinearSRGBColorSpace;
            if (
              material instanceof MeshPhysicalMaterial &&
              material.transmission > 0
            ) {
              material.transmission = 0;
              material.transparent = true;
              material.opacity = 0.2;
              material.depthWrite = false;
            }
            for (const value of Object.values(material))
              if (value instanceof Texture && value !== env) {
                value.anisotropy = 4;
                textures.add(value);
              }
            tint(material);
          }
        }
      });
      state.ready = true;
      state.phase = "docked";
      ready();
      if (pendingWelcome) {
        pendingWelcome = false;
        greet(true);
      }
    },
    undefined,
    () => {
      if (!disposed) {
        state.failed = true;
        state.caption = "WALL·E is taking a little longer to arrive.";
      }
    },
  );
  const cameraLocal = new Vector3();
  return {
    root,
    selectables,
    welcome,
    greet: () => greet(),
    dock: () => dockRobot(),
    farewell,
    wake() {
      sleeping = false;
      if (state.ready) {
        state.phase = "docked";
        say("Lights on. Hello again.", false);
      }
    },
    update(delta: number, camera: Camera) {
      if (disposed || !state.ready || document.hidden) return;
      const dt = Math.min(delta, 50) / 1000;
      elapsed += dt;
      shade.position.y = FLOOR + 0.005 - carriage.position.y;
      if (!reduced.matches && head && neck) {
        carriage.updateMatrixWorld();
        camera.getWorldPosition(cameraLocal);
        carriage.worldToLocal(cameraLocal);
        const yaw = sleeping
          ? 0
          : Math.max(
              -0.65,
              Math.min(0.65, Math.atan2(cameraLocal.x, cameraLocal.z)),
            );
        const follow = 1 - Math.exp(-dt * 3.5);
        head.rotation.y += (yaw - head.rotation.y) * follow;
        const pitch = sleeping ? 0.36 : -0.06 + Math.sin(elapsed * 0.7) * 0.015;
        neck.rotation.x += (pitch - neck.rotation.x) * follow;
        if (leftEye && rightEye && state.phase !== "greeting") {
          leftEye.rotation.z +=
            ((sleeping ? -0.12 : 0.035 + Math.sin(elapsed * 0.8) * 0.018) -
              leftEye.rotation.z) *
            follow;
          rightEye.rotation.z +=
            (-leftEye.rotation.z - rightEye.rotation.z) * follow;
        }
      }
      ledMat.color.setHex(
        sleeping ? 0x58694c : state.phase === "docked" ? 0xa9c297 : 0xd9b66f,
      );
      if (
        !audible() &&
        utterance &&
        "speechSynthesis" in window &&
        window.speechSynthesis.speaking
      )
        window.speechSynthesis.cancel();
    },
    dispose() {
      disposed = true;
      motion?.kill();
      clearTimeout(captionTimer);
      if (utterance && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      state.ready = false;
    },
  };
}
