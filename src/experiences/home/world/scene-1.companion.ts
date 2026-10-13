import {
  Box3,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
  Vector3,
  FrontSide,
  type Camera,
  type BufferGeometry,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { createCompanionDock } from "./scene-1.dock";
import gsap from "gsap";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import type { CompanionState } from "~/common/models/companion.model";

const GROUND = 0.035,
  DOCK = new Vector3(1.15, 0.197, 4.62),
  VISIT = new Vector3(1.15, GROUND, 5.82);
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
        "outgoingLight = sRGBTransferOETF(vec4(outgoingLight * mix(vec3(1.), vec3(.07,.1,.17), uCompanionNight), 1.)).rgb;\n#include <opaque_fragment>",
      );
    };
    m.customProgramCacheKey = () => "wall-e-pbr-display-v2";
    materials.add(m);
    return m;
  };
  const chargingBay = createCompanionDock(env, night);
  const dock = chargingBay.root;
  dock.position.set(DOCK.x, 0, DOCK.z);
  root.add(dock);
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
    if (!silent) say("Heading back to my charging bay.", false);
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
            // Keep the GLTF's linear PBR factors and sRGB image tags intact.
            // This legacy room outputs linear display values: convert the lit result,
            // rather than lifting every dark material and texture before lighting.
            material.envMapIntensity = 0.55;
            if (
              material instanceof MeshPhysicalMaterial &&
              material.transmission > 0
            ) {
              material.transmission = 0;
              material.transparent = true;
              material.opacity = 0.055;
              material.side = FrontSide;
              material.clearcoat = 1;
              material.clearcoatRoughness = 0.12;
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
      // Follow the actual ramp, then the exterior apron; never float on the route.
      const ramp = Math.max(
        0,
        Math.min(1, (carriage.position.z - DOCK.z - 0.58) / 0.59),
      );
      carriage.position.y = DOCK.y + (GROUND - DOCK.y) * ramp;
      shade.position.y = 0.004;
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
      chargingBay.led.color.setHex(
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
      chargingBay.dispose();
      root.removeFromParent();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      state.ready = false;
    },
  };
}
