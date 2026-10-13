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
import { createBootPlant } from "./companion-plant";
import gsap from "gsap";
import { dockTrackPose } from "~/utils/room-mechanics";
import { companionWave } from "~/utils/companion-wave";
import type { SelectableObject } from "~/common/models/experience-interaction.model";
import type { CompanionState } from "~/common/models/companion.model";

const GROUND = 0.035,
  DOCK = new Vector3(1.15, 0.197, 4.62),
  VISIT = new Vector3(1.15, GROUND, 6.24);
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
  let rightArm: Object3D | undefined, rightExtension: Object3D | undefined;
  let head: Object3D | undefined,
    neck: Object3D | undefined,
    upperNeck: Object3D | undefined,
    compartment: Object3D | undefined,
    bootPlant: Group | undefined,
    leftEye: Object3D | undefined,
    rightEye: Object3D | undefined;
  const neutral = new Map<Object3D, { x: number; y: number; z: number }>();
  const neutralPositions = new Map<Object3D, Vector3>();
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
    if (bootPlant) {
      gsap.killTweensOf(bootPlant.position);
      bootPlant.position.z = 0.025;
    }
    state.plantOpen = false;
    if (compartment) gsap.killTweensOf(compartment.rotation);
    for (const [node, v] of neutral) node.rotation.set(v.x, v.y, v.z);
    for (const [node, v] of neutralPositions) node.position.copy(v);
  };
  function dockRobot(silent = false) {
    if (!state.ready) return;
    motion?.kill();
    resetPose();
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
          z: DOCK.z,
          duration: reduced.matches ? 0 : 1.6,
          ease: "power2.inOut",
        },
        reduced.matches ? 0 : 0.45,
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
    state.caption = "";
    if (utterance && "speechSynthesis" in window) window.speechSynthesis.cancel();
    const hello = () => say(
      first
        ? "Hello! Welcome to Mohith’s lab."
        : "Hello again. Take your time.",
    );
    motion = gsap
      .timeline({
        onComplete: () => {
          if (disposed) return;
          if (state.phase === "greeting") state.phase = "visiting";
          if (first) dockRobot(true);
        },
      })
      .to(
        carriage.position,
        {
          x: VISIT.x,
          z: VISIT.z,
          duration: reduced.matches ? 0 : 1.5,
          ease: "power2.inOut",
        },
        0,
      )
      .to(
        carriage.rotation,
        { y: -0.15, duration: reduced.matches ? 0 : 0.9, ease: "power2.out" },
        reduced.matches ? 0 : 1.5,
      );
    if (!reduced.matches && rightArm)
      motion.add(companionWave(rightArm, rightExtension, hello), 1.5);
    else motion.call(hello, [], reduced.matches ? 0 : 1.5);
    if (!reduced.matches && leftEye && rightEye) {
      motion
        .to(leftEye.rotation, { z: -0.18, duration: 0.45 }, 0.5)
        .to(rightEye.rotation, { z: 0.18, duration: 0.45 }, 0.5)
        .to(leftEye.rotation, { z: -0.1, duration: 0.6 }, 1.25)
        .to(rightEye.rotation, { z: 0.1, duration: 0.6 }, 1.25);
    }
    // A moment to read the greeting before the automatic first-visit return.
    motion.to({}, { duration: .8 });
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
    greet();
  };
  const togglePlant = () => {
    if (!compartment || !state.ready) return;
    motion?.kill();
    for (const node of [rightArm, rightExtension]) {
      if (!node) continue;
      const pose = neutral.get(node), position = neutralPositions.get(node);
      if (pose) node.rotation.set(pose.x, pose.y, pose.z);
      if (position) node.position.copy(position);
    }
    if (state.phase === "greeting" || state.phase === "returning") state.phase = "visiting";
    state.plantOpen = !state.plantOpen;
    state.panel = true;
    gsap.to(compartment.rotation, {
      x: state.plantOpen ? (Math.PI * 95) / 180 : 0,
      duration: reduced.matches ? 0 : 0.85,
      ease: "power2.inOut",
      overwrite: true,
      delay: state.plantOpen || reduced.matches ? 0 : 0.25,
    });
    // Present the boot on the lowered hatch, then tuck it safely inside before closing.
    if (bootPlant)
      gsap.to(bootPlant.position, {
        z: state.plantOpen ? 0.18 : 0.025,
        duration: reduced.matches ? 0 : 0.4,
        delay: state.plantOpen && !reduced.matches ? 0.55 : 0,
        ease: "power2.inOut",
        overwrite: true,
      });
    if (state.plantOpen) say("A little green hope.", false);
  };
  selectables.push({
    object: dock,
    outline: false,
    onSelect: () => dockRobot(),
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
      const tracks = new Box3();
      robot.traverse((object) => {
        if (object instanceof Mesh && /track/i.test(object.name))
          tracks.expandByObject(object);
      });
      if (!tracks.isEmpty()) tracks.getCenter(center);
      robot.scale.multiplyScalar(scale);
      robot.position.set(
        -center.x * scale,
        -bounds.min.y * scale,
        -center.z * scale,
      );
      carriage.add(robot);
      bootPlant = createBootPlant();
      robot.add(bootPlant);
      selectables.push({ object: robot, outline: false, onSelect: interact });
      robot.traverse((object) => {
        const key = object.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (key === "controlheadpan") head = object;
        if (key === "controlneckpitch") neck = object;
        if (key === "controlupperneck") upperNeck = object;
        if (key === "controlcompactordoor") compartment = object;
        if (key === "controllefteyeroll") leftEye = object;
        if (key === "controlrighteyeroll") rightEye = object;
        if (key === "controlrightarmlift") rightArm = object;
        if (key === "controlrightarmextension") rightExtension = object;
        if (key.startsWith("control")) {
          neutral.set(object, {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
          });
          neutralPositions.set(object, object.position.clone());
        }
        if (object instanceof Mesh) {
          geometries.add(object.geometry);
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
      if (compartment)
        selectables.push({
          object: compartment,
          outline: false,
          onSelect: togglePlant,
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
  const headLocal = new Vector3();
  return {
    root,
    selectables,
    welcome,
    greet: () => greet(),
    dock: () => dockRobot(),
    farewell,
    togglePlant,
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
      const support = dockTrackPose(carriage.position.z - DOCK.z);
      carriage.position.y = support.y;
      carriage.rotation.x = support.pitch;
      shade.position.y = 0.004;
      if (!reduced.matches && head && neck) {
        head.updateWorldMatrix(true, false);
        camera.getWorldPosition(cameraLocal);
        head.getWorldPosition(headLocal);
        robot?.worldToLocal(cameraLocal);
        robot?.worldToLocal(headLocal);
        cameraLocal.sub(headLocal);
        const yaw = sleeping
          ? 0
          : Math.max(
              -1.05,
              Math.min(1.05, Math.atan2(cameraLocal.x, cameraLocal.z)),
            );
        const follow = 1 - Math.exp(-dt * 3.5);
        head.rotation.y += (yaw - head.rotation.y) * follow;
        const pitch = sleeping
          ? 0.36
          : Math.max(
              -0.9,
              Math.min(
                0.3,
                -Math.atan2(
                  cameraLocal.y,
                  Math.max(0.04, Math.hypot(cameraLocal.x, cameraLocal.z)),
                ),
              ),
            );
        neck.rotation.x += (pitch * 0.6 - neck.rotation.x) * follow;
        if (upperNeck)
          upperNeck.rotation.x += (pitch * 0.4 - upperNeck.rotation.x) * follow;
        if (leftEye && rightEye && state.phase !== "greeting") {
          leftEye.rotation.z +=
            ((sleeping ? 0.12 : -0.1 + Math.sin(elapsed * 0.8) * 0.012) -
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
      if (compartment) gsap.killTweensOf(compartment.rotation);
      if (bootPlant) gsap.killTweensOf(bootPlant.position);
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
